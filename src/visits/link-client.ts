import { LINK_ENDPOINT, LINK_PARAM, LINK_CODE } from './constants';
import { LINK_COPY } from './copy';
import { parseInvitation, type Invitation } from './invite-contract';

/** The slice of `fetch` the client uses, so tests and callers inject their own. */
export type LinkFetch = (url: string, init?: RequestInit) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
export type LinkFailure = 'not-found' | 'invalid' | 'too-large' | 'rate-limited' | 'unavailable' | 'offline' | 'no-fit';
const SERVER_SLUGS: readonly string[] = ['not-found', 'invalid', 'too-large', 'rate-limited', 'unavailable'];

/** A failure with a fixed, visible message. `kind` is what the caller branches on. */
export class LinkError extends Error {
  kind: LinkFailure;
  constructor(kind: LinkFailure) { super(LINK_COPY[kind]); this.name = 'LinkError'; this.kind = kind; }
}

async function send(fetchFn: LinkFetch, url: string, init?: RequestInit) {
  let response;
  try { response = await fetchFn(url, init); } catch { throw new LinkError('offline'); }
  let body: unknown; try { body = await response.json(); } catch { body = undefined; }
  if (response.ok) return body;
  const slug = (body as { error?: unknown } | undefined)?.error;
  throw new LinkError(typeof slug === 'string' && SERVER_SLUGS.includes(slug) ? slug as LinkFailure : 'unavailable');
}

/** POST the invitation; returns the link a sender shares and when it stops working. */
export async function createLink(invitation: Invitation, fetchFn: LinkFetch, origin: string) {
  const body = await send(fetchFn, LINK_ENDPOINT, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(invitation),
    credentials: 'omit', redirect: 'error',
  }) as { code?: unknown; expiresAt?: unknown } | undefined;
  const expiresAt = new Date(typeof body?.expiresAt === 'string' ? body.expiresAt : NaN);
  if (typeof body?.code !== 'string' || !LINK_CODE.test(body.code) || Number.isNaN(expiresAt.getTime())) throw new LinkError('unavailable');
  return { link: `${origin}/?${LINK_PARAM}=${body.code}`, expiresAt };
}

/** GET the invitation for a code and validate it exactly like a file. A malformed code sends no request. */
export async function fetchInvitation(code: string, fetchFn: LinkFetch): Promise<Invitation> {
  if (!LINK_CODE.test(code)) throw new LinkError('not-found');
  const body = await send(fetchFn, `${LINK_ENDPOINT}?code=${code}`, { method: 'GET', credentials: 'omit', redirect: 'error' });
  return parseInvitation(JSON.stringify(body));
}
