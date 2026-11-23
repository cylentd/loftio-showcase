import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NAMES } from '../../src/copy.ts';
import { ORIGINAL_LOADOUTS } from '../../src/loadout/loadout-data.ts';
import { parseLoadout } from '../../src/loadout/loadout-model.ts';

// The owner chose these loadouts ("pick for me", 2026-11-19; TODO.md, "Eleven synergies and themed names", Originals table).
// Sprout, Chomper and Puff keep the traits Rumble has today; Hoodie, Slime and Burger are new. Every row is pinned.
const EXPECTED: [string, string, string, string, string][] = [
  ['sprout', 'springy', 'seed-burst', 'picnic', 'bloom'],
  ['chomper', 'heavy', 'shockwave', 'meteor', 'chaos'],
  ['puff', 'piercing', 'piercing-beam', 'big-plush', 'spark'],
  ['hoodie', 'springy', 'chain-lightning', 'freeze-frame', 'spark'],
  ['slime', 'heavy', 'bubble-guard', 'gravity-well', 'splash'],
  ['burger', 'piercing', 'spread-shot', 'triple-trouble', 'ember'],
];

for (const [id, trait, synergy, special, element] of EXPECTED) {
  test('ORIGINAL_LOADOUTS gives ' + id + ' the ' + trait + ' trait, ' + synergy + ', ' + special + ' and the ' + element + ' element', () => {
    assert.deepEqual(ORIGINAL_LOADOUTS[id], { schemaVersion: 1, trait, synergy, special, element });
  });

  test('ORIGINAL_LOADOUTS entry for ' + id + ' passes the loadout parser unchanged', () => {
    assert.deepEqual(parseLoadout(ORIGINAL_LOADOUTS[id]), ORIGINAL_LOADOUTS[id]);
  });
}

test('ORIGINAL_LOADOUTS has exactly one entry for each original in the cast names', () => {
  assert.deepEqual(Object.keys(ORIGINAL_LOADOUTS).sort(), Object.keys(NAMES).sort());
});
