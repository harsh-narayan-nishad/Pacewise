# Unit II: Advanced Data Structures

## 2.1 Why advanced structures

- A plain binary search tree (BST) has height Θ(n) in the worst case (insert sorted keys) so search is O(n). **Balanced** trees (Red-Black, AVL, B-trees) keep the height O(log n) with local repairs (rotations, splits).
- A binary heap supports insert and extract-min in O(log n) but **merging two heaps** costs O(n). **Mergeable heaps** (binomial, Fibonacci) merge in O(log n) or O(1), and Fibonacci heaps make *decrease-key* O(1) amortized, which speeds up Dijkstra and Prim.
- B-trees are designed for **disks**: one node = one disk block, so a very wide tree (hundreds of children) keeps the number of disk reads tiny.

## 2.2 Red-Black trees

> **Red-Black tree:**
>
> 1. Every node is either red or black.
> 2. The root is black.
> 3. Every leaf (NIL sentinel) is black.
> 4. If a node is red, both its children are black (no two reds in a row).
> 5. For every node, all simple paths down to descendant leaves contain the same number of black nodes (the *black-height* bh(x)).

- **Height bound:** a subtree rooted at x has at least 2^bh(x) - 1 internal nodes (induction). By property 4, bh(root) ≥ h/2, so n ≥ 2^(h/2) - 1 and **h ≤ 2 log₂(n + 1)**. Search, minimum, maximum, successor, insert and delete are all O(log n).
- **Rotation:** a local O(1) restructuring that preserves the BST order. A left rotation on x makes its right child y the new subtree root, x becomes y's left child, and y's old left subtree becomes x's right subtree. Right rotation is the mirror image.

```text
      x                 y
     / \    left        / \
    a   y   ======>    x   c
       / \   rotation  / \
      b   c           a   b
```

### Insertion

Insert like a normal BST, colour the new node **red** (so property 5 is not broken), then fix a possible red-red violation with the node z, its parent p, grandparent g and *uncle* u:

| Case | Condition | Fix |
|---|---|---|
| 1 | Uncle is red | Recolour parent and uncle black, grandparent red; move z up to g and repeat |
| 2 | Uncle is black, z is an "inner" child (zig-zag) | Rotate at the parent to turn it into case 3 |
| 3 | Uncle is black, z is an "outer" child (zig-zig) | Recolour parent black and grandparent red, rotate at the grandparent; done |

At most 2 rotations per insert; the recolouring loop runs O(log n) times. Finally the root is coloured black.

### Deletion

Delete like a BST (replace a node with two children by its successor). If the physically removed node was **black**, a "double black" appears at x (the node that moved into its place) and must be repaired; x's sibling w decides the case:

| Case | Condition | Fix |
|---|---|---|
| 1 | Sibling w is red | Recolour w black and the parent red, rotate at the parent: now w is black (goes to 2, 3 or 4) |
| 2 | w black, both of w's children black | Recolour w red, move the extra black up to the parent |
| 3 | w black, near child red, far child black | Recolour and rotate at w to get case 4 |
| 4 | w black, far child red | w takes the parent's colour, parent and far child black, rotate at the parent; done |

At most 3 rotations per delete. Compared with **AVL trees**: AVL is more strictly balanced (height ≤ 1.44 log n) so lookups are a bit faster, but Red-Black does fewer rotations on insert/delete; hence Red-Black trees back `std::map`/`std::set` and Java's `TreeMap`.

::include cpp/u2-rb-1.cpp

::include cpp/u2-rb-1.out.txt

## 2.3 B-trees

> **B-tree of minimum degree t ≥ 2:**
>
> - every node stores its keys in sorted order; a node with k keys has k+1 children (internal nodes);
> - every node except the root has at least **t-1** and at most **2t-1** keys (so t to 2t children); the root has at least 1 key (if the tree is not empty);
> - all leaves are at the same depth.

- **Height:** n ≥ 1 + (t-1)·Σ 2·t^(i-1) = 2t^h - 1, so **h ≤ log_t((n+1)/2)**. With t = 500 a tree of a billion keys has height at most 4, so at most about 4 disk reads.
- **Search:** in each node binary/linear search for the key, descend into the right child: O(t·log_t n) time and O(log_t n) disk accesses.
- **Insert (single downward pass):** walk down; whenever you meet a *full* node (2t-1 keys), **split** it around its median key (median moves up to the parent, the two halves become two nodes with t-1 keys each). Then insert into a leaf that is guaranteed to have room. If the root is full, the tree grows in height by one (the only way height increases).
- **Delete (also a single downward pass, never going into a node with only t-1 keys without fixing it first):**
    1. Key in a leaf: remove it.
    2. Key in an internal node: replace by its predecessor (if the left child has ≥ t keys) or successor (if the right child has ≥ t keys) and delete that recursively; if both children have exactly t-1 keys, **merge** them with the key and delete from the merged node.
    3. Key not in the node: before descending into child c with only t-1 keys, make it larger: **borrow** a key from a sibling with ≥ t keys (rotate through the parent) or **merge** with a sibling. If the root becomes empty, the height shrinks by one.
- **B+ tree** (used in databases and file systems): all records live in the leaves, internal nodes hold only routing keys, leaves are linked in a list so range queries are sequential. **B∗-tree** keeps nodes at least 2/3 full.
- All operations are O(log n); 2-3-4 trees are B-trees with t = 2 and are equivalent to Red-Black trees.

::include cpp/u2-b-1.cpp

::include cpp/u2-b-1.out.txt

## 2.4 Binomial heaps

> **Binomial tree B<sub>k</sub>:** B<sub>0</sub> is a single node; B<sub>k</sub> is formed by linking two copies of B<sub>k-1</sub> (one becomes the leftmost child of the other's root). Properties: 2^k nodes; height k; root has degree k; exactly C(k, i) nodes at depth i (hence the name); the children of the root are roots of B<sub>k-1</sub>, B<sub>k-2</sub>, ..., B<sub>0</sub>.<br /> **Binomial heap:** a collection of binomial trees, each satisfying the min-heap property (parent ≤ children), with at most *one* tree of each degree. Roots are kept in a linked list in increasing degree.

- A heap with n nodes contains tree B<sub>i</sub> exactly when bit i of the binary representation of n is 1, so it has at most ⌊log₂ n⌋ + 1 trees. For n = 13 = 1101₂ the heap has B₀, B₂, B₃.
- **Union (the core operation):** merge the two root lists by degree (like merging sorted lists), then walk along it: when two trees have the same degree, link them (the one with the smaller root becomes the parent). This is exactly **binary addition with carries**: O(log n).
- **Insert:** union with a one-node heap: O(log n) worst case, O(1) amortized.
- **Find-min:** scan the root list: O(log n).
- **Extract-min:** remove the minimum root; its children, reversed, form a binomial heap; union it with the rest: O(log n).
- **Decrease-key:** change the key and bubble it up while smaller than its parent: O(log n). **Delete:** decrease the key to -∞ and extract-min: O(log n).

::include cpp/u2-binom-1.cpp

::include cpp/u2-binom-1.out.txt

## 2.5 Fibonacci heaps

- **Structure:** a collection of min-heap-ordered trees whose roots are in a circular doubly linked list, with a pointer `min` to the smallest root. Each node stores key, degree, parent, one child pointer (children also form a circular doubly linked list), and a **mark** bit (has this node lost a child since it last became a child of another node?). Operations are *lazy*: work is postponed until extract-min.
- **Insert:** add a new single-node tree to the root list, update min: O(1). **Union:** concatenate root lists: O(1). **Find-min:** O(1).
- **Extract-min:** remove the min root, add its children to the root list, then **consolidate**: link roots of equal degree (using an array indexed by degree) until all roots have distinct degrees; rebuild the min pointer. Amortized O(log n).
- **Decrease-key:** lower the key; if the heap order with the parent is violated, **cut** the node and move it to the root list. If the parent was already marked, cut it too (**cascading cut**), otherwise mark it. O(1) amortized: the cascade cost is paid by the potential.
- **Delete:** decrease-key to -∞, then extract-min: O(log n) amortized.
- **Potential function:** Φ = t(H) + 2·m(H) (number of roots + 2 × marked nodes). Consolidation lowers the number of roots, which pays for itself; a cascading cut un-marks nodes, each cut costs O(1) actual but lowers Φ.
- **Why log n degree bound:** the cuts rule (a node loses at most one child before it is itself cut) guarantees that a node of degree k has subtree size at least F<sub>k+2</sub> ≥ φ^k (φ = 1.618, golden ratio, Fibonacci numbers; hence the name). So the maximum degree is D(n) ≤ log_φ n = O(log n).
- **Application:** Dijkstra and Prim run in O(E + V log V) with a Fibonacci heap (E decrease-keys at O(1) plus V extract-mins at O(log V)) instead of O(E log V). The constants are large, so in practice binary heaps usually win.

::include cpp/u2-fib-1.cpp

::include cpp/u2-fib-1.out.txt

## 2.6 Comparison of heaps

| Operation | Binary heap (worst) | Binomial heap (worst) | Fibonacci heap (amortized) |
|---|---|---|---|
| Make-heap | Θ(1) | Θ(1) | Θ(1) |
| Insert | Θ(log n) | Θ(log n) | Θ(1) |
| Find-min | Θ(1) | Θ(log n) (O(1) with a min pointer) | Θ(1) |
| Extract-min | Θ(log n) | Θ(log n) | O(log n) |
| Union (meld) | Θ(n) | Θ(log n) | Θ(1) |
| Decrease-key | Θ(log n) | Θ(log n) | Θ(1) |
| Delete | Θ(log n) | Θ(log n) | O(log n) |

| Structure | Balance rule | Height | Best used for |
|---|---|---|---|
| AVL tree | Heights of siblings differ by ≤ 1 | ≤ 1.44 log₂ n | Lookup-heavy in-memory dictionaries |
| Red-Black tree | Colour rules (5 properties) | ≤ 2 log₂(n+1) | General dictionaries (`std::map`), fewer rotations |
| B-tree | Node fill between t-1 and 2t-1 keys, leaves at equal depth | ≤ log_t((n+1)/2) | Databases, file systems (disk blocks) |

> **Exam tip:** be ready to (1) insert a sequence of keys into a Red-Black tree and a B-tree and draw the result after each step, naming the case used; (2) delete a key from a B-tree showing borrow and merge; (3) draw the binomial heap for n keys (link as in binary addition); (4) state the potential function of a Fibonacci heap and the amortized costs.
