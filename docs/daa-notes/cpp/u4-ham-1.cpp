#include <bits/stdc++.h>
using namespace std;

bool extend(const vector<vector<int>>& g, vector<int>& path, vector<bool>& used, int pos) {
    int n = g.size();
    if (pos == n) return g[path[n - 1]][path[0]];                 // all vertices placed: need an edge back to the start
    for (int v = 1; v < n; v++) {
        if (used[v] || !g[path[pos - 1]][v]) continue;            // not adjacent to the previous vertex, or already used
        used[v] = true; path[pos] = v;
        if (extend(g, path, used, pos + 1)) return true;
        used[v] = false; path[pos] = -1;                          // backtrack
    }
    return false;
}
void solve(const char* name, const vector<vector<int>>& g) {
    int n = g.size();
    vector<int> path(n, -1);
    vector<bool> used(n, false);
    path[0] = 0; used[0] = true;
    cout << name << ": ";
    if (extend(g, path, used, 1)) { for (int v : path) cout << v << ' '; cout << path[0] << "\n"; }
    else cout << "no Hamiltonian cycle\n";
}

int main() {
    // graph 1 edges: 0-1 0-3 1-2 1-3 1-4 2-4 3-4
    // graph 2 edges: 0-1 0-3 1-2 1-3 1-4 2-4        (graph 1 without the edge 3-4)
    vector<vector<int>> g1 = {{0, 1, 0, 1, 0}, {1, 0, 1, 1, 1}, {0, 1, 0, 0, 1}, {1, 1, 0, 0, 1}, {0, 1, 1, 1, 0}};
    vector<vector<int>> g2 = {{0, 1, 0, 1, 0}, {1, 0, 1, 1, 1}, {0, 1, 0, 0, 1}, {1, 1, 0, 0, 0}, {0, 1, 1, 0, 0}};
    solve("graph 1", g1);
    solve("graph 2 (0, 3 and 1 form a triangle and 0, 3 have degree 2, so any tour closes too early)", g2);
}
