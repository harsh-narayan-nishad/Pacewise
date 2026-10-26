import { deleteThumbnailVideo } from "@/lib/thumbnailVideo";
import { StoryData } from "@/types";
import { loadStory, normalizeStory } from "@/lib/stories";
import { storage } from "@/lib/storage";
import { sessionManager } from "@/lib/session/composition";
import story001Json from "@/data/stories.json";
import story002Json from "@/data/story-002-example.json";

/**
 * Facade over "every story the app knows about."
 *
 * Before this feature the app only ever loaded one hardcoded story
 * (data/stories.json) directly in app/page.tsx. The navbar search needs a
 * real collection to search over, so this module is the single place that
 * assembles it: the JSON files bundled under /data (built-in stories,
 * still added with zero code changes per lib/stories.ts's existing
 * contract) plus whatever the user has added at runtime via the "Add
 * story" flow (persisted through the Repository in lib/storage.ts).
 *
 * Nothing else should import the /data JSON files or
 * storage.getCustomStories() directly — every caller that wants "the
 * stories a user can pick from" goes through getAllStories()/searchStories()
 * here, exactly the way lib/storage.ts centralizes localStorage access.
 */

const BUILT_IN_RAW: unknown[] = [story001Json, story002Json];

let builtInCache: StoryData[] | null = null;

function builtInStories(): StoryData[] {
  if (!builtInCache) {
    builtInCache = BUILT_IN_RAW.map((raw) => loadStory(raw));
  }
  return builtInCache;
}

function storyId(story: StoryData, index: number): string {
  return story.id ?? `story-${index}`;
}

/** Built-ins + custom stories, de-duplicated by id (a custom story can
 *  intentionally shadow a built-in by reusing its id, e.g. re-saving an
 *  edited copy). */
export function getAllStories(): StoryData[] {
  const builtIns = builtInStories();
  const custom = storage.getCustomStories();
  const customIds = new Set(custom.map((s, i) => storyId(s, i)));
  const survivingBuiltIns = builtIns.filter((s, i) => !customIds.has(storyId(s, i)));
  return [...survivingBuiltIns, ...custom];
}

/** Validates + normalizes a user-submitted story (object or JSON text),
 *  assigns it a stable id if it doesn't already have one, and persists it.
 *  Throws StoryValidationError on malformed input — callers should catch
 *  this and show the `issues` list to the user rather than swallowing it,
 *  since this is the one place "add your own story" input is user-typed
 *  rather than pre-authored JSON. */
export function addCustomStory(raw: unknown): StoryData {
  const story = loadStory(raw);
  const withId: StoryData = story.id ? story : { ...story, id: `custom-${Date.now()}` };
  storage.saveCustomStory(withId);
  return withId;
}

export function removeCustomStory(id: string): void {
  void deleteThumbnailVideo(storage.getCustomStories().find((s) => s.id === id)?.thumbnailVideo);
  storage.removeCustomStory(id);
}

/** Wipes every story this browser has uploaded/added — the "clear all
 *  uploaded stories" action (see HamburgerMenu.tsx). Built-in stories
 *  (data/stories.json etc.) are untouched; only localStorage-backed
 *  custom ones are. */
export function clearCustomStories(): void {
  storage.getCustomStories().forEach((s) => void deleteThumbnailVideo(s.thumbnailVideo));
  storage.clearCustomStories();
}

/** Ownership check: true only if the story is in the *active user's own*
 *  uploads (each user has a separate custom-story library — see
 *  lib/session). Drives the owner-only edit/delete buttons. */
export function isCustomStory(id: string | undefined): boolean {
  if (!id) return false;
  return storage.getCustomStories().some((s) => s.id === id);
}

/** Resolve one story by id: built-ins + the active user's uploads first,
 *  then (read-only) any other user's upload. The fallback is what lets a
 *  story someone *shared* open for its recipient — a notification only
 *  carries the content id — without making other users' uploads show up
 *  in this user's library, search or feed (those use getAllStories()). */
export function getStoryById(id: string): StoryData | undefined {
  const own = getAllStories().find((s, i) => storyId(s, i) === id || (s.id ?? s.title) === id);
  return own ?? sessionManager.findCustomStoryAnywhere(id);
}

/** Plain substring relevance match across title/description/tags/level —
 *  deliberately simple (no fuzzy matching/ranking library) since the
 *  library is small and local; the Google-style suggestion list on top of
 *  this is about instant feedback while typing, not search quality. */
export function searchStories(query: string, pool: StoryData[] = getAllStories()): StoryData[] {
  const q = query.trim().toLowerCase();
  if (!q) return pool;
  return pool.filter((s) => {
    const haystack = [s.title, s.description ?? "", s.level, s.difficulty ?? "", ...(s.tags ?? [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export { normalizeStory };
