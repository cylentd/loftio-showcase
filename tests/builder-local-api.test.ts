import assert from "node:assert/strict";
import { test } from "node:test";
import { localApi } from "../src/builder/local-api.ts";
import { mockApi } from "../src/builder/mock-api.ts";

const body = { requestId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", selections: { creature: "moth", personality: "bookworm", signatureDetail: "reading-glasses", palette: null } };

test("local API posts once and polls the same job until a validated image arrives", async () => {
  const result = await mockApi({ rng: () => 0, now: () => new Date("2026-11-05T00:00:00Z"), newId: () => "generated-id" }).generate(body);
  const calls: any[] = [];
  const responses = [Response.json({ jobId: body.requestId }, { status: 202 }), Response.json({ pending: true }, { status: 202 }), Response.json(result)];
  const api = localApi({ fetcher: async (url: any, options: any) => { calls.push([url, options]); return responses.shift()!; }, wait: async () => {} });
  assert.deepEqual(await api.generate(body), result);
  assert.deepEqual(calls.map(call => call[1]?.method ?? "GET"), ["POST", "GET", "GET"]);
  assert.equal(calls[1][0], "/loftio-builder-api/jobs/" + body.requestId);
  assert.deepEqual(JSON.parse(calls[0][1].body), body);
});

test("a rejected job is surfaced without another POST or mock fallback", async () => {
  let calls = 0;
  const failure = { ok: false, error: { kind: "cap", message: "Local test limit reached." } };
  const api = localApi({ fetcher: async () => { calls++; return Response.json(failure, { status: 429 }); }, wait: async () => {} });
  assert.deepEqual(await api.generate(body), failure);
  assert.equal(calls, 1);
});

test("aborting while polling sends a separate cancellation request without the aborted signal", async () => {
  const controller = new AbortController();
  const calls: any[] = [];
  const api = localApi({ fetcher: async (url: any, options: any) => {
    calls.push([url, options]); return Response.json({ jobId: body.requestId }, { status: 202 });
  }, wait: async () => { controller.abort(); throw new DOMException("Aborted", "AbortError"); } });
  await assert.rejects(api.generate(body, controller.signal), /Aborted/);
  assert.deepEqual(calls.map(call => call[1]?.method), ["POST", "DELETE"]);
  assert.equal(calls[1][1].signal, undefined);
  assert.equal(calls[1][1].keepalive, true);
});

test("malformed success records are rejected rather than displayed or saved", async () => {
  const responses = [Response.json({ jobId: body.requestId }, { status: 202 }), Response.json({ ok: true, image: {}, generation: {} })];
  const api = localApi({ fetcher: async () => responses.shift() ?? Response.json({}), wait: async () => {} });
  await assert.rejects(api.generate(body), /Invalid local/);
});

test("durable observation can disconnect without cancelling its worker", async () => {
  const calls: string[] = [];
  const api = localApi({ durable: true, fetcher: async (_url: any, options: any) => {
    calls.push(options?.method ?? 'GET');
    return Response.json({ jobId: body.requestId }, { status: 202 });
  }, wait: async () => { throw new DOMException('Aborted', 'AbortError'); } });
  await assert.rejects(api.generate(body), /Aborted/);
  assert.deepEqual(calls, ['POST']);
});

test("durable ambiguous start observes the same request without another POST", async () => {
  const result = await mockApi({ rng: () => 0, now: () => new Date('2026-11-05T00:00:00Z'), newId: () => 'generated-id' }).generate(body);
  const calls: any[] = [];
  const api = localApi({ durable: true, fetcher: async (url: any, options: any) => {
    calls.push([url, options?.method ?? 'GET']);
    if (options?.method === 'POST') throw new Error('Response lost');
    return Response.json(result);
  }, wait: async () => {} });
  assert.deepEqual(await api.generate(body), result);
  assert.deepEqual(calls, [['/loftio-builder-api/generate', 'POST'], ['/loftio-builder-api/jobs/' + body.requestId, 'GET']]);
});

test('observing exposes the worker preparation stage without an invented percentage', async () => {
  const result = await mockApi({ rng: () => 0, now: () => new Date('2026-11-05T00:00:00Z'), newId: () => 'generated-id' }).generate(body);
  const stages: string[] = [];
  const responses = [Response.json({ jobId: body.requestId }, { status: 202 }), Response.json({ pending: true, stage: 'preparing' }, { status: 202 }), Response.json(result)];
  await localApi({ durable: true, fetcher: async () => responses.shift()!, wait: async () => {} }).generate(body, undefined, stage => stages.push(stage));
  assert.deepEqual(stages, ['preparing']);
});

test('a valid image from a different request cannot satisfy the observed job', async () => {
  const result = await mockApi({ rng: () => 0, now: () => new Date('2026-11-05T00:00:00Z'), newId: () => 'generated-id' }).generate({ ...body, requestId: 'different-request' });
  const api = localApi({ durable: true, fetcher: async () => Response.json(result), wait: async () => {} });
  await assert.rejects(api.observe!(body.requestId), /request/i);
});
