import assert from 'node:assert/strict';
import { test } from 'node:test';
import { originalLineup } from '../../src/residents/original-lineup.ts';

const IDS = ['sprout', 'hoodie', 'puff', 'chomper', 'slime', 'burger'];

test('existing visitors start with all originals and can send everyone home without deleting identities', () => {
  let stored: string | null = null;
  const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } };
  const lineup = originalLineup(storage, IDS, 'lineup');
  assert.deepEqual(lineup.list(), IDS.map(id => ({ id, inRoom: true })));
  for (const id of IDS) lineup.setInRoom(id, false);
  assert.deepEqual(originalLineup(storage, IDS, 'lineup').list(), IDS.map(id => ({ id, inRoom: false })));
});

test('inviting an original back restores only that resident and survives reload', () => {
  let stored = JSON.stringify({ version: 1, away: IDS });
  const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } };
  const lineup = originalLineup(storage, IDS, 'lineup');
  lineup.setInRoom('puff', true);
  assert.deepEqual(originalLineup(storage, IDS, 'lineup').list().filter(entry => entry.inRoom), [{ id: 'puff', inRoom: true }]);
  assert.equal(lineup.list().length, 6);
});

test('failed persistence keeps the current lineup and repeat choices do not write', () => {
  let writes = 0;
  const lineup = originalLineup({ getItem: () => null, setItem() { writes += 1; throw Error('quota'); } }, IDS, 'lineup');
  lineup.setInRoom('puff', true);
  assert.equal(writes, 0);
  assert.throws(() => lineup.setInRoom('puff', false), /quota/);
  assert.equal(lineup.list().find(entry => entry.id === 'puff')?.inRoom, true);
});

test('unknown, duplicated and malformed original identities fail closed', () => {
  for (const raw of ['{}', '{"version":1,"away":["stranger"]}', '{"version":1,"away":["puff","puff"]}', '{"version":1,"away":[null]}']) {
    assert.throws(() => originalLineup({ getItem: () => raw, setItem() {} }, IDS, 'lineup'), /Invalid/);
  }
  const lineup = originalLineup({ getItem: () => null, setItem() { throw Error('must not write'); } }, IDS, 'lineup');
  assert.throws(() => lineup.setInRoom('stranger', false), /Unknown/);
  const copy = lineup.list(); copy[0]!.inRoom = false;
  assert.equal(lineup.list()[0]!.inRoom, true);
});
