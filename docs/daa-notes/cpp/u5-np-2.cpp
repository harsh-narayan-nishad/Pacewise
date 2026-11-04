#include <bits/stdc++.h>
using namespace std;
typedef unsigned long long ull;

vector<ull> adjMask;                                               // adjacency as bitmasks (up to 64 vertices)

int maxIndependentSet(ull mask) {                                  // simple exponential recursion
    if (!mask) return 0;
    int v = __builtin_ctzll(mask);
    ull rest = mask & ~(1ULL << v);
    return max(maxIndependentSet(rest), 1 + maxIndependentSet(rest & ~adjMask[v]));   // skip v, or take v and drop its neighbours
}

bool satisfiable(const vector<array<int, 3>>& clauses, int nvars) {
    for (int mask = 0; mask < (1 << nvars); mask++) {
        bool all = true;
        for (auto& c : clauses) {
            bool any = false;
            for (int lit : c) { bool val = mask >> (abs(lit) - 1) & 1; if (lit > 0 ? val : !val) any = true; }
            if (!any) { all = false; break; }
        }
        if (all) return true;
    }
    return false;
}

int main() {
    mt19937 rng(77);
    int agree = 0, satCount = 0, trials = 400;
    for (int t = 0; t < trials; t++) {
        int nvars = (t % 2) ? 5 : 3;                               // with only 3 variables many formulas are unsatisfiable
        int m = 4 + rng() % 11;                                    // up to 14 clauses = 42 graph vertices
        vector<array<int, 3>> clauses;
        for (int i = 0; i < m; i++) {
            vector<int> vars(nvars);
            iota(vars.begin(), vars.end(), 1);
            shuffle(vars.begin(), vars.end(), rng);                 // three distinct variables per clause
            array<int, 3> c;
            for (int j = 0; j < 3; j++) c[j] = rng() % 2 ? vars[j] : -vars[j];
            clauses.push_back(c);
        }
        // the reduction: vertex 3*i + j = j-th literal of clause i
        int V = 3 * m;
        adjMask.assign(V, 0);
        auto connect = [&](int a, int b) { adjMask[a] |= 1ULL << b; adjMask[b] |= 1ULL << a; };
        for (int i = 0; i < m; i++) { connect(3 * i, 3 * i + 1); connect(3 * i, 3 * i + 2); connect(3 * i + 1, 3 * i + 2); }   // triangle per clause
        for (int a = 0; a < V; a++) for (int b = a + 1; b < V; b++)
            if (clauses[a / 3][a % 3] == -clauses[b / 3][b % 3]) connect(a, b);                                          // x and NOT x conflict
        bool s = satisfiable(clauses, nvars);
        bool hasIS = maxIndependentSet((V == 64 ? ~0ULL : (1ULL << V) - 1)) >= m;
        agree += (s == hasIS);
        satCount += s;
    }
    cout << "3-SAT <=p Independent Set: formula satisfiable <=> graph has an independent set of size m, agreed on "
         << agree << " of " << trials << " random formulas (" << satCount << " satisfiable, " << trials - satCount << " not)\n";

    // independent set / vertex cover / clique identity on random graphs
    bool ok = true;
    for (int t = 0; t < 300; t++) {
        int n = 3 + rng() % 8;
        vector<vector<int>> g(n, vector<int>(n, 0));
        for (int i = 0; i < n; i++) for (int j = i + 1; j < n; j++) g[i][j] = g[j][i] = rng() % 2;
        int alpha = 0, tau = n, omegaComplement = 0;
        for (int S = 0; S < (1 << n); S++) {
            bool indep = true, cover = true, cliqueInComplement = true;
            for (int i = 0; i < n; i++) for (int j = i + 1; j < n; j++) {
                bool inI = S >> i & 1, inJ = S >> j & 1;
                if (g[i][j] && inI && inJ) indep = false;           // an edge inside S
                if (g[i][j] && !inI && !inJ) cover = false;         // an edge with no endpoint in S
                if (g[i][j] == 1 && inI && inJ) cliqueInComplement = false;   // complement has no edge i-j
            }
            int sz = __builtin_popcount(S);
            if (indep) alpha = max(alpha, sz);
            if (cover) tau = min(tau, sz);
            if (cliqueInComplement) omegaComplement = max(omegaComplement, sz);
        }
        ok = ok && alpha + tau == n && alpha == omegaComplement;
    }
    cout << "independent set + minimum vertex cover = n, and independent set = clique of the complement graph, on 300 random graphs: "
         << (ok ? "yes" : "NO") << "\n";
}
