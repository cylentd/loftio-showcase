import type { BuilderState } from '../builder/controller.ts';
import { RESIDENT_COPY } from './copy.ts';

type ActionState = { status: BuilderState['status']; error: { kind: string; message: string } | null; tickets?: number | null };

// The button names the one thing a click does for this failure; the click itself is unchanged.
const RECOVERY_LABELS: Partial<Record<string, string>> = { network: RESIDENT_COPY.reconnect, preparation: RESIDENT_COPY.retryPreparation };

/** What the Create controls show. A builder failure sits directly above the button that answers it, in the
 *  form's own alert; the drawer-top alert keeps only non-builder failures, so the text is announced once.
 *  With no tickets the out-of-tickets panel takes the button's place, unless the click collects an image
 *  already paid for (Reconnect, Retry preparation). */
export function createAction(state: ActionState) {
  const recovery = state.status === 'failed' && state.error ? RECOVERY_LABELS[state.error.kind] : undefined;
  const tickets = state.tickets ?? null;
  const outOfTickets = tickets === 0 && state.status !== 'generating' && !recovery;
  // The panel or the count already says it; a stale 'tickets' failure would contradict a fresh ticket.
  const failure = outOfTickets || state.error?.kind === 'tickets' ? '' : state.error?.message ?? '';
  const ticketNote = tickets ? RESIDENT_COPY.ticketNote(tickets) : '';
  // A started resident can't be stopped, so a click that spends a ticket asks first.
  const confirmBeforeCreate = !!tickets && state.status !== 'generating' && !recovery;
  return { label: recovery ?? RESIDENT_COPY.create, failure, drawerAlert: '', outOfTickets, ticketNote, confirmBeforeCreate };
}
