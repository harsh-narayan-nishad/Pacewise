// Copies the pdf.js worker into /public so it is served as a plain static file
// (never bundled or minified by Next). Runs automatically before `dev` and `build`.
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
];
const from = candidates.map((c) => resolve(root, c)).find(existsSync);
if (!from) {
  console.warn("[copy-pdf-worker] pdfjs-dist worker not found - run `npm install` first. PDF upload will not work until it is copied.");
  process.exit(0);
}
mkdirSync(resolve(root, "public"), { recursive: true });
copyFileSync(from, resolve(root, "public/pdf.worker.min.mjs"));
// A second copy named after the installed version. The flip book reader loads this one, so an old
// public/pdf.worker.min.mjs left over from another pdfjs-dist version can never be picked up by mistake.
try {
  const version = JSON.parse(readFileSync(resolve(root, "node_modules/pdfjs-dist/package.json"), "utf8")).version;
  copyFileSync(from, resolve(root, `public/pdf.worker-${version}.min.mjs`));
} catch {
  /* the unversioned copy above still exists */
}
console.log("[copy-pdf-worker] copied", from.replace(root + "/", ""), "-> public/pdf.worker.min.mjs");
// The flip book reader also wants the pdf.js character maps and standard fonts (for PDFs that do not embed their fonts).
const pkgRoot = resolve(root, "node_modules/pdfjs-dist");
for (const dir of ["cmaps", "standard_fonts"]) {
  if (existsSync(resolve(pkgRoot, dir))) cpSync(resolve(pkgRoot, dir), resolve(root, "public/pdfjs", dir), { recursive: true });
}
