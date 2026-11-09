// Karger's randomized minimum cut: contract random edges until two super-vertices remain.
// One run finds a min cut with probability >= 2/(n(n-1)); repeat n^2 ln n times for 1 - 1/n.
// Complexity: O(m alpha(n)) per run with a shuffled edge list and union-find.
// Build: g++ -std=c++17 -O2 -Wall -Wextra karger.cpp -o karger
// Run:   ./karger [trials [seed]] < g.txt      (default trials = ceil(n^2 ln n))
// Input: "n m", then m lines "u v" (undirected multigraph, vertices 0..n-1, n >= 2).
// Output: the smallest cut size seen, then the vertices of one side.
#include <algorithm>
#include <cmath>
#include <iostream>
#include <numeric>
#include <random>
#include <vector>
using namespace std;
int n; vector<pair<int, int>> E; vector<int> par; mt19937 rng;
int fnd(int x) { return par[x] == x ? x : par[x] = fnd(par[x]); }

// BEGIN CORE
int contractOnce(vector<int>& side) {
    iota(par.begin(), par.end(), 0);
    shuffle(E.begin(), E.end(), rng);          // a random order = repeatedly picking a random edge
    int comps = n;
    for (auto [u, v] : E) {
        if (comps == 2) break;
        int a = fnd(u), b = fnd(v);
        if (a != b) { par[a] = b; comps--; }   // contract; edges inside a super-vertex are skipped
    }
    int root = fnd(0), cut = 0;                // edges between different super-vertices = the cut
    for (auto [u, v] : E) cut += fnd(u) != fnd(v);
    side.clear();
    for (int v = 0; v < n; v++) if (fnd(v) == root) side.push_back(v);
    return cut;
}
// END CORE

int main(int argc, char** argv) {
    int m; cin >> n >> m; E.resize(m); par.resize(n);
    for (auto& e : E) cin >> e.first >> e.second;
    long long trials = argc > 1 ? stoll(argv[1]) : (long long)ceil(n * (double)n * log((double)n));
    rng.seed(argc > 2 ? (unsigned)stoul(argv[2]) : random_device{}());
    int best = -1; vector<int> bestSide, side;
    for (long long t = 0; t < max(1LL, trials); t++) {
        int cut = contractOnce(side);
        if (best < 0 || cut < best) { best = cut; bestSide = side; }
    }
    cout << best << "\n";
    for (int v : bestSide) cout << v << " ";
    cout << "\n";
}
