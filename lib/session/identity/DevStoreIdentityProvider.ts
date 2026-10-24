import { IdentityProvider } from "@/lib/session/identity/IdentityProvider";

/** The slice of the dev data store this adapter needs (structural typing,
 *  so the real `devDataStore` satisfies it without being imported here). */
export interface DevIdentitySource {
  getCurrentUserId(): string | null;
  subscribe(listener: () => void): () => void;
}

/**
 * ADAPTER: presents the development login (`devDataStore`) as an
 * `IdentityProvider`. When real backend auth becomes the identity source,
 * a sibling `ApiIdentityProvider implements IdentityProvider` replaces
 * this in the composition root and nothing else changes.
 */
export class DevStoreIdentityProvider implements IdentityProvider {
  constructor(private readonly source: DevIdentitySource) {}

  currentUserId(): string | null {
    return this.source.getCurrentUserId();
  }

  subscribe(listener: () => void): () => void {
    return this.source.subscribe(listener);
  }
}
