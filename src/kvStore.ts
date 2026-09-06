import { EVICTION_MS } from './config.ts';

interface Entry {
  value: string;
  timer: NodeJS.Timeout;
}

export interface KvStore {
  set(key: string, value: string): void;
  get(key: string): string | undefined;
  has(key: string): boolean;
  remove(key: string): boolean;
  size(): number;
}

/**
 * Creates an independent in-memory KV store whose entries are evicted
 * `evictionMs` after they were last written. Each write resets the
 * eviction timer for that key ("perishable" semantics, not sliding on read).
 */
export function createKvStore(evictionMs: number = EVICTION_MS): KvStore {
  const store = new Map<string, Entry>();

  function set(key: string, value: string): void {
    const existing = store.get(key);
    if (existing) clearTimeout(existing.timer);

    const timer = setTimeout(() => store.delete(key), evictionMs);
    timer.unref?.();
    store.set(key, { value, timer });
  }

  function get(key: string): string | undefined {
    return store.get(key)?.value;
  }

  function has(key: string): boolean {
    return store.has(key);
  }

  function remove(key: string): boolean {
    const existing = store.get(key);
    if (existing) clearTimeout(existing.timer);
    return store.delete(key);
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
