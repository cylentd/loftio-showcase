import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTickets, FREE_BUILDS } from '../../src/builder/tickets.ts';
import { createBuilder, type GenerateOutcome } from '../../src/builder/controller.ts';
import { memoryStore } from '../../src/builder/store.ts';
import type { GenerationRecord } from '../../src/builder/records.ts';

function memory(initial: string | null = null) {
  let stored = initial;
  return { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; }, get raw() { return stored; } };
}

test('first launch grants exactly one free build, and reloading never grants it again', () => {
  const storage = memory();
  assert.equal(FREE_BUILDS, 1);
  const first = buildTickets(storage);
  assert.equal(first.count(), 1);
  assert.equal(first.spend('a'), true);
  assert.equal(buildTickets(storage).count(), 0);
  assert.equal(buildTickets(storage).count(), 0);
});

test('spending with no tickets left is refused and leaves the count at zero', () => {
  const tickets = buildTickets(memory());
  assert.equal(tickets.spend('a'), true);
  assert.equal(tickets.spend('b'), false);
  assert.equal(tickets.count(), 0);
});

test('a refund returns the ticket once, and only for a request that spent one', () => {
  const tickets = buildTickets(memory());
  tickets.spend('a');
  tickets.refund('a');
  tickets.refund('a');
  assert.equal(tickets.count(), 1);
  tickets.refund('never-spent');
  assert.equal(tickets.count(), 1);
});

test('a settled request stays paid: a later refund for it gives nothing back', () => {
  const tickets = buildTickets(memory());
  tickets.spend('a');
  tickets.settle('a');
  tickets.refund('a');
  assert.equal(tickets.count(), 0);
});

test('a second tab sees a spend at once, so two tabs cannot both use one ticket', () => {
  const storage = memory();
  const tabA = buildTickets(storage);
  const tabB = buildTickets(storage);
  assert.equal(tabA.spend('a'), true);
  assert.equal(tabB.count(), 0);
  assert.equal(tabB.spend('b'), false);
});

test('grant adds whole tickets and refuses anything else', () => {
  const tickets = buildTickets(memory());
  tickets.grant(2);
  assert.equal(tickets.count(), 3);
  for (const bad of [0, -1, 1.5, Number.NaN]) assert.throws(() => tickets.grant(bad), String(bad));
  assert.equal(tickets.count(), 3);
});

test('a damaged ticket record is refused rather than replaced by a fresh free build', () => {
  for (const raw of ['{', '{"version":2,"balance":1,"open":[]}', '{"version":1,"balance":-1,"open":[]}',
    '{"version":1,"balance":1.5,"open":[]}', '{"version":1,"balance":1,"open":[3]}', '{"version":1,"balance":1}']) {
    assert.throws(() => buildTickets(memory(raw)), raw);
  }
});

test('mock and local tickets are kept apart by storage key', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  buildTickets(storage, 'loftio-build-tickets-mock-v1').spend('a');
  assert.equal(buildTickets(storage, 'loftio-build-tickets-v1').count(), 1);
});

// Online mode: the store tops up to a cap once per UTC day.

test('refillDaily tops a new store up to the cap', () => {
  const tickets = buildTickets(memory());
  tickets.refillDaily(3, '2026-11-08');
  assert.equal(tickets.count(), 3);
});

test('refillDaily runs once per day key: spent tickets stay spent until the next day', () => {
  const tickets = buildTickets(memory());
  tickets.refillDaily(3, '2026-11-08');
  tickets.spend('a');
  tickets.spend('b');
  tickets.refillDaily(3, '2026-11-08');
  assert.equal(tickets.count(), 1);
  tickets.refillDaily(3, '2026-11-09');
  assert.equal(tickets.count(), 3);
});

test('refillDaily never exceeds the cap, and never takes tickets away', () => {
  const tickets = buildTickets(memory());
  tickets.refillDaily(3, '2026-11-08');
  tickets.refillDaily(3, '2026-11-09');
  assert.equal(tickets.count(), 3);
  tickets.grant(5);
  tickets.refillDaily(3, '2026-11-10');
  assert.equal(tickets.count(), 8);
});

test('the daily refill is remembered across reloads and tabs', () => {
  const storage = memory();
  const first = buildTickets(storage);
  first.refillDaily(3, '2026-11-08');
  first.spend('a');
  const reloaded = buildTickets(storage);
  reloaded.refillDaily(3, '2026-11-08');
  assert.equal(reloaded.count(), 2);
  assert.equal(first.count(), 2);
});

test('a ledger saved before daily refills existed still loads, refills, and keeps its open requests', () => {
  const storage = memory('{"version":1,"balance":0,"open":["old"]}');
  const tickets = buildTickets(storage);
  assert.equal(tickets.count(), 0);
  tickets.refillDaily(3, '2026-11-08');
  assert.equal(tickets.count(), 3);
  tickets.refund('old');
  assert.equal(tickets.count(), 4);
  assert.equal(buildTickets(storage).count(), 4);
});

test('a refill keeps open requests refundable', () => {
  const tickets = buildTickets(memory());
  tickets.refillDaily(3, '2026-11-08');
  tickets.spend('a');
  tickets.refillDaily(3, '2026-11-09');
  tickets.refund('a');
  assert.equal(tickets.count(), 4);
});

// Controller: a ticket is spent when Create dispatches a new request.

const selections = { creature: 'moth', personality: 'bookworm', signatureDetail: 'reading-glasses', palette: null };
const journal = () => {
  let pending: any[] = [];
  return { read: () => pending, add: (value: any) => { pending = [...pending, value]; }, remove: (id: string) => { pending = pending.filter(item => item.requestId !== id); } };
};

function builder(api: any, tickets: ReturnType<typeof buildTickets>, extra: Record<string, unknown> = {}) {
  let next = 0;
  return createBuilder({ api, store: memoryStore(), journal: journal(), tickets, newId: () => `req-${++next}`,
    now: () => new Date('2026-11-07T00:00:00Z'), inspect: async () => ({ verdict: 'transparent' }), ...extra }, selections);
}

test('with no tickets Create sends no request and says so', async () => {
  const tickets = buildTickets(memory());
  tickets.spend('earlier');
  let calls = 0;
  const instance = builder({ async generate(body: any) { calls++; return success(body.requestId); } }, tickets);
  await instance.create();
  assert.equal(calls, 0);
  assert.equal(instance.state().error?.kind, 'tickets');
  assert.equal(instance.state().tickets, 0);
});

test('Create spends one ticket per new image, and Try another spends another', async () => {
  const tickets = buildTickets(memory());
  tickets.grant(1);
  let calls = 0;
  const instance = builder({ async generate(body: any) { calls++; return success(body.requestId); } }, tickets);
  assert.equal(instance.state().tickets, 2);
  await instance.create();
  assert.equal(instance.state().tickets, 1);
  await instance.tryAnother();
  assert.equal(instance.state().tickets, 0);
  await instance.tryAnother();
  assert.equal(calls, 2);
  assert.equal(instance.state().error?.kind, 'tickets');
});

test('a request the worker refuses before making an image gives the ticket back', async () => {
  for (const kind of ['invalid', 'cap', 'busy'] as const) {
    const tickets = buildTickets(memory());
    const instance = builder({ async generate() { return { ok: false, error: { kind, message: kind } }; } }, tickets);
    await instance.create();
    assert.equal(tickets.count(), 1, kind);
  }
});

test('a failure after the image was attempted keeps the ticket spent', async () => {
  for (const kind of ['safety', 'aborted'] as const) {
    const tickets = buildTickets(memory());
    const instance = builder({ async generate() { return { ok: false, error: { kind, message: kind } }; } }, tickets);
    await instance.create();
    assert.equal(tickets.count(), 0, kind);
  }
});

test('a lost connection keeps the ticket, and reconnecting reattaches without spending again', async () => {
  const tickets = buildTickets(memory());
  tickets.grant(1);
  const instance = builder({
    async generate() { throw Error('connection lost'); },
    async observe(id: string) { return success(id); },
  }, tickets);
  await instance.create();
  assert.equal(tickets.count(), 1);
  await instance.reconnect();
  assert.equal(instance.state().status, 'ready');
  assert.equal(tickets.count(), 1);
});

test('resuming a pending request after reload never spends a ticket', async () => {
  const tickets = buildTickets(memory());
  const pending = journal();
  pending.add({ requestId: 'old', selections });
  const instance = builder({ async generate() { throw Error('must not generate'); }, async observe(id: string) { return success(id); } },
    tickets, { journal: pending });
  await instance.resume();
  assert.equal(instance.state().status, 'ready');
  assert.equal(tickets.count(), 1);
});

test('a journal that cannot save gives the ticket back, since nothing was sent', async () => {
  const tickets = buildTickets(memory());
  let calls = 0;
  const instance = builder({ async generate(body: any) { calls++; return success(body.requestId); } }, tickets,
    { journal: { read: () => [], add: () => { throw Error('quota'); }, remove: () => {} } });
  await instance.create();
  assert.equal(calls, 0);
  assert.equal(instance.state().error?.kind, 'storage');
  assert.equal(tickets.count(), 1);
});

test('without a ticket store the builder works as before and reports no count', async () => {
  let calls = 0;
  const instance = createBuilder({ api: { async generate(body) { calls++; return success(body.requestId); } }, store: memoryStore(),
    newId: () => 'plain', now: () => new Date('2026-11-07T00:00:00Z'), inspect: async () => ({ verdict: 'transparent' }) }, selections);
  await instance.create();
  assert.equal(calls, 1);
  assert.equal(instance.state().tickets, null);
});

function record(requestId: string): GenerationRecord {
  return {
    id: `gen-${requestId}`, requestId, userSelections: selections,
    resolvedSelections: {
      creature: { id: 'moth', label: 'Moth', prompt: 'moth' },
      personality: { id: 'bookworm', label: 'Bookworm', prompt: 'enthusiastic bookworm' },
      signatureDetail: { id: 'reading-glasses', label: 'Reading glasses', prompt: 'oversized reading glasses' },
      palette: { id: 'blackberry', label: 'Blackberry', prompt: '', colors: ['a', 'b', 'c'] },
    },
    promptVersion: 'v4.1', prompt: 'prompt', referenceIds: ['loftio-original-six'], providerId: 'mock', modelId: 'mock-1',
    attempts: 1, createdAt: '2026-11-07T00:00:00.000Z',
  };
}

function success(requestId: string): GenerateOutcome {
  return { ok: true, generation: record(requestId), image: { base64: 'AAAA', mime: 'image/png', width: 2, height: 2, hasAlphaChannel: true } };
}
