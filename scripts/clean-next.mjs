// Removes a stale `.next` folder before `next dev`. A leftover from a failed/partial
// `next build` (or an older Node/Next run) makes the dev server crash with
// "Cannot find module .next/server/middleware-manifest.json" and every page returns 500.
import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
rmSync(resolve(root, ".next"), { recursive: true, force: true });
console.log("[clean-next] cleared .next");
