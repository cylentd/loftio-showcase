import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOLO_POOL, holoFor, holoForResident } from '../../src/holo-card/holo-pool-model.ts';
import { HOLO_TYPES } from '../../src/holo-card/holo-type-data.ts';

const GENERATED_IDS = Array.from({ length: 60 }, (_, index) => `resident-${index}`);
const CLASSIC = HOLO_TYPES.find(type => type.id === 'classic')?.id;

test('the normal card (no alt art) wears Classic, whichever resident it is', () => {
  const looks = ['sprout', 'slime', 'chomper'].map(id => holoFor(id, null));
  assert.deepEqual(new Set(looks), new Set([CLASSIC]));
});

test('the pool is every holo type', () => {
  assert.deepEqual([...HOLO_POOL], HOLO_TYPES.map(type => type.id));
});

test('the same id gives the same type on a later call with a freshly built id string', () => {
  const first = GENERATED_IDS.map(holoForResident);
  const later = GENERATED_IDS.map(id => holoForResident(['resident', id.split('-')[1]].join('-')));
  assert.deepEqual(later, first);
});

test('every result is in the pool', () => {
  const outside = GENERATED_IDS.filter(id => !HOLO_POOL.includes(holoForResident(id)));
  assert.deepEqual(outside, []);
});

test('over 60 generated ids every type appears at least once', () => {
  const seen = new Set(GENERATED_IDS.map(holoForResident));
  assert.deepEqual([...seen].sort(), [...HOLO_POOL].sort());
});

test('an alt-art card wears its resident\'s seeded type', () => {
  const altLooks = GENERATED_IDS.map(id => holoFor(id, 'a'));
  assert.deepEqual(altLooks, GENERATED_IDS.map(holoForResident));
});
