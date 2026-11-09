// Bottom-up splay tree: insert, delete, access; every operation splays a node to the root.
// Complexity: O(log n) amortized per operation.
// Build: g++ -std=c++17 -O2 -Wall -Wextra splay.cpp -o splay
// Run:   ./splay < ops.txt
// Input: "q", then q lines "insert k", "delete k" or "access k".
// Output: preorder keys. Missing key: access/delete splay the last node on the search path.
#include <iostream>
#include <string>
using namespace std;
struct Node { int key; Node *l, *r, *p; };
Node* root = nullptr;

// BEGIN CORE
void rotateUp(Node* x) {                        // single rotation of x over its parent
    Node *p = x->p, *g = p->p;
    if (x == p->l) { p->l = x->r; if (x->r) x->r->p = p; x->r = p; }
    else           { p->r = x->l; if (x->l) x->l->p = p; x->l = p; }
    p->p = x; x->p = g;
    if (!g) root = x; else if (g->l == p) g->l = x; else g->r = x;
}
void splay(Node* x) {
    while (x->p) {
        Node *p = x->p, *g = p->p;
        if (!g) rotateUp(x);                                        // zig
        else if ((x == p->l) == (p == g->l)) { rotateUp(p); rotateUp(x); }  // zig-zig: parent first
        else { rotateUp(x); rotateUp(x); }                          // zig-zag
    }
}
// END CORE

Node* search(int k, bool& found) {                // returns the node or the last node visited
    Node *n = root, *last = nullptr;
    while (n && n->key != k) { last = n; n = k < n->key ? n->l : n->r; }
    found = n != nullptr; return n ? n : last;
}
void insertKey(int k) {
    bool f; if (search(k, f) && f) return;
    Node *y = nullptr, *x = root;
    while (x) { y = x; x = k < x->key ? x->l : x->r; }
    Node* z = new Node{k, nullptr, nullptr, y};
    if (!y) root = z; else if (k < y->key) y->l = z; else y->r = z;
    splay(z);
}
void access(int k) { bool f; Node* t = search(k, f); if (t) splay(t); }
void deleteKey(int k) {
    bool f; Node* z = search(k, f);
    if (!z) return;
    splay(z);
    if (!f) return;                               // not found: only the splay happens
    Node *L = z->l, *R = z->r; delete z;
    if (L) L->p = nullptr;
    if (R) R->p = nullptr;
    if (!L) { root = R; return; }
    root = L; Node* m = L; while (m->r) m = m->r;
    splay(m); m->r = R; if (R) R->p = m;          // join: max of L has no right child
}
void pre(Node* n) { if (!n) return; cout << n->key << " "; pre(n->l); pre(n->r); }
int main() {
    int q; cin >> q;
    while (q--) { string op; int k; cin >> op >> k;
        if (op == "insert") insertKey(k); else if (op == "delete") deleteKey(k); else access(k); }
    pre(root); cout << "\n";
}
