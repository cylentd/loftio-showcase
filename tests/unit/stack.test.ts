import test from "node:test";
import assert from "node:assert/strict";
import { chooseStack, splitStack } from "../../src/stack-model.ts";

const target = { id: "sprout", x: 1000, y: 930, lift: 0, height: 200, width: 160, count: 1 };
test("lowering feet near the head selects a stack; a floor-level overlap does not", () => {
  assert.equal(chooseStack({ x: 1020, y: 790 }, [target]), "sprout");
  assert.equal(chooseStack({ x: 1000, y: 930 }, [target]), null);
});
test("upper residents use their visible top and all six residents can join", () => {
  const upper = { ...target, lift: 148, count: 2 };
  assert.equal(chooseStack({ x: 1000, y: 634 }, [upper]), "sprout");
  assert.equal(chooseStack({ x: 1000, y: 634 }, [{ ...upper, count: 3 }]), "sprout");
  assert.equal(chooseStack({ x: 1000, y: 634 }, [{ ...upper, count: 5 }]), "sprout");
  assert.equal(chooseStack({ x: 1000, y: 634 }, [{ ...upper, count: 6 }]), null);
});
test("distant drops do not magnetically attach", () => {
  assert.equal(chooseStack({ x: 1250, y: 790 }, [target]), null);
});
test("taking out the middle preserves the base and drops only residents above", () => {
  assert.deepEqual(splitStack(["base", "middle", "top"], 1), { lower: ["base"], falling: ["top"] });
  assert.deepEqual(splitStack(["base", "middle", "top"], 0), { lower: [], falling: ["middle", "top"] });
  assert.deepEqual(splitStack(["base", "middle", "top"], 2), { lower: ["base", "middle"], falling: [] });
});
