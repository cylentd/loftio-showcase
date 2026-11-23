// The card takes any subject (#477 U3): the originals' subjects are built from their facts, and the look is pluggable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAMES } from '../../src/copy.ts';
import { ORIGINAL_LOADOUTS } from '../../src/loadout/loadout-data.ts';
import { ALT_ART_IMAGES, SCENE_ART } from '../../src/holo-card/holo-card-scenes.ts';
import { originalSubject, PLAIN_LOOK } from '../../src/holo-card/holo-card-subject.ts';
import { holoForResident } from '../../src/holo-card/holo-pool-model.ts';

test('an original on its normal card has its name, element, art and the Classic look, and no alt', () => {
  const subject = originalSubject('sprout', '', null);
  assert.equal(subject.name, NAMES.sprout);
  assert.equal(subject.element, 'bloom');
  assert.equal(subject.look, 'classic');
  assert.equal(subject.alt, undefined);
  assert.equal(typeof subject.idle, 'string');
  assert.equal(typeof subject.expression, 'string');
});

test('an original on its alt card shows the alt painting and wears its seeded look', () => {
  const subject = originalSubject('chomper', '', 'a');
  assert.equal(subject.alt, ALT_ART_IMAGES['chomper-a']);
  assert.equal(subject.look, holoForResident('chomper'));
});

test('the moves on the card are the original loadout', () => {
  const loadout = ORIGINAL_LOADOUTS.slime!;
  const moves = originalSubject('slime', '', null).moves!;
  assert.deepEqual([moves.trait, moves.synergy, moves.special], [loadout.trait, loadout.synergy, loadout.special]);
});

test('a resident with a generated scene carries it; one without carries none', () => {
  assert.deepEqual(originalSubject('chomper', '', null).scene, { id: 'chomper', image: SCENE_ART.chomper });
  assert.equal(originalSubject('sprout', '', null).scene, undefined);
});

test('mock-mode URL parameters preview an element and an alt; an explicit variant wins over ?holoart', () => {
  assert.equal(originalSubject('sprout', '?mode=mock&holoelement=ember', null).element, 'ember');
  assert.equal(originalSubject('sprout', '?mode=mock&holoart=b').alt, ALT_ART_IMAGES['sprout-b']);
  assert.equal(originalSubject('sprout', '?mode=mock&holoart=b', null).alt, undefined);
});

test('a plain look is null, so a card with no look is a plain card', () => {
  assert.equal(PLAIN_LOOK, null);
});
