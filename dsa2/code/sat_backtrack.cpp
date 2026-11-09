// SAT by backtracking: branch on variables in order (0 first), simplify, stop on an empty clause.
// Complexity: O(2^n * size) worst case.
// Build: g++ -std=c++17 -O2 -Wall -Wextra sat_backtrack.cpp -o sat_backtrack
// Run:   ./sat_backtrack < f.txt
// Input: "nvars nclauses", then each clause as nonzero literals ending in 0 (-3 means NOT x3).
// Output: "SAT" and a line of assigned variables "v=b ...", or "UNSAT" (variables never
//         branched on, because the formula was already satisfied, are free).
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;
typedef vector<vector<int>> CNF;
vector<int> vars;                              // variables that occur, ascending
vector<pair<int, int>> asg, answer;

// BEGIN CORE
CNF simplify(const CNF& f, int v, int b) {     // set variable v to b
    CNF out;
    for (const auto& c : f) {
        bool sat = false; vector<int> r;
        for (int l : c) {
            if (abs(l) != v) r.push_back(l);
            else if ((l > 0) == (b == 1)) sat = true;     // literal true: clause satisfied
        }
        if (!sat) out.push_back(r);            // a falsified literal is simply dropped
    }
    return out;
}
bool solve(const CNF& f, size_t i) {
    for (const auto& c : f) if (c.empty()) return false;  // empty clause: dead end, backtrack
    if (f.empty()) { answer = asg; return true; }         // every clause satisfied
    for (int b = 0; b <= 1; b++) {
        asg.push_back({vars[i], b});
        if (solve(simplify(f, vars[i], b), i + 1)) return true;
        asg.pop_back();
    }
    return false;
}
// END CORE

int main() {
    int nv, nc; cin >> nv >> nc; CNF f(nc);
    for (auto& c : f) for (int l; cin >> l && l;) { c.push_back(l); vars.push_back(abs(l)); }
    sort(vars.begin(), vars.end()); vars.erase(unique(vars.begin(), vars.end()), vars.end());
    if (!solve(f, 0)) { cout << "UNSAT\n"; return 0; }
    cout << "SAT\n";
    for (auto [v, b] : answer) cout << v << "=" << b << " ";
    cout << "\n";
}
