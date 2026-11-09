// Invariant and known-answer checks for algo.js. Run: node dsa2/tools/check.js
const A = require('../assets/algo.js'), assert = require('assert');
function rbOK(t) { assert(!t || t.c === 'B', 'root black'); (function bh(n) { if (!n) return 1; assert(!n.db); if (n.c === 'R') assert((!n.l || n.l.c === 'B') && (!n.r || n.r.c === 'B'), 'red-red'); if (n.l) assert(n.l.k < n.k); if (n.r) assert(n.r.k > n.k); const a = bh(n.l), b = bh(n.r); assert.strictEqual(a, b, 'black height'); return a + (n.c === 'B' ? 1 : 0); })(t); }
function avlOK(t) { (function h(n) { if (!n) return 0; const a = h(n.l), b = h(n.r); assert(Math.abs(a - b) < 2, 'avl'); assert.strictEqual(n.bf, a - b); return 1 + Math.max(a, b); })(t); }
function inorder(t, o = []) { if (t) { inorder(t.l, o); o.push(t.k); inorder(t.r, o); } return o; }
let rnd = (s => () => (s = s * 1664525 + 1013904223 >>> 0) / 4294967296)(7);
const ri = n => Math.floor(rnd() * n);
const shuffled = n => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
for (let t = 0; t < 400; t++) for (const kind of ['rb', 'avl', 'splay']) for (const pred of [false, true]) {
  const n = 1 + ri(30), a = shuffled(n); let f = A.runTree(kind, a.join(' '), { pred }); const tr = f.result.T;
  if (kind === 'rb') rbOK(tr.snap()); if (kind === 'avl') avlOK(tr.snap());
  assert.deepStrictEqual(inorder(tr.snap()), [...Array(n).keys()]);
  const live = new Set(a); for (const k of shuffled(n).slice(0, ri(n + 1))) { tr.delete(k); live.delete(k); const s = tr.snap(); if (kind === 'rb') rbOK(s); if (kind === 'avl') avlOK(s); assert.deepStrictEqual(inorder(s), [...live].sort((x, y) => x - y)); }
}
function heapOK(ns, max, p) { for (const n of ns) { if (p !== undefined) assert(max ? n.k <= p : n.k >= p); heapOK(n.ch, max, n.k); } }
function count(ns) { return ns.reduce((a, n) => a + 1 + count(n.ch), 0); }
function binTree(n, d) { assert.strictEqual(n.ch.length, d); n.ch.forEach((c, i) => binTree(c, d - 1 - i)); }
for (let t = 0; t < 300; t++) for (const max of [false, true]) {
  const fr = []; const H = new A.Binomial(fr, { max }), keys = shuffled(1 + ri(40));
  keys.forEach(k => H.insert(k)); const cmp = max ? (a, b) => b - a : (a, b) => a - b, sorted = keys.slice().sort(cmp);
  const chk = () => { H.snap().forEach(r => binTree(r, r.deg)); heapOK(H.snap(), max); const ds = H.roots.map(r => r.deg); assert.deepStrictEqual(ds, [...new Set(ds)].sort((a, b) => a - b)); };
  chk(); for (const s of sorted) { assert.strictEqual(H.extract(), s); chk(); }
}
for (let t = 0; t < 300; t++) {
  const fr = [], H = new A.Fib(fr), keys = shuffled(2 + ri(40)).map(x => x * 2); keys.forEach(k => H.insert(k));
  const live = new Set(keys);
  for (let i = 0; i < keys.length; i++) {
    if (rnd() < .5 && live.size > 1) { const arr = [...live], k = arr[ri(arr.length)], nk = k - 1 - ri(3) * 2 - 1; if (nk > -100 && !live.has(nk) && H.find(k)) { H.decrease(k, nk); live.delete(k); live.add(nk); } }
    const m = Math.min(...live); assert.strictEqual(H.extract(), m); live.delete(m); heapOK(H.roots.map(r => H.snapN(r)), false); assert.strictEqual(count(H.roots.map(r => H.snapN(r))), live.size); if (!live.size) break;
  }
}
// brute-force cross checks on random graphs
for (let t = 0; t < 200; t++) {
  const n = 2 + ri(6), V = [...Array(n).keys()].map(i => String.fromCharCode(65 + i)); let edges = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rnd() < .7 || j === i + 1) edges.push(`${V[i]}-${V[j]} ${1 + ri(9)}`);
  const G = A.parseGraph(edges.join(', ')); assert.strictEqual(A.kruskal(G).result.total, A.prim(G).result.total);
  const dE = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && rnd() < .5) dE.push(`${V[i]}>${V[j]} ${1 + ri(9)}`); if (!dE.length) dE.push(`${V[0]}>${V[1]} 1`);
  const D = A.parseGraph(dE.join(', ')); const a = A.dijkstra(D).result.d, b = A.bellman(D).result.d, fw = A.fw(D).result.D, jo = A.johnson(D).result.D;
  D.V.forEach((v, i) => { assert.strictEqual(a[v], b[v]); assert.strictEqual(fw[0][i], a[v]); assert.strictEqual(jo[0][i], a[v]); });
  const dd = A.flow(D, D.V[0], D.V[D.V.length - 1]).result, ek = A.flow(D, D.V[0], D.V[D.V.length - 1], { bfs: true }).result; assert.strictEqual(dd.value, ek.value); assert.strictEqual(dd.value, dd.cutCap);
  // knapsack vs brute
  const m = 1 + ri(6), it = [...Array(m)].map(() => ({ w: 1 + ri(9), v: 1 + ri(40) })), W = 3 + ri(15); let best = 0; for (let s = 0; s < 1 << m; s++) { let w = 0, v = 0; it.forEach((x, i) => { if (s >> i & 1) { w += x.w; v += x.v; } }); if (w <= W) best = Math.max(best, v); }
  for (const order of ['best', 'dfs']) assert.strictEqual(A.knapsack(it, W, { order }).result.value, best, 'knapsack');
}
for (let t = 0; t < 60; t++) { const n = 3 + ri(3), C = [...Array(n)].map((_, i) => [...Array(n)].map((_, j) => i === j ? 0 : 1 + ri(20))); const r = A.heldKarp(C).result; const P = (a, l) => l.length ? l.flatMap((x, i) => P([...a, x], l.filter((_, j) => j !== i))) : [a]; let b = Infinity; for (const p of P([], [...Array(n - 1).keys()].map(x => x + 1))) { let c = 0, u = 0; for (const v of [...p, 0]) { c += C[u][v]; u = v; } b = Math.min(b, c); } assert.strictEqual(r.cost, b); let c = 0; for (let i = 0; i + 1 < r.tour.length; i++) c += C[r.tour[i] - 1][r.tour[i + 1] - 1]; assert.strictEqual(c, b, 'tour cost'); }
// known answers from the papers
const p = A.runTree('rb', '41 38 31 12 19 8 25 32'); console.log('RB 2024-25 after inserts:', A.preorder(p.result.tree, true));
const q = A.runTree('rb', '41 38 31 12 19 8 25 32 del 8 12 19'); console.log('RB after deletes:', A.preorder(q.result.tree, true));
const G7 = A.parseGraph('A-B 1, A-C 3, A-D 4, B-C 2, B-D 6, C-D 5, C-E 7, D-E 8, E-F 9, D-F 10, C-F 11'); console.log('MST 24-25:', A.kruskal(G7).result);
const fw2 = A.fw(A.parseGraph('A>B 3, B>C 2, C>D 2, D>B -8, A>D 10, B>D 5')).result; console.log('FW 24-25 neg:', fw2.neg, fw2.negV);
const rel = A.flow(A.parseGraph('s>D1 15, s>D2 20, s>D3 10, D1>Z1 99, D1>Z2 99, D2>Z1 99, D2>Z3 99, D2>Z4 99, D3>Z2 99, D3>Z4 99, Z1>t 10, Z2>t 15, Z3>t 10, Z4>t 10'), 's', 't').result; console.log('Relief max flow:', rel.value, rel.S);
console.log('Knapsack 24-25:', A.knapsack([{ w: 4, v: 40 }, { w: 3, v: 50 }, { w: 5, v: 70 }, { w: 3, v: 45 }], 10).result);
console.log('TSP 22-23:', A.heldKarp([[0, 10, 15, 20], [5, 0, 12, 18], [8, 9, 0, 17], [11, 14, 16, 0]]).result);
console.log('SAT 24-25:', A.sat([["x'", "y'"], ["x'", 'y'], ['x', "y'", 'z'], ['x', 'y', 'z']]).result.sat);
const fibIn = A.parseFib('7(30) 24(26(35) 46) 23(51) 17 5(18 52 41(44)) min=5'); const fr = []; const F = new A.Fib(fr); F.load(fibIn.trees, fibIn.min); F.extract(); console.log('Fib 24-25 Q4d:', A.nestF(F.roots.map(r => F.snapN(r))), 'min', F.min.k);
const h = (k) => k % 11; console.log('Hash linear:', JSON.stringify(A.hashing([10, 22, 31, 4, 15, 28, 17, 88, 59], 11, { mode: 'linear', f: (k, i) => (k % 11 + 2 * i) % 11 }).result));
console.log('Hash quad:', JSON.stringify(A.hashing([10, 22, 31, 4, 15, 28, 17, 88, 59], 11, { mode: 'quad', f: (k, i) => (k % 11 + 3 * i * i) % 11 }).result));
console.log('Hash double:', JSON.stringify(A.hashing([10, 22, 31, 4, 15, 28, 17, 88, 59], 11, { mode: 'double', f: (k, i) => (k % 11 + i * (7 - k % 7)) % 11 }).result));
console.log('all invariants passed');
