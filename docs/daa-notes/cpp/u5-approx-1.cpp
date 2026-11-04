#include <bits/stdc++.h>
using namespace std;

vector<int> approxVertexCover(int n, const vector<pair<int, int>>& edges) {
    vector<bool> inCover(n, false);
    for (auto [u, v] : edges)
        if (!inCover[u] && !inCover[v]) { inCover[u] = inCover[v] = true; }   // take BOTH endpoints of an uncovered edge
    vector<int> cover;
    for (int i = 0; i < n; i++) if (inCover[i]) cover.push_back(i);
    return cover;
}

int optimalVertexCover(int n, const vector<pair<int, int>>& edges) {          // brute force over all subsets
    int best = n;
    for (int S = 0; S < (1 << n); S++) {
        bool ok = true;
        for (auto [u, v] : edges) if (!(S >> u & 1) && !(S >> v & 1)) { ok = false; break; }
        if (ok) best = min(best, __builtin_popcount(S));
    }
    return best;
}

int main() {
    // star plus path: 0-1, 0-2, 0-3, 0-4, 4-5, 5-6
    vector<pair<int, int>> e = {{0, 1}, {0, 2}, {0, 3}, {0, 4}, {4, 5}, {5, 6}};
    auto c = approxVertexCover(7, e);
    cout << "approximate cover:";
    for (int v : c) cout << ' ' << v;
    cout << "  (size " << c.size() << "), optimum = " << optimalVertexCover(7, e) << "\n";

    mt19937 rng(31);
    double worst = 1.0;
    bool valid = true;
    for (int t = 0; t < 500; t++) {
        int n = 4 + rng() % 9;
        vector<pair<int, int>> edges;
        for (int i = 0; i < n; i++) for (int j = i + 1; j < n; j++) if (rng() % 100 < 30) edges.push_back({i, j});
        if (edges.empty()) continue;
        auto cover = approxVertexCover(n, edges);
        vector<bool> in(n, false);
        for (int v : cover) in[v] = true;
        for (auto [u, v] : edges) valid = valid && (in[u] || in[v]);          // really a cover?
        worst = max(worst, (double)cover.size() / optimalVertexCover(n, edges));
    }
    cout << "500 random graphs: always a valid cover = " << (valid ? "yes" : "NO") << ", worst size ratio to the optimum = " << worst << " (guarantee: at most 2)\n";
}
