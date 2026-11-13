import assert from "node:assert/strict";
import { test } from "node:test";
import { cloudPose } from "../../src/cloud-pose.ts";

test("clouds start centered and translucent without inflating their resident", () => {
  assert.deepEqual(cloudPose(0, 1), { lift: 0, spread: 1, alpha: 0.55 });
});

test("cloud movement stays bounded and varies between residents", () => {
  for (const phase of [0, 1, 3, 6]) {
    const poses = [500, 1500, 3000, 5000, 10000].map(time => cloudPose(time, phase));
    assert.ok(Math.max(...poses.map(pose => pose.lift)) - Math.min(...poses.map(pose => pose.lift)) > 1);
    for (const pose of poses) {
      assert.ok(Math.abs(pose.lift) <= 3);
      assert.ok(pose.spread >= 0.975 && pose.spread <= 1.025);
      assert.ok(pose.alpha >= 0.525 && pose.alpha <= 0.575);
    }
    assert.notDeepEqual(cloudPose(3000, phase), cloudPose(3000, phase + 1));
  }
});
