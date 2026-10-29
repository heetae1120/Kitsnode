import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createKeywordHandler } from "../keyword-api/src/handler.mjs";
const env = {
  NAVER_SEARCHAD_API_KEY: "test-key",
  NAVER_SEARCHAD_SECRET_KEY: "test-secret",
  NAVER_SEARCHAD_CUSTOMER_ID: "test-customer",
  ALLOWED_ORIGINS: "https://heetae1120.github.io",
};
const request = (
  keywords = "가습기",
  origin = "https://heetae1120.github.io",
  method = "GET",
) =>
  new Request(
    `https://api.example.com/api/keywords?keywords=${encodeURIComponent(keywords)}`,
    { method, headers: { Origin: origin } },
  );
const payload = {
  keywordList: [
    {
      relKeyword: "가습기",
      monthlyPcQcCnt: "3200",
      monthlyMobileQcCnt: "<10",
      monthlyAvePcClkCnt: "12.3",
      monthlyAveMobileClkCnt: "2.1",
      monthlyAvePcCtr: "1.25",
      monthlyAveMobileCtr: "2.4",
      plAvgDepth: "6.2",
      compIdx: "high",
    },
  ],
};
test("missing server credentials returns 503 without contacting Naver", async () => {
  let called = false;
  const handler = createKeywordHandler({
    fetcher: async () => {
      called = true;
      return Response.json(payload);
    },
  });
  const res = await handler(request(), {});
  assert.equal(res.status, 503);
  assert.equal(called, false);
  assert.equal((await res.json()).code, "NOT_CONFIGURED");
});

test("rejects malformed credentials with fixed diagnostics before contacting Naver", async () => {
  for (const name of ["NAVER_SEARCHAD_API_KEY", "NAVER_SEARCHAD_SECRET_KEY", "NAVER_SEARCHAD_CUSTOMER_ID"]) {
    for (const value of ["", "  ", " private-value ", "private\nvalue", "private\\nvalue", '"private-value"', "private\u200bvalue"]) {
      const logs: unknown[] = [];
      let calls = 0;
      const handler = createKeywordHandler({
        logger: (entry) => logs.push(entry),
        fetcher: async () => { calls++; return Response.json(payload); },
      });
      const res = await handler(request(), { ...env, [name]: value });
      const data = await res.json();
      assert.equal(res.status, 503);
      assert.equal(calls, 0);
      assert.equal(data.code, value.trim() ? "INVALID_AUTH_CONFIG" : "NOT_CONFIGURED");
      assert.equal(logs.length, 1);
      assert.equal((logs[0] as { diagnosticId: string }).diagnosticId, data.diagnosticId);
      const output = JSON.stringify({ data, logs });
      for (const privateValue of ["private", ...Object.values(env)])
        assert.ok(!output.includes(privateValue));
    }
  }
});

test("uses a Base64-looking secret verbatim and the same timestamp in header and signature", async () => {
  let headers: Record<string, string> = {};
  let method: string | undefined;
  const handler = createKeywordHandler({
    now: () => 1793145600000,
    fetcher: async (_input, init) => {
      headers = init!.headers as Record<string, string>;
      method = init!.method;
      return Response.json(payload);
    },
  });
  const res = await handler(request("one,two"), { ...env, NAVER_SEARCHAD_SECRET_KEY: "dGVzdC1zZWNyZXQ=" });
  assert.equal(res.status, 200);
  assert.equal(method, "GET");
  assert.equal(headers["X-Timestamp"], "1793145600000");
  assert.equal(headers["X-API-KEY"], env.NAVER_SEARCHAD_API_KEY);
  assert.equal(headers["X-Customer"], env.NAVER_SEARCHAD_CUSTOMER_ID);
  assert.equal(headers["X-Signature"], "8IkxA+/JZosh4ABrW9JAHQ+UjtlRQfgRw3HpzISAjv0=");
});

test("upstream diagnostics correlate errors without echoing secrets, signatures or bodies", async () => {
  for (const status of [401, 403, 429, 500]) {
    const logs: unknown[] = [];
    let signature = "";
    const handler = createKeywordHandler({
      now: () => 1793145600000,
      logger: (entry) => logs.push(entry),
      fetcher: async (_input, init) => {
        signature = (init!.headers as Record<string, string>)["X-Signature"];
        return Response.json({ code: 1018, message: "Signature is invalid.", details: [...Object.values(env), signature, "private-body"].join(" ") }, {
          status,
          headers: { date: new Date(1793145598000).toUTCString(), "x-request-id": env.NAVER_SEARCHAD_SECRET_KEY },
        });
      },
    });
    const res = await handler(request("private-keyword"), env);
    const data = await res.json();
    assert.equal(res.status, status === 429 ? 429 : 502);
    assert.match(data.diagnosticId, /^[\da-f-]{36}$/);
    assert.deepEqual(logs, [{
      event: "naver_searchad_error", diagnosticId: data.diagnosticId,
      reason: "upstream_rejected",
      credentials: { NAVER_SEARCHAD_API_KEY: [], NAVER_SEARCHAD_SECRET_KEY: [], NAVER_SEARCHAD_CUSTOMER_ID: [] },
      upstreamStatus: status,
      upstreamError: { code: "1018", message: "Signature is invalid.", parseStatus: "parsed" },
      signing: { algorithm: "HMAC-SHA256", encoding: "base64", method: "GET", path: "/keywordstool", timestamp: "1793145600000" },
      clockSkewMs: 2000,
    }]);
    const output = JSON.stringify({ data, logs });
    for (const privateValue of [...Object.values(env), signature, "private-body", "private-keyword"])
      assert.ok(!output.includes(privateValue));
  }
});

test("masks Naver code and message before logging while keeping them out of client responses", async () => {
  const logs: { diagnosticId: string; upstreamError: { code: string; message: string } }[] = [];
  let signature = "";
  const secret = "secret+/=redaction-test";
  const handler = createKeywordHandler({
    logger: (entry) => logs.push(entry),
    fetcher: async (_input, init) => {
      signature = (init!.headers as Record<string, string>)["X-Signature"];
      return Response.json({
        code: env.NAVER_SEARCHAD_API_KEY,
        message: `Signature invalid: ${signature}; secret=${secret}; encoded=${encodeURIComponent(secret)}; base64=${Buffer.from(secret).toString("base64")}; customer=${env.NAVER_SEARCHAD_CUSTOMER_ID}\nX-API-KEY: unrecognized-header-value\nPermission denied.\u0000`,
        headers: { Authorization: "private-header-object" },
        extra: "private-extra-field",
      }, { status: 403 });
    },
  });
  const res = await handler(request(), { ...env, NAVER_SEARCHAD_SECRET_KEY: secret });
  const data = await res.json();
  assert.equal(data.code, "NAVER_AUTH_ERROR");
  assert.equal(data.diagnosticId, logs[0].diagnosticId);
  assert.equal(data.upstreamError, undefined);
  assert.equal(logs[0].upstreamError.code, "[REDACTED]");
  assert.match(logs[0].upstreamError.message, /Signature invalid/);
  assert.match(logs[0].upstreamError.message, /Permission denied/);
  assert.ok(!/[\x00-\x1f]/.test(logs[0].upstreamError.message));
  const output = JSON.stringify({ data, logs });
  for (const value of [secret, signature, encodeURIComponent(secret), Buffer.from(secret).toString("base64"), env.NAVER_SEARCHAD_API_KEY, env.NAVER_SEARCHAD_CUSTOMER_ID, "unrecognized-header-value", "X-API-KEY", "private-header-object", "private-extra-field"])
    assert.ok(!output.includes(value), "sensitive upstream content was logged");
  assert.ok(!JSON.stringify(data).includes("Signature invalid"));
});

test("logs redacted RFC 7807 Naver problems without exposing them to the client", async () => {
  const logs: { upstreamError: { code: string; message: string; parseStatus: string } }[] = [];
  const handler = createKeywordHandler({
    logger: (entry) => logs.push(entry),
    fetcher: async () => Response.json({
      type: "urn:naver:api:problem:invalid-api-key",
      title: "Forbidden",
      detail: `Invalid API key ${env.NAVER_SEARCHAD_API_KEY}; customer ${env.NAVER_SEARCHAD_CUSTOMER_ID}; secret ${env.NAVER_SEARCHAD_SECRET_KEY}`,
      status: 403,
      instance: "private-instance",
      nested: { detail: "private-extra" },
    }, { status: 403 }),
  });
  const res = await handler(request(), env);
  const data = await res.json();
  assert.equal(res.status, 502);
  assert.equal(data.code, "NAVER_AUTH_ERROR");
  assert.equal(data.upstreamError, undefined);
  assert.equal(logs[0].upstreamError.code, "urn:naver:api:problem:invalid-api-key");
  assert.match(logs[0].upstreamError.message, /^Forbidden: Invalid API key \[REDACTED\]/);
  assert.equal(logs[0].upstreamError.parseStatus, "parsed");
  const output = JSON.stringify({ data, logs });
  for (const value of [...Object.values(env), "private-instance", "private-extra"])
    assert.ok(!output.includes(value), "private problem fields were logged");
  assert.ok(!JSON.stringify(data).includes("Forbidden"));
});

test("redacts credentials crossing the message length limit before truncation", async () => {
  const logs: { upstreamError: { message: string } }[] = [];
  const handler = createKeywordHandler({
    logger: (entry) => logs.push(entry),
    fetcher: async () => Response.json({ code: "a".repeat(100), message: "a".repeat(495) + env.NAVER_SEARCHAD_SECRET_KEY }, { status: 403 }),
  });
  await handler(request(), env);
  assert.equal(logs[0].upstreamError.message.length, 500);
  assert.ok(!logs[0].upstreamError.message.includes("test-"));
});

test("malformed, oversized and unreadable upstream errors retain auth classification", async () => {
  const encoder = new TextEncoder();
  let cancelled = false;
  const cases = [
    { response: () => new Response("<html>private-body</html>", { status: 403 }), expected: "unavailable" },
    { response: () => Response.json(null, { status: 403 }), expected: "invalid_json" },
    { response: () => Response.json({ code: { secret: "private" }, message: ["private"] }, { status: 403 }), expected: "parsed" },
    { response: () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(encoder.encode("x".repeat(16385))); },
      cancel() { cancelled = true; },
    }), { status: 403 }), expected: "too_large" },
    { response: () => new Response(new ReadableStream({
      start(controller) { controller.error(new Error("private-read-failure")); },
    }), { status: 403 }), expected: "unavailable" },
  ];
  for (const { response, expected } of cases) {
    const logs: { upstreamError: unknown }[] = [];
    const handler = createKeywordHandler({ logger: (entry) => logs.push(entry), fetcher: async () => response() });
    const res = await handler(request(), env);
    const data = await res.json();
    assert.equal(res.status, 502);
    assert.equal(data.code, "NAVER_AUTH_ERROR");
    assert.deepEqual(logs[0].upstreamError, { code: null, message: null, parseStatus: expected });
    assert.ok(!JSON.stringify({ logs, data }).includes("private"));
  }
  assert.equal(cancelled, true);
});

test("invalid upstream dates and logging failures preserve the controlled auth response", async () => {
  const logs: { clockSkewMs?: number | null }[] = [];
  for (const logger of [(entry: { clockSkewMs?: number | null }) => logs.push(entry), () => { throw new Error("private logger failure"); }]) {
    const handler = createKeywordHandler({
      logger,
      fetcher: async () => new Response("private-body", { status: 403, headers: { date: "invalid-private-date" } }),
    });
    const res = await handler(request(), env);
    const data = await res.json();
    assert.equal(res.status, 502);
    assert.equal(data.code, "NAVER_AUTH_ERROR");
    assert.equal(typeof data.diagnosticId, "string");
    assert.ok(!JSON.stringify(data).includes("private"));
  }
  assert.equal(logs[0].clockSkewMs, null);
});
test("CORS, HTTP method and keyword validation reject invalid requests before querying", async () => {
  const handler = createKeywordHandler({
    fetcher: async () => {
      throw new Error("must not query");
    },
  });
  assert.equal(
    (await handler(request("키워드", "https://not-allowed.example"), env))
      .status,
    403,
  );
  const options = await handler(request("가습기", undefined, "OPTIONS"), env);
  assert.equal(options.status, 204);
  assert.equal(
    options.headers.get("Access-Control-Allow-Origin"),
    "https://heetae1120.github.io",
  );
  assert.equal(
    (await handler(request("가습기", undefined, "POST"), env)).status,
    405,
  );
  for (const q of ["", "1,2,3,4,5,6", "가".repeat(51)])
    assert.equal((await handler(request(q), env)).status, 400);
});
test("signs the official endpoint and maps only actual provided fields", async () => {
  const now = 1793145600000;
  const handler = createKeywordHandler({
    now: () => now,
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://api.searchad.naver.com");
      assert.equal(url.pathname, "/keywordstool");
      assert.equal(url.searchParams.get("hintKeywords"), "미니가습기,텀블러");
      assert.equal(url.searchParams.get("showDetail"), "1");
      const headers = init!.headers as Record<string, string>;
      assert.equal(
        headers["X-Signature"],
        createHmac("sha256", "test-secret")
          .update(`${now}.GET./keywordstool`)
          .digest("base64"),
      );
      return Response.json({
        keywordList: [
          ...payload.keywordList,
          ...payload.keywordList,
          { relKeyword: "추가키워드", compIdx: "low" },
        ],
      });
    },
  });
  const res = await handler(request("미니 가습기,텀블러"), env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.source, "naver");
  assert.equal(data.keywords.length, 2);
  assert.equal(data.keywords[0].pcSearches, "3200");
  assert.equal(data.keywords[0].mobileSearches, "<10");
  assert.equal(data.keywords[0].pcClicks, 12.3);
  assert.equal(data.keywords[0].pcCtr, 1.25);
  assert.equal(data.keywords[0].adDepth, 6.2);
  assert.equal(data.keywords[0].competition, "높음");
  assert.equal(data.keywords[1].pcSearches, null);
  assert.equal(data.keywords[1].pcClicks, null);
  assert.equal("cpc" in data.keywords[0], false);
});
test("cache reuses original fetchedAt, expires, and caps upstream calls", async () => {
  let time = 1793145600000,
    calls = 0;
  const handler = createKeywordHandler({
    now: () => time,
    fetcher: async () => {
      calls++;
      return Response.json(payload);
    },
  });
  const first = await (await handler(request(), env, "one")).json();
  time += 1000;
  const second = await (await handler(request(), env, "two")).json();
  assert.equal(calls, 1);
  assert.equal(second.cached, true);
  assert.equal(first.fetchedAt, second.fetchedAt);
  time += 600000;
  const third = await (await handler(request(), env, "three")).json();
  assert.equal(calls, 2);
  assert.equal(third.cached, false);
  assert.notEqual(first.fetchedAt, third.fetchedAt);
});
test("limits requests and returns controlled Naver errors without secret leakage", async () => {
  const limited = createKeywordHandler({
    maxRequests: 1,
    fetcher: async () => Response.json(payload),
  });
  await limited(request(), env, "client");
  const rate = await limited(request("다른키워드"), env, "client");
  assert.equal(rate.status, 429);
  assert.equal(rate.headers.get("Retry-After"), "60");
  const auth = createKeywordHandler({
    fetcher: async () =>
      new Response("upstream private diagnostic", { status: 403 }),
  });
  const res = await auth(request(), env);
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.match(text, /NAVER_AUTH_ERROR/);
  assert.ok(!text.includes("test-secret"));
  assert.ok(!text.includes("upstream private diagnostic"));
  const global = createKeywordHandler({
    globalLimit: 1,
    fetcher: async () => Response.json(payload),
  });
  await global(request(), env, "one");
  assert.equal((await global(request("텀블러"), env, "two")).status, 429);
});
test("empty results remain real empty data, malformed results never turn into demo", async () => {
  const empty = createKeywordHandler({
    fetcher: async () => Response.json({ keywordList: [] }),
  });
  const data = await (await empty(request(), env)).json();
  assert.equal(data.source, "naver");
  assert.deepEqual(data.keywords, []);
  for (const fetcher of [
    async () => Response.json({ wrong: [] }),
    async () => new Response("invalid-json"),
  ])
    assert.equal(
      (await createKeywordHandler({ fetcher })(request(), env)).status,
      502,
    );
  const timeout = createKeywordHandler({
    fetcher: async () => {
      const error = new Error();
      error.name = "TimeoutError";
      throw error;
    },
  });
  assert.equal((await timeout(request(), env)).status, 504);
});
test("caps result size and tells the client when a response was truncated", async () => {
  const handler = createKeywordHandler({
    fetcher: async () =>
      Response.json({
        keywordList: Array.from({ length: 1002 }, (_, i) => ({
          ...payload.keywordList[0],
          relKeyword: `키워드${i}`,
        })),
      }),
  });
  const data = await (await handler(request(), env)).json();
  assert.equal(data.keywords.length, 1000);
  assert.equal(data.truncated, true);
});

test("shopping mode needs separate developer credentials rather than Search Ad keys", async () => {
  const handler = createKeywordHandler({
    fetcher: async () => {
      throw new Error("must not query");
    },
  });
  const r = await handler(
    new Request(
      "https://api.example.com/api/keywords?mode=shopping&keywords=test",
    ),
    env,
  );
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, "SHOPPING_NOT_CONFIGURED");
});
test("shopping mode sends developer headers and keeps product total separate from search volume", async () => {
  let calls = 0;
  const handler = createKeywordHandler({
    fetcher: async (input, init) => {
      calls++;
      const url = new URL(String(input));
      assert.equal(url.origin, "https://openapi.naver.com");
      assert.equal(url.pathname, "/v1/search/shop.json");
      assert.equal(url.searchParams.get("display"), "1");
      assert.equal(
        (init!.headers as Record<string, string>)["X-Naver-Client-Id"],
        "test-developer",
      );
      assert.equal(
        (init!.headers as Record<string, string>)["X-API-KEY"],
        undefined,
      );
      return Response.json({ total: 12345, items: [] });
    },
  });
  const shoppingEnv = {
    NAVER_OPENAPI_CLIENT_ID: "test-developer",
    NAVER_OPENAPI_CLIENT_SECRET: "test-developer-secret",
  };
  const req = new Request(
    "https://api.example.com/api/keywords?mode=shopping&keywords=keyword",
  );
  const first = await handler(req, shoppingEnv);
  const data = await first.json();
  assert.equal(first.status, 200);
  assert.equal(data.source, "naver-shopping");
  assert.deepEqual(data.products, [{ keyword: "keyword", count: 12345 }]);
  assert.equal(data.keywords, undefined);
  assert.equal((await (await handler(req, shoppingEnv)).json()).cached, true);
  assert.equal(calls, 1);
});
test("shopping mode validates totals, protects quotas and returns controlled upstream errors", async () => {
  const shoppingEnv = {
    NAVER_OPENAPI_CLIENT_ID: "test",
    NAVER_OPENAPI_CLIENT_SECRET: "test-secret",
  };
  const req = new Request(
    "https://api.example.com/api/keywords?mode=shopping&keywords=one",
  );
  for (const fetcher of [
    async () => Response.json({ total: -1 }),
    async () => new Response("private", { status: 403 }),
  ])
    assert.equal(
      (await createKeywordHandler({ fetcher })(req, shoppingEnv)).status,
      502,
    );
  const handler = createKeywordHandler({
    globalLimit: 1,
    fetcher: async () => {
      throw new Error("must not query");
    },
  });
  const response = await handler(
    new Request(
      "https://api.example.com/api/keywords?mode=shopping&keywords=one,two",
    ),
    shoppingEnv,
  );
  assert.equal(response.status, 429);
});
