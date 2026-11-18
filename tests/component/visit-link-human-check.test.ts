import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { TURNSTILE_HEADER } from '../../src/visits/constants.ts';
import { LINK_COPY } from '../../src/visits/copy.ts';
import { hostedLinks, linkPorts, linkShareActions, type LinkPorts } from '../../src/visits/link-actions.ts';
import type { LinkFetch } from '../../src/visits/link-client.ts';
import { encodeRgbaPng } from '../../src/builder/png.ts';

// Component layer: the owner's link flow with a fake Turnstile, a fake fetch and a hand-made dialog.
// Contract: docs/architecture/VISITS.md ("Human check").
const CODE = 'AAAAAAAAAAAAAAAAAAAAAA';
const EXPIRES = '2026-11-25T10:00:00.000Z';
const png = Buffer.from(await encodeRgbaPng(1, 1, new Uint8Array([120, 80, 40, 255]))).toString('base64');
const item = { kind: 'loftio-visit' as const, version: 1 as const, name: 'Puff', png };
const globals = globalThis as Record<string, unknown>;
const saved = { Image: globals.Image, document: globals.document, location: globals.location };
afterEach(() => { globals.Image = saved.Image; globals.document = saved.document; globals.location = saved.location; });

function stubCanvas() {
  globals.Image = class { src = ''; naturalWidth = 1; naturalHeight = 1; decode() { return Promise.resolve(); } };
  globals.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/png;base64,' + png }) };
}

function fakeDialog() {
  const buttons: { label: string; isConnected: boolean; click(): void; remove(): void; focus(): void }[] = [];
  const shown = { link: '', note: '' }, field = { focus() {}, select() {} };
  const ui = {
    status: { textContent: '' }, link: { field }, busy() {}, showLink(link: string, note: string) { shown.link = link; shown.note = note; },
    actions: { querySelector: () => buttons.find(button => button.isConnected) ?? null },
    button(label: string, action: () => void) {
      const button = { label, isConnected: true, click: action, remove() { button.isConnected = false; }, focus() {} };
      buttons.push(button); return button;
    },
  };
  const live = () => buttons.filter(button => button.isConnected).map(button => button.label);
  return { ui, shown, live, press: (label: string) => buttons.find(button => button.isConnected && button.label === label)!.click() };
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const tokens = () => { const issued: string[] = []; return { issued, getToken: async () => { issued.push(`token-${issued.length + 1}`); return issued.at(-1)!; } }; };
const ports = (fetchFn: LinkFetch, getToken?: () => Promise<string>): LinkPorts => ({ fetch: fetchFn, origin: 'https://loftio.example', share: {}, getToken });
const made: LinkFetch = async () => ({ ok: true, json: async () => ({ code: CODE, expiresAt: EXPIRES }) });
const refused = (error: string): LinkFetch => async () => ({ ok: false, json: async () => ({ error }) });

test('hosted links are offered only when a human check exists: no site key means no Create link', () => {
  assert.equal(hostedLinks(ports(made)), undefined);
  assert.equal(hostedLinks(undefined), undefined);
  const withCheck = ports(made, tokens().getToken);
  assert.equal(hostedLinks(withCheck), withCheck);
});

test('a build with no Turnstile site key makes ports with no token source; with a key it has one, and a host for the challenge', () => {
  const challenge = { className: '' };
  globals.document = { createElement: () => challenge };
  globals.location = { origin: 'https://loftio.example' };
  const bare = linkPorts(undefined), keyed = linkPorts('site-key');
  assert.equal(bare.getToken, undefined);
  assert.equal(hostedLinks(bare), undefined);
  assert.equal(typeof keyed.getToken, 'function');
  assert.equal(keyed.challenge, challenge as unknown);
  assert.equal(hostedLinks(keyed), keyed);
});

test('without a human check, linkShareActions adds no Create link', () => {
  stubCanvas(); const d = fakeDialog();
  linkShareActions(d.ui as never, item, ports(made), () => true);
  assert.deepEqual(d.live(), []);
});

test('every Create link attempt asks for a fresh token and sends exactly that token', async () => {
  stubCanvas(); const d = fakeDialog(); const t = tokens();
  const sent: (string | undefined)[] = [];
  const fetchFn: LinkFetch = async (_url, init) => {
    sent.push((init?.headers as Record<string, string>)[TURNSTILE_HEADER]);
    return sent.length === 1 ? { ok: false, json: async () => ({ error: 'rate-limited' }) } : { ok: true, json: async () => ({ code: CODE, expiresAt: EXPIRES }) };
  };
  linkShareActions(d.ui as never, item, ports(fetchFn, t.getToken), () => true);
  d.press(LINK_COPY.create); await settle();
  d.press(LINK_COPY.create); await settle();
  assert.deepEqual(t.issued, ['token-1', 'token-2']);
  assert.deepEqual(sent, ['token-1', 'token-2']);
});

test('a 429 says to try again shortly, keeps Create link, and the next attempt runs the check again', async () => {
  stubCanvas(); const d = fakeDialog(); const t = tokens();
  linkShareActions(d.ui as never, item, ports(refused('rate-limited'), t.getToken), () => true);
  d.press(LINK_COPY.create); await settle();
  assert.equal(d.ui.status.textContent, LINK_COPY['rate-limited']);
  assert.match(d.ui.status.textContent, /try again shortly/i);
  assert.deepEqual(d.live(), [LINK_COPY.create]);
  d.press(LINK_COPY.create); await settle();
  assert.equal(t.issued.length, 2);
});

test('a Turnstile failure shows the human-check message, sends nothing, and shows no link', async () => {
  stubCanvas(); const d = fakeDialog(); let requests = 0;
  const fetchFn: LinkFetch = async () => { requests++; return made('' as never); };
  linkShareActions(d.ui as never, item, ports(fetchFn, async () => { throw new Error('Turnstile script failed.'); }), () => true);
  d.press(LINK_COPY.create); await settle();
  assert.equal(d.ui.status.textContent, LINK_COPY['human-check']);
  assert.equal(requests, 0);
  assert.equal(d.shown.link, '');
  assert.deepEqual(d.live(), [LINK_COPY.create]);
});

test('a 403 human-check from the server shows the human-check message and no link', async () => {
  stubCanvas(); const d = fakeDialog();
  linkShareActions(d.ui as never, item, ports(refused('human-check'), tokens().getToken), () => true);
  d.press(LINK_COPY.create); await settle();
  assert.equal(d.ui.status.textContent, LINK_COPY['human-check']);
  assert.equal(d.shown.link, '');
});

test('both human-check messages point to the file option', () => {
  assert.match(LINK_COPY['human-check'], /file below/);
});

test('the note shows the stop time the server sent, in the device clock format, and the one hour', async () => {
  stubCanvas(); const d = fakeDialog();
  linkShareActions(d.ui as never, item, ports(made, tokens().getToken), () => true);
  d.press(LINK_COPY.create); await settle();
  assert.ok(d.shown.note.includes(new Date(EXPIRES).toLocaleTimeString(undefined, { timeStyle: 'short' })), d.shown.note);
  assert.match(d.shown.note, /for 1 hour,/);
  assert.match(LINK_COPY.ready, /works for 1 hour\./);
});

test('closing the dialog while the check runs sends nothing', async () => {
  stubCanvas(); const d = fakeDialog(); let open = true; let requests = 0;
  const fetchFn: LinkFetch = async () => { requests++; return made('' as never); };
  linkShareActions(d.ui as never, item, ports(fetchFn, async () => { open = false; return 'token'; }), () => open);
  d.press(LINK_COPY.create); await settle();
  assert.equal(requests, 0);
});
