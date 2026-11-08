/** Synthetic examples only. Never used as a fallback for a member's report. */
export type AdPerformanceRow = Readonly<{
  date: string;
  hour: number;
  spend: number;
  clicks: number;
  conversions: number | null;
  conversionRevenue: number | null;
  conversionType: "purchase" | "all" | "unknown";
}>;
export const EXAMPLE_DATES = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"] as const;
export const EXAMPLE_PERIODS = [{ id: "week", label: "예시 7일" }, { id: "day", label: "예시 마지막 1일" }] as const;
export type ExamplePeriod = (typeof EXAMPLE_PERIODS)[number]["id"];
// Each row represents a four-hour bucket, not one hour or an individual customer.
export const EXAMPLE_AD_ROWS: readonly AdPerformanceRow[] = Object.freeze(EXAMPLE_DATES.flatMap((date, day) =>
  [0, 4, 8, 12, 16, 20].map((hour, bucket) => {
    const clicks = [12, 8, 42, 56, 48, 64][bucket] + day * 2;
    const conversions = [0, 0, 2, 3, 2, 4][bucket] + (day > 4 && bucket > 1 ? 1 : 0);
    return Object.freeze({ date, hour, spend: clicks * [580, 500, 680, 720, 660, 750][bucket], clicks, conversions, conversionRevenue: conversions * 32000, conversionType: "purchase" as const });
  })
));
export function exampleRows(period: ExamplePeriod): readonly AdPerformanceRow[] {
  return period === "day" ? EXAMPLE_AD_ROWS.filter(row => row.date === EXAMPLE_DATES.at(-1)) : EXAMPLE_AD_ROWS;
}
export function summarizeAdPerformance(rows: readonly AdPerformanceRow[]) {
  for (const row of rows) {
    for (const value of [row.spend, row.clicks, row.conversions, row.conversionRevenue]) {
      if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error("성과 값은 0 이상의 유한한 숫자여야 합니다.");
    }
  }
  if (!rows.length) return { spend: null, clicks: null, purchases: null, purchaseRevenue: null, cpc: null, purchaseCvr: null, cpa: null, roas: null };
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const purchaseOnly = rows.every(row => row.conversionType === "purchase");
  const purchases = purchaseOnly && rows.every(row => row.conversions !== null) ? rows.reduce((sum, row) => sum + row.conversions!, 0) : null;
  const purchaseRevenue = purchaseOnly && rows.every(row => row.conversionRevenue !== null) ? rows.reduce((sum, row) => sum + row.conversionRevenue!, 0) : null;
  return { spend, clicks, purchases, purchaseRevenue,
    cpc: clicks > 0 ? spend / clicks : null,
    purchaseCvr: clicks > 0 && purchases !== null ? purchases / clicks * 100 : null,
    cpa: purchases !== null && purchases > 0 ? spend / purchases : null,
    roas: spend > 0 && purchaseRevenue !== null ? purchaseRevenue / spend * 100 : null };
}
export function groupAdPerformance(rows: readonly AdPerformanceRow[], dimension: "date" | "hour") {
  const groups = new Map<string, AdPerformanceRow[]>();
  for (const row of rows) {
    const key = dimension === "date" ? row.date : String(row.hour).padStart(2, "0");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => ({ key, ...summarizeAdPerformance(items) }));
}
export function formatAdValue(value: number | null, unit = "") {
  return value === null ? "—" : new Intl.NumberFormat("ko-KR", { maximumFractionDigits: unit === "%" ? 2 : 0 }).format(value) + unit;
}
