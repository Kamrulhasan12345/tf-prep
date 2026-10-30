// Lec 01 (Sukarna): design theory. FD algorithms (closure, keys, minimal basis, projection,
// BCNF analysis, 3NF synthesis, chase, dependency preservation, normal-form check) and the
// interactive tools built on them. Attribute sets are bitmasks over the relation's attributes.
'use strict';

// ---------- parsing ----------
const FD_ARROW = /->|→|=>|⟶/;
function parseAttrs(str) {
  let s = String(str || '').trim().replace(/^[A-Za-z_]\w*\s*\(/, '').replace(/\)\s*$/, '');
  const toks = s.split(/[\s,{}()]+/).filter(Boolean);
  if (!toks.length) throw new Error('Type the attributes of the relation, for example <code>A B C D</code> or <code>ABCD</code>.');
  let names = toks.length === 1 && /^[A-Z]{2,}$/.test(toks[0]) ? toks[0].split('') : toks;
  for (const n of names) if (!/^[A-Za-z_][\w']*$/.test(n)) throw new Error(`“${n}” is not a valid attribute name. Use letters, digits and _.`);
  const seen = new Set();
  for (const n of names) { if (seen.has(n)) throw new Error(`Attribute <code>${n}</code> is listed twice.`); seen.add(n); }
  if (names.length > 24) throw new Error('At most 24 attributes, please.');
  return schema(names);
}
function schema(names) {
  const single = names.every(n => n.length === 1);
  return { names, n: names.length, all: (1 << names.length) - 1, single, idx: new Map(names.map((x, i) => [x, i])) };
}
// one side of an FD or a set like "AB", "A,B", "title year", "{title, year}"
function parseSet(S, str, what = 'set') {
  const toks = String(str).split(/[\s,{}()]+/).filter(Boolean);
  let m = 0;
  for (const t of toks) {
    const parts = S.idx.has(t) ? [t] : (S.single ? t.split('') : [t]);
    for (const p of parts) {
      if (!S.idx.has(p)) throw new Error(`Unknown attribute <code>${p}</code> in ${what}. The relation has: ${S.names.join(', ')}.`);
      m |= 1 << S.idx.get(p);
    }
  }
  return m;
}
// "AB -> C; C -> D", newline separated, or comma separated FDs "AB→C, C→D"
function parseFDs(S, str) {
  const out = [];
  for (const chunk of String(str || '').split(/[;\n]+/)) {
    // split on commas only between complete FDs
    let buf = '', parts = [];
    const c = chunk;
    for (let i = 0; i < c.length; i++) {
      if (c[i] === ',' && FD_ARROW.test(buf) && FD_ARROW.test(c.slice(i + 1))) { parts.push(buf); buf = ''; }
      else buf += c[i];
    }
    parts.push(buf);
    for (const p of parts) {
      if (!p.trim()) continue;
      const sides = p.split(FD_ARROW);
      if (sides.length !== 2) throw new Error(`Could not read “${p.trim()}”. Write each FD as <code>X -> Y</code>.`);
      const l = parseSet(S, sides[0], `“${p.trim()}”`), r = parseSet(S, sides[1], `“${p.trim()}”`);
      if (!l) throw new Error(`The FD “${p.trim()}” has an empty left side.`);
      if (!r) throw new Error(`The FD “${p.trim()}” has an empty right side.`);
      out.push({ l, r });
    }
  }
  return out;
}
// decomposition: "ABC, ADE" (single letters) or "{title, year}; {title, star}" or one schema per line
function parseDecomp(S, str) {
  const s = String(str || '').trim();
  let groups;
  if (/[{(]/.test(s)) groups = [...s.matchAll(/[{(]([^})]*)[})]/g)].map(m => m[1]);
  else {
    groups = s.split(/[;\n|]+/).map(x => x.trim()).filter(Boolean);
    if (groups.length === 1 && S.single) groups = groups[0].split(/[\s,]+/).filter(Boolean);
  }
  if (groups.length < 2) throw new Error('Give at least two relation schemas, for example <code>ABC; ADE</code> or <code>{A,B,C}, {A,D,E}</code>.');
  const rs = groups.map(g => parseSet(S, g, 'the decomposition'));
  const cover = rs.reduce((a, b) => a | b, 0);
  if (cover !== S.all) throw new Error(`The schemas do not cover every attribute: ${fmtSet(S, S.all & ~cover)} is missing.`);
  return rs;
}

// ---------- bit helpers and formatting ----------
const pop = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
const sub = (a, b) => (a & b) === a;              // a ⊆ b
function bits(m) { const r = []; for (let i = 0; m; i++, m >>>= 1) if (m & 1) r.push(i); return r; }
function fmtList(S, m) { return bits(m).map(i => S.names[i]).join(S.single ? '' : ' '); }
function fmtSet(S, m) { return m ? '{' + bits(m).map(i => S.names[i]).join(', ') + '}' : '∅'; }
function fmtFD(S, f) { return `${fmtList(S, f.l)} → ${fmtList(S, f.r)}`; }
const fmtRel = (S, m, name = '') => `${name}(${bits(m).map(i => S.names[i]).join(', ')})`;

// ---------- core algorithms ----------
function split(fds) {
  const out = [];
  for (const f of fds) for (const b of bits(f.r)) out.push({ l: f.l, r: 1 << b });
  return out;
}
// attribute closure; steps = [{fd, add, x}] in the order FDs fire (slides' algorithm, FDs pre-split)
function closure(x, fds) {
  let X = x, changed = true;
  while (changed) { changed = false; for (const f of fds) if (sub(f.l, X) && !sub(f.r, X)) { X |= f.r; changed = true; } }
  return X;
}
function closureSteps(x, fds) {
  const sp = split(fds), steps = [];
  let X = x, changed = true;
  while (changed) {
    changed = false;
    for (const f of sp) if (sub(f.l, X) && !sub(f.r, X)) { steps.push({ fd: f, add: f.r & ~X, before: X }); X |= f.r; changed = true; }
  }
  return { set: X, steps, split: sp };
}
// keys: every attribute missing from all right sides is in every key; attributes only on right sides are in none
function keyAnalysis(S, fds) {
  const nt = split(fds).filter(f => !sub(f.r, f.l));
  let rhs = 0, lhs = 0;
  for (const f of nt) { rhs |= f.r; lhs |= f.l; }
  const core = S.all & ~rhs, never = rhs & ~lhs, middle = S.all & ~core & ~never;
  const keys = [], tested = [];
  const mid = bits(middle);
  if (mid.length > 16) throw new Error('Too many attributes to search for keys in the browser (at most 16 that appear on both sides).');
  const combos = [];
  for (let m = 0; m < (1 << mid.length); m++) { let s = 0; mid.forEach((b, i) => { if (m >> i & 1) s |= 1 << b; }); combos.push(s); }
  combos.sort((a, b) => pop(a) - pop(b) || a - b);
  for (const s of combos) {
    const K = core | s;
    if (keys.some(k => sub(k, K))) { tested.push({ K, skip: keys.find(k => sub(k, K)) }); continue; }
    const c = closure(K, fds);
    const isSK = c === S.all;
    tested.push({ K, c, isSK });
    if (isSK) keys.push(K);
  }
  return { core, never, middle, keys, tested };
}
const candidateKeys = (S, fds) => keyAnalysis(S, fds).keys;
function allSuperkeys(S, fds) {
  const r = [];
  for (let m = 1; m <= S.all; m++) if (closure(m, fds) === S.all) r.push(m);
  return r.sort((a, b) => pop(a) - pop(b) || a - b);
}
function follows(fds, f) { return sub(f.r, closure(f.l, fds)); }
function equivalent(F, G) { return G.every(g => follows(F, g)) && F.every(f => follows(G, f)); }

// minimal basis (slides' algorithm): split, then repeat {remove redundant FDs; remove extraneous LHS attributes}.
// FDs are tried in the order given, so different orders can give different (equally correct) answers.
function minimalBasis(fds) {
  const log = [];
  let T = split(fds);
  log.push({ kind: 'split', T: T.slice() });
  // drop exact duplicates
  const key = f => f.l + ':' + f.r;
  T = T.filter((f, i) => T.findIndex(g => key(g) === key(f)) === i);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < T.length; i++) {
      const rest = T.filter((_, j) => j !== i), c = closure(T[i].l, rest);
      const red = sub(T[i].r, c);
      log.push({ kind: 'red', fd: T[i], c, red, T: T.slice() });
      if (red) { T = rest; i--; changed = true; }
    }
    for (let i = 0; i < T.length; i++) {
      if (pop(T[i].l) < 2) continue;
      for (const a of bits(T[i].l)) {
        if (pop(T[i].l) < 2) break;
        const Z = T[i].l & ~(1 << a), c = closure(Z, T), ext = sub(T[i].r, c);
        log.push({ kind: 'ext', fd: T[i], a, Z, c, ext, T: T.slice() });
        if (ext) {
          T = T.slice(); T[i] = { l: Z, r: T[i].r }; changed = true;
          // the reduced FD may now duplicate another one
          const d = T.findIndex((g, j) => j !== i && key(g) === key(T[i]));
          if (d >= 0) { T.splice(i, 1); i--; break; }
        }
      }
    }
  }
  log.push({ kind: 'done', T: T.slice() });
  return { basis: T, log };
}
function combineLHS(fds) {
  const out = [];
  for (const f of fds) { const g = out.find(x => x.l === f.l); if (g) g.r |= f.r; else out.push({ l: f.l, r: f.r }); }
  return out;
}
// projection of F onto R1 (Algorithm 3.12): closures of subsets, then a minimal basis
function project(fds, R1) {
  const b = bits(R1);
  if (b.length > 14) throw new Error('Projection tries every subset; keep the relation to at most 14 attributes.');
  const subsets = [];
  for (let m = 1; m < (1 << b.length); m++) { let s = 0; b.forEach((x, i) => { if (m >> i & 1) s |= 1 << x; }); subsets.push(s); }
  subsets.sort((a, c) => pop(a) - pop(c) || a - c);
  const rows = [], got = [], full = [];
  for (const X of subsets) {
    if (X === R1) continue;
    if (full.some(k => sub(k, X))) { rows.push({ X, skip: true }); continue; }
    const c = closure(X, fds), add = c & R1 & ~X;
    rows.push({ X, c, add });
    if (add) got.push({ l: X, r: add });
    if (sub(R1, c)) full.push(X);
  }
  const mb = got.length ? minimalBasis(got).basis : [];
  return { rows, raw: got, basis: combineLHS(mb), basisSplit: mb };
}
// BCNF violations of relation R (mask) under FDs G that hold on it (G given in R's attributes)
function bcnfViolations(R, G, F) {
  return split(G).filter(f => !sub(f.r, f.l) && !sub(R, closure(f.l, F)));
}
// BCNF analysis (slides' algorithm). Root uses the given FDs in the given order; children use projections.
function bcnfDecompose(S, F) {
  let id = 0;
  function go(R, G, depth) {
    const node = { id: id++, R, G, depth, children: [] };
    if (depth > 12) throw new Error('Decomposition too deep.');
    const v = bcnfViolations(R, G, F).filter(f => sub(f.l | f.r, R));
    const keys = candidateKeysIn(R, F);
    node.keys = keys;
    if (!v.length) { node.bcnf = true; return node; }
    const X = v[0].l, Xp = closure(X, F) & R;
    node.viol = { l: X, r: Xp & ~X };
    node.violAll = v;
    const R1 = Xp, R2 = X | (R & ~Xp);
    const p1 = project(F, R1).basis, p2 = project(F, R2).basis;
    node.children = [go(R1, p1, depth + 1), go(R2, p2, depth + 1)];
    return node;
  }
  return go(S.all, F, 0);
}
function candidateKeysIn(R, F) {
  // keys of the projected relation R: minimal X ⊆ R with closure ⊇ R
  const b = bits(R), keys = [];
  if (b.length > 16) return [];
  const subsets = [];
  for (let m = 1; m < (1 << b.length); m++) { let s = 0; b.forEach((x, i) => { if (m >> i & 1) s |= 1 << x; }); subsets.push(s); }
  subsets.sort((a, c) => pop(a) - pop(c) || a - c);
  for (const X of subsets) if (!keys.some(k => sub(k, X)) && sub(R, closure(X, F))) keys.push(X);
  return keys;
}
function leaves(node) { return node.children.length ? node.children.flatMap(leaves) : [node]; }

// 3NF synthesis (slides' algorithm)
function synth3NF(S, F) {
  const mb = minimalBasis(F).basis;
  const G = combineLHS(mb);
  const rels = G.map(f => ({ R: f.l | f.r, from: f }));
  const steps = { mb, G, rels: rels.map(r => ({ ...r })) };
  // remove a schema contained in another
  const keep = rels.filter((r, i) => !rels.some((o, j) => j !== i && sub(r.R, o.R) && (r.R !== o.R || j < i)));
  steps.removed = rels.filter(r => !keep.includes(r));
  const keys = candidateKeys(S, F);
  steps.keys = keys;
  const hasKey = keep.some(r => closure(r.R, F) === S.all);
  steps.hasKey = hasKey;
  if (!hasKey) keep.push({ R: keys[0], key: true });
  steps.final = keep;
  return steps;
}

// chase test for a lossless join. Symbols: {d: true} distinguished (a, b, …) or {s: row} subscripted.
function chase(S, F, rels) {
  const sp = split(F);
  let T = rels.map((R, i) => S.names.map((_, c) => (R >> c & 1) ? 'd' : 's' + (i + 1)));
  const snaps = [{ T: T.map(r => r.slice()), note: 'start' }];
  const done = () => T.findIndex(r => r.every(x => x === 'd'));
  let changed = true, guard = 0;
  while (changed && done() < 0 && guard++ < 500) {
    changed = false;
    for (const f of sp) {
      const A = bits(f.r)[0], X = bits(f.l);
      for (let i = 0; i < T.length && done() < 0; i++) for (let j = i + 1; j < T.length; j++) {
        if (X.every(c => T[i][c] === T[j][c]) && T[i][A] !== T[j][A]) {
          const keepSym = T[i][A] === 'd' || T[j][A] === 'd' ? 'd' : T[i][A], drop = keepSym === T[i][A] ? T[j][A] : T[i][A];
          const hit = [];
          T.forEach((r, k) => { if (r[A] === drop) { r[A] = keepSym; hit.push(k); } });
          snaps.push({ T: T.map(r => r.slice()), fd: f, rows: [i, j], col: A, from: drop, to: keepSym, hit });
          changed = true;
          if (done() >= 0) break;
        }
      }
      if (done() >= 0) break;
    }
  }
  return { snaps, row: done(), lossless: done() >= 0 };
}
// dependency preservation (Silberschatz's test, no projection needed); returns per-FD trace
function depPreserve(S, F, rels) {
  return F.map(f => {
    let res = f.l, trace = [], ch = true;
    while (ch) {
      ch = false;
      for (const R of rels) {
        const t = closure(res & R, F) & R;
        if (!sub(t, res)) { trace.push({ R, from: res & R, add: t & ~res }); res |= t; ch = true; }
      }
    }
    return { fd: f, res, ok: sub(f.r, res), trace };
  });
}
// normal-form check of R itself: keys, prime attributes, partial and transitive dependencies
function nfCheck(S, F) {
  const keys = candidateKeys(S, F), prime = keys.reduce((a, k) => a | k, 0);
  const sp = split(F).filter(f => !sub(f.r, f.l));
  const bcnf = sp.filter(f => closure(f.l, F) !== S.all);
  const nf3 = bcnf.filter(f => !sub(f.r, prime));
  // partial dependencies: a proper subset of a key determines a non-prime attribute
  const partial = [];
  for (const k of keys) for (const s of bits(k).length > 1 ? subsetsOf(k).filter(x => x && x !== k) : []) {
    // report only attributes not already explained by a smaller part of a key
    const known = partial.filter(p => sub(p.l, s)).reduce((a, p) => a | p.r, 0);
    const np = closure(s, F) & ~prime & ~s & ~known;
    if (np && !partial.some(p => p.l === s)) partial.push({ l: s, r: np, key: k });
  }
  const nf = !partial.length ? (!nf3.length ? (!bcnf.length ? 'BCNF' : '3NF') : '2NF') : '1NF';
  return { keys, prime, bcnf, nf3, partial, nf };
}
function subsetsOf(m) { const b = bits(m), r = []; for (let x = 0; x < (1 << b.length); x++) { let s = 0; b.forEach((y, i) => { if (x >> i & 1) s |= 1 << y; }); r.push(s); } return r.sort((a, c) => pop(a) - pop(c) || a - c); }
// every nontrivial X → A (single A) that follows from F, with X minimal (no smaller X' ⊂ X gives the same A)
function allNontrivialFDs(S, F) {
  const out = [];
  for (const X of subsetsOf(S.all)) {
    if (!X) continue;
    const c = closure(X, F);
    for (const a of bits(c & ~X)) out.push({ l: X, r: 1 << a });
  }
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = { parseAttrs, parseFDs, parseSet, parseDecomp, schema, closure, closureSteps, keyAnalysis, candidateKeys,
    allSuperkeys, follows, equivalent, minimalBasis, combineLHS, project, bcnfViolations, bcnfDecompose, leaves,
    synth3NF, chase, depPreserve, nfCheck, allNontrivialFDs, fmtSet, fmtFD, fmtList, fmtRel, bits, pop, sub, split, subsetsOf, candidateKeysIn };
}

// ====================================================================================
// ---------- browser rendering (needs book.js: $, stepper) ----------
if (typeof document !== 'undefined') {

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// a row of attribute chips: in = member of the set, add = just added
function chips(S, inSet, add = 0, label = '') {
  return `<div class="chips">${label ? `<span class="chips-lab">${label}</span>` : ''}${S.names.map((n, i) =>
    `<span class="chip${add >> i & 1 ? ' add' : inSet >> i & 1 ? ' in' : ''}">${esc(n)}</span>`).join('')}</div>`;
}
function fdList(S, fds, mark = {}) {
  return `<ol class="fdlist">${fds.map((f, i) => `<li class="${mark[i] || ''}">${esc(fmtFD(S, f))}</li>`).join('')}</ol>`;
}
function fdInline(S, fds) { return fds.length ? fds.map(f => `<span class="fd">${esc(fmtFD(S, f))}</span>`).join(', ') : '<i>none</i>'; }

// Generic tool shell: fields [{name, label, value, rows}] → run(values) returns {steps, after?, before?} or throws Error
function fdTool(sel, fields, run, { button = 'Run', interval = 2200 } = {}) {
  const host = typeof sel === 'string' ? $(sel) : sel;
  host.classList.add('fdtool');
  host.innerHTML = `<form class="fdt-form">${fields.map(f => `<label><span>${f.label}</span>${f.rows
      ? `<textarea name="${f.name}" rows="${f.rows}" spellcheck="false">${esc(f.value)}</textarea>`
      : `<input name="${f.name}" value="${esc(f.value)}" autocomplete="off" spellcheck="false">`}</label>`).join('')}
    <div class="fdt-btns"><button type="submit">${button}</button></div></form>
    <div class="fdt-msg" role="alert" hidden></div><div class="fdt-before"></div><div class="fdt-st"></div><div class="fdt-after"></div>`;
  const msg = host.querySelector('.fdt-msg');
  const go = () => {
    const vals = {};
    fields.forEach(f => { vals[f.name] = host.querySelector(`[name="${f.name}"]`).value; });
    host.querySelector('.fdt-st').innerHTML = host.querySelector('.fdt-before').innerHTML = host.querySelector('.fdt-after').innerHTML = '';
    let out;
    try { out = run(vals); msg.hidden = true; }
    catch (e) { msg.innerHTML = `<b>Check your input.</b> ${e.message}`; msg.hidden = false; return; }
    host.querySelector('.fdt-before').innerHTML = out.before || '';
    if (out.steps && out.steps.length) {
      host.querySelector('.fdt-st').classList.remove('stepper');
      stepper(host.querySelector('.fdt-st'), out.steps, { interval });
    }
    host.querySelector('.fdt-after').innerHTML = out.after || '';
  };
  host.querySelector('form').addEventListener('submit', e => { e.preventDefault(); go(); });
  go();
  return host;
}
function readRel(v) {
  const S = parseAttrs(v.attrs), F = parseFDs(S, v.fds);
  return { S, F };
}

// ---- 1. attribute closure ----
function closureFrames(S, F, X) {
  const { set, steps, split: sp } = closureSteps(X, F);
  const idx = f => sp.indexOf(f);
  const frames = [];
  frames.push({ html: `<div class="cl">${fdList(S, sp)}${chips(S, X, 0, 'X =')}</div>`,
    cap: `Step 1: split every FD so it has one attribute on the right (${sp.length} FDs). Step 2: start with <b>X = ${fmtSet(S, X)}</b>.` });
  steps.forEach((s, k) => {
    const mark = {}; mark[idx(s.fd)] = 'on';
    sp.forEach((f, i) => { if (!mark[i] && sub(f.r, s.before)) mark[i] = 'used'; });
    frames.push({ html: `<div class="cl">${fdList(S, sp, mark)}${chips(S, s.before | s.add, s.add, 'X =')}</div>`,
      cap: `Step 3: <b>${fmtList(S, s.fd.l)}</b> ⊆ X, so <span class="fd">${fmtFD(S, s.fd)}</span> fires. Add <b>${fmtList(S, s.add)}</b>: X = ${fmtSet(S, s.before | s.add)}.` });
  });
  const isAll = set === S.all;
  frames.push({ html: `<div class="cl">${fdList(S, sp, Object.fromEntries(sp.map((f, i) => [i, sub(f.l, set) ? 'used' : ''])))}${chips(S, set, 0, 'X⁺ =')}</div>`,
    cap: `Step 4: no FD can add anything new (every FD whose left side is inside X has its right side inside X already). <b>${fmtSet(S, X)}⁺ = ${fmtSet(S, set)}</b>.` +
      (isAll ? ` It contains every attribute, so ${fmtSet(S, X)} is a <b>superkey</b>.` : ` It misses ${fmtSet(S, S.all & ~set)}, so ${fmtSet(S, X)} is not a superkey.`) });
  return { frames, set };
}
function closureTool(sel, { attrs, fds, x, test = '' }) {
  return fdTool(sel, [
    { name: 'attrs', label: 'Attributes of R', value: attrs },
    { name: 'fds', label: 'Functional dependencies (separate with ; or new lines)', value: fds, rows: 3 },
    { name: 'x', label: 'Compute the closure of', value: x },
    { name: 'test', label: 'Optional: does this FD follow?', value: test },
  ], v => {
    const { S, F } = readRel(v);
    const X = parseSet(S, v.x, 'the set to close');
    if (!X) throw new Error('Type the set whose closure you want, for example <code>AB</code>.');
    const { frames, set } = closureFrames(S, F, X);
    let after = `<p class="fdt-res">Result: <b>${fmtSet(S, X)}⁺ = ${fmtSet(S, set)}</b>.</p>`;
    if (v.test.trim()) {
      const t = parseFDs(S, v.test)[0];
      const c = closure(t.l, F), ok = sub(t.r, c);
      after += `<p class="fdt-res">Test <span class="fd">${fmtFD(S, t)}</span>: ${fmtSet(S, t.l)}⁺ = ${fmtSet(S, c)}, which ${ok ? 'contains' : 'does not contain'} ${fmtSet(S, t.r & (ok ? t.r : ~c))}. ` +
        (ok ? '<span class="good">The FD follows.</span>' : '<span class="bad">The FD does not follow.</span>') + '</p>';
    }
    return { steps: frames, after };
  }, { button: 'Compute closure' });
}

// ---- 2. candidate keys ----
function keyTool(sel, { attrs, fds, test = '' }) {
  return fdTool(sel, [
    { name: 'attrs', label: 'Attributes of R', value: attrs },
    { name: 'fds', label: 'Functional dependencies', value: fds, rows: 3 },
    { name: 'test', label: 'Optional: is this set a superkey / key?', value: test },
  ], v => {
    const { S, F } = readRel(v);
    if (!F.length) throw new Error('Give at least one FD.');
    const A = keyAnalysis(S, F), frames = [];
    const tri = `<div class="tri">${chips(S, A.core, 0, 'in every key')}${chips(S, A.middle, 0, 'maybe')}${chips(S, A.never, 0, 'in no key')}</div>`;
    frames.push({ html: tri, cap: `Sort the attributes. <b>${A.core ? fmtSet(S, A.core) : 'No attribute'}</b> never appear${pop(A.core) === 1 ? 's' : ''} on the right side of a nontrivial FD, so nothing can produce ${pop(A.core) === 1 ? 'it' : 'them'}: ${A.core ? 'it must be in every key' : '(nothing is forced)'}. ` +
      (A.never ? `<b>${fmtSet(S, A.never)}</b> appear only on right sides, so they are always derived and never needed in a key. ` : '') +
      `The rest, ${fmtSet(S, A.middle)}, may or may not be needed.` });
    for (const t of A.tested) {
      if (t.skip) { frames.push({ html: tri + chips(S, t.K, 0, 'try'), cap: `Try ${fmtSet(S, t.K)}: it contains the key ${fmtSet(S, t.skip)}, so it is a superkey but <b>not minimal</b>. Skip.` }); continue; }
      frames.push({ html: tri + chips(S, t.c, t.c & ~t.K, `${fmtList(S, t.K)}⁺ =`), cap: `Try ${fmtSet(S, t.K)}: closure = ${fmtSet(S, t.c)}. ` +
        (t.isSK ? `That is every attribute, and no smaller set worked, so <b class="good">${fmtSet(S, t.K)} is a key</b>.` : `Missing ${fmtSet(S, S.all & ~t.c)}: not a superkey.`) });
    }
    frames.push({ html: tri + A.keys.map(k => chips(S, k, 0, 'key')).join(''), cap: `Done. The candidate key${A.keys.length > 1 ? 's are' : ' is'} <b>${A.keys.map(k => fmtSet(S, k)).join(', ')}</b>. Prime attributes (members of some key): ${fmtSet(S, A.keys.reduce((a, k) => a | k, 0))}.` });
    let after = `<p class="fdt-res">Candidate keys: <b>${A.keys.map(k => fmtSet(S, k)).join(', ')}</b>.</p>`;
    if (S.n <= 12) {
      const sk = allSuperkeys(S, F), nk = sk.filter(s => !A.keys.includes(s));
      after += `<p class="fdt-res">Superkeys: ${sk.length} in total; ${nk.length} of them are not keys${nk.length && nk.length <= 40 ? ': ' + nk.map(s => fmtList(S, s)).join(', ') : ''}.</p>`;
    }
    if (v.test.trim()) {
      const X = parseSet(S, v.test, 'the test set'), c = closure(X, F), sk = c === S.all;
      const minimal = sk && A.keys.includes(X);
      after += `<p class="fdt-res">${fmtSet(S, X)}⁺ = ${fmtSet(S, c)}. ` + (sk ? (minimal ? '<span class="good">It is a superkey and a key</span> (no proper subset is a superkey).'
        : `<span class="mid">It is a superkey but not a key</span>: it contains the key ${fmtSet(S, A.keys.find(k => sub(k, X)))}.`) : '<span class="bad">It is not a superkey</span>.') + '</p>';
    }
    return { steps: frames, after };
  }, { button: 'Find keys' });
}

// ---- 3. minimal basis ----
function basisTool(sel, { attrs, fds }) {
  return fdTool(sel, [
    { name: 'attrs', label: 'Attributes of R', value: attrs },
    { name: 'fds', label: 'Functional dependencies (tried in this order)', value: fds, rows: 3 },
  ], v => {
    const { S, F } = readRel(v);
    if (!F.length) throw new Error('Give at least one FD.');
    const { basis, log } = minimalBasis(F), frames = [];
    for (const e of log) {
      const T = e.T, at = e.fd ? T.indexOf(e.fd) : -1, mark = {};
      if (at >= 0) mark[at] = e.kind === 'red' ? (e.red ? 'del' : 'on') : (e.ext ? 'new' : 'on');
      const list = fdList(S, T, mark);
      if (e.kind === 'split') frames.push({ html: list, cap: `Steps 1–2: start with T = S and split every right side into single attributes. T has ${T.length} FDs.` });
      else if (e.kind === 'red') frames.push({ html: list + chips(S, e.c, 0, `${fmtList(S, e.fd.l)}⁺ =`), cap: `Step 3, redundant? Remove <span class="fd">${fmtFD(S, e.fd)}</span> and close ${fmtSet(S, e.fd.l)} with the others: ${fmtSet(S, e.c)}. ` +
        (e.red ? `It contains ${fmtList(S, e.fd.r)}, so the FD <b class="bad">is redundant: delete it</b>.` : `No ${fmtList(S, e.fd.r)}, so the FD is <b>needed</b>. Keep it.`) });
      else if (e.kind === 'ext') frames.push({ html: list + chips(S, e.c, 0, `${fmtList(S, e.Z)}⁺ =`), cap: `Step 4, extraneous? In <span class="fd">${fmtFD(S, e.fd)}</span> drop <b>${S.names[e.a]}</b> from the left: ${fmtSet(S, e.Z)}⁺ = ${fmtSet(S, e.c)} (using all of T). ` +
        (e.ext ? `It contains ${fmtList(S, e.fd.r)}, so <b class="good">${S.names[e.a]} is extraneous</b>: replace by ${fmtList(S, e.Z)} → ${fmtList(S, e.fd.r)}.` : `It lacks ${fmtList(S, e.fd.r)}, so ${S.names[e.a]} is needed.`) });
      else frames.push({ html: fdList(S, T, Object.fromEntries(T.map((_, i) => [i, 'keep']))), cap: `Step 5: a full pass changed nothing, so stop. <b>Minimal basis: ${T.map(f => fmtFD(S, f)).join(', ')}</b>.` });
    }
    return { steps: frames, after: `<p class="fdt-res">Minimal basis (canonical cover): <b>${fdInline(S, basis)}</b>. Combined by left side: ${fdInline(S, combineLHS(basis))}.</p>` };
  }, { button: 'Build minimal basis' });
}

// ---- projection ----
function projTool(sel, { attrs, fds, sub: r1 }) {
  return fdTool(sel, [
    { name: 'attrs', label: 'Attributes of R', value: attrs },
    { name: 'fds', label: 'FDs of R', value: fds, rows: 2 },
    { name: 'r1', label: 'Project onto R₁ with attributes', value: r1 },
  ], v => {
    const { S, F } = readRel(v), R1 = parseSet(S, v.r1, 'R₁');
    if (pop(R1) < 2) throw new Error('R₁ needs at least two attributes.');
    const P = project(F, R1), frames = [];
    let acc = [];
    for (const r of P.rows) {
      if (r.skip) { frames.push({ html: chips(S, r.X, 0, 'X =') + `<p class="tbl-note">${fdInline(S, acc)}</p>`, cap: `X = ${fmtSet(S, r.X)} contains a set whose closure already covers R₁. Any FD it gives already follows. Skip.` }); continue; }
      if (r.add) acc = acc.concat(bits(r.add).map(a => ({ l: r.X, r: 1 << a })));
      frames.push({ html: chips(S, r.c & ~(S.all & ~R1) | r.X, r.add, `${fmtList(S, r.X)}⁺ ∩ R₁`) + `<p class="tbl-note">S₁ so far: ${fdInline(S, acc)}</p>`,
        cap: `${fmtSet(S, r.X)}⁺ = ${fmtSet(S, r.c)} (computed with all of R's FDs). ` + (r.add ? `New attributes inside R₁: ${fmtSet(S, r.add)}, so add ${bits(r.add).map(a => `<span class="fd">${fmtList(S, r.X)} → ${S.names[a]}</span>`).join(', ')}.` : 'Nothing new inside R₁.') });
    }
    frames.push({ html: `<p>Raw: ${fdInline(S, acc)}</p><p>Minimal basis: <b>${fdInline(S, P.basisSplit)}</b></p>`, cap: `Finally simplify S₁ to a minimal basis: <b>${fdInline(S, P.basis)}</b>.` });
    return { steps: frames, after: `<p class="fdt-res">FDs that hold on ${fmtRel(S, R1, 'R₁')}: <b>${fdInline(S, P.basis)}</b>.</p>` };
  }, { button: 'Project FDs' });
}

// ---- 4. BCNF check + decomposition tree ----
function treeSVG(S, root, upto = Infinity) {
  // tidy layout: leaves left to right, parents centred. Nodes with id > upto are drawn but not yet examined.
  const nodes = [], CH = 8.1, H = 62, VG = 60;
  const seen = n => n.id <= upto;
  const lines = n => {
    const L = [fmtRel(S, n.R, n.depth === 0 ? 'R' : '')];
    if (!seen(n)) return L.concat(['', 'not examined yet']);
    L.push(n.keys && n.keys.length ? 'key: ' + n.keys.map(k => fmtList(S, k)).join(', ') : '');
    L.push(n.bcnf ? 'in BCNF' : `violation: ${fmtList(S, n.viol.l)} → ${fmtList(S, n.viol.r)}`);
    return L;
  };
  // subtree width = max(own width, children side by side); each node is centred over its interval
  const GAP = 18;
  (function size(n) {
    n.w = Math.max(...lines(n).map(t => t.length)) * CH + 20;
    n._kids = seen(n) ? n.children : [];
    n._kids.forEach(size);
    const kw = n._kids.reduce((a, k) => a + k.sw, 0) + GAP * Math.max(0, n._kids.length - 1);
    n.sw = Math.max(n.w, kw); n.kw = kw;
  })(root);
  (function place(n, x0) {
    n.x = x0 + (n.sw - n.w) / 2; nodes.push(n);
    let x = x0 + (n.sw - n.kw) / 2;
    for (const k of n._kids) { place(k, x); x += k.sw + GAP; }
  })(root, 10);
  const minX = Math.min(...nodes.map(n => n.x)); nodes.forEach(n => { n.x += 10 - minX; });
  const W = Math.max(...nodes.map(n => n.x + n.w)) + 10, depth = Math.max(...nodes.map(n => n.depth));
  let s = '';
  for (const n of nodes) {
    const y = 10 + n.depth * (H + VG);
    for (const c of n._kids) {
      const cy = 10 + c.depth * (H + VG);
      s += `<path d="M${n.x + n.w / 2} ${y + H} L${c.x + c.w / 2} ${cy - 3}" class="s-fg" marker-end="url(#m-fg)"/>`;
    }
    if (n._kids.length) s += `<text x="${n.x + n.w / 2}" y="${y + H + VG / 2 + 4}" text-anchor="middle" class="lbl acc" style="paint-order:stroke;stroke:var(--plate);stroke-width:5px">split on ${esc(fmtList(S, n.viol.l))} → ${esc(fmtList(S, n.viol.r))}</text>`;
  }
  for (const n of nodes) {
    const y = 10 + n.depth * (H + VG), L = lines(n), cur = n.id === upto;
    const cls = !seen(n) ? 'cell-plain' : n.bcnf ? 'cell-new' : 'cell-hl';
    s += `<rect x="${n.x}" y="${y}" width="${n.w}" height="${H}" rx="6" class="${cls}"${cur ? ' style="stroke:var(--accent);stroke-width:3"' : ''}/>`;
    s += `<text x="${n.x + 10}" y="${y + 19}" class="big">${esc(L[0])}</text>`;
    s += `<text x="${n.x + 10}" y="${y + 37}" class="lbl">${esc(L[1])}</text>`;
    s += `<text x="${n.x + 10}" y="${y + 54}" class="lbl ${!seen(n) ? '' : n.bcnf ? 'grn' : 'red'}">${esc(L[2])}</text>`;
  }
  const Ht = 20 + (depth + 1) * H + depth * VG;
  return `<svg viewBox="0 0 ${W} ${Ht}" width="${W}" role="img" aria-label="BCNF decomposition tree">${s}</svg>`;
}
function bcnfFrames(S, F) {
  const root = bcnfDecompose(S, F), frames = [];
  const all = []; (function walk(n) { all.push(n); n.children.forEach(walk); })(root);
  const order = all.slice().sort((a, b) => a.id - b.id);
  for (const n of order) {
    const cap = n.bcnf
      ? `${fmtRel(S, n.R, n.depth ? '' : 'R')}: FDs ${fdInline(S, n.G)}. ${n.keys.length ? `Key: ${n.keys.map(k => fmtSet(S, k)).join(', ')}. ` : ''}Every nontrivial FD has a superkey on the left, so this relation is <b class="good">in BCNF</b>.`
      : `${fmtRel(S, n.R, n.depth ? '' : 'R')}: FDs ${fdInline(S, n.G)}. Key: ${n.keys.map(k => fmtSet(S, k)).join(', ')}. ` +
        `<span class="fd">${fmtList(S, n.violAll[0].l)} → ${fmtList(S, n.violAll[0].r)}</span> violates BCNF: ${fmtSet(S, n.viol.l)}⁺ = ${fmtSet(S, n.viol.l | n.viol.r)} within this relation, not all of it. ` +
        `Split into <b>R₁ = X⁺ = ${fmtRel(S, n.children[0].R)}</b> and <b>R₂ = X ∪ (R − X⁺) = ${fmtRel(S, n.children[1].R)}</b>.`;
    frames.push({ html: `<figure class="tree">${treeSVG(S, root, n.id)}</figure>`, cap });
  }
  const L = leaves(root);
  frames.push({ html: `<figure class="tree">${treeSVG(S, root, Infinity)}</figure>`, cap: `Done. The BCNF decomposition is the set of leaves: <b>${L.map(l => fmtRel(S, l.R)).join(', ')}</b>.` });
  return { frames, root, L };
}
function bcnfTool(sel, { attrs, fds }) {
  return fdTool(sel, [
    { name: 'attrs', label: 'Attributes of R', value: attrs },
    { name: 'fds', label: 'Functional dependencies', value: fds, rows: 3 },
  ], v => {
    const { S, F } = readRel(v);
    if (!F.length) throw new Error('Give at least one FD.');
    const keys = candidateKeys(S, F);
    const rows = split(F).filter(f => !sub(f.r, f.l)).map(f => {
      const c = closure(f.l, F), ok = c === S.all;
      return `<tr><td class="fd">${esc(fmtFD(S, f))}</td><td>${esc(fmtSet(S, c))}</td><td class="${ok ? 'good' : 'bad'}">${ok ? 'superkey: OK' : 'not a superkey: violation'}</td></tr>`;
    }).join('');
    const before = `<p>Keys of R: <b>${keys.map(k => fmtSet(S, k)).join(', ')}</b>. Test each nontrivial FD: is its left side a superkey?</p><div class="tbl"><table><tr><th>FD</th><th>closure of left side</th><th>BCNF?</th></tr>${rows}</table></div>`;
    const { frames, L } = bcnfFrames(S, F);
    const dp = depPreserve(S, F, L.map(l => l.R)), lost = dp.filter(d => !d.ok);
    const after = `<p class="fdt-res">Result: ${L.map(l => `<b>${fmtRel(S, l.R)}</b> with ${fdInline(S, l.G)}`).join('; ')}.</p>` +
      `<p class="fdt-res">Lossless: yes (every BCNF split is lossless). Dependency preserving: ${lost.length ? `<span class="bad">no</span>, ${fdInline(S, lost.map(d => d.fd))} cannot be checked inside the pieces` : '<span class="good">yes</span>'}.</p>`;
    return { before, steps: frames, after };
  }, { button: 'Check and decompose', interval: 2600 });
}

// ---- 5. 3NF synthesis ----
function synthTool(sel, { attrs, fds }) {
  return fdTool(sel, [
    { name: 'attrs', label: 'Attributes of R', value: attrs },
    { name: 'fds', label: 'Functional dependencies', value: fds, rows: 3 },
  ], v => {
    const { S, F } = readRel(v);
    if (!F.length) throw new Error('Give at least one FD.');
    const r = synth3NF(S, F), frames = [];
    const relBox = (list, cls = () => '') => `<div class="rels">${list.map(x => `<span class="rel ${cls(x)}">${esc(fmtRel(S, x.R))}${x.key ? ' <small>key</small>' : ''}</span>`).join('')}</div>`;
    frames.push({ html: fdList(S, split(F)), cap: `Given FDs (split). Step 1 finds a minimal basis G.` });
    frames.push({ html: fdList(S, r.mb), cap: `Step 1: minimal basis G = ${fdInline(S, r.mb)}. (Use the minimal basis tool to see every check.)` });
    frames.push({ html: fdList(S, r.G), cap: `Step 2: merge FDs with the same left side: ${fdInline(S, r.G)}.` });
    frames.push({ html: relBox(r.rels), cap: `Step 3: one relation X ∪ A for each FD X → A: ${r.rels.map(x => fmtRel(S, x.R)).join(', ')}. Each FD now lives entirely inside one relation, so it is preserved.` });
    if (r.removed.length) frames.push({ html: relBox(r.rels, x => r.removed.includes(x) ? 'del' : ''), cap: `Step 5 (applied early, as on the slide): ${r.removed.map(x => fmtRel(S, x.R)).join(', ')} ${r.removed.length > 1 ? 'are subsets' : 'is a subset'} of another relation, so drop ${r.removed.length > 1 ? 'them' : 'it'}.` });
    frames.push({ html: relBox(r.final, x => x.key ? 'new' : ''), cap: `Step 4: keys of R: ${r.keys.map(k => fmtSet(S, k)).join(', ')}. ` +
      (r.hasKey ? 'Some relation already contains a key (it is a superkey of R), so nothing is added.' : `No relation contains a key, so add one relation whose schema is a key: <b>${fmtRel(S, r.final[r.final.length - 1].R)}</b>. This guarantees a lossless join.`) });
    frames.push({ html: relBox(r.final, () => 'keep'), cap: `Final 3NF decomposition: <b>${r.final.map(x => fmtRel(S, x.R)).join(', ')}</b>. Lossless and dependency preserving.` });
    return { steps: frames, after: `<p class="fdt-res">3NF schemas: <b>${r.final.map(x => fmtRel(S, x.R)).join(', ')}</b>.</p>` };
  }, { button: 'Synthesize 3NF' });
}

// ---- 6. chase + dependency preservation ----
function symHTML(S, sym, c) {
  const L = S.single ? S.names[c].toLowerCase() : String.fromCharCode(97 + (c % 26));
  return sym === 'd' ? `<b>${L}</b>` : `${L}<sub>${sym.slice(1)}</sub>`;
}
function tableau(S, T, rels, hl = {}) {
  return `<table class="tableau"><tr><th></th>${S.names.map(n => `<th>${esc(n)}</th>`).join('')}</tr>${T.map((r, i) =>
    `<tr class="${hl.win === i ? 'win' : ''}"><td class="lab">${esc(fmtList(S, rels[i]))}</td>${r.map((x, c) =>
      `<td class="${(hl.rows || []).includes(i) && (hl.cols || []).includes(c) ? 'agree' : ''}${(hl.hit || []).includes(i) && hl.col === c ? ' chg' : ''}${x === 'd' ? ' dist' : ''}">${symHTML(S, x, c)}</td>`).join('')}</tr>`).join('')}</table>`;
}
function chaseTool(sel, { attrs, fds, decomp }) {
  return fdTool(sel, [
    { name: 'attrs', label: 'Attributes of R', value: attrs },
    { name: 'fds', label: 'Functional dependencies', value: fds, rows: 2 },
    { name: 'decomp', label: 'Decomposition (schemas separated by ; )', value: decomp },
  ], v => {
    const { S, F } = readRel(v), rels = parseDecomp(S, v.decomp);
    const res = chase(S, F, rels), frames = [];
    res.snaps.forEach((sn, k) => {
      if (!sn.fd) { frames.push({ html: tableau(S, sn.T, rels), cap: `Build the tableau: one row per relation. Row i has the plain letter in the columns of its relation (bold) and a letter with subscript i elsewhere (unknown values).` }); return; }
      const prev = res.snaps[k - 1].T, X = bits(sn.fd.l);
      frames.push({ html: tableau(S, prev, rels, { rows: sn.rows, cols: X.concat(sn.col) }),
        cap: `<span class="fd">${fmtFD(S, sn.fd)}</span>: rows ${sn.rows[0] + 1} and ${sn.rows[1] + 1} agree on ${fmtList(S, sn.fd.l)}, so they must agree on ${S.names[sn.col]}.` });
      const win = sn.T.findIndex(r => r.every(x => x === 'd'));
      frames.push({ html: tableau(S, sn.T, rels, { hit: sn.hit, col: sn.col, win }),
        cap: `Replace ${symHTML(S, sn.from, sn.col)} by ${symHTML(S, sn.to, sn.col)} everywhere in column ${S.names[sn.col]}.` + (win >= 0 ? ` <b class="good">Row ${win + 1} is now all plain letters: the join is lossless.</b>` : '') });
    });
    const last = res.snaps[res.snaps.length - 1].T;
    if (!res.lossless) frames.push({ html: tableau(S, last, rels), cap: `No FD can change anything more, and no row is all plain letters. <b class="bad">The decomposition is lossy.</b> This final tableau, read as an instance of R, satisfies every FD but its projections join to give the extra tuple (${S.names.map((_, c) => symHTML(S, 'd', c)).join(', ')}).` });
    let after = `<p class="fdt-res">Chase result: ${res.lossless ? '<span class="good">lossless join</span>' : '<span class="bad">lossy (not lossless)</span>'}.</p>`;
    if (rels.length === 2) {
      const I = rels[0] & rels[1], c = closure(I, F), t1 = sub(rels[0], c), t2 = sub(rels[1], c);
      after += `<p class="fdt-res">Two-relation shortcut: R₁ ∩ R₂ = ${fmtSet(S, I)}, closure ${fmtSet(S, c)}. ${t1 || t2 ? `It contains all of R${t1 ? '₁' : '₂'}, so the common attributes are a superkey of R${t1 ? '₁' : '₂'}: lossless.` : 'It contains neither R₁ nor R₂: lossy.'}</p>`;
    }
    return { steps: frames, after };
  }, { button: 'Run the chase' });
}
function depTool(sel, { attrs, fds, decomp }) {
  return fdTool(sel, [
    { name: 'attrs', label: 'Attributes of R', value: attrs },
    { name: 'fds', label: 'Functional dependencies', value: fds, rows: 2 },
    { name: 'decomp', label: 'Decomposition (schemas separated by ; )', value: decomp },
  ], v => {
    const { S, F } = readRel(v), rels = parseDecomp(S, v.decomp);
    const dp = depPreserve(S, F, rels), frames = [];
    const proj = rels.map(R => pop(R) <= 12 ? project(F, R).basis : null);
    const before = `<p>Projected FDs: ${rels.map((R, i) => `${fmtRel(S, R, `R${i + 1}`)}: ${proj[i] ? fdInline(S, proj[i]) : '(too large)'}`).join('; ')}.</p>`;
    for (const d of dp) {
      let cap = `Test <span class="fd">${fmtFD(S, d.fd)}</span>. Start with result = ${fmtSet(S, d.fd.l)}. `;
      cap += d.trace.length ? d.trace.map(t => `In ${fmtRel(S, t.R)}: (${fmtList(S, t.from)})⁺ ∩ ${fmtList(S, t.R)} adds ${fmtSet(S, t.add)}.`).join(' ') : 'No relation adds anything. ';
      cap += ` Final result ${fmtSet(S, d.res)} ${d.ok ? `contains ${fmtList(S, d.fd.r)}: <b class="good">preserved</b>.` : `lacks ${fmtSet(S, d.fd.r & ~d.res)}: <b class="bad">not preserved</b>.`}`;
      frames.push({ html: chips(S, d.res, 0, 'result =') + `<div class="rels">${rels.map(R => `<span class="rel">${esc(fmtRel(S, R))}</span>`).join('')}</div>`, cap });
    }
    const bad = dp.filter(d => !d.ok);
    return { before, steps: frames, after: `<p class="fdt-res">${bad.length ? `<span class="bad">Not dependency preserving</span>: ${fdInline(S, bad.map(d => d.fd))} cannot be enforced without a join.` : '<span class="good">Dependency preserving</span>: every FD can be checked inside the pieces.'}</p>` };
  }, { button: 'Check preservation' });
}

// ---- normal form check (1NF/2NF/3NF/BCNF) ----
function nfTool(sel, { attrs, fds }) {
  return fdTool(sel, [
    { name: 'attrs', label: 'Attributes of R', value: attrs },
    { name: 'fds', label: 'Functional dependencies', value: fds, rows: 3 },
  ], v => {
    const { S, F } = readRel(v);
    const r = nfCheck(S, F), frames = [];
    frames.push({ html: r.keys.map(k => chips(S, k, 0, 'key')).join('') + chips(S, r.prime, 0, 'prime'), cap: `Keys: ${r.keys.map(k => fmtSet(S, k)).join(', ')}. Prime attributes (in some key): ${fmtSet(S, r.prime)}. Non-prime: ${fmtSet(S, S.all & ~r.prime)}.` });
    frames.push({ html: chips(S, r.prime, 0, 'prime'), cap: `2NF: does a <em>proper part</em> of a key determine a non-prime attribute? ` + (r.partial.length ? `Yes: ${r.partial.map(p => `<span class="fd">${fmtList(S, p.l)} → ${fmtList(S, p.r)}</span> (part of key ${fmtList(S, p.key)})`).join(', ')}. <b class="bad">Not in 2NF.</b>` : '<b class="good">No partial dependency: 2NF holds.</b>') });
    frames.push({ html: chips(S, r.prime, 0, 'prime'), cap: `3NF: each nontrivial FD needs a superkey on the left or a prime attribute on the right. ` + (r.nf3.length ? `Violations: ${fdInline(S, r.nf3)}. <b class="bad">Not in 3NF.</b>` : '<b class="good">3NF holds.</b>') });
    frames.push({ html: chips(S, r.prime, 0, 'prime'), cap: `BCNF: each nontrivial FD needs a superkey on the left. ` + (r.bcnf.length ? `Violations: ${fdInline(S, r.bcnf)}. <b class="bad">Not in BCNF.</b>` : '<b class="good">BCNF holds.</b>') });
    return { steps: frames, after: `<p class="fdt-res">Highest normal form: <b>${r.nf}</b> (assuming every value is atomic, i.e. 1NF).</p>` };
  }, { button: 'Check normal form' });
}

// relation instance as a table. o = {rowCls: {i: 'hl'|'del'|'new'}, cell: {'r,c': cls}, cap}
function inst(head, rows, o = {}) {
  return (o.cap ? `<div class="inst-cap">${o.cap}</div>` : '') + `<div class="inst-wrap"><table class="inst"><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map((r, i) =>
    `<tr class="${(o.rowCls || {})[i] || ''}">${r.map((v, c) => `<td class="${(o.cell || {})[i + ',' + c] || ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</table></div>`;
}
window.inst = inst;
// table of X, X⁺ and the nontrivial single-RHS FDs X → A for every nonempty subset X (exam questions)
function closureTable(attrs, fds) {
  const S = parseAttrs(attrs), F = parseFDs(S, fds), keys = candidateKeys(S, F);
  let n = 0, h = '<div class="tbl"><table class="inst"><tr><th>X</th><th>X⁺</th><th>nontrivial X → A</th><th>X is…</th></tr>';
  for (const X of subsetsOf(S.all)) {
    if (!X) continue;
    const c = closure(X, F), add = bits(c & ~X); n += add.length;
    const kind = keys.includes(X) ? '<b class="good">key</b>' : c === S.all ? 'superkey' : '';
    h += `<tr><td>${esc(fmtList(S, X))}</td><td>${esc(fmtSet(S, c))}</td><td>${add.map(b => esc(fmtList(S, X) + ' → ' + S.names[b])).join(', ') || '<span class="na">none</span>'}</td><td>${kind}</td></tr>`;
  }
  return h + `</table></div><p class="tbl-note">${n} nontrivial FDs with one attribute on the right.</p>`;
}
window.closureTable = closureTable;
// dependency diagram (textbook style): attribute boxes in a row; the key underlined.
// deps: [{from: [names], to: [names], kind: 'full' | 'partial' | 'transitive'}]; full ones drawn above, the rest below.
function depDiagram(names, key, deps) {
  const CW = 7.2, PAD = 10, GAP = 6, BH = 30;
  let x = 10; const pos = {};
  for (const n of names) { const w = n.length * CW + PAD * 2; pos[n] = { x, w, c: x + w / 2 }; x += w + GAP; }
  const W = x + 4, above = deps.filter(d => d.kind === 'full'), below = deps.filter(d => d.kind !== 'full');
  const top = 26 + above.length * 26, H = top + BH + 26 + below.length * 26 + 8;
  const cls = { full: 's-grn', partial: 's-red', transitive: 's-acc' }, mk = { full: 'm-grn', partial: 'm-red', transitive: 'm-acc' };
  const tcl = { full: 'grn', partial: 'red', transitive: 'acc' };
  let s = '';
  const draw = (d, y, up) => {
    const xs = d.from.concat(d.to).map(n => pos[n].c), x0 = Math.min(...xs), x1 = Math.max(...xs), edge = up ? top : top + BH;
    s += `<path d="M${x0} ${y} H${x1}" class="${cls[d.kind]}"/>`;
    d.from.forEach(n => { s += `<path d="M${pos[n].c - 4} ${edge} V${y}" class="${cls[d.kind]}"/>`; });
    d.to.forEach(n => { s += `<path d="M${pos[n].c + 4} ${y} V${up ? edge - 3 : edge + 3}" class="${cls[d.kind]}" marker-end="url(#${mk[d.kind]})"/>`; });
    s += `<text x="${x1 + 6}" y="${y + 4}" class="lbl ${tcl[d.kind]}">${d.label || d.kind}</text>`;
  };
  above.forEach((d, i) => draw(d, top - 14 - i * 26, true));
  below.forEach((d, i) => draw(d, top + BH + 14 + i * 26, false));
  for (const n of names) {
    const p = pos[n], k = key.includes(n);
    s += `<rect x="${p.x}" y="${top}" width="${p.w}" height="${BH}" class="${k ? 'cell-hl' : 'cell'}"/>`;
    s += `<text x="${p.c}" y="${top + 20}" text-anchor="middle" style="font-size:12.5px${k ? ';text-decoration:underline;font-weight:600' : ''}">${esc(n)}</text>`;
  }
  const Wt = W + 80;
  return `<svg viewBox="0 0 ${Wt} ${H}" width="${Wt}" role="img" aria-label="dependency diagram">${s}</svg>`;
}
window.depDiagram = depDiagram;
window.MOVIES1_H = ['title', 'year', 'length', 'genre', 'studioName', 'starName'];
window.MOVIES1 = [
  ['Star Wars', '1977', '124', 'SciFi', 'Fox', 'Carrie Fisher'], ['Star Wars', '1977', '124', 'SciFi', 'Fox', 'Mark Hamill'],
  ['Star Wars', '1977', '124', 'SciFi', 'Fox', 'Harrison Ford'], ['Gone With the Wind', '1939', '231', 'drama', 'MGM', 'Vivien Leigh'],
  ['Wayne’s World', '1992', '95', 'comedy', 'Paramount', 'Dana Carvey'], ['Wayne’s World', '1992', '95', 'comedy', 'Paramount', 'Mike Meyers']];

window.FD = { closureTool, keyTool, basisTool, projTool, bcnfTool, synthTool, chaseTool, depTool, nfTool, chips, fdList, tableau, treeSVG,
  parseAttrs, parseFDs, parseSet, closure, fmtSet, fmtFD };
}
