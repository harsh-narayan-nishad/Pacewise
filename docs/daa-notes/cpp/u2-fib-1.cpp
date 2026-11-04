#include <bits/stdc++.h>
using namespace std;

struct FNode {
    int key, degree = 0;
    bool mark = false;
    FNode *parent = nullptr, *child = nullptr, *left, *right;
    FNode(int k) : key(k) { left = right = this; }
};

class FibHeap {
    FNode* minNode = nullptr;
    int n = 0;

    static void insertAfter(FNode* a, FNode* x) { x->left = a; x->right = a->right; a->right->left = x; a->right = x; }
    static void unlink(FNode* x) { x->left->right = x->right; x->right->left = x->left; }

    void addRoot(FNode* x) {                                       // x is detached; put it in the root list
        if (!minNode) { x->left = x->right = x; minNode = x; }
        else { insertAfter(minNode, x); if (x->key < minNode->key) minNode = x; }
    }
    static void link(FNode* y, FNode* x) {                         // make root y a child of root x
        unlink(y);
        y->parent = x; y->mark = false;
        if (!x->child) { x->child = y; y->left = y->right = y; }
        else insertAfter(x->child, y);
        x->degree++;
    }
    void consolidate() {
        vector<FNode*> A(64, nullptr);                             // A[d] = a root of degree d (64 > log_phi of any int n)
        vector<FNode*> roots;
        FNode* w = minNode;
        do { roots.push_back(w); w = w->right; } while (w != minNode);
        for (FNode* x : roots) {
            int d = x->degree;
            while (A[d]) {
                FNode* y = A[d];
                if (x->key > y->key) swap(x, y);                   // x keeps the smaller key
                link(y, x);
                A[d] = nullptr;
                d++;
            }
            A[d] = x;
        }
        minNode = nullptr;                                         // rebuild the root list and the min pointer
        for (FNode* x : A) if (x) addRoot(x);
    }
    void cut(FNode* x, FNode* y) {                                 // remove x from the child list of y
        if (x->right == x) y->child = nullptr;
        else { if (y->child == x) y->child = x->right; unlink(x); }
        y->degree--;
        x->parent = nullptr; x->mark = false;
        insertAfter(minNode, x);                                   // add x to the root list
    }
    void cascadingCut(FNode* y) {
        FNode* z = y->parent;
        if (!z) return;
        if (!y->mark) y->mark = true;
        else { cut(y, z); cascadingCut(z); }
    }

public:
    bool empty() const { return n == 0; }
    int size() const { return n; }

    FNode* insert(int k) {                                         // O(1)
        FNode* x = new FNode(k);
        addRoot(x);
        n++;
        return x;                                                  // handle for later decreaseKey
    }
    int minimum() const { assert(minNode); return minNode->key; }  // O(1)

    void meld(FibHeap& o) {                                        // O(1): splice the two circular root lists
        if (!o.minNode) return;
        if (!minNode) { minNode = o.minNode; n = o.n; }
        else {
            FNode *aR = minNode->right, *bL = o.minNode->left;
            minNode->right = o.minNode; o.minNode->left = minNode;
            bL->right = aR; aR->left = bL;
            if (o.minNode->key < minNode->key) minNode = o.minNode;
            n += o.n;
        }
        o.minNode = nullptr; o.n = 0;
    }

    int extractMin() {                                             // O(log n) amortized
        FNode* z = minNode;
        assert(z);
        vector<FNode*> kids;
        if (z->child) { FNode* c = z->child; do { kids.push_back(c); c = c->right; } while (c != z->child); }
        for (FNode* c : kids) { c->parent = nullptr; insertAfter(z, c); }   // children become roots
        z->child = nullptr;
        if (z->right == z) minNode = nullptr;
        else { minNode = z->right; unlink(z); consolidate(); }
        n--;
        int k = z->key;
        delete z;
        return k;
    }

    void decreaseKey(FNode* x, int k) {                            // O(1) amortized
        assert(k <= x->key);
        x->key = k;
        FNode* y = x->parent;
        if (y && x->key < y->key) { cut(x, y); cascadingCut(y); }
        if (x->key < minNode->key) minNode = x;
    }
    void remove(FNode* x) { decreaseKey(x, INT_MIN); extractMin(); }

    void printRoots() const {
        cout << "roots: ";
        if (minNode) { FNode* w = minNode; do { cout << w->key << "(deg " << w->degree << ") "; w = w->right; } while (w != minNode); }
        cout << "\n";
    }
};

int main() {
    FibHeap h;
    for (int k : {7, 3, 9, 1, 5, 8, 2, 6}) h.insert(k);
    cout << "after 8 inserts (lazy, nothing linked yet): "; h.printRoots();
    cout << "extractMin = " << h.extractMin() << "  -> consolidation links equal-degree trees\n";
    h.printRoots();

    // stress test: many inserts, one extract-min (builds real trees), many decrease-keys, then drain the heap
    mt19937 rng(11);
    FibHeap big;
    vector<int> keys(3000);
    iota(keys.begin(), keys.end(), 0);
    shuffle(keys.begin(), keys.end(), rng);                        // 3000 distinct keys
    vector<FNode*> handles;
    vector<int> cur;
    for (int k : keys) { handles.push_back(big.insert(1000 + 3 * k)); cur.push_back(1000 + 3 * k); }
    int first = big.extractMin();                                  // the minimum key, so drop its handle
    size_t at = min_element(cur.begin(), cur.end()) - cur.begin();
    assert(cur[at] == first);
    cur.erase(cur.begin() + at);
    handles.erase(handles.begin() + at);
    for (int i = 0; i < 2000; i++) {                               // random decrease-keys (cuts and cascading cuts)
        size_t j = rng() % handles.size();
        int nk = max(0, cur[j] - (int)(rng() % 500));
        big.decreaseKey(handles[j], nk);
        cur[j] = nk;
    }
    sort(cur.begin(), cur.end());
    bool ok = true;
    for (int x : cur) ok = ok && big.extractMin() == x;
    cout << "3000 inserts + 2000 decrease-keys, drained in sorted order: " << (ok && big.empty() ? "yes" : "NO") << "\n";
}
