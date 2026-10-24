// Copies the pdf.js worker into /public so it is served as a plain static file
// (never bundled or minified by Next). Runs automatically before `dev` and `build`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
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
console.log("[copy-pdf-worker] copied", from.replace(root + "/", ""), "-> public/pdf.worker.min.mjs");
