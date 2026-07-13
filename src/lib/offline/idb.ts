import type { QueuedOperation, ReferenceCacheRecord } from "@/lib/offline/types";

/**
 * Minimal IndexedDB adapter for the offline sync layer. Uses the native
 * IndexedDB API (no extra dependency) and degrades gracefully when run in a
 * non-browser context (SSR) or where IndexedDB is unavailable.
 */

const DB_NAME = "khff-offline";
const DB_VERSION = 2;
const QUEUE_STORE = "sync_queue";
const REFERENCE_STORE = "reference_cache";
const DATA_STORE = "data_cache";

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error("IndexedDB is not available."));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(REFERENCE_STORE)) {
        db.createObjectStore(REFERENCE_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function isOfflineStorageAvailable(): boolean {
  return hasIndexedDb();
}

export async function putOperation(op: QueuedOperation): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  tx.objectStore(QUEUE_STORE).put(op);
  await txDone(tx);
}

export async function deleteOperation(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  tx.objectStore(QUEUE_STORE).delete(id);
  await txDone(tx);
}

export async function getAllOperations(): Promise<QueuedOperation[]> {
  if (!hasIndexedDb()) return [];
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readonly");
  const result = await runRequest(
    tx.objectStore(QUEUE_STORE).getAll() as IDBRequest<QueuedOperation[]>,
  );
  return result ?? [];
}

export async function clearFailedOperations(): Promise<void> {
  const ops = await getAllOperations();
  await Promise.all(
    ops.filter((op) => op.status === "failed").map((op) => deleteOperation(op.id)),
  );
}

export async function putReference<T>(
  key: string,
  data: T,
): Promise<ReferenceCacheRecord<T>> {
  const record: ReferenceCacheRecord<T> = {
    key,
    data,
    cachedAt: new Date().toISOString(),
  };
  if (!hasIndexedDb()) return record;
  const db = await openDb();
  const tx = db.transaction(REFERENCE_STORE, "readwrite");
  tx.objectStore(REFERENCE_STORE).put(record);
  await txDone(tx);
  return record;
}

export async function getReference<T>(
  key: string,
): Promise<ReferenceCacheRecord<T> | null> {
  if (!hasIndexedDb()) return null;
  const db = await openDb();
  const tx = db.transaction(REFERENCE_STORE, "readonly");
  const result = await runRequest(
    tx.objectStore(REFERENCE_STORE).get(key) as IDBRequest<
      ReferenceCacheRecord<T> | undefined
    >,
  );
  return result ?? null;
}

/**
 * Generic read-through cache used to mirror server query results (entry
 * lists, review queue, reporting dataset) so they can be browsed offline.
 */
export async function putCachedData<T>(
  key: string,
  data: T,
): Promise<ReferenceCacheRecord<T>> {
  const record: ReferenceCacheRecord<T> = {
    key,
    data,
    cachedAt: new Date().toISOString(),
  };
  if (!hasIndexedDb()) return record;
  const db = await openDb();
  const tx = db.transaction(DATA_STORE, "readwrite");
  tx.objectStore(DATA_STORE).put(record);
  await txDone(tx);
  return record;
}

export async function getCachedData<T>(
  key: string,
): Promise<ReferenceCacheRecord<T> | null> {
  if (!hasIndexedDb()) return null;
  const db = await openDb();
  const tx = db.transaction(DATA_STORE, "readonly");
  const result = await runRequest(
    tx.objectStore(DATA_STORE).get(key) as IDBRequest<
      ReferenceCacheRecord<T> | undefined
    >,
  );
  return result ?? null;
}
