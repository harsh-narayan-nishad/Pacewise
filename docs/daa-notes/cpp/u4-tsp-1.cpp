#include <bits/stdc++.h>
using namespace std;
const int INF = 1e9;

int n;
vector<vector<int>> c;                                          // c[i][j] = cost of going from city i to city j

struct Node { vector<int> path; int mask, cost, bound; };
struct Cmp { bool operator()(const Node& a, const Node& b) const { return a.bound > b.bound; } };

// cheapest edge leaving u towards a city that is still unvisited, or back to the start (city 0)
int minOut(int u, int mask) {
    int m = INF;
    for (int v = 0; v < n; v++) {
        if (v == u) continue;
        bool allowed = !((mask >> v) & 1) || v == 0;
        if (allowed) m = min(m, c[u][v]);
    }
    return m;
}
int lowerBound(const Node& nd) {                                // every remaining tour edge leaves the current city or an unvisited one
    int lb = nd.cost + minOut(nd.path.back(), nd.mask);
    for (int u = 0; u < n; u++) if (!((nd.mask >> u) & 1)) lb += minOut(u, nd.mask);
    return lb;
}

int tspBranchBound(long long& expanded, vector<int>& bestPath) {
    int best = INF;
    priority_queue<Node, vector<Node>, Cmp> pq;                 // least-cost (best-first) search
    Node root{{0}, 1, 0, 0};
    root.bound = lowerBound(root);
    pq.push(root);
    while (!pq.empty()) {
        Node nd = pq.top(); pq.pop();
        if (nd.bound >= best) break;                            // everything left in the queue is at least as bad
        expanded++;
        int cur = nd.path.back();
        if ((int)nd.path.size() == n) {                         // complete tour: add the way back
            int total = nd.cost + c[cur][0];
            if (total < best) { best = total; bestPath = nd.path; }
            continue;
        }
        for (int v = 0; v < n; v++) {
            if ((nd.mask >> v) & 1) continue;
            Node ch = nd;
            ch.path.push_back(v); ch.mask |= 1 << v; ch.cost += c[cur][v];
            ch.bound = lowerBound(ch);
            if (ch.bound < best) pq.push(ch);                   // prune hopeless children immediately
        }
    }
    return best;
}

int heldKarp() {                                                // exact DP, used to verify the answer
    int N = 1 << n;
    vector<vector<int>> dp(N, vector<int>(n, INF));
    dp[1][0] = 0;
    for (int mask = 1; mask < N; mask += 2)                     // masks that contain city 0
        for (int last = 0; last < n; last++) {
            if (!((mask >> last) & 1) || dp[mask][last] >= INF) continue;
            for (int nxt = 1; nxt < n; nxt++) {
                if ((mask >> nxt) & 1) continue;
                dp[mask | (1 << nxt)][nxt] = min(dp[mask | (1 << nxt)][nxt], dp[mask][last] + c[last][nxt]);
            }
        }
    int best = INF;
    for (int last = 1; last < n; last++) best = min(best, dp[N - 1][last] + c[last][0]);
    return best;
}

int main() {
    n = 4;
    c = {{0, 10, 15, 20}, {10, 0, 35, 25}, {15, 35, 0, 30}, {20, 25, 30, 0}};
    long long expanded = 0;
    vector<int> path;
    int best = tspBranchBound(expanded, path);
    cout << "4 cities: optimal tour cost = " << best << ", tour:";
    for (int v : path) cout << ' ' << v;
    cout << " 0   (Held-Karp says " << heldKarp() << ")\n";

    mt19937 rng(10);
    n = 10;
    long long total = 1;                                        // number of partial tours without pruning: sum over k of 9!/(9-k)!
    {
        long long term = 1;
        for (int k = 1; k <= n - 1; k++) { term *= (n - k); total += term; }
    }
    for (int trial = 1; trial <= 4; trial++) {
        c.assign(n, vector<int>(n, INF));
        for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) if (i != j) c[i][j] = 1 + rng() % 100;   // asymmetric costs
        expanded = 0;
        int bb = tspBranchBound(expanded, path), hk = heldKarp();
        cout << "random 10-city instance " << trial << ": branch and bound = " << bb << ", Held-Karp = " << hk
             << (bb == hk ? " (agree)" : " (MISMATCH)") << ", nodes expanded " << expanded << " of " << total << " possible\n";
    }
}
