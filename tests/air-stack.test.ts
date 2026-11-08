import test from "node:test";
import assert from "node:assert/strict";
import { airborneStack } from "../src/air-stack-model.ts";
import { floorBody } from "../src/floor-play-model.ts";
const target = { id: "sprout", x: 1000, y: 930, lift: 0, height: 200, width: 160, count: 1 };
const before = { ...floorBody(1020, 945, 40), z: 190, vz: -500, vx: 100, asleep: false };
const after = { ...before, z: 140 };
test("a descending toss catches a near-miss at head height", () => {
  assert.equal(airborneStack(before, after, [target]), "sprout");
});
test("rising tosses, fast sideswipes and floor-level overlaps cannot stack", () => {
  assert.equal(airborneStack(after, { ...before, vz: 500 }, [target]), null);
  assert.equal(airborneStack({ ...before, vx: 800 }, { ...after, vx: 800 }, [target]), null);
  assert.equal(airborneStack({ ...before, z: 40 }, { ...after, z: 20 }, [target]), null);
});
test("screen overlap at the wrong floor depth is not a landing", () => {
  assert.equal(airborneStack({ ...before, y: 800, z: 70 }, { ...after, y: 800, z: 0 }, [target]), null);
});
test("landing on a pile uses its top, respects the cap and catches swept crossings", () => {
  const top = { ...target, lift: 300, count: 3 };
  assert.equal(airborneStack({ ...before, z: 520 }, { ...after, z: 400 }, [top]), "sprout");
  assert.equal(airborneStack({ ...before, z: 520 }, { ...after, z: 400 }, [{ ...top, count: 6 }]), null);
});
