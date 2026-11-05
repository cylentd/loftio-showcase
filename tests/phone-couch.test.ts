import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { setRoomLayout } from "../src/room-layout.ts";
import { DragPlacement, residentDepth, residentSeat, surfaceAt } from "../src/resident-movement.ts";
import { PORTRAIT_CAST } from "../src/portrait-movement-data.ts";
import { travelRoute } from "../src/travel-route.ts";

afterEach(() => setRoomLayout("desktop"));

function releaseAt(point: { x: number; y: number }, scale: number) {
  const drag = new DragPlacement();
  const origin = { x: 500, y: 1120 };
  drag.begin("puff", 1, origin, origin, origin);
  const held = drag.move(1, point, point, scale);
  assert.deepEqual(held, point);
  assert.deepEqual(drag.landing, point);
  return drag.finish(1)?.position;
}

test("the shadow position is the release position on, behind and around the couch", () => {
  setRoomLayout("portrait");
  for (const scale of [844 / 1350, 780 / 1350]) {
    for (const point of [
      { x: 110, y: 720 }, { x: 170, y: 735 }, { x: 270, y: 740 },
      { x: 170, y: 670 }, { x: 30, y: 780 }, { x: 325, y: 760 },
      { x: 180, y: 780 }, { x: 200, y: 1000 }, { x: 440, y: 850 },
    ]) assert.deepEqual(releaseAt(point, scale), point);
  }
});

test("the cushion spans the couch but excludes its back and front fascia", () => {
  setRoomLayout("portrait");
  for (const point of [{ x: 110, y: 720 }, { x: 170, y: 735 }, { x: 270, y: 740 }]) {
    assert.equal(surfaceAt(point), "couch");
    assert.equal(residentDepth(point), 800);
  }
  assert.notEqual(surfaceAt({ x: 170, y: 670 }), "couch");
  assert.ok(residentDepth({ x: 170, y: 670 }) < 780);
  assert.notEqual(surfaceAt({ x: 325, y: 760 }), "couch");
  assert.equal(residentDepth({ x: 325, y: 760 }), 760);
  assert.equal(residentDepth({ x: 180, y: 1000 }), 1000);
});

test("only walking residents use the couch approach depth", () => {
  setRoomLayout("portrait");
  const route = travelRoute({ x: 500, y: 1120 }, { x: 170, y: 735 });
  assert.deepEqual(route.at(-1)?.from, { x: 420, y: 840 });
  const last = route.at(-1)!;
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    assert.ok(residentDepth({ x: last.from.x + (last.to.x - last.from.x) * progress, y: last.from.y + (last.to.y - last.from.y) * progress }, true) >= 780);
  }
});

test("phone chair seating uses no cloud booster or invisible support lift", () => {
  setRoomLayout("portrait");
  for (const point of [{ x: 190, y: 556 }, { x: 395, y: 535 }]) {
    for (const height of [80, 115, 140, 190]) assert.deepEqual(residentSeat(point, height), { height, lift: 0 });
  }
  setRoomLayout("desktop");
  assert.deepEqual(residentSeat({ x: 290, y: 698 }, 140), { height: 140, lift: 30 });
});

test("Puff starts in the middle of the phone room, leaving the foreground for message arrival", () => {
  assert.deepEqual(PORTRAIT_CAST.find(member => member.id === "puff")?.home, { x: 500, y: 810 });
});
