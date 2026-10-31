"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TickSpinner } from "@/components/ui/loaders/TickSpinner";
import { isPublicPath } from "@/lib/publicRoutes";

/** A wait shorter than this never shows the loader (a quick page just appears). */
export const NAV_LOADER_DELAY_MS = 150;
/** If a navigation never lands, give the screen back after this long. */
const GIVE_UP_MS = 15_000;

interface NavLoader {
  /** Navigate and cover the screen with the loader if the page takes longer than the delay. */
  push: (href: string) => void;
  /** Start the loader for a navigation you trigger yourself. It ends when the address changes. */
  start: () => void;
}

const Ctx = createContext<NavLoader | null>(null);

/**
 * Full-screen navigation loader for the signed-in app (never the docs pages). While a page is loading,
 * the whole screen is the theme colour with the spinner in the centre, so nothing half-loaded shows;
 * the page appears when it is ready. Every normal link is covered automatically (a click on an internal
 * <a>), and `push` covers programmatic navigation.
 */
export function NavLoaderProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);
  const here = useRef(pathname);
  here.current = pathname;

  const start = useCallback(() => {
    if (isPublicPath(here.current)) return;
    setPending(true);
  }, []);

  const push = useCallback(
    (href: string) => {
      const target = href.split(/[?#]/)[0];
      if (target !== here.current) start();
      router.push(href);
    },
    [router, start]
  );

  // The page arrived: drop the loader.
  useEffect(() => {
    setPending(false);
    setVisible(false);
  }, [pathname]);

  useEffect(() => {
    if (!pending) return;
    const show = window.setTimeout(() => setVisible(true), NAV_LOADER_DELAY_MS);
    const giveUp = window.setTimeout(() => { setPending(false); setVisible(false); }, GIVE_UP_MS);
    return () => { window.clearTimeout(show); window.clearTimeout(giveUp); };
  }, [pending]);

  // Plain links anywhere in the app: an internal click that changes the page starts the loader.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented && e.button !== 0) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (isPublicPath(here.current)) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (isPublicPath(url.pathname)) return; // opening the docs keeps its own look
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setPending(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const value = useMemo(() => ({ push, start }), [push, start]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {visible && (
        <div role="alert" aria-busy="true" className="fixed inset-0 z-[400] flex items-center justify-center bg-canvas">
          <TickSpinner size={44} label="Loading page" />
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Falls back to a plain router push when used outside the provider. */
export function useNavLoader(): NavLoader {
  const ctx = useContext(Ctx);
  const router = useRouter();
  return ctx ?? { push: (href) => router.push(href), start: () => undefined };
}
