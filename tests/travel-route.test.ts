import assert from "node:assert/strict";
import { test } from "node:test";
import { travelRoute } from "../src/travel-route.ts";

test("a ground-to-bed journey reaches the ladder foot, climbs, then approaches the bed", () => {
  const route = travelRoute({ x: 1490, y: 945 }, { x: 510, y: 345 });
  const climb = route.findIndex(leg => leg.motion === "climb");
  assert.ok(climb > 0 && climb < route.length - 1);
  assert.deepEqual(route[climb].from, { x: 980, y: 690 });
  assert.deepEqual(route[climb].to, { x: 932, y: 400 });
  assert.deepEqual(route.at(-1)?.to, { x: 510, y: 345 });
  assert.ok(route.slice(0, climb).every(leg => leg.from.y >= 690 && leg.to.y >= 690));
});

test("the return journey descends the same ladder and never jumps the loft gap", () => {
  const route = travelRoute({ x: 1090, y: 365 }, { x: 750, y: 965 });
  const climb = route.find(leg => leg.motion === "climb");
  assert.deepEqual(climb?.from, { x: 932, y: 400 });
  assert.deepEqual(climb?.to, { x: 980, y: 690 });
  assert.deepEqual(route.at(-1)?.to, { x: 750, y: 965 });
});

test("balcony crossings step across the ladder landing instead of flying directly between beds", () => {
  const route = travelRoute({ x: 510, y: 345 }, { x: 1090, y: 365 });
  assert.ok(route.some(leg => leg.to.x === 932 && leg.to.y === 400));
  assert.ok(route.every(leg => leg.motion !== "climb"));
});

test("furniture routes approach at floor level before hopping onto cushions", () => {
  for (const [target, approach] of [
    [{ x: 770, y: 622 }, { x: 770, y: 700 }],
    [{ x: 300, y: 698 }, { x: 300, y: 780 }],
    [{ x: 1250, y: 646 }, { x: 1250, y: 730 }],
  ]) {
    const route = travelRoute({ x: 1490, y: 945 }, target);
    assert.ok(route.some(leg => leg.to.x === approach.x && leg.to.y === approach.y));
    assert.deepEqual(route.at(-1)?.to, target);
    assert.ok(route.every(leg => leg.motion === "hop"));
  }
});

test("a resident placed within a painted table footprint can still walk out", () => {
  assert.ok(travelRoute({ x: 1125, y: 800 }, { x: 1570, y: 700 }).length > 0);
  assert.ok(travelRoute({ x: 1490, y: 945 }, { x: 1125, y: 800 }).length > 0);
});

test("floor travel goes around rather than straight through the central table", () => {
  const route = travelRoute({ x: 1010, y: 895 }, { x: 980, y: 690 });
  assert.ok(route.length > 1);
  for (const leg of route) {
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const x = leg.from.x + (leg.to.x - leg.from.x) * progress;
      const y = leg.from.y + (leg.to.y - leg.from.y) * progress;
      assert.ok(!(x > 735 && x < 1135 && y > 710 && y < 825));
    }
  }
});
