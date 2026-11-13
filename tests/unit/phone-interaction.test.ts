import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { setRoomLayout } from "../../src/room-layout.ts";
import { isSitting, residentDepth, surfaceAt, DragPlacement } from "../../src/resident-movement.ts";
import { PORTRAIT_CAST } from "../../src/portrait-movement-data.ts";
import { travelRoute } from "../../src/travel-route.ts";
import { seatAvailable } from "../../src/seat-occupancy.ts";
import { bubbleMetrics } from "../../src/bubble-model.ts";
import { canWander } from "../../src/wander-model.ts";

afterEach(() => setRoomLayout("desktop"));

test("a resident carrying a foreground message does not wander away", () => {
  assert.equal(canWander(true, false, false, 0, 0, true), false);
  assert.equal(canWander(true, false, false, 0, 0, false), true);
  assert.equal(canWander(true, true, false, 0, 0, true), false);
});

test("the portrait couch is a seat, not a desktop floor seat", () => {
  setRoomLayout("portrait");
  const seat = { x: 170, y: 735 };
  assert.equal(surfaceAt(seat), "couch");
  assert.equal(isSitting(seat), true);
  assert.equal(residentDepth(seat), 800);
  assert.equal(seatAvailable(seat, [{ x: 180, y: 740 }]), false);
  setRoomLayout("desktop");
  assert.equal(isSitting(seat), false);
});

test("a phone resident reaches the couch through its floor approach and can return", () => {
  setRoomLayout("portrait");
  const floor = { x: 500, y: 1120 };
  const seat = { x: 170, y: 735 };
  const outward = travelRoute(floor, seat);
  assert.ok(outward.some(leg => leg.to.x === 420 && leg.to.y === 840));
  assert.deepEqual(outward.at(-1)?.to, seat);
  assert.deepEqual(travelRoute(seat, floor).at(-1)?.to, floor);
});

test("dragging onto the phone couch lands on its cushion rather than the floor", () => {
  setRoomLayout("portrait");
  const drag = new DragPlacement();
  drag.begin("puff", 1, { x: 500, y: 1120 }, { x: 500, y: 1120 }, { x: 500, y: 1120 });
  drag.move(1, { x: 170, y: 735 }, { x: 170, y: 735 });
  assert.deepEqual(drag.finish(1)?.position, { x: 170, y: 735 });
});

test("phone homes keep other residents downstage and Puff away from the message destination", () => {
  const carrier = PORTRAIT_CAST.find(member => member.id === "puff")!;
  const couchResident = PORTRAIT_CAST.find(member => member.id === "hoodie")!;
  assert.deepEqual(carrier.home, { x: 500, y: 810 });
  assert.deepEqual(couchResident.home, { x: 170, y: 735 });
  for (const name of ["sprout", "chomper"]) assert.ok(PORTRAIT_CAST.find(member => member.id === name)!.home.y >= 900);
});

test("bubble geometry follows the displayed resident height rather than fixed viewport sizing", () => {
  const small = bubbleMetrics(80);
  const large = bubbleMetrics(140);
  assert.equal(small.width, 132);
  assert.equal(large.width, 231);
  assert.equal(small.scale, 0.72);
  assert.equal(large.scale, 1);
});

test("bubble geometry stays bounded for tiny and very large residents", () => {
  assert.deepEqual(bubbleMetrics(0), { width: 128, scale: 0.72 });
  assert.deepEqual(bubbleMetrics(300), { width: 240, scale: 1.12 });
});
