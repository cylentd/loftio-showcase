import { WELCOME_SEEN } from './welcome-constants';

type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

/** Once per profile: true the first time it is asked, then never again. The caller decides the profile is fresh
 *  (`ResidentHooks.fresh`, read before the ticket ledger is written); this only keeps the seen marker. */
export function firstVisit(storage: Storage, key: string): () => boolean {
  let eligible = false;
  try { eligible = storage.getItem(key) === null; } catch { /* manual creation remains available */ }
  return () => {
    if (!eligible) return false;
    eligible = false;
    try {
      if (storage.getItem(key) !== null) return false;
      storage.setItem(key, WELCOME_SEEN);
      return true;
    } catch { return false; }
  };
}
