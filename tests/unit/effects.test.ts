import assert from "node:assert/strict";
import { test } from "node:test";
import { cameraOffset, leafWeight, motionStep, onGlass, rainPosition } from "../../src/effects-model.ts";

const live = { still: false, reduced: false, hidden: false, scene: true };
for (const reason of ["still", "reduced", "hidden", "scene"] as const) {
  test(`${reason} freezes the shared atmosphere and camera clock`, () => {
    assert.equal(motionStep(16, { ...live, [reason]: reason !== "scene" }), 0);
  });
}
test("resume cannot fast-forward effects; invalid deltas do not poison geometry", () => {
  assert.equal(motionStep(5000, live), 32);
  assert.equal(motionStep(-5, live), 0);
  assert.equal(motionStep(NaN, live), 0);
  assert.equal(motionStep(16, live), 16);
});
test("look is bounded and cannot expose room edges even without overscan", () => {
  assert.deepEqual(cameraOffset({ x: 100, y: -100 }, 1920, 1081, 1), { x: 0, y: 0 });
  assert.deepEqual(cameraOffset({ x: 100, y: -100 }, 1500, 920, 1), { x: 85, y: -45 });
  assert.deepEqual(cameraOffset({ x: -100, y: 100 }, 1500, 920, 1), { x: -85, y: 45 });
});
for (const [label, x, y, expected] of [
  ["open upper glass", 1500, 80, true], ["open middle glass", 1500, 250, true],
  ["open lower glass", 1700, 450, true], ["main mullion", 1610, 250, false],
  ["crossbar", 1500, 350, false], ["floor", 1700, 740, false],
  ["plant and lantern", 1235, 355, false], ["window plant", 1310, 450, false],
  ["upper leaves", 1220, 50, false], ["room", 1000, 200, false],
] as const) {
  test(`rain excludes painted occluders: ${label}`, () => assert.equal(onGlass({ x, y }), expected));
}
test("foliage patch edges and stem stay fixed; leaf tips can flex", () => {
  assert.equal(leafWeight(0, 0.5), 0);
  assert.equal(leafWeight(1, 0.5), 0);
  assert.equal(leafWeight(0.5, 0), 0);
  assert.equal(leafWeight(0.5, 1), 0);
  assert.ok(leafWeight(0.5, 0.5) > 0.5);
});
test("seeded rain wraps, moves down, and uses distinct depth speeds", () => {
  const a = rainPosition(0.4, 0, false);
  const b = rainPosition(0.4, 16, false);
  const near = rainPosition(0.4, 16, true);
  assert.ok(b.y > a.y && b.y - a.y < 20);
  assert.notEqual(near.y, b.y);
  assert.deepEqual(rainPosition(0.4, 16, false), b);
  assert.ok(rainPosition(0.4, 1e9, true).y < 730);
});
