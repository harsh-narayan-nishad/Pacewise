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

  /** Upsert: replaces any story with the same id, then appends. */
  save(story: StoryData): StoryData[] {
    return this.mutate((items) => [...items.filter((s) => s.id !== story.id), story]);
  }

  remove(id: string): StoryData[] {
    return this.mutate((items) => items.filter((s) => s.id !== id));
  }
}
