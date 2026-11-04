#include <bits/stdc++.h>
using namespace std;
typedef pair<int, int> pii;

// ---------------- Prim: priority queue version ----------------
int prim(const vector<vector<pii>>& g, vector<pair<int, int>>& edgesOut) {
    int n = g.size(), total = 0;
    vector<int> key(n, INT_MAX), parent(n, -1);
    vector<bool> inTree(n, false);
    priority_queue<pii, vector<pii>, greater<pii>> pq;           // (key, vertex)
    key[0] = 0;
    pq.push({0, 0});
    while (!pq.empty()) {
        auto [k, u] = pq.top(); pq.pop();
        if (inTree[u]) continue;
        inTree[u] = true;
        total += k;
        if (parent[u] >= 0) edgesOut.push_back({parent[u], u});
        for (auto [v, w] : g[u])
            if (!inTree[v] && w < key[v]) { key[v] = w; parent[v] = u; pq.push({w, v}); }
    }
    return total;
}

// ---------------- Kruskal with union-find ----------------
struct DSU {
    vector<int> p, rnk;
    DSU(int n) : p(n), rnk(n, 0) { iota(p.begin(), p.end(), 0); }
    int find(int x) { return p[x] == x ? x : p[x] = find(p[x]); }       // path compression
    bool unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return false;                                       // already connected: edge would make a cycle
        if (rnk[a] < rnk[b]) swap(a, b);
        p[b] = a;                                                       // union by rank
        if (rnk[a] == rnk[b]) rnk[a]++;
        return true;
    }
};
struct Edge { int u, v, w; };
int kruskal(int n, vector<Edge> edges, vector<Edge>& used) {
    sort(edges.begin(), edges.end(), [](const Edge& a, const Edge& b) { return a.w < b.w; });
    DSU dsu(n);
    int total = 0;
    for (const Edge& e : edges)
        if (dsu.unite(e.u, e.v)) { total += e.w; used.push_back(e); }
    return total;
}

int main() {
    int n = 6;
    vector<Edge> edges = {{0, 1, 4}, {0, 2, 3}, {1, 2, 1}, {1, 3, 2}, {2, 3, 4}, {3, 4, 2}, {4, 5, 6}};
    vector<vector<pii>> g(n);
    for (auto& e : edges) { g[e.u].push_back({e.v, e.w}); g[e.v].push_back({e.u, e.w}); }

    vector<pair<int, int>> pe;
    int wp = prim(g, pe);
    cout << "Prim    : weight " << wp << ", edges:";
    for (auto [a, b] : pe) cout << " " << a << "-" << b;
    vector<Edge> ke;
    int wk = kruskal(n, edges, ke);
    cout << "\nKruskal : weight " << wk << ", edges:";
    for (auto& e : ke) cout << " " << e.u << "-" << e.v << "(" << e.w << ")";
    cout << "\nboth give the same weight: " << (wp == wk ? "yes" : "NO") << "\n";

    mt19937 rng(6);                                                     // random connected graphs: Prim == Kruskal
    bool ok = true;
    for (int t = 0; t < 200; t++) {
        int N = 2 + rng() % 12;
        vector<Edge> E;
        for (int v = 1; v < N; v++) E.push_back({(int)(rng() % v), v, (int)(1 + rng() % 20)});   // random tree keeps it connected
        for (int k = 0; k < N; k++) { int a = rng() % N, b = rng() % N; if (a != b) E.push_back({a, b, (int)(1 + rng() % 20)}); }
        vector<vector<pii>> G(N);
        for (auto& e : E) { G[e.u].push_back({e.v, e.w}); G[e.v].push_back({e.u, e.w}); }
        vector<pair<int, int>> a; vector<Edge> b;
        ok = ok && prim(G, a) == kruskal(N, E, b);
    }
    cout << "200 random connected graphs: Prim and Kruskal weights agree: " << (ok ? "yes" : "NO") << "\n";
}
