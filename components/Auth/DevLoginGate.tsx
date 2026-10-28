"use client";
import { BRAND_NAME } from "@/lib/brand";

import { PasswordInput } from "@/components/ui/PasswordInput";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isPublicPath } from "@/lib/publicRoutes";
import { motion } from "framer-motion";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser } from "@/lib/devData/useDevStore";
import { SEED_USERS } from "@/lib/devData/seedUsers";
import { useAuth } from "@/lib/api/AuthContext";
import { ApiError } from "@/lib/api/client";

/**
 * Development-only login gate — there was no authentication anywhere in
 * this app before this phase. This is the minimum login support needed to
 * give the new social features (share, notify, comment, follow) a stable
 * "who is doing this" identity, without building a real auth system: pick
 * one of the 100 seeded demo accounts, enter its demo password, and the
 * rest of the app (unchanged) renders normally.
 *
 * Deliberately NOT integrated into the existing design's navbar/landing
 * page — it replaces them entirely until a user logs in, the same way a
 * real app's `/login` route would, rather than bolting a login form onto
 * an existing screen that was never designed to show one. Once logged in,
 * nothing about the existing TopNav/SearchLanding/Dashboard/etc. changes.
 *
 * Session note: the logged-in user (and every share/notification/comment/
 * reaction/save/playlist/follow) is now mirrored into this browser's
 * localStorage by devDataStore (see store.ts's "Persistence" section), so
 * refreshing the page — or closing and reopening the tab on this same
 * machine — keeps you signed in and keeps all of that data intact. The
 * `hydrate()` call below is what loads it: deliberately run once, from
 * this effect, rather than eagerly when the store module is first
 * evaluated, so the very first render (including Next.js's server-
 * rendered HTML, which has no access to this browser's localStorage)
 * always starts identical on server and client — avoiding a hydration
 * mismatch — and then updates a moment later with whatever was saved.
 */
// One look for every field on the sign-in screens: small label above, underlined input (as in the story forms).
const FIELD = "mt-1 block w-full border-0 border-b border-ink/40 bg-transparent pb-2 pt-1 text-lg text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent-medium";
const LABEL = "block text-sm text-ink-muted";
const PANEL = "w-full max-w-md rounded-[32px] border border-overlay/10 bg-canvas-raised p-6 sm:p-10";

export function DevLoginGate({ children }: { children: React.ReactNode }) {
  const currentUser = useCurrentUser();
  const pathname = usePathname();
  const [userId, setUserId] = useState(SEED_USERS[0].id);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    devDataStore.hydrate();
  }, []);

  // Public pages (the shared notes a QR code opens) never ask for a login.
  if (currentUser || isPublicPath(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-canvas px-4 py-12 sm:px-6">
      <DemoLoginCard
        userId={userId}
        setUserId={setUserId}
        password={password}
        setPassword={setPassword}
        error={error}
        setError={setError}
        submitting={submitting}
        setSubmitting={setSubmitting}
      />
      <BackendAuthCard />
    </div>
  );
}

/**
 * The original demo-account picker, unchanged in behavior — pulled into
 * its own component only so it can sit side-by-side with the new
 * `BackendAuthCard` below without this file's JSX getting unwieldy.
 */
function DemoLoginCard({
  userId,
  setUserId,
  password,
  setPassword,
  error,
  setError,
  submitting,
  setSubmitting,
}: {
  userId: string;
  setUserId: (id: string) => void;
  password: string;
  setPassword: (p: string) => void;
  error: string | null;
  setError: (e: string | null) => void;
  submitting: boolean;
  setSubmitting: (s: boolean) => void;
}) {

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    // Synchronous in-memory check — the tiny artificial delay just keeps
    // the submit button's loading state from flashing instantly, matching
    // how a real sign-in request would feel.
    window.setTimeout(() => {
      const result = devDataStore.login(userId, password);
      setSubmitting(false);
      if (!result.ok) setError(result.error);
    }, 150);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={PANEL}>
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl">{BRAND_NAME}</h1>
        <p className="mt-2 text-base text-ink-muted">Sign in with a development demo account.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className={LABEL}>
          Demo account
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className={FIELD}>
            {SEED_USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.id})
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL}>
          Demo password
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Demo password" autoComplete="off" className={FIELD} />
        </label>

        {error && <p className="text-sm text-accent-extreme">{error}</p>}

        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          <LogIn className="h-4 w-4" />
          {submitting ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-center text-sm text-ink-faint">Development credentials. See README.md for the full list. Not real accounts.</p>
      </form>
    </motion.div>
  );
}

/**
 * Optional, additive panel shown only when the app is configured with a
 * real backend (NEXT_PUBLIC_API_URL set — see lib/api/config.ts). Signs up
 * or logs in against the standalone backend (speed-reader-backend) and
 * stores its own JWT session (lib/api/tokenStore.ts), completely separate
 * from the demo-account gate above: this card never needs to "pass" to let
 * you into the app — the demo card still does that, unchanged — it just
 * connects your real backend account (used for synced reading history and
 * your own uploaded/created stories; see useAuth()) alongside whichever
 * demo persona you use to explore the social features.
 */
function BackendAuthCard() {
  const { apiEnabled, user, loading, signup, login, logout } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!apiEnabled || loading) return null;

  if (user) {
    return (
      <div className={PANEL}>
        <p className="text-base text-ink">
          Backend account connected: <span className="font-medium">{user.name}</span> (@{user.username})
        </p>
        <Button size="md" variant="outline" className="mt-4" onClick={() => void logout()}>
          Disconnect backend account
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "signup") {
        await signup({ email, username, password, name });
      } else {
        await login({ identifier, password });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the backend.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={PANEL}>
      <div className="mb-6 flex justify-center gap-2" role="tablist" aria-label="Backend account">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full px-5 py-2 text-sm transition-colors ${mode === m ? "bg-ink text-canvas" : "border border-overlay/15 text-ink-muted hover:text-ink"}`}
          >
            {m === "login" ? "Backend login" : "Create backend account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {mode === "signup" && (
          <>
            <label className={LABEL}>
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={FIELD} />
            </label>
            <label className={LABEL}>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className={FIELD} />
            </label>
            <label className={LABEL}>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className={FIELD} />
            </label>
          </>
        )}
        {mode === "login" && (
          <label className={LABEL}>
            Email or username
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email or username" className={FIELD} />
          </label>
        )}
        <label className={LABEL}>
          Password
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={FIELD} />
        </label>

        {error && <p className="text-sm text-accent-extreme">{error}</p>}

        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
        </Button>

        <p className="text-center text-sm text-ink-faint">
          Optional. Connects a real account on speed-reader-backend for synced reading history and your own stories.
        </p>
      </form>
    </div>
  );
}
