import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishLink, copyLink, shareLinkNative } from '../../src/visits/link-share.ts';
import { LinkError, type LinkFetch } from '../../src/visits/link-client.ts';
import { LINK_COPY, COPY } from '../../src/visits/copy.ts';

// Component layer: the share-a-link flow with a fake fetch, clipboard and share port.
const CODE = 'AAAAAAAAAAAAAAAAAAAAAA';
const ORIGIN = 'https://loftio.example';
const prepared = { kind: 'loftio-visit' as const, version: 1 as const, name: 'Puff', png: 'c21hbGw=' };
const created: LinkFetch = async () => ({ ok: true, json: async () => ({ code: CODE, expiresAt: '2026-11-25T10:00:00.000Z' }) });

test('sharing creates a link from the prepared (downsized) invitation and offers it', async () => {
  const bodies: unknown[] = [];
  const fetchFn: LinkFetch = async (url, init) => { bodies.push(JSON.parse(String(init?.body))); return created(url, init); };
  const made = await publishLink(Promise.resolve(prepared), fetchFn, ORIGIN);
  assert.equal(made.link, `${ORIGIN}/?visit=${CODE}`);
  assert.deepEqual(bodies, [prepared]);
});

test('when no downsized size fits, no request is sent and the failure points to the file', async () => {
  let requests = 0;
  const fetchFn: LinkFetch = async url => { requests++; return created(url); };
  await assert.rejects(publishLink(Promise.resolve(null), fetchFn, ORIGIN),
    (error: unknown) => error instanceof LinkError && error.kind === 'no-fit' && error.message === LINK_COPY['no-fit']);
  assert.equal(requests, 0);
  assert.match(LINK_COPY['no-fit'], /file/i);
});

test('a preparation that throws is the same no-fit failure, never an unhandled rejection', async () => {
  await assert.rejects(publishLink(Promise.reject(Error('decode')), created, ORIGIN),
    (error: unknown) => error instanceof LinkError && error.kind === 'no-fit');
});

for (const [slug, kind] of [['rate-limited', 'rate-limited'], ['unavailable', 'unavailable']] as const) {
  test(`create ${slug} fails visibly as ${kind}; the file option's copy is unaffected`, async () => {
    const fetchFn: LinkFetch = async () => ({ ok: false, json: async () => ({ error: slug }) });
    await assert.rejects(publishLink(Promise.resolve(prepared), fetchFn, ORIGIN), (error: unknown) => error instanceof LinkError && error.kind === kind);
    assert.equal(COPY.download, 'Download invitation');
  });
}

test('copy writes the link to the clipboard', async () => {
  const written: string[] = [];
  assert.equal(await copyLink('https://x/?visit=1', { writeText: async text => { written.push(text); } }), 'copied');
  assert.deepEqual(written, ['https://x/?visit=1']);
});

test('copy falls back to "unavailable" when the clipboard is missing, and "failed" when it rejects', async () => {
  assert.equal(await copyLink('https://x', undefined), 'unavailable');
  assert.equal(await copyLink('https://x', {}), 'unavailable');
  assert.equal(await copyLink('https://x', { writeText: async () => { throw new DOMException('denied', 'NotAllowedError'); } }), 'failed');
});

test('native share sends the link and name; unsupported, cancelled and failed are distinct and never "shared"', async () => {
  const sent: ShareData[] = [];
  assert.equal(await shareLinkNative('https://x', 'Puff', { share: async data => { sent.push(data); } }), 'shared');
  assert.deepEqual(sent, [{ url: 'https://x', title: 'Puff' }]);
  assert.equal(await shareLinkNative('https://x', 'Puff', {}), 'unsupported');
  assert.equal(await shareLinkNative('https://x', 'Puff', { share: async () => { throw new DOMException('x', 'AbortError'); } }), 'cancelled');
  assert.equal(await shareLinkNative('https://x', 'Puff', { share: async () => { throw new DOMException('x', 'NotAllowedError'); } }), 'failed');
});

test('the privacy line says anyone with the link can see the resident until the date, and lives in copy', () => {
  assert.match(LINK_COPY.privacy, /Anyone with the link can see \{name\} until \{date\}/);
});
