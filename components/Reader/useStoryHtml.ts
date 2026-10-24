"use client";

import React from "react";
import { StoryData } from "@/types";
import { richDocFor } from "@/lib/editor/storyBridge";
import { plainStoryToHtml } from "@/lib/editor/reader/plainStoryHtml";
import { RichDocument } from "@/lib/editor/model/RichDocument";
import { StoryContentRenderer } from "@/lib/editor/reader/StoryContentRenderer";
import { createStoreImageResolver } from "@/lib/editor/reader/imageResolver";
import { sessionManager } from "@/lib/session/composition";
import { createDefaultKeyValueStore } from "@/lib/session/storage/KeyValueStore";

/**
 * Sanitized HTML for a story written in the rich editor (images, tables,
 * code blocks) or containing code; null for plain stories (render `<p>`s).
 * Shared by the auto-scroll Reader and the free-scroll reading mode.
 */
export function useStoryHtml(story: StoryData): string | null {
  return React.useMemo(() => {
    const doc =
      richDocFor(story) ??
      (() => {
        const html = plainStoryToHtml(story.story.map((p) => p.paragraph));
        return html ? RichDocument.fromHtml(html) : null;
      })();
    if (!doc) return null;
    const resolver = createStoreImageResolver(createDefaultKeyValueStore(), sessionManager.active().namespace);
    return new StoryContentRenderer(resolver).render(doc);
  }, [story]);
}
