import assert from 'node:assert/strict';
import { test } from 'node:test';
import { residentRegistry } from '../src/residents/registry.ts';

test('resident identity and membership survive reload independently of generation and reveal', () => {
  let stored: string | null = null;
  const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } };
  const registry = residentRegistry(storage, () => 'independent-resident-id');
  const id = registry.discover('saved-generation');
  assert.equal(id, 'resident:independent-resident-id');
  assert.equal(registry.discover('saved-generation'), id);
  assert.equal(registry.list().length, 1);
  assert.equal(registry.welcome(id), true);
  assert.equal(registry.welcome(id), false);
  const restored = residentRegistry(storage, () => { throw Error('must retain identity'); });
  assert.equal(restored.list()[0].arrival, 'welcomed');
  restored.remove(id);
  assert.equal(restored.list()[0].inRoom, false);
  assert.equal(restored.list()[0].savedId, 'saved-generation');
  assert.equal(restored.welcome(id), true);
});

test('Save for later persists the draft without adding it to the room', () => {
  let stored: string | null = null;
  const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } };
  const registry = residentRegistry(storage, () => 'later');
  registry.defer(registry.discover('saved'));
  const record = residentRegistry(storage, () => 'unused').list()[0];
  assert.equal(record.arrival, 'saved');
  assert.equal(record.inRoom, false);
});

test('room positions are separate and capacity never evicts an existing resident', () => {
  let stored: string | null = null; let next = 0;
  const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } };
  const registry = residentRegistry(storage, () => String(++next));
  const first = registry.discover('first');
  registry.position(first, 'desktop', { x: 900, y: 900 });
  registry.position(first, 'portrait', { x: 500, y: 1000 });
  registry.welcome(first);
  for (let index = 1; index < 12; index++) assert.equal(registry.welcome(registry.discover('saved-' + index)), true);
  assert.equal(registry.welcome(registry.discover('overflow')), false);
  const restored = residentRegistry(storage, () => 'unused');
  assert.equal(restored.list().filter(entry => entry.inRoom).length, 12);
  assert.deepEqual(restored.list()[0].positions, { desktop: { x: 900, y: 900 }, portrait: { x: 500, y: 1000 } });
});

test('a resident kept before arrivals existed is discovered as saved, not as a new arrival', () => {
  let stored: string | null = null; let next = 0;
  const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } };
  const registry = residentRegistry(storage, () => String(++next));
  const kept = registry.discover('kept-earlier', 'saved');
  const draft = registry.discover('new-draft');
  assert.equal(registry.list().find(entry => entry.id === kept)?.arrival, 'saved');
  assert.equal(registry.list().find(entry => entry.id === draft)?.arrival, 'waiting');
  assert.equal(registry.discover('kept-earlier', 'waiting'), kept);
  assert.equal(registry.list().find(entry => entry.id === kept)?.arrival, 'saved');
});

test('room capacity can be checked without changing membership', () => {
  let stored: string | null = null; let next = 0;
  const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } };
  const registry = residentRegistry(storage, () => String(++next));
  const ids = Array.from({ length: 12 }, (_, index) => registry.discover('saved-' + index));
  const before = stored;
  assert.equal(registry.canWelcome(ids[0]!), true);
  assert.equal(stored, before);
  for (const id of ids.slice(0, 11)) registry.welcome(id);
  assert.equal(registry.canWelcome(ids[11]!), true);
  registry.welcome(ids[11]!);
  assert.equal(registry.canWelcome(ids[11]!), true, 'a resident already in the room is not over capacity');
  assert.equal(registry.canWelcome(registry.discover('overflow')), false);
  assert.equal(registry.canWelcome('resident:missing'), false);
});

test('failed persistence leaves membership unchanged and malformed stored records are rejected', () => {
  let fail = false; let stored: string | null = null;
  const registry = residentRegistry({ getItem: () => stored, setItem: (_key, value) => { if (fail) throw Error('quota'); stored = value; } }, () => 'resident');
  const id = registry.discover('saved'); fail = true;
  assert.throws(() => registry.welcome(id), /quota/);
  assert.equal(registry.list()[0].inRoom, false);
  assert.throws(() => residentRegistry({ getItem: () => '{"version":1,"residents":[{"id":"puff"}]}', setItem() {} }, () => 'unused'), /Invalid/);
});
