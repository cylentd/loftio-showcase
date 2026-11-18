import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeRgbaPng } from '../../src/builder/png.ts';
import { parseInvitation, cleanPng } from '../../src/visits/invite-contract.ts';
import { next, type VisitEvent, type VisitState } from '../../src/visits/visit-model.ts';

const png = await encodeRgbaPng(1, 1, new Uint8Array([120, 80, 40, 255]));
const invite = { kind: 'loftio-visit', version: 1, name: 'Puff', png: Buffer.from(png).toString('base64') };

test('a bounded portable invitation retains only display name and PNG', () => {
  assert.deepEqual(parseInvitation(JSON.stringify(invite)), invite);
  assert.deepEqual(cleanPng(png), png);
});

for (const [label, patch] of Object.entries({
  version: { version: 2 }, url: { png: 'https://example.org/art.png' }, markup: { name: '<img>' },
  path: { name: '../Puff' }, control: { name: 'Puff\u0000' }, long: { name: 'x'.repeat(41) },
  extra: { prompt: 'private' }, empty: { name: '' }, base64: { png: '!!!!' },
})) test(`rejects ${label}`, () => assert.throws(() => parseInvitation(JSON.stringify({ ...invite, ...patch }))));

test('rejects oversized input before JSON parsing and invalid PNG chunks before decoding', () => {
  assert.throws(() => parseInvitation(' '.repeat(2097153)));
  const corrupt = png.slice(); corrupt[20] = 255;
  assert.throws(() => cleanPng(corrupt));
  assert.throws(() => cleanPng(png.subarray(0, png.length - 1)));
  assert.throws(() => cleanPng(new Uint8Array(1048577)));
});

test('rejects valid but oversized PNG dimensions', async () => {
  const wide = await encodeRgbaPng(2049, 1, new Uint8Array(2049 * 4));
  assert.throws(() => cleanPng(wide));
});

test('strips a valid text chunk, keeping the complete PNG image bytes', () => {
  // Independently encoded PNG tEXt chunk: Comment=private prompt, with its specification CRC.
  const text = Buffer.from('AAAAFnRFWHRDb21tZW50AHByaXZhdGUgcHJvbXB0q4ARJQ==', 'base64');
  const withMetadata = new Uint8Array([...png.slice(0, 33), ...text, ...png.slice(33)]);
  assert.deepEqual(cleanPng(withMetadata), png);
  assert.equal(parseInvitation(JSON.stringify({ ...invite, png: Buffer.from(withMetadata).toString('base64') })).png, invite.png);
});

const rows: [VisitState, VisitEvent, VisitState][] = [
  ['closed', 'open', 'loading'], ['loading', 'loaded', 'preview'], ['loading', 'fail', 'error'],
  ['preview', 'welcome', 'welcoming'], ['welcoming', 'saved', 'welcomed'], ['welcoming', 'fail', 'preview'],
  ['preview', 'close', 'closed'], ['loading', 'close', 'closed'], ['closed', 'loaded', 'closed'],
  ['closed', 'welcome', 'closed'], ['welcoming', 'welcome', 'welcoming'], ['welcoming', 'close', 'welcoming'],
];
for (const [from, event, to] of rows) test(`${from} + ${event} = ${to}`, () => assert.equal(next(from, event), to));
