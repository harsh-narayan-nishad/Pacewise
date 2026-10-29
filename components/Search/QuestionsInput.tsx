"use client";

import React, { useRef, useState } from "react";
import { FileJson, FormInput, Upload, Trash2 } from "lucide-react";
import { StoryQuestion } from "@/types";
import { QUESTIONS_EXAMPLE, parseQuestionsInput, questionsToJson } from "@/lib/questionImport";

export const emptyQuestion = (): StoryQuestion => ({ question: "", options: ["", ""], correctAnswer: 0, explanation: "" });

interface Props {
  value: StoryQuestion[];
  /** `valid` is false only while the JSON pane holds text that doesn't parse. */
  onChange: (questions: StoryQuestion[], valid: boolean) => void;
  /** "form" = the large underlined style of the Add story modal. Default is the compact original. */
  variant?: "default" | "form";
}

type Mode = "manual" | "json";

const fieldDefault =
  "w-full rounded-md border border-overlay/15 bg-canvas px-2.5 py-1.5 text-xs text-ink outline-none focus-visible:border-accent-medium";
const fieldForm =
  "w-full border-0 border-b border-ink/40 bg-transparent px-0 pb-2 pt-3 text-lg text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent-medium";

/**
 * Quiz questions for a story, entered either one by one or as JSON (typed,
 * pasted, or loaded from a .json/.txt file). Both modes edit the same
 * `value`, so you can paste a batch of questions, flip to "One by one" and
 * fix one, or the reverse. The JSON pane is live: valid JSON replaces the
 * question list immediately; invalid JSON keeps the last good list and
 * lists exactly what is wrong.
 */
export function QuestionsInput({ value, onChange, variant = "default" }: Props) {
  const form = variant === "form";
  const field = form ? fieldForm : fieldDefault;
  const [mode, setMode] = useState<Mode>("manual");
  const [jsonText, setJsonText] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const complete = value.filter((q) => q.question.trim()).length;

  function switchTo(next: Mode) {
    if (next === mode) return;
    if (next === "json") {
      setJsonText(questionsToJson(value));
      setIssues([]);
      setNotice(null);
    } else if (issues.length) {
      setNotice("The JSON had errors, so the last valid question list was kept.");
      onChange(value, true);
      setIssues([]);
    }
    setMode(next);
  }

  function applyJson(text: string) {
    setJsonText(text);
    setNotice(null);
    const parsed = parseQuestionsInput(text);
    setIssues(parsed.issues);
    if (parsed.issues.length) onChange(value, false);
    else onChange(parsed.questions.length ? parsed.questions : [emptyQuestion()], true);
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setIssues(["That file is larger than 1 MB."]);
      onChange(value, false);
      return;
    }
    applyJson(await file.text());
  }

  // ---- one-by-one helpers --------------------------------------------------
  const update = (i: number, patch: Partial<StoryQuestion>) =>
    onChange(value.map((q, qi) => (qi === i ? { ...q, ...patch } : q)), true);
  const setOption = (qi: number, oi: number, v: string) =>
    update(qi, { options: value[qi].options.map((o, k) => (k === oi ? v : o)) });
  const removeOption = (qi: number, oi: number) => {
    const q = value[qi];
    if (q.options.length <= 2) return;
    const correct = q.correctAnswer === oi ? 0 : q.correctAnswer > oi ? q.correctAnswer - 1 : q.correctAnswer;
    const multi = q.correctAnswers?.filter((x) => x !== oi).map((x) => (x > oi ? x - 1 : x));
    update(qi, { options: q.options.filter((_, k) => k !== oi), correctAnswer: correct, ...(multi ? { correctAnswers: multi.length ? multi : [0] } : {}) });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className={form ? "text-xl font-medium text-ink" : "text-xs font-medium text-ink-muted"}>
          Quiz questions <span className={form ? "ml-2 text-sm font-normal text-ink-muted" : "text-ink-faint"}>({complete} added)</span>
        </p>
        <div className={form ? "flex gap-1 rounded-full bg-overlay/[0.06] p-1" : "flex gap-1 rounded-lg bg-overlay/5 p-0.5"} role="tablist" aria-label="How to add questions">
          {(
            [
              ["manual", "One by one", FormInput],
              ["json", "JSON / file", FileJson],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => switchTo(id)}
              className={`flex items-center gap-1 transition-colors ${form ? "rounded-full px-4 py-2 text-sm" : "rounded-md px-2 py-1 text-xs"} ${
                mode === id ? "bg-canvas text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {notice && <p className="text-xs text-ink-muted">{notice}</p>}

      {mode === "manual" ? (
        <>
          {value.map((q, qi) => (
            <div key={qi} className={form ? "space-y-4 rounded-3xl border border-overlay/15 p-5 sm:p-7" : "space-y-1.5 rounded-lg border border-overlay/10 p-2.5"}>
              <div className="flex items-center gap-1.5">
                <input
                  value={q.question}
                  onChange={(e) => update(qi, { question: e.target.value })}
                  placeholder={`Question ${qi + 1}`}
                  className={field}
                />
                {value.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Delete question ${qi + 1}`}
                    onClick={() => onChange(value.filter((_, k) => k !== qi), true)}
                    className="rounded p-1 text-ink-faint hover:text-ink"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {q.options.length === 0 && q.numericAnswer !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-muted">Typed number answer</span>
                  <input
                    value={String(q.numericAnswer)}
                    inputMode="decimal"
                    onChange={(e) => { const n = parseFloat(e.target.value); update(qi, { numericAnswer: Number.isFinite(n) ? n : 0 }); }}
                    aria-label="Correct number"
                    className={`${field} max-w-[10rem] font-mono`}
                  />
                </div>
              )}
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-1.5">
                  {q.correctAnswers ? (
                    <input
                      type="checkbox"
                      aria-label={`Option ${oi + 1} is correct`}
                      className={form ? "h-5 w-5 shrink-0 cursor-pointer accent-accent-medium" : undefined}
                      checked={q.correctAnswers.includes(oi)}
                      onChange={() => {
                        const next = q.correctAnswers!.includes(oi) ? q.correctAnswers!.filter((x) => x !== oi) : [...q.correctAnswers!, oi].sort((a, b) => a - b);
                        if (next.length) update(qi, { correctAnswers: next, correctAnswer: next[0] });
                      }}
                    />
                  ) : (
                  <input
                    type="radio"
                    name={`correct-${qi}`}
                    aria-label={`Option ${oi + 1} is correct`}
                    className={form ? "h-5 w-5 shrink-0 cursor-pointer accent-accent-medium" : undefined}
                    checked={q.correctAnswer === oi}
                    onChange={() => update(qi, { correctAnswer: oi })}
                  />
                  )}
                  <input value={opt} onChange={(e) => setOption(qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`} className={field} />
                  {q.options.length > 2 && (
                    <button type="button" aria-label={`Remove option ${oi + 1}`} onClick={() => removeOption(qi, oi)} className="px-1 text-xs text-ink-faint hover:text-ink">
                      ×
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between gap-2">
                <button type="button" hidden={q.options.length === 0} onClick={() => update(qi, { options: [...q.options, ""] })} className={form ? "text-base text-ink-muted hover:text-ink" : "text-xs text-ink-muted hover:text-ink"}>
                  + option
                </button>
                <input value={q.explanation} onChange={(e) => update(qi, { explanation: e.target.value })} placeholder="Explanation" className={`${field} flex-1`} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <input value={q.chapter ?? ""} onChange={(e) => update(qi, { chapter: e.target.value || undefined })} placeholder="Chapter (optional)" className={`${field} min-w-[8rem] flex-1`} />
                <input value={q.topic ?? ""} onChange={(e) => update(qi, { topic: e.target.value || undefined })} placeholder="Topic (optional)" className={`${field} min-w-[8rem] flex-1`} />
                <input
                  value={q.year ?? ""}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(e) => { const y = Number(e.target.value.replace(/\D/g, "")); update(qi, { year: y ? y : undefined }); }}
                  placeholder="Year (optional)"
                  className={`${field} w-28 shrink-0`}
                />
                <input value={q.note ?? ""} onChange={(e) => update(qi, { note: e.target.value || undefined })} placeholder="Note shown after the test (optional)" className={`${field} min-w-[12rem] flex-[2]`} />
              </div>
            </div>
          ))}
          <button type="button" onClick={() => onChange([...value, emptyQuestion()], true)} className={form ? "text-base font-medium text-ink-muted hover:text-ink" : "text-xs font-medium text-ink-muted hover:text-ink"}>
            + Add question
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-ink-faint">
            Paste a JSON array, or load a <code>.json</code>/<code>.txt</code> file. Each question needs <code>question</code>,{" "}
            <code>options</code> (2+), <code>correctAnswer</code> (0-based number, letter like &quot;B&quot;, or the exact option text) and{" "}
            <code>explanation</code>. Use a list like <code>[0, 2]</code> for &quot;select all that apply&quot;, or empty <code>options</code> with a number for a typed answer. Optional extras per question: <code>chapter</code>, <code>topic</code>, <code>year</code> (e.g. 2026) and <code>note</code> (shown after the test). A whole story JSON with a <code>questions</code> array works too.
          </p>
          <textarea
            value={jsonText}
            onChange={(e) => applyJson(e.target.value)}
            onDrop={(e) => {
              const f = e.dataTransfer.files?.[0];
              if (f) {
                e.preventDefault();
                void loadFile(f);
              }
            }}
            spellCheck={false}
            rows={10}
            aria-label="Questions as JSON"
            placeholder={QUESTIONS_EXAMPLE}
            className="w-full resize-y rounded-lg border border-overlay/15 bg-canvas p-3 font-mono text-xs text-ink outline-none focus-visible:border-accent-medium"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 rounded-md border border-overlay/15 px-2 py-1 text-xs text-ink-muted hover:text-ink">
              <Upload className="h-3 w-3" /> Load file
            </button>
            <button type="button" onClick={() => applyJson(QUESTIONS_EXAMPLE)} className="rounded-md border border-overlay/15 px-2 py-1 text-xs text-ink-muted hover:text-ink">
              Insert example
            </button>
            <button type="button" onClick={() => applyJson("")} className="rounded-md border border-overlay/15 px-2 py-1 text-xs text-ink-muted hover:text-ink">
              Clear
            </button>
            <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={(e) => { void loadFile(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          {issues.length > 0 ? (
            <ul role="alert" className="space-y-0.5 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-400">
              {issues.slice(0, 8).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
              {issues.length > 8 && <li>…and {issues.length - 8} more.</li>}
            </ul>
          ) : (
            jsonText.trim() && (
              <p role="status" className="text-xs text-ink-muted">
                {complete} question{complete === 1 ? "" : "s"} ready.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
