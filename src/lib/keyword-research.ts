import {
  countRange,
  formatCount,
  formatRange,
  mobileShare,
  rowVolume,
  type Device,
  type KeywordData,
  type KeywordRow,
} from "./naver-keywords";
export type KeywordSnapshot = {
  row: KeywordRow;
  source: KeywordData["source"];
  fetchedAt: string;
  savedAt: string;
};
export type ProductRecord = {
  keyword: string;
  count: number;
  source: "manual" | "naver-shopping";
  capturedAt: string;
};
export type TrendPoint = { month: string; searches: number | null };
export const snapshotId = (item: Pick<KeywordSnapshot, "row" | "source">) =>
  `${item.source}:${item.row.keyword}`;
export function exactVolume(
  row: KeywordRow,
  device: Device = "all",
): number | null {
  const volume = rowVolume(row, device);
  return volume && volume.min === volume.max ? volume.min : null;
}
export function productSearchRatio(
  productCount: number | null,
  volume: number | null,
): number | null {
  return productCount !== null &&
    Number.isSafeInteger(productCount) &&
    productCount >= 0 &&
    volume !== null &&
    volume > 0
    ? productCount / volume
    : null;
}
export function parseProductCount(value: string): number | null {
  const text = value.replaceAll(",", "").trim();
  if (!text) return null;
  if (!/^\d+$/.test(text))
    throw new Error("상품 수는 0 이상의 정수로 입력해 주세요.");
  const n = Number(text);
  if (!Number.isSafeInteger(n) || n > 1_000_000_000_000)
    throw new Error("상품 수는 1조 이하의 정수로 입력해 주세요.");
  return n;
}
export type KeywordFilters = {
  text: string;
  exclude: string;
  competition: string;
  minVolume: string;
  maxVolume: string;
  minMobileShare: string;
  device: Device;
};
export function filterResearchKeywords(
  rows: KeywordRow[],
  filters: KeywordFilters,
): { rows: KeywordRow[]; error: string } {
  const number = (s: string, label: string, max = 1e12) => {
    if (!s.trim()) return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0 || n > max)
      throw new Error(`${label} 범위를 확인해 주세요.`);
    return n;
  };
  try {
    const min = number(filters.minVolume, "최소 검색량"),
      max = number(filters.maxVolume, "최대 검색량"),
      share = number(filters.minMobileShare, "모바일 비중", 100);
    if (min !== null && max !== null && min > max)
      throw new Error("최소 검색량은 최대 검색량보다 클 수 없습니다.");
    const included = filters.text
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      excluded = filters.exclude
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return {
      error: "",
      rows: rows.filter((row) => {
        if (
          included.length &&
          !included.every((s) =>
            row.keyword.toLocaleLowerCase().includes(s.toLocaleLowerCase()),
          )
        )
          return false;
        if (
          excluded.some((s) =>
            row.keyword.toLocaleLowerCase().includes(s.toLocaleLowerCase()),
          )
        )
          return false;
        if (
          filters.competition !== "all" &&
          row.competition !== filters.competition
        )
          return false;
        const volume = rowVolume(row, filters.device);
        if ((min !== null || max !== null) && !volume) return false;
        if (min !== null && volume!.min < min) return false;
        if (max !== null && volume!.max > max) return false;
        const ratio = mobileShare(row);
        if (share !== null && (ratio === null || ratio < share)) return false;
        return true;
      }),
    };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  }
}
export function keywordSuggestions(seed: string, existing: string[]): string[] {
  const clean = seed.replace(/\s+/g, "").slice(0, 40);
  if (!clean) return [];
  const candidates = ["추천", "비교", "가격", "후기", "선물", "사용법"]
    .map((s) => clean + s)
    .concat(
      ["휴대용", "가정용", "사무실", "미니"]
        .filter((s) => !clean.startsWith(s))
        .map((s) => s + clean),
    );
  return [...new Set(candidates)]
    .filter((s) => !existing.includes(s) && s.length <= 50)
    .slice(0, 10);
}
function csvFields(line: string): string[] {
  const cells: string[] = [];
  let value = "",
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      cells.push(value.trim());
      value = "";
    } else value += c;
  }
  if (quoted) throw new Error("CSV 따옴표 형식이 올바르지 않습니다.");
  cells.push(value.trim());
  return cells;
}
export function parseMonthlyTrend(text: string): TrendPoint[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (!lines.length)
    throw new Error("월별 데이터를 입력하거나 CSV 파일을 가져오세요.");
  const values = new Map<number, number>();
  for (let i = 0; i < lines.length; i++) {
    const cells = csvFields(lines[i]);
    if (i === 0 && /^(month|월|날짜)$/i.test(cells[0])) continue;
    if (cells.length !== 2 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(cells[0]))
      throw new Error(
        `${i + 1}번째 줄을 YYYY-MM,검색량 형식으로 입력해 주세요.`,
      );
    const [year, month] = cells[0].split("-").map(Number);
    if (year < 2000 || year > 2100)
      throw new Error("연도는 2000~2100 범위로 입력해 주세요.");
    const index = year * 12 + month - 1;
    if (values.has(index))
      throw new Error("동일한 월을 중복 입력할 수 없습니다.");
    if (!/^\d+$/.test(cells[1].replaceAll(",", "")))
      throw new Error(
        `${i + 1}번째 줄의 검색량을 0 이상의 정수로 입력해 주세요.`,
      );
    const n = Number(cells[1].replaceAll(",", ""));
    if (!Number.isSafeInteger(n) || n > 1e12)
      throw new Error("월별 검색량은 1조 이하의 정수여야 합니다.");
    values.set(index, n);
  }
  if (values.size < 2)
    throw new Error("추이 비교를 위해 서로 다른 월을 2개 이상 입력해 주세요.");
  const indices = [...values.keys()].sort((a, b) => a - b);
  if (indices.at(-1)! - indices[0] >= 60)
    throw new Error("최대 60개월 범위까지 분석할 수 있습니다.");
  return Array.from({ length: indices.at(-1)! - indices[0] + 1 }, (_, i) => {
    const index = indices[0] + i;
    return {
      month: `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`,
      searches: values.get(index) ?? null,
    };
  });
}
export function trendSummary(points: TrendPoint[]) {
  const known = points.filter(
    (p): p is TrendPoint & { searches: number } => p.searches !== null,
  );
  const latest = known.at(-1),
    previous = known.at(-2);
  const peak = known.reduce<typeof latest>(
    (best, p) => (!best || p.searches > best.searches ? p : best),
    undefined,
  );
  return {
    latest,
    previous,
    peak,
    changePercent:
      latest && previous && previous.searches > 0
        ? ((latest.searches - previous.searches) / previous.searches) * 100
        : null,
  };
}
export function restoreSnapshots(value: unknown): KeywordSnapshot[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 100).filter((item): item is KeywordSnapshot => {
    if (
      !item ||
      typeof item !== "object" ||
      !item.row ||
      typeof item.row.keyword !== "string" ||
      !item.row.keyword.trim() ||
      item.row.keyword.length > 100 ||
      !["demo", "naver"].includes(item.source) ||
      !Number.isFinite(Date.parse(item.fetchedAt)) ||
      !Number.isFinite(Date.parse(item.savedAt))
    )
      return false;
    const row = item.row;
    for (const k of ["pcSearches", "mobileSearches"])
      if (
        row[k] !== null &&
        ((typeof row[k] !== "number" && typeof row[k] !== "string") ||
          countRange(row[k]) === null)
      )
        return false;
    for (const k of ["pcClicks", "mobileClicks"])
      if (
        row[k] !== null &&
        (typeof row[k] !== "number" || !Number.isFinite(row[k]) || row[k] < 0)
      )
        return false;
    if (typeof row.competition !== "string" || row.competition.length > 30)
      return false;
    for (const key of ["pcCtr", "mobileCtr", "adDepth"])
      if (
        row[key] != null &&
        (typeof row[key] !== "number" ||
          !Number.isFinite(row[key]) ||
          row[key] < 0)
      )
        return false;
    const id = snapshotId(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
export function restoreProducts(value: unknown): ProductRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 200)
    .filter(
      (v): v is ProductRecord =>
        !!v &&
        typeof v === "object" &&
        typeof v.keyword === "string" &&
        v.keyword.trim().length > 0 &&
        v.keyword.length <= 100 &&
        Number.isSafeInteger(v.count) &&
        v.count >= 0 &&
        v.count <= 1e12 &&
        ["manual", "naver-shopping"].includes(v.source) &&
        Number.isFinite(Date.parse(v.capturedAt)),
    );
}
const cell = (value: string) =>
  `"${(/^[\s]*[=+\-@]|^[\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
export function researchKeywordsCsv(
  items: KeywordSnapshot[],
  products: ProductRecord[],
  device: Device = "all",
): string {
  return (
    "\uFEFF" +
    [
      [
        "번호",
        "키워드",
        "PC 검색량",
        "모바일 검색량",
        "합계",
        "상품 수",
        "상품 수 출처",
        "상품/검색 비율",
        "PC 광고 CTR(%)",
        "모바일 광고 CTR(%)",
        "PC 평균 광고 노출 깊이",
        "비율 기기 기준",
        "검색량 출처",
        "조회 시각",
      ],
      ...items.map((item, index) => {
        const product = products.find((p) => p.keyword === item.row.keyword);
        const ratio = productSearchRatio(
          product?.count ?? null,
          exactVolume(item.row, device),
        );
        return [
          String(index + 1),
          item.row.keyword,
          formatCount(item.row.pcSearches),
          formatCount(item.row.mobileSearches),
          formatRange(rowVolume(item.row, "all")),
          product ? String(product.count) : "—",
          product
            ? product.source === "manual"
              ? "직접 입력"
              : "네이버 쇼핑 API"
            : "미입력",
          ratio === null ? "—" : ratio.toFixed(3),
          item.row.pcCtr == null ? "—" : String(item.row.pcCtr),
          item.row.mobileCtr == null ? "—" : String(item.row.mobileCtr),
          item.row.adDepth == null ? "—" : String(item.row.adDepth),
          device === "all" ? "전체" : device === "pc" ? "PC" : "모바일",
          item.source === "demo" ? "데모 데이터(가상)" : "네이버 검색광고 API",
          item.fetchedAt,
        ];
      }),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}
