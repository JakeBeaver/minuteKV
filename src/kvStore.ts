import { EVICTION_MS, MAX_ENTRIES } from './config.ts';

interface Entry {
  value: string;
  isAdmin: boolean;
  timer: NodeJS.Timeout;
}

export interface KvStore {
  set(key: string, value: string, isAdmin?: boolean): void;
  get(key: string): string | undefined;
  has(key: string): boolean;
  remove(key: string): boolean;
  size(): number;
}

/**
 * Creates an independent in-memory KV store with two eviction rules:
 *
 *  - Timeout elapsed: a key is dropped `evictionMs` after it was last
 *    written, admin-written or not.
 *  - Maximum size reached: writing a *new* key while the store already
 *    holds `maxEntries` evicts the oldest non-admin key to make room, so
 *    admin-written data can't be pushed out just because other traffic
 *    filled up the store. (If every stored key happens to be admin-owned,
 *    the oldest key of any kind is evicted instead, so the size cap
 *    always holds.)
 *
 * A `Map`'s iteration order is insertion order, and every write
 * re-inserts the key, so that order doubles as oldest-write-first order.
 */
export function createKvStore(evictionMs: number = EVICTION_MS, maxEntries: number = MAX_ENTRIES): KvStore {
  const store = new Map<string, Entry>();

  function remove(key: string): boolean {
    const existing = store.get(key);
    if (existing) clearTimeout(existing.timer);
    return store.delete(key);
  }

  function evictOldest(): void {
    let fallback: string | undefined;
    for (const [key, entry] of store) {
      if (!entry.isAdmin) {
        remove(key);
        return;
      }
      if (fallback === undefined) fallback = key;
    }
    // Every entry is admin-owned; evict the oldest one anyway so the size
    // cap is never exceeded.
    if (fallback !== undefined) remove(fallback);
  }

  function set(key: string, value: string, isAdmin = false): void {
    const existing = store.get(key);
    if (existing) clearTimeout(existing.timer);
    else if (store.size >= maxEntries) evictOldest();

    const timer = setTimeout(() => store.delete(key), evictionMs);
    timer.unref?.();

    // Delete-then-set moves an overwritten key to the end too, so it
    // reads as freshly written rather than stale.
    store.delete(key);
    store.set(key, { value, isAdmin, timer });
  }

  function get(key: string): string | undefined {
    return store.get(key)?.value;
  }

  function has(key: string): boolean {
    return store.has(key);
  }

  function size(): number {
    return store.size;
  }

  return { set, get, has, remove, size };
}

// Default, process-wide store used by the running server.
const defaultStore = createKvStore();

export const set = defaultStore.set;
export const get = defaultStore.get;
export const has = defaultStore.has;
export const remove = defaultStore.remove;
export const size = defaultStore.size;
