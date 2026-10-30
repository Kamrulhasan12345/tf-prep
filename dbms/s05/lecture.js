// Lec 05–06 (Sukarna) · Coping with system failures.
// Shared engine + interactive tools, used by s05/*.html and s06/*.html (loaded as ../s05/lecture.js).
//   parseLog(text)               -> {recs, errs}
//   recover(recs, mode)          -> recovery trace for 'undo' | 'redo' | 'undoredo' logging
//   runScript(script, init, mode)-> step table for one transaction T (INPUT/READ/WRITE/OUTPUT/FLUSH LOG)
//   xactTool, recoveryTool, recoveryAnim, timelineTool: page widgets built on stepper().

const RV_MODES = { undo: 'Undo logging', redo: 'Redo logging', undoredo: 'Undo/redo logging' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------- log parsing
function parseRec(raw) {
  const s = raw.replace(/\s+/g, ' ').trim();
  let m;
  if (/^(CKPT|CHECKPOINT)$/i.test(s)) return { k: 'ckpt' };
  if ((m = s.match(/^START ?CKPT ?(?:\((.*)\)|(.*))$/i))) {
    const list = (m[1] ?? m[2] ?? '').split(/[ ,]+/).map(x => x.trim()).filter(Boolean);
    if (list.some(t => !/^\w+$/.test(t))) return { err: 'transaction names in a checkpoint list must be words like T1' };
    return { k: 'sckpt', list };
  }
  if (/^END ?CKPT$/i.test(s)) return { k: 'eckpt' };
  if (/^(START|END) ?DUMP$/i.test(s)) return { k: 'dump', end: /^END/i.test(s) };
  if ((m = s.match(/^(START|COMMIT|ABORT) (\w+)$/i))) return { k: m[1].toLowerCase(), t: m[2] };
  if ((m = s.match(/^(\w+) ?,? ?(start|commit|abort)$/i))) return { k: m[2].toLowerCase(), t: m[1] };
  const p = s.split(',').map(x => x.trim());
  if ((p.length === 3 || p.length === 4) && p.every(Boolean) && /^\w+$/.test(p[0]) && /^\w+$/.test(p[1]))
    return { k: 'upd', t: p[0], x: p[1], v: p[2], w: p[3] };
  return { err: 'this is not a log record I recognise (try <START T1>, <T1,A,8>, <T1,A,8,16>, <COMMIT T1>, <START CKPT(T1,T2)>, <END CKPT>)' };
}
function recText(r) {
  switch (r.k) {
    case 'start': return `<START ${r.t}>`;
    case 'commit': return `<COMMIT ${r.t}>`;
    case 'abort': return `<ABORT ${r.t}>`;
    case 'ckpt': return '<CKPT>';
    case 'sckpt': return `<START CKPT(${r.list.join(',')})>`;
    case 'eckpt': return '<END CKPT>';
    case 'dump': return r.end ? '<END DUMP>' : '<START DUMP>';
    default: return `<${r.t},${r.x},${r.v}${r.w !== undefined ? ',' + r.w : ''}>`;
  }
}
function parseLog(text) {
  const recs = [], errs = [];
  const re = /<([^<>]*)>/g;
  let m;
  while ((m = re.exec(text))) {
    const r = parseRec(m[1]);
    if (r.err) errs.push(`<code>${esc('<' + m[1].trim() + '>')}</code>: ${r.err}.`);
    else recs.push(r);
  }
  if (!recs.length && !errs.length) errs.push('No log records found. Put each record in angle brackets, for example <code>&lt;START T1&gt;</code>.');
  return { recs, errs };
}

// Sanity checks that do not stop the simulation but deserve a warning.
function logWarnings(recs, mode) {
  const w = [], started = new Set(), ended = new Set();
  recs.forEach((r, i) => {
    const n = `record ${i + 1} ${esc(recText(r))}`;
    if (r.k === 'start') { if (started.has(r.t)) w.push(`${n}: ${r.t} was already started.`); started.add(r.t); }
    if (r.k === 'commit' || r.k === 'abort') { if (!started.has(r.t)) w.push(`${n}: there is no &lt;START ${r.t}&gt; before it.`); ended.add(r.t); }
    if (r.k === 'upd') {
      if (!started.has(r.t)) w.push(`${n}: there is no &lt;START ${r.t}&gt; before it.`);
      if (ended.has(r.t)) w.push(`${n}: ${r.t} writes after its COMMIT/ABORT record, which a real system never does. It is treated as an update of ${r.t}.`);
      if (mode === 'undoredo' && r.w === undefined) w.push(`${n}: undo/redo logging needs both the old and the new value, &lt;T,X,old,new&gt;.`);
      if (mode !== 'undoredo' && r.w !== undefined) w.push(`${n}: has two values; ${mode === 'undo' ? 'undo logging uses the first (old) value' : 'redo logging uses the second (new) value'}.`);
    }
    if (r.k === 'sckpt') {
      const active = [...started].filter(t => !ended.has(t));
      const missing = active.filter(t => !r.list.includes(t)), extra = r.list.filter(t => !active.includes(t));
      if (missing.length) w.push(`${n}: ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} active here but not in the list.`);
      if (extra.length) w.push(`${n}: ${extra.join(', ')} ${extra.length > 1 ? 'are' : 'is'} in the list but not active here.`);
    }
    if (r.k === 'eckpt' && mode === 'undo') {
      let s = i - 1; while (s >= 0 && recs[s].k !== 'sckpt') s--;
      if (s >= 0) {
        const open = recs[s].list.filter(t => !ended.has(t));
        if (open.length) w.push(`${n}: under undo logging &lt;END CKPT&gt; may only be written after ${open.join(', ')} ${open.length > 1 ? 'have' : 'has'} finished.`);
      }
    }
  });
  return w;
}

// ---------------------------------------------------------------- recovery engine
// Returns {frames, writes, aborts, scanned:[lo,hi], warns, final}. Each frame snapshots a status for every record.
function recover(recs, mode, disk = null) {
  const n = recs.length, st = recs.map(() => null), frames = [], writes = [], warns = logWarnings(recs, mode);
  const db = disk ? { ...disk } : {};
  const committed = new Set(recs.filter(r => r.k === 'commit').map(r => r.t));
  const aborted = new Set(recs.filter(r => r.k === 'abort').map(r => r.t));
  const startIdx = {}; recs.forEach((r, i) => { if (r.k === 'start' && startIdx[r.t] === undefined) startIdx[r.t] = i; });
  const txns = [...new Set(recs.filter(r => r.t).map(r => r.t))];
  const set = s => s.size ? [...s].join(', ') : '∅';
  const snap = (cur, dir, cap, extra = {}) => frames.push({ cur, dir, cap, st: st.slice(), writes: writes.slice(), ...extra });
  const write = (x, v, i, kind) => { writes.push({ x, v, i, kind }); db[x] = v; };
  const oldv = r => r.v, newv = r => (r.w !== undefined ? r.w : r.v);
  let lo = 0, hi = n - 1, aborts = [];

  if (mode === 'undo') {
    const done = new Set(), inc = new Set(), seenStart = new Set();
    let ck = null, need = null, stop = -1;
    snap(-1, 'up', 'Undo recovery scans the log <b>backward</b>, from the last record to the first. It remembers every transaction whose COMMIT or ABORT it has seen; any other transaction is incomplete, and each of its update records &lt;T,X,v&gt; is undone by writing the old value v back to X on disk.', { sets: { 'Complete (COMMIT/ABORT seen)': '∅', 'Incomplete': '∅' } });
    for (let i = n - 1; i >= 0; i--) {
      const r = recs[i];
      let cap = '', stopHere = false;
      if (r.k === 'commit' || r.k === 'abort') {
        done.add(r.t); st[i] = ['mark', 'complete'];
        cap = `${r.t} has a ${r.k.toUpperCase()} record, so it is complete. By rule U2 all its changes reached disk before the COMMIT did, so its update records will be ignored.`;
      } else if (r.k === 'upd') {
        if (done.has(r.t)) { st[i] = ['skip', 'ignore']; cap = `${r.t} is complete, so this record is ignored.`; }
        else {
          inc.add(r.t); write(r.x, oldv(r), i, 'undo'); st[i] = ['undo', `${r.x} ← ${oldv(r)}`];
          cap = `${r.t} has no COMMIT record (we have scanned everything after this point), so it is incomplete. <b>Undo: write ${r.x} = ${oldv(r)}</b> on disk. By rule U1 this record reached disk before any new value of ${r.x} did, so writing the old value is always safe.`;
        }
      } else if (r.k === 'start') {
        seenStart.add(r.t);
        if (!done.has(r.t)) inc.add(r.t);
        st[i] = ['mark', done.has(r.t) ? 'start' : 'start (incomplete)'];
        cap = done.has(r.t) ? `Start of ${r.t}, which is complete. Nothing to do.` : `Start of ${r.t}: every change of this incomplete transaction is now undone.`;
        if (need) {
          need.delete(r.t);
          if (!need.size) { stopHere = true; cap += ` This was the last incomplete transaction of the checkpoint list whose START we needed, so <b>the scan stops here</b>.`; }
        }
      } else if (r.k === 'ckpt') {
        if (!ck) { stopHere = true; st[i] = ['ck', 'stop']; cap = 'A quiescent &lt;CKPT&gt;: every transaction that started before it had finished (COMMIT or ABORT) when it was written. Everything before it is irrelevant. <b>Stop.</b>'; }
        else { st[i] = ['ck', '']; cap = 'An older checkpoint record; it does not change where we stop.'; }
      } else if (r.k === 'eckpt') {
        if (!ck) { ck = 'end'; st[i] = ['ck', 'END seen first']; cap = 'The first checkpoint record met is &lt;END CKPT&gt;. So the checkpoint completed: every transaction in its START CKPT list finished, and every incomplete transaction started after that &lt;START CKPT&gt;. <b>We can stop at the matching &lt;START CKPT&gt;</b> (case 1).'; }
        else { st[i] = ['ck', '']; cap = 'An &lt;END CKPT&gt; of an older checkpoint. We already know where to stop, so it is ignored.'; }
      } else if (r.k === 'sckpt') {
        if (ck === 'end') { stopHere = true; ck = 'done'; st[i] = ['ck', 'stop']; cap = `The &lt;START CKPT(${r.list.join(',')})&gt; that matches the &lt;END CKPT&gt;. All of ${r.list.join(', ') || 'its listed transactions'} finished before the END CKPT, and no incomplete transaction started earlier. <b>Stop.</b>`; }
        else if (!ck) {
          ck = 'start';
          need = new Set(r.list.filter(t => !done.has(t) && !seenStart.has(t)));
          r.list.filter(t => !done.has(t)).forEach(t => inc.add(t));
          st[i] = ['ck', 'START seen first'];
          cap = `The first checkpoint record met is &lt;START CKPT(${r.list.join(',')})&gt; with no END after it: the crash happened during the checkpoint (case 2). The only incomplete transactions are those found so far plus listed ones that did not finish: ` +
            (need.size ? `<b>${[...need].join(', ')}</b>. We must keep scanning back to the earliest START among them.` : `none of the listed ones (${r.list.join(', ') || 'none listed'}) is incomplete, so <b>we can stop here</b>.`);
          if (!need.size) stopHere = true;
        } else { st[i] = ['ck', '']; cap = 'An older &lt;START CKPT&gt;; the scan is still looking for the START records it needs.'; }
      } else { st[i] = ['skip', '']; cap = 'A dump marker; not used for system-failure recovery.'; }
      snap(i, 'up', cap, { sets: { 'Complete (COMMIT/ABORT seen)': set(done), 'Incomplete': set(inc) } });
      if (stopHere) { stop = i; break; }
    }
    if (stop < 0) stop = 0;
    lo = stop;
    for (let i = 0; i < stop; i++) st[i] = ['out', 'not scanned'];
    aborts = [...inc].filter(t => !aborted.has(t));
  } else if (mode === 'redo' || mode === 'undoredo') {
    // where may the redo pass start, and which committed transactions need redoing?
    let k = n - 1;
    while (k >= 0 && !['ckpt', 'sckpt', 'eckpt'].includes(recs[k].k)) k--;
    let redoFrom = 0, why = 'There is no checkpoint, so the redo pass starts at the beginning of the log.', cand = null, ckIdx = [];
    const pairFrom = e => { let s = e - 1; while (s >= 0 && recs[s].k !== 'sckpt') s--; return s; };
    let useEnd = -1;
    if (k >= 0 && recs[k].k === 'ckpt') { redoFrom = k; ckIdx = [k]; cand = new Set(txns.filter(t => (startIdx[t] ?? -1) > k)); why = 'The last checkpoint is a quiescent &lt;CKPT&gt;: every transaction before it finished and had its changes flushed, so we start right after it.'; }
    else if (k >= 0 && recs[k].k === 'eckpt') useEnd = k;
    else if (k >= 0 && recs[k].k === 'sckpt') {
      let e = k - 1; while (e >= 0 && recs[e].k !== 'eckpt' && recs[e].k !== 'ckpt') e--;
      ckIdx = [k];
      if (e >= 0 && recs[e].k === 'eckpt') { useEnd = e; why = `The last checkpoint record is &lt;START CKPT(${recs[k].list.join(',')})&gt; with no END: that checkpoint never completed, so it guarantees nothing. We go back to the previous &lt;END CKPT&gt; and its matching START CKPT. `; }
      else if (e >= 0) { redoFrom = e; ckIdx.push(e); cand = new Set(txns.filter(t => (startIdx[t] ?? -1) > e)); why = 'The last checkpoint never completed; the previous one is a quiescent &lt;CKPT&gt;, so we start after it.'; }
      else why = `The last checkpoint record is &lt;START CKPT(${recs[k].list.join(',')})&gt; with no &lt;END CKPT&gt;, and there is no earlier completed checkpoint. So it guarantees nothing, and the redo pass must start at the beginning of the log.`;
    }
    if (useEnd >= 0) {
      const s = pairFrom(useEnd);
      ckIdx.push(useEnd, s);
      const list = s >= 0 ? recs[s].list : [];
      if (mode === 'redo') {
        cand = new Set([...list, ...txns.filter(t => (startIdx[t] ?? -1) > s)]);
        const firsts = list.map(t => startIdx[t]).filter(x => x !== undefined && x < s);
        redoFrom = firsts.length ? Math.min(...firsts) : s;
        why = (useEnd === k ? '' : why) + `&lt;END CKPT&gt; (record ${useEnd + 1}) matches &lt;START CKPT(${list.join(',')})&gt; (record ${s + 1}). Every transaction that committed before that START CKPT has its changes on disk. Only ${list.length ? list.join(', ') + ' and ' : ''}transactions that started after the START CKPT can still need redoing, so the forward pass starts at ${firsts.length ? `the earliest of their START records, record ${redoFrom + 1}` : `the START CKPT, record ${s + 1}`}.`;
      } else {
        redoFrom = s;
        why = (useEnd === k ? '' : why) + `&lt;END CKPT&gt; (record ${useEnd + 1}) matches &lt;START CKPT(${list.join(',')})&gt; (record ${s + 1}). During that checkpoint <em>every</em> dirty buffer was flushed, so every change logged before the START CKPT is on disk. The redo pass starts at the START CKPT, record ${s + 1}.`;
      }
    }
    const inc = new Set(txns.filter(t => !committed.has(t) && !aborted.has(t)));
    const ckNote = ckIdx.filter(x => x >= 0);
    ckNote.forEach(x => { st[x] = ['ck', 'checkpoint']; });
    recs.forEach((r, i) => { if (r.k === 'commit') st[i] = ['mark', 'committed']; });
    snap(-1, 'down', `${RV_MODES[mode]}. <b>Step 1: find the committed transactions</b> (those with a COMMIT record on the log): <b>${set(committed)}</b>. ` +
      (mode === 'redo' ? 'Every other transaction is incomplete. By rule R1 none of their changes can be on disk, so they need nothing except an ABORT record at the end.' : `Incomplete: <b>${set(inc)}</b>. These must be undone, the committed ones redone.`),
      { sets: { Committed: set(committed), Incomplete: set(inc) } });
    snap(ckNote.length ? ckNote[0] : -1, 'up', '<b>Where does the redo pass start?</b> ' + why, { sets: { Committed: set(committed), Incomplete: set(inc) }, from: redoFrom });
    for (let i = 0; i < redoFrom; i++) if (!st[i] || st[i][0] !== 'ck') st[i] = ['out', 'not needed'];
    for (let i = redoFrom; i < n; i++) {
      const r = recs[i];
      let cap;
      if (r.k === 'upd') {
        if (committed.has(r.t) && (!cand || cand.has(r.t))) { write(r.x, newv(r), i, 'redo'); st[i] = ['redo', `${r.x} ← ${newv(r)}`]; cap = `${r.t} committed. We cannot tell whether this change reached disk, so <b>redo: write ${r.x} = ${newv(r)}</b>. Writing it again is harmless if it was already there.`; }
        else if (committed.has(r.t)) { st[i] = ['skip', 'on disk']; cap = `${r.t} committed before the checkpoint started, so its changes were flushed during the checkpoint. Skip.`; }
        else { st[i] = ['skip', 'ignore']; cap = `${r.t} did not commit. ${mode === 'redo' ? 'By rule R1 its change never reached disk. Skip.' : 'It will be handled by the undo pass. Skip for now.'}`; }
      } else if (r.k === 'commit') cap = `COMMIT of ${r.t}.`;
      else if (r.k === 'start') { st[i] = st[i] || ['mark', '']; cap = `Start of ${r.t}.`; }
      else cap = 'Nothing to redo for this record.';
      snap(i, 'down', '<b>Redo pass (forward).</b> ' + cap);
    }
    lo = Math.min(redoFrom, n - 1);
    if (mode === 'undoredo') {
      const need = new Set(inc);
      let stop = n;
      snap(-1, 'up', `<b>Step 2: undo pass (backward)</b>, from the end, for the incomplete transactions <b>${set(inc)}</b>, latest change first. ${inc.size ? 'It continues until the START record of each of them has been passed.' : 'There are none, so nothing is undone.'}`);
      if (need.size) for (let i = n - 1; i >= 0; i--) {
        const r = recs[i];
        let cap = null;
        if (r.k === 'upd' && inc.has(r.t)) { write(r.x, oldv(r), i, 'undo'); st[i] = ['undo', `${r.x} ← ${oldv(r)}`]; cap = `${r.t} is incomplete: <b>undo, write ${r.x} = ${oldv(r)}</b> (its old value).`; }
        else if (r.k === 'start' && need.has(r.t)) {
          need.delete(r.t); st[i] = ['mark', 'start (undone)'];
          cap = `START of ${r.t}: all its changes are undone.` + (need.size ? '' : ' Every incomplete transaction is now fully undone, so the undo pass stops.');
        }
        else if (st[i] && st[i][0] === 'out') st[i] = ['skip', ''];
        if (cap) snap(i, 'up', '<b>Undo pass (backward).</b> ' + cap);
        stop = i;
        if (!need.size) break;
      }
      lo = Math.min(lo, stop);
      for (let i = 0; i < lo; i++) if (!st[i] || st[i][0] === 'out') st[i] = ['out', 'not needed'];
    }
    aborts = [...inc].filter(t => !aborted.has(t));
  }
  // final frame
  const wtxt = writes.length ? writes.map(w => `${w.x} = ${w.v}`).join(', ') : 'none';
  let cap = `<b>Done.</b> Disk writes made by recovery, in order: <b>${wtxt}</b>. ` +
    (aborts.length ? `Then write ${aborts.map(t => `&lt;ABORT ${t}&gt;`).join(' ')} to the log and flush it, so a later recovery knows these transactions were dealt with.` : 'No ABORT records are needed.');
  if (disk) cap += ` Database after recovery: <b>${Object.entries(db).map(([x, v]) => `${x} = ${v}`).join(', ')}</b>.`;
  snap(-1, null, cap, { aborts });
  return { frames, writes, aborts, scanned: [lo, hi], warns, final: disk ? db : null };
}

// ---------------------------------------------------------------- transaction script interpreter
// One transaction T. Lines: START | READ(X,t) | WRITE(X,t) | INPUT(X) | OUTPUT(X) | FLUSH LOG | COMMIT | t := expr
function parseVals(text) {
  const out = {}, errs = [];
  for (const part of String(text).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)) {
    const m = part.match(/^([A-Za-z]\w*)\s*=\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) errs.push(`"${esc(part)}" should look like A = 8.`); else out[m[1]] = +m[2];
  }
  return { vals: out, errs };
}
function runScript(script, init, mode) {
  const lines = script.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
  const errs = [], rows = [];
  const loc = {}, mem = {}, disk = { ...init }, logBuf = [], logDisk = [], dirty = new Set(), written = new Set();
  let committedLogged = false;
  const els = Object.keys(init);
  const need = x => { if (!(x in disk)) { errs.push(`Line "${esc(cur)}": element ${x} has no initial value. Add it to the initial values.`); return false; } return true; };
  let cur = '';
  const upd = (x, oldv, newv) => mode === 'undo' ? { k: 'upd', t: 'T', x, v: oldv } : mode === 'redo' ? { k: 'upd', t: 'T', x, v: newv } : { k: 'upd', t: 'T', x, v: oldv, w: newv };
  const onDisk = pred => logDisk.some(pred);
  for (cur of lines) {
    let m, act = cur, log = null, note = '', viol = '', hl = [];
    const L = cur.toUpperCase().replace(/\s+/g, ' ');
    if (/^(<\s*)?START( T)?(\s*>)?$/.test(L)) { act = ''; if (mode !== 'none') { log = { k: 'start', t: 'T' }; note = '&lt;START T&gt; is appended to the log buffer in memory.'; } else note = 'Transaction T begins.'; }
    else if (/^(<\s*)?COMMIT( T)?(\s*>)?$/.test(L)) {
      act = '';
      if (mode === 'none') note = 'T commits (no log is kept).';
      else { log = { k: 'commit', t: 'T' }; committedLogged = true; note = '&lt;COMMIT T&gt; is appended to the log buffer. It is not on disk until the next FLUSH LOG.'; }
    } else if (/^FLUSH ?LOG$/.test(L)) {
      act = 'FLUSH LOG';
      if (mode === 'none') { errs.push('FLUSH LOG needs a logging method (choose undo, redo or undo/redo).'); break; }
      const moved = logBuf.splice(0);
      if (mode === 'undo' && moved.some(r => r.k === 'commit')) {
        const pend = [...written].filter(x => mem[x] !== disk[x]);
        if (pend.length) viol = `Violates <b>U2</b>: &lt;COMMIT T&gt; reaches disk while the new value of ${pend.join(', ')} is still only in memory.`;
      }
      logDisk.push(...moved);
      note = moved.length ? `The log buffer is written to disk: ${moved.map(r => esc(recText(r))).join(' ')} ${moved.length > 1 ? 'are' : 'is'} now safe from a crash.` : 'The log buffer was empty; nothing changes.';
    } else if ((m = cur.match(/^INPUT\s*\(\s*([A-Za-z]\w*)\s*\)$/i))) {
      const x = m[1]; if (!need(x)) break;
      mem[x] = disk[x]; hl.push('M-' + x); note = `INPUT(${x}): disk block ${x} is copied into a memory buffer.`;
    } else if ((m = cur.match(/^READ\s*\(\s*([A-Za-z]\w*)\s*,\s*([a-z]\w*)\s*\)$/i))) {
      const [, x, t] = m; if (!need(x)) break;
      if (!(x in mem)) { mem[x] = disk[x]; hl.push('M-' + x); note = `${x} is not in a buffer, so INPUT(${x}) runs first. `; }
      loc[t] = mem[x]; hl.push('L-' + t); note += `READ(${x},${t}): the buffer value ${mem[x]} is copied into T's local variable ${t}.`;
    } else if ((m = cur.match(/^WRITE\s*\(\s*([A-Za-z]\w*)\s*,\s*([a-z]\w*)\s*\)$/i))) {
      const [, x, t] = m; if (!need(x)) break;
      if (!(t in loc)) { errs.push(`Line "${esc(cur)}": local variable ${t} has no value yet (READ into it first).`); break; }
      if (!(x in mem)) { mem[x] = disk[x]; note = `${x} is not in a buffer, so INPUT(${x}) runs first. `; }
      const old = mem[x]; mem[x] = loc[t]; dirty.add(x); written.add(x); hl.push('M-' + x);
      if (mode !== 'none') log = upd(x, old, loc[t]);
      note += `WRITE(${x},${t}): ${t} = ${loc[t]} is copied into the buffer of ${x}. Disk is unchanged.` + (log ? ` The log record ${esc(recText(log))} is appended to the log buffer${mode === 'undo' ? ' (old value only)' : mode === 'redo' ? ' (new value only)' : ' (old and new value)'}.` : '');
    } else if ((m = cur.match(/^OUTPUT\s*\(\s*([A-Za-z]\w*)\s*\)$/i))) {
      const x = m[1]; if (!need(x)) break;
      if (!(x in mem)) { errs.push(`Line "${esc(cur)}": ${x} is not in a memory buffer, so there is nothing to output.`); break; }
      const changed = mem[x] !== disk[x] || dirty.has(x);
      if (changed && mode !== 'none') {
        const hasUpd = onDisk(r => r.k === 'upd' && r.x === x);
        if (mode === 'undo' && !hasUpd) viol = `Violates <b>U1</b>: the new value of ${x} reaches disk before its log record &lt;T,${x},…&gt; is on disk.`;
        if (mode === 'undoredo' && !hasUpd) viol = `Violates <b>UR1</b>: ${x} reaches disk before its log record &lt;T,${x},…&gt; is on disk.`;
        if (mode === 'redo' && !(hasUpd && onDisk(r => r.k === 'commit'))) viol = `Violates <b>R1</b>: under redo logging ${x} may reach disk only after &lt;T,${x},…&gt; <em>and</em> &lt;COMMIT T&gt; are on disk.`;
      }
      disk[x] = mem[x]; dirty.delete(x); hl.push('D-' + x); note = `OUTPUT(${x}): the buffer of ${x} is copied to disk. Disk ${x} = ${mem[x]}.`;
    } else if ((m = cur.match(/^([a-z]\w*)\s*:?=\s*(.+)$/i))) {
      const [, t, ex] = m;
      if (!/^[\w\s+\-*/().]+$/.test(ex)) { errs.push(`Line "${esc(cur)}": use only numbers, local variables and + − * / ( ).`); break; }
      const ids = ex.match(/[A-Za-z_]\w*/g) || [];
      const bad = ids.filter(id => !(id in loc));
      if (bad.length) { errs.push(`Line "${esc(cur)}": ${bad.join(', ')} ${bad.length > 1 ? 'are not local variables' : 'is not a local variable'} with a value. A transaction can only compute with values it has READ.`); break; }
      let v;
      try { v = Function(...Object.keys(loc), `return (${ex});`)(...Object.values(loc)); } catch (e) { errs.push(`Line "${esc(cur)}": cannot evaluate this expression.`); break; }
      if (typeof v !== 'number' || !isFinite(v)) { errs.push(`Line "${esc(cur)}": the result is not a number.`); break; }
      loc[t] = Math.round(v * 1e6) / 1e6; hl.push('L-' + t); act = `${t} := ${ex.trim()}`;
      note = `A local computation: ${t} becomes ${loc[t]}. Only T's own memory changes; no buffer, disk or log is touched.`;
    } else { errs.push(`I do not understand the line "${esc(cur)}". Use START, READ(X,t), t := t*2, WRITE(X,t), INPUT(X), OUTPUT(X), FLUSH LOG, COMMIT.`); break; }
    if (log) logBuf.push(log);
    rows.push({ act, log, loc: { ...loc }, mem: { ...mem }, disk: { ...disk }, logBuf: logBuf.slice(), logDisk: logDisk.slice(), note, viol, hl });
  }
  const locs = [...new Set(rows.flatMap(r => Object.keys(r.loc)))];
  return { rows, errs, els, locs, init: { ...init }, mode };
}

// ---------------------------------------------------------------- widgets
const rvVal = v => (v === undefined ? '' : v);
function xactFrame(R, upto, crash) {
  const { rows, els, locs } = R, r = rows[upto] || null;
  const hl = new Set(r ? r.hl : []);
  const box = (title, cells, cls = '') => `<div class="xt-box ${cls}"><div class="xt-h">${title}</div>${cells}</div>`;
  const kv = (pre, obj, keys, lost) => keys.map(k => `<div class="xt-kv${hl.has(pre + k) ? ' hl' : ''}${lost ? ' lost' : ''}"><span>${k}</span><b>${rvVal(obj[k]) === '' ? '–' : obj[k]}</b></div>`).join('') || '<div class="xt-empty">empty</div>';
  const lg = (arr, cls) => arr.length ? arr.map(x => `<div class="xt-log ${cls}">${esc(recText(x))}</div>`).join('') : '<div class="xt-empty">empty</div>';
  const S = r || { loc: {}, mem: {}, disk: R.init, logBuf: [], logDisk: [] };
  let h = '<div class="xt-zones">' +
    box('Transaction T<small>local variables</small>', kv('L-', S.loc, locs, crash), crash ? 'lostbox' : '') +
    box('Main memory<small>buffers</small>', kv('M-', S.mem, els.filter(e => e in S.mem), crash) + (R.mode !== 'none' ? `<div class="xt-sub">log buffer</div>${lg(S.logBuf, 'buf')}` : ''), crash ? 'lostbox' : '') +
    box('Disk<small>non-volatile</small>', kv('D-', S.disk, els) + (R.mode !== 'none' ? `<div class="xt-sub">log on disk</div>${lg(S.logDisk, 'dsk')}` : '')) + '</div>';
  // the textbook-style table up to this step
  h += '<div class="tbl xt-tbl"><table><tr><th>Step</th><th>Action</th>' + locs.map(t => `<th>${t}</th>`).join('') +
    els.map(e => `<th>M-${e}</th>`).join('') + els.map(e => `<th>D-${e}</th>`).join('') + (R.mode !== 'none' ? '<th>Log</th>' : '') + '</tr>';
  rows.forEach((x, i) => {
    if (i > upto) return;
    const flushed = x.log && (rows[upto].logDisk.includes(x.log));
    h += `<tr class="${i === upto ? 'cur' : ''}${x.viol ? ' viol' : ''}"><td>${i + 1})</td><td><code>${esc(x.act)}</code></td>` +
      locs.map(t => `<td class="num">${rvVal(x.loc[t])}</td>`).join('') + els.map(e => `<td class="num">${rvVal(x.mem[e])}</td>`).join('') +
      els.map(e => `<td class="num">${rvVal(x.disk[e])}</td>`).join('') +
      (R.mode !== 'none' ? `<td>${x.log ? `<span class="${flushed ? 'dsk' : 'buf'}">${esc(recText(x.log))}</span>` : ''}</td>` : '') + '</tr>';
  });
  return h + '</table></div>' + (R.mode !== 'none' ? '<p class="xt-leg"><span class="buf">log record only in the memory buffer</span> · <span class="dsk">log record on disk</span></p>' : '');
}
function xactSteps(R, crashAt) {
  const steps = [{ html: xactFrame(R, -1), cap: `Before T runs. Disk: ${R.els.map(e => `${e} = ${R.init[e]}`).join(', ')}. ${R.mode === 'none' ? 'No log is kept.' : RV_MODES[R.mode] + '.'}` }];
  const last = crashAt == null ? R.rows.length - 1 : Math.min(crashAt, R.rows.length) - 1;
  for (let i = 0; i <= last; i++) {
    const r = R.rows[i];
    steps.push({ html: xactFrame(R, i), cap: `<b>Step ${i + 1}.</b> ${r.note}${r.viol ? ` <span class="bad">${r.viol}</span>` : ''}` });
  }
  if (crashAt != null) {
    const r = R.rows[last] || { disk: R.init, logDisk: [] };
    let cap = `<b>Crash after step ${last + 1}.</b> Memory is lost: local variables, buffers and the log buffer disappear. What survives is the disk: ${R.els.map(e => `${e} = ${r.disk[e]}`).join(', ')}, and the log on disk: ${r.logDisk.length ? r.logDisk.map(x => esc(recText(x))).join(' ') : 'nothing'}. `;
    let fin = { ...r.disk };
    if (R.mode !== 'none' && r.logDisk.length) {
      const out = recover(r.logDisk, R.mode, r.disk);
      fin = out.final;
      cap += `Recovery (${RV_MODES[R.mode].toLowerCase()}) writes ${out.writes.length ? out.writes.map(w => `${w.x} = ${w.v}`).join(', ') : 'nothing'}${out.aborts.length ? ' and logs &lt;ABORT T&gt;' : ''}. `;
    } else if (R.mode !== 'none') cap += 'The log on disk is empty, so recovery does nothing. ';
    else cap += 'There is no log, so nothing can be repaired. ';
    const end = R.rows[R.rows.length - 1].mem;
    const before = R.els.every(e => fin[e] === R.init[e]), after = R.els.every(e => fin[e] === (e in end ? end[e] : R.init[e]));
    cap += `Final disk: <b>${R.els.map(e => `${e} = ${fin[e]}`).join(', ')}</b>. ` + (before ? '<span class="good">As if T never ran.</span>' : after ? '<span class="good">As if T ran completely.</span>' : '<span class="bad">A mix of old and new values: T was not atomic.</span>');
    steps.push({ html: xactFrame(R, last, true), cap });
  }
  return steps;
}
const XACT_PRESETS = {
  none: 'READ(A,t)\nt := t*2\nWRITE(A,t)\nREAD(B,t)\nt := t*2\nWRITE(B,t)\nOUTPUT(A)\nOUTPUT(B)',
  undo: 'START\nREAD(A,t)\nt := t*2\nWRITE(A,t)\nREAD(B,t)\nt := t*2\nWRITE(B,t)\nFLUSH LOG\nOUTPUT(A)\nOUTPUT(B)\nCOMMIT\nFLUSH LOG',
  redo: 'START\nREAD(A,t)\nt := t*2\nWRITE(A,t)\nREAD(B,t)\nt := t*2\nWRITE(B,t)\nCOMMIT\nFLUSH LOG\nOUTPUT(A)\nOUTPUT(B)',
  undoredo: 'START\nREAD(A,t)\nt := t*2\nWRITE(A,t)\nREAD(B,t)\nt := t*2\nWRITE(B,t)\nFLUSH LOG\nOUTPUT(A)\nCOMMIT\nOUTPUT(B)',
};
const modeOpts = (sel, withNone) => (withNone ? [['none', 'No log (Fig. 17.2)']] : []).concat(Object.entries(RV_MODES))
  .map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${v}</option>`).join('');

function xactTool(sel, o = {}) {
  const host = $(sel), id = host.id;
  const mode = o.mode || 'undo';
  host.innerHTML = `<form class="bp-form rv-form">
    <label>Logging <select id="${id}-m">${modeOpts(mode, true)}</select></label>
    <label>Initial disk values <input id="${id}-i" value="${o.init || 'A = 8, B = 8'}" spellcheck="false"></label>
    <label class="rv-wide">Actions of T, one per line <textarea id="${id}-s" rows="${Math.min(16, (o.script || XACT_PRESETS[mode]).split('\n').length + 1)}" spellcheck="false">${o.script || XACT_PRESETS[mode]}</textarea></label>
    <label>Crash after step <input id="${id}-c" value="${o.crash ?? ''}" placeholder="none" style="width:5em"></label>
    <button type="submit">Run</button> <button type="button" data-p>Load the textbook sequence for this method</button>
  </form><div class="rv-msg" aria-live="polite"></div><div class="rv-st"></div>`;
  const g = s => host.querySelector(s);
  const run = () => {
    const msg = g('.rv-msg'), m = g(`#${id}-m`).value;
    const { vals, errs } = parseVals(g(`#${id}-i`).value);
    const c = g(`#${id}-c`).value.trim();
    if (c && !/^\d+$/.test(c)) errs.push('Crash step must be a whole number (or leave it empty).');
    if (!Object.keys(vals).length && !errs.length) errs.push('Give at least one initial value, like A = 8.');
    const R = errs.length ? null : runScript(g(`#${id}-s`).value, vals, m);
    if (R) errs.push(...R.errs);
    if (R && !R.rows.length && !errs.length) errs.push('Type at least one action.');
    if (errs.length) { msg.className = 'rv-msg bad'; msg.innerHTML = errs.join('<br>'); g('.rv-st').innerHTML = ''; return; }
    const v = R.rows.filter(r => r.viol).length;
    msg.className = 'rv-msg ' + (v ? 'bad' : 'good');
    msg.innerHTML = m === 'none' ? '' : v ? `${v} step${v > 1 ? 's break' : ' breaks'} a rule of ${RV_MODES[m].toLowerCase()} (red rows).` : `This sequence obeys every rule of ${RV_MODES[m].toLowerCase()}.`;
    stepper(g('.rv-st'), xactSteps(R, c ? +c : null), { interval: 2200 });
  };
  g('form').addEventListener('submit', e => { e.preventDefault(); run(); });
  g('[data-p]').addEventListener('click', () => { g(`#${id}-s`).value = XACT_PRESETS[g(`#${id}-m`).value]; run(); });
  run();
}

// recovery animation frames
function rvFrame(recs, f, mode) {
  let h = '<div class="rv"><table class="rv-log"><tr><th>#</th><th>Log record</th><th>Recovery</th></tr>';
  recs.forEach((r, i) => {
    const s = f.st[i], cls = (s ? 'st-' + s[0] : '') + (i === f.cur ? ' cur' : '');
    const arrow = i === f.cur ? (f.dir === 'up' ? '▲' : f.dir === 'down' ? '▼' : '◆') : '';
    h += `<tr class="${cls}"><td class="n">${arrow} ${i + 1}</td><td><code>${esc(recText(r))}</code></td><td class="act">${s ? s[1] : ''}</td></tr>`;
  });
  h += '</table><div class="rv-side">';
  if (f.sets) for (const [k, v] of Object.entries(f.sets)) h += `<div class="rv-set"><span>${k}</span><b>${v}</b></div>`;
  h += `<div class="rv-set"><span>Disk writes so far</span><b>${f.writes.length ? f.writes.map(w => `<span class="${w.kind}">${w.x} ← ${w.v}</span>`).join(' ') : '–'}</b></div>`;
  if (f.aborts) h += `<div class="rv-set"><span>Appended to the log</span><b>${f.aborts.length ? f.aborts.map(t => `&lt;ABORT ${t}&gt;`).join(' ') + ' + FLUSH LOG' : '–'}</b></div>`;
  return h + `<div class="rv-mode">${RV_MODES[mode]}</div></div></div>`;
}
function recoveryAnim(sel, text, mode, disk = null) {
  const { recs, errs } = parseLog(text);
  if (errs.length) { $(sel).innerHTML = `<p class="bad">${errs.join('<br>')}</p>`; return null; }
  const out = recover(recs, mode, disk);
  stepper(sel, out.frames.map(f => ({ html: rvFrame(recs, f, mode), cap: f.cap })), { interval: 2000 });
  return out;
}
function recoveryTool(sel, o = {}) {
  const host = $(sel), id = host.id;
  host.innerHTML = `<form class="bp-form rv-form">
    <label class="rv-wide">Log on disk at the crash (records in angle brackets; spaces, commas, semicolons or new lines between them)
      <textarea id="${id}-l" rows="${Math.min(14, Math.max(4, (o.log || '').split('\n').length + 1))}" spellcheck="false">${esc(o.log || '')}</textarea></label>
    <label>Logging method <select id="${id}-m">${modeOpts(o.mode || 'undo')}</select></label>
    <label>Disk values before recovery (optional) <input id="${id}-d" value="${o.disk || ''}" placeholder="e.g. A = 16, B = 8" spellcheck="false"></label>
    <button type="submit">Recover</button>
  </form><div class="rv-msg" aria-live="polite"></div><div class="rv-st"></div>`;
  const g = s => host.querySelector(s);
  const run = () => {
    const msg = g('.rv-msg'), { recs, errs } = parseLog(g(`#${id}-l`).value), m = g(`#${id}-m`).value;
    const d = g(`#${id}-d`).value.trim(), pv = d ? parseVals(d) : { vals: null, errs: [] };
    errs.push(...pv.errs);
    if (!errs.length && m === 'undoredo') { const bad = recs.find(r => r.k === 'upd' && r.w === undefined); if (bad) errs.push(`Undo/redo logging needs records with old and new value, like &lt;${bad.t},${bad.x},${bad.v},new&gt;.`); }
    if (errs.length) { msg.className = 'rv-msg bad'; msg.innerHTML = errs.join('<br>'); g('.rv-st').innerHTML = ''; return; }
    const out = recover(recs, m, pv.vals);
    msg.className = 'rv-msg' + (out.warns.length ? ' mid' : '');
    msg.innerHTML = out.warns.length ? '<b>Warnings about this log:</b><br>' + out.warns.join('<br>') : '';
    stepper(g('.rv-st'), out.frames.map(f => ({ html: rvFrame(recs, f, m), cap: f.cap })), { interval: 2000 });
  };
  g('form').addEventListener('submit', e => { e.preventDefault(); run(); });
  run();
}

// ---------------------------------------------------------------- checkpoint timeline
function timelineSVG(recs, upto, mode, out) {
  const tx = [...new Set(recs.filter(r => r.t).map(r => r.t))];
  const dx = 46, x0 = 70, rowH = 30, yT = 46, y0 = yT + 26;
  const X = i => x0 + i * dx + dx / 2, W = x0 + recs.length * dx + 60, yAx = y0 + tx.length * rowH + 6;
  let s = '';
  // checkpoint shading and lines
  let open = null;
  recs.forEach((r, i) => {
    if (i > upto) return;
    if (r.k === 'sckpt') open = i;
    if (r.k === 'eckpt' && open !== null) { s += `<rect x="${X(open)}" y="${yT - 4}" width="${X(i) - X(open)}" height="${yAx - yT + 4}" style="fill:var(--cell-hl);opacity:.55"/>`; open = null; }
  });
  if (open !== null) s += `<rect x="${X(open)}" y="${yT - 4}" width="${X(Math.min(upto, recs.length - 1)) - X(open) + 8}" height="${yAx - yT + 4}" style="fill:var(--cell-hl);opacity:.35"/>`;
  // scanned region on the final frame
  if (out) {
    const [lo] = out.scanned;
    s += `<rect x="${X(lo) - dx / 2 + 2}" y="${yAx + 4}" width="${X(recs.length - 1) - X(lo) + dx - 4}" height="10" style="fill:var(--accent);opacity:.8"/>`;
    s += `<text x="${X(lo) - dx / 2 + 2}" y="${yAx + 28}" class="lbl acc">recovery reads the log from here to the end</text>`;
  }
  recs.forEach((r, i) => {
    if (i > upto) return;
    if (r.k === 'sckpt' || r.k === 'eckpt' || r.k === 'ckpt') {
      s += `<line x1="${X(i)}" x2="${X(i)}" y1="${yT - 4}" y2="${yAx}" class="${r.k === 'eckpt' ? 's-grn' : r.k === 'ckpt' ? 's-fg' : 's-red'} dash"/>`;
      s += `<text x="${X(i)}" y="${r.k === 'sckpt' ? yT - 24 : yT - 10}" text-anchor="middle" class="lbl ${r.k === 'eckpt' ? 'grn' : r.k === 'ckpt' ? '' : 'red'}" style="font-weight:600">${r.k === 'sckpt' ? `START CKPT(${r.list.join(',')})` : r.k === 'eckpt' ? 'END CKPT' : 'CKPT'}</text>`;
    }
  });
  tx.forEach((t, k) => {
    const y = y0 + k * rowH;
    s += `<text x="10" y="${y + 5}" class="big">${t}</text>`;
    let a = -1, b = -1, end = null;
    recs.forEach((r, i) => { if (i > upto || r.t !== t) return; if (a < 0) a = i; b = i; if (r.k === 'commit' || r.k === 'abort') end = r.k; });
    if (a < 0) return;
    const live = !end, bx = live ? X(upto) + 6 : X(b);
    s += `<line x1="${X(a)}" x2="${bx}" y1="${y}" y2="${y}" style="stroke:var(${end === 'abort' ? '--red' : live ? '--amber' : '--green'});stroke-width:6;stroke-linecap:round;opacity:.8"/>`;
    recs.forEach((r, i) => {
      if (i > upto || r.t !== t) return;
      if (r.k === 'upd') s += `<circle cx="${X(i)}" cy="${y}" r="9" class="cell"/><text x="${X(i)}" y="${y + 4}" text-anchor="middle" style="font-size:11px">${r.x}</text>`;
      if (r.k === 'commit') s += `<text x="${X(i) + 8}" y="${y + 4}" class="lbl grn" style="font-weight:600">C</text>`;
      if (r.k === 'abort') s += `<text x="${X(i) + 8}" y="${y + 4}" class="lbl red" style="font-weight:600">A</text>`;
    });
  });
  // axis with record numbers and the current record
  s += `<line x1="${x0}" x2="${W - 10}" y1="${yAx}" y2="${yAx}" class="s-fg"/>`;
  recs.forEach((r, i) => {
    s += `<text x="${X(i)}" y="${yAx + (out ? 44 : 16)}" text-anchor="middle" class="lbl${i === upto && !out ? ' red' : ''}" style="${i === upto && !out ? 'font-weight:600' : ''}">${i + 1}</text>`;
  });
  if (out) s += `<path d="M${X(recs.length - 1) + 16} ${yT} l-6 10 l8 6 l-6 10 l8 6 l-6 10" class="s-red"/><text x="${X(recs.length - 1) + 26}" y="${yT + 22}" class="lbl red" style="font-weight:600">crash</text>`;
  const H = yAx + (out ? 54 : 26);
  return `<svg viewBox="0 0 ${W + 10} ${H}" width="${W + 10}" role="img" aria-label="Transaction timeline with checkpoints">${s}</svg>` +
    `<div class="tl-rec">Record ${Math.min(upto, recs.length - 1) + 1}: <code>${esc(recText(recs[Math.min(upto, recs.length - 1)]))}</code></div>`;
}
function timelineSteps(recs, mode) {
  const steps = [], active = new Set(), done = new Set();
  let ck = null;
  recs.forEach((r, i) => {
    let cap = '';
    if (r.k === 'start') { active.add(r.t); cap = `${r.t} starts.` + (ck ? ` New transactions may start during a nonquiescent checkpoint; ${r.t} is not in the checkpoint list.` : ''); }
    else if (r.k === 'upd') cap = `${r.t} changes ${r.x} (in a memory buffer) and logs it.`;
    else if (r.k === 'commit' || r.k === 'abort') {
      active.delete(r.t); done.add(r.t); cap = `${r.t} ${r.k === 'commit' ? 'commits' : 'aborts'}.`;
      if (ck && mode === 'undo') { const left = ck.filter(t => active.has(t)); cap += left.length ? ` The checkpoint still waits for ${left.join(', ')}.` : ' Every transaction in the checkpoint list has now finished, so &lt;END CKPT&gt; may be written.'; }
    } else if (r.k === 'sckpt') {
      ck = r.list;
      cap = `<b>&lt;START CKPT(${r.list.join(',')})&gt;</b> is written and the log flushed. The list names the transactions active right now: ${[...active].join(', ') || 'none'}. ` +
        (mode === 'undo' ? 'Undo logging: the checkpoint now waits for these transactions to commit or abort, while new ones may start.'
          : mode === 'redo' ? 'Redo logging: the checkpoint now writes to disk every buffer changed by transactions that had <em>already committed</em>. It does not wait for the listed transactions.'
          : 'Undo/redo logging: the checkpoint now writes <em>all</em> dirty buffers to disk, committed or not. It does not wait for the listed transactions.');
    } else if (r.k === 'eckpt') {
      cap = '<b>&lt;END CKPT&gt;</b> is written and flushed. ' + (mode === 'undo' ? `All of ${ck ? ck.join(', ') : 'the listed transactions'} have finished.` : mode === 'redo' ? 'All data changed by transactions committed before the START CKPT is now on disk.' : 'Every buffer that was dirty at START CKPT is now on disk.');
      ck = null;
    } else if (r.k === 'ckpt') cap = '<b>&lt;CKPT&gt;</b>: a quiescent checkpoint. No transaction was active when it was written.';
    else cap = 'Dump marker.';
    steps.push({ html: timelineSVG(recs, i, mode), cap });
  });
  const out = recover(recs, mode);
  steps.push({ html: timelineSVG(recs, recs.length - 1, mode, out), cap: `<b>Crash after record ${recs.length}.</b> With ${RV_MODES[mode].toLowerCase()}, recovery needs the log from record ${out.scanned[0] + 1} onward (blue bar). ${out.writes.length ? 'It writes ' + out.writes.map(w => `${w.x} = ${w.v} (${w.kind})`).join(', ') + '.' : 'It writes nothing.'}${out.aborts.length ? ' It then logs ' + out.aborts.map(t => `&lt;ABORT ${t}&gt;`).join(' ') + '.' : ''}` });
  return steps;
}
function timelineTool(sel, o = {}) {
  const host = $(sel), id = host.id;
  host.innerHTML = `<form class="bp-form rv-form">
    <label class="rv-wide">Log <textarea id="${id}-l" rows="${Math.min(10, Math.max(3, (o.log || '').split('\n').length + 1))}" spellcheck="false">${esc(o.log || '')}</textarea></label>
    <label>Logging method <select id="${id}-m">${modeOpts(o.mode || 'undo')}</select></label>
    <button type="submit">Animate</button></form><div class="rv-msg" aria-live="polite"></div><div class="rv-st"></div>`;
  const g = s => host.querySelector(s);
  const run = () => {
    const msg = g('.rv-msg'), { recs, errs } = parseLog(g(`#${id}-l`).value), m = g(`#${id}-m`).value;
    if (errs.length) { msg.className = 'rv-msg bad'; msg.innerHTML = errs.join('<br>'); g('.rv-st').innerHTML = ''; return; }
    const w = logWarnings(recs, m);
    msg.className = 'rv-msg' + (w.length ? ' mid' : ''); msg.innerHTML = w.length ? '<b>Warnings about this log:</b><br>' + w.join('<br>') : '';
    stepper(g('.rv-st'), timelineSteps(recs, m), { interval: 1700 });
  };
  g('form').addEventListener('submit', e => { e.preventDefault(); run(); });
  run();
}

if (typeof module !== 'undefined') module.exports = { parseLog, recover, runScript, parseVals, recText, logWarnings };
