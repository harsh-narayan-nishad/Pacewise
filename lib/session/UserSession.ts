import { KeyValueStore } from "@/lib/session/storage/KeyValueStore";
import { UserNamespace } from "@/lib/session/UserNamespace";
import { UserScopedRepository } from "@/lib/session/UserScopedRepository";
import { LifetimeStatsCalculator } from "@/lib/session/analytics/LifetimeStatsCalculator";
import { LifetimeStats } from "@/lib/session/types";
import { HistoryRepository } from "@/lib/session/repositories/HistoryRepository";
import { StreakRepository } from "@/lib/session/repositories/StreakRepository";
import { DailyActivityRepository } from "@/lib/session/repositories/DailyActivityRepository";
import { BookmarkRepository } from "@/lib/session/repositories/BookmarkRepository";
import { AchievementRepository } from "@/lib/session/repositories/AchievementRepository";
import { CustomStoryRepository } from "@/lib/session/repositories/CustomStoryRepository";
import { SearchHistoryRepository } from "@/lib/session/repositories/SearchHistoryRepository";
import { DocTimeRepository } from "@/lib/session/repositories/DocTimeRepository";
import { TimeLogRepository } from "@/lib/session/repositories/TimeLogRepository";
import { TimeSummaryCalculator } from "@/lib/session/analytics/TimeSummaryCalculator";
import { TimeSummary } from "@/lib/session/types";

/**
 * AGGREGATE ROOT + FACADE + COMPOSITION.
 *
 * One `UserSession` is everything that belongs to one signed-in user:
 * reading history and quiz attempts, the daily-activity series behind the
 * calendar / pace graphs / efficiency trends, streaks, bookmarks,
 * achievements, uploaded stories and search history. It *composes* one
 * repository per feature, all constructed from the same namespace, so the
 * whole bundle is bound to a single user at construction time and cannot
 * be re-pointed at someone else afterwards (`readonly` fields, no setters).
 *
 * Consumers hold "the session", not a bag of loose keys; switching user
 * means switching which `UserSession` is active (see SessionManager).
 */
export class UserSession {
  readonly history: HistoryRepository;
  readonly streak: StreakRepository;
  readonly daily: DailyActivityRepository;
  readonly bookmarks: BookmarkRepository;
  readonly achievements: AchievementRepository;
  readonly customStories: CustomStoryRepository;
  readonly searchHistory: SearchHistoryRepository;
  /** Time spent reading and testing, per story and per page (the profile's time analysis). */
  readonly timeLog: TimeLogRepository;
  /** Time spent reading documentation pages. */
  readonly docTime: DocTimeRepository;

  /** Every repository, viewed through their shared abstract type — lets
   *  `clearAllData` treat them uniformly (polymorphism). */
  private readonly repositories: ReadonlyArray<UserScopedRepository<unknown>>;

  constructor(
    readonly namespace: UserNamespace,
    store: KeyValueStore,
    private readonly stats: LifetimeStatsCalculator = new LifetimeStatsCalculator(),
    private readonly timeStats: TimeSummaryCalculator = new TimeSummaryCalculator()
  ) {
    this.history = new HistoryRepository(store, namespace);
    this.streak = new StreakRepository(store, namespace);
    this.daily = new DailyActivityRepository(store, namespace);
    this.bookmarks = new BookmarkRepository(store, namespace);
    this.achievements = new AchievementRepository(store, namespace);
    this.customStories = new CustomStoryRepository(store, namespace);
    this.searchHistory = new SearchHistoryRepository(store, namespace);
    this.timeLog = new TimeLogRepository(store, namespace);
    this.docTime = new DocTimeRepository(store, namespace);
    this.repositories = [
      this.history,
      this.streak,
      this.daily,
      this.bookmarks,
      this.achievements,
      this.customStories,
      this.searchHistory,
      this.timeLog,
      this.docTime,
    ] as ReadonlyArray<UserScopedRepository<unknown>>;
  }

  get userId(): string {
    return this.namespace.userId;
  }

  /** The one aggregator the dashboard stats and the calendar header both
   *  call, so the same history can't produce two different totals. */
  lifetimeStats(now: Date = new Date()): LifetimeStats {
    return this.stats.compute(this.daily.getAll(), now);
  }

  /** Totals over the whole time log (reading, testing, both). */
  timeSummary(): TimeSummary {
    return this.timeStats.compute(this.timeLog.getAll(), this.docTime.getAll());
  }

  /** Wipes every feature's data for *this user only*. */
  clearAllData(): void {
    this.repositories.forEach((repo) => repo.clear());
  }
}
