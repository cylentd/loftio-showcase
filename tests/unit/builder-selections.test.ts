import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG, CATALOG_STATUS, SURPRISE } from "../../src/builder/catalog-data.ts";
import { resolveSelections, validateSelections } from "../../src/builder/selections.ts";

const moth = { creature: "moth", personality: "bookworm", signatureDetail: "reading-glasses", palette: "blackberry" };
const firstPick = () => 0;

test("the preset catalog is marked provisional and every group has unique ids and labels", () => {
  assert.equal(CATALOG_STATUS, "provisional");
  for (const group of [CATALOG.creatures, CATALOG.personalities, CATALOG.signatureDetails, CATALOG.palettes]) {
    assert.ok(group.length >= 4);
    assert.equal(new Set(group.map(option => option.id)).size, group.length);
    assert.ok(group.every(option => option.label.length > 0 && option.prompt.length > 0));
    assert.ok(!group.some(option => option.id === SURPRISE));
  }
  assert.ok(CATALOG.palettes.every(palette => palette.colors.length === 3));
});

test("a request made of catalog ids passes validation unchanged", () => {
  const result = validateSelections(moth);
  assert.deepEqual(result, { ok: true, value: moth });
});

test("surprise and an omitted palette are valid choices", () => {
  const result = validateSelections({ creature: SURPRISE, personality: SURPRISE, signatureDetail: SURPRISE, palette: null });
  assert.equal(result.ok, true);
});

test("validation names every field that is unknown, missing or the wrong type", () => {
  const result = validateSelections({ creature: "dragon", personality: 7, palette: SURPRISE });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.errors.sort(), ["creature", "palette", "personality", "signatureDetail"]);
});

test("validation refuses a body that is not an object", () => {
  for (const body of [null, "moth", 3, []]) assert.equal(validateSelections(body).ok, false);
});

test("resolution keeps concrete choices and fills them from the catalog", () => {
  const resolved = resolveSelections(moth, firstPick);
  assert.equal(resolved.creature.id, "moth");
  assert.equal(resolved.personality.id, "bookworm");
  assert.equal(resolved.signatureDetail.id, "reading-glasses");
  assert.deepEqual(resolved.palette.colors, ["blackberry purple", "warm cream", "honey gold"]);
});

test("surprise traits become invention directives while an omitted palette draws once", () => {
  const draws = [0.75];
  const rng = () => draws.shift() ?? 0;
  const resolved = resolveSelections({ creature: SURPRISE, personality: SURPRISE, signatureDetail: SURPRISE, palette: null }, rng);
  assert.equal(resolved.creature.id, "invented-creature");
  assert.equal(resolved.personality.id, "invented-personality");
  assert.equal(resolved.signatureDetail.id, "invented-detail");
  assert.equal(resolved.palette.id, CATALOG.palettes[Math.floor(0.75 * CATALOG.palettes.length)]?.id);
  assert.equal(draws.length, 0);
});

test("a concrete choice never consumes a random draw", () => {
  let draws = 0;
  resolveSelections(moth, () => { draws += 1; return 0; });
  assert.equal(draws, 0);
});
test('familiar residents are additive and None resolves without a random accessory', () => {
  const ids = new Set(CATALOG.creatures.map(item => item.id));
  for (const id of ['cat', 'puppy', 'bunny', 'fox', 'bear', 'duck', 'penguin', 'axolotl', 'tiny-dragon', 'sprout', 'little-ghost', 'moth', 'snail', 'crystal', 'gecko', 'beetle']) assert.ok(ids.has(id), id);
  const resolved = resolveSelections({ creature: 'cat', personality: 'sleepy', signatureDetail: 'none', palette: 'blackberry' }, () => { throw Error('Unexpected surprise'); });
  assert.equal(resolved.signatureDetail.id, 'none');
  assert.match(resolved.signatureDetail.prompt, /no accessories/i);
});
