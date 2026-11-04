#include <bits/stdc++.h>
using namespace std;

vector<int> countingSort(const vector<int>& a, int k) {          // keys in 0..k, stable
    vector<int> cnt(k + 2, 0), out(a.size());
    for (int x : a) cnt[x + 1]++;
    for (int i = 1; i <= k + 1; i++) cnt[i] += cnt[i - 1];       // cnt[x] = number of keys smaller than x = start index of x
    for (int x : a) out[cnt[x]++] = x;
    return out;
}

void radixSort(vector<int>& a) {                                  // non-negative ints, base 10, LSD first
    int mx = *max_element(a.begin(), a.end());
    vector<int> out(a.size());
    for (long long exp = 1; mx / exp > 0; exp *= 10) {
        int cnt[10] = {0};
        for (int x : a) cnt[(x / exp) % 10]++;
        for (int d = 1; d < 10; d++) cnt[d] += cnt[d - 1];
        for (int i = (int)a.size() - 1; i >= 0; i--)              // backwards => stable
            out[--cnt[(a[i] / exp) % 10]] = a[i];
        a = out;
    }
}

void bucketSort(vector<double>& a) {                              // values in [0,1)
    int n = a.size();
    vector<vector<double>> bucket(n);
    for (double x : a) bucket[(int)(n * x)].push_back(x);
    int idx = 0;
    for (auto& b : bucket) {
        sort(b.begin(), b.end());                                 // textbook: insertion sort inside the bucket
        for (double x : b) a[idx++] = x;
    }
}

int main() {
    vector<int> a = {4, 2, 2, 8, 3, 3, 1, 0, 7, 7};
    for (int x : countingSort(a, 8)) cout << x << ' ';
    cout << "  <- counting sort\n";

    vector<int> r = {170, 45, 75, 90, 802, 24, 2, 66};
    radixSort(r);
    for (int x : r) cout << x << ' ';
    cout << "  <- radix sort\n";

    vector<double> b = {0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68};
    bucketSort(b);
    for (double x : b) cout << x << ' ';
    cout << "  <- bucket sort\n";
}
