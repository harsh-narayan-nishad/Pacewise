# 04 · Data Structures और Algorithms

इस level पर target pace: **Easy ≤ 10 min, Medium ≤ 25 min, Hard ≤ 40 min**, हमेशा complexity और edge cases बताते हुए। Pattern > problem count।

## Easy
| समस्या | Pattern | मुख्य विचार |
|---|---|---|
| Two Sum | Hash map | value→index store करें, एक pass, O(n) |
| Valid Parentheses | Stack | open को push करें, close पर match करें |
| Merge Two Sorted Lists | Two pointers | dummy head |
| Best Time to Buy/Sell Stock | Running min | एक pass |
| Binary Search | Binary search | `lo<=hi`, overflow से बचें |
| Reverse Linked List | Pointers | prev/curr/next |
| Valid Anagram / Palindrome | Counting / two pointers | |
| Maximum Depth of Binary Tree | DFS | recursion |

## Medium
| समस्या | Pattern | मुख्य विचार |
|---|---|---|
| Longest Substring Without Repeating | Sliding window | map char→last index |
| 3Sum | Sort + two pointers | duplicates छोड़ें |
| Group Anagrams | Hashing | sorted key / count tuple |
| Top K Frequent Elements | Heap / bucket | O(n log k) या O(n) |
| Number of Islands | BFS/DFS / DSU | grid flood fill |
| Course Schedule | Topological sort | Kahn's / DFS colours |
| LRU Cache | Hash map + doubly linked list | O(1) get/put |
| Merge Intervals | Sort | sweep |
| Kth Largest in Array | Quickselect / heap | औसत O(n) |
| Coin Change | 1-D DP | `dp[a]=min(dp[a-c]+1)` |
| Word Break | DP + trie/set | |
| Lowest Common Ancestor | Tree recursion | |
| Rotting Oranges | Multi-source BFS | |

## Hard
| समस्या | Pattern | मुख्य विचार |
|---|---|---|
| Median of Two Sorted Arrays | Partition पर binary search | O(log min(m,n)) |
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

## Project से जुड़ी समस्याएँ (इनके बारे में असली code से बात करें)
- **Tokenizer** (`lib/editor/code/Tokenizer.ts`): spec-driven lexer जिसके tokens जोड़ने पर वापस source बन जाता है — इसे property test से साबित करें (`join(tokens) === source`)।
- **Code formatter** (`formatCode.ts`): bracket-depth indentation, हर line के open counts के stack के साथ; idempotent (`format(format(x)) === format(x)`) और strings/comments को कभी नहीं छूता।
- **Sliding window / interpolation:** `easeToward` एक exponential lerp है: `x += (target-x) * (1 - e^(-k·dt))` — frame-rate से स्वतंत्र।
- **Reading time और WPM:** `wpmFromElapsed(words, ms)`; edge cases: शून्य elapsed, जल्दी ख़त्म करना, clamping।

## Complexity cheat-sheet
Array access O(1) · hash avg O(1) · balanced BST O(log n) · heap push/pop O(log n) · sort O(n log n) · BFS/DFS O(V+E) · Dijkstra O((V+E) log V)।
