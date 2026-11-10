# यूनिट IV: Dynamic Programming, Backtracking, Branch and Bound

## 4.1 Dynamic programming

> **Dynamic programming (DP):** किसी problem को *overlapping* subproblems के solutions को मिलाकर हल करना, जिसमें हर subproblem सिर्फ एक बार solve होता है और उसका answer एक table में store किया जाता है। यह तब लागू होता है जब problem में (1) **optimal substructure** हो (optimal solution के अंदर उसके subproblems के optimal solutions होते हैं) और (2) **overlapping subproblems** हों (वही subproblem बार-बार चाहिए होता है)।

- **चार steps:** (1) optimal solution की structure पहचानना, (2) value को recursively define करना (recurrence और उसके base cases), (3) values को bottom-up compute करना (या memoization के साथ top-down), (4) table से असली solution दोबारा बनाना (choices store करना या पीछे walk करना)।
- **Top-down (memoization):** recursion लिखें, results cache करें; सिर्फ ज़रूरी subproblems compute होते हैं; recursion का overhead रहता है। **Bottom-up (tabulation):** table को dependency order में भरें; recursion नहीं; space optimization संभव है (सिर्फ आखिरी row रखें)।
- **Complexity** = (subproblems की संख्या) × (हर subproblem का काम)।
- **DP बनाम greedy बनाम D&C:** D&C के subproblems independent होते हैं, DP के subproblems overlap करते हैं, greedy बाकी choices को देखे बिना एक choice पर commit कर देता है।
- "programming" शब्द का मतलब "table के साथ planning" है, computer programming नहीं।

::include cpp/u4-dp-1.cpp

::include cpp/u4-dp-1.out.txt

## 4.2 0/1 knapsack

n items जिनके weights w<sub>i</sub> और values v<sub>i</sub> हैं, capacity W है; हर item या तो लिया जाता है या छोड़ा जाता है (0/1)। कुल value को maximize करना है।

```text
Let K[i][c] = best value using only the first i items with capacity c.
K[0][c] = 0,  K[i][0] = 0
K[i][c] = K[i-1][c]                                   if w[i] > c           (item i does not fit)
K[i][c] = max( K[i-1][c],  K[i-1][c - w[i]] + v[i] )  otherwise              (skip it, or take it)
```

- **Time Θ(nW), space Θ(nW)** (अगर सिर्फ value चाहिए तो Θ(W): 1-D array पर capacity को नीचे की ओर loop करें)। Input का size n और log W है, इसलिए यह *pseudo-polynomial* है; यह problem NP-hard है।
- **Reconstruction:** K[n][W] से शुरू करें; अगर K[i][c] ≠ K[i-1][c] है, तो item i लिया गया था, इसलिए उसका weight घटाएँ और ऊपर जाएँ; नहीं तो बस ऊपर जाएँ।

::include cpp/u4-knap-1.cpp

::include cpp/u4-knap-1.out.txt

## 4.3 All-pairs shortest paths: Floyd-Warshall और Warshall

- **Floyd-Warshall:** vertices की *हर* pair के बीच shortest distance। मान लें d<sup>(k)</sup>[i][j] वह shortest i→j path है जो intermediates के तौर पर सिर्फ vertices {1..k} इस्तेमाल करता है:  तीन nested loops (k सबसे बाहर!): **Θ(V³) time**, Θ(V²) space (layers को in-place overwrite किया जा सकता है)। Negative edges संभाल लेता है; negative cycle तभी होता है जब कोई d[i][i] < 0 हो। एक `next` matrix से paths दोबारा बनाए जा सकते हैं।
- **Warshall's algorithm:** इसका boolean version, जो **transitive closure** compute करता है (क्या i से j तक कोई path है?): `reach[i][j] = reach[i][j] OR (reach[i][k] AND reach[k][j])`, Θ(V³) (या bitsets के साथ Θ(V³/64))।
- **विकल्प:** हर vertex से Dijkstra चलाना (O(V·E log V), non-negative weights वाले sparse graphs के लिए अच्छा); **Johnson's algorithm** Bellman-Ford से edges को reweight करता है ताकि negative edges के साथ भी Dijkstra चले: O(V² log V + VE)।

```text
d(k)[i][j] = min( d(k-1)[i][j],  d(k-1)[i][k] + d(k-1)[k][j] )     (path avoiding k, or passing through k)
```

::include cpp/u4-apsp-1.cpp

::include cpp/u4-apsp-1.out.txt

## 4.4 Resource allocation और reliability design (DP)

- **Resource allocation problem:** किसी resource (पैसा, machines, घंटे) की R identical units को n activities में बाँटना है; activity i को x units मिलने पर profit P<sub>i</sub>(x) देती है। Σ x<sub>i</sub> ≤ R के साथ कुल profit maximize करें। मान लें F[i][r] = पहली i activities को r units देने पर सबसे अच्छा profit:  Time Θ(n·R²), space Θ(n·R) (allocation दोबारा बनाने के लिए argmax x store किया जाता है)। यहाँ greedy fail होता है, जब तक profit functions concave न हों।
- **Reliability design (section 3.8 की problem का exact solution):** मान लें F[i][b] = stages 1..i की अधिकतम reliability, जब कुल cost अधिकतम b हो:  Time Θ(n·C·(C/c<sub>min</sub>)), pseudo-polynomial। Section 3.8 का marginal-gain greedy सिर्फ एक heuristic है: नीचे का program इसकी तुलना इस exact DP से 1000 random instances पर करता है और पाता है कि यह ज़्यादातर में optimal है लेकिन सभी में नहीं (output देखें); DP हमेशा optimal होता है।

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

## 4.5 और DP classics

| Problem | State और recurrence | Time |
|---|---|---|
| Longest common subsequence | L[i][j] = L[i-1][j-1] + 1 if a[i] = b[j], else max(L[i-1][j], L[i][j-1]) | Θ(mn) |
| Matrix-chain multiplication | M[i][j] = min over k of ( M[i][k] + M[k+1][j] + p[i-1]·p[k]·p[j] ) | Θ(n³) |
| Edit distance | D[i][j] = D[i-1][j-1] if equal, else 1 + min(D[i-1][j], D[i][j-1], D[i-1][j-1]) | Θ(mn) |
| Coin change (min coins) | dp[a] = 1 + min over coins c ≤ a of dp[a - c] | Θ(amount × coins) |
| Longest increasing subsequence | dp[i] = 1 + max dp[j] (j < i, a[j] < a[i]); binary search के साथ O(n log n) | Θ(n²) |
| Optimal binary search tree | e[i][j] = min over r of ( e[i][r-1] + e[r+1][j] + w(i,j) ) | Θ(n³) |

::include cpp/u4-more-1.cpp

::include cpp/u4-more-1.out.txt

## 4.6 Backtracking

> **Backtracking:** solution को एक-एक component करके बनाना (*state-space tree* की depth-first search); जैसे ही कोई partial solution किसी valid complete solution तक नहीं पहुँच सकता (वह *promising* नहीं है), उसे छोड़ दें और पिछली choice पर **backtrack** करें। यह pruning के साथ brute force है।

- **Terminology:** *explicit constraints* हर component की संभावित values तय करती हैं (जैसे x<sub>i</sub> ∈ {0,1}); *implicit constraints* बताती हैं कि components का आपस में क्या संबंध होना चाहिए (जैसे कोई दो queens एक-दूसरे पर attack न करें); *solution space* वे सभी tuples हैं जो explicit constraints को satisfy करते हैं; *bounding function* ऐसे node को खत्म कर देता है जिसके subtree में कोई solution नहीं हो सकता।
- **Template:**
- **Complexity:** worst case में exponential (permutations के लिए O(n!), subsets के लिए O(2^n), colourings के लिए O(m^n)) लेकिन pruning की वजह से आमतौर पर काफ़ी कम। अच्छा pruning order और checks किसी भी चीज़ से ज़्यादा मायने रखते हैं।
- Puzzles, constraint satisfaction, combinatorial enumeration में इस्तेमाल होता है। यह *feasible* या *सभी* solutions ढूँढता है; optimization के लिए इसे branch and bound में सुधारा जाता है (section 4.11)।

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

n×n board पर n queens इस तरह रखें कि कोई दो एक-दूसरे पर attack न करें (कोई दो एक ही row, column या diagonal में न हों)। हर row में एक queen रखें, हर column आज़माएँ और तीन boolean arrays से prune करें: used columns, used "/" diagonals (row + col) और used "\\" diagonals (row - col)। Solutions की संख्या: n = 4 → 2, n = 6 → 4, n = 8 → 92। Pruning के बिना state-space tree में n^n leaves होते हैं; backtracking उसके बहुत छोटे हिस्से को visit करता है। (हर n ≥ 4 के लिए और n = 1 के लिए solutions मौजूद हैं।)

::include cpp/u4-nq-1.cpp

::include cpp/u4-nq-1.out.txt

## 4.8 Hamiltonian cycles

**Hamiltonian cycle** हर vertex को ठीक एक बार visit करती है और शुरुआत पर लौट आती है (इसे ढूँढना NP-complete है; Euler cycles, जो हर *edge* को एक बार इस्तेमाल करती हैं, आसान हैं)। Backtracking: vertex 0 को start के रूप में fix करें (cycle को rotate किया जा सकता है), path को एक-एक vertex बढ़ाएँ, कोई vertex तभी स्वीकार करें जब वह पिछले vertex का adjacent हो और अभी तक use न हुआ हो, और अंत में start तक वापसी की edge जाँचें। Worst case O(n!), आमतौर पर बहुत कम।

::include cpp/u4-ham-1.cpp

::include cpp/u4-ham-1.out.txt

## 4.9 Graph colouring

**m-colouring decision problem:** क्या किसी graph के vertices को अधिकतम m colours से इस तरह रंगा जा सकता है कि adjacent vertices के रंग अलग हों? ऐसा सबसे छोटा m **chromatic number** χ(G) कहलाता है (इसे compute करना NP-hard है; m = 2 तय करना BFS (यानी bipartiteness) से आसान है, लेकिन m ≥ 3 NP-complete है)। Backtracking vertex-by-vertex colours assign करता है और 1..m में से हर वह colour आज़माता है जो किसी neighbour ने पहले से इस्तेमाल न किया हो; state-space tree में m^n leaves होते हैं, इसलिए worst case में O(n·m^n)। **Four colour theorem**: हर planar graph 4-colourable होता है। Applications: timetable और register allocation, map colouring, frequency assignment।

::include cpp/u4-color-1.cpp

::include cpp/u4-color-1.out.txt

## 4.10 Sum of subsets

n positive weights w<sub>1..n</sub> और एक target M दिए हैं; वे सभी subsets ढूँढें जिनके weights का योग ठीक M हो। Weights को बढ़ते क्रम में sort करें और एक binary state-space tree बनाएँ (हर weight को include या exclude करें)। किसी node को तब prune करें जब: **(a)** अब तक का sum जमा अगला weight M से ज़्यादा हो जाए (बाद के सभी weights कम से कम उतने ही बड़े हैं), या **(b)** अब तक का sum जमा *बचे हुए सभी* weights फिर भी M से कम हों। Worst case O(2^n), लेकिन pruning ज़्यादातर tree हटा देती है।

::include cpp/u4-sos-1.cpp

::include cpp/u4-sos-1.out.txt

## 4.11 Branch and bound

> **Branch and bound (B&B):** किसी *minimization* (या maximization) problem का optimum ढूँढने की search। *Branch*: किसी node (partial solution) को children में बाँटना। *Bound*: हर node के लिए उसके नीचे की किसी भी complete solution की cost का **lower bound** compute करना (maximization के लिए upper bound)। अगर bound अब तक मिली सबसे अच्छी complete solution (*incumbent*) से बेहतर नहीं है, तो पूरा subtree prune कर दिया जाता है।

- **Node selection strategies:** *FIFO* (queue, breadth-first), *LIFO* (stack, depth-first), और **least-cost (LC) search / best-first** (bound के हिसाब से ordered priority queue; आमतौर पर सबसे कम nodes expand करती है, लेकिन ज़्यादा memory चाहिए)।
- **अच्छे bounds B&B का दिल हैं:** tight लेकिन compute करने में सस्ते। शुरू में मिली पहली solution (greedy या depth-first dive से) एक अच्छा initial incumbent देती है।
- **Backtracking बनाम branch and bound:**

|  | Backtracking | Branch and bound |
|---|---|---|
| लक्ष्य | Feasible / सभी solutions ढूँढना | Optimal solution ढूँढना |
| Traversal | सिर्फ़ depth-first | BFS, DFS या best-first (कोई भी) |
| Pruning का आधार | Constraint violation (not promising) | अब तक की सबसे अच्छी solution से bound की तुलना |
| आम problems | n-Queens, Sudoku, graph colouring, Hamiltonian cycle, sum of subsets | TSP, 0/1 knapsack, job assignment |

## 4.12 Travelling salesman problem (TSP)

**Problem:** n cities और i से j जाने की cost c[i][j] दी है; सबसे सस्ता tour ढूँढें जो हर city को ठीक एक बार visit करे और शुरुआत पर लौट आए। (n-1)! tours हैं; TSP NP-hard है।

### तरीके

- **Brute force:** सभी (n-1)! tours आज़माना।
- **Held-Karp dynamic programming:** dp[S][j] = सबसे सस्ता path जो city 0 से शुरू होता है, cities के ठीक set S को visit करता है और j पर खत्म होता है: dp[S][j] = min over i in S\\{j} of dp[S\\{j}][i] + c[i][j]। Time O(n²·2^n), space O(n·2^n); लगभग n = 20 तक practical है।
- **Reduced cost matrix के साथ branch and bound (classic textbook method):**
    1. Cost matrix को *reduce* करें: हर row से उसका row minimum घटाएँ, फिर हर उस column से column minimum घटाएँ जिसमें कोई zero नहीं है। घटाई गई सभी amounts का योग किसी भी tour का lower bound है: यही root का bound है।
    2. उस child के लिए जो edge (i, j) लेता है: row i और column j को ∞ कर दें और c[j][start] (या c[j][i]) को भी ∞ कर दें ताकि कोई समय-पूर्व cycle न बने; फिर से reduce करें। **bound(child) = bound(parent) + reduction cost + (reduced) c[i][j]।**
    3. हमेशा सबसे छोटे bound वाले live node को expand करें (LC search); जिस node का bound ≥ अब तक मिले सबसे अच्छे tour का हो, उसे prune करें।
- नीचे का program एक सरल लेकिन फिर भी valid lower bound इस्तेमाल करता है: अब तक की cost + हर उस city के लिए, जिससे अभी निकलना बाकी है (current city और सभी unvisited cities), वह सबसे सस्ती edge जो वह आगे इस्तेमाल कर सकती है। यह priority queue के साथ best-first चलता है, और result को Held-Karp से check किया जाता है।

::include cpp/u4-tsp-1.cpp

::include cpp/u4-tsp-1.out.txt

### Branch-and-bound के अन्य examples

- **0/1 knapsack:** items को value/weight के हिसाब से order करें; node का bound बचे हुए items की fractional-knapsack value है (यह upper bound है क्योंकि splitting allowed है); bound ≤ best होने पर prune करें। सबसे बड़े bound के हिसाब से LC search।
- **Job assignment:** cost matrix के साथ n jobs को n workers को assign करें; bound = अब तक की cost + बची हुई हर row की सबसे सस्ती unused entry।
- **15-puzzle:** bound = अब तक की moves + tiles की Manhattan distances का योग (एक admissible heuristic; यह A* search है)।

| Problem | Technique | Time |
|---|---|---|
| 0/1 knapsack | DP | Θ(nW) pseudo-polynomial |
| All-pairs shortest paths | Floyd-Warshall (DP) | Θ(V³) |
| TSP | Held-Karp (DP) / branch and bound | O(n²2^n) / worst case में exponential |
| n-Queens, Hamiltonian cycle, colouring, sum of subsets | Backtracking | Worst case में exponential |

> **Exam tip:** 4-Queens, किसी छोटे graph की 3-colouring और sum of subsets के state-space tree बनाएँ (हर prune किए गए node के बगल में bounding conditions लिखकर), और 4 या 5-city TSP के लिए reduced cost matrices दिखाएँ। DP के सवालों में हमेशा table, recurrence, और answer को trace back करने का तरीका दिखाएँ।
