"use client";

import React from "react";
import { useReadingPresence } from "@/lib/useReadingPresence";

/** "● Reading" — shown beside the navbar clock only while the heartbeat says you are actively reading. */
export function ReadingStatus() {
  const { status } = useReadingPresence();
  if (status !== "reading") return null;
  return (
    <span role="status" className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-accent-medium" title="You're reading right now">
      <span aria-hidden className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-medium opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-medium" />
      </span>
      Reading
    </span>
  );
}
