import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guestController, type GuestStore } from '../../src/visits/guest-controller.ts';
import type { Guest } from '../../src/visits/invite-contract.ts';

const guest: Guest = { kind: 'loftio-visit', version: 1, id: 'guest:one', name: 'Puff', png: 'canonical' };
function fixture(fail = false) {
  const records = new Map<string, Guest>(), visible = new Set<string>();
  const store: GuestStore = {
    list: async () => [...records.values()],
    add: async item => { if (fail) throw Error('quota'); if (records.has(item.id)) return false; records.set(item.id, item); return true; },
    remove: async id => { if (fail) throw Error('quota'); records.delete(id); },
  };
  const scene = { prepare: async (item: Guest) => ({ attach: () => { visible.add(item.id); }, dispose: () => {} }), remove: (id: string) => { visible.delete(id); } };
  return { records, visible, controller: guestController(store, scene), store, scene };
}
test('construction and preview data do not persist; Welcome adds once; removal is guest-only', async () => {
  const f = fixture(); assert.equal(f.records.size, 0); assert.equal(f.visible.size, 0);
  assert.equal(await f.controller.welcome(guest), true);
  assert.equal(await f.controller.welcome(guest), false);
  assert.deepEqual([...f.records.values()], [guest]); assert.deepEqual([...f.visible], ['guest:one']);
  await f.controller.remove(guest.id);
  assert.equal(f.records.size, 0); assert.equal(f.visible.size, 0);
});
test('reload restores a saved visible guest without writing ownership', async () => {
  const f = fixture(); f.records.set(guest.id, guest);
  await f.controller.restore(); assert.deepEqual([...f.visible], [guest.id]); assert.equal(f.records.size, 1);
});
test('quota failure never reports Welcome success or adds a sprite', async () => {
  const f = fixture(true);
  await assert.rejects(f.controller.welcome(guest), /quota/);
  assert.equal(f.records.size, 0); assert.equal(f.visible.size, 0);
});
test('failed removal leaves the visible guest and saved record intact', async () => {
  const f = fixture(true); f.records.set(guest.id, guest); f.visible.add(guest.id);
  await assert.rejects(f.controller.remove(guest.id), /quota/);
  assert.equal(f.records.size, 1); assert.equal(f.visible.size, 1);
});
test('failed scene preparation never writes a guest', async () => {
  const f = fixture(); f.scene.prepare = async () => { throw Error('decode'); };
  await assert.rejects(f.controller.welcome(guest), /decode/); assert.equal(f.records.size, 0);
});
test('one unreadable guest stays removable and does not hide later arrivals', async () => {
  const f = fixture(); const other = { ...guest, id: 'guest:two' };
  f.records.set(guest.id, guest); f.records.set(other.id, other);
  const prepare = f.scene.prepare;
  f.scene.prepare = async item => { if (item.id === guest.id) throw Error('unreadable'); return prepare(item); };
  assert.equal(await f.controller.restore(), false);
  assert.deepEqual([...f.visible], [other.id]);
  assert.equal(f.records.size, 2); await f.controller.remove(guest.id);
  assert.deepEqual([...f.records.keys()], [other.id]);
});
