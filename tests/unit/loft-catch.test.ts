import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { setRoomLayout } from "../../src/room-layout.ts";
import { DragPlacement, restingPosition } from "../../src/resident-movement.ts";

afterEach(() => setRoomLayout("desktop"));

// Portrait decks (PORTRAIT_SURFACES): loft-left y 310..330 over x 250..610, loft-right y 320..340 over x 725..835.
// Everything between a deck's front edge and SURFACE_SPLIT (y 420) used to fall to the ground floor (back edge y 615, x 380..1015).
const PORTRAIT_CATCH = [
  { name: "just below the left deck", point: { x: 500, y: 345 }, lands: { x: 500, y: 330 } },
  { name: "in the middle of the dead zone under the left deck", point: { x: 500, y: 380 }, lands: { x: 500, y: 330 } },
  { name: "at the bottom of the zone, right above the split", point: { x: 500, y: 419 }, lands: { x: 500, y: 330 } },
  { name: "below the right deck", point: { x: 780, y: 400 }, lands: { x: 780, y: 340 } },
  { name: "in the gap between the decks, nearer the right one", point: { x: 690, y: 360 }, lands: { x: 725, y: 340 } },
  { name: "in the gap between the decks, nearer the left one", point: { x: 630, y: 380 }, lands: { x: 610, y: 330 } },
  { name: "just past the right deck's side edge", point: { x: 870, y: 380 }, lands: { x: 835, y: 340 } },
] as const;

for (const { name, point, lands } of PORTRAIT_CATCH) {
  test(`portrait: feet ${name} land on the loft`, () => {
    setRoomLayout("portrait");
    assert.deepEqual(restingPosition(point), lands);
  });
}

const PORTRAIT_GROUND = [
  { name: "well left of the left deck", point: { x: 100, y: 380 }, lands: { x: 380, y: 615 } },
  { name: "well right of the right deck", point: { x: 930, y: 400 }, lands: { x: 930, y: 615 } },
  { name: "beside the right deck at deck height, where there is only wall", point: { x: 870, y: 335 }, lands: { x: 870, y: 615 } },
] as const;

for (const { name, point, lands } of PORTRAIT_GROUND) {
  test(`portrait: feet ${name} still land on the ground floor`, () => {
    setRoomLayout("portrait");
    assert.deepEqual(restingPosition(point), lands);
  });
}

test("portrait: feet at or below the loft/ground split stay where they were let go", () => {
  setRoomLayout("portrait");
  assert.deepEqual(restingPosition({ x: 500, y: 420 }), { x: 500, y: 420 });
  assert.deepEqual(restingPosition({ x: 500, y: 425 }), { x: 500, y: 425 });
});

test("portrait: a finger on the deck with the feet carried below it lands on the deck", () => {
  setRoomLayout("portrait");
  const drag = new DragPlacement();
  // Grabbed by the body: the feet ride 60 world px below the finger.
  drag.begin("chomper", 1, { x: 0, y: 0 }, { x: 500, y: 700 }, { x: 500, y: 760 });
  drag.move(1, { x: 0, y: 100 }, { x: 500, y: 320 });
  assert.deepEqual(drag.finish(1)?.position, { x: 500, y: 330 });
});

test("desktop: the dead zone under a loft still falls to the ground floor", () => {
  assert.deepEqual(restingPosition({ x: 500, y: 430 }), { x: 500, y: 725 });
  assert.deepEqual(restingPosition({ x: 1100, y: 420 }), { x: 1100, y: 725 });
});
