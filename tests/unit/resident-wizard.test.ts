import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SURPRISE } from '../../src/builder/catalog-data.ts';
import { CURATED } from '../../src/builder/curated.ts';
import { SUMMARY_STEP, WIZARD_FIELDS, createWizard } from '../../src/residents/wizard.ts';

function fakeBuilder() {
  const picks: [string, string | null][] = []; let creates = 0;
  return { picks, get creates() { return creates; }, select: (field: string, value: string | null) => { picks.push([field, value]); }, create: async () => { creates += 1; } };
}

test('the builder asks one question per step: friend, feeling, extra, colours, then the summary', () => {
  assert.deepEqual(WIZARD_FIELDS, ['creature', 'personality', 'signatureDetail', 'palette']);
  assert.equal(SUMMARY_STEP, 4);
  const wizard = createWizard(fakeBuilder(), () => 0);
  assert.equal(wizard.step, 0);
  assert.equal(wizard.field, 'creature');
});

test('tapping a card selects it for this step and moves to the next', () => {
  const builder = fakeBuilder(); const wizard = createWizard(builder, () => 0);
  wizard.choose('fox'); wizard.choose('sleepy'); wizard.choose('scarf'); wizard.choose(null);
  assert.deepEqual(builder.picks, [['creature', 'fox'], ['personality', 'sleepy'], ['signatureDetail', 'scarf'], ['palette', null]]);
  assert.equal(wizard.step, SUMMARY_STEP);
  assert.equal(wizard.field, null);
});

test('the dice picks surprise for friend, feeling and extra, and moves on', () => {
  const builder = fakeBuilder(); const wizard = createWizard(builder, () => 0);
  wizard.surprise(); wizard.surprise(); wizard.surprise();
  assert.deepEqual(builder.picks, [['creature', SURPRISE], ['personality', SURPRISE], ['signatureDetail', SURPRISE]]);
  assert.equal(wizard.step, 3);
});

test('on the colours step the dice picks a real palette, chosen by the random draw', () => {
  for (const [draw, expected] of [[0, CURATED.palette[0]], [0.99, CURATED.palette.at(-1)]] as const) {
    const builder = fakeBuilder(); const wizard = createWizard(builder, () => draw);
    wizard.goTo(3); wizard.surprise();
    assert.deepEqual(builder.picks, [['palette', expected]]);
    assert.equal(wizard.step, SUMMARY_STEP);
  }
});

test('nothing shows as picked until the user picks it, and back keeps what they picked', () => {
  const wizard = createWizard(fakeBuilder(), () => 0);
  assert.equal(WIZARD_FIELDS.some(field => wizard.chosen(field)), false);
  wizard.choose('fox'); wizard.surprise(); wizard.back(); wizard.back();
  assert.equal(wizard.chosen('creature'), true);
  assert.equal(wizard.chosen('personality'), true);
  assert.equal(wizard.chosen('signatureDetail'), false);
});

test('back is one step, stops at the first, and never changes a pick', () => {
  const builder = fakeBuilder(); const wizard = createWizard(builder, () => 0);
  wizard.choose('cat'); wizard.back();
  assert.equal(wizard.step, 0);
  wizard.back();
  assert.equal(wizard.step, 0);
  assert.equal(builder.picks.length, 1);
});

test('a summary pick jumps back to its own step', () => {
  const wizard = createWizard(fakeBuilder(), () => 0);
  wizard.goTo(SUMMARY_STEP); wizard.goTo(1);
  assert.equal(wizard.field, 'personality');
  wizard.goTo(99);
  assert.equal(wizard.step, SUMMARY_STEP);
});

test('restart goes back to the first question with nothing shown as picked, and changes no pick', () => {
  const builder = fakeBuilder(); const wizard = createWizard(builder, () => 0);
  wizard.choose('fox'); wizard.choose('sleepy'); wizard.choose('scarf'); wizard.choose(null);
  wizard.restart();
  assert.equal(wizard.step, 0);
  assert.equal(wizard.field, 'creature');
  assert.equal(WIZARD_FIELDS.some(field => wizard.chosen(field)), false);
  assert.equal(builder.picks.length, 4);
});

test('Bring to life calls create once, and only from the summary', async () => {
  const builder = fakeBuilder(); const wizard = createWizard(builder, () => 0);
  await wizard.make();
  assert.equal(builder.creates, 0);
  wizard.goTo(SUMMARY_STEP); await wizard.make();
  assert.equal(builder.creates, 1);
  assert.equal(wizard.step, SUMMARY_STEP);
});
