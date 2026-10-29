import test from "node:test";
import assert from "node:assert/strict";
import {
  safeProductUrl,
  manualAmount,
  validateCompetitor,
  competitorTotal,
  summarizeReviews,
  type Competitor,
  type ManualReview,
} from "../src/lib/product-research";
import { calculate, SAMPLE } from "../src/lib/calculator";

const row: Competitor = {
  rank: 1,
  name: "경쟁 상품",
  url: "https://example.com/product",
  price: "25000",
  shipping: "0",
  source: "쇼핑검색광고 직접 확인",
  checkedAt: "2026-10-29T15:30",
  context: "텀블러 / 모바일 / 쇼핑검색광고",
  strengths: "가벼움",
  weaknesses: "용량 작음",
};
test("selling links allow http(s) only and exclude credentials", () => {
  assert.equal(
    safeProductUrl(" https://example.com/item?q=1 "),
    "https://example.com/item?q=1",
  );
  for (const value of [
    "",
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:pass@example.com",
    "//example.com",
  ])
    assert.equal(safeProductUrl(value), null);
});
test("manual prices distinguish blank, invalid and free shipping", () => {
  assert.equal(manualAmount("0"), 0);
  for (const value of ["", " ", "-1", "1.5", "Infinity", "1000000001"])
    assert.equal(manualAmount(value), null);
  assert.equal(competitorTotal(row), 25000);
  assert.equal(competitorTotal({ ...row, shipping: "3000" }), 28000);
  assert.equal(competitorTotal({ ...row, shipping: "" }), null);
});
test("ad position records require product, evidence, observation time and context", () => {
  assert.equal(validateCompetitor(row), null);
  for (const key of [
    "name",
    "url",
    "price",
    "shipping",
    "source",
    "checkedAt",
    "context",
  ] as const)
    assert.ok(validateCompetitor({ ...row, [key]: "" }));
  assert.ok(validateCompetitor({ ...row, checkedAt: "invalid" }));
});
test("review summary isolates targets and preserves unclassified and mixed reviews", () => {
  const review: ManualReview = {
    id: "1",
    target: "0",
    text: "가볍지만 용량은 작아요",
    source: "직접 입력",
    checkedAt: row.checkedAt,
    strength: "가벼움",
    weakness: "작은 용량",
  };
  const reviews = [
    review,
    { ...review, id: "2", strength: "", weakness: "" },
    { ...review, id: "3", target: "1" },
  ];
  const summary = summarizeReviews(reviews, "0");
  assert.equal(summary.total, 2);
  assert.equal(summary.unclassified, 1);
  assert.equal(summary.strengths.length, 1);
  assert.equal(summary.weaknesses.length, 1);
  assert.deepEqual(summarizeReviews(reviews, "3"), {
    total: 0,
    strengths: [],
    weaknesses: [],
    unclassified: 0,
  });
  assert.equal(reviews.length, 3);
});
test("research calculations leave the original profitability inputs and results unchanged", () => {
  const input = { ...SAMPLE };
  const before = calculate(input);
  competitorTotal(row);
  summarizeReviews([], "0");
  assert.deepEqual(input, SAMPLE);
  assert.deepEqual(calculate(input), before);
  assert.equal(before.unitProfit, 4500);
});
