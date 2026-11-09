// Johnson's all-pairs shortest paths for sparse graphs (CLRS 25.3).
// What: Bellman-Ford from a virtual source gives potentials h; reweight
//       w'(u,v) = w(u,v) + h(u) - h(v) >= 0; run Dijkstra from every vertex; undo the shift.
// Complexity: O(V E + V (V + E) log V) = O(V^2 log V + V E) with a good heap.
// Build: g++ -std=c++17 -O2 -Wall -Wextra johnson.cpp -o johnson
// Run:   ./johnson < graph.txt
// Input: "n m", then m lines "u v w" (directed edge u->v, vertices 0..n-1, w may be negative).
// Output: n lines of D ("INF" = no path), or "NEGATIVE CYCLE".
#include <climits>
#include <iostream>
#include <set>
#include <utility>
#include <vector>

struct Edge { int u, v; long long w; };

int main() {
    int n, m;
    std::cin >> n >> m;
    std::vector<Edge> edges(m);
    for (Edge& e : edges) std::cin >> e.u >> e.v >> e.w;
    const long long INF = LLONG_MAX / 4;

    // G' adds vertex s with a 0-weight edge to every vertex, so Bellman-Ford from s starts
    // with h[v] = 0 for all v (that is the first relaxation of the new edges).
// BEGIN CORE
    std::vector<long long> h(n, 0);
    for (int pass = 1; pass <= n; pass++) {      // n+1 vertices in G', so n passes
        bool changed = false;
        for (const Edge& e : edges)
            if (h[e.u] + e.w < h[e.v]) { h[e.v] = h[e.u] + e.w; changed = true; }
        if (!changed) break;
        if (pass == n) { std::cout << "NEGATIVE CYCLE\n"; return 0; }  // still relaxing
    }

    // Reweight: every w' is >= 0 because h(v) <= h(u) + w(u,v) (triangle inequality).
    std::vector<std::vector<std::pair<int, long long>>> adj(n);
    for (const Edge& e : edges) adj[e.u].push_back({e.v, e.w + h[e.u] - h[e.v]});

    std::vector<std::vector<long long>> D(n, std::vector<long long>(n, INF));
    for (int u = 0; u < n; u++) {                // Dijkstra from each u on the reweighted graph
        std::vector<long long> d(n, INF);
        d[u] = 0;
        std::set<std::pair<long long, int>> Q;
        Q.insert({0, u});
        while (!Q.empty()) {
            auto [du, x] = *Q.begin();
            Q.erase(Q.begin());
            for (auto [y, w] : adj[x])
                if (du + w < d[y]) {
                    Q.erase({d[y], y});
                    d[y] = du + w;
                    Q.insert({d[y], y});
                }
        }
        for (int v = 0; v < n; v++)              // line 12: d(u,v) = d'(u,v) + h(v) - h(u)
            if (d[v] < INF) D[u][v] = d[v] + h[v] - h[u];
    }
// END CORE
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            if (j) std::cout << " ";
            if (D[i][j] >= INF) std::cout << "INF"; else std::cout << D[i][j];
        }
        std::cout << "\n";
    }
}
