import { LanguageSpec, Tokenizer } from "@/lib/editor/code/Tokenizer";

const C_PAIRS = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" } as const;
const CLIKE = { lineComment: "//", blockComment: ["/*", "*/"] as const, strings: ['"', "'"], pairs: C_PAIRS, indentAfter: ["{", "(", "["] };

export const LANGUAGES: readonly LanguageSpec[] = [
  { id: "plaintext", label: "Plain text", keywords: [], strings: [], pairs: C_PAIRS },
  { id: "javascript", label: "JavaScript", ...CLIKE, strings: ['"', "'", "`"], keywords: "async await break case catch class const continue debugger default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while with yield".split(" ") },
  { id: "typescript", label: "TypeScript", ...CLIKE, strings: ['"', "'", "`"], keywords: "abstract any as async await boolean break case catch class const constructor continue declare default delete do else enum export extends false finally for from function get if implements import in infer instanceof interface is keyof let namespace never new null number of private protected public readonly return set static string super switch this throw true try type typeof undefined unknown var void while yield".split(" ") },
  { id: "python", label: "Python", lineComment: "#", blockComment: null, strings: ['"""', "'''", '"', "'"], pairs: C_PAIRS, indentAfter: [":"], keywords: "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield self print".split(" ") },
  { id: "java", label: "Java", ...CLIKE, keywords: "abstract assert boolean break byte case catch char class const continue default do double else enum extends false final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch synchronized this throw throws true try var void volatile while".split(" ") },
  { id: "c", label: "C", ...CLIKE, keywords: "auto break case char const continue default do double else enum extern float for goto if include inline int long register return short signed sizeof static struct switch typedef union unsigned void volatile while define NULL".split(" ") },
  { id: "cpp", label: "C++", ...CLIKE, keywords: "alignas auto bool break case catch char class const constexpr continue default delete do double else enum explicit extern false float for friend if include inline int long namespace new noexcept nullptr operator private protected public return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while".split(" ") },
  { id: "csharp", label: "C#", ...CLIKE, keywords: "abstract as async await base bool break byte case catch char class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sealed short static string struct switch this throw true try typeof uint ulong using var virtual void while".split(" ") },
  { id: "go", label: "Go", ...CLIKE, strings: ['"', "'", "`"], keywords: "break case chan const continue default defer else fallthrough false for func go goto if import interface map nil package range return select struct switch true type var".split(" ") },
  { id: "rust", label: "Rust", ...CLIKE, keywords: "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while".split(" ") },
  { id: "php", label: "PHP", lineComment: "//", blockComment: ["/*", "*/"], strings: ['"', "'"], pairs: C_PAIRS, indentAfter: ["{", "(", "["], keywords: "abstract and array as break case catch class clone const continue default do echo else elseif empty extends false final finally for foreach function global if implements include interface isset namespace new null or print private protected public require return static switch this throw trait true try use var while".split(" ") },
  { id: "html", label: "HTML", markup: true, lineComment: null, blockComment: ["<!--", "-->"], strings: ['"', "'"], keywords: [], pairs: { ...C_PAIRS, "<": ">" }, indentAfter: [">"] },
  { id: "css", label: "CSS", lineComment: null, blockComment: ["/*", "*/"], strings: ['"', "'"], pairs: C_PAIRS, indentAfter: ["{"], keywords: "important media import font-face keyframes".split(" ") },
  { id: "json", label: "JSON", lineComment: null, blockComment: null, strings: ['"'], pairs: C_PAIRS, indentAfter: ["{", "["], keywords: ["true", "false", "null"] },
  { id: "sql", label: "SQL", lineComment: "--", blockComment: ["/*", "*/"], strings: ["'", '"'], caseInsensitive: true, pairs: C_PAIRS, indentAfter: ["("], keywords: "select from where and or not insert into values update set delete create table alter drop index primary key foreign references join inner left right outer on group by order having limit offset as distinct union all null is in like between exists case when then else end begin commit rollback transaction default unique check".split(" "), types: "int integer bigint varchar text boolean date timestamp serial numeric decimal float".split(" ") },
  { id: "bash", label: "Bash", lineComment: "#", blockComment: null, strings: ['"', "'"], pairs: C_PAIRS, indentAfter: ["{", "then", "do"], keywords: "if then else elif fi for while do done case esac function in return exit export local echo cd ls cat grep sed awk sudo".split(" ") },
  { id: "markdown", label: "Markdown", lineComment: null, blockComment: null, strings: [], pairs: { "(": ")", "[": "]", "`": "`", "*": "*" }, keywords: [] },
];

const byId = new Map(LANGUAGES.map((l) => [l.id, l]));
const cache = new Map<string, Tokenizer>();

/** Common fence / file-extension names that should resolve to a supported language. */
export const LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", node: "javascript", ts: "typescript", tsx: "typescript",
  py: "python", python3: "python", "c++": "cpp", cc: "cpp", cxx: "cpp", "c#": "csharp", cs: "csharp",
  golang: "go", rs: "rust", sh: "bash", shell: "bash", zsh: "bash", md: "markdown", htm: "html", xml: "html",
  text: "plaintext", txt: "plaintext", "": "plaintext", postgres: "sql", mysql: "sql",
};

export function getLanguage(id: string): LanguageSpec {
  const key = (id ?? "").toLowerCase().trim();
  return byId.get(key) ?? byId.get(LANGUAGE_ALIASES[key] ?? "") ?? byId.get("plaintext")!;
}
export function getTokenizer(id: string): Tokenizer {
  const spec = getLanguage(id);
  let t = cache.get(spec.id);
  if (!t) { t = new Tokenizer(spec); cache.set(spec.id, t); }
  return t;
}
