import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { roomData, roomFrame, roomLayoutFor, setRoomLayout } from "../src/room-layout.ts";
import { WORLD } from "../src/tune.ts";
import { floorPosition, surfaceAt, DragPlacement } from "../src/resident-movement.ts";
import { travelRoute } from "../src/travel-route.ts";
import { GLASS, FOLIAGE } from "../src/effects-constants.ts";
import { PORTRAIT_CAST, PORTRAIT_NODES } from "../src/portrait-movement-data.ts";
import { TRAVEL_NODES } from "../src/travel-data.ts";
import { onGlass } from "../src/effects-model.ts";

afterEach(() => setRoomLayout("desktop"));

test("portrait screens use the portrait painting, including tablets, while landscape keeps desktop", () => {
  assert.equal(roomLayoutFor(390, 844), "portrait");
  assert.equal(roomLayoutFor(768, 1024), "portrait");
  assert.equal(roomLayoutFor(844, 390), "desktop");
  assert.equal(roomLayoutFor(1440, 900), "desktop");
});

test("switching rooms updates nested geometry in place and restores the desktop map", () => {
  const data = roomData({ width: 1920, seats: [{ x: 300, y: 698 }] }, { width: 1080, seats: [{ x: 190, y: 556 }] });
  const seat = data.seats[0];
  setRoomLayout("portrait");
  assert.equal(data.width, 1080);
  assert.equal(data.seats[0], seat);
  assert.deepEqual(seat, { x: 190, y: 556 });
  setRoomLayout("desktop");
  assert.equal(data.width, 1920);
  assert.deepEqual(seat, { x: 300, y: 698 });
});

test("portrait fits the painting height without overscan and leaves horizontal swipe room", () => {
  const frame = roomFrame(390, 844, { width: 1080, height: 1350 }, 1);
  assert.equal(frame.scale, 844 / 1350);
  assert.equal(frame.offsetY, 0);
  assert.ok(frame.width > 390);
  assert.equal(roomFrame(360, 780, { width: 1080, height: 1350 }, 1).offsetY, 0);
});

test("portrait feet clamp to its floor, cushions and loft rather than the desktop furniture", () => {
  setRoomLayout("portrait");
  assert.deepEqual(WORLD, { width: 1080, height: 1350 });
  assert.deepEqual(floorPosition({ x: 0, y: 1400 }), { x: 250, y: 1240 });
  assert.equal(surfaceAt({ x: 190, y: 556 }), "chair-left");
  assert.equal(surfaceAt({ x: 550, y: 505 }), "lounge");
  assert.equal(surfaceAt({ x: 760, y: 308 }), "bed-right");
});

test("portrait bed trips climb the painted diagonal ladder and return by the same route", () => {
  setRoomLayout("portrait");
  const outward = travelRoute({ x: 840, y: 930 }, { x: 350, y: 285 });
  const climb = outward.find(leg => leg.motion === "climb");
  assert.deepEqual(climb?.from, { x: 735, y: 565 });
  assert.deepEqual(climb?.to, { x: 640, y: 320 });
  const homeward = travelRoute({ x: 760, y: 308 }, { x: 690, y: 1000 });
  assert.deepEqual(homeward.find(leg => leg.motion === "climb")?.to, { x: 735, y: 565 });
  assert.deepEqual(homeward.at(-1)?.to, { x: 690, y: 1000 });
});

test("portrait floor routes go around the coffee table, not through its painted top", () => {
  setRoomLayout("portrait");
  const route = travelRoute({ x: 610, y: 810 }, { x: 735, y: 565 });
  assert.ok(route.length > 1);
  for (const leg of route) for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const pointX = leg.from.x + (leg.to.x - leg.from.x) * progress;
    const pointY = leg.from.y + (leg.to.y - leg.from.y) * progress;
    assert.ok(!(pointX > 470 && pointX < 780 && pointY > 580 && pointY < 665));
  }
});

test("portrait carry bounds reach the lower floor, including after a room switch", () => {
  setRoomLayout("portrait");
  const drag = new DragPlacement();
  drag.begin("puff", 1, { x: 610, y: 810 }, { x: 610, y: 810 }, { x: 610, y: 810 });
  assert.deepEqual(drag.move(1, { x: 700, y: 1200 }, { x: 700, y: 1200 }), { x: 700, y: 1200 });
  assert.deepEqual(drag.finish(1)?.position, { x: 700, y: 1200 });
});

test("portrait foliage and glass masks stay inside the portrait painting", () => {
  setRoomLayout("portrait");
  assert.ok(GLASS.length > 0);
  assert.ok(GLASS.every(polygon => polygon.every((value, index) => value >= 0 && value <= (index % 2 === 0 ? 1080 : 1350))));
  assert.ok(FOLIAGE.every(patch => patch.x + patch.w <= 1080 && patch.y + patch.h <= 1350));
});

test("every portrait resident can reach its favorite and every seat can be visited from the floor", () => {
  setRoomLayout("portrait");
  for (const member of PORTRAIT_CAST) {
    const route = travelRoute(member.home, member.interest);
    assert.ok(route.length > 0, member.id);
    assert.deepEqual(route.at(-1)?.to, member.interest);
  }
  for (const node of PORTRAIT_NODES.filter(node => /^(bed|chair)-|^lounge$|^ottoman$/.test(node.zone))) {
    const route = travelRoute({ x: 840, y: 930 }, node);
    assert.ok(route.length > 0, node.id);
    assert.deepEqual(route.at(-1)?.to, { x: node.x, y: node.y });
  }
});

test("repeated portrait-landscape changes restore routes and dimensions without accumulating distortion", () => {
  for (const layout of ["portrait", "desktop", "portrait", "desktop"] as const) {
    setRoomLayout(layout);
    const ladder = TRAVEL_NODES.find(node => node.id === "ladder-top");
    assert.equal(WORLD.width, layout === "portrait" ? 1080 : 1920);
    assert.equal(ladder?.x, layout === "portrait" ? 640 : 932);
    assert.equal(ladder?.y, layout === "portrait" ? 320 : 400);
  }
});

test("portrait rain stays on open glass rather than mullions, lanterns or floor", () => {
  setRoomLayout("portrait");
  assert.equal(onGlass({ x: 1000, y: 200 }), true);
  assert.equal(onGlass({ x: 1000, y: 370 }), true);
  for (const point of [{ x: 940, y: 200 }, { x: 1000, y: 294 }, { x: 872, y: 295 }, { x: 500, y: 500 }, { x: 1000, y: 700 }]) {
    assert.equal(onGlass(point), false, JSON.stringify(point));
  }
});
