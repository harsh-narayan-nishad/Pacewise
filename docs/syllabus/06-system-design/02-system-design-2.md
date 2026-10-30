# System Design 2

## Pacewise Search Engine — system design case study

*Design a search engine that finds anything inside a user's own notes, docs, PDFs and images, in under 200 ms.*

This chapter takes the Google case study (the 2013 IJCTE paper and the "Google search architecture" post) and applies the same crawl → index → rank → serve skeleton to Pacewise. The big differences are that Pacewise search is **private** (each user searches only their own content) and its input is **not just web pages** — it is notes, scanned PDFs and photos of handwriting.

### 1. What Google teaches us

| Google component (from the paper) | What it does | Pacewise equivalent |
| --- | --- | --- |
| URL server + distributed crawlers | Decide what to fetch and download pages | **Not needed.** Content arrives by upload or import, so an event queue replaces the crawler |
| Store server + repository | Compress and store every fetched page | Object store for originals, plus a doc store for extracted text |
| `docID` | One number per page | `docId` per file, `chunkId` per page or section inside it |
| Indexer → "hits" | Per word: position, font size, capitalisation | Per word: position, **heading level** (the font-size analogue), field (title, body, OCR) |
| Barrels → sorter → inverted index | Forward index re-sorted by word | Same idea, handled by the search engine's segments |
| Lexicon + DumpLexicon | Word list kept in memory | Lexicon used for spell correction and autocomplete |
| Anchors file | Link text, valuable for pages that cannot be indexed as text, such as images | **Doc-to-doc links and image captions** become anchor text |
| PageRank, `PR(A) = (1-d) + d·Σ PR(Ti)/C(Ti)`, d = 0.85 | Importance from backlinks | Small-weight "link rank" over the links between a user's docs |
| 500 servers per query | Index partitioned by `docID`, so every query fans out | **One shard per query**, partitioned by `userId` (see section 6) |
| Top-k, caches, nearest data centre | Keep latency low | Same: top-k, result cache, regional replicas |

The post's summary still holds: **crawling finds content, indexing makes it understandable, searching ranks and shows it.** We keep the last two and replace crawling with an *ingestion pipeline*.

### 2. Requirements

**Functional**

- Full-text search across notes, docs, quiz questions, **text inside digital PDFs**, **text inside scanned PDFs** and **text inside images**.
- Results show the file, the page number and a highlighted snippet, and open the reader at that page.
- Typo tolerance, synonyms, phrase search, filters such as `type:pdf` and `in:folder`, and autocomplete.
- A newly added note is searchable within seconds. A scanned PDF is searchable by title immediately and by content once OCR finishes.

**Non-functional**

- p95 query latency under 200 ms, p99 under 400 ms.
- Strict tenant isolation: a query can never return another user's content.
- Highly available reads. Brief delay in indexing is acceptable, a wrong or missing result is not.
- Deleting a file removes it from search within 24 hours.

**Out of scope:** web crawling, ads, sponsored results, cross-user search.

### 3. Capacity estimates

These are assumptions, written down so each design decision can be checked against them.

| Quantity | Assumption | Result |
| --- | --- | --- |
| Users | 1,000,000 | |
| Documents | 200 per user | 200 M docs |
| Mix | 70% text, 20% PDF, 10% image | 140 M text · 40 M PDF · 20 M images |
| Words | text 1,500 · PDF 16,000 (40 pages) · image 60 | ≈ 850 B words |
| Raw text | 6 bytes per word | ≈ 5 TB |
| Inverted index | about 35% of raw text | ≈ 1.8 TB, ×3 replicas ≈ 5.4 TB |
| Vectors (phase 3) | 300-word chunks → 2.8 B chunks, product-quantised to 48 B | ≈ 136 GB |
| Queries | 10 per user per day | 10 M/day ≈ 116 QPS average, plan for 1,000 QPS peak |
| New files | 3 per user per day | 3 M/day ≈ 35 per second |
| OCR volume | 15% of 24 M PDF pages + 0.3 M images per day | ≈ 3.9 M pages/day ≈ 45 CPU cores average, ~150 at peak |
| Shards | at most 40 GB each | ≈ 50 primaries |

**What the numbers tell us:** the index fits comfortably on a few dozen machines, so the hard parts are not storage. They are **OCR throughput, tenant isolation, freshness and ranking quality**.

### 4. High-level architecture

![Pacewise search engine — high-level architecture](/docs/search-architecture.svg)

Two independent paths meet in the search cluster. The **online path** answers queries and must be fast. The **offline path** turns files into searchable chunks and must be reliable and elastic. Because they only share the index, a surge of uploads can never slow down searching.

### 5. Ingestion: documents, PDFs and images

![Ingestion pipeline for notes, PDFs and images](/docs/search-ingestion-pipeline.svg)

1. **Store first.** The original goes to object storage and an event is published. If everything downstream fails, the file is safe and can be reprocessed.
2. **Route by content, not by file name.** Detect the type using the MIME type and magic bytes.
3. **Notes and docs.** Parse headings and links, then keep the heading level as a ranking weight.
4. **PDFs.** Check each page for a text layer. If a page has enough characters it is extracted with layout (page number and bounding boxes). If not, it is rasterised at about 300 dpi and sent to OCR. A single PDF can mix both, so the decision is **per page**.
5. **Images.** Deskew, denoise and boost contrast, then OCR. Keep the confidence score. Optionally add a caption or an image embedding so that "whiteboard photo of the load balancer" can match without any text in it.
6. **Normalise, chunk, analyse.** Unicode NFKC, language detection, then chunks of about 300 words with 15% overlap that respect page and heading boundaries. Every chunk remembers its `docId`, page and bounding boxes, so a result can highlight the exact place.
7. **Index in bulk.** Write the chunk to the shard chosen by `hash(userId)` and the chunk text to the doc store.

```ts title="services/ingest/pdf-router.ts" principle="Decide per page, not per file — digital pages are cheap to extract, scanned pages need OCR"
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

**Operational rules that matter**

- **Two lanes.** Text goes through a fast lane, OCR through a slow lane with its own workers. A 400-page scanned book never delays a one-line note.
- **Idempotency.** Each job is keyed by `fileHash + pipelineVersion`, so retries and duplicate events are harmless.
- **Back-pressure.** Autoscale OCR workers on queue lag. Failed jobs retry with exponential backoff and then land in a dead-letter queue for inspection.
- **Progressive availability.** Index the title and metadata first. The user sees the file immediately with an "indexing" badge, and content becomes searchable as pages finish.
- **Deduplication.** An exact hash catches identical uploads. A near-duplicate fingerprint (simhash) catches the same document exported twice, and only one copy is ranked.

### 6. Index design

![Inverted index and tenant routing](/docs/search-index-and-shards.svg)

The structure is the one Google described: a **forward index** (document → words) re-sorted into an **inverted index** (word → documents). A multi-word query intersects the posting lists. In the example above, "online" appears in documents 13, 28, 49, 54 and 99, "shopping" in 13, 23, 49 and 57, so only **13 and 49** match both.

Each posting stores more than a document number: term frequency, positions (for phrase and proximity matching) and a field flag, so a match in a title counts more than a match in an OCR'd footnote.

**Decision: partition by `userId`, not by `docId`.**

| | Partition by `docId` (Google) | Partition by `userId` (Pacewise) |
| --- | --- | --- |
| Shards touched per query | All of them | **One** |
| Tail latency | Slowest shard decides | One shard, one replica |
| Tenant isolation | A filter on every shard | Physical boundary plus a filter |
| Weak spot | None for web search | A very large user makes a hot shard |

The weak spot is handled by splitting a heavy tenant across a few sub-shards (`userId + docBucket`), which keeps the single-shard rule for 99.9% of users. Replicas serve reads and are placed in the nearest region, and a copy of the index in each region is what keeps latency low, as in the Google post.

**Buy or build?** The inverted index, BM25 and vector search are solved problems. Use a Lucene-based engine such as OpenSearch for them and spend engineering time where Pacewise is different: the ingestion pipeline, tenant routing and ranking.

### 7. Query flow

![Query flow with latency budget](/docs/search-query-flow.svg)

1. **Normalise and parse** — lowercase, split filters from words.
2. **Spell and synonyms** — the lexicon plus edit distance corrects "algorthm"; a small synonym table maps "OS" to "operating system".
3. **Cache lookup** — key is `userId + normalised query + index version`. Including the index version means a new upload invalidates stale results without any manual purge.
4. **Route** to the user's shard in the nearest region.
5. **BM25F lexical retrieval** — top 100 chunks, with title ×3, heading ×2, body ×1.
6. **Vector retrieval** (phase 3) — top 100 chunks by meaning, so "how does a load balancer pick a server" finds a note that never uses those words.
7. **Fuse and re-rank** with Reciprocal Rank Fusion plus the signals below.
8. **Snippets** — take the best chunk, show the page number, and draw OCR bounding boxes over the matched words.

```ts title="lib/search/rrf.ts" principle="Fuse rankings, not scores — BM25 and cosine scores are on different scales, ranks are comparable"
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

Retrieval decides what *could* match. Ranking decides what comes first. Starting weights, to be tuned rather than trusted:

| Signal | Weight | Why |
| --- | --- | --- |
| BM25F text match | 0.50 | Core relevance, field-weighted |
| Phrase and proximity | 0.15 | Words close together mean a better match (Google keeps hit positions for the same reason) |
| Personal behaviour | 0.12 | What this user opens, saves and reads for long |
| Doc link rank | 0.10 | Docs that many other docs link to are probably central |
| Freshness | 0.08 | Recent notes win ties |
| Anchor text | 0.05 | Words in links pointing at a doc describe it better than the doc itself |

Penalties apply for duplicates, very low OCR confidence and near-empty pages.

The link rank is the paper's PageRank, run on the small graph of one user's docs:

```ts title="lib/search/link-rank.ts" principle="PageRank by iteration — repeat until the scores stop moving; d = 0.85 models a reader who sometimes jumps to a random doc"
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

**How we know ranking is good.** Offline: NDCG@10 and MRR on a labelled set of real queries and the doc the user eventually opened. Online: click-through on the first three results, zero-result rate, time to first click, reformulation rate (searching again immediately means the first answer failed) and p95 latency. Every ranking change ships behind an A/B test.

### 9. Pacewise today and the path to this design

| Phase | What exists | Why it is enough | Trigger to move on |
| --- | --- | --- | --- |
| 0 — now | A build-time full-text index bundled with the docs site, searched in the browser | Tens of pages, no server cost | Content becomes user-generated |
| 1 | Postgres full-text search with trigram typo tolerance, plus an OCR queue | One datastore, easy to operate | Queries over ~50 ms or index over ~100 GB |
| 2 | OpenSearch, routed by `userId`, with autocomplete and filters | Proper relevance, horizontal scale | Users want "find by meaning" |
| 3 | Hybrid lexical + vector, learning-to-rank from clicks | Best relevance | Tuning from real data |

Each phase is shippable and the interfaces (`search(userId, query, filters)`) stay the same, so the move is a migration, not a rewrite.

### 10. Failure modes and security

| Problem | What happens | Mitigation |
| --- | --- | --- |
| OCR workers fall behind | Scanned files wait | Autoscale on queue lag, text lane is separate, UI shows "indexing" |
| A shard replica dies | Reads shift to another replica | 3 replicas, health checks, automatic promotion |
| Bad OCR text | Garbage terms, false matches | Confidence threshold, penalty, keep original image for display |
| Poison file crashes a parser | Same job retried forever | Retry limit, dead-letter queue, per-file timeout and memory cap |
| Hot tenant | One shard overloaded | Sub-shard the tenant, rate-limit per user |
| Cache serves stale data | User cannot find new note | Index version is in the cache key |
| Cross-tenant leak | Worst case | `userId` filter added **server-side** from the auth token, never from the client; shard routing as a second boundary; automated test that queries as user A for user B's unique word |
| Deleted file still searchable | Privacy issue | Tombstone immediately, hide at query time, purge segments within 24 hours |

Also: encrypt originals and index at rest, use short-lived signed URLs for file access, and run OCR in a sandboxed worker because PDF and image parsers are a common attack surface.

### 11. Why this design is senior-level

- It **starts from numbers** (section 3) and shows that storage is not the bottleneck, then spends effort on the real ones.
- It **changes the Google design where the problem differs** — tenant partitioning instead of docID partitioning, an ingestion pipeline instead of a crawler — rather than copying it.
- It makes **explicit trade-offs**: build versus buy, per-page OCR decision, progressive availability, fast lane versus slow lane.
- It treats **correctness and privacy** (tenant isolation, deletion) as first-class, not as an afterthought.
- It defines **how success is measured** and a **migration path** from what exists today.

*Credit: structure and the Google component names follow Lavania, Jain, Gupta and Sharma, "Google: A Case Study (Web Searching and Crawling)", IJCTE Vol. 5 No. 2, 2013, and the "Google search architecture" newsletter post; the numbers, the Pacewise design and the diagrams are original to this document.*
