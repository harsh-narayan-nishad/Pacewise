# Frontend

**Computer networks · Frontend।** Pacewise web app (Next.js + React, जो browser में चलता है) networking का उपयोग कैसे करता है: वह कौन-से requests करता है, धीमे connection पर कैसे तेज़ रहता है और network fail होने पर क्या करता है।

## हर visit पर browser क्या करता है
1. साइट के domain के लिए **DNS lookup**, फिर secure connection खोलने के लिए **TCP** और **TLS**।
2. पेज के लिए **HTTP request**; response में HTML और JavaScript व CSS files के links होते हैं।
3. हर file के लिए browser वही connection दोबारा इस्तेमाल करता है (**keep-alive**, और host सपोर्ट करे तो **HTTP/2 multiplexing**), इसलिए कई files एक ही connection पर parallel में आती हैं।
4. **Caching**: जिन files के नाम में hash होता है (`/_next/static/...`) उन्हें लंबे समय के लिए cacheable मार्क किया जाता है, इसलिए लौटकर आने वाला visitor लगभग कुछ भी डाउनलोड नहीं करता।

## App network से कहाँ बात करता है
| क्या | Code | Protocol idea |
|---|---|---|
| सभी backend calls | `lib/api/client.ts` (`apiFetch`) | HTTPS पर `fetch`, JSON body, `Authorization: Bearer <token>` |
| Token renewal | वही file | **401** आने पर एक साझा `/auth/refresh` call चलती है और इंतज़ार कर रहे हर request को एक बार retry किया जाता है (single-flight, ताकि दस parallel requests दस refreshes न भेजें) |
| बदलाव भेजना | `lib/api/backendSync.ts` | बदलाव 400 ms इंतज़ार करते हैं (**debounce**), फिर 200 operations तक एक साथ लेकर एक `POST /sync/ops` में जाते हैं (**batching**) |
| बदलाव पाना | वही file | **Polling**: हर 15 s पर और tab के दोबारा visible होने पर `GET /sync/snapshot?since=N` |
| Reading time | `lib/api/backendTracking.ts` | Events `localStorage` में queue होते हैं, 100 के batches में जाते हैं, हर एक का unique id होता है ताकि **retry** सुरक्षित रहे |
| Live notifications | `lib/api/useNotificationStream.ts` | `EventSource` (**Server-Sent Events**): एक लंबा HTTP response; browser अपने आप दोबारा connect करता है |
| PDF engine | `scripts/copy-pdf-worker.mjs` | PDF worker file सामान्य static file की तरह `/pdf.worker.min.mjs` से serve होती है |
| Fonts | `app/layout.tsx` | `fonts.googleapis.com` पर `preconnect` DNS + TCP + TLS जल्दी शुरू कर देता है; `display=swap` font आने से पहले text दिखा देता है |
| Page changes | `next/link` | **Prefetch**: अगले पेज का code तब fetch हो जाता है जब उसका link दिखाई देता है, इसलिए click करते ही तुरंत लगता है |

## Failure handling
- **Offline या server down**: sync और tracking कभी screen पर exception नहीं फेंकते। Pending data queue में रहता है (tracking queue `localStorage` में save होती है, sync अपना अंतर दोबारा निकाल लेता है) और अगले बदलाव या poll पर retry होता है।
- **Status codes**: 401 refresh trigger करता है; 403/404/422 एक `ApiError` बन जाते हैं जिसे screen दिखा सकती है; 429 का मतलब है धीमे चलो; 5xx का मतलब है बाद में कोशिश करो।
- **Idempotency**: खोया हुआ response reading time को दो बार नहीं गिनना चाहिए, इसलिए हर event का unique id होता है और server दोहराए गए events को ignore करता है।
- **Cross-origin**: browser API से पूछता है (`OPTIONS` pre-flight) कि क्या साइट उसे call कर सकती है; API allowed origins के साथ जवाब देता है।

## Wire पर security
- सारा traffic HTTPS है, इसलिए tokens और passwords transit में encrypted रहते हैं।
- Access tokens कुछ मिनटों तक चलते हैं; refresh token हर उपयोग पर rotate होता है।
- Notification stream token को URL में रखती है क्योंकि `EventSource` headers सेट नहीं कर सकता; इसीलिए token की उम्र कम रखी जाती है।

## ज्ञात network कमज़ोरियाँ (investigation से)
- अगर वह host धीमा या blocked हो तो Google Fonts stylesheet पहले paint को block कर देती है; `next/font` से fonts को self-host करने पर बाहरी request हट जाती है।
- Login screen कंटेंट दिखाने से पहले JavaScript का इंतज़ार करती है, इसलिए धीमे networks पर और धीमा लगता है।
- Landing video में `preload="metadata"` इस्तेमाल होना चाहिए ताकि वह bandwidth के लिए scripts से होड़ न करे।

## आपसे पूछे जा सकने वाले सवाल
- जब आप URL टाइप करके Enter दबाते हैं तो क्या होता है?
- Requests को debounce और batch क्यों करें? हर एक की कीमत क्या है?
- इस feature के लिए Polling, SSE या WebSocket में से क्या, और क्यों?
- दस failed requests को दस token refreshes भेजने से कैसे रोकें?
