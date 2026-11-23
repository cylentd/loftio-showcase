import type { BuilderApi, FollowUpRequest, GenerateOutcome } from './controller.ts';
import { validGeneration, validImage } from './storage-contract.ts';
import { ALT_ID, LOCAL_API_PREFIX } from './constants.ts';
import { FOLLOW_UP_BODY_MAX_LENGTH, TURNSTILE_BODY_FIELD } from './server/online-config.ts';
import { COPY } from './copy.ts';
import type { FailureKind } from './provider.ts';
import type { AltReference, GeneratedImage } from './records.ts';
import { FOLLOW_UPS } from './follow-ups.ts';

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

const base64Of = (image: GeneratedImage) => ('base64' in image ? image.base64 : '');

/** The follow-up body: the idle, and for the alt the expression (when the request has one), kind, trait and element. */
function followUpBody(request: FollowUpRequest, withExpression: boolean): string {
  const alt = request.id === ALT_ID;
  return JSON.stringify({
    token: request.token, id: request.id, idle: base64Of(request.image),
    ...(alt && withExpression && request.expression ? { expression: base64Of(request.expression) } : {}),
    ...(alt ? { kind: request.kind, trait: request.trait, element: request.element } : {}),
  });
}

/** The public showcase's API: one POST per image, carrying a Turnstile token. No polling, cancel or prepare. */
export function onlineApi({ fetcher = fetch, getToken, bodyMaxLength = FOLLOW_UP_BODY_MAX_LENGTH }: {
  fetcher?: typeof fetch; getToken: () => Promise<string>; bodyMaxLength?: number; // the longest follow-up body sent whole; default the server's own cap
}): BuilderApi {
  // An expression or alt: one POST with the idle and the worker's token, never retried. Every failure is an outcome, not a throw.
  // An alt body over the max (two images) is sent with the idle alone, and the outcome's `references` says so.
  const followUp: NonNullable<BuilderApi['followUp']> = async (request, signal) => {
    if (!request.token) return { ok: false, kind: 'network' }; // the token store was down: the idle is never uploaded without one
    try {
      let text = followUpBody(request, true);
      const droppedExpression = text.length > bodyMaxLength && !!request.expression;
      if (droppedExpression) text = followUpBody(request, false);
      const response = await fetcher(LOCAL_API_PREFIX + '/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text, signal });
      const body = await response.json() as Record<string, unknown> | null;
      const error = body?.error as Record<string, unknown> | undefined;
      if (body?.ok === false) return { ok: false, kind: typeof error?.kind === 'string' && failureKinds.has(error.kind) ? error.kind as FailureKind : 'network' };
      if (body?.ok !== true || !validImage(body[request.id])) return { ok: false, kind: 'corrupt' };
      const references: AltReference[] = request.expression && !droppedExpression ? ['idle', 'expression'] : ['idle'];
      return { ok: true, image: body[request.id] as GeneratedImage, createdAt: new Date().toISOString(),
        promptVersion: FOLLOW_UPS.find(entry => entry.id === request.id)?.promptVersion ?? '', ...(request.id === ALT_ID ? { references } : {}) };
    } catch { return { ok: false, kind: signal?.aborted ? 'aborted' : 'network' }; }
  };
  return {
    followUp,
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
