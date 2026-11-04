#include <bits/stdc++.h>
using namespace std;

int linearSearch(const vector<int>& a, int key, long long& cmp) {
    for (size_t i = 0; i < a.size(); i++) { cmp++; if (a[i] == key) return (int)i; }
    return -1;
}
int binarySearch(const vector<int>& a, int key, long long& cmp) {   // a must be sorted
    int lo = 0, hi = (int)a.size() - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        cmp++;
        if (a[mid] == key) return mid;
        if (a[mid] < key) lo = mid + 1; else hi = mid - 1;
    }
    return -1;
}
int main() {
    for (int n : {1000, 1000000}) {
        vector<int> a(n);
        iota(a.begin(), a.end(), 0);
        long long c1 = 0, c2 = 0;
        linearSearch(a, n, c1);          // worst case: key absent
        binarySearch(a, n, c2);
        cout << "n = " << n << "   linear: " << c1 << " comparisons   binary: " << c2 << " comparisons\n";
    }
}
