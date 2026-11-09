import type { CharacterStore } from './store.ts';
import { CHARACTER_STORE, DATABASE_NAME, DATABASE_VERSION } from './constants.ts';
import { readSavedCharacters } from './storage-contract.ts';

export function indexedStore(factory: IDBFactory = indexedDB, databaseName = DATABASE_NAME): CharacterStore {
  let database: Promise<IDBDatabase> | null = null;
  function open() {
    if (database) return database;
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(databaseName, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(CHARACTER_STORE)) {
          request.result.createObjectStore(CHARACTER_STORE, { keyPath: 'id' });
        }
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Storage upgrade blocked'));
      request.onsuccess = () => {
        const connection = request.result;
        connection.onversionchange = () => { connection.close(); database = null; };
        resolve(connection);
      };
    }).catch(error => { database = null; throw error; });
    return database;
  }

  async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const connection = await open();
    return new Promise<T>((resolve, reject) => {
      const transaction = connection.transaction(CHARACTER_STORE, mode);
      const request = action(transaction.objectStore(CHARACTER_STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? new Error('Storage transaction aborted'));
      transaction.onerror = () => reject(transaction.error);
    });
  }

  return {
    async list() { return readSavedCharacters(await transact<unknown[]>('readonly', store => store.getAll())); },
    async put(character) { await transact('readwrite', store => store.put(character)); },
  };
}
