// Dijkstra's single-source shortest paths (CLRS 24.3). Weights must be nonnegative.
// What: repeatedly extract the closest unsettled vertex u and relax its out-edges.
// Complexity: O((V + E) log V) with a balanced-tree priority queue.
// Build: g++ -std=c++17 -O2 -Wall -Wextra dijkstra.cpp -o dijkstra
// Run:   ./dijkstra < graph.txt
// Input: "n m s", then m lines "u v w" (directed edge u->v, w >= 0, vertices 0..n-1).
// Output: line 1 = d[0..n-1] ("INF" if unreachable), line 2 = pi[0..n-1] ("-" = NIL).
#include <climits>
#include <iostream>
#include <set>
#include <utility>
#include <vector>

int main() {
    int n, m, s;
    std::cin >> n >> m >> s;
    std::vector<std::vector<std::pair<int, long long>>> adj(n);
    for (int i = 0; i < m; i++) {
        int u, v; long long w;
        std::cin >> u >> v >> w;
        adj[u].push_back({v, w});
    }
    const long long INF = LLONG_MAX / 4;
    std::vector<long long> d(n, INF);            // INITIALIZE-SINGLE-SOURCE
    std::vector<int> pi(n, -1);
    d[s] = 0;
    std::set<std::pair<long long, int>> Q;       // min-priority queue Q = V - S, keyed by d
    for (int v = 0; v < n; v++) Q.insert({d[v], v});

// BEGIN CORE
    while (!Q.empty()) {
        auto [du, u] = *Q.begin();               // u = EXTRACT-MIN(Q)
        Q.erase(Q.begin());
        if (du >= INF) break;                    // the rest is unreachable
        for (auto [v, w] : adj[u]) {
            if (d[u] + w < d[v]) {               // RELAX(u, v, w), which is a DECREASE-KEY
                Q.erase({d[v], v});
                d[v] = d[u] + w; pi[v] = u;
                Q.insert({d[v], v});
            }
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
