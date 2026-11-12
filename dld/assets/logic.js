// CSE 205 logic engine. Pure functions, no DOM. Checked by `node dld/tools/check.js`.
// Minterm numbering: vars[0] is the MSB. A cube is {v, m}: m has a 1 for every eliminated variable.
const L = (() => {
  const pc = x => { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; };
  const range = n => [...Array(n).keys()];
  const VARS = n => ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n);

  // ---------- cubes ----------
  const lits = (c, n) => n - pc(c.m);
  const covers = (c, x) => (x & ~c.m) === c.v;
  const cubeMinterms = (c, n) => range(1 << n).filter(x => covers(c, x));
  function cubeStr(c, vars, sum = false) { // sum=true writes the maxterm (sum) for a cube of zeros
    const n = vars.length, out = [];
    for (let i = 0; i < n; i++) {
      const b = 1 << (n - 1 - i); if (c.m & b) continue;
      const one = !!(c.v & b); out.push(vars[i] + ((sum ? one : !one) ? "'" : ''));
    }
    if (sum) return out.length ? (out.length > 1 ? '(' + out.join(' + ') + ')' : out[0]) : '0';
    return out.length ? out.join('') : '1';
  }
  const cubeBits = (c, n) => range(n).map(i => { const b = 1 << (n - 1 - i); return c.m & b ? '-' : (c.v & b ? '1' : '0'); }).join('');

  // ---------- Quine-McCluskey ----------
  // returns {pis, cols}: cols[k] = list of {v,m,cov,used,ones} at combination level k (for the tabulation display)
  function qm(n, ones, dc = []) {
    const all = [...new Set([...ones, ...dc])].sort((a, b) => a - b);
    let level = all.map(x => ({ v: x, m: 0, cov: [x] })); const cols = [], pis = [];
    while (level.length) {
      const next = new Map();
      for (let i = 0; i < level.length; i++) for (let j = i + 1; j < level.length; j++) {
        const a = level[i], b = level[j], d = a.v ^ b.v;
        if (a.m !== b.m || pc(d) !== 1) continue;
        a.used = b.used = true;
        const v = a.v & ~d, m = a.m | d, k = v + ':' + m;
        if (!next.has(k)) next.set(k, { v, m, cov: [...new Set([...a.cov, ...b.cov])].sort((x, y) => x - y) });
      }
      level.forEach(c => { c.ones = pc(c.v); c.used = !!c.used; if (!c.used) pis.push(c); });
      cols.push(level.sort((a, b) => a.ones - b.ones || a.cov[0] - b.cov[0]));
      level = [...next.values()];
    }
    return { pis, cols };
  }

  // exact minimum cover: essential PIs first, then the cheapest completion (fewest terms, then literals). Returns every optimum.
  function minimize(n, ones, dc = [], vars = VARS(n)) {
    ones = [...new Set(ones)].sort((a, b) => a - b);
    const { pis, cols } = qm(n, ones, dc);
    const useful = pis.filter(p => p.cov.some(x => ones.includes(x)));
    const epi = [], resp = new Map();
    for (const x of ones) { const c = useful.filter(p => p.cov.includes(x)); if (c.length === 1) { if (!epi.includes(c[0])) epi.push(c[0]); resp.set(c[0], [...(resp.get(c[0]) || []), x]); } }
    const left = ones.filter(x => !epi.some(p => p.cov.includes(x)));
    const rest = useful.filter(p => !epi.includes(p));
    let best = [], bestCost = [Infinity, Infinity];
    if (!left.length) best = [[]]; else {
      for (let k = 1; k <= rest.length && !best.length; k++) {
        (function rec(start, pick) {
          if (pick.length === k) {
            if (!left.every(x => pick.some(p => p.cov.includes(x)))) return;
            const cost = [k, pick.reduce((s, p) => s + lits(p, n), 0)];
            if (cost[1] < bestCost[1]) { bestCost = cost; best = [pick.slice()]; } else if (cost[1] === bestCost[1]) best.push(pick.slice());
            return;
          }
          for (let i = start; i < rest.length; i++) { pick.push(rest[i]); rec(i + 1, pick); pick.pop(); }
        })(0, []);
      }
    }
    const sols = best.map(extra => [...epi, ...extra].sort((a, b) => a.cov[0] - b.cov[0]));
    const str = s => s.length ? s.map(c => cubeStr(c, vars)).join(' + ') : '0';
    return {
      pis, useful, epi, resp, cols, sols, vars, n,
      sop: ones.length === 1 << n ? '1' : str(sols[0] || []),
      all: sols.map(str),
      piStr: p => cubeStr(p, vars), bits: p => cubeBits(p, n),
    };
  }
  // POS: minimize the zeros, write each zero-cube as a sum term
  function pos(n, ones, dc = [], vars = VARS(n)) {
    const zeros = range(1 << n).filter(x => !ones.includes(x) && !dc.includes(x));
    const r = minimize(n, zeros, dc, vars);
    return { ...r, comp: r.sop, pos: zeros.length ? (r.sols[0].map(c => cubeStr(c, vars, true)).join('') || '1') : '1', allPos: r.sols.map(s => s.map(c => cubeStr(c, vars, true)).join('')) };
  }

  // ---------- expressions ----------
  // parse('A B\' + (C ^ D)', vars) -> truth table (array of 0/1, index = minterm). Throws on bad input.
  function parse(src, vars) {
    const n = vars.length, names = [...vars].sort((a, b) => b.length - a.length);
    const s = src.replace(/[’′‘`]/g, "'").replace(/[·∙•*&]/g, ' ').replace(/[⊕]/g, '^').replace(/[¬!~]/g, '~').replace(/∨|\|/g, '+').replace(/∧/g, ' ');
    let i = 0;
    const ws = () => { while (s[i] === ' ') i++; };
    const peek = () => { ws(); return s[i]; };
    const node = { or: [], };
    function E() { const t = [X()]; while (peek() === '+') { i++; t.push(X()); } return t.length === 1 ? t[0] : { op: '+', t }; }
    function X() { const t = [A()]; while (peek() === '^') { i++; t.push(A()); } return t.length === 1 ? t[0] : { op: '^', t }; }
    function A() { const t = [U()]; for (;;) { const c = peek(); if (c === undefined || c === '+' || c === '^' || c === ')') break; t.push(U()); } return t.length === 1 ? t[0] : { op: '.', t }; }
    function U() {
      ws(); let e;
      if (s[i] === '~') { i++; e = { op: '~', t: [U()] }; }
      else if (s[i] === '(') { i++; e = E(); if (peek() !== ')') throw Error('missing )'); i++; }
      else if (s[i] === '0' || s[i] === '1') { e = { c: +s[i] }; i++; }
      else { const nm = names.find(v => s.startsWith(v, i)); if (!nm) throw Error('unknown symbol at "' + s.slice(i, i + 6) + '"'); e = { v: vars.indexOf(nm) }; i += nm.length; }
      while (s[i] === "'") { i++; e = { op: '~', t: [e] }; }
      return e;
    }
    const tree = E(); ws(); if (i < s.length) throw Error('unexpected "' + s.slice(i, i + 6) + '"');
    const ev = (e, x) => e.c !== undefined ? e.c : e.v !== undefined ? (x >> (n - 1 - e.v)) & 1
      : e.op === '~' ? 1 - ev(e.t[0], x) : e.op === '+' ? +e.t.some(t => ev(t, x)) : e.op === '.' ? +e.t.every(t => ev(t, x)) : e.t.reduce((a, t) => a ^ ev(t, x), 0);
    void node;
    return range(1 << n).map(x => ev(tree, x));
  }
  const onesOf = tt => tt.flatMap((b, i) => b ? [i] : []);
  // same function on every minterm that is not a don't-care
  const sameFn = (tt, ones, dc = []) => tt.every((b, x) => dc.includes(x) || b === +ones.includes(x));
  // literal count of a typed SOP/POS (for "is it minimal?")
  const countLits = (src, vars) => { const names = [...vars].sort((a, b) => b.length - a.length); let c = 0, i = 0; while (i < src.length) { const nm = names.find(v => src.startsWith(v, i)); if (nm) { c++; i += nm.length; } else i++; } return c; };

  // ---------- MUX / decoder residues ----------
  // sel: indexes of the variables on the select lines (MSB first). For each select value, the residual function of the other vars.
  function residues(n, ones, dc = [], sel = [0, 1], vars = VARS(n)) {
    const rest = range(n).filter(i => !sel.includes(i)), rv = rest.map(i => vars[i]), k = sel.length, r = rest.length;
    const at = (s, t) => { let x = 0; sel.forEach((vi, j) => { if ((s >> (k - 1 - j)) & 1) x |= 1 << (n - 1 - vi); }); rest.forEach((vi, j) => { if ((t >> (r - 1 - j)) & 1) x |= 1 << (n - 1 - vi); }); return x; };
    return range(1 << k).map(s => {
      const lo = [], ld = [], mins = [];
      range(1 << r).forEach(t => { const x = at(s, t); mins.push(x); if (ones.includes(x)) lo.push(t); else if (dc.includes(x)) ld.push(t); });
      let expr;
      if (!lo.length) expr = '0'; else if (lo.length + ld.length === 1 << r) expr = '1'; else expr = minimize(r, lo, ld, rv).sop;
      return { s, mins, ones: lo, dc: ld, expr };
    });
  }

  // ---------- PLA ----------
  // fns: array of on-sets over n vars (dcs optional). Picks true/complement per output and the fewest shared product terms.
  function pla(n, fns, dcs = [], vars = VARS(n)) {
    const N = 1 << n, m = fns.length, mask = s => s.reduce((a, x) => a | (1 << x), 0);
    const allCubes = []; for (let mm = 0; mm < N; mm++) for (let v = 0; v < N; v++) if ((v & mm) === 0) allCubes.push({ v, m: mm, b: mask(cubeMinterms({ v, m: mm }, n)) });
    const pol = fns.map((on, f) => { const dc = dcs[f] || [], off = range(N).filter(x => !on.includes(x) && !dc.includes(x)); return [[on, dc], [off, dc]].map(([o, d]) => ({ on: mask(o), ok: mask([...o, ...d]), pis: minimize(n, o, d, vars).useful })); });
    let best = null;
    for (let choice = 0; choice < 1 << m; choice++) {
      const P = range(m).map(f => pol[f][(choice >> f) & 1]);
      const key = c => c.v + ':' + c.m, cand = new Map();
      P.forEach(p => p.pis.forEach(c => cand.set(key(c), allCubes.find(a => a.v === c.v && a.m === c.m))));
      allCubes.forEach(c => { if (c.b && P.filter(p => (c.b & ~p.ok) === 0).length >= 2) cand.set(key(c), c); });
      const C = [...cand.values()];
      const limit = best ? best.terms.length : C.length;
      for (let k = 1; k <= limit; k++) {
        let found = null;
        (function rec(st, pick) {
          if (pick.length === k) {
            if (!P.every(p => (pick.filter(c => (c.b & ~p.ok) === 0).reduce((a, c) => a | c.b, 0) & p.on) === p.on)) return;
            const litc = pick.reduce((s, c) => s + lits(c, n), 0);
            if (!found || litc < found.lit) found = { lit: litc, pick: pick.slice() };
            return;
          }
          for (let i = st; i < C.length; i++) { pick.push(C[i]); rec(i + 1, pick); pick.pop(); }
        })(0, []);
        if (found) {
          if (!best || k < best.terms.length || (k === best.terms.length && found.lit < best.lit)) best = { choice, terms: found.pick, lit: found.lit, P };
          break;
        }
      }
    }
    const rows = best.terms.map(c => ({ term: cubeStr(c, vars), bits: cubeBits(c, n), out: best.P.map(p => (c.b & ~p.ok) === 0 ? 1 : 0) }));
    // drop links a function does not need (keep a minimal cover per output)
    best.P.forEach((p, f) => {
      const users = rows.map((r, i) => r.out[f] ? i : -1).filter(i => i >= 0);
      for (const i of users) { const others = users.filter(j => j !== i && rows[j].out[f]); const cov = others.reduce((a, j) => a | best.terms[j].b, 0); if ((cov & p.on) === p.on) rows[i].out[f] = 0; }
    });
    const tc = range(m).map(f => (best.choice >> f) & 1 ? 'C' : 'T');
    const exprs = range(m).map(f => rows.filter(r => r.out[f]).map(r => r.term).join(' + ') || '0');
    return { rows, tc, exprs, count: rows.length };
  }

  // ---------- flip-flops ----------
  const FF = {
    D: { ins: ['D'], ex: (q, q1) => [q1], next: (q, [d]) => d },
    T: { ins: ['T'], ex: (q, q1) => [q ^ q1], next: (q, [t]) => q ^ t },
    JK: { ins: ['J', 'K'], ex: (q, q1) => q ? ['x', 1 - q1] : [q1, 'x'], next: (q, [j, k]) => q ? 1 - k : j },
    SR: { ins: ['S', 'R'], ex: (q, q1) => q === q1 ? (q ? ['x', 0] : [0, 'x']) : (q1 ? [1, 0] : [0, 1]), next: (q, [s, r]) => s && r ? null : s ? 1 : r ? 0 : q },
  };

  // Synthesis of a clocked circuit.
  // spec = {sv:['A','B'], iv:['x'], ff:['JK','D'], ov:['z'], rows:[{ps, x, ns, z:[..]}]} with ps/ns as integers over sv (A = MSB), x over iv.
  // K-map variables are sv then iv. Missing (ps,x) pairs are don't-cares.
  function synth(spec) {
    const { sv, iv = [], ff, ov = [], rows } = spec, ns = sv.length, ni = iv.length, n = ns + ni, vars = [...sv, ...iv];
    const maps = {}, out = {}, table = [];
    ff.forEach((t, b) => FF[t].ins.forEach(nm => maps[nm + sv[b]] = { ones: [], dc: [] }));
    ov.forEach(o => out[o] = { ones: [], dc: [] });
    const seen = new Set();
    for (const r of rows) {
      const idx = (r.ps << ni) | (r.x || 0); seen.add(idx); const ex = {};
      ff.forEach((t, b) => {
        const q = (r.ps >> (ns - 1 - b)) & 1, q1 = (r.ns >> (ns - 1 - b)) & 1, e = FF[t].ex(q, q1);
        FF[t].ins.forEach((nm, j) => { const key = nm + sv[b]; ex[key] = e[j]; if (e[j] === 1) maps[key].ones.push(idx); else if (e[j] === 'x') maps[key].dc.push(idx); });
      });
      ov.forEach((o, j) => { const z = r.z ? r.z[j] : null; if (z === 1) out[o].ones.push(idx); else if (z === null || z === 'x' || z === undefined) out[o].dc.push(idx); });
      table.push({ ...r, ex });
    }
    range(1 << n).forEach(i => { if (!seen.has(i)) { for (const k in maps) maps[k].dc.push(i); for (const o in out) out[o].dc.push(i); } });
    const eq = {};
    for (const k in maps) eq[k] = minimize(n, maps[k].ones, maps[k].dc, vars);
    for (const o in out) eq[o] = minimize(n, out[o].ones, out[o].dc, vars);
    return { vars, maps, out, eq, table, n };
  }
  // simulate the synthesized equations from a state (to check unused states). Returns the next state or null (SR 1,1).
  function step(spec, eq, ps, x = 0) {
    const { sv, iv = [], ff } = spec, ni = iv.length, ns = sv.length, idx = (ps << ni) | x;
    const val = k => { const r = eq[k]; return r.sols[0].some(c => covers(c, idx)) ? 1 : 0; };
    let nxt = 0;
    for (let b = 0; b < ns; b++) { const q = (ps >> (ns - 1 - b)) & 1, q1 = FF[ff[b]].next(q, FF[ff[b]].ins.map(nm => val(nm + sv[b]))); if (q1 === null) return null; nxt |= q1 << (ns - 1 - b); }
    return nxt;
  }
  // counter: seq of states, bits, ff types per bit (MSB first)
  function counter(seq, bits, ff) {
    const sv = range(bits).map(i => 'Q' + (bits - 1 - i));
    const ffs = Array.isArray(ff) ? ff : sv.map(() => ff);
    const spec = { sv, ff: ffs, rows: seq.map((s, i) => ({ ps: s, ns: seq[(i + 1) % seq.length] })) };
    const r = synth(spec);
    const unused = range(1 << bits).filter(s => !seq.includes(s)).map(s => {
      const path = [s]; let cur = s;
      for (let t = 0; t < 1 << bits && !seq.includes(cur); t++) { cur = step(spec, r.eq, cur); path.push(cur); if (cur === null) break; }
      return { s, path, ok: cur !== null && seq.includes(cur) };
    });
    return { ...r, spec, unused };
  }
  // flip-flop conversion: build target FF (ins) from source FF type
  function convert(target, source) {
    const tin = FF[target].ins, k = tin.length, rows = [], maps = {};
    FF[source].ins.forEach(nm => maps[nm] = { ones: [], dc: [] });
    for (let a = 0; a < 1 << k; a++) for (let q = 0; q < 2; q++) {
      const inp = range(k).map(j => (a >> (k - 1 - j)) & 1), q1 = FF[target].next(q, inp);
      const idx = (a << 1) | q; // K-map vars: target inputs..., then Q
      if (q1 === null) { FF[source].ins.forEach(nm => maps[nm].dc.push(idx)); rows.push({ inp, q, q1: '?', need: FF[source].ins.map(() => 'x') }); continue; }
      const e = FF[source].ex(q, q1);
      FF[source].ins.forEach((nm, j) => { if (e[j] === 1) maps[nm].ones.push(idx); else if (e[j] === 'x') maps[nm].dc.push(idx); });
      rows.push({ inp, q, q1, need: e });
    }
    const vars = [...tin, 'Q'], eq = {};
    for (const nm in maps) eq[nm] = minimize(k + 1, maps[nm].ones, maps[nm].dc, vars);
    return { rows, vars, eq, maps };
  }
  // analysis: eqs {JA:'expr',...} over vars sv+iv. Returns state table rows.
  function analyze({ sv, iv = [], ff, eqs, outs = {}, labels = sv }) { // eqs keyed by input name + label, e.g. JA when labels=['A','B']
    const vars = [...sv, ...iv], tt = {}; for (const k in eqs) tt[k] = parse(eqs[k], vars); for (const k in outs) tt[k] = parse(outs[k], vars);
    const ns = sv.length, ni = iv.length, rows = [];
    for (let ps = 0; ps < 1 << ns; ps++) for (let x = 0; x < 1 << ni; x++) {
      const idx = (ps << ni) | x, ins = {}; let nxt = 0, bad = false;
      sv.forEach((s, b) => { const q = (ps >> (ns - 1 - b)) & 1, v = FF[ff[b]].ins.map(nm => tt[nm + labels[b]][idx]); FF[ff[b]].ins.forEach((nm, j) => ins[nm + labels[b]] = v[j]); const q1 = FF[ff[b]].next(q, v); if (q1 === null) bad = true; else nxt |= q1 << (ns - 1 - b); });
      rows.push({ ps, x, ins, ns: bad ? null : nxt, z: Object.keys(outs).map(k => tt[k][idx]) });
    }
    return rows;
  }

  // ---------- state tables ----------
  // machine = {S:['A',..], I:['0','1'], t:{A:[['B',0],['C',null]], ...}} ; next/output null = unspecified ('-')
  function parseTable(txt, inputs) { // rows like "A: B,0 C,1" ; '-' for unspecified ; outputs may be multi-bit strings
    const S = [], t = {};
    for (const line of txt.trim().split('\n')) {
      const [s, rest] = line.split(':'); const st = s.trim(); S.push(st);
      t[st] = rest.trim().split(/\s+/).map(c => { const [a, b] = c.split(/[,/]/); return [a === '-' || a === undefined ? null : a, b === undefined || b === '-' ? null : b]; });
    }
    const k = t[S[0]].length;
    return { S, I: inputs || (k === 4 ? ['00', '01', '11', '10'] : t[S[0]].map((_, i) => String(i))), t }; // 4 columns = x1x2 in Gray order
  }
  // equivalence partitions for a completely specified machine
  function partitions(M) {
    const { S, t } = M, k = M.I.length;
    let P = []; const g0 = new Map();
    for (const s of S) { const key = t[s].map(c => c[1]).join('|'); if (!g0.has(key)) g0.set(key, []); g0.get(key).push(s); }
    P.push([...g0.values()]);
    for (;;) {
      const cur = P[P.length - 1], blk = s => cur.findIndex(b => b.includes(s)), next = [];
      for (const b of cur) { const m = new Map(); for (const s of b) { const key = range(k).map(i => blk(t[s][i][0])).join(','); if (!m.has(key)) m.set(key, []); m.get(key).push(s); } next.push(...m.values()); }
      if (next.length === cur.length) break; P.push(next);
    }
    const fin = P[P.length - 1], name = b => b[0], rep = s => name(fin.find(b => b.includes(s)));
    const min = { S: fin.map(name), I: M.I, t: Object.fromEntries(fin.map(b => [name(b), t[b[0]].map(([n, o]) => [rep(n), o])])) };
    return { P, min, classes: fin };
  }
  const outConflict = (a, b) => a !== null && b !== null && a !== b;
  // implication table: cells[i][j] for j<i : {x:pass or 0, pairs:[[p,q],...]}
  function implication(M) {
    const { S, t } = M, k = M.I.length, cell = {}, key = (a, b) => S.indexOf(a) > S.indexOf(b) ? b + a : a + b;
    for (let i = 0; i < S.length; i++) for (let j = 0; j < i; j++) {
      const a = S[i], b = S[j]; let x = 0; const pairs = [];
      for (let c = 0; c < k; c++) {
        if (outConflict(t[a][c][1], t[b][c][1])) x = 1;
        const p = t[a][c][0], q = t[b][c][0];
        if (p && q && p !== q && key(p, q) !== key(a, b) && !pairs.some(e => key(e[0], e[1]) === key(p, q))) pairs.push(S.indexOf(p) < S.indexOf(q) ? [p, q] : [q, p]);
      }
      cell[key(a, b)] = { a: S[j], b: S[i], x: x ? 1 : 0, pairs };
    }
    let pass = 1, changed = true;
    while (changed) {
      changed = false; pass++;
      const kill = Object.values(cell).filter(c => !c.x && c.pairs.some(([p, q]) => cell[key(p, q)].x));
      kill.forEach(c => { c.x = pass; changed = true; });
    }
    const compat = Object.values(cell).filter(c => !c.x).map(c => [c.a, c.b]);
    return { cell, key, compat, passes: pass - 1 };
  }
  function cliques(V, adj) { // maximal cliques (Bron-Kerbosch), V in order
    const out = [];
    (function bk(R, P, X) {
      if (!P.length && !X.length) { out.push(R); return; }
      for (const v of P.slice()) { bk([...R, v], P.filter(u => adj(u, v)), X.filter(u => adj(u, v))); P = P.filter(u => u !== v); X = [...X, v]; }
    })([], V.slice(), []);
    const ord = s => s.slice().sort((a, b) => V.indexOf(a) - V.indexOf(b));
    return out.map(ord).sort((a, b) => b.length - a.length || V.indexOf(a[0]) - V.indexOf(b[0]));
  }
  // full reduction (works for completely and incompletely specified machines, and for primitive flow tables)
  function reduce(M) {
    const imp = implication(M), { S, t } = M, k = M.I.length;
    const ok = (a, b) => a === b || !imp.cell[imp.key(a, b)].x;
    const maxC = cliques(S, (a, b) => a !== b && ok(a, b));
    const maxI = cliques(S, (a, b) => a !== b && !ok(a, b));
    const lower = Math.max(...maxI.map(c => c.length)), upper = Math.min(S.length, maxC.length);
    // every compatible = every subset (size>=1) of a maximal compatible
    const comp = new Map();
    maxC.forEach(c => { for (let m = 1; m < 1 << c.length; m++) { const s = c.filter((_, i) => m >> i & 1); comp.set(s.join(''), s); } });
    const C = [...comp.values()].sort((a, b) => b.length - a.length);
    const implied = c => range(k).map(i => [...new Set(c.map(s => t[s][i][0]).filter(Boolean))].sort((a, b) => S.indexOf(a) - S.indexOf(b))).filter(s => s.length > 1 && !s.every(x => c.includes(x)));
    const closedOK = pick => pick.every(c => implied(c).every(sset => pick.some(d => sset.every(x => d.includes(x)))));
    let cover = null;
    for (let n = Math.max(1, lower); n <= S.length && !cover; n++) {
      (function rec(st, pick) {
        if (cover) return;
        if (pick.length === n) { if (S.every(s => pick.some(c => c.includes(s))) && closedOK(pick)) cover = pick.slice(); return; }
        for (let i = st; i < C.length; i++) { pick.push(C[i]); rec(i + 1, pick); pick.pop(); }
      })(0, []);
    }
    // minimal machine: new state per chosen compatible
    const nm = cover.map(c => c.length > 1 ? '(' + c.join('') + ')' : c[0]);
    const tbl = {};
    cover.forEach((c, ci) => {
      tbl[nm[ci]] = range(k).map(i => {
        const nx = [...new Set(c.map(s => t[s][i][0]).filter(Boolean))], out = c.map(s => t[s][i][1]).find(o => o !== null) ?? null;
        const di = nx.length ? cover.findIndex(d => nx.every(x => d.includes(x))) : -1;
        return [di < 0 ? null : nm[di], out];
      });
    });
    return { imp, maxC, maxI, lower, upper, cover, implied, min: { S: nm, I: M.I, t: tbl } };
  }
  // Mealy -> Moore. Returns Moore table {S, I, t:{s:[next..]}, z:{s:out}}
  function mealyToMoore(M, start = M.S[0]) {
    const { S, t } = M, inc = Object.fromEntries(S.map(s => [s, new Set()]));
    S.forEach(s => t[s].forEach(([n, o]) => { if (n) inc[n].add(o); }));
    const split = {}, states = [], z = {};
    S.forEach(s => {
      const outs = [...inc[s]].sort();
      if (outs.length <= 1) { split[s] = { [outs[0] ?? 'none']: s }; states.push(s); z[s] = outs[0] ?? null; }
      else { split[s] = {}; outs.forEach(o => { const nm = s + o; split[s][o] = nm; states.push(nm); z[nm] = o; }); }
    });
    const tgt = (n, o) => split[n][o] ?? split[n][Object.keys(split[n])[0]];
    const tt = {};
    S.forEach(s => Object.values(split[s]).forEach(nm => tt[nm] = t[s].map(([n, o]) => n ? tgt(n, o) : null)));
    const noInc = S.filter(s => !inc[s].size);
    return { S: states, I: M.I, t: tt, z, noInc, start: Object.values(split[start])[0] };
  }
  // Moore -> Mealy: output on a transition = Moore output of the next state
  function mooreToMealy(Mo) { return { S: Mo.S, I: Mo.I, t: Object.fromEntries(Mo.S.map(s => [s, Mo.t[s].map(n => [n, n ? Mo.z[n] : null])])) }; }
  // run a Mealy machine on an input string (symbols are input indexes)
  function run(M, start, xs) { let s = start; return xs.map(x => { const [n, o] = M.t[s][x]; const r = { s, x, n, o }; s = n; return r; }); }

  // ---------- fundamental mode ----------
  // reduced flow table rows: {a:['(a)/0','b/-',...]} ; cols are input combos in Gray order 00 01 11 10
  // race analysis: transitions that must be adjacent (row r unstable entry pointing to row s)
  function flowEdges(F) {
    const E = new Set();
    F.S.forEach(r => F.t[r].forEach(([n]) => { if (n && n !== r) E.add([r, n].sort((a, b) => F.S.indexOf(a) - F.S.indexOf(b)).join('-')); }));
    return [...E].map(e => e.split('-'));
  }
  // all codes assignments (bits) where every edge joins adjacent codes. Returns list of {state:code}
  function assignments(S, edges, bits) {
    const N = 1 << bits, res = [], used = new Set(), code = {};
    (function rec(i) {
      if (i === S.length) { if (edges.every(([a, b]) => pc(code[a] ^ code[b]) === 1)) res.push({ ...code }); return; }
      for (let c = 0; c < N; c++) { if (used.has(c)) continue; if (i === 0 && c !== 0) continue; code[S[i]] = c; used.add(c); rec(i + 1); used.delete(c); }
    })(0);
    return res;
  }

  // ---------- number systems ----------
  function rComp(digits, r, radixMinus1 = false) { // digits: string in base r (no point), returns complement string of same length
    const d = [...digits].map(c => parseInt(c, 36)), n = d.length;
    let c = d.map(x => r - 1 - x);
    if (!radixMinus1) { let carry = 1; for (let i = n - 1; i >= 0; i--) { const s = c[i] + carry; c[i] = s % r; carry = Math.floor(s / r); } }
    return c.map(x => x.toString(36).toUpperCase()).join('');
  }
  const gray = x => x ^ (x >> 1);
  const ungray = g => { let b = 0; for (; g; g >>= 1) b ^= g; return b; };
  const bin = (x, w) => x.toString(2).padStart(w, '0');

  return { pc, range, VARS, lits, covers, cubeMinterms, cubeStr, cubeBits, qm, minimize, pos, parse, onesOf, sameFn, countLits, residues, pla, FF, synth, step, counter, convert, analyze, parseTable, partitions, implication, cliques, reduce, mealyToMoore, mooreToMealy, run, flowEdges, assignments, rComp, gray, ungray, bin };
})();
if (typeof module !== 'undefined') module.exports = L;
