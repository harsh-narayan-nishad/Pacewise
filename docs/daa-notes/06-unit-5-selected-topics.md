# Unit V: Selected Topics

## 5.1 Algebraic computation

Algorithms for arithmetic on polynomials and integers. A polynomial A(x) = a<sub>0</sub> + a<sub>1</sub>x + ... + a<sub>n-1</sub>x<sup>n-1</sup> has *degree-bound* n.

### Polynomial evaluation: Horner's rule

- Naive evaluation computes every power of x: Θ(n²) multiplications (or 2n-1 if powers are built incrementally).
- **Horner's rule** rewrites A(x) = a<sub>0</sub> + x(a<sub>1</sub> + x(a<sub>2</sub> + ... + x·a<sub>n-1</sub>)): exactly **n-1 multiplications and n-1 additions**, Θ(n). It is optimal for a general polynomial and also does synthetic division.

### Polynomial multiplication

- **Coefficient form:** C = A·B has coefficients c<sub>k</sub> = Σ a<sub>i</sub>·b<sub>k-i</sub> (a *convolution*): the schoolbook method costs Θ(n²).
- **Karatsuba (divide and conquer):** split A = A<sub>0</sub> + x^h·A<sub>1</sub>, B = B<sub>0</sub> + x^h·B<sub>1</sub>. Then AB = A<sub>0</sub>B<sub>0</sub> + x^h[(A<sub>0</sub>+A<sub>1</sub>)(B<sub>0</sub>+B<sub>1</sub>) - A<sub>0</sub>B<sub>0</sub> - A<sub>1</sub>B<sub>1</sub>] + x^(2h)·A<sub>1</sub>B<sub>1</sub>: **three** half-size products instead of four, T(n) = 3T(n/2) + Θ(n) = Θ(n^(log₂3)) = **Θ(n^1.585)**. The same trick multiplies big integers (digits are the coefficients, x = base).
- **FFT:** convert to point-value form, multiply pointwise, convert back: Θ(n log n) (section 5.2).

### Number-theoretic algorithms

- **Euclid's GCD:** gcd(a, b) = gcd(b, a mod b). The number of steps is O(log min(a,b)); the worst case is two consecutive Fibonacci numbers (Lamé's theorem).
- **Extended Euclid:** also returns x, y with ax + by = gcd(a, b) (Bézout identity). If gcd(a, m) = 1 then x is the **modular inverse** of a modulo m. Used in RSA.
- **Modular exponentiation (square and multiply):** a^e mod m in O(log e) multiplications, using a^e = (a^(e/2))² (times a if e is odd).
- **Matrix exponentiation** gives Fibonacci numbers in O(log n); **primality testing** is in section 5.6.

::include cpp/u5-alg-1.cpp

::include cpp/u5-alg-1.out.txt

## 5.2 Fast Fourier Transform (FFT)

- **Two representations of a polynomial of degree-bound n:** coefficient form (a<sub>0..n-1</sub>) and *point-value form* (values at n distinct points). Evaluation and interpolation convert between them. Multiplication is Θ(n²) in coefficient form but only Θ(n) in point-value form (multiply the values pointwise; you need 2n points because the product has degree-bound 2n-1). FFT makes the two conversions fast.
- **Complex roots of unity:** ω<sub>n</sub> = e^(2πi/n); the n-th roots are ω<sub>n</sub><sup>k</sup>, k = 0..n-1. **DFT** of (a<sub>0..n-1</sub>): y<sub>k</sub> = A(ω<sub>n</sub><sup>k</sup>) = Σ a<sub>j</sub>·ω<sub>n</sub><sup>jk</sup>. Computed directly it costs Θ(n²).
- **Divide and conquer (n a power of 2):** split into even and odd coefficients, A(x) = A<sub>even</sub>(x²) + x·A<sub>odd</sub>(x²). The *halving lemma*: the squares of the n-th roots are the n/2-th roots (each twice), so the subproblems are DFTs of half size:  Recurrence T(n) = 2T(n/2) + Θ(n) ⇒ **Θ(n log n)**.
- **Inverse DFT:** the same algorithm with ω<sub>n</sub><sup>-1</sup> in place of ω<sub>n</sub>, and a final division of every value by n.
- **Fast polynomial multiplication (convolution theorem):** (1) pad both polynomials with zeros to length n = a power of 2 ≥ deg(A) + deg(B) + 1; (2) FFT both: Θ(n log n); (3) multiply pointwise: Θ(n); (4) inverse FFT; (5) round to integers. Total Θ(n log n).
- **Iterative FFT:** reorder the input in bit-reversal order, then combine pairs, then quadruples, ... with three nested loops; O(1) extra space and no recursion.
- **Precision:** double-precision FFT is accurate for moderate sizes and coefficients; for exact integer results use the *number theoretic transform* (NTT), the same algorithm in arithmetic modulo a prime such as 998244353 with a primitive root of unity.
- **Applications:** big-integer multiplication, signal and image processing, audio filtering, polynomial and string matching with wildcards, counting problems (e.g. subset sums), solving Toeplitz systems.

```text
y[k]       = E[k] + ω^k · O[k]
y[k + n/2] = E[k] - ω^k · O[k]            for k = 0 .. n/2 - 1         ("butterfly")
```

::include cpp/u5-fft-1.cpp

::include cpp/u5-fft-1.out.txt

## 5.3 String matching

> **Problem:** find all *valid shifts* s such that pattern P[0..m-1] occurs in text T[0..n-1] starting at T[s]: T[s..s+m-1] = P. Notation: n = |T|, m = |P|, Σ = alphabet.

| Algorithm | Preprocessing | Matching time | Idea |
|---|---|---|---|
| Naive | 0 | O((n - m + 1)·m) | Try every shift, compare character by character |
| Rabin-Karp | O(m) | O(n + m) expected, O(nm) worst | Compare hash values of the pattern and each window; the window hash is updated in O(1) by a *rolling hash*; verify on a hash match (spurious hits possible) |
| Finite automaton | O(m·\|Σ\|) | Θ(n) | Build a DFA whose state = length of the longest prefix of P that is a suffix of the text read so far; accept at state m |
| Knuth-Morris-Pratt (KMP) | O(m) | Θ(n) | Prefix function π[i] = length of the longest proper prefix of P[0..i] that is also a suffix; on a mismatch shift using π instead of restarting, so the text pointer never moves back |
| Boyer-Moore (and Horspool) | O(m + \|Σ\|) | Sublinear on average (about n/m), O(nm) worst | Compare from the *right* end of the pattern; on a mismatch use the bad-character (and good-suffix) rule to jump several positions |

- **Rabin-Karp hash:** h(window) = Σ T[s+i]·d^(m-1-i) mod q. Moving the window: h<sub>s+1</sub> = (d·(h<sub>s</sub> - T[s]·d^(m-1)) + T[s+m]) mod q. A large prime q makes false matches rare; it also extends to 2-D patterns and to searching many patterns at once.
- **KMP amortized analysis:** the variable k (matched length) is increased at most once per text character and every decrease (k = π[k-1]) is paid by an earlier increase, so the loops are O(n) and O(m) in total.

::include cpp/u5-string-1.cpp

::include cpp/u5-string-1.out.txt

## 5.4 Theory of NP-completeness

### Easy versus hard problems

- **Polynomial time:** running time O(n^k) for some constant k; considered "tractable". Exponential or factorial time is considered intractable for large n.
- **Decision problem:** answer is yes/no. The theory is stated for decision problems (an optimization problem can be turned into one: "is there a tour of cost ≤ K?").

| Class | Meaning |
|---|---|
| **P** | Decision problems *solvable* in polynomial time by a deterministic algorithm (sorting, shortest path, MST, matching, 2-SAT, primality). |
| **NP** | Decision problems whose "yes" answers can be *verified* in polynomial time given a short certificate (equivalently: solvable in polynomial time by a non-deterministic machine). Hamiltonian cycle, SAT, subset sum, clique, vertex cover, graph colouring, TSP-decision are in NP. |
| **NP-hard** | At least as hard as every problem in NP: every NP problem reduces to it in polynomial time. May be outside NP (e.g. the halting problem, or optimization versions). |
| **NP-complete (NPC)** | In NP *and* NP-hard: the hardest problems in NP. If any NPC problem has a polynomial algorithm, then P = NP. |
| **co-NP** | Problems whose "no" answers have short certificates (e.g. tautology, primality was shown in P later). |

- P ⊆ NP is certain. Whether **P = NP** is the biggest open problem in computer science (a Millennium Prize problem); most researchers believe P ≠ NP.
- **Polynomial-time reduction A ≤<sub>p</sub> B:** a function f computable in polynomial time such that x is a yes-instance of A ⇔ f(x) is a yes-instance of B. Then an algorithm for B gives one for A, so B is *at least as hard* as A. Reductions are transitive.
- **How to prove problem B is NP-complete:**
    1. Show B ∈ NP: describe a certificate and a polynomial-time verifier.
    2. Choose a known NP-complete problem A and give a polynomial-time reduction A ≤<sub>p</sub> B.
    3. Prove correctness both ways (yes ⇒ yes and yes ⇐ yes) and that the reduction runs in polynomial time.
- **Cook-Levin theorem (1971):** SAT (boolean satisfiability) is NP-complete: any NP computation can be encoded as a boolean formula. It is the first NP-complete problem; all others are proved via reductions from it.

### The classical chain of reductions

```text
SAT  ->  3-SAT  ->  Independent Set / Clique  ->  Vertex Cover  ->  Hamiltonian Cycle  ->  TSP
                  3-SAT  ->  3-Colouring            3-SAT -> Subset Sum -> Partition -> Knapsack
```

| NP-complete (decision) | Similar problem that is in P |
|---|---|
| 3-SAT | 2-SAT |
| Hamiltonian cycle | Euler cycle |
| Longest simple path | Shortest path |
| 3-colouring | 2-colouring (bipartite test) |
| 0/1 knapsack, subset sum (weakly NP-complete: pseudo-polynomial DP exists) | Fractional knapsack |
| Vertex cover, independent set, clique | Matching, vertex cover in bipartite graphs (König's theorem) |
| Integer linear programming | Linear programming |
| Travelling salesman (decision) | Minimum spanning tree |

### Example reductions you can state in the exam

- **Independent Set ↔ Vertex Cover ↔ Clique:** S is an independent set of G ⇔ V \\ S is a vertex cover of G ⇔ S is a clique in the complement graph. So G has an independent set of size k ⇔ G has a vertex cover of size n - k, and these problems are interreducible in linear time.
- **3-SAT ≤<sub>p</sub> Independent Set:** for a formula with m clauses build a graph with one *triangle* per clause (a vertex for each literal of the clause) and an edge between every pair of vertices that carry complementary literals (x and ¬x in different clauses). The formula is satisfiable ⇔ the graph has an independent set of size m. (Choosing one literal per clause = a satisfying choice; the complementary-literal edges forbid choosing both x and ¬x.)
- **Hamiltonian Cycle ≤<sub>p</sub> TSP:** give every edge of G cost 1 and every non-edge cost 2 on the complete graph; G has a Hamiltonian cycle ⇔ the TSP tour of cost ≤ n exists.

### Coping with NP-hard problems

Exact exponential algorithms with pruning (backtracking, branch and bound, DP over subsets), approximation algorithms with guaranteed ratios (5.5), randomized algorithms, heuristics and local search (simulated annealing, genetic algorithms), solving special cases (planar, bounded treewidth), and fixed-parameter tractable algorithms.

::include cpp/u5-np-1.cpp

::include cpp/u5-np-1.out.txt

### A real reduction in code: 3-SAT ≤<sub>p</sub> Independent Set

The program builds the gadget graph described above for random 3-CNF formulas and checks, by brute force on both sides, that "formula satisfiable" and "graph has an independent set of size m" always give the same answer. The second part checks the identity independent set / vertex cover / clique-in-the-complement.

::include cpp/u5-np-2.cpp

::include cpp/u5-np-2.out.txt

## 5.5 Approximation algorithms

- For an NP-hard optimization problem, an **approximation algorithm** runs in polynomial time and returns a solution whose cost C is provably close to the optimum C*. The **approximation ratio** ρ(n) satisfies max(C/C*, C*/C) ≤ ρ(n) (so ρ ≥ 1 for both minimization and maximization). A *ρ-approximation* guarantees cost within a factor ρ.
- **PTAS** (polynomial-time approximation scheme): for every fixed ε > 0 a (1+ε)-approximation in time polynomial in n (may be exponential in 1/ε). **FPTAS:** the time is also polynomial in 1/ε (0/1 knapsack has one: scale and round the values, then run the DP).
- **Vertex cover, 2-approximation:** repeatedly pick an edge (u, v) whose endpoints are both uncovered, put *both* in the cover, and delete all edges touching them. The picked edges form a matching M; any cover must contain at least one endpoint of each matching edge, so OPT ≥ |M|, while the algorithm returns 2|M| ≤ 2·OPT. O(V + E).
- **Metric TSP, 2-approximation (MST-based):** with the triangle inequality: (1) compute an MST T; (2) take a preorder walk of T and shortcut repeated vertices. cost(T) ≤ OPT (delete one edge of the optimal tour to get a spanning tree); the full walk costs 2·cost(T); shortcutting does not increase the cost by the triangle inequality, so the tour ≤ 2·OPT. **Christofides** improves this to 1.5 (add a minimum matching on the odd-degree vertices, use an Euler tour). For *general* TSP no constant-factor approximation exists unless P = NP.
- **Set cover, greedy:** repeatedly pick the set covering the most still-uncovered elements: ratio H(d) ≤ ln n + 1, and this is essentially the best possible in polynomial time.
- **Other classics:** load balancing (list scheduling 2, LPT 4/3), bin packing (first-fit decreasing 11/9 OPT + 6/9), max-cut (random assignment gives 1/2 in expectation), 0/1 knapsack (FPTAS), k-center (greedy 2).

::include cpp/u5-approx-1.cpp

::include cpp/u5-approx-1.out.txt

::include cpp/u5-approx-2.cpp

::include cpp/u5-approx-2.out.txt

::include cpp/u5-approx-3.cpp

::include cpp/u5-approx-3.out.txt

## 5.6 Randomized algorithms

- A **randomized algorithm** makes random choices during execution, so its behaviour depends on the random bits as well as the input. Analysis is of the *expected* running time or the *error probability* over the algorithm's own coins, not over a distribution of inputs.
- **Las Vegas algorithms:** always give the correct answer; only the running time is random (randomized quick sort, randomized quickselect).
- **Monte Carlo algorithms:** fixed running time but the answer may be wrong with small probability; repeating k times (with independent coins) drives the error down exponentially (Miller-Rabin, Karger's min cut, Freivalds' matrix-product check). *One-sided error:* a "no" answer is always right (or the reverse).
- **Randomized quick sort analysis:** let z<sub>1</sub> < ... < z<sub>n</sub> be the sorted elements. z<sub>i</sub> and z<sub>j</sub> are compared only if one of them is the first pivot chosen among z<sub>i..j</sub>, which has probability 2/(j-i+1). By linearity of expectation E[comparisons] = Σ<sub>i<j</sub> 2/(j-i+1) ≤ 2n·H<sub>n</sub> = O(n log n), about 1.39·n·log₂ n.
- **Miller-Rabin primality test:** write n-1 = 2^s·d with d odd. For a random base a, n is declared "probably prime" if a^d ≡ 1 or a^(2^r·d) ≡ -1 (mod n) for some 0 ≤ r < s. A composite n passes for at most 1/4 of the bases, so k random bases give error ≤ 4^(-k). Time O(k·log³ n). (Fermat's test is fooled by Carmichael numbers such as 561; Miller-Rabin is not. The deterministic AKS test is in P but slower in practice.) Used to generate RSA primes.
- **Karger's min-cut:** repeat n-2 times: pick a random edge and *contract* it (merge its endpoints). The two super-vertices left define a cut. A specific minimum cut survives with probability ≥ 2/(n(n-1)), so n²/2·ln n repetitions find it with probability ≥ 1 - 1/n.
- **Freivalds' algorithm:** to check A·B = C in O(n²) instead of the O(n^2.8) needed to recompute: pick a random 0/1 vector x and test A(Bx) = Cx. If AB ≠ C the test fails to notice with probability ≤ 1/2; k rounds give error ≤ 2^(-k).
- **Other uses:** universal hashing, skip lists and treaps (expected O(log n) operations), random sampling and reservoir sampling, randomized rounding for approximation, load balancing, and randomized pivoting in median finding.

::include cpp/u5-rand-1.cpp

::include cpp/u5-rand-1.out.txt

> **Exam tip:** for NP-completeness answers always include the two parts (in NP, NP-hard by reduction) and name the problem you reduce *from*. For approximation answers state the ratio and prove it in two lines (lower bound on OPT, upper bound on the algorithm). For FFT, write the recurrence, the butterfly, and the five-step polynomial multiplication.
