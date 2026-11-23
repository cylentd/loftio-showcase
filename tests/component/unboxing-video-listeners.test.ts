import assert from 'node:assert/strict';
import { test } from 'node:test';
import { revealVideo } from '../../src/residents/unboxing-video.ts';

type Listener = (...args: unknown[]) => void;

// Stores each handler by event name; a remove with any other function is recorded as a mismatch.
function spyVideo() {
  const live = new Map<string, Listener>();
  const mismatched: string[] = [];
  const video = {
    muted: false, readyState: 0, HAVE_CURRENT_DATA: 2,
    addEventListener(name: string, fn: Listener) { live.set(name, fn); },
    removeEventListener(name: string, fn: Listener) {
      if (live.get(name) !== fn) mismatched.push(name);
      live.delete(name);
    },
    play: () => Promise.resolve(), pause() {}, removeAttribute() {}, load() {},
  };
  return { video, live, mismatched };
}

test('the video listens for end, error and playing, and dispose removes all three', () => {
  const { video, live, mismatched } = spyVideo();
  const reveal = revealVideo(video as unknown as HTMLVideoElement, () => false, () => {});
  assert.deepEqual([...live.keys()].sort(), ['ended', 'error', 'playing']);
  reveal.dispose();
  assert.deepEqual([...live.keys()], []);
  assert.deepEqual(mismatched, [], 'dispose must remove the same function it added');
});
