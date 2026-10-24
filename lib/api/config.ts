/**
 * Base URL of the standalone backend (see /speed-reader-backend). Empty by
 * default — every function in this `lib/api` module checks `isApiEnabled()`
 * first and the rest of the app falls back to its existing local
 * (devData/localStorage) behavior when it's unset, so wiring this up is
 * additive: nothing here breaks the app if the backend isn't running.
 *
 * Set NEXT_PUBLIC_API_URL in .env.local to point at it, e.g.
 * NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";

export function isApiEnabled(): boolean {
  return API_BASE_URL.length > 0;
}
