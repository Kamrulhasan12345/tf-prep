// EEE 263 helpers: KaTeX rendering, SI numbers, seeded random values, circuit schematics,
// step-reveal worked examples and the random practice ("drill") engine.
// Load after book.js. Every helper is a plain global function.

// ---------- KaTeX: \( inline \) and \[ display \] ----------
const KX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/';
let kxReady = null;
function loadKatex() {
  if (kxReady) return kxReady;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = KX + 'katex.min.css';
  document.head.append(css);
  const js = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); });
  kxReady = js(KX + 'katex.min.js').then(() => js(KX + 'contrib/auto-render.min.js'));
  return kxReady;
}
function tex(el = document.body) {
  loadKatex().then(() => renderMathInElement(el, {
    delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
    throwOnError: false,
  })).catch(() => {}); // offline: the raw TeX stays readable
}
document.addEventListener('DOMContentLoaded', () => tex());

// ---------- SI numbers ----------
const PFX = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
const PFXV = { G: 1e9, M: 1e6, k: 1e3, K: 1e3, m: 1e-3, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };
// sig: significant figures. si(0.004359, 'A') -> "4.36 mA"; si(5.9e-4,'A') -> "590 µA"
function si(v, unit = '', sig = 3) {
  if (!isFinite(v)) return String(v);
  if (v === 0) return `0 ${unit}`.trim();
  const a = Math.abs(v);
  const [m, p] = PFX.find(([m]) => a >= m * 0.9995) || PFX[PFX.length - 1];
  return `${+(v / m).toPrecision(sig)} ${p}${unit}`.trim();
}
const num = (v, sig = 4) => String(+v.toPrecision(sig)); // plain number, trimmed
const siT = (v, unit = '', sig = 3) => `\\text{${si(v, unit, sig)}}`; // SI value inside \( \) math
// Parse what a student types. Bare numbers are in the answer's display unit (e.g. 'mA').
// Accepts "4.36", "4.36m", "4.36 mA", "4.36e-3 A", "4,360 µA", "-2.1 k".
function parseSI(text, dispUnit = '', mul = 0) { // mul: scale for bare numbers when the unit is compound (e.g. V/ms -> 1e3)
  const t = String(text).trim().replace(/,/g, '').replace(/\s+/g, '').replace(/Ω|ohms?/gi, '');
  const m = t.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)([GMkKmuµμnpf]?)([A-Za-z°/]*)$/);
  if (!m) return NaN;
  let v = parseFloat(m[1]);
  if (m[2]) v *= PFXV[m[2]];
  else if (!m[3] && mul) v *= mul;
  else if (!m[3]) { // bare number: use the display unit's prefix
    const dp = dispUnit.match(/^([GMkKmuµμnpf])(?=[A-ZΩVAHFSsW])/);
    if (dp) v *= PFXV[dp[1]];
  }
  return v;
}
// value -> number in the display unit, e.g. disp(0.00436,'mA') = 4.36
function disp(v, unit) { const dp = unit.match(/^([GMkKmuµμnpf])(?=[A-ZΩVAHFSsW])/); return dp ? v / PFXV[dp[1]] : v; }

// ---------- seeded random values ----------
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  const r = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.step = (lo, hi, st) => +(lo + st * Math.floor(r() * (Math.round((hi - lo) / st) + 1))).toFixed(10);
  r.E = (lo, hi) => r.pick(E12.filter(x => x >= lo && x <= hi)); // standard resistor value in [lo, hi]
  return r;
}
const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2].flatMap(b => [1, 10, 100, 1e3, 1e4, 1e5, 1e6].map(d => +(b * d).toPrecision(3)));
const par = (...rs) => 1 / rs.reduce((s, r) => s + 1 / r, 0); // parallel resistances

// ---------- schematics ----------
// sch(items, {w, h}) returns an <svg>. Coordinates in px. Two-terminal parts run between two
// points on a horizontal or vertical line; the symbol is centred and leads fill the rest.
//  ['W', [x,y], [x,y], ...]          wire through points
//  ['R'|'C'|'L'|'D'|'Z'|'LED', [x1,y1], [x2,y2], label]   D/Z: anode at p1, cathode at p2
//  ['V', p1, p2, label]   DC source, + at p1      ['AC', p1, p2, label]   sine source
//  ['I', p1, p2, label]   current source, arrow p1 -> p2
//  ['gnd', [x,y]]  ['rail', [x,y], '+10 V', up=true]  ['dot', [x,y]]  ['t', [x,y], 'text', anchor]
//  ['open', [x,y], label]  small terminal circle (input/output), label to the right
//  ['npn'|'pnp', [bx,by], {flip, label}]  base at (bx,by); npn: C (bx+40, by-40), E (bx+40, by+40); pnp: E on top, C below
//  ['nmos'|'pmos', [gx,gy], {flip}]             gate at (gx,gy);  D at (gx+40, gy-40), S at (gx+40, gy+40)
//  ['opamp', [x,y], {plusTop}]                  inputs at (x, y∓16) ('−' on top by default), output at (x+80, y)
// Any item may carry a sim-parameter object, e.g. ['AC', p1, p2, 'vs', {amp: 5, f: 50}], ['npn', b, {beta: 150}],
// ['nmos', g, {vt: 1, k: 2e-3}], ['Z', p1, p2, 'Z', {vz: 5.1}], ['opamp', p, {vmax: 12}]. Otherwise values are read
// from the label text ("R₁ 10 kΩ", "+15 V"). sch(..., {sim: false}) hides the simulator link.
function sch(items, { w = 360, h = 240, cls = '', pad = 34, sim = true } = {}) {
  const out = [];
  const L = (x1, y1, x2, y2, c = '') => out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${c ? ` class="${c}"` : ''}/>`);
  const T = (x, y, s, a = 'middle', c = '') => out.push(`<text x="${x}" y="${y}" text-anchor="${a}" class="sl ${c}">${s}</text>`);
  const P = (d, c = '') => out.push(`<path d="${d}"${c ? ` class="${c}"` : ''}/>`);
  // place a symbol drawn along +x of length len centred between p1 and p2; returns a transform
  const two = ([x1, y1], [x2, y2], len, draw, label, lside = 1) => {
    const vert = x1 === x2, dist = vert ? y2 - y1 : x2 - x1, s = Math.sign(dist) || 1, mid = Math.abs(dist) / 2;
    const ang = vert ? (s > 0 ? 90 : -90) : (s > 0 ? 0 : 180);
    const g = [];
    g.push(`<g transform="translate(${x1} ${y1}) rotate(${ang})">`);
    g.push(`<line x1="0" y1="0" x2="${mid - len / 2}" y2="0"/><line x1="${mid + len / 2}" y1="0" x2="${2 * mid}" y2="0"/>`);
    g.push(`<g transform="translate(${mid - len / 2} 0)">${draw}</g></g>`);
    out.push(g.join(''));
    if (label) {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      if (vert) T(cx + 16 * lside, cy + 5, label, lside > 0 ? 'start' : 'end');
      else T(cx, cy - 14 * lside + (lside < 0 ? 10 : 0), label);
    }
  };
  const SYM = {
    R: [36, '<path d="M0,0 l3,-7 l6,14 l6,-14 l6,14 l6,-14 l6,14 l3,-7" class="nf"/>'],
    C: [12, '<line x1="0" y1="0" x2="0" y2="0"/><line x1="4" y1="-11" x2="4" y2="11"/><line x1="10" y1="-11" x2="10" y2="11"/><line x1="0" y1="0" x2="4" y2="0"/><line x1="10" y1="0" x2="12" y2="0"/>'],
    L: [36, '<path d="M0,0 a4.5,5 0 0 1 9,0 a4.5,5 0 0 1 9,0 a4.5,5 0 0 1 9,0 a4.5,5 0 0 1 9,0" class="nf"/>'],
    D: [20, '<path d="M2,-9 L2,9 L18,0 Z" class="fill"/><line x1="18" y1="-9" x2="18" y2="9"/><line x1="0" y1="0" x2="2" y2="0"/><line x1="18" y1="0" x2="20" y2="0"/>'],
    Z: [20, '<path d="M2,-9 L2,9 L18,0 Z" class="fill"/><path d="M14,-12 L18,-9 L18,9 L22,12" class="nf"/><line x1="0" y1="0" x2="2" y2="0"/><line x1="18" y1="0" x2="20" y2="0"/>'],
    LED: [20, '<path d="M2,-9 L2,9 L18,0 Z" class="fill"/><line x1="18" y1="-9" x2="18" y2="9"/><path d="M8,-12 l6,-7 M13,-11 l6,-7" class="nf"/>'],
    V: [28, '<circle cx="14" cy="0" r="14" class="nf"/><text x="6" y="-2" class="sl sm" text-anchor="middle" transform="rotate(0)">+</text><text x="22" y="-2" class="sl sm" text-anchor="middle">−</text>'],
    AC: [28, '<circle cx="14" cy="0" r="14" class="nf"/><path d="M5,0 q4.5,-9 9,0 t9,0" class="nf"/>'],
    I: [28, '<circle cx="14" cy="0" r="14" class="nf"/><line x1="6" y1="0" x2="20" y2="0" marker-end="url(#m-fg)"/>'],
  };
  for (const it of items) {
    const [k, a, b, c, d] = it;
    if (SYM[k]) {
      let [len, draw] = SYM[k];
      if (k === 'V') { // keep + and − upright whatever the orientation: draw them separately
        draw = '<circle cx="14" cy="0" r="14" class="nf"/>';
        two(a, b, len, draw, c, typeof d === 'number' ? d : 1);
        const vert = a[0] === b[0], ux = vert ? 0 : Math.sign(b[0] - a[0]), uy = vert ? Math.sign(b[1] - a[1]) : 0;
        const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
        T(cx - ux * 7, cy - uy * 7 + 4, '+', 'middle', 'sm'); T(cx + ux * 7, cy + uy * 7 + 4, '−', 'middle', 'sm');
      } else two(a, b, len, draw, c, typeof d === 'number' ? d : 1);
    } else if (k === 'W') { out.push(`<polyline points="${it.slice(1).map(p => p.join(',')).join(' ')}" class="nf"/>`); }
    else if (k === 'gnd') { const [x, y] = a; L(x, y, x, y + 6); L(x - 10, y + 6, x + 10, y + 6); L(x - 6, y + 10, x + 6, y + 10); L(x - 2, y + 14, x + 2, y + 14); }
    else if (k === 'rail') { const [x, y] = a, up = c !== false; L(x - 9, y, x + 9, y); T(x, up ? y - 6 : y + 16, b); }
    else if (k === 'dot') out.push(`<circle cx="${a[0]}" cy="${a[1]}" r="2.8" class="fill"/>`);
    else if (k === 'open') { out.push(`<circle cx="${a[0]}" cy="${a[1]}" r="3.2" class="open"/>`); if (b) T(a[0] + 8, a[1] + 5, b, 'start'); }
    else if (k === 't') T(a[0], a[1], b, c || 'middle', d || '');
    else if (k === 'npn' || k === 'pnp') {
      const [x, y] = a, o = b || {}, f = o.flip ? -1 : 1, X = dx => x + f * dx;
      L(x, y, X(18), y); L(X(18), y - 16, X(18), y + 16);
      out.push(`<polyline points="${X(18)},${y - 7} ${X(40)},${y - 22} ${X(40)},${y - 40}" class="nf"/>`);
      if (k === 'npn') { out.push(`<polyline points="${X(40)},${y + 22} ${X(40)},${y + 40}" class="nf"/>`); L(X(18), y + 7, X(40), y + 22, 'arr'); }
      else { out.push(`<polyline points="${X(18)},${y + 7} ${X(40)},${y + 22} ${X(40)},${y + 40}" class="nf"/>`); L(X(40), y - 22, X(20), y - 8, 'arr'); }
      if (o.label) T(X(46), y + 4, o.label, f > 0 ? 'start' : 'end');
    } else if (k === 'nmos' || k === 'pmos') {
      const [x, y] = a, o = b || {}, f = o.flip ? -1 : 1, X = dx => x + f * dx;
      L(x, y, X(16), y); L(X(16), y - 14, X(16), y + 14); L(X(22), y - 16, X(22), y + 16);
      out.push(`<polyline points="${X(22)},${y - 10} ${X(40)},${y - 10} ${X(40)},${y - 40}" class="nf"/>`);
      out.push(`<polyline points="${X(40)},${y + 10} ${X(40)},${y + 40}" class="nf"/>`);
      if (k === 'nmos') L(X(24), y + 10, X(38), y + 10, 'arr'); else L(X(40), y + 10, X(25), y + 10, 'arr');
      if (o.label) T(X(46), y + 4, o.label, f > 0 ? 'start' : 'end');
    } else if (k === 'opamp') {
      const [x, y] = a, o = b || {};
      P(`M${x + 10},${y - 34} L${x + 10},${y + 34} L${x + 70},${y} Z`, 'nf');
      L(x, y - 16, x + 10, y - 16); L(x, y + 16, x + 10, y + 16); L(x + 70, y, x + 80, y);
      T(x + 17, y - 10, o.plusTop ? '+' : '−', 'middle', 'sm'); T(x + 17, y + 20, o.plusTop ? '−' : '+', 'middle', 'sm');
    }
  }
  const svg = `<svg class="sch ${cls}" viewBox="${-pad} ${-pad / 2} ${w + 2 * pad} ${h + pad}" width="${w + 2 * pad}" role="img" aria-label="Circuit diagram">${out.join('')}</svg>`;
  return sim ? svg + `<a class="simbtn" href="${simURL(items)}" target="_blank" rel="noopener">Open in simulator ↗</a>` : svg;
}

// ---------- export to the Falstad CircuitJS simulator ----------
// Element formats and pin geometry follow circuitjs1's *Elm.java dump()/setPoints().
// CircuitJS joins wires only at end points, so every wire is split wherever another pin lies on it.
function cjsText(items) {
  const els = [], pins = [], wires = [];
  const k = p => p.join(',');
  const opt = it => it.find(x => x && typeof x === 'object' && !Array.isArray(x)) || {};
  const val = (label, d) => { // last number in the label, with SI prefix
    const m = [...String(label || '').replace(/−/g, '-').matchAll(/(-?\d+(?:\.\d+)?)\s*([GMkKmuµμnp]?)(?=\s*(?:Ω|V|A|F|H|Hz|$|\s|,))/g)].pop();
    return m ? parseFloat(m[1]) * (m[2] ? PFXV[m[2]] : 1) : d;
  };
  const el = (line, ...ps) => { els.push(line); ps.forEach(p => pins.push(p)); };
  const wire = (a, b) => { if (k(a) !== k(b)) { wires.push([a, b]); pins.push(a, b); } };
  for (const it of items) {
    const [t, a, b, c] = it, o = opt(it), P = q => q.join(' ');
    if (t === 'W') for (let i = 2; i < it.length; i++) Array.isArray(it[i]) && Array.isArray(it[i - 1]) && wire(it[i - 1], it[i]);
    else if (t === 'R') el(`r ${P(a)} ${P(b)} 0 ${o.val ?? val(c, 1000)}`, a, b);
    else if (t === 'C') el(`c ${P(a)} ${P(b)} 0 ${o.val ?? val(c, 1e-6)} 0 0`, a, b);
    else if (t === 'L') el(`l ${P(a)} ${P(b)} 0 ${o.val ?? val(c, 1e-3)} 0`, a, b);
    else if (t === 'D' || t === 'LED') el(`d ${P(a)} ${P(b)} 2 default`, a, b);
    else if (t === 'Z') el(`z ${P(a)} ${P(b)} 0 ${o.vz ?? val(c, 5.6)}`, a, b);
    else if (t === 'V') el(`v ${P(b)} ${P(a)} 0 0 40 ${o.val ?? val(c, 5)} 0 0 0.5`, a, b); // CircuitJS: + at point 2
    else if (t === 'AC') el(`v ${P(b)} ${P(a)} 0 1 ${o.f ?? 1000} ${o.amp ?? val(c, 1)} ${o.dc ?? 0} 0 0.5`, a, b);
    else if (t === 'I') el(`i ${P(a)} ${P(b)} 0 ${o.val ?? val(c, 1e-3)}`, a, b);
    else if (t === 'gnd') el(`g ${P(a)} ${a[0]} ${a[1] + 16} 0 0`, a);
    else if (t === 'rail') el(`R ${P(a)} ${a[0]} ${a[1] + (c === false ? 16 : -16)} 0 0 40 ${o.val ?? val(b, 5)} 0 0 0.5`, a);
    else if (t === 'npn' || t === 'pnp') {
      const f = b && b.flip ? -1 : 1, [x, y] = a, X = x + 40 * f;
      el(`t ${x} ${y} ${X} ${y} 0 ${t === 'npn' ? 1 : -1} 0 0 ${o.beta ?? 100} default`, a);
      wire([X, y - 16], [X, y - 40]); wire([X, y + 16], [X, y + 40]);
    } else if (t === 'nmos' || t === 'pmos') {
      const f = b && b.flip ? -1 : 1, [x, y] = a, X = x + 40 * f;
      el(`f ${x} ${y} ${X} ${y} ${t === 'pmos' ? 1 : 0} ${o.vt ?? 1} ${o.k ?? 0.002}`, a); // drain top, source bottom
      wire([X, y - 16], [X, y - 40]); wire([X, y + 16], [X, y + 40]);
    } else if (t === 'opamp') {
      const [x, y] = a, v = o.vmax ?? 15;
      el(`a ${x} ${y} ${x + 80} ${y} ${8 | (o.plusTop ? 1 : 0)} ${v} ${-v} 1000000 0 0 100000`, [x, y - 16], [x, y + 16], [x + 80, y]);
    } else if (t === 'dot') pins.push(a);
  }
  const on = (p, [a, b]) => (a[0] === b[0] && p[0] === a[0] && (p[1] - a[1]) * (p[1] - b[1]) < 0) ||
                            (a[1] === b[1] && p[1] === a[1] && (p[0] - a[0]) * (p[0] - b[0]) < 0);
  for (const [a, b] of wires) {
    const cut = pins.filter(p => on(p, [a, b])).sort((p, q) => Math.hypot(p[0] - a[0], p[1] - a[1]) - Math.hypot(q[0] - a[0], q[1] - a[1]));
    const pts = [a, ...cut.filter((p, i) => !i || k(p) !== k(cut[i - 1])), b];
    for (let i = 1; i < pts.length; i++) els.push(`w ${pts[i - 1].join(' ')} ${pts[i].join(' ')} 0`);
  }
  return ['$ 1 0.000005 10.20027730826997 50 5 43 5e-11', ...els].join('\n') + '\n';
}
const simURL = items => 'https://www.falstad.com/circuit/circuitjs.html?cct=' + encodeURIComponent(cjsText(items));

// ---------- worked example with step reveal ----------
// worked(sel, {given, fig, steps: [html | {t, a: {l, v, u, tol}}]})
// Try to write each next line yourself before revealing it. Steps with `a` ask you for the value first.
function worked(sel, ex) {
  const host = typeof sel === 'string' ? $(sel) : sel;
  host.classList.add('worked');
  const steps = ex.steps.map(s => typeof s === 'string' ? { t: s } : s);
  host.innerHTML = `${ex.given ? `<div class="wk-given">${ex.given}</div>` : ''}${ex.fig ? `<div class="wk-fig">${ex.fig}</div>` : ''}
    <ol class="wk-steps"></ol>
    <div class="wk-ctl"><button type="button" data-a="next">Reveal step 1 of ${steps.length}</button><button type="button" data-a="all">Show all</button><button type="button" data-a="reset">Hide all</button></div>`;
  const ol = host.querySelector('.wk-steps'), nb = host.querySelector('[data-a="next"]');
  let i = 0;
  const askBox = (a, k) => `<form class="wk-ask" data-k="${k}"><label>Your \\(${a.l}\\) =</label> <input type="text" autocomplete="off" spellcheck="false" aria-label="Your value"> <span class="u">${a.u || ''}</span> <button type="submit">Check</button><span class="wk-res" aria-live="polite"></span></form>`;
  const reveal = () => {
    if (i >= steps.length) return;
    const s = steps[i], li = document.createElement('li');
    li.innerHTML = s.a && !host.dataset.all ? askBox(s.a, i) + `<div class="wk-t" hidden>${s.t}</div>` : `<div class="wk-t">${s.t}</div>`;
    ol.append(li); tex(li); i++;
    nb.textContent = i < steps.length ? `Reveal step ${i + 1} of ${steps.length}` : 'All steps shown';
    nb.disabled = i >= steps.length;
  };
  host.addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target.closest('.wk-ask'); if (!f) return;
    const a = steps[+f.dataset.k].a, v = parseSI(f.querySelector('input').value, a.u || '', a.mul);
    const ok = closeTo(v, a.v, a.tol);
    f.querySelector('.wk-res').innerHTML = ok ? ' ✓ correct' : ` ✗ the line below shows the working`;
    f.querySelector('.wk-res').className = 'wk-res ' + (ok ? 'ok' : 'bad');
    f.nextElementSibling.hidden = false; tex(f.nextElementSibling);
  });
  host.querySelector('.wk-ctl').addEventListener('click', e => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return;
    if (a === 'next') reveal();
    if (a === 'all') { host.dataset.all = 1; while (i < steps.length) reveal(); ol.querySelectorAll('.wk-t').forEach(t => { t.hidden = false; tex(t); }); delete host.dataset.all; }
    if (a === 'reset') { ol.innerHTML = ''; i = 0; nb.disabled = false; nb.textContent = `Reveal step 1 of ${steps.length}`; }
  });
  tex(host);
}
const closeTo = (v, want, tol = 0.02) => isFinite(v) && (Math.abs(v - want) <= Math.abs(want) * tol || Math.abs(v - want) < 1e-12);

// ---------- practice engine ----------
// drill(sel, {id, title, gen}) where gen(r) returns
//   {given: html, fig: svg?, ask: [{l: 'I_D', v: 0.00436, u: 'mA', tol?}], steps: [html | {t, a}], note?: html}
// r is a seeded random source (see rng). Modes: Solo = answer then check; Guided = steps with
// intermediate values to fill. Progress (tries, streak) is kept in localStorage per id.
const PROG_KEY = 'eee263-progress';
const prog = {
  all() { try { return JSON.parse(localStorage.getItem(PROG_KEY)) || {}; } catch { return {}; } },
  get(id) { return this.all()[id] || { tries: 0, right: 0, streak: 0, best: 0 }; },
  put(id, p) { try { const a = this.all(); a[id] = p; localStorage.setItem(PROG_KEY, JSON.stringify(a)); } catch {} },
};
const MASTER = 3; // solo correct in a row without opening the solution
function drill(sel, spec) {
  const host = typeof sel === 'string' ? $(sel) : sel;
  host.classList.add('drill');
  let seed = (Math.random() * 2 ** 31) >>> 0, cur = null, peeked = false, checked = false;
  host.innerHTML = `<div class="dr-bar"><span class="dr-tag">Practice · random values</span><b class="dr-title">${spec.title || ''}</b><span class="dr-prog" aria-live="polite"></span></div>
    <div class="dr-body"></div>
    <div class="dr-ctl"><button type="button" data-a="new">New problem ↻</button><button type="button" data-a="guided">Guided steps</button><button type="button" data-a="sol">Full solution</button></div>`;
  const body = host.querySelector('.dr-body'), progEl = host.querySelector('.dr-prog');
  const showProg = () => {
    const p = prog.get(spec.id);
    const m = p.best >= MASTER ? ' · <span class="dr-mast">mastered ★</span>' : '';
    progEl.innerHTML = p.tries ? `streak ${p.streak} · ${p.right}/${p.tries} solved${m}` : `solve ${MASTER} in a row to master`;
  };
  const make = () => {
    for (let tries = 0; tries < 50; tries++) { cur = spec.gen(rng(seed)); if (cur) break; seed++; }
    peeked = checked = false;
    body.innerHTML = `<div class="dr-given">${cur.given}</div>${cur.fig ? `<div class="dr-fig">${cur.fig}</div>` : ''}
      <form class="dr-ans">${cur.ask.map((a, k) => `<label class="dr-a"><span>\\(${a.l}\\) =</span><input type="text" data-k="${k}" autocomplete="off" spellcheck="false" inputmode="decimal" aria-label="${a.l}"><span class="u">${a.u || ''}</span><span class="dr-mark"></span></label>`).join('')}
      <button type="submit">Check</button></form>
      <div class="dr-out" aria-live="polite"></div><div class="dr-sol"></div>`;
    tex(body);
  };
  body.addEventListener('submit', e => {
    e.preventDefault();
    const ins = [...body.querySelectorAll('.dr-ans input')];
    if (ins.every(i => !i.value.trim())) return;
    let all = true;
    ins.forEach(inp => {
      const a = cur.ask[+inp.dataset.k], v = parseSI(inp.value, a.u || '', a.mul), ok = closeTo(v, a.v, a.tol);
      all = all && ok;
      inp.parentElement.querySelector('.dr-mark').textContent = !inp.value.trim() ? '' : ok ? '✓' : '✗';
      inp.parentElement.className = 'dr-a ' + (!inp.value.trim() ? '' : ok ? 'ok' : 'bad');
    });
    const out = body.querySelector('.dr-out');
    if (!checked) { // only the first check counts for progress
      checked = true;
      const p = prog.get(spec.id); p.tries++;
      if (all && !peeked) { p.right++; p.streak++; p.best = Math.max(p.best, p.streak); } else p.streak = 0;
      prog.put(spec.id, p); showProg();
    }
    out.className = 'dr-out ' + (all ? 'ok' : 'bad');
    out.innerHTML = all ? `<b>All correct.</b> ${peeked ? '(Solution was open, so this one does not count for the streak.)' : 'Press “New problem” for another.'}`
      : '<b>Not yet.</b> Fix the ✗ values, or open Guided steps to find the slip. Answers within 2% count (rounding).';
  });
  const solution = guided => {
    peeked = true;
    const box = body.querySelector('.dr-sol');
    box.innerHTML = '';
    worked(box, { steps: cur.steps });
    if (!guided) box.querySelector('[data-a="all"]').click();
    if (cur.note) box.insertAdjacentHTML('beforeend', `<div class="dr-note">${cur.note}</div>`);
    tex(box);
  };
  host.querySelector('.dr-ctl').addEventListener('click', e => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return;
    if (a === 'new') { seed = (Math.random() * 2 ** 31) >>> 0; make(); }
    if (a === 'guided') solution(true);
    if (a === 'sol') solution(false);
  });
  make(); showProg();
  return host;
}

// Progress summary for the atlas page: ids -> {tries, right, streak, best}
function progressBadge(id) {
  const p = prog.get(id);
  if (!p.tries) return '<span class="pb pb-0">not started</span>';
  return p.best >= MASTER ? '<span class="pb pb-m">mastered ★</span>' : `<span class="pb pb-1">${p.right}/${p.tries}</span>`;
}
