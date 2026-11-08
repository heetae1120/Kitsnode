import { plannerExamples } from './planner-examples';

export type PlannerExampleState<T> = { draft: T; exampleFields: string[] };

/** A direct edit replaces the reference source for that field only. */
export function setPlannerInput<T>(state: PlannerExampleState<T>, key: keyof T, value: string): PlannerExampleState<T> {
  return { draft: { ...state.draft, [key]: value }, exampleFields: state.exampleFields.filter(field => field !== key) };
}

/** An existing handling cost keeps its value and its original source. */
export function setPlannerExample<T extends Record<keyof typeof plannerExamples, string>>(
  state: PlannerExampleState<T>, key: keyof typeof plannerExamples,
): PlannerExampleState<T> {
  const autoHandling = key === 'returnRate' && state.draft.returnHandling === '';
  return {
    draft: { ...state.draft, [key]: plannerExamples[key], ...(autoHandling ? { returnHandling: plannerExamples.returnHandling } : {}) },
    exampleFields: [...new Set([...state.exampleFields, key, ...(autoHandling ? ['returnHandling'] : [])])],
  };
}

/** Preserve stored source while excluding a handling cost that is not used. */
export function activePlannerExamples(draft: { returnRate: string }, exampleFields: string[]): string[] {
  return exampleFields.filter(field => field !== 'returnHandling' || (draft.returnRate !== '' && Number(draft.returnRate) > 0));
}
