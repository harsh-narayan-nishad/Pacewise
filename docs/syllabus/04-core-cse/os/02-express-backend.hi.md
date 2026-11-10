# Express backend

**Operating system · Express backend।** Pacewise API (Express + TypeScript + MongoDB) Operating system की अवधारणाओं का उपयोग कैसे करती है।

## एक process, एक event loop
Node.js आपका JavaScript एक **single thread** पर एक **event loop** के साथ चलाता है। जब कोई request MongoDB का इंतज़ार करती है, तब thread दूसरी requests को serve करता है। इसीलिए एक process हज़ारों connections संभाल लेता है, और इसीलिए एक धीमा synchronous task सबको रोक देता है।

| काम | कहाँ चलता है |
|---|---|
| JSON parse करना, routing, zod validation | Main thread (तेज़) |
| Network reads और writes (sockets) | Operating system की I/O notification (Linux पर epoll); thread को बताया जाता है कि data तैयार है |
| File system, DNS lookup, crypto | libuv का thread pool (default रूप से 4 threads) |
| `bcryptjs` से password hashing | Main thread (pure JavaScript), cost 12 पर लगभग चौथाई सेकंड |

**ईमानदार कमज़ोर कड़ी:** क्योंकि `bcryptjs` pure JavaScript है, sign-ins की बौछार थोड़ी देर के लिए दूसरी requests को रोक देती है। सामान्य fix native `bcrypt` package है (thread pool में चलता है) या sign-in rate पर सीमा, जो इस API में पहले से है (20 प्रति मिनट)।

## Processes और scaling
- एक **process** की अपनी memory होती है। दो API processes एक-दूसरे के variables नहीं देख सकते, इसलिए जो कुछ साझा होना चाहिए (rate-limit counters, live events, data) वह Redis या MongoDB में रहता है, कभी global variable में नहीं।
- **Replicas** (`docker compose up --scale api=3`) ज़्यादा CPU cores इस्तेमाल करते हैं। Node हर process पर एक core इस्तेमाल करता है।
- Rate limits के लिए in-memory fallback सिर्फ़ एक instance के लिए सही है; यह README में कहा गया है।

## Sockets और file descriptors
हर खुला connection (एक browser, MongoDB, Redis, एक SSE stream) एक **file descriptor** है। Operating system सीमित करता है कि एक process कितने रख सकता है (`ulimit -n`)। कई खुली SSE streams हर एक descriptors और थोड़ी memory लेती हैं, इसीलिए heartbeats और `close` पर cleanup मायने रखते हैं: जो client गायब हो जाए उसे हटाना ज़रूरी है वरना process धीरे-धीरे leak करता है।

## Memory
- Node heap को garbage collector संभालता है; जिन objects को कोई reference नहीं करता वे मुक्त हो जाते हैं।
- In-memory rate-limit map बिना cleanup के हमेशा बढ़ता रहता, इसलिए 50 000 entries पार होने पर पुरानी windows हटा दी जाती हैं।
- बड़े uploads कभी memory में नहीं आते: browser file को signed URL से सीधे storage में भेजता है।

## Signals और graceful shutdown
जब container रोका जाता है तो OS **SIGTERM** भेजता है। तब server:
1. नए connections स्वीकार करना बंद करता है (`server.close`),
2. चल रही requests को पूरा होने देता है,
3. MongoDB और Redis connections बंद करता है,
4. बाहर निकलता है; अगर कुछ अटक जाए तो 10 सेकंड का timer exit को मजबूर करता है।
इससे deploys के दौरान responses छूटने से बचते हैं। `SIGINT` (Ctrl+C) भी यही करता है।

## Environment, configuration, security
- Settings **environment variables** से आती हैं, जिन्हें शुरुआत में zod एक बार validate करता है; `MONGODB_URI` गायब हो तो process बाद में fail होने के बजाय साफ़ संदेश के साथ रुक जाता है।
- Container बिना किसी local state के चलता है, इसलिए उसे किसी भी समय मारकर बदला जा सकता है।
- Secrets (JWT keys, database URL) `.env` में रहते हैं, जो कभी commit या zip नहीं होता।

## यहाँ दिखाए गए Concurrency विचार
| विचार | उदाहरण |
|---|---|
| Race condition | दो clicks एक साथ दो reactions बनाते हैं। (story, user) पर unique index database से दूसरे को ठुकरवा देता है। |
| Atomic operation | Counter पर `$inc` एक अविभाज्य कदम है, इसलिए दो requests कभी एक ही पुरानी value नहीं पढ़तीं। |
| Critical section | Sync sequence number एक atomic update से लिया जाता है ताकि हर बदलाव को अलग number मिले। |
| Starvation / blocking | Handler में लंबा synchronous loop उस process की हर दूसरी request को freeze कर देगा। |

## आपसे पूछे जा सकने वाले सवाल
- क्या Node.js single-threaded है? Thread pool क्या करता है?
- दो API replicas एक in-memory counter क्यों साझा नहीं कर सकते?
- Signal क्या है, और graceful shutdown का क्या मतलब है?
- आप कैसे पता लगाएँगे कि request का कौन-सा हिस्सा event loop को block करता है?
