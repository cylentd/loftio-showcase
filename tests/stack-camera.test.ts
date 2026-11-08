import test from "node:test";
import assert from "node:assert/strict";
import { towerFrame } from "../src/stack-camera.ts";

test("a six-resident tower fits vertically on a phone with breathing room", () => {
  const f = towerFrame({ top: -250, bottom: 950 }, 0.8, 844, 1081);
  assert.ok(f.scale < 0.8);
  assert.ok(-250 * f.scale + f.offsetY >= 32);
  assert.ok(950 * f.scale + f.offsetY <= 812);
});
test("a short pile and an empty room keep the original framing", () => {
  const normal = towerFrame(null, 0.8, 844, 1081);
  assert.equal(normal.scale, 0.8);
  assert.deepEqual(towerFrame({ top: 400, bottom: 930 }, 0.8, 844, 1081), normal);
});
