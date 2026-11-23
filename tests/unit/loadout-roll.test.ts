// #442 phase 2, unit P1: trait, synergy and special are rolled independently from one seeded rng. The first draw still
// chooses the trait exactly as before (the pinned backfill table in loadout-model.test.ts stays green); the synergy and
// the special come from the second and third draws. Expected values are worked from the design lists written out here.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SPECIALS, SYNERGIES, SYNERGY_BY_TRAIT, TRAITS } from '../../src/loadout/loadout-data.ts';
import { parseLoadout, rollLoadout, seededRng } from '../../src/loadout/loadout-model.ts';

// Seeds rolled in a sweep: a missing synergy has chance (10/11)^400 < 1e-16, a missing special (9/10)^400 < 1e-18.
const SWEEP_SEEDS = 400;
const NEAR_ONE = 1 - Number.EPSILON;
// The ids written out by hand from the TODO.md tables, in table order; the roll maps a draw over these lists.
const ELEVEN = ['seed-burst', 'piercing-beam', 'spread-shot', 'shockwave', 'ricochet', 'chain-lightning', 'poison-cloud', 'power-field', 'booster', 'mend', 'bubble-guard'];
const TEN = ['meteor', 'stampede', 'big-plush', 'overdrive', 'triple-trouble', 'picnic', 'pep-rally', 'bumpers', 'freeze-frame', 'gravity-well'];
const THREE = ['springy', 'heavy', 'piercing'];

const fromValues = (values: number[]) => {
  let next = 0;
  return () => values[next++ % values.length] as number;
};
const sweep = () => Array.from({ length: SWEEP_SEEDS }, (_, i) => rollLoadout(seededRng('sweep-' + i)));
const distinct = (values: unknown[]) => [...new Set(values)].sort();
/** The reference roll: draw one over three traits, draw two over the eleven minus the excluded one, draw three over the ten. */
const reference = (draws: [number, number, number], excludeSynergy?: string) => {
  const synergies = ELEVEN.filter((id) => id !== excludeSynergy);
  const at = <T>(list: T[], draw: number) => list[Math.min(Math.floor(draw * list.length), list.length - 1)];
  return { schemaVersion: 1, trait: at(THREE, draws[0]), synergy: at(synergies, draws[1]), special: at(TEN, draws[2]) };
};

test('the catalog lists the same ids the reference lists do', () => {
  assert.deepEqual([SYNERGIES.map((e) => e.id), SPECIALS.map((e) => e.id), [...TRAITS]], [ELEVEN, TEN, THREE]);
});

const DRAWS: [number, number, number][] = [[0, 0, 0], [NEAR_ONE, NEAR_ONE, NEAR_ONE], [0.1, 0.5, 0.9], [0.5, 0.25, 0.75], [0.9, 0.99, 0.01], [0.34, 0.34, 0.34]];
for (const draws of DRAWS) {
  test('rollLoadout maps draws ' + draws.join(', ') + ' to trait, synergy and special in that order', () => {
    assert.deepEqual(rollLoadout(fromValues(draws)), reference(draws));
  });
}

test('rollLoadout draws exactly three times: trait, synergy, special', () => {
  const seen: number[] = [];
  rollLoadout(() => { seen.push(seen.length); return 0.5; });
  assert.deepEqual(seen, [0, 1, 2]);
});

test('the later draws never change the trait: the first draw alone chooses it, as before', () => {
  const traits = [0, 0.3, 0.6, NEAR_ONE].flatMap((later) => [0, 0.4, 0.7, NEAR_ONE].map((first) => rollLoadout(fromValues([first, later, later])).trait === THREE[Math.floor(first * 3)]));
  assert.deepEqual(traits.filter((same) => !same), []);
});

test('a roll over a sweep of seeds reaches all eleven synergies', () => {
  assert.deepEqual(distinct(sweep().map((l) => l.synergy)), [...ELEVEN].sort());
});

test('a roll over a sweep of seeds reaches all ten specials and never rolls none', () => {
  assert.deepEqual(distinct(sweep().map((l) => l.special)), [...TEN].sort());
});

test('trait and synergy are independent: some seeded roll pairs a trait with a synergy that is not its default', () => {
  const odd = sweep().filter((l) => l.synergy !== SYNERGY_BY_TRAIT[l.trait]);
  assert.ok(odd.length > SWEEP_SEEDS / 2);
});

test('every synergy is paired with every trait somewhere in the sweep', () => {
  const pairs = new Set(sweep().map((l) => l.trait + '/' + l.synergy));
  assert.ok(pairs.size > ELEVEN.length); // far more than a one-to-one table could give
});

test('a roll over a sweep is the same on a repeat', () => {
  // honest: allow TAUTOLOGY the seeded roll must be deterministic; a Math.random roll fails this
  assert.deepEqual(sweep(), sweep());
});

for (const excluded of ELEVEN) {
  test('rollLoadout excluding the synergy ' + excluded + ' never returns it and reaches the other ten', () => {
    const rolls = Array.from({ length: SWEEP_SEEDS }, (_, i) => rollLoadout(seededRng('x-' + i), undefined, excluded));
    assert.deepEqual(distinct(rolls.map((l) => l.synergy)), ELEVEN.filter((id) => id !== excluded).sort());
  });
}

test('rollLoadout excluding a synergy maps draw two over the ten that are left', () => {
  assert.deepEqual(rollLoadout(fromValues([0, 0, 0]), undefined, 'seed-burst'), reference([0, 0, 0], 'seed-burst'));
});

test('rollLoadout excluding a trait still draws the trait first, over the two left', () => {
  assert.equal(rollLoadout(fromValues([0, 0, 0]), 'springy').trait, 'heavy');
});

// ---- parseLoadout under the new rules ----

const valid = { schemaVersion: 1, trait: 'springy', synergy: 'seed-burst', special: null };
const keptCases: [string, unknown][] = [
  ['a synergy that is not its trait default', { ...valid, trait: 'heavy', synergy: 'ricochet' }],
  ['a new synergy with a new special', { ...valid, synergy: 'chain-lightning', special: 'meteor' }],
  ['a synergy id this build does not know', { ...valid, synergy: 'future-ability' }],
  ['a special id this build does not know', { ...valid, special: 'future-special' }],
  ['the longest id the pattern allows', { ...valid, synergy: 'a'.repeat(32) }],
];
for (const [name, input] of keptCases) {
  test('parseLoadout keeps ' + name + ' exactly', () => {
    assert.deepEqual(parseLoadout(input), input);
  });
}

const idRejects: [string, unknown][] = [
  ['a synergy with capitals', { ...valid, synergy: 'Seed-Burst' }],
  ['a synergy with markup', { ...valid, synergy: '<b>' }],
  ['a synergy over 32 characters', { ...valid, synergy: 'a'.repeat(33) }],
  ['an empty synergy', { ...valid, synergy: '' }],
  ['a numeric synergy', { ...valid, synergy: 3 }],
  ['a special with a space', { ...valid, special: 'big plush' }],
  ['a special over 32 characters', { ...valid, special: 'a'.repeat(33) }],
];
for (const [name, input] of idRejects) {
  test('parseLoadout returns null for ' + name, () => {
    assert.equal(parseLoadout(input), null);
  });
}

const names = { 'seed-burst': 'Seed Pop', meteor: 'Tea Party' };
test('parseLoadout keeps a valid name pack untouched', () => {
  assert.deepEqual(parseLoadout({ ...valid, names }), { ...valid, names });
});

test('parseLoadout keeps the loadout and drops an invalid name pack to absent', () => {
  assert.deepEqual(parseLoadout({ ...valid, names: '<b>no</b>' }), valid);
});

test('parseLoadout drops one bad name and keeps the rest of the pack', () => {
  assert.deepEqual(parseLoadout({ ...valid, names: { ...names, meteor: '<i>' } }), { ...valid, names: { 'seed-burst': 'Seed Pop' } });
});

test('a record that already has a loadout is parsed to itself, with no names key added', () => {
  const old = { schemaVersion: 1, trait: 'piercing', synergy: 'piercing-beam', special: null };
  assert.deepEqual(Object.keys(parseLoadout(old) ?? {}), ['schemaVersion', 'trait', 'synergy', 'special']);
});
