import { calculate, type ProductInput } from "./calculator";
export type SellerAnswers = {
  store: boolean | null;
  ads: boolean | null;
  agency: boolean | null;
};
export type DiagnosisPath = "starter" | "profit" | "report";
export function diagnosisPath(a: SellerAnswers): DiagnosisPath | null {
  if (a.store === false) return "starter";
  if (a.store !== true || a.ads === null) return null;
  if (a.ads === false) return "profit";
  return a.agency === null ? null : "report";
}
export function clickTarget(input: ProductInput) {
  const r = calculate(input);
  if (input.cpc === 0 || r.margin <= 0) return null;
  const spend = 100 * input.cpc;
  if (r.margin <= input.cpc) return { clicks: 100, orders: null, spend };
  let orders = Math.floor(spend / r.margin) + 1;
  while (orders > 1 && (orders - 1) * r.margin > spend) orders--;
  while (orders <= 100 && orders * r.margin <= spend) orders++;
  return { clicks: 100, orders: orders <= 100 ? orders : null, spend };
}
export function clickTargetText(input: ProductInput) {
  const target = clickTarget(input);
  return target === null
    ? "유효한 CPC와 양수 공헌이익이 있어야 판매 목표를 계산할 수 있습니다."
    : target.orders === null
      ? "현재 비용 구조에서는 100회 클릭이 모두 구매로 이어져도 순이익이 남지 않습니다."
      : `광고 클릭 100회 중 최소 ${target.orders}개를 판매해야 광고비 차감 후 이익이 남습니다.`;
}
