#include <bits/stdc++.h>
using namespace std;

enum Color { RED, BLACK };
struct Node {
    int key;
    Color color;
    Node *left, *right, *parent;
};

class RBTree {
    Node *NIL, *root;                                   // NIL = shared black sentinel for all leaves

    void leftRotate(Node* x) {
        Node* y = x->right;
        x->right = y->left;
        if (y->left != NIL) y->left->parent = x;
        y->parent = x->parent;
        if (x->parent == NIL) root = y;
        else if (x == x->parent->left) x->parent->left = y;
        else x->parent->right = y;
        y->left = x;
        x->parent = y;
    }
    void rightRotate(Node* x) {
        Node* y = x->left;
        x->left = y->right;
        if (y->right != NIL) y->right->parent = x;
        y->parent = x->parent;
        if (x->parent == NIL) root = y;
        else if (x == x->parent->right) x->parent->right = y;
        else x->parent->left = y;
        y->right = x;
        x->parent = y;
    }

    void insertFixup(Node* z) {
        while (z->parent->color == RED) {
            Node* g = z->parent->parent;
            if (z->parent == g->left) {
                Node* uncle = g->right;
                if (uncle->color == RED) {                         // case 1: recolour
                    z->parent->color = BLACK; uncle->color = BLACK; g->color = RED;
                    z = g;
                } else {
                    if (z == z->parent->right) { z = z->parent; leftRotate(z); }   // case 2 -> 3
                    z->parent->color = BLACK;                      // case 3
                    z->parent->parent->color = RED;
                    rightRotate(z->parent->parent);
                }
            } else {                                               // mirror image
                Node* uncle = g->left;
                if (uncle->color == RED) {
                    z->parent->color = BLACK; uncle->color = BLACK; g->color = RED;
                    z = g;
                } else {
                    if (z == z->parent->left) { z = z->parent; rightRotate(z); }
                    z->parent->color = BLACK;
                    z->parent->parent->color = RED;
                    leftRotate(z->parent->parent);
                }
            }
        }
        root->color = BLACK;
    }

    void transplant(Node* u, Node* v) {                            // replace subtree u by subtree v
        if (u->parent == NIL) root = v;
        else if (u == u->parent->left) u->parent->left = v;
        else u->parent->right = v;
        v->parent = u->parent;                                     // allowed even when v == NIL
    }
    Node* minimum(Node* x) { while (x->left != NIL) x = x->left; return x; }

    void deleteFixup(Node* x) {
        while (x != root && x->color == BLACK) {
            if (x == x->parent->left) {
                Node* w = x->parent->right;
                if (w->color == RED) {                             // case 1
                    w->color = BLACK; x->parent->color = RED;
                    leftRotate(x->parent); w = x->parent->right;
                }
                if (w->left->color == BLACK && w->right->color == BLACK) {   // case 2
                    w->color = RED; x = x->parent;
                } else {
                    if (w->right->color == BLACK) {                // case 3
                        w->left->color = BLACK; w->color = RED;
                        rightRotate(w); w = x->parent->right;
                    }
                    w->color = x->parent->color;                   // case 4
                    x->parent->color = BLACK; w->right->color = BLACK;
                    leftRotate(x->parent);
                    x = root;
                }
            } else {                                               // mirror image
                Node* w = x->parent->left;
                if (w->color == RED) {
                    w->color = BLACK; x->parent->color = RED;
                    rightRotate(x->parent); w = x->parent->left;
                }
                if (w->right->color == BLACK && w->left->color == BLACK) {
                    w->color = RED; x = x->parent;
                } else {
                    if (w->left->color == BLACK) {
                        w->right->color = BLACK; w->color = RED;
                        leftRotate(w); w = x->parent->left;
                    }
                    w->color = x->parent->color;
                    x->parent->color = BLACK; w->left->color = BLACK;
                    rightRotate(x->parent);
                    x = root;
                }
            }
        }
        x->color = BLACK;
    }

    Node* find(int key) {
        Node* x = root;
        while (x != NIL && x->key != key) x = key < x->key ? x->left : x->right;
        return x;
    }
    void destroy(Node* x) { if (x == NIL) return; destroy(x->left); destroy(x->right); delete x; }
    void collect(Node* x, vector<int>& out) { if (x == NIL) return; collect(x->left, out); out.push_back(x->key); collect(x->right, out); }
    int heightOf(Node* x) { return x == NIL ? 0 : 1 + max(heightOf(x->left), heightOf(x->right)); }
    int check(Node* x, long long lo, long long hi) {               // returns black-height, or -1 on a violation
        if (x == NIL) return 1;
        if (x->key <= lo || x->key >= hi) return -1;               // BST order
        if (x->color == RED && (x->left->color == RED || x->right->color == RED)) return -1;   // property 4
        int l = check(x->left, lo, x->key), r = check(x->right, x->key, hi);
        if (l < 0 || r < 0 || l != r) return -1;                   // property 5
        return l + (x->color == BLACK ? 1 : 0);
    }

public:
    RBTree() {
        NIL = new Node{0, BLACK, nullptr, nullptr, nullptr};
        NIL->left = NIL->right = NIL->parent = NIL;
        root = NIL;
    }
    ~RBTree() { destroy(root); delete NIL; }

    bool contains(int key) { return find(key) != NIL; }

    void insert(int key) {
        if (contains(key)) return;                                 // no duplicates in this version
        Node* z = new Node{key, RED, NIL, NIL, NIL};
        Node *y = NIL, *x = root;
        while (x != NIL) { y = x; x = key < x->key ? x->left : x->right; }
        z->parent = y;
        if (y == NIL) root = z;
        else if (key < y->key) y->left = z;
        else y->right = z;
        insertFixup(z);
    }

    void remove(int key) {
        Node* z = find(key);
        if (z == NIL) return;
        Node* y = z;
        Color yOriginal = y->color;
        Node* x;
        if (z->left == NIL) { x = z->right; transplant(z, z->right); }
        else if (z->right == NIL) { x = z->left; transplant(z, z->left); }
        else {                                                     // two children: use the successor
            y = minimum(z->right);
            yOriginal = y->color;
            x = y->right;
            if (y->parent == z) x->parent = y;
            else { transplant(y, y->right); y->right = z->right; y->right->parent = y; }
            transplant(z, y);
            y->left = z->left; y->left->parent = y;
            y->color = z->color;
        }
        delete z;
        if (yOriginal == BLACK) deleteFixup(x);
    }

    vector<int> keys() { vector<int> v; collect(root, v); return v; }
    int height() { return heightOf(root); }
    int blackHeight() { return root->color == BLACK ? check(root, LLONG_MIN, LLONG_MAX) : -1; }   // -1 = invalid
};

int main() {
    RBTree t;
    for (int k : {10, 20, 30, 15, 25, 5, 1, 12, 18}) t.insert(k);
    cout << "inorder: ";
    for (int k : t.keys()) cout << k << ' ';
    cout << "\nvalid red-black tree? " << (t.blackHeight() > 0 ? "yes" : "NO") << ", black-height = " << t.blackHeight() << "\n";

    RBTree seq;                                                    // worst case for a plain BST: sorted input
    for (int i = 1; i <= 1000; i++) seq.insert(i);
    cout << "1000 sorted inserts -> height " << seq.height() << " (plain BST would be 1000, bound 2*log2(1001) = "
         << 2 * log2(1001.0) << ")\n";

    RBTree big; set<int> ref; mt19937 rng(1);
    for (int i = 0; i < 20000; i++) { int k = rng() % 50000; big.insert(k); ref.insert(k); }
    bool ok = big.blackHeight() > 0;
    for (int i = 0; i < 15000; i++) {                              // random deletions, validate along the way
        int k = rng() % 50000;
        big.remove(k); ref.erase(k);
        if (i % 3000 == 0) ok = ok && big.blackHeight() > 0;
    }
    vector<int> expect(ref.begin(), ref.end());
    ok = ok && big.blackHeight() > 0 && big.keys() == expect;
    cout << "20000 inserts + 15000 deletes, matches std::set and keeps all 5 properties: " << (ok ? "yes" : "NO")
         << " (n = " << expect.size() << ", height = " << big.height() << ")\n";
}
