"use client";

import React from "react";
import { useNavLoader } from "@/contexts/NavLoaderContext";
import { Avatar } from "@/components/ui/Avatar";
import { useCurrentUser } from "@/lib/devData/useDevStore";
import { ROUTES } from "@/lib/routes";

/** Navbar profile button: shows the user's photo and opens their profile page directly. */
export function ProfileMenu() {
  const nav = useNavLoader();
  const currentUser = useCurrentUser();
  return (
    <button
      type="button"
      onClick={() => currentUser && nav.push(ROUTES.profile(currentUser.id))}
      aria-label="Open your profile"
      className="flex items-center gap-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-medium"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-overlay/15 transition-shadow hover:ring-overlay/40">
        <Avatar userId={currentUser?.id} size={36} />
      </span>
    </button>
  );
}
