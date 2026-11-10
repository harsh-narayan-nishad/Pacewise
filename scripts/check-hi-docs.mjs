// Checks every docs/**/*.hi.md (Hindi version) against its English file, so the two stay structurally identical:
// same headings (levels and count, so section links keep working), same code blocks, includes, links and table rows.
//   node scripts/check-hi-docs.mjs                       all Hindi files that exist
//   node scripts/check-hi-docs.mjs docs/a.hi.md ...      only these
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "docs");
const args = process.argv.slice(2);
const files = [];
(function walk(dir) {
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith(".hi.md")) files.push(p);
  }
})(root);
const targets = args.length ? args.map((a) => join(process.cwd(), a)) : files;

const strip = (s) => s.replace(/\r\n?/g, "\n");
/** Splits a doc into prose lines and fenced blocks (opening line normalised: principle / note text may be translated). */
function parse(md) {
  const lines = strip(md).split("\n");
  const fences = [], headings = [], includes = [], links = [], images = [], embeds = [];
  let tableLines = 0, fenced = false, buf = [], open = "";
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (!fenced) { fenced = true; open = line.replace(/(principle|note)="[^"]*"/g, '$1=""'); buf = []; }
      else { fenced = false; fences.push(open + "\n" + buf.join("\n")); }
      continue;
    }
    if (fenced) { buf.push(line); continue; }
    const h = line.match(/^(#{1,6})\s+/);
    if (h) headings.push(h[1].length);
    if (/^\s*::include\s/.test(line)) includes.push(line.trim());
    if (/^\s*::linkedin\s/.test(line)) embeds.push(line.trim());
    if (/^\s*\|/.test(line)) tableLines++;
    for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) (m[0].startsWith("](/") && /^\s*!\[/.test(line) ? images : links).push(m[1]);
  }
  return { fences, headings, includes, links: links.sort(), images, embeds, tableLines, unclosed: fenced };
}

let bad = 0;
for (const hiPath of targets) {
  const enPath = hiPath.replace(/\.hi\.md$/, ".md");
  const problems = [];
  if (!existsSync(enPath)) problems.push("no English file next to it");
  else {
    const en = parse(readFileSync(enPath, "utf8"));
    const hiText = readFileSync(hiPath, "utf8");
    const hi = parse(hiText);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (hi.unclosed) problems.push("a code fence is not closed");
    if (!same(en.headings, hi.headings)) problems.push(`headings differ: English levels [${en.headings}] vs Hindi [${hi.headings}]`);
    if (en.fences.length !== hi.fences.length) problems.push(`code blocks: ${en.fences.length} in English, ${hi.fences.length} in Hindi`);
    else en.fences.forEach((f, i) => { if (f !== hi.fences[i]) problems.push(`code block #${i + 1} was changed (must be copied exactly; only principle="" / note="" text may be translated)`); });
    if (!same(en.includes, hi.includes)) problems.push("::include lines differ");
    if (!same(en.embeds, hi.embeds)) problems.push("::linkedin lines differ");
    if (!same(en.links, hi.links)) problems.push("link targets differ (keep every ](target) exactly)");
    if (!same(en.images, hi.images)) problems.push("image targets differ");
    if (en.tableLines !== hi.tableLines) problems.push(`table lines: ${en.tableLines} in English, ${hi.tableLines} in Hindi`);
    const dev = (hiText.match(/[ऀ-ॿ]/g) ?? []).length;
    const latinWords = (strip(hiText).replace(/```[\s\S]*?```/g, "").match(/[A-Za-z]{4,}/g) ?? []).length;
    if (dev < 20 && statSync(enPath).size > 400) problems.push("hardly any Hindi (Devanagari) text");
    if (statSync(enPath).size > 3000 && latinWords > dev / 2) problems.push("looks mostly untranslated (too many English words outside code)");
  }
  if (problems.length) { bad++; console.log(`FAIL ${hiPath.replace(process.cwd() + "/", "")}\n  - ${problems.join("\n  - ")}`); }
  else console.log(`ok   ${hiPath.replace(process.cwd() + "/", "")}`);
}
console.log(bad ? `\n${bad} file(s) need fixing` : `\nall ${targets.length} Hindi file(s) match their English structure`);
process.exit(bad ? 1 : 0);
