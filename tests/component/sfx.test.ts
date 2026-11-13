import test from "node:test";
import assert from "node:assert/strict";
import { Sfx, type SfxContext } from "../../src/sfx.ts";
import { SFX } from "../../src/sfx-data.ts";

type Voice = { buffer: unknown; playbackRate: { value: number }; detune: { value: number }; startAt: number | null; gain: { value: number } };

/** A context that records every buffer voice the engine schedules; no sound is made. */
function fakeContext(state = "running") {
  const voices: Voice[] = [];
  const gains: { gain: { value: number } }[] = [];
  const decoded: string[] = [];
  const log = { resumed: 0 };
  const node = () => ({ connect: (n: unknown) => n });
  const context = {
    currentTime: 10, destination: node(), state,
    resume() { log.resumed += 1; return Promise.resolve(); },
    decodeAudioData(bytes: ArrayBuffer) { const tag = new TextDecoder().decode(bytes); decoded.push(tag); return Promise.resolve(`buffer:${tag}`); },
    createBufferSource() {
      const v: Voice & { connect(n: unknown): unknown; start(t: number): void } = { ...node(), buffer: null, playbackRate: { value: 1 }, detune: { value: 0 }, startAt: null, gain: { value: 0 }, start(t) { v.startAt = t; } };
      voices.push(v); return v;
    },
    createGain() { const g = { ...node(), gain: { value: 0 } }; gains.push(g); return g; },
  };
  return { context: context as unknown as SfxContext, voices, gains, decoded, log };
}

/** Voices get their gain from the gain node wired after them: the nth voice uses the nth non-master gain. */
const voiceGain = (fake: ReturnType<typeof fakeContext>, n: number) => fake.gains[n + 1]!.gain.value;
const flush = () => new Promise<void>(r => setImmediate(r));

function rig(over: { audible?: boolean; hidden?: boolean; unlock?: boolean; random?: () => number } = {}) {
  const fake = fakeContext();
  const state = { audible: over.audible ?? true, hidden: over.hidden ?? false, created: 0, fetched: [] as string[] };
  const sfx = new Sfx({
    create: () => { state.created += 1; return fake.context; },
    audible: () => state.audible, hidden: () => state.hidden,
    fetchBytes: (url) => { state.fetched.push(url); return Promise.resolve(new TextEncoder().encode(url).buffer as ArrayBuffer); },
    random: over.random ?? (() => 0.5),
  });
  if (over.unlock !== false) sfx.unlock();
  return { sfx, fake, state };
}
/** A rig whose clips are already decoded. */
async function ready(over: Parameters<typeof rig>[0] = {}) { const r = rig(over); r.sfx.plop(1); await flush(); r.fake.voices.length = 0; r.fake.gains.length = 1; return r; }
const semis = (v: Voice) => 12 * Math.log2(v.playbackRate.value);

test("a plop before the clip has decoded plays nothing, and does not throw", () => {
  const { sfx, fake } = rig();
  assert.doesNotThrow(() => { sfx.plop(1); sfx.topple(3); });
  assert.equal(fake.voices.length, 0);
});

test("the clips are fetched and decoded once after the unlock, then plays start", async () => {
  const { sfx, fake, state } = rig();
  sfx.plop(1); sfx.plop(2); sfx.topple(2);
  await flush();
  assert.deepEqual(state.fetched.sort(), [SFX.landFile, SFX.toppleFile].sort());
  assert.equal(fake.decoded.length, 2);
  sfx.plop(1);
  assert.equal(fake.voices.length, 1);
  assert.equal(fake.voices[0]!.buffer, `buffer:${SFX.landFile}`);
});

test("a failed fetch leaves the engine silent without throwing", async () => {
  const fake = fakeContext();
  const sfx = new Sfx({ create: () => fake.context, audible: () => true, hidden: () => false, fetchBytes: () => Promise.reject(new Error("offline")), random: () => 0.5 });
  sfx.unlock(); sfx.plop(1);
  await flush();
  assert.doesNotThrow(() => sfx.plop(1));
  assert.equal(fake.voices.length, 0);
});

test("each pile level plays at the pentatonic step for that level", async () => {
  const { sfx, fake } = await ready({ random: () => 0.5 });
  for (let level = 1; level <= 6; level++) sfx.plop(level);
  assert.deepEqual(fake.voices.map(v => Math.round(semis(v))), [0, 2, 4, 7, 9, 12]);
});

test("a level past the top of the scale keeps the top step", async () => {
  const { sfx, fake } = await ready();
  sfx.plop(6); sfx.plop(99);
  assert.equal(fake.voices[1]!.playbackRate.value, fake.voices[0]!.playbackRate.value);
});

test("a topple plays one voice per resident, staggered, falling in pitch, on the topple clip", async () => {
  const { sfx, fake } = await ready();
  sfx.topple(4);
  assert.equal(fake.voices.length, 4);
  const rates = fake.voices.map(v => v.playbackRate.value), starts = fake.voices.map(v => v.startAt!);
  for (let i = 1; i < 4; i++) {
    assert.ok(rates[i]! < rates[i - 1]!);
    assert.ok(Math.abs(starts[i]! - starts[i - 1]! - SFX.toppleGapS) < 1e-9);
  }
  assert.ok(starts[0]! >= 10);
  assert.ok(fake.voices.every(v => v.buffer === `buffer:${SFX.toppleFile}`));
});

test("a topple of nobody plays nothing, and a full pile of six plays six", async () => {
  const { sfx, fake } = await ready();
  sfx.topple(0);
  assert.equal(fake.voices.length, 0);
  sfx.topple(6);
  assert.equal(fake.voices.length, 6);
});

test("repeats of one level differ by a small random detune within the named bound", async () => {
  const lo = await ready({ random: () => 0 }), hi = await ready({ random: () => 1 });
  lo.sfx.plop(3); hi.sfx.plop(3);
  assert.equal(lo.fake.voices[0]!.detune.value, -SFX.detuneCents);
  assert.equal(hi.fake.voices[0]!.detune.value, SFX.detuneCents);
  assert.ok(SFX.detuneCents > 0 && SFX.detuneCents < 50);
});

test("quiet mode scales every voice's gain by the quiet factor", async () => {
  const loud = await ready(), quiet = await ready();
  loud.sfx.plop(3); quiet.sfx.plop(3, true);
  assert.ok(voiceGain(quiet.fake, 0) > 0);
  assert.ok(Math.abs(voiceGain(quiet.fake, 0) / voiceGain(loud.fake, 0) - SFX.quietFactor) < 1e-9);
  assert.ok(SFX.quietFactor < 0.5);
  const topple = await ready(); topple.sfx.topple(3, true);
  assert.ok(topple.fake.voices.every((_, i) => voiceGain(topple.fake, i) <= voiceGain(loud.fake, 0) * SFX.quietFactor + 1e-9));
});

test("a falling topple voice never exceeds a plop's loudness", async () => {
  const plop = await ready(), topple = await ready();
  plop.sfx.plop(1); topple.sfx.topple(5);
  assert.ok(topple.fake.voices.every((_, i) => voiceGain(topple.fake, i) <= voiceGain(plop.fake, 0) + 1e-9));
});

test("nothing is fetched, created or played before the unlock gesture", async () => {
  const { sfx, fake, state } = rig({ unlock: false });
  sfx.plop(2); sfx.topple(3);
  await flush();
  assert.equal(fake.voices.length, 0);
  assert.equal(state.created, 0);
  assert.equal(state.fetched.length, 0);
});

test("nothing plays while the room's sound is muted, and sound returns when it is not", async () => {
  const { sfx, fake, state } = await ready();
  state.audible = false;
  sfx.plop(2); sfx.topple(3);
  assert.equal(fake.voices.length, 0);
  state.audible = true;
  sfx.plop(2);
  assert.equal(fake.voices.length, 1);
});

test("nothing plays in a hidden tab and no context is made", async () => {
  const { sfx, fake, state } = rig({ hidden: true });
  sfx.plop(2); sfx.topple(3);
  await flush();
  assert.equal(fake.voices.length, 0);
  assert.equal(state.created, 0);
});

test("the clips load at the unlock, so the very first stack already sounds", async () => {
  const { sfx, fake, state } = rig();
  await flush();
  assert.equal(state.created, 1);
  assert.equal(fake.decoded.length, 2);
  sfx.plop(1);
  assert.equal(fake.voices.length, 1);
});

test("the context is made once and reused", () => {
  const { sfx, state } = rig();
  sfx.plop(1); sfx.plop(2); sfx.topple(2);
  assert.equal(state.created, 1);
});

test("a tab hidden at the unlock makes its context on the first sound once visible", async () => {
  const { sfx, fake, state } = rig({ hidden: true });
  assert.equal(state.created, 0);
  state.hidden = false;
  sfx.plop(1);
  assert.equal(state.created, 1);
  await flush();
  sfx.plop(1);
  assert.equal(fake.voices.length, 1);
});

test("a suspended context is resumed", () => {
  const fake = fakeContext("suspended");
  const sfx = new Sfx({ create: () => fake.context, audible: () => true, hidden: () => false, fetchBytes: () => new Promise(() => {}), random: () => 0.5 });
  sfx.unlock(); sfx.plop(1);
  assert.equal(fake.log.resumed, 1);
});

test("a browser with no audio context stays silent without throwing", () => {
  const sfx = new Sfx({ create: () => null, audible: () => true, hidden: () => false, fetchBytes: () => new Promise(() => {}), random: () => 0.5 });
  sfx.unlock();
  assert.doesNotThrow(() => { sfx.plop(1); sfx.topple(2); });
});
