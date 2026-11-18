import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { linkShareActions, type LinkPorts } from '../../src/visits/link-actions.ts';
import type { LinkFetch } from '../../src/visits/link-client.ts';
import { LINK_COPY } from '../../src/visits/copy.ts';
import { encodeRgbaPng } from '../../src/builder/png.ts';

// Component layer: the owner's link markup over a hand-made dialog, a fake fetch and a stub canvas (the downsize step).
const CODE = 'AAAAAAAAAAAAAAAAAAAAAA';
const ORIGIN = 'https://loftio.example';
const png = Buffer.from(await encodeRgbaPng(1, 1, new Uint8Array([120, 80, 40, 255]))).toString('base64');
const item = { kind: 'loftio-visit' as const, version: 1 as const, name: 'Puff', png };
const globals = globalThis as Record<string, unknown>;
const saved = { Image: globals.Image, document: globals.document };
afterEach(() => { globals.Image = saved.Image; globals.document = saved.document; });

function stubCanvas() {
  globals.Image = class { src = ''; naturalWidth = 1; naturalHeight = 1; decode() { return Promise.resolve(); } };
  globals.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/png;base64,' + png }) };
}

function fakeDialog() {
  const buttons: { label: string; primary: boolean; isConnected: boolean; click(): void; remove(): void; focus(): void }[] = [];
  const shown = { link: '', note: '' }, field = { selected: false, focus() {}, select() { field.selected = true; } };
  const ui = {
    status: { textContent: '' }, link: { field },
    busy() {}, showLink(link: string, note: string) { shown.link = link; shown.note = note; },
    actions: { querySelector: () => buttons.find(button => button.isConnected) ?? null },
    button(label: string, action: () => void, primary = false) {
      const button = { label, primary, isConnected: true, click: action, remove() { button.isConnected = false; }, focus() {} };
      buttons.push(button); return button;
    },
  };
  const live = () => buttons.filter(button => button.isConnected).map(button => (button.primary ? '*' : '') + button.label);
  return { ui, shown, field, live, press: (label: string) => buttons.find(button => button.isConnected && button.label === label)!.click() };
}

const ports = (fetchFn: LinkFetch, writeText?: (text: string) => Promise<void>): LinkPorts =>
  ({ fetch: fetchFn, origin: ORIGIN, clipboard: writeText ? { writeText } : undefined, share: {}, getToken: async () => 'token' });
const created: LinkFetch = async () => ({ ok: true, json: async () => ({ code: CODE, expiresAt: '2026-11-25T10:00:00.000Z' }) });
const settle = () => new Promise(resolve => setImmediate(resolve)); // one macrotask lets the click handler's promises finish

test('a ready link fills the link field with the privacy note, and Copy link replaces Create link as the primary', async () => {
  stubCanvas(); const d = fakeDialog();
  linkShareActions(d.ui as never, item, ports(created), () => true);
  d.press(LINK_COPY.create); await settle();
  assert.equal(d.shown.link, `${ORIGIN}/?visit=${CODE}`);
  assert.match(d.shown.note, /^Anyone with the link can see Puff for \d+ hours?, until .+\./);
  assert.deepEqual(d.live(), ['*' + LINK_COPY.copy]);
  assert.equal(d.ui.status.textContent, LINK_COPY.ready);
});

test('without a clipboard, Copy link selects the link in its field and says so, never "Copied"', async () => {
  stubCanvas(); const d = fakeDialog();
  linkShareActions(d.ui as never, item, ports(created), () => true);
  d.press(LINK_COPY.create); await settle();
  d.press(LINK_COPY.copy); await settle();
  assert.equal(d.ui.status.textContent, LINK_COPY.copyUnavailable);
  assert.equal(d.field.selected, true);
});

test('a refused create keeps Create link for a retry and shows no link', async () => {
  stubCanvas(); const d = fakeDialog();
  linkShareActions(d.ui as never, item, ports(async () => ({ ok: false, json: async () => ({ error: 'rate-limited' }) })), () => true);
  d.press(LINK_COPY.create); await settle();
  assert.equal(d.ui.status.textContent, LINK_COPY['rate-limited']);
  assert.deepEqual(d.live(), ['*' + LINK_COPY.create]);
  assert.equal(d.shown.link, '');
});
