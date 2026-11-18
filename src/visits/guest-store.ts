import { DATABASE, STORE, MAX_GUESTS, VERSION } from './constants';
import { COPY } from './copy';
import type { Guest } from './invite-contract';
import type { GuestStore } from './guest-controller';

/** Separate database: no handle to resident, builder, name, currency or ticket stores. */
export function guestStore(factory: IDBFactory = indexedDB): GuestStore {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(DATABASE, VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error(COPY.storage));
    request.onblocked = () => reject(Error(COPY.storage));
  });
  async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, result: (value: T) => void, fail: (error: Error) => void) => void): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode); let value: T, failure = Error(COPY.storage);
      tx.oncomplete = () => { db.close(); resolve(value); };
      tx.onabort = tx.onerror = () => { db.close(); reject(failure); };
      work(tx.objectStore(STORE), result => { value = result; }, error => { failure = error; tx.abort(); });
    });
  }
  return {
    list: () => transaction<Guest[]>('readonly', (store, result) => {
      const request = store.getAll(); request.onsuccess = () => result(request.result);
    }),
    add: guest => transaction<boolean>('readwrite', (store, result, fail) => {
      const existing = store.get(guest.id);
      existing.onsuccess = () => {
        if (existing.result) { result(false); return; }
        const count = store.count(); count.onsuccess = () => {
          if (count.result >= MAX_GUESTS) { fail(Error(COPY.capacity)); return; }
          store.add(guest); result(true);
        };
      };
    }),
    remove: id => transaction<void>('readwrite', (store, result) => { store.delete(id); result(undefined); }),
  };
}
