# यूनिट I: Introduction और Sorting

## 1.1 Algorithm क्या है

> **Algorithm:** well-defined और unambiguous steps का एक finite sequence, जो दिए गए input को required output में बदलता है। हर algorithm में ये गुण होने चाहिए: **input** (शून्य या अधिक), **output** (कम से कम एक), **definiteness** (हर step स्पष्ट हो), **finiteness** (वह terminate हो), और **effectiveness** (हर step इतना basic हो कि उसे किया जा सके)।

- **Algorithm बनाम program:** algorithm एक abstract procedure है; program किसी language में उसका implementation है। Algorithm का code में लिखा होना ज़रूरी नहीं है (pseudo-code, flow chart और सादी अंग्रेज़ी सब चलते हैं)।
- **Design बनाम analysis:** *design* का मतलब है कोई method खोजना (एक design paradigm: brute force, divide and conquer, greedy, dynamic programming, backtracking, branch and bound, randomization)। *Analysis* का मतलब है इस्तेमाल होने वाले resources (time, memory) का अनुमान लगाना और correctness prove करना।
- **Problem हल करने के steps:** problem को समझना, model चुनना, design technique चुनना, algorithm लिखना, correctness prove करना, complexity analyze करना, implement और test करना।
- **Correctness:** loop invariants (loop से पहले सही, हर iteration में बनी रहे, और exit पर उत्तर दे) या induction (recursion के लिए) से prove की जाती है।

| Paradigm | विचार | विशिष्ट उदाहरण |
|---|---|---|
| Brute force | सब कुछ आज़माओ | Linear search, naive string match |
| Divide and conquer | बाँटो, हिस्सों को recursively हल करो, जोड़ो | Merge sort, quick sort, Strassen, binary search |
| Greedy | locally सबसे अच्छा choice लो, दोबारा विचार मत करो | Prim, Kruskal, Dijkstra, Huffman |
| Dynamic programming | overlapping subproblems के उत्तर store करो | Knapsack, Floyd-Warshall, LCS |
| Backtracking / Branch and bound | pruning के साथ state space की व्यवस्थित खोज | n-Queens, TSP, graph colouring |
| Randomized | speed या सरलता के लिए random choices इस्तेमाल करो | Randomized quick sort, Miller-Rabin |
| Approximation | polynomial time में optimal के क़रीब उत्तर | Vertex cover 2-approximation |

## 1.2 Algorithms का analysis

- **Computation का model (RAM model):** एक processor, instructions एक के बाद एक चलती हैं, हर basic operation (arithmetic, comparison, assignment, array access) में constant time लगता है, memory unlimited और random access वाली है।
- **Input size n:** elements की संख्या, bits, vertices और edges आदि। Complexity n का function होती है।
- **Cases:** *best* (सबसे तेज़ संभव input), *worst* (सबसे धीमा input, guarantee देता है, सबसे ज़्यादा इस्तेमाल होता है), *average* (inputs के distribution पर expected मान; assumptions चाहिए)।
- **गिनती कैसे करें:** एक statement = 1 unit; loop = (iterations) x (body की cost); nested loops गुणा होते हैं; sequential blocks जुड़ते हैं; dominant term लो; recursive algorithm से recurrence बनता है।

### Loop analysis के patterns

| Code pattern | Cost |
|---|---|
| `for (i=1;i<=n;i++)` | Θ(n) |
| `for (i=1;i<=n;i*=2)` (या `i/=2`) | Θ(log n) |
| n तक के दो nested loops | Θ(n²) |
| `for(i..n) for(j=1;j<=i;j++)` | 1+2+...+n = n(n+1)/2 = Θ(n²) |
| `for(i..n) for(j=1;j<=n;j*=2)` | Θ(n log n) |
| `for(i=1;i*i<=n;i++)` | Θ(√n) |
| `for(i=1;i<=n;i*=2) for(j=1;j<=i;j++)` | 1+2+4+...+n = 2n-1 = Θ(n) |

### उदाहरण: insertion sort, तीन cases

Insertion sort हर नई key की तुलना sorted prefix से करता है। Sorted input पर यह n-1 comparisons करता है (best, Θ(n)); reverse sorted input पर 1+2+...+(n-1) = n(n-1)/2 करता है (worst, Θ(n²)); random input पर लगभग n²/4 (average, Θ(n²))।

::include cpp/u1-analysis-1.cpp

::include cpp/u1-analysis-1.out.txt

### उदाहरण: linear search बनाम binary search

::include cpp/u1-analysis-2.cpp

::include cpp/u1-analysis-2.out.txt

### Amortized analysis

जब महँगे operations कभी-कभार ही होते हैं, तब एक operation की worst-case cost भ्रामक हो सकती है। **Amortized analysis** worst-case *sequence* पर प्रति operation औसत cost देता है (इसमें probability का कोई रोल नहीं)। तीन methods:

- **Aggregate:** n operations की कुल cost को n से भाग दो।
- **Accounting (banker's):** हर operation से एक fixed amortized price लो; बचा हुआ credit बाद के महँगे operations का भुगतान करता है।
- **Potential:** एक potential Φ(state) ≥ 0 define करो, Φ(initial) = 0; amortized cost = actual cost + ΔΦ।

**Dynamic array doubling:** एक push की cost सामान्यतः 1 होती है, लेकिन array भर जाने पर वह सारे elements को दोगुने बड़े array में copy करता है। n pushes में copies का कुल योग 1+2+4+...+n/2 < n होता है, इसलिए कुल cost 3n से कम है और हर push amortized O(1) है, भले ही एक अकेले push की cost Θ(n) हो सकती है। Fibonacci heaps (यूनिट II) का analysis potential method से होता है।

::include cpp/u1-analysis-3.cpp

::include cpp/u1-analysis-3.out.txt

## 1.3 Complexity और asymptotic notation

- **Time complexity:** input size के function के रूप में basic steps की संख्या। **Space complexity:** इस्तेमाल हुई अतिरिक्त memory (input को आम तौर पर नहीं गिनते, इसे "auxiliary space" कहते हैं; recursion stack गिना जाता है)।
- Notation *growth की दर* बताता है और constants तथा lower-order terms को अनदेखा करता है क्योंकि बड़े n के लिए वे मायने नहीं रखते।

| Notation | अर्थ | Formal definition | पढ़ने का तरीका |
|---|---|---|---|
| O(g(n)) | Upper bound | f(n) ≤ c·g(n) सभी n ≥ n₀ के लिए (कोई c > 0) | "f, g से तेज़ नहीं बढ़ता" |
| Ω(g(n)) | Lower bound | f(n) ≥ c·g(n) सभी n ≥ n₀ के लिए | "f कम से कम g जितनी तेज़ी से बढ़ता है" |
| Θ(g(n)) | Tight bound | c₁·g(n) ≤ f(n) ≤ c₂·g(n) सभी n ≥ n₀ के लिए | "f ठीक g की तरह बढ़ता है" |
| o(g(n)) | Strict upper bound | f(n) < c·g(n) *हर* c > 0 के लिए (बड़े n पर) | f/g → 0 |
| ω(g(n)) | Strict lower bound | f(n) > c·g(n) हर c > 0 के लिए | f/g → ∞ |

- **Θ = O और Ω दोनों साथ में।** Best, average और worst case, हर एक का अपना notation हो सकता है; "insertion sort O(n²) है" कहना सही है, पर "worst case Θ(n²)" कहने से कमज़ोर है।
- **Limit test:** L = lim f(n)/g(n) निकालो। L = 0 → f = o(g); 0 < L < ∞ → f = Θ(g); L = ∞ → f = ω(g)।
- **Properties:** reflexive (f = Θ(f)), transitive, Θ के लिए symmetric (f = Θ(g) ⇔ g = Θ(f)), transpose symmetry (f = O(g) ⇔ g = Ω(f)), sum rule O(f)+O(g) = O(max(f,g)), product rule O(f)·O(g) = O(f·g)।
- **उदाहरण:** 3n²+5n+7 = Θ(n²); n log n = O(n²) लेकिन Θ(n²) नहीं; 2^(n+1) = Θ(2^n) लेकिन 2^(2n) ≠ O(2^n); log(n!) = Θ(n log n); log_a n = Θ(log_b n) (base मायने नहीं रखता)।
- **आम गलतियाँ:** O को "worst case" समझ लेना (O किसी function पर bound है, case नहीं); 2^(2n) बनाम 2^n जैसे non-constant factor को छोड़ देना; "Ω best case है" कहना।

## 1.4 Functions की growth और recurrences

### Growth का क्रम (सबसे धीमे से सबसे तेज़)

```text
1 < log log n < log n < (log n)^2 < √n < n < n log n < n^2 < n^3 < 2^n < n! < n^n
```

- कोई भी polynomial किसी भी polylogarithm को हरा देता है: हर ε > 0, k के लिए n^ε, (log n)^k से तेज़ बढ़ता है।
- कोई भी exponential किसी भी polynomial को हरा देता है: c^n (c > 1), n^k से तेज़ बढ़ता है।
- **Stirling:** n! ≈ √(2πn)(n/e)^n, इसलिए log(n!) = Θ(n log n)।
- **उपयोगी sums:** 1+2+...+n = n(n+1)/2; 1+2+4+...+2^k = 2^(k+1)-1; Σ 1/i = Θ(log n) (harmonic); r<1 के लिए Σ r^i = O(1)।
- **Logs:** log_b(xy) = log_b x + log_b y; a^(log_b c) = c^(log_b a); base बदलने से सिर्फ़ एक constant बदलता है।

::include cpp/u1-growth-1.cpp

::include cpp/u1-growth-1.out.txt

### Recurrences हल करना

Divide and conquer algorithms से T(n) = 2T(n/2) + n जैसे recurrences बनते हैं। तीन methods:

1. **Substitution:** हल का अनुमान लगाओ, फिर induction से prove करो। उदाहरण: T(n) = 2T(n/2)+n के लिए अनुमान T(n) ≤ c·n log n; तब T(n) ≤ 2c(n/2)log(n/2)+n = c n log n - c n + n ≤ c n log n, c ≥ 1 के लिए।
2. **Recursion tree:** tree बनाओ, हर level की cost जोड़ो, फिर सभी levels का योग लो। 2T(n/2)+n के लिए: log n में से हर level की cost n है, कुल n log n।
3. **Master theorem:** T(n) = a·T(n/b) + f(n) के लिए, जहाँ a ≥ 1, b > 1, मान लो p = log_b a (f(n) की तुलना n^p से करो):

| Case | शर्त | परिणाम |
|---|---|---|
| 1 | किसी ε > 0 के लिए f(n) = O(n^(p-ε)) (f छोटा) | T(n) = Θ(n^p) |
| 2 | f(n) = Θ(n^p · log^k n), k ≥ 0 (f बराबर) | T(n) = Θ(n^p · log^(k+1) n) |
| 3 | f(n) = Ω(n^(p+ε)) और किसी c < 1 के लिए a·f(n/b) ≤ c·f(n) (f बड़ा, regularity) | T(n) = Θ(f(n)) |

| Recurrence | Algorithm | p = log_b a | Case | हल |
|---|---|---|---|---|
| T(n) = T(n/2) + 1 | Binary search | 0 | 2 | Θ(log n) |
| T(n) = 2T(n/2) + n | Merge sort | 1 | 2 | Θ(n log n) |
| T(n) = 2T(n/2) + 1 | Tree traversal | 1 | 1 | Θ(n) |
| T(n) = 7T(n/2) + n² | Strassen | 2.807 | 1 | Θ(n^2.807) |
| T(n) = 8T(n/2) + n² | साधारण block matrix multiply | 3 | 1 | Θ(n³) |
| T(n) = 3T(n/2) + n | Karatsuba | 1.585 | 1 | Θ(n^1.585) |
| T(n) = T(n/2) + n | Quickselect (अच्छे pivots) | 0 | 3 | Θ(n) |
| T(n) = 2T(n/2) + n log n | - | 1 | 2 (k=1) | Θ(n log² n) |
| T(n) = 4T(n/2) + n² | - | 2 | 2 | Θ(n² log n) |
| T(n) = 2T(n/2) + n/log n | - | 1 | कोई नहीं (gap) | recursion tree से Θ(n log log n) |
| T(n) = T(n-1) + n | Insertion sort (recursive) | a·T(n/b) के रूप का नहीं: expand करो, = n(n+1)/2 = Θ(n²) |  |  |
| T(n) = 2T(n-1) + 1 | Towers of Hanoi | Expand करो: T(n) = 2^n - 1 = Θ(2^n) |  |  |

> **Exam tip:** हमेशा a, b, f(n), p = log_b a लिखो, फिर case का नाम बताओ और परिणाम लिखो। Case 3 के लिए regularity condition जाँचो। अगर recurrence T(n-1) जैसा है, तो master theorem की जगह expansion (iteration) या recursion tree इस्तेमाल करो।

## 1.5 Performance measurement

- **A priori analysis** (theoretical): n के function के रूप में operations गिनो; machine से स्वतंत्र; growth rate देता है।
- **A posteriori testing** (empirical): implement करो, असली data पर चलाओ, time और memory मापो; machine और compiler पर निर्भर; constant factors और cache effects दिखाता है।
- **अच्छी practice:** optimization के साथ compile करो (`-O2`), `std::chrono::steady_clock` इस्तेमाल करो, हर test को कई बार चलाओ और median या minimum लो, हर algorithm को *वही* input दो, best, average और worst case inputs test करो, n को geometrically बढ़ाओ।
- **Doubling test:** अगर time(2n)/time(n) ≈ 2 है तो algorithm लगभग linear है; ≈ 4 quadratic; ≈ 8 cubic; 2 से थोड़ा ऊपर होना n log n का संकेत है।

::include cpp/u1-perf-1.cpp

Timings आपकी machine पर निर्भर करती हैं, इसलिए ऊपर कोई output paste नहीं किया गया है। इसे चलाने पर आपको हर बार n दोगुना होने पर हर column लगभग दोगुना (थोड़ा ज़्यादा) होता दिखना चाहिए, और shell sort सबसे तेज़ बढ़ता दिखेगा।

## 1.6 Shell sort

- **विचार:** insertion sort का generalization, जो पहले *दूर-दूर* (gap h) के elements की तुलना करता है, फिर gap घटाते-घटाते 1 तक ले आता है। जो array बड़े h के लिए h-sorted है और फिर (h/2)-sorted किया जाता है, वह h-sorted ही रहता है, इसलिए आख़िरी gap-1 pass (सादा insertion sort) को data लगभग sorted मिलता है और वह linear के क़रीब चलता है।
- **Properties:** in place, not stable, adaptive, कोई अतिरिक्त memory नहीं।
- **Complexity gap sequence पर निर्भर करती है:**

| Gap sequence | Worst-case time |
|---|---|
| Shell का मूल: n/2, n/4, ..., 1 | Θ(n²) |
| Hibbard: 2^k - 1 (1, 3, 7, 15, ...) | Θ(n^1.5) |
| Knuth: (3^k - 1)/2 (1, 4, 13, 40, ...) | O(n^1.5) |
| Sedgewick, Pratt (3-smooth numbers) | O(n^(4/3)) और O(n log² n) |

::include cpp/u1-shell-1.cpp

::include cpp/u1-shell-1.out.txt

## 1.7 Quick sort

- **Divide and conquer:** array को pivot के आसपास *partition* करो ताकि pivot के बाईं ओर सब कुछ ≤ pivot और दाईं ओर सब कुछ ≥ pivot हो; फिर दोनों तरफ़ को recursively sort करो। कोई combine step नहीं।
- **Recurrence:** T(n) = T(k) + T(n-k-1) + Θ(n), जहाँ k बाएँ हिस्से का size है।
- **Best case:** pivot हमेशा median हो: T(n) = 2T(n/2) + n = Θ(n log n)।
- **Worst case:** pivot हमेशा सबसे छोटा या सबसे बड़ा हो (sorted input और first/last pivot): T(n) = T(n-1) + n = Θ(n²)।
- **Average case:** Θ(n log n)। हर बार 9:1 का split भी T(n) = T(9n/10)+T(n/10)+n = O(n log n) देता है। Random pivot के लिए expected comparisons ≈ 1.39 n log₂ n।
- **Randomized quick sort:** pivot को uniformly random चुनो। तब कोई विशेष input बुरा नहीं होता; *हर* input के लिए expected time Θ(n log n) है।
- **Space:** in place, लेकिन recursion stack औसतन O(log n) और worst case में O(n) है। पहले छोटे हिस्से पर recurse करने और बड़े हिस्से पर loop चलाने से O(log n) stack की guarantee मिलती है।
- **Stable नहीं है।** बहुत सारी equal keys होने पर Lomuto partitioning quadratic हो जाती है; भारी duplicates के लिए 3-way partitioning (Dutch national flag) इस्तेमाल करो।
- **Partition schemes:** *Lomuto* (एक scan, pivot अंत में, सरल) और *Hoare* (दोनों सिरों से दो scans, लगभग 3 गुना कम swaps, duplicates बेहतर संभालता है)।

::include cpp/u1-quick-1.cpp

::include cpp/u1-quick-1.out.txt

## 1.8 Merge sort

- array को दो halves में **divide** करो, हर half को recursively sort करके **conquer** करो, और दो sorted halves को linear time में merge करके **combine** करो।
- **Recurrence:** T(n) = 2T(n/2) + Θ(n) ⇒ best, average और worst case में Θ(n log n) (master theorem case 2)।
- **Space:** arrays के लिए Θ(n) auxiliary (linked lists के लिए O(1) अतिरिक्त)। अगर merge बराबर होने पर बाएँ half से लेता है तो **stable**। Arrays के लिए in place नहीं है।
- Merge में अधिकतम n-1 comparisons लगते हैं; कुल comparisons ≈ n log₂ n - n + 1। यह *inversions* को भी O(n log n) में गिन देता है (हर बार जब दाएँ का element लिया जाए, तब बाएँ में बचे elements की संख्या जोड़ दो)। External sorting (disk पर data) और linked lists को sort करने के लिए बहुत अच्छा है।

::include cpp/u1-merge-1.cpp

::include cpp/u1-merge-1.out.txt

## 1.9 Heap sort

- **(Max-)heap** एक complete binary tree है जो array में store होता है और जिसमें हर parent ≥ अपने children होता है। 0-based index i के लिए: parent (i-1)/2, children 2i+1 और 2i+2। Height = ⌊log₂ n⌋।
- **Heapify (sift-down):** एक violated node को बार-बार बड़े child से swap करके ठीक करो: O(log n)।
- **Build-heap:** nodes n/2-1 से 0 तक heapify करो। Cost = Σ (n/2^(h+1))·O(h) = O(n), O(n log n) *नहीं*, क्योंकि ज़्यादातर nodes leaves के पास होते हैं।
- **Heap sort:** max-heap बनाओ, फिर बार-बार root (maximum) को आख़िरी element से swap करो, heap छोटा करो और heapify करो: कुल O(n) + n·O(log n) = सभी cases में Θ(n log n)।
- **Properties:** in place (O(1) अतिरिक्त), not stable, cache behaviour ख़राब, व्यवहार में आम तौर पर quick sort से धीमा, लेकिन worst-case की guarantee देता है।
- यही heap एक **priority queue** देता है: insert O(log n), extract-max O(log n), peek O(1)।

::include cpp/u1-heap-1.cpp

::include cpp/u1-heap-1.out.txt

## 1.10 Sorting algorithms की तुलना

| Algorithm | Best | Average | Worst | अतिरिक्त space | Stable | In place |
|---|---|---|---|---|---|---|
| Insertion | n | n² | n² | 1 | हाँ | हाँ |
| Selection | n² | n² | n² | 1 | नहीं | हाँ |
| Bubble (flag के साथ) | n | n² | n² | 1 | हाँ | हाँ |
| Shell | n log n | gaps पर निर्भर | n² / n^1.5 / n log² n | 1 | नहीं | हाँ |
| Quick | n log n | n log n | n² | log n (stack) | नहीं | हाँ |
| Merge | n log n | n log n | n log n | n | हाँ | नहीं |
| Heap | n log n | n log n | n log n | 1 | नहीं | हाँ |
| Counting | n + k | n + k | n + k | n + k | हाँ | नहीं |
| Radix (d digits) | d(n + k) | d(n + k) | d(n + k) | n + k | हाँ | नहीं |
| Bucket | n + k | n + k | n² | n + k | हाँ | नहीं |

- **कब क्या इस्तेमाल करें:** छोटा या लगभग sorted data → insertion sort; सामान्य उपयोग, व्यवहार में तेज़ → quick sort (C++ `std::sort` में introsort: ऐसा quick sort जो recursion बहुत गहरी होने पर heap sort पर switch करता है, और छोटी ranges के लिए insertion sort इस्तेमाल करता है); guaranteed O(n log n) या stability चाहिए → merge sort (`std::stable_sort`); memory कम हो और worst-case guarantee चाहिए → heap sort; छोटे integer keys → counting/radix sort; uniformly distributed reals → bucket sort; disk पर data → external merge sort।
- **Stability** का मतलब है कि equal keys अपना मूल relative order बनाए रखती हैं; यह तब मायने रखता है जब कई keys पर बारी-बारी से sort करना हो (और radix sort इसी की वजह से काम करता है)।

### Comparison sorting के लिए lower bound

कोई भी algorithm जो सिर्फ़ elements की तुलना करके sort करता है, उसे एक binary *decision tree* के रूप में बनाया जा सकता है: हर internal node एक comparison है, हर leaf एक output permutation है। n! permutations हैं, इसलिए tree में कम से कम n! leaves हैं और height h के लिए 2^h ≥ n!। अतः h ≥ log₂(n!) = Θ(n log n) (Stirling)। इसलिए **हर comparison sort को worst case में Ω(n log n) comparisons चाहिए**, जिससे merge sort और heap sort asymptotically optimal सिद्ध होते हैं। इसे हराने के लिए सिर्फ़ comparisons पर निर्भर नहीं रहना होगा (अगला section)।

## 1.11 Linear time में sorting

- **Counting sort:** keys 0..k के integers हैं। Occurrences गिनो, prefix sums लो (वे हर key की शुरुआती position देते हैं), elements रखो, बाएँ से scan करते हुए (या matching prefix definition के साथ दाएँ से) ताकि *stable* रहे। Θ(n + k)। k = O(n) होने पर अच्छा है।
- **Radix sort:** पहले सबसे कम significant digit से sort करो, फिर अगले से, ... हर digit के लिए एक *stable* sort (आम तौर पर counting sort) इस्तेमाल करके। base b में d digits वाले n numbers के लिए: Θ(d(n + b))। 32-bit integers के लिए base 256 के साथ d = 4 passes।
- **Bucket sort:** keys [0,1) में uniform हैं। हर key को bucket ⌊n·x⌋ में डालो, हर bucket को sort करो (insertion sort), फिर जोड़ दो। Uniform data के लिए expected Θ(n); अगर सब कुछ एक ही bucket में चला जाए तो worst case Θ(n²)।

::include cpp/u1-linear-1.cpp

::include cpp/u1-linear-1.out.txt

## 1.12 Order statistics

> n elements के एक set का **i-th order statistic** उसका i-th सबसे छोटा element होता है। Minimum = 1st, maximum = n-th, median = ⌈n/2⌉-th।

- **Minimum या maximum:** n-1 comparisons (optimal)। **दोनों साथ में:** पहले elements की जोड़ियों में तुलना करो (⌊n/2⌋ comparisons), फिर हर जोड़ी के बड़े की max से और छोटे की min से तुलना करो: 2n की जगह लगभग 3n/2 comparisons।
- **Naive selection:** sort करो और index लो: Θ(n log n)।
- **Randomized select (quickselect):** quick sort की तरह partition करो, लेकिन recurse सिर्फ़ *एक* तरफ़ करो। Expected T(n) = T(n/2) + n = Θ(n); worst case Θ(n²)।
- **Median of medians (worst-case linear time, BFPRT):** 5 के groups में बाँटो, हर group का median लो, उन medians का median recursively खोजो और उसे pivot बनाओ। Pivot के दोनों तरफ़ कम से कम 3n/10 elements होते हैं, इसलिए recurrence T(n) = T(n/5) + T(7n/10) + Θ(n) = Θ(n) है, क्योंकि 1/5 + 7/10 = 9/10 < 1। (3 के groups से 1/3 + 2/3 = 1 मिलता और वह linear नहीं रहता।) Constant factor बड़ा है, इसलिए व्यवहार में quickselect इस्तेमाल होता है।

::include cpp/u1-order-1.cpp

::include cpp/u1-order-1.out.txt

> **Exam tip:** "Quick sort और merge sort की तुलना करो", "Heap sort को उदाहरण के साथ समझाओ और उसकी complexity derive करो", "Build-heap O(n) क्यों है?", "Ω(n log n) lower bound prove करो", और "Median of medians समझाओ और उसका recurrence हल करो" जैसे प्रश्नों की उम्मीद रखो। हर sort के लिए एक छोटा array trace बनाओ।
