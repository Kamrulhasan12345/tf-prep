// Red-black tree (CLRS ch. 13) with a sentinel NIL. Delete uses the successor.
// Complexity: O(log n) per operation, at most 2 rotations per insert, 3 per delete.
// Build: g++ -std=c++17 -O2 -Wall -Wextra red_black.cpp -o red_black
// Run:   ./red_black < ops.txt
// Input: "q", then q lines "insert k" or "delete k" (duplicates / missing keys ignored).
// Output: preorder, each key followed by R or B.
#include <iostream>
#include <string>
using namespace std;
enum Color { RED, BLACK };
struct Node { int key; Color color; Node *p, *c[2]; };   // c[0] = left, c[1] = right
Node nilNode{0, BLACK, &nilNode, {&nilNode, &nilNode}};
Node* const NIL = &nilNode;
Node* root = NIL;

// d = 0 is LEFT-ROTATE(x), d = 1 is RIGHT-ROTATE(x); the code is mirror symmetric.
void rotate(Node* x, int d) {
    Node* y = x->c[1 - d];
    x->c[1 - d] = y->c[d];
    if (y->c[d] != NIL) y->c[d]->p = x;
    y->p = x->p;
    if (x->p == NIL) root = y; else if (x == x->p->c[0]) x->p->c[0] = y; else x->p->c[1] = y;
    y->c[d] = x; x->p = y;
}

// BEGIN CORE
void insertFixup(Node* z) {                       // RB-INSERT-FIXUP
    while (z->p->color == RED) {
        int d = z->p == z->p->p->c[0] ? 0 : 1;    // d = side of the parent (mirror via 1-d)
        Node* y = z->p->p->c[1 - d];              // uncle
        if (y->color == RED) {                    // Case 1: uncle red, recolor, move z up
            z->p->color = BLACK; y->color = BLACK; z->p->p->color = RED; z = z->p->p;
        } else {
            if (z == z->p->c[1 - d]) { z = z->p; rotate(z, d); }   // Case 2: triangle -> line
            z->p->color = BLACK; z->p->p->color = RED;             // Case 3: line, rotate grandparent
            rotate(z->p->p, 1 - d);
        }
    }
    root->color = BLACK;
}
void deleteFixup(Node* x) {                       // RB-DELETE-FIXUP: x carries an extra black
    while (x != root && x->color == BLACK) {
        int d = x == x->p->c[0] ? 0 : 1;
        Node* w = x->p->c[1 - d];                 // sibling
        if (w->color == RED) {                    // Case 1: red sibling -> black sibling
            w->color = BLACK; x->p->color = RED; rotate(x->p, d); w = x->p->c[1 - d];
        }
        if (w->c[0]->color == BLACK && w->c[1]->color == BLACK) {  // Case 2: push extra black up
            w->color = RED; x = x->p;
        } else {
            if (w->c[1 - d]->color == BLACK) {    // Case 3: far child black -> make it red
                w->c[d]->color = BLACK; w->color = RED; rotate(w, 1 - d); w = x->p->c[1 - d];
            }
            w->color = x->p->color; x->p->color = BLACK;           // Case 4: rotate, done
            w->c[1 - d]->color = BLACK; rotate(x->p, d); x = root;
        }
    }
    x->color = BLACK;
}
// END CORE

void insertKey(int key) {                         // RB-INSERT
    Node *y = NIL, *x = root;
    while (x != NIL) { y = x; if (key == x->key) return; x = x->c[key < x->key ? 0 : 1]; }
    Node* z = new Node{key, RED, y, {NIL, NIL}};
    if (y == NIL) root = z; else y->c[key < y->key ? 0 : 1] = z;
    insertFixup(z);
}
void transplant(Node* u, Node* v) {
    if (u->p == NIL) root = v; else if (u == u->p->c[0]) u->p->c[0] = v; else u->p->c[1] = v;
    v->p = u->p;                                  // allowed even when v is NIL
}
void deleteKey(int key) {                         // RB-DELETE
    Node* z = root;
    while (z != NIL && z->key != key) z = z->c[key < z->key ? 0 : 1];
    if (z == NIL) return;
    Node *y = z, *x; Color yColor = y->color;
    if (z->c[0] == NIL) { x = z->c[1]; transplant(z, x); }
    else if (z->c[1] == NIL) { x = z->c[0]; transplant(z, x); }
    else {
        y = z->c[1]; while (y->c[0] != NIL) y = y->c[0];   // successor
        yColor = y->color; x = y->c[1];
        if (y->p == z) x->p = y;
        else { transplant(y, x); y->c[1] = z->c[1]; y->c[1]->p = y; }
        transplant(z, y); y->c[0] = z->c[0]; y->c[0]->p = y; y->color = z->color;
    }
    if (yColor == BLACK) deleteFixup(x);
}
void pre(Node* n) { if (n == NIL) return; cout << n->key << (n->color == RED ? 'R' : 'B') << " "; pre(n->c[0]); pre(n->c[1]); }
int main() {
    int q; cin >> q;
    while (q--) { string op; int k; cin >> op >> k; if (op == "insert") insertKey(k); else deleteKey(k); }
    pre(root); cout << "\n";
}
