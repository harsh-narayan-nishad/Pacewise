#include <bits/stdc++.h>
using namespace std;
typedef vector<vector<long long>> Mat;
long long mulCount = 0;                                   // scalar multiplications performed

Mat makeMat(int n) { return Mat(n, vector<long long>(n, 0)); }
Mat naiveMul(const Mat& A, const Mat& B) {
    int n = A.size();
    Mat C = makeMat(n);
    for (int i = 0; i < n; i++)
        for (int k = 0; k < n; k++)
            for (int j = 0; j < n; j++) { C[i][j] += A[i][k] * B[k][j]; mulCount++; }
    return C;
}
Mat addM(const Mat& A, const Mat& B, int sign = 1) {
    int n = A.size();
    Mat C = makeMat(n);
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) C[i][j] = A[i][j] + sign * B[i][j];
    return C;
}
Mat block(const Mat& A, int r, int c, int h) {
    Mat X = makeMat(h);
    for (int i = 0; i < h; i++) for (int j = 0; j < h; j++) X[i][j] = A[r + i][c + j];
    return X;
}
void place(Mat& C, const Mat& X, int r, int c) {
    for (size_t i = 0; i < X.size(); i++) for (size_t j = 0; j < X.size(); j++) C[r + i][c + j] = X[i][j];
}

Mat strassen(const Mat& A, const Mat& B, int cutoff) {    // n must be a power of two
    int n = A.size();
    if (n <= cutoff) return naiveMul(A, B);
    int h = n / 2;
    Mat A11 = block(A, 0, 0, h), A12 = block(A, 0, h, h), A21 = block(A, h, 0, h), A22 = block(A, h, h, h);
    Mat B11 = block(B, 0, 0, h), B12 = block(B, 0, h, h), B21 = block(B, h, 0, h), B22 = block(B, h, h, h);
    Mat M1 = strassen(addM(A11, A22), addM(B11, B22), cutoff);
    Mat M2 = strassen(addM(A21, A22), B11, cutoff);
    Mat M3 = strassen(A11, addM(B12, B22, -1), cutoff);
    Mat M4 = strassen(A22, addM(B21, B11, -1), cutoff);
    Mat M5 = strassen(addM(A11, A12), B22, cutoff);
    Mat M6 = strassen(addM(A21, A11, -1), addM(B11, B12), cutoff);
    Mat M7 = strassen(addM(A12, A22, -1), addM(B21, B22), cutoff);
    Mat C = makeMat(n);
    place(C, addM(addM(M1, M4), addM(M7, M5, -1)), 0, 0);   // C11 = M1 + M4 - M5 + M7
    place(C, addM(M3, M5), 0, h);                           // C12 = M3 + M5
    place(C, addM(M2, M4), h, 0);                           // C21 = M2 + M4
    place(C, addM(addM(M1, M2, -1), addM(M3, M6)), h, h);   // C22 = M1 - M2 + M3 + M6
    return C;
}

Mat multiply(const Mat& A, const Mat& B, int cutoff = 32) {      // any n: pad to a power of two
    int n = A.size(), m = 1;
    while (m < n) m <<= 1;
    Mat PA = makeMat(m), PB = makeMat(m);
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) { PA[i][j] = A[i][j]; PB[i][j] = B[i][j]; }
    Mat PC = strassen(PA, PB, cutoff), C = makeMat(n);
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) C[i][j] = PC[i][j];
    return C;
}

int main() {
    Mat A = {{1, 2}, {3, 4}}, B = {{5, 6}, {7, 8}};
    Mat C = strassen(A, B, 1);                                    // cutoff 1: apply the 7-product formulas down to scalars
    cout << "[[1,2],[3,4]] x [[5,6],[7,8]] = [[" << C[0][0] << "," << C[0][1] << "],[" << C[1][0] << "," << C[1][1] << "]]\n";

    mt19937 rng(4);
    for (int n : {8, 64}) {                                       // count scalar multiplications
        Mat X = makeMat(n), Y = makeMat(n);
        for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) { X[i][j] = rng() % 7; Y[i][j] = rng() % 7; }
        mulCount = 0; strassen(X, Y, 1); long long s = mulCount;
        mulCount = 0; naiveMul(X, Y);    long long c = mulCount;
        cout << "n = " << setw(2) << n << ": Strassen uses " << setw(6) << s << " multiplications (7^log2 n), classical uses " << c << " (n^3)\n";
    }

    int n = 100;                                                  // correctness for a non power of two, with a cutoff
    Mat X = makeMat(n), Y = makeMat(n);
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) { X[i][j] = (int)(rng() % 21) - 10; Y[i][j] = (int)(rng() % 21) - 10; }
    cout << "100 x 100 random product equals the classical product: " << (multiply(X, Y, 16) == naiveMul(X, Y) ? "yes" : "NO") << "\n";
}
