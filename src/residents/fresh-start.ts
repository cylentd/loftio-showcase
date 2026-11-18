type Read = { getItem(key: string): string | null };

/**
 * Notes whether the profile saved nothing under `keys`, then starts the session. In that order on purpose: starting
 * writes the ticket ledger, so reading after it would never see a first visit. `storage` null (arrival preview) is
 * never fresh; unreadable storage is not fresh either.
 */
export function startNotingFresh<T>(storage: Read | null, keys: readonly string[], start: () => T): { fresh: boolean; started: T } {
  let fresh = false;
  try { fresh = storage !== null && keys.every(key => storage.getItem(key) === null); } catch { /* not fresh */ }
  return { fresh, started: start() };
}
