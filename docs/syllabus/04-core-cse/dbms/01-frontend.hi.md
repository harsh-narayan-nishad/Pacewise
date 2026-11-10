# Frontend

**DBMS · Frontend।** Web app browser में अपना एक छोटा database रखता है, और फिर backend के ज़रिए उसे MongoDB में copy करता है। ज़्यादातर database concepts (tables, keys, constraints, indexes, transactions, change tracking) client पर भी दिखते हैं।

## Browser का "database"
| Layer | यह क्या है | Code |
|---|---|---|
| Storage engine | `localStorage`, एक key-value store | `lib/session/storage/KeyValueStore.ts` |
| Namespacing | Key format `srt:v2:u:<userId>:<feature>`; इसमें `v2` **schema version** है | `UserNamespace` |
| Tables (repositories) | History, streak, daily activity, bookmarks, achievements, custom stories, search history, time logs | `lib/session/repositories/*` |
| Social tables | `reactions`, `comments`, `commentReactions`, `shares`, `saves`, `playlists`, `playlistRelationships`, `follows`, `notifications`, `avatars` | `lib/devData/store.ts` |
| Docs search | Build time पर बना index, जो सिर्फ़ तब load होता है जब search box इस्तेमाल हो | `lib/docs/search.generated.ts` |

## Keys, constraints, relations
- हर record का एक **id** (primary key) होता है। नए ids में एक random हिस्सा होता है ताकि दो browsers कभी एक ही id न बनाएँ।
- **Convention से foreign keys**: comment में `contentId` और `userId` होते हैं; `localStorage` में इसे कोई enforce नहीं करता, इसलिए store के methods करते हैं (यानी **code में लिखा constraint**)।
- **Uniqueness**: हर user की एक story पर एक ही reaction। `setReaction` दूसरी row जोड़ने की जगह मौजूदा row को replace करता है, यही नियम backend unique index से enforce करता है।
- **Many-to-many**: `playlistRelationships` playlists और stories के बीच की **join table** है।
- **Cascade**: किसी comment को delete करने पर उस पर लगे reactions भी हट जाते हैं (यह store के delete method में होता है)।

## Transactions और consistency
- एक user action कई records बदलता है (जैसे "like" एक reaction update करता है और एक notification बनाता है)। Store पहले memory बदलता है और **एक बार save** करता है, इसलिए stored snapshot कभी आधा-अधूरा update नहीं होता; यह एक छोटा all-or-nothing step है।
- अगर save fail हो जाए (storage full), तो session के लिए memory सही रहती है; data durable नहीं होता, इसीलिए backend वाली copy ज़रूरी है।

## MongoDB में Replication (change data capture)
1. Sync layer एक **baseline** रखती है: हर record के लिए वह JSON जो server के पास पहले से है।
2. हर local change के बाद वह मौजूदा data को baseline से **diff** करती है: नए या बदले हुए records `put` बनते हैं, गायब records `delete` बनते हैं।
3. सिर्फ़ वही records भेजे जाते हैं जिनका owner user है; server दोबारा check करता है (**authorisation**)।
4. हर 15 s पर वह `snapshot?since=N` fetch करती है, जो एक **log-based read** है (`N` एक sequence number है, log offset जैसा), और उसे merge कर लेती है, वापस भेजे बिना।
5. Deletions **tombstones** के रूप में जाते हैं, वरना कोई दूसरा device कभी जान ही नहीं पाएगा कि कुछ हटाया गया है।
6. Conflicts में **last write wins** चलता है: सरल है, पर offline रहकर एक ही record edit करने वाले दो devices के लिए safe नहीं है।

## Idempotency और retries
Reading-time events में एक unique id होती है; server वह id store करता है और दोहराए गए events को ignore करता है, इसलिए जो request जवाब खो जाने के बाद retry हुई, वह सिर्फ़ एक बार गिनी जाती है। इसी तरह at-least-once delivery के ऊपर **exactly-once effect** बनाया जाता है।

## Derived data
Streaks store नहीं होते; server प्रति दिन के minutes store करता है और उन्हीं से current streak, longest streak और active days compute करता है। Facts store करना और numbers derive करना इसका मतलब है कि rule बदलने पर migration की ज़रूरत नहीं पड़ती।

## Schema evolution
Key में `v2` एक version है। नए layout को नया prefix और एक बार चलने वाला migration मिलता है, यानी वही काम जो database migration script करती है। Backend से पहली बार link होने पर हर feature के लिए reconcile भी होता है: जो इस browser के पास है उसे upload करो, जो सिर्फ़ server के पास है उसे restore करो।

## आपसे पूछे जा सकने वाले सवाल
- जब store में कोई constraints नहीं हैं, तब आप unique constraint कैसे enforce करेंगे?
- Tombstone क्या है? सीधे delete क्यों नहीं कर देते?
- दो devices के बीच conflict आप कैसे resolve करेंगे?
- Streak का number store करने की जगह प्रति दिन के minutes क्यों store करें?
