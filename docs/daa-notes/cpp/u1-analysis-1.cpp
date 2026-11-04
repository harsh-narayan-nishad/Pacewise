#include <bits/stdc++.h>
using namespace std;

long long insertionSort(vector<int> a) {          // returns the number of key comparisons
    long long cmp = 0;
    for (size_t i = 1; i < a.size(); i++) {
        int key = a[i];
        int j = (int)i - 1;
        while (j >= 0) {
            cmp++;
            if (a[j] > key) { a[j + 1] = a[j]; j--; }
            else break;
        }
        a[j + 1] = key;
    }
    return cmp;
}

int main() {
    int n = 1000;
    vector<int> best(n), worst(n), avg(n);
    iota(best.begin(), best.end(), 1);
    iota(worst.rbegin(), worst.rend(), 1);
    iota(avg.begin(), avg.end(), 1);
    mt19937 rng(42);
    shuffle(avg.begin(), avg.end(), rng);
    cout << "n = " << n << "\n";
    cout << "best    (sorted)   : " << insertionSort(best)  << "  (n-1 = " << n - 1 << ")\n";
    cout << "worst   (reversed) : " << insertionSort(worst) << "  (n(n-1)/2 = " << (long long)n * (n - 1) / 2 << ")\n";
    cout << "average (random)   : " << insertionSort(avg)   << "  (about n^2/4 = " << (long long)n * n / 4 << ")\n";
}
