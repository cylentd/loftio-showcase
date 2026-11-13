import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onlineApi } from '../../src/builder/online-api.ts';
import { mockApi } from '../../src/builder/mock-api.ts';
import { COPY } from '../../src/builder/copy.ts';
import { LOCAL_API_PREFIX } from '../../src/builder/constants.ts';

const body = { requestId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', selections: { creature: 'moth', personality: 'bookworm', signatureDetail: 'reading-glasses', palette: null } };
const make = () => mockApi({ rng: () => 0, now: () => new Date('2026-11-08T00:00:00Z'), newId: () => 'generated-id' }).generate(body as any);

function recorder(respond: () => Response | Promise<Response>) {
  const calls: any[] = [];
  const fetcher = (async (url: any, options: any) => { calls.push([url, options]); return respond(); }) as typeof fetch;
  return { calls, fetcher };
}

test('online API sends one POST with the Turnstile token beside requestId and selections', async () => {
  const result = await make();
  const { calls, fetcher } = recorder(() => Response.json(result));
  const api = onlineApi({ fetcher, getToken: async () => 'token-1' });
  assert.deepEqual(await api.generate(body as any), result);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], LOCAL_API_PREFIX + '/generate');
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][1].headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0][1].body), { requestId: body.requestId, selections: body.selections, turnstileToken: 'token-1' });
});

test('online API has no polling, cancel or prepare', () => {
  const api = onlineApi({ fetcher: (async () => Response.json({})) as typeof fetch, getToken: async () => 't' }) as any;
  assert.equal(api.observe, undefined);
  assert.equal(api.cancel, undefined);
  assert.equal(api.prepare, undefined);
});

test('a token that cannot be fetched gives the human-check message and sends nothing', async () => {
  const { calls, fetcher } = recorder(() => Response.json({}));
  const api = onlineApi({ fetcher, getToken: async () => { throw new Error('widget failed'); } });
  assert.deepEqual(await api.generate(body as any), { ok: false, error: { kind: 'invalid', message: COPY.human } });
  assert.equal(calls.length, 0);
  assert.equal(typeof COPY.human, 'string');
  assert.ok(COPY.human.length > 0);
});

test('failure bodies are returned as outcomes whatever the HTTP status', async () => {
  for (const [status, kind] of [[429, 'cap'], [403, 'invalid'], [502, 'network'], [200, 'busy']] as const) {
    const failure = { ok: false, error: { kind, message: `m-${status}` } };
    const { fetcher } = recorder(() => Response.json(failure, { status }));
    const api = onlineApi({ fetcher, getToken: async () => 't' });
    assert.deepEqual(await api.generate(body as any), failure, String(status));
  }
});

test('a success for another request is refused', async () => {
  const result: any = await make();
  const other = { ...result, generation: { ...result.generation, requestId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' } };
  const { fetcher } = recorder(() => Response.json(other));
  const api = onlineApi({ fetcher, getToken: async () => 't' });
  await assert.rejects(api.generate(body as any));
});

test('garbage bodies are refused rather than shown', async () => {
  const bad: unknown[] = [{}, { ok: true, image: {}, generation: {} }, { ok: false }, { ok: false, error: { kind: 'bogus', message: 'x' } },
    { ok: false, error: { kind: 'cap', message: 5 } }, 'text', null];
  for (const value of bad) {
    const { fetcher } = recorder(() => Response.json(value));
    const api = onlineApi({ fetcher, getToken: async () => 't' });
    await assert.rejects(api.generate(body as any), JSON.stringify(value));
  }
  const { fetcher } = recorder(() => new Response('<html>502</html>', { status: 502 }));
  await assert.rejects(onlineApi({ fetcher, getToken: async () => 't' }).generate(body as any));
});

test('a rejected fetch propagates, and the abort signal is forwarded', async () => {
  const controller = new AbortController();
  const calls: any[] = [];
  const fetcher = (async (_url: any, options: any) => { calls.push(options); throw new Error('offline'); }) as typeof fetch;
  const api = onlineApi({ fetcher, getToken: async () => 't' });
  await assert.rejects(api.generate(body as any, controller.signal), /offline/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].signal, controller.signal);
});
