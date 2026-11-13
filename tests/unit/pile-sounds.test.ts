import test from "node:test";
import assert from "node:assert/strict";
import { addMember, detachPile, newPile, playerOwned, tumblePile } from "../../src/pile-book.ts";

function recorder() {
  const heard: string[] = [];
  return { heard, sound: {
    plop: (level: number, quiet: boolean) => { heard.push(`plop ${level} ${quiet ? "quiet" : "loud"}`); },
    topple: (count: number, quiet: boolean) => { heard.push(`topple ${count} ${quiet ? "quiet" : "loud"}`); },
  } };
}

test("a player stacking onto a pile plops at the new pile height, loud", () => {
  const { heard, sound } = recorder();
  const pile = newPile(["a", "b"]);
  addMember(pile, "c", sound);
  assert.deepEqual(pile.members, ["a", "b", "c"]);
  assert.deepEqual(heard, ["plop 3 loud"]);
});

test("a resident joining a self-made pile plops quietly", () => {
  const { heard, sound } = recorder();
  const pile = newPile(["a"], true);
  addMember(pile, "b", sound);
  addMember(pile, "c", sound);
  assert.deepEqual(heard, ["plop 2 quiet", "plop 3 quiet"]);
});

test("the player adding to a self-made pile is loud", () => {
  const { heard, sound } = recorder();
  const pile = newPile(["a", "b"], true);
  addMember(playerOwned(pile), "c", sound);
  assert.deepEqual(heard, ["plop 3 loud"]);
});

test("joining works with no sound attached", () => {
  const pile = newPile(["a"]);
  addMember(pile, "b");
  assert.deepEqual(pile.members, ["a", "b"]);
});

test("a pile flung over topples one note per resident, quiet only when self-made", () => {
  const { heard, sound } = recorder();
  tumblePile(newPile(["a", "b", "c", "d"]), sound);
  tumblePile(newPile(["a", "b"], true), sound);
  assert.deepEqual(heard, ["topple 4 loud", "topple 2 quiet"]);
});

test("grabbing a resident from the middle of a pile topples those above it, loud", () => {
  const { heard, sound } = recorder();
  detachPile([newPile(["a", "b", "c", "d"], true)], "b", sound);
  assert.deepEqual(heard, ["topple 2 loud"]);
});

test("grabbing the top resident, or one not in a pile, makes no topple", () => {
  const { heard, sound } = recorder();
  detachPile([newPile(["a", "b", "c"])], "c", sound);
  detachPile([newPile(["a", "b", "c"])], "zzz", sound);
  assert.deepEqual(heard, []);
});
