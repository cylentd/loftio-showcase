import assert from "node:assert/strict";
import { test } from "node:test";
import { Turn } from "../src/turn-pose.ts";
import { TURN } from "../src/tune.ts";

/** Steps a turn through its whole length and returns every pose on the way. */
function sweep(turn: Turn, steps = 100) {
  const poses = [turn.pose()];
  for (let i = 0; i < steps; i++) { turn.advance(TURN.ms / steps); poses.push(turn.pose()); }
  return poses;
}

test("a resident at rest shows full width, facing its way, standing still", () => {
  assert.deepEqual(new Turn(1).pose(), { sx: 1, sy: 1, lift: 0 });
  assert.deepEqual(new Turn(-1).pose(), { sx: -1, sy: 1, lift: 0 });
});

test("a turn never narrows past the minimum width, so the flat edge never shows", () => {
  const turn = new Turn(1);
  turn.face(-1);
  for (const pose of sweep(turn)) assert.ok(Math.abs(pose.sx) >= TURN.minWidth - 1e-9, `width ${pose.sx}`);
  assert.ok(TURN.minWidth >= 0.5, "half width or more reads as a body, not a card");
});

test("the flip happens once, at the narrowest and highest point of the hop", () => {
  const turn = new Turn(1);
  turn.face(-1);
  const poses = sweep(turn);
  const flip = poses.findIndex(pose => pose.sx < 0);
  assert.ok(flip > 0);
  assert.ok(poses.slice(flip).every(pose => pose.sx < 0), "no flicker back");
  const highest = poses.reduce((best, pose, i) => pose.lift > poses[best]!.lift ? i : best, 0);
  assert.ok(Math.abs(flip - highest) <= 1, `flip at ${flip}, apex at ${highest}`);
  assert.ok(Math.abs(poses[flip]!.sx) - TURN.minWidth < 0.01);
});

test("the turn stretches a little while narrow and ends exactly at rest on the new side", () => {
  const turn = new Turn(1);
  turn.face(-1);
  const poses = sweep(turn);
  assert.ok(Math.max(...poses.map(pose => pose.sy)) > 1);
  assert.ok(Math.max(...poses.map(pose => pose.lift)) > 0);
  assert.deepEqual(poses.at(-1), { sx: -1, sy: 1, lift: 0 });
  assert.equal(turn.turning, false);
});

test("the turn eases in and out: the first and last steps move far less than the steps around the flip", () => {
  const turn = new Turn(1);
  turn.face(-1);
  const widths = sweep(turn).map(pose => Math.abs(pose.sx));
  const step = (i: number) => Math.abs(widths[i + 1]! - widths[i]!);
  const quarter = Math.floor(widths.length / 4);
  assert.ok(step(0) < step(quarter) / 10, `start ${step(0)} vs quarter ${step(quarter)}`);
  assert.ok(step(widths.length - 2) < step(widths.length - 1 - quarter) / 10);
});

test("a turn lasts long enough to be seen: at least a third of a second", () => {
  assert.ok(TURN.ms >= 330, `${TURN.ms} ms`);
});

test("facing the way it already faces starts no turn", () => {
  const turn = new Turn(1);
  turn.face(1);
  assert.equal(turn.turning, false);
  assert.deepEqual(turn.pose(), { sx: 1, sy: 1, lift: 0 });
});

test("turning back mid-turn reverses smoothly from where it is, with no jump", () => {
  const turn = new Turn(1);
  turn.face(-1);
  turn.advance(TURN.ms * 0.3);
  const before = turn.pose();
  turn.face(1);
  assert.deepEqual(turn.pose(), before);
  turn.advance(TURN.ms);
  assert.deepEqual(turn.pose(), { sx: 1, sy: 1, lift: 0 });
});

test("snap ends any turn at once, for a pick-up or reduced motion", () => {
  const turn = new Turn(1);
  turn.face(-1);
  turn.advance(TURN.ms * 0.2);
  turn.snap(-1);
  assert.equal(turn.turning, false);
  assert.deepEqual(turn.pose(), { sx: -1, sy: 1, lift: 0 });
});
