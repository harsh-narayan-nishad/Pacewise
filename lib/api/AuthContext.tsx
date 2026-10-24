"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isApiEnabled } from "@/lib/api/config";
import { tokenStore } from "@/lib/api/tokenStore";
import * as api from "@/lib/api/endpoints";
import { usersApi } from "@/lib/api/endpoints";
import { ApiUser } from "@/lib/api/types";

interface AuthContextValue {
  /** Whether a backend URL is configured at all (NEXT_PUBLIC_API_URL). */
  apiEnabled: boolean;
  /** The signed-in backend user, or null if not signed in (or not using
   *  the backend). Distinct from the app's existing devData "current
   *  user" — this is the real, backend-authenticated account. */
  user: ApiUser | null;
  /** True while the initial "do we already have a valid session" check is
   *  running, right after mount — lets callers avoid a login-flash. */
  loading: boolean;
  signup: (input: { email: string; username: string; password: string; name: string }) => Promise<void>;
  login: (input: { identifier: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Wraps the app and tracks the real backend session (JWT access + refresh
 * tokens — see lib/api/tokenStore.ts and client.ts). Entirely separate
 * from, and additive to, the existing `devDataStore` "pick a demo user"
 * concept: this only does anything once NEXT_PUBLIC_API_URL is set and a
 * person actually signs up/logs in against the real backend — see
 * components/Auth/DevLoginGate.tsx, which offers both.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      if (!isApiEnabled() || !tokenStore.getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        // There's no "/auth/me" endpoint — the access token itself only
        // carries id+username (see backend's utils/jwt.ts), so the full
        // profile is fetched by username once we know it. Decoding the
        // JWT payload client-side (it's not encrypted, just signed) is
        // enough to get that username without an extra round trip.
        const payloadB64 = tokenStore.getAccessToken()!.split(".")[1];
        const payload = JSON.parse(atob(payloadB64)) as { username?: string };
        if (payload.username) {
          const profile = await usersApi.getProfile(payload.username);
          if (!cancelled) setUser(profile);
        }
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const signup = useCallback(async (input: { email: string; username: string; password: string; name: string }) => {
    const signedUpUser = await api.signup(input);
    setUser(signedUpUser);
  }, []);

  const login = useCallback(async (input: { identifier: string; password: string }) => {
    const loggedInUser = await api.login(input);
    setUser(loggedInUser);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profile = await usersApi.getProfile(user.username);
    setUser(profile);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({ apiEnabled: isApiEnabled(), user, loading, signup, login, logout, refreshProfile }),
    [user, loading, signup, login, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
