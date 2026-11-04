#include <bits/stdc++.h>
using namespace std;
typedef vector<long long> Poly;                                  // p[i] = coefficient of x^i

// ---------- evaluation: naive versus Horner ----------
long long naiveEval(const Poly& a, long long x, long long& mults) {
    long long sum = 0;
    for (size_t i = 0; i < a.size(); i++) {
        long long p = 1;
        for (size_t j = 0; j < i; j++) { p *= x; mults++; }     // x^i recomputed from scratch
        sum += a[i] * p; mults++;
    }
    return sum;
}
long long horner(const Poly& a, long long x, long long& mults) {
    long long r = a.back();
    for (int i = (int)a.size() - 2; i >= 0; i--) { r = r * x + a[i]; mults++; }
    return r;
}

// ---------- multiplication: schoolbook and Karatsuba ----------
Poly schoolbook(const Poly& a, const Poly& b) {
    Poly c(a.size() + b.size() - 1, 0);
    for (size_t i = 0; i < a.size(); i++) for (size_t j = 0; j < b.size(); j++) c[i + j] += a[i] * b[j];
    return c;
}
Poly karatRec(const Poly& a, const Poly& b) {                    // both of the same power-of-two length n
    size_t n = a.size();
    if (n <= 8) return schoolbook(a, b);
    size_t h = n / 2;
    Poly a0(a.begin(), a.begin() + h), a1(a.begin() + h, a.end());
    Poly b0(b.begin(), b.begin() + h), b1(b.begin() + h, b.end());
    Poly z0 = karatRec(a0, b0), z2 = karatRec(a1, b1);
    Poly sa(h), sb(h);
    for (size_t i = 0; i < h; i++) { sa[i] = a0[i] + a1[i]; sb[i] = b0[i] + b1[i]; }
    Poly z1 = karatRec(sa, sb);                                  // (a0+a1)(b0+b1): the single "extra" product
    for (size_t i = 0; i < z1.size(); i++) z1[i] -= z0[i] + z2[i];
    Poly res(2 * n - 1, 0);
    for (size_t i = 0; i < z0.size(); i++) res[i] += z0[i];
    for (size_t i = 0; i < z1.size(); i++) res[i + h] += z1[i];
    for (size_t i = 0; i < z2.size(); i++) res[i + 2 * h] += z2[i];
    return res;
}
Poly karatsuba(Poly a, Poly b) {
    size_t want = a.size() + b.size() - 1, m = 1;
    while (m < max(a.size(), b.size())) m <<= 1;
    a.resize(m); b.resize(m);
    Poly r = karatRec(a, b);
    r.resize(want);
    return r;
}

// ---------- number theory ----------
long long gcdSteps;
long long euclid(long long a, long long b) { gcdSteps++; return b == 0 ? a : euclid(b, a % b); }
long long extGcd(long long a, long long b, long long& x, long long& y) {
    if (b == 0) { x = 1; y = 0; return a; }
    long long x1, y1, g = extGcd(b, a % b, x1, y1);
    x = y1; y = x1 - (a / b) * y1;
    return g;
}
long long modInverse(long long a, long long m) {
    long long x, y;
    return extGcd(a, m, x, y) == 1 ? ((x % m) + m) % m : -1;
}
long long modPow(long long b, long long e, long long m) {        // square and multiply
    long long r = 1; b %= m;
    while (e > 0) { if (e & 1) r = (__int128)r * b % m; b = (__int128)b * b % m; e >>= 1; }
    return r;
}

int main() {
    Poly a = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11};              // degree 10
    long long m1 = 0, m2 = 0;
    long long v1 = naiveEval(a, 3, m1), v2 = horner(a, 3, m2);
    cout << "A(3) = " << v1 << " (naive, " << m1 << " multiplications) = " << v2 << " (Horner, " << m2 << " multiplications)\n";

    mt19937 rng(5);
    Poly p(100), q(77);
    for (auto& c : p) c = (long long)(rng() % 21) - 10;
    for (auto& c : q) c = (long long)(rng() % 21) - 10;
    cout << "Karatsuba equals schoolbook on random polynomials of sizes 100 and 77: " << (karatsuba(p, q) == schoolbook(p, q) ? "yes" : "NO") << "\n";

    gcdSteps = 0;
    cout << "gcd(48, 18) = " << euclid(48, 18) << "\n";
    gcdSteps = 0;
    long long g = euclid(832040, 514229);                         // consecutive Fibonacci numbers: the worst case
    cout << "gcd(832040, 514229) = " << g << " after " << gcdSteps << " recursive calls (consecutive Fibonacci numbers)\n";
    long long x, y, d = extGcd(240, 46, x, y);
    cout << "extGcd(240, 46): gcd = " << d << ", x = " << x << ", y = " << y << "  (240*" << x << " + 46*" << y << " = " << 240 * x + 46 * y << ")\n";
    cout << "inverse of 3 modulo 11 = " << modInverse(3, 11) << ",  inverse of 4 modulo 8 = " << modInverse(4, 8) << " (none)\n";
    cout << "2^10 mod 1000 = " << modPow(2, 10, 1000) << ",  3^200 mod 13 = " << modPow(3, 200, 13) << ",  7^(10^18) mod 1000000007 = " << modPow(7, 1000000000000000000LL, 1000000007) << "\n";
}
