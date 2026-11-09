// 0/1 knapsack by best-first branch and bound; bound = fractional (greedy) knapsack value.
// Complexity: O(2^n) worst case, usually far fewer nodes.
// Build: g++ -std=c++17 -O2 -Wall -Wextra knapsack_bb.cpp -o knapsack_bb
// Run:   ./knapsack_bb < in.txt
// Input: "n W", then n lines "weight value" (n <= 60).
// Output: best value, then the chosen item numbers (1-based, input order).
#include <algorithm>
#include <iostream>
#include <queue>
#include <vector>
using namespace std;
struct Item { int id; double w, v; };
struct Node { int level; double w, v, ub; unsigned long long mask; };
vector<Item> it; double W;

// BEGIN CORE
double bound(int i, double w, double v) {      // fill the rest greedily, last item fractionally
    for (; i < (int)it.size() && w < W; i++) {
        if (w + it[i].w <= W) { w += it[i].w; v += it[i].v; }
        else { v += it[i].v * (W - w) / it[i].w; break; }
    }
    return v;
}
double branchAndBound(unsigned long long& bestMask) {
    auto cmp = [](const Node& a, const Node& b) { return a.ub < b.ub; };
    priority_queue<Node, vector<Node>, decltype(cmp)> open(cmp);   // largest bound first
    double best = 0; open.push({0, 0, 0, bound(0, 0, 0), 0});
    while (!open.empty()) {
        Node n = open.top(); open.pop();
        if (n.ub <= best || n.level == (int)it.size()) continue;   // prune: cannot beat best
        const Item& x = it[n.level];
        if (n.w + x.w <= W) {                                      // child 1: take the item
            Node c{n.level + 1, n.w + x.w, n.v + x.v, 0, n.mask | 1ULL << n.level};
            if (c.v > best) { best = c.v; bestMask = c.mask; }
            c.ub = bound(c.level, c.w, c.v); if (c.ub > best) open.push(c);
        }
        Node c{n.level + 1, n.w, n.v, bound(n.level + 1, n.w, n.v), n.mask};   // child 2: skip it
        if (c.ub > best) open.push(c);
    }
    return best;
}
// END CORE

int main() {
    int n; cin >> n >> W;
    for (int i = 0; i < n; i++) { Item x; x.id = i + 1; cin >> x.w >> x.v; it.push_back(x); }
    stable_sort(it.begin(), it.end(), [](const Item& a, const Item& b) { return a.v * b.w > b.v * a.w; });
    unsigned long long mask = 0; double best = branchAndBound(mask);
    cout << (long long)best << "\n";
    vector<int> ids;
    for (int i = 0; i < n; i++) if (mask >> i & 1) ids.push_back(it[i].id);
    sort(ids.begin(), ids.end());
    for (int id : ids) cout << id << " ";
    cout << "\n";
}
