/**
 * Time-analysis tests (plain Node, no browser):  npx tsx scripts/timelog.test.ts
 * Covers the page tracker, the immutable record, the per-user repository and the overtime clock.
 */
import assert from "node:assert/strict";
import { MemoryKeyValueStore } from "../lib/session/storage/KeyValueStore";
import { UserNamespace } from "../lib/session/UserNamespace";
import { UserSession } from "../lib/session/UserSession";
import { PageDwellTracker, pageIndexAt, paginate } from "../lib/readingMode/PageDwellTracker";
import { clockFace } from "../lib/readingMode/progress";
import { StoryTimeRecord } from "../lib/session/analytics/StoryTimeRecord";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

test("paginate opens a new page after enough words", () => {
  const blocks = [100, 100, 100, 100, 100].map((words, i) => ({ top: i * 300, words }));
  assert.deepEqual(paginate(blocks, 250), [0, 900]);
  assert.deepEqual(paginate([], 250), []);
});

test("pageIndexAt finds the page under a position", () => {
  const starts = [0, 900, 1800];
  assert.equal(pageIndexAt(-50, starts), 0);
  assert.equal(pageIndexAt(899, starts), 0);
  assert.equal(pageIndexAt(900, starts), 1);
  assert.equal(pageIndexAt(99999, starts), 2);
  assert.equal(pageIndexAt(10, []), 0);
});

test("the tracker adds time per page and ignores bad input", () => {
  const t = new PageDwellTracker();
  t.tick(0, 1000);
  t.tick(2, 2500);
  t.tick(0, 500);
  t.tick(1, -5);
  t.tick(1, NaN);
  assert.deepEqual(t.snapshot(), [1500, 0, 2500]);
  assert.equal(t.totalMs(), 4000);
  t.reset();
  assert.deepEqual(t.snapshot(), []);
});

test("a record is immutable and merges page times across sessions", () => {
  const a = StoryTimeRecord.empty("s1", "Story");
  const b = a.withReading(60_000, [10_000, 50_000]);
  const c = b.withReading(30_000, [5_000, 5_000, 20_000]).withTest(45_000);
  assert.equal(a.readingMs, 0);
  assert.equal(b.readingMs, 60_000);
  assert.deepEqual([...c.pages], [15_000, 55_000, 20_000]);
  assert.equal(c.readingMs, 90_000);
  assert.equal(c.testMs, 45_000);
  assert.equal(c.totalMs, 135_000);
  assert.equal(c.readingSessions, 2);
  assert.equal(c.slowestPage(), 1);
});

test("stored junk is rejected or repaired, never thrown", () => {
  assert.equal(StoryTimeRecord.from(null), null);
  assert.equal(StoryTimeRecord.from({ title: "x" }), null);
  const r = StoryTimeRecord.from({ storyId: "a", title: "A", readingMs: "oops", pages: [1, "x", 3] });
  assert.equal(r?.readingMs, 0);
  assert.deepEqual([...(r?.pages ?? [])], [1, 0, 3]);
});

test("the time log keeps each user's data apart and drops tiny visits", () => {
  const store = new MemoryKeyValueStore();
  const alice = new UserSession(UserNamespace.forUser("alice"), store);
  const bob = new UserSession(UserNamespace.forUser("bob"), store);
  alice.timeLog.recordReading("s1", "Story one", 120_000, [60_000, 60_000]);
  alice.timeLog.recordReading("s1", "Story one", 500, []);
  alice.timeLog.recordTest("s1", "Story one", 30_000);
  alice.timeLog.recordReading("s2", "Story two", 10_000);
  assert.equal(alice.timeLog.find("s1")?.readingSessions, 1);
  assert.deepEqual(alice.timeSummary(), { totalMs: 160_000, readingMs: 130_000, testMs: 30_000, storyCount: 2, readingSessions: 2, testSessions: 1, docMs: 0, docCount: 0 });
  assert.equal(bob.timeLog.getAll().length, 0);
  alice.clearAllData();
  assert.equal(alice.timeLog.getAll().length, 0);
});

test("documentation time is kept per page and added to the total", () => {
  const session = new UserSession(UserNamespace.forUser("carol"), new MemoryKeyValueStore());
  session.docTime.record("syllabus--readme", "Overview", 40_000, true);
  session.docTime.record("syllabus--readme", "Overview", 20_000, false);
  session.docTime.record("interview--13-html-css", "HTML & CSS", 30_000, true);
  session.docTime.record("x", "x", 0, true);
  const all = session.docTime.getAll();
  assert.equal(all.length, 2);
  const overview = all.find((d) => d.slug === "syllabus--readme");
  assert.equal(overview?.ms, 60_000);
  assert.equal(overview?.visits, 1);
  assert.deepEqual(session.timeSummary(), { totalMs: 90_000, readingMs: 0, testMs: 0, storyCount: 0, readingSessions: 0, testSessions: 0, docMs: 90_000, docCount: 2 });
});

test("the clock counts down, then up as overtime", () => {
  // 500 words at 250 wpm = 2 minutes.
  assert.deepEqual(clockFace(500, 250, 0), { ms: 120_000, overtime: false });
  assert.deepEqual(clockFace(500, 250, 119_000), { ms: 1_000, overtime: false });
  assert.deepEqual(clockFace(500, 250, 120_000), { ms: 0, overtime: false });
  assert.deepEqual(clockFace(500, 250, 125_000), { ms: 5_000, overtime: true });
  assert.deepEqual(clockFace(0, 250, 5_000), { ms: 0, overtime: false });
});

console.log(`\n${passed} tests passed`);
