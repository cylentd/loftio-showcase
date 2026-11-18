import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLink, fetchInvitation, LinkError, type LinkFetch } from '../../src/visits/link-client.ts';
import { LINK_ENDPOINT } from '../../src/visits/constants.ts';
import { LINK_COPY } from '../../src/visits/copy.ts';
import { encodeRgbaPng } from '../../src/builder/png.ts';

// Unit layer: the real client against a hand-made fetch. Contract: docs/architecture/VISITS.md (hosted links).
const CODE = 'AAAAAAAAAAAAAAAAAAAAAA';
const ORIGIN = 'https://loftio.example';
const invitation = { kind: 'loftio-visit' as const, version: 1 as const, name: 'Puff', png: Buffer.from(await encodeRgbaPng(1, 1, new Uint8Array([120, 80, 40, 255]))).toString('base64') };
const reply = (ok: boolean, body: unknown): LinkFetch => async () => ({ ok, json: async () => body });

test('createLink posts the invitation as JSON and returns the shareable link with its expiry', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn: LinkFetch = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ code: CODE, expiresAt: '2026-11-25T10:00:00.000Z' }) }; };
  const made = await createLink(invitation, fetchFn, ORIGIN);
  assert.equal(made.link, `${ORIGIN}/?visit=${CODE}`);
  assert.equal(made.expiresAt.toISOString(), '2026-11-25T10:00:00.000Z');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, LINK_ENDPOINT);
  assert.equal(calls[0]!.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), invitation);
});

const failures: [string, LinkFetch, string][] = [
  ['rate-limited', reply(false, { error: 'rate-limited' }), 'rate-limited'],
  ['unavailable', reply(false, { error: 'unavailable' }), 'unavailable'],
  ['too-large', reply(false, { error: 'too-large' }), 'too-large'],
  ['invalid', reply(false, { error: 'invalid' }), 'invalid'],
  ['an unreadable error body', async () => ({ ok: false, json: async () => { throw Error('html'); } }), 'unavailable'],
  ['a success with a malformed code', reply(true, { code: 'short', expiresAt: '2026-11-25T10:00:00.000Z' }), 'unavailable'],
  ['a success with a bad expiry', reply(true, { code: CODE, expiresAt: 'tomorrow' }), 'unavailable'],
  ['no network', async () => { throw new TypeError('Failed to fetch'); }, 'offline'],
];
for (const [label, fetchFn, kind] of failures) {
  test(`createLink fails as ${kind} for ${label}, with that failure's message`, async () => {
    await assert.rejects(createLink(invitation, fetchFn, ORIGIN),
      (error: unknown) => error instanceof LinkError && error.kind === kind && error.message === LINK_COPY[kind as keyof typeof LINK_COPY]);
  });
}

test('fetchInvitation requests the code and returns the validated invitation', async () => {
  const calls: string[] = [];
  const fetchFn: LinkFetch = async url => { calls.push(url); return { ok: true, json: async () => invitation }; };
  assert.deepEqual(await fetchInvitation(CODE, fetchFn), invitation);
  assert.deepEqual(calls, [`${LINK_ENDPOINT}?code=${CODE}`]);
});

test('fetchInvitation reports not-found for a 404 body, with the plain "no longer available" message', async () => {
  await assert.rejects(fetchInvitation(CODE, reply(false, { error: 'not-found' })),
    (error: unknown) => error instanceof LinkError && error.kind === 'not-found' && /no longer available/.test(error.message));
});

for (const [label, fetchFn, kind] of [
  ['offline', (async () => { throw new TypeError('Failed to fetch'); }) as LinkFetch, 'offline'],
  ['429', reply(false, { error: 'rate-limited' }), 'rate-limited'],
  ['503', reply(false, { error: 'unavailable' }), 'unavailable'],
] as const) test(`fetchInvitation ${label} fails visibly as ${kind}`, async () => {
  await assert.rejects(fetchInvitation(CODE, fetchFn), (error: unknown) => error instanceof LinkError && error.kind === kind);
});

test('fetchInvitation refuses a body that is not a valid invitation, with no partial result', async () => {
  await assert.rejects(fetchInvitation(CODE, reply(true, { ...invitation, name: '<script>' })), /not a supported Loftio invitation/);
  await assert.rejects(fetchInvitation(CODE, reply(true, { ...invitation, prompt: 'private' })), /not a supported Loftio invitation/);
});

test('fetchInvitation never sends a request for a malformed code', async () => {
  let requests = 0;
  const fetchFn: LinkFetch = async () => { requests++; return { ok: true, json: async () => invitation }; };
  await assert.rejects(fetchInvitation('../etc/passwd', fetchFn), (error: unknown) => error instanceof LinkError && error.kind === 'not-found');
  assert.equal(requests, 0);
});
