#include <bits/stdc++.h>
using namespace std;

vector<int> naive(const string& t, const string& p) {
    vector<int> res;
    int n = t.size(), m = p.size();
    for (int s = 0; s + m <= n; s++) if (t.compare(s, m, p) == 0) res.push_back(s);
    return res;
}

vector<int> rabinKarp(const string& t, const string& p) {
    const long long B = 256, MOD = 1000000007;
    int n = t.size(), m = p.size();
    vector<int> res;
    if (m > n) return res;
    long long h = 1;                                              // B^(m-1) mod MOD
    for (int i = 0; i < m - 1; i++) h = h * B % MOD;
    long long hp = 0, ht = 0;
    for (int i = 0; i < m; i++) { hp = (hp * B + (unsigned char)p[i]) % MOD; ht = (ht * B + (unsigned char)t[i]) % MOD; }
    for (int s = 0; s + m <= n; s++) {
        if (hp == ht && t.compare(s, m, p) == 0) res.push_back(s);   // verify: equal hashes may be a spurious hit
        if (s + m < n) ht = ((ht - (unsigned char)t[s] * h % MOD + MOD) * B + (unsigned char)t[s + m]) % MOD;   // rolling update
    }
    return res;
}

vector<int> prefixFunction(const string& p) {                     // pi[i] = longest proper prefix of p[0..i] that is also its suffix
    int m = p.size();
    vector<int> pi(m, 0);
    for (int i = 1, k = 0; i < m; i++) {
        while (k > 0 && p[i] != p[k]) k = pi[k - 1];
        if (p[i] == p[k]) k++;
        pi[i] = k;
    }
    return pi;
}
vector<int> kmp(const string& t, const string& p) {
    vector<int> pi = prefixFunction(p), res;
    int m = p.size();
    for (int i = 0, k = 0; i < (int)t.size(); i++) {
        while (k > 0 && (k == m || t[i] != p[k])) k = pi[k - 1];     // fall back, never moving i backwards
        if (t[i] == p[k]) k++;
        if (k == m) res.push_back(i - m + 1);
    }
    return res;
}

vector<vector<int>> buildDFA(const string& p) {                   // d[state][char] = next state
    int m = p.size();
    vector<vector<int>> d(m + 1, vector<int>(256, 0));
    d[0][(unsigned char)p[0]] = 1;
    for (int j = 1, x = 0; j <= m; j++) {                         // x = state reached after reading p[1..j-1]
        for (int c = 0; c < 256; c++) d[j][c] = d[x][c];          // mismatch transitions copy the restart state
        if (j < m) { d[j][(unsigned char)p[j]] = j + 1; x = d[x][(unsigned char)p[j]]; }
    }
    return d;
}
vector<int> automaton(const string& t, const string& p) {
    auto d = buildDFA(p);
    vector<int> res;
    int m = p.size(), state = 0;
    for (int i = 0; i < (int)t.size(); i++) {
        state = d[state][(unsigned char)t[i]];
        if (state == m) res.push_back(i - m + 1);
    }
    return res;
}

vector<int> horspool(const string& t, const string& p) {          // simplified Boyer-Moore (bad character rule only)
    int n = t.size(), m = p.size();
    vector<int> shift(256, m), res;
    for (int i = 0; i < m - 1; i++) shift[(unsigned char)p[i]] = m - 1 - i;
    for (int s = 0; s + m <= n; ) {
        int j = m - 1;
        while (j >= 0 && t[s + j] == p[j]) j--;                   // compare right to left
        if (j < 0) res.push_back(s);
        s += shift[(unsigned char)t[s + m - 1]];
    }
    return res;
}

void show(const char* name, const vector<int>& v) {
    cout << setw(14) << left << name << right << ": ";
    for (int x : v) cout << x << ' ';
    cout << "\n";
}

int main() {
    string t = "ABABDABACDABABCABAB", p = "ABABCABAB";
    cout << "text    = " << t << "\npattern = " << p << "\n";
    show("naive", naive(t, p));
    show("Rabin-Karp", rabinKarp(t, p));
    show("KMP", kmp(t, p));
    show("automaton", automaton(t, p));
    show("Horspool", horspool(t, p));
    cout << "prefix function of the pattern:";
    for (int x : prefixFunction(p)) cout << ' ' << x;
    cout << "\n";

    mt19937 rng(14);                                              // all five must agree on random strings with overlapping matches
    bool ok = true;
    for (int trial = 0; trial < 2000; trial++) {
        string T, P;
        int n = 1 + rng() % 60, m = 1 + rng() % 5;
        for (int i = 0; i < n; i++) T += "ab"[rng() % 2];
        for (int i = 0; i < m; i++) P += "ab"[rng() % 2];
        auto ref = naive(T, P);
        ok = ok && ref == rabinKarp(T, P) && ref == kmp(T, P) && ref == automaton(T, P) && ref == horspool(T, P);
    }
    cout << "2000 random binary strings: all algorithms give identical answers: " << (ok ? "yes" : "NO") << "\n";
}
