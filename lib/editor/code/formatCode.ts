import { getLanguage, getTokenizer } from "@/lib/editor/code/languages";
import { dedent, guessLanguage, normalizeCodeText } from "@/lib/editor/code/CodeHeuristics";
import { beautifyIfCollapsed } from "@/lib/editor/reader/CodeFormatter";

/**
 * One-click "Format code" for every language the editor knows.
 *
 * Strategy pattern: `formatCode` picks a strategy by language family.
 *   - json      → parse + pretty-print (falls back to bracket re-indent if invalid)
 *   - markup    → tag-depth layout (html); <script>/<style> bodies are formatted
 *                 with their own language, <pre>/<textarea> are left verbatim
 *   - python    → indentation levels are re-derived from the existing structure
 *                 and re-emitted with one consistent unit (no reflow: Python's
 *                 meaning depends on indentation, so lines are never joined/split)
 *   - sql       → keyword upper-casing, clause per line, one column per line
 *   - bash      → block-keyword (if/fi, do/done, case/esac, { }) re-indent
 *   - brace family (JS, TS, Java, C, C++, C#, Go, Rust, PHP, CSS) and anything else
 *                 → re-indent by bracket depth; a single collapsed line is first
 *                 split into statements
 * Strings and comments are never altered (decided by the language Tokenizer).
 * Idempotent: formatting formatted code returns it unchanged.
 */
export interface FormatOptions { readonly indent?: string }
export interface FormatResult { readonly code: string; readonly lang: string }

const DEFAULT_INDENT = "  ";
const FOUR = new Set(["java", "c", "cpp", "csharp", "rust", "php", "python", "sql", "bash"]);

export function formatCode(raw: string, langId: string, opts: FormatOptions = {}): FormatResult {
  let code = normalizeCodeText(raw).replace(/[ \t]+$/gm, "");
  if (!code.trim()) return { code: "", lang: langId };
  let lang = getLanguage(langId).id;
  if (lang === "plaintext") lang = getLanguage(guessLanguage(code)).id;
  const unit = opts.indent ?? (FOUR.has(lang) ? "    " : lang === "go" ? "\t" : DEFAULT_INDENT);
  code = code.replace(/^\n+|\n+$/g, "");
  let out: string;
  try {
    out = run(code, lang, unit);
  } catch {
    out = code; // formatting must never lose the user's code
  }
  out = out.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+$/gm, "");
  return { code: out, lang };
}

function run(code: string, lang: string, unit: string): string {
  switch (lang) {
    case "json": return formatJson(code, unit);
    case "html": return formatMarkup(code, unit);
    case "python": return formatPython(code, unit);
    case "sql": return formatSql(code, unit);
    case "bash": return formatBash(code, unit);
    case "markdown":
    case "plaintext": return dedent(code);
    default: return reindentBraces(beautifyIfCollapsed(code, lang, true), lang, unit);
  }
}

// --- shared: which characters belong to strings / comments ---------------------------
function literalMask(code: string, lang: string): Uint8Array | null {
  const mask = new Uint8Array(code.length);
  let pos = 0;
  for (const t of getTokenizer(lang).tokenize(code)) {
    if (t.type === "string" || t.type === "comment") mask.fill(1, pos, pos + t.text.length);
    pos += t.text.length;
  }
  return pos === code.length ? mask : null;
}

// --- JSON ------------------------------------------------------------------------------
function formatJson(code: string, unit: string): string {
  try {
    return JSON.stringify(JSON.parse(code), null, unit);
  } catch {
    return reindentBraces(code, "json", unit);
  }
}

// --- brace languages: re-indent by bracket depth ---------------------------------------
function reindentBraces(code: string, lang: string, unit: string): string {
  const mask = literalMask(code, lang);
  if (!mask) return code;
  const lines = code.split("\n");
  const out: string[] = [];
  const stack: number[] = []; // per source line: how many of its brackets are still open
  const closeOne = () => { if (stack.length) { stack[stack.length - 1] -= 1; if (stack[stack.length - 1] <= 0) stack.pop(); } };
  let offset = 0;
  let ctrl = false; // previous line was `if (...)` / `else` / `for (...)` with no `{`
  const isCss = lang === "css";
  for (const line of lines) {
    const start = offset;
    offset += line.length + 1;
    if (start > 0 && mask[start - 1] === 1 && line.length > 0 && mask[start] === 1) { out.push(line); continue; } // inside a multi-line string/comment
    const lead = line.length - line.trimStart().length;
    const body = line.trim();
    if (!body) { out.push(""); continue; }
    let closers = 0;
    while (closers < body.length && "}])".includes(body[closers]) && !mask[start + lead + closers]) { closeOne(); closers += 1; }
    let level = stack.length;
    if (ctrl && !body.startsWith("{")) level += 1;
    out.push(unit.repeat(level) + body);
    let cur = 0;
    let net = 0;
    let codeOnly = "";
    for (let i = closers; i < body.length; i += 1) {
      if (mask[start + lead + i]) continue;
      const ch = body[i];
      codeOnly += ch;
      if ("{[(".includes(ch)) { cur += 1; net += 1; }
      else if ("}])".includes(ch)) { net -= 1; if (cur > 0) cur -= 1; else closeOne(); }
    }
    if (cur > 0) stack.push(cur);
    const t = codeOnly.trim();
    ctrl = !isCss && net === 0 && (/^(if|for|foreach|while)\b[^;{]*\)$/.test(t) || /^(else|else\s+if\b[^;{]*\)|do)$/.test(t) || /^\}\s*else(\s+if\b[^;{]*\))?$/.test(t));
  }
  return out.join("\n");
}

// --- Python ----------------------------------------------------------------------------
function formatPython(code: string, unit: string): string {
  const mask = literalMask(code, "python");
  if (!mask) return code;
  const lines = code.replace(/\t/g, "    ").split("\n");
  // The mask was built on the tab-expanded text length only if there were no tabs; rebuild it.
  const m2 = code.includes("\t") ? literalMask(lines.join("\n"), "python") : mask;
  if (!m2) return code;
  const out: string[] = [];
  const stack: number[] = [];
  let offset = 0;
  let bracket = 0;
  let stmtLevel = 0;
  let backslash = false;
  for (const line of lines) {
    const start = offset;
    offset += line.length + 1;
    if (start > 0 && m2[start - 1] === 1 && line.length > 0 && m2[start] === 1) { out.push(line); continue; }
    const lead = line.length - line.trimStart().length;
    const body = line.trim();
    if (!body) { out.push(""); continue; }
    let level: number;
    if (bracket > 0 || backslash) {
      const closer = bracket > 0 && "}])".includes(body[0]);
      level = stmtLevel + (closer ? 0 : 1);
    } else {
      const w = lead;
      const comment = body.startsWith("#");
      if (comment) {
        level = Math.max(0, stack.filter((s) => s <= w).length - 1);
      } else {
        if (!stack.length || w > stack[stack.length - 1]) stack.push(w);
        else {
          while (stack.length && stack[stack.length - 1] > w) stack.pop();
          if (!stack.length || stack[stack.length - 1] < w) stack.push(w);
        }
        level = stack.length - 1;
        stmtLevel = level;
      }
    }
    out.push(unit.repeat(level) + body);
    backslash = false;
    for (let i = 0; i < body.length; i += 1) {
      if (m2[start + lead + i]) continue;
      const ch = body[i];
      if ("{[(".includes(ch)) bracket += 1;
      else if ("}])".includes(ch)) bracket = Math.max(0, bracket - 1);
    }
    if (bracket === 0 && /\\$/.test(body) && !m2[start + lead + body.length - 1]) backslash = true;
  }
  return out.join("\n");
}

// --- HTML ------------------------------------------------------------------------------
const VOID = new Set("area base br col embed hr img input link meta param source track wbr".split(" "));
const RAW = new Set(["script", "style", "pre", "textarea"]);

function formatMarkup(code: string, unit: string): string {
  const toks = code.match(/<!--[\s\S]*?-->|<![^>]*>|<\?[\s\S]*?\?>|<\/?[A-Za-z][^>]*>|[^<]+|</g) ?? [];
  const lines: string[] = [];
  let depth = 0;
  const push = (s: string) => lines.push(unit.repeat(Math.max(0, depth)) + s);
  const tagName = (t: string) => /^<\/?([A-Za-z][\w:-]*)/.exec(t)?.[1].toLowerCase() ?? "";
  const clean = (t: string) => t.replace(/\s+/g, " ").replace(/\s+(\/?>)$/, "$1");
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i];
    if (!t.startsWith("<") || t === "<") {
      const text = t.replace(/\s+/g, " ").trim();
      if (text) push(text);
      continue;
    }
    if (t.startsWith("<!--") || t.startsWith("<!") || t.startsWith("<?")) { push(t.startsWith("<!--") ? t : clean(t)); continue; }
    const name = tagName(t);
    if (t.startsWith("</")) { depth -= 1; push(clean(t)); continue; }
    const selfClosing = /\/>$/.test(t) || VOID.has(name);
    if (selfClosing) { push(clean(t)); continue; }
    if (RAW.has(name)) {
      let j = i + 1;
      let inner = "";
      while (j < toks.length && !(toks[j].toLowerCase().startsWith(`</${name}`))) { inner += toks[j]; j += 1; }
      const close = toks[j] ?? `</${name}>`;
      if (name === "pre" || name === "textarea") push(clean(t) + inner + close.trim());
      else {
        const sub = inner.trim() ? formatCode(inner, name === "script" ? "javascript" : "css", { indent: unit }).code : "";
        push(clean(t));
        if (sub) { depth += 1; sub.split("\n").forEach((l) => push(l)); depth -= 1; }
        push(close.trim());
      }
      i = j;
      continue;
    }
    // <p>text</p> stays on one line
    const next = toks[i + 1];
    const after = toks[i + 2];
    if (next !== undefined && after !== undefined && !next.startsWith("<") && after.startsWith("</") && tagName(after) === name) {
      const text = next.replace(/\s+/g, " ").trim();
      if (text.length <= 80) { push(clean(t) + text + clean(after)); i += 2; continue; }
    }
    if (next !== undefined && next.startsWith("</") && tagName(next) === name) { push(clean(t) + clean(next)); i += 1; continue; }
    push(clean(t));
    depth += 1;
  }
  return lines.join("\n");
}

// --- SQL -------------------------------------------------------------------------------
const SQL_CLAUSES = new Set(["SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "UNION", "UNION ALL", "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "CREATE TABLE", "ALTER TABLE", "DROP TABLE", "JOIN", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL JOIN", "CROSS JOIN", "LEFT OUTER JOIN", "RIGHT OUTER JOIN", "FULL OUTER JOIN"]);
const SQL_LIST_CLAUSES = new Set(["SELECT", "SET", "GROUP BY", "ORDER BY"]);

function formatSql(code: string, unit: string): string {
  const spec = getLanguage("sql");
  const kw = new Set([...spec.keywords, ...(spec.types ?? [])].map((k) => k.toLowerCase()));
  type It = { text: string; kind: "word" | "kw" | "lit" | "lc" | "op" };
  const items: It[] = [];
  for (const t of getTokenizer("sql").tokenize(code)) {
    if (t.type === "string") items.push({ text: t.text, kind: "lit" });
    else if (t.type === "comment") items.push({ text: t.text.trim(), kind: t.text.trimStart().startsWith("--") ? "lc" : "lit" });
    else for (const m of t.text.match(/[A-Za-z_][\w$]*|\d[\w.]*|[<>=!]+|\|\||[^\sA-Za-z_\d]/g) ?? []) {
      if (/^[A-Za-z_]/.test(m)) items.push(kw.has(m.toLowerCase()) ? { text: m.toUpperCase(), kind: "kw" } : { text: m, kind: "word" });
      else items.push({ text: m, kind: /^\d/.test(m) ? "word" : "op" });
    }
  }
  const upper = (i: number) => (items[i]?.kind === "kw" ? items[i].text : "");
  let out = "";
  let pd = 0;
  let clause = "";
  let createTable = false;
  let prev = null as It | null;
  const atLineStart = () => out === "" || out.endsWith("\n");
  const nl = (indent = 0) => { out = out.replace(/[ \t]+$/, ""); if (!atLineStart()) out += "\n"; out += unit.repeat(indent); prev = null; };
  const emit = (it: It) => {
    let gap = " ";
    if (!prev || atLineStart()) gap = "";
    else if (it.text === "," || it.text === ";" || it.text === ")" || it.text === "." || prev.text === "(" || prev.text === "." || it.kind === "lc") gap = it.kind === "lc" ? " " : "";
    else if (it.text === "(" && prev.kind === "word") gap = "";
    out += gap + it.text;
    prev = it;
  };
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    if (it.kind === "kw" && pd === 0) {
      const two = `${it.text} ${upper(i + 1)}`.trim();
      const three = `${two} ${upper(i + 2)}`.trim();
      const key = SQL_CLAUSES.has(three) ? three : SQL_CLAUSES.has(two) ? two : SQL_CLAUSES.has(it.text) ? it.text : "";
      const joinMod = /^(INNER|LEFT|RIGHT|FULL|CROSS|OUTER)$/.test(it.text) && /JOIN/.test(three);
      if (key || joinMod) {
        const words = key ? key.split(" ").length : (three.includes("OUTER") ? 3 : 2);
        const phrase = key || three.split(" ").slice(0, words).join(" ");
        if (!(prev && /^(INNER|LEFT|RIGHT|FULL|CROSS|OUTER)$/.test(prev.text))) nl();
        for (let k = 0; k < words; k += 1) emit(items[i + k]);
        i += words - 1;
        clause = phrase.replace(/ OUTER| INNER| LEFT| RIGHT| FULL| CROSS/g, "");
        createTable = createTable || phrase === "CREATE TABLE";
        if (SQL_LIST_CLAUSES.has(phrase)) { /* first column stays on the clause line */ }
        continue;
      }
      if ((it.text === "AND" || it.text === "OR") && (clause === "WHERE" || clause === "HAVING" || /JOIN/.test(clause))) { nl(1); emit(it); continue; }
    }
    if (it.text === "(") {
      pd += 1; emit(it);
      if (createTable && pd === 1) nl(1);
      continue;
    }
    if (it.text === ")") {
      if (createTable && pd === 1) { pd -= 1; nl(); emit(it); continue; }
      pd = Math.max(0, pd - 1); emit(it); continue;
    }
    if (it.text === ",") {
      emit(it);
      if (pd === 0 && SQL_LIST_CLAUSES.has(clause)) nl(1);
      else if (pd === 1 && createTable) nl(1);
      continue;
    }
    if (it.text === ";") { emit(it); out += "\n\n"; prev = null; clause = ""; createTable = false; pd = 0; continue; }
    emit(it);
    if (it.kind === "lc") nl();
  }
  return out.trim();
}

// --- Bash ------------------------------------------------------------------------------
function formatBash(code: string, unit: string): string {
  const mask = literalMask(code, "bash");
  const lines = code.split("\n");
  const out: string[] = [];
  let depth = 0;
  let inCase = 0;
  let offset = 0;
  for (const line of lines) {
    const start = offset;
    offset += line.length + 1;
    if (mask && start > 0 && mask[start - 1] === 1 && line.length > 0 && mask[start] === 1) { out.push(line); continue; }
    const body = line.trim();
    if (!body) { out.push(""); continue; }
    const first = body.split(/[\s;]/)[0];
    const code0 = body.replace(/#.*$/, "").trim();
    let level = depth;
    if (/^(fi|done|esac|\})$/.test(first)) level = Math.max(0, depth - 1);
    else if (/^(else|elif)$/.test(first)) level = Math.max(0, depth - 1);
    else if (inCase && /^;;$/.test(code0)) level = depth;
    out.push(unit.repeat(level) + body);
    let delta = 0;
    if (/^(fi|done|esac|\})$/.test(first)) delta -= 1;
    if (/^(if|elif)\b.*(;\s*then|^then)?$/.test(code0) && /\bthen$/.test(code0) && first !== "fi") delta += first === "elif" ? 1 : 1;
    else if (first === "then") delta += 1;
    if (first === "else") delta += 1;
    if (/^(for|while|until|select)\b/.test(first) && /\bdo$/.test(code0)) delta += 1;
    else if (first === "do") delta += 1;
    if (/^case\b.*\bin$/.test(code0)) { delta += 1; inCase += 1; }
    if (/\{$/.test(code0) && first !== "}") delta += 1;
    if (first === "esac") inCase = Math.max(0, inCase - 1);
    if (first === "elif") delta += 0;
    depth = Math.max(0, depth + delta);
  }
  return out.join("\n");
}
