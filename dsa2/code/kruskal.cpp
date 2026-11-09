// Kruskal's minimum spanning tree (CLRS 23.2) on a disjoint-set forest.
// What: sort edges by weight; take an edge when it joins two different trees.
// Complexity: O(E log E) = O(E log V) (sort dominates; union-find is almost linear).
// Build: g++ -std=c++17 -O2 -Wall -Wextra kruskal.cpp -o kruskal
// Run:   ./kruskal < graph.txt
// Input: "n m", then m lines "u v w" (undirected edge, vertices 0..n-1, integer weight).
// Output: total weight, then the chosen edges "u v w" (a spanning forest if disconnected).
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>

struct Edge { int u, v; long long w; };

// BEGIN CORE
struct DisjointSets {
    std::vector<int> parent, rnk;
    explicit DisjointSets(int n) : parent(n), rnk(n, 0) {
        std::iota(parent.begin(), parent.end(), 0);            // MAKE-SET(v) for every v
    }
    int findSet(int x) {                                       // FIND-SET with path compression
        return parent[x] == x ? x : parent[x] = findSet(parent[x]);
    }
    bool unite(int a, int b) {                                 // UNION by rank
        a = findSet(a); b = findSet(b);
        if (a == b) return false;
        if (rnk[a] < rnk[b]) std::swap(a, b);
        parent[b] = a;
        if (rnk[a] == rnk[b]) rnk[a]++;
        return true;
    }
};
// END CORE

int main() {
    int n, m;
    std::cin >> n >> m;
    std::vector<Edge> edges(m);
    for (Edge& e : edges) std::cin >> e.u >> e.v >> e.w;

// BEGIN CORE
    // Line 3 of MST-KRUSKAL: sort edges into nondecreasing order by weight.
    std::stable_sort(edges.begin(), edges.end(),
                     [](const Edge& a, const Edge& b) { return a.w < b.w; });

    DisjointSets sets(n);
    std::vector<Edge> tree;
    long long total = 0;
    for (const Edge& e : edges) {
        // Safe edge: its endpoints lie in different trees, so it cannot close a cycle.
        if (sets.unite(e.u, e.v)) { tree.push_back(e); total += e.w; }
    }
// END CORE
    std::cout << total << "\n";
    for (const Edge& e : tree) std::cout << e.u << " " << e.v << " " << e.w << "\n";
}
