import assert from "node:assert/strict";
import { test } from "node:test";
import { Soundtrack } from "../src/audio-model.ts";

function fixture(reject = false) {
  const calls = { play: 0, pause: 0 };
  const audio = { volume: 1, src: "paper.mp3", currentTime: 17,
    async play() { calls.play += 1; if (reject) throw new Error("blocked"); },
    pause() { calls.pause += 1; },
  };
  return { calls, audio, model: new Soundtrack(audio) };
}
test("soundtrack is opt-in and toggle preserves the playhead", async () => {
  const { calls, audio, model } = fixture();
  assert.equal(calls.play, 0);
  await model.toggle();
  assert.equal(model.playing, true);
  await model.toggle();
  assert.equal(model.playing, false);
  assert.equal(calls.pause, 1);
  assert.equal(audio.currentTime, 17);
});
test("hidden pauses; visible resumes only a user-selected soundtrack", async () => {
  const { calls, model } = fixture();
  await model.visibility(true);
  await model.visibility(false);
  assert.equal(calls.play, 0);
  await model.toggle();
  await model.visibility(true);
  assert.equal(model.playing, false);
  await model.visibility(false);
  assert.equal(calls.play, 2);
  assert.equal(model.playing, true);
});
test("pausing intent while hidden prevents a later unsolicited resume", async () => {
  const { calls, model } = fixture();
  await model.toggle();
  await model.visibility(true);
  await model.toggle();
  await model.visibility(false);
  assert.equal(calls.play, 1);
  assert.equal(model.desired, false);
});
test("rejected playback reports failure and does not retry on tab focus", async () => {
  const { calls, model } = fixture(true);
  await model.toggle();
  assert.equal(model.failed, true);
  assert.equal(model.desired, false);
  await model.visibility(false);
  assert.equal(calls.play, 1);
});
test("volume is bounded and zero supports mute without changing play intent", async () => {
  const { audio, model } = fixture();
  model.volume(2);
  assert.equal(audio.volume, 1);
  model.volume(-1);
  assert.equal(audio.volume, 0);
  assert.equal(model.desired, false);
  model.volume(0.35);
  assert.equal(audio.volume, 0.35);
});

test("selecting a track while paused changes the source without starting playback", async () => {
  const { calls, audio, model } = fixture();
  await model.select("slow.mp3");
  assert.equal(audio.src, "slow.mp3");
  assert.equal(audio.currentTime, 0);
  assert.equal(calls.play, 0);
  assert.equal(model.desired, false);
});

test("selecting another track while playing preserves play intent and volume", async () => {
  const { calls, audio, model } = fixture();
  model.volume(0.2);
  await model.toggle();
  await model.select("slow.mp3");
  assert.equal(audio.src, "slow.mp3");
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.volume, 0.2);
  assert.equal(calls.play, 2);
  assert.equal(model.playing, true);
});

test("a track selected while hidden waits for visible before resuming", async () => {
  const { calls, audio, model } = fixture();
  await model.toggle();
  await model.visibility(true);
  await model.select("slow.mp3");
  assert.equal(audio.src, "slow.mp3");
  assert.equal(calls.play, 1);
  await model.visibility(false);
  assert.equal(calls.play, 2);
});
test("a fade-in starts silent, rises, and lands exactly on the set volume", () => {
  const { audio, model } = fixture();
  model.volume(0.4);
  model.beginFade();
  assert.equal(audio.volume, 0);
  model.fadeStep(0.5);
  assert.ok(audio.volume > 0 && audio.volume < 0.4, `mid-fade volume ${audio.volume}`);
  model.fadeStep(1);
  assert.equal(audio.volume, 0.4);
});
test("moving the volume during a fade wins, and the fade stops touching it", () => {
  const { audio, model } = fixture();
  model.volume(0.4);
  model.beginFade();
  model.fadeStep(0.3);
  model.volume(0.2);
  model.fadeStep(0.6);
  model.fadeStep(1);
  assert.equal(audio.volume, 0.2);
});
