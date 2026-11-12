/** Small IndexedDB cache so the text of a PDF is extracted only once, even across visits. */
const DB_NAME = 'flip-reader';
const STORE = 'text-index';
const KEEP = 8; // remember the 8 most recently used books

interface Entry {
    key: string;
    pages: string[];
    t: number;
}

function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

const done = (tx: IDBTransaction) =>
    new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });

export async function loadPages(key: string, expected: number): Promise<string[] | null> {
    try {
        const db = await open();
        const entry = await new Promise<Entry | undefined>((resolve, reject) => {
            const req = db.transaction(STORE).objectStore(STORE).get(key);
            req.onsuccess = () => resolve(req.result as Entry | undefined);
            req.onerror = () => reject(req.error);
        });
        db.close();
        return entry && Array.isArray(entry.pages) && entry.pages.length === expected ? entry.pages : null;
    } catch {
        return null; // private mode / blocked storage: just extract again
    }
}

export async function savePages(key: string, pages: string[]): Promise<void> {
    try {
        const db = await open();
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        store.put({ key, pages, t: Date.now() } satisfies Entry);

        // keep only the most recent entries
        const all = await new Promise<Entry[]>((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result as Entry[]);
            req.onerror = () => reject(req.error);
        });
        all.sort((a, b) => b.t - a.t).slice(KEEP).forEach((e) => store.delete(e.key));
        await done(tx);
        db.close();
    } catch {
        /* quota or storage unavailable: the in-memory cache still works */
    }
}
