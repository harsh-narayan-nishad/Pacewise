/**
 * Base URL of the standalone backend (see /speed-reader-backend). Empty by
 * default — every function in this `lib/api` module checks `isApiEnabled()`
 * first and the rest of the app falls back to its existing local
 * (devData/localStorage) behavior when it's unset, so wiring this up is
 * additive: nothing here breaks the app if the backend isn't running.
 *
 * The address is written directly here (no .env file is read). To point the app at another backend,
 * change the URL below.
 */
export const API_BASE_URL = "https://pacewise-backend-o4qu.onrender.com/api/v1";

export function isApiEnabled(): boolean {
  return API_BASE_URL.length > 0;
}
