import { getLanguage, getTokenizer } from "@/lib/editor/code/languages";
import { looksLikeCollapsedCode, normalizeCodeText } from "@/lib/editor/code/CodeHeuristics";

const BRACE_LANGS = new Set(["javascript", "typescript", "java", "c", "cpp", "csharp", "go", "rust", "php", "css"]);
const CONTINUES_AFTER_BRACE = /^(else|catch|finally|while)\b/;

/**
 * Re-flows code whose line breaks were lost (everything on one line) into
 * indented lines — braces open/close levels, `;` ends a statement (except
 * inside `( )` such as `for (a; b; c)`), strings and comments are never
 * touched. Brace languages and JSON only; anything else is returned as is.
 *
 * It is a DISPLAY fix-up, not a full pretty-printer: code that already has
 * several lines is never rewritten.
 */
/**
 * Code whose line breaks were lost usually keeps the old indentation as a run
 * of 2+ spaces where each newline was (`a;    // note    b();`). Turns such gaps
 * back into line breaks: after `;`, `{`, `}` and after a `//` comment. Only for
 * a single line of input; strings are never touched.
 */
export function splitOnWideGaps(code: string, langId: string): string {
  if (code.includes("\n")) return code;
  let cur = code;
  for (let pass = 0; pass < 500; pass += 1) {
    let masked = "";
    let pos = 0;
    let best: { at: number; len: number } | null = null; // replace cur[at, at+len) by "\n"
    for (const tok of getTokenizer(langId).tokenize(cur)) {
      const isLit = tok.type === "string" || tok.type === "comment";
      masked += isLit ? "\u0001".repeat(tok.text.length) : tok.text;
      if (tok.type === "comment" && tok.text.startsWith("//")) {
        const m = /^\S.{2,}?\S([ \t]{2,})(?=\S)/.exec(tok.text);
        if (m && (!best || pos + m[0].length - m[1].length < best.at)) best = { at: pos + m[0].length - m[1].length, len: m[1].length };
      }
      pos += tok.text.length;
    }
    const g = /[;{}]([ \t]{2,})(?=\S)/.exec(masked);
    if (g) {
      const at = g.index + 1;
      if (!best || at < best.at) best = { at, len: g[1].length };
    }
    const j = /;(?=\})/.exec(masked);
    if (j && (!best || j.index + 1 < best.at)) best = { at: j.index + 1, len: 0 };
    if (!best) break;
    cur = cur.slice(0, best.at) + "\n" + cur.slice(best.at + best.len);
  }
  return cur;
}

export function beautifyIfCollapsed(raw: string, langId: string, force = false): string {
  let code = normalizeCodeText(raw);
  const langPre = getLanguage(langId).id;
  if (BRACE_LANGS.has(langPre) && !code.includes("\n")) {
    const split = splitOnWideGaps(code, langPre);
    if (split !== code) return split; // already has real lines again; the caller re-indents
  }
  const lines = code.split("\n").filter((l) => l.trim());
  const lang = getLanguage(langId).id;

  if (lang === "json" && lines.length <= 2) {
    try { return JSON.stringify(JSON.parse(code), null, 2); } catch { return code; }
  }
  if (!BRACE_LANGS.has(lang)) return code;
  const collapsed = lines.length === 1 ? looksLikeCollapsedCode(code) || (force && (code.match(/[;{}]/g) ?? []).length >= 2) || (lang === "css" && /[{};]/.test(code) && code.length > 50) : false;
  if (!collapsed) return code;

  const unit = lang === "javascript" || lang === "typescript" || lang === "css" ? "  " : "    ";
  const tokens = getTokenizer(lang).tokenize(code.trim());
  let out = "";
  let level = 0;
  let paren = 0;
  const lineStart = () => out === "" || out.endsWith("\n");
  const newline = () => { out = out.replace(/[ \t]+$/, ""); if (!lineStart()) out += "\n"; };
  const write = (s: string) => { if (lineStart()) out += unit.repeat(Math.max(0, level)); out += s; };
  const space = () => { if (!lineStart() && !out.endsWith(" ") && !out.endsWith("(") && !out.endsWith("[")) out += " "; };
  const rest = (from: number, ti: number): string => tokens.slice(ti).map((t) => t.text).join("").slice(from).trimStart();

  tokens.forEach((tok, ti) => {
    if (tok.type === "string") { write(tok.text); return; }
    if (tok.type === "comment") {
      space(); write(tok.text);
      if (tok.text.startsWith("//") || tok.text.startsWith("#")) newline();
      return;
    }
    const text = tok.text;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (/\s/.test(ch)) { space(); continue; }
      if (ch === "{") { space(); write("{"); level += 1; newline(); continue; }
      if (ch === "}") {
        level = Math.max(0, level - 1); newline(); write("}");
        const after = rest(i + 1, ti === undefined ? 0 : ti);
        const next = (text.slice(i + 1) + tokens.slice(ti + 1).map((t) => t.text).join("")).trimStart();
        void after;
        if (CONTINUES_AFTER_BRACE.test(next)) out += " ";
        else if (!/^[),;.\]]/.test(next) && next !== "") newline();
        continue;
      }
      if (ch === ";") { write(";"); if (paren === 0) newline(); else out += " "; continue; }
      if (ch === "(" || ch === "[") paren += 1;
      if (ch === ")" || ch === "]") paren = Math.max(0, paren - 1);
      if (ch === ",") { write(","); out += " "; continue; }
      write(ch);
    }
  });
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
