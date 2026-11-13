import assert from "node:assert/strict";
import { test } from "node:test";
import { DragPlacement } from "../../src/resident-movement.ts";

function releaseAt(point: { x: number; y: number }, scale = 1) {
  const drag = new DragPlacement();
  drag.begin("puff", 1, { x: 100, y: 100 }, { x: 1100, y: 800 }, { x: 1100, y: 800 });
  assert.deepEqual(drag.move(1, { x: 100, y: 120 }, point, scale), point);
  assert.deepEqual(drag.landing, point);
  return drag.finish(1)?.position;
}

test("held feet and shadow remain continuous across the loft/ground split", () => {
  const drag = new DragPlacement();
  drag.begin("puff", 1, { x: 100, y: 100 }, { x: 1100, y: 800 }, { x: 1100, y: 800 });
  assert.deepEqual(drag.move(1, { x: 100, y: 120 }, { x: 1100, y: 569 }), { x: 1100, y: 569 });
  assert.deepEqual(drag.move(1, { x: 100, y: 122 }, { x: 1100, y: 571 }), { x: 1100, y: 571 });
  assert.deepEqual(drag.finish(1)?.position, { x: 1100, y: 571 });
});

test("a release below a thin seat does not jump to either the seat or foreground", () => {
  assert.deepEqual(releaseAt({ x: 770, y: 636 }, 0.5), { x: 770, y: 636 });
});

test("releases above, on and beside furniture stay at the shadow at every scale", () => {
  for (const scale of [0.5, 1, 2]) {
    for (const point of [{ x: 780, y: 580 }, { x: 780, y: 620 }, { x: 850, y: 620 }]) {
      assert.deepEqual(releaseAt(point, scale), point);
    }
  }
});

test("passing below a surface does not change the release position", () => {
  const drag = new DragPlacement();
  drag.begin("puff", 1, { x: 100, y: 100 }, { x: 1100, y: 800 }, { x: 1100, y: 800 });
  drag.move(1, { x: 100, y: 120 }, { x: 1100, y: 400 });
  assert.deepEqual(drag.landing, { x: 1100, y: 400 });
  drag.move(1, { x: 100, y: 122 }, { x: 1100, y: 420 });
  assert.deepEqual(drag.landing, { x: 1100, y: 420 });
});

test("distant furniture cannot pull a drop away from its shadow", () => {
  assert.deepEqual(releaseAt({ x: 1100, y: 636 }), { x: 1100, y: 636 });
});
