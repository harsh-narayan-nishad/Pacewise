import { ListRepository } from "@/lib/session/UserScopedRepository";

/** One user's bookmarked story titles. */
export class BookmarkRepository extends ListRepository<string> {
  protected feature(): string {
    return "bookmarks";
  }

  has(title: string): boolean {
    return this.getAll().includes(title);
  }

  toggle(title: string): string[] {
    return this.mutate((items) => (items.includes(title) ? items.filter((t) => t !== title) : [...items, title]));
  }
}
