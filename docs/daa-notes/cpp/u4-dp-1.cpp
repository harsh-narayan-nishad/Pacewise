#include <bits/stdc++.h>
using namespace std;

long long naiveCalls = 0, memoCalls = 0;
long long fibNaive(int n) { naiveCalls++; return n < 2 ? n : fibNaive(n - 1) + fibNaive(n - 2); }     // exponential: same subproblems repeat
long long fibMemo(int n, vector<long long>& memo) {                                                  // top-down DP
    memoCalls++;
    if (n < 2) return n;
    if (memo[n] != -1) return memo[n];
    return memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
}
long long fibTable(int n) {                                                                          // bottom-up DP, O(1) space
    long long a = 0, b = 1;
    for (int i = 2; i <= n; i++) { long long c = a + b; a = b; b = c; }
    return n == 0 ? 0 : b;
}

int main() {
    int n = 32;
    vector<long long> memo(n + 1, -1);
    cout << "fib(" << n << ") = " << fibNaive(n) << " using " << naiveCalls << " recursive calls (about 1.6^n)\n";
    cout << "fib(" << n << ") = " << fibMemo(n, memo) << " using " << memoCalls << " calls with memoization (O(n))\n";
    cout << "fib(" << n << ") = " << fibTable(n) << " using a bottom-up loop of " << n - 1 << " steps and O(1) memory\n";
}
