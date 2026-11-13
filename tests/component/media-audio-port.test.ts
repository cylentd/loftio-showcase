import assert from "node:assert/strict";
import { test } from "node:test";
import { gainPort } from "../../src/media-audio-port.ts";
import { Soundtrack } from "../../src/audio-model.ts";

/** iOS Safari ignores `media.volume`: the fake mirrors that, so only the gain graph can change loudness. */
function iosMedia() {
  const writes: number[] = [];
  const media = { src: "a.wav", currentTime: 17, paused: true, plays: 0,
    get volume() { return 1; }, set volume(value: number) { writes.push(value); },
    async play() { this.plays += 1; this.paused = false; }, pause() { this.paused = true; } };
  // The fake stands in for the element; it implements only what gainPort touches.
  return { media: media as unknown as typeof media & HTMLAudioElement, writes };
}

function fakeRuntime(state = "running") {
  const gains: { gain: { value: number }; connected: unknown[] }[] = [];
  let sources = 0, resumes = 0;
  const context = { state, destination: "out",
    createGain() { const gain = { gain: { value: 1 }, connected: [] as unknown[], connect(to: unknown) { this.connected.push(to); } }; gains.push(gain); return gain; },
    createMediaElementSource() { sources += 1; return { connect() {} }; } };
  return { runtime: { context: () => context as unknown as AudioContext, resume: async () => { resumes += 1; } }, gains, count: () => ({ sources, resumes }) };
}

for (const level of [0, 0.25, 0.75, 1]) {
  test(`A1: level ${level} reaches the gain node while media volume stays out of the path`, async () => {
    const { media, writes } = iosMedia(); const rig = fakeRuntime();
    const port = gainPort(media, rig.runtime);
    await port.play(); port.volume = level;
    assert.equal(rig.gains[0]!.gain.value, level);
    assert.equal(port.volume, level);
    assert.equal(writes.at(-1), 1);
    assert.equal(media.currentTime, 17);
  });
}

test("A1: two channels attenuate independently", async () => {
  const rig = fakeRuntime();
  const music = gainPort(iosMedia().media, rig.runtime), rain = gainPort(iosMedia().media, rig.runtime);
  await music.play(); await rain.play();
  music.volume = 0.25; rain.volume = 0.75;
  assert.deepEqual(rig.gains.map(entry => entry.gain.value), [0.25, 0.75]);
});

test("A3: repeated play attaches one source and one gain", async () => {
  const { media } = iosMedia(); const rig = fakeRuntime();
  const port = gainPort(media, rig.runtime);
  await port.play(); await port.play(); await port.play();
  assert.equal(rig.count().sources, 1);
  assert.equal(rig.gains.length, 1);
  assert.equal(rig.gains[0]!.connected[0], "out");
});

test("A3: play asks the runtime to resume the context on every play", async () => {
  const { media } = iosMedia(); const rig = fakeRuntime("suspended");
  const port = gainPort(media, rig.runtime);
  await port.play(); await port.play();
  assert.equal(rig.count().resumes, 2);
});

test("A1: a level set before the first play is applied when the graph attaches", async () => {
  const { media } = iosMedia(); const rig = fakeRuntime();
  const port = gainPort(media, rig.runtime);
  port.volume = 0.25; await port.play();
  assert.equal(rig.gains[0]!.gain.value, 0.25);
});

test("without Web Audio the media element's own volume is used", async () => {
  const { media, writes } = iosMedia();
  const port = gainPort(media, { context: () => null, resume: async () => {} });
  port.volume = 0.5; await port.play();
  assert.deepEqual(writes.at(-1), 0.5);
  assert.equal(media.plays, 1);
});

test("a source that cannot attach falls back to media volume instead of throwing", async () => {
  const { media, writes } = iosMedia(); const rig = fakeRuntime();
  (rig.runtime.context() as unknown as { createMediaElementSource(): never }).createMediaElementSource = () => { throw new Error("already attached"); };
  const port = gainPort(media, rig.runtime);
  await port.play(); port.volume = 0.5;
  assert.equal(writes.at(-1), 0.5);
});

test("a gain-routed track still obeys the Soundtrack fade and clamp", async () => {
  const { media } = iosMedia(); const rig = fakeRuntime();
  const model = new Soundtrack(gainPort(media, rig.runtime));
  await model.start(); model.volume(2);
  assert.equal(rig.gains[0]!.gain.value, 1);
  model.beginFade();
  assert.equal(rig.gains[0]!.gain.value, 0);
  model.fadeStep(1);
  assert.equal(rig.gains[0]!.gain.value, 1);
});
