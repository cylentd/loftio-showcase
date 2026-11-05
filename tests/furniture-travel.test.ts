import assert from "node:assert/strict";
import { test } from "node:test";
import { placementPosition, surfaceAt, isLoft, DragPlacement } from "../src/resident-movement.ts";
import { wanderTarget } from "../src/wander-model.ts";

test("residents can stand close to the right window without crossing its sill", () => {
  assert.deepEqual(placementPosition({ x: 1570, y: 700 }), { x: 1570, y: 700 });
  assert.equal(isLoft({ x: 1570, y: 700 }), false);
  assert.deepEqual(placementPosition({ x: 1570, y: 650 }), { x: 1570, y: 685 });
});

test("both painted upstairs beds accept feet and remain classified upstairs", () => {
  for (const [point, surface] of [
    [{ x: 510, y: 345 }, "bed-left"],
    [{ x: 1090, y: 365 }, "bed-right"],
  ] as const) {
    assert.equal(surfaceAt(point), surface);
    assert.deepEqual(placementPosition(point), point);
    assert.equal(isLoft(point), true);
  }
});

test("a phone drag onto a mattress settles on the mattress rather than the balcony", () => {
  const drag = new DragPlacement();
  drag.begin("puff", 1, { x: 100, y: 100 }, { x: 510, y: 800 }, { x: 510, y: 800 });
  drag.move(1, { x: 100, y: 140 }, { x: 510, y: 345 }, 0.5);
  assert.deepEqual(drag.finish(1)?.position, { x: 510, y: 345 });
});

test("exploratory wandering includes chairs, lounge, ottoman, beds and window", () => {
  const surfaces = new Set(Array.from({ length: 100 }, (_, index) => surfaceAt(
    wanderTarget({ x: 1100, y: 900 }, { x: 1600, y: 770 }, "home", index / 100, true),
  )));
  for (const surface of ["chair-left", "chair-right", "lounge", "ottoman", "bed-left", "bed-right", "window"]) {
    assert.ok(surfaces.has(surface), "Missing destination: " + surface);
  }
  const home = { x: 510, y: 345 };
  assert.deepEqual(wanderTarget(home, { x: 1600, y: 770 }, "interest", 0.9, true), home);
});
