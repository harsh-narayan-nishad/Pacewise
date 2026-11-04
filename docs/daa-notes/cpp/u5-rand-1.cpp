#include <bits/stdc++.h>
using namespace std;
typedef unsigned long long ull;
typedef __uint128_t u128;

// ---------- Miller-Rabin primality test (Monte Carlo) ----------
ull mulmod(ull a, ull b, ull m) { return (u128)a * b % m; }
ull powmod(ull b, ull e, ull m) { ull r = 1; b %= m; while (e) { if (e & 1) r = mulmod(r, b, m); b = mulmod(b, b, m); e >>= 1; } return r; }
bool millerRabin(ull n, int rounds, mt19937_64& rng) {
    if (n < 2) return false;
    for (ull p : {2ULL, 3ULL, 5ULL, 7ULL, 11ULL, 13ULL, 17ULL, 19ULL, 23ULL, 29ULL, 31ULL, 37ULL}) if (n % p == 0) return n == p;
    ull d = n - 1; int s = 0;
    while (d % 2 == 0) { d /= 2; s++; }                             // n - 1 = 2^s * d
    for (int r = 0; r < rounds; r++) {
        ull a = 2 + rng() % (n - 3);                                // random base in [2, n-2]
        ull x = powmod(a, d, n);
        if (x == 1 || x == n - 1) continue;
        bool composite = true;
        for (int i = 1; i < s; i++) { x = mulmod(x, x, n); if (x == n - 1) { composite = false; break; } }
        if (composite) return false;                                // a is a witness: n is certainly composite
    }
    return true;                                                    // probably prime (error <= 4^-rounds)
}

// ---------- Karger's randomized minimum cut ----------
struct DSU {
    vector<int> p;
    DSU(int n) : p(n) { iota(p.begin(), p.end(), 0); }
    int find(int x) { return p[x] == x ? x : p[x] = find(p[x]); }
};
int kargerOnce(int n, vector<pair<int, int>> edges, mt19937& rng) {
    shuffle(edges.begin(), edges.end(), rng);                       // a random order = contracting random edges one by one
    DSU dsu(n);
    int components = n;
    for (auto [u, v] : edges) {
        if (components == 2) break;
        int a = dsu.find(u), b = dsu.find(v);
        if (a != b) { dsu.p[a] = b; components--; }                 // contract the edge
    }
    int cut = 0;
    for (auto [u, v] : edges) cut += dsu.find(u) != dsu.find(v);    // edges between the two super-vertices
    return cut;
}

// ---------- Freivalds' matrix product verification ----------
typedef vector<vector<long long>> Mat;
vector<long long> mulVec(const Mat& A, const vector<long long>& x) {
    int n = A.size();
    vector<long long> r(n, 0);
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) r[i] += A[i][j] * x[j];
    return r;
}
bool freivalds(const Mat& A, const Mat& B, const Mat& C, int rounds, mt19937& rng) {
    int n = A.size();
    for (int r = 0; r < rounds; r++) {
        vector<long long> x(n);
        for (auto& v : x) v = rng() & 1;
        if (mulVec(A, mulVec(B, x)) != mulVec(C, x)) return false;  // O(n^2): A(Bx) versus Cx
    }
    return true;
}

int main() {
    mt19937_64 rng64(1);
    cout << "Miller-Rabin: ";
    for (ull n : {1000000007ULL, 998244353ULL, 2305843009213693951ULL, 1000003ULL * 1000033ULL, 561ULL, 97ULL * 89ULL * 83ULL})
        cout << n << (millerRabin(n, 20, rng64) ? " prime; " : " composite; ");
    bool agree = true;                                              // compare with trial division for every n below 30000
    for (ull n = 0; n < 30000; n++) {
        bool prime = n >= 2;
        for (ull d = 2; d * d <= n && prime; d++) if (n % d == 0) prime = false;
        agree = agree && prime == millerRabin(n, 10, rng64);
    }
    cout << "\nagrees with trial division for all n < 30000: " << (agree ? "yes" : "NO") << "\n";

    mt19937 rng(6);                                                 // two 4-cliques joined by two edges: the minimum cut is 2
    vector<pair<int, int>> e;
    for (int a = 0; a < 4; a++) for (int b = a + 1; b < 4; b++) { e.push_back({a, b}); e.push_back({a + 4, b + 4}); }
    e.push_back({3, 4}); e.push_back({2, 5});
    int n = 8, best = INT_MAX, hits = 0, single = 1000;
    for (int t = 0; t < single; t++) { int c = kargerOnce(n, e, rng); best = min(best, c); hits += (c == 2); }
    cout << "Karger: minimum cut found = " << best << "; a single contraction run found it in " << hits << " of " << single
         << " tries (theory: at least 2/(n(n-1)) = " << 2.0 / (n * (n - 1)) << " per run)\n";

    int N = 40;                                                     // Freivalds
    Mat A(N, vector<long long>(N)), B = A, C(N, vector<long long>(N, 0));
    for (int i = 0; i < N; i++) for (int j = 0; j < N; j++) { A[i][j] = rng() % 10; B[i][j] = rng() % 10; }
    for (int i = 0; i < N; i++) for (int k = 0; k < N; k++) for (int j = 0; j < N; j++) C[i][j] += A[i][k] * B[k][j];
    cout << "Freivalds accepts the correct product (20 rounds): " << (freivalds(A, B, C, 20, rng) ? "yes" : "NO") << "\n";
    C[7][11] += 1;                                                  // corrupt a single entry
    int caught = 0;
    for (int t = 0; t < 1000; t++) caught += !freivalds(A, B, C, 1, rng);
    cout << "one wrong entry: a single round detects it in " << caught << " of 1000 trials (theory: at least 50%), 20 rounds detect it: "
         << (!freivalds(A, B, C, 20, rng) ? "yes" : "NO") << "\n";
}
