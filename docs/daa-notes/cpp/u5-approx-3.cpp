#include <bits/stdc++.h>
using namespace std;

int main() {
    // universe 1..14: row 1 = {1..7}, row 2 = {8..14}; the best cover is the two rows, but greedy is lured by bigger sets
    vector<set<int>> S = {
        {1, 2, 3, 4, 8, 9, 10, 11},       // T1 (8 elements)
        {5, 6, 12, 13},                   // T2 (4 elements)
        {7, 14},                          // T3 (2 elements)
        {1, 2, 3, 4, 5, 6, 7},            // R1 (row 1)
        {8, 9, 10, 11, 12, 13, 14}        // R2 (row 2)
    };
    const char* name[] = {"T1", "T2", "T3", "R1", "R2"};
    set<int> uncovered;
    for (int i = 1; i <= 14; i++) uncovered.insert(i);

    cout << "greedy picks:";
    int picks = 0;
    while (!uncovered.empty()) {
        int best = -1, bestGain = 0;
        for (size_t i = 0; i < S.size(); i++) {
            int gain = 0;
            for (int x : S[i]) gain += uncovered.count(x);          // how many NEW elements this set covers
            if (gain > bestGain) { bestGain = gain; best = i; }
        }
        for (int x : S[best]) uncovered.erase(x);
        cout << ' ' << name[best] << "(+" << bestGain << ")";
        picks++;
    }
    int opt = 99;
    for (int mask = 1; mask < (1 << S.size()); mask++) {            // brute force optimum
        set<int> cov;
        for (size_t i = 0; i < S.size(); i++) if (mask >> i & 1) cov.insert(S[i].begin(), S[i].end());
        if (cov.size() == 14) opt = min(opt, __builtin_popcount(mask));
    }
    cout << "\ngreedy uses " << picks << " sets, the optimum is " << opt << " sets (ratio " << (double)picks / opt
         << ", within the H(8) = 2.72 bound)\n";
}
