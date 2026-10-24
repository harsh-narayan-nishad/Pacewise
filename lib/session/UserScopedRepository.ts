import { KeyValueStore } from "@/lib/session/storage/KeyValueStore";
import { UserNamespace } from "@/lib/session/UserNamespace";

/**
 * ABSTRACT BASE CLASS + TEMPLATE METHOD + INHERITANCE.
 *
 * Every per-user feature (history, streak, daily activity, bookmarks...)
 * is a subclass. The base owns the *invariant* algorithm — build the
 * namespaced key, read, JSON-parse defensively, fall back to an empty
 * value on any failure, serialize, write — and subclasses only fill in the
 * *varying* steps through three hooks:
 *
 *   - `feature()`      which slot of the user's namespace this owns
 *   - `emptyValue()`   what "nothing stored yet" looks like
 *   - `deserialize()`  optional upgrade of older stored shapes
 *
 * Because the namespace is injected through the constructor and is the
 * only way a key is produced, a repository instance can only ever touch
 * the one user's data it was built for — isolation is a property of the
 * object graph, not something each call site has to remember.
 *
 * `read`/`write` are `protected`: the stored representation is
 * encapsulated, and the outside world only sees the intention-revealing
 * public methods each subclass declares (`add`, `toggle`, `recordSession`).
 */
export abstract class UserScopedRepository<T> {
  constructor(
    private readonly store: KeyValueStore,
    private readonly namespace: UserNamespace
  ) {}

  protected abstract feature(): string;
  protected abstract emptyValue(): T;

  /** Hook: turn parsed JSON into `T`. Override to migrate older shapes. */
  protected deserialize(raw: unknown): T {
    return raw as T;
  }

  /** Hook: turn `T` into something JSON-serializable. */
  protected serialize(value: T): unknown {
    return value;
  }

  protected storageKey(): string {
    return this.namespace.key(this.feature());
  }

  protected read(): T {
    const raw = this.store.getItem(this.storageKey());
    if (raw === null) return this.emptyValue();
    try {
      return this.deserialize(JSON.parse(raw));
    } catch {
      return this.emptyValue();
    }
  }

  protected write(value: T): void {
    try {
      this.store.setItem(this.storageKey(), JSON.stringify(this.serialize(value)));
    } catch {
      /* unserializable value — keep the previous stored state */
    }
  }

  /** Removes this feature's data for this user only. */
  clear(): void {
    this.store.removeItem(this.storageKey());
  }
}

/**
 * SECOND LEVEL OF THE HIERARCHY — a repository whose value is a list.
 * Pulls the list-shaped boilerplate (empty array, "is it really an
 * array?" guard, read-modify-write) out of five concrete repositories so
 * each is left with only its own rules (caps, de-duplication, toggling).
 */
export abstract class ListRepository<TItem> extends UserScopedRepository<TItem[]> {
  protected emptyValue(): TItem[] {
    return [];
  }

  protected deserialize(raw: unknown): TItem[] {
    return Array.isArray(raw) ? (raw as TItem[]) : [];
  }

  getAll(): TItem[] {
    return this.read();
  }

  /** Read-modify-write in one place; returns the list that was saved. */
  protected mutate(change: (items: TItem[]) => TItem[]): TItem[] {
    const next = change(this.read());
    this.write(next);
    return next;
  }
}
