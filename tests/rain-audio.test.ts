import assert from "node:assert/strict";
import { test } from "node:test";
import { rainWave } from "../src/rain-audio.ts";

const bytes = rainWave();
const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

test("rain is a locally generated stereo PCM WAV with a complete payload", () => {
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), "WAVE");
  assert.equal(header.getUint16(22, true), 2);
  assert.equal(header.getUint32(24, true), 22050);
  assert.equal(header.getUint32(40, true), 24 * 22050 * 4);
  assert.equal(bytes.byteLength, 44 + 24 * 22050 * 4);
});

test("rain is reproducible, audible and has stereo variation without clipping", () => {
  assert.deepEqual(rainWave(), bytes);
  let energy = 0;
  let stereo = 0;
  let peak = 0;
  for (let offset = 44; offset < bytes.byteLength; offset += 4) {
    const left = header.getInt16(offset, true);
    const right = header.getInt16(offset + 2, true);
    energy += left * left;
    stereo += Math.abs(left - right);
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
  }
  assert.ok(Math.sqrt(energy / (24 * 22050)) > 500);
  assert.ok(stereo > 100000);
  assert.ok(peak < 30000);
});
