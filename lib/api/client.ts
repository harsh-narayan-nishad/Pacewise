import { API_BASE_URL, isApiEnabled } from "@/lib/api/config";
import { tokenStore } from "@/lib/api/tokenStore";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Skip attaching the Authorization header (signup/login/refresh). */
  skipAuth?: boolean;
  /** Internal — prevents infinite refresh loops. */
  _isRetry?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(API_BASE_URL + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

// A single in-flight refresh is shared by every request that hits a 401 at
// the same time, instead of each one independently calling /auth/refresh
// (which would race to rotate the same refresh token and knock the others
// out — see the backend's reuse-detection logic in auth.service.ts).
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          tokenStore.clear();
          return null;
        }
        const data = await res.json();
        tokenStore.setTokens(data.accessToken, data.refreshToken);
        return data.accessToken as string;
      })
      .catch(() => {
        tokenStore.clear();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * The one place every backend call goes through. Attaches the stored
 * access token, and on a 401 transparently refreshes once and retries the
 * original request — so a 15-minute access-token expiry is invisible to
 * every caller below this function instead of each one having to handle
 * it. Throws `ApiError` (never a raw fetch rejection) so callers can
 * pattern-match on `.status`/`.code`.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!isApiEnabled()) {
    throw new ApiError(0, "Backend API is not configured (NEXT_PUBLIC_API_URL is unset).", "API_DISABLED");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!options.skipAuth) {
    const token = tokenStore.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !options.skipAuth && !options._isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, { ...options, _isRetry: true });
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const err = (payload as { error?: { message?: string; code?: string; details?: unknown } } | null)?.error;
    // An admin banned this account while it was signed in: drop the session and reload to the sign-in screen.
    if (res.status === 403 && !options.skipAuth && (err?.code === "ACCOUNT_BANNED" || err?.code === "ACCOUNT_REJECTED") && typeof window !== "undefined") {
      tokenStore.clear();
      window.location.reload();
    }
    throw new ApiError(res.status, err?.message ?? `Request failed with status ${res.status}`, err?.code, err?.details);
  }

  return payload as T;
}
