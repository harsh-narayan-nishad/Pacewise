"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dashboard } from "@/components/Dashboard/Dashboard";
import { useReadingState, useReadingDispatch } from "@/contexts/ReadingContext";
import { storage } from "@/lib/storage";

export function StoryPage() {
  const state = useReadingState();
  const dispatch = useReadingDispatch();
  const router = useRouter();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setStreak(storage.getStreak().count);
  }, [state.story]);

  // The caller (app/page.tsx or app/story/[id]/page.tsx) loads the story first.
  if (!state.story) return null;

  return (
    <Dashboard
      story={state.story}
      selectedWpm={state.selectedWpm}
      streak={streak}
      onQuizOnly={() => {
        // Just the quiz, without reading the story first.
        dispatch({ type: "GO_TO_QUESTIONS", quizQuestionCount: Math.min(5, state.story!.questions.length), quizOnly: true });
        router.push("/questions");
      }}
      onStart={() => {
        // Reading mode was chosen before starting: open the free-scroll article, no practice session.
        if (state.readingMode) {
          router.push("/read");
          return;
        }
        dispatch({ type: "PLAY" });
        router.push("/reader");
      }}
    />
  );
}
