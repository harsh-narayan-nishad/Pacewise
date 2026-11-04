#include <bits/stdc++.h>
using namespace std;
const int INF = 1e9;

void printMatrix(const vector<vector<int>>& d) {
    for (auto& row : d) { for (int x : row) { if (x >= INF) cout << setw(5) << "INF"; else cout << setw(5) << x; } cout << "\n"; }
}

int main() {
    int n = 4;
    vector<vector<int>> d(n, vector<int>(n, INF)), nxt(n, vector<int>(n, -1));
    auto edge = [&](int u, int v, int w) { d[u][v] = w; nxt[u][v] = v; };
    edge(0, 1, 5); edge(0, 3, 10); edge(1, 2, 3); edge(2, 3, 1);
    for (int i = 0; i < n; i++) { d[i][i] = 0; nxt[i][i] = i; }
    cout << "initial matrix:\n"; printMatrix(d);

    for (int k = 0; k < n; k++)                                   // k = the intermediate vertex: MUST be the outer loop
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                if (d[i][k] < INF && d[k][j] < INF && d[i][k] + d[k][j] < d[i][j]) {
                    d[i][j] = d[i][k] + d[k][j];
                    nxt[i][j] = nxt[i][k];                        // first step of the best path
                }
    cout << "all-pairs shortest distances:\n"; printMatrix(d);

    auto path = [&](int i, int j) {
        if (nxt[i][j] == -1) return string("no path");
        string s = to_string(i);
        for (int cur = i; cur != j; ) { cur = nxt[cur][j]; s += " -> " + to_string(cur); }
        return s;
    };
    cout << "path 0 to 3: " << path(0, 3) << "   (cost " << d[0][3] << ")\n";
    cout << "path 3 to 0: " << path(3, 0) << "\n";

    // negative cycle detection: a negative diagonal entry
    vector<vector<int>> e(3, vector<int>(3, INF));
    for (int i = 0; i < 3; i++) e[i][i] = 0;
    e[0][1] = 1; e[1][2] = -1; e[2][0] = -1;
    for (int k = 0; k < 3; k++) for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++)
        if (e[i][k] < INF && e[k][j] < INF) e[i][j] = min(e[i][j], e[i][k] + e[k][j]);
    cout << "graph with cycle 0->1->2->0 of weight -1 has a negative cycle: " << (e[0][0] < 0 ? "yes (d[0][0] < 0)" : "no") << "\n";

    // Warshall: transitive closure
    vector<vector<bool>> reach(n, vector<bool>(n, false));
    reach[0][1] = reach[1][2] = reach[2][3] = reach[3][1] = true;
    for (int i = 0; i < n; i++) reach[i][i] = true;
    for (int k = 0; k < n; k++) for (int i = 0; i < n; i++) for (int j = 0; j < n; j++)
        reach[i][j] = reach[i][j] || (reach[i][k] && reach[k][j]);
    cout << "transitive closure (edges 0>1, 1>2, 2>3, 3>1):\n";
    for (auto& row : reach) { for (bool b : row) cout << ' ' << b; cout << "\n"; }
}
