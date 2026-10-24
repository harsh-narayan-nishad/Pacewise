"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ReadingModePage } from "@/components/ReadingMode/ReadingModePage";
import { useReadingState } from "@/contexts/ReadingContext";

export default function ReadPage() {
  const state = useReadingState();
  const router = useRouter();
  const story = state.story;
  useEffect(() => {
    if (!story) router.replace("/");
  }, [story, router]);
  if (!story) return null;
  return <ReadingModePage story={story} />;
}
