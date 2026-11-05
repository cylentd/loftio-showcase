import assert from "node:assert/strict";
import { test } from "node:test";
import { DragPlacement } from "../src/resident-movement.ts";

test("held feet follow the pointer continuously across the loft/ground split", () => {
  const drag = new DragPlacement();
  drag.begin("puff", 1, { x: 100, y: 100 }, { x: 1100, y: 800 }, { x: 1100, y: 800 });
  assert.deepEqual(drag.move(1, { x: 100, y: 120 }, { x: 1100, y: 569 }), { x: 1100, y: 569 });
  assert.deepEqual(drag.move(1, { x: 100, y: 122 }, { x: 1100, y: 571 }), { x: 1100, y: 571 });
  assert.deepEqual(drag.finish(1)?.position, { x: 1100, y: 725 });
});

test("a thin seat can be targeted from beside its edge at phone scale", () => {
  const drag = new DragPlacement();
  drag.begin("puff", 1, { x: 100, y: 100 }, { x: 770, y: 800 }, { x: 770, y: 800 });
  assert.deepEqual(drag.move(1, { x: 100, y: 120 }, { x: 770, y: 636 }, 0.5), { x: 770, y: 636 });
  assert.deepEqual(drag.finish(1)?.position, { x: 770, y: 630 });
});

test("small boundary jitter keeps the landing target until intent is clear", () => {
  const drag = new DragPlacement();
  drag.begin("puff", 1, { x: 100, y: 100 }, { x: 1100, y: 800 }, { x: 1100, y: 800 });
  drag.move(1, { x: 100, y: 120 }, { x: 1100, y: 566 });
  assert.deepEqual(drag.landing, { x: 1100, y: 410 });
  drag.move(1, { x: 100, y: 122 }, { x: 1100, y: 569 });
  assert.deepEqual(drag.landing, { x: 1100, y: 410 });
  drag.move(1, { x: 100, y: 140 }, { x: 1100, y: 580 });
  assert.deepEqual(drag.landing, { x: 1100, y: 725 });
});

test("distant furniture cannot pull a drop away from the floor", () => {
  const drag = new DragPlacement();
  drag.begin("puff", 1, { x: 100, y: 100 }, { x: 1100, y: 800 }, { x: 1100, y: 800 });
  drag.move(1, { x: 100, y: 120 }, { x: 1100, y: 636 });
  assert.deepEqual(drag.finish(1)?.position, { x: 1100, y: 725 });
});
