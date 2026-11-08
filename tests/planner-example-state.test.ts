import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activePlannerExamples, setPlannerExample, setPlannerInput } from '../src/lib/planner-example-state';

const initial = () => ({ draft: { feePercent: '', logistics: '', packaging: '', returnRate: '', returnHandling: '' }, exampleFields: [] as string[] });

test('all reference costs reset to zero without a reference warning, then return handling source resumes', () => {
  let state = initial();
  for (const key of ['feePercent', 'logistics', 'packaging', 'returnRate'] as const) state = setPlannerExample(state, key);
  assert.equal(state.draft.returnHandling, '5000');
  for (const key of ['feePercent', 'logistics', 'packaging', 'returnRate'] as const) state = setPlannerInput(state, key, '0');
  assert.deepEqual(activePlannerExamples(state.draft, state.exampleFields), []);
  state = setPlannerInput(state, 'returnRate', '2');
  assert.deepEqual(activePlannerExamples(state.draft, state.exampleFields), ['returnHandling']);
});

test('reference rate preserves a manually entered handling value and its source', () => {
  let state = setPlannerInput(initial(), 'returnHandling', '8000');
  state = setPlannerExample(state, 'returnRate');
  assert.equal(state.draft.returnHandling, '8000');
  assert.deepEqual(state.exampleFields, ['returnRate']);
  state = setPlannerInput(state, 'returnRate', '0');
  assert.deepEqual(activePlannerExamples(state.draft, state.exampleFields), []);
});

test('reference rate marks only automatically populated handling and retains it on repeated selection', () => {
  let state = setPlannerExample(initial(), 'returnRate');
  state = setPlannerExample(state, 'returnRate');
  assert.deepEqual(state.exampleFields, ['returnRate', 'returnHandling']);
  state = setPlannerInput(state, 'returnHandling', '9000');
  state = setPlannerExample(state, 'returnRate');
  assert.equal(state.draft.returnHandling, '9000');
  assert.deepEqual(state.exampleFields, ['returnRate']);
});

test('an unused handling reference is excluded but unrelated reference costs remain active', () => {
  let state = setPlannerExample(initial(), 'returnRate');
  state = setPlannerExample(state, 'packaging');
  state = setPlannerInput(state, 'returnRate', '');
  assert.deepEqual(activePlannerExamples(state.draft, state.exampleFields), ['packaging']);
  assert.deepEqual(state.exampleFields, ['returnHandling', 'packaging']);
});
