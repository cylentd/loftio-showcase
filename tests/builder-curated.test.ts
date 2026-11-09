import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { CATALOG } from '../src/builder/catalog-data.ts';
import { CURATED, curatedOptions, iconFor } from '../src/builder/curated.ts';

const publicDir = new URL('../public/', import.meta.url);
const ICON_BUDGET = 40 * 1024; // bytes per card icon: twenty of them stay under one painted frame

const groups = { creature: CATALOG.creatures, personality: CATALOG.personalities, signatureDetail: CATALOG.signatureDetails, palette: CATALOG.palettes };

test('every curated id exists in the full catalog, once', () => {
  for (const [field, ids] of Object.entries(CURATED)) {
    const catalog = groups[field as keyof typeof groups] as readonly { id: string }[];
    for (const id of ids) assert.ok(catalog.some(option => option.id === id), `${field}:${id}`);
    assert.equal(new Set(ids).size, ids.length, field);
  }
});

test('the picture cards show 8 friends, 6 feelings, 6 extras and 6 colour sets', () => {
  assert.deepEqual(Object.values(CURATED).map(ids => ids.length), [8, 6, 6, 6]);
});

test('cards read in short, plain words from the catalog labels', () => {
  const labels = (field: keyof typeof CURATED) => curatedOptions(field).map(option => option.label);
  assert.deepEqual(labels('creature'), ['Bunny', 'Cat', 'Puppy', 'Fox', 'Frog', 'Penguin', 'Dragon', 'Ghost']);
  assert.deepEqual(labels('personality'), ['Sleepy', 'Playful', 'Shy', 'Curious', 'Grumpy', 'Cheeky']);
  assert.deepEqual(labels('signatureDetail'), ['Glasses', 'Bow', 'Scarf', 'Hat', 'Flowers', 'None']);
  assert.deepEqual(labels('palette'), ['Berry', 'Peach', 'Sky', 'Cocoa', 'Frosty', 'Meadow']);
});

test('every curated picture card has a small square-ish WebP icon in public/builder', () => {
  for (const field of ['creature', 'personality', 'signatureDetail'] as const) {
    for (const option of curatedOptions(field)) {
      const icon = iconFor(field, option.id);
      assert.ok(icon, `${field}:${option.id} has an icon`);
      assert.match(icon, /^builder\/.+\.webp$/);
      const file = new URL(icon, publicDir);
      assert.ok(existsSync(file), `${icon} exists`);
      assert.ok(statSync(file).size <= ICON_BUDGET, `${icon} is ${statSync(file).size} bytes`);
    }
  }
});

test('palettes are swatches, not pictures', () => {
  assert.equal(iconFor('palette', 'meadow'), null);
});
