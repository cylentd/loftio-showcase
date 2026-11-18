import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLink, LinkError, type LinkFetch } from '../../src/visits/link-client.ts';
import { TURNSTILE_HEADER } from '../../src/visits/constants.ts';
import { LINK_COPY } from '../../src/visits/copy.ts';
import { encodeRgbaPng } from '../../src/builder/png.ts';

// Unit layer: the client's create call and its human-check slug. Contract: docs/architecture/VISITS.md.
const invitation = { kind: 'loftio-visit' as const, version: 1 as const, name: 'Puff', png: Buffer.from(await encodeRgbaPng(1, 1, new Uint8Array([120, 80, 40, 255]))).toString('base64') };

test('createLink sends the token in the Turnstile header and nowhere else', async () => {
  const calls: RequestInit[] = [];
  const fetchFn: LinkFetch = async (_url, init) => { calls.push(init!); return { ok: true, json: async () => ({ code: 'AAAAAAAAAAAAAAAAAAAAAA', expiresAt: '2026-11-25T10:00:00.000Z' }) }; };
  await createLink(invitation, fetchFn, 'https://loftio.example', 'token-abc');
  assert.equal((calls[0]!.headers as Record<string, string>)[TURNSTILE_HEADER], 'token-abc');
  assert.deepEqual(JSON.parse(String(calls[0]!.body)), invitation);
});

test('a 403 human-check body is a human-check failure with its own message', async () => {
  const fetchFn: LinkFetch = async () => ({ ok: false, json: async () => ({ error: 'human-check' }) });
  await assert.rejects(createLink(invitation, fetchFn, 'https://loftio.example', 't'),
    (error: unknown) => error instanceof LinkError && error.kind === 'human-check' && error.message === LINK_COPY['human-check']);
});
