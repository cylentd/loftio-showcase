// #442 phase 2, review fix: an OLD record (saved before loadouts) is backfilled with the loadout its trait implied: the
// trait from the same first draw as always, the synergy that trait grants, no special. A NEW build rolls all three
// independently. Expected values come from the trait-to-ability table in TODO.md, written out here.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SYNERGIES, SPECIALS } from '../../src/loadout/loadout-data.ts';
import { backfillLoadout, isRerollable, newLoadout, rollLoadout, seededRng } from '../../src/loadout/loadout-model.ts';

// Ids backfilled in a sweep: with 3 traits, a trait missing from 200 ids has chance below 1e-30.
const SWEEP_IDS = 200;
const IMPLIED: Record<string, string> = { springy: 'seed-burst', heavy: 'shockwave', piercing: 'piercing-beam' };
const ids = () => Array.from({ length: SWEEP_IDS }, (_, i) => 'gen-' + i);
const PINNED: [string, string][] = [['a', 'heavy'], ['resident-1', 'springy'], ['', 'heavy'], ['seed-42', 'heavy'], ['résumé-🌱', 'springy']];

for (const [id, trait] of PINNED) {
  test('backfillLoadout for "' + id + '" is the loadout its trait implied, with no special', () => {
    assert.deepEqual(backfillLoadout(id), { schemaVersion: 1, trait, synergy: IMPLIED[trait], special: null });
  });
}

test('backfillLoadout over a sweep of ids always pairs the trait with the synergy it implies and no special', () => {
  const wrong = ids().filter((id) => {
    const loadout = backfillLoadout(id);
    return loadout.synergy !== IMPLIED[loadout.trait] || loadout.special !== null;
  });
  assert.deepEqual(wrong, []);
});

test('backfillLoadout takes its trait from the same first draw as the independent roll', () => {
  assert.deepEqual(ids().filter((id) => backfillLoadout(id).trait !== rollLoadout(seededRng(id)).trait), []);
});

test('backfillLoadout reaches every trait over a sweep of ids', () => {
  assert.deepEqual([...new Set(ids().map((id) => backfillLoadout(id).trait))].sort(), ['heavy', 'piercing', 'springy']);
});

test('a backfilled legacy loadout can still be rerolled', () => {
  assert.deepEqual(ids().filter((id) => !isRerollable(backfillLoadout(id))), []);
});

for (const id of ['a', 'resident-1', 'gen-d']) {
  test('newLoadout for "' + id + '" is the independent three-draw roll from its seeded rng', () => {
    assert.deepEqual(newLoadout(id), rollLoadout(seededRng(id)));
  });
}

test('newLoadout over a sweep of ids reaches all eleven synergies and all ten specials', () => {
  const rolls = ids().concat(ids().map((id) => 'more-' + id)).map(newLoadout);
  assert.deepEqual(
    [new Set(rolls.map((l) => l.synergy)).size, new Set(rolls.map((l) => l.special)).size],
    [SYNERGIES.length, SPECIALS.length],
  );
});
