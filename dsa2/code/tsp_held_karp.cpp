// Travelling salesman by Held-Karp dynamic programming (start and end at city 1).
// g(i, S) = cheapest way from i through every city of S and then home.
// Complexity: O(n^2 2^n) time, O(n 2^n) space.
// Build: g++ -std=c++17 -O2 -Wall -Wextra tsp_held_karp.cpp -o tsp_held_karp
// Run:   ./tsp_held_karp < in.txt
// Input: "n" then an n x n cost matrix c[i][j] (n >= 2, up to about 16).
// Output: optimal cost, then the tour with 1-based city numbers.
#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n; cin >> n;
    vector<vector<long long>> c(n, vector<long long>(n));
    for (auto& r : c) for (auto& x : r) cin >> x;
    int full = (1 << n) - 2;                       // S ranges over subsets of cities 1..n-1 (bit 0 unused)
    vector<vector<long long>> g(1 << n, vector<long long>(n, 0));
    vector<vector<int>> next(1 << n, vector<int>(n, -1));
// BEGIN CORE
    for (int i = 1; i < n; i++) g[0][i] = c[i][0];             // g(i, empty) = c[i][1]
    for (int S = 2; S < full; S += 2)                          // increasing S: subsets come first
        for (int i = 1; i < n; i++) {
            if (S >> i & 1) continue;
            long long best = -1;
            for (int j = 1; j < n; j++)                        // j = next city after i
                if ((S >> j & 1) && (best < 0 || c[i][j] + g[S ^ (1 << j)][j] < best)) {
                    best = c[i][j] + g[S ^ (1 << j)][j]; next[S][i] = j;
                }
            g[S][i] = best;
        }
    long long cost = -1; int first = -1;                       // g(1, all others)
    for (int j = 1; j < n; j++)
        if (cost < 0 || c[0][j] + g[full ^ (1 << j)][j] < cost) { cost = c[0][j] + g[full ^ (1 << j)][j]; first = j; }
// END CORE
    cout << cost << "\n1";
    int S = full, j = first;
    while (j >= 0) { cout << " " << j + 1; S ^= 1 << j; j = S ? next[S][j] : -1; }
    cout << " 1\n";
}
