import assert from "node:assert/strict";
import { test } from "node:test";
import { cycleBlend, lampFlicker, residentLighting } from "../src/lighting-model.ts";

test("the four-minute cycle rests at lamplit, dusk and moonlit then returns seamlessly", () => {
  for (const [time, expected] of [[0, 0], [30000, 0], [70000, 0.5], [95000, 0.5], [135000, 1], [185000, 1], [240000, 0], [310000, 0.5]]) {
    assert.equal(cycleBlend(time), expected);
  }
  assert.ok(cycleBlend(50000) > 0 && cycleBlend(50000) < 0.5);
  assert.ok(Math.abs(cycleBlend(239999) - cycleBlend(240000)) < 0.001);
});

test("lamp dips are sparse, gentle and staggered instead of synchronized flashing", () => {
  const first = [], second = [];
  for (let time = 0; time < 90000; time += 50) {
    const left = lampFlicker(time, 0), right = lampFlicker(time, 1);
    assert.ok(left >= 0.78 && left <= 1);
    if (left < 0.99) first.push(time);
    if (right < 0.99) second.push(time);
  }
  assert.ok(first.length > 0 && first.length < 90);
  assert.ok(second.length > 0 && second.length < 90);
  assert.ok(first.every(time => !second.includes(time)));
});

test("moonlight cools resident art without making residents unreadable", () => {
  assert.equal(residentLighting(0xffffff, 0), 0xffffff);
  assert.equal(residentLighting(0xffffff, 1), 0x849bc5);
  const dusk = residentLighting(0xffffff, 0.5);
  assert.ok(dusk > 0x849bc5 && dusk < 0xffffff);
  assert.equal(residentLighting(0x000000, 1), 0x000000);
});
