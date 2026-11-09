// Maximum bipartite matching by augmenting paths (Ford-Fulkerson on a unit network, CLRS 26.3).
// Complexity: O(V E).
// Build: g++ -std=c++17 -O2 -Wall -Wextra bipartite_matching.cpp -o bipartite_matching
// Run:   ./bipartite_matching < g.txt
// Input: "nl nr m", then m lines "l r" (left 0..nl-1, right 0..nr-1).
// Output: matching size, then the pairs "l r".
#include <iostream>
#include <vector>
using namespace std;
vector<vector<int>> adj; vector<int> matchR; vector<bool> seen;

// BEGIN CORE
bool augment(int u) {                       // look for an augmenting path starting at free vertex u
    for (int v : adj[u]) {
        if (seen[v]) continue;
        seen[v] = true;
        if (matchR[v] < 0 || augment(matchR[v])) { matchR[v] = u; return true; }  // flip the path
    }
    return false;
}
// END CORE

int main() {
    int nl, nr, m; cin >> nl >> nr >> m;
    adj.assign(nl, {}); matchR.assign(nr, -1);
    for (int i = 0; i < m; i++) { int l, r; cin >> l >> r; adj[l].push_back(r); }
    int size = 0;
    for (int u = 0; u < nl; u++) { seen.assign(nr, false); if (augment(u)) size++; }
    cout << size << "\n";
    for (int r = 0; r < nr; r++) if (matchR[r] >= 0) cout << matchR[r] << " " << r << "\n";
}
