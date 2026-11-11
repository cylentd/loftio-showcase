import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { WORLD_ART, applyWorldArt } from '../src/world-art.ts';

const publicDir = new URL('../public/', import.meta.url);
const PIECE_BUDGET = 150 * 1024; // bytes per painted piece, the same ceiling as the frame: every piece loads when the room does
const PIECES = ['box-front', 'box-right', 'box-lid', 'box-seal'] as const;

for (const piece of PIECES) {
  test(`the blind box's ${piece} ships as a small WebP in public/brand`, () => {
    const art = WORLD_ART[piece];
    assert.equal(art, `brand/${piece}.webp`);
    assert.ok(existsSync(new URL(art, publicDir)), `${art} exists`);
    assert.ok(statSync(new URL(art, publicDir)).size <= PIECE_BUDGET, `${art} is ${statSync(new URL(art, publicDir)).size} bytes`);
  });

  test(`${piece} reaches the stylesheet as an absolute url`, () => {
    const values = new Map<string, string>();
    applyWorldArt({ style: { setProperty: (key: string, value: string) => values.set(key, value) } } as any, 'https://example.test/loft/index.html');
    assert.equal(values.get(`--art-${piece}`), `url("https://example.test/loft/brand/${piece}.webp")`);
  });

  test(`the carton paints ${piece} from its art token`, () => {
    const css = readFileSync(new URL('../src/residents/blind-box.css', import.meta.url), 'utf8');
    assert.ok(css.includes(`var(--art-${piece})`), `blind-box.css uses --art-${piece}`);
  });
}

test('the carton stylesheet names no image file, so a moved asset cannot break it silently', () => {
  const css = readFileSync(new URL('../src/residents/blind-box.css', import.meta.url), 'utf8');
  assert.equal(css.includes('url('), false);
});
