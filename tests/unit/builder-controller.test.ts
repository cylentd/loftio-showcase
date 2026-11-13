import assert from "node:assert/strict";
import { test } from "node:test";
import { createBuilder, type BuilderApi, type GenerateOutcome } from "../../src/builder/controller.ts";
import { memoryStore } from "../../src/builder/store.ts";
import type { GeneratedImage, GenerationRecord } from "../../src/builder/records.ts";

const selections = { creature: "moth", personality: "bookworm", signatureDetail: "reading-glasses", palette: null };

test('durable request is saved before dispatch and reload observes it without generating', async () => {
  let pending: any[] = [];
  const journal = { read: () => pending, add: (value: any) => { pending = [value]; }, remove: () => { pending = []; } };
  const calls: string[] = [];
  const dependencies = {
    api: {
      async generate(body: any) { calls.push('generate'); assert.deepEqual(pending, [body]); throw Error('connection lost'); },
      async observe(id: string) { calls.push('observe'); return success(id); },
    },
    store: memoryStore(), journal, newId: () => 'durable-id',
    now: () => new Date('2026-11-06T00:00:00Z'), inspect: async () => ({ verdict: 'transparent' }),
  };
  await createBuilder(dependencies, selections).create();
  const resumed = createBuilder(dependencies, selections);
  await resumed.load();
  await resumed.resume();
  assert.deepEqual(calls, ['generate', 'observe']);
  assert.equal(resumed.state().preview?.generation.requestId, 'durable-id');
  assert.equal(resumed.state().status, 'ready');
});

test('durable storage failure prevents dispatch rather than losing a paid job', async () => {
  let calls = 0;
  const instance = createBuilder({
    api: { async generate() { calls++; return success('lost'); } },
    store: memoryStore(), journal: { read: () => [], add: () => { throw Error('quota'); }, remove: () => {} },
    newId: () => 'lost', now: () => new Date('2026-11-06T00:00:00Z'), inspect: async () => ({ verdict: 'transparent' }),
  }, selections);
  await instance.create();
  assert.equal(calls, 0);
  assert.equal(instance.state().error?.kind, 'storage');
});

test('durable ready results become drafts before another creation can replace the preview', async () => {
  const store = memoryStore();
  let next = 0;
  const instance = createBuilder({ api: { async generate(body) { return success(body.requestId); } }, store,
    journal: { read: () => [], add: () => {}, remove: () => {} }, newId: () => `draft-${++next}`,
    now: () => new Date('2026-11-06T00:00:00Z'), inspect: async () => ({ verdict: 'transparent' }),
  }, selections);
  await instance.create();
  await instance.tryAnother();
  assert.deepEqual((await store.list()).map(record => [record.generationId, record.state]), [['gen-draft-1', 'draft'], ['gen-draft-2', 'draft']]);
  assert.equal(instance.state().previewKept, false);
  await instance.keep();
  assert.equal((await store.list()).find(record => record.generationId === 'gen-draft-2')?.state, 'kept');
});

function record(requestId: string): GenerationRecord {
  return {
    id: `gen-${requestId}`,
    requestId,
    userSelections: selections,
    resolvedSelections: {
      creature: { id: "moth", label: "Moth", prompt: "moth" },
      personality: { id: "bookworm", label: "Bookworm", prompt: "enthusiastic bookworm" },
      signatureDetail: { id: "reading-glasses", label: "Reading glasses", prompt: "oversized reading glasses" },
      palette: { id: "blackberry", label: "Blackberry", prompt: "", colors: ["a", "b", "c"] },
    },
    promptVersion: "v4.1",
    prompt: "prompt",
    referenceIds: ["loftio-original-six"],
    providerId: "mock",
    modelId: "mock-1",
    attempts: 1,
    createdAt: "2026-11-05T12:00:00.000Z",
  };
}

function success(requestId: string): GenerateOutcome {
  return { ok: true, generation: record(requestId), image: { base64: "AAAA", mime: "image/png", width: 2, height: 2, hasAlphaChannel: true } };
}

function fakeApi(answer: (requestId: string) => GenerateOutcome = success) {
  const requests: { requestId: string; selections: unknown }[] = [];
  const pending: (() => void)[] = [];
  const api: BuilderApi = {
    generate(body) {
      requests.push(body);
      return new Promise(resolve => pending.push(() => resolve(answer(body.requestId))));
    },
  };
  const settle = async () => { while (pending.length) pending.shift()?.(); };
  return { api, requests, settle };
}

function builder(api: BuilderApi, store = memoryStore()) {
  let n = 0;
  const instance = createBuilder({
    api,
    store,
    newId: () => `id-${++n}`,
    now: () => new Date("2026-11-05T12:30:00Z"),
    inspect: async () => ({ verdict: "transparent" }),
  }, selections);
  return { instance, store };
}

test("Create moves idle to generating to ready with one request", async () => {
  const fake = fakeApi();
  const { instance } = builder(fake.api);
  assert.equal(instance.state().status, "idle");
  const done = instance.create();
  assert.equal(instance.state().status, "generating");
  await fake.settle();
  await done;
  assert.equal(instance.state().status, "ready");
  assert.equal(fake.requests.length, 1);
  assert.equal(instance.state().preview?.generation.requestId, "id-1");
  assert.deepEqual(instance.state().preview?.check, { verdict: "transparent" });
});

test("clicking Create again while generating sends nothing", async () => {
  const fake = fakeApi();
  const { instance } = builder(fake.api);
  const first = instance.create();
  await instance.create();
  await instance.tryAnother();
  await fake.settle();
  await first;
  assert.equal(fake.requests.length, 1);
});

test("Try another reuses the selections with a fresh request id", async () => {
  const fake = fakeApi();
  const { instance } = builder(fake.api);
  instance.select("personality", "sleepy");
  const one = instance.create(); await fake.settle(); await one;
  const two = instance.tryAnother(); await fake.settle(); await two;
  assert.equal(fake.requests.length, 2);
  assert.deepEqual(fake.requests[1]?.selections, { ...selections, personality: "sleepy" });
  assert.notEqual(fake.requests[0]?.requestId, fake.requests[1]?.requestId);
  assert.deepEqual(instance.state().selections, { ...selections, personality: "sleepy" });
});

test("Keep saves the image with its inputs and metadata, once", async () => {
  const fake = fakeApi();
  const { instance, store } = builder(fake.api);
  const made = instance.create(); await fake.settle(); await made;
  await Promise.all([instance.keep(), instance.keep()]);
  const kept = await store.list();
  assert.equal(kept.length, 1);
  const resident = kept[0];
  assert.equal(resident?.state, "kept");
  assert.equal(resident?.generationId, "gen-id-1");
  assert.deepEqual(resident?.userSelections, selections);
  assert.equal(resident?.resolvedSelections.creature.id, "moth");
  assert.equal(resident?.promptVersion, "v4.1");
  assert.equal(resident?.providerModelId, "mock/mock-1");
  assert.deepEqual(resident?.referenceIds, ["loftio-original-six"]);
  assert.equal((resident?.image as Extract<GeneratedImage, { mime: "image/png" }> | undefined)?.base64, "AAAA");
  assert.equal(resident?.keptAt, "2026-11-05T12:30:00.000Z");
  assert.equal(instance.state().previewKept, true);
  assert.equal(instance.state().kept.length, 1);
});

test("Try another after Keep leaves the saved resident untouched", async () => {
  const fake = fakeApi();
  const { instance, store } = builder(fake.api);
  const made = instance.create(); await fake.settle(); await made;
  await instance.keep();
  const before = structuredClone(await store.list());
  const again = instance.tryAnother(); await fake.settle(); await again;
  assert.deepEqual(await store.list(), before);
  assert.equal(instance.state().previewKept, false);
  assert.notEqual(instance.state().preview?.generation.id, before[0]?.generationId);
});

test("a failure keeps the selections and reports the provider's reason", async () => {
  const fake = fakeApi(() => ({ ok: false, error: { kind: "safety", message: "rejected" } }));
  const { instance } = builder(fake.api);
  const made = instance.create(); await fake.settle(); await made;
  assert.equal(instance.state().status, "failed");
  assert.equal(instance.state().error?.kind, "safety");
  assert.deepEqual(instance.state().selections, selections);
});

test("Cancel returns to the previous preview and ignores the late answer", async () => {
  const fake = fakeApi();
  const { instance } = builder(fake.api);
  const made = instance.create(); await fake.settle(); await made;
  const late = instance.tryAnother();
  instance.cancel();
  assert.equal(instance.state().status, "ready");
  await fake.settle(); await late;
  assert.equal(instance.state().preview?.generation.requestId, "id-1");
});

test("residents saved earlier load on start", async () => {
  const store = memoryStore();
  const first = fakeApi();
  const a = builder(first.api, store).instance;
  const made = a.create(); await first.settle(); await made; await a.keep();
  const b = builder(fakeApi().api, store).instance;
  await b.load();
  assert.equal(b.state().kept.length, 1);
});

test("Refine is reported unsupported until image editing is verified", () => {
  const { instance } = builder(fakeApi().api);
  assert.equal(instance.state().refineSupported, false);
});

test('failed persistence preserves the preview and permits a later Keep retry', async () => {
  const fake = fakeApi();
  let fail = true;
  const backing = memoryStore();
  const store = {
    list: backing.list,
    async put(character: Parameters<typeof backing.put>[0]) {
      if (fail) throw new Error('quota');
      await backing.put(character);
    },
  };
  const instance = builder(fake.api, store).instance;
  const made = instance.create(); await fake.settle(); await made;
  await instance.keep();
  assert.equal(instance.state().error?.kind, 'storage');
  assert.equal(instance.state().previewKept, false);
  assert.equal(instance.state().saving, false);
  fail = false;
  await instance.keep();
  assert.equal((await store.list()).length, 1);
});

test('selection and state snapshots cannot change an active generation', async () => {
  const fake = fakeApi();
  const instance = builder(fake.api).instance;
  const done = instance.create();
  instance.select('creature', 'snail');
  instance.state().selections.creature = 'frog';
  await fake.settle(); await done;
  assert.equal(instance.state().selections.creature, 'moth');
  assert.equal(fake.requests.length, 1);
});

test('an undecodable image reports corruption rather than a network failure', async () => {
  const fake = fakeApi();
  const instance = createBuilder({
    api: fake.api, store: memoryStore(), newId: () => 'bad-image',
    now: () => new Date('2026-11-05T12:30:00Z'),
    inspect: async () => { throw new Error('cannot decode'); },
  }, selections);
  const done = instance.create(); await fake.settle(); await done;
  assert.equal(instance.state().status, 'failed');
  assert.equal(instance.state().error?.kind, 'corrupt');
  assert.equal(instance.state().preview, null);
});
