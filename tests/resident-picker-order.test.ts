import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as curated from '../src/builder/curated.ts';

test('the full creature picker puts familiar choices before the unusual creatures', () => {
  assert.equal(typeof curated.orderedPickerOptions, 'function');
  const options = curated.orderedPickerOptions('creature', curated.catalogOptions('creature'));
  assert.deepEqual(options.map(option => option.id), [
    'bunny', 'cat', 'puppy', 'fox', 'frog', 'penguin', 'tiny-dragon', 'little-ghost',
    'bear', 'duck', 'axolotl', 'sprout', 'moth', 'snail', 'teapot', 'crystal', 'mushroom', 'gecko', 'beetle', 'cloud',
  ]);
});

test('ordering keeps the featured subset unchanged and does not add hidden catalog choices', () => {
  assert.equal(typeof curated.orderedPickerOptions, 'function');
  const featured = curated.curatedOptions('creature');
  assert.deepEqual(curated.orderedPickerOptions('creature', featured), featured);
  assert.deepEqual(curated.orderedPickerOptions('creature', []), []);
});

test('picker ordering never mutates the source catalog or changes ids, labels and prompts', () => {
  assert.equal(typeof curated.orderedPickerOptions, 'function');
  const options = curated.catalogOptions('creature'); const before = structuredClone(options);
  const ordered = curated.orderedPickerOptions('creature', options);
  assert.deepEqual(options, before);
  assert.deepEqual([...ordered].sort((left, right) => left.id.localeCompare(right.id)), [...before].sort((left, right) => left.id.localeCompare(right.id)));
});

test('moods and details keep their favourites first and palettes keep the established order', () => {
  assert.equal(typeof curated.orderedPickerOptions, 'function');
  assert.deepEqual(curated.orderedPickerOptions('personality', curated.catalogOptions('personality')).map(option => option.id), [
    'sleepy', 'playful', 'bashful', 'curious', 'serious', 'mischievous', 'bookworm', 'helper', 'troublemaker', 'gentle', 'affectionate', 'calm',
  ]);
  assert.deepEqual(curated.orderedPickerOptions('signatureDetail', curated.catalogOptions('signatureDetail')).map(option => option.id), [
    'round-glasses', 'tiny-bow', 'scarf', 'beret', 'flower-tuft', 'none', 'reading-glasses', 'bow-tie', 'fang', 'tuft', 'mittens', 'antennae', 'sweater',
  ]);
  assert.deepEqual(curated.orderedPickerOptions('palette', curated.catalogOptions('palette')).map(option => option.id), ['blackberry', 'apricot', 'dusty-blue', 'cocoa', 'frost', 'meadow']);
});
