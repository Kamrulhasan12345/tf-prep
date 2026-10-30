// Lec 14 helpers: a slotted-page renderer that scales to any block size, and an interactive simulator.
// Convention (same as the slides and book.js slotted()): a slot stores (size, location), where location is the
// byte just after the record's last byte, so the record occupies [location − size, location).

// Pure engine: runs ops on an empty block. ops: [{op:'ins', name, size} | {op:'del', slot (1-based)}].
// Returns [{entries, freeEnd, records, cap, err}] with one state per visible step.
function slotRun(block, ops) {
  let slots = [], freeEnd = block;
  const states = [];
  const snap = (cap, mark = {}) => states.push({
    entries: slots.map(s => s && [s.size, s.end]), freeEnd,
    records: slots.filter(Boolean).map(s => ({ start: s.end - s.size, end: s.end, text: s.name, cls: mark[s.name + '@' + s.end] })),
    cap });
  snap(`Empty block of ${block} bytes. Header: 0 entries, end of free space = ${block}.`);
  for (const o of ops) {
    if (o.op === 'ins') {
      if (o.size > freeEnd) { states.push({ ...states[states.length - 1], err: true, cap: `<b>Cannot insert ${o.name} (${o.size} B):</b> only ${freeEnd} bytes of free space are left in this block. A real DBMS would put it in another block.` }); continue; }
      const end = freeEnd; freeEnd -= o.size;
      const reuse = slots.indexOf(null);
      const s = { name: o.name, size: o.size, end };
      let k;
      if (reuse >= 0) { slots[reuse] = s; k = reuse + 1; } else { slots.push(s); k = slots.length; }
      snap(`Insert <b>${o.name}</b> (${o.size} B). It goes just before the end of free space: ${end} − ${o.size} = <b>${freeEnd}</b>, so it occupies bytes ${freeEnd}–${end - 1}. ` +
        `${reuse >= 0 ? `Empty slot ${k} is reused` : `New slot ${k} is added`} with (size ${o.size}, location ${end}). Header: ${slots.length} entries, end of free space = ${freeEnd}.`,
        { [o.name + '@' + end]: 'cell-new' });
    } else {
      const s = slots[o.slot - 1];
      if (!s) { states.push({ ...states[states.length - 1], err: true, cap: `<b>Slot ${o.slot} is empty or does not exist</b>, so there is nothing to delete.` }); continue; }
      const start = s.end - s.size;
      snap(`Delete the record in <b>slot ${o.slot}</b> (${s.name}, bytes ${start}–${s.end - 1}).`, { [s.name + '@' + s.end]: 'cell-del' });
      slots[o.slot - 1] = null;
      const movers = slots.filter(x => x && x.end <= start);
      movers.forEach(x => { x.end += s.size; });
      freeEnd += s.size;
      const mark = Object.fromEntries(movers.map(x => [x.name + '@' + x.end, 'cell-hl']));
      snap(movers.length
        ? `Slot ${o.slot} is marked empty. The ${movers.length} record(s) between the free space and the hole (${movers.map(x => x.name).join(', ')}) move <b>${s.size} bytes</b> toward the end of the block, and their slot locations grow by ${s.size}. End of free space = ${freeEnd - s.size} + ${s.size} = <b>${freeEnd}</b>.`
        : `Slot ${o.slot} is marked empty. The record was next to the free space, so <b>nothing moves</b>. End of free space = <b>${freeEnd}</b>.`, mark);
    }
  }
  return states;
}

// Parse "insert student 400, delete 1, +takes 100, -2" (commas, semicolons or new lines between operations).
function slotParse(text) {
  const ops = [];
  for (const raw of text.split(/[;,\n]+/)) {
    const t = raw.trim(); if (!t) continue;
    let m = t.match(/^(?:insert|ins|\+)\s*([A-Za-z][\w-]*)\s+(\d+)$/i);
    if (m) { ops.push({ op: 'ins', name: m[1], size: +m[2] }); continue; }
    m = t.match(/^(?:delete|del|-)\s*(?:slot\s*)?(\d+)$/i);
    if (m) { ops.push({ op: 'del', slot: +m[1] }); continue; }
    throw new Error(`I could not read “${t}”. Write operations like <code>insert student 400</code> or <code>delete 1</code>.`);
  }
  return ops;
}

// Draw one slotted page. Scales record widths so any block size fits in 760 px.
function slotPage({ entries, freeEnd, records, block, note = '' }) {
  const W = 720, x0 = 10, y0 = 58, hh = 52;
  const cw = Math.min(62, Math.max(40, 330 / Math.max(1, entries.length + 1)));
  const hdrW = (entries.length + 1) * cw;
  const total = records.reduce((a, r) => a + r.end - r.start, 0);
  const room = W - hdrW - 90;
  const minW = Math.min(68, Math.max(40, (W - hdrW - 40) / Math.max(1, records.length)));
  const scale = Math.min(0.28, Math.max(0.01, (room - minW * records.length * 0.5) / Math.max(1, total)));
  const sorted = [...records].sort((a, b) => b.end - a.end);
  let xr = x0 + W; const pos = {};
  for (const r of sorted) {
    const w = Math.max(minW, (r.end - r.start) * scale);
    pos[r.end] = xr; r._x = xr - w; r._w = w; xr -= w;
  }
  const freeX = xr;
  let s = `<rect class="free" x="${x0}" y="${y0}" width="${W}" height="${hh}"/>`;
  const cell = (i, top, bot, cls) => {
    const x = x0 + i * cw;
    return `<rect class="${cls}" x="${x}" y="${y0}" width="${cw}" height="${hh}"/>` +
      `<line x1="${x}" x2="${x + cw}" y1="${y0 + hh / 2}" y2="${y0 + hh / 2}" class="s-fg"/>` +
      `<text x="${x + cw / 2}" y="${y0 + 18}" text-anchor="middle" class="big" style="font-size:12px">${top}</text>` +
      `<text x="${x + cw / 2}" y="${y0 + 44}" text-anchor="middle" style="font-size:11px">${bot}</text>`;
  };
  s += cell(0, entries.length, freeEnd, 'cell-hl');
  entries.forEach((e, i) => { s += cell(i + 1, e ? e[0] : '−', e ? e[1] : '−', e ? 'cell' : 'cell-plain'); });
  s += `<text x="${x0}" y="${y0 - 26}" class="lbl">BLOCK HEADER (entries / end of free space, then size / location per slot)</text>`;
  if (freeX - x0 - hdrW > 70) s += `<text x="${x0 + hdrW + (freeX - x0 - hdrW) / 2}" y="${y0 + 32}" text-anchor="middle" class="lbl">free space</text>`;
  for (const r of records) {
    s += `<rect class="${r.cls || 'cell'}" x="${r._x}" y="${y0}" width="${r._w}" height="${hh}"/>`;
    s += `<text x="${r._x + r._w / 2}" y="${y0 + 22}" text-anchor="middle" class="big" style="font-size:12px">${r.text}</text>`;
    s += `<text x="${r._x + r._w / 2}" y="${y0 + 40}" text-anchor="middle" class="lbl">${r.end - r.start} B</text>`;
  }
  // start-byte labels, staggered when neighbours are close
  let last = -1e9, alt = 0;
  [...records].sort((a, b) => a._x - b._x).forEach(r => {
    alt = r._x - last < 34 ? 1 - alt : 0; last = r._x;
    s += `<text x="${r._x}" y="${y0 - 6 - alt * 11}" text-anchor="middle" class="lbl">${r.start}</text>`;
  });
  s += `<text x="${x0 + W}" y="${y0 - 6}" text-anchor="middle" class="lbl">${block}</text>`;
  let ay = y0 + hh + 24;
  entries.forEach((e, i) => {
    if (!e) return;
    const sx = x0 + (i + 1) * cw + cw / 2, tx = (pos[e[1]] ?? x0 + W) - 3;
    s += `<path d="M${sx} ${y0 + hh} V${ay} H${tx} V${y0 + hh + 3}" class="s-acc" marker-end="url(#m-acc)"/>`;
    ay += 9;
  });
  const fx = x0 + cw / 2;
  s += `<path d="M${fx} ${y0 + hh} V${ay} H${freeX} V${y0 + hh + 3}" class="s-red dash" marker-end="url(#m-red)"/>`;
  s += `<text x="${fx + 4}" y="${ay + 14}" class="lbl red">end of free space</text>`;
  if (note) s += `<text x="${x0}" y="14" class="lbl">${note}</text>`;
  const H = ay + 24;
  return `<svg viewBox="0 0 ${W + 30} ${H}" width="${W + 30}" role="img" aria-label="slotted page">${s}</svg>`;
}

// Interactive simulator: block size + list of operations → animated stepper.
function slotSim(sel, block, text) {
  const host = document.querySelector(sel);
  host.innerHTML = `<form class="bp-form"><label>Block size <input type="text" value="${block}" style="width:6em" aria-label="Block size in bytes"></label>
    <label style="flex:1 1 100%">Operations <input type="text" value="${text}" style="width:100%" aria-label="Operations"></label>
    <button type="submit">Run</button></form><div class="sim-msg" aria-live="polite"></div><div class="sim-st"></div>`;
  const [bIn, oIn] = host.querySelectorAll('input'), msg = host.querySelector('.sim-msg');
  const run = () => {
    const b = parseInt(bIn.value, 10);
    try {
      if (!(b >= 100 && b <= 1000000)) throw new Error('Block size must be a whole number of bytes between 100 and 1,000,000.');
      const ops = slotParse(oIn.value);
      if (!ops.length) throw new Error('Type at least one operation.');
      if (ops.length > 20) throw new Error('Please use at most 20 operations.');
      msg.textContent = '';
      stepper(host.querySelector('.sim-st'), slotRun(b, ops).map(st => ({ html: slotPage({ ...st, block: b }), cap: st.cap })), { interval: 2200 });
    } catch (e) { msg.innerHTML = `<p class="bad">${e.message}</p>`; }
  };
  host.querySelector('form').addEventListener('submit', e => { e.preventDefault(); run(); });
  run();
}

if (typeof module !== 'undefined') module.exports = { slotRun, slotParse };
