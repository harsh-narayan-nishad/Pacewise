#include <bits/stdc++.h>
using namespace std;

struct BNode {
    int key, degree;
    BNode *parent, *child, *sibling;                     // leftmost child, next sibling (or next root)
    BNode(int k) : key(k), degree(0), parent(nullptr), child(nullptr), sibling(nullptr) {}
};

class BinomialHeap {
    BNode* head = nullptr;                               // root list in increasing order of degree

    static void link(BNode* y, BNode* z) {               // make y (a B_{k-1}) the leftmost child of z (another B_{k-1})
        y->parent = z; y->sibling = z->child; z->child = y; z->degree++;
    }
    static BNode* mergeRootLists(BNode* a, BNode* b) {   // merge by degree, like merging two sorted lists
        BNode dummy(0);
        BNode* tail = &dummy;
        while (a && b) {
            if (a->degree <= b->degree) { tail->sibling = a; a = a->sibling; }
            else { tail->sibling = b; b = b->sibling; }
            tail = tail->sibling;
        }
        tail->sibling = a ? a : b;
        return dummy.sibling;
    }
    static BNode* unionHeaps(BNode* h1, BNode* h2) {
        BNode* head = mergeRootLists(h1, h2);
        if (!head) return nullptr;
        BNode *prev = nullptr, *x = head, *next = x->sibling;
        while (next) {
            if (x->degree != next->degree || (next->sibling && next->sibling->degree == x->degree)) {
                prev = x; x = next;                                    // cases 1 and 2: just move on
            } else if (x->key <= next->key) {                          // case 3: next becomes a child of x
                x->sibling = next->sibling;
                link(next, x);
            } else {                                                   // case 4: x becomes a child of next
                if (prev) prev->sibling = next; else head = next;
                link(x, next);
                x = next;
            }
            next = x->sibling;
        }
        return head;
    }
    static BNode* findNode(BNode* r, int key) {          // search the tree rooted at r (not its siblings)
        if (r->key == key) return r;
        for (BNode* c = r->child; c; c = c->sibling)
            if (BNode* f = findNode(c, key)) return f;
        return nullptr;
    }

public:
    bool empty() const { return head == nullptr; }
    void insert(int k) { head = unionHeaps(head, new BNode(k)); }
    void meld(BinomialHeap& other) { head = unionHeaps(head, other.head); other.head = nullptr; }

    int minimum() const {
        assert(head);
        int m = head->key;
        for (BNode* r = head; r; r = r->sibling) m = min(m, r->key);
        return m;
    }
    int extractMin() {
        assert(head);
        BNode *prev = nullptr, *minPrev = nullptr, *minNode = head;
        for (BNode* cur = head; cur; prev = cur, cur = cur->sibling)
            if (cur->key < minNode->key) { minNode = cur; minPrev = prev; }
        if (minPrev) minPrev->sibling = minNode->sibling; else head = minNode->sibling;
        BNode *rev = nullptr, *c = minNode->child;                     // reverse the child list -> a valid heap
        while (c) { BNode* nxt = c->sibling; c->sibling = rev; c->parent = nullptr; rev = c; c = nxt; }
        int k = minNode->key;
        delete minNode;
        head = unionHeaps(head, rev);
        return k;
    }
    void decreaseKey(int oldKey, int newKey) {
        BNode* x = nullptr;
        for (BNode* r = head; r && !x; r = r->sibling) x = findNode(r, oldKey);
        assert(x && newKey <= oldKey);
        x->key = newKey;
        BNode *y = x, *z = y->parent;
        while (z && y->key < z->key) { swap(y->key, z->key); y = z; z = y->parent; }   // bubble up
    }
    void remove(int key) { decreaseKey(key, INT_MIN); extractMin(); }

    void printRoots() const {
        cout << "trees: ";
        for (BNode* r = head; r; r = r->sibling) cout << "B" << r->degree << "(root " << r->key << ") ";
        cout << "\n";
    }
};

int main() {
    BinomialHeap h;
    for (int k : {12, 7, 25, 3, 18, 9, 1, 30, 15, 21, 5, 8, 11}) h.insert(k);   // 13 keys = 1101 in binary
    cout << "13 keys inserted. "; h.printRoots();
    cout << "minimum = " << h.minimum() << "\n";
    h.decreaseKey(30, 0);
    h.remove(15);
    cout << "after decreaseKey(30 -> 0) and remove(15), extracting everything: ";
    while (!h.empty()) cout << h.extractMin() << ' ';
    cout << "\n";

    BinomialHeap a, b;                                                         // union of two heaps
    for (int k : {40, 10, 30}) a.insert(k);
    for (int k : {20, 50, 5, 60}) b.insert(k);
    a.meld(b);
    cout << "union of two heaps -> "; a.printRoots();

    mt19937 rng(3);                                                            // stress test
    vector<int> v(5000);
    iota(v.begin(), v.end(), 1);
    shuffle(v.begin(), v.end(), rng);
    BinomialHeap big;
    for (int x : v) big.insert(x);
    bool ok = true;
    for (int i = 1; i <= 5000; i++) ok = ok && big.extractMin() == i;
    cout << "5000 shuffled inserts come out in sorted order: " << (ok ? "yes" : "NO") << "\n";
}
