# Express backend

**DBMS · Express backend।** Pacewise API (Express + TypeScript + MongoDB) DBMS concepts का इस्तेमाल कैसे करती है।

## Model: documents, rows नहीं
Relational table हर row में एक जैसे columns रखने को मजबूर करती है और read के समय tables को join करती है। MongoDB **documents** (JSON जैसे, flexible) को **collections** में store करता है। Pacewise इसे इसलिए इस्तेमाल करता है क्योंकि data स्वाभाविक रूप से nested है और उसका shape बदलता रहता है: एक story में paragraphs, questions और media होते हैं; एक playlist अपने items की list खुद रखती है।

| Collection | क्या रखती है | मुख्य बातें |
|---|---|---|
| `users` | accounts | unique `email` और `username` |
| `refreshtokens` | हर device sign-in के लिए एक | unique `token`; automatic expiry (TTL index) |
| `stories` | stories | `authorId`, `tags`, `createdAt` पर index |
| `reactions`, `shares`, `bookmarks`, `follows` | native social records | unique compound indexes duplicates रोकते हैं |
| `playlists` | embedded `items` वाली playlist | embedding से join बच जाता है |
| `syncrecords` | web app जो भी like, comment, save, follow, notification भेजता है | `_id = "collection:recordId"`, index `(coll, seq)` |
| `dailyactivities` | हर user के लिए हर दिन एक row | unique `(userId, day)`; streaks का स्रोत |
| `itemtimes` | हर story या doc पर reading time | unique `(userId, kind, itemId)` |
| `userblobs` | हर user की saved lists (history, bookmarks ...) | `rev` counter |

## Keys और indexes
- `_id` एक string है (UUID, या demo users के लिए `user-009`), ताकि API responses में वही `id` रहे जो app पहले से इस्तेमाल करता है।
- **Unique index** database द्वारा enforce किया गया constraint है, इसलिए यह तब भी सही रहता है जब दो servers में race हो।
- **Compound index** `(userId, day)` बिना scan किए "इस user के दिन" और "इस user का इस दिन" दोनों को serve करता है।
- **TTL index** पुराने documents को अपने आप delete कर देता है (refresh tokens, याद रखे गए event ids)।
- Index के बिना MongoDB पूरी collection scan करता है; index के साथ वह सीधे matches तक पहुँच जाता है (B-tree, O(log n))।

## Atomicity और consistency (व्यवहार में ACID)
- **एक document** पर write atomic होता है। Design जहाँ हो सके, related data को एक document में रखता है (playlist और उसके items), ताकि transaction की ज़रूरत न पड़े।
- `updateOne(..., { $inc: ... }, { upsert: true })` का मतलब है "न हो तो बनाओ, वरना जोड़ दो", एक ही step में। Reading time इसी तरह जोड़ा जाता है; दो devices एक साथ report करें तो दोनों गिने जाते हैं।
- `Reaction` में `(story, user)` पर upsert होता है: dislike की हालत में like करने पर वही एक row replace हो जाती है।
- MongoDB में multi-document transactions होते हैं पर यहाँ इस्तेमाल नहीं किए गए। इसकी कीमत यह है कि कुछ multi-step actions all-or-nothing नहीं हैं ("Honest limits" देखें)।

## Idempotency: एक ही event दो बार नहीं गिना जाता
हर tracking event में एक unique `opId` होता है। Server एक छोटी collection में `userId:opId` insert करने की कोशिश करता है; duplicate-key error (code 11000) का मतलब है "पहले ही apply हो चुका", इसलिए event skip कर दिया जाता है। ये entries TTL index के ज़रिए सात दिन बाद expire हो जाती हैं। इसी तरह network का जवाब खो जाने के बाद हुआ retry भी सही रहता है।

## Streaks: derived data
Raw facts (प्रति दिन पढ़े गए minutes) store होते हैं; streak उन्हीं से **compute** होता है (`consistency.ts`)। Facts store करने और number derive करने का मतलब है कि rule बदलने पर (जैसे "1 minute भी active गिना जाए") कभी data migration नहीं करना पड़ता।

## Sync design: एक change log
`syncrecords` में हर write को एक atomic counter (`seq`) से अगला number मिलता है। Client कहता है "seq N के बाद का सब कुछ दो"। Deletions **tombstones** (`deleted: true`) के रूप में store होते हैं, वरना client कभी जान नहीं पाएगा कि कुछ हटाया गया है। यह वही idea है जो database के write-ahead log या Kafka offset में होता है, बस छोटे पैमाने पर।

## Data rule के रूप में Access control
Server हर collection के लिए तय करता है कि record का owner कौन है और उसे कौन पढ़ सकता है (`sync/policy.ts`)। Saves private रहते हैं, notifications अपने recipient को जाते हैं, public playlists सबको दिखती हैं। यह unit tests वाला एक pure function है, इसलिए नियमों की जाँच database के बिना हो जाती है।

## Normalisation बनाम embedding
| चुनाव | किसके लिए | Trade-off |
|---|---|---|
| Embed | Playlist के अंदर playlist items | एक ही read, पर बहुत बड़ी list से बहुत बड़ा document बन जाता है (limit 16 MB) |
| id से reference | Story का author, comment का user | दूसरा lookup चाहिए (एक batched `find ... $in` में हो जाता है) |

## Honest limits
- एक sync operation कई अलग-अलग writes है (record पढ़ो, number लो, उसे लिखो)। बीच में crash हो तो कोई number अनुपयोगी रह सकता है, जो हानिरहित है, पर batch all-or-nothing नहीं है।
- Last write wins: offline रहकर एक ही record edit करने वाले दो devices एक-दूसरे को overwrite कर देते हैं।
- Titles पर `$regex` search scan करता है; बड़े data के लिए text index (या Atlas Search) upgrade है।

## आपसे पूछे जा सकने वाले सवाल
- इस data के लिए SQL या NoSQL, और क्यों?
- Index की क्या कीमत होती है? Index कब नहीं जोड़ना चाहिए?
- Retry हुई request को safe कैसे बनाते हैं?
- Tombstone क्या है और इसकी ज़रूरत क्यों है?
- MongoDB में single-document write के लिए ACID क्या guarantee करता है?
