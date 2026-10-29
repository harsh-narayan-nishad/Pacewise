/** npx tsx scripts/quiz.test.ts — quiz JSON import and grading for single-choice, multi-select and typed-number questions. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseQuestionsInput, questionsToJson, isCompleteQuestion } from "../lib/questionImport";
import { splitQuestionText } from "../lib/questionText";
import { isAnswered, isCorrectAnswer, questionKind } from "../lib/grading";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { console.error(`FAIL  ${name}\n`, e); process.exitCode = 1; }
}
const base = { questionIndex: 0, flagged: false, timeSpentMs: 1 };

test("the GATE CS1 2026 file imports with no problems", () => {
  const { questions, issues } = parseQuestionsInput(fs.readFileSync(new URL("./fixtures/gate-cs1-2026.json", import.meta.url), "utf8"));
  assert.deepEqual(issues, []);
  assert.equal(questions.length, 65);
  const kinds = questions.map(questionKind);
  assert.ok(kinds.includes("mcq") && kinds.includes("msq") && kinds.includes("nat"));
  assert.ok(questions.every(isCompleteQuestion));
});

test("multi-select questions need exactly the right set", () => {
  const { questions } = parseQuestionsInput(JSON.stringify([{ question: "q", options: ["a", "b", "c", "d"], correctAnswer: [0, 2], explanation: "e" }]));
  const q = questions[0];
  assert.equal(questionKind(q), "msq");
  assert.equal(isCorrectAnswer(q, { ...base, selectedOption: 0, selectedOptions: [2, 0] }), true);
  assert.equal(isCorrectAnswer(q, { ...base, selectedOption: 0, selectedOptions: [0] }), false);
  assert.equal(isCorrectAnswer(q, { ...base, selectedOption: 0, selectedOptions: [0, 1, 2] }), false);
});

test("typed-number questions: whole numbers exact, decimals within 0.01", () => {
  const { questions } = parseQuestionsInput(JSON.stringify([
    { question: "n", options: [], correctAnswer: 11, explanation: "e" },
    { question: "d", options: [], correctAnswer: 4.25, explanation: "e" },
  ]));
  const [whole, dec] = questions;
  assert.equal(questionKind(whole), "nat");
  assert.equal(isCorrectAnswer(whole, { ...base, selectedOption: null, numericValue: 11 }), true);
  assert.equal(isCorrectAnswer(whole, { ...base, selectedOption: null, numericValue: 11.5 }), false);
  assert.equal(isCorrectAnswer(dec, { ...base, selectedOption: null, numericValue: 4.26 }), true);
  assert.equal(isCorrectAnswer(dec, { ...base, selectedOption: null, numericValue: 4.3 }), false);
});

test("single-choice and skipped answers behave as before", () => {
  const { questions } = parseQuestionsInput(JSON.stringify([{ question: "q", options: ["a", "b"], correctAnswer: 1, explanation: "e" }]));
  assert.equal(isCorrectAnswer(questions[0], { ...base, selectedOption: 1 }), true);
  assert.equal(isCorrectAnswer(questions[0], { ...base, selectedOption: 0 }), false);
  assert.equal(isAnswered({ ...base, selectedOption: null }), false);
});

test("bad answers are still reported", () => {
  const { questions, issues } = parseQuestionsInput(JSON.stringify([{ question: "q", options: ["a", "b"], correctAnswer: [0, 9], explanation: "e" }, { question: "q", options: ["a"], correctAnswer: 0, explanation: "e" }]));
  assert.equal(questions.length, 0);
  assert.equal(issues.length, 2);
});

test("export keeps the question kinds", () => {
  const src = fs.readFileSync(new URL("./fixtures/gate-cs1-2026.json", import.meta.url), "utf8");
  const again = parseQuestionsInput(questionsToJson(parseQuestionsInput(src).questions));
  assert.deepEqual(again.issues, []);
  assert.deepEqual(again.questions, parseQuestionsInput(src).questions);
});

test("optional chapter, topic, year and note are accepted, never required", () => {
  const ok = parseQuestionsInput(JSON.stringify([
    { question: "q", options: ["a", "b"], correctAnswer: 0, explanation: "e", chapter: "OS", topic: "Deadlock", year: 2026, note: "Revise Banker's" },
    { question: "q2", options: [], correctAnswer: 3, explanation: "e", pyqYear: "2025" },
    { question: "q3", options: ["a", "b"], correctAnswer: 1, explanation: "e" },
  ]));
  assert.deepEqual(ok.issues, []);
  assert.deepEqual([ok.questions[0].chapter, ok.questions[0].topic, ok.questions[0].year, ok.questions[0].note], ["OS", "Deadlock", 2026, "Revise Banker's"]);
  assert.equal(ok.questions[1].year, 2025);
  assert.equal(ok.questions[2].chapter, undefined);
  assert.equal(parseQuestionsInput(JSON.stringify([{ question: "q", options: ["a", "b"], correctAnswer: 0, explanation: "e", year: "soon" }])).issues.length, 1);
  assert.deepEqual(parseQuestionsInput(questionsToJson(ok.questions)).questions, ok.questions);
});

test("code inside a question is split out with its indentation kept", () => {
  const src = fs.readFileSync(new URL("./fixtures/gate-cs1-2026.json", import.meta.url), "utf8");
  const q = parseQuestionsInput(src).questions.find((x) => x.question.includes("void func"))!;
  const parts = splitQuestionText(q.question);
  const code = parts.find((p) => p.kind === "code");
  assert.ok(code && code.kind === "code");
  assert.match(code.text, /^#include <stdio.h>\nvoid func\(int i, int j\) \{\n  if \(i < j\) \{\n    int i = 0;/);
  assert.equal(parts[0].kind, "text");
  assert.ok(parts[parts.length - 1].kind === "text" && /output of the program/.test((parts[parts.length - 1] as { text: string }).text));
  assert.deepEqual(splitQuestionText("What is 2 + 2?"), [{ kind: "text", text: "What is 2 + 2?" }]);
  const fenced = splitQuestionText("Run:\n```js\nif (a) {\n  b();\n}\n```\nWhat prints?");
  assert.deepEqual(fenced.map((p) => p.kind), ["text", "code", "text"]);
  assert.equal((fenced[1] as { text: string }).text, "if (a) {\n  b();\n}");
});
console.log(`\n${passed} tests passed`);
