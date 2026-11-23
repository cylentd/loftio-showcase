import type { BuilderApi, GenerateOutcome, StageListener } from './controller.ts';
import { validGeneration, validImage } from './storage-contract.ts';
import { parseFollowUp } from './follow-up-model.ts';
import { ALT_ID, LOCAL_API_PREFIX, LOCAL_POLL_INTERVAL_MS, LOCAL_POLL_LIMIT } from './constants.ts';
import type { AltReference } from './records.ts';

const failureKinds = new Set(['invalid', 'network', 'safety', 'corrupt', 'aborted', 'cap', 'busy', 'storage', 'preparation']);

function outcome(input: unknown, requestId: string): GenerateOutcome {
  if (!input || typeof input !== 'object') throw new Error('Invalid local worker response.');
  const body = input as Record<string, unknown>;
  if (body.ok === true && validGeneration(body.generation) && validImage(body.image)) {
    const result = body as Extract<GenerateOutcome, { ok: true }>;
    if (result.generation.requestId !== requestId) throw new Error('Local result belongs to another request.');
    return result;
  }
  const error = body.error as Record<string, unknown> | undefined;
  if (body.ok === false && error && typeof error.kind === 'string' && failureKinds.has(error.kind)
    && typeof error.message === 'string') return body as GenerateOutcome;
  throw new Error('Invalid local generation record.');
}

function pause(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, LOCAL_POLL_INTERVAL_MS);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

/** The images the worker draws the alt from: the idle and, when its slot is ready, the expression: the same rule the request follows. */
const altReferences = (request: { id: string; expression?: unknown }): { references?: AltReference[] } =>
  request.id !== ALT_ID ? {} : { references: request.expression ? ['idle', 'expression'] : ['idle'] };

/** The expression or alt: polls the job's follow-ups route until the slot leaves pending. Never throws; every way it can go
 *  wrong is a failed outcome, and the idle is already saved. */
function followUpPoller(fetcher: typeof fetch, wait: (signal?: AbortSignal) => Promise<void>, jobUrl: (id: string) => string): NonNullable<BuilderApi['followUp']> {
  return async (request, signal) => {
    try {
      for (let poll = 0; poll < LOCAL_POLL_LIMIT; poll++) {
        await wait(signal);
        const response = await fetcher(jobUrl(request.requestId) + '/follow-ups', { signal, cache: 'no-store' });
        const slot = parseFollowUp(((await response.json()) as { followUps?: Record<string, unknown> } | null)?.followUps?.[request.id]);
        if (!slot) return { ok: false, kind: 'corrupt' };
        if (slot.status === 'ready') return { ok: true, image: slot.image, promptVersion: slot.promptVersion, createdAt: slot.createdAt, ...altReferences(request) };
        if (slot.status === 'failed') return { ok: false, kind: slot.kind };
      }
      return { ok: false, kind: 'network' };
    } catch { return { ok: false, kind: signal?.aborted ? 'aborted' : 'network' }; }
  };
}

export function localApi({ fetcher = fetch, wait = pause, durable = false }: {
  fetcher?: typeof fetch; wait?: (signal?: AbortSignal) => Promise<void>; durable?: boolean;
} = {}): BuilderApi {
  const jobUrl = (id: string) => LOCAL_API_PREFIX + '/jobs/' + encodeURIComponent(id);
  const cancel = async (id: string) => {
    const response = await fetcher(jobUrl(id), { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, keepalive: true });
    if (!response.ok) throw new Error('Could not cancel local job.');
    return (await response.json())?.cancelled === true;
  };
  const observe = async (id: string, signal?: AbortSignal, onStage?: StageListener) => {
    for (let poll = 0; poll < LOCAL_POLL_LIMIT; poll++) {
      await wait(signal);
      const result = await fetcher(jobUrl(id), { signal, cache: 'no-store' });
      if (result.status !== 202) return outcome(await result.json(), id);
      const pending = await result.json();
      onStage?.(pending.stage === 'preparing' ? 'preparing' : 'creating');
    }
    throw new Error('Local generation timed out.');
  };
  const followUp = followUpPoller(fetcher, wait, jobUrl);
  return {
    followUp,
    resumeFollowUp: followUp, // the worker keeps the slot by request id, so a reloaded page can poll it again
    ...(durable ? { observe, cancel, prepare: async (id: string) => outcome(await (await fetcher(jobUrl(id) + '/prepare', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })).json(), id) } : {}),
    async generate(body, signal, onStage) {
      try {
        let response: Response;
        try {
          response = await fetcher(LOCAL_API_PREFIX + '/generate', { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
        } catch (error) {
          if (!durable || signal?.aborted) throw error;
          return await observe(body.requestId, signal, onStage);
        }
        if (response.status !== 202) return outcome(await response.json(), body.requestId);
        const accepted = await response.json();
        if (accepted.jobId !== body.requestId) throw new Error('Invalid local job ID.');
        return await observe(body.requestId, signal, onStage);
      } catch (error) {
        if (!durable) void cancel(body.requestId).catch(() => {});
        throw error;
      }
    },
  };
}
