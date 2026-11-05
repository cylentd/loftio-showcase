import test from "node:test";
import assert from "node:assert/strict";
import { heldPose } from "../src/held-pose.ts";

test("a held resident gently squirms within a small rotation budget", () => {
  const first = heldPose(160, Math.PI);
  const second = heldPose(400, Math.PI);
  assert.notEqual(first.rotation, second.rotation);
  assert.ok(Math.abs(first.rotation) <= 0.07 && Math.abs(second.rotation) <= 0.07);
  assert.ok(Math.abs(first.lift) <= 0.02 && Math.abs(second.lift) <= 0.02);
});

test("Still and reduced motion neutralize held squirm immediately", () => {
  for (const time of [0, 300, 1400]) assert.deepEqual(heldPose(time, Math.PI, true), { rotation: 0, lift: 0, sx: 1, sy: 1 });
});

test("a fresh pickup starts from a neutral pose regardless of resident phase", () => {
  for (const phase of [0, Math.PI, Math.PI / 2]) assert.deepEqual(heldPose(0, phase), { rotation: 0, lift: 0, sx: 1, sy: 1 });
});
