// The alt prompt (plan: loftio-alt-art, unit U1). Wording is data in alt-prompt-data.ts; these tests check the rules the plan
// sets for it, not its exact text.
// Assumed API (product code, next stage): alt-prompt-data.ts exports ALT_PROMPT_BLOCKS (any nesting of strings);
// alt-prompt.ts exports renderAltPrompt(ctx: FollowUpContext): string. The kind arrives as ctx.kind ('A' | 'B'); the renderer reads it
// and never calls altKindFor itself, so every test here passes the kind explicitly.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALT_PROMPT_BLOCKS } from '../../src/builder/alt-prompt-data.ts';
import { ALT_PROMPT_VERSION, renderAltPrompt } from '../../src/builder/alt-prompt.ts';
import type { FollowUpContext } from '../../src/builder/follow-ups.ts';
import { resolveSelections } from '../../src/builder/selections.ts';
import { ELEMENTS } from '../../src/loadout/element-data.ts';
import { TRAITS } from '../../src/loadout/loadout-data.ts';
import { BLOCKED_RUNS, BLOCKED_WORDS } from '../../src/loadout/loadout-blocklist-data.ts';
import { fold } from '../../src/loadout/loadout-blocklist-model.ts';
import type { Element, Trait } from '../../src/loadout/loadout-model.ts';

const resolved = resolveSelections(
  { creature: 'moth', personality: 'bookworm', signatureDetail: 'reading-glasses', palette: 'blackberry' }, () => 0);
const KINDS = ['A', 'B'] as const;
const ctxFor = (kind: 'A' | 'B', trait: Trait = TRAITS[0]!, element: Element = ELEMENTS[0]!): FollowUpContext => ({ resolved, residentId: 'gen-d', kind, trait, element });
const promptA = renderAltPrompt(ctxFor('A'));
const promptB = renderAltPrompt(ctxFor('B'));
// Every kind, trait and element the prompt can be built from, so a blocked word in any filled block is found.
const everyPrompt = KINDS.flatMap(kind => TRAITS.flatMap(trait => ELEMENTS.map(element => renderAltPrompt(ctxFor(kind, trait, element)))));

function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(allStrings);
  return [];
}
const PLAN_NAMES = ['pokemon', 'pokémon', 'pikachu', 'nintendo', 'disney', 'sanrio', 'digimon'];
const texts = [...allStrings(ALT_PROMPT_BLOCKS), ...everyPrompt];
// Folded the way the product's blocklist model folds a name (case, accents, number-for-letter swaps), then its words and its run
// (letters only, separators removed), so "Pok3mon" or "pika chu" in a prompt string is caught as the model would catch it.
const words = (text: string) => fold(text).split(/[^a-z]+/);
const run = (text: string) => fold(text).replace(/[^a-z]+/g, '');

for (const [name, prompt] of [['kind A', promptA], ['kind B', promptB]] as const) {
  test(`${name}: the prompt says references are identity only`, () => {
    assert.match(prompt, /identity only/i);
  });
  test(`${name}: the prompt asks for a new pose, expression, camera angle and lighting`, () => {
    for (const part of ['pose', 'expression', 'camera angle', 'lighting']) assert.match(prompt, new RegExp(part, 'i'));
  });
  test(`${name}: the prompt asks for a background`, () => {
    assert.match(prompt, /background/i);
  });
  test(`${name}: the prompt leaves no placeholder behind`, () => {
    assert.doesNotMatch(prompt, /\{\{|\}\}/);
  });
}

// Owner, 2026-11-20: "action was better", so kind A is the plain dynamic action moment again (the goofy rewrite is gone).
test('kind A asks for a dynamic action moment and not a calm one', () => {
  assert.match(promptA, /dynamic action moment/i);
  assert.doesNotMatch(promptA, /calm everyday|ridiculous|funny/i);
});

test('kind B asks for a calm everyday moment and not an action one', () => {
  assert.match(promptB, /calm/i);
  assert.match(promptB, /everyday/i);
  assert.doesNotMatch(promptB, /dynamic action/i);
});

test('the prompt version is back at alt-v1, the action wording it named', () => {
  assert.equal(ALT_PROMPT_VERSION, 'alt-v1');
});

test('another trait changes the prompt', () => {
  assert.notEqual(renderAltPrompt(ctxFor('A', TRAITS[1])), promptA);
});

test('another element changes the prompt', () => {
  assert.notEqual(renderAltPrompt(ctxFor('A', TRAITS[0], ELEMENTS[1])), promptA);
});

test('the prompt version is a non-empty string', () => {
  assert.equal(typeof ALT_PROMPT_VERSION, 'string');
  assert.notEqual(ALT_PROMPT_VERSION, '');
});

test('the data blocks hold at least one string to check', () => {
  assert.ok(allStrings(ALT_PROMPT_BLOCKS).length > 0);
});

test('the blocklist lists to check against are not empty', () => {
  assert.ok(BLOCKED_WORDS.length > 0);
  assert.ok(BLOCKED_RUNS.length > 0);
});

for (const name of [...PLAN_NAMES, ...BLOCKED_RUNS]) {
  test(`no alt prompt data string or rendered prompt contains the blocked name "${name}"`, () => {
    assert.deepEqual(texts.filter(text => run(text).includes(fold(name))), []);
  });
}

for (const word of BLOCKED_WORDS) {
  test(`no alt prompt data string or rendered prompt contains the blocked word "${word}"`, () => {
    assert.deepEqual(texts.filter(text => words(text).includes(word)), []);
  });
}
