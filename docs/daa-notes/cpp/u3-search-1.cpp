#include <bits/stdc++.h>
using namespace std;

// ---- binary search, recursive divide and conquer form ----
int binarySearch(const vector<int>& a, int lo, int hi, int key) {
    if (lo > hi) return -1;                                   // empty range: not found
    int mid = lo + (hi - lo) / 2;
    if (a[mid] == key) return mid;
    return a[mid] < key ? binarySearch(a, mid + 1, hi, key) : binarySearch(a, lo, mid - 1, key);
}
// first index with a[i] >= key (a "lower bound"): the form used most often in practice
int lowerBound(const vector<int>& a, int key) {
    int lo = 0, hi = (int)a.size();
    while (lo < hi) { int mid = lo + (hi - lo) / 2; if (a[mid] < key) lo = mid + 1; else hi = mid; }
    return lo;
}

// ---- maximum subarray, divide and conquer ----
struct Info { long long best, prefix, suffix, total; };
Info solve(const vector<int>& a, int l, int r) {
    if (l == r) return {a[l], a[l], a[l], a[l]};
    int m = (l + r) / 2;
    Info L = solve(a, l, m), R = solve(a, m + 1, r), res;
    res.total = L.total + R.total;
    res.prefix = max(L.prefix, L.total + R.prefix);
    res.suffix = max(R.suffix, R.total + L.suffix);
    res.best = max({L.best, R.best, L.suffix + R.prefix});    // third option: the subarray crosses the middle
    return res;
}
long long kadane(const vector<int>& a) {
    long long best = a[0], cur = a[0];
    for (size_t i = 1; i < a.size(); i++) { cur = max<long long>(a[i], cur + a[i]); best = max(best, cur); }
    return best;
}

int main() {
    vector<int> s = {2, 5, 8, 12, 16, 23, 38, 56, 72, 91};
    cout << "binarySearch(23) -> index " << binarySearch(s, 0, (int)s.size() - 1, 23)
         << ", binarySearch(24) -> " << binarySearch(s, 0, (int)s.size() - 1, 24)
         << ", lowerBound(24) -> " << lowerBound(s, 24) << "\n";

    vector<int> a = {13, -3, -25, 20, -3, -16, -23, 18, 20, -7, 12, -5, -22, 15, -4, 7};
    cout << "max subarray sum: divide and conquer = " << solve(a, 0, (int)a.size() - 1).best
         << ", Kadane = " << kadane(a) << "\n";

    mt19937 rng(9);                                           // quick randomized agreement test
    bool ok = true;
    for (int t = 0; t < 500; t++) {
        vector<int> v(1 + rng() % 40);
        for (int& x : v) x = (int)(rng() % 41) - 20;
        ok = ok && solve(v, 0, (int)v.size() - 1).best == kadane(v);
    }
    cout << "500 random arrays agree: " << (ok ? "yes" : "NO") << "\n";
}
