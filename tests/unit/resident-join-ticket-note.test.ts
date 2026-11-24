import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAction } from '../../src/residents/create-action.ts';
import { FIRST_RESIDENT_COPY } from '../../src/residents/first-resident-copy.ts';
import { RESIDENT_COPY } from '../../src/residents/copy.ts';

test('kept-record join retry has no price, whether or not there are tickets left', () => {
  for (const tickets of [0, 2]) {
    const message = 'Your resident is saved. No new ticket is needed.';
    const retry = createAction({ status: 'failed', error: { kind: 'loft-pending', message }, tickets, resumable: false });
    assert.equal(retry.label, FIRST_RESIDENT_COPY.retryJoin);
    assert.equal(retry.failure, message);
    assert.equal(retry.ticketNote, '');
    assert.equal(retry.outOfTickets, false);
    assert.equal(retry.confirmBeforeCreate, false);
  }
  assert.equal(createAction({ status: 'ready', error: null, tickets: 2 }).ticketNote, RESIDENT_COPY.ticketNote(2));
});
