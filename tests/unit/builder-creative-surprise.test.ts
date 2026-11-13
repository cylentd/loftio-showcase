import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG, SURPRISE } from "../../src/builder/catalog-data.ts";
import { resolveSelections } from "../../src/builder/selections.ts";
import { renderPrompt } from "../../src/builder/prompt.ts";

test("surprise traits delegate invention to the model without catalog random draws", () => {
  const resolved = resolveSelections({ creature: SURPRISE, personality: SURPRISE, signatureDetail: SURPRISE, palette: "blackberry" }, () => { throw Error("Surprise must not draw a catalog trait"); });
  assert.equal(resolved.creature.id, "invented-creature");
  assert.equal(resolved.personality.id, "invented-personality");
  assert.equal(resolved.signatureDetail.id, "invented-detail");
  assert.match(renderPrompt(resolved), /Invent an original creature/i);
  assert.match(renderPrompt(resolved), /Invent a distinctive personality/i);
  assert.match(renderPrompt(resolved), /Invent an unexpected signature detail/i);
});

test("a single surprise leaves every explicit choice intact", () => {
  const resolved = resolveSelections({ creature: "cat", personality: SURPRISE, signatureDetail: "none", palette: "blackberry" }, () => { throw Error("No random draws expected"); });
  assert.deepEqual(resolved.creature, CATALOG.creatures.find(option => option.id === "cat"));
  assert.deepEqual(resolved.signatureDetail, CATALOG.signatureDetails.find(option => option.id === "none"));
  assert.deepEqual(resolved.palette, CATALOG.palettes.find(option => option.id === "blackberry"));
  assert.match(resolved.personality.prompt, /respect.*explicit/i);
  assert.match(resolved.signatureDetail.prompt, /no accessories/i);
});
