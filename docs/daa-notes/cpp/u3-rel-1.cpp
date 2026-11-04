#include <bits/stdc++.h>
using namespace std;

double stageRel(double r, int m) { return 1.0 - pow(1.0 - r, m); }          // m devices in parallel

int main() {
    vector<double> r = {0.9, 0.8, 0.5};       // reliability of one device in each stage
    vector<int> c = {30, 15, 20};             // cost of one device in each stage
    int C = 105;                              // total budget
    int n = r.size();

    vector<int> m(n, 1);                      // one device per stage is mandatory
    int budget = C;
    for (int i = 0; i < n; i++) budget -= c[i];

    while (true) {
        int best = -1;
        double bestGain = 0;
        for (int i = 0; i < n; i++) {
            if (c[i] > budget) continue;
            double gain = (stageRel(r[i], m[i] + 1) / stageRel(r[i], m[i]) - 1.0) / c[i];   // relative improvement per unit cost
            if (gain > bestGain) { bestGain = gain; best = i; }
        }
        if (best < 0) break;                  // nothing affordable improves the system
        m[best]++;
        budget -= c[best];
    }

    double rel = 1;
    int cost = 0;
    for (int i = 0; i < n; i++) { rel *= stageRel(r[i], m[i]); cost += c[i] * m[i]; }
    cout << "copies per stage:";
    for (int x : m) cout << ' ' << x;
    cout << "\ntotal cost = " << cost << " (budget " << C << "), system reliability = " << rel << "\n";
}
