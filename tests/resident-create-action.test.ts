import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAction } from '../src/residents/create-action.ts';
import { RESIDENT_COPY } from '../src/residents/copy.ts';

const failed = (kind: string, message = `${kind} message`) => ({ status: 'failed' as const, error: { kind, message } });

test('a failed Create names the one action its button takes, per failure kind', () => {
  assert.equal(createAction(failed('network')).label, 'Reconnect');
  assert.equal(createAction(failed('preparation')).label, 'Retry preparation');
  for (const kind of ['invalid', 'storage', 'corrupt', 'rejected']) assert.equal(createAction(failed(kind)).label, RESIDENT_COPY.create, kind);
  assert.equal(createAction({ status: 'idle', error: null }).label, RESIDENT_COPY.create);
  assert.equal(createAction({ status: 'generating', error: null }).label, RESIDENT_COPY.create);
});

test('a builder that cannot resume never offers Reconnect: the click is a new paid build, so it asks first', () => {
  for (const kind of ['network', 'preparation']) {
    const action = createAction({ ...failed(kind), tickets: 2, resumable: false });
    assert.equal(action.label, RESIDENT_COPY.create, kind);
    assert.equal(action.confirmBeforeCreate, true, kind);
    assert.equal(createAction({ ...failed(kind), tickets: 0, resumable: false }).outOfTickets, true, kind);
  }
});

test('Create button labels are single actions read from the keyed copy, never slash pairs', () => {
  const labels = new Set(['network', 'preparation', 'storage'].map(kind => createAction(failed(kind)).label));
  for (const label of labels) {
    assert.ok(!label.includes('/'), label);
    assert.ok(Object.values(RESIDENT_COPY).includes(label), `${label} must come from RESIDENT_COPY`);
  }
});

test('the failure message travels with the Create button, so it sits beside the action that answers it', () => {
  assert.equal(createAction(failed('network', 'Lost the connection to the builder.')).failure, 'Lost the connection to the builder.');
  assert.equal(createAction(failed('preparation', 'Could not prepare the image.')).failure, 'Could not prepare the image.');
  // A save failure leaves status at ready but still belongs next to the Create controls.
  assert.equal(createAction({ status: 'ready', error: { kind: 'storage', message: 'Could not save.' } }).failure, 'Could not save.');
  assert.equal(createAction({ status: 'generating', error: null }).failure, '');
});

test('with tickets left, the small print says what Bring to life costs and how many remain', () => {
  assert.equal(createAction({ status: 'idle', error: null, tickets: 2 }).ticketNote, 'Uses 1 build ticket · 2 left');
  assert.equal(createAction({ status: 'ready', error: null, tickets: 1 }).ticketNote, 'Uses 1 build ticket · 1 left');
  assert.equal(createAction({ status: 'idle', error: null, tickets: 1 }).outOfTickets, false);
  // The standalone harness has no ticket store: no note, no panel.
  assert.equal(createAction({ status: 'idle', error: null, tickets: null }).ticketNote, '');
  assert.equal(createAction({ status: 'idle', error: null, tickets: null }).outOfTickets, false);
});

test('with no tickets the out-of-tickets panel replaces the button, and its message is not repeated as a failure', () => {
  for (const state of [{ status: 'idle' as const, error: null }, { status: 'ready' as const, error: null }, failed('tickets')]) {
    const action = createAction({ ...state, tickets: 0 });
    assert.equal(action.outOfTickets, true, state.status);
    assert.equal(action.failure, '', state.status);
    assert.equal(action.ticketNote, '', state.status);
  }
});

test('a stale out-of-tickets failure disappears once a ticket is added', () => {
  assert.equal(createAction({ ...failed('tickets'), tickets: 1 }).failure, '');
  assert.equal(createAction({ ...failed('tickets'), tickets: 1 }).outOfTickets, false);
});

test('the last ticket being made, or awaiting Reconnect, never shows the out-of-tickets panel', () => {
  assert.equal(createAction({ status: 'generating', error: null, tickets: 0 }).outOfTickets, false);
  // Reconnect and Retry preparation collect an image already paid for, so they need no ticket.
  for (const kind of ['network', 'preparation']) {
    const action = createAction({ ...failed(kind), tickets: 0 });
    assert.equal(action.outOfTickets, false, kind);
    assert.equal(action.failure, `${kind} message`, kind);
  }
});

test('Bring to life asks first whenever it would spend a ticket', () => {
  for (const status of ['idle', 'ready'] as const) assert.equal(createAction({ status, error: null, tickets: 1 }).confirmBeforeCreate, true, status);
  // A failure that starts afresh (a refusal, a corrupt image) spends a new ticket too.
  assert.equal(createAction({ ...failed('corrupt'), tickets: 2 }).confirmBeforeCreate, true);
});

test('no confirmation when nothing is spent', () => {
  // Reconnect and Retry preparation collect an image already paid for.
  for (const kind of ['network', 'preparation']) assert.equal(createAction({ ...failed(kind), tickets: 1 }).confirmBeforeCreate, false, kind);
  assert.equal(createAction({ status: 'idle', error: null, tickets: 0 }).confirmBeforeCreate, false); // the panel shows instead
  assert.equal(createAction({ status: 'idle', error: null, tickets: null }).confirmBeforeCreate, false); // no ticket store
  assert.equal(createAction({ status: 'generating', error: null, tickets: 1 }).confirmBeforeCreate, false);
});

test('the confirmation names the cost, what is left, and that a started resident cannot be stopped', () => {
  assert.equal(RESIDENT_COPY.confirmBuild(1), 'This uses your last build ticket. Once it starts, it can’t be stopped.');
  assert.equal(RESIDENT_COPY.confirmBuild(3), 'This uses 1 of your 3 build tickets. Once it starts, it can’t be stopped.');
  for (const label of [RESIDENT_COPY.confirmYes, RESIDENT_COPY.confirmNo]) assert.ok(label && !label.includes('/'), label);
});

test('there is no cancel: a started resident always finishes', () => {
  assert.ok(!Object.values(RESIDENT_COPY).some(value => typeof value === 'string' && /cancel|stop here/i.test(value)));
});

test('the drawer-top alert never repeats a builder failure, so it is announced once', () => {
  const state = failed('network', 'Lost the connection to the builder.');
  assert.equal(createAction(state).drawerAlert, '');
});
