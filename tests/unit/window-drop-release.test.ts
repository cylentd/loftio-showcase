import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { setRoomLayout } from "../../src/room-layout.ts";
import { DragPlacement } from "../../src/resident-movement.ts";
import { PLACEMENT, SURFACES } from "../../src/resident-movement-data.ts";

afterEach(() => setRoomLayout("desktop"));

// The pointer-up handler takes the resident's resting spot from DragPlacement.finish.
function releaseAt(point: { x: number; y: number }) {
  const drag = new DragPlacement();
  drag.begin("chomper", 1, { x: 100, y: 100 }, { x: 1100, y: 800 }, { x: 1100, y: 800 });
  drag.move(1, { x: 100, y: 140 }, point);
  return drag.finish(1)?.position;
}

const CASES = [
  { layout: "desktop", name: "upper glass", point: { x: 1500, y: 150 }, floor: "window" },
  { layout: "desktop", name: "middle glass", point: { x: 1700, y: 400 }, floor: "window" },
  { layout: "desktop", name: "lower glass", point: { x: 1600, y: 620 }, floor: "window" },
  { layout: "desktop", name: "wall beside the loft", point: { x: 1300, y: 300 }, floor: "ground" },
  { layout: "portrait", name: "upper glass", point: { x: 990, y: 150 }, floor: "window" },
  { layout: "portrait", name: "wall beside the loft", point: { x: 880, y: 300 }, floor: "ground" },
] as const;

for (const { layout, name, point, floor } of CASES) {
  test(`a ${layout} release on the ${name} falls to the floor straight below`, () => {
    setRoomLayout(layout);
    const back = floor === "window" ? SURFACES.window.back : PLACEMENT.back;
    assert.deepEqual(releaseAt(point), { x: point.x, y: back });
  });
}

test("a release on the right loft still stays on the loft", () => {
  assert.deepEqual(releaseAt({ x: 1100, y: 395 }), { x: 1100, y: 395 });
});

test("a cancelled drag over the glass returns to where it started", () => {
  const drag = new DragPlacement();
  drag.begin("chomper", 1, { x: 100, y: 100 }, { x: 1100, y: 800 }, { x: 1100, y: 800 });
  drag.move(1, { x: 100, y: 140 }, { x: 1500, y: 150 });
  assert.deepEqual(drag.finish(1, true)?.position, { x: 1100, y: 800 });
});
