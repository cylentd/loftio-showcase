import assert from "node:assert/strict";
import { test } from "node:test";
import { SURPRISE } from "../../src/builder/catalog-data.ts";
import { encodeRgbaPng } from "../../src/builder/png.ts";
import { ProviderError, type ImageProvider, type ImageRequest } from "../../src/builder/provider.ts";
import { createGenerateHandler, type HandlerLimits } from "../../src/builder/server/generate-handler.ts";

const selections = { creature: "moth", personality: "bookworm", signatureDetail: "reading-glasses", palette: null };
const LIMITS: HandlerLimits = { sessionCap: 5, maxConcurrent: 2, technicalRetries: 1 };
const pngBytes = await encodeRgbaPng(2, 2, new Uint8Array(16));

type Step = "ok" | "network" | "safety" | "corrupt" | "hang";

function scriptedProvider(steps: Step[]) {
  const calls: ImageRequest[] = [];
  const provider: ImageProvider = {
    id: "fake",
    model: "fake-model",
    async generate(request) {
      calls.push(request);
      const step = steps.shift() ?? "ok";
      if (step === "network") throw new ProviderError("network", "socket closed");
      if (step === "safety") throw new ProviderError("safety", "rejected");
      if (step === "corrupt") return { bytes: new Uint8Array([1, 2, 3]), mime: "image/png" };
      if (step === "hang") await new Promise((_, reject) => request.signal?.addEventListener("abort", () => reject(new ProviderError("aborted", "stopped"))));
      return { bytes: pngBytes, mime: "image/png" };
    },
  };
  return { provider, calls };
}

let ids = 0;
function handlerWith(steps: Step[], limits: Partial<HandlerLimits> = {}) {
  const fake = scriptedProvider(steps);
  const handle = createGenerateHandler({
    provider: fake.provider,
    rng: () => 0,
    now: () => new Date("2026-11-05T12:00:00Z"),
    newId: () => `gen-${++ids}`,
    limits: { ...LIMITS, ...limits },
  });
  return { handle, calls: fake.calls };
}

function post(body: unknown, signal?: AbortSignal): Request {
  return new Request("http://local/api/builder/generate", { method: "POST", body: JSON.stringify(body), signal });
}

test("one Create is one provider call that returns one image and its full record", async () => {
  const { handle, calls } = handlerWith(["ok"]);
  const response = await handle(post({ requestId: "r1", selections }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.prompt ?? "", /moth/);
  assert.deepEqual(calls[0]?.referenceIds, ["loftio-original-six", "loftio-exploratory-concepts"]);
  assert.equal(body.generation.requestId, "r1");
  assert.deepEqual(body.generation.userSelections, selections);
  assert.equal(body.generation.resolvedSelections.palette.colors.length, 3);
  assert.equal(body.generation.promptVersion, "v4.2");
  assert.equal(body.generation.providerId, "fake");
  assert.equal(body.generation.modelId, "fake-model");
  assert.equal(body.generation.attempts, 1);
  assert.equal(body.generation.createdAt, "2026-11-05T12:00:00.000Z");
  assert.equal(body.image.mime, "image/png");
  assert.equal(body.image.hasAlphaChannel, true);
  assert.equal(typeof body.image.base64, "string");
});

test("surprise choices come back resolved, never as surprise", async () => {
  const { handle, calls } = handlerWith(["ok"]);
  const all = { creature: SURPRISE, personality: SURPRISE, signatureDetail: SURPRISE, palette: null };
  const body = await (await handle(post({ requestId: "r2", selections: all }))).json();
  const resolved = body.generation.resolvedSelections;
  for (const field of ["creature", "personality", "signatureDetail", "palette"]) assert.notEqual(resolved[field].id, SURPRISE);
  assert.deepEqual(body.generation.userSelections, all);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.prompt, /Invent an original creature/);
  assert.match(calls[0]!.prompt, /Invent a distinctive personality/);
  assert.match(calls[0]!.prompt, /Invent an unexpected signature detail/);
});

test("a repeated request id is answered once, whether it arrives during or after the first", async () => {
  const { handle, calls } = handlerWith(["ok"]);
  const [first, second] = await Promise.all([handle(post({ requestId: "dup", selections })), handle(post({ requestId: "dup", selections }))]);
  const third = await handle(post({ requestId: "dup", selections }));
  assert.equal(calls.length, 1);
  const bodies = await Promise.all([first.json(), second.json(), third.json()]);
  assert.equal(new Set(bodies.map(body => body.generation.id)).size, 1);
});

test("invalid selections are refused before any paid call", async () => {
  const { handle, calls } = handlerWith(["ok"]);
  const response = await handle(post({ requestId: "r3", selections: { ...selections, creature: "dragon" } }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.kind, "invalid");
  assert.equal(calls.length, 0);
});

test("a missing or oversized request id is refused", async () => {
  const { handle, calls } = handlerWith(["ok"]);
  assert.equal((await handle(post({ selections }))).status, 400);
  assert.equal((await handle(post({ requestId: "x".repeat(65), selections }))).status, 400);
  assert.equal((await handle(new Request("http://local/api/builder/generate", { method: "POST", body: "{" }))).status, 400);
  assert.equal(calls.length, 0);
});

test("one network failure is retried once and both calls count toward the cap", async () => {
  const { handle, calls } = handlerWith(["network", "ok"], { sessionCap: 3 });
  const body = await (await handle(post({ requestId: "r4", selections }))).json();
  assert.equal(calls.length, 2);
  assert.equal(body.generation.attempts, 2);
  assert.equal(body.usage.used, 2);
});

test("technical retries stop at the bound and report the failure", async () => {
  const { handle, calls } = handlerWith(["network", "corrupt", "ok"]);
  const response = await handle(post({ requestId: "r5", selections }));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.kind, "corrupt");
  assert.equal(calls.length, 2);
});

test("a safety rejection is reported, not silently re-rolled", async () => {
  const { handle, calls } = handlerWith(["safety", "ok"]);
  const response = await handle(post({ requestId: "r6", selections }));
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.kind, "safety");
  assert.equal(calls.length, 1);
});

test("the session cap refuses further paid calls, retries included", async () => {
  const { handle, calls } = handlerWith(["network", "network", "ok"], { sessionCap: 1 });
  assert.equal((await handle(post({ requestId: "c1", selections }))).status, 502);
  const capped = await handle(post({ requestId: "c2", selections }));
  assert.equal(capped.status, 429);
  assert.equal((await capped.json()).error.kind, "cap");
  assert.equal(calls.length, 1);
});

test("requests past the concurrency limit are refused instead of queued", async () => {
  const { handle, calls } = handlerWith(["hang"], { maxConcurrent: 1 });
  const controller = new AbortController();
  const first = handle(post({ requestId: "slow", selections }, controller.signal));
  const busy = await handle(post({ requestId: "other", selections }));
  assert.equal(busy.status, 409);
  controller.abort();
  assert.equal((await first).status, 499);
  assert.equal(calls.length, 1);
});

test("only POST generates", async () => {
  const { handle, calls } = handlerWith(["ok"]);
  assert.equal((await handle(new Request("http://local/api/builder/generate"))).status, 405);
  assert.equal(calls.length, 0);
});

test('a request ID cannot be reused with different selections', async () => {
  const { handle, calls } = handlerWith(['ok']);
  await handle(post({ requestId: 'same', selections }));
  const changed = await handle(post({ requestId: 'same', selections: { ...selections, creature: 'snail' } }));
  assert.equal(changed.status, 409);
  assert.equal(calls.length, 1);
});

test('a cancelled request makes no provider call', async () => {
  const { handle, calls } = handlerWith(['ok']);
  const controller = new AbortController();
  controller.abort();
  assert.equal((await handle(post({ requestId: 'cancelled', selections }, controller.signal))).status, 499);
  assert.equal(calls.length, 0);
});
