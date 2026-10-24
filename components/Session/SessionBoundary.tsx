"use client";

import React, { Fragment } from "react";
import { useActiveUserId } from "@/lib/session/useUserSession";

/**
 * Gives each signed-in user a fresh component tree.
 *
 * Persisted data is already isolated per user (lib/session), but React
 * state is not: the reading engine's current story / phase / answers and
 * every component that cached a storage read in `useState` would
 * otherwise carry the *previous* user's screen across a login switch.
 * Keying a Fragment by the active user id makes React unmount and remount
 * everything below on a switch — so the graphs, streak calendar, pace
 * charts, history and reader state all start clean and re-read the new
 * user's own session. Same user, no remount: normal navigation is
 * unaffected.
 */
export function SessionBoundary({ children }: { children: React.ReactNode }) {
  const userId = useActiveUserId();
  return <Fragment key={userId}>{children}</Fragment>;
}
