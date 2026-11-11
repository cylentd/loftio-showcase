import assert from 'node:assert/strict';
import { test } from 'node:test';
import { revealVideo, type VideoPhase } from '../src/residents/unboxing-video.ts';

function fixture(frameCallbacks = true, handoff?: () => Promise<void>) {
  const events = new EventTarget();
  const phases: VideoPhase[] = [];
  let plays = 0, pauses = 0, enabled = false, blocked = false;
  let frame: (() => void) | undefined;
  const video = Object.assign(events, { muted: false,
    readyState: 0,
    HAVE_CURRENT_DATA: 2,
    requestVideoFrameCallback: frameCallbacks ? (callback: () => void) => { frame = callback; return 1; } : undefined,
    cancelVideoFrameCallback() { frame = undefined; },
    play() { plays += 1; return blocked ? Promise.reject(new Error('blocked')) : Promise.resolve(); },
    pause() { pauses += 1; }, removeAttribute() {}, load() {},
  });
  const reveal = revealVideo(video as unknown as HTMLVideoElement, () => enabled, phase => phases.push(phase), handoff);
  return { video, phases, reveal, get plays() { return plays; }, get pauses() { return pauses; },
    frame() { video.readyState = 2; frame?.(); },
    pendingFrame() { return frame; },
    sound(value: boolean) { enabled = value; }, block(value: boolean) { blocked = value; } };
}

test('video waits for user intent, obeys mute and reveals exactly once on end', () => {
  const run = fixture();
  assert.equal(run.plays, 0);
  run.reveal.play(); run.reveal.play();
  assert.equal(run.plays, 1);
  assert.equal(run.video.muted, true);
  assert.deepEqual(run.phases, ['loading']);
  run.frame();
  assert.deepEqual(run.phases, ['loading', 'playing']);
  run.video.dispatchEvent(new Event('ended')); run.video.dispatchEvent(new Event('ended'));
  assert.deepEqual(run.phases, ['loading', 'playing', 'revealed']);
});

test('clip audio follows preference and can be muted during playback', () => {
  const run = fixture(); run.sound(true); run.reveal.play(); run.frame();
  assert.equal(run.video.muted, false);
  run.reveal.mute();
  assert.equal(run.video.muted, true);
  assert.equal(run.plays, 1);
});

test('skip reveals immediately, stops playback and ignores a late rejection', async () => {
  const run = fixture(); run.block(true); run.reveal.play(); run.reveal.skip();
  await Promise.resolve();
  assert.ok(run.pauses > 0);
  assert.deepEqual(run.phases, ['loading', 'revealed']);
  run.reveal.play();
  assert.equal(run.plays, 1);
});

test('blocked playback offers retry without revealing or deadlocking', async () => {
  const run = fixture(); run.block(true); run.reveal.play();
  await Promise.resolve();
  assert.deepEqual(run.phases, ['loading', 'retry']);
  run.block(false); run.reveal.play(); run.frame(); run.video.dispatchEvent(new Event('ended'));
  assert.equal(run.plays, 2);
  assert.equal(run.phases.at(-1), 'revealed');
});

test('media error offers retry and skip remains available', () => {
  const run = fixture(); run.reveal.play(); run.frame(); run.video.dispatchEvent(new Event('error'));
  assert.equal(run.phases.at(-1), 'retry');
  run.reveal.skip();
  assert.equal(run.phases.at(-1), 'revealed');
});

test('closing stops and releases media with no late completion or restart', async () => {
  const run = fixture(); run.block(true); run.reveal.play(); run.reveal.dispose(); run.reveal.dispose();
  run.video.dispatchEvent(new Event('ended')); run.video.dispatchEvent(new Event('error'));
  await Promise.resolve(); run.reveal.play(); run.reveal.skip();
  assert.ok(run.pauses > 0);
  assert.equal(run.plays, 1);
  assert.deepEqual(run.phases, ['loading', 'closed']);
});

test('play promise and media readiness do not reveal the video before its first presented frame', async () => {
  const run = fixture(); run.reveal.play();
  await Promise.resolve();
  run.video.readyState = 2; run.video.dispatchEvent(new Event('playing'));
  assert.deepEqual(run.phases, ['loading']);
  run.frame(); run.frame();
  assert.deepEqual(run.phases, ['loading', 'playing']);
});

test('browsers without frame callbacks wait for a playing event with decoded data', () => {
  const run = fixture(false); run.reveal.play();
  run.video.dispatchEvent(new Event('playing'));
  assert.deepEqual(run.phases, ['loading']);
  run.video.readyState = 2; run.video.dispatchEvent(new Event('playing'));
  assert.deepEqual(run.phases, ['loading', 'playing']);
});

test('skip and close cancel a pending frame and ignore a stale callback', () => {
  for (const action of ['skip', 'dispose'] as const) {
    const run = fixture(); run.reveal.play();
    const stale = run.pendingFrame();
    assert.equal(typeof stale, 'function');
    run.reveal[action](); stale!();
    assert.equal(run.pendingFrame(), undefined);
    assert.deepEqual(run.phases, ['loading', action === 'skip' ? 'revealed' : 'closed']);
  }
});

test('retry ignores the previous attempt frame and waits for the new frame', () => {
  const run = fixture(); run.reveal.play();
  const stale = run.pendingFrame();
  run.video.dispatchEvent(new Event('error')); run.reveal.play();
  stale!();
  assert.deepEqual(run.phases, ['loading', 'retry', 'loading']);
  run.frame();
  assert.deepEqual(run.phases, ['loading', 'retry', 'loading', 'playing']);
});

test('holds the decoded first frame until the box reaches its landing position', async () => {
  let land!: () => void;
  const flight = new Promise<void>(resolve => { land = resolve; });
  const run = fixture(true, () => flight); run.sound(true); run.reveal.play(); run.frame();
  assert.deepEqual(run.phases, ['loading']);
  assert.equal(run.pauses, 1);
  assert.equal(run.video.muted, true);
  land(); await flight; await Promise.resolve();
  assert.deepEqual(run.phases, ['loading', 'playing']);
  assert.equal(run.plays, 2);
  assert.equal(run.video.muted, false);
});

test('skip and close during a flight never resume the video after landing', async () => {
  for (const action of ['skip', 'dispose'] as const) {
    let land!: () => void;
    const flight = new Promise<void>(resolve => { land = resolve; });
    const run = fixture(true, () => flight); run.reveal.play(); run.frame();
    run.reveal[action](); land(); await flight; await Promise.resolve();
    assert.equal(run.plays, 1);
    assert.deepEqual(run.phases, ['loading', action === 'skip' ? 'revealed' : 'closed']);
  }
});

test('intentionally pausing the first frame does not turn an aborted startup play into retry', async () => {
  let land!: () => void;
  const flight = new Promise<void>(resolve => { land = resolve; });
  const run = fixture(true, () => flight);
  const resume = run.video.play;
  run.video.play = () => Promise.reject(new DOMException('Paused at the first frame', 'AbortError'));
  run.reveal.play(); run.frame(); await Promise.resolve();
  assert.deepEqual(run.phases, ['loading']);
  run.video.play = resume; land(); await flight; await Promise.resolve();
  assert.deepEqual(run.phases, ['loading', 'playing']);
});
