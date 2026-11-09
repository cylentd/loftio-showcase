import type { BuilderRequest } from './controller.ts';
import { validateSelections } from './selections.ts';

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
