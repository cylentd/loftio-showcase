import assert from "node:assert/strict";
import { test } from "node:test";
import { placementPosition, surfaceAt } from "../../src/resident-movement.ts";
import { canWander, wanderTarget } from "../../src/wander-model.ts";

test("dragging can place residents on either loft while the ladder gap stays excluded", () => {
  assert.deepEqual(placementPosition({ x: 620, y: 400 }), { x: 620, y: 400 });
  assert.deepEqual(placementPosition({ x: 1100, y: 400 }), { x: 1100, y: 400 });
  assert.deepEqual(placementPosition({ x: 950, y: 400 }), { x: 1040, y: 400 });
  assert.equal(surfaceAt({ x: 620, y: 400 }), "loft-left");
  assert.equal(surfaceAt({ x: 1100, y: 400 }), "loft-right");
  assert.equal(surfaceAt({ x: 1100, y: 800 }), "ground");
});

test("the closest floor clamps an out-of-bounds drop without leaving the room", () => {
  assert.deepEqual(placementPosition({ x: -500, y: -50 }), { x: 365, y: 380 });
  assert.deepEqual(placementPosition({ x: 5000, y: 5000 }), { x: 1770, y: 1020 });
});

test("wandering resumes after the post-drop pause but respects the toggle and held residents", () => {
  assert.equal(canWander(true, false, false, 8000, 8000), true);
  assert.equal(canWander(true, false, false, 7999, 8000), false);
  assert.equal(canWander(false, false, false, 9000, 8000), false);
  assert.equal(canWander(true, true, false, 9000, 8000), false);
  assert.equal(canWander(true, false, true, 9000, 8000), false);
});

test("a moved downstairs resident returns to its new anchor instead of undoing the drag", () => {
  const home = { x: 1100, y: 900 };
  const interest = { x: 1600, y: 770 };
  assert.deepEqual(wanderTarget(home, interest, "home", 0.8), interest);
  assert.deepEqual(wanderTarget(home, interest, "interest", 0.8), home);
});

test("upstairs wandering never crosses the ladder gap or changes floors", () => {
  const left = wanderTarget({ x: 820, y: 400 }, { x: 1600, y: 770 }, "home", 1);
  const right = wanderTarget({ x: 1050, y: 400 }, { x: 500, y: 800 }, "home", 0);
  assert.equal(surfaceAt(left), "loft-left");
  assert.equal(surfaceAt(right), "loft-right");
  assert.notDeepEqual(left, { x: 820, y: 400 });
  assert.notDeepEqual(right, { x: 1050, y: 400 });
});
