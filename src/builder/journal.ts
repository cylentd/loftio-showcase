import type { BuilderRequest } from './controller.ts';
import type { BuilderFailure } from './provider.ts';
import type { BuildTickets } from './tickets.ts';
import { COPY } from './copy.ts';
import { validateSelections } from './selections.ts';
import type { Dependencies } from './controller-types.ts';

const PENDING_KEY = 'loftio-builder-local-pending-v1';
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

function parse(value: any): BuilderRequest {
  const selections = validateSelections(value?.selections);
  if (!selections.ok || typeof value?.requestId !== 'string' || !value.requestId) throw Error('Invalid pending request');
  return { requestId: value.requestId, selections: selections.value };
}

// One entry per request, so a second tab never overwrites or clears another tab's job.
// The key also holds the earlier single-request format (one object or null).
export function requestJournal(storage: Storage, key = PENDING_KEY) {
  const read = (): BuilderRequest[] => {
    const value = JSON.parse(storage.getItem(key) ?? 'null');
    if (value === null) return [];
    return Array.isArray(value) ? value.map(parse) : [parse(value)];
  };
  const write = (requests: BuilderRequest[]) => storage.setItem(key, JSON.stringify(requests));
  return {
    read,
    add(request: BuilderRequest) { write([...read().filter(item => item.requestId !== request.requestId), request]); },
    remove(requestId: string) { write(read().filter(item => item.requestId !== requestId)); },
  };
}
export type RequestJournal = ReturnType<typeof requestJournal>;

export function paidJournalFailure(journal: Pick<RequestJournal, 'read'> | undefined): BuilderFailure | null {
  try {
    if (journal) return journal.read().length ? { kind: 'network', message: COPY.network, dispatch: 'unresolved' } : null;
  } catch { /* unreadable is not empty */ }
  return { kind: 'storage', message: COPY.storage, dispatch: 'not-sent' };
}

export function paidOutcomeFailure(error: BuilderFailure): BuilderFailure {
  switch (error.kind) {
    case 'invalid': case 'cap': case 'busy': case 'safety': case 'corrupt': return { kind: error.kind, message: error.message };
    default: return { ...error, dispatch: 'unresolved' };
  }
}

export function reserveBuild(request: BuilderRequest, journal?: Pick<RequestJournal, 'add'>,
  tickets?: Pick<BuildTickets, 'spend' | 'refund'>): BuilderFailure | null {
  const notSent: BuilderFailure = { kind: 'storage', message: COPY.storage, dispatch: 'not-sent' };
  try {
    if (tickets && !tickets.spend(request.requestId)) return { kind: 'tickets', message: COPY.tickets };
  } catch { return notSent; }
  try { journal?.add(request); }
  catch { refundBuild(request, tickets); return notSent; }
  return null;
}

export function refundBuild(request: BuilderRequest, tickets?: Pick<BuildTickets, 'refund'>) {
  try { tickets?.refund(request.requestId); } catch { /* unrecorded refund leaves the ticket spent */ }
}

export function reservePaidBuild(request: BuilderRequest, journal: RequestJournal, tickets?: Pick<BuildTickets, 'count' | 'spend'>): BuilderFailure | null {
  if (tickets && tickets.count() < 1) return { kind: 'tickets', message: COPY.tickets };
  journal.add(request);
  if (tickets && !tickets.spend(request.requestId)) throw Error(COPY.storage);
  return null;
}

export function settleBuild({ tickets, journal, exclusive }: Dependencies, request: BuilderRequest, refund: boolean) {
  if (exclusive) {
    if (refund) tickets?.refund(request.requestId);
    else tickets?.settle(request.requestId);
  } else if (refund) refundBuild(request, tickets);
  journal?.remove(request.requestId);
  if (!exclusive) try { tickets?.settle(request.requestId); } catch { /* the ticket stays spent */ }
}
