/**
 * Splits a quiz question into prose and code so code is shown exactly as written (indentation kept).
 * Code is recognised from a Markdown fence (``` … ```), or, for plain text with line breaks, from lines that look
 * like source code (a C/Java/JS-style program pasted into the question).
 */
export type TextPart = { kind: "text"; text: string } | { kind: "code"; text: string; lang: string };

const LOOKS_LIKE_CODE = [
  /^\s*#\s*(include|define|ifdef|ifndef|endif|pragma)\b/,
  /[;{}]\s*(\/\/.*|\/\*.*\*\/)?\s*$/,
  /^\s*(int|char|float|double|long|void|struct|unsigned|static|const|return|if|else|for|while|do|switch|case|break|continue|class|public|private|def|import|from|let|var|function)\b[^.?!]*[({=;:]/,
  /^\s*[A-Za-z_][\w.\->\[\]*]*\s*(=|\+=|-=|\+\+|--)[^=]/,
  /^\s*[A-Za-z_]\w*\s*\(.*\)\s*;?\s*$/,
  /^\s*(\/\/|\/\*|\*)/,
];
const isCodeLine = (l: string) => LOOKS_LIKE_CODE.some((re) => re.test(l));

export function splitQuestionText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  // 1) explicit fences
  const fence = /```([\w+-]*)[ \t]*\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let fenced = false;
  while ((m = fence.exec(text))) {
    fenced = true;
    if (m.index > last) pushProse(parts, text.slice(last, m.index));
    parts.push({ kind: "code", text: m[2].replace(/\s+$/, ""), lang: m[1] || "c" });
    last = m.index + m[0].length;
  }
  if (fenced) {
    if (last < text.length) pushProse(parts, text.slice(last));
    return parts;
  }
  // 2) plain text with line breaks: group runs of code-looking lines
  if (!text.includes("\n")) return [{ kind: "text", text }];
  const lines = text.split("\n");
  let i = 0;
  let prose: string[] = [];
  const flushProse = () => { if (prose.join("").trim()) parts.push({ kind: "text", text: prose.join("\n").trim() }); prose = []; };
  while (i < lines.length) {
    if (isCodeLine(lines[i])) {
      let j = i;
      let end = i;
      while (j < lines.length && (isCodeLine(lines[j]) || !lines[j].trim() || /^\s{2,}\S/.test(lines[j]))) {
        if (lines[j].trim()) end = j;
        j++;
      }
      flushProse();
      parts.push({ kind: "code", text: lines.slice(i, end + 1).join("\n").replace(/\s+$/, ""), lang: "c" });
      i = end + 1;
    } else {
      prose.push(lines[i]);
      i++;
    }
  }
  flushProse();
  return parts.length ? parts : [{ kind: "text", text }];
}

function pushProse(parts: TextPart[], s: string) {
  const t = s.trim();
  if (t) parts.push({ kind: "text", text: t });
}

/** An option that spans lines (assembly, code) is shown in a monospace block too. */
export const isMultilineOption = (s: string) => s.includes("\n");
