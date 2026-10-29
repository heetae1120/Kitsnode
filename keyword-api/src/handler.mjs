import { createHmac, randomUUID } from "node:crypto";

// Credential diagnostics contain fixed labels only, never credential values.
function credentialIssues(value) {
  if (!value || !value.trim()) return ["missing"];
  const issues = [];
  if (value !== value.trim()) issues.push("surrounding_whitespace");
  if (/[\r\n]|\\[rn]/.test(value)) issues.push("newline");
  if (/['"]/.test(value)) issues.push("quotes");
  if (/[^\x21-\x7e]/.test(value)) issues.push("non_header_character");
  return issues;
}

function maskDiagnostic(value, sensitive, maxLength) {
  if (typeof value === "number" && Number.isFinite(value)) value = String(value);
  if (typeof value !== "string") return null;
  // Redact BEFORE truncating so a key crossing the length limit cannot leak.
  const variants = [...new Set(sensitive.filter(Boolean).flatMap((item) => [
    item, encodeURIComponent(item), encodeURI(item),
    Buffer.from(item, "utf8").toString("base64"),
  ]))].sort((a, b) => b.length - a.length);
  for (const item of variants) value = value.split(item).join("[REDACTED]");
  return value
    .replace(/\b(?:X-API-KEY|X-Customer|X-Signature|X-Timestamp|Authorization)['"]?\s*[:=][^\r\n]*/gi, "[REDACTED_AUTH_HEADER]")
    .replace(/[\x00-\x1f\x7f-\x9f\u2028-\u202e\u2066-\u2069]/g, " ")
    .slice(0, maxLength);
}

async function readUpstreamError(response, sensitive) {
  const empty = { code: null, message: null };
  let reader;
  try {
    reader = response.body?.getReader();
    if (!reader) return { ...empty, parseStatus: "empty" };
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) return { ...empty, parseStatus: "too_large" };
      chunks.push(value);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      return { ...empty, parseStatus: "invalid_json" };
    // Only these two scalar fields are permitted. Never log payload or errors.
    return {
      code: maskDiagnostic(payload.code, sensitive, 80),
      message: maskDiagnostic(payload.message, sensitive, 500),
      parseStatus: "parsed",
    };
  } catch {
    return { ...empty, parseStatus: "unavailable" };
  } finally {
    if (reader) {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}

/** Server-only Naver adapter. Never import this module in browser components. */
export function createKeywordHandler({
  fetcher = fetch,
  now = () => Date.now(),
  maxRequests = 20,
  globalLimit = 60,
  cacheTtl = 600000,
  logger = (entry) => console.error(JSON.stringify(entry)),
} = {}) {
  const cache = new Map();
  const rates = new Map();
  let globalWindow = { start: 0, count: 0 };
  /**
   * @param {Request} request
   * @param {Record<string, string | undefined>} [env]
   * @param {string} [clientId]
   */
  return async function handle(
    request,
    env = process.env,
    clientId = "anonymous",
  ) {
    const origin = request.headers.get("origin");
    const allowed = (env.ALLOWED_ORIGINS || "https://heetae1120.github.io")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const cors = { Vary: "Origin", "Cache-Control": "no-store" };
    if (origin && allowed.includes(origin))
      cors["Access-Control-Allow-Origin"] = origin;
    const json = (value, status = 200, extra = {}) =>
      Response.json(value, { status, headers: { ...cors, ...extra } });
    if (origin && !allowed.includes(origin))
      return json(
        {
          code: "ORIGIN_NOT_ALLOWED",
          error: "허용되지 않은 사이트에서 보낸 요청입니다.",
        },
        403,
      );
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "600",
        },
      });
    if (request.method !== "GET")
      return json(
        { code: "METHOD_NOT_ALLOWED", error: "GET 요청만 지원합니다." },
        405,
        { Allow: "GET, OPTIONS" },
      );
    const params = new URL(request.url).searchParams;
    const mode = params.get("mode") || "keywords";
    if (!["keywords", "shopping"].includes(mode))
      return json(
        { code: "INVALID_MODE", error: "지원하지 않는 조회 유형입니다." },
        400,
      );
    const raw = params.get("keywords") || "";
    const seeds = [
      ...new Set(
        raw
          .split(/[,，\n]+/)
          .map((s) => s.replace(/\s+/g, ""))
          .filter(Boolean),
      ),
    ];
    if (
      raw.length > 300 ||
      !seeds.length ||
      seeds.length > 5 ||
      seeds.some((s) => s.length > 50 || /[\x00-\x1f\x7f]/.test(s))
    )
      return json(
        {
          code: "INVALID_KEYWORDS",
          error:
            "키워드를 쉼표로 구분해 1~5개 입력하세요. 각 키워드는 최대 50자입니다.",
        },
        400,
      );
    const key =
      mode === "shopping"
        ? env.NAVER_OPENAPI_CLIENT_ID
        : env.NAVER_SEARCHAD_API_KEY;
    const secret =
      mode === "shopping"
        ? env.NAVER_OPENAPI_CLIENT_SECRET
        : env.NAVER_SEARCHAD_SECRET_KEY;
    const customer =
      mode === "shopping" ? "shopping" : env.NAVER_SEARCHAD_CUSTOMER_ID;
    const credentials = mode === "keywords"
      ? {
          NAVER_SEARCHAD_API_KEY: credentialIssues(key),
          NAVER_SEARCHAD_SECRET_KEY: credentialIssues(secret),
          NAVER_SEARCHAD_CUSTOMER_ID: credentialIssues(customer),
        }
      : null;
    const diagnose = (reason, details = {}) => {
      const diagnosticId = randomUUID();
      try {
        logger({
          event: "naver_searchad_error",
          diagnosticId,
          reason,
          credentials,
          ...details,
        });
      } catch {
        // An observability failure must not change the API response.
      }
      return diagnosticId;
    };
    if (
      credentials && Object.values(credentials).some((issues) => issues.length)
    ) {
      const missing = Object.values(credentials).some((issues) =>
        issues.includes("missing"),
      );
      const diagnosticId = diagnose("invalid_credentials");
      return json(
        {
          code: missing ? "NOT_CONFIGURED" : "INVALID_AUTH_CONFIG",
          error: "서버의 검색광고 인증 환경변수를 확인해 주세요. 공백·줄바꿈·따옴표 없이 원문 값을 등록해야 합니다.",
          diagnosticId,
        },
        503,
      );
    }
    if (!key || !secret || !customer)
      return json(
        {
          code:
            mode === "shopping" ? "SHOPPING_NOT_CONFIGURED" : "NOT_CONFIGURED",
          error:
            mode === "shopping"
              ? "상품 수 자동 조회용 네이버 개발자센터 Client ID / Client Secret이 아직 서버에 설정되지 않았습니다. 검색광고 API 키와는 별도입니다."
              : "조회 서버에 네이버 API 인증 정보가 아직 설정되지 않았습니다.",
        },
        503,
      );
    const time = now();
    for (const [id, slot] of rates) {
      if (time - slot.start >= 60000) rates.delete(id);
    }
    const slot = rates.get(clientId) || { start: time, count: 0 };
    slot.count++;
    rates.set(clientId, slot);
    if (rates.size > 1000) rates.delete(rates.keys().next().value);
    if (slot.count > maxRequests)
      return json(
        {
          code: "RATE_LIMIT",
          error: "조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
        },
        429,
        { "Retry-After": "60" },
      );
    const cacheKey =
      mode + ":" + String(customer) + ":" + String(key) + ":" + seeds.join(",");
    const hit = cache.get(cacheKey);
    if (hit && time - hit.time < cacheTtl)
      return json({ ...hit.data, cached: true });
    if (time - globalWindow.start >= 60000)
      globalWindow = { start: time, count: 0 };
    globalWindow.count += mode === "shopping" ? seeds.length : 1;
    if (globalWindow.count > globalLimit)
      return json(
        {
          code: "RATE_LIMIT",
          error: "서버 조회 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
        },
        429,
        { "Retry-After": "60" },
      );
    try {
      if (mode === "shopping") {
        const responses = await Promise.all(
          seeds.map(async (keyword) => {
            const url = new URL(
              "https://openapi.naver.com/v1/search/shop.json",
            );
            url.searchParams.set("query", keyword);
            url.searchParams.set("display", "1");
            url.searchParams.set("start", "1");
            const res = await fetcher(url, {
              headers: {
                "X-Naver-Client-Id": key,
                "X-Naver-Client-Secret": secret,
              },
              signal: AbortSignal.timeout(8000),
              cache: "no-store",
            });
            if (!res.ok) return { error: res.status };
            const payload = await res.json();
            if (
              !Number.isSafeInteger(payload.total) ||
              payload.total < 0 ||
              payload.total > 1e12
            )
              throw new Error("invalid shopping response");
            return { keyword, count: payload.total };
          }),
        );
        const failed = responses.find((row) => "error" in row);
        if (failed)
          return json(
            {
              code: "SHOPPING_ERROR",
              error:
                "네이버 쇼핑 검색 API 요청에 실패했습니다. 개발자센터 키·쇼핑 검색 사용 권한·조회 한도를 확인해 주세요.",
            },
            failed.error === 429 ? 429 : 502,
          );
        const data = {
          source: "naver-shopping",
          products: responses,
          fetchedAt: new Date(time).toISOString(),
        };
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(cacheKey, { time, data });
        return json({ ...data, cached: false });
      }
      const timestamp = String(time);
      const path = "/keywordstool";
      const method = "GET";
      // Official SearchAd format: raw UTF-8 secret (no Base64 decoding),
      // millisecond timestamp, uppercase method, path WITHOUT query parameters.
      const signature = createHmac("sha256", secret)
        .update(`${timestamp}.${method}.${path}`, "utf8")
        .digest("base64");
      const url = new URL("https://api.searchad.naver.com" + path);
      url.searchParams.set("hintKeywords", seeds.join(","));
      url.searchParams.set("showDetail", "1");
      const response = await fetcher(url, {
        method,
        headers: {
          "X-Timestamp": timestamp,
          "X-API-KEY": key,
          "X-Customer": String(customer),
          "X-Signature": signature,
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!response.ok) {
        const status = response.status === 429 ? 429 : 502;
        const upstreamTime = Date.parse(response.headers.get("date") || "");
        const upstreamError = await readUpstreamError(response, [
          key, secret, String(customer), signature,
          env.NAVER_OPENAPI_CLIENT_ID, env.NAVER_OPENAPI_CLIENT_SECRET,
          raw, ...seeds, String(url),
        ]);
        const diagnosticId = diagnose("upstream_rejected", {
          upstreamStatus: response.status,
          upstreamError,
          signing: {
            algorithm: "HMAC-SHA256", encoding: "base64", method, path, timestamp,
          },
          // Approximate only: includes network latency and Date header rounding.
          clockSkewMs: Number.isFinite(upstreamTime) ? now() - upstreamTime : null,
        });
        return json(
          {
            diagnosticId,
            code:
              response.status === 401 || response.status === 403
                ? "NAVER_AUTH_ERROR"
                : response.status === 429
                  ? "NAVER_RATE_LIMIT"
                  : "NAVER_ERROR",
            error:
              response.status === 401 || response.status === 403
                ? "네이버 API 인증에 실패했습니다. 서버의 키·고객 ID·사용 권한을 확인해 주세요."
                : response.status === 429
                  ? "네이버 API 조회 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
                  : "네이버에서 검색량을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
          },
          status,
        );
      }
      const text = await response.text();
      if (text.length > 2000000) throw new Error("oversized");
      const payload = JSON.parse(text);
      if (!Array.isArray(payload.keywordList)) throw new Error("invalid");
      const count = (v) => {
        if (typeof v === "number")
          return Number.isSafeInteger(v) && v >= 0 ? v : null;
        if (typeof v === "string" && /^(?:\d+|<\s*\d+)$/.test(v.trim()))
          return v.trim();
        return null;
      };
      const clicks = (v) => {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : null;
      };
      const comp = (v) =>
        ({ high: "높음", mid: "중간", low: "낮음" })[v] ||
        (typeof v === "string" ? v.slice(0, 30) : "—");
      const seen = new Set();
      const keywords = [];
      for (const row of payload.keywordList) {
        if (
          !row ||
          typeof row.relKeyword !== "string" ||
          !row.relKeyword.trim() ||
          seen.has(row.relKeyword)
        )
          continue;
        seen.add(row.relKeyword);
        keywords.push({
          keyword: row.relKeyword.slice(0, 100),
          pcSearches: count(row.monthlyPcQcCnt),
          mobileSearches: count(row.monthlyMobileQcCnt),
          pcClicks: clicks(row.monthlyAvePcClkCnt),
          pcCtr: clicks(row.monthlyAvePcCtr),
          mobileCtr: clicks(row.monthlyAveMobileCtr),
          adDepth: clicks(row.plAvgDepth),
          mobileClicks: clicks(row.monthlyAveMobileClkCnt),
          competition: comp(row.compIdx),
        });
        if (keywords.length >= 1000) break;
      }
      const data = {
        source: "naver",
        queriedKeywords: seeds,
        fetchedAt: new Date(time).toISOString(),
        keywords,
        truncated: payload.keywordList.length > 1000,
      };
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(cacheKey, { time, data });
      return json({ ...data, cached: false });
    } catch (error) {
      return json(
        {
          code:
            error?.name === "TimeoutError"
              ? "NAVER_TIMEOUT"
              : "INVALID_UPSTREAM",
          error:
            error?.name === "TimeoutError"
              ? "네이버 응답 시간이 초과되었습니다. 다시 시도해 주세요."
              : "검색량 응답을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        },
        error?.name === "TimeoutError" ? 504 : 502,
      );
    }
  };
}
