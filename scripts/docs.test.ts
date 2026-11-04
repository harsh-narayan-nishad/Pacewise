/** npx tsx scripts/docs.test.ts — the docs renderer is safe and covers the Markdown the docs use. */
import assert from "node:assert/strict";
import { extractHeadings, readingMinutes, renderMarkdown } from "../lib/docs/markdown";
import { DOCS } from "../lib/docs/generated";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { console.error(`FAIL  ${name}\n`, e); process.exitCode = 1; }
}

test("html in text is escaped", () => {
  const out = renderMarkdown("# Hi <script>alert(1)</script>\n\n<img src=x onerror=alert(1)> **b**");
  assert.ok(!/<script|<img/i.test(out));
  assert.ok(out.includes("&lt;script&gt;") && out.includes("<strong>b</strong>"));
});
test("javascript: links are dropped", () => {
  assert.ok(!renderMarkdown("[x](javascript:alert(1))").includes("href"));
});
test("tables, nested lists, code fences and quotes", () => {
  const out = renderMarkdown("| a | b |\n|---|---|\n| 1 | `x|y` |\n\n- one\n  - two\n- three\n\n```ts\nconst a = <b>;\n```\n\n> note");
  assert.ok(out.includes("<table>") && out.includes("<td>1</td>"));
  assert.ok(/<ul><li>one<ul><li>two<\/li><\/ul><\/li><li>three<\/li><\/ul>/.test(out));
  assert.ok(out.includes("&lt;b&gt;") && out.includes("<blockquote>"));
});
test("doc links are resolved", () => {
  const out = renderMarkdown("[a](OTHER.md#sec)", { resolveLink: (h) => (h.startsWith("OTHER.md") ? "/x" : null) });
  assert.ok(out.includes('href="/x"'));
});
test("every bundled doc renders, safely, and the credentials CSV is not bundled", () => {
  assert.ok(DOCS.length >= 20);
  for (const d of DOCS) {
    const html = renderMarkdown(d.md);
    assert.ok(html.length > 20, d.path);
    assert.ok(!/<script/i.test(html), d.path);
    assert.ok(!d.path.endsWith(".csv"));
  }
  assert.ok(!DOCS.some((d) => /4walnut\.zebra/.test(d.md)));
});
test("highlighter, underline, strike and bold-italic", () => {
  const out = renderMarkdown("This is ==key== and ==green:go== and ++under++ and ~~gone~~ and ***both***. a == b stays.");
  assert.ok(out.includes('<mark class="hl" data-c="yellow">key</mark>'));
  assert.ok(out.includes('data-c="green">go</mark>') && out.includes("<u>under</u>") && out.includes("<s>gone</s>") && out.includes("<strong><em>both</em></strong>"));
  assert.ok(out.includes("a == b stays"));
});
test("mermaid fences become diagram holders, headings get anchors", () => {
  const out = renderMarkdown("```mermaid\nclassDiagram\n  A <|-- B\n```\n\n## Part one");
  assert.ok(out.includes('class="doc-diagram" data-diagram="classDiagram'));
  assert.ok(out.includes('<a class="anchor" href="#part-one"'));
  assert.deepEqual(extractHeadings("# T\n## A b\n```\n## no\n```\n### C"), [{ level: 2, text: "A b", id: "a-b" }, { level: 3, text: "C", id: "c" }]);
  assert.equal(readingMinutes("word ".repeat(400)), 2);
});
test("captioned code blocks: path, language, coloured tokens, principle, indentation kept", () => {
  const md = '```ts title="lib/a.ts" principle="Encapsulation"\nclass A {\n  private x = 1; // note\n}\n```';
  const html = renderMarkdown(md);
  assert.match(html, /<figure class="doc-code">/);
  assert.match(html, /<span class="code-path">lib\/a\.ts<\/span>/);
  assert.match(html, /<span class="tk-k">class<\/span>/);
  assert.match(html, /<span class="tk-c">\/\/ note<\/span>/);
  assert.match(html, /\n  <span class="tk-k">private<\/span>/);
  assert.match(html, /Encapsulation/);
  assert.doesNotMatch(renderMarkdown('```ts title="<script>"\nx\n```'), /<script>/);
  assert.match(renderMarkdown("```\nplain\n```"), /^<pre data-lang="">/);
});
test("images (local only) and line breaks in table cells", () => {
  assert.match(renderMarkdown("![Cap](/docs/a.png)"), /<figure class="doc-figure"><a href="\/docs\/a\.png"[^>]*><img src="\/docs\/a\.png" alt="Cap"/);
  assert.doesNotMatch(renderMarkdown("![x](https://evil.test/a.png)"), /<img/);
  assert.match(renderMarkdown("| A |\n| --- |\n| one<br>two |"), /one<br \/>two/);
  assert.doesNotMatch(renderMarkdown("<img src=x onerror=1>"), /<img/);
});
test("LinkedIn embeds: only validated post ids", () => {
  assert.match(renderMarkdown('::linkedin urn:li:share:7521638052172288001 1699 "T"'), /<iframe src="https:\/\/www\.linkedin\.com\/embed\/feed\/update\/urn:li:share:7521638052172288001" height="1699"/);
  assert.doesNotMatch(renderMarkdown("::linkedin https://evil.test 1699"), /<iframe/);
});
test("html code blocks are coloured and keep indentation", () => {
  const h = renderMarkdown('```html title="index.html"\n<div class="a">\n  <p>Hi</p>\n</div>\n```');
  assert.match(h, /<span class="tk-k">&lt;div<\/span> <span class="tk-p">class<\/span>=<span class="tk-s">&quot;a&quot;<\/span><span class="tk-k">&gt;<\/span>\n  <span class="tk-k">&lt;p<\/span>/);
});
test("C++ and i++ are not underlined; sub / sup are allowed; other tags are not", () => {
  const h = renderMarkdown("C++17 and C++ code, i++ and j++. ++under++ works. n<sub>2</sub> x<sup>2</sup> <b>no</b>");
  assert.doesNotMatch(h, /<u>[^<]*(C\+\+|i\+\+)/);
  assert.match(h, /<u>under<\/u>/);
  assert.match(h, /n<sub>2<\/sub> x<sup>2<\/sup>/);
  assert.doesNotMatch(h, /<b>/);
});
test("DAA notes: C++ files are included from docs/daa-notes/cpp, with their output", () => {
  const daa = DOCS.filter((d) => d.folder === "daa-notes");
  assert.equal(daa.length, 7);
  assert.ok(daa.every((d) => !d.md.includes("::include")), "includes are expanded at build time");
  const u1 = daa.find((d) => d.path.includes("unit-1"))!;
  const h = renderMarkdown(u1.md);
  assert.match(h, /<span class="code-path">cpp\/[\w-]+\.cpp<\/span><span class="code-lang">cpp<\/span><button type="button" class="code-copy"/);
  assert.match(h, /<span class="code-path">Output<\/span>/);
});
console.log(`\n${passed} tests passed`);
