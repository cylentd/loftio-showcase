import type { BuilderApi, GenerateOutcome } from './controller.ts';
import { validGeneration, validImage } from './storage-contract.ts';
import { LOCAL_API_PREFIX } from './constants.ts';
import { TURNSTILE_BODY_FIELD } from './server/online-config.ts';
import { COPY } from './copy.ts';

const failureKinds = new Set(['invalid', 'network', 'safety', 'corrupt', 'aborted', 'cap', 'busy', 'storage', 'preparation']);

function outcome(input: unknown, requestId: string): GenerateOutcome {
  if (!input || typeof input !== 'object') throw new Error('Invalid online response.');
  const body = input as Record<string, unknown>;
  if (body.ok === true && validGeneration(body.generation) && validImage(body.image)) {
    const result = body as Extract<GenerateOutcome, { ok: true }>;
    if (result.generation.requestId !== requestId) throw new Error('Online result belongs to another request.');
    return result;
  }
  const error = body.error as Record<string, unknown> | undefined;
  if (body.ok === false && error && typeof error.kind === 'string' && failureKinds.has(error.kind)
    && typeof error.message === 'string') return body as GenerateOutcome;
  throw new Error('Invalid online generation record.');
}

/** The public showcase's API: one POST per image, carrying a Turnstile token. No polling, cancel or prepare. */
export function onlineApi({ fetcher = fetch, getToken }: { fetcher?: typeof fetch; getToken: () => Promise<string> }): BuilderApi {
  return {
    async generate(body, signal) {
      let token: string;
      try { token = await getToken(); } catch { return { ok: false, error: { kind: 'invalid', message: COPY.human } }; }
      const response = await fetcher(LOCAL_API_PREFIX + '/generate', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: body.requestId, selections: body.selections, [TURNSTILE_BODY_FIELD]: token }), signal });
      return outcome(await response.json(), body.requestId);
    },
  };
}
