import { ProviderError, type ImageProvider, type ImageRequest, type FailureKind } from '../provider.ts';
import { resolveSelections, validateSelections, type UserSelections } from '../selections.ts';
import { PROMPT_VERSION, REFERENCE_IDS, renderPrompt } from '../prompt.ts';
import { readPngInfo } from '../png.ts';
import { REQUEST_ID_MAX_LENGTH, REQUEST_BODY_MAX_LENGTH, IMAGE_MAX_SIDE, IMAGE_MAX_BYTES } from '../constants.ts';
import { COPY } from '../copy.ts';
import type { GenerationRecord } from '../records.ts';
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
};

class GenerateSession {
  private options: HandlerOptions;
  private used = 0;
  private concurrent = 0;
  private cache = new Map<string, { fingerprint: string; response: Promise<Response> }>();

  constructor(options: HandlerOptions) { this.options = options; }

  private async generate(requestId: string, selections: UserSelections, signal: AbortSignal) {
    const resolvedSelections = resolveSelections(selections, this.options.rng);
    const prompt = renderPrompt(resolvedSelections);
    let attempts = 0;
    while (this.used < this.options.limits.sessionCap) {
      if (signal.aborted) return failure(499, 'aborted', COPY.aborted);
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
        return failure(kind === 'aborted' ? 499 : kind === 'safety' ? 422 : 502, kind, COPY[kind]);
      }
    }
    return failure(429, 'cap', COPY.cap);
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
    if (request.signal.aborted) return failure(499, 'aborted', COPY.aborted);
    if (this.used >= this.options.limits.sessionCap) return failure(429, 'cap', COPY.cap);
    if (this.concurrent >= this.options.limits.maxConcurrent) return failure(409, 'busy', COPY.busy);
    this.concurrent++;
    const response = this.generate(requestId, validated.value, request.signal).finally(() => { this.concurrent--; });
    this.cache.set(requestId, { fingerprint, response });
    return (await response).clone();
  }
}

export function createGenerateHandler(options: HandlerOptions) {
  const session = new GenerateSession(options);
  return (request: Request) => session.handle(request);
}
