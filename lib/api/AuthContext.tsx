"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isApiEnabled } from "@/lib/api/config";
import { ApiError } from "@/lib/api/client";
import { tokenStore } from "@/lib/api/tokenStore";
import * as api from "@/lib/api/endpoints";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser } from "@/lib/devData/useDevStore";
import { ApiUser, AuthResponse } from "@/lib/api/types";

interface AuthContextValue {
  /** Whether a backend URL is configured at all (NEXT_PUBLIC_API_URL). Without one nobody can sign in. */
  apiEnabled: boolean;
  /** The account the BACKEND confirmed, or null while signed out / not yet confirmed. */
  user: ApiUser | null;
  /** True until the first "is the saved session still valid?" check has finished. */
  loading: boolean;
  /** `verificationRequired: true` = account created, but the e-mailed link must be clicked before signing in. */
  signup: (input: { email: string; username: string; password: string; name: string }) => Promise<{ verificationRequired: boolean; approvalRequired: boolean }>;
  login: (input: { identifier: string; password: string }) => Promise<void>;
  /** Sign in / sign up with a Google ID token. `approvalRequired: true` = new account, waiting for an admin. */
  google: (idToken: string) => Promise<{ approvalRequired: boolean }>;
  logout: () => Promise<void>;
  changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The ONLY place authentication happens, and it happens on the backend:
 *   - signup/login send the credentials to the API, which checks them (bcrypt) and returns the account + tokens.
 *   - The browser keeps just the tokens (per signed-in user, see tokenStore) — never a password.
 *   - On every load the saved session is re-checked with GET /auth/me; a 401 (expired or revoked) signs the
 *     person out. A network error alone does not (a brief outage should not log you out).
 *   - Log out revokes the refresh token on the server, then clears this browser.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUser = useCurrentUser();
  const currentUserId = currentUser?.id ?? null;

  // Re-check the saved session whenever the signed-in person changes (including after the saved one is restored on load).
  useEffect(() => {
    let cancelled = false;
    async function verify() {
      if (!currentUserId) {
        setUser(null);
        setLoading(false);
        return;
      }
      if (!isApiEnabled() || !tokenStore.getAccessToken()) {
        // A session that exists only in this browser (made before real sign-in existed) is not a session.
        devDataStore.logout();
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const confirmed = await api.me();
        if (cancelled) return;
        if (confirmed.id !== currentUserId) {
          // Tokens belong to a different account than the one remembered here: start clean.
          tokenStore.clear();
          devDataStore.logout();
          setUser(null);
        } else {
          setUser(confirmed);
        }
      } catch (err) {
        if (cancelled) return;
        // 401 = expired/revoked session. ACCOUNT_* = an admin banned or un-approved this account.
        if (err instanceof ApiError && (err.status === 401 || (err.status === 403 && err.code?.startsWith("ACCOUNT_")))) {
          tokenStore.clear();
          devDataStore.logout();
          setUser(null);
        }
        // Any other failure (backend unreachable): keep the session, it is verified again on the next load.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void verify();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  /** Order matters: the person must be "current" BEFORE the tokens are saved, because tokens are stored per user. */
  const establish = useCallback((result: AuthResponse) => {
    devDataStore.signInAs({ id: result.user.id, name: result.user.name, username: result.user.username, interests: result.user.interests });
    tokenStore.setTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
  }, []);

  const signup = useCallback(async (input: { email: string; username: string; password: string; name: string }) => {
    const result = await api.signup(input);
    // No session yet when the e-mail must be confirmed first, or when an admin still has to approve the account.
    if (result.verificationRequired) return { verificationRequired: true, approvalRequired: Boolean(result.approvalRequired) };
    if (result.approvalRequired) return { verificationRequired: false, approvalRequired: true };
    establish(result);
    return { verificationRequired: false, approvalRequired: false };
  }, [establish]);

  const login = useCallback(async (input: { identifier: string; password: string }) => {
    establish(await api.login(input));
  }, [establish]);

  const google = useCallback(async (idToken: string) => {
    const result = await api.loginWithGoogle(idToken);
    if (result.approvalRequired) return { approvalRequired: true };
    establish(result);
    return { approvalRequired: false };
  }, [establish]);

  const logout = useCallback(async () => {
    await api.logout(); // revokes the refresh token on the server, then clears the saved tokens
    devDataStore.logout();
    setUser(null);
  }, []);

  const changePassword = useCallback(async (input: { currentPassword: string; newPassword: string }) => {
    establish(await api.changePassword(input));
  }, [establish]);

  const value = useMemo<AuthContextValue>(
    () => ({ apiEnabled: isApiEnabled(), user, loading, signup, login, google, logout, changePassword }),
    [user, loading, signup, login, google, logout, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
