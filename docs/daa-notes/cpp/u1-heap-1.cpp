#include <bits/stdc++.h>
using namespace std;

void heapify(vector<int>& a, int n, int i) {                 // sift-down in a max-heap of size n
    while (true) {
        int largest = i, l = 2 * i + 1, r = 2 * i + 2;
        if (l < n && a[l] > a[largest]) largest = l;
        if (r < n && a[r] > a[largest]) largest = r;
        if (largest == i) return;
        swap(a[i], a[largest]);
        i = largest;
    }
}

void buildMaxHeap(vector<int>& a) {
    for (int i = (int)a.size() / 2 - 1; i >= 0; i--) heapify(a, a.size(), i);   // O(n)
}

void heapSort(vector<int>& a) {
    buildMaxHeap(a);
    for (int end = (int)a.size() - 1; end > 0; end--) {
        swap(a[0], a[end]);                                  // move current maximum to its final place
        heapify(a, end, 0);                                  // restore heap on a[0..end-1]
    }
}

int main() {
    vector<int> a = {4, 10, 3, 5, 1, 8, 7, 9, 2, 6};
    vector<int> h = a;
    buildMaxHeap(h);
    cout << "max-heap array : ";
    for (int x : h) cout << x << ' ';
    heapSort(a);
    cout << "\nsorted         : ";
    for (int x : a) cout << x << ' ';
    cout << '\n';
}
