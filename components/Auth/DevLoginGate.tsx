"use client";
import { BRAND_NAME } from "@/lib/brand";

import { PasswordInput } from "@/components/ui/PasswordInput";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpenText, LogIn } from "lucide-react";
import { Card } from "@/components/ui/card";
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
export function DevLoginGate({ children }: { children: React.ReactNode }) {
  const currentUser = useCurrentUser();
  const [userId, setUserId] = useState(SEED_USERS[0].id);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    devDataStore.hydrate();
  }, []);

  if (currentUser) return <>{children}</>;

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-canvas px-6 py-12">
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-sm"
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-canvas">
          <BookOpenText className="h-6 w-6" />
        </div>
        <h1 className="mb-1 font-display text-2xl text-ink">{BRAND_NAME}</h1>
        <p className="text-sm text-ink-muted">Sign in with a development demo account</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Demo account
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-overlay/15 bg-canvas-raised px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
            >
              {SEED_USERS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.id})
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Demo password
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Demo password"
              autoComplete="off"
              className="mt-1.5 w-full rounded-lg border border-overlay/15 bg-canvas-raised px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
            />
          </label>

          {error && <p className="text-sm text-accent-extreme">{error}</p>}

          <Button type="submit" size="md" disabled={submitting} className="mt-1 w-full">
            <LogIn className="h-4 w-4" />
            {submitting ? "Signing in…" : "Sign in"}
          </Button>

          <p className="mt-1 text-center text-xs text-ink-faint">
            Development credentials — see README.md for the full list. Not real accounts.
          </p>
        </form>
      </Card>
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
      <Card className="w-full max-w-sm">
        <p className="text-sm text-ink">
          Backend account connected: <span className="font-medium">{user.name}</span> (@{user.username})
        </p>
        <Button size="sm" className="mt-3" onClick={() => void logout()}>
          Disconnect backend account
        </Button>
      </Card>
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
    <Card className="w-full max-w-sm">
      <div className="mb-3 flex gap-2 text-xs font-medium uppercase tracking-wide">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={mode === "login" ? "text-ink" : "text-ink-faint"}
        >
          Backend login
        </button>
        <span className="text-ink-faint">/</span>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={mode === "signup" ? "text-ink" : "text-ink-faint"}
        >
          Create backend account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === "signup" && (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-lg border border-overlay/15 bg-canvas-raised px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
            />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full rounded-lg border border-overlay/15 bg-canvas-raised px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full rounded-lg border border-overlay/15 bg-canvas-raised px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
            />
          </>
        )}
        {mode === "login" && (
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email or username"
            className="w-full rounded-lg border border-overlay/15 bg-canvas-raised px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
          />
        )}
        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-overlay/15 bg-canvas-raised px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent-medium"
        />

        {error && <p className="text-sm text-accent-extreme">{error}</p>}

        <Button type="submit" size="sm" disabled={submitting} className="w-full">
          {submitting ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
        </Button>

        <p className="text-center text-xs text-ink-faint">
          Optional — connects a real account on speed-reader-backend for synced reading history and your own
          stories.
        </p>
      </form>
    </Card>
  );
}
