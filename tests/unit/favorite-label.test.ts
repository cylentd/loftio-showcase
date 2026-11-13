import assert from "node:assert/strict";
import { test } from "node:test";
import { FAVORITE_ART } from "../../src/favorite-scenery-data.ts";
import { FAVORITES, NAMES } from "../../src/copy.ts";
import { favoriteAnchor, favoriteLabelLayout, favoriteLabelPlacement } from "../../src/favorite-label-model.ts";

const look = { scale: 0.5, x: 100, y: 20, offsetY: 30 };
const frame = { origin: { left: 0, top: 0 }, viewport: { width: 800, height: 600 }, gutter: 12, gap: 8, size: { width: 120, height: 28 } };

test("the label anchors on the top centre of the favorite's own mask, so Chomper's is the lantern", () => {
  const anchor = favoriteAnchor(FAVORITE_ART.chomper!);
  assert.deepEqual(anchor, { x: (995 + 1051) / 2, y: 622 });
});

test("the label reads as the resident's name plus 'favorite'", () => {
  for (const id of Object.keys(FAVORITES.labels)) assert.equal(FAVORITES.tag(NAMES[id]!), `${NAMES[id]}'s favorite`);
});

test("the label sits centred above the spot", () => {
  const { left, top } = favoriteLabelPlacement({ x: 1000, y: 600 }, look, frame);
  assert.deepEqual([left, top], [(1000 - 100) * 0.5 - 60, (600 - 20) * 0.5 + 30 - 28 - 8]);
});

test("the label slides inside the screen edges and flips below the spot when there is no room above", () => {
  const edge = favoriteLabelPlacement({ x: 100, y: 600 }, look, frame);
  assert.equal(edge.left, 12);
  const high = favoriteLabelPlacement({ x: 1000, y: 40 }, look, frame);
  assert.equal(high.top, (40 - 20) * 0.5 + 30 + 8);
});

// Phone geometry from #298: at 390x844 the centred label (130..270 x 363..392) hit Sprout on its left
// by 38.78x17.5 px and Slime on its right by 23.83x17.5 px.
const flat = { scale: 1, x: 0, y: 0, offsetY: 0 };
const phone = { origin: { left: 0, top: 0 }, viewport: { width: 390, height: 844 }, gutter: 12, gap: 8, size: { width: 140, height: 29 } };
const spot = { x: 200, y: 400 };
const leftResident = { left: 90, top: 374.5, right: 130 + 38.78, bottom: 480 };
const rightResident = { left: 270 - 23.83, top: 374.5, right: 320, bottom: 480 };
type Box = { left: number; top: number; right: number; bottom: number };
const boxOf = (p: { left: number; top: number }, size = phone.size): Box =>
  ({ left: p.left, top: p.top, right: p.left + size.width, bottom: p.top + size.height });
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const onScreen = (b: Box, frame = phone) =>
  b.left >= frame.gutter && b.top >= frame.gutter && b.right <= frame.viewport.width - frame.gutter && b.bottom <= frame.viewport.height - frame.gutter;

for (const [name, residents] of [
  ["a resident on its left (38.78x17.5 px)", [leftResident]],
  ["a resident on its right (23.83x17.5 px)", [rightResident]],
  ["residents on both sides", [leftResident, rightResident]],
] as const) {
  test(`on a phone the label clears ${name} and stays on screen`, () => {
    const box = boxOf(favoriteLabelPlacement(spot, flat, phone, [...residents]));
    assert.deepEqual(residents.map(resident => overlap(box, resident)), residents.map(() => 0));
    assert.equal(onScreen(box), true);
  });
}

test("with nothing in the way on a phone the label stays centred above the spot", () => {
  const placed = favoriteLabelPlacement(spot, flat, phone, []);
  assert.deepEqual([placed.left, placed.top], [200 - 70, 400 - 29 - 8]);
});

test("a label pushed sideways by a resident still keeps a gap from it", () => {
  const box = boxOf(favoriteLabelPlacement(spot, flat, phone, [leftResident]));
  const clear = box.left >= leftResident.right + phone.gap || box.bottom <= leftResident.top - phone.gap || box.top >= leftResident.bottom + phone.gap;
  assert.equal(clear, true);
});

for (const [name, at, resident] of [
  ["left", { x: 20, y: 400 }, { left: 0, top: 360, right: 90, bottom: 480 }],
  ["right", { x: 380, y: 400 }, { left: 300, top: 360, right: 390, bottom: 480 }],
  ["bottom", { x: 200, y: 830 }, { left: 150, top: 790, right: 250, bottom: 844 }],
  ["top", { x: 200, y: 20 }, { left: 150, top: 0, right: 250, bottom: 60 }],
] as const) {
  test(`at the ${name} screen edge with a resident beside the spot the label stays fully on screen and clear`, () => {
    const box = boxOf(favoriteLabelPlacement(at, flat, phone, [resident]));
    assert.equal(onScreen(box), true);
    assert.equal(overlap(box, resident), 0);
  });
}

test("panning moves the screen origin and the label still clears the resident in screen pixels", () => {
  const panned = { ...phone, origin: { left: -300, top: 0 } };
  const placed = favoriteLabelPlacement({ x: 500, y: 400 }, flat, panned, [leftResident]);
  const screen = boxOf({ left: placed.left - 300, top: placed.top });
  assert.equal(overlap(screen, leftResident), 0);
  assert.equal(onScreen(screen), true);
});

test("two favorites on the same spot never stack their labels on each other", () => {
  const [first, second] = favoriteLabelLayout([{ anchor: spot, size: phone.size }, { anchor: spot, size: phone.size }], flat, phone, [leftResident]);
  assert.equal(overlap(boxOf(first!), boxOf(second!)), 0);
  assert.deepEqual([overlap(boxOf(first!), leftResident), overlap(boxOf(second!), leftResident)], [0, 0]);
});

test("while the centre stays blocked a label keeps its previous clear place, so it does not creep as a resident walks", () => {
  const before = favoriteLabelPlacement(spot, flat, phone, [leftResident]);
  const walked = { ...leftResident, top: leftResident.top + 5, bottom: leftResident.bottom + 5 };
  assert.notDeepEqual(favoriteLabelPlacement(spot, flat, phone, [walked]).top, before.top);
  const kept = favoriteLabelPlacement(spot, flat, phone, [walked], before.offset);
  assert.deepEqual([kept.left, kept.top], [before.left, before.top]);
});

test("once the resident walks away the label returns to centred above the spot", () => {
  const before = favoriteLabelPlacement(spot, flat, phone, [leftResident]);
  const home = favoriteLabelPlacement(spot, flat, phone, [], before.offset);
  assert.deepEqual([home.left, home.top], [200 - 70, 400 - 29 - 8]);
});
