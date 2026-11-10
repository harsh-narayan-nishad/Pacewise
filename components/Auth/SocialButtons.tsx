"use client";

import React, { useEffect, useRef } from "react";
import { Apple } from "lucide-react";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const PILL = "flex h-12 w-full items-center justify-center gap-3 rounded-full border border-overlay/15 bg-white text-base font-medium text-[#1f1f1f] transition-colors hover:bg-[#f4f4f4] disabled:opacity-60";

interface GoogleId {
  initialize: (o: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode?: string }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
}
declare global { interface Window { google?: { accounts: { id: GoogleId } } } }

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-16.6z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2 1.4-4.7 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/**
 * "Continue with Google" and "Continue with Apple", then an "or" divider.
 * Google works when NEXT_PUBLIC_GOOGLE_CLIENT_ID is set (Google's own button hands back a signed ID token, which the backend verifies).
 * Apple is a placeholder for now: it is shown but not connected.
 */
export function SocialButtons({ onGoogleToken, onUnavailable, disabled }: { onGoogleToken: (idToken: string) => void; onUnavailable: (message: string) => void; disabled?: boolean }) {
  const slot = useRef<HTMLDivElement>(null);
  // Latest handler without re-initialising Google's button on every render.
  const handler = useRef(onGoogleToken);
  handler.current = onGoogleToken;

  useEffect(() => {
    if (!CLIENT_ID || !slot.current) return;
    const el = slot.current;
    const draw = () => {
      const id = window.google?.accounts.id;
      if (!id) return;
      id.initialize({ client_id: CLIENT_ID, callback: (r) => { if (r.credential) handler.current(r.credential); } });
      el.innerHTML = "";
      id.renderButton(el, { type: "standard", theme: "outline", size: "large", shape: "pill", text: "continue_with", logo_alignment: "center", width: Math.min(400, el.clientWidth || 384) });
    };
    if (window.google?.accounts) { draw(); return; }
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", draw);
    return () => script?.removeEventListener("load", draw);
  }, []);

  return (
    <div className="mb-2 flex w-full flex-col gap-3">
      {CLIENT_ID ? (
        <div className={`flex h-12 w-full justify-center ${disabled ? "pointer-events-none opacity-60" : ""}`} ref={slot} aria-label="Continue with Google" />
      ) : (
        <button type="button" disabled={disabled} onClick={() => onUnavailable("Google sign-in is not set up yet.")} className={PILL}>
          <GoogleMark /> Continue with Google
        </button>
      )}
      <button type="button" disabled={disabled} onClick={() => onUnavailable("Apple sign-in is not available yet.")} className={PILL}>
        <Apple className="h-5 w-5 fill-current" aria-hidden /> Continue with Apple
      </button>
      <div className="my-2 flex items-center gap-3 text-sm text-ink-muted" role="separator">
        <span className="h-px flex-1 bg-overlay/20" />
        or
        <span className="h-px flex-1 bg-overlay/20" />
      </div>
    </div>
  );
}
