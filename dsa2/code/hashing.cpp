// Hash tables: chaining, linear, quadratic and double probing (CLRS ch. 11), h(k) = k mod m.
// Build: g++ -std=c++17 -O2 -Wall -Wextra hashing.cpp -o hashing
// Run:   ./hashing < in.txt
// Input: "mode m c1 c2" (mode = chain|linear|quad|double), then "n k1 .. kn".
//   linear: (h + c1 i) mod m; quad: (h + c1 i + c2 i^2) mod m; double: (h + i (c1 - k mod c1)) mod m.
// Output: m lines (slot contents, "-" if empty, chain in insertion order), then
//   "collisions N" (chain: keys landing on a used slot; open: total unsuccessful probes).
#include <iostream>
#include <string>
#include <vector>
using namespace std;
string mode; long long m, c1, c2;

// BEGIN CORE
long long probe(long long k, long long i) {          // slot examined on probe number i
    long long h = k % m;
    if (mode == "linear") return (h + c1 * i) % m;
    if (mode == "quad") return (h + c1 * i + c2 * i * i) % m;
    return (h + i * (c1 - k % c1)) % m;              // double hashing, h2 = c1 - k mod c1
}
// END CORE

int main() {
    int n; cin >> mode >> m >> c1 >> c2 >> n;
    vector<vector<long long>> T(m); vector<bool> used(m, false);
    long long bad = 0;
    for (int j = 0; j < n; j++) {
        long long k; cin >> k;
        if (mode == "chain") { bad += !T[k % m].empty(); T[k % m].push_back(k); continue; }
        for (long long i = 0; i < 3 * m; i++) {
            long long s = probe(k, i);
            if (!used[s]) { used[s] = true; T[s].push_back(k); bad += i; break; }
        }
    }
    for (int i = 0; i < m; i++) {
        if (T[i].empty()) cout << "-";
        for (size_t j = 0; j < T[i].size(); j++) cout << (j ? " " : "") << T[i][j];
        cout << "\n";
    }
    cout << "collisions " << bad << "\n";
}
