export type Device = "all" | "pc" | "mobile";
export type SearchCount = number | string | null;
export type KeywordRow = {
  keyword: string;
  pcSearches: SearchCount;
  mobileSearches: SearchCount;
  pcClicks: number | null;
  mobileClicks: number | null;
  competition: string;
  pcCtr?: number | null;
  mobileCtr?: number | null;
  adDepth?: number | null;
};
export type KeywordData = {
  source: "demo" | "naver";
  queriedKeywords: string[];
  fetchedAt: string;
  keywords: KeywordRow[];
  truncated: boolean;
};
export type CountRange = { min: number; max: number };
export function parseSeeds(text: string): string[] {
  const seeds = [
    ...new Set(
      text
        .split(/[,，\n]+/)
        .map((s) => s.replace(/\s+/g, ""))
        .filter(Boolean),
    ),
  ];
  if (!seeds.length) throw new Error("조회할 키워드를 입력해 주세요.");
  if (seeds.length > 5)
    throw new Error("키워드는 쉼표로 구분해 최대 5개까지 조회할 수 있습니다.");
  if (seeds.some((s) => s.length > 50))
    throw new Error("각 키워드는 50자 이내로 입력해 주세요.");
  return seeds;
}
export function countRange(value: SearchCount): CountRange | null {
  if (value === null) return null;
  if (typeof value === "number")
    return Number.isSafeInteger(value) && value >= 0
      ? { min: value, max: value }
      : null;
  const trimmed = value.replaceAll(",", "").trim();
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isSafeInteger(n) ? { min: n, max: n } : null;
  }
  const bounded = trimmed.match(/^<\s*(\d+)$/);
  if (bounded) {
    const n = Number(bounded[1]);
    return Number.isSafeInteger(n) && n > 0 ? { min: 0, max: n - 1 } : null;
  }
  return null;
}
export function addRanges(values: (CountRange | null)[]): CountRange | null {
  if (values.some((v) => v === null)) return null;
  return values.reduce<CountRange>(
    (sum, v) => ({ min: sum.min + v!.min, max: sum.max + v!.max }),
    { min: 0, max: 0 },
  );
}
export function rowVolume(row: KeywordRow, device: Device): CountRange | null {
  return device === "pc"
    ? countRange(row.pcSearches)
    : device === "mobile"
      ? countRange(row.mobileSearches)
      : addRanges([countRange(row.pcSearches), countRange(row.mobileSearches)]);
}
export const formatRange = (range: CountRange | null) =>
  range === null
    ? "—"
    : range.min === range.max
      ? range.min.toLocaleString("ko-KR")
      : range.min === 0
        ? `< ${(range.max + 1).toLocaleString("ko-KR")}`
        : `${range.min.toLocaleString("ko-KR")}~${range.max.toLocaleString("ko-KR")}`;
export const formatCount = (value: SearchCount) =>
  formatRange(countRange(value));
export function mobileShare(row: KeywordRow): number | null {
  const pc = countRange(row.pcSearches),
    mobile = countRange(row.mobileSearches);
  if (
    !pc ||
    !mobile ||
    pc.min !== pc.max ||
    mobile.min !== mobile.max ||
    pc.min + mobile.min === 0
  )
    return null;
  return (mobile.min / (pc.min + mobile.min)) * 100;
}
export function sortKeywords(rows: KeywordRow[], device: Device): KeywordRow[] {
  return [...rows].sort((a, b) => {
    const av = rowVolume(a, device),
      bv = rowVolume(b, device);
    if (av === null)
      return bv === null ? a.keyword.localeCompare(b.keyword, "ko") : 1;
    if (bv === null) return -1;
    return (
      bv.min - av.min ||
      bv.max - av.max ||
      a.keyword.localeCompare(b.keyword, "ko")
    );
  });
}
export function demoKeywordData(seeds: string[]): KeywordData {
  const suffixes = [
    "",
    "추천",
    "무선",
    "휴대용",
    "세척",
    "사무실",
    "사용법",
    "충전",
  ];
  const pc = [2400, 1380, 920, 610, 440, 310, 180, 70],
    mobile = [18600, 9240, 6580, 4930, 3120, 2280, 1460, 630];
  const seen = new Set<string>();
  const keywords: KeywordRow[] = [];
  seeds.forEach((seed, j) =>
    suffixes.forEach((suffix, i) => {
      const keyword = seed + suffix;
      if (seen.has(keyword)) return;
      seen.add(keyword);
      keywords.push({
        keyword,
        pcSearches: pc[i] * (j + 1),
        mobileSearches: mobile[i] * (j + 1),
        pcClicks: Number((pc[i] * 0.014).toFixed(1)),
        mobileClicks: Number((mobile[i] * 0.018).toFixed(1)),
        competition: i < 3 ? "높음" : i < 6 ? "중간" : "낮음",
        pcCtr: 1.4,
        mobileCtr: 1.8,
        adDepth: 6.2,
      });
    }),
  );
  return {
    source: "demo",
    queriedKeywords: seeds,
    fetchedAt: new Date().toISOString(),
    keywords,
    truncated: false,
  };
}
export function validateEndpoint(text: string): string {
  const value = text.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.hostname === "api.searchad.naver.com"
    )
      throw new Error();
    return url.toString();
  } catch {
    throw new Error(
      "조회 서버의 HTTPS 주소를 입력해 주세요. API 키·비밀 키는 이 화면에 입력하지 않습니다. 로컬 테스트는 localhost HTTP 주소를 사용할 수 있습니다.",
    );
  }
}
export function validateKeywordResponse(value: unknown): KeywordData {
  if (!value || typeof value !== "object")
    throw new Error("조회 서버 응답 형식이 올바르지 않습니다.");
  const data = value as Record<string, unknown>;
  if (
    data.source !== "naver" ||
    !Array.isArray(data.keywords) ||
    data.keywords.length > 1000 ||
    !Array.isArray(data.queriedKeywords) ||
    !data.queriedKeywords.every((s) => typeof s === "string") ||
    typeof data.fetchedAt !== "string" ||
    !Number.isFinite(Date.parse(data.fetchedAt))
  )
    throw new Error("조회 서버 응답 형식이 올바르지 않습니다.");
  const seen = new Set<string>();
  const keywords: KeywordRow[] = [];
  for (const raw of data.keywords) {
    if (!raw || typeof raw !== "object")
      throw new Error("키워드 데이터가 올바르지 않습니다.");
    const r = raw as Record<string, unknown>;
    if (
      typeof r.keyword !== "string" ||
      !r.keyword.trim() ||
      r.keyword.length > 100
    )
      throw new Error("키워드 데이터가 올바르지 않습니다.");
    if (seen.has(r.keyword)) continue;
    seen.add(r.keyword);
    const count = (v: unknown): SearchCount =>
      typeof v === "number" || typeof v === "string"
        ? countRange(v) === null
          ? null
          : v
        : null;
    const clicks = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
    keywords.push({
      keyword: r.keyword,
      pcSearches: count(r.pcSearches),
      mobileSearches: count(r.mobileSearches),
      pcClicks: clicks(r.pcClicks),
      pcCtr: clicks(r.pcCtr),
      mobileCtr: clicks(r.mobileCtr),
      adDepth: clicks(r.adDepth),
      mobileClicks: clicks(r.mobileClicks),
      competition:
        typeof r.competition === "string" ? r.competition.slice(0, 30) : "—",
    });
  }
  return {
    source: "naver",
    queriedKeywords: data.queriedKeywords as string[],
    fetchedAt: data.fetchedAt,
    keywords,
    truncated: data.truncated === true,
  };
}
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function keywordCsv(
  rows: KeywordRow[],
  device: Device,
  source: "demo" | "naver",
  fetchedAt: string,
): string {
  const sorted = sortKeywords(rows, device);
  const headers = [
    "조회 결과 내 검색량 순위",
    "키워드",
    "최근30일 PC 검색량",
    "최근30일 모바일 검색량",
    "합계",
    "월평균 PC 광고 클릭 수(최근4주)",
    "월평균 모바일 광고 클릭 수(최근4주)",
    "PC 광고 경쟁 정도",
    "출처",
    "조회시각",
  ];
  return (
    "\uFEFF" +
    [
      headers,
      ...sorted.map((r, i) => [
        String(i + 1),
        r.keyword,
        formatCount(r.pcSearches),
        formatCount(r.mobileSearches),
        formatRange(rowVolume(r, "all")),
        r.pcClicks === null ? "—" : String(r.pcClicks),
        r.mobileClicks === null ? "—" : String(r.mobileClicks),
        r.competition,
        source === "demo" ? "데모 데이터(가상)" : "네이버 검색광고 API",
        fetchedAt,
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n")
  );
}
