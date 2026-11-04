#include <bits/stdc++.h>
using namespace std;

int main() {
    vector<int> w = {1, 3, 4, 5}, v = {1, 4, 5, 7};
    int n = w.size(), W = 7;
    vector<vector<int>> K(n + 1, vector<int>(W + 1, 0));
    for (int i = 1; i <= n; i++)
        for (int c = 0; c <= W; c++) {
            K[i][c] = K[i - 1][c];                                           // skip item i
            if (w[i - 1] <= c) K[i][c] = max(K[i][c], K[i - 1][c - w[i - 1]] + v[i - 1]);   // or take it
        }

    cout << "capacity:   ";
    for (int c = 0; c <= W; c++) cout << setw(3) << c;
    cout << "\n";
    for (int i = 0; i <= n; i++) {
        cout << "first " << i << " items";
        for (int c = 0; c <= W; c++) cout << setw(3) << K[i][c];
        cout << "\n";
    }
    cout << "best value = " << K[n][W] << ", items taken (1-based):";
    for (int i = n, c = W; i >= 1; i--)
        if (K[i][c] != K[i - 1][c]) { cout << ' ' << i << "(w=" << w[i - 1] << ",v=" << v[i - 1] << ")"; c -= w[i - 1]; }
    cout << "\n";

    // space-optimized version and a brute-force check on random instances
    mt19937 rng(3);
    bool ok = true;
    for (int t = 0; t < 300; t++) {
        int N = 1 + rng() % 10, cap = rng() % 30;
        vector<int> ww(N), vv(N);
        for (int i = 0; i < N; i++) { ww[i] = 1 + rng() % 10; vv[i] = 1 + rng() % 20; }
        vector<int> dp(cap + 1, 0);
        for (int i = 0; i < N; i++)
            for (int c = cap; c >= ww[i]; c--) dp[c] = max(dp[c], dp[c - ww[i]] + vv[i]);   // downward loop: each item used once
        int brute = 0;
        for (int mask = 0; mask < (1 << N); mask++) {
            int sw = 0, sv = 0;
            for (int i = 0; i < N; i++) if (mask >> i & 1) { sw += ww[i]; sv += vv[i]; }
            if (sw <= cap) brute = max(brute, sv);
        }
        ok = ok && dp[cap] == brute;
    }
    cout << "1-D DP matches brute force on 300 random instances: " << (ok ? "yes" : "NO") << "\n";
}
