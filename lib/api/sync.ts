import { isApiEnabled } from "@/lib/api/config";
import { tokenStore } from "@/lib/api/tokenStore";
import { historyApi, RecordSessionInput } from "@/lib/api/endpoints";

/**
 * Fire-and-forget: mirrors a finished reading session to the backend's
 * `/history` endpoint (see speed-reader-backend's ReadingSession model) so
 * it's available from any other device signed into the same backend
 * account, in addition to this browser's own localStorage copy (which
 * `lib/storage.ts` keeps regardless — that one is never removed, so the
 * app works fully offline/without a backend exactly as before).
 *
 * Deliberately swallows errors rather than surfacing them: a finished
 * session should never be blocked, or show an error toast, just because
 * the backend happens to be unreachable at that moment — the local copy
 * is already safely written by the time this is called.
 */
export function syncReadingSession(input: RecordSessionInput): Promise<string | null> {
  if (!isApiEnabled() || !tokenStore.getAccessToken()) return Promise.resolve(null);
  // Resolves with the attempt's id on the backend (so topic edits can be saved there), or null on failure.
  return historyApi.record(input).then((row) => row.id).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn("Could not sync reading session to backend:", err);
    return null;
  });
}
