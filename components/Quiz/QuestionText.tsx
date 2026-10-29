"use client";

import React from "react";
import { highlight } from "@/lib/docs/highlight";
import { splitQuestionText } from "@/lib/questionText";

const TOKEN_CSS = `
.q-code .tk-c{color:#6a737d;font-style:italic}.q-code .tk-s{color:#0a7a3d}.q-code .tk-n{color:#b35c00}.q-code .tk-k{color:#cf222e}
.q-code .tk-l{color:#0550ae}.q-code .tk-t{color:#8250df}.q-code .tk-f{color:#0969da}.q-code .tk-p{color:#953800}.q-code .tk-v{color:#b35c00}
:root[data-theme="dark"] .q-code .tk-c{color:#8b949e}:root[data-theme="dark"] .q-code .tk-s{color:#a5d6ff}:root[data-theme="dark"] .q-code .tk-n{color:#79c0ff}
:root[data-theme="dark"] .q-code .tk-k{color:#ff7b72}:root[data-theme="dark"] .q-code .tk-l{color:#79c0ff}:root[data-theme="dark"] .q-code .tk-t{color:#d2a8ff}
:root[data-theme="dark"] .q-code .tk-f{color:#d2a8ff}:root[data-theme="dark"] .q-code .tk-p{color:#ffa657}:root[data-theme="dark"] .q-code .tk-v{color:#ffa657}
`;

/** Code exactly as written: monospace, indentation and line breaks kept, coloured, scrolls sideways instead of wrapping. */
export function CodeBlock({ code, lang = "c", size = "base" }: { code: string; lang?: string; size?: "base" | "sm" }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TOKEN_CSS }} />
      <pre className={`q-code overflow-x-auto rounded-2xl border border-overlay/10 bg-canvas p-4 font-mono leading-7 text-ink ${size === "sm" ? "text-sm" : "text-[15px] sm:text-base"}`} style={{ whiteSpace: "pre", tabSize: 2 }}>
        <code dangerouslySetInnerHTML={{ __html: highlight(code, lang) }} />
      </pre>
    </>
  );
}

/** The question text: prose in the display type, any code as a code block. */
export function QuestionText({ text }: { text: string }) {
  const parts = splitQuestionText(text);
  return (
    <div className="space-y-4">
      {parts.map((p, i) =>
        p.kind === "code" ? (
          <div key={i} className="font-normal"><CodeBlock code={p.text} lang={p.lang} /></div>
        ) : (
          <h1 key={i} className="whitespace-pre-line font-display text-2xl leading-[1.15] tracking-[-0.03em] text-ink [overflow-wrap:anywhere] sm:text-4xl">{p.text}</h1>
        )
      )}
    </div>
  );
}
