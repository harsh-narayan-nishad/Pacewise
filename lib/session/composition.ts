import { devDataStore } from "@/lib/devData/store";
import { createDefaultKeyValueStore } from "@/lib/session/storage/KeyValueStore";
import { DevStoreIdentityProvider } from "@/lib/session/identity/DevStoreIdentityProvider";
import { registerCustomStoryOwnerResolver } from "@/lib/devData/contentMeta";
import { SyncingKeyValueStore } from "@/lib/api/SyncingKeyValueStore";
import { SessionManager } from "@/lib/session/SessionManager";

/**
 * COMPOSITION ROOT — the one file that decides which concrete classes get
 * wired together (browser/memory store, dev-login identity). Everything
 * else in lib/session depends only on interfaces, so changing the storage
 * medium or the identity source is an edit to this file alone.
 */
/** Browser storage + a decorator that also mirrors the reading data to the backend (MongoDB). */
export const syncingStore = new SyncingKeyValueStore(createDefaultKeyValueStore());

export const sessionManager = new SessionManager(
  syncingStore,
  new DevStoreIdentityProvider(devDataStore)
);

registerCustomStoryOwnerResolver((id) => sessionManager.findCustomStoryOwner(id));
