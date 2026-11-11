import assert from "node:assert/strict";
import { test } from "node:test";
import { touchPose, vibrate } from "../src/tactile.ts";

test("touch compresses without changing the resting pose", () => {
  assert.deepEqual(touchPose(0), { sx: 1, sy: 1 });
  assert.ok(touchPose(1).sx > 1);
  assert.ok(touchPose(1).sy < 1);
  assert.deepEqual(touchPose(5), touchPose(1));
  assert.deepEqual(touchPose(-1), touchPose(0));
});

test("opening has a bounded anticipation pulse and cancellation stops it", () => {
  const calls: (number | number[])[] = [];
  const device = { vibrate: (pattern: number | number[]) => { calls.push(pattern); return true; } };
  assert.equal(vibrate("open", false, device), true);
  assert.deepEqual(calls[0], [12, 70, 16, 110, 25]);
  vibrate("cancel", false, device);
  assert.equal(calls[1], 0);
});

test("reduced motion, unsupported devices and denied vibration are harmless", () => {
  let calls = 0;
  const device = { vibrate: () => { calls++; return true; } };
  assert.equal(vibrate("touch", true, device), false);
  assert.equal(calls, 0);
  assert.equal(vibrate("touch", false, {}), false);
  assert.equal(vibrate("touch", false, { vibrate: () => { throw Error("denied"); } }), false);
});
