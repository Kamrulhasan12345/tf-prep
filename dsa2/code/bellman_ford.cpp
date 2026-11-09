// Bellman-Ford single-source shortest paths (CLRS 24.1); negative edge weights allowed.
// What: relax every edge |V|-1 times, then one more pass detects a reachable negative cycle.
// Complexity: O(V * E).
// Build: g++ -std=c++17 -O2 -Wall -Wextra bellman_ford.cpp -o bellman_ford
// Run:   ./bellman_ford < graph.txt
// Input: "n m s", then m lines "u v w" (directed edge u->v, vertices 0..n-1).
// Output: line 1 = d[0..n-1] ("INF" if unreachable), line 2 = pi[0..n-1] ("-" = NIL);
//         or the single line "NEGATIVE CYCLE" (CLRS returns FALSE).
#include <climits>
#include <iostream>
#include <vector>

struct Edge { int u, v; long long w; };

int main() {
    int n, m, s;
    std::cin >> n >> m >> s;
    std::vector<Edge> edges(m);
    for (Edge& e : edges) std::cin >> e.u >> e.v >> e.w;

    const long long INF = LLONG_MAX / 4;
    std::vector<long long> d(n, INF);            // INITIALIZE-SINGLE-SOURCE
    std::vector<int> pi(n, -1);
    d[s] = 0;

// BEGIN CORE
    for (int pass = 1; pass <= n - 1; pass++) {
        bool changed = false;
        for (const Edge& e : edges) {            // RELAX(u, v, w)
            if (d[e.u] < INF && d[e.u] + e.w < d[e.v]) {
                d[e.v] = d[e.u] + e.w; pi[e.v] = e.u; changed = true;
            }
        }
        if (!changed) break;                     // nothing moved, later passes cannot help
    }
    for (const Edge& e : edges) {                // CLRS lines 5-7: an edge that still relaxes
        if (d[e.u] < INF && d[e.u] + e.w < d[e.v]) {  // means a negative cycle is reachable
            std::cout << "NEGATIVE CYCLE\n";
            return 0;
        }
    }
// END CORE
    for (int v = 0; v < n; v++) {
        if (v) std::cout << " ";
        if (d[v] >= INF) std::cout << "INF"; else std::cout << d[v];
    }
    std::cout << "\n";
    for (int v = 0; v < n; v++) {
        if (v) std::cout << " ";
        if (pi[v] < 0) std::cout << "-"; else std::cout << pi[v];
    }
    std::cout << "\n";
}
