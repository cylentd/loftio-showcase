// #442 phase 2, unit P1: the catalog of eleven synergies and ten specials, and its copy. Expected rows come from the design
// tables in TODO.md ("Eleven synergies and themed names"), not from the code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ID_PATTERN, SPECIALS, SYNERGIES, SYNERGY_BY_TRAIT, TRAITS } from '../../src/loadout/loadout-data.ts';
import { LOADOUT_COPY, ORIGINAL_NAMES } from '../../src/loadout/loadout-copy.ts';

const SYNERGY_ROWS: [string, string, string[]][] = [
  ['seed-burst', 'burst', ['boss']],
  ['piercing-beam', 'burst', ['few', 'crowd']],
  ['spread-shot', 'burst', ['few', 'crowd']],
  ['shockwave', 'burst', ['crowd']],
  ['ricochet', 'burst', ['few', 'crowd']],
  ['chain-lightning', 'burst', ['few', 'crowd']],
  ['poison-cloud', 'over-time', ['boss']],
  ['power-field', 'zone', ['any']],
  ['booster', 'boost', ['any']],
  ['mend', 'heal', ['any']],
  ['bubble-guard', 'guard', ['any']],
];
const SPECIAL_KINDS: [string, string][] = [
  ['meteor', 'big-hit'], ['stampede', 'big-hit'],
  ['big-plush', 'power-up'], ['overdrive', 'power-up'], ['triple-trouble', 'power-up'],
  ['picnic', 'team-boost'], ['pep-rally', 'team-boost'],
  ['bumpers', 'chaos'], ['freeze-frame', 'chaos'],
  ['gravity-well', 'chaos'], // the design names no kind for it; it changes the arena, so it joins Chaos
];
const SHINES = ['boss', 'few', 'crowd', 'any'];

test('SYNERGIES lists the eleven ids in the design table order', () => {
  assert.deepEqual(SYNERGIES.map((entry) => entry.id), SYNERGY_ROWS.map(([id]) => id));
});

for (const [id, kind, shinesVs] of SYNERGY_ROWS) {
  test('synergy ' + id + ' is a ' + kind + ' that shines vs ' + shinesVs.join(', '), () => {
    const entry = SYNERGIES.find((item) => item.id === id);
    assert.deepEqual([entry?.kind, entry?.shinesVs], [kind, shinesVs]);
  });
}

test('SPECIALS lists the ten ids with the kinds the owner locked', () => {
  assert.deepEqual(SPECIALS.map((entry) => [entry.id, entry.kind]), SPECIAL_KINDS);
});

// Conductor's shines-vs for the specials (2026-11-19): the design table rates synergies only.
const SPECIAL_SHINES: [string, string[]][] = [
  ['meteor', ['boss', 'crowd']], ['stampede', ['few', 'crowd']], ['big-plush', ['boss']], ['overdrive', ['any']],
  ['triple-trouble', ['few', 'crowd']], ['picnic', ['any']], ['pep-rally', ['boss']], ['bumpers', ['crowd']],
  ['freeze-frame', ['any']], ['gravity-well', ['crowd']],
];
test('SPECIALS carry the shines-vs the conductor set', () => {
  assert.deepEqual(SPECIALS.map((entry) => [entry.id, entry.shinesVs]), SPECIAL_SHINES);
});

test('every synergy and special has a non-empty shines-vs list of known values', () => {
  const entries: { shinesVs: readonly string[] }[] = [...SYNERGIES, ...SPECIALS];
  const bad = entries.filter((entry) => entry.shinesVs.length === 0 || entry.shinesVs.some((v) => !SHINES.includes(v)));
  assert.deepEqual(bad, []);
});

test('every synergy and special id matches the id pattern and no id is used twice', () => {
  const all = [...SYNERGIES, ...SPECIALS].map((entry) => entry.id);
  assert.deepEqual([all.filter((id) => !ID_PATTERN.test(id)), new Set(all).size], [[], all.length]);
});

test('every trait still has a default synergy that is in the catalog', () => {
  const known = SYNERGIES.map((entry) => entry.id as string);
  assert.deepEqual(TRAITS.filter((trait) => !known.includes(SYNERGY_BY_TRAIT[trait])), []);
});

test('copy has a plain name and a plain line for every synergy and special', () => {
  const missing = [...SYNERGIES.map((e) => [e.id, LOADOUT_COPY.synergies[e.id]] as const), ...SPECIALS.map((e) => [e.id, LOADOUT_COPY.specials[e.id]] as const)]
    .filter(([, text]) => !text || text.name.trim() === '' || text.line.trim() === '');
  assert.deepEqual(missing, []);
});

test('copy has a label for every kind and every shines-vs value', () => {
  const kinds = new Set([...SYNERGIES, ...SPECIALS].map((entry) => entry.kind));
  const noKind = [...kinds].filter((kind) => !LOADOUT_COPY.kinds[kind]);
  const noShine = SHINES.filter((value) => !LOADOUT_COPY.shinesVs[value as 'boss']);
  assert.deepEqual([noKind, noShine], [[], []]);
});

test('the drawer copy keys the landed drawer reads are still there', () => {
  assert.deepEqual(Object.keys(LOADOUT_COPY.traits), ['springy', 'heavy', 'piercing']);
});

test('Meteor reads "Leaps and slams down"', () => {
  assert.equal(LOADOUT_COPY.specials.meteor.line, 'Leaps and slams down');
});

const ORIGINAL_NAME_ROWS: [string, string, string][] = [
  ['sprout', 'Seed Pop', 'Tea Party'], ['chomper', 'Belly Boom', 'Chomp Crash'], ['puff', 'Cloud Ray', 'Super Puff'],
  ['hoodie', 'Static Shock', 'Pause Menu'], ['slime', 'Jelly Dome', 'Star Pull'], ['burger', 'Sesame Spray', 'Triple Stack'],
];
for (const [id, synergy, special] of ORIGINAL_NAME_ROWS) {
  test('original ' + id + ' is hand-named ' + synergy + ' and ' + special, () => {
    assert.deepEqual(ORIGINAL_NAMES[id], { synergy, special });
  });
}
