import assert from "node:assert/strict";
import { test } from "node:test";
import { createWizard } from "../src/residents/wizard.ts";

function fixture(draw: number) {
  const picks: [string, string | null][] = [];
  let creates = 0;
  const wizard = createWizard({ select: (field, value) => picks.push([field, value]), create: () => { creates++; } }, () => draw);
  return { wizard, picks, creates: () => creates };
}

test("Pick for me chooses concrete catalog entries, including beyond favourites, and advances once", () => {
  const { wizard, picks, creates } = fixture(0);
  for (let step = 0; step < 4; step++) wizard.pickForMe?.();
  assert.deepEqual(picks, [["creature", "moth"], ["personality", "bookworm"], ["signatureDetail", "reading-glasses"], ["palette", "blackberry"]]);
  assert.equal(wizard.step, 4);
  assert.equal(creates(), 0);
});

test("the last catalog entries can be chosen without revealing extra choices", () => {
  const { wizard, picks } = fixture(0.999);
  for (let step = 0; step < 4; step++) wizard.pickForMe?.();
  assert.deepEqual(picks, [["creature", "little-ghost"], ["personality", "calm"], ["signatureDetail", "flower-tuft"], ["palette", "meadow"]]);
  assert.equal(wizard.step, 4);
});

test("Pick for me does nothing on the summary and Back retains the concrete pick", () => {
  const { wizard, picks } = fixture(0);
  wizard.pickForMe?.(); wizard.back();
  assert.equal(wizard.chosen("creature"), true);
  assert.deepEqual(picks, [["creature", "moth"]]);
  wizard.goTo(4); wizard.pickForMe?.();
  assert.deepEqual(picks, [["creature", "moth"]]);
});
