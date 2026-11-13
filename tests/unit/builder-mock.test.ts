import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mockApi } from '../../src/builder/mock-api.ts';
import { readPngInfo } from '../../src/builder/png.ts';
import type { GeneratedImage } from '../../src/builder/records.ts';

// The mock adapter returns the PNG variant of the image union, which carries base64.
type PngImage = Extract<GeneratedImage, { mime: 'image/png' }>;

const selections = { creature: 'moth', personality: 'bookworm', signatureDetail: 'reading-glasses', palette: null };

test('the free mock adapter returns one honest placeholder and fresh interpretations', async () => {
  let generationId = 0;
  const api = mockApi({
    rng: () => 0, now: () => new Date('2026-11-05T12:00:00Z'),
    newId: () => 'mock-generation-' + ++generationId,
  });
  const first = await api.generate({ requestId: 'mock-one', selections });
  const second = await api.generate({ requestId: 'mock-two', selections });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) throw new Error('mock failed');
  assert.equal(first.generation.providerId, 'mock');
  assert.equal(first.generation.modelId, 'geometric-placeholder-v1');
  assert.equal(first.generation.id, 'mock-generation-1');
  assert.equal(second.generation.id, 'mock-generation-2');
  assert.equal(first.generation.createdAt, '2026-11-05T12:00:00.000Z');
  assert.deepEqual(readPngInfo(Uint8Array.from(atob((first.image as PngImage).base64), char => char.charCodeAt(0))), {
    width: 128, height: 128, hasAlphaChannel: true,
  });
  assert.notEqual((first.image as PngImage).base64, (second.image as PngImage).base64);
  assert.deepEqual(second.usage, { used: 2, cap: 20 });
});
