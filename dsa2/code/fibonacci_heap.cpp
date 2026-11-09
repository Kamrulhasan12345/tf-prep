// Fibonacci min-heap (CLRS ch. 19): insert, extract-min, decrease-key, delete.
// Complexity: O(1) insert / decrease-key amortized, O(log n) extract-min amortized.
// Keys are assumed distinct. Root list and child lists are vectors (clearer than circular lists).
// Conventions: insert goes just left of min; cut nodes go to the end of the root list; linked
//   children go to the end of the child list; a linked tree keeps the slot of the later root.
// Build: g++ -std=c++17 -O2 -Wall -Wextra fibonacci_heap.cpp -o fibonacci_heap
// Run:   ./fibonacci_heap < ops.txt
// Input: "q", then q lines: "insert k", "extract", "decrease old new", "delete k".
// Output: line 1 root list as k(child ...), line 2 "min=K" (or none), line 3 marked keys sorted.
#include <algorithm>
#include <climits>
#include <iostream>
#include <string>
#include <vector>
using namespace std;
struct Node { int key; bool mark; Node* p; vector<Node*> ch; };
vector<Node*> roots; Node* mn = nullptr;

// BEGIN CORE
void consolidate(size_t start) {              // start = root right of the removed min
    rotate(roots.begin(), roots.begin() + start % roots.size(), roots.end());
    vector<Node*> slot = roots, A(64, nullptr); vector<size_t> pos(64, 0);
    for (size_t i = 0; i < slot.size(); i++) {
        Node* x = slot[i]; size_t d = x->ch.size();
        while (A[d]) {                        // another root of degree d: link them
            Node* y = A[d]; slot[pos[d]] = nullptr; A[d] = nullptr;
            if (y->key < x->key) swap(x, y);  // the larger key goes under the smaller
            y->p = x; y->mark = false; x->ch.push_back(y);   // FIB-HEAP-LINK
            d++;
        }
        A[d] = x; pos[d] = i; slot[i] = x;
    }
    roots.clear(); mn = nullptr;
    for (Node* r : slot) if (r) { roots.push_back(r); if (!mn || r->key < mn->key) mn = r; }
}
void cut(Node* x, Node* y) {                  // FIB-HEAP-CUT: move x from y's children to the roots
    y->ch.erase(find(y->ch.begin(), y->ch.end(), x));
    x->p = nullptr; x->mark = false; roots.push_back(x);
}
void cascadingCut(Node* y) {
    Node* z = y->p;
    if (!z) return;
    if (!y->mark) y->mark = true;             // first child lost: just mark
    else { cut(y, z); cascadingCut(z); }      // second child lost: cut too, and recurse up
}
void decreaseKey(Node* x, int k) {
    x->key = k; Node* y = x->p;
    if (y && x->key < y->key) { cut(x, y); cascadingCut(y); }
    if (x->key < mn->key) mn = x;
}
void extractMin() {
    Node* z = mn; if (!z) return;
    size_t i = find(roots.begin(), roots.end(), z) - roots.begin();
    for (Node* c : z->ch) { c->p = nullptr; c->mark = false; }   // children become roots
    roots.erase(roots.begin() + i); roots.insert(roots.begin() + i, z->ch.begin(), z->ch.end());
    size_t k = z->ch.size(); delete z; mn = nullptr;
    if (!roots.empty()) consolidate(i + k);
}
// END CORE

void insertKey(int k) {                       // FIB-HEAP-INSERT: O(1), no consolidation
    Node* x = new Node{k, false, nullptr, {}};
    roots.insert(mn ? find(roots.begin(), roots.end(), mn) : roots.begin(), x);
    if (!mn || k < mn->key) mn = x;
}
Node* findKey(const vector<Node*>& v, int k) {
    for (Node* n : v) { if (n->key == k) return n; if (Node* r = findKey(n->ch, k)) return r; }
    return nullptr;
}
void print(const vector<Node*>& v) {
    for (size_t i = 0; i < v.size(); i++) {
        cout << (i ? " " : "") << v[i]->key;
        if (!v[i]->ch.empty()) { cout << "("; print(v[i]->ch); cout << ")"; }
    }
}
void marks(const vector<Node*>& v, vector<int>& out) { for (Node* n : v) { if (n->mark) out.push_back(n->key); marks(n->ch, out); } }
int main() {
    int q; cin >> q;
    while (q--) {
        string op; cin >> op;
        if (op == "insert") { int k; cin >> k; insertKey(k); }
        else if (op == "extract") extractMin();
        else if (op == "decrease") { int a, b; cin >> a >> b; if (Node* x = findKey(roots, a)) decreaseKey(x, b); }
        else { int k; cin >> k; if (Node* x = findKey(roots, k)) { decreaseKey(x, INT_MIN); extractMin(); } }
    }
    print(roots); cout << "\n";
    if (mn) cout << "min=" << mn->key << "\n"; else cout << "min=none\n";
    vector<int> mk; marks(roots, mk); sort(mk.begin(), mk.end());
    for (int k : mk) cout << k << " ";
    cout << "\n";
}
