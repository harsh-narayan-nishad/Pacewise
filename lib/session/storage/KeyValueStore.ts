/**
 * ABSTRACTION + POLYMORPHISM.
 *
 * `KeyValueStore` is the only thing the session layer knows about "where
 * bytes live". Repositories depend on this interface, never on
 * `window.localStorage` directly (Dependency Inversion), so the backing
 * medium is swappable — browser localStorage in the app, an in-memory Map
 * on the server / in tests, IndexedDB or a remote API later — and every
 * implementation is substitutable for every other (Liskov).
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Every key currently stored — needed to discover other users'
   *  namespaces (see SessionManager.findCustomStoryAnywhere). */
  keys(): string[];
}

/** Map-backed store: SSR-safe default and the test double. */
export class MemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  keys(): string[] {
    return Array.from(this.data.keys());
  }
}

/**
 * ENCAPSULATION: all the defensive plumbing around `window.localStorage`
 * (no `window` during SSR, access throwing in private mode, quota errors)
 * lives here and nowhere else. Callers just get `null` / a silent no-op,
 * so the app keeps working in-memory when storage is unavailable.
 */
export class BrowserKeyValueStore implements KeyValueStore {
  private get backing(): Storage | null {
    try {
      return typeof window === "undefined" ? null : window.localStorage;
    } catch {
      return null;
    }
  }

  getItem(key: string): string | null {
    try {
      return this.backing?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      this.backing?.setItem(key, value);
    } catch {
      /* storage full or disabled — fail silently, app still works in-memory */
    }
  }

  removeItem(key: string): void {
    try {
      this.backing?.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  keys(): string[] {
    const store = this.backing;
    if (!store) return [];
    const out: string[] = [];
    try {
      for (let i = 0; i < store.length; i += 1) {
        const k = store.key(i);
        if (k !== null) out.push(k);
      }
    } catch {
      /* ignore */
    }
    return out;
  }
}

/** Factory picking the right store for the runtime (Factory pattern). */
export function createDefaultKeyValueStore(): KeyValueStore {
  return typeof window === "undefined" ? new MemoryKeyValueStore() : new BrowserKeyValueStore();
}
