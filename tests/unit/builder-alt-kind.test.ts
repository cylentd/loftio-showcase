// altKindFor (plan: loftio-alt-art, unit U1): a resident's alt art kind. Owner, 2026-11-20: action (A) is not
// consistently good enough to give players, so every made resident gets quiet (B) until A is re-approved.
// API: game/src/builder/alt-kind.ts exports altKindFor(id: string): 'A' | 'B'.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { altKindFor } from '../../src/builder/alt-kind.ts';

const IDS = Array.from({ length: 40 }, (_unused, index) => `gen-resident-${index}`);

test('every id gets the quiet kind B, and asking twice gives the same one', () => {
  assert.deepEqual([IDS.map(altKindFor), IDS.map(altKindFor)], [IDS.map(() => 'B'), IDS.map(() => 'B')]);
});

test('ids that drew action under the old even split now get B too', () => {
  assert.deepEqual(['gen-resident-1', 'gen-resident-4', 'gen-resident-5'].map(altKindFor), ['B', 'B', 'B']);
});
