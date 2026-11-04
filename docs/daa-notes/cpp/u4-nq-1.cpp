#include <bits/stdc++.h>
using namespace std;

int n;
vector<int> colOf;                                            // colOf[r] = column of the queen in row r
vector<bool> usedCol, diag1, diag2;                            // columns, (r + c) diagonals, (r - c + n - 1) diagonals
long long solutions;
vector<int> firstSolution;

void place(int r) {
    if (r == n) { if (solutions == 0) firstSolution = colOf; solutions++; return; }
    for (int c = 0; c < n; c++) {
        if (usedCol[c] || diag1[r + c] || diag2[r - c + n - 1]) continue;       // attacked: prune this branch
        usedCol[c] = diag1[r + c] = diag2[r - c + n - 1] = true;
        colOf[r] = c;
        place(r + 1);
        usedCol[c] = diag1[r + c] = diag2[r - c + n - 1] = false;               // undo (backtrack)
    }
}
long long countQueens(int size) {
    n = size; solutions = 0;
    colOf.assign(n, -1); usedCol.assign(n, false); diag1.assign(2 * n, false); diag2.assign(2 * n, false);
    firstSolution.clear();
    place(0);
    return solutions;
}

int main() {
    cout << "n:         ";
    for (int k = 1; k <= 10; k++) cout << setw(5) << k;
    cout << "\nsolutions: ";
    for (int k = 1; k <= 10; k++) cout << setw(5) << countQueens(k);
    cout << "\n\nfirst solution for n = 6 (Q = queen):\n";
    countQueens(6);
    for (int r = 0; r < 6; r++) {
        for (int c = 0; c < 6; c++) cout << (firstSolution[r] == c ? " Q" : " .");
        cout << "\n";
    }
}
