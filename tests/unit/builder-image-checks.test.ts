import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectAlpha } from "../../src/builder/alpha.ts";
import { encodeRgbaPng, readPngInfo } from "../../src/builder/png.ts";

const SIZE = 64;

function canvas(fill: (x: number, y: number) => [number, number, number, number]): Uint8Array {
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) rgba.set(fill(x, y), (y * SIZE + x) * 4);
  }
  return rgba;
}

const inside = (x: number, y: number, from: number, to: number) => x >= from && x < to && y >= from && y < to;
const centredBlob = canvas((x, y) => (inside(x, y, 16, 48) ? [200, 120, 90, 255] : [0, 0, 0, 0]));

test("an encoded RGBA PNG reads back with its size and an alpha channel", async () => {
  const png = await encodeRgbaPng(SIZE, SIZE, centredBlob);
  assert.deepEqual(readPngInfo(png), { width: SIZE, height: SIZE, hasAlphaChannel: true });
});

test("bytes that are not a PNG are reported as unreadable, not guessed at", () => {
  assert.equal(readPngInfo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])), null);
  assert.equal(readPngInfo(new Uint8Array(4)), null);
});

test("a subject on real transparency with clear margins passes", () => {
  const report = inspectAlpha(centredBlob, SIZE, SIZE);
  assert.equal(report.verdict, "transparent");
  assert.equal(report.cornersTransparent, true);
  assert.equal(report.marginOk, true);
  assert.deepEqual(report.bounds, { left: 16, top: 16, right: 47, bottom: 47 });
  assert.equal(report.fillHeightShare, 0.5);
});

test("an opaque image is never labelled transparent", () => {
  const report = inspectAlpha(canvas(() => [250, 240, 230, 255]), SIZE, SIZE);
  assert.equal(report.verdict, "opaque");
  assert.equal(report.cornersTransparent, false);
});

test("a baked-in grey checkerboard is flagged as fake transparency", () => {
  const checker = canvas((x, y) => ((Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? [255, 255, 255, 255] : [204, 204, 204, 255]));
  assert.equal(inspectAlpha(checker, SIZE, SIZE).verdict, "checkerboard-suspect");
});

test("a subject touching the canvas edge fails the margin check", () => {
  const cropped = canvas((x, y) => (inside(x, y, 0, 40) ? [200, 120, 90, 255] : [0, 0, 0, 0]));
  assert.equal(inspectAlpha(cropped, SIZE, SIZE).marginOk, false);
});

test('a PNG header without its image data is not accepted as an image', async () => {
  const png = await encodeRgbaPng(SIZE, SIZE, centredBlob);
  assert.equal(readPngInfo(png.subarray(0, 33)), null);
  const broken = png.slice();
  broken[20] = 1;
  assert.equal(readPngInfo(broken), null);
});

test('an empty transparent image is distinguished from a complete subject', () => {
  const report = inspectAlpha(new Uint8Array(SIZE * SIZE * 4), SIZE, SIZE);
  assert.equal(report.verdict, 'empty');
  assert.equal(report.marginOk, false);
});
