"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dashboard } from "@/components/Dashboard/Dashboard";
import { SearchLanding } from "@/components/Search/SearchLanding";
import { useReadingState, useReadingDispatch } from "@/contexts/ReadingContext";
import { storage } from "@/lib/storage";

export default function DashboardPage() {
  const state = useReadingState();
  const dispatch = useReadingDispatch();
  const router = useRouter();
  const [streak, setStreak] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    setStreak(storage.getStreak().count);
    if (state.story) setBookmarked(storage.getBookmarks().includes(state.story.title));
  }, [state.story]);

  // No story auto-loaded on first visit anymore — the app's entry point
  // is now a dedicated search landing (Google-homepage style, see
  // SearchLanding), not a pre-picked default story. A story only exists
  // in state once the person searches/picks/adds one via SearchBar, which
  // dispatches LOAD_STORY itself.
  if (!state.story) return <SearchLanding />;

  return (
    <Dashboard
      story={state.story}
      selectedWpm={state.selectedWpm}
      streak={streak}
      isBookmarked={bookmarked}
      onSelectWpm={(wpm) => dispatch({ type: "SET_WPM", wpm })}
      onStart={() => {
        // Reading mode was chosen before starting: open the free-scroll article, no practice session.
        if (state.readingMode) {
          router.push("/read");
          return;
        }
        dispatch({ type: "PLAY" });
        router.push("/reader");
      }}
      onToggleBookmark={() => {
        const next = storage.toggleBookmark(state.story!.title);
        setBookmarked(next.includes(state.story!.title));
      }}
    />
  );
}
