import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketPreviewState, marketStageFor } from '../src/lib/market-preview';
import { PREVIEW_STAGES, validPreviewStage } from '../src/lib/layout-preview';

test('each market preview state is synthetic, contract-valid and identifies its rendered stage', () => {
  const stages = PREVIEW_STAGES['/tools/market/'];
  assert.equal(stages.length, 11);
  for (const stage of stages) {
    const state = marketPreviewState(stage);
    assert.ok(state, stage);
    assert.equal(marketStageFor(state.answers, Boolean(state.report)), stage);
    assert.equal(validPreviewStage('/tools/market/', stage), true);
    if (state.report) assert.equal(state.report.name, '미리보기 예시');
  }
  assert.equal(marketPreviewState('market-ads-result'), null);
  assert.equal(marketPreviewState('constructor'), null);
});
