import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foilBands, foilTint } from '../../src/holo-card/holo-foil-tint-model.ts';
import { FOIL_TINT } from '../../src/holo-card/constants.ts';

const colour = (hue: number) => `hsl(${hue} ${FOIL_TINT.saturation}% ${FOIL_TINT.lightness}%)`;
/** `count` copies of one RGBA pixel, flattened like ImageData.data. */
const pixels = (count: number, rgba: [number, number, number, number]) => Array.from({ length: count }, () => rgba).flat();

test('the foil takes the painting\'s three most common hues, most common first', () => {
  const painting = [...pixels(3, [0, 255, 0, 255]), ...pixels(6, [255, 0, 0, 255]), ...pixels(1, [0, 0, 255, 255])];
  assert.deepEqual(foilTint(painting), [colour(0), colour(120), colour(240)]);
});

test('transparent, grey, near-black and highlight pixels carry no hue, and one hue fills the rest with its neighbours', () => {
  const painting = [
    ...pixels(9, [255, 0, 0, 0]), // transparent red: the cut-out's surround
    ...pixels(9, [128, 128, 128, 255]), // grey
    ...pixels(9, [20, 0, 0, 255]), // near-black red
    ...pixels(9, [255, 245, 245, 255]), // highlight
    ...pixels(1, [0, 0, 255, 255]),
  ];
  assert.deepEqual(foilTint(painting), [colour(240), colour(240 + FOIL_TINT.fillStep), colour((240 + 2 * FOIL_TINT.fillStep) % 360)]);
});

test('a neighbour fill past 360 degrees wraps round the colour wheel', () => {
  assert.deepEqual(foilTint(pixels(1, [255, 0, 85, 255])), [colour(340), colour((340 + FOIL_TINT.fillStep) % 360), colour((340 + 2 * FOIL_TINT.fillStep) % 360)]);
});

test('a hue family too close to a chosen one is skipped, so a one-colour painting still gets a rainbow', () => {
  // 0 (6 px) and 30 (4 px) sit one bin apart, under minSpread; 180 (1 px) is far enough to count.
  const painting = [...pixels(6, [255, 0, 0, 255]), ...pixels(4, [255, 128, 0, 255]), ...pixels(1, [0, 255, 255, 255])];
  assert.deepEqual(foilTint(painting).slice(0, 2), [colour(0), colour(180)]);
});

test('a painting with no colourful pixel wears the fallback foil', () => {
  assert.deepEqual(foilTint(pixels(4, [128, 128, 128, 255])), FOIL_TINT.fallback.map(colour));
});

test('a hue family\'s colour is the mean hue of its pixels', () => {
  // rgb(255, 0, 0) is 0 degrees, rgb(255, 85, 0) is 20: one bin, mean 10.
  assert.deepEqual(foilTint([...pixels(1, [255, 0, 0, 255]), ...pixels(1, [255, 85, 0, 255])])[0], colour(10));
});

test('the bands keep the painting\'s main hue and add gold and cyan, so a one-colour dark painting still reads as holo', () => {
  // Chomper-like: all purple, rgb(119, 34, 204) is 270 degrees. Gold and cyan are both far from it.
  assert.deepEqual(foilBands(pixels(4, [119, 34, 204, 255])), [colour(270), colour(FOIL_TINT.accents[0]), colour(FOIL_TINT.accents[1])]);
});

test('an accent too close to the painting\'s main hue gives its place to the painting\'s next hue', () => {
  // Main hue rgb(255, 170, 0) is 40 degrees, beside gold; cyan joins, then the painting's magenta (300).
  const painting = [...pixels(6, [255, 170, 0, 255]), ...pixels(2, [255, 0, 255, 255])];
  assert.deepEqual(foilBands(painting), [colour(40), colour(FOIL_TINT.accents[1]), colour(300)]);
});

test('a painting with no colourful pixel wears the fallback bands', () => {
  assert.deepEqual(foilBands(pixels(4, [128, 128, 128, 255])), FOIL_TINT.fallback.map(colour));
});
