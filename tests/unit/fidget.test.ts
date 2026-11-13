import test from "node:test";
import assert from "node:assert/strict";
import { body, flick, stepBodies } from "../../src/fidget-model.ts";
import { FIDGET as F } from "../../src/fidget-data.ts";

test("flick distinguishes a quick release from placement and a held pause", () => {
  const fast = [{ x: 0, y: 0, time: 0 }, { x: 100, y: -50, time: 50 }];
  assert.deepEqual(flick(fast, 50, 1), { x: 2000, y: -1000 });
  assert.equal(flick(fast, 200, 1), null);
  assert.equal(flick([{ x: 0, y: 0, time: 0 }, { x: 10, y: 0, time: 50 }], 50, 1), null);
  assert.equal(flick(fast, 50, 0.1), null);
});

test("wall and floor impacts bounce, show impact, and eventually settle", () => {
  const b = body(F.right - 30, 30); b.vx = 1000; b.vy = 700; b.asleep = false;
  stepBodies([b], 16);
  assert.ok(b.vx < 0); assert.ok(b.vy < 0); assert.ok(b.impact > 0);
  for (let frame = 0; frame < 1500; frame++) stepBodies([b], 16);
  assert.equal(b.asleep, true); assert.equal(b.y, F.floor - b.radius);
  assert.equal(b.vx, 0); assert.equal(b.vy, 0);
});

test("a thrown resident transfers momentum to an idle toy", () => {
  const resident = body(800, 60); resident.vx = 1000; resident.asleep = false;
  const toy = body(890, 30, 0.45); toy.y = resident.y;
  stepBodies([resident, toy], 8);
  assert.ok(toy.vx > 0); assert.equal(toy.asleep, false);
  assert.ok(resident.vx < 1000); assert.ok(toy.impact > 0);
});

test("untouched toys stay still and long frames remain bounded", () => {
  const idle = body(840, 30); const before = { ...idle };
  stepBodies([idle], 5000); assert.deepEqual(idle, before);
  const moving = body(800, 30); moving.asleep = false; moving.vx = 2000;
  stepBodies([moving], 5000);
  assert.ok(moving.x < 1000); assert.ok(Number.isFinite(moving.y));
});

test("phone throws bounce inside the visible slice of the room", () => {
  const b = body(1100, 60); b.vx = 2000; b.asleep = false;
  stepBodies([b], 64, { left: 800, right: 1200, top: 100, floor: F.floor });
  assert.ok(b.x <= 1140); assert.ok(b.vx < 0);
});
