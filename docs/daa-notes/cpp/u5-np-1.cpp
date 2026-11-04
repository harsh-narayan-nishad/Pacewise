#include <bits/stdc++.h>
using namespace std;

// ------- polynomial-time verifiers: this is what "in NP" means -------
bool verifyHamCycle(const vector<vector<int>>& adj, const vector<int>& cyc) {
    int n = adj.size();
    if ((int)cyc.size() != n) return false;
    vector<bool> seen(n, false);
    for (int i = 0; i < n; i++) {
        if (seen[cyc[i]]) return false;
        seen[cyc[i]] = true;
        if (!adj[cyc[i]][cyc[(i + 1) % n]]) return false;           // consecutive vertices must be adjacent
    }
    return true;
}
bool verifySubsetSum(const vector<int>& a, const vector<int>& idx, int target) {
    set<int> used;
    long long sum = 0;
    for (int i : idx) { if (i < 0 || i >= (int)a.size() || !used.insert(i).second) return false; sum += a[i]; }
    return sum == target;
}
typedef vector<vector<int>> CNF;                                    // literal +i = variable i, -i = NOT variable i (1-based)
bool verifyCNF(const CNF& f, const vector<bool>& val) {             // val[1..n]
    for (const auto& clause : f) {
        bool ok = false;
        for (int lit : clause) if (lit > 0 ? val[lit] : !val[-lit]) ok = true;
        if (!ok) return false;
    }
    return true;
}
// ------- brute-force search: exponential, 2^n candidates -------
bool bruteForceSAT(const CNF& f, int nvars, vector<bool>& model, long long& tried) {
    for (long long mask = 0; mask < (1LL << nvars); mask++) {
        tried++;
        model.assign(nvars + 1, false);
        for (int i = 1; i <= nvars; i++) model[i] = mask >> (i - 1) & 1;
        if (verifyCNF(f, model)) return true;
    }
    return false;
}

int main() {
    vector<vector<int>> g = {{0, 1, 0, 1, 0}, {1, 0, 1, 1, 1}, {0, 1, 0, 0, 1}, {1, 1, 0, 0, 1}, {0, 1, 1, 1, 0}};
    cout << "certificate 0 1 2 4 3 is a Hamiltonian cycle: " << (verifyHamCycle(g, {0, 1, 2, 4, 3}) ? "accepted" : "rejected") << "\n";
    cout << "certificate 0 1 2 3 4 is a Hamiltonian cycle: " << (verifyHamCycle(g, {0, 1, 2, 3, 4}) ? "accepted" : "rejected") << "\n";
    vector<int> a = {3, 34, 4, 12, 5, 2};
    cout << "subset-sum certificate {4, 5} (items 2 and 4) for target 9: " << (verifySubsetSum(a, {2, 4}, 9) ? "accepted" : "rejected") << "\n";

    CNF f = {{1, 2, 3}, {-1, -2, 3}, {1, -2, -3}, {-1, 2, -3}};        // satisfiable 3-CNF
    vector<bool> model;
    long long tried = 0;
    bool sat = bruteForceSAT(f, 3, model, tried);
    cout << "formula 1: " << (sat ? "satisfiable" : "unsatisfiable") << " after trying " << tried << " assignments; model:";
    for (int i = 1; i <= 3; i++) cout << " x" << i << "=" << model[i];
    cout << "\n";

    CNF u;                                                             // all 8 sign patterns over 3 variables: unsatisfiable
    for (int mask = 0; mask < 8; mask++) u.push_back({mask & 1 ? 1 : -1, mask & 2 ? 2 : -2, mask & 4 ? 3 : -3});
    tried = 0;
    cout << "formula 2 (all 8 clauses over x1,x2,x3): " << (bruteForceSAT(u, 3, model, tried) ? "satisfiable" : "unsatisfiable")
         << " after checking all " << tried << " assignments\n";
    cout << "verifying one certificate takes O(size of formula); finding one may need 2^n tries.\n";
}
