# Unit III: Divide and Conquer, Greedy Methods

## 3.1 Divide and conquer

> **Divide and conquer (D&C):** (1) *divide* the problem into a smaller instances of the same problem, (2) *conquer* by solving them recursively (base case solved directly), (3) *combine* the answers. The running time satisfies T(n) = a·T(n/b) + D(n) + C(n), solved with the master theorem (see section 1.4).

- **Template:** `solve(P): if small(P) return direct(P); split P into P1..Pa; return combine(solve(P1), ..., solve(Pa))`.
- **Strengths:** clean recursive proofs, natural parallelism, good cache behaviour on small subproblems. **Weaknesses:** recursion overhead, and it is wasteful if subproblems *overlap* (then use dynamic programming, Unit IV).
- **Examples:** merge sort Θ(n log n), quick sort, binary search Θ(log n), Strassen Θ(n^2.81), Karatsuba Θ(n^1.585), closest pair of points Θ(n log n), FFT Θ(n log n), convex hull, maximum subarray, median of medians.

## 3.2 Searching and the maximum-subarray problem

- **Binary search:** sorted array; compare with the middle, discard half. T(n) = T(n/2) + 1 = Θ(log n). Works on any *monotone* predicate ("first index where f is true"); the same idea finds square roots, minimum feasible capacity, etc.
- **Related:** interpolation search (O(log log n) on uniform data, O(n) worst), exponential search (unbounded arrays), ternary search (unimodal functions).
- **Maximum subarray:** find the contiguous subarray with the largest sum. D&C: the best subarray lies in the left half, the right half, or crosses the middle. Each half returns four numbers (best, best prefix, best suffix, total) and the combine step is O(1) work per merge, so T(n) = 2T(n/2) + O(1) = Θ(n) with this formulation (the textbook crossing-sum version is Θ(n log n)). Kadane's DP algorithm also solves it in Θ(n).

::include cpp/u3-search-1.cpp

::include cpp/u3-search-1.out.txt

## 3.3 Matrix multiplication (Strassen)

- **Classical algorithm:** C[i][j] = Σ A[i][k]·B[k][j]: three nested loops, Θ(n³) multiplications. Splitting each n×n matrix into four n/2 × n/2 blocks and using the classical block formulas needs **8** half-size multiplications: T(n) = 8T(n/2) + Θ(n²) = Θ(n³), no gain.
- **Strassen (1969):** computes the product with only **7** half-size multiplications (plus 18 additions/subtractions of Θ(n²) cost): T(n) = 7T(n/2) + Θ(n²) = Θ(n^(log₂7)) = **Θ(n^2.807)**.
- The seven products (blocks A11..A22, B11..B22):
- **In practice:** n must be a power of two (pad with zeros); recursion overhead and extra memory mean Strassen only wins for large n, so implementations switch to the classical algorithm below a cutoff (typically 32 to 128). It is also slightly less numerically stable. Asymptotically faster algorithms exist (about n^2.37) but are not practical.

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

> **Convex hull** of a set of points: the smallest convex polygon containing all of them (picture a rubber band stretched around nails). Output: the hull vertices in order. Key primitive: the **cross product** sign of (b - a) × (c - a) tells whether a→b→c turns left (> 0), right (< 0) or is collinear (= 0).

| Algorithm | Idea | Time |
|---|---|---|
| Brute force | A pair (p, q) is a hull edge if all other points lie on one side | O(n³) |
| Jarvis march (gift wrapping) | From the leftmost point repeatedly pick the most counter-clockwise point | O(n·h), h = hull size |
| Graham scan / Andrew monotone chain | Sort the points, build lower and upper hulls with a stack, popping on right turns | O(n log n) |
| **Quickhull (divide and conquer)** | Line through the extreme points splits the set; the point farthest from the line is a hull vertex; points inside the triangle are discarded; recurse on the two outer parts (like quick sort) | O(n log n) average, O(n²) worst |
| Divide-and-conquer merge hull | Split by x, compute two hulls, merge them by finding the two common tangents | Θ(n log n) |
| Chan's algorithm | Combines grouping, Graham and Jarvis | O(n log h), output sensitive |

Lower bound: computing the hull needs Ω(n log n) in the comparison/algebraic model because sorting reduces to it (put points on a parabola y = x²: the hull order is the sorted order).

::include cpp/u3-hull-1.cpp

::include cpp/u3-hull-1.out.txt

## 3.5 Greedy method

> **Greedy algorithm:***right now*
>
> - **Greedy-choice property:** some optimal solution contains the greedy first choice.
> - **Optimal substructure:** after the greedy choice, the rest is an optimal solution of a smaller problem.

- **Proof technique, exchange argument:** take any optimal solution, show you can swap its first choice for the greedy one without making it worse. Or *greedy stays ahead* (compare partial solutions step by step).
- **General shape:** sort the candidates by a criterion (O(n log n)), then scan once, keeping a candidate if it stays feasible. Complexity is usually dominated by the sort or a priority queue.
- **Greedy can fail:** coin change with coins {1, 3, 4} for amount 6: greedy gives 4+1+1 (3 coins) but 3+3 (2 coins) is optimal; 0/1 knapsack (see below). For such problems use dynamic programming.

| Greedy vs | Dynamic programming | Divide and conquer |
|---|---|---|
| Subproblems | Makes one choice, solves *one* subproblem | Independent subproblems |
| Decisions | Never reconsidered | Explores all options, stores results of overlapping subproblems |
| Speed | Usually fastest | Polynomial, more memory |
| Correctness | Needs a proof for each problem | Always correct if the recurrence is right |

## 3.6 Activity selection

Given n activities with start and finish times, choose the maximum number of mutually compatible (non-overlapping) activities. **Greedy rule: always pick the compatible activity that finishes first.** Proof (exchange): in any optimal schedule replace the first activity by the one with the earliest finish time; it still leaves at least as much room, so the schedule stays valid and optimal. Time Θ(n log n) for sorting, Θ(n) for the scan. (Greedy by earliest start or shortest duration is *wrong*.)

::include cpp/u3-act-1.cpp

::include cpp/u3-act-1.out.txt

## 3.7 Knapsack: fractional (greedy) versus 0/1

- **Fractional knapsack:** items with value v<sub>i</sub> and weight w<sub>i</sub>, capacity W, items may be split. **Greedy rule: sort by value/weight ratio (descending) and take as much as possible of the best remaining item.** Optimal. Time Θ(n log n).
- **0/1 knapsack:** each item is taken whole or not at all. The same greedy is *not* optimal (example below); it needs dynamic programming (Unit IV) with Θ(nW) time. It is NP-hard in general (pseudo-polynomial DP).

::include cpp/u3-knap-1.cpp

::include cpp/u3-knap-1.out.txt

## 3.8 Optimal reliability allocation

**Problem.** A system has n stages connected in *series*; the system works only if every stage works. Stage i uses devices with reliability r<sub>i</sub> and cost c<sub>i</sub> each. Using m<sub>i</sub> copies of the device *in parallel* at stage i raises its reliability to Φ<sub>i</sub>(m<sub>i</sub>) = 1 - (1 - r<sub>i</sub>)^m<sub>i</sub>. Choose m<sub>1..n</sub> ≥ 1 to **maximize the system reliability ∏ Φ<sub>i</sub>(m<sub>i</sub>) subject to total cost Σ c<sub>i</sub>·m<sub>i</sub> ≤ C**.

- **Greedy (marginal gain) method:** start with one device per stage, then repeatedly add one more device to the stage whose reliability improvement per unit cost is largest, while the budget allows. Fast, O(n·extra devices), but it is only a *heuristic*: the budget is spent in lumps of size c<sub>i</sub>, so a locally best choice can use up money that a better combination needed. It is optimal on the sample below, but in a test of 1000 random 4-stage instances (section 4.4) it matched the exact answer in only about 82% of them, and the worst case reached 87% of the optimal reliability.
- **Exact method:** dynamic programming over the budget (section 4.4), which is guaranteed optimal. Also usable: branch and bound with dominance rules.
- Upper bound on copies at stage i: u<sub>i</sub> = ⌊(C + c<sub>i</sub> - Σ c<sub>j</sub>) / c<sub>i</sub>⌋ (you must keep one device in every other stage).

::include cpp/u3-rel-1.cpp

::include cpp/u3-rel-1.out.txt

## 3.9 Minimum spanning trees (Prim and Kruskal)

> **Spanning tree** of a connected undirected graph: a subgraph that is a tree (connected, acyclic) containing all V vertices, hence V-1 edges. **MST:** a spanning tree of minimum total edge weight. If all weights are distinct the MST is unique.

- **Cut property:** for any cut (S, V-S), the lightest edge crossing it belongs to some MST. **Cycle property:** the heaviest edge on any cycle is not needed. Both Prim and Kruskal are justified by the cut property (generic greedy MST algorithm: keep adding a "safe" edge).
- **Kruskal:** sort all edges by weight; scan them and add an edge if it joins two different components (checked with a **disjoint-set union** (union-find) structure). Time O(E log E) = O(E log V). Good for sparse graphs.
- **Prim:** grow a single tree from a start vertex; at each step add the cheapest edge leaving the tree (priority queue keyed by edge weight). Time O(V²) with an adjacency matrix and a simple array, O(E log V) with a binary heap, O(E + V log V) with a Fibonacci heap. Good for dense graphs.
- **Union-find:** with path compression and union by rank each operation is O(α(n)), practically constant (α is the inverse Ackermann function).

|  | Prim | Kruskal |
|---|---|---|
| Grows | One tree | A forest that merges |
| Key structure | Priority queue | Sorted edge list + DSU |
| Time | O(E log V) | O(E log E) |
| Best on | Dense graphs | Sparse graphs |
| Works on disconnected graph | No (only one component) | Yes (gives a minimum spanning forest) |

::include cpp/u3-mst-1.cpp

::include cpp/u3-mst-1.out.txt

## 3.10 Single-source shortest paths: Dijkstra and Bellman-Ford

- **Problem:** shortest path (minimum total weight) from a source s to every vertex of a weighted graph. **Relaxation:** if d[u] + w(u,v) < d[v] then set d[v] = d[u] + w(u,v). All algorithms below are repeated relaxation. **Optimal substructure:** a sub-path of a shortest path is itself a shortest path.
- **Dijkstra** (greedy): keep a set of finalized vertices; repeatedly take the non-finalized vertex u with the smallest tentative distance, finalize it and relax its outgoing edges. **Requires non-negative weights**: then no later path can improve a finalized vertex (proof by contradiction on the first vertex finalized with a wrong distance). Time O(V²) with an array, O((V + E) log V) with a binary heap, O(E + V log V) with a Fibonacci heap. Fails with negative edges (e.g. s→a = 2, s→b = 3, b→a = -2: finalizing a at distance 2 is wrong, the real distance is 1).
- **Bellman-Ford** (dynamic programming flavour): relax *all* edges V-1 times (a shortest path has at most V-1 edges). One more round that still relaxes something proves a **negative-weight cycle** reachable from s (distances are then undefined). Handles negative edges. Time O(V·E), space O(V). Can stop early if a full round changes nothing.
- **Shortest paths in a DAG:** relax edges in topological order: O(V + E), works with negative weights. For unweighted graphs BFS gives shortest paths in O(V + E).

|  | Dijkstra | Bellman-Ford |
|---|---|---|
| Negative edges | No | Yes |
| Detects negative cycle | No | Yes |
| Time | O((V+E) log V) | O(VE) |
| Strategy | Greedy | Repeated relaxation (DP) |

::include cpp/u3-sssp-1.cpp

::include cpp/u3-sssp-1.out.txt

## 3.11 Huffman coding (classic greedy)

Assign shorter binary codes to more frequent characters to compress data with an optimal *prefix code* (no code is a prefix of another, so decoding is unambiguous). **Greedy rule: repeatedly merge the two least frequent nodes into a new node whose frequency is their sum** (min-heap). Time O(n log n). The final tree gives each character its code: left edge 0, right edge 1.

::include cpp/u3-huff-1.cpp

::include cpp/u3-huff-1.out.txt

> **Exam tip:** for Prim/Kruskal/Dijkstra questions, show a table that lists the chosen edge or vertex at every step. For Bellman-Ford show the distance array after each of the V-1 rounds. State the complexity with the data structure you assumed.
