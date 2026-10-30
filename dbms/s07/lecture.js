// Lec 07–08 (Sukarna) · Query execution: cost formulas and step-through tools.
// Pure functions (QE.*) are also exported for the node test harness; the DOM tools use stepper() from book.js.
const QE = {};

// ---------- small helpers ----------
QE.chunk = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
QE.fmt = n => (Number.isInteger(n) ? n : Math.round(n * 100) / 100).toLocaleString('en-US');
const keyOf = t => String(t).trim().split(/\s+/)[0];
QE.cmpFor = items => {
  const numeric = items.every(t => /^-?\d+(\.\d+)?$/.test(keyOf(t)));
  const full = (a, b) => a < b ? -1 : a > b ? 1 : 0;   // tie-break on the whole tuple so equal tuples end up adjacent
  const lc = x => keyOf(x).toLowerCase();
  return numeric ? (a, b) => (+keyOf(a) - +keyOf(b)) || full(a, b) : (a, b) => full(lc(a), lc(b)) || full(a, b);
};

// ---------- cost formulas (disk I/Os; writing the final result is not counted, as on the slides) ----------
// Block-based nested-loop join with `outer` read in chunks of M-1 blocks.
QE.bnlj = (Bo, Bi, M) => { const chunks = Math.ceil(Bo / (M - 1)); return { chunks, cost: Bo + chunks * Bi, slide: Bo + Bo * Bi / (M - 1) }; };
// External merge sort of B blocks with M buffers (runs of M blocks, (M-1)-way merges).
QE.sortPlan = (B, M) => {
  const runs = Math.ceil(B / M), counts = [runs];
  let r = runs, passes = 0;
  while (r > 1) { r = Math.ceil(r / (M - 1)); passes++; counts.push(r); }
  const onePass = B <= M;
  const io = onePass ? B : B * (2 * passes + 1);          // excluding the final write
  return { runs, passes, counts, twoPhase: !onePass && runs <= M - 1, onePass, io, ioStored: io + B, maxTwoPhase: M * (M - 1) };
};
// Silberschatz-style external sort with bb blocks per buffer: fan-in floor(M/bb)-1, seeks counted too.
QE.sortSeeks = (B, M, bb = 1) => {
  const runs = Math.ceil(B / M), fan = Math.floor(M / bb) - 1;
  if (fan < 2) return { runs, fan, ok: false };
  let r = runs, passes = 0; while (r > 1) { r = Math.ceil(r / fan); passes++; }
  return { runs, fan, passes, ok: true, transfers: B * (2 * passes + 1), transfersStored: 2 * B * (passes + 1),
           seeks: 2 * runs + Math.ceil(B / bb) * (2 * passes - 1), seeksStored: 2 * runs + Math.ceil(B / bb) * 2 * passes };
};
// All join algorithms of Lec 07–08 for given sizes. Each row: {id, name, cost, ok, formula, sub, note}
QE.joinCosts = ({ BR, BS, TR, TS, M }) => {
  const rows = [], small = Math.min(BR, BS), sum = BR + BS;
  const sR = QE.bnlj(BS, BR, M), rR = QE.bnlj(BR, BS, M);
  if (TR && TS) rows.push({ id: 'tnlj', name: 'Tuple-based nested loop (careless)', cost: TR * TS, ok: true,
    formula: 'T(R)·T(S)', sub: `${QE.fmt(TR)} × ${QE.fmt(TS)}`, note: 'worst case: one disk I/O per pair of tuples' });
  rows.push({ id: 'bS', name: 'Block nested loop, S outer', cost: sR.cost, ok: M >= 2,
    formula: 'B(S) + ⌈B(S)/(M−1)⌉·B(R)', sub: `${QE.fmt(BS)} + ${sR.chunks} × ${QE.fmt(BR)}`,
    note: `slide formula B(S) + B(S)B(R)/(M−1) = ${QE.fmt(sR.slide)}` });
  rows.push({ id: 'bR', name: 'Block nested loop, R outer', cost: rR.cost, ok: M >= 2,
    formula: 'B(R) + ⌈B(R)/(M−1)⌉·B(S)', sub: `${QE.fmt(BR)} + ${rR.chunks} × ${QE.fmt(BS)}`,
    note: `slide formula B(R) + B(R)B(S)/(M−1) = ${QE.fmt(rR.slide)}` });
  rows.push({ id: 'one', name: 'One-pass join', cost: sum, ok: small <= M - 1,
    formula: 'B(R) + B(S)', sub: `${QE.fmt(BR)} + ${QE.fmt(BS)}`,
    note: `needs min(B(R),B(S)) = ${QE.fmt(small)} ≤ M−1 = ${M - 1}` });
  const runsR = Math.ceil(BR / M), runsS = Math.ceil(BS / M);
  rows.push({ id: 'sj', name: 'Simple sort-join (sort both, then merge)', cost: 5 * sum, ok: runsR <= M - 1 && runsS <= M - 1,
    formula: '5(B(R) + B(S))', sub: `5 × ${QE.fmt(sum)}`,
    note: `needs B(R) and B(S) ≤ M(M−1) = ${QE.fmt(M * (M - 1))} (sublists: ${runsR} and ${runsS}, at most ${M - 1} each)` });
  rows.push({ id: 'smj', name: 'Sort-merge join (efficient, two-pass)', cost: 3 * sum, ok: runsR + runsS <= M,
    formula: '3(B(R) + B(S))', sub: `3 × ${QE.fmt(sum)}`,
    note: `needs B(R)+B(S) ≤ M² = ${QE.fmt(M * M)} (sublists: ${runsR} + ${runsS} = ${runsR + runsS}, at most ${M})` });
  const bucket = Math.ceil(small / (M - 1));
  rows.push({ id: 'hj', name: 'Hash join (two-pass)', cost: 3 * sum, ok: bucket <= M - 1,
    formula: '3(B(R) + B(S))', sub: `3 × ${QE.fmt(sum)}`,
    note: `needs min(B(R),B(S)) ≤ M² ≈ ${QE.fmt(M * M)} (bucket of the smaller ≈ ⌈${QE.fmt(small)}/${M - 1}⌉ = ${bucket} ≤ ${M - 1})` });
  const best = Math.min(...rows.filter(r => r.ok && r.id !== 'tnlj').map(r => r.cost));
  rows.forEach(r => { r.win = r.ok && r.id !== 'tnlj' && r.cost === best; });
  return rows;
};

// ---------- trace generators (pure; the DOM renderers turn them into stepper frames) ----------
// Tuple-based nested-loop join iterator (textbook Fig. 15.7: S is the outer loop) over two table scans.
// R rows: [A, B]; S rows: [B, C]; join on B.
QE.nljTrace = (R, S) => {
  const ev = [], st = { r: -1, s: -1, rOpen: false, sOpen: false, out: [] };
  const snap = (node, call, ret, cap) => ev.push({ node, call, ret, cap, r: st.r, s: st.s, rOpen: st.rOpen, sOpen: st.sOpen, out: st.out.slice() });
  const scan = (rel, name) => {
    const k = name.toLowerCase();
    return {
      open() { st[k] = 0; st[k + 'Open'] = true; snap(name, 'Open()', null, `${name}.Open(): the table scan of ${name} starts at its first tuple.`); },
      next() {
        if (st[k] >= rel.length) { snap(name, 'GetNext()', 'NotFound', `${name}.GetNext() returns <b>NotFound</b>: ${name} is exhausted.`); return null; }
        const t = rel[st[k]]; st[k]++;
        snap(name, 'GetNext()', `(${t.join(', ')})`, `${name}.GetNext() returns <b>(${t.join(', ')})</b>.`);
        return t;
      },
      close() { st[k + 'Open'] = false; snap(name, 'Close()', null, `${name}.Close().`); },
    };
  };
  const RI = scan(R, 'R'), SI = scan(S, 'S');
  let s, r;
  snap('J', 'Open()', null, 'The consumer calls <b>Open()</b> on the join. Open() calls R.Open() and S.Open(), then fetches the first outer tuple s.');
  RI.open(); SI.open(); s = SI.next();
  if (!s || !R.length) { snap('J', 'Close()', null, 'One relation is empty, so the join is empty.'); return ev; }
  for (;;) {
    snap('J', 'GetNext()', null, `The consumer calls <b>GetNext()</b> on the join and waits for one tuple. Current outer tuple s = (${s.join(', ')}).`);
    let found = null;
    for (;;) {
      r = RI.next();
      if (!r) {
        RI.close(); s = SI.next();
        if (!s) { snap('J', 'GetNext()', 'NotFound', 'S is exhausted too, so the join\'s GetNext() returns <b>NotFound</b>. The consumer stops asking.'); break; }
        RI.open(); r = RI.next();
      }
      if (r[1] === s[0]) { found = [r[0], r[1], s[1]]; break; }
      snap('J', 'compare', null, `r = (${r.join(', ')}) and s = (${s.join(', ')}) do not join (B values ${r[1]} ≠ ${s[0]}). Keep looping inside GetNext().`);
    }
    if (!found) break;
    st.out.push(found);
    snap('J', 'GetNext()', `(${found.join(', ')})`, `r = (${r.join(', ')}) and s = (${s.join(', ')}) join. GetNext() <b>returns (${found.join(', ')})</b> to the consumer, which uses it right away. Nothing is stored on disk: this is <b>pipelining</b>.`);
  }
  snap('J', 'Close()', null, 'The consumer calls <b>Close()</b> on the join, which calls Close() on its children.');
  RI.close(); SI.close();
  return ev;
};

// External merge sort (TPMMS when one merge pass suffices). opts.dedup removes duplicates while merging.
// Returns a list of states: {phase, disk, mem, runs, out, io:{r,w,o}, cap}
QE.sortTrace = (items, tpb, M, { dedup = false } = {}) => {
  const cmp = QE.cmpFor(items), states = [], io = { r: 0, w: 0, o: 0 };
  const input = QE.chunk(items, tpb);
  let readUpTo = 0;
  const push = (o, cap) => states.push({ ...o, io: { ...io }, readUpTo, cap });
  // phase 1
  let runs = [];
  push({ phase: 'Start', mem: [], runs: [] }, `R has ${items.length} tuples in B = ${input.length} blocks (${tpb} tuple${tpb > 1 ? 's' : ''} per block). Memory has M = ${M} buffers.`);
  QE.chunk(input, M).forEach(ch => {
    readUpTo += ch.length; io.r += ch.length;
    push({ phase: 'Phase 1', mem: ch.map(b => ({ t: b })), runs: runs.slice() }, `Phase 1: read the next ${ch.length} block${ch.length > 1 ? 's' : ''} of R into memory (${ch.length} reads).`);
    const sorted = QE.chunk(ch.flat().sort(cmp), tpb);
    push({ phase: 'Phase 1', mem: sorted.map(b => ({ t: b, cls: 'hl' })), runs: runs.slice() }, 'Sort these tuples in main memory. No disk I/O.');
    io.w += sorted.length;
    runs = runs.concat([{ name: `sublist ${runs.length + 1}`, blocks: sorted, cls: 'new' }]);
    push({ phase: 'Phase 1', mem: [], runs: runs.slice() }, `Write them to disk as sorted <b>sublist ${runs.length}</b> (${sorted.length} write${sorted.length > 1 ? 's' : ''}).`);
  });
  if (runs.length === 1) { push({ phase: 'Done', mem: [], runs }, 'R fit in memory, so one sorted sublist is already the answer.'); return states; }
  let pass = 0;
  while (runs.length > 1) {
    pass++;
    const groups = QE.chunk(runs, M - 1), next = [], last = groups.length === 1;
    groups.forEach((g, gi) => {
      const name = last ? 'sorted output' : `run ${pass}.${gi + 1}`;
      const bi = g.map(() => 0), buf = g.map(rn => rn.blocks[0].slice()), outBlocks = [];
      let outBuf = [], lastKey = null;
      io.r += g.length;
      const view = (pick, cap, done) => push({
        phase: `Merge pass ${pass}${groups.length > 1 ? ` · merge ${gi + 1} of ${groups.length}` : ''}`,
        merge: { g: g.map((rn, k) => ({ name: rn.name, blocks: rn.blocks, at: bi[k] })), buf: buf.map(b => b.slice()), pick, out: outBuf.slice(), outBlocks: outBlocks.slice(), name, last },
        runs: runs.filter(rn => !g.includes(rn)).concat(next.slice()), done }, cap);
      view(null, `Merge ${g.map(rn => rn.name).join(', ')}: load the first block of each into its own input buffer (${g.length} reads). One more buffer is the output buffer.`);
      for (;;) {
        let k = -1;
        buf.forEach((b, j) => { if (b.length && (k < 0 || cmp(b[0], buf[k][0]) < 0)) k = j; });
        if (k < 0) break;
        const t = buf[k].shift();
        let cap;
        if (dedup && t === lastKey) cap = `Smallest front tuple is <b>${t}</b> from ${g[k].name}. It equals the last tuple output, so it is a duplicate: <b>discard it</b>.`;
        else { outBuf.push(t); lastKey = t; cap = `Smallest front tuple is <b>${t}</b> (from ${g[k].name}). Move it to the output buffer.`; }
        if (outBuf.length === tpb) {
          outBlocks.push(outBuf); outBuf = [];
          if (last) { io.o++; cap += ' The output buffer is full: write it out (1 write of the <i>result</i>).'; }
          else { io.w++; cap += ' The output buffer is full: write it to disk (1 write).'; }
        }
        if (!buf[k].length) {
          if (bi[k] + 1 < g[k].blocks.length) { bi[k]++; buf[k] = g[k].blocks[bi[k]].slice(); io.r++; cap += ` Input buffer of ${g[k].name} is empty: read its next block (1 read).`; }
          else { bi[k] = g[k].blocks.length; cap += ` ${g[k].name} is used up.`; }
        }
        view(k, cap);
      }
      if (outBuf.length) { outBlocks.push(outBuf); outBuf = []; if (last) io.o++; else io.w++; }
      next.push({ name, blocks: outBlocks, cls: 'new' });
      view(null, last ? 'All sublists are exhausted. The last partial output block is written. <b>R is sorted.</b>' : `Merge done: <b>${name}</b> is written to disk.`, true);
    });
    runs = next;
  }
  push({ phase: 'Done', mem: [], runs, final: true }, `Done. Disk I/Os: <b>${io.r} reads + ${io.w} writes = ${io.r + io.w}</b>, plus ${io.o} write${io.o === 1 ? '' : 's'} if the sorted result is stored on disk (total ${io.r + io.w + io.o}).`);
  return states;
};

// Block-based nested-loop join: the outer relation in chunks of M-1 blocks, the inner scanned once per chunk.
QE.bnljTrace = (Bo, Bi, M, outer = 'S', inner = 'R') => {
  const st = [], chunks = QE.chunk([...Array(Bo).keys()], M - 1);
  let io = 0, scans = 0;
  st.push({ chunk: null, mem: [], inner: -1, io, scans, cap: `Outer relation ${outer}: ${Bo} blocks. Inner relation ${inner}: ${Bi} blocks. M = ${M}: ${M - 1} buffers hold a chunk of ${outer}, 1 buffer holds one block of ${inner}. There are ⌈${Bo}/${M - 1}⌉ = ${chunks.length} chunks.` });
  chunks.forEach((c, ci) => {
    io += c.length;
    st.push({ chunk: ci, mem: c, inner: -1, io, scans, cap: `Chunk ${ci + 1}: read blocks ${outer}${c[0] + 1}–${outer}${c[c.length - 1] + 1} into memory (${c.length} reads) and build a search structure on the join attributes.` });
    for (let b = 0; b < Bi; b++) {
      io++;
      if (b === Bi - 1) scans++;
      st.push({ chunk: ci, mem: c, inner: b, io, scans, cap: `Read ${inner}${b + 1} into the last buffer (1 read). Each of its tuples is joined with the ${outer}-tuples of the chunk in memory.${b === Bi - 1 ? ` That finishes scan ${scans} of ${inner}.` : ''}` });
    }
  });
  st.push({ chunk: null, mem: [], inner: -1, io, scans, done: true, cap: `Done: ${Bo} reads of ${outer} + ${chunks.length} scans × ${Bi} blocks of ${inner} = <b>${io} disk I/Os</b>.` });
  return st;
};

// Hash partitioning of R into M-1 buckets (h(t) = key mod (M-1)), one input buffer.
QE.hashTrace = (items, tpb, M) => {
  const k = M - 1, input = QE.chunk(items, tpb), buf = Array.from({ length: k }, () => []), disk = Array.from({ length: k }, () => []), st = [];
  let io = { r: 0, w: 0 };
  const h = t => ((+keyOf(t) % k) + k) % k;
  const push = (o, cap) => st.push({ buf: buf.map(b => b.slice()), disk: disk.map(d => d.map(b => b.slice())), io: { ...io }, ...o, cap });
  push({ blk: -1 }, `R has ${input.length} blocks. M = ${M}: ${k} buffers for buckets 0–${k - 1}, 1 buffer to read R. h(t) = t mod ${k}.`);
  input.forEach((b, bi) => {
    io.r++;
    push({ blk: bi, inp: b.slice(), pick: -1 }, `Read block ${bi + 1} of R into the input buffer (1 read).`);
    b.forEach((t, ti) => {
      const j = h(t); let cap = `h(${keyOf(t)}) = ${keyOf(t)} mod ${k} = ${j}: copy ${t} to the buffer of bucket ${j}.`;
      if (buf[j].length === tpb) { disk[j].push(buf[j].splice(0)); io.w++; cap = `h(${keyOf(t)}) = ${j}, but bucket ${j}'s buffer is full: write it to disk (1 write) and start a new block. ` + `Then copy ${t} into it.`; }
      buf[j].push(t);
      push({ blk: bi, inp: b.slice(), pick: ti, hb: j }, cap);
    });
  });
  buf.forEach((b, j) => { if (b.length) { disk[j].push(b.splice(0)); io.w++; } });
  push({ blk: input.length, done: true }, `End of R: write every non-empty bucket buffer to disk. Total: ${io.r} reads + ${io.w} writes = <b>${io.r + io.w}</b> I/Os (about 2B(R); partial blocks can add a few).`);
  return st;
};

// One-pass unary/binary operation. mem = relation kept in memory (null for δ / γ), str = relation streamed.
// op: 'dedup' | 'group' | 'union' | 'inter' | 'strMinusMem' | 'memMinusStr' | 'bagInter'
QE.onePassTrace = ({ op, mem = [], str, tpb = 2, memName = 'S', strName = 'R' }) => {
  const st = [], out = [];
  let io = 0;
  const table = new Map();
  const tab = () => [...table.entries()].map(([k, v]) => ({ k, v: typeof v === 'object' ? { ...v } : v }));
  const push = (o, cap) => st.push({ tab: tab(), out: out.slice(), io, ...o, cap });
  QE.chunk(mem, tpb).forEach((b, bi) => {
    io++;
    b.forEach(t => {
      if (op === 'bagInter') table.set(t, (table.get(t) || 0) + 1);
      else if (op === 'join') { const [y, z] = t.split(/\s+/); table.set(y, (table.get(y) || []).concat(z)); }
      else table.set(t, true);
      if (op === 'union') out.push(t);
    });
    push({ src: 'mem', blk: b, bi }, `Read block ${bi + 1} of ${memName} into memory (1 read) and insert its tuples into the search structure${op === 'bagInter' ? ' with a count per distinct tuple' : op === 'join' ? ', keyed on the join attribute Y' : ''}${op === 'union' ? '. Every tuple of ' + memName + ' is also copied to the output' : ''}.`);
  });
  const blocks = QE.chunk(str, tpb);
  blocks.forEach((b, bi) => {
    io++;
    push({ src: 'str', blk: b, bi, pick: -1 }, `Read block ${bi + 1} of ${strName} into the one remaining buffer (1 read).`);
    b.forEach((t, ti) => {
      let cap, hit = table.has(t);
      if (op === 'dedup') { if (hit) cap = `${t} is already in memory: a duplicate, discard it.`; else { table.set(t, true); out.push(t); cap = `${t} is new: copy it to the output and remember it.`; } }
      else if (op === 'group') {
        const [g, v] = t.split(/\s+/), e = table.get(g) || { count: 0, sum: 0, min: Infinity, max: -Infinity };
        e.count++; e.sum += +v; e.min = Math.min(e.min, +v); e.max = Math.max(e.max, +v); table.set(g, e);
        cap = `Tuple (${g}, ${v}): find group ${g}'s entry and update it: COUNT ${e.count}, SUM ${e.sum}, MIN ${e.min}, MAX ${e.max}.`;
      }
      else if (op === 'union') { if (hit) cap = `${t} is also in ${memName}: already output, skip it.`; else { out.push(t); cap = `${t} is not in ${memName}: copy it to the output.`; } }
      else if (op === 'inter') { if (hit) { out.push(t); cap = `${t} is in ${memName}: copy it to the output.`; } else cap = `${t} is not in ${memName}: ignore it.`; }
      else if (op === 'strMinusMem') { if (hit) cap = `${t} is in ${memName}: it must not appear in ${strName} − ${memName}, ignore it.`; else { out.push(t); cap = `${t} is not in ${memName}: copy it to the output.`; } }
      else if (op === 'memMinusStr') { if (hit) { table.delete(t); cap = `${t} is in ${memName}: delete it from the in-memory copy of ${memName}.`; } else cap = `${t} is not in ${memName}: nothing to do.`; }
      else if (op === 'join') {
        const [x, y] = t.split(/\s+/), zs = table.get(y) || [];
        zs.forEach(z => out.push(`${x} ${y} ${z}`));
        cap = zs.length ? `Probe with Y = ${y}: it matches ${zs.length} tuple${zs.length > 1 ? 's' : ''} of ${memName}. Output ${zs.map(z => `(${x}, ${y}, ${z})`).join(', ')}.` : `Probe with Y = ${y}: no tuple of ${memName} has this Y. Nothing to output.`;
      }
      else if (op === 'bagInter') { const c = table.get(t) || 0; if (c > 0) { table.set(t, c - 1); out.push(t); cap = `${t} is in ${memName} with count ${c} > 0: output it and decrease the count to ${c - 1}.`; } else cap = hit ? `${t} has count 0: all copies of ${t} in ${memName} are used up, do not output.` : `${t} is not in ${memName}: ignore it.`; }
      push({ src: 'str', blk: b, bi, pick: ti }, cap);
    });
  });
  if (op === 'memMinusStr') { for (const k of table.keys()) out.push(k); push({ done: true }, `${strName} is finished. Copy the tuples of ${memName} still in memory to the output. Total: <b>${io} disk I/Os</b> = B(${memName}) + B(${strName}).`); }
  else if (op === 'group') { for (const [g, e] of table) out.push(`${g}: count ${e.count}, sum ${e.sum}, avg ${QE.fmt(e.sum / e.count)}, min ${e.min}, max ${e.max}`); push({ done: true }, `All of ${strName} is read. Only now can γ output one tuple per group. Total: <b>${io} disk I/Os</b> = B(${strName}).`); }
  else push({ done: true }, `Done. Total: <b>${io} disk I/Os</b>${mem.length ? ` = B(${memName}) + B(${strName})` : ` = B(${strName})`}.`);
  return st;
};

if (typeof module !== 'undefined') module.exports = QE;

// ======================= DOM side =======================
if (typeof document !== 'undefined') {

const blkH = (tuples, cap, cls = '', pick = -1, gone = -1) => {
  const cells = [];
  for (let i = 0; i < cap; i++) {
    const t = tuples[i];
    cells.push(t === undefined ? '<span class="emp">·</span>' : `<span class="${i === pick ? 'pick' : i < gone ? 'gone' : ''}">${t}</span>`);
  }
  return `<span class="qe-blk ${cls}">${cells.join('')}</span>`;
};
QE.blkH = blkH;
const row = (lab, inner) => `<div class="qe-row"><span class="qe-lab">${lab}</span>${inner}</div>`;

// Build a small input form. fields: [{id, label, value, cls}]; onRun(values, outEl) may throw Error(message).
QE.form = (sel, fields, btn, onRun) => {
  const host = typeof sel === 'string' ? $(sel) : sel;
  host.innerHTML = `<form class="qe-form">${fields.map(f => `<label>${f.label}${f.options
    ? `<select name="${f.id}">${f.options.map(([val, txt]) => `<option value="${val}"${val === f.value ? ' selected' : ''}>${txt}</option>`).join('')}</select>`
    : `<input name="${f.id}" value="${f.value}" class="${f.cls || 'num'}" autocomplete="off" spellcheck="false">`}</label>`).join('')}<button type="submit">${btn}</button></form><div class="qe-err" aria-live="polite"></div><div class="qe-out"></div>`;
  const form = host.querySelector('form'), err = host.querySelector('.qe-err'), out = host.querySelector('.qe-out');
  const run = () => {
    const v = {}; fields.forEach(f => { v[f.id] = form.elements[f.id].value.trim(); });
    err.textContent = '';
    try { onRun(v, out); } catch (e) { err.textContent = e.message; out.innerHTML = ''; }
  };
  form.addEventListener('submit', e => { e.preventDefault(); run(); });
  run();
};
QE.int = (s, name, lo, hi) => {
  const n = Number(String(s).replace(/,/g, ''));
  if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`${name} must be a whole number from ${lo.toLocaleString('en-US')} to ${hi.toLocaleString('en-US')}.`);
  return n;
};
QE.list = (s, name, lo, hi) => {
  const a = s.split(',').map(x => x.trim()).filter(Boolean);
  if (a.length < lo || a.length > hi) throw new Error(`${name}: give ${lo} to ${hi} comma-separated values.`);
  return a;
};

// ---- Tool 1: iterator animation for a tuple-based nested-loop join over two table scans ----
const ITER_POS = { C: [270, 26], J: [270, 112], S: [125, 210], R: [415, 210] };
function iterTree(e) {
  const box = (id, label, sub) => {
    const [x, y] = ITER_POS[id], on = e.node === id, w = 220;
    return `<rect x="${x - w / 2}" y="${y - 20}" width="${w}" height="40" rx="6" class="${on ? 'cell-hl' : id === 'C' ? 'cell-plain' : 'cell'}" ${on ? 'style="stroke:var(--red);stroke-width:2.5"' : ''}/>` +
      `<text x="${x}" y="${y - 3}" text-anchor="middle" class="big">${label}</text><text x="${x}" y="${y + 13}" text-anchor="middle" class="lbl">${sub}</text>`;
  };
  const edge = (a, b) => { const [x1, y1] = ITER_POS[a], [x2, y2] = ITER_POS[b]; return `<line x1="${x1}" y1="${y1 + 20}" x2="${x2}" y2="${y2 - 20}" class="s-fg"/>`; };
  const caller = e.node === 'J' ? 'C' : 'J', [cx, cy] = ITER_POS[caller], [nx, ny] = ITER_POS[e.node];
  let call = '';
  if (e.call !== 'compare') {
    const mx = (cx + nx) / 2, my = (cy + ny) / 2, dx = e.node === 'S' ? -62 : e.node === 'R' ? 62 : 0;
    call = `<text x="${mx + dx + (e.node === 'J' ? 12 : 0)}" y="${my - 2}" text-anchor="${e.node === 'S' ? 'end' : 'start'}" class="red" style="font-size:12px;font-weight:600">${e.node === 'J' ? '' : e.node + '.'}${e.call}</text>` +
      (e.ret ? `<text x="${mx + dx + (e.node === 'J' ? 12 : 0)}" y="${my + 13}" text-anchor="${e.node === 'S' ? 'end' : 'start'}" class="grn" style="font-size:12px;font-weight:600">↑ ${e.ret}</text>` : '');
  }
  return `<svg viewBox="0 0 540 236" width="540" role="img" aria-label="plan tree">${edge('C', 'J')}${edge('J', 'S')}${edge('J', 'R')}` +
    box('C', 'consumer', 'asks for one tuple at a time') + box('J', '⋈ nested-loop join', 'iterator: Open / GetNext / Close') +
    box('S', 'TableScan(S)', `outer loop · ${e.sOpen ? 'open' : 'closed'}`) + box('R', 'TableScan(R)', `inner loop · ${e.rOpen ? 'open' : 'closed'}`) + call + '</svg>';
}
function iterFrame(e, R, S) {
  const cur = (rel, at, open) => rel.map((t, i) => `<span class="qe-blk ${open && i === at - 1 ? 'hl' : !open || i >= at ? '' : 'dim'}"><span>${t.join(', ')}</span></span>`).join('');
  return `<div class="figrow"><div>${iterTree(e)}</div><div style="min-width:15em">` +
    row('S (B, C)', cur(S, e.s, e.sOpen)) + row('R (A, B)', cur(R, e.r, e.rOpen)) +
    row('output so far', e.out.length ? e.out.map(t => `<span class="qe-blk new"><span>${t.join(', ')}</span></span>`).join('') : '<span class="qe-note">(nothing yet)</span>') + '</div></div>';
}
QE.iterTool = sel => QE.form(sel, [
  { id: 'R', label: 'R(A, B) tuples, "A B" separated by commas', value: 'a1 1, a2 2, a3 1', cls: 'wide' },
  { id: 'S', label: 'S(B, C) tuples, "B C" separated by commas', value: '1 c1, 3 c3, 2 c2', cls: 'wide' },
], 'Animate', (v, out) => {
  const parse = (s, n) => QE.list(s, n, 1, 4).map(x => { const p = x.split(/\s+/); if (p.length !== 2) throw new Error(`${n}: each tuple needs exactly 2 values, like "a1 1".`); return p; });
  const R = parse(v.R, 'R'), S = parse(v.S, 'S');
  const ev = QE.nljTrace(R, S);
  stepper(out, ev.map(e => ({ html: iterFrame(e, R, S), cap: e.cap })), { interval: 1700 });
});

// ---- Tool 2: external merge sort / TPMMS animator ----
function sortFrame(s, tpb, M, inputBlocks) {
  let h = row('R on disk', inputBlocks.map((b, i) => blkH(b, tpb, i < s.readUpTo ? 'dim' : '')).join(''));
  if (s.merge) {
    const m = s.merge;
    h += row('sublists on disk', m.g.map(rn => `<span class="qe-grp"><small>${rn.name}</small><span>${rn.blocks.map((b, i) => blkH(b, tpb, i < rn.at ? 'dim' : i === rn.at ? 'hl' : '')).join('')}</span></span>`).join('') +
      s.runs.map(rn => `<span class="qe-grp"><small>${rn.name}</small><span>${rn.blocks.map(b => blkH(b, tpb, 'dim')).join('')}</span></span>`).join(''));
    const used = m.buf.length;
    h += `<div class="qe-mem"><span class="qe-lab">main memory · M = ${M} buffers</span>` +
      row('input buffers', m.buf.map((b, k) => `<span class="qe-grp"><small>${m.g[k].name}</small>${blkH(b, tpb, !b.length ? 'free' : k === m.pick ? 'hl' : '')}</span>`).join('') +
        Array.from({ length: M - 1 - used }, () => `<span class="qe-grp"><small>unused</small>${blkH([], tpb, 'free')}</span>`).join('')) +
      row('output buffer', blkH(m.out, tpb, 'new', m.pick != null && m.out.length ? m.out.length - 1 : -1)) + '</div>';
    h += row(m.last ? 'result' : 'new run on disk', m.outBlocks.length ? m.outBlocks.map(b => blkH(b, tpb, 'new')).join('') : '<span class="qe-note">(no block written yet)</span>');
  } else {
    h += `<div class="qe-mem"><span class="qe-lab">main memory · M = ${M} buffers</span>` + row('buffers', Array.from({ length: M }, (_, i) => s.mem[i] ? blkH(s.mem[i].t, tpb, s.mem[i].cls || '') : blkH([], tpb, 'free')).join('')) + '</div>';
    h += row(s.final ? 'sorted R' : 'sublists on disk', s.runs.length ? s.runs.map(rn => `<span class="qe-grp"><small>${rn.name}</small><span>${rn.blocks.map(b => blkH(b, tpb, rn.cls || '')).join('')}</span></span>`).join('') : '<span class="qe-note">(none yet)</span>');
  }
  h += `<div class="qe-io">${s.phase} · disk I/O so far: reads <b>${s.io.r}</b> · writes <b>${s.io.w}</b>${s.io.o ? ` · result writes <b>${s.io.o}</b>` : ''}</div>`;
  return h;
}
QE.sortAnim = (sel, items, tpb, M, opts = {}) => {
  const st = QE.sortTrace(items, tpb, M, opts), input = QE.chunk(items, tpb);
  return stepper(sel, st.map(s => ({ html: sortFrame(s, tpb, M, input), cap: s.cap })), { interval: 1500 });
};
QE.sortTool = (sel, init = {}) => QE.form(sel, [
  { id: 'items', label: 'Tuples to sort (comma-separated; sort key = first word)', value: init.items || '17, 3, 42, 8, 25, 1, 33, 12, 9, 30, 5, 21, 14, 2', cls: 'wide' },
  { id: 'tpb', label: 'Tuples per block', value: init.tpb || 2 },
  { id: 'M', label: 'Buffers M', value: init.M || 3 },
], 'Animate the sort', (v, out) => {
  const items = QE.list(v.items, 'Tuples', 2, 30), tpb = QE.int(v.tpb, 'Tuples per block', 1, 4), M = QE.int(v.M, 'M', 3, 8);
  out.innerHTML = '<div></div>';
  QE.sortAnim(out.firstChild, items, tpb, M, { dedup: !!init.dedup });
});
QE.sortCalc = sel => QE.form(sel, [
  { id: 'B', label: 'B(R) blocks', value: '1000000' }, { id: 'M', label: 'Buffers M', value: '1000' },
], 'Compute', (v, out) => {
  const B = QE.int(v.B, 'B(R)', 1, 1e12), M = QE.int(v.M, 'M', 3, 1e9), p = QE.sortPlan(B, M);
  if (p.onePass) { out.innerHTML = `<p>B(R) = ${QE.fmt(B)} ≤ M = ${QE.fmt(M)}: R fits in memory. Read it once and sort it in memory: <b>${QE.fmt(B)} I/Os</b>.</p>`; return; }
  out.innerHTML = `<div class="tbl"><table class="qe-tbl"><tr><th>Quantity</th><th>Formula</th><th>Value</th></tr>
    <tr><td>Sorted sublists after phase 1</td><td class="f">⌈B/M⌉ = ⌈${QE.fmt(B)}/${QE.fmt(M)}⌉</td><td>${QE.fmt(p.runs)}</td></tr>
    <tr><td>Most sublists phase 2 can merge</td><td class="f">M − 1</td><td>${QE.fmt(M - 1)}</td></tr>
    <tr><td>Largest R for two phases</td><td class="f">M(M−1) ≈ M²</td><td>${QE.fmt(p.maxTwoPhase)} blocks (M² = ${QE.fmt(M * M)})</td></tr>
    <tr class="${p.twoPhase ? 'win' : 'no'}"><td>Is TPMMS (two phases) enough?</td><td class="f">${QE.fmt(p.runs)} ≤ ${QE.fmt(M - 1)} ?</td><td>${p.twoPhase ? 'Yes' : 'No: more merge passes are needed'}</td></tr>
    <tr><td>Merge passes</td><td class="f">⌈log<sub>M−1</sub>(⌈B/M⌉)⌉</td><td>${p.passes} (sublists per pass: ${p.counts.map(QE.fmt).join(' → ')})</td></tr>
    <tr class="win"><td>Disk I/Os (result not stored)</td><td class="f">B(2·passes + 1) = ${QE.fmt(B)} × ${2 * p.passes + 1}</td><td><b>${QE.fmt(p.io)}</b>${p.twoPhase ? ' (= 3B)' : ''}</td></tr>
    <tr><td>Disk I/Os (sorted R written to disk)</td><td class="f">+ B</td><td><b>${QE.fmt(p.ioStored)}</b>${p.twoPhase ? ' (= 4B)' : ''}</td></tr>
    <tr><td>Smallest M for two phases</td><td class="f">smallest M with ⌈B/M⌉ ≤ M − 1</td><td>${QE.fmt(QE.minM2(B))} (≈ √B = ${QE.fmt(Math.sqrt(B))})</td></tr></table></div>`;
});

// ---- Tool 3: join cost calculator ----
QE.joinCalc = (sel, init = {}) => QE.form(sel, [
  { id: 'BR', label: 'B(R)', value: init.BR || 1000 }, { id: 'BS', label: 'B(S)', value: init.BS || 500 },
  { id: 'TR', label: 'T(R) (optional)', value: init.TR ?? 10000 }, { id: 'TS', label: 'T(S) (optional)', value: init.TS ?? 5000 },
  { id: 'M', label: 'M', value: init.M || 101 },
], 'Compare', (v, out) => {
  const BR = QE.int(v.BR, 'B(R)', 1, 1e9), BS = QE.int(v.BS, 'B(S)', 1, 1e9), M = QE.int(v.M, 'M', 3, 1e9);
  const TR = v.TR ? QE.int(v.TR, 'T(R)', BR, 1e12) : 0, TS = v.TS ? QE.int(v.TS, 'T(S)', BS, 1e12) : 0;
  const rows = QE.joinCosts({ BR, BS, TR, TS, M });
  const win = rows.filter(r => r.win).map(r => r.name);
  out.innerHTML = `<div class="tbl"><table class="qe-tbl"><tr><th>Algorithm</th><th>Formula</th><th>With your numbers</th><th>Disk I/Os</th><th>Works with M = ${QE.fmt(M)}?</th></tr>` +
    rows.map(r => `<tr class="${r.win ? 'win' : r.ok ? '' : 'no'}"><td>${r.name}</td><td class="f">${r.formula}</td><td class="f">${r.sub}</td><td class="num"><b>${QE.fmt(r.cost)}</b></td><td>${r.ok ? '<span class="good">yes</span>' : '<span class="bad">no</span>'}<br><small>${r.note}</small></td></tr>`).join('') +
    `</table></div><p><b>Cheapest that works:</b> ${win.join(' and ')} (${QE.fmt(rows.find(r => r.win).cost)} I/Os). The sort-based joins also need the tuples sharing one join value to fit in memory; the tool cannot check that.</p>`;
});

// ---- Tool 4: block-based nested-loop join animation ----
function bnljFrame(s, Bo, Bi, M, on, inn) {
  const lab = (p, i, cls) => `<span class="qe-blk ${cls}"><span>${p}${i + 1}</span></span>`;
  const chunkOf = i => Math.floor(i / (M - 1));
  let h = row(`${on} on disk (outer)`, [...Array(Bo).keys()].map(i => lab(on, i, s.chunk === null ? (s.done ? 'dim' : '') : chunkOf(i) < s.chunk ? 'dim' : chunkOf(i) === s.chunk ? 'hl' : '')).join(''));
  h += row(`${inn} on disk (inner)`, [...Array(Bi).keys()].map(i => lab(inn, i, s.inner === i ? 'hl' : s.inner > i ? 'dim' : '')).join(''));
  h += `<div class="qe-mem"><span class="qe-lab">main memory · M = ${M} buffers</span>` +
    row(`${M - 1} buffers: chunk of ${on}`, Array.from({ length: M - 1 }, (_, i) => s.mem[i] !== undefined ? lab(on, s.mem[i], 'new') : '<span class="qe-blk free"><span>empty</span></span>').join('')) +
    row(`1 buffer: block of ${inn}`, s.inner >= 0 ? lab(inn, s.inner, 'hl') : '<span class="qe-blk free"><span>empty</span></span>') + '</div>';
  return h + `<div class="qe-io">disk I/O so far: <b>${s.io}</b> · complete scans of ${inn}: <b>${s.scans}</b></div>`;
}
QE.bnljTool = (sel, init = {}) => QE.form(sel, [
  { id: 'Bo', label: 'Outer B (smaller relation)', value: init.Bo || 5 }, { id: 'Bi', label: 'Inner B', value: init.Bi || 6 },
  { id: 'M', label: 'Buffers M', value: init.M || 3 },
  { id: 'on', label: 'Outer name', value: init.on || 'S' }, { id: 'inn', label: 'Inner name', value: init.inn || 'R' },
], 'Animate the join', (v, out) => {
  const Bo = QE.int(v.Bo, 'Outer B', 1, 12), Bi = QE.int(v.Bi, 'Inner B', 1, 12), M = QE.int(v.M, 'M', 2, 8);
  const on = (v.on || 'S').slice(0, 3), inn = (v.inn || 'R').slice(0, 3);
  const st = QE.bnljTrace(Bo, Bi, M, on, inn);
  if (st.length > 160) throw new Error('That makes too many steps to animate. Use smaller numbers (the calculator handles big ones).');
  out.innerHTML = '<div></div>';
  stepper(out.firstChild, st.map(s => ({ html: bnljFrame(s, Bo, Bi, M, on, inn), cap: s.cap })), { interval: 1200 });
});

// ---- hash partitioning animation ----
QE.hashAnim = (sel, items, tpb, M) => {
  const st = QE.hashTrace(items, tpb, M), input = QE.chunk(items, tpb), k = M - 1;
  return stepper(sel, st.map(s => ({ cap: s.cap, html:
    row('R on disk', input.map((b, i) => blkH(b, tpb, i < s.blk ? 'dim' : i === s.blk ? 'hl' : '')).join('')) +
    `<div class="qe-mem"><span class="qe-lab">main memory · M = ${M} buffers</span>` +
    row('input buffer', s.inp ? blkH(s.inp, tpb, '', s.pick, s.pick) : blkH([], tpb, 'free')) +
    row('bucket buffers', s.buf.map((b, j) => `<span class="qe-grp"><small>bucket ${j}</small>${blkH(b, tpb, j === s.hb ? 'hl' : '')}</span>`).join('')) + '</div>' +
    row('buckets on disk', s.disk.map((d, j) => `<span class="qe-grp"><small>bucket ${j}</small><span>${d.length ? d.map(b => blkH(b, tpb, 'new')).join('') : '<span class="qe-note">empty</span>'}</span></span>`).join('')) +
    `<div class="qe-io">disk I/O so far: reads <b>${s.io.r}</b> · writes <b>${s.io.w}</b></div>` })), { interval: 1300 });
};

// ---- one-pass operation animation ----
QE.onePassAnim = (sel, o) => {
  const st = QE.onePassTrace(o), tpb = o.tpb || 2;
  const memLab = o.op === 'dedup' ? 'tuples seen so far' : o.op === 'group' ? 'one entry per group' : `${o.memName || 'S'} in memory (M−1 buffers)`;
  return stepper(sel, st.map(s => ({ cap: s.cap, html:
    (o.mem && o.mem.length ? row(`${o.memName || 'S'} on disk`, QE.chunk(o.mem, tpb).map((b, i) => blkH(b, tpb, s.src === 'mem' && i === s.bi ? 'hl' : s.src === 'mem' && i > s.bi ? '' : 'dim')).join('')) : '') +
    row(`${o.strName || 'R'} on disk`, QE.chunk(o.str, tpb).map((b, i) => blkH(b, tpb, s.src === 'str' && i === s.bi ? 'hl' : s.done || (s.src === 'str' && i < s.bi) ? 'dim' : '')).join('')) +
    `<div class="qe-mem"><span class="qe-lab">main memory</span>` +
    row(memLab, s.tab.length ? s.tab.map(e => `<span class="qe-blk"><span>${o.op === 'group' ? `${e.k}: cnt ${e.v.count}, sum ${e.v.sum}, min ${e.v.min}, max ${e.v.max}` : o.op === 'bagInter' ? `${e.k} ×${e.v}` : o.op === 'join' ? `Y=${e.k} → ${e.v.join(', ')}` : e.k}</span></span>`).join('') : '<span class="qe-note">(empty)</span>') +
    row('input buffer', s.src === 'str' && s.blk ? blkH(s.blk, tpb, '', s.pick) : blkH([], tpb, 'free')) + '</div>' +
    row('output', s.out.length ? s.out.map(t => `<span class="qe-blk new"><span>${t}</span></span>`).join('') : '<span class="qe-note">(nothing yet)</span>') +
    `<div class="qe-io">disk I/O so far: <b>${s.io}</b></div>` })), { interval: 1400 });
};

}

// smallest M with ceil(B/M) <= M-1 (two-phase sort feasible)
QE.minM2 = B => { let M = Math.max(3, Math.floor(Math.sqrt(B))); while (M > 3 && Math.ceil(B / (M - 1)) <= M - 2) M--; while (Math.ceil(B / M) > M - 1) M++; return M; };
