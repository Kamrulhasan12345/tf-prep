// Ford-Fulkerson max flow (CLRS 26.2) with a DFS augmenting path.
// Complexity: O(E * |f*|) for integer capacities (can be slow for big capacities).
// Build: g++ -std=c++17 -O2 -Wall -Wextra ford_fulkerson.cpp -o ford_fulkerson
// Run:   ./ford_fulkerson < net.txt
// Input: "n m s t", then m lines "u v c" (directed, capacity c, vertices 0..n-1).
// Output: line 1 max flow, line 2 number of augmentations, line 3 min-cut side S
//         (vertices reachable from s in the final residual network).
#include <iostream>
#include <vector>
using namespace std;
int n;
vector<vector<long long>> c, f;   // capacity and net flow (f[u][v] = -f[v][u])

// BEGIN CORE
bool dfs(int u, int t, vector<int>& pi, vector<bool>& seen) {
    if (u == t) return true;
    for (int v = 0; v < n; v++)
        if (!seen[v] && c[u][v] - f[u][v] > 0) {       // residual capacity cf(u,v) > 0
            seen[v] = true; pi[v] = u;
            if (dfs(v, t, pi, seen)) return true;
        }
    return false;
}
long long fordFulkerson(int s, int t, int& rounds) {
    long long value = 0;
    for (;;) {
        vector<int> pi(n, -1); vector<bool> seen(n, false); seen[s] = true;
        if (!dfs(s, t, pi, seen)) return value;        // no augmenting path: flow is maximum
        long long b = 1LL << 60;                       // bottleneck cf(p) = min residual on p
        for (int v = t; v != s; v = pi[v]) b = min(b, c[pi[v]][v] - f[pi[v]][v]);
        for (int v = t; v != s; v = pi[v]) { f[pi[v]][v] += b; f[v][pi[v]] -= b; }
        value += b; rounds++;
    }
}
// END CORE

int main() {
    int m, s, t; cin >> n >> m >> s >> t;
    c.assign(n, vector<long long>(n, 0)); f = c;
    for (int i = 0; i < m; i++) { int u, v; long long w; cin >> u >> v >> w; c[u][v] += w; }
    int rounds = 0;
    long long value = fordFulkerson(s, t, rounds);
    vector<bool> S(n, false); vector<int> q{s}; S[s] = true;   // residual reachability = min cut
    for (size_t i = 0; i < q.size(); i++)
        for (int v = 0; v < n; v++) if (!S[v] && c[q[i]][v] - f[q[i]][v] > 0) { S[v] = true; q.push_back(v); }
    cout << value << "\n" << rounds << "\n";
    for (int v = 0; v < n; v++) if (S[v]) cout << v << " ";
    cout << "\n";
}
