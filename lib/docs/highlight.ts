/**
 * Small dependency-free syntax highlighter for the document pages. Returns escaped HTML where tokens are wrapped
 * in <span class="tk-…"> (colours live in DocContent's stylesheet). Indentation and line breaks are untouched.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Rule = [cls: string, re: RegExp];

const JS_KEYWORDS = "abstract|as|async|await|break|case|catch|class|const|continue|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|of|override|private|protected|public|readonly|return|set|static|super|switch|this|throw|try|type|typeof|var|void|while|yield|keyof|declare|namespace|satisfies";
const JS: Rule[] = [
  ["c", /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
  ["s", /`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/y],
  ["n", /\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/y],
  ["k", new RegExp(`\\b(?:${JS_KEYWORDS})\\b`, "y")],
  ["l", /\b(?:true|false|null|undefined|NaN|Infinity)\b/y],
  ["t", /\b[A-Z][A-Za-z0-9_]*\b/y],
  ["f", /\b[a-z_$][\w$]*(?=\s*\()/y],
  ["p", /(?<=\.)[a-zA-Z_$][\w$]*/y],
];
const C_KEYWORDS = "auto|break|case|const|continue|default|do|else|enum|extern|for|goto|if|inline|register|return|sizeof|static|struct|switch|typedef|union|volatile|while|int|char|float|double|long|short|signed|unsigned|void|class|public|private|protected|new|delete|template|namespace|using";
const C: Rule[] = [
  ["c", /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
  ["k", /#\s*[a-z]+/y],
  ["s", /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|<[a-z_.]+\.h>/y],
  ["n", /\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?)\b/y],
  ["k", new RegExp(`\\b(?:${C_KEYWORDS})\\b`, "y")],
  ["l", /\b(?:NULL|true|false)\b/y],
  ["f", /\b[A-Za-z_]\w*(?=\s*\()/y],
];
const HTML: Rule[] = [
  ["c", /<!--[\s\S]*?-->/y],
  ["t", /<!DOCTYPE[^>]*>/iy],
  ["k", /<\/?[A-Za-z][\w-]*/y],
  ["k", /\/?>/y],
  ["s", /"[^"]*"|'[^']*'/y],
  ["p", /[A-Za-z_:][\w:.-]*(?==)/y],
];
const BASH: Rule[] = [
  ["c", /#[^\n]*/y],
  ["s", /'[^']*'|"(?:\\.|[^"\\])*"/y],
  ["v", /\$\{?[A-Za-z_][\w]*\}?/y],
  ["p", /(?<=\s)--?[A-Za-z][\w-]*/y],
  ["k", /\b(?:if|then|else|fi|for|do|done|while|case|esac|function|export|cd|echo|set|source)\b/y],
  ["f", /\b(?:npm|npx|node|git|docker|curl|sudo|cp|mv|rm|mkdir|ls|cat|vercel|openssl|nginx|systemctl)\b/y],
  ["n", /\b\d+(?:\.\d+)?\b/y],
];
const JSON_: Rule[] = [
  ["p", /"(?:\\.|[^"\\\n])*"(?=\s*:)/y],
  ["s", /"(?:\\.|[^"\\\n])*"/y],
  ["n", /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/y],
  ["l", /\b(?:true|false|null)\b/y],
];
const CSS: Rule[] = [
  ["c", /\/\*[\s\S]*?\*\//y],
  ["s", /'[^']*'|"[^"]*"/y],
  ["v", /--[\w-]+|\$[\w-]+/y],
  ["n", /#[\da-fA-F]{3,8}\b|-?\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms)?\b/y],
  ["p", /[a-z-]+(?=\s*:)/y],
  ["k", /@[a-z-]+/y],
];
const CONF: Rule[] = [
  ["c", /#[^\n]*|\/\/[^\n]*/y],
  ["s", /'[^']*'|"[^"]*"/y],
  ["n", /\b\d+(?:\.\d+)?[a-z]?\b/y],
  ["k", /^\s*[a-z_]+(?=\s)/my],
  ["v", /\$[\w]+/y],
];

const LANGS: Record<string, Rule[]> = {
  ts: JS, tsx: JS, js: JS, jsx: JS, javascript: JS, typescript: JS, mjs: JS,
  html: HTML, xml: HTML, svg: HTML,
  c: C, cpp: C, java: C,
  bash: BASH, sh: BASH, shell: BASH, zsh: BASH,
  json: JSON_, css: CSS, scss: CSS,
  nginx: CONF, yaml: CONF, yml: CONF, conf: CONF, env: CONF, ini: CONF,
};

export const isHighlightable = (lang: string) => lang.toLowerCase() in LANGS;

export function highlight(code: string, lang: string): string {
  const rules = LANGS[lang.toLowerCase()];
  if (!rules) return esc(code);
  let out = "";
  let plain = "";
  const flush = () => { if (plain) { out += esc(plain); plain = ""; } };
  let i = 0;
  while (i < code.length) {
    let hit: [string, string] | null = null;
    for (const [cls, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m.index === i && m[0].length > 0) { hit = [cls, m[0]]; break; }
    }
    if (hit) {
      flush();
      out += `<span class="tk-${hit[0]}">${esc(hit[1])}</span>`;
      i += hit[1].length;
    } else {
      plain += code[i];
      i++;
    }
  }
  flush();
  return out;
}

/** Parses the text after the language on a fence line: `title="path" principle="Template Method"` (also `file=`). */
export function parseFenceInfo(info: string): { title?: string; principle?: string; note?: string } {
  const out: Record<string, string> = {};
  for (const m of info.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2];
  return { title: out.title ?? out.file ?? out.path, principle: out.principle, note: out.note };
}
