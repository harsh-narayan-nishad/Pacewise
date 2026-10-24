import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { RichDocument } from "../lib/editor/model/RichDocument";
import { ExporterRegistry } from "../lib/editor/export/ExporterRegistry";
import { MarkdownImporter, TextImporter, ImporterRegistry } from "../lib/editor/import/Importers";
import { crc32 } from "../lib/editor/util/crc32";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n`, e); process.exitCode = 1; }
}

const SAMPLE =
  '<h1>Title</h1><p>Hello <strong>bold</strong> and <em>it</em> <a href="https://x.dev">link</a><script>alert(1)</script></p>' +
  '<ul><li>a<ul><li>nested</li></ul></li><li>b</li></ul><ol><li>one</li><li>two</li></ol>' +
  '<pre data-lang="python"><code>def f(x):\n    return x &lt; 2\n</code></pre>' +
  '<table><tr><th>H</th><th>I</th></tr><tr><td colspan="2" style="background-color:#ff0">wide</td></tr></table><hr class="sr-pagebreak"><p>after</p>';

test("crc32 known vector", () => assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926));
test("sanitizes on construction", () => assert.ok(!RichDocument.fromHtml(SAMPLE).html.includes("script")));
test("code block survives", () => {
  const c = RichDocument.fromHtml(SAMPLE).blocks.find((b) => b.kind === "code");
  assert.ok(c && (c as any).code === "def f(x):\n    return x < 2" && (c as any).language === "python");
});
test("stats", () => {
  const s = RichDocument.fromHtml(SAMPLE).stats;
  assert.equal(s.codeBlocks, 1); assert.ok(s.words > 8);
});
test("snapshot round trip", () => {
  const d = RichDocument.fromHtml(SAMPLE);
  assert.equal(RichDocument.fromSnapshot(JSON.parse(JSON.stringify(d.snapshot())))!.html, d.html);
  assert.equal(RichDocument.fromSnapshot({ v: 2 }), null);
});
test("malicious snapshot is sanitized", () => {
  const d = RichDocument.fromSnapshot({ v: 1, html: '<img src=x onerror=alert(1)><a href="javascript:1">x</a>' })!;
  assert.ok(!/onerror|javascript/.test(d.html));
});
test("markdown export", () => {
  const md = new ExporterRegistry().get("md").export(RichDocument.fromHtml(SAMPLE)).data as string;
  assert.ok(md.includes("# Title") && md.includes("**bold**") && md.includes("```python") && md.includes("  - nested") && md.includes("[link](https://x.dev)"));
});
test("markdown round trip keeps code", () => {
  const md = new ExporterRegistry().get("md").export(RichDocument.fromHtml(SAMPLE)).data as string;
  const back = new MarkdownImporter().import(md, "t");
  assert.ok(back.blocks.some((b) => b.kind === "code" && (b as any).code.includes("return x < 2")));
});
test("text import paragraphs", () => assert.equal(new TextImporter().import("a\n\nb\nc", "t").toReadingParagraphs().length, 2));
test("reading paragraphs", () => assert.ok(RichDocument.fromHtml(SAMPLE).toReadingParagraphs().includes("after")));
test("importer registry", () => assert.ok(new ImporterRegistry().forFilename("x.MD")));

const docx = new ExporterRegistry().get("docx").export(RichDocument.fromHtml(SAMPLE).withMeta({ title: "T & Co" }));
writeFileSync(process.argv[2] ?? (process.env.TMPDIR ?? "/tmp") + "/editor-sample.docx", docx.data as Uint8Array);

import { getTokenizer, getLanguage } from "../lib/editor/code/languages";
import { CodeEditingEngine } from "../lib/editor/code/CodeEditingEngine";
{
  const eng = (id: string, indent = "  ") => new CodeEditingEngine({ indent, lang: getLanguage(id) });
  test("tokenizer is lossless for all languages", () => {
    const src = 'const a = "x\\"y"; // c\n/* b */ if (a) { return 0x1F + 2.5; }\n`t`\n<a href=\'q\'>def</a> -- s\n"""z';
    for (const id of ["javascript", "python", "html", "sql", "bash", "rust", "markdown", "json", "css"]) {
      assert.equal(getTokenizer(id).tokenize(src).map((t) => t.text).join(""), src, id);
    }
  });
  test("tokenizer classifies", () => {
    const t = getTokenizer("javascript").tokenize('return "s" // c');
    assert.deepEqual(t.filter((x) => x.type !== "plain").map((x) => x.type), ["keyword", "string", "comment"]);
  });
  test("enter auto-indents inside braces", () => {
    const r = eng("javascript").enter({ value: "if (x) {}", start: 8, end: 8 });
    assert.equal(r.value, "if (x) {\n  \n}");
    assert.equal(r.start, 11);
  });
  test("python indents after colon", () => {
    assert.equal(eng("python", "    ").enter({ value: "def f():", start: 8, end: 8 }).value, "def f():\n    ");
  });
  test("tab / shift+tab multi-line", () => {
    const e = eng("javascript");
    const a = e.tab({ value: "a\nb", start: 0, end: 3 }, false);
    assert.equal(a.value, "  a\n  b");
    assert.equal(e.tab({ value: a.value, start: 0, end: a.value.length }, true).value, "a\nb");
  });
  test("bracket pairing, step-over, backspace", () => {
    const e = eng("javascript");
    const p = e.type({ value: "", start: 0, end: 0 }, "(")!;
    assert.equal(p.value, "()");
    assert.equal(e.type(p, ")")!.start, 2);
    assert.equal(e.backspace(p)!.value, "");
    assert.equal(e.type({ value: "don", start: 3, end: 3 }, "'"), null);
  });
  test("toggle comment + fold", () => {
    const e = eng("javascript");
    const c = e.toggleComment({ value: "a\nb", start: 0, end: 3 });
    assert.equal(c.value, "// a\n// b");
    assert.equal(e.toggleComment({ ...c, start: 0, end: c.value.length }).value, "a\nb");
    assert.deepEqual(e.foldRanges("f {\n a\n b\n}"), [[0, 3]]);
  });
}

import { DocumentStore, VersionConflictError } from "../lib/editor/persistence/DocumentStore";
import { EditLock } from "../lib/editor/persistence/EditLock";
import { AutosaveScheduler } from "../lib/editor/persistence/AutosaveScheduler";
import { MemoryKeyValueStore } from "../lib/session/storage/KeyValueStore";
import { UserNamespace } from "../lib/session/UserNamespace";
import { LruCache } from "../lib/editor/util/LruCache";
{
  const kv = new MemoryKeyValueStore();
  const a = new DocumentStore(kv, UserNamespace.forUser("alice"));
  const b = new DocumentStore(kv, UserNamespace.forUser("bob"));
  test("documents are isolated per user", () => {
    const id = a.newId();
    a.save(id, RichDocument.fromHtml("<p>secret</p>"), null);
    assert.equal(a.list().length, 1);
    assert.equal(b.list().length, 0);
    assert.equal(b.load(id), null);
  });
  test("optimistic version check", () => {
    const id = a.list()[0].id;
    a.save(id, RichDocument.fromHtml("<p>v2</p>"), 1);
    assert.throws(() => a.save(id, RichDocument.fromHtml("<p>stale</p>"), 1), VersionConflictError);
  });
  test("tampered storage is re-sanitized on load", () => {
    const id = a.list()[0].id;
    const key = UserNamespace.forUser("alice").key(`docs:body:${id}`);
    const snap = JSON.parse(kv.getItem(key)!); snap.html = '<p onclick="x()">hi</p><script>1</script>';
    kv.setItem(key, JSON.stringify(snap));
    const fresh = new DocumentStore(kv, UserNamespace.forUser("alice"));
    assert.ok(!/onclick|script/.test(fresh.load(id)!.html));
  });
  test("image dedup + GC", async () => {
    const url = "data:image/png;base64,AAAA";
    const i1 = await a.putImage(url); const i2 = await a.putImage(url);
    assert.equal(i1, i2);
    const id = a.newId();
    a.save(id, RichDocument.fromHtml(`<p><img src="sr-img:${i1}"></p>`), null);
    assert.equal(a.collectGarbage(), 0);
    a.remove(id);
    assert.equal(a.getImage(i1), null);
  });
  test("repair removes orphan index rows", () => {
    const id = a.list()[0].id;
    kv.removeItem(UserNamespace.forUser("alice").key(`docs:body:${id}`));
    assert.equal(a.repair(), 1);
  });
  test("save rolls back when index write fails", () => {
    class Full extends MemoryKeyValueStore { setItem(k: string, v: string) { if (k.endsWith("docs:index")) throw new Error("quota"); super.setItem(k, v); } }
    const s = new DocumentStore(new Full(), UserNamespace.forUser("z"));
    assert.throws(() => s.save("d1", RichDocument.fromHtml("<p>x</p>"), null));
    assert.equal(s.load("d1"), null);
  });
  test("edit lock excludes a second tab, lease expires", () => {
    let t = 0; const now = () => t;
    const l1 = new EditLock(kv, "lock", 1000, now), l2 = new EditLock(kv, "lock", 1000, now);
    assert.ok(l1.acquire()); assert.ok(!l2.acquire());
    t = 2000; assert.ok(l2.acquire());
    l1.release(); l2.release();
  });
  test("LRU evicts least recently used", () => {
    const c = new LruCache<string, number>(2); c.set("a", 1); c.set("b", 2); c.get("a"); c.set("c", 3);
    assert.equal(c.get("b"), undefined); assert.equal(c.get("a"), 1);
  });
  test("autosave debounces and flushes", async () => {
    const writes: number[] = []; const st: string[] = [];
    const s = new AutosaveScheduler<number>((v) => writes.push(v), (x) => st.push(x), 20);
    s.schedule(1); s.schedule(2); s.schedule(3);
    await new Promise((r) => setTimeout(r, 60));
    assert.deepEqual(writes, [3]); assert.equal(st[st.length - 1], "saved");
    s.schedule(4); s.flush(); assert.deepEqual(writes, [3, 4]);
  });
}
setTimeout(() => console.log(`\n${passed} tests passed${process.exitCode ? " (WITH FAILURES)" : ""}`), 150);

import { renderTexLite } from "../lib/editor/format/TexLite";
import { HistoryStack } from "../components/Editor/engine/HistoryStack";
test("tex-lite", () => {
  assert.equal(renderTexLite("x^2 + \\alpha_1"), "x² + α₁");
  assert.equal(renderTexLite("\\frac{a}{b}"), "(a)/(b)");
});
test("history stack", () => {
  const h = new HistoryStack(); h.reset({ html: "a", selStart: 0, selEnd: 0 });
  h.push({ html: "b", selStart: 0, selEnd: 0 }); h.push({ html: "b", selStart: 0, selEnd: 0 });
  assert.equal(h.undo()!.html, "a"); assert.equal(h.redo()!.html, "b"); assert.ok(!h.canRedo);
});
test("language aliases", () => { assert.equal(getLanguage("JS").id, "javascript"); assert.equal(getLanguage("c++").id, "cpp"); assert.equal(getLanguage("nope").id, "plaintext"); });

import { docFromStory, storyPartsFromDoc } from "../lib/editor/storyBridge";
test("story bridge: rich snapshot reused only while in sync", () => {
  const d = RichDocument.fromHtml("<h1>T</h1><p>one</p><pre data-lang=\"js\"><code>x=1</code></pre>");
  const parts = storyPartsFromDoc(d);
  assert.deepEqual(parts.story.map((p) => p.paragraph), ["T", "one", "x=1"]);
  assert.equal(docFromStory({ story: parts.story, richDocument: parts.richDocument }).html, d.html);
  const stale = docFromStory({ story: [{ paragraph: "changed" }], richDocument: parts.richDocument });
  assert.deepEqual(stale.toReadingParagraphs(), ["changed"]);
});

import { parseQuestionsInput, questionsToJson, isCompleteQuestion } from "../lib/questionImport";
import { StoryContentRenderer, isNeutralColor } from "../lib/editor/reader/StoryContentRenderer";
import { createStoreImageResolver } from "../lib/editor/reader/imageResolver";
import { richDocFor } from "../lib/editor/storyBridge";
{
  const ok = '[{"question":"Q1?","options":["a","b","c"],"correctAnswer":2,"explanation":"e"}]';
  test("questions: array, wrapped object and fenced JSON", () => {
    assert.equal(parseQuestionsInput(ok).questions[0].correctAnswer, 2);
    assert.equal(parseQuestionsInput(`{"title":"T","questions":${ok}}`).questions.length, 1);
    assert.equal(parseQuestionsInput("```json\n" + ok + "\n```").questions.length, 1);
    assert.equal(parseQuestionsInput("").issues.length, 0);
  });
  test("questions: answer as letter / text / aliases", () => {
    const mk = (a: string) => `[{"q":"Q?","choices":["x","Yes","z"],"answer":${a},"rationale":"r"}]`;
    assert.equal(parseQuestionsInput(mk('"B"')).questions[0].correctAnswer, 1);
    assert.equal(parseQuestionsInput(mk('"yes"')).questions[0].correctAnswer, 1);
    assert.equal(parseQuestionsInput(mk("0")).questions[0].correctAnswer, 0);
  });
  test("questions: precise errors, nothing guessed", () => {
    const r = parseQuestionsInput('[{"question":"","options":["a"],"correctAnswer":5},{"question":"ok","options":["a","b"],"correctAnswer":9,"explanation":"e"}, 7]');
    assert.equal(r.questions.length, 0);
    assert.ok(r.issues[0].startsWith("Question 1:") && r.issues[0].includes("at least 2 options"));
    assert.ok(r.issues[1].includes("doesn't match an option") && r.issues[2].startsWith("Question 3"));
    assert.ok(parseQuestionsInput("{bad").issues[0].includes("valid JSON"));
    assert.ok(parseQuestionsInput('[{"question":"q","options":["a","A"],"correctAnswer":0,"explanation":"e"}]').issues[0].includes("duplicate"));
  });
  test("questions: round trip + completeness", () => {
    const q = parseQuestionsInput(ok).questions;
    assert.deepEqual(parseQuestionsInput(questionsToJson(q)).questions, q);
    assert.equal(questionsToJson([{ question: "", options: ["", ""], correctAnswer: 0, explanation: "" }]), "");
    assert.ok(isCompleteQuestion(q[0]) && !isCompleteQuestion({ ...q[0], explanation: " " }));
  });
  const img = "data:image/png;base64,AAAA";
  const kv2 = new MemoryKeyValueStore();
  const mine = UserNamespace.forUser("me"), other = UserNamespace.forUser("other");
  kv2.setItem(other.key("docs:img:abc123"), img);
  kv2.setItem(mine.key("docs:img:evil"), "javascript:alert(1)");
  const render = (html: string) => new StoryContentRenderer(createStoreImageResolver(kv2, mine)).render(RichDocument.fromHtml(html));
  test("reader renders images (own + adopted-from-other-user), blocks tampered ones", () => {
    const out = render('<p>a</p><figure class="sr-figure"><img src="sr-img:abc123" alt="pic" width="40"><figcaption>cap</figcaption></figure><img src="sr-img:evil"><img src="sr-img:gone" alt="lost">');
    assert.ok(out.includes('src="data:image/png;base64,AAAA"') && out.includes("cap"));
    assert.ok(!out.includes("javascript") && out.includes("Image unavailable: lost"));
  });
  test("reader highlights code and drops neutral colours, keeps chromatic", () => {
    const out = render('<pre data-lang="js"><code>const x = "s"; // c</code></pre><p><span style="color:#000000">k</span><span style="color:#e5484d;background-color:#ffffff">r</span></p>');
    assert.ok(out.includes('class="sr-tk-keyword"') && out.includes('class="sr-tk-string"') && out.includes('data-lang="javascript"'));
    assert.ok(!out.includes("#000000") && out.includes("#e5484d") && !out.includes("#ffffff"));
    assert.ok(isNeutralColor("rgb(30,30,30)") && !isNeutralColor("#0091ff"));
  });
  test("reader output is XSS-safe even from a hostile snapshot", () => {
    const d = RichDocument.fromSnapshot({ v: 1, html: '<p onclick=x()>hi</p><pre data-lang="js"><code>&lt;/code&gt;&lt;script&gt;1&lt;/script&gt;</code></pre><a href="javascript:1">l</a>' })!;
    const out = new StoryContentRenderer(() => null).render(d);
    assert.ok(!/<script|onclick|javascript:/i.test(out), out);
  });
  test("richDocFor only when snapshot matches the paragraphs", () => {
    const d = RichDocument.fromHtml("<p>one</p><p>two</p>");
    const story = { story: [{ paragraph: "one" }, { paragraph: "two" }], richDocument: d.snapshot() };
    assert.ok(richDocFor(story)); assert.equal(richDocFor({ ...story, story: [{ paragraph: "x" }] }), null);
  });
  test("GC keeps images referenced by a saved story", async () => {
    const s = new DocumentStore(kv2, mine);
    const id = await s.putImage("data:image/png;base64,BBBB");
    kv2.setItem(mine.key("customStories"), JSON.stringify([{ richDocument: { html: `<img src="sr-img:${id}">` } }]));
    assert.equal(s.collectGarbage() >= 0, true);
    assert.ok(s.getImage(id));
    kv2.removeItem(mine.key("customStories"));
    s.collectGarbage(); assert.equal(s.getImage(id), null);
  });
}

import { looksLikeCode, looksLikeCollapsedCode, guessLanguage, dedent, splitFences } from "../lib/editor/code/CodeHeuristics";
import { beautifyIfCollapsed } from "../lib/editor/reader/CodeFormatter";
{
  test("code heuristics: code yes, prose no", () => {
    assert.ok(looksLikeCode("def add(a, b):\n    return a + b\n"));
    assert.ok(looksLikeCode("for (int i = 0; i < n; i++) {\n  sum += i;\n}"));
    assert.ok(looksLikeCode("SELECT id, name\nFROM users\nWHERE id = 1;"));
    assert.ok(!looksLikeCode("The quick brown fox jumps over the lazy dog.\nIt was a bright day in April, and the clocks were striking thirteen."));
    assert.ok(!looksLikeCode("Hello world"));
  });
  test("language guess", () => {
    assert.equal(guessLanguage("def f(x):\n    return x"), "python");
    assert.equal(guessLanguage('public class A { public static void main(String[] a) { System.out.println(1); } }'), "java");
    assert.equal(guessLanguage("#include <stdio.h>\nint main(){return 0;}"), "c");
    assert.equal(guessLanguage("#include <iostream>\nint main(){ std::cout << 1; }"), "cpp");
    assert.equal(guessLanguage('{"a": [1,2]}'), "json");
    assert.equal(guessLanguage("const x = (a) => a + 1;\nconsole.log(x(1));"), "javascript");
    assert.equal(guessLanguage("SELECT * FROM t;"), "sql");
  });
  test("dedent + fences", () => {
    assert.equal(dedent("\n    a\n      b\n    c\n\n"), "a\n  b\nc");
    const segs = splitFences("intro\n```python\nx = 1\n```\nafter");
    assert.deepEqual(segs.map((s) => [s.kind, s.lang ?? ""]), [["text", ""], ["code", "python"], ["text", ""]]);
    assert.equal(splitFences("```js\nunclosed();")[0].text, "unclosed();");
  });
  test("beautify: collapsed C-like code gets IDE-style indentation", () => {
    const out = beautifyIfCollapsed('public class A { static int f(int n) { int s = 0; for (int i = 0; i < n; i++) { s += i; } if (s > 3) { return s; } else { return 0; } } }', "java");
    assert.equal(out, [
      "public class A {", "    static int f(int n) {", "        int s = 0;", "        for (int i = 0; i < n; i++) {",
      "            s += i;", "        }", "        if (s > 3) {", "            return s;", "        } else {", "            return 0;", "        }", "    }", "}",
    ].join("\n"));
    assert.equal(beautifyIfCollapsed('function f(){ const s = "a;{b}"; // c;{\n return s; }', "javascript").includes('"a;{b}"'), true);
    assert.equal(beautifyIfCollapsed('{"a":1,"b":[1,2]}', "json"), '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
    const already = "if (x) {\n  y();\n}";
    assert.equal(beautifyIfCollapsed(already, "javascript"), already);
    assert.ok(looksLikeCollapsedCode("function f(){ var a = 1; if (a) { return a; } return 0; }"));
  });
}

import { plainStoryToHtml } from "../lib/editor/reader/plainStoryHtml";
import { StoryContentRenderer as SCR } from "../lib/editor/reader/StoryContentRenderer";
{
  test("reader: plain paragraphs with code render as multi-line <pre>, prose untouched", () => {
    assert.equal(plainStoryToHtml(["Just a normal sentence.", "Another one."]), null);
    const html = plainStoryToHtml(["Intro text.", "def f(x):\n    if x:\n        return 1\n    return 0", "```js\nfunction a() {\n  return 1;\n}\n```"])!;
    const out = new SCR(() => null).render(RichDocument.fromHtml(html));
    assert.equal((out.match(/<pre class="sr-code"/g) ?? []).length, 2);
    assert.ok(out.includes("\n        ") && out.includes('data-lang="python"') && out.includes('data-lang="javascript"'));
    assert.ok(out.includes("<p>Intro text.</p>"));
  });
  test("reader: collapsed one-line rich code block is re-flowed", () => {
    const html = '<pre data-lang="java"><code>class A { void f() { int a = 1; if (a > 0) { a++; } } }</code></pre>';
    const out = new SCR(() => null).render(RichDocument.fromHtml(html));
    assert.ok(out.split("\n").length >= 6 && /\n    {1,}void f\(\)/.test(out.replace(/<[^>]+>/g, "")));
  });
}

import { formatCode } from "../lib/editor/code/formatCode";
{
  const f = (c: string, l: string) => formatCode(c, l).code;
  test("format: JS/Java messy indentation + collapsed", () => {
    assert.equal(f("function a(x){\nif(x){\n      return 1;\n}\n  else\nreturn 2;\n}", "javascript"), "function a(x){\n  if(x){\n    return 1;\n  }\n  else\n    return 2;\n}");
    assert.equal(f('const s = `a\n   b {`;\nfoo({\n a: 1,\n});', "javascript"), 'const s = `a\n   b {`;\nfoo({\n  a: 1,\n});');
    assert.ok(f("class A { void f() { int a = 1; } }", "java").includes("\n    void f() {\n        int a = 1;\n    }\n}"));
  });
  test("format: idempotent for every language", () => {
    const samples: [string, string][] = [
      ["javascript", "function a(x) {\n  if (x) {\n    return [1,\n      2];\n  }\n}"], ["python", "def f(x):\n    if x:\n        return (1,\n            2)\n    return 0"],
      ["json", '{"a":[1,2],"b":{"c":null}}'], ["html", "<div><p>Hi</p><ul><li>a</li><li>b</li></ul></div>"],
      ["sql", "select a, b from t where x = 1 and y = 2 order by a"], ["bash", "if [ -f x ]; then\necho a\nelse\necho b\nfi"],
      ["css", "a{color:red;margin:0}"], ["go", "func main() {\nfmt.Println(1)\n}"], ["rust", "fn main() {\nlet x = 1;\n}"], ["cpp", "int main(){\nreturn 0;\n}"],
    ];
    for (const [l, c] of samples) { const once = f(c, l); assert.equal(f(once, l), once, l); }
  });
  test("format: python re-indents tabs/2-space, keeps strings", () => {
    assert.equal(f("def f(x):\n  if x:\n\treturn '''a\n   b'''\n  return 0", "python"), "def f(x):\n    if x:\n        return '''a\n   b'''\n    return 0");
  });
  test("format: html / sql / json / bash", () => {
    assert.equal(f("<div><p>Hi</p><ul><li>a</li></ul></div>", "html"), "<div>\n  <p>Hi</p>\n  <ul>\n    <li>a</li>\n  </ul>\n</div>");
    assert.equal(f("select a, b from t join u on t.id=u.id where x = 1 and y = 'a and b' order by a", "sql"), "SELECT a,\n    b\nFROM t\nJOIN u ON t.id = u.id\nWHERE x = 1\n    AND y = 'a and b'\nORDER BY a");
    assert.equal(f('{"a":[1,2]}', "json"), '{\n    "a": [\n        1,\n        2\n    ]\n}'.replace(/    /g, "  "));
    assert.equal(f("if [ -f x ]; then\necho a\nfi", "bash"), "if [ -f x ]; then\n    echo a\nfi");
  });
  test("format: plaintext guesses language; empty/never loses code", () => {
    assert.equal(formatCode("def f(x):\n return x", "plaintext").lang, "python");
    assert.equal(f("   \n", "java"), "");
    assert.ok(f("a = ((", "python").includes("a = (("));
  });
}

{
  test("format: single-line code with // comments and lost newlines (the screenshot case)", () => {
    const a = formatCode("Map<Integer, Deque<Party>> bySize;   // size -> FIFO of waiting parties", "plaintext");
    assert.equal(a.lang, "java");
    const b = formatCode("Party findBestParty(int capacity) {    // 1. exact match: the head of the bucket    Deque<Party> q = bySize.get(capacity);    if (q != null) {        return q.peek();    }    return null;}", "plaintext").code;
    assert.equal(b, "Party findBestParty(int capacity) {\n    // 1. exact match: the head of the bucket\n    Deque<Party> q = bySize.get(capacity);\n    if (q != null) {\n        return q.peek();\n    }\n    return null;\n}");
  });
}

import { articleProgress, timeLeftMs, easeToward } from "../lib/readingMode/progress";
{
  test("reading mode: progress is 0 at start, 1 at the end, monotonic", () => {
    const top = 300, h = 5000, vh = 900;
    assert.equal(articleProgress(0, vh, top, h), 0);
    assert.equal(articleProgress(top + h - vh, vh, top, h), 1);
    assert.equal(articleProgress(99999, vh, top, h), 1);
    let prev = -1;
    for (let y = 0; y <= top + h; y += 137) { const p = articleProgress(y, vh, top, h); assert.ok(p >= prev); prev = p; }
    assert.equal(articleProgress(500, vh, top, 0), 0);
  });
  test("reading mode: time left follows speed and progress; easing converges", () => {
    assert.equal(timeLeftMs(1000, 250, 0), 240_000);
    assert.equal(timeLeftMs(1000, 500, 0), 120_000);
    assert.equal(timeLeftMs(1000, 250, 0.5), 120_000);
    assert.equal(timeLeftMs(1000, 250, 1), 0);
    let c = 0; for (let i = 0; i < 200; i += 1) c = easeToward(c, 1000);
    assert.equal(c, 1000);
    assert.ok(easeToward(0, 1000) > 0 && easeToward(0, 1000) < 1000);
  });
}

import { remainingMs, wpmFromElapsed } from "../lib/readingMode/progress";
{
  test("reading mode clock: independent of scroll, counts real time; early submit recalculates wpm", () => {
    assert.equal(remainingMs(1000, 250, 0), 240_000);
    assert.equal(remainingMs(1000, 250, 60_000), 180_000);
    assert.equal(remainingMs(1000, 250, 999_999), 0);
    assert.equal(remainingMs(1000, 500, 60_000), 60_000);
    assert.equal(wpmFromElapsed(1000, 120_000), 500); // finished in 2 min instead of the 4 planned
    assert.equal(wpmFromElapsed(1000, 240_000), 250);
    assert.equal(wpmFromElapsed(0, 1000), 0);
  });
}
