import assert from "node:assert/strict";
import { test } from "node:test";
import { createBuilder, type BuilderApi } from "../../src/builder/controller.ts";
import { memoryStore } from "../../src/builder/store.ts";
import { COPY } from "../../src/builder/copy.ts";

const selections = { creature: "moth", personality: "bookworm", signatureDetail: "reading-glasses", palette: null };

async function lostConnection() {
  const api: BuilderApi = { generate: () => Promise.reject(new TypeError("Failed to fetch")) };
  const instance = createBuilder({
    api, store: memoryStore(), newId: () => "id-1", now: () => new Date("2026-11-06T12:00:00Z"),
    inspect: async () => ({ verdict: "transparent" }),
  }, selections);
  await instance.create();
  return instance.state();
}

test("a dropped connection tells the user the connection was lost", async () => {
  const state = await lostConnection();
  assert.equal(state.status, "failed");
  assert.equal(state.error?.kind, "network");
  assert.match(state.error?.message ?? "", /connection/i);
});

test("a dropped connection never reads like a rejected or failed job", async () => {
  const message = (await lostConnection()).error?.message ?? "";
  assert.notEqual(message, COPY.safety);
  assert.doesNotMatch(message, /rejected|request failed/i);
});
