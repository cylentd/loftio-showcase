import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { WORLD_ART, applyWorldArt } from '../src/world-art.ts';

const publicDir = new URL('../public/', import.meta.url);
const ART_BUDGET = 150 * 1024; // bytes per painted UI piece, so the frame and basket stay a small part of a phone's first load

test('the painted frame and basket have delivery files in public/brand, each a small WebP', () => {
  for (const art of [WORLD_ART.frame, WORLD_ART.basket]) {
    const file = new URL(art, publicDir);
    assert.ok(existsSync(file), `${art} exists`);
    assert.match(art, /\.webp$/);
    assert.ok(statSync(file).size <= ART_BUDGET, `${art} is ${statSync(file).size} bytes`);
  }
});

test('every piece of world art is set as an absolute url the stylesheet can use', () => {
  const values = new Map<string, string>();
  applyWorldArt({ style: { setProperty: (key: string, value: string) => values.set(key, value) } } as any, 'https://example.test/loft/index.html');
  assert.equal(values.get('--art-frame'), 'url("https://example.test/loft/brand/frame-treehouse.webp")');
  assert.equal(values.get('--art-basket'), 'url("https://example.test/loft/brand/basket-treehouse.webp")');
  for (const leaf of ['leaf-1', 'leaf-2', 'leaf-3']) assert.ok(existsSync(new URL(WORLD_ART[leaf as keyof typeof WORLD_ART], publicDir)), leaf);
});
