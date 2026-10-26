/** Reading-presence tests (fake clock, in-memory storage): npx tsx scripts/presence.test.ts */
import assert from "node:assert/strict";
import { ReadingPresence, PresenceStorage, formatReadingTotal } from "../lib/readingPresence";

class MemStore implements PresenceStorage {
  data = new Map<string, number>();
  load(u: string) { return this.data.get(u) ?? 0; }
  save(u: string, ms: number) { this.data.set(u, ms); }
}

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n`, e); process.exitCode = 1; }
}

function setup() {
  const store = new MemStore();
  const p = new ReadingPresence(store, { heartbeatMs: 5000, idleTimeoutMs: 60000 });
  p.setUser("u1");
  p.setSurface("article", true);
  return { store, p };
}

console.log("Reading presence");

test("active user on a reading surface accrues time and shows reading", () => {
  const { p } = setup();
  p.noteActivity(0); p.heartbeat(0);
  for (let t = 5000; t <= 30000; t += 5000) { p.noteActivity(t); p.heartbeat(t); }
  assert.equal(p.getSnapshot().status, "reading");
  assert.equal(p.getSnapshot().totalMs, 30000);
});

test("goes idle after the idle window and stops counting (like WhatsApp online)", () => {
  const { p } = setup();
  p.noteActivity(0); p.heartbeat(0); p.heartbeat(5000);
  for (let t = 10000; t <= 70000; t += 5000) p.heartbeat(t);
  assert.equal(p.getSnapshot().status, "idle");
  const total = p.getSnapshot().totalMs;
  p.heartbeat(75000);
  assert.equal(p.getSnapshot().totalMs, total);
});

test("activity brings reading status back", () => {
  const { p } = setup();
  p.noteActivity(0); p.heartbeat(0);
  p.heartbeat(100000);
  assert.equal(p.getSnapshot().status, "idle");
  p.noteActivity(101000); p.heartbeat(101000);
  assert.equal(p.getSnapshot().status, "reading");
});

test("hidden tab or leaving the surface stops reading immediately", () => {
  const { p } = setup();
  p.noteActivity(0); p.heartbeat(0); p.heartbeat(5000);
  p.setVisible(false); p.heartbeat(10000);
  assert.equal(p.getSnapshot().status, "idle");
  p.setVisible(true); p.noteActivity(11000); p.heartbeat(11000);
  assert.equal(p.getSnapshot().status, "reading");
  p.setSurface("article", false); p.heartbeat(16000);
  assert.equal(p.getSnapshot().status, "idle");
});

test("a long gap (sleep) adds at most two beats", () => {
  const { p } = setup();
  p.noteActivity(0); p.heartbeat(0);
  p.noteActivity(50000); p.heartbeat(50000);
  assert.equal(p.getSnapshot().totalMs, 10000);
});

test("totals are per user and persisted", () => {
  const { p, store } = setup();
  p.noteActivity(0); p.heartbeat(0); p.noteActivity(5000); p.heartbeat(5000);
  p.setUser("u2");
  assert.equal(p.getSnapshot().totalMs, 0);
  assert.equal(store.data.get("u1"), 5000);
  p.setUser("u1");
  assert.equal(p.getSnapshot().totalMs, 5000);
});

test("signed-out never reads", () => {
  const { p } = setup();
  p.setUser(null); p.noteActivity(0); p.heartbeat(0);
  assert.equal(p.getSnapshot().status, "idle");
});

test("format", () => {
  assert.equal(formatReadingTotal(0), "0 min");
  assert.equal(formatReadingTotal(42 * 60000), "42 min");
  assert.equal(formatReadingTotal(65 * 60000), "1h 05m");
});

console.log(`\n${passed} tests passed${process.exitCode ? " (with failures)" : ""}`);
