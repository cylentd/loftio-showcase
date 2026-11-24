import type { SavedCharacter } from './records.ts';
import type { BuilderRequest } from './controller-model.ts';
import { ProviderError } from './provider.ts';
import { COPY } from './copy.ts';
import type { Dependencies } from './controller-types.ts';
import { sameRecordIdentity } from './saved-record-write.ts';

export function joinSaved(join: (savedId: string) => boolean, savedId: string) {
  try { return join(savedId); }
  catch { throw new ProviderError('storage', COPY.storage); }
}

export function pendingLoftJoins(records: SavedCharacter[], journal?: { read(): BuilderRequest[] }) {
  let requests: BuilderRequest[];
  try { requests = journal?.read() ?? []; }
  catch { return []; }
  return requests.flatMap(request => {
    const saved = records.find(item => item.state === 'kept' && item.generation.requestId === request.requestId);
    return saved ? [{ request, saved }] : [];
  });
}

export function commitLoftJoin(deps: Dependencies, request: BuilderRequest, inspected: SavedCharacter,
  live: () => boolean, settle: () => void) {
  const commit = async () => {
    const latest = (await deps.store.list()).find(item => item.id === inspected.id);
    if (!live()) return undefined;
    if (!latest || latest.state !== 'kept' || latest.generation.requestId !== request.requestId
      || !sameRecordIdentity(latest, inspected)) return null;
    const joined = deps.isJoined?.(latest.id);
    if (deps.exclusive && !deps.journal?.read().some(item => item.requestId === request.requestId)) return joined ? latest : undefined;
    if (!joined && !joinSaved(deps.joinSaved!, latest.id)) return undefined;
    settle();
    return latest;
  };
  return deps.exclusive ? deps.exclusive(commit) : commit();
}
