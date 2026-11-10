# Flask backend

**DBMS · Flask backend।** Pacewise की data layer Express के साथ Mongoose इस्तेमाल करती है। यह page वही design Flask में दिखाता है। इसमें से अभी कुछ भी Pacewise में बना हुआ नहीं है।

## Data layer बनाने के दो तरीके
| | PyMongo / MongoEngine के साथ MongoDB | Flask-SQLAlchemy के साथ SQL |
|---|---|---|
| Data का shape | Documents, वही collections जो अभी हैं | Fixed columns, foreign keys, joins वाली tables |
| किसके लिए अच्छा | Flexible, nested data (stories, items वाली playlists) | मज़बूत relations और reporting |
| Migrations | ज़्यादातर नहीं | Alembic migrations |
| Transactions | Multi-document के लिए replica set चाहिए (Atlas में होता है) | Built in, default |

## PyMongo में वही operations
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
Transaction तभी इस्तेमाल करें जब कई documents को एक साथ बदलना ज़रूरी हो। Pacewise related data को एक document में रखकर इनकी ज़रूरत से बचता है।

## Connection handling
- `MongoClient` **हर process में एक बार** बनाया जाता है और दोबारा इस्तेमाल होता है (उसका अपना pool होता है)। gunicorn के साथ इसे fork के बाद (app factory में) बनाना चाहिए, master में import के समय नहीं।
- `maxPoolSize` इस्तेमाल करें ताकि कई workers database की connection limit पार न करें: workers × pool size उस limit से नीचे रहना चाहिए।

## ORM बनाम plain driver
ORM (SQLAlchemy, MongoEngine) classes को tables या documents से map करता है और boilerplate बचाता है; वह धीमी queries छिपा सकता है (N+1 problem: loop में हर row के लिए एक query)। Generated queries को `explain()` या SQL logging से जाँचें।

## क्या एक जैसा रहता है
Unique indexes workers में race होने पर भी नियम enforce करते हैं; tombstones और `seq` counter `since=N` sync देते हैं; streaks daily minutes से compute होते हैं; policy rules एक pure function हैं।

## आपसे पूछे जा सकने वाले सवाल
- इस app के लिए SQL या MongoDB, और क्या बदलेगा?
- N+1 problem क्या है?
- Database client को process के fork होने के बाद क्यों बनाएँ?
- Multi-document transaction की ज़रूरत कब पड़ती है?
