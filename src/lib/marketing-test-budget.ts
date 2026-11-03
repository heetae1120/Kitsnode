import { marketingPlan, type MarketingPlanInput } from "./marketing-plan";

/** A transparent starting rule for a first test, not a performance forecast. */
export function marketingTestBudget(input: MarketingPlanInput) {
  if (input.marketingBudget !== undefined) return null;
  const plan = marketingPlan(input);
  if (plan.marketing <= 0 || plan.margin <= 0) return null;
  const amount = Math.min(plan.marketing, Math.max(1, Math.floor(plan.marketing * 0.1)));
  return {
    amount,
    heldBack: plan.marketing - amount,
    breakEvenUnits: Math.ceil((plan.fixed + amount) / plan.margin),
  };
}
