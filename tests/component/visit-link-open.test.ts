import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadLinkGuest } from '../../src/visits/link-open.ts';
import { guestController, type GuestStore } from '../../src/visits/guest-controller.ts';
import { LinkError, type LinkFetch } from '../../src/visits/link-client.ts';
import type { Guest, Invitation } from '../../src/visits/invite-contract.ts';
import { next } from '../../src/visits/visit-model.ts';
import { encodeRgbaPng } from '../../src/builder/png.ts';

// Component layer: opening a link end to end with a fake fetch and the real guest controller over an in-memory store.
const CODE = 'AAAAAAAAAAAAAAAAAAAAAA';
const invitation: Invitation = { kind: 'loftio-visit', version: 1, name: 'Puff', png: Buffer.from(await encodeRgbaPng(1, 1, new Uint8Array([120, 80, 40, 255]))).toString('base64') };
const canonical = async (item: Invitation): Promise<Guest> => ({ ...item, id: 'guest:' + item.name });
const serving: LinkFetch = async () => ({ ok: true, json: async () => invitation });

function fixture() {
  const records = new Map<string, Guest>(), visible = new Set<string>();
  const store: GuestStore = {
    list: async () => [...records.values()],
    add: async guest => { if (records.has(guest.id)) return false; records.set(guest.id, guest); return true; },
    remove: async id => { records.delete(id); },
  };
  const scene = { prepare: async (guest: Guest) => ({ attach: () => { visible.add(guest.id); }, dispose: () => {} }), remove: (id: string) => { visible.delete(id); } };
  return { records, visible, controller: guestController(store, scene) };
}

// "Nothing is saved before Welcome" is tested where the click happens: visit-link-welcome.test.ts.
test('opening a link yields a canonical guest for preview', async () => {
  const guest = await loadLinkGuest(CODE, serving, canonical);
  assert.deepEqual(guest, { ...invitation, id: 'guest:Puff' });
});

test('Welcome after preview saves the guest through the existing controller', async () => {
  const f = fixture();
  const guest = await loadLinkGuest(CODE, serving, canonical);
  assert.equal(await f.controller.welcome(guest), true);
  assert.deepEqual([...f.records.keys()], ['guest:Puff']); assert.deepEqual([...f.visible], ['guest:Puff']);
});

test('opening the same link twice and welcoming twice is idempotent by content id', async () => {
  const f = fixture();
  assert.equal(await f.controller.welcome(await loadLinkGuest(CODE, serving, canonical)), true);
  assert.equal(await f.controller.welcome(await loadLinkGuest(CODE, serving, canonical)), false);
  assert.equal(f.records.size, 1);
});

for (const [label, fetchFn, kind] of [
  ['404', (async () => ({ ok: false, json: async () => ({ error: 'not-found' }) })) as LinkFetch, 'not-found'],
  ['offline', (async () => { throw new TypeError('Failed to fetch'); }) as LinkFetch, 'offline'],
  ['429', (async () => ({ ok: false, json: async () => ({ error: 'rate-limited' }) })) as LinkFetch, 'rate-limited'],
] as const) test(`a ${label} open fails with a visible ${kind} message and no guest`, async () => {
  const f = fixture();
  await assert.rejects(loadLinkGuest(CODE, fetchFn, canonical), (error: unknown) => error instanceof LinkError && error.kind === kind && error.message.length > 0);
  assert.equal(f.records.size, 0);
});

test('an invitation that fails canonical validation is refused before preview', async () => {
  const refuse = async () => { throw Error('This is not a supported Loftio invitation.'); };
  await assert.rejects(loadLinkGuest(CODE, serving, refuse), /not a supported Loftio invitation/);
});

test('a link open uses the existing lifecycle: loading, then preview, and Welcome only from preview', () => {
  let state = next('closed', 'open');
  assert.equal(state, 'loading');
  assert.equal(next(state, 'welcome'), 'loading');
  state = next(state, 'loaded'); assert.equal(state, 'preview');
  assert.equal(next(next(state, 'welcome'), 'saved'), 'welcomed');
  assert.equal(next(next('closed', 'open'), 'fail'), 'error');
});
