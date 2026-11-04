#include <bits/stdc++.h>
using namespace std;
using Clock = chrono::steady_clock;

void shellSort(vector<int>& a) {
    for (int gap = a.size() / 2; gap > 0; gap /= 2)
        for (int i = gap; i < (int)a.size(); i++) {
            int t = a[i], j = i;
            while (j >= gap && a[j - gap] > t) { a[j] = a[j - gap]; j -= gap; }
            a[j] = t;
        }
}
void mergeSortRec(vector<int>& a, vector<int>& tmp, int l, int r) {
    if (r - l < 1) return;
    int m = (l + r) / 2;
    mergeSortRec(a, tmp, l, m); mergeSortRec(a, tmp, m + 1, r);
    merge(a.begin() + l, a.begin() + m + 1, a.begin() + m + 1, a.begin() + r + 1, tmp.begin() + l);
    copy(tmp.begin() + l, tmp.begin() + r + 1, a.begin() + l);
}
void mergeSortAlgo(vector<int>& a) { vector<int> tmp(a.size()); mergeSortRec(a, tmp, 0, (int)a.size() - 1); }
void quickSortRec(vector<int>& a, int lo, int hi, mt19937& rng) {
    while (lo < hi) {
        swap(a[lo + rng() % (hi - lo + 1)], a[hi]);
        int p = a[hi], i = lo - 1;
        for (int j = lo; j < hi; j++) if (a[j] <= p) swap(a[++i], a[j]);
        swap(a[i + 1], a[hi]);
        if (i + 1 - lo < hi - (i + 1)) { quickSortRec(a, lo, i, rng); lo = i + 2; }   // recurse on the smaller part
        else { quickSortRec(a, i + 2, hi, rng); hi = i; }
    }
}
void quickSortAlgo(vector<int>& a) { mt19937 rng(1); quickSortRec(a, 0, (int)a.size() - 1, rng); }
void heapSortAlgo(vector<int>& a) { make_heap(a.begin(), a.end()); sort_heap(a.begin(), a.end()); }
void stdSortAlgo(vector<int>& a) { sort(a.begin(), a.end()); }

template <class F> double timeIt(F f, vector<int> data) {          // data is copied: same input for everyone
    auto t0 = Clock::now();
    f(data);
    auto t1 = Clock::now();
    if (!is_sorted(data.begin(), data.end())) cerr << "NOT SORTED!\n";
    return chrono::duration<double, milli>(t1 - t0).count();
}

int main() {
    mt19937 rng(2024);
    cout << fixed << setprecision(2);
    cout << setw(9) << "n" << setw(10) << "shell" << setw(10) << "merge" << setw(10) << "quick"
         << setw(10) << "heap" << setw(10) << "std::sort" << "   (milliseconds)\n";
    for (int n = 25000; n <= 400000; n *= 2) {
        vector<int> data(n);
        for (int& x : data) x = rng();
        cout << setw(9) << n << setw(10) << timeIt(shellSort, data) << setw(10) << timeIt(mergeSortAlgo, data)
             << setw(10) << timeIt(quickSortAlgo, data) << setw(10) << timeIt(heapSortAlgo, data)
             << setw(10) << timeIt(stdSortAlgo, data) << "\n";
    }
}
