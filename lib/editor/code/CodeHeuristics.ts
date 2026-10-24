/**
 * Decides whether a piece of text IS code, which language it probably is, and
 * cleans up its whitespace. Pure string functions (no DOM) used by the reader
 * (to show every code snippet in IDE style) and by the editor's paste handler.
 *
 * The rules are deliberately conservative: a false "this is code" turns prose
 * into a grey box, which is worse than leaving an odd snippet as text.
 */

const STRONG_LINE: RegExp[] = [
  /[;{}]\s*$/,
  /^\s*(#include\b|#define\b|import\s+[\w.{}*,\s]+(\s+from\s+['"][^'"]+['"])?\s*;?\s*$|from\s+[\w.]+\s+import\b|using\s+[\w.]+\s*;|package\s+[\w.]+)/,
  /^\s*(def|class|async\s+def|elif|else\s*:|try\s*:|except\b.*:|finally\s*:|with\s+.+:|lambda\b)/,
  /^\s*(public|private|protected|static|final|abstract|override|virtual)\s+[\w<>\[\], ?]+[\s(]/,
  /^\s*(function\b|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|export\s+(default\s+)?(function|class|const)|fn\s+\w+|func\s+\w+|interface\s+\w+|enum\s+\w+|struct\s+\w+)/,
  /^\s*(if|for|while|switch|catch)\s*\(.*\)\s*\{?\s*$/,
  /^\s*(return\b.*[;)]|throw\s+new\b|print\(|console\.\w+\(|System\.out\.|printf\(|std::|cout\s*<<)/,
  /=>|->\s*\w|::\w|\)\s*\{|\bnull\b.*;|\bnew\s+\w+\(/,
  /^\s*(SELECT\b.+\bFROM\b|INSERT\s+INTO\b|CREATE\s+TABLE\b|UPDATE\s+\w+\s+SET\b|DELETE\s+FROM\b)/i,
  /^\s*<\/?[a-z][\w-]*(\s[^>]*)?>\s*$/i,
  /^\s*[.#]?[\w-]+\s*\{\s*$|^\s*[\w-]+\s*:\s*[^;]+;\s*$/,
];

const WEAK_LINE: RegExp[] = [/^\s*(SELECT|FROM|WHERE|JOIN|LEFT JOIN|INNER JOIN|GROUP BY|ORDER BY|HAVING|VALUES|SET|LIMIT)\b/, /^(\t| {2,})\S/, /^\s*(\/\/|#(?!\s)|\/\*|\*\/|--\s)/, /\w\(.*\)/, /[=!<>]=|\+\+|--|&&|\|\|/];

const NBSP = / /g;

export function normalizeCodeText(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").replace(NBSP, " ").replace(/​/g, "");
}

export function isStrongCodeLine(line: string): boolean {
  const l = line.replace(NBSP, " ");
  if (!l.trim()) return false;
  const words = l.trim().split(/\s+/);
  // Long sentence-like lines ending in a full stop are prose, whatever they contain.
  if (words.length > 14 && /[.?!]$/.test(l.trim()) && !/[;{}]/.test(l)) return false;
  return STRONG_LINE.some((re) => re.test(l));
}

function isWeakCodeLine(line: string): boolean {
  return WEAK_LINE.some((re) => re.test(line.replace(NBSP, " ")));
}

/** Multi-line text where most lines look like code. */
export function looksLikeCode(text: string): boolean {
  const lines = normalizeCodeText(text).split("\n").filter((l) => l.trim());
  if (lines.length >= 2) {
    const strong = lines.filter(isStrongCodeLine).length;
    const codeish = lines.filter((l) => isStrongCodeLine(l) || isWeakCodeLine(l)).length;
    return strong >= 1 && codeish / lines.length >= 0.7 && (strong >= 2 || lines.length >= 3 || /^\s/.test(lines[1]));
  }
  return looksLikeCollapsedCode(text);
}

/** One long line holding several statements: code whose newlines were lost. */
export function looksLikeCollapsedCode(text: string): boolean {
  const t = normalizeCodeText(text).trim();
  if (t.length < 40 || t.includes("\n")) return false;
  const marks = (t.match(/[;{}]/g) ?? []).length;
  const hasKeyword = /\b(function|class|def|return|if|for|while|const|let|var|public|private|import|#include|SELECT|int|void|console|print)\b/.test(t) || /=>|\)\s*\{/.test(t);
  return marks >= 3 && hasKeyword && !/^[A-Z][^{};]*\.\s/.test(t);
}

/** Best-guess language id (one of `languages.ts`), "plaintext" when unsure. */
export function guessLanguage(raw: string): string {
  const t = normalizeCodeText(raw).trim();
  if (!t) return "plaintext";
  if (/^[{[]/.test(t)) {
    try { JSON.parse(t); return "json"; } catch { /* not JSON */ }
  }
  if (/^<!doctype html|^<html|^<(div|span|body|head|section|ul|table|form|p)\b/i.test(t)) return "html";
  if (/^#include\b/m.test(t)) return /std::|\bcout\b|iostream|template\s*</.test(t) ? "cpp" : "c";
  if (/<\?php|\$\w+\s*=|->\w+\(/.test(t) && /<\?php|\$\w+/.test(t)) return "php";
  if (/\bdef\s+\w+\s*\(.*\)\s*:|^\s*(elif|except)\b|\bself\.|^\s*from\s+\w+\s+import\b|^\s*import\s+\w+\s*$|\bprint\(/m.test(t) && !/[;{}]\s*$/m.test(t)) return "python";
  if (/public\s+static\s+void\s+main|System\.out\.print|\bpublic\s+class\b|\bimport\s+java\./.test(t)) return "java";
  if (/\busing\s+System|Console\.Write|\bnamespace\s+\w+|\bstring\[\]/.test(t)) return "csharp";
  if (/\bpackage\s+main\b|\bfunc\s+\w+\(|\bfmt\.\w+\(/.test(t)) return "go";
  if (/\bfn\s+\w+\(|\blet\s+mut\b|println!|\bimpl\b/.test(t)) return "rust";
  if (/^\s*(SELECT|INSERT\s+INTO|CREATE\s+TABLE|UPDATE\s+\w+\s+SET|DELETE\s+FROM|ALTER\s+TABLE)\b/im.test(t)) return "sql";
  if (/^#!.*\b(ba)?sh\b|^\s*(echo|sudo|cd|ls|grep|chmod|export)\s|\bfi\s*$|\$\(/m.test(t) && !/[;{]\s*$/m.test(t.split("\n")[0])) return "bash";
  if (/[.#]?[\w-]+\s*\{[^}]*:\s*[^;}]+;?[^}]*\}/.test(t) && !/\b(function|const|let|var|return)\b/.test(t)) return "css";
  if (/\b(function|const|let|var|=>|console\.\w+|require\(|import\s.+from|export\s)/.test(t)) {
    return /:\s*(string|number|boolean|void|any)\b|\binterface\s+\w+|\btype\s+\w+\s*=|<\w+>\(/.test(t) ? "typescript" : "javascript";
  }
  if (/\b(int|char|float|double|void)\s+\w+\s*\(.*\)\s*\{?/.test(t)) return "c";
  // C-family fallback: statements ending in `;` with typed declarations, generics or braces.
  if (/;/.test(t) && (/\b[A-Z]\w*(<[^;\n]*>)?\s+\w+\s*(=|;|\()/.test(t) || /[{}]/.test(t))) return "java";
  return "plaintext";
}

/** Removes the indentation shared by every non-blank line and trailing blank lines. */
export function dedent(text: string): string {
  const lines = normalizeCodeText(text).split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const indents = lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0]);
  if (!indents.length) return "";
  let common = indents[0];
  for (const ind of indents) {
    let i = 0;
    while (i < common.length && i < ind.length && common[i] === ind[i]) i += 1;
    common = common.slice(0, i);
  }
  return lines.map((l) => (l.startsWith(common) ? l.slice(common.length) : l.trimStart()).replace(/[ \t]+$/, "")).join("\n");
}

export interface TextSegment { kind: "text" | "code"; text: string; lang?: string }

/** Splits text containing ``` fences into prose and code segments (an unclosed fence runs to the end). */
export function splitFences(raw: string): TextSegment[] {
  const text = raw.replace(/\r\n?/g, "\n");
  if (!text.includes("```")) return [{ kind: "text", text }];
  const out: TextSegment[] = [];
  const re = /```([\w+#.-]*)[ \t]*\n?([\s\S]*?)(?:```|$)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    out.push({ kind: "code", text: m[2].replace(/\n$/, ""), lang: m[1] || undefined });
    last = m.index + m[0].length;
    if (m[0] === "") re.lastIndex += 1;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out.filter((s) => s.kind === "code" || s.text.trim());
}
