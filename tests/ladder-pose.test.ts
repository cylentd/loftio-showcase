import assert from "node:assert/strict";
import { test } from "node:test";
import { ladderPose } from "../src/ladder-pose.ts";

test("ladder travel holds each rung while crouching instead of sliding", () => {
  assert.equal(ladderPose(0.005, false).progress, 0);
  assert.equal(ladderPose(0.205, false).progress, 0.2);
  assert.equal(ladderPose(0.285, false).progress, 0.3);
  assert.ok(ladderPose(0.015, false).sy < 1);
});

test("a rung hop rises close to the ladder and settles before the next push", () => {
  const moving = ladderPose(0.05, false);
  const settled = ladderPose(0.0999, false);
  assert.ok(moving.progress > 0 && moving.progress < 0.1);
  assert.ok(moving.lift > 0 && moving.lift <= 6);
  assert.ok(settled.lift === 0 && Math.abs(settled.sy - 1) < 0.01);
});

test("descending uses gentler steps with the same exact ladder endpoints", () => {
  assert.ok(ladderPose(0.05, true).lift < ladderPose(0.05, false).lift);
  for (const descending of [false, true]) {
    assert.deepEqual(ladderPose(0, descending), { progress: 0, sx: 1, sy: 1, lift: 0, rotation: 0 });
    assert.deepEqual(ladderPose(1, descending), { progress: 1, sx: 1, sy: 1, lift: 0, rotation: 0 });
    let previous = 0;
    for (let frame = 0; frame <= 1000; frame += 1) {
      const pose = ladderPose(frame / 1000, descending);
      assert.ok(pose.progress >= previous && pose.progress <= 1);
      assert.ok(Math.abs(pose.rotation) <= 0.03);
      previous = pose.progress;
    }
  }
});
