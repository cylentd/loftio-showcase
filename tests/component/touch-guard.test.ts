import assert from "node:assert/strict";
import { test } from "node:test";
import { guardPinch } from "../../src/gameplay-gesture.ts";

function touchEvent(type: string, touches: number) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { touches: Array.from({ length: touches }) });
  return event;
}

test("G3: two fingers moving on the game surface do not pinch the page", () => {
  const surface = new EventTarget(); guardPinch(surface);
  const event = touchEvent("touchmove", 2); surface.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
});

test("G3: one finger keeps native scrolling and taps", () => {
  const surface = new EventTarget(); guardPinch(surface);
  const event = touchEvent("touchmove", 1); surface.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
});

for (const type of ["gesturestart", "gesturechange"]) {
  test(`G3: Safari ${type} on the game surface is cancelled`, () => {
    const surface = new EventTarget(); guardPinch(surface);
    const event = touchEvent(type, 0); surface.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  });
}

for (const [type, touches] of [["touchmove", 2], ["gesturestart", 0], ["gesturechange", 0]] as const) {
  test(`G3: ${type} is allowed while the page is zoomed in, so the person can pinch back out`, () => {
    let scale = 2;
    const surface = new EventTarget(); guardPinch(surface, () => scale);
    const zoomed = touchEvent(type, touches); surface.dispatchEvent(zoomed);
    scale = 1;
    const normal = touchEvent(type, touches); surface.dispatchEvent(normal);
    assert.deepEqual([zoomed.defaultPrevented, normal.defaultPrevented], [false, true]);
  });
}

test("G3: disposing the guard returns the surface to browser defaults", () => {
  const surface = new EventTarget(); const dispose = guardPinch(surface); dispose();
  const event = touchEvent("touchmove", 2); surface.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
});

test("G3: an uncancelable event is left alone without throwing", () => {
  const surface = new EventTarget(); guardPinch(surface);
  const event = new Event("touchmove", { cancelable: false });
  Object.assign(event, { touches: [1, 2] });
  assert.doesNotThrow(() => surface.dispatchEvent(event));
});
