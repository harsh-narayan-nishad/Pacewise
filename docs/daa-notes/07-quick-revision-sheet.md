# Quick Revision Sheet

| Algorithm / structure | Technique | Time | Space |
|---|---|---|---|
| Insertion sort | Incremental | n best, n² avg/worst | 1 |
| Shell sort | Gapped insertion | n² (Shell gaps), n^1.5 (Knuth) | 1 |
| Quick sort | D&C | n log n avg, n² worst | log n |
| Merge sort | D&C | n log n | n |
| Heap sort | Heap | n log n | 1 |
| Counting / radix / bucket | Non-comparison | n + k / d(n + k) / n avg | n + k |
| Quickselect / median of medians | D&C | n expected / n worst | 1 |
| Red-Black tree | Balanced BST | log n per operation | n |
| B-tree | Multiway tree | log n, log_t n disk reads | n |
| Binomial heap | Mergeable heap | insert, extract-min, union, decrease-key: log n | n |
| Fibonacci heap | Lazy mergeable heap | insert, union, decrease-key: 1 (amortized); extract-min: log n | n |
| Binary search | D&C | log n | 1 |
| Strassen | D&C | n^2.807 | n² |
| Convex hull: Graham / quickhull | Sort + stack / D&C | n log n / n log n avg, n² worst | n |
| Activity selection | Greedy | n log n | 1 |
| Fractional knapsack | Greedy | n log n | 1 |
| Prim / Kruskal | Greedy | E log V / E log E | V / E |
| Dijkstra | Greedy | (V + E) log V | V |
| Bellman-Ford | DP / relaxation | VE | V |
| Huffman | Greedy | n log n | n |
| 0/1 knapsack | DP | nW | nW (W with 1-D) |
| Floyd-Warshall / Warshall | DP | V³ | V² |
| LCS / edit distance | DP | mn | mn |
| Matrix-chain | DP | n³ | n² |
| Resource allocation | DP | nR² | nR |
| n-Queens, Hamiltonian cycle, colouring, sum of subsets | Backtracking | Exponential (n!, n!, n·m^n, 2^n) | n |
| TSP | B&B / Held-Karp | exponential / n²2^n | n·2^n |
| Horner / Karatsuba | Algebraic / D&C | n / n^1.585 | 1 / n |
| FFT | D&C | n log n | n |
| Naive / Rabin-Karp / KMP / automaton | String matching | (n-m+1)m / n + m exp. / n + m / n (+ m\|Σ\| preprocessing) | 1 / 1 / m / m\|Σ\| |
| Vertex cover, metric TSP | Approximation | Polynomial, ratio 2 | - |
| Miller-Rabin, Karger, Freivalds | Randomized (Monte Carlo) | k·log³ n / n² log n per success / n² per round | - |

## Master theorem in one line

T(n) = aT(n/b) + f(n): compare f(n) with n^(log_b a). Smaller → Θ(n^(log_b a)). Equal → Θ(n^(log_b a) log n). Larger (and regular) → Θ(f(n)).

## Which program for which practical?

| Practical | Section |
|---|---|
| Sorting programs and timing | 1.5 to 1.11 (`benchmark`, `shell_sort`, `quick_sort`, `merge_sort`, `heap_sort`, `linear_sorts`) |
| Selection in linear time | 1.12 (`select_algos`) |
| Red-Black tree, B-tree, binomial and Fibonacci heaps | 2.2 to 2.5 |
| Strassen, convex hull, binary search | 3.2 to 3.4 |
| Knapsack, activity selection, Huffman, MST, shortest paths | 3.6 to 3.11, 4.2 |
| Floyd-Warshall, LCS, matrix chain | 4.3, 4.5 |
| n-Queens, Hamiltonian cycle, graph colouring, sum of subsets, TSP | 4.7 to 4.12 |
| FFT, string matching | 5.2, 5.3 |
