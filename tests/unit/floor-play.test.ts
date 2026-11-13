import test from "node:test";
import assert from "node:assert/strict";
import { floorBody, launchFloor, stepFloor, fitFloor } from "../../src/floor-play-model.ts";

test("sideways flick hops without gravity pulling the resident toward the front", () => {
  const b = floorBody(1200, 900, 40); launchFloor(b, { x: 800, y: 0 });
  stepFloor([b], 32);
  assert.ok(b.x > 1200); assert.equal(b.y, 900); assert.ok(b.z > 0);
  for (let i = 0; i < 500; i++) stepFloor([b], 16);
  assert.equal(b.asleep, true); assert.equal(b.z, 0); assert.equal(b.y, 900);
});

test("depth flick changes the floor position separately from hop height", () => {
  const b = floorBody(1400, 930, 40); launchFloor(b, { x: 0, y: -800 });
  stepFloor([b], 32); assert.ok(b.y < 930); assert.ok(b.z > 0); assert.equal(b.x, 1400);
});

test("resident contact transfers momentum and wakes a resting neighbor", () => {
  const a = floorBody(1200, 930, 40), b = floorBody(1275, 930, 40);
  launchFloor(a, { x: 700, y: 0 }); stepFloor([a, b], 8);
  assert.ok(b.vx > 0); assert.equal(b.asleep, false); assert.ok(b.impact > 0);
});

test("existing table footprint deflects floor travel", () => {
  const b = floorBody(950, 850, 40); launchFloor(b, { x: 0, y: -1000 });
  stepFloor([b], 64); assert.ok(b.y >= 841); assert.ok(b.vy > 0); assert.ok(b.impact > 0);
});

test("phone boundaries constrain active residents; untouched residents stay put", () => {
  const b = floorBody(1200, 930, 40); launchFloor(b, { x: 2000, y: 0 });
  stepFloor([b], 64, { left: 900, right: 1250 }); assert.ok(b.x <= 1210); assert.ok(b.vx < 0);
  const idle = floorBody(1600, 900, 40), before = { ...idle };
  stepFloor([idle], 64, { left: 900, right: 1250 }); assert.deepEqual(idle, before);
});

test("release above furniture projects to open floor, not into the table", () => {
  const b = floorBody(950, 760, 40); fitFloor(b);
  assert.ok(b.y >= 841 || b.x <= 695 || b.x >= 1175);
});

test("phone edges leave room for the entire sprite, not only its foot collision shape", () => {
  const b = Object.assign(floorBody(1200, 930, 40), { edgeRadius: 100 });
  launchFloor(b, { x: 2000, y: 0 });
  stepFloor([b], 64, { left: 900, right: 1350 }); assert.ok(b.x <= 1250);
});

test("strong upward flicks toss higher than sideways flicks, with a bounded maximum", () => {
  const side = floorBody(1400, 930, 40), up = floorBody(1400, 930, 40), huge = floorBody(1400, 930, 40);
  launchFloor(side, { x: 1200, y: 0 }); launchFloor(up, { x: 0, y: -1200 }); launchFloor(huge, { x: 0, y: -10000 });
  assert.ok(up.vz > side.vz * 2); assert.ok(huge.vz <= 1150);
  stepFloor([up], 64); stepFloor([side], 64); assert.ok(up.z > side.z * 2);
});
