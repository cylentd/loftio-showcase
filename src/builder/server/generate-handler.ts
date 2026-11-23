import { ProviderError, type ImageProvider, type ImageRequest, type FailureKind, type NamePackProvider } from '../provider.ts';
import { requestNamePack } from './name-pack.ts';
import { resolveSelections, validateSelections, type UserSelections } from '../selections.ts';
import { PROMPT_VERSION, REFERENCE_IDS, renderPrompt } from '../prompt.ts';
import { readPngInfo, type PngInfo } from '../png.ts';
import { REQUEST_ID_MAX_LENGTH, REQUEST_BODY_MAX_LENGTH, IMAGE_MAX_SIDE, IMAGE_MAX_BYTES, RESPONSE_CACHE_MAX, REPLAY_ONLY_HEADER, FOLLOW_UP_IDS, ALT_ID, EXPRESSION_ID } from '../constants.ts';
import { FOLLOW_UPS, type FollowUpContext, type FollowUpDef } from '../follow-ups.ts';
import type { AltKind } from '../alt-kind.ts';
import { ALT_PROMPT_BLOCKS } from '../alt-prompt-data.ts';
import { ELEMENTS, TRAITS } from '../../loadout/loadout-model.ts';
import { COPY } from '../copy.ts';
import type { GenerationRecord, GeneratedImage } from '../records.ts';
import type { NamePack } from '../../loadout/loadout-name-model.ts';
import type { ResolvedSelections } from '../selections.ts';
import {
  FOLLOW_UP_BODY_MAX_LENGTH, FOLLOW_UP_IDLE_MAX_LENGTH, FOLLOW_UP_KEY_PREFIX, FOLLOW_UP_START_DEADLINE_MS, FOLLOW_UP_STORE_MARGIN_MS,
  FOLLOW_UP_TOKEN_TTL_MS, ONLINE_RESPONSE_MAX_BYTES, type TokenStore,
} from './online-config.ts';
export type GeneratedOutput = { ok: true; generation: GenerationRecord; image: Extract<GeneratedImage, { base64: string }>; usage: { used: number; cap: number }; names?: NamePack; followUp?: { token: string; ids: readonly string[] } };
export type HandlerLimits = { sessionCap: number; maxConcurrent: number; technicalRetries: number };
// A follow-up draws from earlier images: bytes (online, the idle the browser sent) or files (local, the idle's original.png).
export type FollowUpReferences = Pick<ImageRequest, 'referenceImages' | 'referencePaths'>;

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

/**
 * Draws one follow-up image from earlier ones and checks it: a PNG within the follow-up's side, under IMAGE_MAX_BYTES, and with
 * transparency when the entry needs it. The local worker and the online handler both call this, so they refuse the same results.
 */
export async function drawFollowUp(provider: ImageProvider, def: FollowUpDef, ctx: FollowUpContext, references: FollowUpReferences, signal?: AbortSignal) {
  const request = { prompt: def.renderPrompt(ctx), referenceIds: [], ...references, opaque: !def.alphaRequired, signal };
  const result = await abortable(provider, request);
  const info = readPngInfo(result.bytes);
  const side = Math.min(def.maxSide, IMAGE_MAX_SIDE);
  if (result.mime !== 'image/png' || !info || !info.width || !info.height || info.width > side || info.height > side
    || result.bytes.length > IMAGE_MAX_BYTES || (def.alphaRequired && !info.hasAlphaChannel)) {
    throw new ProviderError('corrupt', COPY.corrupt);
  }
  return { bytes: result.bytes, info };
}

type HandlerOptions = {
  provider: ImageProvider; rng: () => number; now: () => Date; newId: () => string; limits: HandlerLimits;
  // The largest follow-up reply, as encoded length. Default ONLINE_RESPONSE_MAX_BYTES (the platform's body limit, less a margin).
  responseMaxBytes?: number;
  // False: the idle reply carries no follow-up token (the local worker follows up itself, with no second request).
  issueFollowUpTokens?: boolean;
  // Where follow-up tokens live. Absent: none are issued and every follow-up is refused. Online it is the shared Redis, so any
  // instance can redeem a token; a test passes the in-memory port.
  tokenStore?: TokenStore;
  onPrepared?: (generation: GenerationRecord) => Promise<void>;
  onGenerated?: (output: GeneratedOutput) => Promise<void>;
  // The text seam for the themed-name pack, asked once after the image succeeds. Absent: no names, nothing else changes.
  namePack?: NamePackProvider;
  namePackTimeoutMs?: number;
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
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_PAYLOAD_TOO_LARGE = 413;
const HTTP_GATEWAY_TIMEOUT = 504;

// What a follow-up token stands for, stored as JSON in the shared token store, one key per follow-up id: one build (its start, for
// the deadline), the idle that build returned (by hash), the selections its images are drawn for, and the last millisecond it may be
// redeemed. The alt's key also holds `expressionSha256` once the server has drawn the expression: the alt may then cite that image.
type FollowUpToken = { buildId: string; idleSha256: string; createdAt: number; expiresAt: number; resolved: ResolvedSelections; expressionSha256?: string };
const tokenKey = (token: string, id: string) => `${FOLLOW_UP_KEY_PREFIX}${token}:${id}`;
// What the alt request sends beside the images: each is checked against its fixed list, so no free text reaches the prompt.
const ALT_KIND_VALUES: readonly string[] = Object.keys(ALT_PROMPT_BLOCKS.kind);
type AltFields = Pick<FollowUpContext, 'kind' | 'trait' | 'element'>;
const isOneOf = (list: readonly string[], value: unknown): value is string => typeof value === 'string' && list.includes(value);

function parseAltFields(body: Record<string, unknown>): AltFields | null {
  const { kind, trait, element } = body;
  if (!isOneOf(ALT_KIND_VALUES, kind) || !isOneOf(TRAITS, trait) || !isOneOf(ELEMENTS, element)) return null;
  return { kind: kind as AltKind, trait: trait as AltFields['trait'], element: element as AltFields['element'] };
}
const HEX_RADIX = 16;
const HEX_BYTE_CHARS = 2;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), byte => byte.toString(HEX_RADIX).padStart(HEX_BYTE_CHARS, '0')).join('');
}

function parseToken(raw: string | null): FollowUpToken | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw);
    const ok = value && typeof value.idleSha256 === 'string' && Number.isFinite(value.createdAt) && Number.isFinite(value.expiresAt) && value.resolved;
    return ok ? value as FollowUpToken : null;
  } catch { return null; }
}

function providerFailure(error: unknown) {
  const kind = error instanceof ProviderError ? error.kind : 'network';
  const status = kind === 'aborted' ? HTTP_CLIENT_CLOSED : kind === 'safety' ? HTTP_UNPROCESSABLE : HTTP_BAD_GATEWAY;
  return { kind, response: failure(status, kind, COPY[kind]) };
}

// An earlier image a follow-up sent (the idle, or the expression an alt cites), or null when it is not base64, not a PNG, or over IMAGE_MAX_BYTES.
// Each is held to the idle's field limit: the whole body is already held to the platform limit.
function decodeIdle(value: unknown): Uint8Array | null {
  if (typeof value !== 'string' || value.length > FOLLOW_UP_IDLE_MAX_LENGTH) return null;
  try {
    const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0));
    return bytes.length <= IMAGE_MAX_BYTES && readPngInfo(bytes) ? bytes : null;
  } catch { return null; }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

class GenerateSession {
  private options: HandlerOptions;
  private used = 0;
  private concurrent = 0;
  private cache = new Map<string, CacheEntry>();

  constructor(options: HandlerOptions) { this.options = options; }

  // A token is issued with the idle answer, on this handler's clock, into the shared store so any instance can redeem it.
  // No store, or a store that fails, means no token: the idle is already paid for and is returned without a follow-up.
  private async issueToken(generation: GenerationRecord, resolved: ResolvedSelections, idle: Uint8Array): Promise<string | null> {
    const store = this.options.tokenStore;
    if (!store) return null;
    const token = crypto.randomUUID();
    const record: FollowUpToken = {
      buildId: generation.id, idleSha256: await sha256Hex(idle), createdAt: Date.parse(generation.createdAt),
      expiresAt: this.options.now().getTime() + FOLLOW_UP_TOKEN_TTL_MS, resolved,
    };
    // One key per follow-up id, so each id redeems once and one cannot spend another.
    try {
      for (const id of FOLLOW_UP_IDS) {
        if (!await store.setNX(tokenKey(token, id), JSON.stringify(record), FOLLOW_UP_TOKEN_TTL_MS + FOLLOW_UP_STORE_MARGIN_MS)) return null;
      }
      return token;
    } catch { return null; }
  }

  // The one-time take: of two redeems of a token's id, the store hands its value to one. A store that fails is a gateway failure.
  private async redeem(token: string, id: string): Promise<FollowUpToken | null | 'unavailable'> {
    try { return parseToken(await this.options.tokenStore!.getDel(tokenKey(token, id))); }
    catch { return 'unavailable'; }
  }

  // After an expression is drawn, its hash goes into the alt's key, so the alt can cite only the image the server drew. The store
  // has no overwrite: the key is taken and set again with its remaining life. An alt already redeemed has no key, so nothing is
  // written; an alt asked in the instant between the two steps is refused (403) and the browser shows no alt.
  private async vouchExpression(token: string, expression: Uint8Array): Promise<void> {
    const store = this.options.tokenStore!;
    try {
      const alt = parseToken(await store.getDel(tokenKey(token, ALT_ID)));
      const ttlMs = alt ? alt.expiresAt - this.options.now().getTime() + FOLLOW_UP_STORE_MARGIN_MS : 0;
      if (alt && ttlMs > 0) await store.setNX(tokenKey(token, ALT_ID), JSON.stringify({ ...alt, expressionSha256: await sha256Hex(expression) }), ttlMs);
    } catch { /* the alt then draws from the idle alone, or is refused; the expression itself is already drawn */ }
  }

  // The second request of a build: no cap slot and no retry, so a refusal is final. The token is spent before the provider is called.
  private async followUp(body: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
    const def = FOLLOW_UPS.find(entry => entry.id === body.id);
    const idle = decodeIdle(body.idle);
    // An alt may cite the expression (absent: the idle alone) and names its kind, trait and element; a malformed one is refused before the token is spent.
    const expression = body.expression === undefined ? undefined : decodeIdle(body.expression);
    const alt = def?.id === ALT_ID ? parseAltFields(body) : null;
    // Only the alt may cite an expression: its hash is checked below, so on the expression request the field would attach any PNG.
    if (!def || !idle || typeof body.token !== 'string' || (def.id === ALT_ID && (expression === null || !alt))
      || (def.id !== ALT_ID && expression !== undefined)) return failure(HTTP_BAD_REQUEST, 'invalid', COPY.invalid);
    if (!this.options.tokenStore) return failure(HTTP_FORBIDDEN, 'invalid', COPY.invalid);
    const entry = await this.redeem(body.token, def.id);
    if (entry === 'unavailable') return failure(HTTP_BAD_GATEWAY, 'network', COPY.network);
    const now = this.options.now().getTime();
    // Expired, unknown, used, bound to another idle, or citing an expression the server did not draw: one answer, so a refusal says nothing about which.
    if (!entry || now > entry.expiresAt || entry.idleSha256 !== await sha256Hex(idle)
      || (def.id === ALT_ID && expression && entry.expressionSha256 !== await sha256Hex(expression))) return failure(HTTP_FORBIDDEN, 'invalid', COPY.invalid);
    // Not measured: the alt starts after the expression ends, so it can pass this deadline where the expression would not (see online-config.ts).
    if (now - entry.createdAt > FOLLOW_UP_START_DEADLINE_MS) return failure(HTTP_GATEWAY_TIMEOUT, 'network', COPY.network);
    // The expression prompt reads only `resolved`; the alt's kind, trait and element were checked above.
    const ctx = { resolved: entry.resolved, residentId: entry.buildId, ...alt } as FollowUpContext;
    try {
      const references = { referenceImages: def.id === ALT_ID && expression ? [idle, expression] : [idle] };
      const { bytes, info } = await drawFollowUp(this.options.provider, def, ctx, references, signal);
      const base64 = encodeBase64(bytes);
      if (base64.length > (this.options.responseMaxBytes ?? ONLINE_RESPONSE_MAX_BYTES)) return failure(HTTP_PAYLOAD_TOO_LARGE, 'cap', COPY.expressionTooLarge);
      if (def.id === EXPRESSION_ID) await this.vouchExpression(body.token, bytes);
      const { width, height, hasAlphaChannel } = info;
      return Response.json({ ok: true, id: def.id, [def.id]: { base64, mime: 'image/png', width, height, hasAlphaChannel } },
        { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) { return providerFailure(error).response; }
  }

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
        // After the image, so a failed image never spends a text call; inside the cached answer, so a replay never makes a second.
        // A visitor who left after the image gets no text call: it would spend for an answer nobody reads.
        const names = this.options.namePack && !signal.aborted
          ? await requestNamePack(this.options.namePack, resolvedSelections, this.options.namePackTimeoutMs, signal)
          : null;
        const token = this.options.issueFollowUpTokens === false ? null : await this.issueToken(generation, resolvedSelections, result.bytes);
        return Response.json({
          ok: true,
          generation,
          image: { ...info, mime: 'image/png', base64: encodeBase64(result.bytes) },
          ...(names ? { names } : {}),
          ...(token ? { followUp: { token, ids: FOLLOW_UP_IDS } } : {}),
          usage: { used: this.used, cap: this.options.limits.sessionCap },
        }, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        const { kind, response } = providerFailure(error);
        const retryable = kind === 'network' || kind === 'corrupt';
        if (retryable && attempts <= this.options.limits.technicalRetries && this.used < this.options.limits.sessionCap) continue;
        return response;
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
    let body: { requestId?: unknown; selections?: unknown; token?: unknown };
    try {
      const text = await request.text();
      if (text.length > FOLLOW_UP_BODY_MAX_LENGTH) return failure(HTTP_BAD_REQUEST, 'invalid', COPY.invalid);
      body = JSON.parse(text);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return failure(HTTP_BAD_REQUEST, 'invalid', COPY.invalid);
      // A body with a token is a follow-up and may be as large as one idle; every other body keeps the create cap.
      if ('token' in body) return await this.followUp(body as Record<string, unknown>, request.signal);
      if (text.length > REQUEST_BODY_MAX_LENGTH) return failure(HTTP_BAD_REQUEST, 'invalid', COPY.invalid);
    } catch { return failure(HTTP_BAD_REQUEST, 'invalid', COPY.invalid); }
    const validated = validateSelections(body.selections);
    const requestId = body.requestId;
    if (!validated.ok || typeof requestId !== 'string' || !requestId.trim() || requestId.length > REQUEST_ID_MAX_LENGTH) {
      return failure(HTTP_BAD_REQUEST, 'invalid', COPY.invalid);
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
