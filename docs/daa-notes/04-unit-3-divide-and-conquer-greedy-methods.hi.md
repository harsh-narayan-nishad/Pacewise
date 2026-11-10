# Unit III: Divide and Conquer, Greedy Methods

## 3.1 Divide and conquer

> **Divide and conquer (D&C):** (1) problem को उसी problem के छोटे a instances में *divide* करें, (2) उन्हें recursively हल करके *conquer* करें (base case सीधे हल होता है), (3) उत्तरों को *combine* करें। Running time T(n) = a·T(n/b) + D(n) + C(n) को satisfy करता है, जिसे master theorem से हल किया जाता है (section 1.4 देखें)।

- **Template:** `solve(P): if small(P) return direct(P); split P into P1..Pa; return combine(solve(P1), ..., solve(Pa))`।
- **Strengths:** साफ़ recursive proofs, स्वाभाविक parallelism, छोटे subproblems पर अच्छा cache behaviour। **Weaknesses:** recursion overhead, और अगर subproblems *overlap* करें तो यह व्यर्थ है (तब dynamic programming उपयोग करें, Unit IV)।
- **Examples:** merge sort Θ(n log n), quick sort, binary search Θ(log n), Strassen Θ(n^2.81), Karatsuba Θ(n^1.585), closest pair of points Θ(n log n), FFT Θ(n log n), convex hull, maximum subarray, median of medians।

## 3.2 Searching और maximum-subarray problem

- **Binary search:** sorted array; middle से compare करें, आधा हिस्सा छोड़ दें। T(n) = T(n/2) + 1 = Θ(log n)। यह किसी भी *monotone* predicate पर काम करता है ("पहला index जहाँ f true है"); यही विचार square roots, minimum feasible capacity आदि खोजने में काम आता है।
- **Related:** interpolation search (uniform data पर O(log log n), worst में O(n)), exponential search (unbounded arrays), ternary search (unimodal functions)।
- **Maximum subarray:** सबसे बड़े sum वाला contiguous subarray खोजें। D&C: सबसे अच्छा subarray left half में, right half में, या middle को पार करता हुआ होता है। हर half चार संख्याएँ लौटाता है (best, best prefix, best suffix, total) और combine step हर merge पर O(1) काम है, इसलिए इस formulation में T(n) = 2T(n/2) + O(1) = Θ(n) (textbook का crossing-sum version Θ(n log n) है)। Kadane का DP algorithm भी इसे Θ(n) में हल करता है।

::include cpp/u3-search-1.cpp

::include cpp/u3-search-1.out.txt

## 3.3 Matrix multiplication (Strassen)

- **Classical algorithm:** C[i][j] = Σ A[i][k]·B[k][j]: तीन nested loops, Θ(n³) multiplications। हर n×n matrix को चार n/2 × n/2 blocks में बाँटकर classical block formulas उपयोग करने पर **8** half-size multiplications लगते हैं: T(n) = 8T(n/2) + Θ(n²) = Θ(n³), कोई फ़ायदा नहीं।
- **Strassen (1969):** product को सिर्फ़ **7** half-size multiplications से निकालता है (साथ में Θ(n²) cost के 18 additions/subtractions): T(n) = 7T(n/2) + Θ(n²) = Θ(n^(log₂7)) = **Θ(n^2.807)**।
- सात products (blocks A11..A22, B11..B22):
- **व्यवहार में:** n का power of two होना ज़रूरी है (zeros से pad करें); recursion overhead और अतिरिक्त memory के कारण Strassen सिर्फ़ बड़े n के लिए जीतता है, इसलिए implementations एक cutoff (आम तौर पर 32 से 128) से नीचे classical algorithm पर चले जाते हैं। यह numerically थोड़ा कम stable भी है। Asymptotically तेज़ algorithms मौजूद हैं (लगभग n^2.37) पर practical नहीं हैं।

```text
M1 = (A11 + A22)(B11 + B22)      C11 = M1 + M4 - M5 + M7
M2 = (A21 + A22) B11             C12 = M3 + M5
M3 = A11 (B12 - B22)             C21 = M2 + M4
M4 = A22 (B21 - B11)             C22 = M1 - M2 + M3 + M6
M5 = (A11 + A12) B22
M6 = (A21 - A11)(B11 + B12)
M7 = (A12 - A22)(B21 + B22)
```

::include cpp/u3-matrix-1.cpp

::include cpp/u3-matrix-1.out.txt

## 3.4 Convex hull

> बिंदुओं के एक set का **Convex hull**: वह सबसे छोटा convex polygon जिसमें वे सभी हों (कल्पना करें कि कीलों के चारों ओर रबर बैंड खिंचा है)। Output: hull के vertices क्रम में। मुख्य primitive: (b - a) × (c - a) का **cross product** sign बताता है कि a→b→c बाएँ मुड़ता है (> 0), दाएँ मुड़ता है (< 0) या collinear है (= 0)।

| Algorithm | विचार | Time |
|---|---|---|
| Brute force | एक जोड़ी (p, q) hull edge है अगर बाकी सभी बिंदु एक ही ओर हों | O(n³) |
| Jarvis march (gift wrapping) | सबसे बाएँ बिंदु से शुरू करके बार-बार सबसे counter-clockwise बिंदु चुनें | O(n·h), h = hull size |
| Graham scan / Andrew monotone chain | बिंदुओं को sort करें, stack से lower और upper hulls बनाएँ, दाएँ मोड़ पर pop करें | O(n log n) |
| **Quickhull (divide and conquer)** | Extreme बिंदुओं से गुज़रती रेखा set को बाँटती है; रेखा से सबसे दूर का बिंदु hull का vertex है; triangle के अंदर के बिंदु हटा दिए जाते हैं; दोनों बाहरी हिस्सों पर recurse करें (quick sort की तरह) | औसतन O(n log n), worst में O(n²) |
| Divide-and-conquer merge hull | x से बाँटें, दो hulls निकालें, दो common tangents खोजकर उन्हें merge करें | Θ(n log n) |
| Chan's algorithm | Grouping, Graham और Jarvis को जोड़ता है | O(n log h), output sensitive |

Lower bound: hull निकालने के लिए comparison/algebraic model में Ω(n log n) चाहिए क्योंकि sorting इसमें reduce हो जाती है (बिंदुओं को parabola y = x² पर रखें: hull का क्रम ही sorted क्रम है)।

::include cpp/u3-hull-1.cpp

::include cpp/u3-hull-1.out.txt

## 3.5 Greedy method

> **Greedy algorithm:***अभी* जो विकल्प सबसे अच्छा दिखे वही चुनता है, और उसे कभी वापस नहीं लेता। सही होने के लिए दो गुण चाहिए:
>
> - **Greedy-choice property:** कोई optimal solution greedy पहली पसंद को शामिल करता है।
> - **Optimal substructure:** greedy choice के बाद बाकी हिस्सा एक छोटी problem का optimal solution है।

- **Proof technique, exchange argument:** कोई भी optimal solution लें, दिखाएँ कि आप उसकी पहली पसंद को greedy वाली से बदल सकते हैं बिना उसे बदतर किए। या *greedy stays ahead* (partial solutions की step-by-step तुलना करें)।
- **सामान्य रूप:** candidates को किसी criterion से sort करें (O(n log n)), फिर एक बार scan करें, और candidate को तब रखें जब वह feasible रहे। Complexity आम तौर पर sort या priority queue से तय होती है।
- **Greedy fail हो सकता है:** coins {1, 3, 4} के साथ amount 6 का coin change: greedy 4+1+1 (3 coins) देता है पर 3+3 (2 coins) optimal है; 0/1 knapsack (नीचे देखें)। ऐसी problems के लिए dynamic programming उपयोग करें।

| Greedy बनाम | Dynamic programming | Divide and conquer |
|---|---|---|
| Subproblems | एक choice करता है, *एक* subproblem हल करता है | Independent subproblems |
| Decisions | कभी दोबारा नहीं देखे जाते | सभी विकल्प explore करता है, overlapping subproblems के results store करता है |
| Speed | आम तौर पर सबसे तेज़ | Polynomial, ज़्यादा memory |
| Correctness | हर problem के लिए proof चाहिए | Recurrence सही हो तो हमेशा सही |

## 3.6 Activity selection

Start और finish times वाली n activities दी गई हैं, परस्पर compatible (non-overlapping) activities की अधिकतम संख्या चुनें। **Greedy rule: हमेशा वह compatible activity चुनें जो सबसे पहले खत्म हो।** Proof (exchange): किसी भी optimal schedule में पहली activity को सबसे जल्दी खत्म होने वाली से बदलें; इससे कम से कम उतनी ही जगह बचती है, इसलिए schedule valid और optimal रहता है। Sorting के लिए Θ(n log n), scan के लिए Θ(n) time। (सबसे जल्दी start या सबसे छोटी duration के अनुसार greedy *गलत* है।)

::include cpp/u3-act-1.cpp

::include cpp/u3-act-1.out.txt

## 3.7 Knapsack: fractional (greedy) बनाम 0/1

- **Fractional knapsack:** items जिनका value v<sub>i</sub> और weight w<sub>i</sub> है, capacity W, items को बाँटा जा सकता है। **Greedy rule: value/weight ratio के अनुसार (descending) sort करें और बचे हुए सबसे अच्छे item में से जितना संभव हो उतना लें।** Optimal। Time Θ(n log n)।
- **0/1 knapsack:** हर item या तो पूरा लिया जाता है या बिल्कुल नहीं। वही greedy optimal *नहीं* है (नीचे उदाहरण); इसके लिए Θ(nW) time वाला dynamic programming (Unit IV) चाहिए। यह सामान्यतः NP-hard है (pseudo-polynomial DP)।

::include cpp/u3-knap-1.cpp

::include cpp/u3-knap-1.out.txt

## 3.8 Optimal reliability allocation

**Problem.** एक system में n stages *series* में जुड़े हैं; system तभी काम करता है जब हर stage काम करे। Stage i ऐसे devices उपयोग करता है जिनकी reliability r<sub>i</sub> और प्रत्येक की cost c<sub>i</sub> है। Stage i पर device की m<sub>i</sub> copies को *parallel* में लगाने से उसकी reliability Φ<sub>i</sub>(m<sub>i</sub>) = 1 - (1 - r<sub>i</sub>)^m<sub>i</sub> हो जाती है। m<sub>1..n</sub> ≥ 1 ऐसे चुनें कि **system reliability ∏ Φ<sub>i</sub>(m<sub>i</sub>) अधिकतम हो, शर्त यह कि कुल cost Σ c<sub>i</sub>·m<sub>i</sub> ≤ C रहे**।

- **Greedy (marginal gain) method:** हर stage में एक device से शुरू करें, फिर बार-बार उस stage में एक और device जोड़ें जिसकी प्रति इकाई cost reliability में सुधार सबसे ज़्यादा हो, जब तक budget अनुमति दे। तेज़, O(n·extra devices), पर यह सिर्फ़ एक *heuristic* है: budget c<sub>i</sub> के आकार के टुकड़ों में खर्च होता है, इसलिए local रूप से सबसे अच्छा चुनाव वह पैसा खत्म कर सकता है जो किसी बेहतर combination को चाहिए था। नीचे के sample पर यह optimal है, पर 1000 random 4-stage instances के test (section 4.4) में यह exact उत्तर से सिर्फ़ लगभग 82% में मेल खाया, और सबसे बुरे case में optimal reliability का 87% मिला।
- **Exact method:** budget पर dynamic programming (section 4.4), जिसके optimal होने की गारंटी है। Dominance rules के साथ branch and bound भी उपयोग हो सकता है।
- Stage i पर copies की upper bound: u<sub>i</sub> = ⌊(C + c<sub>i</sub> - Σ c<sub>j</sub>) / c<sub>i</sub>⌋ (आपको हर दूसरे stage में एक device रखना ही है)।

::include cpp/u3-rel-1.cpp

::include cpp/u3-rel-1.out.txt

## 3.9 Minimum spanning trees (Prim और Kruskal)

> Connected undirected graph का **Spanning tree**: एक subgraph जो tree है (connected, acyclic) और सभी V vertices को शामिल करता है, इसलिए V-1 edges। **MST:** न्यूनतम कुल edge weight वाला spanning tree। अगर सभी weights अलग-अलग हों तो MST unique होता है।

- **Cut property:** किसी भी cut (S, V-S) के लिए, उसे पार करने वाला सबसे हल्का edge किसी MST का हिस्सा होता है। **Cycle property:** किसी भी cycle का सबसे भारी edge ज़रूरी नहीं है। Prim और Kruskal दोनों cut property से justify होते हैं (generic greedy MST algorithm: एक "safe" edge जोड़ते रहें)।
- **Kruskal:** सभी edges को weight से sort करें; उन्हें scan करें और edge तब जोड़ें जब वह दो अलग components को जोड़े (**disjoint-set union** (union-find) structure से जाँचा जाता है)। Time O(E log E) = O(E log V)। Sparse graphs के लिए अच्छा।
- **Prim:** एक start vertex से एक ही tree उगाएँ; हर step में tree से बाहर जाने वाला सबसे सस्ता edge जोड़ें (edge weight पर keyed priority queue)। Adjacency matrix और सरल array के साथ Time O(V²), binary heap के साथ O(E log V), Fibonacci heap के साथ O(E + V log V)। Dense graphs के लिए अच्छा।
- **Union-find:** path compression और union by rank के साथ हर operation O(α(n)) है, व्यवहार में लगभग constant (α inverse Ackermann function है)।

|  | Prim | Kruskal |
|---|---|---|
| बढ़ता है | एक tree | एक forest जो merge होता जाता है |
| मुख्य structure | Priority queue | Sorted edge list + DSU |
| Time | O(E log V) | O(E log E) |
| इन पर सबसे अच्छा | Dense graphs | Sparse graphs |
| Disconnected graph पर काम करता है | नहीं (सिर्फ़ एक component) | हाँ (minimum spanning forest देता है) |

::include cpp/u3-mst-1.cpp

::include cpp/u3-mst-1.out.txt

## 3.10 Single-source shortest paths: Dijkstra और Bellman-Ford

- **Problem:** source s से weighted graph के हर vertex तक का shortest path (न्यूनतम कुल weight)। **Relaxation:** अगर d[u] + w(u,v) < d[v] तो d[v] = d[u] + w(u,v) set करें। नीचे के सभी algorithms बार-बार की गई relaxation हैं। **Optimal substructure:** shortest path का कोई sub-path स्वयं भी shortest path होता है।
- **Dijkstra** (greedy): finalized vertices का एक set रखें; बार-बार सबसे छोटी tentative distance वाले non-finalized vertex u को लें, उसे finalize करें और उसके outgoing edges को relax करें। **Non-negative weights ज़रूरी हैं**: तब कोई बाद का path finalized vertex को सुधार नहीं सकता (पहले ऐसे vertex पर contradiction से proof जो गलत distance के साथ finalize हुआ)। Array के साथ Time O(V²), binary heap के साथ O((V + E) log V), Fibonacci heap के साथ O(E + V log V)। Negative edges के साथ fail होता है (जैसे s→a = 2, s→b = 3, b→a = -2: a को distance 2 पर finalize करना गलत है, असली distance 1 है)।
- **Bellman-Ford** (dynamic programming जैसा): *सभी* edges को V-1 बार relax करें (shortest path में अधिकतम V-1 edges होते हैं)। एक और round जो फिर भी कुछ relax करे, यह साबित करता है कि s से पहुँचने योग्य **negative-weight cycle** है (तब distances undefined हैं)। Negative edges को संभालता है। Time O(V·E), space O(V)। अगर पूरा round कुछ नहीं बदलता तो जल्दी रुक सकता है।
- **DAG में shortest paths:** edges को topological order में relax करें: O(V + E), negative weights के साथ भी काम करता है। Unweighted graphs के लिए BFS O(V + E) में shortest paths देता है।

|  | Dijkstra | Bellman-Ford |
|---|---|---|
| Negative edges | नहीं | हाँ |
| Negative cycle पहचानता है | नहीं | हाँ |
| Time | O((V+E) log V) | O(VE) |
| Strategy | Greedy | बार-बार relaxation (DP) |

::include cpp/u3-sssp-1.cpp

::include cpp/u3-sssp-1.out.txt

## 3.11 Huffman coding (classic greedy)

Data को compress करने के लिए अधिक बार आने वाले characters को छोटे binary codes दें, एक optimal *prefix code* के साथ (कोई code किसी दूसरे का prefix नहीं होता, इसलिए decoding अस्पष्टता-मुक्त है)। **Greedy rule: बार-बार दो सबसे कम frequency वाले nodes को एक नए node में merge करें जिसकी frequency उनका योग हो** (min-heap)। Time O(n log n)। अंतिम tree हर character को उसका code देता है: बायाँ edge 0, दायाँ edge 1।

::include cpp/u3-huff-1.cpp

::include cpp/u3-huff-1.out.txt

> **Exam tip:** Prim/Kruskal/Dijkstra के प्रश्नों में, हर step पर चुना गया edge या vertex एक table में दिखाएँ। Bellman-Ford के लिए V-1 rounds में से हर के बाद distance array दिखाएँ। Complexity उस data structure के साथ बताएँ जो आपने माना है।
