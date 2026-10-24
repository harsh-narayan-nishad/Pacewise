import { KeyValueStore } from "@/lib/session/storage/KeyValueStore";
import { UserNamespace } from "@/lib/session/UserNamespace";
import { RichDocument, RichDocumentSnapshot } from "@/lib/editor/model/RichDocument";
import { LruCache } from "@/lib/editor/util/LruCache";
import { contentHash } from "@/lib/editor/util/hash";
import { EditLock } from "@/lib/editor/persistence/EditLock";

export interface DocumentIndexRow {
  readonly id: string;          // primary key
  readonly title: string;
  readonly words: number;
  readonly updatedAt: number;
  readonly version: number;     // optimistic-concurrency counter
  readonly bytes: number;
}

export class VersionConflictError extends Error {
  constructor(readonly id: string, readonly expected: number, readonly actual: number) {
    super(`Document ${id} changed elsewhere (expected v${expected}, found v${actual})`);
    this.name = "VersionConflictError";
  }
}
export class StorageFullError extends Error {
  constructor() { super("Browser storage is full — delete old documents or images."); this.name = "StorageFullError"; }
}

const IMG_RE = /sr-img:([a-z0-9]+)/g;

/**
 * Per-user document database on top of the existing `KeyValueStore`.
 *
 * It does NOT touch `UserSession`; it only borrows the user's
 * `UserNamespace`, so the isolation guarantee of the session layer (different
 * users => different key prefixes) carries over unchanged.
 *
 * Logical schema (DBMS view):
 *   docs:index            table  DocumentIndexRow[]    (metadata, small, read often)
 *   docs:body:<id>        table  RichDocumentSnapshot  (large, read on open)  — 1:1 with index (normalised: big blobs split from the list)
 *   docs:img:<hash>       table  data URL              — content-addressed => natural dedup (n:m with bodies)
 *   docs:draft:<slot>     table  RichDocumentSnapshot  — crash-recovery write-ahead copy
 */
export class DocumentStore {
  private readonly cache = new LruCache<string, RichDocumentSnapshot>(8);

  constructor(private readonly kv: KeyValueStore, private readonly ns: UserNamespace) {}

  private k(feature: string): string { return this.ns.key(`docs:${feature}`); }

  // --- index -----------------------------------------------------------------
  list(): DocumentIndexRow[] {
    const rows = this.readIndex();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private readIndex(): DocumentIndexRow[] {
    try {
      const raw = this.kv.getItem(this.k("index"));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.id === "string") : [];
    } catch { return []; }
  }

  private put(key: string, value: string): void {
    try { this.kv.setItem(key, value); }
    catch { throw new StorageFullError(); }
  }

  // --- CRUD ------------------------------------------------------------------
  newId(): string { return `doc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; }

  load(id: string): RichDocument | null {
    const hit = this.cache.get(id);
    if (hit) return RichDocument.fromSnapshot(hit);
    try {
      const raw = this.kv.getItem(this.k(`body:${id}`));
      if (!raw) return null;
      const snap = JSON.parse(raw) as RichDocumentSnapshot;
      this.cache.set(id, snap);
      return RichDocument.fromSnapshot(snap); // re-sanitizes: storage is untrusted too
    } catch { return null; }
  }

  /**
   * Atomic-ish save ("transaction"): write body, then index row; if the
   * index write fails the body is rolled back to its previous value.
   * `expectedVersion` null = create, otherwise must match the stored version.
   */
  save(id: string, doc: RichDocument, expectedVersion: number | null): DocumentIndexRow {
    const rows = this.readIndex();
    const cur = rows.find((r) => r.id === id);
    const actual = cur?.version ?? null;
    if (expectedVersion !== actual && !(expectedVersion === null && actual === null)) {
      throw new VersionConflictError(id, expectedVersion ?? 0, actual ?? 0);
    }
    const bodyKey = this.k(`body:${id}`);
    const body = JSON.stringify(doc.snapshot());
    const before = this.kv.getItem(bodyKey);
    this.put(bodyKey, body);
    const row: DocumentIndexRow = {
      id, title: doc.meta.title, words: doc.stats.words, updatedAt: Date.now(),
      version: (cur?.version ?? 0) + 1, bytes: body.length,
    };
    try {
      this.put(this.k("index"), JSON.stringify([...rows.filter((r) => r.id !== id), row]));
    } catch (e) {
      if (before === null) this.kv.removeItem(bodyKey); else this.kv.setItem(bodyKey, before);
      throw e;
    }
    this.cache.set(id, doc.snapshot());
    return row;
  }

  duplicate(id: string): string | null {
    const doc = this.load(id);
    if (!doc) return null;
    const nid = this.newId();
    this.save(nid, doc.withMeta({ title: `${doc.meta.title} (copy)`, createdAt: Date.now() }), null);
    return nid;
  }

  remove(id: string): void {
    this.kv.removeItem(this.k(`body:${id}`));
    this.cache.delete(id);
    this.put(this.k("index"), JSON.stringify(this.readIndex().filter((r) => r.id !== id)));
    this.collectGarbage();
  }

  /** Cross-tab edit lock for one document (see EditLock). */
  lock(id: string): EditLock { return new EditLock(this.kv, this.k(`lock:${id}`)); }

  // --- drafts (crash recovery) ----------------------------------------------
  saveDraft(slot: string, doc: RichDocument): void {
    try { this.kv.setItem(this.k(`draft:${slot}`), JSON.stringify(doc.snapshot())); } catch { /* best effort */ }
  }
  loadDraft(slot: string): RichDocument | null {
    try {
      const raw = this.kv.getItem(this.k(`draft:${slot}`));
      return raw ? RichDocument.fromSnapshot(JSON.parse(raw)) : null;
    } catch { return null; }
  }
  clearDraft(slot: string): void { this.kv.removeItem(this.k(`draft:${slot}`)); }

  // --- images ----------------------------------------------------------------
  async putImage(dataUrl: string): Promise<string> {
    const id = await contentHash(dataUrl);
    const key = this.k(`img:${id}`);
    if (this.kv.getItem(key) === null) this.put(key, dataUrl);
    return id;
  }
  getImage(id: string): string | null { return this.kv.getItem(this.k(`img:${id}`)); }

  /** Resolves `sr-img:<id>` to a displayable data URL (or null). */
  resolveSrc(src: string): string | null {
    const m = /^sr-img:([a-z0-9]+)$/.exec(src);
    return m ? this.getImage(m[1]) : src;
  }

  /**
   * Reference-count GC: drop image rows that nothing in THIS USER's
   * namespace refers to. It scans every key of the namespace (documents,
   * drafts AND the saved stories), because a story's rich snapshot also
   * holds `sr-img:` references the reader needs.
   */
  collectGarbage(): number {
    const imgPrefix = this.k("img:");
    const keys = this.kv.keys().filter((x) => x.startsWith(this.ns.prefix));
    const live = new Set<string>();
    for (const key of keys) {
      if (key.startsWith(imgPrefix)) continue;
      const raw = this.kv.getItem(key) ?? "";
      for (const m of Array.from(raw.matchAll(IMG_RE))) live.add(m[1]);
    }
    let removed = 0;
    for (const key of keys) {
      if (!key.startsWith(imgPrefix)) continue;
      if (!live.has(key.slice(imgPrefix.length))) { this.kv.removeItem(key); removed += 1; }
    }
    return removed;
  }

  /** Consistency check ("fsck"): index rows without bodies are removed. */
  repair(): number {
    const rows = this.readIndex();
    const ok = rows.filter((r) => this.kv.getItem(this.k(`body:${r.id}`)) !== null);
    if (ok.length !== rows.length) this.put(this.k("index"), JSON.stringify(ok));
    return rows.length - ok.length;
  }

  usageBytes(): number {
    const prefix = this.k("");
    return this.kv.keys().filter((x) => x.startsWith(prefix)).reduce((n, key) => n + (this.kv.getItem(key)?.length ?? 0), 0);
  }
}
