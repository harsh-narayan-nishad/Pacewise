#include <bits/stdc++.h>
using namespace std;
typedef pair<int, int> pii;

vector<int> dijkstra(const vector<vector<pii>>& g, int s, vector<int>& parent) {
    int n = g.size();
    vector<int> d(n, INT_MAX);
    parent.assign(n, -1);
    priority_queue<pii, vector<pii>, greater<pii>> pq;           // (distance, vertex)
    d[s] = 0;
    pq.push({0, s});
    while (!pq.empty()) {
        auto [du, u] = pq.top(); pq.pop();
        if (du > d[u]) continue;                                  // stale queue entry
        for (auto [v, w] : g[u])
            if (d[u] + w < d[v]) { d[v] = d[u] + w; parent[v] = u; pq.push({d[v], v}); }   // relax
    }
    return d;
}
string pathTo(const vector<int>& parent, int v) {
    vector<int> p;
    for (; v != -1; v = parent[v]) p.push_back(v);
    reverse(p.begin(), p.end());
    string s;
    for (size_t i = 0; i < p.size(); i++) s += (i ? " -> " : "") + to_string(p[i]);
    return s;
}

struct E { int u, v, w; };
const long long INF = LLONG_MAX / 4;
bool bellmanFord(int n, const vector<E>& edges, int s, vector<long long>& d) {   // false if a negative cycle is reachable
    d.assign(n, INF);
    d[s] = 0;
    for (int i = 1; i < n; i++) {                                 // V-1 rounds
        bool changed = false;
        for (const E& e : edges)
            if (d[e.u] < INF && d[e.u] + e.w < d[e.v]) { d[e.v] = d[e.u] + e.w; changed = true; }
        if (!changed) break;
    }
    for (const E& e : edges)                                      // one more round: still improving => negative cycle
        if (d[e.u] < INF && d[e.u] + e.w < d[e.v]) return false;
    return true;
}

int main() {
    int n = 6;
    vector<vector<pii>> g(n);
    auto add = [&](int u, int v, int w) { g[u].push_back({v, w}); g[v].push_back({u, w}); };
    add(0, 1, 4); add(0, 2, 3); add(1, 2, 1); add(1, 3, 2); add(2, 3, 4); add(3, 4, 2); add(4, 5, 6);
    vector<int> parent;
    vector<int> d = dijkstra(g, 0, parent);
    cout << "Dijkstra from 0:\n";
    for (int v = 0; v < n; v++) cout << "  dist[" << v << "] = " << setw(2) << d[v] << "   path " << pathTo(parent, v) << "\n";

    vector<E> edges = {{0, 1, 6}, {0, 2, 7}, {1, 2, 8}, {1, 3, 5}, {1, 4, -4}, {2, 3, -3}, {2, 4, 9}, {3, 1, -2}, {4, 0, 2}, {4, 3, 7}};
    vector<long long> bd;
    bool ok = bellmanFord(5, edges, 0, bd);
    cout << "Bellman-Ford (has negative edges), no negative cycle = " << (ok ? "true" : "false") << ", distances:";
    for (long long x : bd) cout << ' ' << x;
    vector<E> bad = {{0, 1, 1}, {1, 2, -1}, {2, 0, -1}};          // cycle weight 1 - 1 - 1 = -1
    vector<long long> bd2;
    cout << "\nnegative cycle graph reports no-negative-cycle = " << (bellmanFord(3, bad, 0, bd2) ? "true" : "false") << "\n";
}
