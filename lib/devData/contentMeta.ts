import { StoryData } from "@/types";
import { SEED_USERS } from "@/lib/devData/seedUsers";

/**
 * Development-only bridge between "content" (StoryData, from the existing
 * lib/storyLibrary.ts facade — untouched by this feature) and "dev users"
 * (lib/devData). The real content model has no author-as-a-user concept
 * (StoryData.author is a free-text byline string), and adding a real
 * `authorUserId` foreign key belongs on a production content model, not
 * bolted onto the bundled JSON story files. For this development phase,
 * every content item is instead *assigned* a stable posting dev user here
 * — deterministically, so the same story always resolves to the same
 * "posted by" user across reloads — which is enough to drive profile
 * pages ("content posted by this user") and interest-based feed ranking
 * without touching StoryData/lib/storyLibrary.ts at all.
 */

// Explicit mapping for the two bundled stories, so the demo has a
// recognizable "Dinesh posted this" / "Harsh posted this" story each.
const EXPLICIT_AUTHORS: Record<string, string> = {
  "story-001": "user-001",
  "story-002": "user-002",
};

/** Stable, order-independent hash of a content id into a dev user index —
 *  any custom/user-added story (no entry in EXPLICIT_AUTHORS) still
 *  resolves to the same author on every call, without needing a lookup
 *  table maintained by hand for ids nobody has created yet. */
/** Size of the original seed set (accounts 001–020). */
const AUTHOR_POOL_SIZE = 20;

function hashToIndex(id: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
}

/** Looks up which user uploaded a custom story. Registered by the composition
 *  root (lib/session/composition.ts) so this module never imports the session
 *  layer, which itself depends on the dev store that imports this file. */
type OwnerResolver = (contentId: string) => string | undefined;
let customStoryOwnerResolver: OwnerResolver = () => undefined;

export function registerCustomStoryOwnerResolver(resolver: OwnerResolver): void {
  customStoryOwnerResolver = resolver;
}

export function getContentAuthorId(contentId: string): string {
  // An uploaded story always belongs to the person whose library holds it.
  const uploader = customStoryOwnerResolver(contentId);
  if (uploader) return uploader;
  if (EXPLICIT_AUTHORS[contentId]) return EXPLICIT_AUTHORS[contentId];
  // Authors come from the original 20 accounts only, so adding more demo
  // accounts never re-assigns who "wrote" existing content.
  return SEED_USERS[hashToIndex(contentId, AUTHOR_POOL_SIZE)].id;
}

/** Topic tags used for interest matching — prefers the story's own
 *  `tags`, falls back to its `level`/`difficulty` string so even an
 *  untagged story (see data/story-002-example.json, which has no `tags`
 *  field) still has at least one matchable topic. */
export function getContentTopics(story: StoryData): string[] {
  const topics = new Set<string>();
  (story.tags ?? []).forEach((t) => topics.add(t.toLowerCase()));
  if (story.difficulty) topics.add(story.difficulty.toLowerCase());
  if (story.level) topics.add(story.level.toLowerCase());
  return Array.from(topics);
}

export function stableContentId(story: StoryData, fallbackIndex: number): string {
  return story.id ?? `story-${fallbackIndex}`;
}

/** Pure interest-ranking function, shared by every feed that needs to
 *  order content for a specific person (see `components/Feed/
 *  PersonalizedFeed.tsx`, the generic per-user feed component, and
 *  `ContentFeed.tsx`, the landing page's instance of it). Stories whose
 *  topics overlap `interests` sort first, by overlap count; everything
 *  else keeps its original relative order (a stable sort, and ties —
 *  including "zero matches" — never get shuffled). An empty `interests`
 *  list returns `stories` unchanged, so a user with no stated interests
 *  still sees the full, unfiltered catalog rather than an empty feed. */
export function rankStoriesByInterest(stories: StoryData[], interests: string[]): StoryData[] {
  const wanted = new Set(interests.map((i) => i.toLowerCase()));
  if (wanted.size === 0) return stories;

  const scored = stories.map((story, originalIndex) => {
    const topics = getContentTopics(story);
    const matchCount = topics.filter((t) => wanted.has(t)).length;
    return { story, matchCount, originalIndex };
  });
  scored.sort((a, b) => b.matchCount - a.matchCount);
  return scored.map((s) => s.story);
}
