import test from "node:test";
import assert from "node:assert/strict";
import { calculate, SAMPLE, validateInput } from "../src/lib/calculator";

test("sample uses the same contribution margin across unit and budget calculations", () => {
  const r = calculate(SAMPLE);
  assert.equal(r.margin, 27000);
  assert.equal(r.cpa, 22500);
  assert.equal(r.unitProfit, 4500);
  assert.equal(r.breakEvenClicks, 60);
  assert.equal(r.breakEvenCvr, (450 / 27000) * 100);
  assert.equal(r.clicks, 222);
  assert.equal(r.adSpend, 99900);
  assert.equal(r.remainingBudget, 100);
  assert.equal(r.orders, 4.44);
  assert.equal(r.requiredOrders, 4);
  assert.ok(Math.abs(r.revenue - 173160) < 1e-8);
  assert.ok(Math.abs(r.totalProfit - 19980) < 1e-8);
  assert.equal(r.status, "good");
});
test("all costs and percentage fees reduce the contribution margin", () => {
  const r = calculate({
    ...SAMPLE,
    shipping: 3000,
    other: 1000,
    feePercent: 5,
  });
  assert.equal(r.margin, 21050);
  assert.equal(r.unitProfit, -1450);
  assert.equal(r.status, "loss");
  assert.equal(r.breakEvenClicks, 46);
  assert.equal(r.requiredOrders, 5);
});
test("break-even clicks floor, sales ceil, and spend never exceed budget", () => {
  const input = {
    ...SAMPLE,
    price: 10000,
    cost: 7000,
    cpc: 700,
    budget: 10000,
  };
  const r = calculate(input);
  assert.equal(r.breakEvenClicks, 4);
  assert.equal(r.clicks, 14);
  assert.equal(r.adSpend, 9800);
  assert.equal(r.requiredOrders, 4);
  assert.ok(r.breakEvenClicks! * input.cpc <= r.margin);
  assert.ok((r.breakEvenClicks! + 1) * input.cpc > r.margin);
});
test("zero budget and budgets below CPC do not invent spend or orders", () => {
  for (const budget of [0, 100]) {
    const r = calculate({ ...SAMPLE, budget });
    assert.equal(r.clicks, 0);
    assert.equal(r.adSpend, 0);
    assert.equal(r.orders, 0);
    assert.equal(r.requiredOrders, 0);
    assert.equal(r.simulatedRoas, null);
    assert.equal(r.remainingBudget, budget);
  }
});
test("zero CPC yields an explicitly unavailable paid-traffic model", () => {
  const r = calculate({ ...SAMPLE, cpc: 0 });
  assert.equal(r.cpa, null);
  assert.equal(r.unitProfit, null);
  assert.equal(r.breakEvenClicks, null);
  assert.equal(r.clicks, 0);
  assert.equal(r.remainingBudget, 100000);
  assert.equal(r.status, "unavailable");
});
test("zero conversion yields spend and loss but undefined CPA", () => {
  const r = calculate({ ...SAMPLE, cvrPercent: 0 });
  assert.equal(r.cpa, null);
  assert.equal(r.unitProfit, null);
  assert.equal(r.orders, 0);
  assert.equal(r.totalProfit, -99900);
  assert.equal(r.simulatedRoas, 0);
  assert.equal(r.status, "loss");
});
test("zero and negative margin are not recommended with unreachable break-even", () => {
  for (const cost of [39000, 40000]) {
    const r = calculate({ ...SAMPLE, cost });
    assert.equal(r.status, "not-recommended");
    assert.equal(r.breakEvenRoas, null);
    assert.equal(r.breakEvenCvr, null);
    assert.equal(r.breakEvenClicks, null);
    assert.equal(r.requiredOrders, null);
  }
});
test("a positive margin below one click results in zero affordable clicks", () => {
  const r = calculate({ ...SAMPLE, cost: 38900 });
  assert.equal(r.breakEvenClicks, 0);
  assert.ok(r.breakEvenCvr! > 100);
});
test("break-even tolerance is explicitly one won", () => {
  assert.equal(calculate({ ...SAMPLE, cpc: 540 }).status, "break-even");
  assert.equal(calculate({ ...SAMPLE, cpc: 540.01 }).status, "break-even");
  assert.equal(calculate({ ...SAMPLE, cpc: 541 }).status, "loss");
});
test("reject invalid inputs rather than silently calculating NaN", () => {
  for (const change of [
    { name: "" },
    { price: 0 },
    { cost: -1 },
    { budget: Infinity },
    { cpc: NaN },
    { feePercent: 101 },
    { cvrPercent: 101 },
    { shipping: -3 },
    { price: 1e12 },
  ]) {
    assert.ok(validateInput({ ...SAMPLE, ...change }));
    assert.throws(() => calculate({ ...SAMPLE, ...change }));
  }
  assert.equal(validateInput({ ...SAMPLE, cost: 0, cvrPercent: 100 }), null);
});
test("fractional CPC respects exact multiplication affordability", () => {
  const r = calculate({ ...SAMPLE, price: 1, cost: 0, cpc: 0.1, budget: 0.3 });
  assert.ok(r.adSpend <= 0.3);
  assert.ok((r.clicks + 1) * 0.1 > 0.3);
  assert.ok(r.breakEvenClicks! * 0.1 <= r.margin);
});

test("rejects unsafe click and required-order magnitudes without looping", () => {
  assert.throws(() => calculate({ ...SAMPLE, cpc: 1e-20 }));
  assert.throws(() => calculate({ ...SAMPLE, price: 1, cost: 1 - 1e-14 }));
});

test("same ROAS 200 percent yields opposite profits at 30 and 70 percent cost ratios", () => {
  const low = calculate({
    ...SAMPLE,
    price: 40000,
    cost: 12000,
    cpc: 400,
    cvrPercent: 2,
  });
  const high = calculate({
    ...SAMPLE,
    price: 40000,
    cost: 28000,
    cpc: 400,
    cvrPercent: 2,
  });
  assert.equal(low.roas, 200);
  assert.equal(high.roas, 200);
  assert.equal(low.unitProfit, 8000);
  assert.equal(high.unitProfit, -8000);
  assert.ok(Math.abs(low.breakEvenRoas! - 142.857142857) < 1e-6);
  assert.ok(Math.abs(high.breakEvenRoas! - 333.333333333) < 1e-6);
  assert.equal(low.breakEvenClicks, 70);
  assert.equal(high.breakEvenClicks, 30);
  assert.equal(
    calculate({ ...SAMPLE, budget: 300000 }).breakEvenClicks,
    calculate({ ...SAMPLE, budget: 0 }).breakEvenClicks,
  );
});
