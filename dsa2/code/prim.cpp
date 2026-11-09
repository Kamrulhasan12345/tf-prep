// Prim's minimum spanning tree (CLRS 23.2) with a min-priority queue keyed on key[v].
// What: grow one tree from root 0; always add the cheapest edge leaving the tree.
// Complexity: O(E log V) with a balanced-tree priority queue (O(V^2) with a plain array).
// Build: g++ -std=c++17 -O2 -Wall -Wextra prim.cpp -o prim
// Run:   ./prim < graph.txt
// Input: "n m", then m lines "u v w" (undirected, vertices 0..n-1). Graph assumed connected.
// Output: total weight, then the tree edges "pi[v] v w" in the order vertices were extracted.
#include <climits>
#include <iostream>
#include <set>
#include <utility>
#include <vector>

int main() {
    int n, m;
    std::cin >> n >> m;
    std::vector<std::vector<std::pair<int, long long>>> adj(n);
    for (int i = 0; i < m; i++) {
        int u, v; long long w;
        std::cin >> u >> v >> w;
        adj[u].push_back({v, w});
        adj[v].push_back({u, w});
    }
    const long long INF = LLONG_MAX / 4;
    std::vector<long long> key(n, INF);          // key[v]: cheapest edge weight linking v to the tree
    std::vector<int> pi(n, -1);                  // pi[v]: that edge's other endpoint (NIL = -1)
    std::vector<bool> inQ(n, true);
    std::set<std::pair<long long, int>> Q;       // ordered by (key, vertex): EXTRACT-MIN = begin()
// BEGIN CORE
    key[0] = 0;
    for (int v = 0; v < n; v++) Q.insert({key[v], v});

    long long total = 0;
    std::vector<int> order;
    while (!Q.empty()) {
        int u = Q.begin()->second;               // EXTRACT-MIN
        Q.erase(Q.begin());
        inQ[u] = false;
        if (pi[u] != -1) { total += key[u]; order.push_back(u); }
        for (auto [v, w] : adj[u]) {
            if (inQ[v] && w < key[v]) {          // DECREASE-KEY(v, w): erase and reinsert
                Q.erase({key[v], v});
                key[v] = w; pi[v] = u;
                Q.insert({key[v], v});
            }
        }
    }
// END CORE
    std::cout << total << "\n";
    for (int v : order) std::cout << pi[v] << " " << v << " " << key[v] << "\n";
}
