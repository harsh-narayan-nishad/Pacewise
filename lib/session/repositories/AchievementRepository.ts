import { ListRepository } from "@/lib/session/UserScopedRepository";

/** One user's unlocked achievement ids. Unlocking is idempotent. */
export class AchievementRepository extends ListRepository<string> {
  protected feature(): string {
    return "achievements";
  }

  unlock(id: string): string[] {
    const current = this.getAll();
    if (current.includes(id)) return current;
    return this.mutate((items) => [...items, id]);
  }
}
