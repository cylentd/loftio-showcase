import type { BuilderState } from '../builder/controller.ts';
import { RESIDENT_COPY } from './copy.ts';
import { WELCOME_COPY } from './welcome-copy.ts';
import { FIRST_RESIDENT_COPY } from './first-resident-copy.ts';

// resumable: the builder's API can reattach to a request (local mode). Without it, every click is a new paid build.
type ActionState = { status: BuilderState['status']; error: { kind: string; message: string; dispatch?: NonNullable<BuilderState['error']>['dispatch'] } | null; tickets?: number | null; resumable?: boolean; direct?: boolean };

// The button names the one thing a click does for this failure; the click itself is unchanged.
const RECOVERY_LABELS: Partial<Record<string, string>> = { network: RESIDENT_COPY.reconnect, preparation: RESIDENT_COPY.retryPreparation };

/** What the Create controls show. A builder failure sits directly above the button that answers it, in the
 *  form's own alert; the drawer-top alert keeps only non-builder failures, so the text is announced once.
 *  With no tickets the out-of-tickets panel takes the button's place, unless the click collects an image
 *  already paid for (Reconnect, Retry preparation). */
export function createAction(state: ActionState) {
  const pendingJoin = state.status === 'failed' && state.error?.kind === 'loft-pending';
  const recovery = pendingJoin ? FIRST_RESIDENT_COPY.retryJoin
    : state.status === 'failed' && state.error && state.resumable !== false ? RECOVERY_LABELS[state.error.kind] : undefined;
  const tickets = state.tickets ?? null;
  const outOfTickets = tickets === 0 && state.status !== 'generating' && !recovery;
  // The panel or the count already says it; a stale 'tickets' failure would contradict a fresh ticket.
  const uncertain = state.direct === true && state.status === 'failed' && !recovery
    && (state.error?.dispatch === 'unresolved' || (state.error?.dispatch === undefined
      && ['network', 'storage', 'preparation'].includes(state.error?.kind ?? '')));
  const failure = uncertain ? FIRST_RESIDENT_COPY.uncertain : outOfTickets || state.error?.kind === 'tickets' ? '' : state.error?.message ?? '';
  const ticketNote = tickets && !recovery ? RESIDENT_COPY.ticketNote(tickets) : '';
  // A started resident can't be stopped, so a click that spends a ticket asks first.
  const confirmBeforeCreate = !state.direct && !!tickets && state.status !== 'generating' && !recovery;
  return { label: recovery ?? (state.direct ? WELCOME_COPY.confirm : RESIDENT_COPY.create), failure, drawerAlert: '', outOfTickets, ticketNote, confirmBeforeCreate, recovery, uncertain };
}
