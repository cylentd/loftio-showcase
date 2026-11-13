import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWizard } from '../../src/residents/wizard.ts';

function fixture() {
  const picks: [string, string | null][] = []; let creates = 0;
  const wizard = createWizard({ select: (field, value) => { picks.push([field, value]); }, create: () => { creates += 1; } }, () => 0);
  return { wizard, picks, creates: () => creates };
}

test('every question exposes its entire catalog without a reveal action', () => {
  const { wizard } = fixture();
  assert.deepEqual(wizard.options.map(option => option.id), ['moth', 'snail', 'teapot', 'frog', 'crystal', 'mushroom', 'gecko', 'beetle', 'cloud', 'cat', 'puppy', 'bunny', 'fox', 'bear', 'duck', 'penguin', 'axolotl', 'tiny-dragon', 'sprout', 'little-ghost']);
  wizard.goTo(1);
  assert.deepEqual(wizard.options.map(option => option.id), ['bookworm', 'curious', 'serious', 'bashful', 'mischievous', 'sleepy', 'helper', 'troublemaker', 'gentle', 'playful', 'affectionate', 'calm']);
  wizard.goTo(2);
  assert.deepEqual(wizard.options.map(option => option.id), ['reading-glasses', 'beret', 'bow-tie', 'fang', 'tuft', 'mittens', 'antennae', 'scarf', 'none', 'round-glasses', 'tiny-bow', 'sweater', 'flower-tuft']);
});

test('browsing the full catalogs neither selects, advances nor creates', () => {
  const { wizard, picks, creates } = fixture();
  assert.equal(wizard.options.length, 20);
  assert.equal(wizard.step, 0);
  assert.deepEqual(picks, []);
  assert.equal(creates(), 0);
  assert.equal('showMore' in wizard, false);
  assert.equal('showFeatured' in wizard, false);
});

test('a catalog pick advances once and stays available when revisited', () => {
  const { wizard, picks } = fixture();
  wizard.choose('moth');
  assert.deepEqual(picks, [['creature', 'moth']]); assert.equal(wizard.step, 1);
  wizard.back(); assert.equal(wizard.step, 0);
  assert.equal(wizard.chosen('creature'), true);
  assert.equal(wizard.options.length, 20);
  assert.ok(wizard.options.some(option => option.id === 'moth'));
});

test('Back always goes straight to the previous question', () => {
  const { wizard, picks } = fixture();
  for (const step of [1, 2, 3, 4]) {
    wizard.goTo(step); wizard.back(); assert.equal(wizard.step, step - 1);
  }
  wizard.goTo(0); wizard.back(); assert.equal(wizard.step, 0);
  assert.deepEqual(picks, []);
});

test('palettes remain complete and the summary offers no choices', () => {
  const { wizard, creates } = fixture();
  wizard.goTo(3); assert.equal(wizard.options.length, 6);
  wizard.goTo(4); assert.deepEqual(wizard.options, []);
  assert.equal(creates(), 0);
});

test('restart clears choice indicators while keeping every catalog available', () => {
  const { wizard, picks } = fixture();
  wizard.choose('moth'); wizard.choose('helper'); wizard.restart();
  assert.equal(wizard.step, 0); assert.equal(wizard.chosen('creature'), false);
  assert.equal(wizard.options.length, 20);
  wizard.goTo(1); assert.equal(wizard.options.length, 12);
  assert.deepEqual(picks, [['creature', 'moth'], ['personality', 'helper']]);
});
