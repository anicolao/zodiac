import type { GameSession } from './types';

const DATABASE = 'zodiac-local';
const STORE = 'sessions';
const ACTIVE = 'active';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadSession(): Promise<GameSession | undefined> {
  return transact<GameSession | undefined>('readonly', (store) => store.get(ACTIVE));
}

export async function saveSession(session: GameSession): Promise<void> {
  session.updatedAt = new Date().toISOString();
  await transact<IDBValidKey>('readwrite', (store) => store.put(session, ACTIVE));
}

export async function clearSession(): Promise<void> {
  await transact<undefined>('readwrite', (store) => store.delete(ACTIVE));
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
