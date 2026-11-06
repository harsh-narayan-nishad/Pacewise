# Frontend

**DBMS · Frontend.** The web app keeps its own small database in the browser, then copies it to MongoDB through the backend. Most database ideas (tables, keys, constraints, indexes, transactions, change tracking) appear on the client too.

## The browser's "database"
| Layer | What it is | Code |
|---|---|---|
| Storage engine | `localStorage`, a key-value store | `lib/session/storage/KeyValueStore.ts` |
| Namespacing | Key format `srt:v2:u:<userId>:<feature>`; the `v2` is the **schema version** | `UserNamespace` |
| Tables (repositories) | History, streak, daily activity, bookmarks, achievements, custom stories, search history, time logs | `lib/session/repositories/*` |
| Social tables | `reactions`, `comments`, `commentReactions`, `shares`, `saves`, `playlists`, `playlistRelationships`, `follows`, `notifications`, `avatars` | `lib/devData/store.ts` |
| Docs search | An index built at build time, loaded only when the search box is used | `lib/docs/search.generated.ts` |

## Keys, constraints, relations
- Every record has an **id** (primary key). New ids contain a random part so two browsers never create the same id.
- **Foreign keys by convention**: a comment holds `contentId` and `userId`; nothing in `localStorage` enforces it, so the store's methods do (a **constraint written in code**).
- **Uniqueness**: one reaction per user per story. `setReaction` replaces the existing row instead of adding a second, the same rule the backend enforces with a unique index.
- **Many-to-many**: `playlistRelationships` is a **join table** between playlists and stories.
- **Cascade**: deleting a comment also removes the reactions on it (done in the store's delete method).

## Transactions and consistency
- One user action changes several records (for example "like" updates a reaction and creates a notification). The store changes memory first and **saves once**, so the stored snapshot is never half-updated; this is a small all-or-nothing step.
- If saving fails (storage full), memory stays correct for the session; the data is not durable, which is why the backend copy matters.

## Replication to MongoDB (change data capture)
1. The sync layer keeps a **baseline**: for every record, the JSON the server already has.
2. After every local change it **diffs** current data against the baseline: new or changed records become `put`, missing ones become `delete`.
3. Only records the user owns are sent; the server checks again (**authorisation**).
4. Every 15 s it fetches `snapshot?since=N`, a **log-based read** (`N` is a sequence number, like a log offset), and merges it in without sending it back.
5. Deletions travel as **tombstones**, otherwise another device could never learn that something was removed.
6. Conflicts use **last write wins**: simple, and not safe for two devices editing the same record offline.

## Idempotency and retries
Reading-time events carry a unique id; the server stores the id and ignores repeats, so a request that was retried after a lost answer is counted once. This is how **exactly-once effect** is built on top of at-least-once delivery.

## Derived data
Streaks are not stored; the server stores minutes per day and computes current streak, longest streak and active days from them. Storing facts and deriving numbers means a rule change needs no migration.

## Schema evolution
The `v2` in the key is a version. A new layout gets a new prefix and a one-time migration, the same job as a database migration script. The first link to the backend also reconciles per feature: upload what this browser has, restore what only the server has.

## Questions you can be asked
- How do you enforce a unique constraint when the store has no constraints?
- What is a tombstone? Why not just delete?
- How would you resolve a conflict between two devices?
- Why store minutes per day instead of the streak number?
