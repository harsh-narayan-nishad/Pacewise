#include <bits/stdc++.h>
using namespace std;

string human(double s) {                                    // seconds -> readable text
    ostringstream o;
    o << setprecision(3);
    if (s < 1) o << "under a second";
    else if (s < 3600) o << s << " seconds";
    else if (s < 86400.0 * 365) o << s / 86400 << " days";
    else o << scientific << s / (86400.0 * 365) << " years";
    return o.str();
}

int main() {
    cout << left << setw(8) << "n" << setw(10) << "log2 n" << setw(12) << "n log2 n"
         << setw(12) << "n^2" << setw(14) << "n^3" << setw(16) << "2^n" << "time for 2^n at 1e9 ops/s\n";
    for (int n : {10, 20, 30, 50, 100}) {
        double lg = log2((double)n);
        double t = pow(2.0, n) / 1e9;                       // seconds
        cout << setw(8) << n << setw(10) << fixed << setprecision(2) << lg
             << setw(12) << setprecision(0) << n * lg << setw(12) << (double)n * n << setw(14) << (double)n * n * n
             << setw(16) << scientific << setprecision(2) << pow(2.0, n) << human(t) << "\n";
    }
}
