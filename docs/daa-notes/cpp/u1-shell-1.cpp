#include <bits/stdc++.h>
using namespace std;

// Shell sort with Shell's original gaps n/2, n/4, ..., 1
void shellSort(vector<int>& a) {
    int n = a.size();
    for (int gap = n / 2; gap > 0; gap /= 2) {
        for (int i = gap; i < n; i++) {                     // gapped insertion sort
            int temp = a[i], j = i;
            while (j >= gap && a[j - gap] > temp) { a[j] = a[j - gap]; j -= gap; }
            a[j] = temp;
        }
    }
}

// Knuth's gaps 1, 4, 13, 40, ... (gap = 3*gap + 1) give O(n^1.5)
void shellSortKnuth(vector<int>& a) {
    int n = a.size(), gap = 1;
    while (gap < n / 3) gap = 3 * gap + 1;
    for (; gap >= 1; gap /= 3) {
        for (int i = gap; i < n; i++) {
            int temp = a[i], j = i;
            while (j >= gap && a[j - gap] > temp) { a[j] = a[j - gap]; j -= gap; }
            a[j] = temp;
        }
    }
}

int main() {
    vector<int> a = {64, 25, 12, 22, 11, 90, 5, 43, 77, 1};
    vector<int> b = a;
    shellSort(a);
    shellSortKnuth(b);
    for (int x : a) cout << x << ' ';
    cout << '\n' << (a == b ? "both gap sequences give the same sorted array" : "BUG") << '\n';
}
