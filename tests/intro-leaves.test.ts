import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { LEAF_ART, LEAVES, VINE, VINE_PARTS, partClip, runClip } from "../src/intro-data.ts";

const publicDir = new URL("../public/", import.meta.url);

test("every falling leaf uses one of the designer's painted leaves", () => {
  assert.equal(LEAF_ART.length, 3);
  for (const leaf of LEAVES) assert.ok(LEAF_ART.includes(leaf.art), `${leaf.art} is a painted leaf`);
});

test("all three painted leaves appear, so the fall never repeats one shape", () => {
  assert.deepEqual([...new Set(LEAVES.map(leaf => leaf.art))].sort(), [...LEAF_ART].sort());
});

test("each painted leaf has a delivery file in public/brand", () => {
  for (const art of LEAF_ART) assert.ok(existsSync(new URL(art, publicDir)), `${art} exists`);
});

test("the vine garland has a delivery file and sits over the sign's painted vines", () => {
  assert.ok(existsSync(new URL(VINE.art, publicDir)), `${VINE.art} exists`);
  // Fitted over public/brand/grove-sign.webp (1520 x 537): 4 px right, 18 px up, 1480 px wide.
  assert.deepEqual({ x: +VINE.x.toFixed(2), y: +VINE.y.toFixed(2), width: +VINE.width.toFixed(2) }, { x: 0.26, y: -3.35, width: 97.37 });
});

// Owner, 2026-11-05: rocking the whole garland looked unnatural; only the hanging ends move.
test("the run along the top stays still; only the two hanging ends move", () => {
  assert.deepEqual(VINE_PARTS.map(part => part.name), ["left", "right"]);
  assert.equal(runClip(VINE_PARTS), "polygon(0% 0%, 100% 0%, 100% 32%, 90% 32%, 90% 100%, 18% 100%, 18% 46%, 0% 46%)");
});

test("each hanging end overlaps the still run above its cut, so the join never opens", () => {
  assert.equal(partClip(VINE_PARTS[0]), "polygon(0% 42%, 18% 42%, 18% 100%, 0% 100%)");
  assert.equal(partClip(VINE_PARTS[1]), "polygon(90% 28%, 100% 28%, 100% 100%, 90% 100%)");
});

test("each hanging end swings from a point on its stem, at the top of its own box", () => {
  for (const { name, box: [x0, y0, x1], hang } of VINE_PARTS) {
    assert.ok(hang, `${name} has a hang point`);
    assert.ok(hang[0] >= x0 && hang[0] <= x1, `${name} hangs within its box`);
    assert.ok(Math.abs(hang[1] - y0) <= 2, `${name} hangs from its top edge`);
  }
});

// Owner, 2026-11-05: 2-2.5° was invisible. 4° is the floor for a breeze you can see; past 7° the ends flap.
test("the breeze is visible but not flapping, and the two ends never move in step", () => {
  const [left, right] = VINE_PARTS.map(part => part.breeze);
  for (const breeze of [left, right]) assert.ok(breeze.deg >= 4 && breeze.deg <= 7, `${breeze.deg} degrees`);
  assert.notEqual(left.seconds, right.seconds);
  assert.notEqual(left.delay, right.delay);
});
