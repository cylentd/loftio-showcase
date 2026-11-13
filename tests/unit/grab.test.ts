import test from "node:test";
import assert from "node:assert/strict";
import { grabState, pullGrab, advanceGrab, grabPose } from "../../src/grab-model.ts";

test("a horizontal pull stretches across the motion and compresses vertically", () => {
  const s = grabState(); pullGrab(s, 30, 0, 180); const p = grabPose(s);
  assert.ok(p.sx > 1); assert.ok(p.sy < 1); assert.ok(p.rotation > 0);
});
test("vertical pulls stretch vertically; deformation is bounded even after a huge drag", () => {
  const s = grabState(); pullGrab(s, 0, -10000, 180); const p = grabPose(s);
  assert.ok(p.sy > 1 && p.sy < 1.3); assert.ok(p.sx < 1 && p.sx > 0.8);
});
test("catch squish is immediate and relaxes without further pointer movement", () => {
  const s = grabState(true); assert.ok(grabPose(s).sy < 1);
  for (let i = 0; i < 120; i++) advanceGrab(s, 16);
  assert.deepEqual(grabPose(s), { sx: 1, sy: 1, rotation: 0 });
});
test("pull deformation springs back and reduced motion draws a neutral pose", () => {
  const s = grabState(); pullGrab(s, 30, -15, 180);
  assert.deepEqual(grabPose(s, true), { sx: 1, sy: 1, rotation: 0 });
  for (let i = 0; i < 240; i++) advanceGrab(s, 16);
  const p = grabPose(s); assert.ok(Math.abs(p.sx - 1) < 0.001); assert.ok(Math.abs(p.rotation) < 0.001);
});
