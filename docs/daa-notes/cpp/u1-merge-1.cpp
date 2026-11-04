#include <bits/stdc++.h>
using namespace std;

void mergeHalves(vector<int>& a, int l, int m, int r, vector<int>& tmp) {   // merge a[l..m] and a[m+1..r]
    int i = l, j = m + 1, k = l;
    while (i <= m && j <= r) tmp[k++] = (a[i] <= a[j]) ? a[i++] : a[j++];   // <= keeps it stable
    while (i <= m) tmp[k++] = a[i++];
    while (j <= r) tmp[k++] = a[j++];
    for (k = l; k <= r; k++) a[k] = tmp[k];
}

void mergeSort(vector<int>& a, int l, int r, vector<int>& tmp) {
    if (l >= r) return;
    int m = l + (r - l) / 2;
    mergeSort(a, l, m, tmp);
    mergeSort(a, m + 1, r, tmp);
    mergeHalves(a, l, m, r, tmp);
}

// bonus: count inversions (pairs i<j with a[i]>a[j]) while merge sorting
long long countInv(vector<int>& a, int l, int r, vector<int>& tmp) {
    if (l >= r) return 0;
    int m = l + (r - l) / 2;
    long long inv = countInv(a, l, m, tmp) + countInv(a, m + 1, r, tmp);
    int i = l, j = m + 1, k = l;
    while (i <= m && j <= r) {
        if (a[i] <= a[j]) tmp[k++] = a[i++];
        else { tmp[k++] = a[j++]; inv += m - i + 1; }        // a[i..m] are all greater than a[j]
    }
    while (i <= m) tmp[k++] = a[i++];
    while (j <= r) tmp[k++] = a[j++];
    for (k = l; k <= r; k++) a[k] = tmp[k];
    return inv;
}

int main() {
    vector<int> a = {38, 27, 43, 3, 9, 82, 10};
    vector<int> tmp(a.size());
    vector<int> c = a, tmp2(a.size());
    mergeSort(a, 0, (int)a.size() - 1, tmp);
    for (int x : a) cout << x << ' ';
    cout << "\ninversions in the original array: " << countInv(c, 0, (int)c.size() - 1, tmp2) << "\n";
}
