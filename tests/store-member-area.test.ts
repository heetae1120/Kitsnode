import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EXAMPLE_AD_ROWS, exampleRows, formatAdValue, groupAdPerformance, summarizeAdPerformance, type AdPerformanceRow } from "../src/lib/store-ad-performance";
import { storeLinks } from "../src/lib/store-navigation";
import { toolLinks } from "../src/lib/tool-navigation";

const row: AdPerformanceRow = { date: "2026-11-01", hour: 0, spend: 1000, clicks: 10, conversions: 2, conversionRevenue: 6000, conversionType: "purchase" };
test("purchase metrics use raw summed totals rather than averages of ratios", () => {
  const result = summarizeAdPerformance([row, { ...row, spend: 9000, clicks: 90, conversions: 3, conversionRevenue: 9000 }]);
  assert.deepEqual(result, { spend: 10000, clicks: 100, purchases: 5, purchaseRevenue: 15000, cpc: 100, purchaseCvr: 5, cpa: 2000, roas: 150 });
});
test("empty data is unknown and measured zero is retained", () => {
  const empty = summarizeAdPerformance([]);
  assert.ok(Object.values(empty).every(value => value === null));
  const zero = summarizeAdPerformance([{ ...row, spend: 0, clicks: 0, conversions: 0, conversionRevenue: 0 }]);
  assert.equal(zero.spend, 0); assert.equal(zero.purchases, 0);
  assert.equal(zero.cpc, null); assert.equal(zero.purchaseCvr, null);
  assert.equal(zero.cpa, null); assert.equal(zero.roas, null);
  assert.equal(formatAdValue(null, "원"), "—");
  assert.equal(formatAdValue(0, "원"), "0원");
});
test("all or unknown conversions must never be relabeled as purchases", () => {
  for (const conversionType of ["all", "unknown"] as const) {
    const result = summarizeAdPerformance([row, { ...row, conversionType }]);
    assert.equal(result.spend, 2000); assert.equal(result.clicks, 20);
    assert.equal(result.purchases, null); assert.equal(result.purchaseRevenue, null);
    assert.equal(result.purchaseCvr, null); assert.equal(result.cpa, null); assert.equal(result.roas, null);
  }
});
test("missing conversion fields do not silently become zero", () => {
  const missingCount = summarizeAdPerformance([{ ...row, conversions: null }]);
  assert.equal(missingCount.purchases, null); assert.equal(missingCount.cpa, null);
  const missingRevenue = summarizeAdPerformance([{ ...row, conversionRevenue: null }]);
  assert.equal(missingRevenue.purchaseRevenue, null); assert.equal(missingRevenue.roas, null);
});
test("invalid numeric values are rejected", () => {
  for (const value of [NaN, Infinity, -1]) assert.throws(() => summarizeAdPerformance([{ ...row, spend: value }]));
});
test("synthetic filters and both groupings preserve the same totals", () => {
  assert.equal(EXAMPLE_AD_ROWS.length, 42); assert.equal(exampleRows("day").length, 6);
  for (const period of ["day", "week"] as const) {
    const rows = exampleRows(period), total = summarizeAdPerformance(rows);
    for (const dimension of ["date", "hour"] as const) {
      const groups = groupAdPerformance(rows, dimension);
      for (const key of ["spend", "clicks", "purchases", "purchaseRevenue"] as const)
        assert.equal(groups.reduce((sum, group) => sum + (group[key] ?? 0), 0), total[key]);
    }
  }
  assert.equal(groupAdPerformance(EXAMPLE_AD_ROWS, "date").length, 7);
  assert.equal(groupAdPerformance(EXAMPLE_AD_ROWS, "hour").length, 6);
  assert.ok(Object.isFrozen(EXAMPLE_AD_ROWS));
});
test("store navigation does not enter the editor tool allowlist", () => {
  assert.deepEqual(storeLinks.map(item => item.href), ["/store/", "/store/ads/", "/store/sales/"]);
  assert.ok(toolLinks.every(item => item.href.startsWith("/tools/")));
});
test("header adds store links after the original notice nodes without changing their order", () => {
  const source = readFileSync("src/components/tools-header.tsx", "utf8");
  assert.ok(source.indexOf('className="tool-membership-notice"') < source.indexOf('className="tool-membership-note"'));
  assert.ok(source.indexOf('className="tool-membership-note"') < source.indexOf("storeLinks.map"));
  assert.match(source, /item.id === "store" && storeLinks.map/);
});
test("member pages cannot accept credentials or fabricate authentication", () => {
  const pages = readFileSync("src/components/store/store-pages.tsx", "utf8");
  for (const file of ["store-pages.tsx", "store-shell.tsx", "store-example-report.tsx"]) {
    const source = readFileSync("src/components/store/" + file, "utf8");
    assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage|access_token|<form|type="password"/);
  }
  assert.match(pages, /StoreButton disabled aria-describedby="account-unavailable"/);
  assert.match(pages, /StoreButton disabled aria-describedby="connection-unavailable"/);
  assert.match(pages, /href="\/store\/ads\/example\/"/);
  assert.match(pages, /<dd>—<span>/);
});
test("new styles are scoped and reuse admin token values without applying admin globals", () => {
  const css = readFileSync("src/components/store/store.css", "utf8");
  const tokens = readFileSync("src/components/store/store-tokens.css", "utf8");
  assert.doesNotMatch(css, /(^|\n)(body|html|:root|\*)\s*[{,]/);
  assert.match(tokens, /\.store-theme/);
  assert.doesNotMatch(tokens, /\.admin-theme|:root/);
  assert.match(tokens, /--store-primary: #216ee4/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /prefers-reduced-motion/);
});

test("primary hover does not override secondary button contrast", () => {
  const css = readFileSync("src/components/store/store.css", "utf8");
  assert.ok(css.includes(".store-button:hover:not(:disabled):not(.store-button--secondary)"));
});
