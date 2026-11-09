// Binomial min-heap (CLRS ch. 19): insert, extract-min, decrease-key, delete.
// Complexity: O(log n) each. Keys are assumed distinct.
// Build: g++ -std=c++17 -O2 -Wall -Wextra binomial_heap.cpp -o binomial_heap
// Run:   ./binomial_heap < ops.txt
// Input: "q", then q lines: "insert k", "extract", "decrease old new", "delete k".
// Output: the root list left to right, each tree as k(child child ...), leftmost child first.
#include <climits>
#include <iostream>
#include <string>
using namespace std;
struct Node { int key, degree; Node *p, *child, *sibling; };
Node* head = nullptr;

// BEGIN CORE
void link(Node* y, Node* z) {                 // BINOMIAL-LINK: y (larger root) becomes z's leftmost child
    y->p = z; y->sibling = z->child; z->child = y; z->degree++;
}
Node* merge(Node* a, Node* b) {               // merge root lists by increasing degree (ties: a first)
    Node dummy{0, 0, nullptr, nullptr, nullptr}; Node* t = &dummy;
    while (a && b) { Node*& s = a->degree <= b->degree ? a : b; t->sibling = s; t = s; s = s->sibling; }
    t->sibling = a ? a : b; return dummy.sibling;
}
Node* unite(Node* h1, Node* h2) {             // BINOMIAL-HEAP-UNION
    Node* h = merge(h1, h2); if (!h) return h;
    Node *prev = nullptr, *x = h, *next = x->sibling;
    while (next) {
        if (x->degree != next->degree || (next->sibling && next->sibling->degree == x->degree)) {
            prev = x; x = next;               // Case 1 (degrees differ) and Case 2 (three equal)
        } else if (x->key <= next->key) {     // Case 3: x is the smaller root
            x->sibling = next->sibling; link(next, x);
        } else {                              // Case 4: next is the smaller root
            if (!prev) h = next; else prev->sibling = next;
            link(x, next); x = next;
        }
        next = x->sibling;
    }
    return h;
}
void extractMin() {
    if (!head) return;
    Node *minN = head, *minPrev = nullptr, *prev = head;
    for (Node* x = head->sibling; x; prev = x, x = x->sibling)
        if (x->key < minN->key) { minN = x; minPrev = prev; }
    if (minPrev) minPrev->sibling = minN->sibling; else head = minN->sibling;
    Node* rev = nullptr;                      // children reversed: lowest degree first
    for (Node* c = minN->child; c;) { Node* nx = c->sibling; c->sibling = rev; c->p = nullptr; rev = c; c = nx; }
    delete minN;
    head = unite(head, rev);
}
void decreaseKey(Node* x, int k) {            // swap keys upward while the parent is larger
    x->key = k;
    for (Node* y = x; y->p && y->key < y->p->key; y = y->p) swap(y->key, y->p->key);
}
// END CORE

Node* find(Node* n, int k) {                  // CLRS hands us a pointer; we search by key
    for (; n; n = n->sibling) { if (n->key == k) return n; if (Node* r = find(n->child, k)) return r; }
    return nullptr;
}
void print(Node* n) {
    for (; n; n = n->sibling) { cout << n->key; if (n->child) { cout << "("; print(n->child); cout << ")"; } if (n->sibling) cout << " "; }
}
int main() {
    int q; cin >> q;
    while (q--) {
        string op; cin >> op;
        if (op == "insert") { int k; cin >> k; head = unite(head, new Node{k, 0, nullptr, nullptr, nullptr}); }
        else if (op == "extract") extractMin();
        else if (op == "decrease") { int a, b; cin >> a >> b; if (Node* x = find(head, a)) decreaseKey(x, b); }
        else { int k; cin >> k; if (Node* x = find(head, k)) { decreaseKey(x, INT_MIN); extractMin(); } }
    }
    print(head); cout << "\n";
}
