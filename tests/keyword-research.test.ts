import test from "node:test";
import assert from "node:assert/strict";
import {
  exactVolume,
  filterResearchKeywords,
  keywordSuggestions,
  parseMonthlyTrend,
  parseProductCount,
  productSearchRatio,
  researchKeywordsCsv,
  restoreProducts,
  restoreSnapshots,
  snapshotId,
  trendSummary,
  type KeywordSnapshot,
} from "../src/lib/keyword-research";
import type { KeywordRow } from "../src/lib/naver-keywords";
const row: KeywordRow = {
  keyword: "텀블러",
  pcSearches: 100,
  mobileSearches: 900,
  pcClicks: 2,
  mobileClicks: 5,
  competition: "높음",
  pcCtr: 1.2,
  mobileCtr: 1.8,
  adDepth: 4,
};
const snapshot: KeywordSnapshot = {
  row,
  source: "demo",
  fetchedAt: "2026-10-01T00:00:00Z",
  savedAt: "2026-10-02T00:00:00Z",
};
const defaults = {
  text: "",
  exclude: "",
  competition: "all",
  minVolume: "",
  maxVolume: "",
  minMobileShare: "",
  device: "all" as const,
};
test("product ratio uses exact positive search volume and preserves zero product count", () => {
  assert.equal(productSearchRatio(2000, exactVolume(row)), 2);
  assert.equal(productSearchRatio(0, 1000), 0);
  assert.equal(productSearchRatio(null, 1000), null);
  assert.equal(productSearchRatio(20, 0), null);
  assert.equal(exactVolume({ ...row, pcSearches: "<10" }), null);
  assert.equal(parseProductCount("1,000"), 1000);
  assert.equal(parseProductCount("0"), 0);
  assert.equal(parseProductCount(""), null);
  for (const value of ["-1", "1.5", "Infinity", "1000000000001"])
    assert.throws(() => parseProductCount(value));
});
test("advanced keyword filters combine include, exclude, volume and mobile share", () => {
  const rows = [
    row,
    {
      ...row,
      keyword: "텀블러추천",
      competition: "중간",
      pcSearches: 500,
      mobileSearches: 500,
    },
    { ...row, keyword: "텀블러중고" },
    { ...row, keyword: "다른상품" },
  ];
  const result = filterResearchKeywords(rows, {
    ...defaults,
    text: "텀블러",
    exclude: "추천,중고",
    minVolume: "500",
    maxVolume: "1500",
    minMobileShare: "80",
  });
  assert.deepEqual(
    result.rows.map((r) => r.keyword),
    ["텀블러"],
  );
  assert.match(
    filterResearchKeywords(rows, {
      ...defaults,
      minVolume: "1000",
      maxVolume: "100",
    }).error,
    /최소/,
  );
  assert.ok(
    filterResearchKeywords(rows, { ...defaults, minMobileShare: "101" }).error,
  );
  assert.equal(
    filterResearchKeywords([{ ...row, pcSearches: "<10" }], {
      ...defaults,
      device: "pc",
      minVolume: "1",
    }).rows.length,
    0,
  );
});
test("monthly CSV parser preserves gaps and zero values without manufacturing history", () => {
  const points = parseMonthlyTrend(
    '\uFEFFmonth,searches\n2026-01,0\n2026-03,"1,200"',
  );
  assert.deepEqual(points, [
    { month: "2026-01", searches: 0 },
    { month: "2026-02", searches: null },
    { month: "2026-03", searches: 1200 },
  ]);
  for (const csv of [
    "2026-01,100",
    "2026-01,100\n2026-01,200",
    "2026-13,100\n2026-02,200",
    "2026-01,-1\n2026-02,2",
    "2020-01,1\n2026-01,2",
    "2026-01,1.2\n2026-02,3",
  ])
    assert.throws(() => parseMonthlyTrend(csv));
});
test("trend summary compares entered periods and refuses a zero-denominator growth rate", () => {
  const summary = trendSummary(
    parseMonthlyTrend("2026-01,100\n2026-02,200\n2026-03,150"),
  );
  assert.equal(summary.peak?.month, "2026-02");
  assert.equal(summary.changePercent, -25);
  assert.equal(
    trendSummary(parseMonthlyTrend("2026-01,0\n2026-02,100")).changePercent,
    null,
  );
  assert.equal(trendSummary([]).changePercent, null);
});
test("restored bookmarks preserve sources, discard malformed data and deduplicate", () => {
  const actual = { ...snapshot, source: "naver" as const };
  assert.notEqual(snapshotId(snapshot), snapshotId(actual));
  assert.equal(
    restoreSnapshots([
      snapshot,
      snapshot,
      actual,
      null,
      { ...snapshot, row: { ...row, pcSearches: undefined } },
      { ...snapshot, source: "fake" },
      { ...snapshot, row: { ...row, pcCtr: "bad" } },
    ]).length,
    2,
  );
  assert.deepEqual(restoreSnapshots({}), []);
});
test("product records retain their own independent source and date", () => {
  const product = {
    keyword: "텀블러",
    count: 0,
    source: "manual",
    capturedAt: snapshot.savedAt,
  };
  assert.equal(
    restoreProducts([
      product,
      { ...product, count: -1 },
      { ...product, source: "demo" },
      { ...product, capturedAt: "bad" },
    ]).length,
    1,
  );
});
test("comparison CSV keeps per-row sources, manual product origin and safe formula text", () => {
  const actual = {
    ...snapshot,
    row: { ...row, keyword: "=FORMULA" },
    source: "naver" as const,
  };
  const csv = researchKeywordsCsv(
    [snapshot, actual],
    [
      {
        keyword: "텀블러",
        count: 2000,
        source: "manual",
        capturedAt: snapshot.savedAt,
      },
    ],
  );
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /데모 데이터\(가상\)/);
  assert.match(csv, /네이버 검색광고 API/);
  assert.match(csv, /직접 입력/);
  assert.match(csv, /2\.000/);
  assert.ok(csv.includes('"\'=FORMULA"'));
});
test("rule-based expansion suggestions remain candidate strings and avoid existing keywords", () => {
  const suggestions = keywordSuggestions("텀 블러", ["텀블러추천"]);
  assert.ok(suggestions.includes("텀블러비교"));
  assert.ok(!suggestions.includes("텀블러추천"));
  assert.equal(new Set(suggestions).size, suggestions.length);
  assert.deepEqual(keywordSuggestions("", []), []);
});
