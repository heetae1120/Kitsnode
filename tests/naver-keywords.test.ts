import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSeeds,
  countRange,
  addRanges,
  formatRange,
  formatCount,
  rowVolume,
  sortKeywords,
  mobileShare,
  demoKeywordData,
  validateEndpoint,
  validateKeywordResponse,
  keywordCsv,
  type KeywordRow,
} from "../src/lib/naver-keywords";
const row: KeywordRow = {
  keyword: "가습기",
  pcSearches: "100",
  mobileSearches: 900,
  pcClicks: 1,
  mobileClicks: 2,
  competition: "높음",
};
test("normalizes and deduplicates up to five hint keywords", () => {
  assert.deepEqual(parseSeeds("미니 가습기,텀블러，미니가습기\n무선충전기"), [
    "미니가습기",
    "텀블러",
    "무선충전기",
  ]);
  for (const value of ["", ", ,", "1,2,3,4,5,6", "가".repeat(51)])
    assert.throws(() => parseSeeds(value));
});
test("preserves official less-than counts as ranges and missing counts as unknown", () => {
  assert.deepEqual(countRange("< 10"), { min: 0, max: 9 });
  assert.equal(formatCount("<10"), "< 10");
  assert.equal(
    formatRange(addRanges([countRange(120), countRange("<10")])),
    "120~129",
  );
  assert.equal(
    formatRange(rowVolume({ ...row, pcSearches: null }, "all")),
    "—",
  );
  assert.equal(countRange(-1), null);
  assert.equal(countRange("not a count"), null);
  assert.equal(formatCount("12000"), "12,000");
  assert.equal(mobileShare(row), 90);
  assert.equal(mobileShare({ ...row, pcSearches: "<10" }), null);
});
test("device selection changes ordering without mutating the result", () => {
  const other = {
    ...row,
    keyword: "텀블러",
    pcSearches: 800,
    mobileSearches: 100,
  };
  const rows = [row, other];
  assert.equal(sortKeywords(rows, "pc")[0].keyword, "텀블러");
  assert.equal(sortKeywords(rows, "mobile")[0].keyword, "가습기");
  assert.equal(sortKeywords(rows, "all")[0].keyword, "가습기");
  assert.equal(rows[0], row);
  assert.equal(
    sortKeywords(
      [{ ...row, keyword: "unknown", pcSearches: null }, row],
      "pc",
    )[1].keyword,
    "unknown",
  );
});
test("demo results remain explicitly demo and real responses require the server contract", () => {
  const demo = demoKeywordData(["텀블러"]);
  assert.equal(demo.source, "demo");
  assert.equal(demo.keywords.length, 8);
  assert.throws(() => validateKeywordResponse(demo));
  const real = validateKeywordResponse({
    ...demo,
    source: "naver",
    keywords: [row, row],
  });
  assert.equal(real.source, "naver");
  assert.equal(real.keywords.length, 1);
  assert.throws(() =>
    validateKeywordResponse({ ...demo, source: "naver", fetchedAt: "invalid" }),
  );
  assert.throws(() => validateKeywordResponse({ source: "naver" }));
});
test("endpoint settings accept server URLs and reject credential-bearing or direct Naver URLs", () => {
  assert.equal(
    validateEndpoint("https://example.com/api/keywords"),
    "https://example.com/api/keywords",
  );
  assert.ok(validateEndpoint("http://localhost:8787/api/keywords"));
  assert.equal(validateEndpoint(""), "");
  for (const url of [
    "http://example.com/api",
    "javascript:alert(1)",
    "https://user:secret@example.com/api",
    "https://example.com/api?token=secret",
    "https://api.searchad.naver.com/keywordstool",
  ])
    assert.throws(() => validateEndpoint(url));
});
test("CSV is labeled by data source and neutralizes formula-like keyword cells", () => {
  const csv = keywordCsv(
    [
      { ...row, keyword: "=SUM(A1)" },
      { ...row, keyword: '쉼표,"인용"' },
    ],
    "all",
    "demo",
    "2026-10-28T00:00:00Z",
  );
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /데모 데이터\(가상\)/);
  assert.ok(csv.includes('"\'=SUM(A1)"'));
  assert.ok(csv.includes('쉼표,""인용""'));
});
