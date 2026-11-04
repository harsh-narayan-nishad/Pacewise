#include <bits/stdc++.h>
using namespace std;
typedef complex<double> cd;
const double PI = acos(-1.0);

// ---- recursive FFT: shows the divide and conquer structure (a.size() is a power of 2) ----
vector<cd> fftRecursive(const vector<cd>& a) {
    int n = a.size();
    if (n == 1) return a;
    vector<cd> even(n / 2), odd(n / 2);
    for (int i = 0; i < n / 2; i++) { even[i] = a[2 * i]; odd[i] = a[2 * i + 1]; }
    vector<cd> E = fftRecursive(even), O = fftRecursive(odd), y(n);
    for (int k = 0; k < n / 2; k++) {
        cd w = polar(1.0, 2 * PI * k / n);                       // omega_n^k
        y[k] = E[k] + w * O[k];                                   // butterfly
        y[k + n / 2] = E[k] - w * O[k];
    }
    return y;
}

// ---- iterative in-place FFT (bit reversal + butterflies); invert = true gives the inverse transform ----
void fft(vector<cd>& a, bool invert) {
    int n = a.size();
    for (int i = 1, j = 0; i < n; i++) {                         // bit-reversal permutation
        int bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) swap(a[i], a[j]);
    }
    for (int len = 2; len <= n; len <<= 1) {
        double ang = 2 * PI / len * (invert ? -1 : 1);
        cd wlen(cos(ang), sin(ang));
        for (int i = 0; i < n; i += len) {
            cd w(1);
            for (int j = 0; j < len / 2; j++) {
                cd u = a[i + j], v = a[i + j + len / 2] * w;
                a[i + j] = u + v;
                a[i + j + len / 2] = u - v;
                w *= wlen;
            }
        }
    }
    if (invert) for (cd& x : a) x /= n;
}

vector<long long> multiplyFFT(const vector<long long>& a, const vector<long long>& b) {
    vector<cd> fa(a.begin(), a.end()), fb(b.begin(), b.end());
    int n = 1;
    while (n < (int)(a.size() + b.size())) n <<= 1;               // room for the product
    fa.resize(n); fb.resize(n);
    fft(fa, false); fft(fb, false);                               // coefficients -> point values
    for (int i = 0; i < n; i++) fa[i] *= fb[i];                   // pointwise product
    fft(fa, true);                                                // point values -> coefficients
    vector<long long> r(a.size() + b.size() - 1);
    for (size_t i = 0; i < r.size(); i++) r[i] = llround(fa[i].real());
    return r;
}
vector<long long> naiveMultiply(const vector<long long>& a, const vector<long long>& b) {
    vector<long long> c(a.size() + b.size() - 1, 0);
    for (size_t i = 0; i < a.size(); i++) for (size_t j = 0; j < b.size(); j++) c[i + j] += a[i] * b[j];
    return c;
}
string fmt(cd z) {
    double re = round(z.real() * 1000) / 1000 + 0.0, im = round(z.imag() * 1000) / 1000 + 0.0;   // "+ 0.0" turns -0 into 0
    ostringstream o;
    o << "(" << re << (im < 0 ? " - " : " + ") << fabs(im) << "i)";
    return o.str();
}

int main() {
    vector<cd> a = {1, 2, 3, 4};
    vector<cd> y = fftRecursive(a);
    cout << "DFT of [1,2,3,4] (recursive): ";
    for (cd z : y) cout << fmt(z) << ' ';
    vector<cd> b = a;
    fft(b, false);
    double diff = 0;
    for (int i = 0; i < 4; i++) diff = max(diff, abs(b[i] - y[i]));
    cout << "\niterative FFT gives the same values (max difference " << (diff < 1e-9 ? "< 1e-9" : "TOO LARGE") << ")\n";
    fft(b, true);
    cout << "inverse FFT recovers the input: " << fmt(b[0]) << ' ' << fmt(b[1]) << ' ' << fmt(b[2]) << ' ' << fmt(b[3]) << "\n";

    vector<long long> p = {1, 2, 3}, q = {4, 5};                  // (1 + 2x + 3x^2)(4 + 5x)
    cout << "(1 + 2x + 3x^2)(4 + 5x) = ";
    vector<long long> r = multiplyFFT(p, q);
    for (size_t i = 0; i < r.size(); i++) cout << (i ? " + " : "") << r[i] << (i == 0 ? "" : i == 1 ? "x" : "x^" + to_string(i));
    cout << "\n";

    mt19937 rng(2);
    vector<long long> u(3000), v(2500);
    for (auto& c : u) c = (long long)(rng() % 2001) - 1000;
    for (auto& c : v) c = (long long)(rng() % 2001) - 1000;
    cout << "multiplying degree-2999 by degree-2499 random polynomials: FFT result equals schoolbook result: "
         << (multiplyFFT(u, v) == naiveMultiply(u, v) ? "yes" : "NO") << "\n";
}
