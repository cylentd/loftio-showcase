import assert from "node:assert/strict";
import { test } from "node:test";
import { createBuilder, type BuilderApi, type GenerateOutcome } from "../src/builder/controller.ts";
import { requestJournal } from "../src/builder/journal.ts";
import { ProviderError } from "../src/builder/provider.ts";
import { memoryStore } from "../src/builder/store.ts";
import type { GenerationRecord } from "../src/builder/records.ts";

const selections = { creature: "moth", personality: "bookworm", signatureDetail: "reading-glasses", palette: null };
const KEY = "pending-test";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

function record(requestId: string): GenerationRecord {
  return {
    id: `gen-${requestId}`, requestId, userSelections: selections,
    resolvedSelections: {
      creature: { id: "moth", label: "Moth", prompt: "moth" },
      personality: { id: "bookworm", label: "Bookworm", prompt: "enthusiastic bookworm" },
      signatureDetail: { id: "reading-glasses", label: "Reading glasses", prompt: "oversized reading glasses" },
      palette: { id: "blackberry", label: "Blackberry", prompt: "", colors: ["a", "b", "c"] },
    },
    promptVersion: "v4.1", prompt: "prompt", referenceIds: ["loftio-original-six"],
    providerId: "mock", modelId: "mock-1", attempts: 1, createdAt: "2026-11-05T12:00:00.000Z",
  };
}

const success = (requestId: string): GenerateOutcome =>
  ({ ok: true, generation: record(requestId), image: { base64: "AAAA", mime: "image/png", width: 2, height: 2, hasAlphaChannel: true } });

function instance(api: BuilderApi, storage = memoryStorage(), store = memoryStore(), ids = ["id-1", "id-2", "id-3"]) {
  const queue = [...ids];
  const builder = createBuilder({
    api, store, journal: requestJournal(storage, KEY), newId: () => queue.shift()!,
    now: () => new Date("2026-11-06T00:00:00Z"), inspect: async () => ({ verdict: "transparent" }),
  }, selections);
  return { builder, storage, store };
}

test("a stored draft clears its pending request so reload never observes it again", async () => {
  const observed: string[] = [];
  const api: BuilderApi = { async generate(body) { return success(body.requestId); },
    async observe(id) { observed.push(id); return success(id); } };
  const first = instance(api);
  await first.builder.create();
  assert.deepEqual(requestJournal(first.storage, KEY).read(), []);
  const reloaded = instance(api, first.storage, first.store);
  await reloaded.builder.load();
  await reloaded.builder.resume();
  assert.deepEqual(observed, []);
  assert.equal(reloaded.builder.state().status, "idle");
});

test("load returns saved residents before a pending job finishes; resume finishes it", async () => {
  const storage = memoryStorage();
  requestJournal(storage, KEY).add({ requestId: "slow", selections });
  let finish!: () => void;
  const api: BuilderApi = { async generate() { throw Error("unused"); },
    observe: id => new Promise(resolve => { finish = () => resolve(success(id)); }) };
  const { builder } = instance(api, storage);
  await builder.load();
  assert.equal(builder.state().status, "idle");
  const resumed = builder.resume();
  assert.equal(builder.state().status, "generating");
  finish(); await resumed;
  assert.equal(builder.state().status, "ready");
  assert.equal(builder.state().kept[0]?.state, "draft");
});

test("a busy rejection in a second tab keeps the first tab's pending request", async () => {
  const storage = memoryStorage();
  const tabA = instance({ generate: () => new Promise(() => {}), async observe() { return new Promise(() => {}); } }, storage, memoryStore(), ["tab-a"]);
  void tabA.builder.create();
  const tabB = instance({ async generate() { return { ok: false, error: { kind: "busy", message: "busy" } }; } }, storage, memoryStore(), ["tab-b"]);
  await tabB.builder.create();
  assert.deepEqual(requestJournal(storage, KEY).read().map(item => item.requestId), ["tab-a"]);
});

test("Cancel after the job already finished saves its result as a draft instead of dropping it", async () => {
  const api: BuilderApi = {
    generate: (_body, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }),
    async observe(id) { return success(id); },
    async cancel() { return false; },
  };
  const { builder, storage, store } = instance(api);
  const running = builder.create();
  builder.cancel(); await running;
  await builder.settled();
  assert.deepEqual((await store.list()).map(item => [item.generationId, item.state]), [["gen-id-1", "draft"]]);
  assert.deepEqual(requestJournal(storage, KEY).read(), []);
});

test("confirmed cancellation forgets the request", async () => {
  const api: BuilderApi = {
    generate: (_body, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }),
    async observe() { throw Error("should not observe"); },
    async cancel() { return true; },
  };
  const { builder, storage, store } = instance(api);
  const running = builder.create();
  builder.cancel(); await running;
  await builder.settled();
  assert.deepEqual(requestJournal(storage, KEY).read(), []);
  assert.deepEqual(await store.list(), []);
});

test("Create with changed selections after a lost connection starts a new request", async () => {
  const generated: string[] = [];
  let online = false;
  const api: BuilderApi = {
    async generate(body) { generated.push(body.requestId); if (!online) throw Error("offline"); return success(body.requestId); },
    async observe(id) { if (!online) throw Error("offline"); return success(id); },
  };
  const { builder } = instance(api);
  await builder.create();
  assert.equal(builder.state().status, "failed");
  builder.select("creature", "snail");
  online = true;
  await builder.create();
  assert.deepEqual(generated, ["id-1", "id-2"]);
});

test("Create with unchanged selections after a lost connection reattaches", async () => {
  const generated: string[] = []; const observed: string[] = [];
  let online = false;
  const api: BuilderApi = {
    async generate(body) { generated.push(body.requestId); throw Error("offline"); },
    async observe(id) { observed.push(id); if (!online) throw Error("offline"); return success(id); },
  };
  const { builder } = instance(api);
  await builder.create();
  online = true;
  await builder.create();
  assert.deepEqual(generated, ["id-1"]);
  assert.deepEqual(observed.at(-1), "id-1");
});

test("one pending request's preparation failure does not send the next one to preparation", async () => {
  const storage = memoryStorage();
  const journal = requestJournal(storage, KEY);
  journal.add({ requestId: "a", selections }); journal.add({ requestId: "b", selections });
  const prepared: string[] = [];
  const api: BuilderApi = { async generate() { throw Error("unused"); },
    async observe(id) { return id === "a" ? { ok: false, error: { kind: "preparation", message: "prep" } } : success(id); },
    async prepare(id) { prepared.push(id); return success(id); } };
  const { builder, store } = instance(api, storage);
  await builder.load(); await builder.resume();
  assert.deepEqual(prepared, []);
  assert.deepEqual((await store.list()).map(item => item.generationId), ["gen-b"]);
  assert.deepEqual(journal.read().map(item => item.requestId), ["a"]);
});

test("an image that cannot be decoded is forgotten, and Create starts a new request", async () => {
  const generated: string[] = [];
  const api: BuilderApi = { async generate(body) { generated.push(body.requestId); return success(body.requestId); },
    async observe(id) { return success(id); } };
  const storage = memoryStorage();
  const builder = createBuilder({ api, store: memoryStore(), journal: requestJournal(storage, KEY), newId: (() => { let n = 0; return () => `id-${++n}`; })(),
    now: () => new Date("2026-11-06T00:00:00Z"), inspect: async () => { throw Error("cannot decode"); } }, selections);
  await builder.create();
  assert.equal(builder.state().error?.kind, "corrupt");
  assert.deepEqual(requestJournal(storage, KEY).read(), []);
  await builder.create();
  assert.deepEqual(generated, ["id-1", "id-2"]);
});

test("a preview that fails to download is a network failure that keeps the paid request", async () => {
  let online = false; const generated: string[] = [];
  const api: BuilderApi = { async generate(body) { generated.push(body.requestId); return success(body.requestId); },
    async observe(id) { return success(id); } };
  const storage = memoryStorage(); const store = memoryStore();
  const builder = createBuilder({ api, store, journal: requestJournal(storage, KEY), newId: () => "paid",
    now: () => new Date("2026-11-06T00:00:00Z"),
    inspect: async () => { if (!online) throw new ProviderError("network", "offline"); return { verdict: "transparent" }; } }, selections);
  await builder.create();
  assert.equal(builder.state().error?.kind, "network");
  assert.deepEqual(requestJournal(storage, KEY).read().map(item => item.requestId), ["paid"]);
  online = true;
  await builder.create();
  assert.deepEqual(generated, ["paid"]);
  assert.equal(builder.state().status, "ready");
  assert.deepEqual((await store.list()).map(item => item.generationId), ["gen-paid"]);
});

test("retrying preparation while the worker is busy keeps the paid request for a later retry", async () => {
  const storage = memoryStorage();
  const prepared: string[] = [];
  let busy = true;
  const api: BuilderApi = { async generate() { return { ok: false, error: { kind: "preparation", message: "prep" } }; },
    async observe() { return { ok: false, error: { kind: "preparation", message: "prep" } }; },
    async prepare(id) { prepared.push(id); return busy ? { ok: false, error: { kind: "busy", message: "busy" } } : success(id); } };
  const { builder, store } = instance(api, storage);
  await builder.create();
  await builder.create();
  assert.deepEqual(requestJournal(storage, KEY).read().map(item => item.requestId), ["id-1"]);
  assert.equal(builder.state().error?.kind, "preparation");
  busy = false;
  await builder.create();
  assert.deepEqual(prepared, ["id-1", "id-1"]);
  assert.deepEqual((await store.list()).map(item => item.generationId), ["gen-id-1"]);
});

test("a confirmed cancellation is removed even after a new Create has started", async () => {
  let confirm!: (value: boolean) => void;
  const api: BuilderApi = {
    generate: (_body, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }),
    async observe() { return new Promise(() => {}); },
    cancel: () => new Promise(resolve => { confirm = resolve; }),
  };
  const { builder, storage } = instance(api);
  const first = builder.create();
  builder.cancel(); await first;
  void builder.create();
  confirm(true); await builder.settled();
  assert.deepEqual(requestJournal(storage, KEY).read().map(item => item.requestId), ["id-2"]);
});

test("journal reads the earlier single-request format as one pending request", () => {
  const storage = memoryStorage();
  storage.setItem(KEY, JSON.stringify({ requestId: "legacy", selections }));
  assert.deepEqual(requestJournal(storage, KEY).read(), [{ requestId: "legacy", selections }]);
  storage.setItem(KEY, "null");
  assert.deepEqual(requestJournal(storage, KEY).read(), []);
});
