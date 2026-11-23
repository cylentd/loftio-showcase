import assert from "node:assert/strict";
import { test } from "node:test";
import { CARRY_SCROLL, scrollStep } from "../../src/carry-scroll.ts";

const WINDOW = 390; // the phone window in css px
const HIDDEN = 285; // how far the portrait room can scroll: 1080 world px x 0.625 - 390
const FRAME_MS = 16;
const FULL = CARRY_SCROLL.speed * FRAME_MS; // px moved in one frame with the finger on the glass edge
const step = (finger: number, scrollLeft: number, dt = FRAME_MS) => scrollStep(finger, WINDOW, scrollLeft, HIDDEN, dt);

const CASES = [
  { name: "a finger mid-window does not scroll", finger: 195, scrollLeft: 100, moves: 0 },
  { name: "a finger exactly at the inner edge of the left zone does not scroll", finger: CARRY_SCROLL.edge, scrollLeft: 100, moves: 0 },
  { name: "a finger on the left window edge scrolls left at full speed", finger: 0, scrollLeft: 100, moves: -FULL },
  { name: "a finger half way into the left zone scrolls left at half speed", finger: CARRY_SCROLL.edge / 2, scrollLeft: 100, moves: -FULL / 2 },
  { name: "a finger past the left window edge is held to full speed", finger: -30, scrollLeft: 100, moves: -FULL },
  { name: "a finger on the right window edge scrolls right at full speed", finger: WINDOW, scrollLeft: 100, moves: FULL },
  { name: "a finger half way into the right zone scrolls right at half speed", finger: WINDOW - CARRY_SCROLL.edge / 2, scrollLeft: 100, moves: FULL / 2 },
  { name: "a finger past the right window edge is held to full speed", finger: WINDOW + 30, scrollLeft: 100, moves: FULL },
  { name: "the room stops at its left end", finger: 0, scrollLeft: 0, moves: 0 },
  { name: "the last pixels to the left end are taken whole", finger: 0, scrollLeft: 3, moves: -3 },
  { name: "the room stops at its right end", finger: WINDOW, scrollLeft: HIDDEN, moves: 0 },
  { name: "the last pixels to the right end are taken whole", finger: WINDOW, scrollLeft: HIDDEN - 1, moves: 1 },
] as const;

for (const { name, finger, scrollLeft, moves } of CASES) {
  test(`scroll step: ${name}`, () => assert.equal(step(finger, scrollLeft), moves));
}

const BAD_TIME = [
  { name: "a negative frame time never scrolls backwards", finger: 0, dt: -FRAME_MS },
  { name: "a negative frame time never scrolls backwards at the right edge", finger: WINDOW, dt: -FRAME_MS },
  { name: "a NaN frame time scrolls nothing", finger: 0, dt: NaN },
  { name: "an infinite frame time scrolls nothing", finger: WINDOW, dt: Infinity },
] as const;

for (const { name, finger, dt } of BAD_TIME) {
  test(`scroll step: ${name}`, () => assert.equal(step(finger, 100, dt), 0));
}

test("scroll step: a room with no scroll range stays put at either edge", () => {
  assert.equal(scrollStep(0, WINDOW, 0, 0, FRAME_MS), 0);
  assert.equal(scrollStep(WINDOW, WINDOW, 0, 0, FRAME_MS), 0);
});

test("scroll step: no time passed, no movement", () => assert.equal(step(0, 100, 0), 0));

test("scroll step: a longer frame moves proportionally further", () => assert.equal(step(0, 100, 2 * FRAME_MS), -2 * FULL));
