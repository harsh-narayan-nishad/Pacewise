#include <bits/stdc++.h>
using namespace std;

struct P {
    long long x, y;
    bool operator<(const P& o) const { return x < o.x || (x == o.x && y < o.y); }
    bool operator==(const P& o) const { return x == o.x && y == o.y; }
};
long long cross(const P& a, const P& b, const P& c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }

// ---- Quickhull: divide and conquer ----
void hullSide(const vector<P>& pts, P a, P b, vector<P>& hull) {   // points strictly left of the directed line a->b
    long long best = 0;
    int idx = -1;
    vector<P> left;
    for (const P& p : pts) {
        long long c = cross(a, b, p);
        if (c > 0) { if (c > best) { best = c; idx = (int)left.size(); } left.push_back(p); }
    }
    if (idx < 0) return;                                           // nothing outside this edge
    P far = left[idx];                                             // farthest point = a hull vertex
    hullSide(left, a, far, hull);
    hull.push_back(far);
    hullSide(left, far, b, hull);
}
vector<P> quickHull(vector<P> pts) {
    sort(pts.begin(), pts.end());
    pts.erase(unique(pts.begin(), pts.end()), pts.end());
    if (pts.size() < 3) return pts;
    P A = pts.front(), B = pts.back();                             // leftmost and rightmost points are on the hull
    vector<P> hull;
    hull.push_back(A);
    hullSide(pts, A, B, hull);                                     // upper chain
    hull.push_back(B);
    hullSide(pts, B, A, hull);                                     // lower chain
    return hull;                                                   // clockwise order
}

// ---- Andrew's monotone chain (Graham scan variant): O(n log n) ----
vector<P> monotoneChain(vector<P> pts) {
    sort(pts.begin(), pts.end());
    pts.erase(unique(pts.begin(), pts.end()), pts.end());
    int n = pts.size();
    if (n < 3) return pts;
    vector<P> h(2 * n);
    int k = 0;
    for (int i = 0; i < n; i++) {                                  // lower hull
        while (k >= 2 && cross(h[k - 2], h[k - 1], pts[i]) <= 0) k--;
        h[k++] = pts[i];
    }
    for (int i = n - 2, t = k + 1; i >= 0; i--) {                  // upper hull
        while (k >= t && cross(h[k - 2], h[k - 1], pts[i]) <= 0) k--;
        h[k++] = pts[i];
    }
    h.resize(k - 1);
    return h;                                                      // counter-clockwise order
}

void show(const char* name, const vector<P>& h) {
    cout << name;
    for (const P& p : h) cout << " (" << p.x << "," << p.y << ")";
    cout << "\n";
}

int main() {
    vector<P> pts = {{0, 3}, {1, 1}, {2, 2}, {4, 4}, {0, 0}, {1, 2}, {3, 1}, {3, 3}};
    show("quickhull     :", quickHull(pts));
    show("monotone chain:", monotoneChain(pts));

    mt19937 rng(8);                                                // both algorithms must find the same vertex set
    bool ok = true;
    for (int t = 0; t < 300; t++) {
        vector<P> v(3 + rng() % 60);
        for (P& p : v) p = {(long long)(rng() % 30), (long long)(rng() % 30)};
        vector<P> a = quickHull(v), b = monotoneChain(v);
        sort(a.begin(), a.end()); sort(b.begin(), b.end());
        ok = ok && a == b;
    }
    cout << "300 random point sets: quickhull and monotone chain agree: " << (ok ? "yes" : "NO") << "\n";
}
