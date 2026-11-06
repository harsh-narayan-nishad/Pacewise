/**
 * Writes the demo accounts to ../speed-reader-backend/seed/demo-users.json so
 * the backend's `npm run seed` can create them in MongoDB with the SAME ids
 * ("user-001"…), usernames and passwords the login screen already uses.
 *   npx tsx scripts/export-demo-users.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SEED_USERS } from "../lib/devData/seedUsers";

const out = resolve(process.argv[2] ?? "../speed-reader-backend/seed/demo-users.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(SEED_USERS.map(({ id, name, username, password, interests }) => ({ id, name, username, password, interests })), null, 2) + "\n");
console.log(`Wrote ${SEED_USERS.length} demo users to ${out}`);
