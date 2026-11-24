import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SavedCharacter } from '../../src/builder/records.ts';
import { keptResidents } from '../../src/residents/kept-residents.ts';
import type { ResidentEntry } from '../../src/residents/registry.ts';

test('Collection includes room-saved and welcomed drafts, but not unopened drafts or mock art', () => {
  const record = (id: string, state: SavedCharacter['state'] = 'draft', providerId = 'online') => ({
    id, state, generation: { providerId }, resolvedSelections: { creature: { label: 'Fox' } },
  }) as SavedCharacter;
  const entry = (savedId: string, arrival: ResidentEntry['arrival'], inRoom = false): ResidentEntry => ({
    id: `resident:${savedId}`, savedId, arrival, inRoom, positions: {}, name: savedId,
  });
  const actual = keptResidents([record('later'), record('home'), record('parcel'), record('legacy', 'kept'), record('mock', 'draft', 'mock')], [
    entry('later', 'saved'), entry('home', 'welcomed', true), entry('parcel', 'waiting'), entry('legacy', 'saved'), entry('mock', 'welcomed', true),
    entry('missing', 'welcomed'),
  ]);
  assert.deepEqual(actual.map(({ name, inLoft }) => [name, inLoft]), [['later', false], ['home', true], ['legacy', false]]);
});
