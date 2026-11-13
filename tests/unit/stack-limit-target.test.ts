import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseStack } from "../../src/stack-model.ts";
import { airborneStack } from "../../src/air-stack-model.ts";
import { floorBody } from "../../src/floor-play-model.ts";

const full = { id: "top", x: 1000, y: 930, lift: 300, height: 200, width: 160, count: 6 };

test("full stacks remain targetable for feedback without becoming valid attachment targets", () => {
  assert.equal(chooseStack({ x: 1000, y: 482 }, [full]), null);
  assert.equal(chooseStack({ x: 1000, y: 482 }, [full], true), "top");
  assert.equal(chooseStack({ x: 1300, y: 482 }, [full], true), null);
});

test("the nearest full stack blocks a drop rather than attaching to a farther open stack", () => {
  const nearby = { ...full, id: "open", x: 1040, count: 3 };
  assert.equal(chooseStack({ x: 1000, y: 482 }, [nearby, full], true), "top");
  assert.equal(chooseStack({ x: 1000, y: 482 }, [nearby, full]), "open");
});

test("descending crossings can identify a full stack but wrong-depth and rising tosses cannot", () => {
  const before = { ...floorBody(1020, 945, 40), z: 520, vz: -500, vx: 100, asleep: false };
  const after = { ...before, z: 400 };
  assert.equal(airborneStack(before, after, [full]), null);
  assert.equal(airborneStack(before, after, [full], true), "top");
  assert.equal(airborneStack(before, { ...after, vz: 500 }, [full], true), null);
  assert.equal(airborneStack({ ...before, y: 800 }, { ...after, y: 800 }, [full], true), null);
});
