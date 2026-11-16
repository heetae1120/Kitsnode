import type { SellerAnswers } from './business-diagnosis';
import type { ProductInput } from './calculator';

// All values are fabricated and kept in memory; no visitor input is read.
const sample: ProductInput = { name: '미리보기 예시', price: 30000, cost: 12000, shipping: 3000, other: 1000, feePercent: 5, cpc: 500, cvrPercent: 3, budget: 1000000 };
const answersByStage: Record<string, SellerAnswers> = {
  'market-start': { store: null, ads: null, agency: null },
  'market-ads': { store: true, ads: null, agency: null },
  'market-agency': { store: true, ads: true, agency: null },
  'market-starter': { store: false, ads: null, agency: null },
  'market-profit': { store: true, ads: false, agency: null },
  'market-direct': { store: true, ads: true, agency: false },
  'market-outsourced': { store: true, ads: true, agency: true },
};
export function marketPreviewState(stage: string): { answers: SellerAnswers; report: ProductInput | null } | null {
  const result = stage.endsWith('-result');
  const base = result ? stage.slice(0, -'-result'.length) : stage;
  if (!Object.hasOwn(answersByStage, base) || (result && !['market-starter', 'market-profit', 'market-direct', 'market-outsourced'].includes(base))) return null;
  return { answers: { ...answersByStage[base] }, report: result ? { ...sample } : null };
}
export function marketStageFor(answers: SellerAnswers, result: boolean): string {
  const base = answers.store === null ? 'market-start' : answers.store === false ? 'market-starter' : answers.ads === null ? 'market-ads' : answers.ads === false ? 'market-profit' : answers.agency === null ? 'market-agency' : answers.agency ? 'market-outsourced' : 'market-direct';
  return result && ['market-starter', 'market-profit', 'market-direct', 'market-outsourced'].includes(base) ? `${base}-result` : base;
}
