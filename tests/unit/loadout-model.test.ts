import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TRAITS,
  backfillLoadout,
  parseLoadout,
  rerollPrice,
  rollLoadout,
  seededRng,
  synergyFor,
} from '../../src/loadout/loadout-model.ts';
import type { Trait } from '../../src/loadout/loadout-model.ts';
import { SPECIALS, SYNERGIES } from '../../src/loadout/loadout-data.ts';

// Ids rolled through seededRng in the one seeded sweep: with 3 traits, the chance a trait never shows up in 200 rolls is below 1e-30.
const SEEDS_PER_SWEEP = 200;
// Draws checked per rng sequence: enough to catch an out-of-range value, small enough to stay instant.
const DRAWS_PER_SEQUENCE = 500;
// Draws compared when two sequences must match or differ.
const COMPARE_DRAWS = 20;
// Draws inspected to see that one sequence moves: 10 equal draws in a row from a real rng is not chance.
const VARIATION_DRAWS = 10;
// Rolls compared in the determinism sweep: a Math.random roll matches a repeat in all 60 with chance 3^-60.
const DETERMINISM_ROLLS = 60;
// Edge-value pairs rolled: a roll that ignores its rng gives equal traits for all 40 pairs with chance (1/3)^40.
const EDGE_PAIRS = 40;

const ALL_TRAITS: Trait[] = ['springy', 'heavy', 'piercing'];
const NEAR_ONE = 1 - Number.EPSILON; // the largest value below 1 a draw can take, so index arithmetic stays in range
// Fixed values a hand-made rng feeds rollLoadout: both edges plus values on each side of every third.
const ROLL_VALUES = [0, 0.1, 0.25, 0.34, 0.5, 0.66, 0.75, 0.9, NEAR_ONE];
const EDGES: [string, number][] = [['0', 0], ['1 - EPSILON', NEAR_ONE]];
// Synergy names per the loadout contract.
const SYNERGY_OF: Record<Trait, string> = {
  springy: 'seed-burst',
  heavy: 'shockwave',
  piercing: 'piercing-beam',
};

/** An rng the test controls: returns the given values in order, then starts over. */
const fromValues = (values: number[]) => {
  let next = 0;
  return () => values[next++ % values.length] as number;
};
const draw = (id: string, count: number) => {
  const rng = seededRng(id);
  return Array.from({ length: count }, () => rng());
};
const handSweep = (exclude?: Trait) => ROLL_VALUES.map((v) => rollLoadout(fromValues([v]), exclude));
const seededSweep = () =>
  Array.from({ length: SEEDS_PER_SWEEP }, (_, i) => rollLoadout(seededRng('seed-' + i)));
const distinct = (values: string[]) => [...new Set(values)].sort();
const valid = { schemaVersion: 1, trait: 'springy', synergy: 'seed-burst', special: null };
const throwingGetter = () =>
  Object.defineProperty({ ...valid }, 'trait', {
    enumerable: true,
    get() {
      throw new Error('hostile getter');
    },
  });

test('TRAITS lists springy, heavy, piercing in that order', () => {
  assert.deepEqual([...TRAITS], ['springy', 'heavy', 'piercing']);
});

for (const trait of ALL_TRAITS) {
  test('synergyFor maps ' + trait + ' to ' + SYNERGY_OF[trait], () => {
    assert.equal(synergyFor(trait), SYNERGY_OF[trait]);
  });
}

for (const id of ['a', 'resident-1', '', 'a much longer resident id with spaces and ünïcode']) {
  test('seededRng gives the same sequence on every call for id "' + id + '"', () => {
    // honest: allow TAUTOLOGY two fresh rngs for one id must agree; hidden global state is the defect this catches
    assert.deepEqual(draw(id, COMPARE_DRAWS), draw(id, COMPARE_DRAWS));
  });

  test('seededRng keeps every value in [0,1) for id "' + id + '"', () => {
    const outOfRange = draw(id, DRAWS_PER_SEQUENCE).filter((v) => !(v >= 0 && v < 1));
    assert.equal(outOfRange.length, 0);
  });

  test('seededRng varies from draw to draw for id "' + id + '"', () => {
    assert.ok(new Set(draw(id, VARIATION_DRAWS)).size > 1);
  });
}

const ID_PAIRS: [string, string][] = [['a', 'b'], ['resident-1', 'resident-2'], ['', 'x']];

for (const [a, b] of ID_PAIRS) {
  test('seededRng gives different sequences for ids "' + a + '" and "' + b + '"', () => {
    assert.notDeepEqual(draw(a, COMPARE_DRAWS), draw(b, COMPARE_DRAWS));
  });
}

test('rollLoadout returns schemaVersion 1 and a special from the ten for hand-made rng values', () => {
  const unexpected = handSweep().filter((l) => l.schemaVersion !== 1 || !SPECIALS.some((entry) => entry.id === l.special));
  assert.deepEqual(unexpected, []);
});

test('rollLoadout returns a valid trait for every hand-made rng value', () => {
  const invalid = handSweep().filter((l) => !ALL_TRAITS.includes(l.trait));
  assert.deepEqual(invalid, []);
});

test('rollLoadout gives every hand-made rng value a synergy from the eleven', () => {
  const unknown = handSweep().filter((l) => !SYNERGIES.some((entry) => entry.id === l.synergy));
  assert.deepEqual(unknown, []);
});

test('rollLoadout reaches every trait across hand-made rng values', () => {
  assert.deepEqual(distinct(handSweep().map((l) => l.trait)), ['heavy', 'piercing', 'springy']);
});

for (const [edge, value] of EDGES) {
  test('rollLoadout returns a valid trait at the rng edge ' + edge, () => {
    const roll = rollLoadout(fromValues([value]));
    assert.ok(ALL_TRAITS.includes(roll.trait));
  });

  for (const excluded of ALL_TRAITS) {
    test('rollLoadout excluding ' + excluded + ' never returns it at the rng edge ' + edge, () => {
      const roll = rollLoadout(fromValues([value]), excluded);
      assert.ok(ALL_TRAITS.includes(roll.trait) && roll.trait !== excluded);
    });
  }
}

for (const excluded of ALL_TRAITS) {
  const others = ALL_TRAITS.filter((t) => t !== excluded).sort();
  test('rollLoadout excluding ' + excluded + ' never returns it for any hand-made rng value', () => {
    const hits = handSweep(excluded).filter((l) => l.trait === excluded);
    assert.deepEqual(hits, []);
  });

  test('rollLoadout excluding ' + excluded + ' still reaches both other traits', () => {
    assert.deepEqual(distinct(handSweep(excluded).map((l) => l.trait)), others);
  });

  test('rollLoadout excluding ' + excluded + ' still gives a synergy from the eleven', () => {
    const unknown = handSweep(excluded).filter((l) => !SYNERGIES.some((entry) => entry.id === l.synergy));
    assert.deepEqual(unknown, []);
  });
}

test('rollLoadout gives equal results when the same fixed values are fed twice', () => {
  const values = Array.from({ length: DETERMINISM_ROLLS }, (_, i) => i / DETERMINISM_ROLLS);
  const roll = () => values.map((v) => rollLoadout(fromValues([v])));
  // honest: allow TAUTOLOGY the same fixed rng values must give the same loadouts; a Math.random roll fails this
  assert.deepEqual(roll(), roll());
});

test('rollLoadout gives different traits for rng value 0 and then 1 - EPSILON', () => {
  const pairs = Array.from({ length: EDGE_PAIRS }, () => [
    rollLoadout(fromValues([0])).trait,
    rollLoadout(fromValues([NEAR_ONE])).trait,
  ]);
  assert.equal(pairs.filter(([low, high]) => low === high).length, 0);
});

test('rollLoadout fed seededRng ids reaches every trait', () => {
  assert.deepEqual(distinct(seededSweep().map((l) => l.trait)), ['heavy', 'piercing', 'springy']);
});

test('rerollPrice is free for now', () => {
  assert.deepEqual(rerollPrice(), { kind: 'free' });
});

const validCases: [string, unknown, unknown][] = [
  ['springy with null special', valid, valid],
  ['heavy with its synergy', { ...valid, trait: 'heavy', synergy: 'shockwave' }, { ...valid, trait: 'heavy', synergy: 'shockwave' }],
  ['piercing with its synergy', { ...valid, trait: 'piercing', synergy: 'piercing-beam' }, { ...valid, trait: 'piercing', synergy: 'piercing-beam' }],
  ['a string special from a newer build is kept', { ...valid, special: 'overdrive' }, { ...valid, special: 'overdrive' }],
];
for (const [name, input, expected] of validCases) {
  test('parseLoadout accepts ' + name, () => {
    assert.deepEqual(parseLoadout(input), expected);
  });
}

const rejectedCases: [string, unknown][] = [
  ['null', null],
  ['undefined', undefined],
  ['a string', 'springy'],
  ['a number', 7],
  ['an array', [valid]],
  ['an unknown trait', { ...valid, trait: 'fluffy' }],
  ['a wrong schemaVersion', { ...valid, schemaVersion: 2 }],
  ['a schemaVersion of the string "1"', { ...valid, schemaVersion: '1' }],
  ['a schemaVersion of 0', { ...valid, schemaVersion: 0 }],
  ['a missing schemaVersion', { trait: 'springy', synergy: 'seed-burst', special: null }],
  ['a missing trait', { schemaVersion: 1, synergy: 'seed-burst', special: null }],
  ['a missing synergy', { schemaVersion: 1, trait: 'springy', special: null }],
  ['a missing special key', { schemaVersion: 1, trait: 'springy', synergy: 'seed-burst' }],
  ['a synergy that is not an id', { ...valid, synergy: 'Seed Burst!' }],
  ['a numeric special', { ...valid, special: 7 }],
  ['a special key present with the value undefined', { ...valid, special: undefined }],
  ['a getter that throws', throwingGetter()],
];
for (const [name, input] of rejectedCases) {
  test('parseLoadout returns null for ' + name, () => {
    assert.equal(parseLoadout(input), null);
  });
}

for (const id of ['a', 'resident-1', '', 'seed-42']) {
  test('backfillLoadout for "' + id + '" takes its trait from the first draw of its seeded rng', () => {
    assert.equal(backfillLoadout(id).trait, rollLoadout(seededRng(id)).trait);
  });

  test('backfillLoadout for "' + id + '" gives the same loadout on every call', () => {
    // honest: allow TAUTOLOGY a backfill must not depend on call order or state; the pinned test below fixes the value
    assert.deepEqual(backfillLoadout(id), backfillLoadout(id));
  });
}

// Pinned on 2026-11-18: changing the rng or hash re-rolls every saved resident that was backfilled, so a change here is a migration.
// The non-ASCII id pins the hash over UTF-16 code units: hashing its UTF-8 bytes instead would give 'piercing'.
const PINNED_BACKFILL_TRAIT: [string, Trait][] = [
  ['a', 'heavy'], ['resident-1', 'springy'], ['', 'heavy'], ['seed-42', 'heavy'], ['résumé-🌱', 'springy'],
];
for (const [id, trait] of PINNED_BACKFILL_TRAIT) {
  test('backfillLoadout for "' + id + '" is pinned to ' + trait, () => {
    assert.equal(backfillLoadout(id).trait, trait);
  });
}

// A roll draws the trait, the synergy and the special: one draw each, no retries (loadout-roll.test.ts pins the order).
const ROLL_DRAWS = 3;
test('rollLoadout draws exactly three times from its rng', () => {
  let draws = 0;
  rollLoadout(() => {
    draws += 1;
    return 0.5;
  });
  assert.equal(draws, ROLL_DRAWS);
});

test('rollLoadout draws exactly three times when a trait is excluded', () => {
  let draws = 0;
  rollLoadout(() => {
    draws += 1;
    return 0.5;
  }, 'heavy');
  assert.equal(draws, ROLL_DRAWS);
});
