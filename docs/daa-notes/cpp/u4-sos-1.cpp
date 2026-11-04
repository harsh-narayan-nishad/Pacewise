#include <bits/stdc++.h>
using namespace std;

vector<int> w, chosen;
int M, n;
long long visited;

void solve(int i, int sum, int remaining) {                       // remaining = w[i] + w[i+1] + ... + w[n-1]
    visited++;
    if (sum == M) {                                               // weights are positive: nothing more can be added
        cout << "  {";
        for (size_t k = 0; k < chosen.size(); k++) cout << (k ? ", " : "") << chosen[k];
        cout << "}\n";
        return;
    }
    if (i == n || sum + remaining < M || sum + w[i] > M) return;  // bounding: too small overall, or w[i] (and all later ones) too big
    chosen.push_back(w[i]);                                       // include w[i]
    solve(i + 1, sum + w[i], remaining - w[i]);
    chosen.pop_back();                                            // exclude w[i]
    solve(i + 1, sum, remaining - w[i]);
}

int main() {
    w = {5, 10, 12, 13, 15, 18};                                  // sorted ascending (needed for the pruning rule)
    M = 30;
    n = w.size();
    cout << "subsets of {5,10,12,13,15,18} with sum 30:\n";
    solve(0, 0, accumulate(w.begin(), w.end(), 0));
    cout << "state-space nodes visited: " << visited << " (the full tree has " << (1 << (n + 1)) - 1 << ")\n";
}
