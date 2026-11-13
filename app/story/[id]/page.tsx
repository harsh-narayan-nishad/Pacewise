"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StoryPage } from "@/components/Dashboard/StoryPage";
import { Button } from "@/components/ui/button";
import { useReadingDispatch, useReadingState } from "@/contexts/ReadingContext";
import { getStoryById } from "@/lib/storyLibrary";
import { ROUTES } from "@/lib/routes";

/** A story's own URL — shareable and refresh-safe (loads the story by id). */
export default function StoryRoute({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const state = useReadingState();
  const dispatch = useReadingDispatch();
  const router = useRouter();
  const story = useMemo(() => getStoryById(id), [id]);
  const loaded = Boolean(story) && (state.story?.id ?? state.story?.title) === (story?.id ?? story?.title);

  // Load the story once per address. Without this guard, clearing the story (the logo click) made this page
  // load it again, so the first logo click kept you here and only the second reached the landing page.
  const requestedFor = useRef<string | null>(null);
  useEffect(() => {
    // Already loaded by whoever opened this page (e.g. a story card loads it before navigating): remember it, so
    // clearing it with the logo doesn't make this page load it again.
    if (loaded) { requestedFor.current = id; return; }
    if (story && requestedFor.current !== id) {
      requestedFor.current = id;
      dispatch({ type: "LOAD_STORY", story });
    }
  }, [story, loaded, id, dispatch]);

  if (!story) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl tracking-[-0.03em] text-ink">Story not found</h1>
        <p className="mt-3 text-ink-muted">It may have been deleted, or it lives in another account&apos;s library.</p>
        <Button className="mt-6" variant="outline" onClick={() => router.push(ROUTES.home)}>
          <ArrowLeft className="h-4 w-4" /> Back home
        </Button>
      </div>
    );
  }
  return loaded ? <StoryPage /> : null;
}
