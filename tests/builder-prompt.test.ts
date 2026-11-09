import assert from "node:assert/strict";
import { test } from "node:test";
import { PROMPT_VERSION, REFERENCES, renderPrompt } from "../src/builder/prompt.ts";
import { resolveSelections } from "../src/builder/selections.ts";

const moth = resolveSelections(
  { creature: "moth", personality: "bookworm", signatureDetail: "reading-glasses", palette: "blackberry" },
  () => 0,
);

test("the runtime prompt fills all four selections and leaves no placeholder behind", () => {
  const prompt = renderPrompt(moth);
  assert.match(prompt, /Creature \/ inspiration: moth/);
  assert.match(prompt, /Personality: enthusiastic bookworm/);
  assert.match(prompt, /Signature detail: oversized reading glasses/);
  assert.match(prompt, /Color palette: blackberry purple, warm cream, honey gold/);
  assert.doesNotMatch(prompt, /\{\{|\}\}/);
});

test("the prompt carries the whimsical-not-realistic clarification and asks for exactly one image", () => {
  const prompt = renderPrompt(moth);
  assert.match(prompt, /whimsical companion inspired by the creature, not a realistic animal made cute/);
  assert.match(prompt, /Generate exactly one character image/);
  assert.doesNotMatch(prompt, /\bthree (candidates|concepts|images|options)\b|A\/B\/C|\bcandidates\b/i);
});

test("the prompt version is recorded and moves past the v4 package it extends", () => {
  assert.equal(PROMPT_VERSION, "v4.1");
});

test("only the style and range sheets are positive references; roster and diagnostics never are", () => {
  assert.deepEqual(REFERENCES.map(reference => [reference.id, reference.role]), [
    ["loftio-original-six", "style"],
    ["loftio-exploratory-concepts", "range"],
  ]);
});
