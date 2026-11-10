import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { RAIN_SOURCE } from "../src/rain-audio-data.ts";
import { ABOUT } from "../src/copy.ts";

test("the approved natural rain source is preserved unchanged", () => {
  const recording = readFileSync(new URL("../public/audio/light-rain-soundrecorder7.mp3", import.meta.url));
  assert.equal(createHash("sha256").update(recording).digest("hex"), "e96de7229dd13c42798e8bdad265123d4e1d1377135c9c54c829fe4c7cd3ed55");
});

test("active rain has audible recording gain with headroom below clipping", () => {
  const recording = readFileSync(new URL("../public/" + RAIN_SOURCE, import.meta.url));
  assert.equal(recording.toString("ascii", 0, 4), "RIFF");
  assert.equal(recording.toString("ascii", 8, 12), "WAVE");
  let offset = 12;
  while (recording.toString("ascii", offset, offset + 4) !== "data") {
    assert.ok(offset + 8 < recording.length, "WAV must contain a data chunk");
    const size = recording.readUInt32LE(offset + 4);
    offset += 8 + size + size % 2;
  }
  const sampleBytes = recording.readUInt32LE(offset + 4);
  let energy = 0;
  let peak = 0;
  for (let sampleOffset = offset + 8; sampleOffset < offset + 8 + sampleBytes; sampleOffset += 2) {
    const sample = recording.readInt16LE(sampleOffset) / 32768;
    energy += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const meanDb = 20 * Math.log10(Math.sqrt(energy / (sampleBytes / 2)));
  const peakDb = 20 * Math.log10(peak);
  assert.ok(meanDb > -28 && meanDb < -25, `recording level was ${meanDb} dB`);
  assert.ok(peakDb > -3 && peakDb < -1, `recording peak was ${peakDb} dB`);
});

test("rain credits identify the active recording and its CC0 source", () => {
  assert.equal(ABOUT.recording, "Light Rain by soundrecorder7");
  assert.equal(ABOUT.source, "https://freesound.org/people/soundrecorder7/sounds/167034/");
  assert.equal(ABOUT.license, " (CC0).");
});
