# Unit IV: Dynamic Programming, Backtracking, Branch and Bound

## 4.1 Dynamic programming

> **Dynamic programming (DP):** solve a problem by combining solutions of *overlapping* subproblems, solving each subproblem only once and storing its answer in a table. Applicable when the problem has (1) **optimal substructure** (an optimal solution contains optimal solutions of its subproblems) and (2) **overlapping subproblems** (the same subproblem is needed again and again).

- **Four steps:** (1) characterize the structure of an optimal solution, (2) define the value recursively (the recurrence and its base cases), (3) compute values bottom-up (or top-down with memoization), (4) reconstruct the actual solution from the table (store the choices or walk back).
- **Top-down (memoization):** write the recursion, cache results; computes only needed subproblems; recursion overhead. **Bottom-up (tabulation):** fill the table in dependency order; no recursion; allows space optimization (keep only the last row).
- **Complexity** = (number of subproblems) × (work per subproblem).
- **DP vs greedy vs D&C:** D&C subproblems are independent, DP subproblems overlap, greedy commits to one choice without looking at the others.
- The word "programming" means "planning with a table", not computer programming.

::include cpp/u4-dp-1.cpp

::include cpp/u4-dp-1.out.txt

## 4.2 0/1 knapsack

n items with weights w<sub>i</sub> and values v<sub>i</sub>, capacity W; each item is taken or left (0/1). Maximize the total value.

```text
Let K[i][c] = best value using only the first i items with capacity c.
K[0][c] = 0,  K[i][0] = 0
K[i][c] = K[i-1][c]                                   if w[i] > c           (item i does not fit)
K[i][c] = max( K[i-1][c],  K[i-1][c - w[i]] + v[i] )  otherwise              (skip it, or take it)
```

- **Time Θ(nW), space Θ(nW)** (Θ(W) if only the value is needed: loop capacity downward over a 1-D array). The size of the input is n and log W, so this is *pseudo-polynomial*; the problem is NP-hard.
- **Reconstruction:** start at K[n][W]; if K[i][c] ≠ K[i-1][c], item i was taken, so subtract its weight and move up; else just move up.

::include cpp/u4-knap-1.cpp

::include cpp/u4-knap-1.out.txt

## 4.3 All-pairs shortest paths: Floyd-Warshall and Warshall

- **Floyd-Warshall:** shortest distance between *every* pair of vertices. Let d<sup>(k)</sup>[i][j] be the shortest i→j path using only vertices {1..k} as intermediates:  Three nested loops (k outermost!): **Θ(V³) time**, Θ(V²) space (the layers can be overwritten in place). Handles negative edges; a negative cycle exists iff some d[i][i] < 0. A `next` matrix recovers the paths.
- **Warshall's algorithm:** the boolean version, computing the **transitive closure** (is there a path from i to j?): `reach[i][j] = reach[i][j] OR (reach[i][k] AND reach[k][j])`, Θ(V³) (or Θ(V³/64) with bitsets).
- **Alternatives:** run Dijkstra from every vertex (O(V·E log V), good for sparse graphs with non-negative weights); **Johnson's algorithm** reweights edges with Bellman-Ford so that Dijkstra works with negative edges: O(V² log V + VE).

```text
d(k)[i][j] = min( d(k-1)[i][j],  d(k-1)[i][k] + d(k-1)[k][j] )     (path avoiding k, or passing through k)
```

::include cpp/u4-apsp-1.cpp

::include cpp/u4-apsp-1.out.txt

## 4.4 Resource allocation and reliability design (DP)

- **Resource allocation problem:** R identical units of a resource (money, machines, hours) are to be distributed among n activities; activity i yields profit P<sub>i</sub>(x) when given x units. Maximize total profit with Σ x<sub>i</sub> ≤ R. Let F[i][r] = best profit from the first i activities with r units:  Time Θ(n·R²), space Θ(n·R) (the argmax x is stored to rebuild the allocation). Greedy fails here unless the profit functions are concave.
- **Reliability design (exact solution of the section 3.8 problem):** let F[i][b] = maximum reliability of stages 1..i with total cost at most b:  Time Θ(n·C·(C/c<sub>min</sub>)), pseudo-polynomial. The marginal-gain greedy of section 3.8 is only a heuristic: the program below compares it with this exact DP on 1000 random instances and finds it optimal in most but not all of them (see the output); the DP is always optimal.

```text
F[0][r] = 0
F[i][r] = max over x = 0..r of ( P_i(x) + F[i-1][r - x] )          answer F[n][R]
```

```text
F[0][b] = 1
F[i][b] = max over m = 1 .. floor(b / c_i) of ( (1 - (1 - r_i)^m) * F[i-1][b - m*c_i] )        answer F[n][C]
```

::include cpp/u4-resource-1.cpp

::include cpp/u4-resource-1.out.txt

## 4.5 More DP classics

| Problem | State and recurrence | Time |
|---|---|---|
| Longest common subsequence | L[i][j] = L[i-1][j-1] + 1 if a[i] = b[j], else max(L[i-1][j], L[i][j-1]) | Θ(mn) |
| Matrix-chain multiplication | M[i][j] = min over k of ( M[i][k] + M[k+1][j] + p[i-1]·p[k]·p[j] ) | Θ(n³) |
| Edit distance | D[i][j] = D[i-1][j-1] if equal, else 1 + min(D[i-1][j], D[i][j-1], D[i-1][j-1]) | Θ(mn) |
| Coin change (min coins) | dp[a] = 1 + min over coins c ≤ a of dp[a - c] | Θ(amount × coins) |
| Longest increasing subsequence | dp[i] = 1 + max dp[j] (j < i, a[j] < a[i]); O(n log n) with binary search | Θ(n²) |
| Optimal binary search tree | e[i][j] = min over r of ( e[i][r-1] + e[r+1][j] + w(i,j) ) | Θ(n³) |

::include cpp/u4-more-1.cpp

::include cpp/u4-more-1.out.txt

## 4.6 Backtracking

> **Backtracking:** build a solution one component at a time (a depth-first search of the *state-space tree*); as soon as a partial solution cannot be extended to a valid complete one (it is not *promising*), abandon it and **backtrack** to the previous choice. It is brute force with pruning.

- **Terminology:** *explicit constraints* define the possible values of each component (e.g. x<sub>i</sub> ∈ {0,1}); *implicit constraints* say how the components must relate (e.g. no two queens attack); the *solution space* is all tuples satisfying the explicit constraints; the *bounding function* kills a node whose subtree cannot contain a solution.
- **Template:**
- **Complexity:** exponential in the worst case (O(n!) for permutations, O(2^n) for subsets, O(m^n) for colourings) but usually far smaller thanks to pruning. Good pruning order and checks matter more than anything.
- Used for puzzles, constraint satisfaction, combinatorial enumeration. It finds *feasible* or *all* solutions; for optimization it is improved into branch and bound (section 4.11).

```text
backtrack(partial):
    if partial is a complete solution: record it (and stop, or continue for all solutions)
    for each candidate c for the next component:
        if c is consistent with partial:       // the pruning test
            add c to partial
            backtrack(partial)
            remove c from partial              // undo = "backtrack"
```

## 4.7 n-Queens problem

Place n queens on an n×n board so that no two attack each other (no two in the same row, column or diagonal). Place one queen per row, trying each column and pruning with three boolean arrays: used columns, used "/" diagonals (row + col) and used "\\" diagonals (row - col). Solution counts: n = 4 → 2, n = 6 → 4, n = 8 → 92. The state-space tree has n^n leaves without pruning; backtracking visits a tiny fraction. (Solutions exist for every n ≥ 4, and n = 1.)

::include cpp/u4-nq-1.cpp

::include cpp/u4-nq-1.out.txt

## 4.8 Hamiltonian cycles

A **Hamiltonian cycle** visits every vertex exactly once and returns to the start (finding one is NP-complete; Euler cycles, which use every *edge* once, are easy). Backtracking: fix vertex 0 as the start (a cycle can be rotated), extend the path one vertex at a time, accept a vertex only if it is adjacent to the previous one and not yet used, and at the end check the edge back to the start. Worst case O(n!), typically much less.

::include cpp/u4-ham-1.cpp

::include cpp/u4-ham-1.out.txt

## 4.9 Graph colouring

**m-colouring decision problem:** can the vertices of a graph be coloured with at most m colours so that adjacent vertices differ? The smallest such m is the **chromatic number** χ(G) (NP-hard to compute; deciding m = 2 is easy via BFS, i.e. bipartiteness, but m ≥ 3 is NP-complete). Backtracking assigns colours vertex by vertex and tries each colour from 1..m that no neighbour already uses; state-space tree has m^n leaves, so O(n·m^n) in the worst case. The **four colour theorem**: every planar graph is 4-colourable. Applications: timetable and register allocation, map colouring, frequency assignment.

::include cpp/u4-color-1.cpp

::include cpp/u4-color-1.out.txt

## 4.10 Sum of subsets

Given n positive weights w<sub>1..n</sub> and a target M, find all subsets whose weights sum to exactly M. Sort the weights in increasing order and build a binary state-space tree (include or exclude each weight). Prune a node when: **(a)** the sum so far plus the next weight exceeds M (all later weights are at least as large), or **(b)** the sum so far plus *all* remaining weights is still less than M. Worst case O(2^n), but pruning removes most of the tree.

::include cpp/u4-sos-1.cpp

::include cpp/u4-sos-1.out.txt

## 4.11 Branch and bound

> **Branch and bound (B&B):** a search for the optimum of a *minimization* (or maximization) problem. *Branch*: split a node (partial solution) into children. *Bound*: compute for each node a **lower bound** on the cost of any complete solution below it (upper bound for maximization). If the bound is not better than the best complete solution found so far (the *incumbent*), the whole subtree is pruned.

- **Node selection strategies:** *FIFO* (queue, breadth-first), *LIFO* (stack, depth-first), and **least-cost (LC) search / best-first** (priority queue ordered by the bound; usually expands the fewest nodes, but needs more memory).
- **Good bounds are the heart of B&B:** tight but cheap to compute. A first solution found early (greedy or depth-first dive) gives a good initial incumbent.
- **Backtracking vs branch and bound:**

|  | Backtracking | Branch and bound |
|---|---|---|
| Goal | Find feasible / all solutions | Find an optimal solution |
| Traversal | Depth-first only | BFS, DFS or best-first (any) |
| Pruning by | Constraint violation (not promising) | Bound compared with the best solution so far |
| Typical problems | n-Queens, Sudoku, graph colouring, Hamiltonian cycle, sum of subsets | TSP, 0/1 knapsack, job assignment |

## 4.12 Travelling salesman problem (TSP)

**Problem:** given n cities and the cost c[i][j] of travelling from i to j, find the cheapest tour that visits each city exactly once and returns to the start. There are (n-1)! tours; TSP is NP-hard.

### Methods

- **Brute force:** try all (n-1)! tours.
- **Held-Karp dynamic programming:** dp[S][j] = cheapest path that starts at city 0, visits exactly the set S of cities and ends at j: dp[S][j] = min over i in S\\{j} of dp[S\\{j}][i] + c[i][j]. Time O(n²·2^n), space O(n·2^n); practical up to about n = 20.
- **Branch and bound with the reduced cost matrix (classic textbook method):**
    1. *Reduce* the cost matrix: subtract the row minimum from every row, then the column minimum from every column that has no zero. The sum of all subtracted amounts is a lower bound on any tour: this is the bound of the root.
    2. For a child that takes edge (i, j): set row i and column j to ∞ and also c[j][start] (or c[j][i]) to ∞ so that no premature cycle forms; reduce again. **bound(child) = bound(parent) + reduction cost + (reduced) c[i][j].**
    3. Always expand the live node with the smallest bound (LC search); prune a node whose bound ≥ the best tour found.
- The program below uses a simpler but also valid lower bound: cost so far + for each city that still has to be left (the current city and all unvisited ones) the cheapest edge it could use next. It runs best-first with a priority queue, and the result is checked against Held-Karp.

::include cpp/u4-tsp-1.cpp

::include cpp/u4-tsp-1.out.txt

### Other branch-and-bound examples

- **0/1 knapsack:** order items by value/weight; the bound of a node is the fractional-knapsack value of the remaining items (an upper bound because splitting is allowed); prune when bound ≤ best. LC search by the largest bound.
- **Job assignment:** assign n jobs to n workers with a cost matrix; bound = cost so far + the cheapest unused entry in each remaining row.
- **15-puzzle:** bound = moves so far + sum of Manhattan distances of the tiles (an admissible heuristic; this is A* search).

| Problem | Technique | Time |
|---|---|---|
| 0/1 knapsack | DP | Θ(nW) pseudo-polynomial |
| All-pairs shortest paths | Floyd-Warshall (DP) | Θ(V³) |
| TSP | Held-Karp (DP) / branch and bound | O(n²2^n) / exponential worst case |
| n-Queens, Hamiltonian cycle, colouring, sum of subsets | Backtracking | Exponential worst case |

> **Exam tip:** draw the state-space tree for 4-Queens, 3-colouring of a small graph and sum of subsets (with the bounding conditions written beside each pruned node), and show the reduced cost matrices for a 4 or 5-city TSP. For DP questions always show the table, the recurrence, and how the answer is traced back.
