/**
 * Wipes everything the app has stored in this browser and reloads it, so it starts
 * exactly like a first visit: local/session storage (stories, history, streaks,
 * bookmarks, playlists, per-user sessions, theme, demo accounts, tokens), IndexedDB,
 * Cache Storage, service workers and readable cookies.
 */
export async function resetAllAppData(): Promise<void> {
  const safely = async (fn: () => unknown) => {
    try { await fn(); } catch { /* keep wiping the rest */ }
  };

  await safely(() => window.localStorage.clear());
  await safely(() => window.sessionStorage.clear());

  await safely(async () => {
    const idb = window.indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> };
    const dbs = (await idb.databases?.()) ?? [];
    await Promise.all(
      dbs.map((d) => new Promise<void>((resolve) => {
        if (!d.name) return resolve();
        const req = idb.deleteDatabase(d.name);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      })),
    );
  });

  await safely(async () => {
    if (!("caches" in window)) return;
    await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  });

  await safely(async () => {
    if (!("serviceWorker" in navigator)) return;
    await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
  });

  await safely(() => {
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0]?.trim();
      if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  });

  window.location.replace("/");
}
