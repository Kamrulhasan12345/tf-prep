// Floyd-Warshall all-pairs shortest paths (CLRS 25.2); negative edges allowed.
// What: d[i][j] after round k = shortest i->j path using only intermediates 0..k.
// Complexity: Theta(V^3) time, Theta(V^2) space.
// Build: g++ -std=c++17 -O2 -Wall -Wextra floyd_warshall.cpp -o floyd_warshall
// Run:   ./floyd_warshall < graph.txt
// Input: "n m", then m lines "u v w" (directed edge u->v, vertices 0..n-1).
// Output: n lines of D ("INF" = no path), then n lines of the predecessor matrix Pi
//         ("-" = NIL); or "NEGATIVE CYCLE" if some D[i][i] < 0.
#include <climits>
#include <iostream>
#include <vector>

int main() {
    int n, m;
    std::cin >> n >> m;
    const long long INF = LLONG_MAX / 4;
    std::vector<std::vector<long long>> d(n, std::vector<long long>(n, INF));
    std::vector<std::vector<int>> pi(n, std::vector<int>(n, -1));
    for (int i = 0; i < n; i++) d[i][i] = 0;     // D(0): weight matrix, 0 on the diagonal
    for (int e = 0; e < m; e++) {
        int u, v; long long w;
        std::cin >> u >> v >> w;
        if (u != v && w < d[u][v]) { d[u][v] = w; pi[u][v] = u; }   // keep the lighter parallel edge
        else if (u == v && w < d[u][u]) { d[u][u] = w; }            // negative self-loop
    }
// BEGIN CORE
    for (int k = 0; k < n; k++)                  // D(k) from D(k-1): allow k as intermediate
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                if (d[i][k] < INF && d[k][j] < INF && d[i][k] + d[k][j] < d[i][j]) {
                    d[i][j] = d[i][k] + d[k][j];
                    pi[i][j] = pi[k][j];         // the last hop of i->j is the last hop of k->j
                }
// END CORE
    for (int i = 0; i < n; i++)
        if (d[i][i] < 0) { std::cout << "NEGATIVE CYCLE\n"; return 0; }
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            if (j) std::cout << " ";
            if (d[i][j] >= INF) std::cout << "INF"; else std::cout << d[i][j];
        }
        std::cout << "\n";
    }
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            if (j) std::cout << " ";
            if (pi[i][j] < 0) std::cout << "-"; else std::cout << pi[i][j];
        }
        std::cout << "\n";
    }
}
