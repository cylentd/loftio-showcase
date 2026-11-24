import { CHARACTER_STORE, ONLINE_DATABASE_NAME } from './constants.ts';
import { createPlayableResidentReader } from './playable-resident.ts';

/** Open without requesting a version; abort the creation transaction if the online database is absent. */
export function findOnlineSavedResident(factory: IDBFactory, id: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const open = factory.open(ONLINE_DATABASE_NAME);
    open.onupgradeneeded = () => open.transaction?.abort();
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      try {
        const transaction = db.transaction(CHARACTER_STORE, 'readonly');
        const row = transaction.objectStore(CHARACTER_STORE).get(id);
        transaction.oncomplete = () => { db.close(); resolve(row.result); };
        transaction.onabort = () => { db.close(); reject(transaction.error); };
      } catch (error) { db.close(); reject(error); }
    };
  });
}

export const readPlayableResident = createPlayableResidentReader({
  find: id => findOnlineSavedResident(indexedDB, id),
  decode: blob => createImageBitmap(blob),
  fetch: (input, init) => fetch(input, init),
});
