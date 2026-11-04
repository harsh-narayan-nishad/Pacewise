#include <bits/stdc++.h>
using namespace std;

string lcs(const string& a, const string& b) {
    int n = a.size(), m = b.size();
    vector<vector<int>> L(n + 1, vector<int>(m + 1, 0));
    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= m; j++)
            L[i][j] = a[i - 1] == b[j - 1] ? L[i - 1][j - 1] + 1 : max(L[i - 1][j], L[i][j - 1]);
    string out;                                                    // walk back through the table
    for (int i = n, j = m; i > 0 && j > 0; ) {
        if (a[i - 1] == b[j - 1]) { out += a[i - 1]; i--; j--; }
        else if (L[i - 1][j] >= L[i][j - 1]) i--;
        else j--;
    }
    reverse(out.begin(), out.end());
    return out;
}

// matrix chain: matrix i has dimensions p[i-1] x p[i]
string parens(const vector<vector<int>>& s, int i, int j) {
    if (i == j) return "A" + to_string(i);
    return "(" + parens(s, i, s[i][j]) + parens(s, s[i][j] + 1, j) + ")";
}
long long matrixChain(const vector<int>& p, string& order) {
    int n = p.size() - 1;
    vector<vector<long long>> M(n + 1, vector<long long>(n + 1, 0));
    vector<vector<int>> s(n + 1, vector<int>(n + 1, 0));
    for (int len = 2; len <= n; len++)
        for (int i = 1; i + len - 1 <= n; i++) {
            int j = i + len - 1;
            M[i][j] = LLONG_MAX;
            for (int k = i; k < j; k++) {
                long long cost = M[i][k] + M[k + 1][j] + (long long)p[i - 1] * p[k] * p[j];
                if (cost < M[i][j]) { M[i][j] = cost; s[i][j] = k; }
            }
        }
    order = parens(s, 1, n);
    return M[1][n];
}

int editDistance(const string& a, const string& b) {
    int n = a.size(), m = b.size();
    vector<vector<int>> D(n + 1, vector<int>(m + 1, 0));
    for (int i = 0; i <= n; i++) D[i][0] = i;                       // delete everything
    for (int j = 0; j <= m; j++) D[0][j] = j;                       // insert everything
    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= m; j++)
            D[i][j] = a[i - 1] == b[j - 1] ? D[i - 1][j - 1] : 1 + min({D[i - 1][j], D[i][j - 1], D[i - 1][j - 1]});
    return D[n][m];
}

int coinChange(const vector<int>& coins, int amount) {
    vector<int> dp(amount + 1, INT_MAX);
    dp[0] = 0;
    for (int a = 1; a <= amount; a++)
        for (int c : coins) if (c <= a && dp[a - c] != INT_MAX) dp[a] = min(dp[a], dp[a - c] + 1);
    return dp[amount] == INT_MAX ? -1 : dp[amount];
}

int main() {
    string l = lcs("ABCBDAB", "BDCABA");
    cout << "LCS(ABCBDAB, BDCABA) has length " << l.size() << ", one such sequence: " << l << "\n";
    string order;
    cout << "matrix chain {10,30,5,60}: " << matrixChain({10, 30, 5, 60}, order) << " multiplications, order " << order << "\n";
    cout << "matrix chain {40,20,30,10,30}: " << matrixChain({40, 20, 30, 10, 30}, order) << " multiplications, order " << order << "\n";
    cout << "edit distance(kitten, sitting) = " << editDistance("kitten", "sitting") << "\n";
    cout << "coin change, coins {1,3,4}, amount 6 -> " << coinChange({1, 3, 4}, 6) << " coins (greedy would use 3)\n";
}
