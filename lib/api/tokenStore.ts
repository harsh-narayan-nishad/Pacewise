import { ScopedTokenStore } from "@/lib/api/ScopedTokenStore";
import { createDefaultKeyValueStore } from "@/lib/session/storage/KeyValueStore";
import { sessionManager } from "@/lib/session/composition";

/**
 * The app's one token store — wiring only. The behavior (per-user
 * namespacing, guest adoption, legacy migration) lives in
 * `ScopedTokenStore`; this file just binds it to the browser's storage and
 * to whoever the SessionManager says is signed in *right now*, so
 * switching demo user switches which backend account the app talks as.
 * Kept separate from the general per-user repositories on purpose:
 * tokens are security-sensitive and have their own lifecycle.
 */
export const tokenStore = new ScopedTokenStore(createDefaultKeyValueStore(), () => sessionManager.activeUserId());
