import { RAIN_AUDIO as AUDIO } from "./rain-audio-data.ts";

function channel(frames: number, seed: number): Float32Array {
  const samples = new Float32Array(frames);
  let low = 0;
  let mid = 0;
  const phase = seed % 2 * AUDIO.phase;
  for (let index = 0; index < frames; index += 1) {
    seed = (Math.imul(seed, AUDIO.multiplier) + AUDIO.increment) >>> 0;
    const white = seed / AUDIO.modulus * 2 - 1;
    low += (white - low) * AUDIO.lowFollow;
    mid += (white - mid) * AUDIO.midFollow;
    const swell = 1 + AUDIO.sway * Math.sin(index / AUDIO.rate / AUDIO.swellSeconds + phase);
    samples[index] = (low * AUDIO.lowGain + mid * AUDIO.midGain + (white - mid) * AUDIO.highGain) * AUDIO.outputGain * swell;
  }
  return samples;
}

export function rainWave(): Uint8Array {
  const frames = AUDIO.rate * AUDIO.seconds;
  const overlap = Math.round(AUDIO.rate * AUDIO.overlapSeconds);
  const payload = frames * AUDIO.channels * AUDIO.sampleBytes;
  const bytes = new Uint8Array(AUDIO.headerBytes + payload);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); text(8, "WAVEfmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, AUDIO.channels, true);
  view.setUint32(24, AUDIO.rate, true); view.setUint32(28, AUDIO.rate * AUDIO.channels * AUDIO.sampleBytes, true);
  view.setUint16(32, AUDIO.channels * AUDIO.sampleBytes, true); view.setUint16(34, AUDIO.sampleBytes * 8, true);
  text(36, "data"); view.setUint32(40, payload, true);
  for (let side = 0; side < AUDIO.channels; side += 1) {
    const samples = channel(frames + overlap, AUDIO.seed + side);
    for (let index = 0; index < frames; index += 1) {
      const blend = Math.min(1, index / overlap);
      const value = index < overlap ? samples[frames + index]! * (1 - blend) + samples[index]! * blend : samples[index]!;
      view.setInt16(AUDIO.headerBytes + (index * AUDIO.channels + side) * AUDIO.sampleBytes, Math.round(value * AUDIO.pcmMax), true);
    }
  }
  return bytes;
}
