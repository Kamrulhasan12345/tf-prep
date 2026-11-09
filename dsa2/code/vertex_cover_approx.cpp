// 2-approximation for vertex cover (CLRS 35.1, APPROX-VERTEX-COVER).
// Pick an uncovered edge, take both endpoints. Those edges form a matching, and any cover needs
// one endpoint of each, so |C| = 2|M| <= 2 OPT.
// Complexity: O(V + E).
// Build: g++ -std=c++17 -O2 -Wall -Wextra vertex_cover_approx.cpp -o vertex_cover_approx
// Run:   ./vertex_cover_approx < g.txt
// Input: "n m", then m lines "u v" (undirected, vertices 0..n-1).
// Output: cover size, then the cover vertices.
#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n, m; cin >> n >> m;
    vector<bool> inC(n, false);
// BEGIN CORE
    for (int i = 0; i < m; i++) {
        int u, v; cin >> u >> v;
        if (!inC[u] && !inC[v]) inC[u] = inC[v] = true;   // edge still uncovered: add both ends
    }                                                     // (covered edges are "removed" implicitly)
// END CORE
    int size = 0; for (int v = 0; v < n; v++) size += inC[v];
    cout << size << "\n";
    for (int v = 0; v < n; v++) if (inC[v]) cout << v << " ";
    cout << "\n";
}
