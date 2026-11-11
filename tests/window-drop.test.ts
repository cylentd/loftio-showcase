import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { setRoomLayout } from "../src/room-layout.ts";
import { isLoft, placementPosition, surfaceAt } from "../src/resident-movement.ts";

afterEach(() => setRoomLayout("desktop"));

// Desktop: the window glass fills the right of the room from the ceiling to the sill (x 1380..1840).
const DESKTOP_WINDOW_DROPS = [{ x: 1500, y: 300 }, { x: 1700, y: 200 }, { x: 1800, y: 100 }, { x: 1400, y: 450 }];
// Right of the loft's edge (x 1220) but left of the window sill: still not the loft.
const DESKTOP_BESIDE_LOFT = [{ x: 1300, y: 400 }, { x: 1260, y: 150 }];
// Portrait: loft-right ends at x 835; the window sill spans x 940..1040.
const PORTRAIT_WINDOW_DROPS = [{ x: 990, y: 200 }, { x: 1020, y: 100 }];

test("a drop high on the desktop window glass settles on the window sill, never upstairs", () => {
  for (const point of DESKTOP_WINDOW_DROPS) {
    assert.equal(isLoft(point), false, JSON.stringify(point));
    assert.equal(surfaceAt(point), "window", JSON.stringify(point));
    assert.deepEqual(placementPosition(point), { x: point.x, y: 685 }, JSON.stringify(point));
  }
});

test("a drop above the floor beside the loft edge lands on the ground floor", () => {
  for (const point of DESKTOP_BESIDE_LOFT) {
    assert.equal(isLoft(point), false, JSON.stringify(point));
    assert.equal(surfaceAt(point), "ground", JSON.stringify(point));
    assert.deepEqual(placementPosition(point), { x: point.x, y: 725 }, JSON.stringify(point));
  }
});

test("a drop genuinely on either desktop loft still resolves to that loft", () => {
  assert.equal(surfaceAt({ x: 620, y: 400 }), "loft-left");
  assert.equal(surfaceAt({ x: 1100, y: 400 }), "loft-right");
  assert.equal(surfaceAt({ x: 1200, y: 400 }), "loft-right");
  assert.deepEqual(placementPosition({ x: 1200, y: 400 }), { x: 1200, y: 400 });
});

test("a drop high on the portrait window settles on its sill, never upstairs", () => {
  setRoomLayout("portrait");
  for (const point of PORTRAIT_WINDOW_DROPS) {
    assert.equal(isLoft(point), false, JSON.stringify(point));
    assert.equal(surfaceAt(point), "window", JSON.stringify(point));
    assert.deepEqual(placementPosition(point), { x: point.x, y: 590 }, JSON.stringify(point));
  }
  assert.equal(surfaceAt({ x: 780, y: 330 }), "loft-right");
});
