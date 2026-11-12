// CSE 205 page widgets. Load after book.js and logic.js. Every widget takes a CSS selector for an empty <div>.
if (typeof window !== 'undefined') window.addEventListener('error', e => { document.documentElement.dataset.err = (document.documentElement.dataset.err || '') + (e.message || 'error') + ' @' + (e.lineno || '') + ' | '; });
//   kmap(sel, {vars, ones, dc, pos})                  animated K-map: PIs one by one, EPIs with responsible minterm, final cover
//   tabulation(sel, {vars, ones, dc})                 Quine-McCluskey columns step by step, then the PI chart
//   gates(sel, {expr, vars, form})                    two-level circuit drawing; form: and-or | nand-nand | or-and | nor-nor
//   muxImpl(sel, {vars, ones, dc, sel:[0,1]})         MUX implementation table + live MUX block (flip the inputs)
//   decImpl(sel, {vars, ones, dc, sel:[0,1], low})    same with a decoder + extra gates
//   plaFig(sel, {vars, fns:[[..],[..]], names})       PLA programming table and fuse map
//   diagram(sel, {table, moore, start, run})          state diagram; run:'0110' animates the input string
//   mealyMoore(sel, {table, run})                     Mealy table -> Moore, both diagrams, side-by-side timing
//   timing(sel, {signals:{name:[0,1,..]}, clock})     waveform figure
//   counterLab(sel, {seq, bits, ff})                  counter design tables, K-maps, equations, unused states, animated run
//   shiftLab(sel, {n, kind, init})                    shift register / ring / Johnson animation
//   ffLab(sel, {type})                                latch and flip-flop bench: SR, D, JK (level: race-around), MSJK, T
//   partitionAnim(sel, {table})                       equivalence partitions P0..Pk, then the minimal table
//   implication(sel, {table})                         implication table pass by pass, compatibles, bounds, closed cover
//   flowLab(sel, {table, start, cols})                fundamental mode: change the input, watch unstable -> stable
//   raceFig(sel, {table, codes})                      transition diagram on the cube, critical adjacency check
//   practice(sel, {id, kind, n})                      mandatory: random instance, typed answer auto-marked
//   recall(sel, {id, q, marks, points, model})        mandatory: write on paper, reveal, tick every key point
// Tables are text, one row per state: "A: B,0 C,1" ; '-' = unspecified ; flow tables may write stable entries as (a)/0.
const KX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/'; let kxReady = null;
function loadKatex() { if (kxReady) return kxReady; const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = KX + 'katex.min.css'; document.head.append(css); const js = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); }); return kxReady = js(KX + 'katex.min.js').then(() => js(KX + 'contrib/auto-render.min.js')); }
function tex(el = document.body) { loadKatex().then(() => renderMathInElement(el, { delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }], throwOnError: false })).catch(() => {}); }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const host = sel => typeof sel === 'string' ? $(sel) : sel;
const COL = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#17becf', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22'];
const ov = s => esc(s).replace(/([A-Za-z][0-9]*)'/g, '<span class="ov">$1</span>'); // x' -> overlined x (HTML)
const ovs = s => esc(s).replace(/([A-Za-z][0-9]*)'/g, '<tspan text-decoration="overline" style="text-decoration:overline">$1</tspan>'); // same inside SVG
const tbl = (head, rows, cls = '') => `<div class="tbl"><table class="mat ${cls}"><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
const asTable = t => typeof t === 'string' ? L.parseTable(t.replace(/[()]/g, '')) : t;

// ---------- generic stepper: frames [{html, cap}] ----------
function stepper(el, frames, o = {}) {
  el = host(el); let i = 0, timer = null;
  el.classList.add('stepper'); el.tabIndex = 0;
  el.innerHTML = `${o.tag ? `<span class="anim-tag">${o.tag}</span>` : ''}<div class="st-stage">${frames.map((f, k) => `<div class="st-frame${k ? '' : ' on'}">${f.html}</div>`).join('')}</div><div class="st-cap"></div>
  <div class="st-ctl"><button type="button" data-a="first">⏮</button><button type="button" data-a="prev">◀ Back</button><button type="button" data-a="next">Next ▶</button><button type="button" data-a="play">▶ Play</button><span class="st-count"></span></div>`;
  const fr = el.querySelectorAll('.st-frame'), cap = el.querySelector('.st-cap'), cnt = el.querySelector('.st-count'), b = a => el.querySelector(`[data-a=${a}]`);
  const show = k => { i = Math.max(0, Math.min(frames.length - 1, k)); fr.forEach((f, j) => f.classList.toggle('on', j === i)); cap.innerHTML = frames[i].cap || ''; cnt.textContent = `${i + 1} / ${frames.length}`; b('prev').disabled = b('first').disabled = !i; b('next').disabled = i === frames.length - 1; tex(cap); o.onShow && o.onShow(i); };
  const stop = () => { clearInterval(timer); timer = null; b('play').textContent = '▶ Play'; };
  b('first').onclick = () => { stop(); show(0); }; b('prev').onclick = () => { stop(); show(i - 1); }; b('next').onclick = () => { stop(); show(i + 1); };
  b('play').onclick = () => { if (timer) return stop(); if (i === frames.length - 1) show(0); b('play').textContent = '⏸ Pause'; timer = setInterval(() => { if (i >= frames.length - 1) return stop(); show(i + 1); }, o.speed || 1600); };
  el.onkeydown = e => { if (e.key === 'ArrowRight') { stop(); show(i + 1); } if (e.key === 'ArrowLeft') { stop(); show(i - 1); } };
  show(0); tex(el); return { show };
}

// ---------- K-map drawing ----------
const G2 = [0, 1, 3, 2];
function kmapGeom(n) {
  const rb = n === 5 ? 2 : n >> 1, cb = n === 5 ? 2 : n - (n >> 1), maps = n === 5 ? 2 : 1;
  const rs = rb === 2 ? G2 : [0, 1], cs = cb === 2 ? G2 : [0, 1];
  return { rb, cb, maps, rs, cs, m: (k, r, c) => (k << 4) | (rs[r] << cb) | cs[c] };
}
// vals: array '0'|'1'|'x' by minterm; groups: [{cube, color, star:[minterms]}]
function kmapSVG(vars, vals, groups = [], o = {}) {
  const n = vars.length, g = kmapGeom(n), C = 40, X0 = 58, Y0 = 46, mw = X0 + g.cs.length * C + 24;
  const W = mw * g.maps, H = Y0 + g.rs.length * C + 12;
  const rv = n === 5 ? vars.slice(1, 3) : vars.slice(0, g.rb), cv = n === 5 ? vars.slice(3) : vars.slice(g.rb);
  let s = `<svg class="dsa-fig kmap" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="K-map">`;
  for (let k = 0; k < g.maps; k++) {
    const ox = k * mw;
    if (n === 5) s += `<text class="sm" x="${ox + X0 + g.cs.length * C / 2}" y="10">${vars[0]} = ${k}</text>`;
    s += `<line class="ed" x1="${ox + X0 - 34}" y1="${Y0 - 30}" x2="${ox + X0}" y2="${Y0}"/><text class="sm" x="${ox + X0 - 30}" y="${Y0 - 4}" style="text-anchor:start">${rv.join('')}</text><text class="sm" x="${ox + X0 - 2}" y="${Y0 - 28}" style="text-anchor:end">${cv.join('')}</text>`;
    g.cs.forEach((c, j) => s += `<text class="sm" x="${ox + X0 + j * C + C / 2}" y="${Y0 - 8}">${L.bin(c, g.cb)}</text>`);
    g.rs.forEach((r, i) => s += `<text class="sm" x="${ox + X0 - 14}" y="${Y0 + i * C + C / 2 + 3}">${L.bin(r, g.rb)}</text>`);
    g.rs.forEach((_, i) => g.cs.forEach((_, j) => {
      const m = g.m(k, i, j), v = vals[m], x = ox + X0 + j * C, y = Y0 + i * C;
      s += `<rect class="kc${o.hot && o.hot.includes(m) ? ' hot' : ''}" x="${x}" y="${y}" width="${C}" height="${C}"/><text class="kv ${v === 'x' ? 'dc' : v === '1' ? 'one' : 'zero'}" x="${x + C / 2}" y="${y + C / 2 + 2}">${v === '0' && o.hideZero ? '' : v === 'x' ? '×' : v}</text><text class="km" x="${x + C - 3}" y="${y + C - 4}">${m}</text>`;
    }));
    groups.forEach((gr, gi) => {
      const cells = []; g.rs.forEach((_, i) => g.cs.forEach((_, j) => { if (L.covers(gr.cube, g.m(k, i, j))) cells.push([i, j]); }));
      if (!cells.length) return;
      const runs = (idx, len) => { const set = [...new Set(idx)].sort((a, b) => a - b); if (set.length === len) return [[0, len - 1]]; const out = []; let st = set[0], pr = set[0]; for (const v of set.slice(1)) { if (v === pr + 1) { pr = v; continue; } out.push([st, pr]); st = pr = v; } out.push([st, pr]); if (out.length > 1 && out[0][0] === 0 && out[out.length - 1][1] === len - 1) { const l = out.pop(); out[0] = [l[0], out[0][1] + len]; } return out; };
      const RR = runs(cells.map(c => c[0]), g.rs.length), CC = runs(cells.map(c => c[1]), g.cs.length), ins = 3 + (gi % 4) * 2.5, col = gr.color || COL[gi % COL.length];
      for (const [r0, r1] of RR) for (const [c0, c1] of CC) {
        const piece = (a0, a1, len) => a1 >= len ? [[a0, len - 1, 'e'], [0, a1 - len, 's']] : [[a0, a1, '']];
        for (const [pr0, pr1, er] of piece(r0, r1, g.rs.length)) for (const [pc0, pc1, ec] of piece(c0, c1, g.cs.length)) {
          const x = ox + X0 + pc0 * C + ins, y = Y0 + pr0 * C + ins, w = (pc1 - pc0 + 1) * C - 2 * ins, h = (pr1 - pr0 + 1) * C - 2 * ins;
          s += `<rect class="grp${gr.ess ? ' ess' : ''}" x="${x - (ec === 's' ? 10 : 0)}" y="${y - (er === 's' ? 10 : 0)}" width="${w + (ec ? 10 : 0)}" height="${h + (er ? 10 : 0)}" rx="12" style="stroke:${col}"/>`;
        }
      }
      (gr.star || []).forEach(m => { const p = cells.find(([i, j]) => g.m(k, i, j) === m); if (p) s += `<text class="star" x="${ox + X0 + p[1] * C + 8}" y="${Y0 + p[0] * C + 12}" style="fill:${col}">★</text>`; });
    });
  }
  return s + '</svg>';
}
const valsOf = (n, ones, dc = []) => L.range(1 << n).map(m => ones.includes(m) ? '1' : dc.includes(m) ? 'x' : '0');
function kmap(sel, c) {
  const vars = c.vars, n = vars.length, dc = c.dc || [], zeros = L.range(1 << n).filter(m => !c.ones.includes(m) && !dc.includes(m));
  const tgt = c.pos ? zeros : c.ones, r = L.minimize(n, tgt, dc, vars), vals = valsOf(n, c.ones, dc);
  const name = p => c.pos ? L.cubeStr(p, vars, true) : L.cubeStr(p, vars);
  const what = c.pos ? 'zeros (0s)' : '1s';
  const F = [], cover = r.sols[0] || [];
  F.push({ html: kmapSVG(vars, vals), cap: `Fill the map: ${c.pos ? `F = Π M(${zeros.join(', ')})` : `F = Σ m(${c.ones.join(', ')})`}${dc.length ? ` + d(${dc.join(', ')})` : ''}. Cells are in Gray order (00, 01, 11, 10), so neighbours differ in one bit, including the wrap-around edges.${c.pos ? ' For POS we group the 0s and read each group as a sum term.' : ''}` });
  r.useful.forEach((p, i) => F.push({ html: kmapSVG(vars, vals, r.useful.slice(0, i + 1).map((q, j) => ({ cube: q, color: COL[j % COL.length] }))), cap: `Prime implicant ${i + 1}: <b>${ov(name(p))}</b> covers ${p.cov.join(', ')} (${p.cov.length} cells: as large as possible, a power of 2). ${p.cov.every(x => dc.includes(x)) ? '' : ''}` }));
  if (r.epi.length) F.push({ html: kmapSVG(vars, vals, r.useful.map((q, j) => ({ cube: q, color: COL[j % COL.length], ess: r.epi.includes(q), star: r.resp.get(q) }))), cap: `<b>Essential</b> prime implicants (bold border, ★ = the ${what.replace(/s$/, '')} only that group covers): ${r.epi.map(p => `${ov(name(p))} (responsible minterm${r.resp.get(p).length > 1 ? 's' : ''} ${r.resp.get(p).join(', ')})`).join('; ')}.` });
  else F.push({ html: kmapSVG(vars, vals, r.useful.map((q, j) => ({ cube: q, color: COL[j % COL.length] }))), cap: 'No essential prime implicants here: every cell is covered by at least two prime implicants (a cyclic map). Choose a cheapest set by trial.' });
  const left = tgt.filter(x => !r.epi.some(p => p.cov.includes(x)));
  F.push({ html: kmapSVG(vars, vals, cover.map((q, j) => ({ cube: q, color: COL[r.useful.indexOf(q) % COL.length], ess: r.epi.includes(q) }))), cap: `${left.length ? `After the EPIs, ${left.join(', ')} remain${left.length === 1 ? 's' : ''}: cover with the fewest, largest remaining PIs. ` : 'The EPIs already cover every ' + what.replace(/s$/, '') + '. '}<b>F = ${ov(c.pos ? (cover.map(p => L.cubeStr(p, vars, true)).join('') || '1') : (r.sop))}</b>${r.all.length > 1 ? ` (another equally minimal answer: ${ov(c.pos ? r.sols[1].map(p => L.cubeStr(p, vars, true)).join('') : r.all[1])})` : ''}.${c.pos ? ` (F' = ${ov(r.sop)} from the 0s; De Morgan gives the POS.)` : ''}` });
  stepper(sel, F, { tag: 'K-map · step through' });
}

// ---------- tabulation ----------
function tabulation(sel, c) {
  const vars = c.vars, n = vars.length, dc = c.dc || [], r = L.minimize(n, c.ones, dc, vars), F = [];
  const colHTML = (k, upto) => r.cols.slice(0, upto + 1).map((col, ci) => {
    const groups = [...new Set(col.map(x => x.ones))];
    return `<div><div class="figlabel">Column ${ci + 1}${ci ? ` (${ci} variable${ci > 1 ? 's' : ''} eliminated)` : ''}</div>${tbl(['group', 'minterms', vars.join(''), ''], groups.flatMap(gk => col.filter(x => x.ones === gk).map((x, i) => [i ? '' : gk, x.cov.join(','), L.cubeBits(x, n), ci < upto || ci < k ? (x.used ? '✓' : '<b class="bad">PI</b>') : ''])))}</div>`;
  }).join('');
  F.push({ html: `<div class="figrow">${colHTML(-1, 0)}</div>`, cap: `Step 1: list every minterm${dc.length ? ' and don\'t-care' : ''} in binary, grouped by the number of 1s. Only neighbouring groups can combine (they differ in exactly one bit).` });
  r.cols.forEach((col, ci) => { if (ci + 1 < r.cols.length) F.push({ html: `<div class="figrow">${colHTML(ci + 1, ci + 1)}</div>`, cap: `Step ${ci + 2}: compare each term with the next group. If two differ in one bit, write the merged term with a dash there and tick (✓) both. Terms with the same dashes only.` }); });
  F.push({ html: `<div class="figrow">${colHTML(r.cols.length, r.cols.length - 1)}</div>`, cap: `Every term never ticked is a <b>prime implicant</b>: ${r.pis.map(p => `${ov(r.piStr(p))} (${p.cov.join(',')})${r.useful.includes(p) ? '' : ' <i>covers only don\'t-cares, so it never enters the chart</i>'}`).join(', ')}.` });
  const head = ['PI', ...c.ones.map(m => String(m))];
  const chart = mark => tbl(head, r.useful.map(p => [`${r.epi.includes(p) && mark ? '<b>' : ''}${ov(r.piStr(p))}${r.epi.includes(p) && mark ? ' *</b>' : ''}`, ...c.ones.map(m => p.cov.includes(m) ? (mark && r.resp.get(p)?.includes(m) ? '<b class="bad">⊗</b>' : '×') : '')]), 'pichart');
  F.push({ html: chart(false), cap: 'Prime implicant chart: a row per PI, a column per minterm (don\'t-cares are not columns), × where the PI covers it.' });
  F.push({ html: chart(true), cap: `A column with a single × makes its PI <b>essential</b> (⊗ marks it): ${r.epi.map(p => ov(r.piStr(p))).join(', ') || 'none'}.` });
  F.push({ html: chart(true), cap: `Cover the remaining columns with the fewest PIs. <b>F = ${ov(r.sop)}</b>${r.all.length > 1 ? ` (also minimal: ${ov(r.all.slice(1).join(' ; '))})` : ''}.` });
  stepper(sel, F, { tag: 'Tabulation · step through' });
}

// ---------- gate drawings ----------
function gateShape(t, x, y, w, h) { // t: and|or|nand|nor|not ; returns svg path markup, output point
  const bub = /^n(and|or)$|^not$/.test(t), bx = x + w;
  let p;
  if (t === 'and' || t === 'nand') p = `M${x},${y} h${w / 2} a${h / 2},${h / 2} 0 0 1 0,${h} h${-w / 2} z`;
  else if (t === 'not') p = `M${x},${y} L${x + w - 6},${y + h / 2} L${x},${y + h} z`;
  else p = `M${x},${y} q${w * .3},${h / 2} 0,${h} q${w * .6},0 ${w},${-h / 2} q${-w * .4},${-h / 2} ${-w},${-h / 2} z`;
  return { svg: `<path class="gt" d="${p}"/>` + (bub ? `<circle class="gt" cx="${bx + 4}" cy="${y + h / 2}" r="4"/>` : ''), out: [bx + (bub ? 8 : 0), y + h / 2] };
}
function gates(sel, c) {
  const form = c.form || 'and-or', vars = c.vars, sop = /^(or-and|nor-nor)$/.test(form);
  // terms: SOP "ab' + c" -> [['a','b\''],['c']] ; POS "(a+b')(c)" -> [['a','b\''],['c']]
  const terms = sop ? [...c.expr.matchAll(/\(([^)]*)\)|([A-Za-z][0-9]*'?)/g)].map(m => m[1] ? m[1].split('+').map(s => s.trim()) : [m[2]])
    : c.expr.split('+').map(t => { const out = []; const names = [...vars].sort((a, b) => b.length - a.length); let i = 0; t = t.trim(); while (i < t.length) { const nm = names.find(v => t.startsWith(v, i)); if (!nm) { i++; continue; } i += nm.length; let s = nm; if (t[i] === "'") { s += "'"; i++; } out.push(s); } return out; });
  const t1 = { 'and-or': 'and', 'nand-nand': 'nand', 'or-and': 'or', 'nor-nor': 'nor' }[form], t2 = { 'and-or': 'or', 'nand-nand': 'nand', 'or-and': 'and', 'nor-nor': 'nor' }[form];
  const GH = 14, gap = 12, x1 = 70, gw = 42, x2 = 210;
  let y = 12, s = '', outs = [];
  const flip = l => l.endsWith("'") ? l.slice(0, -1) : l + "'";
  terms.forEach(t => {
    if (t.length === 1) { const lit = (form === 'nand-nand' || form === 'nor-nor') ? flip(t[0]) : t[0]; s += `<text class="lb" x="${x1 - 8}" y="${y + 8}" style="text-anchor:end">${ovs(lit)}</text>`; outs.push([x1, y + 8]); y += 16 + gap; return; }
    const h = Math.max(26, t.length * GH);
    t.forEach((l, i) => { const ly = y + (i + .5) * h / t.length; s += `<text class="lb" x="${x1 - 32}" y="${ly}" style="text-anchor:end">${ovs(l)}</text><line class="wr" x1="${x1 - 28}" y1="${ly}" x2="${x1}" y2="${ly}"/>`; });
    const g = gateShape(t1, x1, y, gw, h); s += g.svg; outs.push(g.out); y += h + gap;
  });
  const H = Math.max(y, 40), gh = Math.max(30, outs.length * 12), gy = H / 2 - gh / 2;
  outs.forEach(([ox, oy], i) => { const ty = gy + (i + .5) * gh / outs.length; s += `<path class="wr" d="M${ox},${oy} H${x2 - 30} V${ty} H${x2}"/>`; });
  const g2 = outs.length > 1 ? gateShape(t2, x2, gy, gw, gh) : null;
  if (g2) s += g2.svg + `<line class="wr" x1="${g2.out[0]}" y1="${g2.out[1]}" x2="${g2.out[0] + 20}" y2="${g2.out[1]}"/><text class="lb" x="${g2.out[0] + 30}" y="${g2.out[1]}">${c.out || 'F'}</text>`;
  const W = x2 + gw + 60;
  host(sel).innerHTML = `<div class="fg-wrap"><svg class="dsa-fig gates" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${form} circuit">${s}</svg><div class="figlabel">${form.toUpperCase()} · ${ov(c.expr)}</div></div>`;
}

// ---------- MUX / decoder implementation ----------
function muxSVG(k, ins, selNames, o = {}) {
  const N = 1 << k, h = Math.max(N * 22 + 20, 70), x = 120, w = Math.max(60, k * 40);
  let s = `<path class="gt" d="M${x},10 L${x + w},${30} L${x + w},${h - 10} L${x},${h + 10} z"/><text class="lb" x="${x + w / 2}" y="${h / 2 + 10}">${N}×1</text><text class="sm" x="${x + w / 2}" y="${h / 2 + 24}">MUX</text>`;
  ins.forEach((t, i) => { const y = 30 + i * 22; const on = o.on === i; s += `<line class="wr${on ? ' on' : ''}" x1="${x - 60}" y1="${y}" x2="${x}" y2="${y}"/><text class="sm" x="${x + 12}" y="${y + 3}">I${i}</text><text class="lb${on ? ' onl' : ''}" x="${x - 64}" y="${y}" style="text-anchor:end">${ovs(t)}</text>`; });
  selNames.forEach((t, j) => { const sx = x + 14 + j * (w - 20) / Math.max(1, selNames.length - 1 || 1); s += `<line class="wr" x1="${sx}" y1="${h + 4}" x2="${sx}" y2="${h + 34}"/><text class="sm" x="${sx}" y="${h + 46}">S${k - 1 - j}=${ovs(t)}</text>`; });
  (o.en || []).forEach((e, j) => { const ex = x + 10 + j * 26; s += `<line class="wr" x1="${ex}" y1="${14 + j * 2}" x2="${ex}" y2="-6"/><text class="sm" x="${ex}" y="-10">${esc(e)}</text>`; });
  s += `<line class="wr${o.on !== undefined ? ' on' : ''}" x1="${x + w}" y1="${h / 2 + 10}" x2="${x + w + 40}" y2="${h / 2 + 10}"/><text class="lb" x="${x + w + 52}" y="${h / 2 + 10}">${o.out || 'F'}${o.val !== undefined ? ' = ' + o.val : ''}</text>`;
  return `<svg class="dsa-fig mux" viewBox="-10 -24 ${x + w + 90} ${h + 76}" width="${x + w + 100}" role="img" aria-label="multiplexer">${s}</svg>`;
}
function residTable(c, R) {
  const vars = c.vars, sel = c.sel || [0, 1], k = sel.length;
  return tbl([sel.map(i => vars[i]).join(''), 'minterms in this slice', 'F as a function of ' + vars.filter((_, i) => !sel.includes(i)).join(', '), c.dec ? 'decoder output' : 'MUX input'],
    R.map(r => [L.bin(r.s, k), r.mins.map(m => c.ones.includes(m) ? `<b>${m}</b>` : (c.dc || []).includes(m) ? `<i>${m}d</i>` : `<span class="muted">${m}</span>`).join(' '), ov(r.expr), c.dec ? `${c.low ? 'D' + r.s + "'" : 'D' + r.s}` : 'I' + r.s]));
}
function muxImpl(sel, c) {
  const el = host(sel), vars = c.vars, n = vars.length, S = c.sel || [0, 1], R = L.residues(n, c.ones, c.dc || [], S, vars);
  const st = Object.fromEntries(vars.map(v => [v, 0]));
  const paint = () => {
    const x = vars.reduce((a, v, i) => a | (st[v] << (n - 1 - i)), 0), s = S.reduce((a, vi, j) => a | (st[vars[vi]] << (S.length - 1 - j)), 0);
    const val = c.ones.includes(x) ? 1 : (c.dc || []).includes(x) ? 'x' : 0;
    el.querySelector('.mx-fig').innerHTML = muxSVG(S.length, R.map(r => r.expr), S.map(i => vars[i]), { on: s, val, en: c.en, out: c.out });
    el.querySelector('.mx-st').innerHTML = `Input ${vars.map(v => v + '=' + st[v]).join(' ')} → minterm ${x}: select lines pick <b>I${s}</b> = ${ov(R[s].expr)}, so F = ${val}.`;
  };
  el.innerHTML = `<span class="anim-tag">live MUX · flip the inputs</span>${residTable(c, R)}<div class="mx-ctl">${vars.map(v => `<button type="button" class="must-b" data-v="${v}">${v} = 0</button>`).join(' ')}</div><div class="mx-fig fg-wrap"></div><p class="tracer-hint mx-st"></p>`;
  el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { st[b.dataset.v] ^= 1; b.textContent = `${b.dataset.v} = ${st[b.dataset.v]}`; paint(); });
  paint(); tex(el);
}
function decImpl(sel, c) {
  const el = host(sel), vars = c.vars, n = vars.length, S = c.sel || [0, 1], R = L.residues(n, c.ones, c.dc || [], S, vars), k = S.length;
  const terms = R.filter(r => r.expr !== '0').map(r => (r.expr === '1' ? '' : '(' + r.expr + ')·') + `D${r.s}`);
  el.innerHTML = `${residTable({ ...c, dec: 1 }, R)}<p><b>F = ${ov(terms.join(' + ') || '0')}</b>${c.low ? ` <span class="tracer-hint">(Di = the selected-line signal. With active-low outputs the wire is Di', low when selected, so feed the wires into a NAND for "OR of minterms", or an AND to get F'.)</span>` : ''}</p>`;
  tex(el); return R;
}

// ---------- PLA ----------
function plaFig(sel, c) {
  const vars = c.vars, n = vars.length, P = L.pla(n, c.fns, c.dcs || [], vars), names = c.names || c.fns.map((_, i) => 'F' + (i + 1));
  const head = ['Product term', ...vars, ...names.map((f, i) => `${f} (${P.tc[i]})`)];
  const rows = P.rows.map((r, i) => [`${i + 1}. ${ov(r.term)}`, ...r.bits.split(''), ...r.out.map(o => o ? '1' : '–')]);
  const cw = 30, ax = 40 + n * 2 * cw, W = ax + names.length * cw + 160, rh = 30, H = 70 + P.rows.length * rh + 90;
  let s = '';
  vars.forEach((v, i) => { const x = 40 + i * 2 * cw; s += `<text class="lb" x="${x + cw / 2}" y="12">${v}</text><line class="wr" x1="${x + 6}" y1="22" x2="${x + 6}" y2="${H - 80}"/><line class="wr" x1="${x + 6 + cw}" y1="22" x2="${x + 6 + cw}" y2="${H - 80}"/><text class="sm" x="${x + 6}" y="36">${v}</text><text class="sm" x="${x + 6 + cw}" y="36"><tspan>${v}'</tspan></text>`; });
  P.rows.forEach((r, i) => {
    const y = 56 + i * rh; s += `<line class="wr" x1="20" y1="${y}" x2="${ax + 6}" y2="${y}"/>`;
    r.bits.split('').forEach((b, j) => { if (b === '-') return; const x = 40 + j * 2 * cw + 6 + (b === '0' ? cw : 0); s += `<text class="fuse" x="${x}" y="${y + 4}">×</text>`; });
    const g = gateShape('and', ax + 6, y - 9, 24, 18); s += g.svg; s += `<line class="wr" x1="${g.out[0]}" y1="${y}" x2="${ax + 40 + names.length * cw}" y2="${y}"/><text class="sm" x="${ax + 18}" y="${y + 3}">${i + 1}</text>`;
    r.out.forEach((o, f) => { if (o) s += `<text class="fuse" x="${ax + 50 + f * cw}" y="${y + 4}">×</text>`; });
  });
  names.forEach((f, i) => { const x = ax + 50 + i * cw, yb = 56 + P.rows.length * rh; s += `<line class="wr" x1="${x}" y1="44" x2="${x}" y2="${yb}"/>`; const g = gateShape('or', x - 10, yb, 20, 20); s += `<g transform="rotate(90 ${x} ${yb + 10})">${g.svg}</g><text class="sm" x="${x}" y="${yb + 44}">${P.tc[i] === 'C' ? '⊕1' : '⊕0'}</text><text class="lb" x="${x}" y="${yb + 60}">${f}</text>`; });
  host(sel).innerHTML = `${tbl(head, rows)}<p class="tracer-hint">Inputs: 1 = true literal, 0 = complemented, – = not connected. Outputs: 1 = term feeds that OR gate, T = true output (XOR with 0), C = complemented (XOR with 1). ${P.count} distinct product terms. ${names.map((f, i) => `${f}${P.tc[i] === 'C' ? "'" : ''} = ${ov(P.exprs[i])}`).join(' ; ')}</p><div class="fg-wrap"><svg class="dsa-fig pla" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="PLA fuse map">${s}</svg></div>`;
  tex(host(sel)); return P;
}

// ---------- state diagrams ----------
function diagSVG(M, o = {}) { // M: Mealy {S,I,t} or Moore {S,I,t,z}
  const moore = !!M.z, N = M.S.length, R0 = 22, rad = Math.max(70, N * 24), cx = rad + 85, cy = rad + 70;
  const P = {}; M.S.forEach((s, i) => { const a = -Math.PI / 2 + 2 * Math.PI * i / N; P[s] = [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; });
  const E = new Map();
  M.S.forEach(s => M.t[s].forEach((cell, i) => { const n = moore ? cell : cell[0], z = moore ? null : cell[1]; if (!n) return; const k = s + '>' + n; if (!E.has(k)) E.set(k, []); E.get(k).push(moore ? M.I[i] : `${M.I[i]}/${z ?? '-'}`); }));
  let s = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--muted)"/></marker><marker id="ahh" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--amber)"/></marker></defs>`;
  for (const [k, labs] of E) {
    const [a, b] = k.split('>'), on = o.edge === k, cls = `ed${on ? ' cur' : ''}`, mk = on ? 'ahh' : 'ah';
    if (a === b) { const [x, y] = P[a], dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, lx = x + ux * (R0 + 22), ly = y + uy * (R0 + 22);
      const p1 = [x + (ux * Math.cos(.5) - uy * Math.sin(.5)) * R0, y + (uy * Math.cos(.5) + ux * Math.sin(.5)) * R0], p2 = [x + (ux * Math.cos(-.5) - uy * Math.sin(-.5)) * R0, y + (uy * Math.cos(-.5) + ux * Math.sin(-.5)) * R0];
      s += `<path class="${cls}" marker-end="url(#${mk})" d="M${p1[0]},${p1[1]} C${lx + uy * 30},${ly - ux * 30} ${lx - uy * 30},${ly + ux * 30} ${p2[0]},${p2[1]}"/><text class="dl${on ? ' on' : ''}" x="${lx + ux * 14}" y="${ly + uy * 14}">${esc(labs.join(', '))}</text>`; continue; }
    const [x1, y1] = P[a], [x2, y2] = P[b], dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d, bend = E.has(b + '>' + a) ? 22 : 10;
    const mx = (x1 + x2) / 2 - uy * bend, my = (y1 + y2) / 2 + ux * bend;
    const sx = x1 + ux * R0, sy = y1 + uy * R0, ex = x2 - ux * (R0 + 2), ey = y2 - uy * (R0 + 2);
    s += `<path class="${cls}" marker-end="url(#${mk})" d="M${sx},${sy} Q${mx * 2 - (sx + ex) / 2},${my * 2 - (sy + ey) / 2} ${ex},${ey}"/><text class="dl${on ? ' on' : ''}" x="${mx - uy * 8}" y="${my + ux * 8}">${esc(labs.join(', '))}</text>`;
  }
  M.S.forEach(st => { const [x, y] = P[st], on = o.state === st; s += `<circle class="nd${on ? ' cur' : ''}" cx="${x}" cy="${y}" r="${R0}"/>${o.start === st ? `<circle class="db" cx="${x}" cy="${y}" r="${R0 - 4}"/>` : ''}<text class="tx" x="${x}" y="${moore ? y - 6 : y}" style="font-size:${st.length > 3 ? 10 : 13}px">${esc(st)}</text>${moore ? `<text class="vl" x="${x}" y="${y + 9}">${esc(M.z[st] ?? '-')}</text>` : ''}`; });
  const W = 2 * cx, H = 2 * cy;
  return `<svg class="dsa-fig sd" viewBox="0 0 ${W} ${H}" width="${Math.min(W, 520)}" role="img" aria-label="state diagram">${s}</svg>`;
}
function stateTableHTML(M) {
  const moore = !!M.z;
  const ih = i => /^[01]$/.test(i) ? `x=${i}` : i;
  return tbl(['PS', ...M.I.map(ih), ...(moore ? ['z'] : [])], M.S.map(s => [s, ...M.t[s].map(c => moore ? (c ?? '–') : `${c[0] ?? '–'}, ${c[1] ?? '–'}`), ...(moore ? [M.z[s] ?? '–'] : [])]));
}
function diagram(sel, c) {
  const M = c.M || asTable(c.table), el = host(sel), start = c.start || M.S[0];
  if (c.inputs) M.I = c.inputs;
  if (!c.run) { el.innerHTML = `<div class="figrow"><div class="fg-wrap">${diagSVG(M, { start })}</div><div>${stateTableHTML(M)}</div></div>`; return; }
  const toks = Array.isArray(c.run) ? c.run : /\s/.test(c.run.trim()) ? c.run.trim().split(/\s+/) : [...c.run], xs = toks.map(ch => M.I.indexOf(ch)), F = [];
  if (xs.includes(-1)) { el.textContent = 'run: unknown input symbol (inputs are ' + M.I.join(', ') + ')'; return; }
  let s = start, outs = '';
  F.push({ html: `<div class="fg-wrap">${diagSVG(M, { state: s, start })}</div>`, cap: `Start in ${s}. Input string ${toks.join(' ')}.` });
  xs.forEach((x, k) => {
    const cell = M.t[s][x], n = M.z ? cell : cell[0], z = M.z ? M.z[n] : cell[1];
    outs += (z ?? '-');
    F.push({ html: `<div class="fg-wrap">${diagSVG(M, { state: s, edge: s + '>' + n, start })}</div>`, cap: `Clock ${k + 1}: in ${s}, input ${M.I[x]} → go to ${n}${M.z ? `; Moore output is the output of the new state: ${z}` : `; Mealy output on this arrow: ${z}`}. Outputs so far: <b>${outs}</b>` });
    s = n;
    F.push({ html: `<div class="fg-wrap">${diagSVG(M, { state: s, start })}</div>`, cap: `Now in ${s}. Outputs so far: <b>${outs}</b>` });
  });
  el.innerHTML = `<div class="dg-run"></div><details class="must-model"><summary>State table</summary>${stateTableHTML(M)}</details>`;
  stepper(el.querySelector('.dg-run'), F, { tag: 'run the machine', speed: 1100 });
}
function mealyMoore(sel, c) {
  const el = host(sel), M = asTable(c.table); if (c.inputs) M.I = c.inputs;
  const Mo = L.mealyToMoore(M, c.start), inc = {};
  M.S.forEach(s => inc[s] = []); M.S.forEach(s => M.t[s].forEach(([n, o], i) => n && inc[n].push(`${s} --${M.I[i]}/${o}--> ${n}`)));
  const split = M.S.map(s => [s, inc[s].map(esc).join('<br>') || '(none)', [...new Set(M.S.flatMap(p => M.t[p].filter(([n]) => n === s).map(([, o]) => o)))].join(', ') || '–', Mo.S.filter(x => x === s || (x.startsWith(s) && x.length === s.length + 1)).join(', ')]);
  const F = [
    { html: `<div class="figrow"><div class="fg-wrap">${diagSVG(M)}</div><div>${stateTableHTML(M)}</div></div>`, cap: 'The Mealy machine: outputs sit on the arrows (input/output).' },
    { html: tbl(['state', 'arrows coming in', 'outputs on them', 'Moore state(s)'], split), cap: 'Step 1: for every state, look at the outputs on the arrows coming <b>into</b> it. One output value → keep the state and give it that output. Two values → split it into two states, one per output (A0, A1).' },
    { html: `<div class="figrow"><div>${stateTableHTML(Mo)}</div></div>`, cap: 'Step 2: each new state copies the next-state row of the state it came from, but an arrow that used to arrive with output z now goes to the copy that has output z.' },
    { html: `<div class="figrow"><div class="fg-wrap">${diagSVG(Mo)}</div></div>`, cap: `The Moore machine: the output is written inside each state.${Mo.noInc.length ? ` ${Mo.noInc.join(', ')} has no incoming arrow, so its output is free (write either).` : ''}` },
  ];
  el.innerHTML = '<div class="mm-steps"></div><div class="mm-time"></div>';
  stepper(el.querySelector('.mm-steps'), F, { tag: 'Mealy → Moore' });
  if (c.run) {
    const xs = [...c.run].map(ch => M.I.indexOf(ch));
    let a = c.start || M.S[0], b = Mo.start; const me = [], mo = [Mo.z[b] ?? 0], st = [a];
    xs.forEach(x => { const [n, o] = M.t[a][x]; me.push(o); a = n; st.push(a); b = Mo.t[b][x]; mo.push(Mo.z[b]); });
    const bits = s => s.map(v => v === null ? 0 : +v);
    el.querySelector('.mm-time').innerHTML = `<h4>Same input, two machines</h4>` + timingSVG({ x: xs.map(x => +M.I[x] || 0), 'Mealy z': bits(me), 'Moore z': bits(mo.slice(0, xs.length)) }, { clock: true, note: `Period i: the machine sits in one state and sees input x. Mealy z is computed from (state, x) during that same period, so it reacts to x at once. Moore z depends only on the state, so the effect of x shows up one period later, after the clock edge moves the machine. Here Moore z is Mealy z shifted right by one clock (the first Moore value is the start state's output, ${mo[0] ?? 0}).` });
  }
}

// ---------- timing diagrams ----------
function timingSVG(sig, o = {}) {
  const names = Object.keys(sig), n = Math.max(...names.map(k => sig[k].length)), cw = 36, x0 = 70, rh = 34, H = (names.length + (o.clock ? 1 : 0)) * rh + 16, W = x0 + n * cw + 10;
  let s = '', row = 0;
  if (o.clock) { let d = ''; for (let i = 0; i < n; i++) { const x = x0 + i * cw; d += `${i ? 'L' : 'M'}${x},${10 + 20} L${x},10 L${x + cw / 2},10 L${x + cw / 2},30 L${x + cw},30 `; } s += `<text class="lb" x="${x0 - 8}" y="20" style="text-anchor:end">clk</text><path class="wave clk" d="${d}"/>`; row = 1; for (let i = 0; i <= n; i++) s += `<line class="tick" x1="${x0 + i * cw}" y1="6" x2="${x0 + i * cw}" y2="${H - 4}"/>`; }
  names.forEach((k, r) => { const y = 10 + (r + row) * rh, v = sig[k]; let d = `M${x0},${y + 20 - 20 * v[0]}`; v.forEach((b, i) => { const yy = y + 20 - 20 * b; d += ` L${x0 + i * cw},${yy} L${x0 + (i + 1) * cw},${yy}`; }); s += `<text class="lb" x="${x0 - 8}" y="${y + 10}" style="text-anchor:end">${esc(k)}</text><path class="wave" d="${d}"/>${v.map((b, i) => `<text class="sm" x="${x0 + i * cw + cw / 2}" y="${y + 33}">${b}</text>`).join('')}`; });
  return `<div class="fg-wrap"><svg class="dsa-fig timing" viewBox="0 0 ${W} ${H + 8}" width="${W}" role="img" aria-label="timing diagram">${s}</svg>${o.note ? `<p class="tracer-hint">${o.note}</p>` : ''}</div>`;
}
const timing = (sel, c) => { host(sel).innerHTML = timingSVG(c.signals, c); };

// ---------- counter lab ----------
function counterLab(sel, c) {
  const el = host(sel), bits = c.bits, R = L.counter(c.seq, bits, c.ff), sv = R.spec.sv, ff = R.spec.ff;
  const head = ['PS ' + sv.join(''), 'NS ' + sv.join(''), ...sv.flatMap((s, b) => L.FF[ff[b]].ins.map(nm => nm + s.slice(1)))];
  const rows = L.range(1 << bits).map(ps => { const r = R.table.find(t => t.ps === ps); return r ? [L.bin(ps, bits) + ` (${ps})`, L.bin(r.ns, bits) + ` (${r.ns})`, ...sv.flatMap((s, b) => L.FF[ff[b]].ins.map(nm => r.ex[nm + s]))] : [L.bin(ps, bits) + ` (${ps})`, 'unused', ...sv.flatMap((s, b) => L.FF[ff[b]].ins.map(() => 'x'))]; });
  const maps = Object.keys(R.maps).map(k => { const m = R.maps[k], e = R.eq[k]; return `<div><div class="figlabel">${k.replace(/Q(\d)/, '$1')} = ${ov(e.sop)}</div>${kmapSVG(R.vars, valsOf(bits, m.ones, m.dc), (e.sols[0] || []).map((q, j) => ({ cube: q, color: COL[j] })))}</div>`; }).join('');
  const un = R.unused.map(u => `${u.s} → ${u.path.slice(1).map(x => x === null ? '?' : x).join(' → ')} ${u.ok ? '<span class="good">(enters the count)</span>' : '<span class="bad">(lock-out or invalid SR input)</span>'}`).join('<br>') || 'none';
  el.innerHTML = `<span class="anim-tag">counter design · ${ff.join(', ')}</span>${tbl(head, rows)}<p class="tracer-hint">Excitation: D = Q⁺ ; T = Q⊕Q⁺ ; JK: 0→0 = 0x, 0→1 = 1x, 1→0 = x1, 1→1 = x0 ; SR: 0→0 = 0x, 0→1 = 10, 1→0 = 01, 1→1 = x0. Unused states are don't-cares (x).</p><div class="figrow">${maps}</div><p><b>Unused states with these equations:</b><br>${un}</p><div class="cl-run"></div>`;
  // animated run
  const run = el.querySelector('.cl-run'); let cur = c.seq[0], hist = [cur], timer = null;
  const paint = () => {
    const wav = {}; sv.forEach((s, b) => wav[s] = hist.map(v => (v >> (bits - 1 - b)) & 1));
    run.innerHTML = `<div class="leds">${sv.map((s, b) => `<span class="led${(cur >> (bits - 1 - b)) & 1 ? ' on' : ''}">${s}<b>${(cur >> (bits - 1 - b)) & 1}</b></span>`).join('')}<span class="tracer-hint">count = ${cur}</span></div><div class="st-ctl"><button type="button" data-c>Clock ↑</button><button type="button" data-p>${timer ? '⏸ Pause' : '▶ Run'}</button><button type="button" data-r>Reset</button>${R.unused.length ? `<button type="button" data-u>Start in unused ${R.unused[0].s}</button>` : ''}</div>` + timingSVG(wav, { clock: true });
    run.querySelector('[data-c]').onclick = tick; run.querySelector('[data-r]').onclick = () => { cur = c.seq[0]; hist = [cur]; paint(); };
    run.querySelector('[data-p]').onclick = () => { if (timer) { clearInterval(timer); timer = null; } else timer = setInterval(tick, 700); paint(); };
    const u = run.querySelector('[data-u]'); if (u) u.onclick = () => { cur = R.unused[0].s; hist = [cur]; paint(); };
  };
  const tick = () => { const n = L.step(R.spec, R.eq, cur); cur = n === null ? cur : n; hist.push(cur); if (hist.length > 14) hist.shift(); paint(); };
  paint(); return R;
}

// ---------- shift registers ----------
function shiftLab(sel, c) {
  const el = host(sel), n = c.n || 4, kind = c.kind || 'ring'; let q = [...(c.init || (kind === 'ring' ? '1' + '0'.repeat(n - 1) : '0'.repeat(n)))].map(Number), hist = [q.slice()], serial = c.serial || '1011', si = 0, fix = false;
  const nextQ = () => {
    let inb;
    if (kind === 'ring') inb = fix ? +q.slice(0, n - 1).every(b => !b) : q[n - 1];
    else if (kind === 'johnson') inb = 1 - q[n - 1];
    else inb = +serial[si++ % serial.length];
    return [inb, ...q.slice(0, n - 1)];
  };
  const paint = () => {
    const wav = {}; q.forEach((_, i) => wav['Q' + i] = hist.map(h => h[i]));
    el.innerHTML = `<span class="anim-tag">${kind} register · ${n} bits</span><div class="shift">${q.map((b, i) => `<span class="ffbox${b ? ' on' : ''}">Q${i}<b>${b}</b></span>${i < n - 1 ? '<span class="arr">→</span>' : ''}`).join('')}<span class="fb">${kind === 'ring' ? (fix ? 'D0 = NOR(Q0..Q' + (n - 2) + ')' : 'D0 = Q' + (n - 1)) : kind === 'johnson' ? `D0 = Q${n - 1}'` : 'serial in: ' + serial}</span></div>
    <div class="st-ctl"><button type="button" data-c>Clock ↑</button><button type="button" data-r>Reset</button>${kind === 'ring' ? `<button type="button" data-b>Load a bad state (1010…)</button><button type="button" data-f>${fix ? 'Self-correction ON' : 'Self-correction OFF'}</button>` : ''}<span class="st-count">${hist.length - 1} clocks</span></div>${timingSVG(wav, { clock: true, note: kind === 'ring' ? `A ${n}-bit ring counter has ${n} states (one 1 circulating). Johnson: ${2 * n} states, decode each with a 2-input AND.` : kind === 'johnson' ? `${2 * n} states: fills with 1s then with 0s. Each state is decoded with one 2-input gate.` : 'Each clock moves every bit one place right; serial in on the left.' })}`;
    el.querySelector('[data-c]').onclick = () => { q = nextQ(); hist.push(q.slice()); if (hist.length > 16) hist.shift(); paint(); };
    el.querySelector('[data-r]').onclick = () => { q = [...(c.init || (kind === 'ring' ? '1' + '0'.repeat(n - 1) : '0'.repeat(n)))].map(Number); hist = [q.slice()]; si = 0; paint(); };
    const b = el.querySelector('[data-b]'); if (b) b.onclick = () => { q = L.range(n).map(i => +(i % 2 === 0)); hist = [q.slice()]; paint(); };
    const f = el.querySelector('[data-f]'); if (f) f.onclick = () => { fix = !fix; paint(); };
  };
  paint();
}

// ---------- flip-flop bench ----------
function ffLab(sel, c) {
  const el = host(sel), t = c.type || 'JK'; const st = { S: 0, R: 0, D: 0, J: 0, K: 0, T: 0, clk: 0, Q: 0, Qm: 0 }, hist = []; let timer = null, note = '';
  const ins = { SR: ['S', 'R'], D: ['D', 'clk'], 'D-edge': ['D'], JK: ['J', 'K', 'clk'], 'JK-edge': ['J', 'K'], MSJK: ['J', 'K', 'clk'], T: ['T'] }[t];
  const rec = () => { hist.push({ ...st }); if (hist.length > 24) hist.shift(); };
  const settle = () => {
    note = '';
    if (t === 'SR') { if (st.S && st.R) note = 'S = R = 1: both NOR outputs forced to 0, so Q = Q\' = 0 (not complements). When both go back to 0 together the latch races and lands unpredictably: the forbidden input.'; else if (st.S) st.Q = 1; else if (st.R) st.Q = 0; }
    if (t === 'D' && st.clk) st.Q = st.D;
    if (t === 'JK') { clearInterval(timer); timer = null; if (st.clk && st.J && st.K) { note = 'Race-around: clock is still high, J = K = 1, so Q keeps toggling through the gate delay loop until the clock falls. Fix: master-slave or edge triggering, or a pulse narrower than the loop delay.'; timer = setInterval(() => { st.Q ^= 1; rec(); draw(); }, 280); } else if (st.clk) st.Q = st.J && !st.K ? 1 : !st.J && st.K ? 0 : st.Q; }
    if (t === 'MSJK') { if (st.clk) { st.Qm = st.J && st.K ? 1 - st.Q : st.J ? 1 : st.K ? 0 : st.Qm; note = 'Clock high: the master follows J, K (using the slave\'s Q, which is frozen). The slave is closed.'; } else note = 'Clock low: the master is closed, the slave copies the master. Each clock pulse can change Q only once: no race-around.'; }
  };
  const draw = () => {
    const wav = {}; [...ins, 'Q'].forEach(k => wav[k] = hist.map(h => +h[k])); if (t === 'MSJK') wav.Qm = hist.map(h => +h.Qm);
    el.innerHTML = `<span class="anim-tag">${t} bench</span><div class="mx-ctl">${ins.map(k => `<button type="button" class="must-b" data-k="${k}">${k} = ${+st[k]}</button>`).join(' ')}${/edge|^T$/.test(t) ? '<button type="button" class="must-b" data-e>clock edge ↑</button>' : ''}</div><div class="leds"><span class="led${st.Q ? ' on' : ''}">Q<b>${+st.Q}</b></span><span class="led${t === 'SR' && st.S && st.R ? '' : !st.Q ? ' on' : ''}">Q'<b>${t === 'SR' && st.S && st.R ? 0 : +!st.Q}</b></span>${t === 'MSJK' ? `<span class="led${st.Qm ? ' on' : ''}">master<b>${+st.Qm}</b></span>` : ''}</div><p class="tracer-hint">${note}</p>${timingSVG(wav, {})}`;
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const k = b.dataset.k, was = st.clk; st[k] = 1 - st[k]; if (t === 'MSJK' && k === 'clk' && was && !st.clk) st.Q = st.Qm; settle(); rec(); draw(); });
    const e = el.querySelector('[data-e]'); if (e) e.onclick = () => { if (t === 'D-edge') st.Q = st.D; else if (t === 'JK-edge') st.Q = st.J && st.K ? 1 - st.Q : st.J ? 1 : st.K ? 0 : st.Q; else if (t === 'T') st.Q = st.T ? 1 - st.Q : st.Q; rec(); draw(); };
  };
  rec(); draw();
}

// ---------- state minimization ----------
function partitionAnim(sel, c) {
  const M = asTable(c.table), R = L.partitions(M), F = [], P = R.P;
  const fmt = p => p.map(b => '(' + b.join('') + ')').join(' ');
  F.push({ html: stateTableHTML(M), cap: 'Completely specified machine. Two states are equivalent if every input sequence gives the same output sequence from both.' });
  F.push({ html: `<p class="formula">P<sub>0</sub> = (${M.S.join('')})</p><p class="formula">P<sub>1</sub> = ${fmt(P[0])}</p>`, cap: 'P0 = all states in one block. P1: split by output rows (states with identical outputs for every input stay together). Every block is a candidate class.' });
  for (let k = 1; k < P.length; k++) {
    const prev = P[k - 1], blk = s => prev.findIndex(b => b.includes(s)) + 1;
    const why = tbl(['state', ...M.I.map(i => (/^[01]$/.test(i) ? 'x=' + i : i) + ' → block'), ''], M.S.map(s => [s, ...M.t[s].map(([n]) => `${n} (${blk(n)})`), '']));
    F.push({ html: `${why}<p class="formula">P<sub>${k + 1}</sub> = ${fmt(P[k])}</p>`, cap: `P${k + 1}: inside each block of P${k}, keep states together only if, for every input, their next states land in the same block of P${k} (block numbers in brackets).` });
  }
  F.push({ html: `<p class="formula">P<sub>${P.length + 1}</sub> = ${fmt(P[P.length - 1])} = P<sub>${P.length}</sub></p>${stateTableHTML(R.min)}`, cap: `No block splits any more, so this is the equivalence partition. ${R.classes.filter(b => b.length > 1).map(b => b.join(' ≡ ')).join(', ') || 'No two states are equivalent'}. Rename each block to its first state: ${M.S.length} states → ${R.min.S.length}.` });
  stepper(sel, F, { tag: 'partition method' }); return R;
}
function impSVG(M, imp, upto) {
  const S = M.S, C = 54, x0 = 30, y0 = 8, n = S.length;
  let s = '';
  for (let i = 1; i < n; i++) { s += `<text class="lb" x="${x0 - 12}" y="${y0 + (i - 1) * C + C / 2}">${S[i]}</text>`; for (let j = 0; j < i; j++) { const c = imp.cell[imp.key(S[i], S[j])], x = x0 + j * C, y = y0 + (i - 1) * C, dead = c.x && c.x <= upto;
    s += `<rect class="kc${dead ? ' dead' : ''}" x="${x}" y="${y}" width="${C}" height="${C}"/>`;
    if (c.x === 1 && upto >= 1) s += `<text class="kv bad" x="${x + C / 2}" y="${y + C / 2 + 2}">×</text>`;
    else { c.pairs.forEach((p, k) => s += `<text class="sm" x="${x + C / 2}" y="${y + 12 + k * 11}">${p.join('')}</text>`); if (!c.pairs.length) s += `<text class="kv good" x="${x + C / 2}" y="${y + C / 2 + 2}">✓</text>`; if (dead) s += `<line class="cross" x1="${x + 4}" y1="${y + 4}" x2="${x + C - 4}" y2="${y + C - 4}"/><text class="km" x="${x + C - 4}" y="${y + C - 4}">p${c.x}</text>`; } } }
  for (let j = 0; j < n - 1; j++) s += `<text class="lb" x="${x0 + j * C + C / 2}" y="${y0 + (n - 1) * C + 14}">${S[j]}</text>`;
  const W = x0 + (n - 1) * C + 10, H = y0 + (n - 1) * C + 24;
  return `<div class="fg-wrap"><svg class="dsa-fig imp" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="implication table">${s}</svg></div>`;
}
function implication(sel, c) {
  const M = asTable(c.table); if (c.inputs) M.I = c.inputs;
  const R = L.reduce(M), imp = R.imp, F = [], complete = M.S.every(s => M.t[s].every(([n, o]) => n !== null && o !== null));
  F.push({ html: stateTableHTML(M), cap: complete ? 'Completely specified machine.' : 'Incompletely specified: a dash is a don\'t-care. Here we look for <b>compatible</b> states (no conflict on every specified input sequence), not equivalent ones.' });
  F.push({ html: impSVG(M, imp, 0), cap: 'Implication table: one cell per pair (staircase). In each cell write the pairs of next states that must also be compatible (implied pairs). A ✓ means nothing is implied.' });
  F.push({ html: impSVG(M, imp, 1), cap: 'First pass: cross (×) every pair whose <b>outputs conflict</b> for some input (a specified 0 against a specified 1).' });
  for (let p = 2; p <= imp.passes; p++) F.push({ html: impSVG(M, imp, p), cap: `Pass ${p}: cross every cell that lists a pair already crossed (marked p${p}). Repeat until a pass crosses nothing.` });
  const comp = imp.compat.map(p => '(' + p.join('') + ')').join(' ') || 'none';
  F.push({ html: impSVG(M, imp, 99), cap: `No more crossings. Compatible pairs: ${comp}.` });
  if (complete) {
    F.push({ html: stateTableHTML(R.min), cap: `Equivalent pairs merge into classes: ${R.cover.map(c => '(' + c.join('') + ')').join(' ')}. Minimal machine has ${R.cover.length} states.` });
  } else {
    F.push({ html: `<p><b>Maximal compatibles</b>: ${R.maxC.map(c => '(' + c.join('') + ')').join(' ')}</p><p><b>Maximal incompatibles</b>: ${R.maxI.map(c => '(' + c.join('') + ')').join(' ')}</p>`, cap: 'Maximal compatible: a set where every pair is compatible and no state can be added (largest cliques of ✓-cells; build them from the right-most column leftwards). Maximal incompatible: same, using the crossed cells.' });
    F.push({ html: `<p class="formula">${R.lower} ≤ minimal states ≤ ${R.upper}</p>`, cap: `Lower bound = size of the largest maximal incompatible (${R.lower}): those states must all be in different rows. Upper bound = min(number of maximal compatibles, number of states) = ${R.upper}.` });
    const cl = tbl(['compatible', ...M.I.map(i => (/^[01]$/.test(i) ? 'x=' + i : i) + ' implies'), ''], R.cover.map(c => [`(${c.join('')})`, ...M.I.map((_, i) => { const s = [...new Set(c.map(st => M.t[st][i][0]).filter(Boolean))]; return s.length ? '(' + s.join('') + ')' : '–'; }), '']));
    F.push({ html: `${cl}${stateTableHTML(R.min)}`, cap: `Choose a set of compatibles that (1) covers every state and (2) is <b>closed</b>: every implied set in the table lies inside some chosen compatible. Smallest such set: ${R.cover.map(c => '(' + c.join('') + ')').join(' ')} → ${R.cover.length} states. Outputs: take the specified value; next state: the chosen compatible containing the implied set.` });
  }
  stepper(sel, F, { tag: complete ? 'implication table' : 'compatibles · closed cover' }); return R;
}

// ---------- fundamental mode ----------
function flowHTML(F, cols, hl = {}) {
  return `<div class="tbl"><table class="mat flow"><tr><th>row</th>${cols.map((c, j) => `<th class="${hl.col === j ? 'hl' : ''}">${c}</th>`).join('')}</tr>${F.S.map(r => `<tr><th class="${hl.row === r ? 'hl' : ''}">${r}</th>${F.t[r].map(([n, o], j) => { const stable = n === r, on = hl.row === r && hl.col === j; return `<td class="${on ? (stable ? 'stab' : 'unst') : ''}">${n === null ? '–' : stable ? `<span class="circ">${n}</span>` : n}${o === null ? '' : ', ' + o}</td>`; }).join('')}</tr>`).join('')}</table></div>`;
}
function flowLab(sel, c) {
  const el = host(sel), F = asTable(c.table), cols = c.cols || ['00', '01', '11', '10'];
  let row = c.start || F.S[0], col = c.col ?? 0, log = [], busy = false;
  const paint = (msg = '') => {
    el.innerHTML = `<span class="anim-tag">fundamental mode · change one input</span>${flowHTML(F, cols, { row, col })}<div class="mx-ctl">${cols.map((x, j) => `<button type="button" class="must-b" data-j="${j}" ${j === col ? 'disabled' : ''}>x = ${x}</button>`).join(' ')}</div><p class="tracer-hint">${msg || `Stable in row ${row} under input ${cols[col]}. Output ${F.t[row][col][1] ?? '–'}. Change one input bit (neighbouring column).`}</p><p class="tracer-hint">${log.slice(-6).join('<br>')}</p>`;
    el.querySelectorAll('[data-j]').forEach(b => b.onclick = () => go(+b.dataset.j));
  };
  const go = async j => {
    if (busy) return; busy = true;
    const diff = L.pc(parseInt(cols[j], 2) ^ parseInt(cols[col], 2));
    col = j; paint(diff > 1 ? 'Two inputs changed at once: fundamental mode forbids this (outcome depends on which changes first).' : 'Input changed: move horizontally to the new column, same row.');
    await new Promise(r => setTimeout(r, 900));
    let steps = 0;
    while (F.t[row][col][0] !== row && steps < 6) {
      const n = F.t[row][col][0]; if (n === null) { paint('Unspecified entry: this input change is not allowed from here.'); busy = false; return; }
      log.push(`${cols[col]}: row ${row} is unstable (${n}) → move vertically to row ${n}`); row = n; steps++;
      paint(`Unstable entry: the secondary variables change, so the circuit moves vertically to row ${row}.`); await new Promise(r => setTimeout(r, 900));
    }
    log.push(`${cols[col]}: stable in ${row}, output ${F.t[row][col][1] ?? '–'}`); busy = false; paint();
  };
  paint();
}
function raceFig(sel, c) {
  const F = asTable(c.table), E = L.flowEdges(F), bits = c.bits || Math.max(1, Math.ceil(Math.log2(F.S.length)));
  const found = c.codes || L.assignments(F.S, E, bits)[0];
  const pos = { 0: [40, 40], 1: [200, 40], 3: [200, 160], 2: [40, 160], 4: [100, 90], 5: [260, 90], 7: [260, 210], 6: [100, 210] };
  const codes = found || Object.fromEntries(F.S.map((s, i) => [s, i === 2 ? 3 : i === 3 ? 2 : i]));
  let s = '';
  E.forEach(([a, b]) => { const p = pos[codes[a]], q = pos[codes[b]], bad = L.pc(codes[a] ^ codes[b]) !== 1; s += `<line class="ed${bad ? ' cut' : ' tree'}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`; });
  F.S.forEach(st => { const [x, y] = pos[codes[st]]; s += `<circle class="nd" cx="${x}" cy="${y}" r="18"/><text class="tx" x="${x}" y="${y - 2}">${st}</text><text class="sm" x="${x}" y="${y + 30}">${L.bin(codes[st], bits)}</text>`; });
  host(sel).innerHTML = `<div class="figrow"><div class="fg-wrap"><svg class="dsa-fig" viewBox="0 0 ${bits > 2 ? 300 : 240} ${bits > 2 ? 250 : 200}" width="${bits > 2 ? 300 : 240}" role="img" aria-label="transition diagram">${s}</svg></div><div><p>Required adjacencies (row → row an unstable entry sends to): ${E.map(e => e.join('–')).join(', ')}</p><p>${found ? `<span class="good">Race-free with ${bits} variable${bits > 1 ? 's' : ''}:</span> ${F.S.map(st => `${st} = ${L.bin(found[st], bits)}`).join(', ')}` : `<span class="bad">No ${bits}-variable assignment makes every required pair adjacent</span> (red lines are diagonals: two secondaries change → race). Add a spare row and route through it, or use a 3-variable assignment.`}</p></div></div>`;
}

// ---------- mandatory-practice bookkeeping (localStorage; the page still works without it) ----------
const PAGE = (() => { const m = /dld\/(.*?)(?:\?.*)?$/.exec(location.pathname); return (m && m[1]) || location.pathname.split('/').slice(-2).join('/'); })();
const Must = {
  KEY: 'cse205-must', items: {},
  load() { try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch { return {}; } },
  save(o) { try { localStorage.setItem(this.KEY, JSON.stringify(o)); } catch {} },
  reg(id, need) { this.items[id] = need; },
  got(id) { return (this.load()[PAGE]?.w?.[id]) || 0; },
  add(id, by = 1) { const o = this.load(), p = o[PAGE] ||= { w: {} }; p.w ||= {}; p.w[id] = (p.w[id] || 0) + by; this.sync(o); return p.w[id]; },
  sync(o = this.load()) { const p = o[PAGE] ||= { w: {} }; p.total = Object.values(this.items).reduce((a, b) => a + b, 0); p.done = Object.entries(this.items).reduce((a, [k, n]) => a + Math.min(n, p.w?.[k] || 0), 0); this.save(o); paintToc(o); paintGate(); return p; },
};
function paintToc(o = Must.load()) { document.querySelectorAll('nav.toc a[href]').forEach(a => { const m = /dld\/(.*)$/.exec(a.href); const p = m && o[m[1]]; a.classList.toggle('fin', !!p && p.total > 0 && p.done >= p.total); a.classList.toggle('debt', !!p && !!p.skipped && !(p.done >= p.total)); }); }
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

// ---------- random instances: each returns {q, fmt, check(answer) -> true | 'hint', show(el)} ----------
function mkRng(seed) { let s = seed >>> 0 || 1; const r = () => (s = s * 1664525 + 1013904223 >>> 0) / 4294967296; r.int = (a, b) => a + Math.floor(r() * (b - a + 1)); r.pick = a => a[r.int(0, a.length - 1)]; return r; }
function randFn(r, n, pOne = .45, pDc = .1, minOnes = 3) { for (;;) { const ones = [], dc = []; for (let m = 0; m < 1 << n; m++) { const q = r(); if (q < pOne) ones.push(m); else if (q < pOne + pDc) dc.push(m); } if (ones.length >= minOnes && ones.length + dc.length < (1 << n) - 1) return { ones, dc }; } }
const setEq = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const blocksOf = s => (s.match(/\(([^)]*)\)|[A-Za-z]/g) || []).map(b => b.replace(/[()\s,]/g, '').split('').sort().join('')).sort();
function randMachine(r, nS, complete) {
  const S = L.range(nS).map(i => String.fromCharCode(65 + i)), t = {};
  // build with planted equivalent pairs so minimization is interesting
  for (const s of S) t[s] = [0, 1].map(() => [r.pick(S), String(r.int(0, 1))]);
  if (complete) { const a = r.int(0, nS - 2), b = r.int(a + 1, nS - 1); t[S[b]] = t[S[a]].map(c => c.slice()); }
  else S.forEach(s => t[s].forEach(c => { if (r() < .22) c[1] = null; if (r() < .12) c[0] = null; }));
  return { S, I: ['0', '1'], t };
}
const tableTxt = M => M.S.map(s => s + ': ' + M.t[s].map(([n, o]) => `${n ?? '-'},${o ?? '-'}`).join(' ')).join('\n');
const GEN = {
  sop(r, o = {}) { const n = o.n || 4, vars = n === 5 ? ['A', 'B', 'C', 'D', 'E'] : ['w', 'x', 'y', 'z'].slice(4 - n), { ones, dc } = randFn(r, n, .42, o.dc === false ? 0 : .12), m = L.minimize(n, ones, dc, vars);
    return { _ans: m.sop, q: `Minimise F(${vars.join(',')}) = Σm(${ones.join(', ')})${dc.length ? ` + d(${dc.join(', ')})` : ''} as a <b>minimal sum of products</b>.`, fmt: `Type it like x'z + wy (use ' for NOT). Any minimal answer is accepted.`,
      check(a) { let tt; try { tt = L.parse(a, vars); } catch (e) { return 'Could not read that: ' + e.message; } if (!L.sameFn(tt, ones, dc)) return 'That expression is not the same function (check a cell).'; const terms = a.split('+').length, lit = L.countLits(a, vars), best = m.sols[0]; if (terms > best.length || lit > best.reduce((s, c) => s + L.lits(c, n), 0)) return `Correct function, but not minimal: the minimum has ${best.length} terms and ${best.reduce((s, c) => s + L.lits(c, n), 0)} literals.`; return true; },
      show: el => kmap(el, { vars, ones, dc }) }; },
  pos(r) { const vars = ['w', 'x', 'y', 'z'], { ones, dc } = randFn(r, 4, .5, .1), p = L.pos(4, ones, dc, vars);
    return { _ans: p.pos, q: `Write F(w,x,y,z) = Σm(${ones.join(', ')})${dc.length ? ` + d(${dc.join(', ')})` : ''} as a <b>minimal product of sums</b>.`, fmt: "Type it like (x + y')(w' + z). Any minimal answer is accepted.",
      check(a) { let tt; try { tt = L.parse(a, vars); } catch (e) { return 'Could not read that: ' + e.message; } if (!L.sameFn(tt, ones, dc)) return 'Not the same function. Group the 0s, then complement each literal.'; const terms = (a.match(/\(/g) || [1]).length, lit = L.countLits(a, vars), best = p.sols[0]; if (terms > best.length || lit > best.reduce((s, c) => s + L.lits(c, 4), 0)) return `Correct function, not minimal: minimum is ${best.length} sum terms, ${best.reduce((s, c) => s + L.lits(c, 4), 0)} literals.`; return true; },
      show: el => kmap(el, { vars, ones, dc, pos: true }) }; },
  epi(r) { const vars = ['w', 'x', 'y', 'z']; let f, m; do { f = randFn(r, 4, .45, .12); m = L.minimize(4, f.ones, f.dc, vars); } while (!m.epi.length);
    return { _ans: m.epi.map(m.piStr).join(', '), q: `F(w,x,y,z) = Σm(${f.ones.join(', ')})${f.dc.length ? ` + d(${f.dc.join(', ')})` : ''}. List the <b>essential prime implicants</b>.`, fmt: "Separate with commas, e.g. x'z', wy",
      check(a) { const want = m.epi.map(p => L.onesOf(L.parse(m.piStr(p), vars)).join()); const got = a.split(',').map(s => s.trim()).filter(Boolean).map(s => { try { return L.onesOf(L.parse(s, vars)).join(); } catch { return '?'; } }); return setEq(got, want) || `Not the EPI set: there ${want.length === 1 ? 'is' : 'are'} ${want.length}.`; },
      show: el => kmap(el, { vars, ones: f.ones, dc: f.dc }) }; },
  pis(r) { const vars = ['w', 'x', 'y', 'z'], f = randFn(r, 4, .4, .1), m = L.minimize(4, f.ones, f.dc, vars);
    return { _ans: m.pis.map(m.piStr).join(', '), q: `By tabulation, find <b>all prime implicants</b> of F(w,x,y,z) = Σm(${f.ones.join(', ')})${f.dc.length ? ` + d(${f.dc.join(', ')})` : ''}.`, fmt: "Comma separated, e.g. w'x', yz, x'y'z",
      check(a) { const want = m.pis.map(p => L.cubeMinterms(p, 4).join()); const got = a.split(',').map(s => s.trim()).filter(Boolean).map(s => { try { return L.onesOf(L.parse(s, vars)).join(); } catch { return '?'; } }); return setEq(got, want) || `There are ${want.length} prime implicants (including any that cover only don't-cares).`; },
      show: el => tabulation(el, { vars, ones: f.ones, dc: f.dc }) }; },
  mux4(r) { const vars = ['A', 'B', 'C', 'D'], f = randFn(r, 4, .45, 0), R = L.residues(4, f.ones, [], [0, 1], vars);
    return { _ans: R.map(x => x.expr).join(' ; '), q: `Implement F(A,B,C,D) = Σm(${f.ones.join(', ')}) with a <b>4×1 MUX</b>, A and B on the select lines (A = S1). Give I0, I1, I2, I3.`, fmt: "Four entries separated by ';' as functions of C, D, e.g. C'D ; 1 ; 0 ; C+D",
      check(a) { const p = a.split(';').map(s => s.trim()); if (p.length !== 4) return 'Give exactly four entries separated by ;'; for (let i = 0; i < 4; i++) { let tt; try { tt = L.parse(p[i], ['C', 'D']); } catch (e) { return `I${i}: ` + e.message; } if (!L.sameFn(tt, R[i].ones, [])) return `I${i} is wrong (look at the minterms with AB = ${L.bin(i, 2)}).`; } return true; },
      show: el => muxImpl(el, { vars, ones: f.ones }) }; },
  mux8(r) { const vars = ['A', 'B', 'C', 'D'], f = randFn(r, 4, .45, 0), R = L.residues(4, f.ones, [], [0, 1, 2], vars);
    return { _ans: R.map(x => x.expr).join(' ; '), q: `Implement F(A,B,C,D) = Σm(${f.ones.join(', ')}) with an <b>8×1 MUX</b>, ABC on the select lines. Give I0..I7.`, fmt: "Eight entries separated by ';' from {0, 1, D, D'}",
      check(a) { const p = a.split(';').map(s => s.trim()); if (p.length !== 8) return 'Give exactly eight entries'; for (let i = 0; i < 8; i++) { let tt; try { tt = L.parse(p[i], ['D']); } catch (e) { return `I${i}: ` + e.message; } if (!L.sameFn(tt, R[i].ones, [])) return `I${i} is wrong.`; } return true; },
      show: el => muxImpl(el, { vars, ones: f.ones, sel: [0, 1, 2] }) }; },
  pla(r) { const vars = ['A', 'B', 'C'], fns = [0, 1].map(() => randFn(r, 3, .5, 0, 2).ones), P = L.pla(3, fns, [], vars);
    return { _ans: String(P.count), q: `PLA for F1(A,B,C) = Σ(${fns[0].join(',')}), F2 = Σ(${fns[1].join(',')}). Each output may be taken true (T) or complemented (C). What is the <b>minimum number of distinct product terms</b>?`, fmt: 'A number. Then compare your programming table with the steps.',
      check: a => +a === P.count || `Not the minimum. Try both F and F' for each output and share terms.`, show: el => plaFig(el, { vars, fns }) }; },
  excite(r) { const t = r.pick(['JK', 'SR', 'T', 'D']), seq = L.range(6).map(() => r.int(0, 1)), pairs = seq.slice(1).map((q1, i) => [seq[i], q1]), want = pairs.map(([q, q1]) => L.FF[t].ex(q, q1).join(''));
    return { _ans: want.map(w => String(w).toLowerCase()).join(' '), q: `A ${t} flip-flop's Q goes ${seq.join(' → ')}. Write the required ${L.FF[t].ins.join(',')} for each of the ${pairs.length} transitions.`, fmt: `${pairs.length} groups separated by spaces, use x for don't-care, e.g. ${t === 'JK' || t === 'SR' ? '1x x0 0x' : '1 0 1'}`,
      check: a => { const g = a.trim().toLowerCase().split(/\s+/); return (g.length === want.length && g.every((v, i) => v === String(want[i]).toLowerCase())) || 'Check the excitation table: ' + (t === 'JK' ? '0→0: 0x, 0→1: 1x, 1→0: x1, 1→1: x0' : t === 'SR' ? '0→0: 0x, 0→1: 10, 1→0: 01, 1→1: x0' : t === 'T' ? 'T = Q xor Q⁺' : 'D = Q⁺'); },
      show: el => { el.innerHTML = `<p>${pairs.map(([q, q1], i) => `${q}→${q1}: <b>${want[i]}</b>`).join(' · ')}</p>`; } }; },
  counter(r) { const bits = 3, all = [0, 1, 2, 3, 4, 5, 6, 7]; for (let i = 7; i > 0; i--) { const j = r.int(0, i); [all[i], all[j]] = [all[j], all[i]]; } const seq = all.slice(0, r.int(5, 6)), t = r.pick(['JK', 'T', 'D', 'SR']), R = L.counter(seq, bits, t), keys = Object.keys(R.eq), k = r.pick(keys), e = R.eq[k], m = R.maps[k];
    return { _ans: e.sop, q: `Synchronous counter ${seq.join(' → ')} → ${seq[0]} … using ${t} flip-flops (Q2 Q1 Q0, Q2 = MSB). Unused states are don't-cares. Give the minimal equation for <b>${k.replace(/Q(\d)/, '$1')}</b>.`, fmt: "Use Q2, Q1, Q0 as variables, e.g. Q1 Q0' + Q2",
      check(a) { let tt; try { tt = L.parse(a, R.vars); } catch (er) { return 'Could not read: ' + er.message; } if (!L.sameFn(tt, m.ones, m.dc)) return 'Wrong on at least one used state. Rebuild that column of the excitation table.'; if (L.countLits(a, R.vars) > e.sols[0].reduce((s, c) => s + L.lits(c, 3), 0)) return 'Right values, but use the don\'t-cares to make it smaller.'; return true; },
      show: el => counterLab(el, { seq, bits, ff: t }) }; },
  ffconv(r) { const pairs = [['JK', 'T'], ['D', 'T'], ['T', 'JK'], ['JK', 'D'], ['T', 'D'], ['SR', 'JK'], ['JK', 'SR'], ['D', 'SR'], ['T', 'SR'], ['SR', 'D']], [tg, src] = r.pick(pairs), C = L.convert(tg, src), k = r.pick(Object.keys(C.eq)), e = C.eq[k], mp = C.maps[k];
    return { _ans: e.sop, q: `Build a <b>${tg}</b> flip-flop from a <b>${src}</b> flip-flop and gates. Give the equation for the ${src} input <b>${k}</b>.`, fmt: `Variables: ${C.vars.join(', ')}. e.g. J Q' + K' Q`,
      check(a) { let tt; try { tt = L.parse(a, C.vars); } catch (er) { return 'Could not read: ' + er.message; } return L.sameFn(tt, mp.ones, mp.dc) || 'Wrong. Write the table: target inputs, Q, Q⁺, then the source excitation.'; },
      show: el => { el.innerHTML = tbl([...C.vars.slice(0, -1), 'Q', 'Q⁺', ...L.FF[src].ins], C.rows.map(r0 => [...r0.inp, r0.q, r0.q1, ...r0.need])) + `<p>${Object.keys(C.eq).map(x => `${x} = ${ov(C.eq[x].sop)}`).join(' ; ')}</p>`; } }; },
  partition(r) { let M, R; do { M = randMachine(r, r.int(5, 7), true); R = L.partitions(M); } while (R.P.length < 2 || R.classes.length === M.S.length);
    return { _ans: R.classes.map(b => '(' + b.join('') + ')').join(''), q: `Find the equivalence classes of this completely specified machine:<pre>${tableTxt(M)}</pre>`, fmt: 'Type the final partition, e.g. (AE)(BD)(C)(F)',
      check: a => setEq(blocksOf(a), R.classes.map(b => b.slice().sort().join(''))) || 'Not the final partition. Did you keep refining until nothing changed?', show: el => partitionAnim(el, { table: M }) }; },
  compat(r) { let M, R; do { M = randMachine(r, r.int(5, 6), false); try { R = L.reduce(M); } catch { R = null; } } while (!R || R.maxC.length < 2 || R.maxC.length >= M.S.length || R.maxC.every(c => c.length === 1));
    return { _ans: R.maxC.map(c => '(' + c.join('') + ')').join(''), q: `Incompletely specified machine:<pre>${tableTxt(M)}</pre>List the <b>maximal compatibles</b>.`, fmt: 'e.g. (ABD)(CE)(F)',
      check: a => setEq(blocksOf(a), R.maxC.map(c => c.slice().sort().join(''))) || `There are ${R.maxC.length} maximal compatibles. Recheck the crossed cells.`, show: el => implication(el, { table: M }) }; },
  moore(r) { let M, Mo; do { M = randMachine(r, r.int(3, 4), true); M.S.forEach(s => M.t[s].forEach(c => c[1] = String(r.int(0, 1)))); Mo = L.mealyToMoore(M); } while (Mo.S.length === M.S.length);
    return { _ans: Mo.S.join(', '), q: `Convert this Mealy machine to Moore. Which states are there in the Moore machine?<pre>${tableTxt(M)}</pre>`, fmt: 'Name a split state by its output, e.g. A, B0, B1, C',
      check: a => setEq(a.split(/[\s,]+/).filter(Boolean).map(s => s.toUpperCase()), Mo.S.map(s => s.toUpperCase())) || `The Moore machine has ${Mo.S.length} states.`, show: el => mealyMoore(el, { table: M }) }; },
  mealyrun(r) { const M = randMachine(r, 3, true); M.S.forEach(s => M.t[s].forEach(c => c[1] = String(r.int(0, 1)))); const xs = L.range(6).map(() => r.int(0, 1)), out = L.run(M, 'A', xs).map(s => s.o).join(''), moore = r() < .5, Mo = L.mealyToMoore(M), mout = (() => { let b = Mo.start; return xs.map(x => (b = Mo.t[b][x], Mo.z[b])).join(''); })();
    return { _ans: moore ? mout : out, q: `${moore ? 'The Moore machine below' : 'This Mealy machine'} starts in ${moore ? Mo.start : 'A'}. Input ${xs.join('')}. What output sequence appears${moore ? ' after each clock (ignore the initial output)' : ''}?<pre>${moore ? Mo.S.map(s => `${s}/${Mo.z[s] ?? '-'}: ${Mo.t[s].join(' ')}`).join('\n') : tableTxt(M)}</pre>`, fmt: '6 bits, e.g. 010011',
      check: a => a.replace(/\s/g, '') === (moore ? mout : out) || 'Walk it step by step: ' + (moore ? 'Moore output = output written in the state you arrive at.' : 'Mealy output = the one written on the arrow you take.'), show: el => moore ? diagram(el, { M: Mo, start: Mo.start, run: xs.join('') }) : diagram(el, { M, start: 'A', run: xs.join('') }) }; },
  comp(r) { const base = r.pick([2, 8, 10, 16]), len = r.int(4, 6), digits = L.range(len).map(() => r.int(0, base - 1).toString(base).toUpperCase()).join(''), dim = r() < .5;
    return { _ans: L.rComp(digits, base, dim), q: `Find the <b>${dim ? `${base - 1}'s` : `${base}'s`}</b> complement of (${digits})<sub>${base}</sub>, keeping ${len} digits.`, fmt: 'Digits only', check: a => a.trim().toUpperCase() === L.rComp(digits, base, dim) || `Subtract each digit from ${base - 1}${dim ? '' : ', then add 1 to the result'}.`, show: el => { el.innerHTML = `<p>${L.rComp(digits, base, dim)}</p>`; } }; },
};
function practice(sel, c) {
  const el = host(sel), need = c.n ?? 2, gen = GEN[c.kind]; Must.reg(c.id, need); el.classList.add('must');
  const seedKey = 'cse205-seed-' + PAGE + c.id; let seed; try { seed = +localStorage.getItem(seedKey); } catch {} seed = seed || Math.floor(Math.random() * 1e9);
  let inst, attempted = false;
  function fresh(s) { seed = s; try { localStorage.setItem(seedKey, String(seed)); } catch {} inst = gen(mkRng(seed), c.opts || {}); attempted = false; paint(); }
  function paint() {
    const got = Must.got(c.id), ok = got >= need; el.classList.toggle('ok', ok);
    el.innerHTML = `<div class="must-h"><span>Mandatory practice · do it on paper first</span><span>${Math.min(got, need)} / ${need}${ok ? ' ✓' : ''}</span></div><div class="must-q">${inst.q}</div><p class="tracer-hint">${inst.fmt}</p>
      <form class="must-f"><input aria-label="Your answer" autocomplete="off" spellcheck="false"><button class="must-b" type="submit">Check</button><button class="must-b" type="button" data-sol>Show the steps</button><button class="must-b" type="button" data-new>New question</button></form><div class="must-r" aria-live="polite"></div><div class="must-sol"></div>`;
    const res = el.querySelector('.must-r'), sol = el.querySelector('.must-sol'), inp = el.querySelector('input');
    el.querySelector('form').onsubmit = e => { e.preventDefault(); if (!inp.value.trim()) return; attempted = true; const v = inst.check(inp.value.trim()); if (v === true) { const n = Must.add(c.id); res.className = 'must-r good'; res.innerHTML = `<b>Correct.</b> ${n < need ? `${need - n} more to go.` : 'Requirement met.'} Compare your working with the steps, or take a new question.`; el.classList.toggle('ok', n >= need); el.querySelector('.must-h span:last-child').textContent = `${Math.min(n, need)} / ${need}${n >= need ? ' ✓' : ''}`; try { localStorage.removeItem(seedKey); } catch {} } else { res.className = 'must-r bad'; res.innerHTML = `<b>Not yet.</b> ${v}`; } };
    el.querySelector('[data-sol]').onclick = () => { if (!attempted) { res.className = 'must-r bad'; res.textContent = 'Submit an attempt first. A wrong answer is fine: finding where it went wrong is the point.'; return; } sol.innerHTML = '<div class="must-model"></div>'; inst.show(sol.firstChild); };
    el.querySelector('[data-new]').onclick = () => fresh(Math.floor(Math.random() * 1e9));
    tex(el);
  }
  fresh(seed); Must.sync();
}

// ---------- optional AI marking of a written answer (Amos: free, no key, called from the browser) ----------
const AMOS = 'https://api.amos.scira.ai/v1/systemone';
const plain = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); };
const photoB64 = f => new Promise((ok, no) => { const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { const k = Math.min(1, 1500 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = im.width * k; cv.height = im.height * k; cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); ok(cv.toDataURL('image/jpeg', .85).split(',')[1]); }; im.onerror = () => no(new Error('That file could not be read as an image.')); im.src = u; });
async function amosMark(c, text, image) {
  const qs = {}, pts = c.points.map(plain), hand = 'the student_answer' + (image ? ' and the handwritten answer in the attached photo' : '');
  pts.forEach((p, i) => { qs['kp_' + i] = { type: 'choice', instructions: `Key point: "${p}". How does ${hand} relate to this key point? Judge meaning, not wording; ignore spelling and notation differences.`, criteria: { established: 'The student states this point or something equivalent, correctly', partial: 'The student gestures at it but leaves out an essential part or is vague', contradicted: 'The student states something incompatible with this point', absent: 'The student does not address this point' } }; });
  qs.on_topic = { type: 'noul', instructions: `There is a genuine attempt to answer the question in ${hand}.` };
  const body = { model: 'amos-1-large', questions: qs, state: { question: plain(c.q), model_answer: plain(c.model || '').slice(0, 12000), student_answer: text.slice(0, 8000) || '(written by hand: read the attached photo)' } };
  if (image) body.images = [image];
  const json = JSON.stringify(body); let r;
  for (let n = 0; n < 4; n++) { r = await fetch(AMOS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json }); if (![429, 503].includes(r.status) || n === 3) break; await new Promise(ok => setTimeout(ok, Math.min(+r.headers.get('Retry-After') || 2 ** (n + 1), 30) * 1000)); }
  if (!r.ok) throw new Error('The AI service answered ' + r.status + '. Mark it yourself with the checklist.');
  const a = (await r.json()).answers;
  return { onTopic: a.on_topic?.noul ?? 1, st: pts.map((_, i) => { const pr = a['kp_' + i]?.probabilities || {}, e = pr.established || 0, m = pr.partial || 0; return (pr.contradicted || 0) >= .5 ? 'contradicted' : e >= .7 ? 'covered' : e + m <= .3 ? 'missing' : 'partly'; }) };
}
function aiBox(body, c, boxes) {
  const box = document.createElement('details'); box.className = 'must-model';
  box.innerHTML = `<summary>AI check (optional): photo or typed answer</summary><p class="tracer-hint">Marks your answer against this checklist. It is sent to Amos (scira.ai), which keeps requests to improve its models, so photograph only the answer, with no name or roll number.</p><textarea rows="4" style="width:100%;font:13px var(--mono);background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:4px;padding:6px" placeholder="Type your answer, or use a photo"></textarea><div class="must-f" style="margin-top:6px"><label class="must-b">📷 Choose photo <input type="file" accept="image/*" capture="environment" hidden></label><button class="must-b" type="button">Mark my answer</button></div><div class="must-r" aria-live="polite"></div>`;
  const ta = box.querySelector('textarea'), file = box.querySelector('input[type=file]'), go = box.querySelector('button'), out = box.querySelector('.must-r'), cap = file.closest('label');
  file.onchange = () => { cap.firstChild.textContent = file.files[0] ? '📷 Photo chosen ' : '📷 Choose photo '; };
  go.onclick = async () => {
    if (!ta.value.trim() && !file.files[0]) { out.className = 'must-r bad'; out.textContent = 'Type an answer or choose a photo first.'; return; }
    go.disabled = true; out.className = 'must-r'; out.textContent = 'Marking, about 10 seconds…';
    try {
      const img = file.files[0] ? await photoB64(file.files[0]) : null, m = await amosMark(c, ta.value, img);
      if (m.onTopic < .3) { out.className = 'must-r bad'; out.textContent = 'This does not look like an answer to the question. If it is a photo, retake it in good light.'; return; }
      const mark = { covered: '✓ covered', partly: '~ partly', missing: '✗ missing', contradicted: '⚠ contradicts this' }; let n = 0;
      m.st.forEach((s, i) => { const b = boxes[i], l = b.closest('label'); l.querySelector('.ai-st')?.remove(); l.insertAdjacentHTML('beforeend', ` <span class="tracer-hint ai-st">[AI: ${mark[s]}]</span>`); if (s === 'covered') { n++; b.checked = true; } });
      body.dispatchEvent(new Event('change', { bubbles: true }));
      out.className = 'must-r good'; out.textContent = `AI found ${n} of ${m.st.length} points fully covered${c.marks ? `, roughly ${Math.round(c.marks * n / m.st.length * 2) / 2} of ${c.marks} marks` : ''}. It can misread handwriting: check the list and tick or untick yourself.`;
    } catch (e) { out.className = 'must-r bad'; out.textContent = e.message || 'Could not reach the AI service. Mark it yourself with the checklist.'; }
    finally { go.disabled = false; }
  };
  body.append(box);
}
function recall(sel, c) {
  const el = host(sel); Must.reg(c.id, 1); el.classList.add('must');
  const ok = Must.got(c.id) >= 1; el.classList.toggle('ok', ok);
  el.innerHTML = `<div class="must-h"><span>Mandatory · write it from memory${c.marks ? ` · ${c.marks} marks` : ''}</span><span>${ok ? 'done ✓' : ''}</span></div><div class="must-q">${c.q}</div><button class="must-b" type="button" data-r>I wrote my answer: show the marking</button><div class="must-body" hidden></div>`;
  const body = el.querySelector('.must-body');
  el.querySelector('[data-r]').onclick = e => { e.target.remove(); body.hidden = false; body.innerHTML = `<p class="tracer-hint">Tick only what your written answer really has. All ticks = done.</p><ul class="pts">${c.points.map((p, i) => `<li><label><input type="checkbox" data-i="${i}"> ${p}</label></li>`).join('')}</ul>${c.model ? `<details class="must-model"><summary>Model answer</summary>${c.model}</details>` : ''}<div class="must-r" aria-live="polite"></div>`; tex(body); const boxes = body.querySelectorAll('.pts input'); aiBox(body, c, boxes); body.addEventListener('change', () => { if ([...boxes].every(b => b.checked) && Must.got(c.id) < 1) { Must.add(c.id); el.classList.add('ok'); el.querySelector('.must-h span:last-child').textContent = 'done ✓'; body.querySelector('.must-r').className = 'must-r good'; body.querySelector('.must-r').textContent = 'Complete.'; } }); };
  tex(el); Must.sync();
}
document.addEventListener('DOMContentLoaded', () => { tex(); paintToc(); });
