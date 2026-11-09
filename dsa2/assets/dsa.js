// CSE 207 page widgets. Load after book.js and algo.js.
//   treeFig(sel, '23B(8R(6B,15B(13R,19R)),27B(,29R))')    static tree figure
//   graphFig(sel, 'A-B 4, A>C 2', {layer:true})           static graph figure
//   forestFig(sel, '7(30) 24(26(35) 46) min=7')           static heap forest
//   trace(sel, {kind, input, s, t, opts, edit})           step-through of any algorithm on any input
//   practice(sel, {id, kind, n})                          mandatory: random instance, typed answer auto-marked, n correct needed
//   recall(sel, {id, q, marks, points, model})            mandatory: write on paper, reveal, tick every key point
const KX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/'; let kxReady = null;
function loadKatex() { if (kxReady) return kxReady; const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = KX + 'katex.min.css'; document.head.append(css); const js = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); }); return kxReady = js(KX + 'katex.min.js').then(() => js(KX + 'contrib/auto-render.min.js')); }
function tex(el = document.body) { loadKatex().then(() => renderMathInElement(el, { delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }], throwOnError: false })).catch(() => {}); }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const R = 16, GAPX = 42, GAPY = 58;

// ---------- drawing ----------
function drawTree(t, hl = []) { // binary; x from in-order position
  if (!t) return '<p class="tracer-hint">(empty tree)</p>';
  let x = 0; const nodes = [], edges = [];
  (function walk(n, d) { if (n.l) walk(n.l, d + 1); n._x = x++; n._y = d; if (n.r) walk(n.r, d + 1); })(t, 0);
  (function coll(n) { nodes.push(n); for (const c of [n.l, n.r]) if (c) { edges.push([n, c]); coll(c); } })(t);
  const px = n => 26 + n._x * GAPX, py = n => 26 + n._y * GAPY, W = 52 + (x - 1) * GAPX, H = 54 + Math.max(...nodes.map(n => n._y)) * GAPY;
  let s = `<svg class="dsa-fig" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="tree">`;
  for (const [a, b] of edges) s += `<line class="ed" x1="${px(a)}" y1="${py(a)}" x2="${px(b)}" y2="${py(b)}"/>`;
  for (const n of nodes) {
    const X = px(n), Y = py(n);
    if (n.nil) { s += `<rect class="nd B" x="${X - 15}" y="${Y - 10}" width="30" height="20"/><rect class="db" x="${X - 19}" y="${Y - 14}" width="38" height="28"/><text class="tx w" x="${X}" y="${Y}" style="font-size:10px">NIL</text>`; continue; }
    s += `<circle class="nd ${n.c || ''}" cx="${X}" cy="${Y}" r="${R}"/>`;
    if (n.db) s += `<circle class="db" cx="${X}" cy="${Y}" r="${R + 4}"/>`;
    if (hl.includes(n.k)) s += `<circle class="hl" cx="${X}" cy="${Y}" r="${R + (n.db ? 7 : 3)}"/>`;
    s += `<text class="tx ${n.c ? 'w' : ''}" x="${X}" y="${Y}">${n.k}</text>`;
    if (n.bf !== undefined) s += `<text class="vl" x="${X + R + 7}" y="${Y - R + 2}">${n.bf > 0 ? '+' : ''}${String(n.bf).replace('-', '−')}</text>`;
  }
  return s + '</svg>';
}
function drawForest(fs, { hl = [], min = null, text = false } = {}) { // general trees, text:true for state-space boxes
  if (!fs || !fs.length) return '<p class="tracer-hint">(empty)</p>';
  const lbl = n => n.txt || [String(n.k)];
  const bw = n => text ? Math.max(58, Math.max(...lbl(n).map(l => l.length)) * 6.8 + 12) : R * 2;
  const bh = n => text ? 8 + 14 * lbl(n).length : R * 2;
  const GX = text ? 10 : 8, GY = text ? 42 : 30; let x = 8;
  const place = (n, d) => { n._d = d; if (!n.ch || !n.ch.length) { n._x = x + bw(n) / 2; x += bw(n) + GX; return; } n.ch.forEach(c => place(c, d + 1)); n._x = Math.max(x + 0, (n.ch[0]._x + n.ch[n.ch.length - 1]._x) / 2); if (n._x + bw(n) / 2 + GX > x) x = n._x + bw(n) / 2 + GX; };
  const maxH = {}; const scan = (n, d) => { maxH[d] = Math.max(maxH[d] || 0, bh(n)); (n.ch || []).forEach(c => scan(c, d + 1)); }; fs.forEach(r => scan(r, 0));
  const ys = [text ? 8 : (min !== null ? 26 : 8)]; for (let d = 1; maxH[d]; d++) ys[d] = ys[d - 1] + maxH[d - 1] + GY;
  fs.forEach((r, i) => { if (i) x += text ? 10 : 18; place(r, 0); });
  const W = x + 8, H = ys[ys.length - 1] + maxH[ys.length - 1] + 8; let e = '', b = '';
  const rootY = ys[0] + maxH[0] / 2;
  if (!text) for (let i = 0; i + 1 < fs.length; i++) e += `<line class="ed" stroke-dasharray="2 3" x1="${fs[i]._x}" y1="${rootY}" x2="${fs[i + 1]._x}" y2="${rootY}"/>`;
  const draw = n => {
    const X = n._x, Y = ys[n._d] + maxH[n._d] / 2;
    for (const c of n.ch || []) { const cy = ys[c._d] + maxH[c._d] / 2; e += `<line class="ed" x1="${X}" y1="${Y}" x2="${c._x}" y2="${cy}"/>`; if (c.edge) b += `<text class="sm" x="${(X + c._x) / 2 + (c._x < X ? -16 : 16)}" y="${(Y + cy) / 2}">${esc(c.edge)}</text>`; draw(c); }
    if (text) { const w = bw(n), h = bh(n); b += `<rect class="box ${n.st || ''}" x="${X - w / 2}" y="${Y - h / 2}" width="${w}" height="${h}" rx="4"/>`; lbl(n).forEach((l, i) => b += `<text class="tx" style="font-size:11px;font-weight:400" x="${X}" y="${Y - h / 2 + 11 + 14 * i}">${esc(l)}</text>`); }
    else { b += `<circle class="nd ${n.mark ? 'cur' : ''}" cx="${X}" cy="${Y}" r="${R}"/>`; if (n.mark) b += `<circle class="db" cx="${X}" cy="${Y}" r="${R - 3}"/>`; if (hl.includes(n.k)) b += `<circle class="hl" cx="${X}" cy="${Y}" r="${R + 3}"/>`; b += `<text class="tx" x="${X}" y="${Y}">${n.k}</text>`; if (min !== null && n._d === 0 && n.k === min) b += `<text class="vl" x="${X}" y="12">min ↓</text>`; }
  };
  fs.forEach(draw);
  return `<svg class="dsa-fig" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="forest"><defs><marker id="dh" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--muted)"/></marker></defs>${e}${b}</svg>`;
}
function layoutGraph(g, layer) {
  const P = {}, n = g.V.length;
  if (layer) {
    const lev = {}, q = [g.V[0]]; lev[g.V[0]] = 0; const nb = {}; g.V.forEach(v => nb[v] = []); g.E.forEach(e => { nb[e.u].push(e.v); if (!g.dir) nb[e.v].push(e.u); });
    while (q.length) { const u = q.shift(); for (const v of nb[u]) if (lev[v] === undefined) { lev[v] = lev[u] + 1; q.push(v); } }
    g.V.forEach(v => { if (lev[v] === undefined) lev[v] = 1; }); const last = g.V[n - 1], mx = Math.max(...Object.values(lev)); if (/^t$/i.test(last)) lev[last] = mx + (g.V.filter(v => lev[v] === mx).length > 1 ? 1 : 0);
    const cols = {}; g.V.forEach(v => (cols[lev[v]] ||= []).push(v));
    const L = Object.keys(cols).length, mh = Math.max(...Object.values(cols).map(c => c.length));
    Object.entries(cols).forEach(([l, c]) => c.forEach((v, i) => P[v] = [50 + l * (L > 5 ? 95 : 120), 45 + (i + .5) * (mh * 72) / c.length]));
    return { P, W: 100 + (L - 1) * (L > 5 ? 95 : 120), H: 90 + mh * 72 };
  }
  const r = Math.max(95, n * 21), c = r + 40; g.V.forEach((v, i) => { const a = -Math.PI / 2 + 2 * Math.PI * i / n; P[v] = [c + r * Math.cos(a), c + r * Math.sin(a)]; });
  return { P, W: 2 * c, H: 2 * c };
}
function drawGraph(g, layer, title) {
  const { P, W, H } = layoutGraph(g, layer), has = new Set(g.E.map(e => e.u + '|' + e.v)); let e = '', b = '';
  for (const x of g.E) {
    let [x1, y1] = P[x.u], [x2, y2] = P[x.v]; const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const both = g.dir && has.has(x.v + '|' + x.u), off = both ? 9 : 0, nx = -uy * off, ny = ux * off;
    const ax = x1 + ux * R + nx, ay = y1 + uy * R + ny, bx = x2 - ux * (R + (g.dir ? 3 : 0)) + nx, by = y2 - uy * (R + (g.dir ? 3 : 0)) + ny;
    e += `<line class="ed ${x.st || ''}" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"${g.dir ? ' marker-end="url(#dh)"' : ''}/>`;
    const t = String(x.w), lx = ax + (bx - ax) * .42 + nx * .6, ly = ay + (by - ay) * .42 + ny * .6, w = t.length * 7 + 5;
    b += `<rect class="lbb" x="${lx - w / 2}" y="${ly - 8}" width="${w}" height="16" rx="2"/><text class="lb" x="${lx}" y="${ly}">${esc(t)}</text>`;
  }
  for (const v of g.V) { const [X, Y] = P[v]; b += `<circle class="nd ${g.vst[v] || ''}" cx="${X}" cy="${Y}" r="${R}"/><text class="tx" x="${X}" y="${Y}">${esc(v)}</text>`; if (g.vlab && g.vlab[v] !== undefined) b += `<text class="vl" x="${X}" y="${Y - R - 5}">${esc(g.vlab[v])}</text>`; }
  return `<div class="fg-wrap">${title ? `<div class="tracer-hint" style="text-align:center">${title}</div>` : ''}<svg class="dsa-fig" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="graph"><defs><marker id="dh" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--muted)"/></marker></defs>${e}${b}</svg></div>`;
}
function drawMat(m) { return `<table class="mat"><caption>${m.title}</caption><tr><th></th>${m.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${m.rows.map(r => `<tr><th>${esc(r.h)}</th>${r.c.map(c => `<td${c.hl ? ' class="hl"' : ''}>${esc(c.t)}</td>`).join('')}</tr>`).join('')}</table>`; }
function drawTbl(t) { return `<div class="tbl tr-tbl"><table class="mat"><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${t.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`; }
function frameHTML(f, o = {}) {
  let h = '';
  if ('tree' in f) h += `<div class="fg-wrap">${drawTree(f.tree, f.hl)}</div>`;
  if (f.forest) h += `<div class="fg-wrap">${drawForest(f.forest, { hl: f.hl, min: f.min ?? null })}</div>`;
  if (f.forest2) h += `<div class="fg-wrap forest2"><div class="tracer-hint">Second heap (the removed root's children)</div>${drawForest(f.forest2)}</div>`;
  if (f.ptree) h += `<div class="fg-wrap">${drawForest(f.ptree, { text: true })}</div>`;
  if (f.graph) h += drawGraph(f.graph, o.layer, f.graph2 ? 'Flow network (flow/capacity)' : '');
  if (f.graph2) h += drawGraph(f.graph2, o.layer, 'Residual network');
  if (f.mats) h += `<div class="mats fg-wrap">${f.mats.map(drawMat).join('')}</div>`;
  if (f.tbl) h += drawTbl(f.tbl);
  if (f.hash) h += `<div class="hash-row">${f.hash.cells.map((c, i) => `<div class="hash-cell${c.hl ? ' hl' : ''}"><b>${i}</b><span>${esc(c.t)}</span></div>`).join('')}</div>`;
  return h;
}

// ---------- running an algorithm from text input ----------
const parseItems = s => [...s.matchAll(/(\d+)\s*[:/,]\s*(\d+)/g)].map(m => ({ w: +m[1], v: +m[2] }));
const parseCNF = s => s.split(/\)\s*[∧&^]?\s*\(|[()]/).map(c => c.trim()).filter(Boolean).map(c => c.split(/\s*[∨v|,+]\s*|\s+/).filter(Boolean));
const parseMatrix = s => s.trim().split(/[;\n]+/).map(r => r.trim().split(/[\s,]+/).map(Number));
function hashOpts(mode, m) { const M = x => ((x % m) + m) % m; return { mode, h: k => M(k), f: { linear: (k, i) => M(k + i), quad: (k, i) => M(k + i * i), double: (k, i) => M(M(k) + i * (7 - (k % 7))) }[mode] }; }
function run(kind, input, c = {}) {
  const o = c.opts || {};
  switch (kind) {
    case 'rb': case 'avl': case 'splay': return Algo.runTree(kind, input, o);
    case 'binomial': return Algo.runHeap('binomial', input, o);
    case 'fib': { if (input.includes('(') || input.includes('min=')) { const [a, b] = input.split(';'), p = Algo.parseFib(a), fr = [], F = new Algo.Fib(fr); F.load(p.trees, p.min); fr.push({ cap: 'Given heap.', tag: 'start', hl: [], forest: F.roots.map(r => F.snapN(r)), min: F.min.k }); for (const m of (b || '').matchAll(/ext\w*|dec\w*\s+-?\d+\s+-?\d+|del\w*\s+-?\d+/gi)) { const w = m[0].trim().split(/\s+/); if (/^ext/i.test(w[0])) F.extract(); else if (/^dec/i.test(w[0])) F.decrease(+w[1], +w[2]); else F.delete(+w[1]); } fr.result = { H: F }; return fr; } return Algo.runHeap('fib', input, o); }
    case 'kruskal': return Algo.kruskal(Algo.parseGraph(input));
    case 'prim': return Algo.prim(Algo.parseGraph(input), c.s);
    case 'dijkstra': return Algo.dijkstra(Algo.parseGraph(input), c.s);
    case 'bellman': return Algo.bellman(Algo.parseGraph(input), c.s);
    case 'dag': return Algo.dagsp(Algo.parseGraph(input), c.s);
    case 'fw': return Algo.fw(Algo.parseGraph(input));
    case 'matmul': return Algo.matmul(Algo.parseGraph(input));
    case 'closure': return Algo.closure(Algo.parseGraph(input));
    case 'johnson': return Algo.johnson(Algo.parseGraph(input));
    case 'ff': return Algo.flow(Algo.parseGraph(input), c.s, c.t);
    case 'ek': return Algo.flow(Algo.parseGraph(input), c.s, c.t, { bfs: true });
    case 'hash': { const [ks, m] = input.split(';'); const keys = ks.trim().split(/[\s,]+/).map(Number); return Algo.hashing(keys, +m, o.f ? o : hashOpts(o.mode || 'linear', +m)); }
    case 'knapsack': { const [its, W] = input.split(';'); return Algo.knapsack(parseItems(its), +W, o); }
    case 'tsp': return Algo.heldKarp(parseMatrix(input));
    case 'sat': return Algo.sat(parseCNF(input), o);
  }
  throw new Error('unknown kind ' + kind);
}
const FORMAT = { rb: 'keys, then del: 41 38 31 del 8 12 · or start from a tree: 23B(8R,27B) ; 11', avl: 'keys, then del: 15 22 24 del 24', splay: 'keys, acc, del: 5 4 3 2 1 acc 1 del 3', binomial: 'keys, then ext, dec a b, del k: 3 7 13 ext dec 13 1', fib: 'heap ; ops: 7(30) 24(26(35) 46) 5(18) min=5 ; ext', kruskal: 'A-B 4, A-C 2', prim: 'A-B 4, A-C 2', dijkstra: 'A>B 4, A>C 2', bellman: 'A>B 4, B>C -2', dag: 'A>B 4, B>C -2', fw: 'A>B 3, B>C -2', matmul: 'A>B 3', closure: 'A>B, B>C', johnson: 'A>B 3, B>C -2', ff: 's>a 10, a>t 5', ek: 's>a 10, a>t 5', hash: 'keys ; table size: 10 22 31 ; 11', knapsack: 'weight:value pairs ; capacity: 4:40 3:50 ; 10', tsp: 'rows split by ; 0 10 15 ; 5 0 12 ; 8 9 0', sat: "(x' v y') (x v y)" };
const LAYER = new Set(['ff', 'ek']);
function trace(sel, c) {
  const host = typeof sel === 'string' ? $(sel) : sel, area = document.createElement('div');
  host.innerHTML = ''; const layer = c.layer ?? LAYER.has(c.kind);
  if (c.edit !== false) { host.insertAdjacentHTML('beforeend', `<div class="tracer-in"><input aria-label="Input" value="${esc(c.input)}" spellcheck="false"><button type="button">Run on this</button></div><p class="tracer-hint">Format: ${esc(FORMAT[c.kind] || '')}</p>`); const inp = host.querySelector('input'), go = () => build(inp.value); host.querySelector('button').onclick = go; inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); }
  host.append(area);
  function build(text) { try { const fr = run(c.kind, text, c); stepper(area, fr.map(f => ({ html: frameHTML(f, { layer }), cap: (f.tag ? `<span class="tr-tag">${f.tag}</span>` : '') + f.cap }))); tex(area); } catch (e) { area.textContent = 'Could not read that input. Check the format above.'; } }
  build(c.input); return host;
}
const treeFig = (sel, t) => { $(sel).innerHTML = `<div class="fg-wrap">${drawTree(typeof t === 'string' ? Algo.parseTreeText(t) : t)}</div>`; };
const graphFig = (sel, s, o = {}) => { const G = Algo.parseGraph(s); $(sel).innerHTML = drawGraph({ V: G.V, dir: G.dir, E: G.E, vlab: {}, vst: {} }, o.layer); };
const forestFig = (sel, s) => { const p = Algo.parseFib(s); $(sel).innerHTML = `<div class="fg-wrap">${drawForest(p.trees, { min: p.min })}</div>`; };

// ---------- random instances. Each returns {q, input, answer(frames)->string, fmt, c} ----------
function mkRng(seed) { let s = seed >>> 0 || 1; const r = () => (s = s * 1664525 + 1013904223 >>> 0) / 4294967296; r.int = (a, b) => a + Math.floor(r() * (b - a + 1)); r.keys = (n, lo = 1, hi = 60) => { const o = new Set(); while (o.size < n) o.add(r.int(lo, hi)); return [...o]; }; r.pick = a => a[r.int(0, a.length - 1)]; return r; }
const letters = n => [...Array(n).keys()].map(i => String.fromCharCode(65 + i));
function randGraph(r, n, dir, lo = 1, hi = 12) { const V = letters(n), E = [], seen = new Set(); for (let i = 1; i < n; i++) { const j = r.int(0, i - 1); E.push(`${V[j]}${dir ? '>' : '-'}${V[i]} ${r.int(lo, hi)}`); seen.add(j + ',' + i); } const extra = r.int(n - 1, n + 2); for (let t = 0; t < extra * 4 && E.length < 2 * n; t++) { let a = r.int(0, n - 1), b = r.int(0, n - 1); if (a === b) continue; if (!dir && a > b) [a, b] = [b, a]; if (seen.has(a + ',' + b)) continue; seen.add(a + ',' + b); E.push(`${V[a]}${dir ? '>' : '-'}${V[b]} ${r.int(lo, hi)}`); } return E.join(', '); }
function randDistinctGraph(r, n) { const V = letters(n), E = []; let w = 1; const pool = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pool.push([i, j]); for (let i = pool.length - 1; i > 0; i--) { const j = r.int(0, i); [pool[i], pool[j]] = [pool[j], pool[i]]; } const conn = []; for (let i = 1; i < n; i++) conn.push([r.int(0, i - 1), i]); const use = [...conn]; for (const p of pool) { if (use.length >= n + 3) break; if (!use.some(q => q[0] === p[0] && q[1] === p[1])) use.push(p); } const ws = r.keys(use.length, 1, 30); return use.map((p, i) => `${V[p[0]]}-${V[p[1]]} ${ws[i]}`).join(', '); }
function randFlow(r) { const m = ['a', 'b', 'c', 'd'], E = []; E.push(`s>a ${r.int(6, 16)}`, `s>b ${r.int(6, 16)}`, `a>c ${r.int(4, 14)}`, `b>d ${r.int(4, 14)}`, `a>b ${r.int(2, 8)}`, `c>d ${r.int(2, 8)}`, `d>c ${r.int(1, 5)}`, `c>t ${r.int(6, 16)}`, `d>t ${r.int(6, 16)}`); return E.join(', '); }
const preF = fr => Algo.preorder(fr.result.tree, true), preK = fr => Algo.preorder(fr.result.tree, false);
const lastForest = fr => [...fr].reverse().find(f => f.forest).forest;
const distList = (fr, G) => G.V.map(v => fr.result.d[v] === Infinity ? 'inf' : fr.result.d[v]).join(' ');
const FMT_RB = 'Type the final tree in preorder with colours, e.g. 38B 19R 12B ...', FMT_K = 'Type the final tree in preorder, e.g. 30 20 10 ...', FMT_NEST = 'Type the root list left to right; children in brackets left to right, e.g. 7(9 8(10)) 3';
const GEN = {
  'rb-insert': r => { const k = r.keys(r.int(7, 9)); return { kind: 'rb', input: k.join(' '), q: `Starting from an empty red-black tree, insert <b>${k.join(', ')}</b> in this order. Draw the tree after each insert.`, fmt: FMT_RB, ans: preF }; },
  'rb-insert-mix': r => { const k = r.keys(9); const add = r.keys(2, 61, 90); return { kind: 'rb', input: [...k, ...add].join(' '), q: `Insert <b>${[...k, ...add].join(', ')}</b> into an empty red-black tree.`, fmt: FMT_RB, ans: preF }; },
  'rb-delete': r => { const k = r.keys(r.int(9, 11)), d = []; const pool = k.slice(); for (let i = 0; i < 3; i++) d.push(pool.splice(r.int(0, pool.length - 1), 1)[0]); return { kind: 'rb', input: `${k.join(' ')} del ${d.join(' ')}`, q: `Insert <b>${k.join(', ')}</b> into an empty red-black tree, then delete <b>${d.join(', ')}</b> in order, using the in-order <b>successor</b> for a node with two children.`, fmt: FMT_RB, ans: preF }; },
  'avl-insert': r => { const k = r.keys(r.int(7, 9)); return { kind: 'avl', input: k.join(' '), q: `Insert <b>${k.join(', ')}</b> into an empty AVL tree.`, fmt: FMT_K, ans: preK }; },
  'avl-delete': r => { const k = r.keys(9), d = [k[r.int(0, 3)], k[r.int(4, 8)]]; return { kind: 'avl', input: `${k.join(' ')} del ${d.join(' ')}`, q: `Insert <b>${k.join(', ')}</b> into an empty AVL tree, then delete <b>${d.join(', ')}</b> (two children: in-order successor).`, fmt: FMT_K, ans: preK }; },
  splay: r => { const k = r.keys(7), a = r.pick(k); return { kind: 'splay', input: `${k.join(' ')} acc ${a}`, q: `Insert <b>${k.join(', ')}</b> into an empty splay tree (splaying after each insert), then access <b>${a}</b>.`, fmt: FMT_K, ans: preK }; },
  'binomial-insert': r => { const k = r.keys(r.int(9, 13)); return { kind: 'binomial', input: k.join(' '), q: `Insert <b>${k.join(', ')}</b> one at a time into an empty binomial min-heap.`, fmt: FMT_NEST, ans: fr => Algo.nestF(lastForest(fr)) }; },
  'binomial-extract': r => { const k = r.keys(r.int(9, 13)); return { kind: 'binomial', input: `${k.join(' ')} ext`, q: `Insert <b>${k.join(', ')}</b> into an empty binomial min-heap, then do one <b>extract-min</b>.`, fmt: FMT_NEST, ans: fr => Algo.nestF(lastForest(fr)) }; },
  'fib-extract': r => { const p = Algo.parseFib(r.pick(['1(1) 1(1(1) 1) 1 1(1) 1(1 1 1(1))', '1 1(1 1(1)) 1(1) 1(1 1(1)) 1'])), ks = r.keys(30, 1, 99).sort((a, b) => a - b), avail = [...p.trees]; let i = 0; while (avail.length) { const n = avail.splice(r.int(0, avail.length - 1), 1)[0]; n.k = ks[i++]; avail.push(...n.ch); } const min = Math.min(...p.trees.map(t => t.k)), canon = Algo.nestF(p.trees); return { kind: 'fib', input: `${canon} min=${min} ; ext`, q: `Fibonacci min-heap, root list left to right: <code>${canon}</code>, min = ${min}. Do <b>extract-min</b>. Children take the min's place in the root list; consolidate starting from the root just right of the removed min, wrapping around.`, fmt: FMT_NEST + ' (order of roots and of children does not matter here)', ans: fr => Algo.nestF(lastForest(fr)), anyOrder: true }; },
  kruskal: r => { const g = randDistinctGraph(r, r.int(6, 7)); return { kind: 'kruskal', input: g, q: `Run <b>Kruskal</b> on: <code>${g}</code>.`, fmt: 'Type the accepted edges in order, e.g. AB CD BE ...', ans: fr => fr.result.edges.join(' ') }; },
  prim: r => { const g = randDistinctGraph(r, r.int(6, 7)); return { kind: 'prim', input: g, s: 'A', q: `Run <b>Prim</b> from A on: <code>${g}</code>.`, fmt: 'Type edges in the order added, e.g. AB BE ...', ans: fr => fr.result.edges.join(' ') }; },
  dijkstra: r => { const g = randGraph(r, r.int(6, 7), true); return { kind: 'dijkstra', input: g, s: 'A', q: `Run <b>Dijkstra</b> from A: <code>${g}</code>.`, fmt: 'Type final distances in vertex order A B C ..., use inf if unreachable', ans: fr => distList(fr, Algo.parseGraph(g)) }; },
  bellman: r => { const g = randGraph(r, r.int(5, 6), true, -3, 9); return { kind: 'bellman', input: g, s: 'A', q: `Run <b>Bellman-Ford</b> from A, relaxing edges in the listed order: <code>${g}</code>.`, fmt: "Type final distances in vertex order, or NEG if a negative cycle is reachable", ans: fr => fr.result.neg ? 'NEG' : distList(fr, Algo.parseGraph(g)) }; },
  fw: r => { const n = 4, g = randGraph(r, n, true, -2, 9); return { kind: 'fw', input: g, q: `Run <b>Floyd-Warshall</b> on: <code>${g}</code>. Write D and Π after every k.`, fmt: 'Type the first row of the final D (A→A, A→B, ...), use inf, or NEG if any diagonal goes negative', ans: fr => fr.result.neg ? 'NEG' : fr.result.D[0].map(x => x === Infinity ? 'inf' : x).join(' ') }; },
  flow: r => { const g = randFlow(r); return { kind: 'ff', s: 's', t: 't', input: g, q: `Find the max flow from s to t, drawing the residual network after every augmentation: <code>${g}</code>.`, fmt: 'Type the max-flow value', ans: fr => String(fr.result.value) }; },
  mincut: r => { const g = randFlow(r); return { kind: 'ff', s: 's', t: 't', input: g, q: `Find the max flow and the min cut: <code>${g}</code>.`, fmt: 'Type S, the source side of the min cut found from the final residual network, e.g. s a', ans: fr => fr.result.S.sort().join(' ') }; },
  'hash-linear': r => { const m = 11, k = r.keys(8, 1, 99); return { kind: 'hash', input: `${k.join(' ')} ; ${m}`, q: `Table size 11, \\(h(k)=k \\bmod 11\\), linear probing \\((h(k)+i) \\bmod 11\\). Insert <b>${k.join(', ')}</b>.`, fmt: 'Type all 11 slots in order, with - for empty', ans: fr => fr.result.table.map(x => x === null ? '-' : x).join(' ') }; },
  'hash-double': r => { const m = 11, k = r.keys(8, 1, 99); return { kind: 'hash', opts: { mode: 'double' }, input: `${k.join(' ')} ; ${m}`, q: `Table size 11, double hashing with \\(h_1(k)=k \\bmod 11\\), \\(h_2(k)=7-(k \\bmod 7)\\). Insert <b>${k.join(', ')}</b>.`, fmt: 'Type all 11 slots in order, with - for empty', ans: fr => fr.result.table.map(x => x === null ? '-' : x).join(' ') }; },
  knapsack: r => { const it = [...Array(4)].map(() => ({ w: r.int(2, 8), v: r.int(10, 80) })), W = r.int(9, 13), input = it.map(x => `${x.w}:${x.v}`).join(' ') + ` ; ${W}`; return { kind: 'knapsack', input, q: `0/1 knapsack by branch and bound (bound = fractional knapsack, expand largest bound first). Capacity ${W}. Weight:value = <code>${it.map(x => `${x.w}:${x.v}`).join(', ')}</code>. Draw the tree.`, fmt: 'Type the optimal value', ans: fr => String(fr.result.value) }; },
  sat: r => { const V = ['x', 'y', 'z'], lit = () => { const v = r.pick(V); return r.int(0, 1) ? v : v + "'"; }, cls = [...Array(r.int(4, 5))].map(() => [...new Set([lit(), lit(), r.int(0, 1) ? lit() : lit()])]); const txt = cls.map(c => '(' + c.join(' v ') + ')').join(' '); return { kind: 'sat', input: txt, q: `Backtracking, branch x then y then z, 0 before 1: <code>${txt}</code>. Draw the tree.`, fmt: "Type the first satisfying assignment found as bits xyz, e.g. 001 (shorten: unset variables as -), or UNSAT", ans: fr => fr.result.sat ? ['x', 'y', 'z'].map(v => fr.result.sols[0][v] ?? '-').join('') : 'UNSAT' }; },
  tsp: r => { const n = 4, C = [...Array(n)].map((_, i) => [...Array(n)].map((_, j) => i === j ? 0 : r.int(2, 20))), input = C.map(x => x.join(' ')).join(' ; '); return { kind: 'tsp', input, q: `Held-Karp DP on this cost matrix, starting at city 1:<br><code>${C.map(x => x.join(' ')).join('<br>')}</code>`, fmt: 'Type the optimal tour cost', ans: fr => String(fr.result.cost) }; },
};

// ---------- mandatory-practice bookkeeping (localStorage; the page still works without it) ----------
const PAGE = (() => { const m = /dsa2\/(.*?)(?:\?.*)?$/.exec(location.pathname); return (m && m[1]) || location.pathname.split('/').slice(-2).join('/'); })();
const Must = {
  KEY: 'cse207-must', items: {},
  load() { try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch { return {}; } },
  save(o) { try { localStorage.setItem(this.KEY, JSON.stringify(o)); } catch {} },
  reg(id, need) { this.items[id] = need; },
  got(id) { return (this.load()[PAGE]?.w?.[id]) || 0; },
  add(id, by = 1) { const o = this.load(), p = o[PAGE] ||= { w: {} }; p.w ||= {}; p.w[id] = (p.w[id] || 0) + by; this.sync(o); return p.w[id]; },
  sync(o = this.load()) { const p = o[PAGE] ||= { w: {} }; p.total = Object.values(this.items).reduce((a, b) => a + b, 0); p.done = Object.entries(this.items).reduce((a, [k, n]) => a + Math.min(n, p.w?.[k] || 0), 0); this.save(o); paintToc(o); paintGate(); return p; },
  complete() { return Object.entries(this.items).every(([k, n]) => this.got(k) >= n); },
};
function paintToc(o = Must.load()) { document.querySelectorAll('nav.toc a[href]').forEach(a => { const m = /dsa2\/(.*)$/.exec(a.href); const p = m && o[m[1]]; a.classList.toggle('fin', !!p && p.total > 0 && p.done >= p.total); a.classList.toggle('debt', !!p && !!p.skipped && !(p.done >= p.total)); }); }
function paintGate() {
  const next = document.querySelector('.pager a.next'), old = document.querySelector('.gate'); if (old) old.remove();
  if (!next || !Object.keys(Must.items).length) return;
  const total = Object.values(Must.items).reduce((a, b) => a + b, 0), done = Object.keys(Must.items).reduce((a, k) => a + Math.min(Must.items[k], Must.got(k)), 0);
  if (done >= total || Must.load()[PAGE]?.skipped) { next.style.opacity = ''; next.onclick = null; return; }
  next.style.opacity = .45; next.onclick = e => { e.preventDefault(); const g = document.querySelector('.gate'); g && g.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const g = document.createElement('div'); g.className = 'gate';
  g.innerHTML = `<b>Practice first: ${done} of ${total} done.</b> This chapter is finished when the mandatory practice is. <button class="must-b" type="button">Skip for now, and log it as debt</button>`;
  g.querySelector('button').onclick = () => { const o = Must.load(); (o[PAGE] ||= { w: {} }).skipped = true; Must.save(o); paintGate(); paintToc(o); };
  next.closest('.pager').before(g);
}

function practice(sel, c) {
  const host = $(sel), need = c.n ?? 2, gen = GEN[c.kind]; Must.reg(c.id, need); host.classList.add('must');
  const seedKey = 'cse207-seed-' + PAGE + c.id; let seed; try { seed = +localStorage.getItem(seedKey); } catch {} seed = seed || (c.seed ?? Math.floor(Math.random() * 1e9));
  const norm = s => String(s).toLowerCase().replace(/[,]/g, ' ').replace(/∞/g, 'inf').replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\s+/g, ' ').trim();
  let inst, frames, attempted = false;
  function fresh(s) { seed = s; try { localStorage.setItem(seedKey, String(seed)); } catch {} inst = gen(mkRng(seed)); frames = run(inst.kind, inst.input, inst); attempted = false; paint(); }
  function paint() {
    const got = Must.got(c.id), ok = got >= need; host.classList.toggle('ok', ok);
    host.innerHTML = `<div class="must-h"><span>Mandatory practice · do it on paper</span><span>${Math.min(got, need)} / ${need}${ok ? ' ✓' : ''}</span></div>
      <p class="must-q">${inst.q}</p><p class="tracer-hint">${inst.fmt}</p>
      <form class="must-f"><input aria-label="Your answer" autocomplete="off" spellcheck="false"><button class="must-b" type="submit">Check</button><button class="must-b" type="button" data-sol>Show the steps</button><button class="must-b" type="button" data-new>New question</button></form>
      <div class="must-r" aria-live="polite"></div><div class="must-sol"></div>`;
    const res = host.querySelector('.must-r'), sol = host.querySelector('.must-sol'), inp = host.querySelector('input');
    const showSol = () => { sol.innerHTML = '<div class="must-model"></div>'; trace(sol.firstChild, { ...inst, edit: false }); };
    host.querySelector('form').onsubmit = e => { e.preventDefault(); const v = norm(inp.value); if (!v) return; attempted = true; const correct = norm(inst.ans(frames)); const accept = inst.anyOrder ? canon(v) === canon(correct) : v === correct; if (accept) { const n = Must.add(c.id); res.className = 'must-r good'; res.innerHTML = `<b>Correct.</b> ${n < need ? `${need - n} more to go.` : 'Requirement met.'} Open the steps to compare your working, or take a new question.`; host.classList.toggle('ok', n >= need); host.querySelector('.must-h span:last-child').textContent = `${Math.min(n, need)} / ${need}${n >= need ? ' ✓' : ''}`; try { localStorage.removeItem(seedKey); } catch {} } else { res.className = 'must-r bad'; res.innerHTML = '<b>Not matching.</b> Check your paper, or open the steps and find the first frame where you differ. A new question is needed for credit after that.'; } };
    host.querySelector('[data-sol]').onclick = () => { if (!attempted) { res.className = 'must-r bad'; res.textContent = 'Submit an attempt first. A wrong answer is fine: finding where it went wrong is the point.'; return; } showSol(); };
    host.querySelector('[data-new]').onclick = () => fresh(Math.floor(Math.random() * 1e9));
    tex(host);
  }
  const canon = t => { const sort = ns => ns.map(n => ({ ...n, ch: sort(n.ch) })).sort((a, b) => a.k - b.k); return Algo.nestF(sort(Algo.parseFib(t).trees)); };
  fresh(seed); Must.sync();
}
function recall(sel, c) {
  const host = $(sel); Must.reg(c.id, 1); host.classList.add('must');
  const paint = () => {
    const ok = Must.got(c.id) >= 1; host.classList.toggle('ok', ok);
    host.innerHTML = `<div class="must-h"><span>Mandatory · write it from memory${c.marks ? ` · ${c.marks} marks` : ''}</span><span>${ok ? 'done ✓' : ''}</span></div><div class="must-q">${c.q}</div><button class="must-b" type="button" data-r>I wrote my answer: show the marking</button><div class="must-body" hidden></div>`;
    const body = host.querySelector('.must-body');
    host.querySelector('[data-r]').onclick = e => { e.target.remove(); body.hidden = false; body.innerHTML = `<p class="tracer-hint">Tick only what your written answer really has. All ticks = done.</p><ul class="pts">${c.points.map((p, i) => `<li><label><input type="checkbox" data-i="${i}"> ${p}</label></li>`).join('')}</ul>${c.model ? `<details class="must-model"><summary>Model answer</summary>${c.model}</details>` : ''}<div class="must-r" aria-live="polite"></div>`; tex(body); const boxes = body.querySelectorAll('input'); body.addEventListener('change', () => { if ([...boxes].every(b => b.checked) && Must.got(c.id) < 1) { Must.add(c.id); host.classList.add('ok'); host.querySelector('.must-h span:last-child').textContent = 'done ✓'; body.querySelector('.must-r').className = 'must-r good'; body.querySelector('.must-r').textContent = 'Complete.'; } }); };
    tex(host);
  };
  paint(); Must.sync();
}
document.addEventListener('DOMContentLoaded', () => { tex(); paintToc(); });
