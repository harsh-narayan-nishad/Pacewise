"use client";
import { BRAND_HEADLINE, BRAND_NAME } from "@/lib/brand";

import { PasswordInput } from "@/components/ui/PasswordInput";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { devDataStore } from "@/lib/devData/store";
import { useCurrentUser } from "@/lib/devData/useDevStore";
import { useAuth } from "@/lib/api/AuthContext";
import { ApiError } from "@/lib/api/client";
import * as authApi from "@/lib/api/endpoints";
import { SocialButtons } from "@/components/Auth/SocialButtons";
import CursorGrid from "@/components/ui/CursorGrid";
import { backendSync } from "@/lib/api/backendSync";
import { isApiEnabled } from "@/lib/api/config";

/**
 * Sign-in gate. Everything in the app (notes and docs a QR code opens included) needs a real account,
 * and accounts exist ONLY on the backend: this screen sends the credentials to the API and the API
 * decides (see lib/api/AuthContext.tsx). No password is stored or compared in the browser.
 *
 * What it also does: loads the locally saved data once on the client (`devDataStore.hydrate()`), and
 * starts/stops the MongoDB sync for whoever is signed in.
 */
// One look for every field on the sign-in screens: small label above, underlined input (as in the story forms).
const FIELD = "mt-1 block w-full border-0 border-b border-ink/40 bg-transparent pb-2 pt-1 text-lg text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent-medium";
const LABEL = "block text-sm text-ink-muted";
const BOX = "block w-full rounded-lg border border-overlay/25 bg-transparent px-4 py-4 text-base text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-ink";
const PANEL = "w-full max-w-md rounded-[32px] border border-overlay/10 bg-canvas-raised p-6 sm:p-10";


export function DevLoginGate({ children }: { children: React.ReactNode }) {
  const currentUser = useCurrentUser();
  const { apiEnabled } = useAuth();
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    devDataStore.hydrate();
    setReady(true);
  }, []);

  // Backend (MongoDB) sync follows whoever is signed in.
  const currentUserId = currentUser?.id ?? null;
  useEffect(() => {
    if (!isApiEnabled()) return;
    if (currentUserId) void backendSync.start(currentUserId);
    else backendSync.stop();
  }, [currentUserId]);

  // First paint is neutral (the saved session is read right after), so the sign-in card never flashes for someone who is already signed in.
  if (!ready) return <div className="min-h-screen w-full bg-canvas" />;
  // Links from e-mails open without a sign-in: they ARE the proof of owning the inbox.
  if (apiEnabled && (pathname === "/verify-email" || pathname === "/reset-password")) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-canvas px-4 py-12 sm:px-6">
        <EmailLinkCard kind={pathname === "/verify-email" ? "verify" : "reset"} />
      </div>
    );
  }
  if (currentUser) return <>{children}</>;

  return (
    <div className="min-h-screen w-full bg-canvas">
      <AuthCard />
    </div>
  );
}

const PASSWORD_HINT = "At least 8 characters, with a letter and a number.";

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    // Validation failures carry per-field messages; show the first one instead of just "Validation failed".
    const fields = (err.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
    const first = fields ? Object.values(fields).flat()[0] : undefined;
    if (err.code === "API_DISABLED" || err.code === "NETWORK" || err.status === 0) return "Could not sign in. Please try again.";
    return first ?? err.message;
  }
  return "Could not sign in. Please try again.";
}

function AuthCard() {
  const { signup, login, google } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "verify-otp" | "reset-otp">("login");
  const [otp, setOtp] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /** Field names are shown on the sign-up form; elsewhere the placeholder says it and the name is for screen readers only. */
  const LBL = mode === "signup" ? "mb-1.5 block text-sm text-ink-muted" : "sr-only";

  function switchMode(m: "login" | "signup" | "forgot" | "verify-otp" | "reset-otp") {
    setMode(m);
    setOtp("");
    setError(null);
    setNotice(null);
    setNeedsVerification(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);
    setNeedsVerification(false);
    if ((mode === "signup" || mode === "reset-otp") && (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) {
      setError(PASSWORD_HINT);
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "verify-otp") {
        await authApi.verifyEmailOtp({ email: email.trim(), otp: otp.trim() });
        switchMode("login");
        setNotice("Email verified. You can sign in.");
      } else if (mode === "reset-otp") {
        await authApi.resetPasswordOtp({ email: email.trim(), otp: otp.trim(), newPassword: password });
        switchMode("login");
        setPassword("");
        setNotice("Password updated. Sign in to continue.");
      } else if (mode === "forgot") {
        await authApi.forgotPassword(email.trim());
        setNotice("If the email is registered, a verification code has been sent.");
      } else if (mode === "signup") {
        const result = await signup({ email: email.trim(), username: username.trim(), password, name: name.trim() });
        if (result.verificationRequired) {
          // Stay on the e-mail address and ask for the code that was just sent.
          setMode("verify-otp");
          setPassword("");
          setNotice(`Verification code sent to your email.${result.approvalRequired ? " Admin approval is also required." : ""}`);
        } else if (result.approvalRequired) {
          // Account exists but cannot be used until an admin approves it.
          switchMode("login");
          setIdentifier(username.trim());
          setNotice("Account created. Awaiting admin approval.");
        }
        // Otherwise the gate re-renders with the signed-in person.
      } else {
        await login({ identifier: identifier.trim(), password });
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") setNeedsVerification(true);
      setError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle(idToken: string) {
    if (submitting) return;
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const result = await google(idToken);
      if (result.approvalRequired) setNotice("Account created. Awaiting admin approval.");
      // Otherwise the gate re-renders with the signed-in person.
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    // The sign-in field may hold a username; the resend endpoint needs the email address.
    const address = mode === "verify-otp" ? email.trim() : identifier.includes("@") ? identifier.trim() : email.trim();
    if (!address.includes("@")) {
      setError("Enter your email address in the sign-in field to get a new link.");
      return;
    }
    try {
      await authApi.resendVerification(address);
      setError(null);
      setNotice("If the account exists, a new code has been sent.");
    } catch (err) {
      setError(errorText(err));
    }
  }

  const title = mode === "login" ? "Sign in to continue." : mode === "signup" ? "Create your account." : mode === "verify-otp" ? "Enter your confirmation code." : mode === "reset-otp" ? "Enter your reset code." : "Reset your password.";

  return (
    <div className="grid h-screen w-full grid-rows-[minmax(0,1fr)] overflow-hidden lg:grid-cols-[2fr_3fr]">
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex h-full min-h-0 flex-col overflow-y-auto px-6 py-10 sm:px-12 lg:px-[8vw]">
    <div className="my-auto">
      <div className="mb-3 font-display text-xl tracking-[-0.02em] text-ink-muted">{BRAND_NAME}</div>
      {mode !== "signup" && <h1 className="mb-10 font-display text-4xl leading-[1.08] tracking-[-0.03em] text-ink sm:text-5xl">{BRAND_HEADLINE}</h1>}
      <div className="w-full max-w-sm">
      {mode !== "login" && mode !== "signup" && <p className="mb-5 font-display text-2xl tracking-[-0.02em] text-ink">{title}</p>}
      {(mode === "login" || mode === "signup") && <SocialButtons disabled={submitting} onGoogleToken={(t) => void handleGoogle(t)} onUnavailable={(m) => { setNotice(null); setError(m); }} />}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <>
            <label className="block">
              <span className={LBL}>Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" required className={BOX} />
            </label>
            <label className="block">
              <span className={LBL}>Username</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Letters, numbers, underscore" autoComplete="username" minLength={3} maxLength={24} required className={BOX} />
            </label>
          </>
        )}
        {(mode === "signup" || mode === "forgot" || mode === "verify-otp" || mode === "reset-otp") && (
          <label className="block">
            <span className={LBL}>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" required className={BOX} />
          </label>
        )}
        {mode === "login" && (
          <label className="block">
            <span className="sr-only">Email or username</span>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email or username" autoComplete="username" required className={BOX} />
          </label>
        )}
        {(mode === "verify-otp" || mode === "reset-otp") && (
          <label className="block">
            <span className="sr-only">6-digit code</span>
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className={BOX} />
          </label>
        )}
        {(mode === "login" || mode === "signup" || mode === "reset-otp") && (
          <label className="block">
            <span className={LBL}>{mode === "reset-otp" ? "New password" : "Password"}</span>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "reset-otp" ? "New password" : "Password"} autoComplete={mode === "login" ? "current-password" : "new-password"} className={BOX} />
          </label>
        )}

        {notice && <p role="status" className="text-sm text-ink-muted">{notice}</p>}
        {error && <p role="alert" className="text-sm text-accent-extreme">{error}</p>}
        {needsVerification && (
          <button type="button" onClick={() => void resend()} className="-mt-1 flex items-center gap-2 self-start text-sm text-ink underline-offset-4 hover:underline">
            <Mail className="h-4 w-4" /> Send a new confirmation code
          </button>
        )}
        {needsVerification && (
          <button type="button" onClick={() => { if (identifier.includes("@")) setEmail(identifier.trim()); switchMode("verify-otp"); }} className="-mt-1 self-start text-sm text-ink underline-offset-4 hover:underline">
            I have a code
          </button>
        )}

        <Button type="submit" size="lg" disabled={submitting} className="mt-1 h-14 w-full text-base">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "verify-otp" ? "Confirm email" : mode === "reset-otp" ? "Change password" : "Email me a code and link"}
        </Button>

        {mode === "login" && (
          <button type="button" onClick={() => switchMode("forgot")} className="text-center text-sm text-ink-muted hover:text-ink">
            Forgot password?
          </button>
        )}
        {mode === "login" && (
          <button type="button" onClick={() => switchMode("signup")} className="text-center text-sm text-ink-muted hover:text-ink">
            Create new account
          </button>
        )}
        {mode === "signup" && (
          <button type="button" onClick={() => switchMode("login")} className="text-center text-sm text-ink-muted hover:text-ink">
            Already have an account? Sign in
          </button>
        )}
        {mode === "forgot" && (
          <button type="button" onClick={() => { const keep = email; switchMode("reset-otp"); setEmail(keep); }} className="text-center text-sm text-ink-muted hover:text-ink">
            I already have a code
          </button>
        )}
        {mode === "verify-otp" && (
          <button type="button" onClick={() => void resend()} className="text-center text-sm text-ink-muted hover:text-ink">
            Send me a new code
          </button>
        )}
        {(mode === "forgot" || mode === "verify-otp" || mode === "reset-otp") && (
          <button type="button" onClick={() => switchMode("login")} className="text-center text-sm text-ink-muted hover:text-ink">
            Back to sign in
          </button>
        )}
      </form>
      </div>
      <p className="mt-12 text-xs text-ink-faint">&copy; {new Date().getFullYear()} {BRAND_NAME}</p>
    </div>
    </motion.div>
    <div aria-hidden className="hidden h-full overflow-hidden lg:block" style={{ background: "radial-gradient(60% 55% at 12% 12%, #5f7a5c 0%, transparent 70%), radial-gradient(55% 50% at 92% 25%, #8da586 0%, transparent 70%), radial-gradient(70% 55% at 70% 85%, #b88a2e 0%, transparent 70%), radial-gradient(60% 60% at 30% 60%, #8f8333 0%, transparent 75%), #a99b57" }}>
      <CursorGrid cellSize={56} color="#ffffff" gridColor="#ffffff" highlight="area" gridStyle="lines" radius={140} holdTime={400} fadeDuration={800} fillOpacity={0.16} gridOpacity={0.12} spotlight={0.5} edgeFade={0} restBlocks={0.07} restLevel={0.8} clickPulse>
        <div className="flex h-full w-full items-center justify-center">
          <svg viewBox="0 0 420 520" className="h-[78vh] w-auto">
            <text x="210" y="470" textAnchor="middle" fontSize="640" fontWeight="700" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2" style={{ fontFamily: "Roobert, Inter, ui-sans-serif, system-ui, sans-serif" }}>P</text>
          </svg>
        </div>
      </CursorGrid>
    </div>
    </div>
  );
}

/** Opened from the link in an e-mail: confirms the address, or lets the person choose a new password. */
function EmailLinkCard({ kind }: { kind: "verify" | "reset" }) {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"working" | "done" | "failed">(kind === "verify" ? "working" : "working");
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (!t) {
      setState("failed");
      setMessage("This link is incomplete. Open it again from the email.");
      return;
    }
    if (kind === "verify") {
      authApi
        .verifyEmail(t)
        .then(() => { setState("done"); setMessage("Your email is confirmed. You can sign in now."); })
        .catch((err) => { setState("failed"); setMessage(errorText(err)); });
    } else {
      setState("working");
    }
  }, [kind]);

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!token || submitting) return;
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setMessage(PASSWORD_HINT);
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, newPassword: password });
      setState("done");
      setMessage("Password changed. Every device was signed out; sign in with your new password.");
    } catch (err) {
      setState("failed");
      setMessage(errorText(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={PANEL}>
      <h1 className="font-display text-4xl leading-tight tracking-[-0.03em] text-ink">{BRAND_NAME}</h1>
      <p className="mt-2 text-base text-ink-muted">{kind === "verify" ? "Confirming your email" : "Choose a new password"}</p>

      {kind === "reset" && state === "working" && (
        <form onSubmit={submitReset} className="mt-6 flex flex-col gap-6">
          <label className={LABEL}>
            New password
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" className={FIELD} />
          </label>
          {message && <p role="alert" className="text-sm text-accent-extreme">{message}</p>}
          <Button type="submit" size="lg" disabled={submitting} className="w-full">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{submitting ? "Please wait…" : "Change password"}</Button>
        </form>
      )}
      {kind === "verify" && state === "working" && <p className="mt-6 text-base text-ink-muted">One moment…</p>}
      {state !== "working" && message && (
        <p role={state === "failed" ? "alert" : "status"} className={`mt-6 text-base ${state === "failed" ? "text-accent-extreme" : "text-ink"}`}>{message}</p>
      )}
      {state !== "working" && (
        <Button size="lg" className="mt-6 w-full" onClick={() => { window.location.assign("/"); }}>Go to sign in</Button>
      )}
    </div>
  );
}
