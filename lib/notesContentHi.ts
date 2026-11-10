import type { NoteSection } from "@/lib/notesContent";

/**
 * Hindi version of lib/notesContent.ts: same sections and same order (matched by position), so a change there
 * needs the matching change here. Technical terms stay in English on purpose.
 */
export const NOTES_HI: NoteSection[] = [
  {
    id: "cn",
    title: "Computer Networks",
    summary: "browser, Next.js app और API आपस में कैसे बात करते हैं।",
    items: [
      { topic: "HTTP request / response और REST", used: "frontend, JSON के साथ HTTP के ज़रिए Express API को call करता है; हर call stateless है और अपना token खुद लेकर जाती है।", tradeoff: "Stateless calls आसानी से scale और cache होती हैं, लेकिन हर request में headers और auth दोहराए जाते हैं, और server खुद से updates push नहीं कर सकता।" },
      { topic: "TLS, CORS और cookies बनाम tokens", used: "API सिर्फ़ app के अपने origin से आने वाली calls स्वीकार करती है; login tokens हर user के लिए client पर रखे जाते हैं।", tradeoff: "storage में tokens सरल हैं और अलग-अलग origins पर काम करते हैं, पर XSS का खतरा रहता है। HttpOnly cookies ज़्यादा सुरक्षित हैं, लेकिन उन्हें CSRF सुरक्षा और same-site setup चाहिए।" },
      { topic: "Caching और CDN", used: "Next.js hashed JS/CSS और static pages को लंबी cache अवधि के साथ serve करता है; fonts CDN से आते हैं।", tradeoff: "दोबारा आने पर बहुत तेज़, लेकिन hash बदलने तक पुरानी file टिक सकती है, और personalised pages उसी तरह cache नहीं हो सकते।" },
      { topic: "Polling बनाम WebSockets", used: "Reading presence 5 सेकंड का heartbeat है जिसमें 60 सेकंड की idle window है, online indicator की तरह।", tradeoff: "Heartbeat सरल है और कमज़ोर network में भी चलता है, पर requests बेकार जाती हैं और एक beat तक की देरी हो सकती है। WebSockets तुरंत हैं, लेकिन sticky connections और reconnect logic चाहिए।" },
      { topic: "Payload size और latency", used: "अपलोड किया गया PDF हर पेज के लिए एक image बन जाता है, और server को भेजे बिना पूरा browser में ही पढ़ा जाता है।", tradeoff: "न upload का इंतज़ार, न server का खर्च, लेकिन बड़ी files बहुत memory लेती हैं और upload के बिना दूसरे devices पर share नहीं हो सकतीं।" },
    ],
  },
  {
    id: "os",
    title: "Operating Systems",
    summary: "processes, threads, memory और scheduling, जैसा कि वे एक reading app को प्रभावित करते हैं।",
    items: [
      { topic: "Single-threaded event loop", used: "browser UI और Node API दोनों एक ही event loop पर चलते हैं; auto-scroll और inertia easing हर animation frame में एक बार चलते हैं।", tradeoff: "locks या data races की चिंता नहीं, लेकिन कोई एक धीमा काम (बड़ा PDF parse करना) पेज को freeze कर देता है, जब तक उसे टुकड़ों में न बाँटा जाए या worker में न भेजा जाए।" },
      { topic: "Scheduling और timers", used: "heartbeat सिर्फ़ तब चलता है जब tab दिख रहा हो, क्योंकि browsers background timers को throttle करते हैं।", tradeoff: "झूठा 'reading' समय रुकता है और battery बचती है, लेकिन background में छोड़ा गया tab idle गिना जाता है, भले ही व्यक्ति सुन रहा हो।" },
      { topic: "Memory और quotas", used: "localStorage हर origin पर लगभग 5 MB तक सीमित है। बड़ा PDF इससे ज़्यादा हो सकता है, इसलिए ownership को एक छोटे record के रूप में अलग से सेव किया जाता है।", tradeoff: "data को device पर रखना तेज़ और private है, पर सीमित है, हर browser का अलग है, और मिट सकता है। भारी data IndexedDB या server में रखना चाहिए।" },
      { topic: "Tabs के बीच concurrency", used: "कई tabs एक ही localStorage साझा करते हैं; app storage events सुनता है ताकि वे एक-दूसरे को आँख मूँदकर overwrite न करें।", tradeoff: "सस्ता sharing, लेकिन transactions नहीं हैं, इसलिए एक साथ लिखने वाले दो tabs में एक update खो सकता है (आख़िरी write जीतता है)।" },
      { topic: "Blocking बनाम non-blocking I/O", used: "API async database calls इस्तेमाल करती है ताकि एक धीमी query बाकी requests को न रोके।", tradeoff: "कम threads पर ज़्यादा throughput, लेकिन CPU-भारी काम फिर भी सब कुछ block कर देता है और उसे worker या queue चाहिए।" },
    ],
  },
  {
    id: "oops",
    title: "Object-Oriented Design",
    summary: "हर user के data के पीछे का class design, और वह ऐसा क्यों बना है।",
    items: [
      { topic: "Abstraction और inheritance", used: "UserScopedRepository एक abstract base class है; ListRepository उसे extend करती है; history, bookmarks और uploads उसे आगे extend करते हैं।", tradeoff: "साझा read/write code एक जगह रहता है, लेकिन गहरी hierarchies बदलना मुश्किल होता है। जब behaviours बहुत अलग हों तो composition ज़्यादा लचीला है।" },
      { topic: "Template method", used: "base class algorithm तय करती है (key बनाओ, पढ़ो, सुरक्षित parse करो, लिखो) और subclasses सिर्फ़ feature(), emptyValue() और deserialize() देती हैं।", tradeoff: "हर repository एक जैसा व्यवहार करती है, पर subclasses base class के steps से बँध जाती हैं।" },
      { topic: "Encapsulation", used: "read() और write() protected हैं, इसलिए callers को सिर्फ़ मतलब बताने वाले methods दिखते हैं, जैसे save() या toggle()।", tradeoff: "callers को छुए बिना storage बदला जा सकता है, लेकिन storage सीधे पढ़ने से थोड़ा ज़्यादा code लिखना पड़ता है।" },
      { topic: "Dependency inversion", used: "repositories एक KeyValueStore interface पर निर्भर हैं; app localStorage देता है और tests in-memory map। Story ownership एक injected resolver से खोजी जाती है।", tradeoff: "आसान testing और कोई circular imports नहीं, लेकिन सीखने और एक composition file में जोड़ने के लिए एक अतिरिक्त परत है।" },
      { topic: "Facade और single responsibility", used: "SessionManager हर व्यक्ति के लिए एक UserSession देता है, जिससे हर user का data अलग रहता है।", tradeoff: "एक साफ़ single entry point, लेकिन अगर उसमें बेमेल ज़िम्मेदारियाँ जमा होती रहें तो वह bottleneck class बन जाती है।" },
    ],
  },
  {
    id: "dbms",
    title: "Database Systems",
    summary: "data कैसे model होता है, बँटता है और consistent रखा जाता है।",
    items: [
      { topic: "Relational model और ORM", used: "backend users, stories और attempts को tables में रखता है और Prisma के ज़रिए उन तक पहुँचता है।", tradeoff: "मज़बूत structure और joins, लेकिन schema बदलने के लिए migrations चाहिए और ORM धीमी queries को छिपा सकता है।" },
      { topic: "Key-value storage और user के हिसाब से partitioning", used: "client पर हर key user की id से शुरू होती है, इसलिए एक व्यक्ति का data अलग partition है।", tradeoff: "पूरा isolation और सरल lookups, लेकिन users के बीच query नहीं हो सकती: किसी story का owner ढूँढने के लिए keys scan करनी पड़ती हैं।" },
      { topic: "Denormalised daily aggregates", used: "हर दिन की एक DailyActivity row में sums और counts रहते हैं, जिन्हें heatmap, pace chart और efficiency view सीधे पढ़ते हैं।", tradeoff: "charts तुरंत और सस्ते हैं, पर हर session का कच्चा detail खो जाता है और aggregation का bug दोबारा replay नहीं किया जा सकता।" },
      { topic: "Atomicity और rollback", used: "story सेव करने पर उसका index और content दोनों लिखे जाते हैं; अगर index का write fail हो जाए तो content का write वापस लिया जाता है (एक test इसे cover करता है)।", tradeoff: "कोई आधा-सेव record नहीं, लेकिन असली transactions के बिना यह manual है और गलती की गुंजाइश रहती है।" },
      { topic: "Indexing, pagination और ids", used: "history और attempts तारीख़ के हिसाब से group होते हैं और एक बार में 10 groups दिखते हैं; ownership claims बड़े story blobs से अलग रखी गई एक छोटी id list है।", tradeoff: "तेज़ screens और छोटे lookups, लेकिन एक अतिरिक्त structure को main data के साथ sync रखना पड़ता है।" },
    ],
  },
];
