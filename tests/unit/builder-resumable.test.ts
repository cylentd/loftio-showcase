import assert from "node:assert/strict";
import { test } from "node:test";
import { createBuilder, type BuilderApi } from "../../src/builder/controller.ts";
import { memoryStore } from "../../src/builder/store.ts";

const selections = { creature: "moth", personality: "bookworm", signatureDetail: "reading-glasses", palette: null };

const builderWith = (api: BuilderApi) => createBuilder({
  api, store: memoryStore(), newId: () => "id", now: () => new Date("2026-11-13T00:00:00Z"), inspect: async () => ({ verdict: "transparent" }),
}, selections);

const generate: BuilderApi["generate"] = async () => { throw new Error("unused"); };

test("a builder whose API has observe reports resumable, so the Create form may offer Reconnect", () => {
  assert.equal(builderWith({ generate, observe: async () => { throw new Error("unused"); } }).state().resumable, true);
});

test("a builder whose API has no observe reports not resumable, so no failure can be reconnected", () => {
  assert.equal(builderWith({ generate }).state().resumable, false);
});
