import test from "node:test";
import assert from "node:assert/strict";
import { PostcardDesign } from "../../src/postcard-design.ts";
import { POSTCARD } from "../../src/copy.ts";

test("a keepsake starts as a clean snapshot with words opt-in", () => {
  const design = new PostcardDesign(POSTCARD.greetings[0]!);
  assert.equal(design.showCaption, false);
});

test("caption visibility survives cloning and cycling without changing the chosen moment", () => {
  const design = new PostcardDesign(POSTCARD.greetings[0]!, "storybook", true);
  design.cycleCaption(1); design.cycleBorder(1);
  const copy = new PostcardDesign(design.greeting, design.border, design.showCaption);
  assert.equal(copy.showCaption, true);
  assert.equal(copy.greeting, design.greeting);
  assert.equal(copy.border, design.border);
});
