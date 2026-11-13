import assert from "node:assert/strict";
import { test } from "node:test";
import { Soundtrack } from "../../src/audio-model.ts";
import { createAudioRuntime, type RuntimeEnv } from "../../src/audio-runtime.ts";
import { AUDIO_UNLOCK_EVENTS } from "../../src/audio-constants.ts";

function pendingTrack() {
  let resolvePlay!: () => void;
  let rejectPlay!: (error: Error) => void;
  const playback = new Promise<void>((resolve, reject) => { resolvePlay = resolve; rejectPlay = reject; });
  const media = { volume: 0.35, src: "local.wav", currentTime: 17, plays: 0, pauses: 0,
    play() { this.plays += 1; return playback; }, pause() { this.pauses += 1; } };
  return { model: new Soundtrack(media), media, resolvePlay, rejectPlay };
}

test("A4 preservation: stale successful completion cannot overwrite explicit stop", async () => {
  const fixture = pendingTrack();
  const starting = fixture.model.start();
  await fixture.model.stop(); fixture.resolvePlay(); await starting;
  assert.equal(fixture.model.desired, false);
  assert.equal(fixture.model.playing, false);
  assert.equal(fixture.media.plays, 1);
  assert.equal(fixture.media.pauses, 1);
});

test("A4 preservation: stale rejection does not mark a stopped channel blocked", async () => {
  const fixture = pendingTrack();
  const starting = fixture.model.start();
  await fixture.model.stop(); fixture.rejectPlay(new Error("blocked")); await starting;
  assert.equal(fixture.model.failed, false);
  assert.equal(fixture.model.desired, false);
  assert.equal(fixture.model.playing, false);
});

test("A3 preservation: hiding during pending play suppresses completion and retains position", async () => {
  const fixture = pendingTrack();
  const starting = fixture.model.start();
  await fixture.model.visibility(true); fixture.resolvePlay(); await starting;
  assert.equal(fixture.model.playing, false);
  assert.equal(fixture.model.desired, true);
  assert.equal(fixture.media.currentTime, 17);
  assert.equal(fixture.media.volume, 0.35);
});

/** A context whose resume() never settles, as one asked outside a gesture may behave. */
class FakeContext extends EventTarget {
  state: string; resumes = 0;
  constructor(state = "suspended") { super(); this.state = state; }
  resume() { this.resumes += 1; return new Promise<void>(() => {}); }
}

function page(context = new FakeContext(), hidden = false) {
  let constructed = 0;
  const document = Object.assign(new EventTarget(), { hidden });
  const window = new EventTarget();
  const Ctor = class { constructor() { constructed += 1; return context as unknown as object; } } as unknown as RuntimeEnv["Ctor"];
  const runtime = createAudioRuntime(() => ({ Ctor, document, window }));
  return { runtime, context, document, window, constructed: () => constructed };
}

test("A3: every caller gets the one shared context", () => {
  const rig = page();
  assert.equal(rig.runtime.context(), rig.runtime.context());
  assert.equal(rig.constructed(), 1);
  assert.equal(rig.runtime.owns(rig.context), true);
});

test("A3: without Web Audio there is no context", () => {
  const runtime = createAudioRuntime(() => ({ Ctor: undefined, document: Object.assign(new EventTarget(), { hidden: false }), window: new EventTarget() }));
  assert.equal(runtime.context(), null);
  assert.equal(runtime.owns({}), false);
});

test("A3: a constructor that throws gives no context and is not retried", () => {
  let tries = 0;
  const Ctor = class { constructor() { tries += 1; throw new Error("denied"); } } as unknown as RuntimeEnv["Ctor"];
  const runtime = createAudioRuntime(() => ({ Ctor, document: Object.assign(new EventTarget(), { hidden: false }), window: new EventTarget() }));
  assert.equal(runtime.context(), null); assert.equal(runtime.context(), null);
  assert.equal(tries, 1);
});

for (const type of AUDIO_UNLOCK_EVENTS) {
  test(`A4: a ${type} after a pending load-time resume asks the context again`, () => {
    const rig = page(); rig.runtime.context();
    void rig.runtime.resume();
    assert.equal(rig.context.resumes, 1);
    rig.document.dispatchEvent(new Event(type));
    assert.equal(rig.context.resumes, 2);
  });
}

test("A4: each gesture while still suspended asks again, never reusing an unsettled promise", () => {
  const rig = page(); rig.runtime.context();
  for (let tap = 0; tap < 3; tap++) rig.document.dispatchEvent(new Event("click"));
  assert.equal(rig.context.resumes, 3);
});

for (const state of ["running", "closed"]) {
  test(`A3: a ${state} context is left alone by gestures`, () => {
    const rig = page(new FakeContext(state)); rig.runtime.context();
    rig.document.dispatchEvent(new Event("click")); void rig.runtime.resume();
    assert.equal(rig.context.resumes, 0);
  });
}

test("A3: an interruption while visible resumes; while hidden it waits", () => {
  const visible = page(new FakeContext("interrupted")); visible.runtime.context();
  visible.context.dispatchEvent(new Event("statechange"));
  const hidden = page(new FakeContext("interrupted"), true); hidden.runtime.context();
  hidden.context.dispatchEvent(new Event("statechange"));
  assert.deepEqual([visible.context.resumes, hidden.context.resumes], [1, 0]);
});

test("A3: pageshow and becoming visible ask a suspended context to resume", () => {
  const rig = page(); rig.runtime.context();
  rig.window.dispatchEvent(new Event("pageshow")); rig.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(rig.context.resumes, 2);
});

test("A4: a rejected resume is swallowed", async () => {
  const context = new FakeContext(); context.resume = () => Promise.reject(new Error("blocked"));
  const rig = page(context); rig.runtime.context();
  await assert.doesNotReject(rig.runtime.resume());
});
