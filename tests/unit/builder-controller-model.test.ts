import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canCreate, initial, next, retryMode } from '../../src/builder/controller-model.ts';
import type { BuilderRequest, Life, LifeEvent } from '../../src/builder/controller-model.ts';
import type { BuilderFailure } from '../../src/builder/provider.ts';

const SELECTIONS = { creature: 'moth', personality: 'bookworm', signatureDetail: 'reading-glasses', palette: null };
const R1: BuilderRequest = { requestId: 'r1', selections: SELECTIONS };
const R2: BuilderRequest = { requestId: 'r2', selections: SELECTIONS };
const R3: BuilderRequest = { requestId: 'r3', selections: SELECTIONS };
const NETWORK: BuilderFailure = { kind: 'network', message: 'offline' };
const STORAGE: BuilderFailure = { kind: 'storage', message: 'full' };
const LIVE_RUN = 1; // the run id every generating state below holds
const STALE_RUN = 99; // an id no state holds

const base = initial({ observable: true, preparable: true });
const life = (changes: Partial<Life>): Life => Object.freeze({ ...base, ...changes });

// One state per row. Each differs from its neighbours in a field a guard reads.
const FROM: Record<string, Life> = {
  idle: life({}),
  'ready, fresh preview': life({ status: 'ready', preview: 'fresh' }),
  'ready, kept preview': life({ status: 'ready', preview: 'kept' }),
  'failed, request held': life({ status: 'failed', error: NETWORK, request: R1, runs: LIVE_RUN }),
  generating: life({ status: 'generating', run: LIVE_RUN, runs: LIVE_RUN, request: R1 }),
  'generating over a preview': life({ status: 'generating', run: LIVE_RUN, runs: LIVE_RUN, request: R3, preview: 'fresh' }),
  saving: life({ status: 'ready', preview: 'fresh', saving: true }),
  disposed: life({ disposed: true, request: R1, runs: LIVE_RUN }),
};
const IDLE = 'idle';
const READY_FRESH = 'ready, fresh preview';
const READY_KEPT = 'ready, kept preview';
const FAILED = 'failed, request held';
const GENERATING = 'generating';
const OVER_PREVIEW = 'generating over a preview';
const SAVING = 'saving';
const DISPOSED = 'disposed';
const SETTLED = [IDLE, READY_FRESH, READY_KEPT, FAILED]; // no run, not saving, not disposed

type Row = { name: string; event: LifeEvent; to: Record<string, (from: Life) => Partial<Life>> };
const each = (names: string[], change: (from: Life) => Partial<Life>) => Object.fromEntries(names.map((name) => [name, change]));
const started = (request: BuilderRequest, stage: Life['stage']) => (from: Life): Partial<Life> =>
  ({ status: 'generating', stage, error: null, run: from.runs + 1, runs: from.runs + 1, request });
const settled = (from: Life): Partial<Life> => ({ status: from.preview === 'none' ? 'idle' : 'ready', run: null });

// Every state/event pair not named in `to` must be refused: the same object comes back.
const TABLE: readonly Row[] = [
  { name: 'select', event: { type: 'select' }, to: each(SETTLED, () => ({ error: null })) },
  { name: 'reject', event: { type: 'reject', error: STORAGE }, to: each(SETTLED, () => ({ status: 'failed', error: STORAGE })) },
  { name: 'start generate', event: { type: 'start', mode: 'generate', request: R2 }, to: each(SETTLED, started(R2, 'creating')) },
  { name: 'start observe', event: { type: 'start', mode: 'observe', request: R2 }, to: each([...SETTLED, SAVING], started(R2, 'creating')) },
  { name: 'start prepare', event: { type: 'start', mode: 'prepare', request: R2 }, to: each([...SETTLED, SAVING], started(R2, 'preparing')) },
  { name: 'stage', event: { type: 'stage', run: LIVE_RUN, stage: 'preparing' }, to: each([GENERATING, OVER_PREVIEW], () => ({ stage: 'preparing' })) },
  { name: 'stage of a stale run', event: { type: 'stage', run: STALE_RUN, stage: 'preparing' }, to: {} },
  { name: 'fail', event: { type: 'fail', run: LIVE_RUN, error: STORAGE }, to: each([GENERATING, OVER_PREVIEW], () => ({ status: 'failed', error: STORAGE, run: null })) },
  { name: 'fail of a stale run', event: { type: 'fail', run: STALE_RUN, error: STORAGE }, to: {} },
  { name: 'ready, new image', event: { type: 'ready', run: LIVE_RUN, kept: false }, to: each([GENERATING, OVER_PREVIEW], () => ({ status: 'ready', run: null, preview: 'fresh' })) },
  { name: 'ready, image already kept', event: { type: 'ready', run: LIVE_RUN, kept: true }, to: each([GENERATING, OVER_PREVIEW], () => ({ status: 'ready', run: null, preview: 'kept' })) },
  { name: 'ready of a stale run', event: { type: 'ready', run: STALE_RUN, kept: false }, to: {} },
  { name: 'cancel', event: { type: 'cancel' }, to: each([GENERATING, OVER_PREVIEW], (from) => ({ ...settled(from), error: null })) },
  { name: 'forget the held request', event: { type: 'forget', requestId: R1.requestId }, to: each([FAILED, GENERATING], () => ({ request: null })) },
  { name: 'forget another request', event: { type: 'forget', requestId: 'other' }, to: {} },
  { name: 'note', event: { type: 'note', error: STORAGE }, to: each(Object.keys(FROM).filter((name) => name !== DISPOSED), () => ({ error: STORAGE })) },
  { name: 'save', event: { type: 'save' }, to: each([READY_FRESH], () => ({ saving: true, error: null })) },
  { name: 'saved', event: { type: 'saved' }, to: each([SAVING], () => ({ saving: false, preview: 'kept' })) },
  { name: 'save failed', event: { type: 'saveFailed', error: STORAGE }, to: each([SAVING], () => ({ saving: false, error: STORAGE })) },
  { name: 'dispose', event: { type: 'dispose' }, to: each(Object.keys(FROM).filter((name) => name !== DISPOSED), (from) => ({ ...(from.run === null ? {} : settled(from)), disposed: true })) },
];

const CELLS = TABLE.flatMap((row) => Object.entries(FROM).map(([name, from]) => ({ row, name, from, want: row.to[name] })));

for (const { row, name, from, want } of CELLS.filter((cell) => cell.want)) {
  test(`${row.name}: ${name} moves as the table says`, () => {
    assert.deepStrictEqual(next(from, Object.freeze(row.event)), { ...from, ...want!(from) });
  });
}

for (const { row, name, from } of CELLS.filter((cell) => !cell.want)) {
  test(`${row.name}: ${name} is refused with the same object`, () => {
    assert.strictEqual(next(from, Object.freeze(row.event)), from);
  });
}

for (const { row, name, from } of CELLS.filter((cell) => cell.want)) {
  test(`${row.name}: ${name} keeps a run live exactly while generating, and none once disposed`, () => {
    const to = next(from, row.event);
    assert.equal(to.run !== null, to.status === 'generating');
    assert.equal(to.disposed && to.run !== null, false);
  });
}

// cancel, create (a new generate) and resumed observe (collecting the cancelled request): all six orders from one
// live run. Whichever starts first after the cancel owns the builder; the rest are refused while it runs.
const STEPS: Record<string, LifeEvent> = {
  cancel: { type: 'cancel' },
  create: { type: 'start', mode: 'generate', request: R2 },
  observe: { type: 'start', mode: 'observe', request: R1 },
};
const ORDERS: readonly { order: string[]; want: Partial<Life> }[] = [
  { order: ['cancel', 'create', 'observe'], want: { status: 'generating', run: 2, runs: 2, request: R2 } },
  { order: ['cancel', 'observe', 'create'], want: { status: 'generating', run: 2, runs: 2, request: R1 } },
  { order: ['create', 'cancel', 'observe'], want: { status: 'generating', run: 2, runs: 2, request: R1 } },
  { order: ['create', 'observe', 'cancel'], want: { status: 'idle', run: null, runs: 1, request: R1 } },
  { order: ['observe', 'cancel', 'create'], want: { status: 'generating', run: 2, runs: 2, request: R2 } },
  { order: ['observe', 'create', 'cancel'], want: { status: 'idle', run: null, runs: 1, request: R1 } },
];

for (const { order, want } of ORDERS) {
  test(`${order.join(', ')} ends as the table says, and the first run's late answers change nothing`, () => {
    const end = order.reduce((state, step) => next(state, STEPS[step]!), FROM[GENERATING]!);
    assert.deepStrictEqual(end, { ...FROM[GENERATING], ...want });
    const late: LifeEvent[] = [
      { type: 'ready', run: LIVE_RUN, kept: false }, { type: 'fail', run: LIVE_RUN, error: NETWORK }, { type: 'stage', run: LIVE_RUN, stage: 'preparing' },
    ];
    for (const event of late) assert.strictEqual(next(end, event), end);
  });
}

test('a duplicate create is refused while the first run is live, and a duplicate keep while saving', () => {
  const running = next(FROM[IDLE]!, { type: 'start', mode: 'generate', request: R1 });
  assert.strictEqual(next(running, { type: 'start', mode: 'generate', request: R2 }), running);
  const saving = next(FROM[READY_FRESH]!, { type: 'save' });
  assert.strictEqual(next(saving, { type: 'save' }), saving);
});

test('a finished save cannot finish twice', () => {
  const done = next(FROM[SAVING]!, { type: 'saved' });
  assert.strictEqual(next(done, { type: 'saved' }), done);
  assert.strictEqual(next(done, { type: 'saveFailed', error: STORAGE }), done);
});

test('disposal ends the live run and freezes every later event', () => {
  const gone = next(FROM[GENERATING]!, { type: 'dispose' });
  assert.deepStrictEqual([gone.status, gone.run, gone.disposed, gone.request], ['idle', null, true, R1]);
  for (const { event } of TABLE) assert.strictEqual(next(gone, event), gone);
});

test('a run id is never reused: a stale id stays stale after later runs', () => {
  const second = next(next(FROM[GENERATING]!, { type: 'cancel' }), { type: 'start', mode: 'observe', request: R1 });
  const third = next(next(second, { type: 'cancel' }), { type: 'start', mode: 'observe', request: R1 });
  assert.deepStrictEqual([second.run, third.run], [2, 3]);
  assert.strictEqual(next(third, { type: 'ready', run: 2, kept: false }), third);
});

const RETRY: readonly { name: string; life: Life; want: ReturnType<typeof retryMode> }[] = [
  { name: 'a lost connection reattaches', life: life({ status: 'failed', error: NETWORK, request: R1 }), want: 'observe' },
  { name: 'a failed draft save reattaches', life: life({ status: 'failed', error: STORAGE, request: R1 }), want: 'observe' },
  { name: 'a failed preparation is prepared again', life: life({ status: 'failed', error: { kind: 'preparation', message: 'x' }, request: R1 }), want: 'prepare' },
  { name: 'a failed preparation reattaches when the API cannot prepare', life: life({ status: 'failed', error: { kind: 'preparation', message: 'x' }, request: R1, preparable: false }), want: null },
  { name: 'a safety failure starts afresh', life: life({ status: 'failed', error: { kind: 'safety', message: 'x' }, request: R1 }), want: null },
  { name: 'no request is held', life: life({ status: 'failed', error: NETWORK }), want: null },
  { name: 'the API has no observe', life: life({ status: 'failed', error: NETWORK, request: R1, observable: false }), want: null },
  { name: 'the status is not failed', life: life({ status: 'ready', error: NETWORK, request: R1 }), want: null },
];

for (const { name, life: from, want } of RETRY) {
  test(`retry mode: ${name}`, () => assert.equal(retryMode(from), want));
}

test('a builder may create only when idle of runs, saves and disposal', () => {
  assert.deepStrictEqual(Object.entries(FROM).map(([name, from]) => [name, canCreate(from)]), [
    [IDLE, true], [READY_FRESH, true], [READY_KEPT, true], [FAILED, true],
    [GENERATING, false], [OVER_PREVIEW, false], [SAVING, false], [DISPOSED, false],
  ]);
});

test('the start state is idle with nothing held', () => {
  assert.deepStrictEqual(initial({ observable: false, preparable: false }), {
    status: 'idle', stage: 'creating', error: null, saving: false, preview: 'none', run: null, runs: 0, request: null,
    observable: false, preparable: false, disposed: false,
  });
});
