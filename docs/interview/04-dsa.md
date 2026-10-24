# 04 · Data Structures & Algorithms

Target pace at this level: **Easy ≤ 10 min, Medium ≤ 25 min, Hard ≤ 40 min**, always stating complexity and edge cases. Pattern > problem count.

## Easy
| Problem | Pattern | Key idea |
|---|---|---|
| Two Sum | Hash map | store value→index, one pass, O(n) |
| Valid Parentheses | Stack | push open, match on close |
| Merge Two Sorted Lists | Two pointers | dummy head |
| Best Time to Buy/Sell Stock | Running min | one pass |
| Binary Search | Binary search | `lo<=hi`, avoid overflow |
| Reverse Linked List | Pointers | prev/curr/next |
| Valid Anagram / Palindrome | Counting / two pointers | |
| Maximum Depth of Binary Tree | DFS | recursion |

## Medium
| Problem | Pattern | Key idea |
|---|---|---|
| Longest Substring Without Repeating | Sliding window | map char→last index |
| 3Sum | Sort + two pointers | skip duplicates |
| Group Anagrams | Hashing | sorted key / count tuple |
| Top K Frequent Elements | Heap / bucket | O(n log k) or O(n) |
| Number of Islands | BFS/DFS / DSU | grid flood fill |
| Course Schedule | Topological sort | Kahn's / DFS colours |
| LRU Cache | Hash map + doubly linked list | O(1) get/put |
| Merge Intervals | Sort | sweep |
| Kth Largest in Array | Quickselect / heap | avg O(n) |
| Coin Change | 1-D DP | `dp[a]=min(dp[a-c]+1)` |
| Word Break | DP + trie/set | |
| Lowest Common Ancestor | Tree recursion | |
| Rotting Oranges | Multi-source BFS | |

## Hard
| Problem | Pattern | Key idea |
|---|---|---|
| Median of Two Sorted Arrays | Binary search on partition | O(log min(m,n)) |
| Trapping Rain Water | Two pointers / monotonic stack | |
| Sliding Window Maximum | Monotonic deque | O(n) |
| Merge K Sorted Lists | Heap | O(N log k) |
| Word Ladder | BFS (bidirectional) | |
| Edit Distance | 2-D DP | |
| Longest Increasing Subsequence | DP + patience sort | O(n log n) |
| Serialize/Deserialize Binary Tree | Preorder + markers | |
| Alien Dictionary | Graph + topo sort | |
| Minimum Window Substring | Sliding window + counts | |
| Dijkstra / Network Delay Time | Heap graph | |
| Design a Text Editor / Autocomplete | Trie + heap | |

## Project-flavoured problems (talk about these from real code)
- **Tokenizer** (`lib/editor/code/Tokenizer.ts`): a spec-driven lexer whose tokens concatenate back to the source — prove it with a property test (`join(tokens) === source`).
- **Code formatter** (`formatCode.ts`): bracket-depth indentation with a stack of per-line open counts; idempotent (`format(format(x)) === format(x)`) and never touches strings/comments.
- **Sliding window / interpolation:** `easeToward` is an exponential lerp: `x += (target-x) * (1 - e^(-k·dt))` — frame-rate independent.
- **Reading time & WPM:** `wpmFromElapsed(words, ms)`; edge cases: zero elapsed, finishing early, clamping.

## Complexity cheat-sheet
Array access O(1) · hash avg O(1) · balanced BST O(log n) · heap push/pop O(log n) · sort O(n log n) · BFS/DFS O(V+E) · Dijkstra O((V+E) log V).
