#include <bits/stdc++.h>
using namespace std;

struct DynArray {
    int* data = new int[1];
    int size = 0, cap = 1;
    long long copies = 0;                       // number of element copies during resizing
    DynArray() = default;
    DynArray(const DynArray&) = delete;
    DynArray& operator=(const DynArray&) = delete;
    ~DynArray() { delete[] data; }
    void push(int x) {
        if (size == cap) {                      // full: double the capacity
            int* nd = new int[cap * 2];
            for (int i = 0; i < size; i++) { nd[i] = data[i]; copies++; }
            delete[] data; data = nd; cap *= 2;
        }
        data[size++] = x;
    }
};

int main() {
    DynArray d;
    int n = 1 << 20;
    for (int i = 0; i < n; i++) d.push(i);
    cout << "pushes = " << n << ", element copies = " << d.copies << "\n";
    cout << "copies per push = " << (double)d.copies / n << "  (< 1, so push is O(1) amortized)\n";
}
