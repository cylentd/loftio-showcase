import test from "node:test";
import assert from "node:assert/strict";
import { FLOOR_PLAY } from "../../src/floor-play-data.ts";
import { TRAVEL_OBSTACLES } from "../../src/travel-data.ts";
import { floorBody, fitFloor, stepFloor, type FloorBody } from "../../src/floor-play-model.ts";

const RADIUS = 40;
const FRAME_MS = 16;
const FRAMES = 200;
// Higher than a low side table (about a third of a resident) and lower than the terrarium on it.
const ABOVE_TABLE_BODY = 100;
const centre = () => TRAVEL_OBSTACLES[0]!;
const flying = (x: number, y: number, z: number): FloorBody => Object.assign(floorBody(x, y, RADIUS), { z, vz: 0, asleep: false });

test("a resident released over open floor beside the table falls straight to the floor, outside every footprint", () => {
  const b = flying(centre().left - RADIUS - 60, 790, centre().clearance! + 100);
  for (let i = 0; i < FRAMES && !b.asleep; i++) stepFloor([b], FRAME_MS);
  assert.deepEqual([b.x, b.y, b.z, b.asleep], [centre().left - RADIUS - 60, 790, 0, true]);
});

test("a low sideways toss into the table still stops at its side", () => {
  const b = flying(560, 790, 0);
  Object.assign(b, { vx: 1400, vz: FLOOR_PLAY.hopSpeed });
  let crossed = false;
  for (let i = 0; i < FRAMES && !b.asleep; i++) { stepFloor([b], FRAME_MS); crossed ||= b.x > centre().right + RADIUS; }
  assert.equal(crossed, false);
  assert.ok(b.x <= centre().left - RADIUS);
});

test("above the table's own height but beside the terrarium, a resident passes over the table body", () => {
  const b = flying(centre().left + 40, 780, ABOVE_TABLE_BODY);
  fitFloor(b);
  assert.deepEqual([b.x, b.y, b.impact], [centre().left + 40, 780, 0]);
});
