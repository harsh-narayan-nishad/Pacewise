import { LanguageSpec } from "@/lib/editor/code/Tokenizer";

export interface EditState { readonly value: string; readonly start: number; readonly end: number }
export interface EditOptions { readonly indent: string; readonly lang: LanguageSpec }

const OPEN_TO_CLOSE = (lang: LanguageSpec) => lang.pairs ?? {};

/**
 * Pure editing rules for the code editor: given the text + selection and a
 * key, return the new text + selection (or null = let the browser handle
 * it). Pure functions of immutable input => trivially unit-testable and
 * independent of any DOM element.
 */
export class CodeEditingEngine {
  constructor(private readonly opts: EditOptions) {}

  private lineStart(v: string, i: number): number { return v.lastIndexOf("\n", i - 1) + 1; }
  private lineEnd(v: string, i: number): number { const n = v.indexOf("\n", i); return n < 0 ? v.length : n; }

  tab(s: EditState, shift: boolean): EditState {
    const { indent } = this.opts;
    const { value, start, end } = s;
    if (start === end && !shift) {
      return { value: value.slice(0, start) + indent + value.slice(end), start: start + indent.length, end: start + indent.length };
    }
    const from = this.lineStart(value, start);
    const to = this.lineEnd(value, end > start && value[end - 1] === "\n" ? end - 1 : end);
    const lines = value.slice(from, to).split("\n");
    let delta0 = 0, deltaAll = 0;
    const next = lines.map((l, i) => {
      if (!shift) { deltaAll += indent.length; if (i === 0) delta0 = indent.length; return indent + l; }
      let cut = 0;
      if (l.startsWith(indent)) cut = indent.length;
      else if (l.startsWith("\t")) cut = 1;
      else { const m = /^ +/.exec(l); cut = m ? Math.min(m[0].length, indent.length) : 0; }
      deltaAll -= cut;
      if (i === 0) delta0 = -cut;
      return l.slice(cut);
    });
    return {
      value: value.slice(0, from) + next.join("\n") + value.slice(to),
      start: Math.max(from, start + delta0),
      end: Math.max(from, end + deltaAll),
    };
  }

  enter(s: EditState): EditState {
    const { value, start, end } = s;
    const ls = this.lineStart(value, start);
    const before = value.slice(ls, start);
    const base = /^[ \t]*/.exec(before)![0];
    const trimmed = before.trimEnd();
    const opens = (this.opts.lang.indentAfter ?? []).some((t) => trimmed.endsWith(t));
    const after = value[end] ?? "";
    const closes = opens && (after === "}" || after === ")" || after === "]" || after === ">");
    const inner = base + (opens ? this.opts.indent : "");
    const ins = closes ? `\n${inner}\n${base}` : `\n${inner}`;
    const pos = start + 1 + inner.length;
    return { value: value.slice(0, start) + ins + value.slice(end), start: pos, end: pos };
  }

  /** Typing `ch`: auto-pairs, wraps selections, or steps over a closer. Null = default. */
  type(s: EditState, ch: string): EditState | null {
    const pairs = OPEN_TO_CLOSE(this.opts.lang);
    const { value, start, end } = s;
    const closers = new Set(Object.values(pairs));
    if (start === end && closers.has(ch) && value[start] === ch) return { value, start: start + 1, end: start + 1 };
    const close = pairs[ch];
    if (!close) return null;
    if (start !== end) {
      return { value: value.slice(0, start) + ch + value.slice(start, end) + close + value.slice(end), start: start + 1, end: end + 1 };
    }
    if (ch === close) {
      const prev = value[start - 1] ?? "";
      const next = value[start] ?? "";
      if (/\w/.test(prev) || /\w/.test(next)) return null; // apostrophes in words
    }
    return { value: value.slice(0, start) + ch + close + value.slice(end), start: start + 1, end: start + 1 };
  }

  backspace(s: EditState): EditState | null {
    const { value, start, end } = s;
    if (start !== end || start === 0) return null;
    const open = value[start - 1];
    const pairs = OPEN_TO_CLOSE(this.opts.lang);
    if (pairs[open] && value[start] === pairs[open]) {
      return { value: value.slice(0, start - 1) + value.slice(start + 1), start: start - 1, end: start - 1 };
    }
    // Delete a whole indent unit when only whitespace precedes the caret.
    const ls = this.lineStart(value, start);
    const lead = value.slice(ls, start);
    const w = this.opts.indent.length;
    if (this.opts.indent !== "\t" && lead.length >= w && /^ +$/.test(lead) && lead.length % w === 0) {
      return { value: value.slice(0, start - w) + value.slice(start), start: start - w, end: start - w };
    }
    return null;
  }

  toggleComment(s: EditState): EditState {
    const lc = this.opts.lang.lineComment;
    if (!lc) return s;
    const { value, start, end } = s;
    const from = this.lineStart(value, start);
    const to = this.lineEnd(value, end);
    const lines = value.slice(from, to).split("\n");
    const all = lines.filter((l) => l.trim()).every((l) => l.trimStart().startsWith(lc));
    const next = lines.map((l) => {
      if (!l.trim()) return l;
      if (all) return l.replace(lc + " ", "").replace(lc, "");
      const lead = /^[ \t]*/.exec(l)![0];
      return `${lead}${lc} ${l.slice(lead.length)}`;
    });
    const out = next.join("\n");
    return { value: value.slice(0, from) + out + value.slice(to), start: from, end: from + out.length };
  }

  /** Line ranges [startLine, endLine] foldable by brace/indent (used by the folding UI). */
  foldRanges(value: string): Array<[number, number]> {
    const lines = value.split("\n");
    const out: Array<[number, number]> = [];
    const stack: number[] = [];
    lines.forEach((l, i) => {
      const o = (l.match(/[{(\[]/g) ?? []).length;
      const c = (l.match(/[})\]]/g) ?? []).length;
      for (let k = 0; k < o - c; k += 1) stack.push(i);
      for (let k = 0; k < c - o && stack.length; k += 1) {
        const s = stack.pop()!;
        if (i - s >= 2) out.push([s, i]);
      }
    });
    if (this.opts.lang.id === "python") {
      const ind = (l: string) => (l.trim() ? /^[ \t]*/.exec(l)![0].length : -1);
      for (let i = 0; i < lines.length; i += 1) {
        if (!lines[i].trimEnd().endsWith(":")) continue;
        let j = i + 1, last = i;
        while (j < lines.length && (ind(lines[j]) === -1 || ind(lines[j]) > ind(lines[i]))) { if (ind(lines[j]) !== -1) last = j; j += 1; }
        if (last - i >= 2) out.push([i, last]);
      }
    }
    return out;
  }

  /** Find all matches of `query` (case-insensitive unless `matchCase`). */
  static findAll(value: string, query: string, matchCase = false): number[] {
    if (!query) return [];
    const hay = matchCase ? value : value.toLowerCase();
    const needle = matchCase ? query : query.toLowerCase();
    const out: number[] = [];
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + Math.max(1, needle.length))) out.push(i);
    return out;
  }
}
