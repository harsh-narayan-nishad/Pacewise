"use client";

import React from "react";
import { StoryPage } from "@/components/Dashboard/StoryPage";
import { SearchLanding } from "@/components/Search/SearchLanding";
import { useReadingState } from "@/contexts/ReadingContext";

export default function HomePage() {
  const state = useReadingState();
  // The entry point is the search landing; a story page shows once one is loaded
  // (also reachable directly at /story/[id]).
  return state.story ? <StoryPage /> : <SearchLanding />;
}
