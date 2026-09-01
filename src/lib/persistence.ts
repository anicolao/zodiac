import type { GameHistoryEntry, GameSession } from './types';

const DATABASE = 'zodiac-local';
const SESSION_STORE = 'sessions';
const HISTORY_STORE = 'history';
const ACTIVE = 'active';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SESSION_STORE)) database.createObjectStore(SESSION_STORE);
      if (!database.objectStoreNames.contains(HISTORY_STORE)) {
        database.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    let result!: T;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function loadSession(): Promise<GameSession | undefined> {
  return transact<GameSession | undefined>(SESSION_STORE, 'readonly', (store) => store.get(ACTIVE));
}

export async function saveSession(session: GameSession): Promise<void> {
  session.updatedAt = new Date().toISOString();
  await transact<IDBValidKey>(SESSION_STORE, 'readwrite', (store) => store.put(session, ACTIVE));
}

export async function clearSession(): Promise<void> {
  await transact<undefined>(SESSION_STORE, 'readwrite', (store) => store.delete(ACTIVE));
}

export function historyEntryFromSession(
  session: GameSession,
  completedAt = new Date().toISOString()
): GameHistoryEntry {
  if (!session.output || session.captures.length !== 6) {
    throw new Error('A completed six-card Zodiac is required for game history.');
  }
  const stars = session.captures.flatMap((capture) => capture.stars);
  return {
    schemaVersion: 1,
    id: session.id,
    createdAt: session.createdAt,
    completedAt,
    cardLabels: session.captures.map((capture) => capture.cardLabel),
    goldCount: stars.filter((star) => star.color === 'gold').length,
    redCount: stars.filter((star) => star.color === 'red').length,
    output: session.output
  };
}

export async function saveCompletedSession(
  session: GameSession,
  completedAt = new Date().toISOString()
): Promise<GameHistoryEntry> {
  session.updatedAt = completedAt;
  const entry = historyEntryFromSession(session, completedAt);
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SESSION_STORE, HISTORY_STORE], 'readwrite');
    transaction.objectStore(SESSION_STORE).put(session, ACTIVE);
    transaction.objectStore(HISTORY_STORE).put(entry);
    transaction.oncomplete = () => {
      database.close();
      resolve(entry);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function loadHistory(): Promise<GameHistoryEntry[]> {
  const entries = await transact<GameHistoryEntry[]>(HISTORY_STORE, 'readonly', (store) => store.getAll());
  return entries.sort((left, right) => right.completedAt.localeCompare(left.completedAt));
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
