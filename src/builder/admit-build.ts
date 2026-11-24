import type { Dependencies } from './controller-types.ts';
import { COPY } from './copy.ts';
import { paidJournalFailure, reserveBuild, reservePaidBuild } from './journal.ts';
import type { BuilderFailure } from './provider.ts';
import { validateSelections, type UserSelections } from './selections.ts';

export function admitBuild(dependencies: Dependencies, selections: UserSelections) {
  const { guardPaidRequests, journal, tickets, exclusive } = dependencies;
  if (guardPaidRequests) {
    const blocked = paidJournalFailure(journal);
    if (blocked) return { error: blocked };
  }
  const reject = (kind: BuilderFailure['kind']): { error: BuilderFailure } => ({ error: { kind, message: COPY[kind] } });
  if (dependencies.canJoin?.() === false) return reject('loft-full');
  const validated = validateSelections(selections);
  if (!validated.ok) return reject('invalid');
  dependencies.refillTickets?.();
  const request = { requestId: dependencies.newId(), selections: validated.value };
  const error = exclusive && guardPaidRequests && journal
    ? reservePaidBuild(request, journal, tickets) : reserveBuild(request, journal, tickets);
  return error ? { error } : { request };
}
