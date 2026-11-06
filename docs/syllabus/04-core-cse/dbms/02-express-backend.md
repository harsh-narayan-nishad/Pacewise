# Express backend

**DBMS · Express backend.** How the Pacewise API (Express + TypeScript + MongoDB) uses DBMS concepts.

## Model: documents, not rows
A relational table forces every row to have the same columns and joins tables at read time. MongoDB stores **documents** (JSON-like, flexible) in **collections**. Pacewise uses it because the data is naturally nested and changes shape: a story has paragraphs, questions and media; a playlist holds its own list of items.

| Collection | Holds | Key points |
|---|---|---|
| `users` | accounts | unique `email` and `username` |
| `refreshtokens` | one per device sign-in | unique `token`; automatic expiry (TTL index) |
| `stories` | stories | index on `authorId`, `tags`, `createdAt` |
| `reactions`, `shares`, `bookmarks`, `follows` | native social records | unique compound indexes stop duplicates |
| `playlists` | playlist with embedded `items` | embedding avoids a join |
| `syncrecords` | every like, comment, save, follow, notification the web app sends | `_id = "collection:recordId"`, index `(coll, seq)` |
| `dailyactivities` | one row per user per day | unique `(userId, day)`; source of streaks |
| `itemtimes` | reading time per story or doc | unique `(userId, kind, itemId)` |
| `userblobs` | per-user saved lists (history, bookmarks ...) | `rev` counter |

## Keys and indexes
- `_id` is a string (a UUID, or `user-009` for demo users), so API responses keep the same `id` the app already uses.
- A **unique index** is a constraint enforced by the database, so it holds even if two servers race.
- A **compound index** `(userId, day)` serves "this user's days" and "this user on this day" without scanning.
- A **TTL index** deletes old documents by itself (refresh tokens, remembered event ids).
- Without an index MongoDB scans the whole collection; with one it jumps to the matches (B-tree, O(log n)).

## Atomicity and consistency (ACID in practice)
- A write to **one document** is atomic. The design keeps related data in one document where it can (a playlist and its items) so no transaction is needed.
- `updateOne(..., { $inc: ... }, { upsert: true })` is "create if missing, otherwise add", in one step. Reading time is added this way; two devices reporting at once both count.
- `Reaction` uses upsert on `(story, user)`: liking while disliked replaces the single row.
- Multi-document transactions exist in MongoDB but are not used here. The cost is that some multi-step actions are not all-or-nothing (see "Honest limits").

## Idempotency: the same event never counts twice
Each tracking event carries a unique `opId`. The server tries to insert `userId:opId` into a small collection; a duplicate-key error (code 11000) means "already applied", so the event is skipped. The entries expire after seven days through a TTL index. This is how a retry after a lost network answer stays correct.

## Streaks: derived data
Raw facts (minutes read per day) are stored; the streak is **computed** from them (`consistency.ts`). Storing the facts and deriving the number means a rule change (for example "1 minute counts as active") never needs a data migration.

## Sync design: a change log
Every write to `syncrecords` gets the next number from an atomic counter (`seq`). A client says "give me everything after seq N". Deletions are stored as **tombstones** (`deleted: true`), otherwise a client could never learn that something was removed. This is the same idea as a database write-ahead log or a Kafka offset, scaled down.

## Access control as a data rule
The server decides, per collection, who owns a record and who may read it (`sync/policy.ts`). Saves are private, notifications go to their recipient, public playlists are visible to all. It is a pure function with unit tests, so the rules are checked without a database.

## Normalisation vs embedding
| Choice | Used for | Trade-off |
|---|---|---|
| Embed | Playlist items inside the playlist | One read, but a huge list makes a huge document (limit 16 MB) |
| Reference by id | Story author, comment user | Needs a second lookup (done in one batched `find ... $in`) |

## Honest limits
- One sync operation is several separate writes (read record, take a number, write it). A crash in the middle can leave a number unused, which is harmless, but the batch is not all-or-nothing.
- Last write wins: two devices editing the same record offline overwrite each other.
- `$regex` search on titles scans; a text index (or Atlas Search) is the upgrade for large data.

## Questions you can be asked
- SQL or NoSQL for this data, and why?
- What does an index cost? When would you not add one?
- How do you make a retried request safe?
- What is a tombstone and why is it needed?
- What does ACID guarantee for a single-document write in MongoDB?
