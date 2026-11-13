import assert from "node:assert/strict";
import { test } from "node:test";
import { songFraction, clockText, wavePath, settleAmplitude } from "../../src/song-wave-model.ts";
import { Soundtrack } from "../../src/audio-model.ts";

test("song position is a 0-1 fraction, and an unknown length reads as the start", () => {
  assert.equal(songFraction(30, 120), 0.25);
  assert.equal(songFraction(200, 120), 1);
  assert.equal(songFraction(-1, 120), 0);
  for (const duration of [NaN, Infinity, 0]) assert.equal(songFraction(10, duration), 0, String(duration));
});

test("times read as minutes and seconds", () => {
  assert.equal(clockText(83.9), "1:23");
  assert.equal(clockText(5), "0:05");
  assert.equal(clockText(NaN), "0:00");
});

function points(path: string): number[][] {
  return [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
}

test("the wave runs from the left edge to the given end, inside its amplitude", () => {
  const path = wavePath({ end: 80, middle: 6, amplitude: 3, wavelength: 16, phase: 0.3 });
  const xy = points(path);
  assert.ok(path.startsWith("M0 "), path);
  assert.equal(xy.at(-1)![0], 80);
  assert.ok(xy.every(([, y]) => y! >= 3 - 1e-9 && y! <= 9 + 1e-9));
  assert.ok(new Set(xy.map(([, y]) => y)).size > 2, "it actually waves");
});

test("zero amplitude is a straight line and a zero-length wave is just its start", () => {
  assert.ok(points(wavePath({ end: 50, middle: 6, amplitude: 0, wavelength: 16, phase: 1 })).every(([, y]) => y === 6));
  assert.deepEqual(points(wavePath({ end: 0, middle: 6, amplitude: 3, wavelength: 16, phase: 0 })), [[0, 6]]);
});

test("the wave calms and rises gradually, never overshooting", () => {
  const down = settleAmplitude(3, 0, 50);
  assert.ok(down > 0 && down < 3, String(down));
  assert.equal(settleAmplitude(3, 0, 10_000), 0);
  const up = settleAmplitude(0, 3, 50);
  assert.ok(up > 0 && up < 3, String(up));
  assert.equal(settleAmplitude(0, 3, 10_000), 3);
});

test("seeking moves the playhead inside the song and keeps play intent", async () => {
  const audio = { volume: 1, src: "a.mp3", currentTime: 0, duration: 100, async play() {}, pause() {} };
  const model = new Soundtrack(audio);
  await model.start();
  model.seek(40);
  assert.equal(audio.currentTime, 40);
  model.seek(500);
  assert.equal(audio.currentTime, 100);
  model.seek(-3);
  assert.equal(audio.currentTime, 0);
  assert.equal(model.desired, true);
});
