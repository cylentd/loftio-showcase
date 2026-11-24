// The card's art URLs for a saved record come from the builder's one resolver, `imageSource` (G4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardArtFor } from '../../src/holo-card/card-art.ts';
import type { GeneratedImage } from '../../src/builder/records.ts';

const webp = (url: string): GeneratedImage => ({ schemaVersion: 2, mime: 'image/webp', url, originalUrl: url, bytes: 1, width: 1, height: 1, hasAlphaChannel: true });
const png = (base64: string): GeneratedImage => ({ mime: 'image/png', base64, width: 1, height: 1, hasAlphaChannel: true });
const ready = (image: GeneratedImage) => ({ status: 'ready' as const, image, promptVersion: 'v', createdAt: 't' });

test('a webp idle is its url and a png idle is a data url', () => {
  assert.equal(cardArtFor({ image: webp('/a/preview.webp') }).idle, '/a/preview.webp');
  assert.equal(cardArtFor({ image: png('QUJD') }).idle, 'data:image/png;base64,QUJD');
});

test('a ready expression and a ready alt are resolved', () => {
  const art = cardArtFor({ image: webp('/i.webp'), expression: ready(webp('/e.webp')), alt: { slot: ready(png('QUJD')) } });
  assert.deepEqual([art.expression, art.alt], ['/e.webp', 'data:image/png;base64,QUJD']);
});

test('a pending or failed slot gives no art', () => {
  const art = cardArtFor({ image: webp('/i.webp'), expression: { status: 'pending' }, alt: { slot: { status: 'failed', kind: 'network' } } });
  assert.deepEqual([art.expression, art.alt], [undefined, undefined]);
});
