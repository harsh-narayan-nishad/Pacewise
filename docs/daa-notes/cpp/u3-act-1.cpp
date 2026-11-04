#include <bits/stdc++.h>
using namespace std;

int main() {
    vector<int> s = {1, 3, 0, 5, 3, 5, 6, 8, 8, 2, 12};
    vector<int> f = {4, 5, 6, 7, 9, 9, 10, 11, 12, 14, 16};
    int n = s.size();
    vector<int> idx(n);
    iota(idx.begin(), idx.end(), 0);
    sort(idx.begin(), idx.end(), [&](int a, int b) { return f[a] < f[b]; });   // sort by finish time

    vector<int> chosen = {idx[0]};
    int lastFinish = f[idx[0]];
    for (int k = 1; k < n; k++) {
        int i = idx[k];
        if (s[i] >= lastFinish) { chosen.push_back(i); lastFinish = f[i]; }    // compatible with everything chosen so far
    }
    cout << "selected " << chosen.size() << " activities:";
    for (int i : chosen) cout << " [" << s[i] << "," << f[i] << ")";
    cout << "\n";
}
