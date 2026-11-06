# Flask backend

**DBMS · Flask backend.** Pacewise's data layer uses Express with Mongoose. This page shows the same design in Flask. Nothing here is built into Pacewise yet.

## Two ways to build the data layer
| | MongoDB with PyMongo / MongoEngine | SQL with Flask-SQLAlchemy |
|---|---|---|
| Data shape | Documents, same collections as now | Tables with fixed columns, foreign keys, joins |
| Good for | Flexible, nested data (stories, playlists with items) | Strong relations and reporting |
| Migrations | Mostly none | Alembic migrations |
| Transactions | Multi-document needs a replica set (Atlas has one) | Built in, the default |

## The same operations in PyMongo
```python
# unique + TTL indexes (once, at start)
db.reactions.create_index([("storyId", 1), ("userId", 1)], unique=True)
db.refresh_tokens.create_index("expiresAt", expireAfterSeconds=0)

# like a story: create if missing, otherwise replace (atomic, one document)
db.reactions.update_one({"storyId": sid, "userId": uid}, {"$set": {"type": "LIKE"}}, upsert=True)

# add reading time (atomic increment)
db.daily_activity.update_one({"userId": uid, "day": day}, {"$inc": {"readMs": ms}}, upsert=True)

# idempotency: a duplicate key means "already applied"
try:
    db.applied_ops.insert_one({"_id": f"{uid}:{op_id}"})
except DuplicateKeyError:
    return  # skip
```

## Transactions
```python
with client.start_session() as s:
    s.with_transaction(lambda sess: (
        db.accounts.update_one({"_id": a}, {"$inc": {"bal": -x}}, session=sess),
        db.accounts.update_one({"_id": b}, {"$inc": {"bal": x}}, session=sess)))
```
Use a transaction only when several documents must change together. Pacewise avoids needing them by keeping related data in one document.

## Connection handling
- `MongoClient` is created **once per process** and reused (it has its own pool). With gunicorn it must be created after the fork (in the app factory), not at import time in the master.
- Use `maxPoolSize` so many workers do not exceed the database's connection limit: workers × pool size must stay below it.

## ORM versus plain driver
An ORM (SQLAlchemy, MongoEngine) maps classes to tables or documents and saves boilerplate; it can hide slow queries (the N+1 problem: one query per row in a loop). Check generated queries with `explain()` or SQL logging.

## What stays identical
Unique indexes enforce rules even when workers race; tombstones and a `seq` counter give `since=N` sync; streaks are computed from daily minutes; policy rules are a pure function.

## Questions you can be asked
- SQL or MongoDB for this app, and what would change?
- What is the N+1 problem?
- Why create the database client after the process forks?
- When do you need a multi-document transaction?
