/**
 * Per-user session isolation tests. Runs with plain Node — no browser, no
 * framework — because the session layer depends only on interfaces:
 *
 *     npx tsx scripts/session-isolation.test.ts
 *
 * A MemoryKeyValueStore stands in for localStorage and FakeIdentity for the
 * dev login (the same substitutability the OOP design is built around).
 */
import assert from "node:assert/strict";
import { MemoryKeyValueStore } from "../lib/session/storage/KeyValueStore";
import { UserNamespace } from "../lib/session/UserNamespace";
import { UserSession } from "../lib/session/UserSession";
import { SessionManager } from "../lib/session/SessionManager";
import { LegacyDataMigrator } from "../lib/session/LegacyDataMigrator";
import { LifetimeStatsCalculator } from "../lib/session/analytics/LifetimeStatsCalculator";
import { IdentityProvider } from "../lib/session/identity/IdentityProvider";
import { ScopedTokenStore } from "../lib/api/ScopedTokenStore";
import { ReadingHistoryEntry, StoryData } from "../types";

class FakeIdentity implements IdentityProvider {
  private id: string | null = null;
  private readonly listeners = new Set<() => void>();
  currentUserId() {
    return this.id;
  }
  subscribe(l: () => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  signIn(id: string | null) {
    this.id = id;
    this.listeners.forEach((l) => l());
  }
  /** Fires listeners without changing the user (like a dev-store like/comment). */
  noise() {
    this.listeners.forEach((l) => l());
  }
}

const story = (id: string): StoryData => ({
  id,
  title: `Story ${id}`,
  level: "Beginner",
  estimatedReadingTime: 1,
  story: [{ paragraph: "hello world" }],
  questions: [],
});

const entry = (id: string, accuracy = 80): ReadingHistoryEntry => ({
  id,
  title: `T-${id}`,
  date: new Date().toISOString(),
  wpm: 250,
  accuracy,
  wordCount: 100,
  totalQuestions: 5,
  correctAnswers: 4,
  avgTimePerQuestionMs: 4000,
});

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}\n`, err);
    process.exitCode = 1;
  }
}

function sessions() {
  const store = new MemoryKeyValueStore();
  const a = new UserSession(UserNamespace.forUser("user-a"), store);
  const b = new UserSession(UserNamespace.forUser("user-b"), store);
  return { store, a, b };
}

console.log("Per-user session isolation");

test("history + quiz attempts + stats never cross users", () => {
  const { a, b } = sessions();
  a.history.add(entry("1", 90));
  a.history.add(entry("2", 70));
  b.history.add(entry("9", 40));
  assert.equal(a.history.getAll().length, 2);
  assert.equal(b.history.getAll().length, 1);
  assert.equal(a.history.quizStats().avgAccuracy, 80);
  assert.equal(b.history.quizStats().avgAccuracy, 40);
});

test("history update patches in place (no duplicate row)", () => {
  const { a } = sessions();
  a.history.add({ ...entry("1"), totalQuestions: undefined, accuracy: 0 });
  a.history.update("1", { accuracy: 100, totalQuestions: 5 });
  assert.equal(a.history.getAll().length, 1);
  assert.equal(a.history.quizAttempts().length, 1);
});

test("daily activity (calendar / pace / efficiency graphs) is per user", () => {
  const { a, b } = sessions();
  a.daily.recordSession({ minutes: 10, wpm: 300, completed: true, breakMs: 5000, breakCount: 1, effectiveWpm: 280, reductionPercent: 6 });
  a.daily.recordSession({ minutes: 5, wpm: 200, completed: false });
  b.daily.recordSession({ minutes: 1, wpm: 100, completed: true });
  const dayA = Object.values(a.daily.getAll())[0];
  assert.equal(dayA.minutes, 15);
  assert.equal(dayA.sessions, 2);
  assert.equal(dayA.storiesCompletedCount, 1);
  assert.equal(dayA.breakMs, 5000);
  assert.equal(Object.values(b.daily.getAll())[0].minutes, 1);
  assert.equal(a.daily.todayBreakMs(), 5000);
  assert.equal(b.daily.todayBreakMs(), 0);
});

test("streak counter is per user and obeys same-day / next-day / gap rules", () => {
  const { a, b } = sessions();
  const d = (s: string) => new Date(`${s}T12:00:00`);
  assert.equal(a.streak.bump(d("2026-01-01")), 1);
  assert.equal(a.streak.bump(d("2026-01-01")), 1); // same day
  assert.equal(a.streak.bump(d("2026-01-02")), 2); // next day
  assert.equal(a.streak.bump(d("2026-01-05")), 1); // gap resets
  assert.equal(b.streak.get().count, 0);
});

test("lifetime stats: streaks computed from the user's own days", () => {
  const { a, b } = sessions();
  const day = (s: string) => new Date(`${s}T12:00:00`);
  a.daily.recordSession({ minutes: 1, wpm: 1, completed: true }, day("2026-03-01"));
  a.daily.recordSession({ minutes: 1, wpm: 1, completed: true }, day("2026-03-02"));
  a.daily.recordSession({ minutes: 1, wpm: 1, completed: true }, day("2026-03-03"));
  a.daily.recordSession({ minutes: 1, wpm: 1, completed: true }, day("2026-03-10"));
  const now = day("2026-03-10");
  const stats = a.lifetimeStats(now);
  assert.equal(stats.longestStreak, 3);
  assert.equal(stats.currentStreak, 1);
  assert.equal(stats.totalActiveDays, 4);
  assert.equal(b.lifetimeStats(now).totalActiveDays, 0);
  assert.equal(b.lifetimeStats(now).readingEfficiency, 100);
  // grace: today inactive but yesterday active still counts
  assert.equal(new LifetimeStatsCalculator().compute(a.daily.getAll(), day("2026-03-04")).currentStreak, 3);
});

test("bookmarks, achievements, search history, uploads are per user", () => {
  const { a, b } = sessions();
  a.bookmarks.toggle("X");
  a.achievements.unlock("first");
  a.achievements.unlock("first");
  a.searchHistory.add("apple");
  a.searchHistory.add("APPLE");
  a.customStories.save(story("c1"));
  assert.deepEqual(a.bookmarks.getAll(), ["X"]);
  assert.deepEqual(a.achievements.getAll(), ["first"]);
  assert.equal(a.searchHistory.getAll().length, 1);
  assert.equal(a.customStories.has("c1"), true);
  assert.deepEqual(b.bookmarks.getAll(), []);
  assert.deepEqual(b.achievements.getAll(), []);
  assert.deepEqual(b.searchHistory.getAll(), []);
  assert.equal(b.customStories.has("c1"), false);
  a.bookmarks.toggle("X");
  assert.deepEqual(a.bookmarks.getAll(), []);
});

test("caps: history 50, search history 30", () => {
  const { a } = sessions();
  for (let i = 0; i < 60; i += 1) a.history.add(entry(String(i)));
  for (let i = 0; i < 40; i += 1) a.searchHistory.add(`q${i}`);
  assert.equal(a.history.getAll().length, 50);
  assert.equal(a.history.getAll()[0].id, "59");
  assert.equal(a.searchHistory.getAll().length, 30);
});

test("clearAllData / clear wipes only that user", () => {
  const { a, b } = sessions();
  a.bookmarks.toggle("X");
  b.bookmarks.toggle("Y");
  a.customStories.save(story("c1"));
  b.customStories.save(story("c2"));
  a.customStories.clear();
  assert.equal(a.customStories.getAll().length, 0);
  assert.equal(b.customStories.getAll().length, 1);
  a.clearAllData();
  assert.deepEqual(a.bookmarks.getAll(), []);
  assert.deepEqual(b.bookmarks.getAll(), ["Y"]);
});

test("old string[] search history is upgraded; corrupt JSON degrades to empty", () => {
  const store = new MemoryKeyValueStore();
  const ns = UserNamespace.forUser("u");
  store.setItem(ns.key("searchHistory"), JSON.stringify(["alpha", "beta"]));
  store.setItem(ns.key("history"), "{not json");
  store.setItem(ns.key("daily"), JSON.stringify([1, 2]));
  const s = new UserSession(ns, store);
  assert.deepEqual(s.searchHistory.getAll().map((e) => e.term), ["alpha", "beta"]);
  assert.equal(typeof s.searchHistory.getAll()[0].date, "string");
  assert.deepEqual(s.history.getAll(), []);
  assert.deepEqual(s.daily.getAll(), {});
});

test("namespace keys cannot collide and round-trip, even with odd ids", () => {
  const odd = UserNamespace.forUser("we:ird/id %");
  const parsed = UserNamespace.parse(odd.key("history"));
  assert.deepEqual(parsed, { userId: "we:ird/id %", feature: "history" });
  assert.equal(UserNamespace.forUser("a").owns(UserNamespace.forUser("ab").key("x")), false);
  assert.equal(UserNamespace.forUser("  ").isGuest, true);
  assert.equal(UserNamespace.forUser(null).userId, "guest");
  assert.equal(UserNamespace.parse("srt:history"), null);
});

console.log("SessionManager + identity");

test("switching user switches session; same user returns the same cached object", () => {
  const store = new MemoryKeyValueStore();
  const id = new FakeIdentity();
  const mgr = new SessionManager(store, id);
  assert.equal(mgr.activeUserId(), "guest");
  id.signIn("u1");
  const s1 = mgr.active();
  s1.bookmarks.toggle("one");
  id.signIn("u2");
  assert.deepEqual(mgr.active().bookmarks.getAll(), []);
  id.signIn("u1");
  assert.equal(mgr.active(), s1);
  assert.deepEqual(mgr.active().bookmarks.getAll(), ["one"]);
});

test("version bumps only on a real user change, not on unrelated store noise", () => {
  const id = new FakeIdentity();
  const mgr = new SessionManager(new MemoryKeyValueStore(), id);
  let notified = 0;
  mgr.subscribe(() => (notified += 1));
  const v0 = mgr.getVersion();
  id.noise();
  id.noise();
  assert.equal(mgr.getVersion(), v0);
  assert.equal(notified, 0);
  id.signIn("u1");
  assert.equal(mgr.getVersion(), v0 + 1);
  id.noise();
  assert.equal(mgr.getVersion(), v0 + 1);
  id.signIn(null);
  assert.equal(mgr.getVersion(), v0 + 2);
  assert.equal(notified, 2);
});

test("data survives sign-out / sign-in for the same user", () => {
  const store = new MemoryKeyValueStore();
  const id = new FakeIdentity();
  const mgr = new SessionManager(store, id);
  id.signIn("u1");
  mgr.active().history.add(entry("h1"));
  id.signIn(null);
  // a brand new manager over the same store = a page reload
  const mgr2 = new SessionManager(store, id);
  id.signIn("u1");
  assert.equal(mgr2.active().history.getAll().length, 1);
});

test("shared stories resolve read-only across users; ownership stays per user", () => {
  const id = new FakeIdentity();
  const mgr = new SessionManager(new MemoryKeyValueStore(), id);
  id.signIn("author");
  mgr.active().customStories.save(story("shared-1"));
  id.signIn("reader");
  assert.equal(mgr.active().customStories.has("shared-1"), false); // not mine
  assert.equal(mgr.findCustomStoryAnywhere("shared-1")?.id, "shared-1"); // but openable
  assert.equal(mgr.findCustomStoryAnywhere("nope"), undefined);
  assert.equal(mgr.active().customStories.getAll().length, 0); // library unchanged
});

console.log("Legacy data migration");

function seedLegacy(store: MemoryKeyValueStore) {
  store.setItem("srt:history", JSON.stringify([entry("old")]));
  store.setItem("srt:streak", "4");
  store.setItem("srt:lastReadDate", JSON.stringify("Thu Jan 01 2026"));
  store.setItem("srt:bookmarks", JSON.stringify(["Old Book"]));
  store.setItem("srt:customStories", JSON.stringify([story("legacy-c")]));
}

test("first real user claims legacy data once; second user starts empty", () => {
  const store = new MemoryKeyValueStore();
  seedLegacy(store);
  const id = new FakeIdentity();
  const mgr = new SessionManager(store, id);
  id.signIn("first");
  const first = mgr.active();
  assert.equal(first.history.getAll()[0].id, "old");
  assert.deepEqual(first.bookmarks.getAll(), ["Old Book"]);
  assert.equal(first.customStories.has("legacy-c"), true);
  assert.deepEqual(first.streak.get(), { count: 4, lastReadDate: "Thu Jan 01 2026" });
  assert.equal(store.getItem("srt:history"), null);
  assert.equal(store.getItem(LegacyDataMigrator.CLAIM_FLAG), "first");
  id.signIn("second");
  assert.deepEqual(mgr.active().history.getAll(), []);
  assert.deepEqual(mgr.active().bookmarks.getAll(), []);
});

test("guest never claims legacy data", () => {
  const store = new MemoryKeyValueStore();
  seedLegacy(store);
  const id = new FakeIdentity();
  const mgr = new SessionManager(store, id);
  assert.deepEqual(mgr.active().history.getAll(), []); // guest session
  assert.notEqual(store.getItem("srt:history"), null); // still there
  id.signIn("real");
  assert.equal(mgr.active().history.getAll().length, 1);
});

test("migration never overwrites data a user already has", () => {
  const store = new MemoryKeyValueStore();
  seedLegacy(store);
  const ns = UserNamespace.forUser("u");
  store.setItem(ns.key("bookmarks"), JSON.stringify(["Mine"]));
  new LegacyDataMigrator(store).claimFor(ns);
  assert.deepEqual(new UserSession(ns, store).bookmarks.getAll(), ["Mine"]);
});

console.log("Backend token scoping");

function tokens() {
  const store = new MemoryKeyValueStore();
  let active = "guest";
  const ts = new ScopedTokenStore(store, () => active);
  return { store, ts, as: (id: string) => (active = id) };
}

test("each user has their own backend tokens; logout clears only theirs", () => {
  const { ts, as } = tokens();
  as("a");
  ts.setTokens("A-access", "A-refresh");
  as("b");
  assert.equal(ts.getAccessToken(), null);
  ts.setTokens("B-access", "B-refresh");
  assert.equal(ts.getRefreshToken(), "B-refresh");
  ts.clear();
  assert.equal(ts.getAccessToken(), null);
  as("a");
  assert.equal(ts.getAccessToken(), "A-access");
  assert.equal(ts.getRefreshToken(), "A-refresh");
});

test("backend login made at the login screen (guest) is adopted by exactly one user", () => {
  const { ts, as } = tokens();
  as("guest");
  ts.setTokens("G-access", "G-refresh");
  as("first");
  assert.equal(ts.getAccessToken(), "G-access");
  assert.equal(ts.getRefreshToken(), "G-refresh");
  as("second");
  assert.equal(ts.getAccessToken(), null); // moved, not copied
  as("guest");
  assert.equal(ts.getAccessToken(), null);
});

test("pre-session browser-wide tokens are adopted by the first real user only", () => {
  const { store, ts, as } = tokens();
  store.setItem("speed-reader:api:accessToken", "old-access");
  store.setItem("speed-reader:api:refreshToken", "old-refresh");
  as("guest");
  assert.equal(ts.getAccessToken(), null); // guest never adopts
  as("u1");
  assert.equal(ts.getAccessToken(), "old-access");
  assert.equal(store.getItem("speed-reader:api:accessToken"), null);
  as("u2");
  assert.equal(ts.getAccessToken(), null);
});

test("a user's own tokens are never replaced by adoption", () => {
  const { ts, as } = tokens();
  as("u1");
  ts.setTokens("mine", "mine-r");
  as("guest");
  ts.setTokens("g", "g-r");
  as("u1");
  assert.equal(ts.getAccessToken(), "mine");
});

test("an uploaded story's owner is whoever's library holds it", () => {
  const store = new MemoryKeyValueStore();
  const id = new FakeIdentity();
  const mgr = new SessionManager(store, id);
  id.signIn("user-a");
  mgr.active().customStories.save(story("custom-1"));
  id.signIn("user-b");
  assert.equal(mgr.findCustomStoryOwner("custom-1"), "user-a");
  mgr.active().customStories.save(story("custom-2"));
  assert.equal(mgr.findCustomStoryOwner("custom-2"), "user-b");
  assert.equal(mgr.findCustomStoryOwner("story-001"), undefined);
});

test("a PDF too big for storage is still credited to the person who uploaded it", () => {
  class TinyQuotaStore extends MemoryKeyValueStore {
    setItem(key: string, value: string): void {
      if (key.includes("customStories") && value.length > 500) throw new Error("QuotaExceededError");
      super.setItem(key, value);
    }
  }
  const store = new TinyQuotaStore();
  const id = new FakeIdentity();
  const mgr = new SessionManager(store, id);
  id.signIn("user-a");
  const big: StoryData = { ...story("media-1"), description: "x".repeat(2000) };
  mgr.active().customStories.save(big);
  assert.equal(mgr.active().customStories.findById("media-1"), undefined); // did not fit
  id.signIn("user-b");
  assert.equal(mgr.findCustomStoryOwner("media-1"), "user-a"); // ...but the owner is remembered
  mgr.active().customStories.remove("media-1"); // someone else's remove must not erase the claim
  assert.equal(mgr.findCustomStoryOwner("media-1"), "user-a");
});

console.log(`\n${passed} tests passed${process.exitCode ? " (with failures)" : ""}`);
