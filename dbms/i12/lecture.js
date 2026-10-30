// Lec 12 (Ishrak): a relational-algebra evaluator (parser, query-tree drawing, bottom-up stepper),
// auto-checked RA exercises, and the sample databases used by the chapters.
// The core (raDB, raRun, raSetup) has no DOM use, so the answers can also be checked in node.
(function (G) {
'use strict';

// ---------- sample data: a tiny text format ----------
// Name(a, b, c)            header, then one row per line, values separated by |
// 001 | John | 3.4         numbers become numbers (except ones with a leading 0), 'quoted' stays text, NULL is null
function raDB(text) {
  const db = {};
  for (const block of text.trim().split(/\n\s*\n/)) {
    const lines = block.trim().split('\n').map(s => s.trim()).filter(Boolean);
    const m = lines[0].match(/^(\w+)\s*\(([^)]*)\)$/);
    if (!m) throw new Error('bad relation header: ' + lines[0]);
    const cols = m[2].split(',').map(s => s.trim()).filter(Boolean);
    const rows = lines.slice(1).map(l => l.split('|').map(v => parseVal(v.trim())));
    rows.forEach(r => { if (r.length !== cols.length) throw new Error(`${m[1]}: row "${r.join('|')}" has ${r.length} values, expected ${cols.length}`); });
    db[m[1]] = { name: m[1], cols, rows };
  }
  return db;
}
function parseVal(v) {
  if (v === 'NULL') return null;
  if (/^'.*'$/.test(v)) return v.slice(1, -1);
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
// Oracle CREATE TABLE + INSERT script for the same data (fed to the SQL playground).
function raSetup(db, only) {
  const q = v => v == null ? 'NULL' : typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`;
  return Object.values(db).filter(r => !only || only.includes(r.name)).map(r => {
    const num = r.cols.map((c, i) => r.rows.length > 0 && r.rows.every(x => x[i] == null || typeof x[i] === 'number'));
    const id = n => /^(transaction|order|group|table|index|check|default|primary|references|values)$/i.test(n) ? `"${n}"` : n;
    return `CREATE TABLE ${id(r.name)} (${r.cols.map((c, i) => `${id(c)} ${num[i] ? 'NUMBER' : 'VARCHAR2(40)'}`).join(', ')});\n` +
      r.rows.map(x => `INSERT INTO ${id(r.name)} VALUES (${x.map(q).join(', ')});`).join('\n');
  }).join('\n');
}

// ---------- lexer ----------
const SYM = ['<=', '>=', '<>', '!=', '==', '->', ':=', '||', '&&', '≤', '≥', '≠', '∧', '∨', '¬', '←', '=', '<', '>', '+', '-', '*', '/', '(', ')', ',', '.', ';',
  'σ', 'π', 'Π', 'ρ', 'γ', 'τ', 'δ', '⋈', '×', '∪', '∩', '−', '÷', '⟕', '⟖', '⟗', '⋉', '→'];
function lex(src, top) {
  const out = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '-' && src[i + 1] === '-' && top) { while (i < src.length && src[i] !== '\n') i++; continue; }   // -- comment
    const at = i;
    if (c === '[' && top) {                     // raw parameter text up to the matching ]
      let d = 1, j = i + 1, quote = null;
      for (; j < src.length; j++) {
        const ch = src[j];
        if (quote) { if (ch === quote) quote = null; continue; }
        if (ch === "'" || ch === '"') quote = ch;
        else if (ch === '[') d++;
        else if (ch === ']' && --d === 0) break;
      }
      if (j >= src.length) throw err('a "[" is never closed', at);
      out.push({ t: 'br', v: src.slice(i + 1, j), at }); i = j + 1; continue;
    }
    if (c === "'" || c === '"' || c === '‘' || c === '“') {
      const close = c === '‘' ? '’' : c === '“' ? '”' : c;
      const j = src.indexOf(close, i + 1);
      if (j < 0) throw err('a quoted string is never closed', at);
      out.push({ t: 'str', v: src.slice(i + 1, j), at }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c)) {
      const m = src.slice(i).match(/^\d+(\.\d+)?/);
      out.push({ t: 'num', v: Number(m[0]), raw: m[0], at }); i += m[0].length; continue;
    }
    if (/[A-Za-z_#$]/.test(c)) {
      const m = src.slice(i).match(/^[A-Za-z_#$][\w#$]*/);
      out.push({ t: 'id', v: m[0], at }); i += m[0].length; continue;
    }
    const s = SYM.find(x => src.startsWith(x, i));
    if (!s) throw err(`unexpected character "${c}"`, at);
    out.push({ t: 'op', v: s, at }); i += s.length;
  }
  return out;
}
function err(msg, at) { const e = new Error(msg); e.at = at; return e; }

// ---------- expression parser (conditions, projection items) ----------
const KW = w => w.toLowerCase();
function parseExpr(src) {
  const toks = lex(src, false); let p = 0;
  const peek = () => toks[p], next = () => toks[p++];
  const isW = (t, ...ws) => t && t.t === 'id' && ws.includes(KW(t.v));
  const isO = (t, ...os) => t && t.t === 'op' && os.includes(t.v);
  function or() { let a = and(); while (isW(peek(), 'or') || isO(peek(), '∨', '||')) { next(); a = { k: 'or', a, b: and() }; } return a; }
  function and() { let a = not(); while (isW(peek(), 'and') || isO(peek(), '∧', '&&')) { next(); a = { k: 'and', a, b: not() }; } return a; }
  function not() { if (isW(peek(), 'not') || isO(peek(), '¬')) { next(); return { k: 'not', a: not() }; } return cmp(); }
  function cmp() {
    const a = add(), t = peek();
    if (isO(t, '=', '==', '<>', '!=', '≠', '<', '<=', '≤', '>', '>=', '≥')) {
      next(); const o = { '==': '=', '!=': '<>', '≠': '<>', '≤': '<=', '≥': '>=' }[t.v] || t.v;
      return { k: 'cmp', o, a, b: add() };
    }
    if (isW(t, 'like')) { next(); return { k: 'like', a, b: add() }; }
    if (isW(t, 'is')) { next(); const neg = isW(peek(), 'not') ? (next(), true) : false; if (!isW(next(), 'null')) throw err('expected NULL after IS'); return { k: 'isnull', a, neg }; }
    return a;
  }
  function add() { let a = mul(); while (isO(peek(), '+', '-', '−')) { const o = next().v === '+' ? '+' : '-'; a = { k: 'ar', o, a, b: mul() }; } return a; }
  function mul() { let a = un(); while (isO(peek(), '*', '/')) { const o = next().v; a = { k: 'ar', o, a, b: un() }; } return a; }
  function un() { if (isO(peek(), '-', '−')) { next(); return { k: 'ar', o: '-', a: { k: 'lit', v: 0 }, b: un() }; } return prim(); }
  function prim() {
    const t = next();
    if (!t) throw err('the condition ends too early');
    if (t.t === 'num') return { k: 'lit', v: t.v };
    if (t.t === 'str') return { k: 'lit', v: t.v };
    if (isO(t, '(')) { const e = or(); if (!isO(next(), ')')) throw err('a "(" is never closed'); return e; }
    if (isO(t, '*')) return { k: 'star' };
    if (t.t === 'id') {
      if (KW(t.v) === 'null') return { k: 'lit', v: null };
      if (KW(t.v) === 'true' || KW(t.v) === 'false') return { k: 'lit', v: KW(t.v) === 'true' ? 'T' : 'F' };
      if (isO(peek(), '(')) {                    // function call
        next(); const args = []; let distinct = false;
        if (isW(peek(), 'distinct')) { next(); distinct = true; }
        if (!isO(peek(), ')')) { args.push(or()); while (isO(peek(), ',')) { next(); args.push(or()); } }
        if (!isO(next(), ')')) throw err(`missing ")" after the arguments of ${t.v}`);
        return { k: 'call', f: KW(t.v), args, distinct };
      }
      if (isO(peek(), '.')) { next(); const n = next(); if (!n || n.t !== 'id') throw err(`expected an attribute name after "${t.v}."`); return { k: 'ref', q: t.v, n: n.v }; }
      return { k: 'ref', q: null, n: t.v };
    }
    throw err(`unexpected "${t.v}" in "${src}"`);
  }
  // items: expr [-> alias | as alias]
  return {
    cond() { const e = or(); if (p < toks.length) throw err(`unexpected "${peek().v}" in condition "${src}"`); return e; },
    items() {
      const list = [];
      if (!toks.length) return list;
      for (;;) {
        const e = or(); let alias = null;
        if (isO(peek(), '->', '→') || isW(peek(), 'as')) { next(); const a = next(); if (!a || a.t !== 'id') throw err('expected a name after ->'); alias = a.v; }
        let dir = null; if (isW(peek(), 'asc', 'desc')) dir = KW(next().v);
        list.push({ e, alias, dir });
        if (p >= toks.length) break;
        if (!isO(next(), ',', ';')) throw err(`expected "," in "${src}"`);
      }
      return list;
    },
  };
}
const exprText = e => {
  switch (e.k) {
    case 'lit': return e.v == null ? 'NULL' : typeof e.v === 'number' ? String(e.v) : `'${e.v}'`;
    case 'ref': return (e.q ? e.q + '.' : '') + e.n;
    case 'star': return '*';
    case 'call': return `${e.f}(${e.distinct ? 'distinct ' : ''}${e.args.map(exprText).join(', ')})`;
    case 'ar': return `${exprText(e.a)}${e.o}${exprText(e.b)}`;
    default: return '?';
  }
};

// ---------- program parser ----------
const UN = { select: 'select', σ: 'select', sigma: 'select', project: 'project', π: 'project', Π: 'project', pi: 'project',
  rename: 'rename', ρ: 'rename', rho: 'rename', group: 'group', γ: 'group', gamma: 'group', sort: 'sort', τ: 'sort', tau: 'sort',
  distinct: 'distinct', δ: 'distinct', delta: 'distinct' };
const PROD = { x: 'cross', '×': 'cross', times: 'cross', cross: 'cross', join: 'join', '⋈': 'join', natjoin: 'join',
  ljoin: 'ljoin', '⟕': 'ljoin', rjoin: 'rjoin', '⟖': 'rjoin', fjoin: 'fjoin', '⟗': 'fjoin', semijoin: 'semi', '⋉': 'semi',
  '/': 'div', '÷': 'div', divide: 'div' };
const INTER = { intersect: 'inter', '∩': 'inter' };
const UNION = { union: 'union', '∪': 'union', '-': 'minus', '−': 'minus', minus: 'minus', except: 'minus' };
const opKey = t => t && (t.t === 'op' ? t.v : t.t === 'id' ? KW(t.v) : null);

function raParse(src) {
  const toks = lex(src, true); let p = 0;
  const peek = (k = 0) => toks[p + k], next = () => toks[p++];
  const want = (v, what) => { const t = next(); if (!t || t.v !== v) throw err(`expected "${v}" ${what}${t ? `, found "${t.v}"` : ' but the input ended'}`, t?.at); return t; };
  function expr() { let a = inter(); while (UNION[opKey(peek())]) { const op = UNION[opKey(next())]; a = mk(op, null, [a, inter()]); } return a; }
  function inter() { let a = prod(); while (INTER[opKey(peek())]) { next(); a = mk('inter', null, [a, prod()]); } return a; }
  function prod() {
    let a = unary();
    while (PROD[opKey(peek())]) {
      const op = PROD[opKey(next())];
      const param = peek()?.t === 'br' ? next().v : null;
      if (param != null && !/join|semi/.test(op)) throw err(`"${op}" does not take a [condition]`);
      a = mk(param != null && op === 'join' ? 'theta' : op, param, [a, unary()]);
    }
    return a;
  }
  function unary() {
    const t = next();
    if (!t) throw err('the expression ends too early (a relation or an operator is missing)');
    const u = UN[opKey(t)];
    if (u) {
      let param = null;
      if (peek()?.t === 'br') param = next().v;
      else if (u !== 'distinct') throw err(`${t.v} needs its parameter in square brackets, e.g. ${u}[…](R)`, t.at);
      const kid = peek()?.v === '(' ? (next(), paren()) : unary();
      return mk(u, param, [kid]);
    }
    if (t.v === '(') return paren();
    if (t.t === 'id') return { op: 'rel', name: t.v, kids: [] };
    throw err(`unexpected "${t.v}"`, t.at);
  }
  function paren() { const e = expr(); want(')', 'to close "("'); return e; }
  const stmts = [];
  while (p < toks.length) {
    let target = null, attrs = null;
    if (peek()?.t === 'id' && (peek(1)?.v === ':=' || peek(1)?.v === '←')) { target = next().v; next(); }
    else if (peek()?.t === 'id' && peek(1)?.v === '(') {
      let j = p + 2; while (j < toks.length && toks[j].v !== ')') j++;
      if (toks[j + 1] && (toks[j + 1].v === ':=' || toks[j + 1].v === '←')) {
        target = next().v; next();
        attrs = []; while (peek().v !== ')') { const a = next(); if (a.t === 'id') attrs.push(a.v); }
        next(); next();
      }
    }
    const e = expr();
    stmts.push({ target, attrs, e });
    while (peek()?.v === ';') next();
  }
  if (!stmts.length) throw err('type an expression first');
  return stmts;
}
function mk(op, param, kids) {
  const n = { op, param, kids };
  try {
    if (/select|theta|ljoin|rjoin|fjoin|semi/.test(op) && param != null) n.cond = parseExpr(param).cond();
    if (op === 'project' || op === 'sort') n.items = parseExpr(param).items();
    if (op === 'rename') n.ren = parseRename(param);
    if (op === 'group') n.grp = parseGroup(param);
  } catch (e) { throw err(`in ${op}[${param}]: ${e.message}`); }
  return n;
}
function parseRename(s) {
  s = s.trim();
  if (/->|→/.test(s)) return { pairs: s.split(',').map(x => x.split(/->|→/).map(y => y.trim())) };
  const m = s.match(/^(\w+)\s*(?:\(([^)]*)\))?$/);
  if (!m) throw err('write rename[S], rename[S(a, b, …)] or rename[old -> new]');
  return { rel: m[1], names: m[2] ? m[2].split(',').map(x => x.trim()) : null };
}
const AGG = ['count', 'sum', 'avg', 'min', 'max'];
function parseGroup(s) {
  let by = [], aggs = [];
  if (s.includes(';')) {
    const [a, b] = s.split(';');
    by = parseExpr(a).items(); aggs = parseExpr(b).items();
  } else parseExpr(s).items().forEach(it => (it.e.k === 'call' && AGG.includes(it.e.f) ? aggs : by).push(it));
  by.forEach(it => { if (it.e.k !== 'ref') throw err('group by attributes must be plain attributes'); });
  aggs.forEach(it => { if (it.e.k !== 'call' || !AGG.includes(it.e.f)) throw err(`"${exprText(it.e)}" is not an aggregate (count, sum, avg, min, max)`); });
  return { by, aggs };
}

// ---------- relations and evaluation ----------
// rel = {cols: [{name, quals: Set}], rows: [[...]]}
const key = r => JSON.stringify(r);
function dedupe(rows) { const s = new Set(), out = []; for (const r of rows) { const k = key(r); if (!s.has(k)) { s.add(k); out.push(r); } } return out; }
const lc = s => String(s).toLowerCase();
function colIndex(cols, q, n) {
  const hits = cols.map((c, i) => i).filter(i => lc(cols[i].name) === lc(n) && (!q || [...cols[i].quals].some(x => lc(x) === lc(q))));
  if (!hits.length) throw err(`there is no attribute ${q ? q + '.' : ''}${n} here (available: ${cols.map(colName.bind(null, cols)).join(', ')})`);
  if (hits.length > 1) throw err(`"${n}" is ambiguous: it could be ${hits.map(i => [...cols[i].quals][0] + '.' + n).join(' or ')}. Qualify it, e.g. ${[...cols[hits[0]].quals][0]}.${n}`);
  return hits[0];
}
function colName(cols, c) {
  const dup = cols.filter(d => lc(d.name) === lc(c.name)).length > 1;
  return dup && c.quals.size ? [...c.quals][0] + '.' + c.name : c.name;
}
const FN = {
  abs: x => x == null ? null : Math.abs(x), mod: (a, b) => a == null || b == null ? null : a % b,
  trunc: x => x == null ? null : Math.trunc(x), floor: x => x == null ? null : Math.floor(x), round: (x, n = 0) => x == null ? null : Math.round(x * 10 ** n) / 10 ** n,
  to_year: d => d == null ? null : Number(String(d).slice(0, 4)), year: d => d == null ? null : Number(String(d).slice(0, 4)),
  upper: s => s == null ? null : String(s).toUpperCase(), lower: s => s == null ? null : String(s).toLowerCase(), length: s => s == null ? null : String(s).length,
};
function compile(e, cols) {
  switch (e.k) {
    case 'lit': return () => e.v;
    case 'ref': { const i = colIndex(cols, e.q, e.n); return r => r[i]; }
    case 'ar': {
      const a = compile(e.a, cols), b = compile(e.b, cols);
      return r => { const x = a(r), y = b(r); if (x == null || y == null) return null; return e.o === '+' ? x + y : e.o === '-' ? x - y : e.o === '*' ? x * y : x / y; };
    }
    case 'cmp': {
      const a = compile(e.a, cols), b = compile(e.b, cols);
      return r => {
        let x = a(r), y = b(r); if (x == null || y == null) return null;
        if (typeof x !== 'number' || typeof y !== 'number') { x = String(x); y = String(y); }
        switch (e.o) { case '=': return x === y; case '<>': return x !== y; case '<': return x < y; case '<=': return x <= y; case '>': return x > y; default: return x >= y; }
      };
    }
    case 'like': {
      const a = compile(e.a, cols), b = compile(e.b, cols);
      return r => { const x = a(r), y = b(r); if (x == null || y == null) return null; return new RegExp('^' + String(y).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 's').test(String(x)); };
    }
    case 'isnull': { const a = compile(e.a, cols); return r => (a(r) == null) !== e.neg; }
    case 'and': { const a = compile(e.a, cols), b = compile(e.b, cols); return r => { const x = a(r), y = b(r); return x === false || y === false ? false : x == null || y == null ? null : true; }; }
    case 'or': { const a = compile(e.a, cols), b = compile(e.b, cols); return r => { const x = a(r), y = b(r); return x === true || y === true ? true : x == null || y == null ? null : false; }; }
    case 'not': { const a = compile(e.a, cols); return r => { const x = a(r); return x == null ? null : !x; }; }
    case 'call': {
      if (AGG.includes(e.f)) throw err(`${e.f}() is an aggregate; use it inside group[…]`);
      const f = FN[e.f]; if (!f) throw err(`unknown function ${e.f}() (available: ${Object.keys(FN).join(', ')})`);
      const args = e.args.map(x => compile(x, cols)); return r => f(...args.map(g => g(r)));
    }
    case 'star': throw err('"*" can only be used as count(*)');
  }
}
const copyCols = cols => cols.map(c => ({ name: c.name, quals: new Set(c.quals) }));
const names = cols => cols.map(c => colName(cols, c)).join(', ');

function evalNode(n, env, steps) {
  if (n.op === 'rel') {
    const r = env[n.name] || env[Object.keys(env).find(k => lc(k) === lc(n.name))];
    if (!r) throw err(`there is no relation called "${n.name}" (available: ${Object.keys(env).join(', ')})`);
    return n.res = r;
  }
  const ins = n.kids.map(k => evalNode(k, env, steps));
  const [L, R] = ins; let out, info = {};
  const pairCols = () => [...copyCols(L.cols), ...copyCols(R.cols)];
  switch (n.op) {
    case 'select': {
      const f = compile(n.cond, L.cols);
      info.pass = L.rows.map(r => f(r) === true);
      out = { cols: copyCols(L.cols), rows: L.rows.filter((r, i) => info.pass[i]) };
      info.txt = `<b>σ</b> tests the condition <code>${esc(pretty(n.param))}</code> on each of the ${L.rows.length} input rows and keeps the rows where it is true: <b>${out.rows.length} of ${L.rows.length}</b> pass (highlighted).`;
      break;
    }
    case 'project': {
      const fs = n.items.map(it => compile(it.e, L.cols));
      const cols = n.items.map(it => it.e.k === 'ref' && !it.alias ? { ...copyCols([L.cols[colIndex(L.cols, it.e.q, it.e.n)]])[0] } : { name: it.alias || exprText(it.e), quals: new Set() });
      const all = L.rows.map(r => fs.map(f => f(r))), rows = dedupe(all);
      out = { cols, rows };
      const d = all.length - rows.length;
      info.txt = `<b>π</b> keeps only ${cols.length === 1 ? 'the attribute' : 'the attributes'} <code>${esc(names(cols))}</code> of each row. ` +
        (d ? `${d} row${d > 1 ? 's become' : ' becomes'} a duplicate and ${d > 1 ? 'are' : 'is'} removed, because a relation is a <b>set</b>: ${L.rows.length} → <b>${rows.length}</b> rows.` : `No two rows become equal, so all ${rows.length} rows stay.`);
      break;
    }
    case 'rename': {
      const cols = copyCols(L.cols), rn = n.ren;
      if (rn.pairs) rn.pairs.forEach(([a, b]) => { const i = colIndex(cols, null, a.split('.').pop()); cols[i].name = b; });
      else {
        if (rn.names && rn.names.length !== cols.length) throw err(`rename[${n.param}] gives ${rn.names.length} names but the input has ${cols.length} attributes`);
        cols.forEach((c, i) => { c.quals = new Set([rn.rel]); if (rn.names) c.name = rn.names[i]; });
      }
      out = { cols, rows: L.rows };
      info.txt = `<b>ρ</b> changes names only: ${rn.pairs ? rn.pairs.map(p => `${p[0]} → ${p[1]}`).join(', ') : `the relation is now called <b>${rn.rel}</b>${rn.names ? ` with attributes (${rn.names.join(', ')})` : ''}`}. The rows are untouched.`;
      break;
    }
    case 'distinct': out = { cols: copyCols(L.cols), rows: dedupe(L.rows) }; info.txt = '<b>δ</b> removes duplicate rows. Our relations are sets, so nothing changes here.'; break;
    case 'sort': {
      const fs = n.items.map(it => ({ f: compile(it.e, L.cols), d: it.dir === 'desc' ? -1 : 1 }));
      const rows = [...L.rows].sort((a, b) => { for (const { f, d } of fs) { const x = f(a), y = f(b); if (x !== y) return (x < y ? -1 : 1) * d; } return 0; });
      out = { cols: copyCols(L.cols), rows, sorted: true };
      info.txt = `<b>τ</b> sorts the rows by <code>${esc(n.param)}</code>. (Sorting is an extended operator: the result is a list, not a set.)`;
      break;
    }
    case 'group': {
      const g = n.grp, byI = g.by.map(it => colIndex(L.cols, it.e.q, it.e.n));
      const groups = new Map();
      L.rows.forEach(r => { const k = key(byI.map(i => r[i])); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
      if (!byI.length && !groups.size) groups.set('[]', []);
      const aggF = g.aggs.map(it => {
        const a = it.e.args[0], col = !a || a.k === 'star' ? null : compile(a, L.cols);
        return rows => {
          let vals = col ? rows.map(col).filter(v => v != null) : rows.map(() => 1);
          if (it.e.distinct) vals = [...new Set(vals)];
          switch (it.e.f) {
            case 'count': return vals.length;
            case 'sum': return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
            case 'avg': return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
            case 'min': return vals.length ? vals.reduce((s, v) => v < s ? v : s) : null;
            default: return vals.length ? vals.reduce((s, v) => v > s ? v : s) : null;
          }
        };
      });
      const rows = [...groups.values()].map(rs => [...byI.map(i => rs.length ? rs[0][i] : null), ...aggF.map(f => f(rs))]);
      const cols = [...byI.map(i => copyCols([L.cols[i]])[0]), ...g.aggs.map(it => ({ name: it.alias || (it.e.f + (it.e.args[0] && it.e.args[0].k !== 'star' ? '_' + exprText(it.e.args[0]).replace(/\W/g, '') : '')), quals: new Set() }))];
      out = { cols, rows };
      info.txt = `<b>γ</b> ${byI.length ? `puts the ${L.rows.length} input rows into <b>${rows.length}</b> group${rows.length === 1 ? '' : 's'}, one per value of (${g.by.map(it => exprText(it.e)).join(', ')}),` : 'treats all the input rows as one group'} and computes ${g.aggs.map(it => `<code>${esc(exprText(it.e))}</code>`).join(', ')} for each group.`;
      break;
    }
    case 'cross':
      out = { cols: pairCols(), rows: L.rows.flatMap(a => R.rows.map(b => [...a, ...b])) };
      info.txt = `<b>×</b> pairs every row of the left input (${L.rows.length}) with every row of the right input (${R.rows.length}): ${L.rows.length} × ${R.rows.length} = <b>${out.rows.length}</b> rows, with all ${out.cols.length} attributes side by side.`;
      break;
    case 'theta': case 'join': case 'ljoin': case 'rjoin': case 'fjoin': case 'semi': {
      let cols, match, shared = [];
      if (n.cond) {
        cols = pairCols(); const f = compile(n.cond, cols);
        match = (a, b) => f([...a, ...b]) === true;
      } else {
        L.cols.forEach((c, i) => {
          const j = R.cols.map((d, j) => j).filter(j => lc(R.cols[j].name) === lc(c.name));
          if (j.length) {
            if (j.length > 1 || L.cols.filter(d => lc(d.name) === lc(c.name)).length > 1) throw err(`natural join: attribute "${c.name}" appears more than once on one side; rename first`);
            shared.push([i, j[0]]);
          }
        });
        const rKeep = R.cols.map((d, j) => j).filter(j => !shared.some(s => s[1] === j));
        cols = [...copyCols(L.cols), ...copyCols(rKeep.map(j => R.cols[j]))];
        shared.forEach(([i, j]) => R.cols[j].quals.forEach(q => cols[i].quals.add(q)));
        match = (a, b) => shared.every(([i, j]) => a[i] != null && a[i] === b[j]);
        cols._rKeep = rKeep;
      }
      const combine = (a, b) => n.cond ? [...a, ...b] : [...a, ...cols._rKeep.map(j => b[j])];
      const rows = [], lHit = L.rows.map(() => false), rHit = R.rows.map(() => false);
      L.rows.forEach((a, i) => R.rows.forEach((b, j) => { if (match(a, b)) { rows.push(combine(a, b)); lHit[i] = rHit[j] = true; } }));
      const nullsR = n.cond ? R.cols.map(() => null) : cols._rKeep.map(() => null);
      let pad = 0;
      if (n.op === 'semi') { out = { cols: copyCols(L.cols), rows: L.rows.filter((r, i) => lHit[i]) }; info.pass = lHit; }
      else {
        if (n.op === 'ljoin' || n.op === 'fjoin') L.rows.forEach((a, i) => { if (!lHit[i]) { rows.push([...a, ...nullsR]); pad++; } });
        if (n.op === 'rjoin' || n.op === 'fjoin') R.rows.forEach((b, j) => {
          if (rHit[j]) return; pad++;
          if (n.cond) rows.push([...L.cols.map(() => null), ...b]);
          else { const a = L.cols.map(() => null); shared.forEach(([i, jj]) => { a[i] = b[jj]; }); rows.push([...a, ...cols._rKeep.map(k => b[k])]); }
        });
        delete cols._rKeep;
        out = { cols, rows: dedupe(rows) };
      }
      const cnd = n.cond ? `<code>${esc(pretty(n.param))}</code>` : shared.length ? `equal values of the shared attribute${shared.length > 1 ? 's' : ''} <code>${shared.map(([i]) => L.cols[i].name).join(', ')}</code>` : null;
      const sym = { theta: '⋈<sub>θ</sub>', join: '⋈', ljoin: '⟕', rjoin: '⟖', fjoin: '⟗', semi: '⋉' }[n.op];
      if (!n.cond && !shared.length) info.txt = `<b>⋈</b>: the two inputs share no attribute names, so the natural join is just the Cartesian product: <b>${out.rows.length}</b> rows.`;
      else if (n.op === 'semi') info.txt = `<b>⋉</b> keeps each left row that has at least one partner on the right (${cnd}): <b>${out.rows.length}</b> of ${L.rows.length} rows. Only the left attributes are kept.`;
      else info.txt = `<b>${sym}</b> looks at all ${L.rows.length} × ${R.rows.length} = ${L.rows.length * R.rows.length} pairs and keeps the pairs with ${cnd}: <b>${out.rows.length - pad}</b> matching row${out.rows.length - pad === 1 ? '' : 's'}${n.cond ? '' : ', each shared attribute kept once'}.` +
        (pad || /ljoin|rjoin|fjoin/.test(n.op) ? ` Then ${pad} unmatched (dangling) row${pad === 1 ? '' : 's'} ${pad === 1 ? 'is' : 'are'} added, padded with NULL.` : '');
      break;
    }
    case 'union': case 'inter': case 'minus': {
      if (L.cols.length !== R.cols.length) throw err(`${n.op === 'union' ? '∪' : n.op === 'inter' ? '∩' : '−'} needs union-compatible inputs, but the left has ${L.cols.length} attribute(s) (${names(L.cols)}) and the right has ${R.cols.length} (${names(R.cols)}). Project both sides onto the same attributes first.`);
      const rk = new Set(R.rows.map(key)), lk = new Set(L.rows.map(key));
      const differ = L.cols.some((c, i) => lc(c.name) !== lc(R.cols[i].name));
      const note = differ ? ` (The attribute names differ, (${names(L.cols)}) vs (${names(R.cols)}); the result uses the left names, as SQL does. Strict RA would rename first.)` : '';
      if (n.op === 'union') {
        const rows = dedupe([...L.rows, ...R.rows]); out = { cols: copyCols(L.cols), rows };
        info.dupR = R.rows.map(r => lk.has(key(r)));
        const d = info.dupR.filter(Boolean).length;
        info.txt = `<b>∪</b> collects the rows that are in either input: ${L.rows.length} + ${R.rows.length}${d ? ` − ${d} row${d > 1 ? 's' : ''} that appear in both` : ''} = <b>${rows.length}</b> rows.` + note;
      } else if (n.op === 'inter') {
        info.pass = L.rows.map(r => rk.has(key(r)));
        out = { cols: copyCols(L.cols), rows: L.rows.filter((r, i) => info.pass[i]) };
        info.txt = `<b>∩</b> keeps the rows that appear in <i>both</i> inputs: <b>${out.rows.length}</b> rows (highlighted on the left).` + note;
      } else {
        info.gone = L.rows.map(r => rk.has(key(r)));
        out = { cols: copyCols(L.cols), rows: L.rows.filter((r, i) => !info.gone[i]) };
        const g = info.gone.filter(Boolean).length;
        info.txt = `<b>−</b> keeps the rows of the left input that are <i>not</i> in the right input: ${g} row${g === 1 ? ' is' : 's are'} removed (struck through), <b>${out.rows.length}</b> remain.` + note;
      }
      break;
    }
    case 'div': {
      const bI = R.cols.map(c => colIndex(L.cols, null, c.name));
      const aI = L.cols.map((c, i) => i).filter(i => !bI.includes(i));
      if (!aI.length) throw err('÷: the divisor must have fewer attributes than the dividend');
      const have = new Set(L.rows.map(r => key([...aI.map(i => r[i]), ...bI.map(i => r[i])])));
      const cands = dedupe(L.rows.map(r => aI.map(i => r[i])));
      const miss = cands.map(a => R.rows.filter(s => !have.has(key([...a, ...s]))));
      out = { cols: aI.map(i => copyCols([L.cols[i]])[0]), rows: cands.filter((a, k) => !miss[k].length) };
      info.cands = cands; info.miss = miss;
      info.txt = `<b>÷</b> keeps a value of <code>${aI.map(i => L.cols[i].name).join(', ')}</code> only if the dividend pairs it with <i>every</i> one of the ${R.rows.length} row${R.rows.length === 1 ? '' : 's'} of the divisor. ` +
        cands.map((a, k) => `${a.join(', ')}: ${miss[k].length ? `<span class="bad">missing ${miss[k].map(s => s.join(', ')).join('; ')}</span>` : '<span class="good">has them all</span>'}`).join(' · ') + `. Result: <b>${out.rows.length}</b> row${out.rows.length === 1 ? '' : 's'}.`;
      break;
    }
    default: throw err('unknown operator ' + n.op);
  }
  n.res = out;
  steps.push({ n, ins, out, info });
  return out;
}
// Run a whole program; returns {result, steps: [{stmt, n, ins, out, info}], stmts}
function raRun(db, src) {
  const env = {};
  for (const r of Object.values(db)) env[r.name] = { cols: r.cols.map(c => ({ name: c, quals: new Set([r.name]) })), rows: r.rows };
  const stmts = raParse(src), steps = [];
  let result = null;
  stmts.forEach((s, k) => {
    const st = [];
    result = evalNode(s.e, env, st);
    if (s.target) {
      const cols = copyCols(result.cols);
      if (s.attrs) { if (s.attrs.length !== cols.length) throw err(`${s.target}(${s.attrs.join(', ')}) names ${s.attrs.length} attributes but the expression gives ${cols.length}`); cols.forEach((c, i) => { c.name = s.attrs[i]; }); }
      cols.forEach(c => { c.quals = new Set([s.target]); });
      result = env[s.target] = { cols, rows: result.rows, sorted: result.sorted };
    }
    st.forEach(x => { x.stmt = k; });
    steps.push(...st);
  });
  return { result, steps, stmts };
}
// Set comparison of two results (column order matched by name when possible).
function raSame(a, b) {
  if (a.cols.length !== b.cols.length) return false;
  let perm = a.cols.map((c, i) => i);
  const an = a.cols.map(c => lc(c.name)), bn = b.cols.map(c => lc(c.name));
  if ([...an].sort().join() === [...bn].sort().join() && new Set(an).size === an.length) perm = an.map(n => bn.indexOf(n));
  const norm = v => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v;
  const A = new Set(a.rows.map(r => key(r.map(norm)))), B = new Set(b.rows.map(r => key(perm.map(i => norm(r[i])))));
  return A.size === B.size && [...A].every(x => B.has(x));
}

// ---------- pretty printing ----------
function pretty(s) {
  return String(s ?? '').replace(/>=/g, '≥').replace(/<=/g, '≤').replace(/<>|!=/g, '≠').replace(/->/g, '→')
    .replace(/\band\b/gi, '∧').replace(/\bor\b/gi, '∨').replace(/\bnot\b/gi, '¬');
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const fmt = v => v == null ? '<span class="sq-null">NULL</span>' : typeof v === 'number' ? String(Math.round(v * 1e4) / 1e4) : esc(v);
const SYMS = { select: 'σ', project: 'π', rename: 'ρ', group: 'γ', sort: 'τ', distinct: 'δ', cross: '×', join: '⋈', theta: '⋈', ljoin: '⟕', rjoin: '⟖', fjoin: '⟗', semi: '⋉', union: '∪', inter: '∩', minus: '−', div: '÷' };
function label(n) {
  if (n.op === 'rel') return { sym: n.name, sub: '' };
  const oj = { ljoin: 'left outer', rjoin: 'right outer', fjoin: 'full outer' }[n.op];
  if (oj) return { sym: SYMS[n.op], sub: (n.param == null ? '' : pretty(n.param) + ' ') + `(${oj})` };
  return { sym: SYMS[n.op], sub: n.param == null ? '' : n.op === 'group' ? pretty(n.param).replace(';', ' ;') : pretty(n.param) };
}
// One-line Unicode form of an expression (used in captions and answers).
function raText(n) {
  if (n.op === 'rel') return n.name;
  const l = label(n), sub = l.sub ? `<sub>${esc(l.sub)}</sub>` : '';
  if (n.kids.length === 1) return `${l.sym}${sub}(${raText(n.kids[0])})`;
  const side = k => k.kids.length === 2 ? `(${raText(k)})` : raText(k);
  return `${side(n.kids[0])} ${l.sym}${sub} ${side(n.kids[1])}`;
}

// ---------- relation tables ----------
// o: {title, mark: (rowIndex) => 'hl'|'del'|'dim'|'', max}
function relHTML(rel, o = {}) {
  const max = o.max || 40, rows = rel.rows.slice(0, max);
  return `<div class="ra-rel">${o.title ? `<div class="ra-rt">${o.title}</div>` : ''}<table class="ra-t"><tr>${rel.cols.map(c => `<th>${esc(colName(rel.cols, c))}</th>`).join('') || '<th>(no attributes)</th>'}</tr>` +
    (rows.length ? rows.map((r, i) => `<tr class="${o.mark ? o.mark(i) || '' : ''}">${r.map(v => `<td>${fmt(v)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${Math.max(1, rel.cols.length)}" class="ra-empty">(empty: no rows)</td></tr>`) +
    `</table><div class="ra-n">${rel.rows.length} row${rel.rows.length === 1 ? '' : 's'}${rel.rows.length > max ? `, first ${max} shown` : ''}${rel.sorted ? ', sorted' : ''}</div></div>`;
}
function dbHTML(db, only) {
  return `<div class="ra-io ra-db">${Object.values(db).filter(r => !only || only.includes(r.name)).map(r =>
    relHTML({ cols: r.cols.map(c => ({ name: c, quals: new Set() })), rows: r.rows }, { title: r.name })).join('')}</div>`;
}

// ---------- query tree SVG ----------
const TW = s => [...s].length;
function treeSVG(root, o = {}) {
  const LV = 62, NH = 30, GAP = 18, state = o.state || new Map();
  const lab = n => { const l = label(n); let sub = l.sub; const full = sub; if (TW(sub) > 34) sub = [...sub].slice(0, 32).join('') + '…'; return { ...l, sub, full }; };
  const measure = n => {
    const l = n._l = lab(n);
    n._lw = Math.max(36, TW(l.sym) * (n.op === 'rel' ? 8.2 : 11) + TW(l.sub) * 6.9 + 18);
    n.kids.forEach(measure);
    const kw = n.kids.reduce((s, k) => s + k._w, 0) + GAP * Math.max(0, n.kids.length - 1);
    n._w = Math.max(n._lw, kw); n._kw = kw;
  };
  let depth = 0;
  const place = (n, x0, d) => {
    n._y = 14 + d * LV + (o.top ? 22 : 0); depth = Math.max(depth, d);
    if (!n.kids.length) { n._x = x0 + n._w / 2; return; }
    let x = x0 + (n._w - n._kw) / 2;
    n.kids.forEach(k => { place(k, x, d + 1); x += k._w + GAP; });
    n._x = (n.kids[0]._x + n.kids[n.kids.length - 1]._x) / 2;
  };
  measure(root); place(root, 10, 0);
  let edges = '', nodes = '';
  const walk = n => {
    n.kids.forEach(k => { edges += `<line x1="${n._x}" y1="${n._y + NH}" x2="${k._x}" y2="${k._y}" class="s-fg"/>`; walk(k); });
    const st = state.get(n), cls = st === 'cur' ? 'cell-hl' : st === 'done' ? 'cell-new' : n.op === 'rel' ? 'cell-plain' : 'cell';
    const l = n._l;
    nodes += `<g${st === 'cur' ? ' class="ra-cur"' : ''}><title>${esc(l.sym + (l.full ? ' ' + l.full : ''))}</title><rect class="${cls}" x="${n._x - n._lw / 2}" y="${n._y}" width="${n._lw}" height="${NH}" rx="${n.op === 'rel' ? 3 : 14}"${st === 'cur' ? ' style="stroke:var(--red);stroke-width:2.5"' : ''}/>` +
      `<text x="${n._x}" y="${n._y + 20}" text-anchor="middle"><tspan style="font-size:${n.op === 'rel' ? 13 : 16}px;font-weight:600">${esc(l.sym)}</tspan>${l.sub ? `<tspan dy="4" style="font-size:11.5px">${esc(l.sub)}</tspan>` : ''}</text></g>`;
  };
  walk(root);
  const W = root._w + 20, H = 14 + (depth + 1) * LV - LV + NH + 12 + (o.top ? 22 : 0);
  const top = o.top ? `<text x="10" y="16" class="lbl" style="font-size:12px;font-weight:600;fill:var(--accent)">${esc(o.top)}</text>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="expression tree">${top}${edges}${nodes}</svg>`;
}

// ---------- step-through frames ----------
function buildSteps(db, src, o = {}) {
  const run = raRun(db, src), frames = [];
  const multi = run.stmts.length > 1;
  const stmtTitle = k => { const s = run.stmts[k]; return s.target ? `${s.target}${s.attrs ? '(' + s.attrs.join(', ') + ')' : ''} := …` : multi ? 'Answer = …' : ''; };
  const leaves = (n, acc = new Set()) => { if (n.op === 'rel') acc.add(n.name); n.kids.forEach(k => leaves(k, acc)); return acc; };
  run.stmts.forEach((s, k) => {
    const st = run.steps.filter(x => x.stmt === k), state = new Map();
    const used = [...leaves(s.e)];
    frames.push({
      html: `<div class="ra-frame"><div class="ra-tree">${treeSVG(s.e, { state, top: stmtTitle(k) })}</div>` +
        `<div class="ra-io">${used.map(nm => { const rel = relOf(run, db, nm, k); return rel ? relHTML(rel, { title: nm, max: o.max }) : ''; }).join('')}</div></div>`,
      cap: (multi ? `<b>Statement ${k + 1} of ${run.stmts.length}${s.target ? ` (${s.target})` : ''}.</b> ` : '') +
        (st.length ? `The expression drawn as a tree, with the input relation${used.length > 1 ? 's' : ''} below. Evaluation is <b>bottom-up</b>: an operator runs once all its children have produced their results.` : `${s.target ? s.target : 'The answer'} is just the relation ${used[0]}.`),
    });
    st.forEach((x, i) => {
      x.n && state.set(x.n, 'cur');
      const mk = x.info;
      const inTbl = (rel, j) => {
        let mark = null;
        if (mk.pass && j === 0) mark = r => mk.pass[r] ? 'hl' : 'dim';
        if (mk.gone && j === 0) mark = r => mk.gone[r] ? 'del' : '';
        if (mk.dupR && j === 1) mark = r => mk.dupR[r] ? 'dim' : '';
        return relHTML(rel, { title: x.n.kids[j].op === 'rel' ? x.n.kids[j].name : `input ${x.ins.length > 1 ? (j ? 'right' : 'left') : ''}`.trim(), mark, max: o.max });
      };
      const last = i === st.length - 1;
      frames.push({
        html: `<div class="ra-frame"><div class="ra-tree">${treeSVG(s.e, { state: new Map(state), top: stmtTitle(k) })}</div>` +
          `<div class="ra-io">${x.ins.map(inTbl).join('')}<div class="ra-arrow">→</div>${relHTML(x.out, { title: last ? (s.target ? `<b>${s.target}</b>` : '<b>result</b>') : 'output', max: o.max })}</div></div>`,
        cap: (multi ? `<b>Statement ${k + 1}.</b> ` : '') + mk.txt + (last && !s.target ? ' This is the <b>final result</b>.' : last ? ` This relation is saved as <b>${s.target}</b>.` : ''),
      });
      state.set(x.n, 'done');
    });
  });
  return { frames, run };
}
function relOf(run, db, nm, k) {
  // the relation as it was when statement k started (base relations, or a temp made by an earlier statement)
  if (db[nm]) return { cols: db[nm].cols.map(c => ({ name: c, quals: new Set() })), rows: db[nm].rows };
  for (let j = k - 1; j >= 0; j--) if (run.stmts[j].target && lc(run.stmts[j].target) === lc(nm)) return run.stmts[j].e.res && { cols: run.stmts[j].e.res.cols, rows: run.stmts[j].e.res.rows };
  return null;
}

// ---------- browser components ----------
const REG = G.RA_REG = [];
let uid = 0;
const HELP = `<div class="ra-help"><p><b>Syntax</b> (ASCII or the Greek symbols both work):</p>
<table class="ra-t"><tr><th>Write</th><th>Means</th></tr>
<tr><td><code>select[salary &gt; 70000](instructor)</code></td><td>σ<sub>salary&gt;70000</sub>(instructor)</td></tr>
<tr><td><code>project[name, dept_name](R)</code></td><td>π<sub>name,dept_name</sub>(R); items may be expressions: <code>salary*1.1 -&gt; raised</code></td></tr>
<tr><td><code>rename[S](R)</code> · <code>rename[S(a,b,c)](R)</code> · <code>rename[gpa -&gt; grade](R)</code></td><td>ρ</td></tr>
<tr><td><code>R x S</code> · <code>R join S</code> · <code>R join[R.a = S.b] S</code></td><td>× · natural ⋈ · θ-join</td></tr>
<tr><td><code>R ljoin S</code> · <code>rjoin</code> · <code>fjoin</code> · <code>semijoin</code></td><td>⟕ ⟖ ⟗ ⋉ (add <code>[cond]</code> for a θ version)</td></tr>
<tr><td><code>R union S</code> · <code>R intersect S</code> · <code>R - S</code> · <code>R / S</code></td><td>∪ ∩ − ÷</td></tr>
<tr><td><code>group[dept; avg(salary) -&gt; avg_sal](R)</code></td><td>γ<sub>dept, AVG(salary)→avg_sal</sub>(R); also count(*), count(distinct x), sum, min, max</td></tr>
<tr><td><code>sort[name desc](R)</code></td><td>τ</td></tr>
<tr><td><code>T := expr</code> on its own line, or <code>T(a, b) := expr</code></td><td>assignment; later lines can use T</td></tr>
</table>
<p>Conditions use <code>= &lt;&gt; &lt; &lt;= &gt; &gt;=</code>, <code>and or not</code>, <code>+ - * /</code>, <code>'text'</code>, <code>like '%x'</code>, and <code>R.a</code> to say which relation an attribute comes from. Precedence: unary operators, then × ⋈ ÷, then ∩, then ∪ −. Use parentheses when unsure. <code>-- text</code> is a comment.</p></div>`;

function showError(box, e, src) {
  let where = '';
  if (e.at != null && src) { const line = src.slice(0, e.at).split('\n').length; where = ` (line ${line})`; }
  box.innerHTML = `<p class="sq-msg err"><b>Cannot evaluate${where}:</b> ${esc(e.message)}</p>`;
}
// Read-only animation of a fixed expression.
function raSteps(sel, db, src, o = {}) {
  REG.push({ db, ra: src, sql: o.sql, where: sel });
  const host = typeof sel === 'string' ? document.querySelector(sel) : sel;
  try { stepper(host, buildSteps(db, src, o).frames, { interval: o.interval || 2600 }); }
  catch (e) { showError(host, e, src); }
}
// The interactive evaluator: editor, presets, tree + steps, and the matching SQL in a playground.
function raLab(sel, o) {
  const host = document.querySelector(sel), id = 'ral' + (++uid);
  (o.presets || []).forEach(p => REG.push({ db: o.db, ra: p.ra, sql: p.sql, where: sel + ' preset ' + p.label }));
  host.classList.add('ra-lab');
  host.innerHTML = `<div class="sq-bar"><span class="sq-tag ra-tag">RA evaluator</span><span class="sq-tip">write relational algebra · Ctrl+Enter evaluates</span></div>
    ${o.presets ? `<label class="ra-pre">Example: <select>${o.presets.map((p, i) => `<option value="${i}">${esc(p.label)}</option>`).join('')}<option value="-1">(my own expression)</option></select></label>` : ''}
    <textarea class="sq-ed ra-ed" spellcheck="false" aria-label="Relational algebra expression"></textarea>
    <div class="sq-btns"><button type="button" data-run>Evaluate ▶</button><button type="button" data-rel>Show relations</button><button type="button" data-help>Syntax</button></div>
    <div class="ra-msg" aria-live="polite"></div><div class="ra-out"></div><div id="${id}-sql" class="ra-sql"></div>`;
  const ed = host.querySelector('textarea'), out = host.querySelector('.ra-out'), msg = host.querySelector('.ra-msg'), pick = host.querySelector('select');
  const run = () => {
    msg.innerHTML = ''; out.innerHTML = '';
    try { const { frames, run: r } = buildSteps(o.db, ed.value, o); const d = document.createElement('div'); out.append(d); stepper(d, frames, { interval: 2400 });
      msg.innerHTML = `<p class="sq-msg ok">Parsed as: ${r.stmts.map(s => (s.target ? esc(s.target) + ' := ' : '') + raText(s.e)).join('<br>')}</p>`; }
    catch (e) { showError(msg, e, ed.value); }
  };
  const sql = p => {
    const box = host.querySelector('.ra-sql');
    if (p && p.sql && typeof sqlPlay === 'function') { box.innerHTML = ''; box.insertAdjacentHTML('beforebegin', ''); sqlPlay('#' + id + '-sql', { setup: raSetup(o.db), query: p.sql, note: 'The same query in Oracle SQL, run on the same data. Compare its rows with the RA result above.' }); }
    else box.innerHTML = p ? '' : '<p class="sq-note">Your own expression: write the matching SQL yourself in any SQL box on this page to compare.</p>';
  };
  const load = i => { const p = o.presets[i]; ed.value = p.ra; run(); sql(p); };
  pick?.addEventListener('change', () => { const i = +pick.value; if (i >= 0) load(i); else { ed.value = ''; out.innerHTML = ''; msg.innerHTML = ''; sql(null); ed.focus(); } });
  host.querySelector('[data-run]').onclick = run;
  host.querySelector('[data-rel]').onclick = () => { msg.innerHTML = ''; out.innerHTML = dbHTML(o.db); };
  host.querySelector('[data-help]').onclick = () => { out.innerHTML = HELP; };
  ed.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } });
  if (o.presets && o.presets.length) load(0); else { ed.value = o.ra || ''; if (o.ra) run(); }
}
// Auto-checked RA exercise: the student's expression must give the same relation as the solution.
function raCheck(sel, o) {
  REG.push({ db: o.db, ra: o.solution, sql: o.sql, where: sel });
  const host = document.querySelector(sel);
  host.classList.add('sqlplay', 'sqlcheck', 'ra-check');
  host.innerHTML = `<div class="sq-bar"><span class="sq-tag ra-tag">RA exercise · auto-checked</span></div><div class="sq-task">${o.task}</div>
    <textarea class="sq-ed ra-ed" spellcheck="false" aria-label="Your relational algebra" placeholder="e.g. project[name](select[salary > 70000](instructor))"></textarea>
    <div class="sq-btns"><button type="button" data-chk>Check ✓</button>${o.hint ? '<button type="button" data-hint>Hint</button>' : ''}<button type="button" data-ans>Show answer</button><button type="button" data-rel>Show relations</button><button type="button" data-help>Syntax</button></div>
    <div class="sq-out" aria-live="polite"></div>`;
  const ed = host.querySelector('textarea'), out = host.querySelector('.sq-out');
  const sol = () => raRun(o.db, o.solution).result;
  host.querySelector('[data-chk]').onclick = () => {
    if (!ed.value.trim()) return;
    try {
      const got = raRun(o.db, ed.value).result, want = sol(), ok = raSame(want, got);
      out.innerHTML = (ok ? `<p class="sq-msg ok"><b>Correct.</b> Your expression gives the expected relation (${got.rows.length} rows).</p>`
        : `<p class="sq-msg err"><b>Not yet.</b> Expected ${want.rows.length} row(s) with ${want.cols.length} attribute(s); yours gave ${got.rows.length} row(s) with ${got.cols.length}.</p>`) + relHTML(got, { title: 'your result' });
    } catch (e) { showError(out, e, ed.value); }
  };
  host.querySelector('[data-ans]').onclick = () => {
    try { const r = raRun(o.db, o.solution); out.innerHTML = `<pre class="sq-sol">${esc(o.solution)}</pre><p class="ra-uni">${r.stmts.map(s => (s.target ? esc(s.target) + ' := ' : '') + raText(s.e)).join('<br>')}</p>${relHTML(r.result, { title: 'expected result' })}${o.why ? `<p>${o.why}</p>` : ''}`; }
    catch (e) { showError(out, e, o.solution); }
  };
  host.querySelector('[data-hint]')?.addEventListener('click', () => { out.innerHTML = `<p class="sq-msg"><b>Hint:</b> ${o.hint}</p>`; });
  host.querySelector('[data-rel]').onclick = () => { out.innerHTML = dbHTML(o.db, o.only); };
  host.querySelector('[data-help]').onclick = () => { out.innerHTML = HELP; };
  ed.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); host.querySelector('[data-chk]').click(); } });
}
// Static figures
function raTree(sel, src) { const r = raParse(src); document.querySelector(sel).innerHTML = r.map(s => treeSVG(s.e, { top: s.target ? s.target + ' :=' : '' })).join(''); }
function raShow(sel, db, only) { document.querySelector(sel).innerHTML = dbHTML(db, only); }
function raResult(sel, db, src, title) { const r = raRun(db, src); REG.push({ db, ra: src, where: sel }); document.querySelector(sel).innerHTML = relHTML(r.result, { title: title || 'result' }); }

// ?ratest=1: evaluate every registered expression, compare with its SQL, and print a report into the page.
async function selfTest() {
  const lines = [];
  for (const t of REG) {
    let r;
    try { r = raRun(t.db, t.ra).result; } catch (e) { lines.push(`FAIL-RA ${t.where}: ${e.message}`); continue; }
    if (!t.sql) { lines.push(`ok-ra ${t.where}: ${r.rows.length} rows`); continue; }
    try {
      const db = await newDB(raSetup(t.db)), res = db.exec(sqlCompat(t.sql)).at(-1) || { columns: [], values: [] };
      if (!res.values.length && !r.rows.length) { lines.push(`ok-sql ${t.where}: both empty`); continue; }
      const got = { cols: res.columns.map(c => ({ name: c, quals: new Set() })), rows: res.values };
      lines.push(`${raSame(r, got) || raSame({ ...r, cols: r.cols.map((c, i) => ({ name: 'c' + i })) }, { ...got, cols: got.cols.map((c, i) => ({ name: 'c' + i })) }) ? 'ok-sql' : 'FAIL-SQL'} ${t.where}: RA ${r.rows.length} rows, SQL ${got.rows.length} rows`);
    } catch (e) { lines.push(`FAIL-SQLERR ${t.where}: ${e.message}`); }
  }
  for (const { sel, spec } of SQLREG) {
    try {
      const db = await newDB(spec.setup), res = db.exec(sqlCompat(spec.solution));
      const r = spec.check === 'state' ? db.exec(`SELECT * FROM ${spec.table}`).at(-1) : res.at(-1);
      lines.push(`ok-sqlcheck ${sel}: ${r ? r.values.length : 0} rows${r ? ' ' + JSON.stringify(r.values).slice(0, 160) : ''}`);
    } catch (e) { lines.push(`${spec.play ? 'PLAY-ERR' : 'FAIL-SQLCHECK'} ${sel}: ${e.message}`); }
  }
  const pre = document.createElement('pre'); pre.id = 'ratest'; pre.textContent = lines.join('\n'); document.body.append(pre);
}
const SQLREG = [];
if (typeof document !== 'undefined' && /ratest/.test(location.search)) {
  if (typeof G.sqlPlay === 'function') { const orig = G.sqlPlay; G.sqlPlay = (sel, spec) => { SQLREG.push({ sel, spec: { setup: spec.setup, solution: spec.query, play: true } }); return orig(sel, spec); }; }
  if (typeof G.sqlCheck === 'function') { const orig = G.sqlCheck; G.sqlCheck = (sel, spec) => { SQLREG.push({ sel, spec }); return orig(sel, spec); }; }
  addEventListener('load', () => setTimeout(selfTest, 300));
}

// A condition over named values, e.g. raCondFn('new.price < 0', ['new.price', 'old.price']) → row => true/false/null
function raCondFn(src, colNames) {
  const cols = colNames.map(n => { const i = n.indexOf('.'); return { name: i < 0 ? n : n.slice(i + 1), quals: new Set(i < 0 ? [] : [n.slice(0, i)]) }; });
  return compile(parseExpr(src).cond(), cols);
}
Object.assign(G, { raCondFn, raDB, raSetup, raParse, raRun, raSame, raText, relHTML, dbHTML, treeSVG, buildSteps, raSteps, raLab, raCheck, raTree, raShow, raResult, raPretty: pretty, raLabel: label });
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis;

// ---------- the sample databases ----------
// Slides 6–20: Students, People, Employee (slide data, with the slide's typos fixed)
const DB_SLIDES = raDB(`
Students(sid, sname, gpa)
001 | John | 3.4
002 | Bob | 1.3
003 | Rina | 3.8
004 | Tanvir | 3.6

People(ssn, pname, address)
1234545 | John | 216 Rosse
5423341 | Bob | 217 Rosse
`);
const DB_EMP = raDB(`
Employee(SSN, Name, Salary)
1234545 | John | 200000
5423341 | Smith | 600000
4352342 | Fred | 500000
`);
// Exam DB QB 121 / 137: Instructor and Teaches
const DB_IT = raDB(`
Instructor(id, name, dept_name, salary)
1 | Alice | CSE | 950000
2 | Bob | Physics | 2300000
3 | Carol | CSE | 720000
4 | David | Math | 2200000
5 | Eve | CSE | 2500000

Teaches(id, course_id, semester, year)
1 | CS101 | Fall | 2023
1 | CS102 | Spring | 2024
2 | PH201 | Fall | 2023
3 | CS101 | Fall | 2023
5 | CS201 | Fall | 2023
`);
// The textbook's products database (GMUW Figs. 2.20–2.21). Printer.color uses 'T'/'F' as on slide 46.
const DB_PPLP = raDB(`
Product(maker, model, type)
A | 1001 | pc
A | 1002 | pc
A | 1003 | pc
A | 2004 | laptop
A | 2005 | laptop
A | 2006 | laptop
B | 1004 | pc
B | 1005 | pc
B | 1006 | pc
B | 2007 | laptop
C | 1007 | pc
D | 1008 | pc
D | 1009 | pc
D | 1010 | pc
D | 3004 | printer
D | 3005 | printer
E | 1011 | pc
E | 1012 | pc
E | 1013 | pc
E | 2001 | laptop
E | 2002 | laptop
E | 2003 | laptop
E | 3001 | printer
E | 3002 | printer
E | 3003 | printer
F | 2008 | laptop
F | 2009 | laptop
G | 2010 | laptop
H | 3006 | printer
H | 3007 | printer

PC(model, speed, ram, hd, price)
1001 | 2.66 | 1024 | 250 | 2114
1002 | 2.10 | 512 | 250 | 995
1003 | 1.42 | 512 | 80 | 478
1004 | 2.80 | 1024 | 250 | 649
1005 | 3.20 | 512 | 250 | 630
1006 | 3.20 | 1024 | 320 | 1049
1007 | 2.20 | 1024 | 200 | 510
1008 | 2.20 | 2048 | 250 | 770
1009 | 2.00 | 1024 | 250 | 650
1010 | 2.80 | 2048 | 300 | 770
1011 | 1.86 | 2048 | 160 | 959
1012 | 2.80 | 1024 | 160 | 649
1013 | 3.06 | 512 | 80 | 529

Laptop(model, speed, ram, hd, screen, price)
2001 | 2.00 | 2048 | 240 | 20.1 | 3673
2002 | 1.73 | 1024 | 80 | 17.0 | 949
2003 | 1.80 | 512 | 60 | 15.4 | 549
2004 | 2.00 | 512 | 60 | 13.3 | 1150
2005 | 2.16 | 1024 | 120 | 17.0 | 2500
2006 | 2.00 | 2048 | 80 | 15.4 | 1700
2007 | 1.83 | 1024 | 120 | 13.3 | 1429
2008 | 1.60 | 1024 | 100 | 15.4 | 900
2009 | 1.60 | 512 | 80 | 14.1 | 680
2010 | 2.00 | 2048 | 160 | 15.4 | 2300

Printer(model, color, type, price)
3001 | T | ink-jet | 99
3002 | F | laser | 239
3003 | T | laser | 899
3004 | T | ink-jet | 120
3005 | F | laser | 120
3006 | T | ink-jet | 100
3007 | T | laser | 200
`);
// Abstract R, S, T for the optimization slides
const DB_RST = raDB(`
R(A, B)
5 | 1
12 | 2
7 | 3
3 | 1

S(B, C)
1 | x
2 | y
3 | x
4 | z

T(C, D)
x | 10
y | 20
z | 30
`);
// Suppliers–Parts–Catalog (exam questions; invented data)
const DB_SPC = raDB(`
Suppliers(sid, sname, address)
1 | Acme | 221 Packer Street
2 | Big Parts | 15 Dhanmondi Road
3 | Chittagong Metal | 9 Agrabad Ave
4 | Delta Supply | 221 Packer Street
5 | Elite Tools | 7 Gulshan Ave
6 | Fahim Traders | 12 Banani Rd

Parts(pid, pname, color)
10 | bolt | red
11 | nut | green
12 | screw | red
13 | washer | blue
14 | gear | green

Catalog(sid, pid, cost)
1 | 10 | 120
1 | 11 | 80
1 | 12 | 150
1 | 13 | 40
1 | 14 | 300
2 | 10 | 90
2 | 13 | 50
3 | 11 | 200
3 | 14 | 210
4 | 13 | 60
5 | 12 | 130
5 | 11 | 140
`);
// University schema (DB QB 132; invented data, Silberschatz style)
const DB_UNI = raDB(`
department(dept_name, building, budget)
Physics | Watson | 70000
Biology | Watson | 90000
Comp. Sci. | Taylor | 100000
History | Painter | 50000

instructor(ID, name, dept_name, salary)
10101 | Srinivasan | Comp. Sci. | 65000
22222 | Einstein | Physics | 95000
33456 | Gold | Physics | 87000
45565 | Katz | Comp. Sci. | 75000
76766 | Crick | Biology | 72000
83821 | Brandt | Comp. Sci. | 98000
32343 | El Said | History | 60000

section(course_id, sec_id, semester, year, building, room_number)
CS-101 | 1 | Fall | 2022 | Packard | 101
CS-101 | 1 | Spring | 2022 | Packard | 101
CS-190 | 2 | Spring | 2022 | Taylor | 3128
CS-315 | 1 | Fall | 2022 | Watson | 120
PHY-101 | 1 | Fall | 2022 | Watson | 100
BIO-101 | 1 | Summer | 2021 | Painter | 514

student(ID, name, dept_name, tot_cred)
00128 | Zhang | Comp. Sci. | 102
'12345' | Shankar | Comp. Sci. | 32
'19991' | Brandt | History | 80
'44553' | Peltier | Physics | 56
'98765' | Bourikas | Comp. Sci. | 98

takes(ID, course_id, sec_id, semester, year, grade)
00128 | CS-101 | 1 | Fall | 2022 | A
'12345' | CS-190 | 2 | Spring | 2022 | B
'19991' | BIO-101 | 1 | Summer | 2021 | A
'98765' | CS-315 | 1 | Fall | 2022 | C
'44553' | BIO-101 | 1 | Summer | 2021 | B
`);
if (typeof module !== 'undefined') Object.assign(module.exports, { DB_SLIDES, DB_EMP, DB_IT, DB_PPLP, DB_RST, DB_SPC, DB_UNI });
