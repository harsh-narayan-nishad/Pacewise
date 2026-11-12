# API design: REST, GraphQL और gRPC

Frontend backend से कैसे बात करता है, API REST क्यों है, errors, pagination, auth और retries कैसे design हुए हैं, और कब GraphQL या gRPC बेहतर होता। JD में "REST, GraphQL, gRPC, HTTP या Thrift से मज़बूत APIs design, build और maintain करना" माँगा गया है, इसलिए यह पेज उसी interview में बचाव के लिए लिखा गया है।

## 1. Frontend जो REST surface इस्तेमाल करता है

सारे paths `/api/v1` के नीचे हैं (version URL में रहता है)। हर call `lib/api/client.ts` के `apiFetch` से गुज़रता है; हर endpoint का `lib/api/endpoints.ts` में एक typed wrapper है।

| Resource | Endpoints | टिप्पणी |
|---|---|---|
| Health | `GET /health` | सोए server को जगाता है; sign-in status toast इसे इस्तेमाल करता है |
| Auth | `POST /auth/signup`, `/auth/login`, `/auth/google`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/change-password`; `GET /auth/me`, `/auth/availability` | Login जैसी calls Bearer header नहीं भेजतीं |
| E-mail flows | `POST /auth/verify-email`, `/auth/verify-email-otp`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/reset-password-otp` | Link token या 6 अंकों का code |
| Users | `GET /users?updatedSince=`, `GET /users/:username`, `PATCH /users/me`, `POST` / `DELETE /users/:username/follow`, `GET /users/:id/followers`, `/following` | `updatedSince` से थोड़ा-थोड़ा लोगों की सूची |
| Stories | `GET /stories?q=&tag=&page=&pageSize=`, `GET /stories/:id`, `POST /stories`, `PATCH` / `DELETE /stories/:id` | पन्नों वाली सूची |
| Social | `PUT` / `DELETE /stories/:id/reaction`, `GET` / `POST /stories/:id/comments`, `DELETE /comments/:id`, `POST /stories/:id/share`, `PUT /stories/:id/bookmark` | किसी मान पर set करने वाले actions के लिए `PUT` (idempotent) |
| Notifications | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `GET /notifications/stream?token=` (SSE) | Client पर stream तैयार |
| Playlists | `GET` / `POST /playlists`, `GET` / `PATCH` / `DELETE /playlists/:id`, `POST /playlists/:id/items`, `DELETE /playlists/:id/items/:storyId`, `GET /playlists/public/:userId` | Public बनाम private server पर लागू |
| History | `POST /history`, `GET /history?page=`, `GET /history/stats`, `GET /history/highlights?today=`, `PATCH /history/:id/topics` | Topic बदलाव थोड़ी देर तक ही |
| Sync | `POST /sync/ops`, `GET /sync/snapshot?since=` | Batch write और log read (section 5) |
| Tracking | `POST /tracking/events`, `PUT /tracking/blobs/:feature`, `GET /tracking/state`, `GET /tracking/summary?today=` | `opId` से idempotent events |
| Uploads | `POST /uploads/presign`, `GET /uploads/:key/url` | File खुद presigned `PUT` से सीधे object storage में जाती है |
| Calendar | `GET` / `POST /calendar/events`, `PATCH` / `DELETE /calendar/events/:id` | Offline होने पर local fallback |

## 2. नियम

- **Resources के लिए संज्ञा, actions के लिए HTTP verbs।** `PUT /stories/:id/reaction` reaction set करता है (दोहराने पर कुछ नहीं बदलता: idempotent); `POST` बनाता है।
- **JSON अंदर, JSON बाहर।** `Content-Type: application/json`; `204 No Content` कोई body नहीं लौटाता और `apiFetch` `undefined` लौटाता है।
- **एक error envelope।** हर विफलता `{ "error": { "message", "code", "details" } }` है। Client इसे `ApiError(status, message, code, details)` बनाता है; validation errors `details.fieldErrors` लाते हैं ताकि form पहले field का संदेश दिखाए।
- **Pagination।** सूची वाले endpoints `{ items, total, page, pageSize }` लौटाते हैं। Offset paging सरल है; बड़े पैमाने पर cursor paging पर जाएँ (inserts में स्थिर, गहरे `OFFSET` scans नहीं)।
- **थोड़ा-थोड़ा पढ़ना।** `GET /users?updatedSince=` और `GET /sync/snapshot?since=` सिर्फ़ बदला हुआ लौटाते हैं: client आख़िरी cursor रखता है।
- **Versioning।** Path में `/api/v1`। जोड़ने वाले बदलाव (नए वैकल्पिक fields) v1 में रहते हैं; तोड़ने वाले बदलाव v2 पाते हैं जबकि v1 पुराने clients को चलाता रहता है।

## 3. Auth design

| हिस्सा | चुनाव | क्यों |
|---|---|---|
| Credential जाँच | सिर्फ़ server (bcrypt) | Browser कभी passwords नहीं रखता या मिलाता |
| Access token | JWT, लगभग 15 मिनट, `Authorization: Bearer` | हर request पर stateless जाँच; कम उम्र leak होने पर नुकसान सीमित करती है |
| Refresh token | लंबी उम्र, **हर इस्तेमाल पर rotate**, server पर reuse detection | चुराया गया refresh token दोनों copies इस्तेमाल होते ही पकड़ में आता है |
| Client पर refresh | `apiFetch` में single-flight | एक साथ refreshes को reuse detection से टकराने से रोकता है |
| Logout | `POST /auth/logout` refresh token रद्द करता है; `logout-all` हर device का रद्द करता है | Server पर रद्द करना, सिर्फ़ local tokens मिटाना नहीं |
| Google | ID token server पर जाँचा जाता है | Browser से आई पहचान पर कभी भरोसा नहीं |
| Account की स्थिति | `403 ACCOUNT_BANNED` / `ACCOUNT_REJECTED` | Admin के action अगले request पर लागू होते हैं |

## 4. API contract में reliability

- Tracking events पर **idempotency keys** (`opId`), ताकि retries सुरक्षित रहें।
- **Batching**: हर request में 200 sync ops और 100 events तक round trips घटाते हैं; 1.5 million characters से बड़े blobs छोड़कर body सीमा (2 MB) का सम्मान होता है।
- **Presigned uploads**: बड़ी files API server को पूरी तरह छोड़ देती हैं, इसलिए API छोटा और तेज़ रहता है; URL की समय-सीमा ख़त्म होती है।
- Warm-up और monitoring के लिए **health endpoint**।
- **Rate limits** `429` लौटाते हैं; client को पीछे हटना चाहिए (jitter के साथ exponential backoff मानक जवाब है)।

## 5. Sync protocol विस्तार से

```text
Push:  POST /sync/ops
       { "ops": [ { "op": "put", "collection": "reactions", "id": "reaction-3-k2j9xq", "data": { ... } },
                  { "op": "delete", "collection": "comments", "id": "comment-7-a81kd0" } ] }
       Server: checks ownership of every op (the client checks first with mayPush), applies, bumps seq.

Pull:  GET /sync/snapshot?since=41
       { "seq": 57, "upserts": { "reactions": [ ... ] }, "deletes": { "comments": [ "comment-7-a81kd0" ] } }
       Client: merges without echoing back, stores seq = 57.
```

गुण: मालिकाना हक़ दो बार जाँचा जाता है (bandwidth बचाने के लिए client, सुरक्षा के लिए server), deletions साफ़ tombstones हैं, cursor हर pull को बदलावों के अनुपात में रखता है, और खोया जवाब नुकसान नहीं करता क्योंकि अगला pull आख़िरी रखे cursor से शुरू होता है।

## 6. REST बनाम GraphQL बनाम gRPC

| | REST (इस्तेमाल) | GraphQL | gRPC |
|---|---|---|---|
| Data का आकार | हर endpoint का तय | Client ठीक वही fields माँगता है | `.proto` messages से तय |
| Transport | HTTP/1.1 या 2, JSON | आम तौर पर एक `POST /graphql`, JSON | HTTP/2, binary Protocol Buffers |
| Browser support | मूल रूप से | मूल रूप से (यह HTTP है) | gRPC-Web और proxy चाहिए |
| Caching | HTTP caches और CDNs URL से चलते हैं | कठिन: एक URL; client caches चाहिए (id से normalised) | HTTP caching नहीं |
| ज़्यादा/कम fetch | हो सकता है | Design से हल | Services के बीच चिंता नहीं |
| Typing | वैकल्पिक (OpenAPI) | Schema ज़रूरी | मज़बूत, generated stubs |
| Streaming | SSE, chunked | Subscriptions (आम तौर पर WebSocket) | Built-in दोतरफ़ा streams |
| किसके लिए सबसे अच्छा | Public, cache होने लायक, resource जैसी APIs | कई screens और nested data वाले product UIs (feeds, profiles) | कम latency वाली service-to-service calls |

**यहाँ REST क्यों:** कम clients, resource जैसा data, मुफ़्त HTTP caching, browser के network tab से debug करना सबसे आसान, और sync endpoints पहले ही बातूनी traffic घटा देते हैं।

**GraphQL पर कब जाएँ:** जब किसी screen को एक round trip में story + लेखक + reaction counts + ऊपर के comments + "क्या मैंने like किया" चाहिए, और web, iOS और Android हर एक को अलग fields चाहिए। Reddit जैसा feed ठीक यही है। N+1 queries से बचने के लिए server पर DataLoader जैसी batching जोड़ें, और persisted queries ताकि CDN उन्हें cache कर सके।

**gRPC कब:** backend services के बीच (feed ranking, notification fan-out, search) जहाँ latency और सख़्त contracts मायने रखते हैं, browser से सीधे कभी नहीं।

**Thrift:** gRPC जैसी ही जगह (IDL के साथ binary RPC); trade-offs वही हैं।

## 7. पूछे जा सकने वाले सवाल

- "किसी post को like करो" की API design करें। कौन-सा verb, कौन-से status codes, idempotent कैसे रखेंगे?
- हर सेकंड नए posts पाने वाले feed को कैसे paginate करेंगे? (Cursor, offset नहीं।)
- पुराने mobile apps जिन्हें आप update नहीं कर सकते, उनके लिए API का version कैसे रखेंगे?
- आपकी API दस parallel requests को 401 लौटाती है। Client में क्या होता है, और क्या गलत हो सकता है?
- मौजूदा REST services के आगे GraphQL कब लगाएँगे?
- 200 MB की PDF को अपने API servers से गुज़ारे बिना कैसे upload करेंगे?
