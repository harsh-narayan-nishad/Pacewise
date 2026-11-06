/** Backend-sync tests (plain Node):  npx tsx scripts/backendsync.test.ts */
import assert from "node:assert/strict";
import { mayPush } from "../lib/api/syncPolicy";
import { isTrivial, SyncingKeyValueStore } from "../lib/api/SyncingKeyValueStore";
import { MemoryKeyValueStore } from "../lib/session/storage/KeyValueStore";
import { devDataStore } from "../lib/devData/store";

let passed = 0;
function t(name: string, fn: () => void) { fn(); passed += 1; console.log("ok -", name); }

t("mayPush: own records only; recipient may update a notification", () => {
  assert.equal(mayPush("u1", "reactions", "r", { userId: "u1" }), true);
  assert.equal(mayPush("u1", "reactions", "r", { userId: "u2" }), false);
  assert.equal(mayPush("u1", "shares", "s", { senderId: "u1", receiverId: "u2" }), true);
  assert.equal(mayPush("u2", "notifications", "n", { senderId: "u1", recipientId: "u2" }), true);
  assert.equal(mayPush("u3", "notifications", "n", { senderId: "u1", recipientId: "u2" }), false);
  assert.equal(mayPush("u1", "avatars", "u1", {}), true);
  assert.equal(mayPush("u1", "avatars", "u2", {}), false);
});

t("isTrivial recognises empty defaults but not real data", () => {
  for (const raw of ["[]", "{}", "null", '{"count":0,"lastReadDate":null}']) assert.equal(isTrivial(raw), true, raw);
  for (const raw of ['[{"a":1}]', '{"count":3,"lastReadDate":"2026-11-05"}']) assert.equal(isTrivial(raw), false, raw);
});

t("reconcile uploads real local data and restores missing data from the server", () => {
  const inner = new MemoryKeyValueStore();
  const s = new SyncingKeyValueStore(inner);
  inner.setItem("srt:v2:u:user-1:history", '[{"id":"h1"}]');
  inner.setItem("srt:v2:u:user-1:streak", '{"count":0,"lastReadDate":null}');
  const restored = s.reconcile("user-1", { streak: { value: { count: 4, lastReadDate: "2026-11-05" } }, bookmarks: { value: ["A"] } });
  assert.equal(restored, true);
  assert.equal(inner.getItem("srt:v2:u:user-1:history"), '[{"id":"h1"}]'); // local kept
  assert.deepEqual(JSON.parse(inner.getItem("srt:v2:u:user-1:streak") as string), { count: 4, lastReadDate: "2026-11-05" }); // trivial local replaced
  assert.deepEqual(JSON.parse(inner.getItem("srt:v2:u:user-1:bookmarks") as string), ["A"]);
});

t("store: local changes are announced; server snapshots merge without echo", () => {
  let changes = 0;
  const off = devDataStore.onLocalChange(() => { changes += 1; });
  devDataStore.login("user-001", (devDataStore.listUsers().find((u) => u.id === "user-001") as { password: string }).password);
  assert.ok(changes >= 1);
  const before = changes;
  devDataStore.applyServerSnapshot({
    upserts: { reactions: [{ id: "reaction-x", contentId: "c1", userId: "user-002", type: "like", createdAt: "2026-11-05T00:00:00Z" }] },
    deletes: {},
  });
  assert.equal(changes, before, "server data must not be echoed back");
  assert.equal(devDataStore.syncCollections().reactions.some((r) => r.id === "reaction-x"), true);
  devDataStore.applyServerSnapshot({ upserts: {}, deletes: { reactions: ["reaction-x"] } });
  assert.equal(devDataStore.syncCollections().reactions.some((r) => r.id === "reaction-x"), false);
  off();
});

console.log(`\n${passed} passed`);
