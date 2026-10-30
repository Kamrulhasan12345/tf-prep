// Lec 13 tools: disk drawings, access-time calculator, disk-arm scheduling, RAID simulator.
// The pure functions (no DOM) come first; the node test harness loads them through module.exports.

const n3 = x => String(+(+x).toFixed(3));            // 3 decimals, no trailing zeros
const bits8 = v => v.toString(2).padStart(8, '0');

// ---------- disk access time ----------
// rpm, seek (average seek, ms), blockKB, rateMB (MB/s, 1 MB = 1024 KB), n blocks
function accessCalc({ rpm, seek, blockKB, rateMB, n = 1 }) {
  const rot = 60000 / rpm, lat = rot / 2, xfer = blockKB / (rateMB * 1024) * 1000;
  const access = seek + lat, total = access + xfer;
  return { rot, lat, xfer, access, total, iops: 1000 / total, rand: n * total, seq: access + n * xfer };
}

// ---------- disk-arm scheduling (head movement in cylinders) ----------
// alg: fcfs | sstf | scan | cscan | look | clook; dir: 'up' (towards higher cylinders) or 'down'.
// Returns moves [{from, to, dist, serve, jump}], order (requests served), total, totalNoJump.
function schedule(alg, reqs, start, dir = 'up', max = 199) {
  const up = dir === 'up', moves = [], order = [];
  let pos = start;
  const go = (c, serve, jump = false) => {
    if (c !== pos || serve) moves.push({ from: pos, to: c, dist: Math.abs(c - pos), serve, jump });
    if (serve) order.push(c);
    pos = c;
  };
  if (alg === 'fcfs') reqs.forEach(c => go(c, true));
  else if (alg === 'sstf') {
    const pend = reqs.slice();
    while (pend.length) {
      let b = 0;   // nearest request; a tie goes to the lower cylinder
      pend.forEach((c, i) => {
        const d = Math.abs(c - pos), bd = Math.abs(pend[b] - pos);
        if (d < bd || (d === bd && c < pend[b])) b = i;
      });
      go(pend.splice(b, 1)[0], true);
    }
  } else {
    const ahead = reqs.filter(c => up ? c >= pos : c <= pos).sort((x, y) => up ? x - y : y - x);
    const behind = reqs.filter(c => up ? c < pos : c > pos).sort((x, y) => up ? y - x : x - y); // nearest first
    ahead.forEach(c => go(c, true));
    if (behind.length) {
      const end = up ? max : 0, other = up ? 0 : max;
      if (alg === 'scan') { go(end, false); behind.forEach(c => go(c, true)); }
      if (alg === 'look') behind.forEach(c => go(c, true));
      if (alg === 'cscan') { go(end, false); go(other, false, true); behind.reverse().forEach(c => go(c, true)); }
      if (alg === 'clook') { const [f, ...rest] = behind.reverse(); go(f, true, true); rest.forEach(c => go(c, true)); }
    }
  }
  const total = moves.reduce((s, m) => s + m.dist, 0);
  return { moves, order, total, totalNoJump: total - moves.filter(m => m.jump).reduce((s, m) => s + m.dist, 0) };
}

// ---------- elevator / FCFS with arrival times (textbook §13.3.5) ----------
// reqs [{c, t}]; seek(d) = 0 if d = 0, else a + d * per; service = rotational latency + transfer.
// Decisions are made only when the previous request finishes, as in the textbook's Example 13.6.
function timedSched(alg, reqs, { start, dir = 'up', a, per, service }) {
  let t = 0, pos = start, up = dir === 'up', left = reqs.map((r, k) => ({ ...r, k }));
  const rows = [];
  while (left.length) {
    const avail = left.filter(r => r.t <= t + 1e-9);
    if (!avail.length) { t = Math.min(...left.map(r => r.t)); continue; }
    let r;
    if (alg === 'fcfs') r = avail.sort((x, y) => x.t - y.t || x.k - y.k)[0];
    else {
      const inDir = x => up ? x.c >= pos : x.c <= pos;
      if (!avail.some(inDir)) up = !up;
      r = avail.filter(inDir).sort((x, y) => Math.abs(x.c - pos) - Math.abs(y.c - pos))[0];
    }
    const d = Math.abs(r.c - pos), seek = d ? a + d * per : 0, arrive = t + seek, done = arrive + service;
    rows.push({ c: r.c, avail: r.t, from: pos, dist: d, seek, start: t, arrive, done, wait: done - r.t, dir: up ? 'up' : 'down' });
    t = done; pos = r.c; left = left.filter(x => x !== r);
  }
  return rows;
}

// ---------- RAID layouts (the slides' conventions) ----------
// Returns stripes: rows[s][d] = {t: 'B'|'M'|'P'|'Q', i} or null (empty slot).
// RAID 0: block i on disk i mod n. RAID 1: stripe over the first n/2 disks, mirror on the rest.
// RAID 4: parity on the last disk. RAID 5: Pk on disk k mod n. RAID 6: Pk on k mod n, Qk on (k+1) mod n.
// Data blocks fill the remaining disks of a stripe from left to right.
const RAID_RED = { 0: 0, 1: null, 4: 1, 5: 1, 6: 2 };
function raidCheck(level, n, m) {
  if (![0, 1, 4, 5, 6].includes(level)) return 'Choose RAID level 0, 1, 4, 5 or 6.';
  if (!Number.isInteger(n) || n < 2 || n > 12) return 'Number of disks must be a whole number from 2 to 12.';
  if (level === 1 && n % 2) return 'RAID 1 needs an even number of disks (half data, half mirror).';
  if ((level === 4 || level === 5) && n < 3) return `RAID ${level} needs at least 3 disks.`;
  if (level === 6 && n < 4) return 'RAID 6 needs at least 4 disks.';
  if (!Number.isInteger(m) || m < 1 || m > 48) return 'Number of blocks must be a whole number from 1 to 48.';
  return '';
}
function raidLayout(level, n, m) {
  const rows = [];
  const per = level === 0 ? n : level === 1 ? n / 2 : n - RAID_RED[level];
  for (let s = 0, b = 0; b < m; s++) {
    const row = Array(n).fill(null), red = {};
    if (level === 4) red[n - 1] = { t: 'P', i: s };
    if (level === 5) red[s % n] = { t: 'P', i: s };
    if (level === 6) { red[s % n] = { t: 'P', i: s }; red[(s + 1) % n] = { t: 'Q', i: s }; }
    const dataDisks = [...Array(level === 1 ? n / 2 : n).keys()].filter(d => !red[d]);
    for (const d of dataDisks) if (b < m) { row[d] = { t: 'B', i: b }; if (level === 1) row[d + n / 2] = { t: 'M', i: b }; b++; }
    Object.assign(row, red);
    rows.push(row);
  }
  return { rows, per };
}
const bval = i => (i * 89 + 53) % 256;                          // demo 8-bit contents of block Bi
function cellVal(rows, s, d) {
  const c = rows[s][d];
  if (!c) return 0;
  if (c.t === 'B' || c.t === 'M') return bval(c.i);
  if (c.t === 'P') return rows[s].reduce((x, o) => o && o.t === 'B' ? x ^ bval(o.i) : x, 0);
  return null;                                                   // Q: Reed–Solomon, value not shown
}
// usable capacity (in disks) and disks needed for `need` units of data with disks of size `size`
function raidCapacity(level, n) { return level === 1 ? n / 2 : n - RAID_RED[level]; }
function disksNeeded(level, need, size) { const k = Math.ceil(need / size); return level === 1 ? 2 * k : k + RAID_RED[level]; }

if (typeof module !== 'undefined') {
  module.exports = { accessCalc, schedule, timedSched, raidLayout, raidCheck, cellVal, bval, raidCapacity, disksNeeded };
}

// ================= DOM part (browser only) =================
if (typeof document !== 'undefined') {

// ---------- top view of one platter, with the arm (used by the block-read animations) ----------
// o = {headR (track radius under the head), secAng (deg, where the target sector's centre is), target (target radius),
//      seek: bool (show arrow), lab: caption text in the svg, t: [seek, lat, xfer, done flags]}
var DTOP = { cx: 170, cy: 160, R: 130, px: 400, py: 290, L: 250 };
function headAt(r) {   // head position and arm angle that put the head over radius r
  const { cx, cy, px, py, L } = DTOP, dx = cx - px, dy = cy - py, d = Math.hypot(dx, dy);
  const phi = Math.acos((d * d + L * L - r * r) / (2 * d * L)), th = Math.atan2(dy, dx) - phi;
  return { x: px + L * Math.cos(th), y: py + L * Math.sin(th), ang: Math.atan2(py + L * Math.sin(th) - cy, px + L * Math.cos(th) - cx) * 180 / Math.PI };
}
const TRACKS = [40, 58, 76, 94, 112, 128];
function diskTop(o) {
  const { cx, cy, R, px, py } = DTOP;
  const h = headAt(o.headR), tr = o.target;
  let s = `<circle cx="${cx}" cy="${cy}" r="${R + 4}" class="cell-plain"/>`;
  TRACKS.forEach(r => { s += `<circle cx="${cx}" cy="${cy}" r="${r}" class="s-fg" style="stroke:var(--idle)"/>`; });
  // sector wedge on the target track
  const a0 = (o.secAng - 11) * Math.PI / 180, a1 = (o.secAng + 11) * Math.PI / 180, r0 = tr - 9, r1 = tr + 9;
  const P = (r, a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  s += `<path d="M${P(r0, a0)} L${P(r1, a0)} A${r1} ${r1} 0 0 1 ${P(r1, a1)} L${P(r0, a1)} A${r0} ${r0} 0 0 0 ${P(r0, a0)} Z" class="${o.reading ? 'cell-new' : 'cell-hl'}" style="stroke:var(--red);stroke-width:2"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${tr}" class="s-acc dash"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="9" style="fill:var(--fg)"/>`;
  s += `<path d="M${cx + 52} ${cy - R - 16} A${R + 16} ${R + 16} 0 0 1 ${cx + R + 12} ${cy - 56}" class="s-fg" marker-end="url(#m-fg)"/>`;
  s += `<text x="${cx + R + 10}" y="${cy - R + 8}" class="lbl">rotation</text>`;
  // arm
  s += `<line x1="${px}" y1="${py}" x2="${h.x}" y2="${h.y}" style="stroke:var(--fg);stroke-width:7;stroke-linecap:round"/>`;
  s += `<circle cx="${px}" cy="${py}" r="12" style="fill:var(--fg)"/>`;
  s += `<rect x="${h.x - 5}" y="${h.y - 5}" width="10" height="10" style="fill:none;stroke:var(--red);stroke-width:2.5"/>`;
  s += `<text x="${px + 18}" y="${py + 4}" class="lbl">arm pivot</text>`;
  s += `<text x="${h.x + 12}" y="${h.y - 10}" class="lbl red">head</text>`;
  s += `<text x="${cx - R}" y="${cy + R + 26}" class="lbl">dashed blue ring = target track · orange wedge = target sector</text>`;
  if (o.seekFrom != null) {
    const f = headAt(o.seekFrom);
    s += `<path d="M${f.x} ${f.y} L${h.x} ${h.y}" class="s-acc dash" marker-end="url(#m-acc)"/>`;
  }
  return s;
}
// timeline bar: parts [[label, ms, cls]], upto = number of parts filled
function timeBar(parts, upto, W = 520) {
  const tot = parts.reduce((a, p) => a + p[1], 0), sc = (W - 20) / tot;
  let x = 10, s = '', acc = 0;
  parts.forEach(([lab, ms, cls], i) => {
    const w = Math.max(ms * sc, 2), on = i < upto;
    s += `<rect x="${x}" y="22" width="${w}" height="24" class="${on ? cls : 'cell-dim'}"/>`;
    if (w > 70) s += `<text x="${x + w / 2}" y="39" text-anchor="middle" style="font-size:11px" class="${on ? '' : 'dimt'}">${lab}</text>`;
    acc += on ? ms : 0; x += w;
  });
  s += `<text x="10" y="14" class="lbl">time for this block (ms): ${n3(acc)} of ${n3(tot)}</text>`;
  return `<svg viewBox="0 0 ${W} 56" width="${W}">${s}</svg>`;
}
// stepper frames for one block read: from radius r0 to r1, with times t = {seek, lat, xfer}
function readSteps(t, extra = '') {
  const from = TRACKS[1], to = TRACKS[4];
  const h0 = headAt(from), h1 = headAt(to);
  const start = h1.ang + 150, parts = [['seek', t.seek, 'cell-hl'], ['rotational latency', t.lat, 'cell'], ['transfer', t.xfer, 'cell-new']];
  const fig = (o, k) => `<div style="display:grid;gap:8px;justify-items:center"><svg viewBox="0 0 560 330" width="560" role="img" aria-label="Top view of a platter, arm and head">${diskTop(o)}</svg>${timeBar(parts, k)}</div>`;
  return [
    { html: fig({ headR: from, target: to, secAng: start }, 0), cap: `A request for one block arrives. The head is over an inner track. The block is in the orange sector on the outer dashed track, which is somewhere else on the spinning platter.${extra}` },
    { html: fig({ headR: to, target: to, secAng: start + 40, seekFrom: from }, 1), cap: `<b>Seek</b> (${n3(t.seek)} ms): the arm swings until the head is over the target track. The platter keeps spinning the whole time, so the sector has moved on a little.` },
    { html: fig({ headR: to, target: to, secAng: h1.ang - 30 }, 2), cap: `<b>Rotational latency</b> (${n3(t.lat)} ms on average): the head waits for the target sector to come round under it. On average this is half a rotation.` },
    { html: fig({ headR: to, target: to, secAng: h1.ang, reading: true }, 3), cap: `<b>Transfer</b> (${n3(t.xfer)} ms): the sector passes under the head and its bits are read. Total = ${n3(t.seek)} + ${n3(t.lat)} + ${n3(t.xfer)} = <b>${n3(t.seek + t.lat + t.xfer)} ms</b>. Access time (seek + latency) = ${n3(t.seek + t.lat)} ms.` },
  ];
}

// small form helper: fields [[id, label, value, width]]
function formHTML(id, fields, btn) {
  return `<form class="bp-form l13-form" id="${id}-form">` + fields.map(([k, lab, v, w, opts]) => opts
      ? `<label>${lab} <select id="${id}-${k}">${opts.map(([ov, ot]) => `<option value="${ov}"${ov == v ? ' selected' : ''}>${ot}</option>`).join('')}</select></label>`
      : `<label>${lab} <input type="text" id="${id}-${k}" value="${v}" style="width:${w || 6}em" autocomplete="off" spellcheck="false"></label>`).join(' ') +
    ` <button type="submit">${btn}</button></form><div class="l13-msg" id="${id}-msg" aria-live="polite"></div><div id="${id}-out"></div>`;
}
const val = (id, k) => document.getElementById(`${id}-${k}`).value.trim();
const num = s => s === '' ? NaN : Number(s.replace(/,/g, ''));
function msg(id, t) { const m = document.getElementById(`${id}-msg`); m.textContent = t; m.hidden = !t; }

// ---------- tool 1: access-time calculator ----------
function accessTool(sel, d = {}) {
  const host = $(sel), id = host.id;
  d = { rpm: 7200, seek: 4, blockKB: 4, rateMB: 100, n: 100, ...d };
  host.innerHTML = formHTML(id, [['rpm', 'Rotation speed (rpm)', d.rpm], ['seek', 'Average seek (ms)', d.seek],
    ['blk', 'Block size (KB)', d.blockKB], ['rate', 'Transfer rate (MB/s)', d.rateMB], ['n', 'Blocks to read', d.n]], 'Calculate');
  const run = () => {
    const p = { rpm: num(val(id, 'rpm')), seek: num(val(id, 'seek')), blockKB: num(val(id, 'blk')), rateMB: num(val(id, 'rate')), n: num(val(id, 'n')) };
    if (!(p.rpm >= 100 && p.rpm <= 100000)) return msg(id, 'Rotation speed should be a number of rpm, e.g. 7200.');
    if (!(p.seek >= 0 && p.seek <= 1000)) return msg(id, 'Average seek time should be a number of milliseconds, e.g. 4.');
    if (!(p.blockKB > 0 && p.blockKB <= 1e6)) return msg(id, 'Block size should be a positive number of kilobytes, e.g. 4.');
    if (!(p.rateMB > 0 && p.rateMB <= 1e6)) return msg(id, 'Transfer rate should be a positive number of MB/s, e.g. 100.');
    if (!(Number.isInteger(p.n) && p.n >= 1 && p.n <= 1e9)) return msg(id, 'Blocks to read should be a whole number, at least 1.');
    msg(id, '');
    const r = accessCalc(p);
    document.getElementById(`${id}-out`).innerHTML = `<div class="tbl"><table>
      <tr><th>Quantity</th><th>Formula</th><th>Value</th></tr>
      <tr><td>One rotation</td><td>60,000 ms ÷ ${p.rpm} rpm</td><td class="num">${n3(r.rot)} ms</td></tr>
      <tr><td>Average rotational latency</td><td>½ × one rotation</td><td class="num">${n3(r.lat)} ms</td></tr>
      <tr><td>Access time</td><td>seek + latency = ${n3(p.seek)} + ${n3(r.lat)}</td><td class="num">${n3(r.access)} ms</td></tr>
      <tr><td>Transfer time of one block</td><td>${p.blockKB} KB ÷ (${p.rateMB} × 1024 KB/s)</td><td class="num">${n3(r.xfer)} ms</td></tr>
      <tr><td>Time to read one random block</td><td>access + transfer</td><td class="num"><b>${n3(r.total)} ms</b></td></tr>
      <tr><td>IOPS (random block reads per second)</td><td>1000 ÷ ${n3(r.total)}</td><td class="num"><b>${n3(r.iops)}</b></td></tr>
      <tr><td>${p.n} blocks, random pattern</td><td>${p.n} × ${n3(r.total)}</td><td class="num">${n3(r.rand)} ms</td></tr>
      <tr><td>${p.n} blocks, sequential pattern</td><td>${n3(r.access)} + ${p.n} × ${n3(r.xfer)}</td><td class="num">${n3(r.seq)} ms</td></tr>
      </table></div><div id="${id}-anim"></div>`;
    stepper(`#${id}-anim`, readSteps({ seek: p.seek, lat: r.lat, xfer: r.xfer }), { interval: 2400 });
  };
  host.querySelector('form').addEventListener('submit', e => { e.preventDefault(); run(); });
  run();
}

// ---------- tool 2: disk-arm scheduling ----------
const ALG = { fcfs: 'FCFS', sstf: 'SSTF', scan: 'SCAN (elevator)', cscan: 'C-SCAN', look: 'LOOK', clook: 'C-LOOK' };
// path chart: x = cylinder, one row per move
function schedSVG(moves, k, max, reqs, start) {
  const W = 700, x0 = 40, x1 = W - 60, X = c => x0 + (x1 - x0) * c / max, y0 = 64, dy = 30;
  let s = `<line x1="${x0}" x2="${x1}" y1="${y0 - 14}" y2="${y0 - 14}" class="s-fg"/>`;
  s += `<text x="${x0 - 6}" y="${y0 - 10}" text-anchor="end" class="lbl">0</text><text x="${x1 + 6}" y="${y0 - 10}" class="lbl">${max}</text>`;
  [...new Set(reqs)].sort((a, b) => a - b).forEach((c, i) => {
    s += `<line x1="${X(c)}" x2="${X(c)}" y1="${y0 - 18}" y2="${y0 - 10}" class="s-fg"/>`;
    s += `<text x="${X(c)}" y="${y0 - 22 - (i % 2) * 14}" text-anchor="middle" style="font-size:11px">${c}</text>`;
  });
  const sa = X(start) > x1 - 50 ? 'end' : X(start) < x0 + 50 ? 'start' : 'middle';
  s += `<text x="${X(start)}" y="${y0 + 4}" text-anchor="${sa}" class="lbl acc">start ${start}</text>`;
  let pts = [[X(start), y0 + 10]];
  moves.forEach((m, i) => {
    const y = y0 + 10 + (i + 1) * dy, on = i < k, cur = i === k - 1;
    const cls = !on ? 's-fg dash' : m.jump ? 's-red dash' : cur ? 's-red' : 's-acc';
    s += `<line x1="${X(m.from)}" y1="${y - dy}" x2="${X(m.to)}" y2="${y}" class="${cls}" style="${on ? '' : 'stroke:var(--idle)'}"${on ? ` marker-end="url(#${cur || m.jump ? 'm-red' : 'm-acc'})"` : ''}/>`;
    if (on) s += `<circle cx="${X(m.to)}" cy="${y}" r="${m.serve ? 4.5 : 3}" style="fill:${m.serve ? 'var(--accent)' : 'var(--muted)'}"/>`;
    if (on) s += `<text x="${X(m.to) + (m.to > m.from ? 10 : -10)}" y="${y + 4}" text-anchor="${m.to > m.from ? 'start' : 'end'}" class="lbl">${m.to}${m.serve ? '' : m.jump ? ' (jump)' : ' (end)'}</text>`;
  });
  const H = y0 + 30 + moves.length * dy;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Head movement chart">${s}</svg>`;
}
function parseList(s) { const a = s.split(/[\s,;]+/).filter(Boolean).map(Number); return a.length && a.every(Number.isInteger) ? a : null; }
function schedTool(sel, d = {}) {
  const host = $(sel), id = host.id;
  d = { reqs: '98, 183, 37, 122, 14, 124, 65, 67', start: 53, dir: 'up', max: 199, alg: 'scan', ...d };
  host.innerHTML = formHTML(id, [['q', 'Request queue', d.reqs, 16], ['s', 'Head at', d.start, 6],
    ['d', 'Moving', d.dir, 0, [['up', 'towards higher'], ['down', 'towards lower']]], ['m', 'Last cylinder', d.max, 6],
    ['a', 'Algorithm', d.alg, 0, Object.entries(ALG)]], 'Schedule');
  const run = () => {
    const reqs = parseList(val(id, 'q')), start = num(val(id, 's')), max = num(val(id, 'm')), alg = val(id, 'a'), dir = val(id, 'd');
    if (!reqs) return msg(id, 'Type the request queue as whole numbers separated by commas, e.g. 98, 183, 37.');
    if (reqs.length > 20) return msg(id, 'Please use at most 20 requests.');
    if (!(Number.isInteger(max) && max >= 1 && max <= 1e6)) return msg(id, 'Last cylinder should be a whole number, e.g. 199.');
    if (!(Number.isInteger(start) && start >= 0 && start <= max)) return msg(id, `Head position should be a whole number from 0 to ${max}.`);
    if (reqs.some(c => c < 0 || c > max)) return msg(id, `Every request must be between 0 and the last cylinder (${max}).`);
    msg(id, '');
    const r = schedule(alg, reqs, start, dir, max);
    let run = 0;
    const steps = [{ html: schedSVG(r.moves, 0, max, reqs, start), cap: `${ALG[alg]}: the head starts at cylinder ${start}${['fcfs', 'sstf'].includes(alg) ? '' : `, moving towards ${dir === 'up' ? 'higher' : 'lower'} cylinders`}. Pending: ${reqs.join(', ')}.` }];
    r.moves.forEach((m, i) => {
      run += m.dist;
      const why = m.jump ? (alg === 'cscan' ? 'Jump back to the other end without serving anything on the way.' : 'Jump back to the lowest pending request without serving anything on the way.')
        : !m.serve ? 'No request here, but SCAN and C-SCAN run on to the end of the disk before turning.'
        : alg === 'fcfs' ? 'Next request in arrival order.' : alg === 'sstf' ? 'The pending request closest to the head.' : 'Next request in the direction of travel.';
      steps.push({ html: schedSVG(r.moves, i + 1, max, reqs, start), cap: `${m.from} → ${m.to}: |${m.to} − ${m.from}| = ${m.dist} cylinders. ${why} Running total: <b>${run}</b>.` });
    });
    const jumpNote = r.total !== r.totalNoJump ? ` (${r.totalNoJump} if the return jump is not counted)` : '';
    steps[steps.length - 1].cap += ` <b>Total head movement = ${r.total} cylinders${jumpNote}</b>; average per request = ${n3(r.total / reqs.length)}${jumpNote ? ` (${n3(r.totalNoJump / reqs.length)})` : ''}. Service order: ${r.order.join(', ')}.`;
    const all = Object.keys(ALG).map(a => { const q = schedule(a, reqs, start, dir, max); return `<tr${a === alg ? ' style="font-weight:600"' : ''}><td>${ALG[a]}</td><td>${q.order.join(', ')}</td><td class="num">${q.total}${q.total !== q.totalNoJump ? ` (${q.totalNoJump} without jump)` : ''}</td></tr>`; }).join('');
    document.getElementById(`${id}-out`).innerHTML = `<div id="${id}-st"></div><div class="tbl"><table><tr><th>Algorithm</th><th>Service order</th><th>Total movement</th></tr>${all}</table></div>`;
    stepper(`#${id}-st`, steps, { interval: 1600 });
  };
  host.querySelector('form').addEventListener('submit', e => { e.preventDefault(); run(); });
  run();
}

// ---------- tool 3: elevator with arrival times ----------
function timedTool(sel, d = {}) {
  const host = $(sel), id = host.id;
  d = { reqs: '8000@0, 24000@0, 56000@0, 16000@10, 64000@20, 40000@30', start: 8000, a: 1, per: 4000, svc: 4.3, max: 65536, alg: 'elev', ...d };
  host.innerHTML = formHTML(id, [['q', 'Requests (cylinder@arrival ms)', d.reqs, 22], ['s', 'Head at', d.start, 5],
    ['a', 'Seek = start/stop (ms)', d.a, 3], ['p', '+ 1 ms per', d.per, 4], ['v', 'cylinders; latency + transfer (ms)', d.svc, 4],
    ['m', 'Last cylinder', d.max, 5], ['g', 'Algorithm', d.alg, 0, [['elev', 'Elevator'], ['fcfs', 'FCFS']]]], 'Schedule');
  const run = () => {
    const items = val(id, 'q').split(/[\s,;]+/).filter(Boolean).map(x => x.split('@').map(Number));
    const start = num(val(id, 's')), a = num(val(id, 'a')), per = num(val(id, 'p')), svc = num(val(id, 'v')), max = num(val(id, 'm')), alg = val(id, 'g');
    if (!items.length || items.some(x => x.length !== 2 || !Number.isInteger(x[0]) || !(x[1] >= 0))) return msg(id, 'Write each request as cylinder@arrival-time, e.g. 8000@0, 16000@10.');
    if (items.length > 15) return msg(id, 'Please use at most 15 requests.');
    if (!(Number.isInteger(max) && max > 0)) return msg(id, 'Last cylinder should be a positive whole number.');
    if (!(Number.isInteger(start) && start >= 0 && start <= max) || items.some(x => x[0] < 0 || x[0] > max)) return msg(id, `Cylinders must be whole numbers from 0 to ${max}.`);
    if (!(a >= 0) || !(per > 0) || !(svc >= 0)) return msg(id, 'Seek and service times must be non-negative numbers (cylinders per ms must be positive).');
    msg(id, '');
    const reqs = items.map(([c, t]) => ({ c, t })), rows = timedSched(alg === 'elev' ? 'elev' : 'fcfs', reqs, { start, a, per: 1 / per, service: svc });
    const table = k => `<div class="tbl"><table><tr><th>#</th><th>Cylinder</th><th>Arrived</th><th>Seek from</th><th>Seek (ms)</th><th>Finished (ms)</th><th>Finished − arrived</th></tr>` +
      rows.map((r, i) => `<tr style="${i === k - 1 ? 'background:var(--cell-hl)' : ''}${i >= k ? ';opacity:.25' : ''}"><td>${i + 1}</td><td class="num">${r.c}</td><td class="num">${r.avail}</td><td class="num">${r.from}</td><td class="num">${n3(r.seek)}</td><td class="num">${n3(r.done)}</td><td class="num">${n3(r.wait)}</td></tr>`).join('') + '</table></div>';
    const moves = rows.map(r => ({ from: r.from, to: r.c, dist: r.dist, serve: true }));
    const steps = [{ html: schedSVG(moves, 0, max, reqs.map(r => r.c), start) + table(0), cap: `t = 0. The head is at cylinder ${start}. Waiting at t = 0: ${reqs.filter(r => r.t === 0).map(r => r.c).join(', ') || 'none'}.` }];
    rows.forEach((r, i) => {
      const pend = reqs.filter(q => q.t <= r.start && !rows.slice(0, i).some(p => p.c === q.c && p.avail === q.t)).map(q => q.c);
      const why = alg === 'fcfs' ? 'the oldest waiting request' : `the nearest waiting request in the ${r.dir === 'up' ? 'upward' : 'downward'} direction`;
      steps.push({ html: schedSVG(moves, i + 1, max, reqs.map(q => q.c), start) + table(i + 1),
        cap: `At t = ${n3(r.start)} the waiting requests are ${pend.join(', ')}. Choose ${r.c} (${why}). Seek = ${r.dist ? `${a} + ${r.dist}/${per} = ${n3(r.seek)}` : '0 (already there)'} ms, then ${svc} ms latency + transfer, so it finishes at ${n3(r.start)} + ${n3(r.seek)} + ${svc} = <b>${n3(r.done)} ms</b>.` });
    });
    steps[steps.length - 1].cap += ` All requests are served by <b>${n3(rows[rows.length - 1].done)} ms</b>. Average finish − arrival = ${n3(rows.reduce((s, r) => s + r.wait, 0) / rows.length)} ms.`;
    document.getElementById(`${id}-out`).innerHTML = `<div id="${id}-st"></div>`;
    stepper(`#${id}-st`, steps, { interval: 2200 });
  };
  host.querySelector('form').addEventListener('submit', e => { e.preventDefault(); run(); });
  run();
}

// ---------- tool 4: RAID simulator ----------
const CELLCLS = { B: '', M: 'grn', P: 'red', Q: 'acc' };
// o = {rows, n, failed: Set, mark: {"s:d": 'hl'|'new'|'del'|'dim'}, bits, newVal: {"s:d": value}, title}
function raidSVG(o) {
  const { rows, n } = o, cw = o.bits ? 84 : 62, gap = 12, rh = o.bits ? 38 : 24, x0 = 70, y0 = 40;
  const W = x0 + n * (cw + gap) + 10, H = y0 + rows.length * rh + 34;
  let s = '';
  for (let d = 0; d < n; d++) {
    const x = x0 + d * (cw + gap), dead = o.failed && o.failed.has(d);
    s += `<rect x="${x}" y="${y0 - 8}" width="${cw}" height="${rows.length * rh + 16}" rx="10" class="${dead ? 'cell-del' : 'cell-plain'}" style="${dead ? 'stroke:var(--red);stroke-width:2' : ''}"/>`;
    s += `<text x="${x + cw / 2}" y="${y0 - 16}" text-anchor="middle" class="big ${dead ? 'red' : ''}">D${d}${dead ? ' ✕' : ''}</text>`;
  }
  rows.forEach((row, si) => {
    const y = y0 + si * rh;
    s += `<text x="${x0 - 10}" y="${y + rh / 2 + 4}" text-anchor="end" class="lbl">stripe ${si}</text>`;
    row.forEach((c, d) => {
      if (!c) return;
      const x = x0 + d * (cw + gap) + 4, key = `${si}:${d}`, mk = (o.mark || {})[key], dead = o.failed && o.failed.has(d);
      const cls = mk === 'hl' ? 'cell-hl' : mk === 'new' ? 'cell-new' : mk === 'del' || (dead && !mk) ? 'cell-del' : mk === 'dim' ? 'cell-dim' : 'cell';
      s += `<rect x="${x}" y="${y + 2}" width="${cw - 8}" height="${rh - 4}" class="${cls}"/>`;
      const lab = (c.t === 'M' ? 'B' : c.t) + c.i, lost = dead && mk !== 'new';
      s += `<text x="${x + (cw - 8) / 2}" y="${y + (o.bits ? 16 : 16)}" text-anchor="middle" class="big ${CELLCLS[c.t]}" style="font-size:12px${lost ? ';text-decoration:line-through' : ''}">${lab}</text>`;
      if (o.bits) {
        const v = (o.newVal || {})[key] ?? cellVal(rows, si, d);
        s += `<text x="${x + (cw - 8) / 2}" y="${y + 31}" text-anchor="middle" style="font-size:11px" class="${lost ? 'dimt' : ''}">${lost ? '????????' : v == null ? 'RS code' : bits8(v)}</text>`;
      }
    });
  });
  if (o.title) s += `<text x="${x0}" y="${H - 8}" class="lbl">${o.title}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="RAID disk layout">${s}</svg>`;
}
const cname = c => (c.t === 'M' ? 'B' : c.t) + c.i;
function xorLine(parts) {   // parts [[name, value]] → "B0 ⊕ B2 = 1010 ⊕ 1100 = 0110"
  const v = parts.reduce((x, p) => x ^ p[1], 0);
  return { v, txt: `${parts.map(p => p[0]).join(' ⊕ ')} = ${parts.map(p => bits8(p[1])).join(' ⊕ ')} = <b>${bits8(v)}</b>` };
}
// recovery steps for failed disks
function recoverSteps(level, n, m, failed) {
  const { rows } = raidLayout(level, n, m), F = new Set(failed), steps = [], fixed = {};
  const base = { rows, n, failed: F, bits: true };
  steps.push({ html: raidSVG({ ...base }), cap: `Disk${failed.length > 1 ? 's' : ''} ${failed.map(d => 'D' + d).join(' and ')} fail${failed.length > 1 ? '' : 's'}. Every block on ${failed.length > 1 ? 'them' : 'it'} (struck out) must be rebuilt from the surviving disks, one stripe at a time.` });
  let lost = 0;
  rows.forEach((row, s) => {
    const dead = row.map((c, d) => c && F.has(d) ? d : -1).filter(d => d >= 0);
    if (!dead.length) return;
    const mark = { ...fixed };
    if (level === 0) {
      dead.forEach(d => { mark[`${s}:${d}`] = 'del'; });
      lost += dead.length;
      steps.push({ html: raidSVG({ ...base, mark }), cap: `Stripe ${s}: ${dead.map(d => cname(row[d])).join(', ')} ${dead.length > 1 ? 'are' : 'is'} <b>lost</b>. RAID 0 keeps no redundant copy or parity, so nothing can rebuild it.` });
      return;
    }
    if (level === 1) {
      dead.forEach(d => {
        const twin = d < n / 2 ? d + n / 2 : d - n / 2;
        if (F.has(twin)) { mark[`${s}:${d}`] = 'del'; lost++; steps.push({ html: raidSVG({ ...base, mark: { ...mark } }), cap: `Stripe ${s}: ${cname(row[d])} on D${d} is <b>lost</b>, because its mirror D${twin} failed too.` }); return; }
        mark[`${s}:${twin}`] = 'hl'; mark[`${s}:${d}`] = 'new'; fixed[`${s}:${d}`] = 'new';
        steps.push({ html: raidSVG({ ...base, mark: { ...mark } }), cap: `Stripe ${s}: copy ${cname(row[d])} from its mirror D${twin} onto the replacement D${d}. One read and one write, no arithmetic.` });
        delete mark[`${s}:${twin}`];
      });
      return;
    }
    const alive = row.map((c, d) => c && !F.has(d) ? d : -1).filter(d => d >= 0);
    if (level === 6 && dead.length <= 2) {
      const types = dead.map(d => row[d].t);
      dead.forEach(d => { mark[`${s}:${d}`] = 'new'; fixed[`${s}:${d}`] = 'new'; });
      alive.forEach(d => { mark[`${s}:${d}`] = 'hl'; });
      let how;
      if (dead.length === 1 && types[0] !== 'Q') how = `${cname(row[dead[0]])} = XOR of the other blocks of the stripe (${xorLine(alive.filter(d => row[d].t !== 'Q').map(d => [cname(row[d]), cellVal(rows, s, d)])).txt}).`;
      else if (types.every(t => t !== 'B')) how = `Only check block${dead.length > 1 ? 's' : ''} ${dead.map(d => cname(row[d])).join(' and ')} ${dead.length > 1 ? 'were' : 'was'} lost: recompute from the data blocks, exactly as when first written.`;
      else if (types.includes('Q') && !types.includes('P')) { const d = dead[types.indexOf('B')]; how = `First ${cname(row[d])} from P: ${xorLine(alive.filter(x => row[x].t !== 'Q').map(x => [cname(row[x]), cellVal(rows, s, x)])).txt}. Then recompute Q.`; }
      else how = `Two unknowns in this stripe (${dead.map(d => cname(row[d])).join(' and ')}), so XOR alone is not enough. The controller solves the two independent equations given by P and Q (Reed–Solomon arithmetic) for the two missing blocks.`;
      steps.push({ html: raidSVG({ ...base, mark }), cap: `Stripe ${s}: ${how}` });
      return;
    }
    if (dead.length > 1 || level === 6) {
      dead.forEach(d => { mark[`${s}:${d}`] = 'del'; });
      lost += dead.length;
      steps.push({ html: raidSVG({ ...base, mark }), cap: `Stripe ${s}: ${dead.map(d => cname(row[d])).join(', ')} are missing from the same stripe. ${level === 6 ? 'RAID 6 has only two redundant blocks per stripe, so it can solve for at most two unknowns' : 'One parity block gives one equation, which cannot solve for two unknowns'}. These blocks are <b>lost</b>.` });
      return;
    }
    const d = dead[0], src = alive.map(x => [cname(row[x]), cellVal(rows, s, x)]), x = xorLine(src);
    alive.forEach(a => { mark[`${s}:${a}`] = 'hl'; });
    mark[`${s}:${d}`] = 'new'; fixed[`${s}:${d}`] = 'new';
    const empty = row.some(c => !c) ? ' (Empty slots of this partial stripe count as all zeros.)' : '';
    steps.push({ html: raidSVG({ ...base, mark }), cap: `Stripe ${s}: ${cname(row[d])} = ${x.txt}. That is the XOR of every surviving block in the stripe${row[d].t === 'P' ? '' : ', parity included'}.${empty}` });
  });
  steps.push({ html: raidSVG({ ...base, mark: fixed }), cap: lost ? `Done: <b>${lost} block${lost > 1 ? 's' : ''} could not be recovered</b>. The rest are rebuilt (green).` : `Done: every block of the failed disk${failed.length > 1 ? 's' : ''} is rebuilt (green), so no data is lost.` });
  return steps;
}
// small-write steps: update block bi to value nv
function updateSteps(level, n, m, bi, nv) {
  const { rows } = raidLayout(level, n, m);
  let s = 0, d = -1;
  rows.forEach((row, si) => row.forEach((c, di) => { if (c && c.t === 'B' && c.i === bi) { s = si; d = di; } }));
  const base = { rows, n, bits: true }, old = bval(bi), k = `${s}:${d}`;
  const steps = [{ html: raidSVG(base), cap: `Update B${bi} (stripe ${s}, disk D${d}) from ${bits8(old)} to ${bits8(nv)}.` }];
  if (level === 0) { steps.push({ html: raidSVG({ ...base, mark: { [k]: 'new' }, newVal: { [k]: nv } }), cap: 'RAID 0: write the new block. <b>1 write</b>, and nothing protects it.' }); return steps; }
  if (level === 1) {
    const k2 = `${s}:${d + n / 2}`;
    steps.push({ html: raidSVG({ ...base, mark: { [k]: 'new', [k2]: 'new' }, newVal: { [k]: nv, [k2]: nv } }), cap: `RAID 1: write the new value to D${d} and to its mirror D${d + n / 2} at the same time. <b>2 writes, 0 reads</b>, no computation.` });
    return steps;
  }
  const pd = rows[s].findIndex(c => c && c.t === 'P'), qd = rows[s].findIndex(c => c && c.t === 'Q'), kp = `${s}:${pd}`, kq = `${s}:${qd}`;
  const op = cellVal(rows, s, pd), np = op ^ old ^ nv;
  const rd = { [k]: 'hl', [kp]: 'hl' }; if (qd >= 0) rd[kq] = 'hl';
  steps.push({ html: raidSVG({ ...base, mark: rd }), cap: `Read the old B${bi} (${bits8(old)}) and the old P${s} (${bits8(op)})${qd >= 0 ? ` and the old Q${s}` : ''}. Reads so far: <b>${qd >= 0 ? 3 : 2}</b>.` });
  steps.push({ html: raidSVG({ ...base, mark: rd }), cap: `Compute in memory: new P${s} = old P${s} ⊕ old B${bi} ⊕ new B${bi} = ${bits8(op)} ⊕ ${bits8(old)} ⊕ ${bits8(nv)} = <b>${bits8(np)}</b>. XOR-ing the old B${bi} cancels it out of the parity, and XOR-ing the new value adds it in.${qd >= 0 ? ` Q${s} is updated the same way with Reed–Solomon arithmetic.` : ''}` });
  const wr = { [k]: 'new', [kp]: 'new' }; if (qd >= 0) wr[kq] = 'new';
  steps.push({ html: raidSVG({ ...base, mark: wr, newVal: { [k]: nv, [kp]: np } }), cap: `Write the new B${bi} and the new P${s}${qd >= 0 ? ` and Q${s}` : ''}. Total: <b>${qd >= 0 ? '3 reads + 3 writes = 6' : '2 reads + 2 writes = 4'} block transfers</b> to change one block. Check: the XOR of the whole stripe is still the parity.` });
  return steps;
}
function raidTool(sel, d = {}) {
  const host = $(sel), id = host.id;
  d = { level: 5, n: 5, m: 10, size: 2, fail: '2', upd: 2, nv: '11001100', ...d };
  host.innerHTML = formHTML(id, [['l', 'RAID level', d.level, 0, [[0, 'RAID 0'], [1, 'RAID 1'], [4, 'RAID 4'], [5, 'RAID 5'], [6, 'RAID 6']]],
    ['n', 'Disks', d.n, 3], ['m', 'Blocks', d.m, 3], ['z', 'Disk size (TB)', d.size, 3], ['f', 'Fail disk(s)', d.fail, 4],
    ['u', 'Update block B', d.upd, 3], ['v', 'to value', d.nv, 6]], 'Build');
  const run = () => {
    const level = +val(id, 'l'), n = num(val(id, 'n')), m = num(val(id, 'm')), size = num(val(id, 'z'));
    const e = raidCheck(level, n, m); if (e) return msg(id, e);
    if (!(size > 0)) return msg(id, 'Disk size should be a positive number of TB.');
    const fail = val(id, 'f') === '' ? [] : parseList(val(id, 'f'));
    if (!fail || fail.some(x => x < 0 || x >= n) || new Set(fail).size !== fail.length) return msg(id, `Fail disk(s): list distinct disk numbers from 0 to ${n - 1}, e.g. 2 or 1, 3. Leave empty for none.`);
    const u = num(val(id, 'u')), nv = val(id, 'v');
    if (!(Number.isInteger(u) && u >= 0 && u < m)) return msg(id, `Update block: give a block number from 0 to ${m - 1}.`);
    if (!/^[01]{8}$/.test(nv)) return msg(id, 'The new value must be 8 bits, e.g. 11001100.');
    msg(id, '');
    const { rows } = raidLayout(level, n, m);
    const cap = [0, 1, 4, 5, 6].filter(l => !raidCheck(l, n, 1)).map(l => `<tr${l === level ? ' style="font-weight:600"' : ''}><td>RAID ${l}</td><td>${l === 1 ? `${n} ÷ 2` : `${n} − ${RAID_RED[l]}`} = ${raidCapacity(l, n)} disks of data</td><td class="num">${n3(raidCapacity(l, n) * size)} TB</td><td class="num">${+(100 * raidCapacity(l, n) / n).toFixed(1)}%</td></tr>`).join('');
    const out = document.getElementById(`${id}-out`);
    out.innerHTML = `<h4 class="l13-h">Layout</h4><figure class="l13-in">${raidSVG({ rows, n, bits: true })}<figcaption>B = data block, P = parity (red), Q = second check block (blue), green = mirror copy. The 8-bit values are made-up demo contents.</figcaption></figure>
      <h4 class="l13-h">Capacity of ${n} disks × ${size} TB (${n3(n * size)} TB raw)</h4><div class="tbl"><table><tr><th>Level</th><th>Rule</th><th>Usable</th><th>Efficiency</th></tr>${cap}</table></div>
      <h4 class="l13-h">${fail.length ? `Disk failure: ${fail.map(x => 'D' + x).join(', ')}` : 'Disk failure'}</h4><div id="${id}-rec"></div>
      <h4 class="l13-h">Small write: update B${u}</h4><div id="${id}-upd"></div>`;
    if (fail.length) stepper(`#${id}-rec`, recoverSteps(level, n, m, fail), { interval: 2600 });
    else document.getElementById(`${id}-rec`).innerHTML = '<p>Type one or more disk numbers in “Fail disk(s)” to watch the recovery.</p>';
    stepper(`#${id}-upd`, updateSteps(level, n, m, u, parseInt(nv, 2)), { interval: 2600 });
  };
  host.querySelector('form').addEventListener('submit', e => { e.preventDefault(); run(); });
  run();
}

}
