import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startNotingFresh } from '../../src/residents/fresh-start.ts';

// The residents panel decides "fresh" (no saved residents, tickets or lineup) and then starts its session, which writes
// the ticket ledger. Read in the other order, a first visit would never be fresh and its introduction would never open.
const KEYS = ['residents', 'tickets', 'residents-originals'];

function storage(saved: Record<string, string> = {}) {
  const values = new Map(Object.entries(saved));
  return { values, getItem: (key: string) => values.get(key) ?? null };
}

test('a first visit is fresh even though starting the session writes the ticket ledger', () => {
  const store = storage();
  const { fresh, started } = startNotingFresh(store, KEYS, () => { store.values.set('tickets', '{"balance":3}'); return 'session'; });
  assert.equal(fresh, true);
  assert.equal(started, 'session');
});

for (const key of KEYS) {
  test(`a profile with saved ${key} is not fresh`, () => {
    assert.equal(startNotingFresh(storage({ [key]: '{}' }), KEYS, () => null).fresh, false);
  });
}

test('arrival preview (no page storage) is never fresh', () => {
  assert.equal(startNotingFresh(null, KEYS, () => null).fresh, false);
});

test('unreadable storage is not fresh, and the session still starts', () => {
  const started: string[] = [];
  const blocked = { getItem: () => { throw Error('denied'); } };
  assert.equal(startNotingFresh(blocked, KEYS, () => started.push('start')).fresh, false);
  assert.deepEqual(started, ['start']);
});

test('a session that fails to start throws to the caller', () => {
  assert.throws(() => startNotingFresh(storage(), KEYS, () => { throw Error('no session'); }), /no session/);
});
