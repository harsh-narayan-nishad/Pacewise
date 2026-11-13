"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_LOADER_DELAY_MS } from "@/contexts/NavLoaderContext";
import { TickSpinner } from "@/components/ui/loaders/TickSpinner";
import { Avatar } from "@/components/ui/Avatar";
import { useCurrentUser } from "@/lib/devData/useDevStore";
import { ROUTES } from "@/lib/routes";

/** If the profile page never arrives, stop showing the spinner after this long. */
const GIVE_UP_MS = 15_000;

/**
 * Navbar profile button: shows the user's photo and opens their profile page directly.
 * While that page loads, the spinner shows inside the profile circle itself (not a full-screen cover), only if the
 * wait passes the same delay the app's navigation loader uses, so a quick page never flashes it.
 */
export function ProfileMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const [clicked, setClicked] = useState(false);
  const [loading, setLoading] = useState(false);

  // The page arrived (the address changed): back to the photo.
  useEffect(() => { setClicked(false); setLoading(false); }, [pathname]);

  useEffect(() => {
    if (!clicked) return undefined;
    const show = window.setTimeout(() => setLoading(true), NAV_LOADER_DELAY_MS);
    const giveUp = window.setTimeout(() => { setClicked(false); setLoading(false); }, GIVE_UP_MS);
    return () => { window.clearTimeout(show); window.clearTimeout(giveUp); };
  }, [clicked]);

  function open() {
    if (!currentUser) return;
    const href = ROUTES.profile(currentUser.id);
    if (href.split(/[?#]/)[0] !== pathname) setClicked(true);
    router.push(href);
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open your profile"
      aria-busy={loading}
      className="flex items-center gap-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-medium"
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-overlay/15 transition-shadow hover:ring-overlay/40">
        <Avatar userId={currentUser?.id} size={36} />
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-canvas/80 backdrop-blur-[1px]">
            <TickSpinner size={20} label="Opening your profile" />
          </span>
        )}
      </span>
    </button>
  );
}
