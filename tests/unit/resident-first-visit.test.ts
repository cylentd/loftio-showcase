import assert from 'node:assert/strict';
import { test } from 'node:test';
import { firstVisit } from '../../src/residents/first-visit.ts';

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test('new profile opens once, including after dismissal and reload', () => {
  const store = storage();
  const enter = firstVisit(store, 'intro');
  assert.equal(enter(), true);
  assert.equal(store.getItem('intro'), 'seen');
  assert.equal(enter(), false);
  assert.equal(firstVisit(store, 'intro')(), false);
});

test('a marker written by another tab after eligibility capture wins', () => {
  const store = storage();
  const enter = firstVisit(store, 'intro');
  store.setItem('intro', 'seen');
  assert.equal(enter(), false);
});

test('unwritable storage never forces a recurring introduction', () => {
  assert.equal(firstVisit({ getItem: () => null, setItem: () => { throw Error('denied'); } }, 'intro')(), false);
});
