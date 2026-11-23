// The ordered follow-up list (plan: loftio-expression-image, unit U1). Feature 1 ships one entry; feature 2 adds one
// without rewiring, so worker and browser must read names and rules from this list.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderExpressionPrompt } from '../../src/builder/expression-prompt.ts';
import { FOLLOW_UPS, followUpArtifactNames } from '../../src/builder/follow-ups.ts';
import { resolveSelections } from '../../src/builder/selections.ts';

test('the list is the expression, then the alt', () => {
  assert.deepEqual(FOLLOW_UPS.map(entry => entry.id), ['expression', 'alt']);
});

test('the expression entry requires alpha', () => {
  assert.equal(FOLLOW_UPS[0]?.alphaRequired, true);
});

test('the expression entry has a positive integer max side', () => {
  const side = FOLLOW_UPS[0]?.maxSide;
  assert.ok(Number.isInteger(side) && (side ?? 0) > 0, `maxSide must be a positive integer, got ${String(side)}`);
});

test('the expression entry renders its prompt with renderExpressionPrompt', () => {
  const resolved = resolveSelections(
    { creature: 'moth', personality: 'bookworm', signatureDetail: 'reading-glasses', palette: 'blackberry' }, () => 0);
  const ctx = { resolved, residentId: 'gen-d', kind: 'A', trait: 'springy', element: 'bloom' } as const;
  assert.equal(FOLLOW_UPS[0]?.renderPrompt(ctx), renderExpressionPrompt(resolved));
});

test('the expression entry takes the idle as its only reference', () => {
  assert.deepEqual(FOLLOW_UPS[0]?.references, ['idle']);
});

test('the artifact names derived from the list are the expression pair, then the alt pair', () => {
  assert.deepEqual(followUpArtifactNames(FOLLOW_UPS), ['expression.png', 'expression.webp', 'alt.png', 'alt.webp']);
});

test('the artifact names follow the list: a second entry adds its own two names', () => {
  const second = { ...FOLLOW_UPS[0]!, id: 'alt-a' };
  assert.deepEqual(followUpArtifactNames([FOLLOW_UPS[0]!, second]),
    ['expression.png', 'expression.webp', 'alt-a.png', 'alt-a.webp']);
});
