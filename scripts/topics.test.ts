/** npx tsx scripts/topics.test.ts — topic strong/medium/weak grouping and the 2-day edit window. */
import assert from "node:assert/strict";
import { computeTopicScores, editWindow, formatLeft, groupByLevel, levelOf, mergeTopics, EDIT_WINDOW_MS } from "../lib/topicAnalytics";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { console.error(`FAIL  ${name}\n`, e); process.exitCode = 1; }
}
const q = (topic: string | undefined, correct: number, chapter?: string) => ({ question: "q", options: ["a", "b", "c", "d"], correctAnswer: correct, explanation: "", topic, chapter });
const ans = (i: number, sel: number | null) => ({ questionIndex: i, selectedOption: sel, flagged: false, timeSpentMs: 1 });

test("scores are grouped per topic; skipped counts as not correct; unlabeled falls back to chapter, then General", () => {
  const questions = [q("Graphs", 0), q("graphs", 1), q("DP", 2), q(undefined, 0, "Trees"), q(undefined, 0)];
  const scores = computeTopicScores(questions, [ans(0, 0), ans(1, 1), ans(2, null), ans(3, 0), ans(4, 3)]);
  assert.deepEqual(scores, [
    { topic: "Graphs", correct: 2, total: 2 },
    { topic: "DP", correct: 0, total: 1 },
    { topic: "Trees", correct: 1, total: 1 },
    { topic: "General", correct: 0, total: 1 },
  ]);
});

test("levels: >=75 strong, >=50 medium, else weak", () => {
  assert.equal(levelOf({ topic: "a", correct: 3, total: 4 }), "strong");
  assert.equal(levelOf({ topic: "a", correct: 1, total: 2 }), "medium");
  assert.equal(levelOf({ topic: "a", correct: 1, total: 3 }), "weak");
  const g = groupByLevel([{ topic: "a", correct: 1, total: 3 }, { topic: "b", correct: 4, total: 4 }, { topic: "c", correct: 0, total: 2 }]);
  assert.deepEqual(g.strong.map((t) => t.topic), ["b"]);
  assert.deepEqual(g.weak.map((t) => t.topic), ["c", "a"]); // weakest first
});

test("renaming a topic into an existing one merges the counts", () => {
  assert.deepEqual(mergeTopics([{ topic: "Graph ", correct: 1, total: 2 }, { topic: "graph", correct: 2, total: 2 }, { topic: " ", correct: 1, total: 1 }]), [{ topic: "Graph", correct: 3, total: 4 }]);
});

test("edit window is 2 days from the attempt, then locked", () => {
  const at = "2026-11-01T10:00:00Z", t0 = Date.parse(at);
  assert.equal(editWindow(at, t0 + EDIT_WINDOW_MS - 1000).locked, false);
  assert.equal(editWindow(at, t0 + EDIT_WINDOW_MS).locked, true);
  assert.equal(editWindow("not a date").locked, true);
  assert.equal(formatLeft(26 * 3_600_000), "1d 2h");
  assert.equal(formatLeft(5 * 3_600_000 + 10 * 60_000), "5h 10m");
  assert.equal(formatLeft(30_000), "1m");
});

console.log(`${passed} passed`);
