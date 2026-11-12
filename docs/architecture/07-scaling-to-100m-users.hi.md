# 100M users तक scaling

Pacewise आज एक free-tier server से कुछ ही users को चलाता है। यह पेज JD की teams के हर feature (feeds, notifications, authentication, sharing, SEO, onboarding, trust और safety) को लेकर दिखाता है कि Pacewise का version अभी क्या करता है, लगभग 10 करोड़ रोज़ाना users पर क्या टूटता है, और उसकी जगह कौन-सा design आता है। Google, Apple या Reddit स्तर के interviews में "बड़े पैमाने पर क्या बदलेंगे" का यही जवाब है।

## 1. मोटा-मोटा हिसाब

| मात्रा | मान्यता | नतीजा |
|---|---|---|
| रोज़ाना सक्रिय users | 100 M (Reddit लगभग 130 M रोज़ाना unique visitors बताता है) | — |
| Feed loads | हर user के दिन में 10 | दिन में 1 B, औसतन लगभग 12,000 प्रति सेकंड, peak पर उसका 3 से 5 गुना |
| Votes (likes) | हर user के दिन में 5 | दिन में 500 M, लगभग 6,000 writes प्रति सेकंड |
| Comments | हर user के दिन में 0.5 | दिन में 50 M |
| Notifications | हर user के दिन में 3 | दिन में 300 M; fan-out कठिन हिस्सा है |
| आज के 15 s पर polling | एक साथ 10 M users | लगभग 670,000 requests प्रति सेकंड जो कुछ उपयोगी नहीं करते: सबसे पहले हटाने वाली चीज़ |

## 2. Feed (Home, Recommendations, Discovery)

**अभी:** browser में `rankStoriesByInterest()` user की रुचियों से topics का मिलान गिनता है और stable sort करता है; `PersonalizedFeed` सूची को एक बार में 6 करके दिखाता है।

**क्यों टूटता है:** हर client हर candidate download करेगा; engagement signals, ताज़गी या विविधता नहीं हैं; ranking logic हर browser में जाता है।

**बड़े पैमाने पर:**
1. **Candidate generation** (हर user के लिए हज़ारों): subscribed communities, follows, embeddings के nearest neighbours, trending।
2. Features पर model से **ranking** (topic मिलान, लेखक से जुड़ाव, ताज़गी का घटना, अनुमानित engagement), gRPC पर ranking service से।
3. विविधता, de-duplication और safety filters के लिए **re-ranking**।
4. **Serving:** भारी users के लिए पहले से गणना (fan-out on write) और celebrities व नए users के लिए पढ़ते समय गणना (hybrid); feed पन्ने Redis में cache; **cursor pagination** ताकि नए posts पन्ने न खिसकाएँ।
5. **Experimentation:** ranking का हर बदलाव A/B flag के पीछे जाता है और engagement व retention पर परखा जाता है, सिर्फ़ offline accuracy पर नहीं।

## 3. Votes, comments और counters

**अभी:** हर (story, user) के लिए एक reaction row, counts rows को filter करके; comments `parentId` वाले tree के रूप में।

**बड़े पैमाने पर:**
- Uniqueness के लिए votes को (post, user) key से रखें; **counters** अलग रखें और उन्हें asynchronously update करें (sharded counters या stream aggregator), क्योंकि hot post को हर सेकंड हज़ारों votes मिलते हैं।
- अनुमानित counts दिखाएँ; पीछे से मिलान करें।
- Comments: post के हिसाब से रखें, score से क्रम में; पहले ऊपरी स्तर के comments load करें, children माँगने पर (tree हर स्तर पर पन्नों में)।

## 4. Notifications

**अभी:** store में notification rows बनती हैं, 15 s polling से sync होती हैं; SSE client hook तैयार है पर mount नहीं।

**बड़े पैमाने पर:**
1. कोई event (like, reply, follow, share) एक queue (Kafka जैसा log) पर जाता है।
2. एक **notification service** तय करती है किसे बताना है, preferences लागू करती है, duplicates हटाती है और **batch** करती है ("12 लोगों ने आपकी post like की"), और rate-limit करती है।
3. पहुँचाने के रास्ते: persistent connection पर in-app (SSE या WebSocket gateway), mobile push (APNs, FCM), e-mail digests (HTTPS e-mail API से, app servers से SMTP नहीं)।
4. Unread count हर user का counter; सूची cursor से पन्नों में।
5. Fallback: live connection टूटे तो client अपने आख़िरी देखे id से आगे का fetch करता है (वही cursor विचार जो `/sync/snapshot?since=` में है)।

## 5. Authentication और accounts

**अभी:** password (bcrypt) और Google sign-in; 15 मिनट का JWT access token; reuse detection के साथ घूमने वाला refresh token; हर user के tokens `localStorage` में।

**बड़े पैमाने पर:**
- Refresh token **httpOnly, Secure, SameSite** cookie में; access token सिर्फ़ memory में।
- अलग identity service; JWT signing keys rotate होती हैं और JWKS के रूप में प्रकाशित होती हैं ताकि दूसरी services local रूप से जाँच सकें।
- जोखिम के आधार पर login (नया device, असंभव यात्रा) और step-up verification; credential stuffing के ख़िलाफ़ हर IP और हर account पर rate limits।
- आधुनिक बिना-password विकल्प के रूप में Passkeys (WebAuthn)।
- Bounce handling वाले provider API से HTTPS पर e-mail; sign-up को कभी e-mail पहुँचने पर रोककर न रखें।

## 6. Sharing, SEO और onboarding

**अभी:** किसी व्यक्ति को share करने पर share और notification बनते हैं; QR code public notes से जुड़ता है; `robots.ts` सिर्फ़ landing page की अनुमति देता है; `metadataBase` अभी backend host की ओर इशारा करता है।

**बड़े पैमाने पर:**
- **Social sharing:** हर post का canonical URL होता है जिसके Open Graph और Twitter card tags server पर render होते हैं, ताकि chat apps में link previews चलें; share links में growth loops मापने के लिए tracking parameter होता है।
- **SEO:** public पेज server पर render करें (Next.js पहले से यह करता है), canonical URLs, हर community के sitemaps, structured data, तेज़ LCP। `metadataBase` frontend का अपना domain होना चाहिए ताकि absolute OG URLs सही हों।
- **Onboarding:** पहले sign-in पर रुचियाँ चुनें (`interests` field पहले से feed चलाता है), तुरंत एक भरा हुआ feed दिखाएँ (लोकप्रिय content से cold start), हर cohort का activation मापें (पहली story पूरी, पहला quiz दिया)।

## 7. Trust और safety, youth experience

- हर account की writes पर rate-limit; spam patterns पकड़ें (एक जैसे comments, अचानक बहुत follows)।
- Content moderation pipeline: पहले automatic classifiers, फिर human review queue, user reports दोनों को भरते हैं।
- Teen accounts के लिए उम्र के हिसाब से defaults: private profile, सीमित messaging, filtered feed।
- Account की स्थितियाँ पहले से हैं (`ACCOUNT_BANNED`, `ACCOUNT_REJECTED`, admin approval), जो लागू करने का आधार हैं।

## 8. Data layer

| Data | बड़े पैमाने पर store | क्यों |
|---|---|---|
| Users, auth | Relational (PostgreSQL), user id से sharded | पहचान के लिए मज़बूत consistency |
| Posts, comments | Wide-column या sharded relational, post id से partitioned | ज़्यादा writes, key से सरल पहुँच |
| Votes | (post, user) key वाला key-value और counter service | Uniqueness और hot-key counters |
| Feeds | हर user की Redis lists, माँगने पर दोबारा बनती हैं | तेज़ reads, फेंके जा सकते हैं |
| Events, notifications | Log (Kafka) फिर per-user store | क्रम वाला, दोबारा चलाने लायक fan-out |
| Search | Inverted index (Elasticsearch / OpenSearch) | Full-text और ranking |
| Media | Object storage + CDN; presigned uploads (पहले से इस्तेमाल) | बड़ी files कभी API servers को नहीं छूतीं |

## 9. क्या वैसा ही रहता है

Pacewise में पहले से मौजूद विचार सीधे आगे जाते हैं: idempotency keys, offsets की जगह cursors, outbox queues, batching, single-flight refresh, per-user isolation, अविश्वसनीय HTML को साफ़ करना, किसी dependency के बंद होने पर graceful degradation, और ship करने से पहले मापना।
