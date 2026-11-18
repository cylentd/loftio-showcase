import assert from 'node:assert/strict';
import { test } from 'node:test';
import { takeVisitCode, linksEnabled } from '../../src/visits/link-boot.ts';
import { fitForUpload } from '../../src/visits/link-fit.ts';
import { UPLOAD_MAX_BYTES, UPLOAD_SIDES } from '../../src/visits/constants.ts';

// Unit layer: URL reading, the build flag and the downsize ladder, all with injected ports.
const CODE = 'AAAAAAAAAAAAAAAAAAAAAA';
const place = (search: string, hash = '') => ({ pathname: '/room/', search, hash });
function history() { const urls: string[] = []; return { urls, replaceState: (_s: unknown, _t: string, url?: string | URL | null) => { urls.push(String(url)); } }; }

test('the build flag turns links on only for the value "online"', () => {
  assert.equal(linksEnabled('online'), true);
  for (const value of [undefined, '', 'offline', 'true', 'ONLINE']) assert.equal(linksEnabled(value), false);
});

test('a build that asks for hosted links gets them whatever the env flag says', () => {
  for (const flag of [undefined, '', 'offline', 'online']) assert.equal(linksEnabled(flag, true), true);
});

test('an installer that does not ask for hosted links follows the env flag alone', () => {
  assert.equal(linksEnabled('online', false), true);
  assert.equal(linksEnabled(undefined, false), false);
});

test('a valid code is read once and removed from the address bar, keeping other parameters and the hash', () => {
  const h = history();
  assert.equal(takeVisitCode(true, place(`?mode=mock&visit=${CODE}`, '#a'), h), CODE);
  assert.deepEqual(h.urls, ['/room/?mode=mock#a']);
});

test('a lone code leaves a clean path with no question mark', () => {
  const h = history();
  takeVisitCode(true, place(`?visit=${CODE}`), h);
  assert.deepEqual(h.urls, ['/room/']);
});

for (const bad of ['short', 'AAAAAAAAAAAAAAAAAAAAA!', `${CODE}A`, '', '../../x']) {
  test(`an invalid code (${JSON.stringify(bad)}) is ignored and cleaned from the URL`, () => {
    const h = history();
    assert.equal(takeVisitCode(true, place(`?visit=${encodeURIComponent(bad)}`), h), null);
    assert.deepEqual(h.urls, ['/room/']);
  });
}

test('with the flag off, a visit parameter is left alone and nothing is read', () => {
  const h = history();
  assert.equal(takeVisitCode(false, place(`?visit=${CODE}`), h), null);
  assert.deepEqual(h.urls, []);
});

test('no visit parameter: nothing read, URL untouched', () => {
  const h = history();
  assert.equal(takeVisitCode(true, place('?mode=mock'), h), null);
  assert.deepEqual(h.urls, []);
});

const bytes = (size: number) => new Uint8Array(size);
test('the ladder tries 512, then 384, then 320, and stops at the first size that fits', async () => {
  const tried: number[] = [];
  const sizes: Record<number, number> = { 512: UPLOAD_MAX_BYTES + 1, 384: UPLOAD_MAX_BYTES, 320: 10 };
  const result = await fitForUpload(async side => { tried.push(side); return bytes(sizes[side]!); });
  assert.deepEqual(tried, [512, 384]);
  assert.equal(result?.length, UPLOAD_MAX_BYTES);
});

test('the first size is used when it already fits', async () => {
  const tried: number[] = [];
  await fitForUpload(async side => { tried.push(side); return bytes(1); });
  assert.deepEqual(tried, [UPLOAD_SIDES[0]]);
});

test('when no size fits the ladder returns null after trying every size', async () => {
  const tried: number[] = [];
  const result = await fitForUpload(async side => { tried.push(side); return bytes(UPLOAD_MAX_BYTES + 1); });
  assert.equal(result, null);
  assert.deepEqual(tried, [...UPLOAD_SIDES]);
});

