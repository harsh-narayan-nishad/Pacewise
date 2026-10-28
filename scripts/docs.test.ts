/** npx tsx scripts/docs.test.ts — the docs renderer is safe and covers the Markdown the docs use. */
import assert from "node:assert/strict";
import { renderMarkdown } from "../lib/docs/markdown";
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
console.log(`\n${passed} tests passed`);
