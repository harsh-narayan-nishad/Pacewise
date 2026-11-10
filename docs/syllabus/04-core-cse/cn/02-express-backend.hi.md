# Express backend

**Computer networks · Express backend।** Pacewise API (Express + TypeScript + MongoDB) networking का उपयोग कैसे करती है: कौन-सी call किस protocol का इस्तेमाल करती है, और उसके पीछे के networking विचार।

## यह कहाँ बैठता है

```text
Browser (Next.js app)
   |  HTTPS  (HTTP/1.1 or HTTP/2 over TLS over TCP)  — JSON requests
   v
Load balancer / nginx  (optional, only with several API instances)
   |  HTTP
   v
Express API  (Node.js, one event loop per process)
   |-- MongoDB wire protocol over TCP (TLS on Atlas)     -> data
   |-- RESP over TCP                                     -> Redis (optional: shared rate limit + live events)
   '-- HTTPS (AWS SDK)                                   -> S3 (optional: only signs URLs; the browser uploads directly)
```

## कौन-सी call किस protocol का उपयोग करती है

| Call | Protocol और style | यही क्यों |
|---|---|---|
| Browser से API (नीचे की सब कुछ) | HTTPS, request/response, JSON body | हर proxy और CDN से होकर चलता है, cache और debug करना आसान है। |
| Sign up, log in, refresh, log out | `POST /auth/*` | Password body में जाता है; URL में कभी नहीं। Rate limit 20 प्रति मिनट। |
| Data पढ़ना (stories, comments, profile, snapshot) | `GET` | दोहराना सुरक्षित है, कोई side effects नहीं। |
| मेरा data बदलना (likes, comments, saves, playlists, follows) | `POST /sync/ops` जिसमें `put` / `delete` operations की सूची है | एक request में कई बदलाव जाते हैं, इसलिए clicks की बौछार एक round trip होती है। |
| दूसरों के बदलाव पाना | हर 15 s पर `GET /sync/snapshot?since=N` | Polling सरल है और सोते हुए laptops और अस्थिर mobile data में भी टिकती है। |
| Reading time, tests, streak events | `POST /tracking/events` (हर event का unique id होता है) | Id से retry सुरक्षित होता है: एक ही event दो बार नहीं गिना जाता। |
| Reading history, bookmarks, achievements ... | `PUT /tracking/blobs/:key` | PUT का मतलब है "इस value को बदल दो", और list को save करना ठीक यही है। |
| Live notifications | `GET /notifications/stream`, एक लंबे समय तक खुला HTTP response (Server-Sent Events, `text/event-stream`) | Server से browser की ओर एकतरफ़ा push; सादा HTTP, `EventSource` में auto-reconnect अंतर्निहित। |
| PDF या image upload करना | signed URL पाने के लिए `POST`, फिर browser सीधे S3 पर `PUT` करता है | File कभी API से होकर नहीं गुज़रती, इसलिए बड़ा upload server को जकड़ नहीं सकता। |
| API से MongoDB | MongoDB wire protocol (binary, TCP पर; Atlas पर TLS; `mongodb+srv://` पहले DNS SRV lookup करता है) | Driver द्वारा संभाला गया connection pool, हर request द्वारा दोबारा इस्तेमाल होता है। |
| API से Redis | TCP पर RESP | Instances के बीच साझा counters और publish/subscribe। |

### WebSockets क्यों नहीं?
Server जो कुछ भी push करता है वह एकतरफ़ा है (एक notification), और बाकी को polling संभाल लेती है। SSE सादा HTTP है, इसलिए उसे किसी विशेष proxy नियम की ज़रूरत नहीं। WebSocket तब फ़ायदेमंद बनता है जब collaborative editor आए और दोनों पक्षों को कई छोटे messages तेज़ी से भेजने हों।

## एक request का जीवन: किसी story को like करना

1. Click से page तुरंत अपडेट होता है (app का अपना logic browser में चलता है)।
2. 400 ms बाद sync layer local data की तुलना उससे करती है जो server के पास पहले से है और एक नई reaction पाती है।
3. `POST /api/v1/sync/ops` `Authorization: Bearer <access token>` के साथ निकलता है।
4. Express middleware chain को क्रम से चलाता है: `helmet` (security headers), `cors`, `express.json` (body parse करना), request logger, router, `requireAuth` (token को signature check से verify करना, database call नहीं), `rateLimit`, `validate` (zod), फिर handler।
5. Service नियम जाँचती है (आप सिर्फ़ अपने records लिख सकते हैं), अगला sequence number देती है और MongoDB में एक document upsert करती है।
6. JSON जवाब बताता है कि कितने operations लागू हुए या ठुकराए गए।
7. किसी दूसरे पाठक का browser अपने अगले poll पर `GET /sync/snapshot?since=N` पूछता है और नया like पा लेता है।

अगर कोई भी कदम fail हो, तो error handler एक ही एकसमान आकार लौटाता है: `{ error: { code, message } }`।

## एक click से response तक
1. **DNS** `api.example.com` को IP address में बदलता है (या, `mongodb+srv://` के लिए, SRV record से database hosts ढूँढता है)।
2. **TCP** three-way handshake (SYN, SYN-ACK, ACK) एक भरोसेमंद byte stream खोलता है।
3. **TLS** handshake keys पर सहमति बनाता है और certificate से server की पहचान साबित करता है, इसलिए password और tokens wire पर encrypted रहते हैं।
4. **HTTP** request और response उसी stream पर चलते हैं। Keep-alive के साथ वही connection कई requests संभालता है, इसलिए चरण 1 से 3 की कीमत एक ही बार चुकानी पड़ती है।

## HTTP जिस तरह API उसे इस्तेमाल करती है
| विचार | API में |
|---|---|
| Methods | `GET` पढ़ता है, `POST` बनाता है या action चलाता है, `PUT` बदल देता है (blobs), `PATCH` हिस्सा edit करता है, `DELETE` हटाता है। |
| Idempotent | दोहराने पर वही नतीजा मिलता है: `GET`, `PUT`, `DELETE`। `POST /tracking/events` को unique event id सुरक्षित बनाता है। |
| Status codes | 200 ok, 201 created, 204 लौटाने को कुछ नहीं, 401 sign in नहीं, 403 अनुमति नहीं, 404 नहीं मिला, 422 गलत input, 429 बहुत ज़्यादा requests, 503 storage configure नहीं। |
| Headers | `Authorization: Bearer ...` access token ले जाता है; `Content-Type: application/json`; `helmet` security headers जोड़ता है। |
| Stateless | Server memory में कोई session नहीं रखता। कोई भी instance कोई भी request संभाल सकता है, और इसी से load balancer traffic बाँट पाता है। |

## CORS
Browser `localhost:3000` के page को `localhost:4000` के जवाब पढ़ने से रोकता है जब तक API न कहे कि इजाज़त है। `Authorization` header वाली requests के लिए browser पहले `OPTIONS` pre-flight भेजता है; `cors` middleware उसका जवाब `CORS_ORIGINS` की सूची से देता है। Phone app browser नहीं है, इसलिए CORS उस पर असर नहीं डालता।

## Wire पर Authentication
- **Access token**: कम समय (15 मिनट) का signed token। उसे जाँचना सिर्फ़ गणित है, database lookup नहीं।
- **Refresh token**: एक लंबी random string जो हर device के लिए MongoDB में रखी जाती है। हर उपयोग पर वह नए से बदल जाती है; अगर कोई पुराना दोबारा दिखे, तो उस user के सभी sessions रद्द कर दिए जाते हैं (यह संकेत है कि वह चोरी हुआ था)।
- **Server-Sent Events** browser में headers सेट नहीं कर सकते, इसलिए वह एक route token को `?token=` के रूप में स्वीकार करता है। URLs में tokens logs में पहुँच सकते हैं, इसीलिए token की उम्र कम है।

## Real-time: polling बनाम SSE बनाम WebSocket
| | कैसे | किसके लिए अच्छा |
|---|---|---|
| Polling | हर N seconds में पूछो | सरल, मज़बूत (15 s sync में इस्तेमाल) |
| SSE | एक खुला HTTP response, server events लिखता है | एकतरफ़ा push (notifications) |
| WebSocket | Upgrade किया गया TCP connection, दोनों पक्ष भेजते हैं | Chat और collaborative editing (बाद में) |

## भरोसेमंदी और निष्पक्षता
- **Rate limiting**: प्रति user (या IP) प्रति मिनट एक counter। Redis के साथ गिनती सभी instances में साझा होती है; उसके बिना हर process अकेले गिनता है।
- **Retries**: browser असफल भेजे गए को बाद में दोबारा भेजता है। Unique event ids का मतलब है कि खोए हुए response के बाद retry दो बार नहीं गिना जाता।
- **Timeouts और back-pressure**: धीमा database requests को इंतज़ार करवाता है; connection pool की सीमा API को असीमित connections खोलने से रोकती है।
- **Load balancing**: nginx कई API containers के आगे बैठ सकता है; tokens stateless हैं, इसलिए "sticky" routing की ज़रूरत नहीं।
- **Payload limits**: 2 MB से बड़े bodies ठुकरा दिए जाते हैं, ताकि एक request server को भर न दे।

## आपसे पूछे जा सकने वाले सवाल
- URL पर Enter दबाने और page दिखने के बीच क्या होता है?
- Refresh token server पर क्यों रखा जाता है लेकिन access token नहीं?
- आप WebSockets के बजाय SSE कब चुनेंगे?
- `POST` को idempotency key क्यों चाहिए और `PUT` को क्यों नहीं?
