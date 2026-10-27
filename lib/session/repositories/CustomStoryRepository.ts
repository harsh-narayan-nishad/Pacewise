import { StoryData } from "@/types";
import { ListRepository } from "@/lib/session/UserScopedRepository";

/**
 * The stories one user uploaded / added. Because it is per-user, "this
 * story is in *my* custom repository" is exactly the ownership rule the
 * edit/delete buttons need — no separate owner field to keep in sync.
 * Built-in stories (data/*.json) are not stored here at all.
 */
export class CustomStoryRepository extends ListRepository<StoryData> {
  protected feature(): string {
    return "customStories";
  }

  has(id: string | undefined): boolean {
    return !!id && this.getAll().some((s) => s.id === id);
  }

  findById(id: string): StoryData | undefined {
    return this.getAll().find((s) => s.id === id);
  }

  /**
   * Ids this user has uploaded, kept apart from the stories themselves. A large PDF
   * (every page is an image) can be bigger than the browser's storage quota, so the
   * story may not fit - but who uploaded it must still be remembered, or it would be
   * credited to someone else. Ids are tiny, so this always fits.
   */
  claimedIds(): string[] {
    try {
      const raw = this.store.getItem(this.claimKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }

  private claimKey(): string {
    return this.namespace.key("customStoryClaims");
  }

  private writeClaims(ids: string[]): void {
    try {
      this.store.setItem(this.claimKey(), JSON.stringify(ids));
    } catch {
      /* storage completely full: nothing more can be done */
    }
  }

  /** Upsert: replaces any story with the same id, then appends. */
  save(story: StoryData): StoryData[] {
    if (story.id && !this.claimedIds().includes(story.id)) this.writeClaims([...this.claimedIds(), story.id]);
    return this.mutate((items) => [...items.filter((s) => s.id !== story.id), story]);
  }

  remove(id: string): StoryData[] {
    this.writeClaims(this.claimedIds().filter((c) => c !== id));
    return this.mutate((items) => items.filter((s) => s.id !== id));
  }

  clear(): void {
    this.store.removeItem(this.claimKey());
    super.clear();
  }
}
