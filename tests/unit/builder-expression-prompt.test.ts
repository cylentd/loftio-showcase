// The expression prompt (plan: loftio-expression-image, unit U1). The prompt text is data in expression-prompt-data.ts;
// these tests check the rules the plan sets for it, not its exact wording.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXPRESSION_PROMPT_BLOCKS } from '../../src/builder/expression-prompt-data.ts';
import { BLOCKED_RUNS, BLOCKED_WORDS } from '../../src/loadout/loadout-blocklist-data.ts';
import { EXPRESSION_PROMPT_VERSION, renderExpressionPrompt } from '../../src/builder/expression-prompt.ts';
import { resolveSelections } from '../../src/builder/selections.ts';

const moth = resolveSelections(
  { creature: 'moth', personality: 'bookworm', signatureDetail: 'reading-glasses', palette: 'blackberry' },
  () => 0,
);
const prompt = renderExpressionPrompt(moth);

/** Every string reachable in a data block, nested arrays and objects included. */
function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(allStrings);
  return [];
}

/** The plan's names, plus the repo's brand blocklist: BLOCKED_RUNS match anywhere, BLOCKED_WORDS as whole words. */
const PLAN_NAMES = ['pokemon', 'pokémon', 'pikachu', 'nintendo', 'disney', 'sanrio', 'digimon'];
const texts = [...allStrings(EXPRESSION_PROMPT_BLOCKS), prompt].map(text => text.toLowerCase());
const words = (text: string) => text.split(/[^a-z0-9]+/);

test('the prompt names the idle image as the only identity reference', () => {
  assert.match(prompt, /idle image[^.]*\b(only reference|identity)\b|\b(only reference|identity)\b[^.]*idle image/i);
});

test('the prompt asks for the same framing, size and position as the idle', () => {
  assert.match(prompt, /same framing/i);
  assert.match(prompt, /same size/i);
  assert.match(prompt, /same position/i);
});

test('the prompt asks for a happy welcome expression', () => {
  assert.match(prompt, /happy/i);
  assert.match(prompt, /welcom/i);
});

test('the prompt asks for a transparent background and exactly one image', () => {
  assert.match(prompt, /transparent background/i);
  assert.match(prompt, /exactly one image/i);
});

test('the rendered prompt leaves no placeholder behind', () => {
  assert.doesNotMatch(prompt, /\{\{|\}\}/);
});

test('the prompt version is a non-empty string', () => {
  assert.equal(typeof EXPRESSION_PROMPT_VERSION, 'string');
  assert.notEqual(EXPRESSION_PROMPT_VERSION, '');
});

test('the data blocks hold at least one string to check', () => {
  assert.ok(allStrings(EXPRESSION_PROMPT_BLOCKS).length > 0);
});

for (const name of [...PLAN_NAMES, ...BLOCKED_RUNS]) {
  test(`no prompt data string or rendered prompt contains the blocked name "${name}"`, () => {
    assert.deepEqual(texts.filter(text => text.includes(name)), []);
  });
}

for (const word of BLOCKED_WORDS) {
  test(`no prompt data string or rendered prompt contains the blocked word "${word}"`, () => {
    assert.deepEqual(texts.filter(text => words(text).includes(word)), []);
  });
}
