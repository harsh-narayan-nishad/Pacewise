#include <bits/stdc++.h>
using namespace std;

// ---- expected linear time: randomized quickselect, k-th smallest (k starts at 1) ----
int quickSelect(vector<int> a, int k) {
    mt19937 rng(7);
    int lo = 0, hi = (int)a.size() - 1;
    while (true) {
        if (lo == hi) return a[lo];
        int r = lo + rng() % (hi - lo + 1);
        swap(a[r], a[hi]);
        int pivot = a[hi], i = lo - 1;
        for (int j = lo; j < hi; j++) if (a[j] < pivot) swap(a[++i], a[j]);
        swap(a[i + 1], a[hi]);
        int p = i + 1;
        if (p == k - 1) return a[p];
        if (p > k - 1) hi = p - 1; else lo = p + 1;
    }
}

// ---- worst-case linear time: median of medians (assumes distinct keys for the guarantee) ----
int partitionAround(vector<int>& a, int lo, int hi, int pivotVal) {
    for (int i = lo; i <= hi; i++) if (a[i] == pivotVal) { swap(a[i], a[hi]); break; }
    int i = lo - 1;
    for (int j = lo; j < hi; j++) if (a[j] < pivotVal) swap(a[++i], a[j]);
    swap(a[i + 1], a[hi]);
    return i + 1;
}
int selectMoM(vector<int>& a, int lo, int hi, int k) {       // k-th smallest (0-based) inside a[lo..hi]
    int n = hi - lo + 1;
    if (n <= 5) { sort(a.begin() + lo, a.begin() + hi + 1); return a[lo + k]; }
    vector<int> medians;
    for (int i = lo; i <= hi; i += 5) {                      // median of every group of 5
        int r = min(i + 4, hi);
        sort(a.begin() + i, a.begin() + r + 1);
        medians.push_back(a[i + (r - i) / 2]);
    }
    int mom = selectMoM(medians, 0, (int)medians.size() - 1, ((int)medians.size() - 1) / 2);
    int p = partitionAround(a, lo, hi, mom);
    int rank = p - lo;
    if (k == rank) return a[p];
    if (k < rank) return selectMoM(a, lo, p - 1, k);
    return selectMoM(a, p + 1, hi, k - rank - 1);
}

// ---- min and max together in about 3n/2 comparisons ----
pair<int, int> minMax(const vector<int>& a) {
    int n = a.size(), mn, mx, i;
    if (n % 2) { mn = mx = a[0]; i = 1; }
    else { mn = min(a[0], a[1]); mx = max(a[0], a[1]); i = 2; }
    for (; i + 1 < n; i += 2) {
        int lo = a[i], hi = a[i + 1];
        if (lo > hi) swap(lo, hi);                           // 1 comparison for the pair
        mn = min(mn, lo);                                    // 1 comparison
        mx = max(mx, hi);                                    // 1 comparison
    }
    return {mn, mx};
}

int main() {
    vector<int> a(1000);
    iota(a.begin(), a.end(), 1);
    mt19937 rng(5);
    shuffle(a.begin(), a.end(), rng);
    vector<int> sorted = a;
    sort(sorted.begin(), sorted.end());
    bool ok = true;
    for (int k : {1, 2, 10, 500, 999, 1000}) {
        vector<int> copy = a;
        int q = quickSelect(a, k), m = selectMoM(copy, 0, (int)copy.size() - 1, k - 1);
        ok = ok && q == sorted[k - 1] && m == sorted[k - 1];
        cout << "k = " << setw(4) << k << "  quickselect = " << setw(4) << q << "  median-of-medians = " << setw(4) << m << "\n";
    }
    auto [mn, mx] = minMax(a);
    cout << "min = " << mn << ", max = " << mx << "\nall answers match the sorted array: " << (ok ? "yes" : "NO") << "\n";
}
