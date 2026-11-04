#include <bits/stdc++.h>
using namespace std;

struct HNode {
    char ch; int freq; HNode *left, *right;
    HNode(char c, int f, HNode* l = nullptr, HNode* r = nullptr) : ch(c), freq(f), left(l), right(r) {}
};
struct Cmp { bool operator()(HNode* a, HNode* b) const { return a->freq > b->freq; } };

void assignCodes(HNode* x, const string& code, map<char, string>& out) {
    if (!x) return;
    if (!x->left && !x->right) { out[x->ch] = code.empty() ? "0" : code; return; }
    assignCodes(x->left, code + "0", out);
    assignCodes(x->right, code + "1", out);
}

int main() {
    vector<pair<char, int>> freq = {{'a', 45}, {'b', 13}, {'c', 12}, {'d', 16}, {'e', 9}, {'f', 5}};
    priority_queue<HNode*, vector<HNode*>, Cmp> pq;
    for (auto [c, f] : freq) pq.push(new HNode(c, f));
    while (pq.size() > 1) {                                       // merge the two rarest nodes
        HNode* a = pq.top(); pq.pop();
        HNode* b = pq.top(); pq.pop();
        pq.push(new HNode('\0', a->freq + b->freq, a, b));
    }
    map<char, string> codes;
    assignCodes(pq.top(), "", codes);
    int bits = 0;
    for (auto [c, f] : freq) { cout << c << " (freq " << setw(2) << f << ") -> " << codes[c] << "\n"; bits += f * (int)codes[c].size(); }
    int total = 0;
    for (auto [c, f] : freq) total += f;
    cout << "total bits = " << bits << " versus " << 3 * total << " with fixed 3-bit codes\n";
}
