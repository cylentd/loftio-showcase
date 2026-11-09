import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SURPRISE } from '../src/builder/catalog-data.ts';
import { WIZARD_COPY } from '../src/residents/copy.ts';
import { pickTile } from '../src/residents/pick-tile.ts';

test('a curated pick shows its felt figure', () => {
  assert.deepEqual(pickTile('creature', 'fox'), { kind: 'image', src: 'builder/creature-fox.webp', label: 'Fox' });
  assert.deepEqual(pickTile('signatureDetail', 'none'), { kind: 'image', src: 'builder/detail-none.webp', label: 'None' });
});

test('a saved pick outside the curated set shows its name as a text tile, never a blank picture', () => {
  assert.deepEqual(pickTile('creature', 'moth'), { kind: 'text', label: 'Moth' });
  assert.deepEqual(pickTile('personality', 'bookworm'), { kind: 'text', label: 'Bookish' });
  assert.deepEqual(pickTile('signatureDetail', 'sweater'), { kind: 'text', label: 'Oversized sweater' });
  assert.deepEqual(pickTile('creature', 'retired-id'), { kind: 'text', label: 'retired-id' });
});

test('palettes draw a swatch, any palette draws the wheel, and a surprise draws the die', () => {
  assert.deepEqual(pickTile('palette', 'meadow'), { kind: 'swatch', palette: 'meadow', label: 'Meadow' });
  assert.deepEqual(pickTile('palette', null), { kind: 'swatch', palette: 'any', label: WIZARD_COPY.anyPalette });
  assert.deepEqual(pickTile('creature', SURPRISE), { kind: 'die', label: WIZARD_COPY.surprisePick });
});

test('the builder speaks to all ages: designer-toy step titles and button', () => {
  assert.deepEqual(WIZARD_COPY.steps, ['Choose a creature', 'Pick a mood', 'Add a signature detail', 'Choose a palette']);
  assert.equal(WIZARD_COPY.summary, 'Your design');
  assert.equal(WIZARD_COPY.anyPalette, 'Any palette');
});
