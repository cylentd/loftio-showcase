import assert from "node:assert/strict";
import { test } from "node:test";
import { nextCaption } from "../src/postcard-caption.ts";
import { FavoriteHint } from "../src/favorite-hint.ts";

test("postcard greetings vary without an immediate repeat even with repeated random values", () => {
  const captions = ["One", "Two", "Three"];
  assert.equal(nextCaption(captions, null, 0), "One");
  assert.equal(nextCaption(captions, "One", 0), "Two");
  assert.equal(nextCaption(captions, "Two", 0), "One");
  assert.equal(nextCaption(captions, "Three", 0.999), "Two");
  assert.equal(nextCaption(["Only"], "Only", 0), "Only");
});

test("inspection hints select one favorite and expire when not held", () => {
  const hint = new FavoriteHint();
  assert.equal(hint.active(0), null);
  hint.show("hoodie", 0);
  assert.equal(hint.active(1), "hoodie");
  hint.show("slime", 1);
  assert.equal(hint.active(2), "slime");
  assert.equal(hint.active(Number.MAX_SAFE_INTEGER), null);
});

test("holding a resident keeps its favorite visible until release or cancellation", () => {
  const hint = new FavoriteHint();
  hint.show("hoodie", 0, true);
  assert.equal(hint.active(Number.MAX_SAFE_INTEGER), "hoodie");
  hint.clear();
  assert.equal(hint.active(100), null);
  hint.show("slime", 0, true);
  hint.clear();
  assert.equal(hint.active(1), null);
});
