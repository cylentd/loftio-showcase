import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validImage } from '../../src/builder/storage-contract.ts';

const image = { schemaVersion: 2, mime: 'image/webp', width: 768, height: 768, hasAlphaChannel: true, bytes: 100378,
  url: '/loftio-builder-api/artifacts/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/preview.webp',
  originalUrl: '/loftio-builder-api/artifacts/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/original.png' };

test('versioned WebP metadata is accepted without a base64 PNG', () => {
  assert.equal(validImage(image), true);
});
test('artifact records reject foreign URLs, traversal and mismatched identities', () => {
  assert.equal(validImage({ ...image, url: 'https://evil.example/preview.webp' }), false);
  assert.equal(validImage({ ...image, url: '/loftio-builder-api/artifacts/../preview.webp' }), false);
  assert.equal(validImage({ ...image, originalUrl: image.originalUrl.replace('aaaaaaaa', 'bbbbbbbb') }), false);
  assert.equal(validImage({ ...image, width: 0 }), false);
});
