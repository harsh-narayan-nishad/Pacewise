# Unit I: Introduction and Sorting

## 1.1 What is an algorithm

> **Algorithm:** a finite sequence of well-defined, unambiguous steps that transforms a given input into the required output. Every algorithm must have: **input** (zero or more), **output** (at least one), **definiteness** (each step is clear), **finiteness** (it terminates), and **effectiveness** (each step is basic enough to be carried out).

- **Algorithm vs program:** an algorithm is an abstract procedure; a program is its implementation in a language. An algorithm need not be written in code (pseudo-code, flow chart and plain English are all fine).
- **Design vs analysis:** *design* means finding a method (a design paradigm: brute force, divide and conquer, greedy, dynamic programming, backtracking, branch and bound, randomization). *Analysis* means predicting resources used (time, memory) and proving correctness.
- **Steps to solve a problem:** understand the problem, choose a model, pick a design technique, write the algorithm, prove correctness, analyze complexity, implement and test.
- **Correctness:** proved with loop invariants (true before the loop, preserved by each iteration, gives the answer at exit) or induction (for recursion).

| Paradigm | Idea | Typical examples |
|---|---|---|
| Brute force | Try everything | Linear search, naive string match |
| Divide and conquer | Split, solve parts recursively, combine | Merge sort, quick sort, Strassen, binary search |
| Greedy | Take the locally best choice, never reconsider | Prim, Kruskal, Dijkstra, Huffman |
| Dynamic programming | Store answers of overlapping subproblems | Knapsack, Floyd-Warshall, LCS |
| Backtracking / Branch and bound | Systematic search of the state space with pruning | n-Queens, TSP, graph colouring |
| Randomized | Use random choices for speed or simplicity | Randomized quick sort, Miller-Rabin |
| Approximation | Near-optimal answer in polynomial time | Vertex cover 2-approximation |

## 1.2 Analyzing algorithms

- **Model of computation (RAM model):** one processor, instructions run one after another, each basic operation (arithmetic, comparison, assignment, array access) takes constant time, memory is unlimited and random access.
- **Input size n:** number of elements, bits, vertices and edges, etc. Complexity is a function of n.
- **Cases:** *best* (fastest possible input), *worst* (slowest input, gives a guarantee, used most often), *average* (expected over a distribution of inputs; needs assumptions).
- **How to count:** a single statement = 1 unit; a loop = (iterations) x (cost of body); nested loops multiply; sequential blocks add; take the dominant term; a recursive algorithm gives a recurrence.

### Loop analysis patterns

| Code pattern | Cost |
|---|---|
| `for (i=1;i<=n;i++)` | Θ(n) |
| `for (i=1;i<=n;i*=2)` (or `i/=2`) | Θ(log n) |
| Two nested loops to n | Θ(n²) |
| `for(i..n) for(j=1;j<=i;j++)` | 1+2+...+n = n(n+1)/2 = Θ(n²) |
| `for(i..n) for(j=1;j<=n;j*=2)` | Θ(n log n) |
| `for(i=1;i*i<=n;i++)` | Θ(√n) |
| `for(i=1;i<=n;i*=2) for(j=1;j<=i;j++)` | 1+2+4+...+n = 2n-1 = Θ(n) |

### Example: insertion sort, three cases

Insertion sort compares each new key with the sorted prefix. On sorted input it does n-1 comparisons (best, Θ(n)); on reverse sorted input it does 1+2+...+(n-1) = n(n-1)/2 (worst, Θ(n²)); on random input about n²/4 (average, Θ(n²)).

::include cpp/u1-analysis-1.cpp

::include cpp/u1-analysis-1.out.txt

### Example: linear search versus binary search

::include cpp/u1-analysis-2.cpp

::include cpp/u1-analysis-2.out.txt

### Amortized analysis

Worst-case cost of one operation can be misleading when expensive operations are rare. **Amortized analysis** gives the average cost per operation over a worst-case *sequence* (no probability involved). Three methods:

- **Aggregate:** total cost of n operations divided by n.
- **Accounting (banker's):** charge each operation a fixed amortized price; the unused credit pays for later expensive operations.
- **Potential:** define a potential Φ(state) ≥ 0, Φ(initial) = 0; amortized cost = actual cost + ΔΦ.

**Dynamic array doubling:** a push costs 1 normally, but when the array is full it copies all elements to an array twice as large. Over n pushes the copies total 1+2+4+...+n/2 < n, so the total cost is under 3n and each push is O(1) amortized, although a single push can cost Θ(n). Fibonacci heaps (Unit II) are analyzed with the potential method.

::include cpp/u1-analysis-3.cpp

::include cpp/u1-analysis-3.out.txt

## 1.3 Complexity and asymptotic notation

- **Time complexity:** number of basic steps as a function of input size. **Space complexity:** extra memory used (input usually not counted, "auxiliary space"; recursion stack counts).
- Notation describes the *rate of growth* and ignores constants and lower-order terms because they do not matter for large n.

| Notation | Meaning | Formal definition | Reads as |
|---|---|---|---|
| O(g(n)) | Upper bound | f(n) ≤ c·g(n) for all n ≥ n₀ (some c > 0) | "f grows no faster than g" |
| Ω(g(n)) | Lower bound | f(n) ≥ c·g(n) for all n ≥ n₀ | "f grows at least as fast as g" |
| Θ(g(n)) | Tight bound | c₁·g(n) ≤ f(n) ≤ c₂·g(n) for all n ≥ n₀ | "f grows exactly like g" |
| o(g(n)) | Strict upper bound | f(n) < c·g(n) for *every* c > 0 (large n) | f/g → 0 |
| ω(g(n)) | Strict lower bound | f(n) > c·g(n) for every c > 0 | f/g → ∞ |

- **Θ = O and Ω together.** The best, average and worst cases can each have their own notation; saying "insertion sort is O(n²)" is true but weaker than "worst case Θ(n²)".
- **Limit test:** compute L = lim f(n)/g(n). L = 0 → f = o(g); 0 < L < ∞ → f = Θ(g); L = ∞ → f = ω(g).
- **Properties:** reflexive (f = Θ(f)), transitive, symmetric for Θ (f = Θ(g) ⇔ g = Θ(f)), transpose symmetry (f = O(g) ⇔ g = Ω(f)), sum rule O(f)+O(g) = O(max(f,g)), product rule O(f)·O(g) = O(f·g).
- **Examples:** 3n²+5n+7 = Θ(n²); n log n = O(n²) but not Θ(n²); 2^(n+1) = Θ(2^n) but 2^(2n) ≠ O(2^n); log(n!) = Θ(n log n); log_a n = Θ(log_b n) (base does not matter).
- **Common mistakes:** thinking O means "worst case" (O is a bound on a function, not a case); dropping a non-constant factor like 2^(2n) vs 2^n; saying "Ω is best case".

## 1.4 Growth of functions and recurrences

### Order of growth (slowest to fastest)

```text
1 < log log n < log n < (log n)^2 < √n < n < n log n < n^2 < n^3 < 2^n < n! < n^n
```

- Any polynomial beats any polylogarithm: n^ε grows faster than (log n)^k for every ε > 0, k.
- Any exponential beats any polynomial: c^n (c > 1) grows faster than n^k.
- **Stirling:** n! ≈ √(2πn)(n/e)^n, so log(n!) = Θ(n log n).
- **Useful sums:** 1+2+...+n = n(n+1)/2; 1+2+4+...+2^k = 2^(k+1)-1; Σ 1/i = Θ(log n) (harmonic); Σ r^i for r<1 = O(1).
- **Logs:** log_b(xy) = log_b x + log_b y; a^(log_b c) = c^(log_b a); changing base only changes a constant.

::include cpp/u1-growth-1.cpp

::include cpp/u1-growth-1.out.txt

### Solving recurrences

Divide and conquer algorithms give recurrences such as T(n) = 2T(n/2) + n. Three methods:

1. **Substitution:** guess the solution, prove it by induction. Example: guess T(n) ≤ c·n log n for T(n) = 2T(n/2)+n; then T(n) ≤ 2c(n/2)log(n/2)+n = c n log n - c n + n ≤ c n log n for c ≥ 1.
2. **Recursion tree:** draw the tree, sum the cost per level, sum over levels. For 2T(n/2)+n: each of the log n levels costs n, total n log n.
3. **Master theorem:** for T(n) = a·T(n/b) + f(n) with a ≥ 1, b > 1, let p = log_b a (compare f(n) with n^p):

| Case | Condition | Result |
|---|---|---|
| 1 | f(n) = O(n^(p-ε)) for some ε > 0 (f smaller) | T(n) = Θ(n^p) |
| 2 | f(n) = Θ(n^p · log^k n), k ≥ 0 (f equal) | T(n) = Θ(n^p · log^(k+1) n) |
| 3 | f(n) = Ω(n^(p+ε)) and a·f(n/b) ≤ c·f(n) for some c < 1 (f bigger, regularity) | T(n) = Θ(f(n)) |

| Recurrence | Algorithm | p = log_b a | Case | Solution |
|---|---|---|---|---|
| T(n) = T(n/2) + 1 | Binary search | 0 | 2 | Θ(log n) |
| T(n) = 2T(n/2) + n | Merge sort | 1 | 2 | Θ(n log n) |
| T(n) = 2T(n/2) + 1 | Tree traversal | 1 | 1 | Θ(n) |
| T(n) = 7T(n/2) + n² | Strassen | 2.807 | 1 | Θ(n^2.807) |
| T(n) = 8T(n/2) + n² | Plain block matrix multiply | 3 | 1 | Θ(n³) |
| T(n) = 3T(n/2) + n | Karatsuba | 1.585 | 1 | Θ(n^1.585) |
| T(n) = T(n/2) + n | Quickselect (good pivots) | 0 | 3 | Θ(n) |
| T(n) = 2T(n/2) + n log n | - | 1 | 2 (k=1) | Θ(n log² n) |
| T(n) = 4T(n/2) + n² | - | 2 | 2 | Θ(n² log n) |
| T(n) = 2T(n/2) + n/log n | - | 1 | none (gap) | Θ(n log log n) by recursion tree |
| T(n) = T(n-1) + n | Insertion sort (recursive) | Not of the form a·T(n/b): expand, = n(n+1)/2 = Θ(n²) |  |  |
| T(n) = 2T(n-1) + 1 | Towers of Hanoi | Expand: T(n) = 2^n - 1 = Θ(2^n) |  |  |

> **Exam tip:** always write a, b, f(n), p = log_b a, then name the case and quote the result. Check the regularity condition for case 3. If the recurrence is T(n-1)-style, use expansion (iteration) or a recursion tree, not the master theorem.

## 1.5 Performance measurement

- **A priori analysis** (theoretical): count operations as a function of n; machine independent; gives growth rate.
- **A posteriori testing** (empirical): implement, run on real data, measure time and memory; machine and compiler dependent; shows constant factors and cache effects.
- **Good practice:** compile with optimization (`-O2`), use `std::chrono::steady_clock`, run each test several times and take the median or minimum, give every algorithm the *same* input, test best, average and worst case inputs, grow n geometrically.
- **Doubling test:** if time(2n)/time(n) ≈ 2 the algorithm is about linear; ≈ 4 quadratic; ≈ 8 cubic; slightly above 2 suggests n log n.

::include cpp/u1-perf-1.cpp

Timings depend on your machine, so no output is pasted above. When you run it you should see every column roughly double (a little more) each time n doubles, with shell sort growing fastest.

## 1.6 Shell sort

- **Idea:** generalization of insertion sort that first compares elements *far apart* (gap h), then reduces the gap until it is 1. An array that is h-sorted for a large h and then (h/2)-sorted stays h-sorted, so the final gap-1 pass (plain insertion sort) finds the data nearly sorted and runs close to linear.
- **Properties:** in place, not stable, adaptive, no extra memory.
- **Complexity depends on the gap sequence:**

| Gap sequence | Worst-case time |
|---|---|
| Shell's original: n/2, n/4, ..., 1 | Θ(n²) |
| Hibbard: 2^k - 1 (1, 3, 7, 15, ...) | Θ(n^1.5) |
| Knuth: (3^k - 1)/2 (1, 4, 13, 40, ...) | O(n^1.5) |
| Sedgewick, Pratt (3-smooth numbers) | O(n^(4/3)) and O(n log² n) |

::include cpp/u1-shell-1.cpp

::include cpp/u1-shell-1.out.txt

## 1.7 Quick sort

- **Divide and conquer:** *partition* the array around a pivot so that everything left of the pivot is ≤ pivot and everything right is ≥ pivot; then sort the two sides recursively. No combine step.
- **Recurrence:** T(n) = T(k) + T(n-k-1) + Θ(n), where k is the size of the left part.
- **Best case:** pivot always the median: T(n) = 2T(n/2) + n = Θ(n log n).
- **Worst case:** pivot always the smallest or largest (sorted input with a first/last pivot): T(n) = T(n-1) + n = Θ(n²).
- **Average case:** Θ(n log n). Even a 9:1 split every time gives T(n) = T(9n/10)+T(n/10)+n = O(n log n). Expected comparisons for a random pivot ≈ 1.39 n log₂ n.
- **Randomized quick sort:** choose the pivot uniformly at random. Then no particular input is bad; the expected time is Θ(n log n) for *every* input.
- **Space:** in place, but recursion stack is O(log n) on average and O(n) worst case. Recursing on the smaller side first and looping on the larger side guarantees O(log n) stack.
- **Not stable.** Many equal keys make Lomuto partitioning quadratic; use 3-way partitioning (Dutch national flag) for heavy duplicates.
- **Partition schemes:** *Lomuto* (one scan, pivot at the end, simpler) and *Hoare* (two scans from both ends, about 3 times fewer swaps, handles duplicates better).

::include cpp/u1-quick-1.cpp

::include cpp/u1-quick-1.out.txt

## 1.8 Merge sort

- **Divide** the array into two halves, **conquer** by sorting each recursively, **combine** by merging two sorted halves in linear time.
- **Recurrence:** T(n) = 2T(n/2) + Θ(n) ⇒ Θ(n log n) in best, average and worst case (master theorem case 2).
- **Space:** Θ(n) auxiliary for arrays (O(1) extra for linked lists). **Stable** if the merge takes from the left half on ties. Not in place for arrays.
- Merge needs at most n-1 comparisons; total comparisons ≈ n log₂ n - n + 1. It also counts *inversions* in O(n log n) (add the number of left elements remaining each time a right element is taken). Excellent for external sorting (data on disk) and for sorting linked lists.

::include cpp/u1-merge-1.cpp

::include cpp/u1-merge-1.out.txt

## 1.9 Heap sort

- A **(max-)heap** is a complete binary tree stored in an array where every parent ≥ its children. For 0-based index i: parent (i-1)/2, children 2i+1 and 2i+2. Height = ⌊log₂ n⌋.
- **Heapify (sift-down):** fix one violated node by swapping it with the larger child repeatedly: O(log n).
- **Build-heap:** heapify nodes n/2-1 down to 0. Cost = Σ (n/2^(h+1))·O(h) = O(n), *not* O(n log n), because most nodes are near the leaves.
- **Heap sort:** build a max-heap, then repeatedly swap the root (maximum) with the last element, shrink the heap and heapify: total O(n) + n·O(log n) = Θ(n log n) in all cases.
- **Properties:** in place (O(1) extra), not stable, poor cache behaviour, usually slower than quick sort in practice but has a worst-case guarantee.
- The same heap gives a **priority queue**: insert O(log n), extract-max O(log n), peek O(1).

::include cpp/u1-heap-1.cpp

::include cpp/u1-heap-1.out.txt

## 1.10 Comparison of sorting algorithms

| Algorithm | Best | Average | Worst | Extra space | Stable | In place |
|---|---|---|---|---|---|---|
| Insertion | n | n² | n² | 1 | Yes | Yes |
| Selection | n² | n² | n² | 1 | No | Yes |
| Bubble (with flag) | n | n² | n² | 1 | Yes | Yes |
| Shell | n log n | depends on gaps | n² / n^1.5 / n log² n | 1 | No | Yes |
| Quick | n log n | n log n | n² | log n (stack) | No | Yes |
| Merge | n log n | n log n | n log n | n | Yes | No |
| Heap | n log n | n log n | n log n | 1 | No | Yes |
| Counting | n + k | n + k | n + k | n + k | Yes | No |
| Radix (d digits) | d(n + k) | d(n + k) | d(n + k) | n + k | Yes | No |
| Bucket | n + k | n + k | n² | n + k | Yes | No |

- **When to use what:** small or nearly sorted data → insertion sort; general purpose, fast in practice → quick sort (introsort in C++ `std::sort`: quick sort that switches to heap sort when recursion gets too deep, plus insertion sort for tiny ranges); guaranteed O(n log n) or stability needed → merge sort (`std::stable_sort`); memory tight with worst-case guarantee → heap sort; small integer keys → counting/radix sort; uniformly distributed reals → bucket sort; data on disk → external merge sort.
- **Stability** means equal keys keep their original relative order; it matters when sorting by several keys in turn (and is what makes radix sort work).

### Lower bound for comparison sorting

Any algorithm that sorts only by comparing elements can be drawn as a binary *decision tree*: each internal node is a comparison, each leaf is one output permutation. There are n! permutations, so the tree has at least n! leaves and height h with 2^h ≥ n!. Hence h ≥ log₂(n!) = Θ(n log n) (Stirling). Therefore **every comparison sort needs Ω(n log n) comparisons in the worst case**, which makes merge sort and heap sort asymptotically optimal. To beat it you must not rely on comparisons only (next section).

## 1.11 Sorting in linear time

- **Counting sort:** keys are integers in 0..k. Count occurrences, take prefix sums (they give each key's starting position), place elements, scanning from the left (or right with the matching prefix definition) to stay *stable*. Θ(n + k). Good when k = O(n).
- **Radix sort:** sort by the least significant digit first, then the next, ... using a *stable* sort for each digit (usually counting sort). For n numbers of d digits in base b: Θ(d(n + b)). For 32-bit integers with base 256, d = 4 passes.
- **Bucket sort:** keys uniform in [0,1). Put each key in bucket ⌊n·x⌋, sort each bucket (insertion sort), concatenate. Expected Θ(n) for uniform data; worst case Θ(n²) if everything lands in one bucket.

::include cpp/u1-linear-1.cpp

::include cpp/u1-linear-1.out.txt

## 1.12 Order statistics

> The **i-th order statistic** of a set of n elements is its i-th smallest element. Minimum = 1st, maximum = n-th, median = ⌈n/2⌉-th.

- **Minimum or maximum:** n-1 comparisons (optimal). **Both together:** compare elements in pairs first (⌊n/2⌋ comparisons), then the larger of each pair against the max and the smaller against the min: about 3n/2 comparisons instead of 2n.
- **Naive selection:** sort and index: Θ(n log n).
- **Randomized select (quickselect):** partition like quick sort, but recurse into *one* side only. Expected T(n) = T(n/2) + n = Θ(n); worst case Θ(n²).
- **Median of medians (worst-case linear time, BFPRT):** split into groups of 5, take each group's median, recursively find the median of those medians and use it as the pivot. The pivot has at least 3n/10 elements on each side, so the recurrence is T(n) = T(n/5) + T(7n/10) + Θ(n) = Θ(n), because 1/5 + 7/10 = 9/10 < 1. (Groups of 3 would give 1/3 + 2/3 = 1 and fail to be linear.) The constant factor is large, so quickselect is used in practice.

::include cpp/u1-order-1.cpp

::include cpp/u1-order-1.out.txt

> **Exam tip:** expect "Compare quick sort and merge sort", "Explain heap sort with an example and derive its complexity", "Why is build-heap O(n)?", "Prove the Ω(n log n) lower bound", and "Explain median of medians and solve its recurrence". Draw a small array trace for each sort.
