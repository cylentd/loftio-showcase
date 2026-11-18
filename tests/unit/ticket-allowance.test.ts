import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTickets } from '../../src/builder/tickets.ts';

function memory(raw: string | null = null) {
  return { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
}

test('game initial allowance is three, persisted before any creation', () => {
  const storage = memory();
  const tickets = buildTickets(storage, 'game', 3);
  assert.equal(tickets.count(), 3);
  assert.deepEqual(JSON.parse(storage.getItem()!), { version: 1, balance: 3, open: [] });
  assert.equal(buildTickets(storage, 'game', 3).count(), 3);
  assert.equal(tickets.spend('confirmed'), true);
  tickets.settle('confirmed');
  assert.equal(buildTickets(storage, 'game', 3).count(), 2);
});

for (const balance of [0, 1, 2, 7]) {
  test(`an initial allowance preserves saved balance ${balance} and pending requests`, () => {
    const saved = { version: 1, balance, open: ['pending'], day: '2026-11-17' };
    const storage = memory(JSON.stringify(saved));
    assert.equal(buildTickets(storage, 'game', 3).count(), balance);
    assert.deepEqual(JSON.parse(storage.getItem()!), saved);
  });
}

test('malformed saved ledger is not replaced with the initial allowance', () => {
  const storage = memory('{broken');
  assert.throws(() => buildTickets(storage, 'game', 3));
  assert.equal(storage.getItem(), '{broken');
});
