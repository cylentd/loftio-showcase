import test from "node:test";
import assert from "node:assert/strict";
import { FLOOR_PLAY } from "../../src/floor-play-data.ts";
import { setRoomLayout } from "../../src/room-layout.ts";
import { TRAVEL_OBSTACLES } from "../../src/travel-data.ts";
import { floorBody, fitFloor, stepFloor, type FloorBody } from "../../src/floor-play-model.ts";

const RADIUS = 40;
const FRAME_MS = 16;
const HIGH = 500;
const ROUNDING = 1e-6;
const centre = () => TRAVEL_OBSTACLES[0]!;
const puzzle = () => TRAVEL_OBSTACLES[1]!;
const inside = (o: { left: number; right: number; back: number; front: number }, b: { x: number; y: number }) =>
  b.x > o.left - RADIUS && b.x < o.right + RADIUS &&
  b.y > o.back - RADIUS * FLOOR_PLAY.depthScale && b.y < o.front + RADIUS * FLOOR_PLAY.depthScale;
const flying = (x: number, y: number, z: number): FloorBody => Object.assign(floorBody(x, y, RADIUS), { z, vz: 0, asleep: false });

test("only the measured centre table gives a clearance height", () => {
  assert.ok(centre().clearance! > 0);
  assert.equal(puzzle().clearance, undefined);
});

test("a resident above the centre table's height is not pushed out of its footprint", () => {
  const b = flying(950, 780, centre().clearance! + 40);
  fitFloor(b);
  assert.deepEqual([b.x, b.y, b.impact], [950, 780, 0]);
});

test("a resident below the centre table's height is still pushed out of its footprint", () => {
  const b = flying(950, 780, centre().clearance! - 40);
  fitFloor(b);
  assert.equal(inside(centre(), b), false);
  assert.equal(b.impact, 1);
});

test("a high sideways toss clears the footprint at the ladder instead of rebounding off it", () => {
  const b = flying(560, 790, 0);
  Object.assign(b, { vx: 1400, vz: 1150 });
  let reachedFarSide = false;
  for (let i = 0; i < 90 && !b.asleep; i++) { stepFloor([b], FRAME_MS); reachedFarSide ||= b.x > centre().right + RADIUS; }
  assert.equal(reachedFarSide, true);
});

test("a toss that comes down inside the footprint slides out in small steps and never rests inside", () => {
  const b = flying(800, 790, centre().clearance! + 150);
  let widest = 0;
  for (let i = 0; i < 400 && !b.asleep; i++) {
    const [x, y] = [b.x, b.y];
    stepFloor([b], FRAME_MS);
    widest = Math.max(widest, Math.hypot(b.x - x, b.y - y));
  }
  assert.equal(b.asleep, true);
  assert.equal(inside(centre(), b), false);
  assert.ok(widest <= FLOOR_PLAY.slideSpeed * FRAME_MS / FLOOR_PLAY.seconds + ROUNDING, `moved ${widest} px in one frame`);
});

test("an unmeasured desktop obstacle deflects at any height", () => {
  const b = flying(400, 700, HIGH);
  fitFloor(b);
  assert.equal(inside(puzzle(), b), false);
  assert.equal(b.impact, 1);
});

test("the portrait obstacles: the table is measured, the others deflect at any height", () => {
  setRoomLayout("portrait");
  try {
    assert.ok(TRAVEL_OBSTACLES[0]!.clearance! > 0);
    assert.equal(TRAVEL_OBSTACLES[2]!.clearance, undefined);
    const b = flying(330, 800, HIGH);
    fitFloor(b);
    assert.equal(inside(TRAVEL_OBSTACLES[2]!, b), false);
    assert.equal(b.impact, 1);
  } finally { setRoomLayout("desktop"); }
});
