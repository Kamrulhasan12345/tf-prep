// Single-source shortest paths in a DAG (CLRS 24.2); negative weights allowed.
// What: topologically sort with DFS, then relax each vertex's out-edges once in that order.
// Complexity: O(V + E).
// Build: g++ -std=c++17 -O2 -Wall -Wextra dag_sssp.cpp -o dag_sssp
// Run:   ./dag_sssp < graph.txt
// Input: "n m s", then m lines "u v w" (directed edge u->v, vertices 0..n-1).
// Output: line 1 = d[0..n-1] ("INF" if unreachable), line 2 = pi[0..n-1] ("-" = NIL);
//         or "NOT A DAG" if the DFS meets a back edge.
#include <algorithm>
#include <climits>
#include <iostream>
#include <vector>

int n;
std::vector<std::vector<std::pair<int, long long>>> adj;
std::vector<int> color;          // 0 white, 1 gray, 2 black
std::vector<int> topo;           // vertices in decreasing finishing time
bool cyclic = false;

void dfsVisit(int u) {
    color[u] = 1;
    for (auto [v, w] : adj[u]) {
        (void)w;
        if (color[v] == 1) cyclic = true;        // back edge: not acyclic
        else if (color[v] == 0) dfsVisit(v);
    }
    color[u] = 2;
    topo.push_back(u);                           // finished: pushed in increasing finish time
}

int main() {
    int m, s;
    std::cin >> n >> m >> s;
    adj.assign(n, {});
    for (int i = 0; i < m; i++) {
        int u, v; long long w;
        std::cin >> u >> v >> w;
        adj[u].push_back({v, w});
    }
    color.assign(n, 0);
    for (int v = 0; v < n; v++) if (color[v] == 0) dfsVisit(v);
    if (cyclic) { std::cout << "NOT A DAG\n"; return 0; }
// BEGIN CORE
    std::reverse(topo.begin(), topo.end());      // line 1: topologically sort the vertices

    const long long INF = LLONG_MAX / 4;
    std::vector<long long> d(n, INF);            // INITIALIZE-SINGLE-SOURCE
    std::vector<int> pi(n, -1);
    d[s] = 0;
    for (int u : topo) {                         // lines 3-5: u's final distance is settled
        if (d[u] >= INF) continue;               // unreachable from s, nothing to relax
        for (auto [v, w] : adj[u])
            if (d[u] + w < d[v]) { d[v] = d[u] + w; pi[v] = u; }   // RELAX
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
