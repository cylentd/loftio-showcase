import test from "node:test";
import assert from "node:assert/strict";
import { FLOOR_PLAY } from "../../src/floor-play-data.ts";
import { PLACEMENT } from "../../src/resident-movement-data.ts";
import { TRAVEL_OBSTACLES } from "../../src/travel-data.ts";
import { floorBody, stepFloor, slidesOffTable, type FloorBody } from "../../src/floor-play-model.ts";

const HOODIE_DROP = { x: 905, y: 790 };
const HELD_LIFT = 30;
const FRAME_MS = 16;
const RADIUS = 40;
const ROUNDING = 1e-6;
const far = { x: 0, y: 0 };
const table = () => TRAVEL_OBSTACLES[0]!;
const inside = (b: { x: number; y: number }) =>
  b.x > table().left - RADIUS && b.x < table().right + RADIUS &&
  b.y > table().back - RADIUS * FLOOR_PLAY.depthScale && b.y < table().front + RADIUS * FLOOR_PLAY.depthScale;

test("a drop on the middle table's footprint slides off it", () => {
  assert.equal(slidesOffTable(HOODIE_DROP, far, PLACEMENT.interestRadius), true);
});

test("drops beside, behind or above the table are left exactly where they were put", () => {
  for (const point of [{ x: 700, y: 850 }, { x: 980, y: 690 }, { x: 900, y: 400 }, { x: 1300, y: 790 }, { x: 400, y: 700 }]) {
    assert.equal(slidesOffTable(point, far, PLACEMENT.interestRadius), false, JSON.stringify(point));
  }
});

test("a drop at the resident's own favorite stays put so its arrival still plays", () => {
  assert.equal(slidesOffTable(HOODIE_DROP, HOODIE_DROP, PLACEMENT.interestRadius), false);
});

test("the dropped resident walks off in small steps, ends outside the footprint and asleep", () => {
  const b: FloorBody = Object.assign(floorBody(HOODIE_DROP.x, HOODIE_DROP.y, RADIUS), { z: HELD_LIFT, asleep: false });
  let widest = 0, travelled = 0;
  for (let i = 0; i < 400 && !b.asleep; i++) {
    const [x, y] = [b.x, b.y];
    stepFloor([b], FRAME_MS);
    widest = Math.max(widest, Math.hypot(b.x - x, b.y - y)); travelled += Math.hypot(b.x - x, b.y - y);
  }
  assert.equal(b.asleep, true);
  assert.equal(inside(b), false);
  assert.ok(travelled > 0, "it never moved");
  assert.ok(widest <= FLOOR_PLAY.slideSpeed * FRAME_MS / FLOOR_PLAY.seconds + ROUNDING, `moved ${widest} px in one frame`);
});
