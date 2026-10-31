// Fails the build early if FOLDER_LABELS (lib/docs/library.ts) repeats a key.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../lib/docs/library.ts", import.meta.url), "utf8");
const m = src.match(/FOLDER_LABELS[^=]*=\s*\{([\s\S]*?)\n\};?/);
if (!m) { console.error("FOLDER_LABELS not found"); process.exit(1); }
const keys = [...m[1].matchAll(/^\s*("[^"]*"|[\w-]+)\s*:/gm)].map((x) => x[1].replace(/"/g, ""));
const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
if (dup.length) { console.error("Duplicate FOLDER_LABELS keys: " + [...new Set(dup)].join(", ")); process.exit(1); }
console.log(`FOLDER_LABELS ok (${keys.length} keys)`);
