"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeDashboard } from "@/components/Dashboard/HomeDashboard";
import { useReadingState } from "@/contexts/ReadingContext";

/**
 * Reachable from the profile menu on every page, including the search
 * landing (where no story is loaded, so "/" can only show the search box).
 * With a story open it is that story's dashboard ("/"); otherwise it is the
 * personal dashboard: streak, totals, recent sessions, saved stories.
 */
export default function DashboardRoute() {
  const state = useReadingState();
  const router = useRouter();
  const hasStory = Boolean(state.story);

  useEffect(() => {
    if (hasStory) router.replace("/");
  }, [hasStory, router]);

  if (hasStory) return null;
  return <HomeDashboard />;
}
