import assert from "node:assert/strict";
import { test } from "node:test";
import { DragPlacement, floorPosition, worldPoint, landingPose } from "../src/resident-movement.ts";

test("screen coordinates account for scale, scroll, camera and cast parallax", () => {
  assert.deepEqual(worldPoint({ x: 300, y: 450 }, { scale: 0.5, left: -200, top: -50 }), { x: 1000, y: 1000 });
});

test("placement stays on the room floor, including sloped side limits", () => {
  assert.deepEqual(floorPosition({ x: -500, y: -80 }), { x: 390, y: 725 });
  assert.deepEqual(floorPosition({ x: 2500, y: 1400 }), { x: 1770, y: 1020 });
  assert.deepEqual(floorPosition({ x: 1000, y: 890 }), { x: 1000, y: 890 });
});

test("a tap or small hand tremor is not a drag", () => {
  const drag = new DragPlacement();
  assert.equal(drag.begin("puff", 4, { x: 100, y: 100 }, { x: 1000, y: 800 }, { x: 1010, y: 895 }), true);
  assert.equal(drag.move(4, { x: 104, y: 103 }, { x: 1004, y: 803 }), null);
  assert.deepEqual(drag.finish(4), { id: "puff", moved: false, position: { x: 1010, y: 895 } });
});

test("drag preserves grab offset and ignores other fingers", () => {
  const drag = new DragPlacement();
  drag.begin("puff", 4, { x: 100, y: 100 }, { x: 1000, y: 800 }, { x: 1010, y: 895 });
  assert.equal(drag.begin("slime", 5, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 560, y: 850 }), false);
  assert.equal(drag.move(5, { x: 200, y: 200 }, { x: 1100, y: 900 }), null);
  assert.deepEqual(drag.move(4, { x: 200, y: 120 }, { x: 1100, y: 820 }), { x: 1110, y: 915 });
  assert.equal(drag.finish(5), null);
  assert.deepEqual(drag.finish(4), { id: "puff", moved: true, position: { x: 1110, y: 915 } });
});

test("cancel restores the original location even after movement", () => {
  const drag = new DragPlacement();
  drag.begin("puff", 1, { x: 10, y: 10 }, { x: 1000, y: 800 }, { x: 1010, y: 895 });
  drag.move(1, { x: 100, y: 100 }, { x: 1200, y: 900 });
  assert.deepEqual(drag.finish(1, true), { id: "puff", moved: true, position: { x: 1010, y: 895 } });
  assert.equal(drag.finish(1), null);
});

test("release starts at the held height, settles on the floor, then returns to rest", () => {
  assert.equal(landingPose(0).lift, 0.14);
  assert.equal(landingPose(0).air, 0.5);
  assert.equal(landingPose(0.45).lift, 0);
  assert.ok(landingPose(0.7).sx > 1);
  assert.ok(landingPose(0.7).sy < 1);
  assert.deepEqual(landingPose(1), { lift: 0, air: 0, sx: 1, sy: 1, rot: 0 });
});
