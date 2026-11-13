import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { setRoomLayout } from "../../src/room-layout.ts";
import { DragPlacement, fallDrop, fallMs, fallPose } from "../../src/resident-movement.ts";
import { PLACEMENT, SURFACES } from "../../src/resident-movement-data.ts";
import { FLOOR_PLAY } from "../../src/floor-play-data.ts";
import { IDLE } from "../../src/tune.ts";

afterEach(() => setRoomLayout("desktop"));

// The pointer-up handler takes the resident's resting spot from DragPlacement.finish.
function releaseAt(point: { x: number; y: number }) {
  const drag = new DragPlacement();
  drag.begin("chomper", 1, { x: 100, y: 100 }, { x: 1100, y: 800 }, { x: 1100, y: 800 });
  drag.move(1, { x: 100, y: 140 }, point);
  return drag.finish(1)?.position;
}

// x picks a spot over the deck but clear of the bed on it, or over the bed itself.
const AIR = [
  { layout: "desktop", name: "left loft", point: { x: 700, y: 250 }, surface: "loft-left" },
  { layout: "desktop", name: "right loft", point: { x: 1180, y: 200 }, surface: "loft-right" },
  { layout: "desktop", name: "left bed", point: { x: 500, y: 150 }, surface: "bed-left" },
  { layout: "desktop", name: "right bed", point: { x: 1100, y: 120 }, surface: "bed-right" },
  { layout: "portrait", name: "left loft", point: { x: 500, y: 150 }, surface: "loft-left" },
  { layout: "portrait", name: "right loft", point: { x: 820, y: 150 }, surface: "loft-right" },
  { layout: "portrait", name: "left bed", point: { x: 350, y: 120 }, surface: "bed-left" },
] as const;

for (const { layout, name, point, surface } of AIR) {
  test(`a ${layout} release in the air above the ${name} comes to rest on it, straight below`, () => {
    setRoomLayout(layout);
    assert.deepEqual(releaseAt(point), { x: point.x, y: SURFACES[surface].back });
  });
}

test("a release standing on a loft deck stays exactly where it was let go", () => {
  assert.deepEqual(releaseAt({ x: 700, y: 395 }), { x: 700, y: 395 });
});

for (const point of [{ x: 900, y: 400 }, { x: 700, y: 450 }, { x: 900, y: 250 }]) {
  test(`unsupported loft boundary ${point.x},${point.y} falls straight to ground`, () => {
    assert.deepEqual(releaseAt(point), { x: point.x, y: 725 });
  });
}

test("the expanding edge of a loft catches a vertical fall without moving it sideways", () => {
  assert.deepEqual(releaseAt({ x: 357.5, y: 250 }), { x: 357.5, y: 395 });
});

const HEIGHT = 150; // a resident's drawn height in world px

test("the fall starts at the release height plus the held lift, and none when nothing is below", () => {
  assert.equal(fallDrop({ x: 700, y: 250 }, { x: 700, y: 380 }, HEIGHT), 130 + HEIGHT * PLACEMENT.lift);
  assert.equal(fallDrop({ x: 700, y: 395 }, { x: 700, y: 395 }, HEIGHT), 0);
});

// Free fall from rest under the gravity thrown residents use: lift(t) = drop - g t² / 2.
for (const ms of [0, 100, 250]) {
  test(`${ms} ms after release the resident is still in the air, where gravity puts it`, () => {
    const drop = 500, seconds = ms / FLOOR_PLAY.seconds;
    const pose = fallPose(ms, drop);
    assert.ok(Math.abs(pose.lift - (drop - FLOOR_PLAY.gravity * seconds ** 2 / 2)) < 1e-9, `lift ${pose.lift}`);
    assert.ok(pose.lift > 0);
  });
}

test("the fall touches down when gravity says it does, squashes, then rests", () => {
  const drop = 500, air = Math.sqrt(2 * drop / FLOOR_PLAY.gravity) * FLOOR_PLAY.seconds;
  assert.ok(Math.abs(fallMs(drop) - air) < 1e-9);
  assert.equal(fallPose(air, drop).lift, 0);
  assert.ok(fallPose(air + IDLE.pressMs / 4, drop).sx > 1, "landing squash");
  assert.deepEqual(fallPose(air + IDLE.pressMs, drop), { lift: 0, air: 0, sx: 1, sy: 1, rot: 0 });
});

test("a higher release takes longer to land than a lower one", () => {
  assert.ok(fallMs(fallDrop({ x: 1300, y: 100 }, { x: 1300, y: PLACEMENT.back }, HEIGHT))
    > fallMs(fallDrop({ x: 1300, y: 600 }, { x: 1300, y: PLACEMENT.back }, HEIGHT)));
});
