import assert from "node:assert/strict";
import { test } from "node:test";
import { FAVORITE_ART } from "../src/favorite-scenery-data.ts";
import { FAVORITES, ARRIVALS } from "../src/copy.ts";

test("Sprout's favorite lights the upstairs teal sofa rather than the downstairs plants", () => {
  const shapes = FAVORITE_ART.sprout!;
  assert.ok(shapes.length > 0);
  for (const shape of shapes) {
    for (let index = 0; index < shape.length; index += 2) {
      assert.ok(shape[index]! >= 970 && shape[index]! <= 1150);
      assert.ok(shape[index + 1]! >= 300 && shape[index + 1]! <= 410);
    }
  }
  assert.equal(FAVORITES.labels.sprout, "The upstairs teal sofa");
  assert.match(ARRIVALS.sprout!, /sofa/);
});
