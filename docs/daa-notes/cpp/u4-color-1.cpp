#include <bits/stdc++.h>
using namespace std;

bool safe(const vector<vector<int>>& g, const vector<int>& color, int v, int c) {
    for (size_t u = 0; u < g.size(); u++) if (g[v][u] && color[u] == c) return false;
    return true;
}
bool colorGraph(const vector<vector<int>>& g, vector<int>& color, int v, int m) {
    if (v == (int)g.size()) return true;                          // every vertex coloured
    for (int c = 1; c <= m; c++) {
        if (!safe(g, color, v, c)) continue;                      // pruning
        color[v] = c;
        if (colorGraph(g, color, v + 1, m)) return true;
        color[v] = 0;                                             // backtrack
    }
    return false;
}

int main() {
    // 4 vertices: triangle 0-1-2 plus vertex 3 joined to 0 and 2
    vector<vector<int>> g = {{0, 1, 1, 1}, {1, 0, 1, 0}, {1, 1, 0, 1}, {1, 0, 1, 0}};
    for (int m = 1; m <= 4; m++) {
        vector<int> color(g.size(), 0);
        cout << "m = " << m << ": ";
        if (colorGraph(g, color, 0, m)) { cout << "colouring"; for (int c : color) cout << ' ' << c; cout << "\n"; }
        else cout << "not possible\n";
    }
    int chi = 1;
    for (;; chi++) { vector<int> color(g.size(), 0); if (colorGraph(g, color, 0, chi)) break; }
    cout << "chromatic number = " << chi << "\n";
}
