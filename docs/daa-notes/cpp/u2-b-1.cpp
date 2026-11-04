#include <bits/stdc++.h>
using namespace std;

struct BNode {
    bool leaf;
    vector<int> keys;
    vector<BNode*> child;
    BNode(bool l) : leaf(l) {}
};

class BTree {
    int t;                                              // minimum degree: non-root nodes hold t-1 .. 2t-1 keys
    BNode* root;

    int lowerIdx(BNode* x, int k) { return lower_bound(x->keys.begin(), x->keys.end(), k) - x->keys.begin(); }

    void splitChild(BNode* x, int i) {                  // x->child[i] is full (2t-1 keys)
        BNode* y = x->child[i];
        BNode* z = new BNode(y->leaf);
        int median = y->keys[t - 1];
        z->keys.assign(y->keys.begin() + t, y->keys.end());
        y->keys.resize(t - 1);
        if (!y->leaf) {
            z->child.assign(y->child.begin() + t, y->child.end());
            y->child.resize(t);
        }
        x->keys.insert(x->keys.begin() + i, median);    // median moves up
        x->child.insert(x->child.begin() + i + 1, z);
    }

    void insertNonFull(BNode* x, int k) {
        int i = lowerIdx(x, k);
        if (x->leaf) { x->keys.insert(x->keys.begin() + i, k); return; }
        if ((int)x->child[i]->keys.size() == 2 * t - 1) {
            splitChild(x, i);
            if (k > x->keys[i]) i++;
        }
        insertNonFull(x->child[i], k);
    }

    bool search(BNode* x, int k) {
        int i = lowerIdx(x, k);
        if (i < (int)x->keys.size() && x->keys[i] == k) return true;
        return x->leaf ? false : search(x->child[i], k);
    }

    // ---------- deletion helpers ----------
    int predecessor(BNode* c) { while (!c->leaf) c = c->child.back(); return c->keys.back(); }
    int successor(BNode* c) { while (!c->leaf) c = c->child.front(); return c->keys.front(); }

    void merge(BNode* x, int i) {                       // merge child[i], key[i], child[i+1] into child[i]
        BNode *c = x->child[i], *s = x->child[i + 1];
        c->keys.push_back(x->keys[i]);
        c->keys.insert(c->keys.end(), s->keys.begin(), s->keys.end());
        if (!c->leaf) c->child.insert(c->child.end(), s->child.begin(), s->child.end());
        x->keys.erase(x->keys.begin() + i);
        x->child.erase(x->child.begin() + i + 1);
        delete s;
    }
    void borrowFromPrev(BNode* x, int i) {
        BNode *c = x->child[i], *s = x->child[i - 1];
        c->keys.insert(c->keys.begin(), x->keys[i - 1]);
        if (!c->leaf) { c->child.insert(c->child.begin(), s->child.back()); s->child.pop_back(); }
        x->keys[i - 1] = s->keys.back();
        s->keys.pop_back();
    }
    void borrowFromNext(BNode* x, int i) {
        BNode *c = x->child[i], *s = x->child[i + 1];
        c->keys.push_back(x->keys[i]);
        if (!c->leaf) { c->child.push_back(s->child.front()); s->child.erase(s->child.begin()); }
        x->keys[i] = s->keys.front();
        s->keys.erase(s->keys.begin());
    }
    void fill(BNode* x, int i) {                        // make child[i] have at least t keys
        if (i > 0 && (int)x->child[i - 1]->keys.size() >= t) borrowFromPrev(x, i);
        else if (i < (int)x->keys.size() && (int)x->child[i + 1]->keys.size() >= t) borrowFromNext(x, i);
        else if (i < (int)x->keys.size()) merge(x, i);
        else merge(x, i - 1);
    }

    void remove(BNode* x, int k) {
        int n = x->keys.size();
        int i = lowerIdx(x, k);
        if (i < n && x->keys[i] == k) {
            if (x->leaf) { x->keys.erase(x->keys.begin() + i); return; }              // case 1
            if ((int)x->child[i]->keys.size() >= t) {                                  // case 2a
                int pred = predecessor(x->child[i]); x->keys[i] = pred; remove(x->child[i], pred);
            } else if ((int)x->child[i + 1]->keys.size() >= t) {                       // case 2b
                int succ = successor(x->child[i + 1]); x->keys[i] = succ; remove(x->child[i + 1], succ);
            } else { merge(x, i); remove(x->child[i], k); }                            // case 2c
        } else {
            if (x->leaf) return;                                                       // not present
            bool wasLast = (i == n);
            if ((int)x->child[i]->keys.size() < t) fill(x, i);                         // case 3
            if (wasLast && i > (int)x->keys.size()) remove(x->child[i - 1], k);        // merged with the left sibling
            else remove(x->child[i], k);
        }
    }

    void destroy(BNode* x) { for (BNode* c : x->child) destroy(c); delete x; }
    void collect(BNode* x, vector<int>& out) {
        for (size_t i = 0; i < x->keys.size(); i++) { if (!x->leaf) collect(x->child[i], out); out.push_back(x->keys[i]); }
        if (!x->leaf) collect(x->child.back(), out);
    }
    int check(BNode* x, bool isRoot, long long lo, long long hi) {    // returns leaf depth or -1 on violation
        int n = x->keys.size();
        if (n > 2 * t - 1 || (!isRoot && n < t - 1) || (isRoot && !x->leaf && n < 1)) return -1;
        for (int i = 0; i < n; i++) {
            if (x->keys[i] <= lo || x->keys[i] >= hi) return -1;
            if (i && x->keys[i - 1] >= x->keys[i]) return -1;
        }
        if (x->leaf) return 0;
        if ((int)x->child.size() != n + 1) return -1;
        int depth = -2;
        for (int i = 0; i <= n; i++) {
            long long l = i ? x->keys[i - 1] : lo, h = i < n ? x->keys[i] : hi;
            int c = check(x->child[i], false, l, h);
            if (c < 0) return -1;
            if (depth == -2) depth = c; else if (depth != c) return -1;   // all leaves at the same depth
        }
        return depth + 1;
    }
    void print(BNode* x, int depth) {
        cout << string(depth * 4, ' ') << "[";
        for (size_t i = 0; i < x->keys.size(); i++) cout << (i ? " " : "") << x->keys[i];
        cout << "]\n";
        for (BNode* c : x->child) print(c, depth + 1);
    }

public:
    BTree(int t) : t(t), root(new BNode(true)) {}
    ~BTree() { destroy(root); }
    bool contains(int k) { return search(root, k); }
    void insert(int k) {
        if (contains(k)) return;
        if ((int)root->keys.size() == 2 * t - 1) {                    // root full: tree grows in height
            BNode* s = new BNode(false);
            s->child.push_back(root);
            root = s;
            splitChild(s, 0);
        }
        insertNonFull(root, k);
    }
    void remove(int k) {
        if (!contains(k)) return;
        remove(root, k);
        if (root->keys.empty() && !root->leaf) { BNode* old = root; root = root->child[0]; delete old; }   // height shrinks
    }
    vector<int> keys() { vector<int> v; collect(root, v); return v; }
    int validDepth() { return check(root, true, LLONG_MIN, LLONG_MAX); }   // -1 = invalid
    void print() { print(root, 0); }
};

int main() {
    BTree small(2);                                       // t = 2: a 2-3-4 tree
    for (int k = 1; k <= 10; k++) small.insert(k);
    cout << "B-tree (t=2) after inserting 1..10:\n";
    small.print();
    small.remove(6); small.remove(1);
    cout << "after deleting 6 and 1:\n";
    small.print();

    for (int t : {2, 3, 8}) {
        BTree bt(t); set<int> ref; mt19937 rng(t);
        bool ok = true;
        for (int i = 0; i < 20000; i++) { int k = rng() % 30000; bt.insert(k); ref.insert(k); }
        ok = ok && bt.validDepth() >= 0;
        for (int i = 0; i < 18000; i++) {
            int k = rng() % 30000;
            bt.remove(k); ref.erase(k);
            if (i % 3000 == 0) ok = ok && bt.validDepth() >= 0;
        }
        vector<int> expect(ref.begin(), ref.end());
        ok = ok && bt.validDepth() >= 0 && bt.keys() == expect;
        cout << "stress test t = " << t << ": matches std::set and all B-tree rules hold -> " << (ok ? "yes" : "NO")
             << " (n = " << expect.size() << ", height = " << bt.validDepth() + 1 << ")\n";
    }
}
