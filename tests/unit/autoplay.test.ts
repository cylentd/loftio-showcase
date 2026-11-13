import assert from "node:assert/strict";
import { test } from "node:test";
import { Soundtrack } from "../../src/audio-model.ts";

function fixture(blocked = false) {
  const calls = { play: 0, pause: 0 };
  const audio = { volume: 0.35, src: "room.mp3", currentTime: 0,
    async play() { calls.play += 1; if (blocked) throw new Error("NotAllowedError"); },
    pause() { calls.pause += 1; },
  };
  return { calls, model: new Soundtrack(audio) };
}
test("explicit autoplay start requests playback without toggling an already-on track off", async () => {
  const { model, calls } = fixture();
  await model.start();
  assert.equal(calls.play, 1);
  assert.equal(model.playing, true);
  await model.start();
  assert.equal(model.desired, true);
  assert.equal(model.playing, true);
  await model.stop();
  assert.equal(model.desired, false);
  assert.equal(model.playing, false);
});
test("blocked autoplay reports stopped and waits for an explicit retry", async () => {
  const { model, calls } = fixture(true);
  await model.start();
  assert.equal(model.failed, true);
  assert.equal(model.desired, false);
  await model.visibility(true);
  await model.visibility(false);
  assert.equal(calls.play, 1);
  await model.start();
  assert.equal(calls.play, 2);
});
