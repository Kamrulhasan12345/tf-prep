// Block-diagram circuit figure for the past-paper pages. Self-contained (no engine, no edits to ../assets).
// netFig(sel, {inputs:['A','B'], nodes:[{id:'x',t:'XOR',i:['A','B']}, {id:'f',t:'FF',kind:'JK',pins:['J','K'],i:['x','1'],out:'Q'}], outs:[{n:'S',src:'x'}], note:'...'})
// A reference "A'" draws a shared NOT gate. "0"/"1" are constants. Any node type other than the simple gates is a labelled block
// (give pins:[...] for the pin names, e.g. a MUX). Type 'FF' draws a clocked box; its out name is usable as an input name
// (feedback is drawn as a net label, not as a wire).
const NET = (() => {
  const SIMPLE = { AND: 0, OR: 0, XOR: 0, NAND: 1, NOR: 1, XNOR: 1, NOT: 1, BUF: 0 };
  const PIN = 16, XS = 128, X0 = 64, YG = 14;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function build(c) {
    const nodes = c.nodes.map(n => ({ ...n, pins: n.pins || (n.t in SIMPLE ? n.i.map(() => '') : n.i.map(() => '')) }));
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    const ffOut = new Set(nodes.filter(n => n.t === 'FF' && n.out).map(n => n.out));
    const inputs = [...c.inputs];
    const nots = {};
    const ref = r => { // resolve a reference string to {src, kind}
      if (r === '0' || r === '1') return { k: 'const', v: r };
      if (/'$/.test(r)) { const b = r.slice(0, -1); if (!nots[b]) nots[b] = { id: '~' + b, t: 'NOT', i: [b], pins: [''] }; return { k: 'node', id: '~' + b, o: 0 }; }
      if (byId[r]) return { k: 'node', id: r, o: 0 };
      const dm = /^(.+)\.(\d+)$/.exec(r); if (dm && byId[dm[1]]) return { k: 'node', id: dm[1], o: +dm[2] };
      return { k: 'in', n: r };
    };
    // register NOT nodes (also from other NOT references)
    nodes.forEach(n => n.i.forEach(r => { if (/'$/.test(r)) ref(r); }));
    (c.outs || []).forEach(o => { if (/'$/.test(o.src)) ref(o.src); });
    Object.values(nots).forEach(n => { nodes.push(n); byId[n.id] = n; });
    // depth
    const depth = {};
    const dep = id => {
      if (depth[id] !== undefined) return depth[id]; depth[id] = 0; const n = byId[id];
      let d = 0; n.i.forEach(r => { const q = ref(r); if (q.k === 'node') d = Math.max(d, dep(q.id)); });
      return depth[id] = d + 1;
    };
    nodes.forEach(n => dep(n.id));
    // inputs actually used (keep given order, append FF outs referenced)
    const used = new Set(); nodes.forEach(n => n.i.forEach(r => { const q = ref(r); if (q.k === 'in') used.add(q.n); }));
    const ins = inputs.filter(x => used.has(x) || c.keepAll);
    used.forEach(u => { if (!ins.includes(u)) ins.push(u); });
    return { nodes, ins, ref, depth, byId, ffOut };
  }
  function draw(c) {
    const { nodes, ins, ref, depth, byId } = build(c);
    const maxD = Math.max(...nodes.map(n => depth[n.id]), 1);
    const inY = {}; ins.forEach((x, k) => inY[x] = 20 + k * 24);
    const pos = {}, colY = {};
    for (let d = 1; d <= maxD; d++) {
      const col = nodes.filter(n => depth[n.id] === d);
      col.forEach(n => { const ys = n.i.map(r => { const q = ref(r); return q.k === 'in' ? inY[q.n] : q.k === 'node' && pos[q.id] ? pos[q.id].oy : null; }).filter(v => v !== null); n._want = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 20; });
      col.sort((a, b) => a._want - b._want);
      let y = 8;
      col.forEach(n => {
        const np = Math.max(n.i.length, (n.outs || []).length, n.t === 'FF' ? 3 : 1), h = np * PIN + 10;
        y = Math.max(y, n._want - h / 2); n.y = y; n.h = h; y += h + YG;
        const x = X0 + (d - 1) * XS + 40; n.x = x; n.w = n.t in SIMPLE ? 46 : Math.max(84, 40 + (n.label || n.t).length * 6.2);
        pos[n.id] = { x, y: n.y, w: n.w, h, ox: x + n.w + (SIMPLE[n.t] ? 7 : 0), oy: n.y + h / 2, oys: (n.outs || []).map((_, k) => n.y + 5 + PIN / 2 + k * PIN) };
      });
    }
    const W = X0 + maxD * XS + 90, H = Math.max(...nodes.map(n => n.y + n.h), ins.length * 24 + 20) + 30;
    let s = '', wires = '';
    ins.forEach(x => { s += `<text class="lb" style="text-anchor:end" x="46" y="${inY[x]}">${esc(x)}</text><line class="wr" x1="50" y1="${inY[x]}" x2="${X0 - 8}" y2="${inY[x]}"/>`; });
    const used = {}; // x-lane per source so verticals do not coincide
    nodes.forEach(n => {
      const P = pos[n.id];
      n.i.forEach((r, k) => {
        const q = ref(r), ty = n.y + 5 + PIN / 2 + k * PIN + (n.i.length < 2 && n.t in SIMPLE ? (n.h - 10 - PIN) / 2 : 0), tx = n.x;
        if (q.k === 'const') { wires += `<text class="sm" style="text-anchor:end" x="${tx - 4}" y="${ty}">${q.v}</text>`; return; }
        const sx = q.k === 'in' ? X0 - 8 : pos[q.id].ox, sy = q.k === 'in' ? inY[q.n] : (pos[q.id].oys[q.o] ?? pos[q.id].oy);
        const key = q.k === 'in' ? 'i' + q.n : q.id; used[key] = (used[key] || 0);
        const mx = sx + 14 + ((used[key]++ % 3) * 5) + (q.k === 'in' ? (ins.indexOf(q.n) % 6) * 3 : 0);
        const mid = Math.min(mx, tx - 8);
        wires += `<path class="wr" d="M${sx},${sy} H${mid} V${ty} H${tx}"/>`;
        if (q.k === 'in') wires += `<circle cx="${sx}" cy="${sy}" r="2" fill="currentColor"/>`;
      });
      const lab = n.label || (n.t === 'FF' ? (n.kind || 'D') + ' FF' : n.t);
      if (n.t === 'FF') {
        s += `<rect class="gt" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3"/>`;
        n.i.forEach((r, k) => { s += `<text class="sm" style="text-anchor:start" x="${n.x + 4}" y="${n.y + 5 + PIN / 2 + k * PIN}">${esc(n.pins[k] || '')}</text>`; });
        s += `<text class="sm" style="text-anchor:start" x="${n.x + 4}" y="${n.y + n.h - 5}">&gt; ${esc(n.clk || 'clk')}</text><text class="lb" x="${n.x + n.w / 2 + 6}" y="${n.y + 8}">${esc(lab)}</text>`;
        s += `<text class="lb" style="text-anchor:start" x="${n.x + n.w + 6}" y="${n.y + 5 + PIN / 2}">${esc(n.out || 'Q')}</text>`;
      } else if (n.t in SIMPLE) {
        s += `<rect class="gt" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${n.t === 'NOT' || n.t === 'BUF' ? 12 : 8}"/><text class="lb" x="${n.x + n.w / 2}" y="${n.y + n.h / 2}">${n.t === 'NOT' ? 'NOT' : n.t}</text>`;
        if (SIMPLE[n.t]) s += `<circle class="gt" cx="${n.x + n.w + 3.5}" cy="${n.y + n.h / 2}" r="3.5"/>`;
      } else {
        s += `<rect class="gt" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3"/>`;
        n.i.forEach((r, k) => { s += `<text class="sm" style="text-anchor:start" x="${n.x + 4}" y="${n.y + 5 + PIN / 2 + k * PIN}">${esc(n.pins[k] || '')}</text>`; });
        s += `<text class="lb" x="${n.x + n.w / 2 + 14}" y="${n.y + n.h / 2}">${esc(lab)}</text>`;
        (n.outs || []).forEach((o, k) => { s += `<text class="sm" style="text-anchor:end" x="${n.x + n.w - 4}" y="${n.y + 5 + PIN / 2 + k * PIN}">${esc(o)}</text>`; });
        if (n.outLabel) s += `<text class="sm" style="text-anchor:start" x="${n.x + n.w + 4}" y="${n.y + n.h / 2 - 8}">${esc(n.outLabel)}</text>`;
      }
      if (n.outName && n.t !== 'FF') s += `<text class="sm" style="text-anchor:start" x="${P.ox + 3}" y="${P.oy - 7}">${esc(n.outName)}</text>`;
    });
    (c.outs || []).forEach(o => {
      const q = ref(o.src); if (q.k !== 'node') return; const P = pos[q.id], x2 = W - 40, oy = P.oys[q.o] ?? P.oy;
      wires += `<line class="wr" x1="${P.ox}" y1="${oy}" x2="${x2}" y2="${oy}"/><text class="lb" style="text-anchor:start;font-weight:700" x="${x2 + 4}" y="${oy}">${esc(o.n)}</text>`;
    });
    return `<div class="fg-wrap"><svg class="dsa-fig" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(c.title || 'circuit')}">${wires}${s}</svg>${c.note ? `<p class="tracer-hint">${c.note}</p>` : ''}</div>`;
  }
  return draw;
})();
const netFig = (sel, c) => { (typeof sel === 'string' ? document.querySelector(sel) : sel).innerHTML = NET(c); };

// PLA fuse map from precomputed rows (used when the engine's L.pla is too slow, e.g. 4 inputs x 4 outputs with don't-cares).
// plaMap(sel, {vars, rows:[{term,bits,out:[1,0,..]}], names, tc:['T','C',..]})
function plaMap(sel, c) {
  const { vars, rows, names, tc } = c, n = vars.length, m = names.length, cw = 30, rh = 28, x0 = 30, ax = x0 + n * 2 * cw + 20;
  const W = ax + m * cw + 150, H = 60 + rows.length * rh + 70, esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let s = '';
  vars.forEach((v, i) => { const x = x0 + i * 2 * cw; s += `<text class="lb" x="${x + cw}" y="12">${esc(v)}</text>`; [0, 1].forEach(k => { const lx = x + 6 + k * cw; s += `<line class="wr" x1="${lx}" y1="22" x2="${lx}" y2="${H - 56}"/><text class="sm" x="${lx}" y="${H - 44}">${k ? esc(v) + "'" : esc(v)}</text>`; }); });
  names.forEach((f, j) => { const lx = ax + 16 + j * cw; s += `<line class="wr" x1="${lx}" y1="22" x2="${lx}" y2="${H - 56}"/><text class="lb" x="${lx}" y="12">${esc(f)}</text><text class="sm" x="${lx}" y="${H - 44}">${tc[j]}</text>`; });
  rows.forEach((r, i) => {
    const y = 44 + i * rh;
    s += `<line class="wr" x1="14" y1="${y}" x2="${ax + 16 + (m - 1) * cw + 14}" y2="${y}"/><text class="sm" x="8" y="${y - 5}">P${i + 1}</text>`;
    r.bits.split('').forEach((b, j) => { if (b === '-') return; const x = x0 + j * 2 * cw + 6 + (b === '0' ? cw : 0); s += `<text class="fuse" x="${x}" y="${y}">×</text>`; });
    r.out.forEach((o, j) => { if (o) s += `<text class="fuse" x="${ax + 16 + j * cw}" y="${y}">×</text>`; });
    s += `<text class="sm" style="text-anchor:start" x="${ax + 16 + m * cw}" y="${y + 4}">${esc(r.term)}</text>`;
  });
  (typeof sel === 'string' ? document.querySelector(sel) : sel).innerHTML = `<div class="fg-wrap"><svg class="dsa-fig" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="PLA fuse map">${s}</svg><p class="tracer-hint">× = fuse left intact. Left block: AND plane (true and complement of each input). Right block: OR plane (which product terms each output ORs). T = output taken true; C = the complement is programmed and the output XOR fuse is blown so the pin gives F.</p></div>`;
}

// Static K-map with the minimal cover drawn and the equation above it. kst(sel, {vars, ones, dc, pos, name})
function kst(sel, c) {
  const n = c.vars.length, dc = c.dc || [], r = c.pos ? L.pos(n, c.ones, dc, c.vars) : L.minimize(n, c.ones, dc, c.vars), cover = r.sols[0] || [];
  (typeof sel === 'string' ? document.querySelector(sel) : sel).innerHTML = `<div class="figlabel">${c.name || 'F'} = ${ov(c.pos ? r.pos : r.sop)}</div>` + kmapSVG(c.vars, valsOf(n, c.ones, dc), cover.map((q, j) => ({ cube: q, color: COL[j % COL.length] })));
}
