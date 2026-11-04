# Design and Analysis of Algorithms (NCS-501): Complete Notes with C++

Full notes for all five units of the syllabus: theory, proofs in short form, comparison tables, exam tips, and working C++17 code for every algorithm. Each program is complete (copy, compile with `g++ -std=c++17 file.cpp`, run) and the output printed under it is the real output from a test run.

## Syllabus covered (L-T-P: 3-1-0, 8 lectures per unit)

| Unit | Topics in the syllabus | Where in these notes |
|---|---|---|
| I | Introduction: algorithms, analyzing algorithms, complexity, growth of functions, performance measurement, sorting and order statistics (Shell, Quick, Merge, Heap), comparison of sorting algorithms, sorting in linear time | [Unit I](02-unit-1-introduction-and-sorting.md) |
| II | Advanced data structures: Red-Black trees, B-trees, Binomial heaps, Fibonacci heaps | [Unit II](03-unit-2-advanced-data-structures.md) |
| III | Divide and conquer (sorting, matrix multiplication, convex hull, searching); Greedy methods (optimal reliability allocation, knapsack, MST: Prim and Kruskal, single-source shortest paths: Dijkstra and Bellman-Ford) | [Unit III](04-unit-3-divide-and-conquer-greedy-methods.md) |
| IV | Dynamic programming (knapsack, all-pairs shortest paths: Warshall and Floyd, resource allocation); Backtracking and Branch and Bound (travelling salesman, graph colouring, n-Queens, Hamiltonian cycles, sum of subsets) | [Unit IV](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md) |
| V | Selected topics: algebraic computation, Fast Fourier Transform, string matching, theory of NP-completeness, approximation algorithms, randomized algorithms | [Unit V](06-unit-5-selected-topics.md) |

> **How to use these notes:** for theory exams read the definitions, the tables and the "exam tip" boxes; for practicals and interviews type each program yourself, change the input, and predict the output before running. Code uses `#include <bits/stdc++.h>` (a GCC convenience header) to keep programs short; in a project include the specific headers instead.

**Contents**

- [Unit I: Introduction and sorting](02-unit-1-introduction-and-sorting.md)
- [Unit II: Advanced data structures](03-unit-2-advanced-data-structures.md)
- [Unit III: Divide and conquer, greedy methods](04-unit-3-divide-and-conquer-greedy-methods.md)
- [Unit IV: Dynamic programming, backtracking, branch and bound](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md)
- [Unit V: Selected topics (FFT, strings, NP, approximation, randomized)](06-unit-5-selected-topics.md)
- [Quick revision sheet](07-quick-revision-sheet.md)

**Unit I**

- [1.1 What is an algorithm](02-unit-1-introduction-and-sorting.md#11-what-is-an-algorithm)
- [1.2 Analyzing algorithms](02-unit-1-introduction-and-sorting.md#12-analyzing-algorithms)
- [1.3 Complexity and asymptotic notation](02-unit-1-introduction-and-sorting.md#13-complexity-and-asymptotic-notation)
- [1.4 Growth of functions and recurrences](02-unit-1-introduction-and-sorting.md#14-growth-of-functions-and-recurrences)
- [1.5 Performance measurement](02-unit-1-introduction-and-sorting.md#15-performance-measurement)
- [1.6 Shell sort](02-unit-1-introduction-and-sorting.md#16-shell-sort)
- [1.7 Quick sort](02-unit-1-introduction-and-sorting.md#17-quick-sort)
- [1.8 Merge sort](02-unit-1-introduction-and-sorting.md#18-merge-sort)
- [1.9 Heap sort](02-unit-1-introduction-and-sorting.md#19-heap-sort)
- [1.10 Comparison of sorting algorithms](02-unit-1-introduction-and-sorting.md#110-comparison-of-sorting-algorithms)
- [1.11 Sorting in linear time](02-unit-1-introduction-and-sorting.md#111-sorting-in-linear-time)
- [1.12 Order statistics](02-unit-1-introduction-and-sorting.md#112-order-statistics)

**Unit II**

- [2.1 Why advanced structures](03-unit-2-advanced-data-structures.md#21-why-advanced-structures)
- [2.2 Red-Black trees](03-unit-2-advanced-data-structures.md#22-red-black-trees)
- [2.3 B-trees](03-unit-2-advanced-data-structures.md#23-b-trees)
- [2.4 Binomial heaps](03-unit-2-advanced-data-structures.md#24-binomial-heaps)
- [2.5 Fibonacci heaps](03-unit-2-advanced-data-structures.md#25-fibonacci-heaps)
- [2.6 Comparison of heaps](03-unit-2-advanced-data-structures.md#26-comparison-of-heaps)

**Unit III**

- [3.1 Divide and conquer](04-unit-3-divide-and-conquer-greedy-methods.md#31-divide-and-conquer)
- [3.2 Searching and max subarray](04-unit-3-divide-and-conquer-greedy-methods.md#32-searching-and-the-maximum-subarray-problem)
- [3.3 Matrix multiplication (Strassen)](04-unit-3-divide-and-conquer-greedy-methods.md#33-matrix-multiplication-strassen)
- [3.4 Convex hull](04-unit-3-divide-and-conquer-greedy-methods.md#34-convex-hull)
- [3.5 Greedy method](04-unit-3-divide-and-conquer-greedy-methods.md#35-greedy-method)
- [3.6 Activity selection](04-unit-3-divide-and-conquer-greedy-methods.md#36-activity-selection)
- [3.7 Fractional knapsack](04-unit-3-divide-and-conquer-greedy-methods.md#37-knapsack-fractional-greedy-versus-01)
- [3.8 Optimal reliability allocation](04-unit-3-divide-and-conquer-greedy-methods.md#38-optimal-reliability-allocation)
- [3.9 Minimum spanning trees](04-unit-3-divide-and-conquer-greedy-methods.md#39-minimum-spanning-trees-prim-and-kruskal)
- [3.10 Single-source shortest paths](04-unit-3-divide-and-conquer-greedy-methods.md#310-single-source-shortest-paths-dijkstra-and-bellman-ford)
- [3.11 Huffman coding](04-unit-3-divide-and-conquer-greedy-methods.md#311-huffman-coding-classic-greedy)

**Unit IV**

- [4.1 Dynamic programming](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md#41-dynamic-programming)
- [4.2 0/1 knapsack](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md#42-01-knapsack)
- [4.3 All-pairs shortest paths](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md#43-all-pairs-shortest-paths-floyd-warshall-and-warshall)
- [4.4 Resource allocation and reliability design](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md#44-resource-allocation-and-reliability-design-dp)
- [4.5 More DP classics](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md#45-more-dp-classics)
- [4.6 Backtracking](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md#46-backtracking)
- [4.7 n-Queens](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md#47-n-queens-problem)
- [4.8 Hamiltonian cycles](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md#48-hamiltonian-cycles)
- [4.9 Graph colouring](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md#49-graph-colouring)
- [4.10 Sum of subsets](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md#410-sum-of-subsets)
- [4.11 Branch and bound](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md#411-branch-and-bound)
- [4.12 Travelling salesman problem](05-unit-4-dynamic-programming-backtracking-branch-and-bound.md#412-travelling-salesman-problem-tsp)

**Unit V**

- [5.1 Algebraic computation](06-unit-5-selected-topics.md#51-algebraic-computation)
- [5.2 Fast Fourier Transform](06-unit-5-selected-topics.md#52-fast-fourier-transform-fft)
- [5.3 String matching](06-unit-5-selected-topics.md#53-string-matching)
- [5.4 NP-completeness](06-unit-5-selected-topics.md#54-theory-of-np-completeness)
- [5.5 Approximation algorithms](06-unit-5-selected-topics.md#55-approximation-algorithms)
- [5.6 Randomized algorithms](06-unit-5-selected-topics.md#56-randomized-algorithms)
