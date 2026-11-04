#include <bits/stdc++.h>
using namespace std;

double stageRel(double r, int m) { return 1.0 - pow(1.0 - r, m); }

// exact DP for reliability design
double reliabilityDP(const vector<double>& r, const vector<int>& c, int C, vector<int>& copies) {
    int n = r.size();
    vector<vector<double>> F(n + 1, vector<double>(C + 1, 0.0));
    vector<vector<int>> choice(n + 1, vector<int>(C + 1, 0));
    for (int b = 0; b <= C; b++) F[0][b] = 1.0;                         // empty product
    for (int i = 1; i <= n; i++)
        for (int b = 0; b <= C; b++)
            for (int m = 1; m * c[i - 1] <= b; m++) {
                double val = stageRel(r[i - 1], m) * F[i - 1][b - m * c[i - 1]];
                if (val > F[i][b]) { F[i][b] = val; choice[i][b] = m; }
            }
    copies = vector<int>(n, 0);
    for (int i = n, b = C; i >= 1; i--) { copies[i - 1] = choice[i][b]; b -= choice[i][b] * c[i - 1]; }
    return F[n][C];
}

// marginal-gain greedy from section 3.8, for comparison
double reliabilityGreedy(const vector<double>& r, const vector<int>& c, int C) {
    int n = r.size(), budget = C;
    vector<int> m(n, 1);
    for (int i = 0; i < n; i++) budget -= c[i];
    while (true) {
        int best = -1; double bestGain = 0;
        for (int i = 0; i < n; i++) {
            if (c[i] > budget) continue;
            double gain = (stageRel(r[i], m[i] + 1) / stageRel(r[i], m[i]) - 1.0) / c[i];
            if (gain > bestGain) { bestGain = gain; best = i; }
        }
        if (best < 0) break;
        m[best]++; budget -= c[best];
    }
    double rel = 1;
    for (int i = 0; i < n; i++) rel *= stageRel(r[i], m[i]);
    return rel;
}

int main() {
    // ---- resource allocation: 4 units among 3 activities ----
    vector<vector<int>> P = {{0, 2, 4, 7, 8}, {0, 3, 5, 6, 9}, {0, 1, 4, 5, 6}};   // P[i][x] = profit of activity i given x units
    int n = P.size(), R = 4;
    vector<vector<int>> F(n + 1, vector<int>(R + 1, 0)), arg(n + 1, vector<int>(R + 1, 0));
    for (int i = 1; i <= n; i++)
        for (int r = 0; r <= R; r++)
            for (int x = 0; x <= r; x++) {
                int val = P[i - 1][x] + F[i - 1][r - x];
                if (val > F[i][r]) { F[i][r] = val; arg[i][r] = x; }
            }
    vector<int> give(n);
    for (int i = n, r = R; i >= 1; i--) { give[i - 1] = arg[i][r]; r -= arg[i][r]; }
    cout << "resource allocation: best total profit = " << F[n][R] << ", units given to activities:";
    for (int x : give) cout << ' ' << x;
    int brute = 0;                                                              // check by brute force
    for (int a = 0; a <= R; a++) for (int b = 0; a + b <= R; b++) for (int c = 0; a + b + c <= R; c++)
        brute = max(brute, P[0][a] + P[1][b] + P[2][c]);
    cout << "   (brute force: " << brute << ")\n";

    // ---- reliability design ----
    vector<double> rel = {0.9, 0.8, 0.5};
    vector<int> cost = {30, 15, 20};
    vector<int> copies;
    double best = reliabilityDP(rel, cost, 105, copies);
    cout << "reliability design (C = 105): copies =";
    for (int m : copies) cout << ' ' << m;
    cout << ", reliability = " << best << "\n";

    mt19937 rng(21);                                                           // how good is the greedy heuristic?
    int same = 0, trials = 1000;
    double worstRatio = 1.0;
    for (int t = 0; t < trials; t++) {
        int N = 4;
        vector<double> rr(N); vector<int> cc(N);
        int sum = 0;
        for (int i = 0; i < N; i++) { rr[i] = 0.5 + (rng() % 45) / 100.0; cc[i] = 5 + rng() % 26; sum += cc[i]; }
        int C = sum + 10 + rng() % 70;
        vector<int> tmp;
        double opt = reliabilityDP(rr, cc, C, tmp), gr = reliabilityGreedy(rr, cc, C);
        if (fabs(opt - gr) < 1e-12) same++;
        worstRatio = min(worstRatio, gr / opt);
    }
    cout << "greedy matched the exact DP in " << same << " of " << trials << " random instances; worst greedy/optimal ratio = "
         << fixed << setprecision(4) << worstRatio << "\n";
}
