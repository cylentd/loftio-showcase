import test from "node:test";
import assert from "node:assert/strict";
import { canAutoJoin, detachPile, newPile, playerOwned, tickAutoPile } from "../src/pile-book.ts";
import { chooseStack } from "../src/stack-model.ts";
import { AUTO_STACK } from "../src/auto-stack-data.ts";
import { STACK } from "../src/stack-data.ts";

test("a self-made pile never grows past three", () => {
  const piles = [newPile(["a", "b"], true)];
  assert.equal(canAutoJoin(piles, "a", "c"), true);
  piles[0]!.members.push("c");
  assert.equal(canAutoJoin(piles, "a", "d"), false);
  assert.equal(AUTO_STACK.maxHeight, 3);
});

test("a resident already in a pile, or a pile the player owns, takes no self-made joiner", () => {
  const piles = [newPile(["a", "b"], true), newPile(["x", "y"])];
  assert.equal(canAutoJoin(piles, "a", "x"), false);
  assert.equal(canAutoJoin(piles, "x", "z"), false);
  assert.equal(canAutoJoin(piles, "z", "z"), false);
});

test("the player can still add to a self-made pile up to six", () => {
  const target = (count: number) => ({ id: "base", x: 100, y: 500, lift: 0, height: 200, width: 160, count });
  const foot = { x: 100, y: 500 - 200 * STACK.supportHeight };
  assert.equal(chooseStack(foot, [target(3)]), "base");
  assert.equal(chooseStack(foot, [target(5)]), "base");
  assert.equal(chooseStack(foot, [target(6)]), null);
  const pile = newPile(["a", "b", "c"], true);
  assert.equal(playerOwned(pile).auto, false);
  assert.equal(canAutoJoin([pile], "a", "d"), false);
});

test("a self-made pile stands, then residents climb down top first, base last", () => {
  const pile = newPile(["a", "b", "c"], true);
  assert.deepEqual(tickAutoPile(pile, AUTO_STACK.lifetimeMs - 1), []);
  assert.deepEqual(tickAutoPile(pile, 1), ["c"]);
  assert.deepEqual(tickAutoPile(pile, AUTO_STACK.descendStepMs - 1), []);
  assert.deepEqual(tickAutoPile(pile, 1), ["b", "a"]);
  assert.deepEqual(pile.members, []);
});

test("a player pile never dissolves by itself", () => {
  const pile = newPile(["a", "b"]);
  assert.deepEqual(tickAutoPile(pile, AUTO_STACK.lifetimeMs * 10), []);
  assert.deepEqual(pile.members, ["a", "b"]);
});

test("grabbing a resident from a self-made pile splits it as a player pile splits", () => {
  const piles = [newPile(["a", "b", "c"], true)];
  const middle = detachPile(piles, "b")!;
  assert.deepEqual(middle.falling, ["c"]);
  assert.equal(middle.landing, "a");
  assert.deepEqual(middle.piles, []);
  const base = detachPile(piles, "a")!;
  assert.deepEqual(base.falling, ["b", "c"]);
  assert.equal(base.landing, null);
  const top = detachPile([newPile(["a", "b", "c"], true)], "c")!;
  assert.deepEqual(top.falling, []);
  assert.deepEqual(top.piles.map((p) => [p.members, p.auto]), [[["a", "b"], false]]);
  assert.equal(detachPile(piles, "zzz"), null);
});
