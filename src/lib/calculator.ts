export type ProductInput = {
  name: string;
  price: number;
  cost: number;
  shipping: number;
  other: number;
  feePercent: number;
  cpc: number;
  cvrPercent: number;
  budget: number;
};
export const SAMPLE: ProductInput = {
  name: "프리미엄 무선 미니 가습기",
  price: 39000,
  cost: 12000,
  shipping: 0,
  other: 0,
  feePercent: 0,
  cpc: 450,
  cvrPercent: 2,
  budget: 100000,
};
export function validateInput(input: ProductInput): string | null {
  if (!input.name.trim()) return "상품명 또는 판매 예정 품목을 입력해 주세요.";
  for (const [key, label] of Object.entries({
    price: "판매가",
    cost: "원가",
    shipping: "택배비",
    other: "기타 비용",
    feePercent: "판매 수수료",
    cpc: "CPC",
    cvrPercent: "구매전환율",
    budget: "광고 예산",
  })) {
    const value = input[key as keyof ProductInput];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      return `${label}은(는) 0 이상의 유효한 숫자로 입력해 주세요.`;
  }
  if (input.price <= 0) return "판매가는 0원보다 커야 합니다.";
  if (input.feePercent > 100 || input.cvrPercent > 100)
    return "수수료와 구매전환율은 100% 이하여야 합니다.";
  if (
    [
      input.price,
      input.cost,
      input.shipping,
      input.other,
      input.cpc,
      input.budget,
    ].some((n) => n > 1_000_000_000)
  )
    return "금액은 10억 원 이내로 입력해 주세요.";
  if (
    input.cpc > 0 &&
    Math.max(input.price, input.budget) / input.cpc >
      Number.MAX_SAFE_INTEGER - 2
  )
    return "CPC가 너무 작아 클릭 수를 정확하게 계산할 수 없습니다.";
  if (
    input.cpc > 0 &&
    input.cvrPercent > 0 &&
    !Number.isFinite(input.cpc / (input.cvrPercent / 100))
  )
    return "구매전환율이 너무 작아 정확하게 계산할 수 없습니다.";
  const margin =
    input.price -
    input.cost -
    input.shipping -
    input.other -
    (input.price * input.feePercent) / 100;
  if (margin > 0 && input.budget / margin > Number.MAX_SAFE_INTEGER - 2)
    return "마진이 너무 작아 최소 판매량을 정확하게 계산할 수 없습니다.";
  return null;
}
export function calculate(input: ProductInput) {
  const error = validateInput(input);
  if (error) throw new Error(error);
  const { price, cost, shipping, other, feePercent, cpc, cvrPercent, budget } =
    input;
  const rate = cvrPercent / 100;
  const margin = price - cost - shipping - other - (price * feePercent) / 100;
  // Zero CPC is an undefined paid-traffic model, not unlimited free clicks.
  const cpa = cpc > 0 && rate > 0 ? cpc / rate : null;
  const unitProfit = cpa === null ? null : margin - cpa;
  const roas = cpa === null ? null : (price / cpa) * 100;
  const breakEvenRoas = margin > 0 ? (price / margin) * 100 : null;
  const breakEvenCvr = margin > 0 && cpc > 0 ? (cpc / margin) * 100 : null;
  let breakEvenClicks = margin > 0 && cpc > 0 ? Math.floor(margin / cpc) : null;
  // Correct floating-point division only if multiplication proves the click affordable.
  if (breakEvenClicks !== null) {
    while ((breakEvenClicks + 1) * cpc <= margin) breakEvenClicks++;
    while (breakEvenClicks * cpc > margin) breakEvenClicks--;
  }
  let clicks = cpc > 0 ? Math.floor(budget / cpc) : 0;
  if (cpc > 0) {
    while ((clicks + 1) * cpc <= budget) clicks++;
    while (clicks * cpc > budget) clicks--;
  }
  const adSpend = clicks * cpc;
  const orders = clicks * rate;
  const revenue = orders * price;
  const totalProfit = orders * margin - adSpend;
  let requiredOrders = margin > 0 ? Math.ceil(adSpend / margin) : null;
  if (requiredOrders !== null) {
    while (requiredOrders * margin < adSpend) requiredOrders++;
    while (requiredOrders > 0 && (requiredOrders - 1) * margin >= adSpend)
      requiredOrders--;
  }
  // A ±1 KRW tolerance defines the displayed break-even band.
  const status:
    | "not-recommended"
    | "unavailable"
    | "loss"
    | "break-even"
    | "good" =
    margin <= 0
      ? "not-recommended"
      : unitProfit === null
        ? cpc === 0
          ? "unavailable"
          : "loss"
        : Math.abs(unitProfit) <= 1
          ? "break-even"
          : unitProfit > 0
            ? "good"
            : "loss";
  return {
    margin,
    cpa,
    unitProfit,
    roas,
    breakEvenRoas,
    breakEvenCvr,
    breakEvenClicks,
    clicks,
    adSpend,
    remainingBudget: budget - adSpend,
    orders,
    revenue,
    totalProfit,
    requiredOrders,
    simulatedRoas: adSpend > 0 ? (revenue / adSpend) * 100 : null,
    status,
  };
}
export type Calculation = ReturnType<typeof calculate>;
export const won = (value: number | null) =>
  value === null
    ? "계산 불가"
    : `${Math.round(value).toLocaleString("ko-KR")}원`;
export const num = (value: number | null, digits = 1) =>
  value === null
    ? "—"
    : value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
