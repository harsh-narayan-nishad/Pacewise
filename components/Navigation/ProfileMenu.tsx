"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { useCurrentUser } from "@/lib/devData/useDevStore";
import { ROUTES } from "@/lib/routes";
import { formatReadingTotal } from "@/lib/readingPresence";
import { useReadingPresence } from "@/lib/useReadingPresence";

/** Navbar profile button: shows the user's photo and opens their profile page directly. */
export function ProfileMenu() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { totalMs } = useReadingPresence();
  return (
    <button
      type="button"
      onClick={() => currentUser && router.push(ROUTES.profile(currentUser.id))}
      aria-label={`Open your profile — ${formatReadingTotal(totalMs)} read in total`}
      title={`Total reading time: ${formatReadingTotal(totalMs)}`}
      className="flex items-center gap-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-medium"
    >
      <span className="hidden text-xs tabular-nums text-ink-muted sm:inline">{formatReadingTotal(totalMs)}</span>
      <span className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-overlay/15 transition-shadow hover:ring-overlay/40">
        <Avatar userId={currentUser?.id} size={36} />
      </span>
    </button>
  );
}
