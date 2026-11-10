# Unit V: चयनित विषय

## 5.1 Algebraic computation

Polynomials और integers पर arithmetic के algorithms। एक polynomial A(x) = a<sub>0</sub> + a<sub>1</sub>x + ... + a<sub>n-1</sub>x<sup>n-1</sup> का *degree-bound* n होता है।

### Polynomial evaluation: Horner's rule

- Naive evaluation x की हर power निकालता है: Θ(n²) multiplications (या 2n-1, अगर powers क्रमिक रूप से बनाई जाएँ)।
- **Horner's rule** A(x) को A(x) = a<sub>0</sub> + x(a<sub>1</sub> + x(a<sub>2</sub> + ... + x·a<sub>n-1</sub>)) के रूप में लिखता है: ठीक **n-1 multiplications और n-1 additions**, यानी Θ(n)। यह एक general polynomial के लिए optimal है और synthetic division भी करता है।

### Polynomial multiplication

- **Coefficient form:** C = A·B के coefficients c<sub>k</sub> = Σ a<sub>i</sub>·b<sub>k-i</sub> होते हैं (एक *convolution*): schoolbook method की लागत Θ(n²) है।
- **Karatsuba (divide and conquer):** A = A<sub>0</sub> + x^h·A<sub>1</sub>, B = B<sub>0</sub> + x^h·B<sub>1</sub> में बाँटें। तब AB = A<sub>0</sub>B<sub>0</sub> + x^h[(A<sub>0</sub>+A<sub>1</sub>)(B<sub>0</sub>+B<sub>1</sub>) - A<sub>0</sub>B<sub>0</sub> - A<sub>1</sub>B<sub>1</sub>] + x^(2h)·A<sub>1</sub>B<sub>1</sub>: चार की जगह **तीन** आधे-आकार के products, T(n) = 3T(n/2) + Θ(n) = Θ(n^(log₂3)) = **Θ(n^1.585)**। यही trick बड़े integers को गुणा करती है (digits ही coefficients हैं, x = base)।
- **FFT:** point-value form में बदलें, pointwise गुणा करें, वापस बदलें: Θ(n log n) (section 5.2)।

### Number-theoretic algorithms

- **Euclid's GCD:** gcd(a, b) = gcd(b, a mod b)। steps की संख्या O(log min(a,b)) है; सबसे बुरा case दो लगातार Fibonacci numbers हैं (Lamé's theorem)।
- **Extended Euclid:** ax + by = gcd(a, b) (Bézout identity) वाले x, y भी लौटाता है। अगर gcd(a, m) = 1 है तो x, a का modulo m पर **modular inverse** है। RSA में इस्तेमाल होता है।
- **Modular exponentiation (square and multiply):** a^e mod m, O(log e) multiplications में, a^e = (a^(e/2))² का उपयोग करके (e विषम हो तो a से गुणा)।
- **Matrix exponentiation** Fibonacci numbers O(log n) में देता है; **primality testing** section 5.6 में है।

::include cpp/u5-alg-1.cpp

::include cpp/u5-alg-1.out.txt

## 5.2 Fast Fourier Transform (FFT)

- **Degree-bound n वाले polynomial के दो representations:** coefficient form (a<sub>0..n-1</sub>) और *point-value form* (n अलग-अलग points पर values)। Evaluation और interpolation इनके बीच बदलते हैं। Multiplication coefficient form में Θ(n²) है, पर point-value form में सिर्फ़ Θ(n) (values को pointwise गुणा करें; 2n points चाहिए क्योंकि product का degree-bound 2n-1 है)। FFT दोनों conversions को तेज़ बनाता है।
- **Complex roots of unity:** ω<sub>n</sub> = e^(2πi/n); n-th roots ω<sub>n</sub><sup>k</sup>, k = 0..n-1 हैं। (a<sub>0..n-1</sub>) का **DFT**: y<sub>k</sub> = A(ω<sub>n</sub><sup>k</sup>) = Σ a<sub>j</sub>·ω<sub>n</sub><sup>jk</sup>। सीधे निकालने पर लागत Θ(n²) है।
- **Divide and conquer (n, 2 की power):** even और odd coefficients में बाँटें, A(x) = A<sub>even</sub>(x²) + x·A<sub>odd</sub>(x²)। *Halving lemma*: n-th roots के squares n/2-th roots हैं (हर एक दो बार), इसलिए subproblems आधे आकार के DFTs हैं: Recurrence T(n) = 2T(n/2) + Θ(n) ⇒ **Θ(n log n)**।
- **Inverse DFT:** वही algorithm, ω<sub>n</sub> की जगह ω<sub>n</sub><sup>-1</sup> के साथ, और अंत में हर value को n से भाग देना।
- **तेज़ polynomial multiplication (convolution theorem):** (1) दोनों polynomials को zeros से pad करके length n करें जो 2 की power ≥ deg(A) + deg(B) + 1 हो; (2) दोनों का FFT: Θ(n log n); (3) pointwise गुणा: Θ(n); (4) inverse FFT; (5) integers में round करें। कुल Θ(n log n)।
- **Iterative FFT:** input को bit-reversal order में लगाएँ, फिर जोड़ों को combine करें, फिर चौकड़ियों को, ... तीन nested loops के साथ; O(1) अतिरिक्त space और कोई recursion नहीं।
- **Precision:** double-precision FFT मध्यम आकार और coefficients के लिए सटीक है; सटीक integer results के लिए *number theoretic transform* (NTT) इस्तेमाल करें, यानी वही algorithm किसी prime (जैसे 998244353) के modulo arithmetic में, primitive root of unity के साथ।
- **Applications:** big-integer multiplication, signal और image processing, audio filtering, wildcards के साथ polynomial और string matching, counting problems (जैसे subset sums), Toeplitz systems हल करना।

```text
y[k]       = E[k] + ω^k · O[k]
y[k + n/2] = E[k] - ω^k · O[k]            for k = 0 .. n/2 - 1         ("butterfly")
```

::include cpp/u5-fft-1.cpp

::include cpp/u5-fft-1.out.txt

## 5.3 String matching

> **Problem:** वे सभी *valid shifts* s ढूँढें जिनके लिए pattern P[0..m-1] text T[0..n-1] में T[s] से शुरू होकर आता है: T[s..s+m-1] = P। Notation: n = |T|, m = |P|, Σ = alphabet।

| Algorithm | Preprocessing | Matching time | विचार |
|---|---|---|---|
| Naive | 0 | O((n - m + 1)·m) | हर shift आज़माएँ, character-by-character तुलना करें |
| Rabin-Karp | O(m) | O(n + m) expected, O(nm) worst | Pattern और हर window के hash values की तुलना करें; window hash एक *rolling hash* से O(1) में update होता है; hash match पर verify करें (spurious hits संभव) |
| Finite automaton | O(m·\|Σ\|) | Θ(n) | एक DFA बनाएँ जिसकी state = अब तक पढ़े text के suffix के रूप में मौजूद P के सबसे लंबे prefix की length; state m पर accept |
| Knuth-Morris-Pratt (KMP) | O(m) | Θ(n) | Prefix function π[i] = P[0..i] के सबसे लंबे proper prefix की length जो suffix भी है; mismatch पर दोबारा शुरू करने की जगह π से shift करें, इसलिए text pointer कभी पीछे नहीं जाता |
| Boyer-Moore (और Horspool) | O(m + \|Σ\|) | औसतन sublinear (लगभग n/m), O(nm) worst | Pattern के *दाएँ* सिरे से तुलना करें; mismatch पर bad-character (और good-suffix) rule से कई positions आगे कूदें |

- **Rabin-Karp hash:** h(window) = Σ T[s+i]·d^(m-1-i) mod q। Window खिसकाने पर: h<sub>s+1</sub> = (d·(h<sub>s</sub> - T[s]·d^(m-1)) + T[s+m]) mod q। बड़ा prime q झूठे matches को दुर्लभ बनाता है; यह 2-D patterns और एक साथ कई patterns खोजने तक भी बढ़ता है।
- **KMP amortized analysis:** variable k (matched length) हर text character पर अधिकतम एक बार बढ़ता है और हर घटाव (k = π[k-1]) का भुगतान पहले की किसी बढ़त से होता है, इसलिए loops कुल मिलाकर O(n) और O(m) हैं।

::include cpp/u5-string-1.cpp

::include cpp/u5-string-1.out.txt

## 5.4 NP-completeness का सिद्धांत

### Easy बनाम hard problems

- **Polynomial time:** running time किसी constant k के लिए O(n^k); इसे "tractable" माना जाता है। Exponential या factorial time को बड़े n के लिए intractable माना जाता है।
- **Decision problem:** उत्तर yes/no होता है। सिद्धांत decision problems के लिए कहा जाता है (optimization problem को एक में बदला जा सकता है: "क्या cost ≤ K वाला tour है?")।

| Class | अर्थ |
|---|---|
| **P** | वे decision problems जो एक deterministic algorithm द्वारा polynomial time में *हल* हो सकती हैं (sorting, shortest path, MST, matching, 2-SAT, primality)। |
| **NP** | वे decision problems जिनके "yes" उत्तर किसी छोटे certificate के साथ polynomial time में *verify* हो सकते हैं (समतुल्य रूप से: non-deterministic machine द्वारा polynomial time में हल)। Hamiltonian cycle, SAT, subset sum, clique, vertex cover, graph colouring, TSP-decision NP में हैं। |
| **NP-hard** | NP की हर problem जितनी कम से कम कठिन: NP की हर problem polynomial time में इसमें reduce होती है। यह NP के बाहर भी हो सकती है (जैसे halting problem, या optimization versions)। |
| **NP-complete (NPC)** | NP में *और* NP-hard: NP की सबसे कठिन problems। अगर किसी भी NPC problem का polynomial algorithm हो, तो P = NP। |
| **co-NP** | वे problems जिनके "no" उत्तरों के छोटे certificates होते हैं (जैसे tautology; primality को बाद में P में दिखाया गया)। |

- P ⊆ NP निश्चित है। **P = NP** है या नहीं, यह computer science की सबसे बड़ी open problem है (एक Millennium Prize problem); ज़्यादातर शोधकर्ता मानते हैं कि P ≠ NP।
- **Polynomial-time reduction A ≤<sub>p</sub> B:** polynomial time में computable एक function f ऐसा कि x, A का yes-instance है ⇔ f(x), B का yes-instance है। तब B का algorithm A का algorithm देता है, इसलिए B कम से कम A जितनी *कठिन* है। Reductions transitive होते हैं।
- **Problem B को NP-complete कैसे सिद्ध करें:**
    1. B ∈ NP दिखाएँ: एक certificate और polynomial-time verifier बताएँ।
    2. कोई ज्ञात NP-complete problem A चुनें और polynomial-time reduction A ≤<sub>p</sub> B दें।
    3. दोनों दिशाओं में correctness सिद्ध करें (yes ⇒ yes और yes ⇐ yes) और यह भी कि reduction polynomial time में चलता है।
- **Cook-Levin theorem (1971):** SAT (boolean satisfiability) NP-complete है: कोई भी NP computation एक boolean formula के रूप में encode हो सकती है। यह पहली NP-complete problem है; बाकी सब इससे reductions द्वारा सिद्ध होती हैं।

### Reductions की classical chain

```text
SAT  ->  3-SAT  ->  Independent Set / Clique  ->  Vertex Cover  ->  Hamiltonian Cycle  ->  TSP
                  3-SAT  ->  3-Colouring            3-SAT -> Subset Sum -> Partition -> Knapsack
```

| NP-complete (decision) | मिलती-जुलती problem जो P में है |
|---|---|
| 3-SAT | 2-SAT |
| Hamiltonian cycle | Euler cycle |
| Longest simple path | Shortest path |
| 3-colouring | 2-colouring (bipartite test) |
| 0/1 knapsack, subset sum (weakly NP-complete: pseudo-polynomial DP मौजूद है) | Fractional knapsack |
| Vertex cover, independent set, clique | Matching, bipartite graphs में vertex cover (König's theorem) |
| Integer linear programming | Linear programming |
| Travelling salesman (decision) | Minimum spanning tree |

### Exam में लिखने योग्य उदाहरण reductions

- **Independent Set ↔ Vertex Cover ↔ Clique:** S, G का independent set है ⇔ V \\ S, G का vertex cover है ⇔ S, complement graph में clique है। इसलिए G में size k का independent set है ⇔ G में size n - k का vertex cover है, और ये problems linear time में आपस में reducible हैं।
- **3-SAT ≤<sub>p</sub> Independent Set:** m clauses वाले formula के लिए एक graph बनाएँ जिसमें हर clause के लिए एक *triangle* हो (clause के हर literal के लिए एक vertex) और हर उस vertex-जोड़ी के बीच एक edge हो जिनमें complementary literals हैं (अलग clauses में x और ¬x)। Formula satisfiable है ⇔ graph में size m का independent set है। (हर clause से एक literal चुनना = एक satisfying choice; complementary-literal edges x और ¬x दोनों चुनने से रोकते हैं।)
- **Hamiltonian Cycle ≤<sub>p</sub> TSP:** complete graph पर G की हर edge को cost 1 और हर non-edge को cost 2 दें; G में Hamiltonian cycle है ⇔ cost ≤ n वाला TSP tour मौजूद है।

### NP-hard problems से निपटना

Pruning के साथ exact exponential algorithms (backtracking, branch and bound, subsets पर DP), guaranteed ratios वाले approximation algorithms (5.5), randomized algorithms, heuristics और local search (simulated annealing, genetic algorithms), special cases हल करना (planar, bounded treewidth), और fixed-parameter tractable algorithms।

::include cpp/u5-np-1.cpp

::include cpp/u5-np-1.out.txt

### Code में एक असली reduction: 3-SAT ≤<sub>p</sub> Independent Set

यह program random 3-CNF formulas के लिए ऊपर बताया गया gadget graph बनाता है और दोनों तरफ़ brute force से जाँचता है कि "formula satisfiable है" और "graph में size m का independent set है" हमेशा एक ही उत्तर देते हैं। दूसरा हिस्सा independent set / vertex cover / complement में clique वाली identity जाँचता है।

::include cpp/u5-np-2.cpp

::include cpp/u5-np-2.out.txt

## 5.5 Approximation algorithms

- किसी NP-hard optimization problem के लिए, **approximation algorithm** polynomial time में चलता है और ऐसा solution लौटाता है जिसका cost C optimum C* के प्रमाणित रूप से करीब है। **Approximation ratio** ρ(n) इस शर्त को पूरा करता है: max(C/C*, C*/C) ≤ ρ(n) (इसलिए minimization और maximization दोनों के लिए ρ ≥ 1)। एक *ρ-approximation* गारंटी देता है कि cost factor ρ के भीतर है।
- **PTAS** (polynomial-time approximation scheme): हर fixed ε > 0 के लिए n में polynomial time वाला (1+ε)-approximation (1/ε में exponential हो सकता है)। **FPTAS:** time 1/ε में भी polynomial होता है (0/1 knapsack में एक है: values को scale और round करें, फिर DP चलाएँ)।
- **Vertex cover, 2-approximation:** बार-बार ऐसी edge (u, v) चुनें जिसके दोनों endpoints uncovered हैं, *दोनों* को cover में डालें, और उनसे छूने वाली सभी edges हटा दें। चुनी गई edges एक matching M बनाती हैं; किसी भी cover में हर matching edge का कम से कम एक endpoint होना चाहिए, इसलिए OPT ≥ |M|, जबकि algorithm 2|M| ≤ 2·OPT लौटाता है। O(V + E)।
- **Metric TSP, 2-approximation (MST-based):** triangle inequality के साथ: (1) एक MST T निकालें; (2) T का preorder walk लें और दोहराए गए vertices को shortcut करें। cost(T) ≤ OPT (optimal tour की एक edge हटाने पर spanning tree मिलता है); पूरा walk 2·cost(T) का है; triangle inequality के कारण shortcutting से cost नहीं बढ़ता, इसलिए tour ≤ 2·OPT। **Christofides** इसे 1.5 तक सुधारता है (odd-degree vertices पर minimum matching जोड़ें, Euler tour इस्तेमाल करें)। *General* TSP के लिए, जब तक P = NP न हो, कोई constant-factor approximation मौजूद नहीं है।
- **Set cover, greedy:** बार-बार वह set चुनें जो अभी तक uncovered सबसे ज़्यादा elements cover करता है: ratio H(d) ≤ ln n + 1, और polynomial time में यही लगभग सर्वोत्तम संभव है।
- **अन्य classics:** load balancing (list scheduling 2, LPT 4/3), bin packing (first-fit decreasing 11/9 OPT + 6/9), max-cut (random assignment expectation में 1/2 देता है), 0/1 knapsack (FPTAS), k-center (greedy 2)।

::include cpp/u5-approx-1.cpp

::include cpp/u5-approx-1.out.txt

::include cpp/u5-approx-2.cpp

::include cpp/u5-approx-2.out.txt

::include cpp/u5-approx-3.cpp

::include cpp/u5-approx-3.out.txt

## 5.6 Randomized algorithms

- एक **randomized algorithm** execution के दौरान random choices करता है, इसलिए उसका व्यवहार input के साथ-साथ random bits पर भी निर्भर करता है। Analysis algorithm के अपने coins पर *expected* running time या *error probability* का होता है, inputs के किसी distribution पर नहीं।
- **Las Vegas algorithms:** हमेशा सही उत्तर देते हैं; सिर्फ़ running time random होता है (randomized quick sort, randomized quickselect)।
- **Monte Carlo algorithms:** running time निश्चित, पर उत्तर छोटी probability से गलत हो सकता है; k बार दोहराने (independent coins के साथ) से error exponentially घटता है (Miller-Rabin, Karger's min cut, Freivalds' matrix-product check)। *One-sided error:* "no" उत्तर हमेशा सही होता है (या इसका उलटा)।
- **Randomized quick sort analysis:** मान लें z<sub>1</sub> < ... < z<sub>n</sub> sorted elements हैं। z<sub>i</sub> और z<sub>j</sub> की तुलना तभी होती है जब z<sub>i..j</sub> में से चुना गया पहला pivot उनमें से एक हो, जिसकी probability 2/(j-i+1) है। Linearity of expectation से E[comparisons] = Σ<sub>i<j</sub> 2/(j-i+1) ≤ 2n·H<sub>n</sub> = O(n log n), लगभग 1.39·n·log₂ n।
- **Miller-Rabin primality test:** n-1 = 2^s·d लिखें जहाँ d विषम है। Random base a के लिए, n को "probably prime" घोषित किया जाता है अगर किसी 0 ≤ r < s के लिए a^d ≡ 1 या a^(2^r·d) ≡ -1 (mod n)। एक composite n अधिकतम 1/4 bases के लिए पास होता है, इसलिए k random bases पर error ≤ 4^(-k)। Time O(k·log³ n)। (Fermat's test को 561 जैसे Carmichael numbers बेवकूफ़ बना देते हैं; Miller-Rabin को नहीं। Deterministic AKS test P में है पर practice में धीमा है।) RSA primes बनाने में इस्तेमाल होता है।
- **Karger's min-cut:** n-2 बार दोहराएँ: एक random edge चुनें और उसे *contract* करें (उसके endpoints merge करें)। बचे हुए दो super-vertices एक cut तय करते हैं। एक विशेष minimum cut के बचे रहने की probability ≥ 2/(n(n-1)) है, इसलिए n²/2·ln n repetitions इसे probability ≥ 1 - 1/n से ढूँढ लेते हैं।
- **Freivalds' algorithm:** A·B = C जाँचने के लिए O(n²) में, दोबारा गणना के लिए ज़रूरी O(n^2.8) की जगह: एक random 0/1 vector x चुनें और A(Bx) = Cx जाँचें। अगर AB ≠ C है तो test के पकड़ न पाने की probability ≤ 1/2 है; k rounds पर error ≤ 2^(-k)।
- **अन्य उपयोग:** universal hashing, skip lists और treaps (expected O(log n) operations), random sampling और reservoir sampling, approximation के लिए randomized rounding, load balancing, और median finding में randomized pivoting।

::include cpp/u5-rand-1.cpp

::include cpp/u5-rand-1.out.txt

> **Exam tip:** NP-completeness के उत्तरों में हमेशा दोनों भाग लिखें (NP में, reduction से NP-hard) और उस problem का नाम लें जिससे आप reduce कर रहे हैं। Approximation के उत्तरों में ratio बताएँ और उसे दो पंक्तियों में सिद्ध करें (OPT पर lower bound, algorithm पर upper bound)। FFT के लिए recurrence, butterfly और पाँच-चरणों वाला polynomial multiplication लिखें।
