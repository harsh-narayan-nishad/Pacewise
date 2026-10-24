export type TokenType = "keyword" | "string" | "comment" | "number" | "type" | "func" | "punct" | "tag" | "attr" | "plain";
export interface Token { readonly type: TokenType; readonly text: string }

export interface LanguageSpec {
  readonly id: string;
  readonly label: string;
  readonly keywords: readonly string[];
  readonly types?: readonly string[];
  readonly lineComment?: string | null;
  readonly blockComment?: readonly [string, string] | null;
  readonly strings: readonly string[];
  readonly caseInsensitive?: boolean;
  readonly markup?: boolean;
  readonly pairs?: Readonly<Record<string, string>>;
  /** Lines ending with one of these increase indentation on Enter. */
  readonly indentAfter?: readonly string[];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Generic, spec-driven lexer. One class + one data object per language
 * (data-driven polymorphism) instead of a hand-written lexer per language.
 * Linear time in the input; never throws; every input char lands in a token,
 * so `tokens.map(t => t.text).join("") === source` always holds.
 */
export class Tokenizer {
  private readonly kw: Set<string>;
  private readonly ty: Set<string>;
  private readonly re: RegExp;

  constructor(private readonly spec: LanguageSpec) {
    const ci = !!spec.caseInsensitive;
    this.kw = new Set(spec.keywords.map((k) => (ci ? k.toLowerCase() : k)));
    this.ty = new Set((spec.types ?? []).map((k) => (ci ? k.toLowerCase() : k)));
    const parts: string[] = [];
    if (spec.blockComment) parts.push(`(?<bc>${esc(spec.blockComment[0])}[\\s\\S]*?(?:${esc(spec.blockComment[1])}|(?![\\s\\S])))`);
    if (spec.lineComment) parts.push(`(?<lc>${esc(spec.lineComment)}[^\\n]*)`);
    for (const q of spec.strings) {
      if (q === "`") parts.push("(?<s3>`(?:\\\\[\\s\\S]|[^`\\\\])*(?:`|(?![\\s\\S])))");
      else if (q === '"""') parts.push('(?<s4>"""[\\s\\S]*?(?:"""|(?![\\s\\S])))');
      else if (q === "'''") parts.push("(?<s5>'''[\\s\\S]*?(?:'''|(?![\\s\\S])))");
      else if (q === '"') parts.push('(?<s1>"(?:\\\\.|[^"\\\\\\n])*(?:"|(?![\\s\\S])))');
      else if (q === "'") parts.push("(?<s2>'(?:\\\\.|[^'\\\\\\n])*(?:'|(?![\\s\\S])))");
    }
    if (spec.markup) parts.push("(?<tg></?[A-Za-z][\\w:-]*|/?>)");
    parts.push("(?<nm>\\b(?:0[xX][0-9a-fA-F_]+|\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\b)");
    parts.push("(?<id>[A-Za-z_$][\\w$]*)");
    parts.push("(?<pn>[{}()\\[\\];,.:<>=+\\-*/%&|^!~?@#]+)");
    this.re = new RegExp(parts.join("|"), "gm");
  }

  tokenize(src: string): Token[] {
    const out: Token[] = [];
    let last = 0;
    const push = (type: TokenType, text: string) => {
      if (!text) return;
      const prev = out[out.length - 1];
      if (prev && prev.type === type && type === "plain") out[out.length - 1] = { type, text: prev.text + text };
      else out.push({ type, text });
    };
    this.re.lastIndex = 0;
    for (let m = this.re.exec(src); m; m = this.re.exec(src)) {
      if (m[0] === "") { this.re.lastIndex += 1; continue; }
      push("plain", src.slice(last, m.index));
      last = m.index + m[0].length;
      const g = m.groups ?? {};
      if (g.bc !== undefined || g.lc !== undefined) push("comment", m[0]);
      else if (g.s1 !== undefined || g.s2 !== undefined || g.s3 !== undefined || g.s4 !== undefined || g.s5 !== undefined) push("string", m[0]);
      else if (g.tg !== undefined) push("tag", m[0]);
      else if (g.nm !== undefined) push("number", m[0]);
      else if (g.id !== undefined) {
        const key = this.spec.caseInsensitive ? m[0].toLowerCase() : m[0];
        if (this.kw.has(key)) push("keyword", m[0]);
        else if (this.ty.has(key) || /^[A-Z][A-Za-z0-9_]*$/.test(m[0]) && !this.spec.markup) push("type", m[0]);
        else if (src[last] === "(") push("func", m[0]);
        else push("plain", m[0]);
      } else push("punct", m[0]);
    }
    push("plain", src.slice(last));
    return out;
  }
}
