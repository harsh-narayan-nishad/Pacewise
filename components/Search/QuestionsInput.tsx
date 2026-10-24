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
}

type Mode = "manual" | "json";

const field =
  "w-full rounded-md border border-overlay/15 bg-canvas px-2.5 py-1.5 text-xs text-ink outline-none focus-visible:border-accent-medium";

/**
 * Quiz questions for a story, entered either one by one or as JSON (typed,
 * pasted, or loaded from a .json/.txt file). Both modes edit the same
 * `value`, so you can paste a batch of questions, flip to "One by one" and
 * fix one, or the reverse. The JSON pane is live: valid JSON replaces the
 * question list immediately; invalid JSON keeps the last good list and
 * lists exactly what is wrong.
 */
export function QuestionsInput({ value, onChange }: Props) {
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
    update(qi, { options: q.options.filter((_, k) => k !== oi), correctAnswer: correct });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">
          Quiz questions <span className="text-ink-faint">({complete} added)</span>
        </p>
        <div className="flex gap-1 rounded-lg bg-overlay/5 p-0.5" role="tablist" aria-label="How to add questions">
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
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
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
            <div key={qi} className="space-y-1.5 rounded-lg border border-overlay/10 p-2.5">
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
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`correct-${qi}`}
                    aria-label={`Option ${oi + 1} is correct`}
                    checked={q.correctAnswer === oi}
                    onChange={() => update(qi, { correctAnswer: oi })}
                  />
                  <input value={opt} onChange={(e) => setOption(qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`} className={field} />
                  {q.options.length > 2 && (
                    <button type="button" aria-label={`Remove option ${oi + 1}`} onClick={() => removeOption(qi, oi)} className="px-1 text-xs text-ink-faint hover:text-ink">
                      ×
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => update(qi, { options: [...q.options, ""] })} className="text-xs text-ink-muted hover:text-ink">
                  + option
                </button>
                <input value={q.explanation} onChange={(e) => update(qi, { explanation: e.target.value })} placeholder="Explanation" className={`${field} flex-1`} />
              </div>
            </div>
          ))}
          <button type="button" onClick={() => onChange([...value, emptyQuestion()], true)} className="text-xs font-medium text-ink-muted hover:text-ink">
            + Add question
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-ink-faint">
            Paste a JSON array, or load a <code>.json</code>/<code>.txt</code> file. Each question needs <code>question</code>,{" "}
            <code>options</code> (2+), <code>correctAnswer</code> (0-based number, letter like &quot;B&quot;, or the exact option text) and{" "}
            <code>explanation</code>. A whole story JSON with a <code>questions</code> array works too.
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
