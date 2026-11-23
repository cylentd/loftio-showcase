import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORIGINAL_LOADOUTS } from '../../src/loadout/loadout-data.ts';
import { cardArt, cardElement, cardPlace, cardResident, cardScene, ELEMENTS, holoVars, nextGreetDelay, pointerPercent, pointerVars } from '../../src/holo-card/holo-card-model.ts';
import { HOLO_LIFE } from '../../src/holo-card/constants.ts';

const card = { left: 100, top: 200, width: 200, height: 280 };
const tune = { tiltMax: 14, shineTravel: 30 };

test('a pointer at 75% across and 25% down tips the card toward that corner and slides the foil away from it', () => {
  // 75% of 200 past left 100 is 250; 25% of 280 below top 200 is 270.
  assert.deepEqual(pointerVars(250, 270, card, tune), {
    px: 75, py: 25,
    rx: 7, ry: 7, // half way to the edge on both axes: half of tiltMax, top tipped away, right tipped away
    bx: 42.5, by: 57.5, // the foil slides opposite the pointer by a quarter of shineTravel
    from: 0.5, // (0.25, 0.25) from the centre is half way to a corner
  });
});

test('the centre is flat, and a pointer off the card is clamped to its edge', () => {
  assert.deepEqual(pointerVars(200, 340, card, tune), { px: 50, py: 50, rx: -0, ry: 0, bx: 50, by: 50, from: 0 });
  assert.deepEqual(pointerPercent(-50, 900, card), { px: 0, py: 100 });
  const corner = pointerVars(9999, -9999, card, tune);
  assert.equal(corner.ry, tune.tiltMax);
  assert.equal(corner.rx, tune.tiltMax);
  assert.equal(corner.from, 1);
});

test('a card at rest is flat wherever the pointer last was, and a zero-sized box reads as the centre', () => {
  const rest = holoVars(90, 10, 0, tune);
  assert.deepEqual([rest.rx, rest.ry, rest.bx, rest.by, rest.from], [0, 0, 50, 50, 0]);
  assert.equal(rest.px, 90); // the glare position still follows, so it fades out where it was
  assert.deepEqual(pointerPercent(5, 5, { left: 0, top: 0, width: 0, height: 0 }), { px: 50, py: 50 });
});

test('the next welcome waits inside the repeat bounds, placed in that range by the injected rng', () => {
  const { repeatMinMs: min, repeatMaxMs: max } = HOLO_LIFE;
  assert.equal(nextGreetDelay(() => 0), min);
  assert.equal(nextGreetDelay(() => 0.5), (min + max) / 2);
  assert.equal(nextGreetDelay(() => 0.75), min + (max - min) * 0.75);
  assert.ok(nextGreetDelay(() => 0.999999) < max);
});

test('?holores picks whose card shows in mock mode; an unknown id or a real visit falls back to sprout', () => {
  assert.equal(cardResident('?mode=mock&holocard&holores=chomper'), 'chomper');
  assert.equal(cardResident('?mode=mock&holores=sprout'), 'sprout');
  assert.equal(cardResident('?mode=mock&holores=gremlin'), 'sprout');
  assert.equal(cardResident('?holocard&holores=chomper'), 'sprout'); // not mock: no override
  assert.equal(cardResident(''), 'sprout');
});

test('the palette follows the resident element; an unknown resident falls back to bloom', () => {
  assert.equal(cardElement('sprout', ''), 'bloom');
  assert.equal(cardElement('chomper', ''), 'chaos');
  assert.equal(cardElement('slime', ''), 'splash');
  assert.equal(cardElement('burger', ''), 'ember');
  assert.equal(cardElement('puff', ''), 'spark');
  assert.equal(cardElement('gremlin', ''), 'bloom');
});

for (const element of ELEMENTS) {
  test(`?holoelement=${element} previews that palette in mock mode`, () => {
    assert.equal(cardElement('sprout', `?mode=mock&holoelement=${element}`), element);
  });
}

test('?holoelement outside mock mode or with an unknown value keeps the resident element', () => {
  assert.equal(cardElement('chomper', '?mode=mock&holoelement=glitter'), 'chaos');
  assert.equal(cardElement('gremlin', '?mode=mock&holoelement=glitter'), 'bloom');
  assert.equal(cardElement('sprout', '?holocard&holoelement=ember'), 'bloom'); // not mock: no override
});

test('?holoplace picks placement a, b or c in mock mode; anything else is a', () => {
  assert.equal(cardPlace(''), 'a');
  assert.equal(cardPlace('?mode=mock&holoplace=b'), 'b');
  assert.equal(cardPlace('?mode=mock&holoplace=c'), 'c');
  assert.equal(cardPlace('?mode=mock&holoplace=z'), 'a');
  assert.equal(cardPlace('?holoplace=c'), 'a');
});

test('a resident with a generated scene wears it; ?holoscene previews another in mock mode; no scene means the drawn burst', () => {
  assert.equal(cardScene('chomper', ''), 'chomper');
  assert.equal(cardScene('sprout', ''), null);
  assert.equal(cardScene('sprout', '?mode=mock&holoscene=cloud'), 'cloud');
  assert.equal(cardScene('chomper', '?mode=mock&holoscene=none'), null);
  assert.equal(cardScene('chomper', '?mode=mock&holoscene=nope'), 'chomper');
  assert.equal(cardScene('sprout', '?holoscene=cloud'), null);
});

test('?holoart picks one of the alt art paintings of a resident in mock mode; anything else is the standard card (null)', () => {
  assert.equal(cardArt('chomper', '?mode=mock&holoart=a'), 'a');
  assert.equal(cardArt('chomper', '?mode=mock&holoart=b'), 'b');
  assert.equal(cardArt('chomper', '?mode=mock&holoart=z'), null);
  assert.equal(cardArt('gremlin', '?mode=mock&holoart=a'), null);
  assert.equal(cardArt('chomper', '?holoart=a'), null);
});

for (const id of Object.keys(ORIGINAL_LOADOUTS)) {
  test(`original ${id} has a card (?holores) with alt art a (action) and b (quiet) (?holoart) in mock mode`, () => {
    assert.equal(cardResident(`?mode=mock&holocard&holores=${id}`), id);
    assert.equal(cardArt(id, '?mode=mock&holoart=a'), 'a');
    assert.equal(cardArt(id, '?mode=mock&holoart=b'), 'b');
  });
}
