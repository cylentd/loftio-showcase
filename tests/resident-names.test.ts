import assert from 'node:assert/strict';
import { test } from 'node:test';
import { residentRegistry } from '../src/residents/registry.ts';
import { RESIDENT_COPY } from '../src/residents/copy.ts';

function fixture(initial: string | null = null) {
  let stored = initial; let fail = false;
  const storage = { getItem: () => stored, setItem: (_key: string, value: string) => {
    if (fail) throw Error('quota');
    stored = value;
  } };
  const registry = residentRegistry(storage, () => 'named');
  const id = registry.discover('saved-image');
  return { registry, id, storage, fail: () => { fail = true; }, stored: () => stored };
}

test('an arrival name is trimmed, saved locally and retained after reloading', () => {
  const { registry, id, storage } = fixture();
  assert.equal(typeof registry.rename, 'function', 'the registry must support local names');
  registry.rename(id, '  Maple  ');
  assert.equal(registry.list()[0]!.name, 'Maple');
  const reloaded = residentRegistry(storage, () => { throw Error('must retain identity'); });
  assert.equal(reloaded.list()[0]!.name, 'Maple');
  assert.equal(reloaded.list()[0]!.id, id);
  assert.equal(reloaded.list()[0]!.savedId, 'saved-image');
});

test('naming does not change membership, arrival state or either room position', () => {
  const { registry, id } = fixture();
  registry.position(id, 'desktop', { x: 100, y: 200 });
  registry.position(id, 'portrait', { x: 300, y: 400 });
  const before = registry.list()[0]!;
  assert.equal(typeof registry.rename, 'function');
  registry.rename(id, 'Pebble');
  assert.deepEqual(registry.list()[0], { ...before, name: 'Pebble' });
  registry.defer(id);
  assert.equal(registry.list()[0]!.name, 'Pebble');
  assert.equal(registry.list()[0]!.inRoom, false);
  registry.welcome(id);
  assert.equal(registry.list()[0]!.name, 'Pebble');
});

test('names allow twenty Unicode characters, including surrogate pairs, but not twenty-one', () => {
  const { registry, id } = fixture();
  assert.equal(typeof registry.rename, 'function');
  registry.rename(id, 'abcdefghijklmnopqrst');
  assert.equal(registry.list()[0]!.name, 'abcdefghijklmnopqrst');
  registry.rename(id, '🌱'.repeat(20));
  assert.equal(registry.list()[0]!.name, '🌱'.repeat(20));
  assert.throws(() => registry.rename(id, 'abcdefghijklmnopqrstu'));
  assert.throws(() => registry.rename(id, '🌱'.repeat(21)));
  assert.equal(registry.list()[0]!.name, '🌱'.repeat(20));
});

test('empty, non-string and control-character names cannot replace a valid name', () => {
  const { registry, id } = fixture();
  assert.equal(typeof registry.rename, 'function');
  registry.rename(id, 'Clover');
  for (const name of ['', '   ', 'Maple\nLeaf', 'Pip\u0000', null, 42]) {
    assert.throws(() => registry.rename(id, name as string));
    assert.equal(registry.list()[0]!.name, 'Clover');
  }
});

test('a failed write or unknown identity never changes the resident registry', () => {
  const state = fixture();
  assert.equal(typeof state.registry.rename, 'function');
  state.registry.rename(state.id, 'Cedar');
  const before = state.stored();
  assert.throws(() => state.registry.rename('resident:missing', 'Pip'));
  assert.equal(state.stored(), before);
  state.fail();
  assert.throws(() => state.registry.rename(state.id, 'Miso'), /quota/);
  assert.equal(state.registry.list()[0]!.name, 'Cedar');
  assert.equal(state.stored(), before);
});

test('existing version-one records without a name load without inventing or changing one', () => {
  const initial = JSON.stringify({ version: 1, residents: [{
    id: 'resident:named', savedId: 'saved-image', inRoom: true, arrival: 'welcomed', positions: {},
  }] });
  const { registry } = fixture(initial);
  assert.equal(registry.list()[0]!.name, undefined);
  assert.equal(registry.list()[0]!.inRoom, true);
});

test('invalid persisted names are rejected instead of becoming room labels', () => {
  for (const name of ['', ' x ', 'x'.repeat(21), 'a\nb', null, 42, {}]) {
    const raw = JSON.stringify({ version: 1, residents: [{
      id: 'resident:named', savedId: 'saved-image', inRoom: false, arrival: 'waiting', positions: {}, name,
    }] });
    assert.throws(() => residentRegistry({ getItem: () => raw, setItem() {} }, () => 'unused'));
  }
});

for (const mode of ['local', 'online', 'mock'] as const) {
  test(mode + ' progress copy refers to closing the box, not leaving the page', () => {
    assert.equal(RESIDENT_COPY.creating[mode], 'Close this and keep playing. Your resident will arrive in the loft in about a minute.');
  });
}
