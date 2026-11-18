import { fetchInvitation, type LinkFetch } from './link-client';
import type { Guest, Invitation } from './invite-contract';

/** Fetch a link's invitation and canonicalize it for preview. Writes nothing: saving is the Welcome step. */
export async function loadLinkGuest(code: string, fetchFn: LinkFetch, canonical: (item: Invitation) => Promise<Guest>): Promise<Guest> {
  return canonical(await fetchInvitation(code, fetchFn));
}
