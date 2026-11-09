import assert from "node:assert/strict";
import { test } from "node:test";
import { SPACE } from "../src/personal-space-data.ts";
import { canStand, floorOf, separate, type SpaceBody, type Occupant } from "../src/personal-space.ts";

const RADIUS = 30;
const FRAME_MS = 16;
const SECOND_MS = 1000;
const body = (x: number, y: number, over: Partial<SpaceBody> = {}): SpaceBody => ({ x, y, radius: RADIUS, floor: "ground", heading: null, ...over });
const east = { x: 1, y: 0 };
const west = { x: -1, y: 0 };

/** Runs the pass the way the room does: a walker's path is fixed, a sidestep is an offset on top of it. */
function simulate(bodies: SpaceBody[], paths: ((t: number) => { x: number; y: number }) [], steps: number) {
  const offsets = bodies.map(() => ({ x: 0, y: 0 }));
  for (let step = 1; step <= steps; step += 1) {
    bodies.forEach((b, i) => { const p = paths[i]!(step / steps); b.x = p.x + offsets[i]!.x; b.y = p.y + offsets[i]!.y; });
    separate(bodies, FRAME_MS).forEach((s, i) => { offsets[i]!.x += s.dx; offsets[i]!.y += s.dy; });
  }
  return offsets;
}

const rest: Occupant = { surface: "ground", held: false, walking: false, paused: false, climbing: false, posedByPlay: false };

test("open ground and each loft are separate floors; every other state has no body", () => {
  assert.equal(floorOf(rest), "ground");
  assert.equal(floorOf({ ...rest, surface: "loft-left" }), "loft-left");
  assert.equal(floorOf({ ...rest, surface: "loft-right" }), "loft-right");
  assert.equal(floorOf({ ...rest, walking: true }), "ground");
  for (const surface of ["chair-left", "chair-right", "table", "lounge", "ottoman", "bed-left", "bed-right", "couch", "window"]) {
    assert.equal(floorOf({ ...rest, surface }), null, surface);
  }
  assert.equal(floorOf({ ...rest, held: true }), null);
  assert.equal(floorOf({ ...rest, walking: true, climbing: true }), null);
  assert.equal(floorOf({ ...rest, paused: true }), null);
  assert.equal(floorOf({ ...rest, posedByPlay: true }), null);
});

test("two overlapping walkers on the ground end up apart after a few steps", () => {
  const a = body(500, 900, { heading: east });
  const b = body(520, 900, { heading: west });
  for (let step = 0; step < 60; step += 1) {
    separate([a, b], FRAME_MS).forEach((shove, i) => { const mover = i ? b : a; mover.x += shove.dx; mover.y += shove.dy; });
  }
  const apart = Math.hypot(b.x - a.x, (b.y - a.y) / SPACE.depthScale);
  assert.ok(apart >= 2 * RADIUS - 1, `apart ${apart}`);
});

test("a walker sidesteps across its heading and is not shoved along it", () => {
  const walker = body(500, 900, { heading: east });
  const idle = body(520, 900);
  const [w] = separate([walker, idle], FRAME_MS);
  assert.ok(Math.abs(w!.dy) > Math.abs(w!.dx), `${w!.dx},${w!.dy}`);
});

test("an idle resident yields less than the walker that bumps it", () => {
  const [w, i] = separate([body(500, 900, { heading: east }), body(555, 900)], FRAME_MS); // a shallow overlap, under the step cap
  const effort = (s: { dx: number; dy: number }) => Math.hypot(s.dx, s.dy / SPACE.depthScale); // in footprint space
  assert.ok(effort(i!) > 0);
  assert.ok(effort(i!) < effort(w!));
});

test("one step never moves a resident further than the cap", () => {
  const cap = RADIUS * SPACE.maxSpeed * FRAME_MS / SECOND_MS;
  const crowd = [body(500, 900), body(500, 900, { heading: east }), body(505, 900), body(500, 902, { heading: west })];
  for (const s of separate(crowd, FRAME_MS)) assert.ok(Math.hypot(s.dx, s.dy / SPACE.depthScale) <= cap + 1e-9, `${s.dx},${s.dy}`);
  assert.ok(separate(crowd, FRAME_MS).some((s) => s.dx || s.dy));
});

test("a body with no floor is not moved and pushes nobody", () => {
  const exempt = body(500, 900, { floor: null });
  const other = body(510, 900, { heading: east });
  const [e, o] = separate([exempt, other], FRAME_MS);
  assert.deepEqual(e, { dx: 0, dy: 0 });
  assert.deepEqual(o, { dx: 0, dy: 0 });
});

test("residents on different floors never interact", () => {
  const shoves = separate([body(900, 400, { floor: "loft-left" }), body(900, 400, { floor: "loft-right" }), body(900, 400, { floor: "ground" })], FRAME_MS);
  for (const s of shoves) assert.deepEqual(s, { dx: 0, dy: 0 });
});

test("residents farther apart than their footprints do not push", () => {
  const apart = 2 * RADIUS + 1;
  for (const s of separate([body(500, 900, { heading: east }), body(500 + apart, 900)], FRAME_MS)) assert.deepEqual(s, { dx: 0, dy: 0 });
});

test("footprints are flat: the same gap in depth is closer than across", () => {
  const across = separate([body(500, 900), body(500 + 2 * RADIUS - 5, 900)], FRAME_MS)[0]!;
  const depth = separate([body(500, 900), body(500, 900 + 2 * RADIUS - 5)], FRAME_MS)[0]!;
  assert.ok(Math.abs(across.dx) > 0, "overlaps across at 55px");
  assert.deepEqual(depth, { dx: 0, dy: 0 }, "55px in depth is clear of a squashed footprint");
});

test("a push that the floor refuses is dropped, never clamped sideways", () => {
  const stand = (_i: number, _x: number, y: number) => y >= 900;
  const [walker, idle] = separate([body(500, 900, { heading: west }), body(520, 900)], FRAME_MS, stand);
  assert.deepEqual(walker, { dx: 0, dy: 0 }, "its sidestep goes to y < 900, which the floor refuses");
  assert.ok(idle!.dx > 0, "the neighbour's push along the floor is still fine");
});

test("head-on walkers pass on their own right, and each still arrives", () => {
  const a = body(800, 900, { heading: east });
  const b = body(1000, 900, { heading: west });
  const offsets = simulate([a, b], [(t) => ({ x: 800 + 200 * t, y: 900 }), (t) => ({ x: 1000 - 200 * t, y: 900 })], 60);
  assert.ok(Math.abs(a.x - 1000) <= RADIUS * SPACE.maxOffset + 1, `a.x ${a.x}`);
  assert.ok(Math.abs(offsets[0]!.y) > 0 && Math.sign(offsets[0]!.y) === -Math.sign(offsets[1]!.y), "opposite sides");
  assert.ok(Math.abs(a.y - b.y) > 0);
});

test("a walker's path is untouched, so separation cannot stall it", () => {
  const a = body(800, 900, { heading: east });
  const b = body(1000, 900, { heading: west });
  simulate([a, b], [(t) => ({ x: 800 + 200 * t, y: 900 }), (t) => ({ x: 1000 - 200 * t, y: 900 })], 60);
  const reach = RADIUS * SPACE.maxOffset;
  assert.ok(Math.hypot(a.x - 1000, a.y - 900) <= reach + 1);
  assert.ok(Math.hypot(b.x - 800, b.y - 900) <= reach + 1);
});

test("the floor accepts open ground and refuses the walls, the table and the world's edge", () => {
  const from = { x: 1300, y: 900 };
  assert.equal(canStand("ground", from, { x: 1310, y: 905 }), true);
  assert.equal(canStand("ground", from, { x: -20, y: 905 }), false, "past the world edge");
  assert.equal(canStand("ground", { x: 310, y: 900 }, { x: 280, y: 900 }), false, "off the floor polygon");
  assert.equal(canStand("ground", { x: 1200, y: 780 }, { x: 1100, y: 780 }), false, "into the coffee table");
  assert.equal(canStand("ground", { x: 1200, y: 780 }, { x: 1195, y: 780 }), true, "stays clear of it");
});

test("a loft push never lands on the other loft or in the ladder gap", () => {
  assert.equal(canStand("loft-left", { x: 800, y: 400 }, { x: 810, y: 400 }), true);
  assert.equal(canStand("loft-left", { x: 830, y: 400 }, { x: 850, y: 400 }), false, "past the loft's end");
  assert.equal(canStand("loft-right", { x: 1100, y: 400 }, { x: 1110, y: 405 }), true);
});
