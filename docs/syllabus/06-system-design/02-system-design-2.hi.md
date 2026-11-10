# सिस्टम डिज़ाइन 2

## Pacewise Search Engine — सिस्टम डिज़ाइन केस स्टडी

*एक ऐसा search engine डिज़ाइन करें जो यूज़र के अपने notes, docs, PDFs और images के अंदर कुछ भी 200 ms से कम में खोज सके।*

यह चैप्टर Google केस स्टडी (2013 का IJCTE paper और "Google search architecture" पोस्ट) को लेता है और वही crawl → index → rank → serve ढाँचा Pacewise पर लागू करता है। बड़े अंतर ये हैं कि Pacewise search **private** है (हर यूज़र सिर्फ़ अपना कंटेंट खोजता है) और इसका input **सिर्फ़ web pages नहीं** है — इसमें notes, scanned PDFs और हाथ से लिखे नोट्स की फ़ोटो शामिल हैं।

### 1. Google हमें क्या सिखाता है

| Google component (paper से) | यह क्या करता है | Pacewise में समकक्ष |
| --- | --- | --- |
| URL server + distributed crawlers | तय करते हैं कि क्या fetch करना है और pages डाउनलोड करते हैं | **ज़रूरत नहीं।** कंटेंट upload या import से आता है, इसलिए crawler की जगह event queue आती है |
| Store server + repository | हर fetch किए गए page को compress करके store करता है | originals के लिए object store, और extracted text के लिए doc store |
| `docID` | हर page के लिए एक number | हर file के लिए `docId`, और उसके अंदर हर page या section के लिए `chunkId` |
| Indexer → "hits" | हर word के लिए: position, font size, capitalisation | हर word के लिए: position, **heading level** (font-size का समकक्ष), field (title, body, OCR) |
| Barrels → sorter → inverted index | Forward index को word के हिसाब से दोबारा sort किया जाता है | वही idea, जिसे search engine के segments सँभालते हैं |
| Lexicon + DumpLexicon | Word list जो memory में रहती है | Lexicon का उपयोग spell correction और autocomplete के लिए |
| Anchors file | Link text, उन pages के लिए उपयोगी जिन्हें text के रूप में index नहीं किया जा सकता, जैसे images | **Doc-to-doc links और image captions** anchor text बन जाते हैं |
| PageRank, `PR(A) = (1-d) + d·Σ PR(Ti)/C(Ti)`, d = 0.85 | Backlinks से importance | यूज़र के docs के बीच के links पर कम weight वाला "link rank" |
| हर query पर 500 servers | Index को `docID` से partition किया जाता है, इसलिए हर query सबको fan out होती है | **हर query पर एक shard**, `userId` से partition (section 6 देखें) |
| Top-k, caches, सबसे नज़दीकी data centre | Latency कम रखना | वही: top-k, result cache, regional replicas |

पोस्ट का सार आज भी सही है: **crawling कंटेंट खोजती है, indexing उसे समझने लायक बनाती है, और searching उसे rank करके दिखाती है।** हम आख़िरी दो रखते हैं और crawling की जगह एक *ingestion pipeline* लगाते हैं।

### 2. Requirements

**Functional**

- Notes, docs, quiz questions, **digital PDFs के अंदर का text**, **scanned PDFs के अंदर का text** और **images के अंदर का text** पर full-text search।
- Results में file, page number और highlight किया हुआ snippet दिखता है, और reader उसी page पर खुलता है।
- Typo tolerance, synonyms, phrase search, `type:pdf` और `in:folder` जैसे filters, और autocomplete।
- नया जोड़ा गया note कुछ सेकंड में searchable हो जाता है। Scanned PDF title से तुरंत और content से OCR पूरा होने के बाद searchable होता है।

**Non-functional**

- p95 query latency 200 ms से कम, p99 400 ms से कम।
- सख़्त tenant isolation: कोई query कभी किसी दूसरे यूज़र का कंटेंट नहीं लौटा सकती।
- Reads की high availability। Indexing में थोड़ी देरी स्वीकार्य है, ग़लत या ग़ायब result नहीं।
- किसी file को delete करने पर वह 24 घंटे के अंदर search से हट जाती है।

**Out of scope:** web crawling, ads, sponsored results, cross-user search।

### 3. Capacity estimates

ये assumptions हैं, जिन्हें इसलिए लिखा गया है ताकि हर design decision को इनसे जाँचा जा सके।

| Quantity | Assumption | Result |
| --- | --- | --- |
| Users | 1,000,000 | |
| Documents | हर यूज़र के 200 | 200 M docs |
| Mix | 70% text, 20% PDF, 10% image | 140 M text · 40 M PDF · 20 M images |
| Words | text 1,500 · PDF 16,000 (40 pages) · image 60 | ≈ 850 B words |
| Raw text | हर word के 6 bytes | ≈ 5 TB |
| Inverted index | raw text का लगभग 35% | ≈ 1.8 TB, ×3 replicas ≈ 5.4 TB |
| Vectors (phase 3) | 300-word chunks → 2.8 B chunks, product-quantised होकर 48 B | ≈ 136 GB |
| Queries | हर यूज़र की रोज़ 10 | 10 M/day ≈ औसतन 116 QPS, peak पर 1,000 QPS की योजना बनाएँ |
| New files | हर यूज़र की रोज़ 3 | 3 M/day ≈ 35 प्रति सेकंड |
| OCR volume | 24 M PDF pages का 15% + रोज़ 0.3 M images | ≈ 3.9 M pages/day ≈ औसतन 45 CPU cores, peak पर ~150 |
| Shards | हर एक अधिकतम 40 GB | ≈ 50 primaries |

**ये numbers हमें क्या बताते हैं:** index कुछ दर्जन machines पर आराम से fit हो जाता है, इसलिए मुश्किल हिस्से storage नहीं हैं। वे हैं **OCR throughput, tenant isolation, freshness और ranking quality**।

### 4. High-level architecture

![Pacewise search engine — high-level architecture](/docs/search-architecture.svg)

दो स्वतंत्र paths search cluster में मिलते हैं। **Online path** queries का जवाब देता है और तेज़ होना चाहिए। **Offline path** files को searchable chunks में बदलता है और भरोसेमंद व elastic होना चाहिए। क्योंकि वे सिर्फ़ index साझा करते हैं, uploads की बाढ़ कभी searching को धीमा नहीं कर सकती।

### 5. Ingestion: documents, PDFs और images

![Notes, PDFs और images के लिए ingestion pipeline](/docs/search-ingestion-pipeline.svg)

1. **पहले store करें।** Original object storage में जाता है और एक event publish होता है। अगर आगे सब कुछ fail हो जाए, तब भी file सुरक्षित रहती है और दोबारा process की जा सकती है।
2. **File name से नहीं, content से route करें।** MIME type और magic bytes से type पहचानें।
3. **Notes और docs।** Headings और links parse करें, फिर heading level को ranking weight के रूप में रखें।
4. **PDFs।** हर page में text layer जाँचें। अगर page में पर्याप्त characters हैं तो उसे layout (page number और bounding boxes) के साथ extract किया जाता है। अगर नहीं, तो उसे लगभग 300 dpi पर rasterise करके OCR को भेजा जाता है। एक ही PDF में दोनों तरह के pages हो सकते हैं, इसलिए फ़ैसला **हर page पर अलग** होता है।
5. **Images।** Deskew, denoise और contrast बढ़ाएँ, फिर OCR करें। Confidence score रखें। चाहें तो caption या image embedding जोड़ें ताकि "whiteboard photo of the load balancer" बिना किसी text के भी match हो सके।
6. **Normalise, chunk, analyse।** Unicode NFKC, language detection, फिर लगभग 300 words के chunks जिनमें 15% overlap हो और जो page व heading की सीमाओं का सम्मान करें। हर chunk को अपना `docId`, page और bounding boxes याद रहते हैं, इसलिए result ठीक उसी जगह को highlight कर सकता है।
7. **Bulk में index करें।** Chunk को `hash(userId)` से चुने गए shard में और chunk text को doc store में लिखें।

```ts title="services/ingest/pdf-router.ts" principle="फ़ैसला हर page पर करें, पूरी file पर नहीं — digital pages extract करने में सस्ते हैं, scanned pages को OCR चाहिए"
type PageResult = { page: number; text: string; source: "text-layer" | "ocr"; confidence: number };

const MIN_CHARS_PER_PAGE = 40;

export async function extractPdf(pdf: PdfDocument): Promise<PageResult[]> {
  const results: PageResult[] = [];

  for (let page = 1; page <= pdf.pageCount; page++) {
    const layer = await pdf.textLayer(page);

    if (layer.text.trim().length >= MIN_CHARS_PER_PAGE) {
      results.push({ page, text: layer.text, source: "text-layer", confidence: 1 });
      continue;
    }

    const bitmap = await pdf.rasterise(page, { dpi: 300 });
    const ocr = await ocrQueue.run(bitmap);   // slow lane, autoscaled
    results.push({ page, text: ocr.text, source: "ocr", confidence: ocr.confidence });
  }

  return results;
}
```

**ज़रूरी operational rules**

- **दो lanes।** Text एक fast lane से जाता है, OCR अपने अलग workers वाली slow lane से। 400 pages की scanned किताब एक लाइन के note को कभी देर नहीं करती।
- **Idempotency।** हर job का key `fileHash + pipelineVersion` होता है, इसलिए retries और duplicate events हानिरहित हैं।
- **Back-pressure।** Queue lag के आधार पर OCR workers को autoscale करें। Failed jobs exponential backoff के साथ retry होते हैं और फिर जाँच के लिए dead-letter queue में चले जाते हैं।
- **Progressive availability।** पहले title और metadata index करें। यूज़र को file तुरंत "indexing" badge के साथ दिखती है, और pages पूरे होते ही content searchable होता जाता है।
- **Deduplication।** Exact hash एक जैसे uploads पकड़ लेता है। Near-duplicate fingerprint (simhash) एक ही document के दो बार export होने को पकड़ लेता है, और सिर्फ़ एक copy rank होती है।

### 6. Index design

![Inverted index और tenant routing](/docs/search-index-and-shards.svg)

ढाँचा वही है जो Google ने बताया था: एक **forward index** (document → words) जिसे दोबारा sort करके **inverted index** (word → documents) बनाया जाता है। कई words वाली query posting lists का intersection लेती है। ऊपर के उदाहरण में, "online" documents 13, 28, 49, 54 और 99 में आता है, "shopping" 13, 23, 49 और 57 में, इसलिए दोनों से सिर्फ़ **13 और 49** match होते हैं।

हर posting में document number से ज़्यादा होता है: term frequency, positions (phrase और proximity matching के लिए) और एक field flag, ताकि title में match का वज़न OCR किए गए footnote के match से ज़्यादा हो।

**Decision: `docId` से नहीं, `userId` से partition करें।**

| | `docId` से partition (Google) | `userId` से partition (Pacewise) |
| --- | --- | --- |
| हर query पर छुए जाने वाले shards | सभी | **एक** |
| Tail latency | सबसे धीमा shard तय करता है | एक shard, एक replica |
| Tenant isolation | हर shard पर एक filter | Physical boundary और साथ में filter |
| कमज़ोर पक्ष | web search के लिए कोई नहीं | बहुत बड़ा यूज़र hot shard बना देता है |

कमज़ोर पक्ष को भारी tenant को कुछ sub-shards (`userId + docBucket`) में बाँटकर सँभाला जाता है, जिससे 99.9% यूज़र्स के लिए single-shard नियम बना रहता है। Replicas reads serve करते हैं और सबसे नज़दीकी region में रखे जाते हैं, और हर region में index की एक copy ही latency कम रखती है, जैसा Google पोस्ट में है।

**Buy या build?** Inverted index, BM25 और vector search सुलझी हुई समस्याएँ हैं। इनके लिए OpenSearch जैसा Lucene-based engine इस्तेमाल करें और engineering समय वहाँ लगाएँ जहाँ Pacewise अलग है: ingestion pipeline, tenant routing और ranking।

### 7. Query flow

![Latency budget के साथ query flow](/docs/search-query-flow.svg)

1. **Normalise और parse करें** — lowercase करें, filters को words से अलग करें।
2. **Spell और synonyms** — lexicon और edit distance "algorthm" को सही करते हैं; एक छोटी synonym table "OS" को "operating system" से map करती है।
3. **Cache lookup** — key है `userId + normalised query + index version`। Index version शामिल करने का मतलब है कि नया upload बिना किसी manual purge के पुराने results को invalidate कर देता है।
4. **Route करें** सबसे नज़दीकी region में यूज़र के shard पर।
5. **BM25F lexical retrieval** — top 100 chunks, title ×3, heading ×2, body ×1 के साथ।
6. **Vector retrieval** (phase 3) — मतलब के आधार पर top 100 chunks, ताकि "how does a load balancer pick a server" ऐसा note खोज ले जिसमें ये words कभी आए ही नहीं।
7. **Fuse और re-rank करें** Reciprocal Rank Fusion और नीचे दिए signals के साथ।
8. **Snippets** — सबसे अच्छा chunk लें, page number दिखाएँ, और matched words पर OCR bounding boxes बनाएँ।

```ts title="lib/search/rrf.ts" principle="Scores नहीं, rankings को fuse करें — BM25 और cosine scores अलग scale पर हैं, ranks तुलनीय हैं"
type Ranked = { chunkId: string; rank: number };

const K = 60; // dampens the gap between rank 1 and rank 2

export function reciprocalRankFusion(lists: Ranked[][]): Map<string, number> {
  const fused = new Map<string, number>();

  for (const list of lists) {
    for (const { chunkId, rank } of list) {
      fused.set(chunkId, (fused.get(chunkId) ?? 0) + 1 / (K + rank));
    }
  }

  return fused;
}
```

### 8. Ranking

![Ranking signals](/docs/search-ranking-signals.svg)

Retrieval तय करता है कि क्या *match हो सकता है*। Ranking तय करती है कि पहले क्या आए। शुरुआती weights, जिन्हें भरोसा करने के बजाय tune करना है:

| Signal | Weight | क्यों |
| --- | --- | --- |
| BM25F text match | 0.50 | Core relevance, field-weighted |
| Phrase और proximity | 0.15 | पास-पास आए words बेहतर match दर्शाते हैं (Google इसी कारण hit positions रखता है) |
| Personal behaviour | 0.12 | यह यूज़र क्या खोलता, save करता और देर तक पढ़ता है |
| Doc link rank | 0.10 | जिन docs को कई दूसरे docs link करते हैं वे शायद central हैं |
| Freshness | 0.08 | Tie होने पर हाल के notes जीतते हैं |
| Anchor text | 0.05 | किसी doc की ओर इशारा करने वाले links के words उस doc का वर्णन doc से बेहतर करते हैं |

Duplicates, बहुत कम OCR confidence और लगभग ख़ाली pages पर penalties लगती हैं।

Link rank इस paper का PageRank ही है, जो एक यूज़र के docs के छोटे graph पर चलाया जाता है:

```ts title="lib/search/link-rank.ts" principle="Iteration से PageRank — तब तक दोहराएँ जब तक scores हिलना बंद न करें; d = 0.85 उस reader को model करता है जो कभी-कभी किसी random doc पर कूद जाता है"
export function linkRank(
  links: Map<string, string[]>,   // docId → docs it links to
  iterations = 20,
  d = 0.85,
): Map<string, number> {
  const ids = [...links.keys()];
  let rank = new Map(ids.map((id) => [id, 1 / ids.length]));

  for (let i = 0; i < iterations; i++) {
    const next = new Map(ids.map((id) => [id, (1 - d) / ids.length]));

    for (const [from, targets] of links) {
      if (targets.length === 0) continue;
      const share = (rank.get(from) ?? 0) / targets.length;
      for (const to of targets) next.set(to, (next.get(to) ?? 0) + d * share);
    }

    rank = next;
  }

  return rank;
}
```

**हमें कैसे पता चलता है कि ranking अच्छी है।** Offline: असली queries के labelled set पर NDCG@10 और MRR, और वह doc जो यूज़र ने आख़िर में खोला। Online: पहले तीन results पर click-through, zero-result rate, पहले click तक का समय, reformulation rate (तुरंत दोबारा search करने का मतलब है कि पहला जवाब फ़ेल हुआ) और p95 latency। हर ranking बदलाव A/B test के पीछे ship होता है।

### 9. आज का Pacewise और इस design तक का रास्ता

| Phase | क्या मौजूद है | यह काफ़ी क्यों है | आगे बढ़ने का trigger |
| --- | --- | --- | --- |
| 0 — अभी | Docs site के साथ bundle किया गया build-time full-text index, जो browser में search होता है | दर्जनों pages, कोई server cost नहीं | कंटेंट user-generated हो जाए |
| 1 | Trigram typo tolerance के साथ Postgres full-text search, और एक OCR queue | एक datastore, चलाना आसान | Queries ~50 ms से ऊपर या index ~100 GB से ऊपर |
| 2 | `userId` से route होने वाला OpenSearch, autocomplete और filters के साथ | सही relevance, horizontal scale | यूज़र्स "मतलब से खोजना" चाहें |
| 3 | Hybrid lexical + vector, clicks से learning-to-rank | सबसे अच्छी relevance | असली data से tuning |

हर phase ship किया जा सकता है और interfaces (`search(userId, query, filters)`) वही रहते हैं, इसलिए यह एक migration है, rewrite नहीं।

### 10. Failure modes और security

| समस्या | क्या होता है | Mitigation |
| --- | --- | --- |
| OCR workers पीछे रह जाते हैं | Scanned files इंतज़ार करती हैं | Queue lag पर autoscale, text lane अलग है, UI "indexing" दिखाता है |
| एक shard replica मर जाता है | Reads दूसरे replica पर चले जाते हैं | 3 replicas, health checks, automatic promotion |
| ख़राब OCR text | बेकार terms, ग़लत matches | Confidence threshold, penalty, display के लिए original image रखें |
| Poison file parser को crash कर देती है | वही job बार-बार retry होती रहती है | Retry limit, dead-letter queue, per-file timeout और memory cap |
| Hot tenant | एक shard overload हो जाता है | Tenant को sub-shard करें, हर यूज़र पर rate-limit |
| Cache पुराना data serve करता है | यूज़र को नया note नहीं मिलता | Index version cache key में है |
| Cross-tenant leak | सबसे बुरी स्थिति | `userId` filter **server-side** पर auth token से जोड़ा जाता है, client से कभी नहीं; दूसरी सीमा के रूप में shard routing; automated test जो user A बनकर user B के unique word को query करता है |
| Delete की गई file अब भी searchable | Privacy issue | तुरंत tombstone लगाएँ, query time पर छिपाएँ, 24 घंटे में segments purge करें |

साथ ही: originals और index को at rest encrypt करें, file access के लिए short-lived signed URLs इस्तेमाल करें, और OCR को sandboxed worker में चलाएँ क्योंकि PDF और image parsers हमले की आम सतह हैं।

### 11. यह design senior-level क्यों है

- यह **numbers से शुरू होता है** (section 3) और दिखाता है कि storage bottleneck नहीं है, फिर असली bottlenecks पर मेहनत लगाता है।
- यह **जहाँ समस्या अलग है वहाँ Google design को बदलता है** — docID partitioning की जगह tenant partitioning, crawler की जगह ingestion pipeline — उसे कॉपी नहीं करता।
- यह **स्पष्ट trade-offs** करता है: build versus buy, per-page OCR decision, progressive availability, fast lane versus slow lane।
- यह **correctness और privacy** (tenant isolation, deletion) को पहली प्राथमिकता देता है, बाद का विचार नहीं।
- यह बताता है कि **सफलता कैसे मापी जाती है** और आज जो मौजूद है उससे आगे का **migration path** क्या है।

*Credit: structure और Google component names Lavania, Jain, Gupta और Sharma, "Google: A Case Study (Web Searching and Crawling)", IJCTE Vol. 5 No. 2, 2013, और "Google search architecture" newsletter पोस्ट का अनुसरण करते हैं; numbers, Pacewise design और diagrams इस document के मौलिक हैं।*
