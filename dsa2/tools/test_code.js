// Compiles dsa2/code/*.cpp and checks each against assets/algo.js on random inputs.
// Run: node dsa2/tools/test_code.js
const A = require('../assets/algo.js'), cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const CODE = path.join(__dirname, '../code'), TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dsa2code-'));
const progs = fs.readdirSync(CODE).filter(f => f.endsWith('.cpp')).map(f => f.slice(0, -4));
let rs = 12345; const rnd = () => (rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296, ri = n => Math.floor(rnd() * n), pick = a => a[ri(a.length)];
const stats = {}; let failures = 0;
function ok(group, cond, msg) { const s = stats[group] ||= { pass: 0, fail: 0 }; if (cond) s.pass++; else { s.fail++; if (++failures <= 15) console.log(`FAIL [${group}] ${msg}`); } }
const run = (p, input, args = []) => { const r = cp.spawnSync(path.join(TMP, p), args, { input, encoding: 'utf8' }); return r.status === 0 ? r.stdout : 'CRASH ' + r.status + ' ' + r.stderr; };
const lines = s => s.split('\n').map(x => x.trim());
const L = i => String.fromCharCode(65 + i), num = x => x === Infinity ? 'INF' : String(x);

console.error("== compile with warnings as failures");
// compile all in parallel (shell background jobs), one stderr file per program
cp.spawnSync('sh', ['-c', 'for p in "$@"; do (g++ -std=c++17 -O2 -Wall -Wextra "$0/$p.cpp" -o "$1/$p" 2> "$1/$p.err"; echo $? > "$1/$p.rc") & done; wait', CODE, TMP, ...progs]);
for (const p of progs) { const err = fs.readFileSync(path.join(TMP, p + '.err'), 'utf8'); ok('compile', fs.readFileSync(path.join(TMP, p + '.rc'), 'utf8').trim() === '0' && err === '', p + ' ' + err); }
const need = ['kruskal', 'prim', 'bellman_ford', 'dag_sssp', 'dijkstra', 'floyd_warshall', 'transitive_closure', 'johnson', 'ford_fulkerson', 'edmonds_karp', 'bipartite_matching', 'avl', 'red_black', 'splay', 'hashing', 'binomial_heap', 'fibonacci_heap', 'sat_backtrack', 'knapsack_bb', 'tsp_held_karp', 'randomized_quicksort', 'karger', 'vertex_cover_approx'];
for (const p of need) ok('compile', progs.includes(p), 'missing ' + p);
const nonAscii = progs.filter(p => /—/.test(fs.readFileSync(path.join(CODE, p + '.cpp'), 'utf8'))); ok('compile', !nonAscii.length, 'em dash in ' + nonAscii);

console.error("== trees");
const snapPre = (n, f) => { const o = []; (function g(x) { if (!x) return; o.push(f(x)); g(x.l); g(x.r); })(n); return o.join(' '); };
console.error("trees");
for (const [kind, prog] of [['rb', 'red_black'], ['avl', 'avl'], ['splay', 'splay']]) for (let t = 0; t < 400; t++) {
  const ops = [], keys = 1 + ri(40);
  for (let i = 0, n = 1 + ri(45); i < n; i++) { const r = rnd(); ops.push([r < .55 ? 'insert' : r < .85 || kind !== 'splay' ? 'delete' : 'access', ri(keys + 5)]); }
  const text = ops.map(o => `${o[0] === 'access' ? 'acc' : o[0] === 'insert' ? 'ins' : 'del'} ${o[1]}`).join(' ');
  const tree = A.runTree(kind, text).result.tree, out = lines(run(prog, `${ops.length}\n${ops.map(o => o.join(' ')).join('\n')}\n`));
  ok(prog, out[0] === A.preorder(tree, kind === 'rb'), `${text}\n got ${out[0]}\n exp ${A.preorder(tree, kind === 'rb')}`);
  if (kind === 'avl') ok('avl bf', out[1] === snapPre(tree, x => x.bf), text);
}

console.error("== heaps");
for (const [kind, prog] of [['binomial', 'binomial_heap'], ['fib', 'fibonacci_heap']]) for (let t = 0; t < 400; t++) {
  const live = [], used = new Set(), ops = [];
  const fresh = () => { let k; do k = 1 + ri(300); while (used.has(k)); used.add(k); return k; };
  for (let i = 0, n = 1 + ri(40); i < n; i++) {
    const r = rnd();
    if (r < .45 || !live.length) { const k = fresh(); live.push(k); ops.push(['insert', k]); }
    else if (r < .65) { const m = Math.min(...live); live.splice(live.indexOf(m), 1); ops.push(['extract']); }
    else if (r < .85) { const j = ri(live.length), o = live[j], c = []; for (let k = -5; k < o; k++) if (!used.has(k)) c.push(k); if (!c.length) continue; const nk = pick(c); used.add(nk); live[j] = nk; ops.push(['decrease', o, nk]); }
    else { const j = ri(live.length); ops.push(['delete', live[j]]); live.splice(j, 1); }
  }
  const text = ops.map(o => o[0].slice(0, 3) === 'ext' ? 'ext' : o[0].slice(0, 3) + ' ' + o.slice(1).join(' ')).join(' ');
  const H = A.runHeap(kind, text).result.H, forest = kind === 'fib' ? H.roots.map(r => H.snapN(r)) : H.snap();
  const out = lines(run(prog, `${ops.length}\n${ops.map(o => o.join(' ')).join('\n')}\n`));
  ok(prog, out[0] === A.nestF(forest), `${text}\n got ${out[0]}\n exp ${A.nestF(forest)}`);
  if (kind === 'fib') {
    ok('fib min', out[1] === 'min=' + (H.min ? H.min.k : 'none'), text);
    const mk = []; (function g(ns) { ns.forEach(n => { if (n.mark) mk.push(n.k); g(n.ch); }); })(forest);
    ok('fib marks', (out[2] || '').trim() === mk.sort((a, b) => a - b).join(' '), `${text}\n got ${out[2]} exp ${mk}`);
  }
}

console.error("== graphs");
const parseRow = s => s.trim().split(/\s+/);
function connected(n) { const E = []; for (let i = 1; i < n; i++) E.push([ri(i), i]); for (let k = ri(n * 2); k > 0; k--) { const u = ri(n), v = ri(n); if (u !== v) E.push([u, v]); } return E.map(([u, v]) => [u, v, 1 + ri(12)]); }
for (let t = 0; t < 400; t++) {
  const n = 2 + ri(8), E = connected(n), G = { V: [...Array(n).keys()].map(L), dir: false, E: E.map(([u, v, w]) => ({ u: L(u), v: L(v), w })) };
  const exp = A.kruskal(G).result.total, inp = `${n} ${E.length}\n${E.map(e => e.join(' ')).join('\n')}\n`;
  for (const p of ['kruskal', 'prim']) {
    const o = lines(run(p, inp)), tree = o.slice(1).filter(Boolean).map(l => l.split(' ').map(Number)), par = [...Array(n).keys()], f = x => par[x] === x ? x : par[x] = f(par[x]);
    tree.forEach(e => { par[f(e[0])] = f(e[1]); });
    ok(p, +o[0] === exp && tree.length === n - 1 && tree.reduce((a, e) => a + e[2], 0) === exp && new Set([...Array(n).keys()].map(f)).size === 1, `${inp} got ${o.join('|')} exp ${exp}`);
  }
}
function digraph(n, lo, hi, p = .4) { const E = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && rnd() < p) E.push([i, j, lo + ri(hi - lo + 1)]); return E; }
const mkG = (n, E) => ({ V: [...Array(n).keys()].map(L), dir: true, E: E.map(([u, v, w]) => ({ u: L(u), v: L(v), w })) });
const dist = (n, d) => [...Array(n).keys()].map(i => num(d[L(i)])).join(' ');
for (let t = 0; t < 500; t++) {
  const n = 2 + ri(7), s = ri(n), neg = t % 2, E = digraph(n, neg ? -4 : 0, 9, .15 + rnd() * .4), G = mkG(n, E), inp = `${n} ${E.length} ${s}\n${E.map(e => e.join(' ')).join('\n')}\n`;
  const be = A.bellman(G, L(s)).result, o = lines(run('bellman_ford', inp));
  ok('bellman_ford', be.neg ? o[0] === 'NEGATIVE CYCLE' : o[0] === dist(n, be.d), `${inp} got ${o[0]} exp ${be.neg ? 'NEG' : dist(n, be.d)}`);
  if (!neg) { const o2 = lines(run('dijkstra', inp)); ok('dijkstra', o2[0] === dist(n, A.dijkstra(G, L(s)).result.d), `${inp} got ${o2[0]}`); }
  // DAG: edges forward in a random order of the vertices
  const perm = [...Array(n).keys()].sort(() => rnd() - .5), D = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rnd() < .5) D.push([perm[i], perm[j], -5 + ri(15)]);
  const dinp = `${n} ${D.length} ${s}\n${D.map(e => e.join(' ')).join('\n')}\n`, o3 = lines(run('dag_sssp', dinp));
  ok('dag_sssp', o3[0] === dist(n, A.dagsp(mkG(n, D), L(s)).result.d), `${dinp} got ${o3[0]}`);
  // all pairs
  const fw = A.fw(G).result, o4 = lines(run('floyd_warshall', `${n} ${E.length}\n${E.map(e => e.join(' ')).join('\n')}\n`)), jo = A.johnson(G).result, o5 = lines(run('johnson', `${n} ${E.length}\n${E.map(e => e.join(' ')).join('\n')}\n`));
  ok('floyd_warshall', fw.neg ? o4[0] === 'NEGATIVE CYCLE' : fw.D.every((r, i) => o4[i] === r.map(num).join(' ')), `${inp} got ${o4.join('|')}`);
  ok('johnson', jo.neg ? o5[0] === 'NEGATIVE CYCLE' : jo.D.every((r, i) => o5[i] === r.map(num).join(' ')), `${inp} got ${o5.join('|')}`);
  ok('johnson/fw agree on neg cycle', !!jo.neg === !!fw.neg, inp);
  const cl = A.closure(G).result.T, o6 = lines(run('transitive_closure', `${n} ${E.length}\n${E.map(e => e[0] + ' ' + e[1]).join('\n')}\n`));
  ok('transitive_closure', cl.every((r, i) => o6[i] === r.join(' ')), `${inp} got ${o6.join('|')}`);
}
console.error("== flow and matching");
for (let t = 0; t < 500; t++) {
  const n = 3 + ri(7), E = digraph(n, 1, 9, .15 + rnd() * .4), inp = `${n} ${E.length} 0 ${n - 1}\n${E.map(e => e.join(' ')).join('\n')}\n`, G = mkG(n, E);
  for (const [p, bfs] of [['ford_fulkerson', false], ['edmonds_karp', true]]) {
    const r = A.flow(G, 'A', L(n - 1), { bfs }).result, o = lines(run(p, inp)), S = A.flow(G, 'A', L(n - 1), { bfs }).result.S.map(x => x.charCodeAt(0) - 65).sort((a, b) => a - b).join(' ');
    ok(p, +o[0] === r.value && +o[1] === r.paths && o[2].trim() === S, `${inp} got ${o.join('|')} exp ${r.value} ${r.paths} ${S}`);
  }
}
for (let t = 0; t < 500; t++) {
  const nl = 1 + ri(6), nr = 1 + ri(6), E = []; for (let i = 0; i < nl; i++) for (let j = 0; j < nr; j++) if (rnd() < .4) E.push([i, j]);
  const net = ['s>' + 'L0 0'].slice(0, 0); const parts = []; for (let i = 0; i < nl; i++) parts.push(`s>L${i} 1`); for (let j = 0; j < nr; j++) parts.push(`R${j}>t 1`); E.forEach(([i, j]) => parts.push(`L${i}>R${j} 1`));
  const exp = A.flow(A.parseGraph(parts.join(', ')), 's', 't').result.value, o = lines(run('bipartite_matching', `${nl} ${nr} ${E.length}\n${E.map(e => e.join(' ')).join('\n')}\n`));
  const pr = o.slice(1).filter(Boolean).map(l => l.split(' ').map(Number)), es = new Set(E.map(String));
  ok('bipartite_matching', +o[0] === exp && pr.length === exp && pr.every(p => es.has(String(p))) && new Set(pr.map(p => p[0])).size === pr.length && new Set(pr.map(p => p[1])).size === pr.length, `${nl} ${nr} ${JSON.stringify(E)} got ${o.join('|')} exp ${exp}`);
}

console.error("== hashing");
for (let t = 0; t < 600; t++) {
  const m = 5 + ri(9), mode = pick(['chain', 'linear', 'quad', 'double']), c1 = mode === 'double' ? 2 + ri(6) : 1 + ri(3), c2 = 1 + ri(3), n = 3 + ri(m + 3), keys = [...new Set([...Array(n)].map(() => ri(200)))];
  const opts = mode === 'chain' ? { mode, h: k => k % m } : { mode, f: mode === 'linear' ? (k, i) => (k % m + c1 * i) % m : mode === 'quad' ? (k, i) => (k % m + c1 * i + c2 * i * i) % m : (k, i) => (k % m + i * (c1 - k % c1)) % m };
  const r = A.hashing(keys, m, opts).result, o = lines(run('hashing', `${mode} ${m} ${c1} ${c2}\n${keys.length} ${keys.join(' ')}\n`));
  const exp = r.table.map(c => Array.isArray(c) ? (c.length ? c.join(' ') : '-') : c === null ? '-' : String(c));
  ok('hashing', o.slice(0, m).map(x => x.trim()).join('|') === exp.join('|') && o[m] === 'collisions ' + r.unsuccessful, `${mode} ${m} ${c1} ${c2} ${keys} got ${o.join('|')} exp ${exp.join('|')} ${r.unsuccessful}`);
}

console.error("== search / optimisation");
for (let t = 0; t < 500; t++) {
  const n = 1 + ri(8), items = [...Array(n)].map(() => ({ w: 1 + ri(9), v: 1 + ri(40) })), W = 3 + ri(20), r = A.knapsack(items, W).result, o = lines(run('knapsack_bb', `${n} ${W}\n${items.map(i => i.w + ' ' + i.v).join('\n')}\n`));
  const ids = o[1].trim() ? o[1].trim().split(' ').map(Number) : [], sw = ids.reduce((a, i) => a + items[i - 1].w, 0), sv = ids.reduce((a, i) => a + items[i - 1].v, 0);
  ok('knapsack_bb', +o[0] === r.value && sv === r.value && sw <= W && new Set(ids).size === ids.length, `${W} ${JSON.stringify(items)} got ${o.join('|')} exp ${r.value}`);
}
for (let t = 0; t < 300; t++) {
  const n = 2 + ri(6), C = [...Array(n)].map((_, i) => [...Array(n)].map((_, j) => i === j ? 0 : 1 + ri(20))), r = A.heldKarp(C).result, o = lines(run('tsp_held_karp', `${n}\n${C.map(x => x.join(' ')).join('\n')}\n`));
  const tour = o[1].trim().split(' ').map(Number); let c = 0; for (let i = 0; i + 1 < tour.length; i++) c += C[tour[i] - 1][tour[i + 1] - 1];
  ok('tsp_held_karp', +o[0] === r.cost && c === r.cost && tour.length === n + 1 && tour[0] === 1 && tour[n] === 1 && new Set(tour).size === n, `${JSON.stringify(C)} got ${o.join('|')} exp ${r.cost}`);
  ok('tsp tour = engine tour', o[1].trim() === r.tour.join(' '), `${JSON.stringify(C)} got ${o[1]} exp ${r.tour.join(' ')}`);
}
for (let t = 0; t < 500; t++) {
  const nv = 2 + ri(6), cl = []; for (let i = 0, k = 1 + ri(13); i < k; i++) { const vs = [...Array(nv).keys()].sort(() => rnd() - .5).slice(0, 1 + ri(Math.min(3, nv))); cl.push(vs.map(v => [v + 1, rnd() < .5 ? -1 : 1])); }
  const eng = A.sat(cl.map(c => c.map(([v, s]) => String.fromCharCode(96 + v) + (s < 0 ? "'" : '')))).result, o = lines(run('sat_backtrack', `${nv} ${cl.length}\n${cl.map(c => c.map(([v, s]) => v * s).join(' ') + ' 0').join('\n')}\n`));
  let good = (o[0] === 'SAT') === eng.sat;
  if (good && eng.sat) {
    const asg = {}; o[1].trim().split(' ').forEach(x => { const [v, b] = x.split('='); asg[v] = +b; });
    good = cl.every(c => c.some(([v, s]) => (asg[v] ?? 0) === (s > 0 ? 1 : 0))) && o[1].trim() === Object.entries(eng.sols[0]).map(([a, b]) => `${a.charCodeAt(0) - 96}=${b}`).join(' ');
  }
  ok('sat_backtrack', good, `${JSON.stringify(cl)} got ${o.join('|')} exp ${eng.sat}`);
}

console.error("== randomized algorithms");
for (let t = 0; t < 400; t++) {
  const n = ri(60), a = [...Array(n)].map(() => ri(41) - 20), o = lines(run('randomized_quicksort', `${n}\n${a.join(' ')}\n`, [String(t)]));
  ok('randomized_quicksort', o[0] === [...a].sort((x, y) => x - y).join(' '), `${a} got ${o[0]}`);
}
const cutOf = (E, side) => E.filter(([u, v]) => side.has(u) !== side.has(v)).length;
for (let t = 0; t < 300; t++) {
  const n = 2 + ri(6), E = []; if (rnd() < .85) for (let i = 1; i < n; i++) E.push([ri(i), i]); for (let k = ri(n * 2); k > 0; k--) { const u = ri(n), v = ri(n); if (u !== v) E.push([u, v]); }
  let brute = Infinity; for (let s = 1; s < (1 << n) - 1; s++) brute = Math.min(brute, cutOf(E, new Set([...Array(n).keys()].filter(i => s >> i & 1))));
  const inp = `${n} ${E.length}\n${E.map(e => e.join(' ')).join('\n')}\n`;
  const parse = o => ({ k: +o[0], side: new Set(o[1].trim().split(' ').filter(Boolean).map(Number)) });
  const one = parse(lines(run('karger', inp, ['1', String(t)])));
  ok('karger valid cut', one.side.size > 0 && one.side.size < n && cutOf(E, one.side) === one.k && one.k >= brute, `${inp} got ${one.k} ${[...one.side]}`);
  const many = parse(lines(run('karger', inp, [String(40 * n * n), String(t + 1000)])));
  ok('karger finds min cut', many.k === brute && cutOf(E, many.side) === brute, `${inp} got ${many.k} exp ${brute}`);
}
for (let t = 0; t < 400; t++) {
  const n = 1 + ri(9), E = []; for (let k = ri(n * 2); k > 0; k--) { const u = ri(n), v = ri(n); if (u !== v) E.push([u, v]); }
  let opt = n; for (let s = 0; s < 1 << n; s++) if (E.every(([u, v]) => s >> u & 1 || s >> v & 1)) { let c = 0; for (let x = s; x; x &= x - 1) c++; opt = Math.min(opt, c); }
  const o = lines(run('vertex_cover_approx', `${n} ${E.length}\n${E.map(e => e.join(' ')).join('\n')}\n`)), C = new Set(o[1].trim().split(' ').filter(Boolean).map(Number));
  ok('vertex_cover_approx', +o[0] === C.size && E.every(([u, v]) => C.has(u) || C.has(v)) && C.size <= 2 * opt, `${n} ${JSON.stringify(E)} got ${o.join('|')} opt ${opt}`);
}

fs.rmSync(TMP, { recursive: true, force: true });
let tp = 0, tf = 0; for (const [g, s] of Object.entries(stats)) { console.log(`${s.fail ? 'FAIL' : 'ok  '} ${g}: ${s.pass}/${s.pass + s.fail}`); tp += s.pass; tf += s.fail; }
console.log(`total ${tp} passed, ${tf} failed`); process.exit(tf ? 1 : 0);
