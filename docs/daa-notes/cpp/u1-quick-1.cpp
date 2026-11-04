#include <bits/stdc++.h>
using namespace std;
mt19937 rng(12345);

int partitionLomuto(vector<int>& a, int lo, int hi) {      // pivot = a[hi]
    int pivot = a[hi], i = lo - 1;
    for (int j = lo; j < hi; j++)
        if (a[j] <= pivot) swap(a[++i], a[j]);
    swap(a[i + 1], a[hi]);
    return i + 1;                                            // final position of the pivot
}

void quickSort(vector<int>& a, int lo, int hi) {            // randomized quick sort
    if (lo >= hi) return;
    int r = lo + rng() % (hi - lo + 1);                      // random pivot
    swap(a[r], a[hi]);
    int p = partitionLomuto(a, lo, hi);
    quickSort(a, lo, p - 1);
    quickSort(a, p + 1, hi);
}

int partitionHoare(vector<int>& a, int lo, int hi) {        // returns j: sort [lo..j] and [j+1..hi]
    int pivot = a[lo + (hi - lo) / 2], i = lo - 1, j = hi + 1;
    while (true) {
        do i++; while (a[i] < pivot);
        do j--; while (a[j] > pivot);
        if (i >= j) return j;
        swap(a[i], a[j]);
    }
}
void quickSortHoare(vector<int>& a, int lo, int hi) {
    if (lo >= hi) return;
    int p = partitionHoare(a, lo, hi);
    quickSortHoare(a, lo, p);
    quickSortHoare(a, p + 1, hi);
}

int main() {
    vector<int> a = {10, 7, 8, 9, 1, 5, 3, 3, 12, 0};
    vector<int> b = a;
    quickSort(a, 0, (int)a.size() - 1);
    quickSortHoare(b, 0, (int)b.size() - 1);
    for (int x : a) cout << x << ' ';
    cout << "\n(Hoare gives the same: " << (a == b ? "yes" : "NO") << ")\n";

    // stress test against std::sort: random, already sorted, many duplicates
    for (int type = 0; type < 3; type++) {
        vector<int> v(20000);
        for (int i = 0; i < (int)v.size(); i++)
            v[i] = type == 0 ? (int)(rng() % 100000) : type == 1 ? i : (int)(rng() % 10);
        vector<int> expect = v, w = v;
        sort(expect.begin(), expect.end());
        quickSort(v, 0, (int)v.size() - 1);
        quickSortHoare(w, 0, (int)w.size() - 1);
        cout << (type == 0 ? "random   " : type == 1 ? "sorted   " : "duplicates") << " -> "
             << (v == expect && w == expect ? "correct" : "WRONG") << "\n";
    }
}
