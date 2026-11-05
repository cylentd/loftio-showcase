import test from "node:test";
import assert from "node:assert/strict";
import { PostcardDesign } from "../src/postcard-design.ts";
import { POSTCARD } from "../src/copy.ts";
import { POSTCARD_RENDER } from "../src/postcard-data.ts";
import { favoriteLightMatrix, favoritePixel } from "../src/favorite-light-model.ts";

test("caption and border cycling wrap independently and can be reversed", () => {
  const design = new PostcardDesign(POSTCARD.greetings[0]!);
  const original = design.greeting;
  design.cycleCaption(-1);
  assert.equal(design.greeting,POSTCARD.greetings.at(-1));
  design.cycleCaption(1); assert.equal(design.greeting,original);
  design.cycleBorder(-1); assert.equal(design.border,"airmail");
  assert.equal(design.greeting,original);
  design.cycleBorder(1); assert.equal(design.border,"storybook");
  design.cycleBorder(1); assert.equal(design.border,"quilt");
  design.cycleBorder(1); design.cycleBorder(1); assert.equal(design.border,"storybook");
});

test("print captions and stamps have larger uncompressed dimensions", () => {
  assert.ok(POSTCARD_RENDER.titleFont >= 40);
  assert.ok(POSTCARD_RENDER.compactTitleFont >= 32);
  assert.ok(POSTCARD_RENDER.stampWidth >= 100);
  assert.ok(POSTCARD_RENDER.stampHeight >= 120);
});

test("moonlight grade moves warm upholstery toward blue and preserves tonal differences", () => {
  const warm = [152,107,63];
  const matrix = favoriteLightMatrix(1);
  const lit = favoritePixel(warm[0]!,warm[1]!,warm[2]!,matrix);
  assert.ok(lit[2]! > lit[0]!);
  assert.ok(lit.reduce((sum,value) => sum+value,0) > warm.reduce((sum,value) => sum+value,0));
  const dark = favoritePixel(76,53,31,matrix);
  assert.ok(dark.every((value,index) => value < lit[index]!));
  assert.deepEqual(favoritePixel(152,107,63,favoriteLightMatrix(0)),warm);
  assert.deepEqual(favoriteLightMatrix(-1),favoriteLightMatrix(0));
  assert.deepEqual(favoriteLightMatrix(2),favoriteLightMatrix(1));
});
