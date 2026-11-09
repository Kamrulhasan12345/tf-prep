// CSE 207 algorithm engine: pure functions, no DOM. Each run returns frames [{cap, tag, tree|forest|graph|mats|tbl, hl}].
// Run the invariant checks with: node dsa2/tools/check.js
(function (root, f) { typeof module === 'object' ? module.exports = f() : root.Algo = f(); })(globalThis, function () {
'use strict';
const clone = x => JSON.parse(JSON.stringify(x));

// ===== Red-black tree (CLRS). opts.pred: replace a two-child node by its predecessor instead of successor =====
class RB {
  constructor(frames, opts = {}) {
    this.frames = frames; this.opts = opts;
    const nil = this.nil = { c: 'B', nil: true }; nil.l = nil.r = nil.p = nil; this.root = nil; this.x = null;
  }
  snap(n = this.root, par = this.nil) {
    if (n === this.nil) return this.x === this.nil && this.nil.p === par && par !== this.nil ? { nil: true, c: 'B', db: true } : null;
    const o = { k: n.k, c: n.c, l: this.snap(n.l, n), r: this.snap(n.r, n) }; if (n === this.x) o.db = true; return o;
  }
  emit(cap, hl = [], tag = '') { this.frames.push({ cap, tag, hl, tree: this.snap() }); }
  rotL(x) { const y = x.r, nil = this.nil; x.r = y.l; if (y.l !== nil) y.l.p = x; y.p = x.p; if (x.p === nil) this.root = y; else if (x === x.p.l) x.p.l = y; else x.p.r = y; y.l = x; x.p = y; }
  rotR(x) { const y = x.l, nil = this.nil; x.l = y.r; if (y.r !== nil) y.r.p = x; y.p = x.p; if (x.p === nil) this.root = y; else if (x === x.p.r) x.p.r = y; else x.p.l = y; y.r = x; x.p = y; }
  find(k) { let n = this.root; while (n !== this.nil && n.k !== k) n = k < n.k ? n.l : n.r; return n === this.nil ? null : n; }
  // load an existing tree given as {k,c,l,r}
  load(t, p = this.nil) { if (!t) return this.nil; const n = { k: t.k, c: t.c, p }; n.l = this.load(t.l, n); n.r = this.load(t.r, n); if (p === this.nil) this.root = n; return n; }
  insert(k) {
    const nil = this.nil; let y = nil, x = this.root;
    while (x !== nil) { y = x; x = k < x.k ? x.l : x.r; }
    const z = { k, c: 'R', l: nil, r: nil, p: y };
    if (y === nil) this.root = z; else if (k < y.k) y.l = z; else y.r = z;
    this.emit(`<b>Insert ${k}.</b> Normal BST insert, coloured <b>red</b>.`, [k], 'insert');
    this.fixInsert(z);
  }
  fixInsert(z) {
    const nil = this.nil;
    while (z.p.c === 'R') {
      const g = z.p.p, left = z.p === g.l, u = left ? g.r : g.l;
      if (u.c === 'R') {
        z.p.c = 'B'; u.c = 'B'; g.c = 'R';
        this.emit(`<b>Case 1 (uncle ${u.k} is red).</b> Recolour: parent ${z.p.k} and uncle ${u.k} black, grandparent ${g.k} red. Move z up to ${g.k}.`, [z.p.k, u.k, g.k], 'case 1'); z = g;
      } else {
        if (left ? z === z.p.r : z === z.p.l) {
          const pk = z.p.k; z = z.p; left ? this.rotL(z) : this.rotR(z);
          this.emit(`<b>Case 2 (uncle black, z is an inner child: triangle).</b> ${left ? 'Left' : 'Right'}-rotate at parent ${pk} to make a straight line; now z = ${z.k}. Falls into case 3.`, [pk, z.p.k], 'case 2');
        }
        const p = z.p, gg = z.p.p; p.c = 'B'; gg.c = 'R'; left ? this.rotR(gg) : this.rotL(gg);
        this.emit(`<b>Case 3 (uncle black, z is an outer child: line).</b> Colour parent ${p.k} black, grandparent ${gg.k} red, then ${left ? 'right' : 'left'}-rotate at ${gg.k}.`, [p.k, gg.k], 'case 3');
      }
    }
    if (this.root.c === 'R') { this.root.c = 'B'; this.emit(`Root must be black: colour ${this.root.k} black.`, [this.root.k], 'root'); }
    else this.emit('No red-red violation remains. Insertion done.', [], 'done');
  }
  transplant(u, v) { if (u.p === this.nil) this.root = v; else if (u === u.p.l) u.p.l = v; else u.p.r = v; v.p = u.p; }
  delete(k) {
    const nil = this.nil, z = this.find(k); if (!z) { this.emit(`${k} is not in the tree.`, [], 'none'); return; }
    let y = z, yc = y.c, x; const pred = this.opts.pred;
    this.emit(`<b>Delete ${k}.</b>`, [k], 'delete');
    if (z.l === nil) { x = z.r; this.transplant(z, z.r); }
    else if (z.r === nil) { x = z.l; this.transplant(z, z.l); }
    else {
      y = z[pred ? 'l' : 'r']; while (y[pred ? 'r' : 'l'] !== nil) y = y[pred ? 'r' : 'l'];
      yc = y.c; x = y[pred ? 'l' : 'r'];
      if (y.p === z) x.p = y;
      else { this.transplant(y, x); y[pred ? 'l' : 'r'] = z[pred ? 'l' : 'r']; y[pred ? 'l' : 'r'].p = y; }
      this.transplant(z, y); y[pred ? 'r' : 'l'] = z[pred ? 'r' : 'l']; y[pred ? 'r' : 'l'].p = y; y.c = z.c;
    }
    const note = y === z ? `Node ${k} has at most one child: splice it out.` : `Two children: ${y.k} is the in-order ${pred ? 'predecessor' : 'successor'}. It moves into ${k}'s place and takes ${k}'s colour.`;
    if (yc === 'R') { this.emit(`${note} The removed colour was red, so nothing is violated. Done.`, [y === z ? -1e9 : y.k], 'red removed'); return; }
    this.x = x;
    this.emit(`${note} A black was removed, so ${x === nil ? 'the NIL in its place' : x.k} carries an <b>extra black</b>.`, x === nil ? [] : [x.k], 'extra black');
    this.fixDelete(x); this.x = null;
    this.emit('All red-black properties hold. Deletion done.', [], 'done');
  }
  fixDelete(x) {
    const nil = this.nil, nm = n => n === nil ? 'NIL' : n.k;
    while (x !== this.root && x.c === 'B') {
      const left = x === x.p.l, L = left ? 'l' : 'r', R = left ? 'r' : 'l', rot = left ? this.rotL.bind(this) : this.rotR.bind(this), rotB = left ? this.rotR.bind(this) : this.rotL.bind(this);
      let w = x.p[R];
      if (w.c === 'R') {
        w.c = 'B'; x.p.c = 'R'; rot(x.p); this.emit(`<b>Case 1 (sibling ${w.k} is red).</b> Swap colours of sibling and parent, ${left ? 'left' : 'right'}-rotate at parent ${x.p.k}. The new sibling is black, so continue with case 2, 3 or 4.`, [w.k, x.p.k], 'case 1'); w = x.p[R];
      }
      if (w[L].c === 'B' && w[R].c === 'B') {
        w.c = 'R'; const px = x.p; this.x = px; x = px;
        this.emit(`<b>Case 2 (sibling ${w.k} black, both its children black).</b> Colour sibling red and move the extra black up to ${px.k}.${px.c === 'R' ? ` ${px.k} is red, so it simply becomes black and we stop.` : ''}`, [w.k, px.k], 'case 2');
      } else {
        if (w[R].c === 'B') {
          w[L].c = 'B'; w.c = 'R'; const nk = w[L].k; rotB(w); this.emit(`<b>Case 3 (sibling ${w.k} black, its near child ${nk} red, far child black).</b> Swap their colours, ${left ? 'right' : 'left'}-rotate at the sibling. Now the far child is red: case 4.`, [w.k, nk], 'case 3'); w = x.p[R];
        }
        w.c = x.p.c; x.p.c = 'B'; w[R].c = 'B'; const pk = x.p.k, fk = w[R].k; rot(x.p); const wk = w.k; x = this.root; this.x = null;
        this.emit(`<b>Case 4 (sibling ${wk} black, far child ${fk} red).</b> Sibling takes parent's colour; parent ${pk} and far child ${fk} become black; ${left ? 'left' : 'right'}-rotate at ${pk}. Extra black is gone. Stop.`, [wk, pk, fk], 'case 4');
      }
    }
    if (x.c === 'R') { x.c = 'B'; const k = x.k; this.x = null; this.emit(`The extra black landed on red node ${k}: colour it black. Done.`, [k], 'red-black'); }
    else if (x === this.root) { this.x = null; }
    x.c = 'B';
  }
}

// ===== Plain BST helpers shared by AVL and splay =====
class BSTBase {
  constructor(frames, opts = {}) { this.frames = frames; this.opts = opts; this.root = null; }
  rotL(x) { const y = x.r; x.r = y.l; if (y.l) y.l.p = x; y.p = x.p; if (!x.p) this.root = y; else if (x === x.p.l) x.p.l = y; else x.p.r = y; y.l = x; x.p = y; }
  rotR(x) { const y = x.l; x.l = y.r; if (y.r) y.r.p = x; y.p = x.p; if (!x.p) this.root = y; else if (x === x.p.r) x.p.r = y; else x.p.l = y; y.r = x; x.p = y; }
  find(k) { let n = this.root; while (n && n.k !== k) n = k < n.k ? n.l : n.r; return n; }
  load(t, p = null) { if (!t) return null; const n = { k: t.k, p, h: 1 }; n.l = this.load(t.l, n); n.r = this.load(t.r, n); if (!p) this.root = n; return n; }
}

// ===== AVL. bf = height(left) - height(right), the sign used in the papers =====
class AVL extends BSTBase {
  h(n) { return n ? n.h : 0; } bf(n) { return this.h(n.l) - this.h(n.r); }
  fix(n) { n.h = 1 + Math.max(this.h(n.l), this.h(n.r)); }
  fixAll(n = this.root) { if (!n) return; this.fixAll(n.l); this.fixAll(n.r); this.fix(n); }
  snap(n = this.root) { return n ? { k: n.k, bf: this.bf(n), l: this.snap(n.l), r: this.snap(n.r) } : null; }
  emit(cap, hl = [], tag = '') { this.frames.push({ cap, tag, hl, tree: this.snap() }); }
  rebalance(a, phrase) {
    this.fix(a); const b = this.bf(a); if (Math.abs(b) < 2) return a;
    const k = a.k;
    if (b === 2) {
      const c = a.l, bc = this.bf(c);
      if (bc >= 0) { this.rotR(a); this.fix(a); this.fix(c); this.emit(`${phrase} Node ${k} has bf +2, left child ${c.k} has bf ${bc >= 0 ? '+' : ''}${bc}: <b>LL case</b>. Right-rotate at ${k}.`, [k, c.k], 'LL'); return c; }
      const g = c.r; this.rotL(c); this.fix(c); this.fix(g); this.emit(`${phrase} Node ${k} has bf +2, left child ${c.k} has bf ${bc}: <b>LR case</b>. First left-rotate at ${c.k}.`, [k, c.k, g.k], 'LR 1/2');
      this.rotR(a); this.fix(a); this.fix(g); this.emit(`Then right-rotate at ${k}. Balanced.`, [k, g.k], 'LR 2/2'); return g;
    }
    const c = a.r, bc = this.bf(c);
    if (bc <= 0) { this.rotL(a); this.fix(a); this.fix(c); this.emit(`${phrase} Node ${k} has bf −2, right child ${c.k} has bf ${bc}: <b>RR case</b>. Left-rotate at ${k}.`, [k, c.k], 'RR'); return c; }
    const g = c.l; this.rotR(c); this.fix(c); this.fix(g); this.emit(`${phrase} Node ${k} has bf −2, right child ${c.k} has bf +${bc}: <b>RL case</b>. First right-rotate at ${c.k}.`, [k, c.k, g.k], 'RL 1/2');
    this.rotL(a); this.fix(a); this.fix(g); this.emit(`Then left-rotate at ${k}. Balanced.`, [k, g.k], 'RL 2/2'); return g;
  }
  insert(k) {
    let y = null, x = this.root; while (x) { y = x; x = k < x.k ? x.l : x.r; }
    const z = { k, l: null, r: null, p: y, h: 1 }; if (!y) this.root = z; else if (k < y.k) y.l = z; else y.r = z;
    for (let n = y; n; n = n.p) this.fix(n);
    this.emit(`<b>Insert ${k}.</b> Normal BST insert. Walk up, updating balance factors.`, [k], 'insert');
    for (let n = y; n; n = n.p) { const before = n.h, r = this.rebalance(n, 'Deepest violation.'); if (r !== n) { for (let m = r.p; m; m = m.p) this.fix(m); this.emit('Insertion done: one rebalancing is always enough.', [], 'done'); return; } n = r; if (before === n.h && false) break; }
    this.emit('Every balance factor is in {−1, 0, +1}. No rotation needed.', [], 'done');
  }
  delete(k) {
    let z = this.find(k); if (!z) { this.emit(`${k} is not in the tree.`, [], 'none'); return; }
    this.emit(`<b>Delete ${k}.</b>`, [k], 'delete'); let note = '';
    if (z.l && z.r) { const pred = this.opts.pred; let y = z[pred ? 'l' : 'r']; while (y[pred ? 'r' : 'l']) y = y[pred ? 'r' : 'l']; note = `Two children: copy in-order ${pred ? 'predecessor' : 'successor'} ${y.k} into this node and delete that node. `; z.k = y.k; z = y; }
    const ch = z.l || z.r, p = z.p; if (ch) ch.p = p; if (!p) this.root = ch; else if (z === p.l) p.l = ch; else p.r = ch;
    for (let n = p; n; n = n.p) this.fix(n);
    this.emit(`${note}Spliced out. Walk up to the root, checking every ancestor.`, [], 'splice');
    let rot = false; for (let n = p; n; n = n.p) { const r = this.rebalance(n, 'Violation.'); if (r !== n) { rot = true; for (let m = r.p; m; m = m.p) this.fix(m); } n = r; }
    this.emit(rot ? 'Deletion done. Unlike insertion, deletion may need a rotation at several levels.' : 'All balance factors fine. No rotation needed.', [], 'done');
  }
}

// ===== Splay tree (bottom-up) =====
class Splay extends BSTBase {
  snap(n = this.root) { return n ? { k: n.k, l: this.snap(n.l), r: this.snap(n.r) } : null; }
  emit(cap, hl = [], tag = '') { this.frames.push({ cap, tag, hl, tree: this.snap() }); }
  splay(x) {
    while (x.p) {
      const p = x.p, g = p.p, xL = x === p.l;
      if (!g) { xL ? this.rotR(p) : this.rotL(p); this.emit(`<b>Zig.</b> Parent ${p.k} is the root: one ${xL ? 'right' : 'left'} rotation at ${p.k}.`, [x.k, p.k], 'zig'); }
      else if (xL === (p === g.l)) { if (xL) { this.rotR(g); this.rotR(p); } else { this.rotL(g); this.rotL(p); } this.emit(`<b>Zig-zig.</b> ${x.k}, parent ${p.k}, grandparent ${g.k} in a line: rotate at the <b>grandparent</b> first, then at the parent.`, [x.k, p.k, g.k], 'zig-zig'); }
      else { if (xL) { this.rotR(p); this.rotL(g); } else { this.rotL(p); this.rotR(g); } this.emit(`<b>Zig-zag.</b> ${x.k} is an inner grandchild: rotate at parent ${p.k}, then at grandparent ${g.k}.`, [x.k, p.k, g.k], 'zig-zag'); }
    }
  }
  access(k) { let n = this.root, last = null; while (n && n.k !== k) { last = n; n = k < n.k ? n.l : n.r; } const t = n || last; if (!t) return; this.emit(n ? `<b>Access ${k}:</b> found; splay it to the root.` : `<b>Access ${k}:</b> not found; splay the last node reached, ${t.k}.`, [t.k], 'access'); this.splay(t); }
  insert(k) { let y = null, x = this.root; while (x) { y = x; x = k < x.k ? x.l : x.r; } const z = { k, l: null, r: null, p: y }; if (!y) this.root = z; else if (k < y.k) y.l = z; else y.r = z; this.emit(`<b>Insert ${k}.</b> Normal BST insert, then splay it to the root.`, [k], 'insert'); this.splay(z); }
  delete(k) {
    const z = this.find(k); if (!z) { this.access(k); return; }
    this.emit(`<b>Delete ${k}.</b> First splay it to the root.`, [k], 'delete'); this.splay(z);
    const L = z.l, R = z.r; if (L) L.p = null; if (R) R.p = null;
    if (!L) { this.root = R; this.emit(`Remove root ${k}. No left subtree: the right subtree is the tree.`, [], 'done'); return; }
    this.root = L; this.emit(`Remove root ${k}. Now join: splay the largest key of the left subtree.`, [], 'join');
    let m = L; while (m.r) m = m.r; this.splay(m); m.r = R; if (R) R.p = m;
    this.emit(`${m.k} is now the root of the left part and has no right child: attach the right subtree there.`, [m.k], 'done');
  }
}

// ===== Binomial heap (CLRS). opts.max for a max-heap. children stored highest degree first =====
class Binomial {
  constructor(frames, opts = {}) { this.frames = frames; this.max = !!opts.max; this.roots = []; }
  before(a, b) { return this.max ? a > b : a < b; }
  snap(ns = this.roots) { return ns.map(n => ({ k: n.k, ch: this.snap(n.ch), deg: n.deg })); }
  emit(cap, hl = [], tag = '', extra) { const f = { cap, tag, hl, forest: this.snap() }; if (extra) f.forest2 = extra; this.frames.push(f); }
  link(y, z) { y.p = z; z.ch.unshift(y); z.deg++; }
  union(other, quiet) {
    const a = this.roots, b = other; let i = 0, j = 0; const m = [];
    while (i < a.length || j < b.length) m.push(j >= b.length || (i < a.length && a[i].deg <= b[j].deg) ? a[i++] : b[j++]);
    this.roots = m; if (!quiet) this.emit('<b>Merge</b> the two root lists by increasing degree (no linking yet).', [], 'merge');
    let x = 0;
    while (x + 1 < m.length) {
      const X = m[x], N = m[x + 1];
      if (X.deg !== N.deg || (x + 2 < m.length && m[x + 2].deg === X.deg)) { x++; continue; }
      if (!this.before(N.k, X.k)) { m.splice(x + 1, 1); this.link(N, X); if (!quiet) this.emit(`Two B<sub>${N.deg}</sub> trees: ${N.k} becomes the leftmost child of ${X.k}.`, [X.k, N.k], 'link'); }
      else { m.splice(x, 1); this.link(X, N); if (!quiet) this.emit(`Two B<sub>${X.deg}</sub> trees: ${X.k} becomes the leftmost child of ${N.k}.`, [X.k, N.k], 'link'); }
    }
  }
  insert(k) { this.union([{ k, deg: 0, ch: [], p: null }], true); this.emit(`<b>Insert ${k}.</b> Make it a one-node heap and union it in (like adding 1 to a binary counter).`, [k], 'insert'); }
  find(k, ns = this.roots) { for (const n of ns) { if (n.k === k) return n; const r = this.find(k, n.ch); if (r) return r; } return null; }
  top() { let b = null; for (const r of this.roots) if (!b || this.before(r.k, b.k)) b = r; return b; }
  extract() {
    const t = this.top(); if (!t) return null; const name = this.max ? 'Extract-max' : 'Extract-min';
    this.emit(`<b>${name}:</b> the root list holds the ${this.max ? 'largest' : 'smallest'} key, ${t.k}.`, [t.k], 'find');
    this.roots.splice(this.roots.indexOf(t), 1); const kids = t.ch.slice().reverse(); kids.forEach(c => c.p = null);
    this.emit(`Remove ${t.k}. Its children, reversed (lowest degree first), form a second heap: ${kids.map(c => c.k).join(', ') || 'empty'}.`, kids.map(c => c.k), 'remove', this.snap(kids));
    this.union(kids); this.emit(`${name} finished.`, [], 'done'); return t.k;
  }
  decrease(oldk, newk) {
    let n = this.find(oldk); if (!n) return; n.k = newk; this.emit(`<b>Decrease key</b> ${oldk} → ${newk}.`, [newk], 'decrease');
    while (n.p && this.before(n.k, n.p.k)) { const p = n.p, t = n.k; n.k = p.k; p.k = t; this.emit(`Heap order broken: exchange ${t} with parent ${n.k}.`, [t, n.k], 'bubble'); n = p; }
    this.emit('Heap order restored.', [], 'done');
  }
  delete(k) { if (!this.find(k)) { this.emit(`${k} is not in the heap.`, [], 'none'); return; } this.emit(`<b>Delete ${k}:</b> decrease it to −∞, then extract-min.`, [k], 'delete'); this.decrease(k, -1e9); this.extract(); }
}

// ===== Fibonacci heap (min). roots is display order. Follows CLRS; start of consolidate set by the root order =====
class Fib {
  constructor(frames, opts = {}) { this.frames = frames; this.opts = opts; this.roots = []; this.min = null; this.n = 0; }
  snapN(n) { return { k: n.k, mark: !!n.mark, ch: n.ch.map(c => this.snapN(c)) }; }
  emit(cap, hl = [], tag = '', A) { const f = { cap, tag, hl, forest: this.roots.map(r => this.snapN(r)), min: this.min ? this.min.k : null }; if (A) f.A = A; this.frames.push(f); }
  node(t, p = null) { const n = { k: t.k, mark: !!t.mark, p, ch: [] }; n.ch = (t.ch || []).map(c => this.node(c, n)); n.deg = n.ch.length; this.n++; return n; }
  load(trees, minKey) { this.roots = trees.map(t => this.node(t)); this.min = this.roots.find(r => r.k === minKey) || this.minRoot(); }
  minRoot() { let b = null; for (const r of this.roots) if (!b || r.k < b.k) b = r; return b; }
  find(k, ns = this.roots) { for (const n of ns) { if (n.k === k) return n; const r = this.find(k, n.ch); if (r) return r; } return null; }
  insert(k) { const n = { k, mark: false, p: null, ch: [], deg: 0 }; const i = this.min ? this.roots.indexOf(this.min) : 0; this.roots.splice(i, 0, n); if (!this.min || k < this.min.k) this.min = n; this.n++; this.emit(`<b>Insert ${k}.</b> Add it to the root list, just left of min. No consolidation: O(1).`, [k], 'insert'); }
  extract() {
    const z = this.min; if (!z) return null; const i = this.roots.indexOf(z);
    const kids = z.ch; kids.forEach(c => { c.p = null; c.mark = false; });
    this.emit(`<b>Extract-min:</b> min is ${z.k}. Each child goes to the root list (and loses its mark), then ${z.k} is removed.`, [z.k], 'extract');
    // order after removal: rest of list starting just right of z, wrapping; kids spliced in z's place
    this.roots.splice(i, 1, ...kids); this.min = null; this.n--;
    if (!this.roots.length) { this.emit('Heap is now empty.', [], 'done'); return z.k; }
    this.emit('Children are on the root list; min is temporarily unknown. Now consolidate.', kids.map(c => c.k), 'promote');
    this.consolidate(i + kids.length); this.emit(`Done. New min is ${this.min.k}.`, [this.min.k], 'done'); return z.k;
  }
  consolidate(start) {
    const m = this.roots.length, order = []; for (let i = 0; i < m; i++) order.push(this.roots[(start + i) % m]);
    this.roots = order.slice();
    const A = {};
    const show = () => Object.keys(A).filter(d => A[d]).map(d => `A[${d}]=${A[d].k}`).join(', ') || 'empty';
    for (const w of order) {
      let x = w, d = x.deg;
      while (A[d]) {
        let y = A[d]; if (y.k < x.k) { const pos = this.roots.indexOf(x), t = x; x = y; y = t; const py = this.roots.indexOf(x); this.roots[pos] = x; this.roots.splice(py, 1); }
        else this.roots.splice(this.roots.indexOf(y), 1);
        y.p = x; y.mark = false; x.ch.push(y); x.deg++; A[d] = null;
        this.emit(`Two roots of degree ${d}: link ${y.k} under ${x.k} (larger key goes under the smaller). A: ${show()}.`, [x.k, y.k], 'link'); d++;
      }
      A[d] = x;
      this.emit(`Root ${x.k} has degree ${d}, A[${d}] was free: A[${d}] = ${x.k}. A: ${show()}.`, [x.k], 'A[]');
    }
    this.min = this.minRoot();
  }
  decrease(oldk, newk) {
    const x = this.find(oldk); if (!x) return; x.k = newk; const y = x.p; this.emit(`<b>Decrease key</b> ${oldk} → ${newk}.`, [newk], 'decrease');
    if (y && x.k < y.k) { this.cut(x, y); this.cascade(y); } else if (y) this.emit('Heap order still holds, nothing to cut.', [], 'ok');
    if (x.k < this.min.k) this.min = x; this.emit(`Done. Min is ${this.min.k}.`, [this.min.k], 'done');
  }
  cut(x, y) { y.ch.splice(y.ch.indexOf(x), 1); y.deg--; x.p = null; x.mark = false; this.roots.push(x); this.emit(`Cut ${x.k} from parent ${y.k}; it joins the root list, unmarked.`, [x.k, y.k], 'cut'); }
  cascade(y) { const z = y.p; if (!z) return; if (!y.mark) { y.mark = true; this.emit(`${y.k} just lost its first child and is not a root: mark it. Stop.`, [y.k], 'mark'); } else { this.emit(`${y.k} is already marked and lost a second child: cascading cut.`, [y.k], 'cascade'); this.cut(y, z); this.cascade(z); } }
  delete(k) { if (!this.find(k)) { this.emit(`${k} is not in the heap.`, [], 'none'); return; } this.emit(`<b>Delete ${k}:</b> decrease to −∞, then extract-min.`, [k], 'delete'); this.decrease(k, -1e9); this.extract(); }
}

// ===== Graph parsing: "A-B 1, A-C 3" undirected, "A>B 3" directed. Weight optional =====
function parseGraph(s) {
  const E = [], V = []; let dir = false;
  const add = v => { if (!V.includes(v)) V.push(v); };
  for (const m of s.matchAll(/([\w']+)\s*(->|→|>|-|–)\s*([\w']+)(?:\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)|\s+(-?\d+(?:\.\d+)?))?/g)) {
    const d = m[2] !== '-' && m[2] !== '–'; dir = dir || d; add(m[1]); add(m[3]);
    E.push({ u: m[1], v: m[3], w: +(m[4] ?? m[5] ?? 1) });
  }
  V.sort((a, b) => (+a === +a && +b === +b) ? a - b : a < b ? -1 : a > b ? 1 : 0);
  return { V, E, dir };
}
const adj = (G) => { const a = {}; G.V.forEach(v => a[v] = []); for (const e of G.E) { a[e.u].push({ to: e.v, w: e.w, e }); if (!G.dir) a[e.v].push({ to: e.u, w: e.w, e }); } for (const v of G.V) a[v].sort((x, y) => x.to < y.to ? -1 : 1); return a; };
const inf = x => x === Infinity ? '∞' : x === -Infinity ? '−∞' : x === null || x === undefined ? 'NIL' : x;
const gframe = (G, st, vlab, vst, extra) => ({ graph: { V: G.V, dir: G.dir, E: G.E.map((e, i) => ({ u: e.u, v: e.v, w: e.w, st: st[i] || '' })), vlab: vlab || {}, vst: vst || {} }, ...extra });

function kruskal(G) {
  const fr = [], ord = G.E.map((e, i) => i).sort((a, b) => G.E[a].w - G.E[b].w || (G.E[a].u + G.E[a].v < G.E[b].u + G.E[b].v ? -1 : 1));
  const par = {}; G.V.forEach(v => par[v] = v); const find = v => par[v] === v ? v : (par[v] = find(par[v]));
  const st = {}; let tot = 0; const pick = [];
  const sets = () => { const m = {}; G.V.forEach(v => (m[find(v)] ||= []).push(v)); return Object.values(m).map(s => '{' + s.join(',') + '}').join(' '); };
  fr.push(gframe(G, st, 0, 0, { cap: `Sort edges by weight: ${ord.map(i => `${G.E[i].u}${G.E[i].v}(${G.E[i].w})`).join(', ')}. Every vertex starts in its own set.`, tag: 'sort' }));
  for (const i of ord) {
    const e = G.E[i], ru = find(e.u), rv = find(e.v);
    if (ru !== rv) { par[ru] = rv; st[i] = 'tree'; tot += e.w; pick.push(`${e.u}${e.v}`); fr.push(gframe(G, st, 0, 0, { cap: `Edge ${e.u}–${e.v} (${e.w}): endpoints in different sets, <b>accept</b>. Sets: ${sets()}. Weight so far ${tot}.`, tag: 'accept' })); }
    else { st[i] = 'rej'; fr.push(gframe(G, st, 0, 0, { cap: `Edge ${e.u}–${e.v} (${e.w}): endpoints already in one set, it would make a cycle: <b>reject</b>.`, tag: 'reject' })); }
  }
  fr.result = { total: tot, edges: pick }; return fr;
}
function prim(G, r = G.V[0]) {
  const fr = [], A = adj(G), key = {}, pi = {}, inQ = {}, st = {}; G.V.forEach(v => { key[v] = Infinity; pi[v] = null; inQ[v] = 1; }); key[r] = 0; let tot = 0; const pick = [];
  const lab = () => Object.fromEntries(G.V.map(v => [v, inf(key[v])]));
  const vst = {};
  const edgeIdx = (a, b) => G.E.findIndex(e => (e.u === a && e.v === b) || (e.u === b && e.v === a));
  fr.push(gframe(G, st, lab(), vst, { cap: `Start at ${r} with key 0, all others ∞.`, tag: 'init' }));
  while (Object.keys(inQ).length) {
    let u = null; for (const v of G.V) if (inQ[v] && (u === null || key[v] < key[u])) u = v;
    delete inQ[u]; vst[u] = 'done';
    if (pi[u] !== null) { st[edgeIdx(pi[u], u)] = 'tree'; tot += key[u]; pick.push(`${pi[u]}${u}`); }
    const upd = [];
    for (const { to, w } of A[u]) if (inQ[to] && w < key[to]) { key[to] = w; pi[to] = u; upd.push(`${to}=${w}`); }
    fr.push(gframe(G, st, lab(), { ...vst }, { cap: `Extract ${u} (key ${key[u]})${pi[u] !== null ? `, add edge ${pi[u]}–${u}` : ''}. ${upd.length ? 'Update keys: ' + upd.join(', ') + '.' : 'No key changes.'}`, tag: 'extract' }));
  }
  fr.result = { total: tot, edges: pick }; return fr;
}
function dijkstra(G, s = G.V[0]) {
  const fr = [], A = adj(G), d = {}, pi = {}, Q = {}, st = {}, vst = {}; G.V.forEach(v => { d[v] = Infinity; pi[v] = null; Q[v] = 1; }); d[s] = 0;
  const lab = () => Object.fromEntries(G.V.map(v => [v, inf(d[v])]));
  const eid = (a, b) => G.E.findIndex(e => (e.u === a && e.v === b) || (!G.dir && e.u === b && e.v === a));
  const rows = [];
  const row = u => rows.push([u, ...G.V.map(v => inf(d[v]))]);
  const tbl = () => ({ head: ['extracted', ...G.V], rows: rows.map(r => r.slice()) });
  fr.push(gframe(G, st, lab(), vst, { cap: `Initialise: d[${s}] = 0, all others ∞.`, tag: 'init', tbl: tbl() }));
  while (Object.keys(Q).length) {
    let u = null; for (const v of G.V) if (Q[v] && (u === null || d[v] < d[u])) u = v;
    delete Q[u]; vst[u] = 'done'; if (d[u] === Infinity) continue;
    if (pi[u] !== null) st[eid(pi[u], u)] = 'tree';
    const up = [];
    for (const { to, w } of A[u]) if (Q[to] && d[u] + w < d[to]) { const o = d[to]; if (pi[to] !== null) { const k = eid(pi[to], to); if (st[k] === 'tree') st[k] = ''; } d[to] = d[u] + w; pi[to] = u; up.push(`d[${to}]: ${inf(o)} → ${d[to]}`); }
    row(u);
    fr.push(gframe(G, st, lab(), { ...vst, [u]: 'cur' }, { cap: `Extract ${u} (d = ${d[u]}). ${up.length ? 'Relax: ' + up.join('; ') + '.' : 'No improvement.'}`, tag: 'extract', tbl: tbl() }));
  }
  fr.result = { d, pi }; return fr;
}
function bellman(G, s = G.V[0]) {
  const fr = [], d = {}, pi = {}, st = {}; G.V.forEach(v => { d[v] = Infinity; pi[v] = null; }); d[s] = 0;
  const lab = () => Object.fromEntries(G.V.map(v => [v, inf(d[v])]));
  const order = G.E.map(e => `${e.u}${G.dir ? '→' : '–'}${e.v}`).join(', ');
  const rows = [['init', ...G.V.map(v => inf(d[v]))]];
  const tbl = () => ({ head: ['pass', ...G.V], rows: rows.map(r => r.slice()) });
  fr.push(gframe(G, st, lab(), {}, { cap: `Initialise d[${s}] = 0. Relax every edge |V|−1 = ${G.V.length - 1} times, in this order: ${order}.`, tag: 'init', tbl: tbl() }));
  for (let p = 1; p < G.V.length; p++) {
    const up = []; let ch = false;
    G.E.forEach((e, i) => { const rel = (a, b) => { if (d[a] !== Infinity && d[a] + e.w < d[b]) { d[b] = d[a] + e.w; pi[b] = a; ch = true; up.push(`${a}→${b}: d[${b}] = ${d[b]}`); } }; rel(e.u, e.v); if (!G.dir) rel(e.v, e.u); });
    rows.push([p, ...G.V.map(v => inf(d[v]))]);
    fr.push(gframe(G, st, lab(), {}, { cap: `<b>Pass ${p}.</b> ${up.length ? up.join('; ') + '.' : 'Nothing changed: can stop early.'}`, tag: 'pass ' + p, tbl: tbl() }));
    if (!ch) break;
  }
  let neg = null; for (const e of G.E) if (d[e.u] !== Infinity && d[e.u] + e.w < d[e.v]) neg = e;
  fr.push(gframe(G, st, lab(), {}, { cap: neg ? `One more pass: edge ${neg.u}→${neg.v} can still relax. <b>Negative-weight cycle reachable from ${s}.</b>` : 'One more pass: no edge can relax. <b>No negative cycle;</b> distances are final.', tag: 'check', tbl: tbl() }));
  fr.result = { d, pi, neg: !!neg }; return fr;
}
function dagsp(G, s = G.V[0]) {
  const fr = [], A = adj(G), seen = {}, ord = []; const dfs = u => { seen[u] = 1; for (const { to } of A[u]) if (!seen[to]) dfs(to); ord.unshift(u); };
  for (const v of G.V) if (!seen[v]) dfs(v);
  const d = {}, st = {}; G.V.forEach(v => d[v] = Infinity); d[s] = 0; const lab = () => Object.fromEntries(G.V.map(v => [v, inf(d[v])]));
  fr.push(gframe(G, st, lab(), {}, { cap: `Topological order (DFS finish times reversed): ${ord.join(', ')}. Relax each vertex's edges once, in this order.`, tag: 'topo' }));
  for (const u of ord) { const up = []; for (const { to, w } of A[u]) if (d[u] !== Infinity && d[u] + w < d[to]) { d[to] = d[u] + w; up.push(`d[${to}] = ${d[to]}`); } fr.push(gframe(G, st, lab(), { [u]: 'cur' }, { cap: `Vertex ${u}: ${d[u] === Infinity ? 'unreachable so far, skip.' : up.length ? up.join('; ') + '.' : 'no improvement.'}`, tag: u })); }
  fr.result = { d, order: ord }; return fr;
}
const matOf = (title, V, M, hl = []) => ({ title, cols: V, rows: V.map((v, i) => ({ h: v, c: M[i].map((x, j) => ({ t: inf(x), hl: hl.some(h => h[0] === i && h[1] === j) })) })) });
function fw(G) {
  const n = G.V.length, ix = {}; G.V.forEach((v, i) => ix[v] = i);
  const D = G.V.map((_, i) => G.V.map((_, j) => i === j ? 0 : Infinity)), P = G.V.map(() => G.V.map(() => null));
  for (const e of G.E) { const put = (a, b) => { if (e.w < D[a][b]) { D[a][b] = e.w; P[a][b] = G.V[a]; } }; put(ix[e.u], ix[e.v]); if (!G.dir) put(ix[e.v], ix[e.u]); }
  const fr = [{ cap: 'D⁽⁰⁾ is the weight matrix; Π⁽⁰⁾ holds i where edge i→j exists.', tag: 'k=0', mats: [matOf('D⁽⁰⁾', G.V, D), matOf('Π⁽⁰⁾', G.V, P)] }];
  let neg = false;
  for (let k = 0; k < n; k++) {
    const hl = [], up = [];
    const old = D.map(r => r.slice());
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (old[i][k] !== Infinity && old[k][j] !== Infinity && old[i][k] + old[k][j] < old[i][j]) { D[i][j] = old[i][k] + old[k][j]; P[i][j] = P[k][j]; hl.push([i, j]); up.push(`d[${G.V[i]},${G.V[j]}] = ${inf(old[i][k])} + ${inf(old[k][j])} = ${D[i][j]}`); }
    const negs = G.V.filter((_, i) => D[i][i] < 0); if (negs.length) neg = true;
    fr.push({ cap: `<b>k = ${G.V[k]}:</b> allow ${G.V[k]} as an intermediate vertex. ${up.length ? up.join('; ') + '.' : 'No entry improves.'}${negs.length ? ` <b>Negative diagonal at ${negs.join(', ')}: negative cycle through these vertices.</b>` : ''}`, tag: 'k=' + G.V[k], mats: [matOf(`D⁽${k + 1}⁾`, G.V, D, hl), matOf(`Π⁽${k + 1}⁾`, G.V, P, hl)] });
  }
  fr.result = { D, P, neg, negV: G.V.filter((_, i) => D[i][i] < 0) }; return fr;
}
function matmul(G) {
  const n = G.V.length, ix = {}; G.V.forEach((v, i) => ix[v] = i);
  const W = G.V.map((_, i) => G.V.map((_, j) => i === j ? 0 : Infinity)); for (const e of G.E) { W[ix[e.u]][ix[e.v]] = e.w; if (!G.dir) W[ix[e.v]][ix[e.u]] = e.w; }
  const ext = (A, B) => A.map((r, i) => r.map((_, j) => { let m = Infinity; for (let k = 0; k < n; k++) m = Math.min(m, A[i][k] + B[k][j]); return m; }));
  let L = W, m = 1; const fr = [{ cap: 'L⁽¹⁾ = W. Each product allows paths with more edges.', tag: 'm=1', mats: [matOf('L⁽¹⁾', G.V, L)] }];
  while (m < n - 1) { const X = ext(L, L), hl = []; X.forEach((r, i) => r.forEach((x, j) => { if (x !== L[i][j]) hl.push([i, j]); })); m *= 2; L = X; fr.push({ cap: `Repeated squaring: L⁽${m}⁾ = L⁽${m / 2}⁾ ⊗ L⁽${m / 2}⁾, min over k of (l[i,k] + l[k,j]).`, tag: 'm=' + m, mats: [matOf(`L⁽${m}⁾`, G.V, L, hl)] }); }
  fr.result = { L }; return fr;
}
function closure(G) {
  const n = G.V.length, ix = {}; G.V.forEach((v, i) => ix[v] = i);
  const T = G.V.map((_, i) => G.V.map((_, j) => i === j ? 1 : 0)); for (const e of G.E) { T[ix[e.u]][ix[e.v]] = 1; if (!G.dir) T[ix[e.v]][ix[e.u]] = 1; }
  const fr = [{ cap: 'T⁽⁰⁾: 1 on the diagonal and where an edge exists.', tag: 'k=0', mats: [matOf('T⁽⁰⁾', G.V, T)] }];
  for (let k = 0; k < n; k++) { const hl = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!T[i][j] && T[i][k] && T[k][j]) { T[i][j] = 1; hl.push([i, j]); } fr.push({ cap: `k = ${G.V[k]}: t[i,j] = t[i,j] OR (t[i,k] AND t[k,j]).`, tag: 'k=' + G.V[k], mats: [matOf(`T⁽${k + 1}⁾`, G.V, T, hl)] }); }
  fr.result = { T }; return fr;
}
function johnson(G) {
  const fr = [], h = {}; G.V.forEach(v => h[v] = 0);
  const pass = () => { let c = false; for (const e of G.E) if (h[e.u] + e.w < h[e.v]) { h[e.v] = h[e.u] + e.w; c = true; } return c; };
  fr.push(gframe(G, {}, Object.fromEntries(G.V.map(v => [v, 0])), {}, { cap: 'Add a new vertex q with a 0-weight edge to every vertex. Run Bellman-Ford from q; all h start at 0.', tag: 'add q' }));
  for (let i = 0; i <= G.V.length; i++) { const c = pass(); if (!c) break; if (i === G.V.length) { fr.push(gframe(G, {}, {}, {}, { cap: 'Bellman-Ford still relaxes after |V| passes: negative cycle, stop.', tag: 'neg' })); fr.result = { neg: true }; return fr; } }
  const H = { V: G.V, dir: true, E: G.E.map(e => ({ u: e.u, v: e.v, w: e.w + h[e.u] - h[e.v] })) };
  fr.push(gframe(G, {}, Object.fromEntries(G.V.map(v => [v, 'h=' + h[v]])), {}, { cap: `h values: ${G.V.map(v => `h(${v})=${h[v]}`).join(', ')}.`, tag: 'h' }));
  fr.push(gframe(H, {}, Object.fromEntries(G.V.map(v => [v, 'h=' + h[v]])), {}, { cap: 'Reweight every edge: ŵ(u,v) = w(u,v) + h(u) − h(v). All weights are now ≥ 0, so Dijkstra is safe.', tag: 'reweight' }));
  const D = G.V.map(u => { const r = dijkstra(H, u).result.d; return G.V.map(v => r[v] === Infinity ? Infinity : r[v] + h[v] - h[u]); });
  fr.push({ cap: 'Run Dijkstra from every vertex on ŵ, then undo: d(u,v) = d̂(u,v) − h(u) + h(v).', tag: 'result', mats: [matOf('D (true distances)', G.V, D)] });
  fr.result = { h, D, reweighted: H.E }; return fr;
}
// Ford-Fulkerson. opts.bfs true: Edmonds-Karp. DFS explores neighbours alphabetically.
function flow(G, s, t, opts = {}) {
  s = s || G.V[0]; t = t || G.V[G.V.length - 1];
  const cap = {}, key = (a, b) => a + '\u0001' + b, f = {}; const nb = {}; G.V.forEach(v => nb[v] = new Set());
  for (const e of G.E) { cap[key(e.u, e.v)] = (cap[key(e.u, e.v)] || 0) + e.w; nb[e.u].add(e.v); nb[e.v].add(e.u); }
  const res = (a, b) => (cap[key(a, b)] || 0) - (f[key(a, b)] || 0) + (f[key(b, a)] || 0);
  const residual = () => { const E = []; for (const a of G.V) for (const b of [...nb[a]]) if (res(a, b) > 0) E.push({ u: a, v: b, w: res(a, b), st: '' }); return { V: G.V, dir: true, E, vlab: {}, vst: {} }; };
  const net = (path) => { const on = new Set(); if (path) for (let i = 0; i + 1 < path.length; i++) { on.add(key(path[i], path[i + 1])); on.add(key(path[i + 1], path[i])); } return { V: G.V, dir: true, vlab: {}, vst: {}, E: G.E.map(e => ({ u: e.u, v: e.v, w: `${f[key(e.u, e.v)] || 0}/${e.w}`, st: on.has(key(e.u, e.v)) ? 'cur' : '' })) }; };
  const find = () => {
    if (opts.bfs) { const par = { [s]: null }, q = [s]; while (q.length) { const u = q.shift(); for (const v of [...nb[u]].sort()) if (!(v in par) && res(u, v) > 0) { par[v] = u; q.push(v); } } if (!(t in par)) return null; const p = [t]; while (p[0] !== s) p.unshift(par[p[0]]); return p; }
    const seen = new Set([s]); const go = u => { if (u === t) return [t]; for (const v of [...nb[u]].sort()) if (!seen.has(v) && res(u, v) > 0) { seen.add(v); const r = go(v); if (r) return [u, ...r]; } return null; }; return go(s);
  };
  const fr = [{ cap: 'Start with zero flow. Labels are flow/capacity.', tag: 'init', graph: net(), graph2: residual() }]; let val = 0, it = 0;
  for (;;) {
    const p = find(); if (!p) break; it++;
    let b = Infinity; for (let i = 0; i + 1 < p.length; i++) b = Math.min(b, res(p[i], p[i + 1]));
    fr.push({ cap: `<b>Augmenting path ${it}:</b> ${p.join(' → ')} in the residual network. Bottleneck = ${b}.`, tag: 'path ' + it, graph: net(p), graph2: residual() });
    for (let i = 0; i + 1 < p.length; i++) { const a = p[i], c = p[i + 1], back = Math.min(b, f[key(c, a)] || 0); if (back) f[key(c, a)] -= back; if (b - back) f[key(a, c)] = (f[key(a, c)] || 0) + b - back; }
    val += b; fr.push({ cap: `Push ${b}. Flow value is now <b>${val}</b>.`, tag: '|f|=' + val, graph: net(p), graph2: residual() });
  }
  const S = new Set([s]), q = [s]; while (q.length) { const u = q.shift(); for (const v of nb[u]) if (!S.has(v) && res(u, v) > 0) { S.add(v); q.push(v); } }
  const cutE = G.E.filter(e => S.has(e.u) && !S.has(e.v)), cv = cutE.reduce((a, e) => a + e.w, 0);
  const finalNet = net(); finalNet.E.forEach((e, i) => { if (S.has(G.E[i].u) && !S.has(G.E[i].v)) e.st = 'cut'; }); finalNet.vst = Object.fromEntries([...S].map(v => [v, 'done']));
  fr.push({ cap: `No augmenting path remains: <b>max flow = ${val}</b>. Vertices reachable from ${s} in the residual network: S = {${[...S].join(', ')}}. Min cut edges: ${cutE.map(e => `${e.u}→${e.v}`).join(', ')}, capacity ${cv}.`, tag: 'done', graph: finalNet, graph2: residual() });
  fr.result = { value: val, S: [...S], cut: cutE, cutCap: cv, paths: it }; return fr;
}

// ===== Hash table. mode chain|linear|quad|double. Probe function f(k,i) is given by opts =====
function hashing(keys, m, opts) {
  const fr = [], T = Array.from({ length: m }, () => opts.mode === 'chain' ? [] : null); let bad = 0; const perKey = {};
  const view = hl => ({ cols: [...Array(m).keys()], cells: T.map((c, i) => ({ t: Array.isArray(c) ? c.join(' → ') : c === null ? '' : c, hl: i === hl })) });
  for (const k of keys) {
    if (opts.mode === 'chain') { const h = opts.h(k); bad += T[h].length ? 1 : 0; perKey[k] = T[h].length; T[h].push(k); fr.push({ cap: `h(${k}) = ${h}. ${T[h].length > 1 ? 'Chain at this slot.' : 'Empty slot.'}`, tag: String(k), hash: view(h) }); continue; }
    const tried = []; let placed = false;
    for (let i = 0; i < m * 3; i++) { const s = opts.f(k, i); tried.push(s); if (T[s] === null) { T[s] = k; placed = true; const c = i; bad += c; perKey[k] = c; fr.push({ cap: `${k}: probes ${tried.join(' → ')}. ${c} unsuccessful probe${c === 1 ? '' : 's'}. Placed at ${s}.`, tag: String(k), hash: view(s) }); break; } }
    if (!placed) { perKey[k] = null; fr.push({ cap: `${k}: probes ${tried.join(' → ')}. No free slot reachable: insertion fails.`, tag: String(k), hash: view(-1) }); }
  }
  fr.result = { table: T, unsuccessful: bad, perKey }; return fr;
}

// ===== state-space trees: nodes {txt:[lines], st, ch:[]} =====
// 0/1 knapsack: bound = fractional relaxation. opts.order: 'best' (largest bound first) or 'dfs' (take-branch first)
function knapsack(items, W, opts = {}) {
  const it = items.map((x, i) => ({ ...x, id: x.id ?? i + 1 })).sort((a, b) => b.v / b.w - a.v / a.w);
  const bound = (i, cw, cv) => { let b = cv, r = W - cw; for (let j = i; j < it.length && r > 0; j++) { if (it[j].w <= r) { b += it[j].v; r -= it[j].w; } else { b += it[j].v * r / it[j].w; r = 0; } } return Math.round(b * 1000) / 1000; };
  const root = { txt: ['W=0 V=0', 'ub=' + bound(0, 0, 0)], ch: [], st: 'open', i: 0, cw: 0, cv: 0, ub: bound(0, 0, 0), take: [] };
  let best = 0, bestT = [], leaf = null; const fr = [], open = [root];
  const strip = n => ({ txt: n.txt, st: n.st, edge: n.edge, ch: n.ch.map(strip) });
  fr.push({ cap: `Sort by value/weight: ${it.map(x => `item ${x.id} (${x.v}/${x.w} = ${Math.round(x.v / x.w * 100) / 100})`).join(', ')}. Root upper bound is the fractional knapsack value.`, tag: 'root', ptree: [strip(root)] });
  while (open.length) {
    let idx = 0;
    if (opts.order === 'dfs') idx = open.length - 1; else open.forEach((n, i) => { if (n.ub > open[idx].ub) idx = i; });
    const n = open.splice(idx, 1)[0];
    if (n.ub <= best) { n.st = 'pruned'; fr.push({ cap: `Node with bound ${n.ub} ≤ best ${best}: prune.`, tag: 'prune', ptree: [strip(root)] }); continue; }
    if (n.i === it.length) continue;
    n.st = 'exp'; const x = it[n.i]; const mk = (take) => {
      const cw = n.cw + (take ? x.w : 0), cv = n.cv + (take ? x.v : 0), feas = cw <= W, ub = feas ? bound(n.i + 1, cw, cv) : 0;
      return { txt: feas ? [`W=${cw} V=${cv}`, 'ub=' + ub] : [`W=${cw}`, 'infeasible'], edge: `${take ? '' : 'no '}item ${x.id}`, ch: [], st: feas ? 'open' : 'dead', i: n.i + 1, cw, cv, ub, take: take ? [...n.take, x.id] : n.take, feas };
    };
    const a = mk(true), b = mk(false); n.ch.push(a, b); const notes = [];
    for (const c of [a, b]) if (c.feas && c.cv > best) { best = c.cv; bestT = c.take; leaf = c; notes.push(`new best value ${best}`); }
    for (const c of [b, a]) if (c.feas) { if (c.i === it.length || c.ub <= best && c !== leaf) { if (c.ub <= best && c.i < it.length) c.st = 'pruned'; else c.st = 'leaf'; } else open.push(c); }
    fr.push({ cap: `Expand the node at level ${n.i}: branch on item ${x.id}. ${a.feas ? '' : 'Taking it exceeds capacity. '}${notes.join('; ')}.`, tag: 'item ' + x.id, ptree: [strip(root)] });
    n.st = 'done';
  }
  if (leaf) leaf.st = 'best';
  fr.push({ cap: `No open node can beat ${best}. <b>Optimal value ${best}</b> with items {${bestT.slice().sort((a, b) => a - b).join(', ')}}.`, tag: 'done', ptree: [strip(root)] });
  fr.result = { value: best, items: bestT }; return fr;
}
// Held-Karp DP, vertices 0..n-1, start 0, C is a cost matrix
function heldKarp(C) {
  const n = C.length, g = new Map(), p = new Map(), key = (S, i) => S + ':' + i, name = S => '{' + [...Array(n).keys()].filter(i => S >> i & 1).map(i => i + 1).join(',') + '}';
  const rows = [], fr = [];
  for (let i = 1; i < n; i++) { g.set(key(0, i), C[i][0]); rows.push([`g(${i + 1}, ∅)`, `c[${i + 1},1]`, C[i][0]]); }
  fr.push({ cap: 'Base: g(i, ∅) = c[i,1], the cost of going straight home from i.', tag: '|S|=0', tbl: { head: ['state', 'how', 'value'], rows: rows.map(r => r.slice()) } });
  const subs = []; for (let S = 1; S < (1 << n); S += 2) {} // start vertex excluded from S
  for (let S = 2; S < (1 << n); S += 2) subs.push(S); subs.sort((a, b) => pop(a) - pop(b) || a - b);
  function pop(x) { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; }
  let lastSz = 0;
  const full = (1 << n) - 2;
  for (const S of subs) {
    if (S === full) break;
    const sz = pop(S);
    if (sz !== lastSz && lastSz) fr.push({ cap: `All subsets of size ${lastSz} are done.`, tag: '|S|=' + lastSz, tbl: { head: ['state', 'how', 'value'], rows: rows.map(r => r.slice()) } });
    lastSz = sz;
    for (let i = 1; i < n; i++) { if (S >> i & 1) continue; let b = Infinity, bj = -1; const parts = []; for (let j = 1; j < n; j++) if (S >> j & 1) { const v = C[i][j] + g.get(key(S ^ (1 << j), j)); parts.push(`${C[i][j]}+${g.get(key(S ^ (1 << j), j))}`); if (v < b) { b = v; bj = j; } } g.set(key(S, i), b); p.set(key(S, i), bj); rows.push([`g(${i + 1}, ${name(S)})`, 'min(' + parts.join(', ') + ')', b]); }
  }
  let b = Infinity, bj = -1; const parts = [];
  for (let j = 1; j < n; j++) { const v = C[0][j] + g.get(key(full ^ (1 << j), j)); parts.push(`${C[0][j]}+${g.get(key(full ^ (1 << j), j))}`); if (v < b) { b = v; bj = j; } }
  rows.push([`g(1, ${name(full)})`, 'min(' + parts.join(', ') + ')', b]);
  const tour = [1]; let S = full, j = bj; while (j !== -1 && j !== undefined) { tour.push(j + 1); const ns = S ^ (1 << j); const nj = ns ? p.get(key(ns, j)) : -1; S = ns; j = nj; } tour.push(1);
  fr.push({ cap: `Answer g(1, all others) = <b>${b}</b>. Follow the choices back: tour <b>${tour.join(' → ')}</b>.`, tag: 'done', tbl: { head: ['state', 'how', 'value'], rows } });
  fr.result = { cost: b, tour }; return fr;
}
// Backtracking SAT. clauses: arrays like ["x'", "y"]. Branches on variables in sorted order; 0 first
function sat(clauses, opts = {}) {
  const vars = [...new Set(clauses.flat().map(l => l.replace("'", '')))].sort(), fr = [];
  const simp = (cl, v, b) => { const out = []; for (const c of cl) { const pos = c.includes(v), neg = c.includes(v + "'"); if ((pos && b) || (neg && !b)) continue; out.push(c.filter(l => l !== v && l !== v + "'")); } return out; };
  const show = cl => cl.length ? cl.map(c => '(' + c.join('∨') + ')').join('') : 'all satisfied';
  const root = { txt: [show(clauses)], st: 'open', ch: [] }; const strip = n => ({ txt: n.txt, st: n.st, edge: n.edge, ch: n.ch.map(strip) });
  const sols = []; fr.push({ cap: 'Root holds the whole formula.', tag: 'root', ptree: [strip(root)] });
  const go = (n, cl, i, asg) => {
    if (cl.some(c => !c.length)) { n.st = 'dead'; n.txt = [...n.txt.slice(0, 1), 'empty clause: fail']; fr.push({ cap: 'A clause became empty: dead end, backtrack.', tag: 'fail', ptree: [strip(root)] }); return false; }
    if (!cl.length) { n.st = 'best'; sols.push({ ...asg }); fr.push({ cap: `All clauses satisfied with ${Object.entries(asg).map(([a, b]) => a + '=' + b).join(', ')}.`, tag: 'SAT', ptree: [strip(root)] }); return true; }
    n.st = 'exp';
    const v = vars[i];
    for (const b of [0, 1]) { const nc = simp(cl, v, b), c = { txt: [show(nc)], st: 'open', ch: [], edge: `${v}=${b}` }; n.ch.push(c); const r = go(c, nc, i + 1, { ...asg, [v]: b }); if (r && !opts.all) return true; }
    n.st = 'done'; return false;
  };
  go(root, clauses, 0, {});
  fr.push({ cap: sols.length ? `<b>Satisfiable</b>: ${sols.map(s => Object.entries(s).map(([a, b]) => a + '=' + b).join(', ')).join(' ; ')}.` : '<b>Unsatisfiable:</b> every branch failed.', tag: 'done', ptree: [strip(root)] });
  fr.result = { sat: sols.length > 0, sols }; return fr;
}

// ===== text formats =====
function parseTreeText(s) { // 23B(8R(6B,15B(13R,19R)),27B(,29R))
  let i = 0; const ws = () => { while (s[i] === ' ') i++; };
  const node = () => { ws(); const m = /^-?\d+/.exec(s.slice(i)); if (!m) return null; i += m[0].length; const n = { k: +m[0], c: 'B', l: null, r: null }; if (/[RBrb]/.test(s[i] || '')) n.c = s[i++].toUpperCase(); ws(); if (s[i] === '(') { i++; n.l = node(); ws(); if (s[i] === ',') { i++; n.r = node(); ws(); } i++; } return n; };
  return node();
}
const preorder = (t, col) => { const o = []; (function g(n) { if (!n || n.nil) return; o.push(n.k + (col ? n.c : '')); g(n.l); g(n.r); })(t); return o.join(' '); };
const nestF = ns => ns.map(n => n.ch.length ? `${n.k}(${nestF(n.ch)})` : String(n.k)).join(' ');
// ops text: "41 38 del 8 acc 3"; words switch mode
function runTree(kind, text, opts = {}) {
  const frames = [], C = { rb: RB, avl: AVL, splay: Splay }[kind], T = new C(frames, opts); let body = text;
  const semi = text.indexOf(';');
  if (semi >= 0) { const t = parseTreeText(text.slice(0, semi)); if (t) { T.load(t); if (T.fixAll) T.fixAll(); frames.push({ cap: 'Given tree.', tag: 'start', hl: [], tree: T.snap() }); } body = text.slice(semi + 1); }
  let mode = 'ins';
  for (const w of body.trim().split(/[\s,]+/).filter(Boolean)) {
    if (/^(ins|insert)$/i.test(w)) mode = 'ins'; else if (/^(del|delete)$/i.test(w)) mode = 'del'; else if (/^(acc|access|find)$/i.test(w)) mode = 'acc';
    else { const k = +w; if (Number.isNaN(k)) continue; if (mode === 'ins') { if (T.find(k)) frames.push({ cap: `${k} is already in the tree, skipped.`, tag: 'dup', hl: [], tree: T.snap() }); else T.insert(k); } else if (mode === 'del') T.delete(k); else T.access(k); }
  }
  frames.result = { tree: T.snap(), T }; return frames;
}
function runHeap(kind, text, opts = {}) {
  const frames = [], H = kind === 'binomial' ? new Binomial(frames, opts) : new Fib(frames, opts); let mode = 'ins'; const words = text.trim().split(/[\s,]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) { const w = words[i];
    if (/^ins/i.test(w)) mode = 'ins'; else if (/^del/i.test(w)) mode = 'del'; else if (/^(ext|extract)/i.test(w)) H.extract(); else if (/^dec/i.test(w)) { H.decrease(+words[i + 1], +words[i + 2]); i += 2; }
    else { const k = +w; if (Number.isNaN(k)) continue; mode === 'ins' ? H.insert(k) : H.delete(k); } }
  frames.result = { H }; return frames;
}
function parseFib(s) { // "7(30) 24(26*(35) 46) 23 ...", * marks a node; min given by "min=5" or smallest
  const m = /min\s*=\s*(-?\d+)/.exec(s); const t = s.replace(/min\s*=\s*-?\d+/, ''); let i = 0;
  const ws = () => { while (/[\s,]/.test(t[i] || '')) i++; };
  const list = () => { const o = []; for (;;) { ws(); const r = /^-?\d+/.exec(t.slice(i)); if (!r) break; i += r[0].length; const n = { k: +r[0], ch: [], mark: false }; if (t[i] === '*') { n.mark = true; i++; } if (t[i] === '(') { i++; n.ch = list(); ws(); i++; } o.push(n); } return o; };
  return { trees: list(), min: m ? +m[1] : null };
}
return { RB, AVL, Splay, Binomial, Fib, parseGraph, kruskal, prim, dijkstra, bellman, dagsp, fw, matmul, closure, johnson, flow, hashing, knapsack, heldKarp, sat, parseTreeText, preorder, nestF, runTree, runHeap, parseFib, clone };
});
