import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitWithin } from '../../src/residents/thumbnail-model.ts';
import { createThumbnailer } from '../../src/residents/roster-thumbnail.ts';
import type { ThumbnailEnv, ThumbnailSource } from '../../src/residents/roster-thumbnail.ts';
import { THUMB_MIME, THUMB_QUALITY } from '../../src/residents/roster-thumbnail-constants.ts';
import { THUMB_MAX_SIDE } from '../../src/residents/roster-publish.ts';

// Unit layer: the thumbnailer is driven through its injected environment (image loader and canvas), so no browser is needed.
const MAX = 256; // the cap the model is given; the real caller passes THUMB_MAX_SIDE (checked in its own test below)

const FIT_CASES: [string, [number, number], { width: number; height: number }][] = [
  ['a wide image shrinks to the cap on its width', [1024, 512], { width: 256, height: 128 }],
  ['a tall image shrinks to the cap on its height', [512, 1024], { width: 128, height: 256 }],
  ['an image already under the cap is never enlarged', [200, 150], { width: 200, height: 150 }],
  ['an image exactly at the cap is unchanged', [256, 100], { width: 256, height: 100 }],
  ['a very thin image keeps at least one pixel on its short side', [1000, 1], { width: 256, height: 1 }],
  ['an odd ratio rounds to whole pixels', [1000, 333], { width: 256, height: 85 }],
];
for (const [name, [width, height], expected] of FIT_CASES) {
  test('fitWithin: ' + name, () => {
    assert.deepEqual(fitWithin(width, height, MAX), expected);
  });
}

const UNUSABLE: [string, number, number][] = [['a zero width', 0, 10], ['a negative height', 10, -4], ['a NaN width', NaN, 10], ['an infinite height', 10, Infinity]];
for (const [name, width, height] of UNUSABLE) {
  test('fitWithin returns null for ' + name, () => {
    assert.equal(fitWithin(width, height, MAX), null);
  });
}

const png = (id: string, base64 = 'AAAA'): ThumbnailSource => ({
  id, image: { base64, mime: 'image/png', width: 1024, height: 512, hasAlphaChannel: true },
});

/** A fake environment: every load answers `size`; every canvas records what was drawn and answers a fixed data URL. */
const fakeEnv = (size = { width: 1024, height: 512 }, context: 'ok' | 'none' = 'ok') => {
  const log = { loads: [] as string[], canvases: [] as { width: number; height: number }[], draws: [] as unknown[][], encoded: [] as unknown[][] };
  const env: ThumbnailEnv = {
    load: async (src) => { log.loads.push(src); return { source: { fake: 'image' }, ...size }; },
    canvas: (width, height) => {
      log.canvases.push({ width, height });
      return {
        getContext: () => (context === 'none' ? null : { drawImage: (...args: unknown[]) => { log.draws.push(args); } }),
        toDataURL: (...args: unknown[]) => { log.encoded.push(args); return 'data:image/webp;base64,THUMB'; },
      };
    },
  };
  return { env, log };
};

test('the thumbnailer loads the image from its data URL', async () => {
  const { env, log } = fakeEnv();
  await createThumbnailer(env, MAX)(png('a', 'QUJD'));
  assert.deepEqual(log.loads, ['data:image/png;base64,QUJD']);
});

test('the thumbnailer returns the encoded data URL with the downscaled size', async () => {
  const { env } = fakeEnv();
  assert.deepEqual(await createThumbnailer(env, MAX)(png('a')), { src: 'data:image/webp;base64,THUMB', width: 256, height: 128 });
});

test('the thumbnailer draws the loaded image over the whole downscaled canvas', async () => {
  const { env, log } = fakeEnv();
  await createThumbnailer(env, MAX)(png('a'));
  assert.deepEqual([log.canvases, log.draws], [[{ width: 256, height: 128 }], [[{ fake: 'image' }, 0, 0, 256, 128]]]);
});

test('the thumbnailer encodes with the configured type and quality', async () => {
  const { env, log } = fakeEnv();
  await createThumbnailer(env, MAX)(png('a'));
  assert.deepEqual(log.encoded, [[THUMB_MIME, THUMB_QUALITY]]);
});

test('a thumbnailer given THUMB_MAX_SIDE never returns a side above it', async () => {
  const { env } = fakeEnv({ width: 4000, height: 3000 });
  const art = await createThumbnailer(env, THUMB_MAX_SIDE)(png('a'));
  assert.equal(Math.max(art.width, art.height), THUMB_MAX_SIDE);
});

test('the thumbnailer rejects when there is no 2d canvas context', async () => {
  const { env } = fakeEnv(undefined, 'none');
  await assert.rejects(createThumbnailer(env, MAX)(png('a')), /canvas/i);
});

test('the thumbnailer rejects when the image has no usable size', async () => {
  const { env } = fakeEnv({ width: 0, height: 0 });
  await assert.rejects(createThumbnailer(env, MAX)(png('a')), /size/i);
});

test('the thumbnailer rejects when the image fails to load', async () => {
  const env: ThumbnailEnv = { ...fakeEnv().env, load: async () => { throw new Error('decode failed'); } };
  await assert.rejects(createThumbnailer(env, MAX)(png('a')), /decode failed/);
});

test('the thumbnailer rejects a value that is not a saved image', async () => {
  await assert.rejects(createThumbnailer(fakeEnv().env, MAX)('https://example.com/a.png'), /saved image/);
});

test('the thumbnailer does the work once for one saved image across repeated calls', async () => {
  const { env, log } = fakeEnv();
  const thumbnail = createThumbnailer(env, MAX);
  await thumbnail(png('a'));
  await thumbnail(png('a'));
  assert.equal(log.loads.length, 1);
});

test('the thumbnailer shares one run between two calls made before the first finishes', async () => {
  const { env, log } = fakeEnv();
  const thumbnail = createThumbnailer(env, MAX);
  await Promise.all([thumbnail(png('a')), thumbnail(png('a'))]);
  assert.equal(log.loads.length, 1);
});

test('the thumbnailer treats a different saved image as new work', async () => {
  const { env, log } = fakeEnv();
  const thumbnail = createThumbnailer(env, MAX);
  await thumbnail(png('a'));
  await thumbnail(png('b'));
  assert.equal(log.loads.length, 2);
});

test('the thumbnailer redoes the work when the same saved id carries different image bytes', async () => {
  const { env, log } = fakeEnv();
  const thumbnail = createThumbnailer(env, MAX);
  await thumbnail(png('a', 'AAAA'));
  await thumbnail(png('a', 'BBBBBB'));
  assert.equal(log.loads.length, 2);
});

test('the thumbnailer does not remember a failure: the next call tries again', async () => {
  let fail = true;
  const good = fakeEnv();
  const env: ThumbnailEnv = { ...good.env, load: async (src) => { if (fail) throw new Error('offline'); return good.env.load(src); } };
  const thumbnail = createThumbnailer(env, MAX);
  await assert.rejects(thumbnail(png('a')), /offline/);
  fail = false;
  assert.equal((await thumbnail(png('a'))).width, 256);
});
