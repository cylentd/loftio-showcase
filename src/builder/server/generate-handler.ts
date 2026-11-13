import { ProviderError, type ImageProvider, type ImageRequest, type FailureKind } from '../provider.ts';
import { resolveSelections, validateSelections, type UserSelections } from '../selections.ts';
import { PROMPT_VERSION, REFERENCE_IDS, renderPrompt } from '../prompt.ts';
import { readPngInfo } from '../png.ts';
import { REQUEST_ID_MAX_LENGTH, REQUEST_BODY_MAX_LENGTH, IMAGE_MAX_SIDE, IMAGE_MAX_BYTES, RESPONSE_CACHE_MAX, REPLAY_ONLY_HEADER } from '../constants.ts';
import { COPY } from '../copy.ts';
import type { GenerationRecord, GeneratedImage } from '../records.ts';
export type GeneratedOutput = { ok: true; generation: GenerationRecord; image: Extract<GeneratedImage, { base64: string }>; usage: { used: number; cap: number } };
export type HandlerLimits = { sessionCap: number; maxConcurrent: number; technicalRetries: number };

const failure = (status: number, kind: FailureKind, message: string) =>
  Response.json({ ok: false, error: { kind, message } }, { status, headers: { 'Cache-Control': 'no-store' } });

async function abortable(provider: ImageProvider, request: ImageRequest) {
  const signal = request.signal;
  if (signal?.aborted) throw new ProviderError('aborted', COPY.aborted);
  let onAbort = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new ProviderError('aborted', COPY.aborted));
    signal?.addEventListener('abort', onAbort, { once: true });
  });
  try { return await Promise.race([provider.generate(request), cancelled]); }
  finally { signal?.removeEventListener('abort', onAbort); }
}

type HandlerOptions = {
  provider: ImageProvider; rng: () => number; now: () => Date; newId: () => string; limits: HandlerLimits;
  onPrepared?: (generation: GenerationRecord) => Promise<void>;
  onGenerated?: (output: GeneratedOutput) => Promise<void>;
};

type CacheEntry = { fingerprint: string; settled: boolean; response: Promise<Response> };
const HTTP_BAD_GATEWAY = 502;
const HTTP_CONFLICT = 409;
// The provider's safety filter refused the prompt: the request is well-formed but cannot be processed.
const HTTP_UNPROCESSABLE = 422;
// nginx's "client closed request": the visitor went away, so the answer says nothing about the id.
const HTTP_CLIENT_CLOSED = 499;
// Answers that are transient: replaying one would pin the id to a failure, so a same-id retry runs again.
const UNCACHED_STATUSES: readonly number[] = [HTTP_BAD_GATEWAY, HTTP_CLIENT_CLOSED];

class GenerateSession {
  private options: HandlerOptions;
  private used = 0;
  private concurrent = 0;
  private cache = new Map<string, CacheEntry>();

  constructor(options: HandlerOptions) { this.options = options; }

  private async generate(requestId: string, selections: UserSelections, signal: AbortSignal) {
    const resolvedSelections = resolveSelections(selections, this.options.rng);
    const prompt = renderPrompt(resolvedSelections);
    let attempts = 0;
    while (this.used < this.options.limits.sessionCap) {
      if (signal.aborted) return failure(HTTP_CLIENT_CLOSED, 'aborted', COPY.aborted);
      this.used++;
      attempts++;
      try {
        const generation: GenerationRecord = {
          id: this.options.newId(), requestId, userSelections: selections, resolvedSelections,
          promptVersion: PROMPT_VERSION, prompt, referenceIds: REFERENCE_IDS,
          providerId: this.options.provider.id, modelId: this.options.provider.model,
          attempts, createdAt: this.options.now().toISOString(),
        };
        await this.options.onPrepared?.(structuredClone(generation));
        const result = await abortable(this.options.provider, { prompt, referenceIds: REFERENCE_IDS, signal });
        const info = readPngInfo(result.bytes);
        if (result.mime !== 'image/png' || !info || !info.width || !info.height
          || info.width > IMAGE_MAX_SIDE || info.height > IMAGE_MAX_SIDE || result.bytes.length > IMAGE_MAX_BYTES) {
          throw new ProviderError('corrupt', COPY.corrupt);
        }
        let binary = '';
        for (const byte of result.bytes) binary += String.fromCharCode(byte);
        return Response.json({
          ok: true,
          generation,
          image: { ...info, mime: 'image/png', base64: btoa(binary) },
          usage: { used: this.used, cap: this.options.limits.sessionCap },
        }, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        const kind = error instanceof ProviderError ? error.kind : 'network';
        const retryable = kind === 'network' || kind === 'corrupt';
        if (retryable && attempts <= this.options.limits.technicalRetries && this.used < this.options.limits.sessionCap) continue;
        return failure(kind === 'aborted' ? HTTP_CLIENT_CLOSED : kind === 'safety' ? HTTP_UNPROCESSABLE : HTTP_BAD_GATEWAY, kind, COPY[kind]);
      }
    }
    return failure(429, 'cap', COPY.cap);
  }

  // True when this instance already holds a response for requestId, in flight or done: a repeat replays it.
  replays(requestId: string): boolean {
    return this.cache.has(requestId);
  }

  async handle(request: Request): Promise<Response> {
    if (request.method !== 'POST') return failure(405, 'invalid', COPY.method);
    let body: { requestId?: unknown; selections?: unknown };
    try {
      const text = await request.text();
      if (text.length > REQUEST_BODY_MAX_LENGTH) return failure(400, 'invalid', COPY.invalid);
      body = JSON.parse(text);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return failure(400, 'invalid', COPY.invalid);
    } catch { return failure(400, 'invalid', COPY.invalid); }
    const validated = validateSelections(body.selections);
    const requestId = body.requestId;
    if (!validated.ok || typeof requestId !== 'string' || !requestId.trim() || requestId.length > REQUEST_ID_MAX_LENGTH) {
      return failure(400, 'invalid', COPY.invalid);
    }
    const fingerprint = JSON.stringify(validated.value);
    const cached = this.cache.get(requestId);
    if (cached) {
      if (cached.fingerprint !== fingerprint) return failure(409, 'invalid', COPY.conflict);
      return (await cached.response).clone();
    }
    // Let through as a replay with no cap slot, but evicted meanwhile: generating now would be a slotless provider call.
    if (request.headers.has(REPLAY_ONLY_HEADER)) return failure(HTTP_CONFLICT, 'busy', COPY.busy);
    if (request.signal.aborted) return failure(HTTP_CLIENT_CLOSED, 'aborted', COPY.aborted);
    if (this.used >= this.options.limits.sessionCap) return failure(429, 'cap', COPY.cap);
    if (this.concurrent >= this.options.limits.maxConcurrent) return failure(409, 'busy', COPY.busy);
    this.concurrent++;
    // The callbacks below run after `entry` is built, a tick later, so they may read it.
    const response = this.generate(requestId, validated.value, request.signal).then(async result => {
      if (result.ok && this.options.onGenerated) {
        try { await this.options.onGenerated(await result.clone().json() as GeneratedOutput); } catch {}
      }
      if (UNCACHED_STATUSES.includes(result.status)) this.forget(requestId, entry);
      entry.settled = true;
      return result;
    }).catch(error => {
      // A rejection settles and drops the entry too, or it would sit unsettled and never evict.
      this.forget(requestId, entry);
      entry.settled = true;
      throw error;
    }).finally(() => { this.concurrent--; });
    const entry: CacheEntry = { fingerprint, settled: false, response };
    this.cache.set(requestId, entry);
    this.evict();
    return (await response).clone();
  }

  private forget(requestId: string, entry: CacheEntry) {
    if (this.cache.get(requestId) === entry) this.cache.delete(requestId);
  }

  // Drops the oldest answered ids beyond RESPONSE_CACHE_MAX. An id still generating is never dropped:
  // a repeat must wait for it, not start a second provider call.
  private evict() {
    for (const [id, entry] of this.cache) {
      if (this.cache.size <= RESPONSE_CACHE_MAX) return;
      if (entry.settled) this.cache.delete(id);
    }
  }
}

export type GenerateHandler = ((request: Request) => Promise<Response>) & { replays(requestId: string): boolean };

export function createGenerateHandler(options: HandlerOptions): GenerateHandler {
  const session = new GenerateSession(options);
  return Object.assign((request: Request) => session.handle(request), {
    replays: (requestId: string) => session.replays(requestId),
  });
}
