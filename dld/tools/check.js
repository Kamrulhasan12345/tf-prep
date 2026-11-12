// node dld/tools/check.js  — asserts the logic engine against textbook answers and brute force.
const L = require('../assets/logic.js');
const assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const eqSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const W = ['w', 'x', 'y', 'z'];

// --- minimization (Morris examples) ---
let r = L.minimize(4, [0, 1, 2, 4, 5, 6, 8, 9, 12, 13, 14], [], W);
ok(eqSet(r.sop.split(' + '), ["y'", "w'z'", "xz'"]), 'Morris 3.4: ' + r.sop);
r = L.minimize(4, [0, 1, 2, 8, 10, 11, 14, 15], [], W);
ok(eqSet(r.pis.map(r.piStr), ["w'x'y'", "x'z'", 'wy']) && r.sop.split(' + ').length === 3, 'Morris tabulation: ' + r.pis.map(r.piStr));
r = L.minimize(4, [1, 3, 7, 11, 15], [0, 2, 5], W);
ok(eqSet(r.sop.split(' + '), ["w'z", 'yz']) || eqSet(r.sop.split(' + '), ["w'x'", 'yz']), 'Morris dc: ' + r.all);
const p = L.pos(4, [0, 1, 2, 5, 8, 9, 10], [], ['A', 'B', 'C', 'D']);
ok(p.sop === "AB + CD + BD'" || eqSet(p.comp.split(' + '), ['AB', 'CD', "BD'"]), 'Morris POS complement ' + p.comp);
ok(p.pos.includes("(A' + B')") && p.pos.includes("(C' + D')") && p.pos.includes("(B' + D)"), 'Morris POS ' + p.pos);

// random brute-force: our minimum literal count equals exhaustive search over all implicant cubes (3 and 4 vars)
function brute(nv, ones, dc) {
  const N = 1 << nv, ok = new Set([...ones, ...dc]), cubes = [];
  for (let m = 0; m < N; m++) for (let v = 0; v < N; v++) if (!(v & m)) { const ms = L.cubeMinterms({ v, m }, nv); if (ms.every(x => ok.has(x))) cubes.push({ v, m, ms }); }
  let best = [Infinity, Infinity];
  const useful = cubes.filter(c => c.ms.some(x => ones.includes(x)));
  (function rec(i, pick, cov) {
    if (pick.length > best[0]) return;
    if (ones.every(x => cov.has(x))) { const c = [pick.length, pick.reduce((s, c) => s + L.lits(c, nv), 0)]; if (c[0] < best[0] || (c[0] === best[0] && c[1] < best[1])) best = c; return; }
    if (i === useful.length) return;
    rec(i + 1, [...pick, useful[i]], new Set([...cov, ...useful[i].ms])); rec(i + 1, pick, cov);
  })(0, [], new Set());
  return best;
}
let seed = 7; const rnd = k => (seed = (seed * 1103515245 + 12345) % 2147483648) % k;
for (let t = 0; t < 60; t++) {
  const nv = t < 30 ? 3 : 4, ones = [], dc = [];
  for (let x = 0; x < 1 << nv; x++) { const q = rnd(10); if (q < 4) ones.push(x); else if (q < 5) dc.push(x); }
  if (!ones.length) continue;
  const m = L.minimize(nv, ones, dc);
  const tt = L.parse(m.sop, L.VARS(nv));
  ok(L.sameFn(tt, ones, dc), 'sop wrong ' + m.sop);
  if (nv === 3 || t < 42) { const b = brute(nv, ones, dc); ok(m.sols[0].length === b[0] && m.sols[0].reduce((s, c) => s + L.lits(c, nv), 0) === b[1], `not minimal ${ones}|${dc}: ${m.sop} vs ${b}`); }
}

// --- parser ---
ok(L.onesOf(L.parse("x'y + (y z)' ^ 1", ['x', 'y', 'z'])).join() === '2,3,7', 'parser');
ok(L.onesOf(L.parse("yA x1 + yB'", ['yA', 'yB', 'x1'])).join() === '0,1,4,5,7', 'multi-letter vars');

// --- MUX residues: 2019-20 8(b) ---
const res = L.residues(4, [1, 2, 4, 10, 12, 13, 14, 15], [], [0, 1]);
ok(res.map(x => x.expr).join('|') === "A'B + AB'|A'B'|AB'|1".replace(/A/g, 'C').replace(/B/g, 'D'), 'residues ' + res.map(x => x.expr));

// --- PLA (Morris): F1=Σ(0,1,2,4), F2=Σ(0,5,6,7) -> 4 terms, F1 complemented ---
let pl = L.pla(3, [[0, 1, 2, 4], [0, 5, 6, 7]]);
ok(pl.count === 4 && pl.tc[0] === 'C', 'PLA Morris ' + JSON.stringify(pl));
for (let t = 0; t < 15; t++) { // every PLA output must realise its function
  const fns = [0, 1, 2].map(() => L.range(8).filter(() => rnd(2)));
  const q = L.pla(3, fns);
  fns.forEach((f, i) => { const tt = L.parse(q.exprs[i], L.VARS(3)); const want = q.tc[i] === 'T' ? f : L.range(8).filter(x => !f.includes(x)); ok(L.sameFn(tt, want), 'pla fn ' + i); });
}

// --- flip-flop conversion ---
let cv = L.convert('JK', 'T'); ok(L.sameFn(L.parse(cv.eq.T.sop, cv.vars), L.onesOf(L.parse("J Q' + K Q", cv.vars))), 'JK from T: ' + cv.eq.T.sop);
cv = L.convert('D', 'T'); ok(L.sameFn(L.parse(cv.eq.T.sop, cv.vars), L.onesOf(L.parse("D ^ Q", cv.vars))), 'D from T');
cv = L.convert('T', 'JK'); ok(cv.eq.J.sop === 'T' && cv.eq.K.sop === 'T', 'T from JK');
cv = L.convert('D', 'JK'); ok(cv.eq.J.sop === 'D' && cv.eq.K.sop === "D'", 'D from JK');

// --- counters: every listed transition holds, unused states reach the cycle (or are flagged) ---
for (const ff of [['JK', 'T', 'D'], 'SR', 'JK', 'T', 'D']) {
  const c = L.counter([0, 2, 4, 7, 5, 3], 3, ff);
  [0, 2, 4, 7, 5, 3].forEach((s, i, a) => ok(L.step(c.spec, c.eq, s) === a[(i + 1) % a.length], 'counter step ' + ff));
}
const c12 = L.counter([0, 1, 2, 5, 4, 6], 3, 'SR'); [0, 1, 2, 5, 4, 6].forEach((s, i, a) => ok(L.step(c12.spec, c12.eq, s) === a[(i + 1) % a.length], 'counter 2017'));

// --- analysis: 2019-20 2(b) ---
const an = L.analyze({ sv: ['yA', 'yB'], iv: ['x1', 'x2'], ff: ['JK', 'JK'], labels: ['A', 'B'], eqs: { JA: 'yA x1 + yB x2', KA: 'yA yB + x1 x2', JB: 'yA x1', KB: 'yA yB x1 + yB x2' }, outs: { z: 'yA x1 x2 + yB x1 x2' } });
ok(an.length === 16 && an.find(q => q.ps === 0 && q.x === 3).ns === 0, 'analysis');
ok(an.find(q => q.ps === 3 && q.x === 3).ns === 0 && an.find(q => q.ps === 3 && q.x === 3).z[0] === 1, 'analysis 11/11'); // JA=1 KA=1 toggle ->0 ; JB=1 KB=1 toggle ->0

// --- completely specified minimization (2020-21 7a) checked by simulation ---
function equivalent(M, Min, map, trials = 300) {
  for (let t = 0; t < trials; t++) for (const s of M.S) {
    let a = s, b = map(s);
    for (let k = 0; k < 8; k++) { const x = rnd(M.I.length); const [na, oa] = M.t[a][x]; const [nb, ob] = Min.t[b][x]; if (na === null) break; if (oa !== null && ob !== oa) return false; a = na; b = nb; if (b === null) return false; }
  }
  return true;
}
const T20 = L.parseTable(`A: B,1 H,1
B: F,1 D,1
C: D,0 E,1
D: C,0 F,1
E: D,1 C,1
F: C,1 C,1
G: C,1 D,1
H: C,0 A,1`);
const pt = L.partitions(T20);
ok(equivalent(T20, pt.min, s => pt.min.S.find(x => pt.classes.find(b => b.includes(s))[0] === x)), 'partition sim');
// implication table must agree with partitions on a completely specified machine
const im = L.implication(T20);
ok(im.compat.length === pt.classes.reduce((s, b) => s + b.length * (b.length - 1) / 2, 0), 'implication == partition');

// --- incompletely specified: closed cover realises the machine (2023-24 7a, 2017-18 7b, 2021-22 7b, 2020-21 7b) ---
const ISM = [
  L.parseTable(`A: B,0 C,0
B: D,0 -,-
C: F,0 E,1
D: B,0 G,0
E: F,0 C,1
F: E,0 D,1
G: F,0 -,-`),
  L.parseTable(`A: A,- B,1
B: G,- D,0
C: B,1 B,-
D: A,1 B,-
E: C,- A,-
F: F,- C,-
G: G,- G,-`),
  L.parseTable(`A: C,0 E,1 -
B: C,0 E,- -
C: B,- C,0 A,-
D: B,0 C,- E,-
E: - E,0 A,-`),
  L.parseTable(`A: A,00 E,01 - A,01
B: - C,10 B,00 D,11
C: A,00 C,10 - -
D: A,00 - - D,11
E: - E,01 F,00 -
F: - G,10 F,00 G,11
G: A,00 - - G,11`),
];
for (const M of ISM) {
  const R = L.reduce(M);
  ok(R.lower <= R.cover.length && R.cover.length <= R.upper, 'bounds');
  // each original state s is simulated by any cover member containing it
  const map = s => R.min.S[R.cover.findIndex(c => c.includes(s))];
  ok(equivalent(M, R.min, map), 'IS cover simulates machine ' + M.S.join(''));
}

// --- Mealy -> Moore (2023-24 8c) by simulation ---
const ME = L.parseTable(`A: B,1 C,0
B: C,1 D,0
C: D,0 E,1
D: E,0 A,1
E: A,1 B,1`);
const MO = L.mealyToMoore(ME);
for (let t = 0; t < 200; t++) { let a = 'A', b = MO.start; for (let k = 0; k < 10; k++) { const x = rnd(2); const [na, oa] = ME.t[a][x]; b = MO.t[b][x]; ok(MO.z[b] === oa, 'moore output'); a = na; } }
const back = L.mooreToMealy(MO); ok(back.S.length === MO.S.length, 'moore->mealy');

// --- race-free assignment (2020-21 8b: a,b,c triangle -> no 2-bit assignment) ---
const F = L.parseTable(`a: a,0 b,- a,1 b,-
b: a,- b,0 c,- b,0
c: a,- c,1 c,0 b,-`);
ok(L.assignments(F.S, L.flowEdges(F), 2).length === 0, 'triangle needs extra state');

// --- numbers ---
ok(L.rComp('6900', 16) === '9700' && L.rComp('0110', 2, true) === '1001', 'complements');
ok(L.ungray(L.gray(13)) === 13, 'gray');

console.log('logic.js: ' + n + ' checks passed');
