import assert from "node:assert/strict";
import { test } from "node:test";
import { placementPosition, surfaceAt, residentDepth, residentSeat } from "../../src/resident-movement.ts";
import { wanderTarget } from "../../src/wander-model.ts";

test("the pink lounge cushion and cream ottoman accept feet on their painted tops", () => {
  for (const [point, surface] of [
    [{ x: 770, y: 622 }, "lounge"],
    [{ x: 1250, y: 646 }, "ottoman"],
  ] as const) {
    assert.equal(surfaceAt(point), surface);
    assert.deepEqual(placementPosition(point), point);
  }
});

test("lounge and ottoman wandering stay on the chosen seat instead of stepping off", () => {
  for (const [home, surface] of [[{ x: 770, y: 622 }, "lounge"], [{ x: 1250, y: 646 }, "ottoman"]] as const) {
    for (const random of [0, 0.5, 0.999]) {
      const target = wanderTarget(home, { x: 1100, y: 950 }, "home", random);
      assert.equal(surfaceAt(target), surface);
      assert.deepEqual(placementPosition(target), target);
    }
  }
});

test("table-chair residents retain natural height without moving their placement coordinates", () => {
  assert.equal(residentSeat({ x: 290, y: 698 }, 140).height, 140);
  assert.equal(residentSeat({ x: 530, y: 680 }, 140).height, 140);
  assert.equal(residentSeat({ x: 290, y: 698 }, 190).height, 190);
  assert.equal(residentSeat({ x: 800, y: 900 }, 140).height, 140);
  assert.equal(residentSeat({ x: 770, y: 622 }, 140).height, 140);
  assert.deepEqual(placementPosition({ x: 290, y: 698 }), { x: 290, y: 698 });
});

test("chair support raises short residents instead of stretching them and stays off other furniture", () => {
  assert.deepEqual(residentSeat({ x: 290, y: 698 }, 140), { height: 140, lift: 30 });
  assert.deepEqual(residentSeat({ x: 530, y: 680 }, 115), { height: 115, lift: 55 });
  assert.deepEqual(residentSeat({ x: 290, y: 698 }, 190), { height: 190, lift: 0 });
  for (const point of [{ x: 400, y: 641 }, { x: 770, y: 622 }, { x: 1250, y: 646 }, { x: 510, y: 345 }, { x: 800, y: 900 }]) {
    assert.deepEqual(residentSeat(point, 140), { height: 140, lift: 0 });
  }
});

test("new seats tuck residents behind their cushion fronts while chair residents stay behind the table", () => {
  assert.equal(residentDepth({ x: 770, y: 622 }), 620);
  assert.equal(residentDepth({ x: 1250, y: 646 }), 645);
  assert.ok(residentDepth({ x: 290, y: 698 }) < 670);
});
