// Transitive closure of a directed graph by Warshall's recurrence (CLRS 25.2).
// What: t[i][j] = 1 iff j is reachable from i. Same loops as Floyd-Warshall with OR/AND.
// Complexity: Theta(V^3) time, Theta(V^2) space.
// Build: g++ -std=c++17 -O2 -Wall -Wextra transitive_closure.cpp -o transitive_closure
// Run:   ./transitive_closure < graph.txt
// Input: "n m", then m lines "u v" (directed edge u->v, vertices 0..n-1).
// Output: n lines of n digits (the closure matrix T, space separated).
#include <iostream>
#include <vector>

int main() {
    int n, m;
    std::cin >> n >> m;
    std::vector<std::vector<int>> t(n, std::vector<int>(n, 0));
    for (int i = 0; i < n; i++) t[i][i] = 1;     // T(0): 1 on the diagonal and on every edge
    for (int e = 0; e < m; e++) {
        int u, v;
        std::cin >> u >> v;
        t[u][v] = 1;
    }
// BEGIN CORE
    for (int k = 0; k < n; k++)
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                t[i][j] = t[i][j] | (t[i][k] & t[k][j]);   // path i->k and k->j gives i->j
// END CORE
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) std::cout << (j ? " " : "") << t[i][j];
        std::cout << "\n";
    }
}
