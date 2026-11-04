#include <bits/stdc++.h>
using namespace std;

int n;
vector<vector<double>> dist;

double tourCost(const vector<int>& t) {
    double s = 0;
    for (size_t i = 0; i < t.size(); i++) s += dist[t[i]][t[(i + 1) % t.size()]];
    return s;
}

vector<int> mstApproxTour() {                                      // 2-approximation for metric TSP
    vector<int> parent(n, -1);
    vector<double> key(n, 1e18);
    vector<bool> in(n, false);
    key[0] = 0;
    for (int it = 0; it < n; it++) {                               // Prim, O(n^2)
        int u = -1;
        for (int v = 0; v < n; v++) if (!in[v] && (u < 0 || key[v] < key[u])) u = v;
        in[u] = true;
        for (int v = 0; v < n; v++) if (!in[v] && dist[u][v] < key[v]) { key[v] = dist[u][v]; parent[v] = u; }
    }
    vector<vector<int>> children(n);
    for (int v = 1; v < n; v++) children[parent[v]].push_back(v);
    vector<int> tour;
    function<void(int)> preorder = [&](int u) { tour.push_back(u); for (int c : children[u]) preorder(c); };   // preorder walk = shortcut tour
    preorder(0);
    return tour;
}

double heldKarp() {                                                // exact optimum for the comparison
    int N = 1 << n;
    vector<vector<double>> dp(N, vector<double>(n, 1e18));
    dp[1][0] = 0;
    for (int mask = 1; mask < N; mask += 2)
        for (int last = 0; last < n; last++) {
            if (!(mask >> last & 1) || dp[mask][last] >= 1e17) continue;
            for (int nx = 1; nx < n; nx++) if (!(mask >> nx & 1))
                dp[mask | 1 << nx][nx] = min(dp[mask | 1 << nx][nx], dp[mask][last] + dist[last][nx]);
        }
    double best = 1e18;
    for (int last = 1; last < n; last++) best = min(best, dp[N - 1][last] + dist[last][0]);
    return best;
}

int main() {
    mt19937 rng(17);
    n = 10;
    cout << fixed << setprecision(2);
    double worst = 0;
    for (int trial = 1; trial <= 8; trial++) {
        vector<pair<double, double>> pt(n);
        for (auto& p : pt) p = {(double)(rng() % 1000) / 10, (double)(rng() % 1000) / 10};
        dist.assign(n, vector<double>(n));
        for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) dist[i][j] = hypot(pt[i].first - pt[j].first, pt[i].second - pt[j].second);   // Euclidean: triangle inequality holds
        double approx = tourCost(mstApproxTour()), opt = heldKarp();
        worst = max(worst, approx / opt);
        cout << "instance " << trial << ": MST-approximation tour = " << setw(7) << approx << ", optimal = " << setw(7) << opt
             << ", ratio = " << approx / opt << "\n";
    }
    cout << "largest ratio seen: " << worst << " (guarantee: at most 2)\n";
}
