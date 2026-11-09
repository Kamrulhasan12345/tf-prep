// AVL tree: insert and delete with rotations. Balance factor = height(left) - height(right).
// Complexity: O(log n) per operation.
// Build: g++ -std=c++17 -O2 -Wall -Wextra avl.cpp -o avl
// Run:   ./avl < ops.txt
// Input: "q", then q lines "insert k" or "delete k" (duplicates / missing keys ignored).
// Output: line 1 preorder keys, line 2 their balance factors.
#include <algorithm>
#include <iostream>
#include <string>
using namespace std;
struct Node { int key, h; Node *l, *r; };
int H(Node* n) { return n ? n->h : 0; }
int bf(Node* n) { return H(n->l) - H(n->r); }
void upd(Node* n) { n->h = 1 + max(H(n->l), H(n->r)); }

// BEGIN CORE
Node* rotR(Node* y) { Node* x = y->l; y->l = x->r; x->r = y; upd(y); upd(x); return x; }
Node* rotL(Node* x) { Node* y = x->r; x->r = y->l; y->l = x; upd(x); upd(y); return y; }
Node* rebalance(Node* n) {
    upd(n);
    if (bf(n) == 2) {                                   // left heavy
        if (bf(n->l) < 0) n->l = rotL(n->l);            // LR case: first rotation
        return rotR(n);                                 // LL case (also finishes LR)
    }
    if (bf(n) == -2) {                                  // right heavy
        if (bf(n->r) > 0) n->r = rotR(n->r);            // RL case: first rotation
        return rotL(n);                                 // RR case
    }
    return n;
}
Node* insert(Node* n, int k) {
    if (!n) return new Node{k, 1, nullptr, nullptr};
    if (k < n->key) n->l = insert(n->l, k); else if (k > n->key) n->r = insert(n->r, k);
    return rebalance(n);                                // fix every ancestor on the way up
}
Node* erase(Node* n, int k) {
    if (!n) return n;
    if (k < n->key) n->l = erase(n->l, k);
    else if (k > n->key) n->r = erase(n->r, k);
    else if (!n->l || !n->r) { Node* c = n->l ? n->l : n->r; delete n; return c; }
    else {                                              // two children: copy the successor
        Node* s = n->r; while (s->l) s = s->l;
        n->key = s->key; n->r = erase(n->r, s->key);
    }
    return rebalance(n);                                // deletion may rotate at several levels
}
// END CORE

void pre(Node* n, bool bfs) { if (!n) return; cout << (bfs ? bf(n) : n->key) << " "; pre(n->l, bfs); pre(n->r, bfs); }
int main() {
    int q; cin >> q; Node* root = nullptr;
    while (q--) { string op; int k; cin >> op >> k; root = op == "insert" ? insert(root, k) : erase(root, k); }
    pre(root, false); cout << "\n"; pre(root, true); cout << "\n";
}
