# Search system

पूरी तरह browser में PDF पर full-text search: index कैसे बनता और cache होता है, यह inverted index की जगह scan क्यों है, और canvas पर hit ठीक उन्हीं characters पर कैसे highlight होता है।

## 1. Constraints

- Text PDF के अंदर है; उसे निकालने में हर page पर एक worker round trip लगता है।
- Extraction चलते समय भी search काम करना चाहिए (progressive results)।
- उसी book को दोबारा खोलने पर फिर से extract नहीं होना चाहिए।
- Rasterised page पर hit सटीक highlight होना चाहिए।

## 2. Pipeline

```text
open search
  └─ getIndex(doc)                    key = doc.key + "#" + doc.rev     (memory LRU, 4 entries)
       └─ buildIndex                  3 concurrent workers over pages, cancellable, resumable
            ├─ hydrate from IndexedDB  per source file, if seen before   (LRU, 8 files)
            ├─ getTextContent → normalizeItems → page.cleanup()
            └─ when a file is complete → persist to IndexedDB
query → linear scan of folded page strings → hits with context
```

## 3. Inverted index नहीं, scan क्यों

| Option | Build cost | Query cost | Phrase search | Memory |
| --- | --- | --- | --- | --- |
| Linear scan (हर page पर `indexOf`) | Extraction के अलावा कुछ नहीं | O(total text) | मुफ़्त | 1× text (+1× folded copy) |
| Inverted index (word → postings) | हर page tokenise | O(postings) | Positions चाहिए | 2–4× text |
| Trie / n-gram index | सबसे ज़्यादा | तेज़ prefix / fuzzy | Positions चाहिए | सबसे ज़्यादा |

1000 pages की textbook लगभग 2–5 MB text है। उस पर `indexOf` कुछ milliseconds का है — इंसानी perception से नीचे — और phrase queries मुफ़्त मिलती हैं। Index device पर build time जोड़ता, बिना किसी दिखने वाले फ़ायदे के। ==सबसे सरल structure चुनो जो latency budget पूरा करे, और वह point जानो जहाँ वह काम करना बंद करता है== (दसियों MB text, या fuzzy search) — तब worker में inverted index पर जाओ।

## 4. Caching और invalidation

- **दो levels।** तुरंत दोबारा search के लिए memory (4 books का LRU बना `Map`); visits के पार IndexedDB (`flip-reader` / `text-index`, 8 files का LRU)।
- **Source के हिसाब से cache, revision के हिसाब से नहीं।** Text हर PDF file के हिसाब से रखा जाता है; per-revision index उसी से जोड़ा जाता है। Pages reorder या delete करने से `rev` बढ़ता है पर दोबारा extract कभी नहीं होता।
- **Content से बने keys।** `name | size | lastModified` 300 MB hash किए बिना file को पहचानता है। असली files के लिए collisions लगभग असंभव हैं; एक की कीमत गलत search text होगी, data loss नहीं।
- **Storage optional है।** हर IndexedDB call wrapped है; private mode या quota errors `null` लौटाते हैं और system दोबारा compute करता है।

## 5. एक normaliser, दो consumers

pdf.js text को positioned fragments के रूप में लौटाता है। `normalizeItems` उन्हें जोड़ता है (whitespace सिकोड़ना, soft hyphens हटाना, items अलग करना) और माँगने पर एक **character map** भी लौटाता है, हर output character से वापस `(item, char)` तक।

```ts title="lib/flipreader/pdftext.ts" principle="Single source of truth — search offsets और highlight offsets एक ही function से आते हैं"
export function normalizeItems(items: RawItem[], withMap = false): PageText {
```

Search string इस्तेमाल करता है; highlighting उसी function को map के साथ फिर चलाता है। दोनों तरफ़ एक जैसी normalisation होने से search का मिला offset हमेशा सही glyphs पर map होता है। Lower-casing `fold` से होती है, जो string length बनाए रखता है ताकि offsets valid रहें।

## 6. Offset से pixels तक

`rectsForRange` हर fragment की text matrix को viewport transform से गुणा करता है (2D affine composition), फिर fragment width के अनुपात में character positions interpolate करता है। यह घुमाए और तिरछे text को संभालता है क्योंकि यह matrix space में काम करता है, axis-aligned मान्यताओं से नहीं। नतीजा canvas के ऊपर बने rectangles की list है।

## 7. Query semantics और limits

- Case-insensitive; quotes हटते हैं; whitespace सिकुड़ता है; कम से कम 2 characters।
- पहले phrase। अगर कई शब्दों के phrase का कहीं hit नहीं, तो "सारे शब्दों वाले pages" पर fallback।
- Bounded output: कुल 300 hits, हर page पर 6, ~100 characters का context, शब्दों की सीमा पर कटा।

## 8. Known gaps और अगले कदम

| Gap | Approach |
| --- | --- |
| Scanned PDFs में text नहीं | उसी `pages: string[]` interface को भरता on-device OCR (WASM) |
| कोई fuzzy / stemming नहीं | Normalised tokens वाला inverted index, worker में बना |
| बड़ी books पर main-thread scan | `search()` को worker में ले जाएँ और hits stream करें |
| Ranking | अभी page order; हर page पर term frequency जोड़ी जा सकती है |
