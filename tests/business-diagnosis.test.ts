import test from "node:test";
import assert from "node:assert/strict";
import { diagnosisPath, clickTarget } from "../src/lib/business-diagnosis";
import { SAMPLE } from "../src/lib/calculator";
test("seller diagnosis branches skip inapplicable questions and require ad operator selection", () => {
  assert.equal(
    diagnosisPath({ store: false, ads: null, agency: null }),
    "starter",
  );
  assert.equal(
    diagnosisPath({ store: true, ads: false, agency: null }),
    "profit",
  );
  assert.equal(diagnosisPath({ store: true, ads: true, agency: null }), null);
  for (const agency of [false, true])
    assert.equal(diagnosisPath({ store: true, ads: true, agency }), "report");
  assert.equal(diagnosisPath({ store: null, ads: null, agency: null }), null);
});
test("strict profit sales target distinguishes profit from exact break-even", () => {
  assert.equal(clickTarget(SAMPLE)?.orders, 2);
  const input = { ...SAMPLE, price: 10000, cost: 5000, cpc: 100 };
  assert.equal(clickTarget(input)?.orders, 3); // two sales only recover the 10,000 won spend
  assert.equal(clickTarget({ ...input, cpc: 5000 })?.orders, null);
  assert.equal(clickTarget({ ...input, cost: 10000 }), null);
  assert.equal(clickTarget({ ...input, cpc: 0 }), null);
});
