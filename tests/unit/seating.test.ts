import test from "node:test";
import assert from "node:assert/strict";
import { placementPosition, surfaceAt } from "../../src/resident-movement.ts";
import { wanderTarget } from "../../src/wander-model.ts";

test("left chair accepts feet on the painted seat instead of clamping to the floor", () => {
  assert.equal(surfaceAt({ x: 290, y: 698 }), "chair-left");
  assert.deepEqual(placementPosition({ x: 290, y: 698 }), { x: 290, y: 698 });
});
test("the puzzle tabletop and right stool are distinct drop surfaces", () => {
  assert.equal(surfaceAt({ x: 400, y: 641 }), "table");
  assert.deepEqual(placementPosition({ x: 400, y: 641 }), { x: 400, y: 641 });
  assert.equal(surfaceAt({ x: 535, y: 680 }), "chair-right");
  assert.deepEqual(placementPosition({ x: 535, y: 680 }), { x: 535, y: 680 });
});
test("a chair placement can wander without hopping off the seat", () => {
  for (const random of [0, 0.5, 1]) {
    const target = wanderTarget({ x: 290, y: 698 }, { x: 1395, y: 722 }, "home", random);
    assert.equal(surfaceAt(target), "chair-left");
    assert.ok(target.x >= 245 && target.x <= 350 && target.y >= 680 && target.y <= 712);
  }
});
test("a resident already living upstairs can visit its actual upstairs favorite", () => {
  assert.deepEqual(wanderTarget({ x: 650, y: 400 }, { x: 520, y: 390 }, "home", 0.5), { x: 520, y: 390 });
});
test("moving an upstairs resident downstairs does not create a cross-floor flight", () => {
  const target = wanderTarget({ x: 1010, y: 895 }, { x: 520, y: 390 }, "home", 0.5);
  assert.equal(surfaceAt(target), "ground");
});
