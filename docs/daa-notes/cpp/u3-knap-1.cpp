#include <bits/stdc++.h>
using namespace std;

struct Item { int value, weight; };

double fractionalKnapsack(vector<Item> items, int W) {
    sort(items.begin(), items.end(), [](const Item& a, const Item& b) {
        return (double)a.value / a.weight > (double)b.value / b.weight;        // best ratio first
    });
    double total = 0;
    for (const Item& it : items) {
        if (W == 0) break;
        int take = min(W, it.weight);                                          // whole item, or the fraction that fits
        total += (double)it.value * take / it.weight;
        W -= take;
    }
    return total;
}

int knapsack01(const vector<Item>& items, int W) {                              // DP, for comparison (see Unit IV)
    vector<int> dp(W + 1, 0);
    for (const Item& it : items)
        for (int w = W; w >= it.weight; w--) dp[w] = max(dp[w], dp[w - it.weight] + it.value);
    return dp[W];
}

int greedy01(vector<Item> items, int W) {                                       // greedy by ratio but items cannot be split
    sort(items.begin(), items.end(), [](const Item& a, const Item& b) {
        return (double)a.value / a.weight > (double)b.value / b.weight;
    });
    int total = 0;
    for (const Item& it : items) if (it.weight <= W) { total += it.value; W -= it.weight; }
    return total;
}

int main() {
    vector<Item> items = {{60, 10}, {100, 20}, {120, 30}};
    int W = 50;
    cout << "fractional knapsack (greedy)        : " << fractionalKnapsack(items, W) << "   (60 + 100 + 2/3 of 120)\n";
    cout << "0/1 knapsack, greedy by ratio       : " << greedy01(items, W) << "   (not optimal)\n";
    cout << "0/1 knapsack, dynamic programming   : " << knapsack01(items, W) << "   (items 2 and 3)\n";
}
