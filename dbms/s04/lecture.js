// Lec 04 (Sukarna): schedule classifier, cascading rollback, waits-for graphs, wait-die / wound-wait.
// Pure logic first (s4parse, s4classify, s4cascade, s4lockSim, s4cycles) so it can be tested in node;
// DOM tools after (scheduleTool, waitsForTool, wdwwTool).

const S4SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
const s4T = t => `T${t}`;
const s4esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Parse "r1(A); w2(B); c1" (also "r1 (A)", "R1(A)", subscripts, commas). allowed = string of ops.
// ops: r w c a (schedules), l sl xl u (locks). Returns {ok, acts:[{op,t,x}], err}.
function s4parse(text, allowed = 'rwca') {
  const src = String(text).replace(/[₀-₉]/g, c => S4SUB[c]).replace(/_/g, '')
    .replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')').trim();
  if (!src) return { ok: false, err: 'Type a schedule first, for example <code>w1(A); r2(A); c1; c2</code>.' };
  const toks = src.split(/[;,\s]+/).filter(Boolean), acts = [];
  const okOps = allowed === 'rwca' ? ['r', 'w', 'c', 'a'] : ['r', 'w', 'c', 'a', 'l', 'sl', 'xl', 'u'];
  for (const raw of toks) {
    const m = raw.match(/^(sl|xl|l|r|w|u|c|a)(\d+)(?:\(([A-Za-z][A-Za-z0-9']*)\))?$/i);
    if (!m) return { ok: false, err: `I could not read <code>${s4esc(raw)}</code>. Write actions like <code>r1(A)</code>, <code>w2(B)</code>${allowed === 'rwca' ? ', <code>c1</code> (commit) or <code>a1</code> (abort)' : ', <code>l1(A)</code>, <code>sl1(A)</code>, <code>xl1(A)</code>, <code>u1(A)</code>, <code>c1</code>'}.` };
    const op = m[1].toLowerCase(), t = +m[2], x = m[3] ? m[3].toUpperCase() : null;
    if (!okOps.includes(op)) return { ok: false, err: `<code>${s4esc(raw)}</code>: this tool takes only ${okOps.map(o => `<code>${o}</code>`).join(' ')} actions.` };
    if ((op === 'c' || op === 'a') && x) return { ok: false, err: `<code>${s4esc(raw)}</code>: a commit or abort has no element. Write <code>${op}${t}</code>.` };
    if (op !== 'c' && op !== 'a' && !x) return { ok: false, err: `<code>${s4esc(raw)}</code> needs an element, like <code>${op}${t}(A)</code>.` };
    if (t < 1 || t > 9) return { ok: false, err: 'Use transaction numbers 1 to 9.' };
    acts.push({ op, t, x });
  }
  if (acts.length > 40) return { ok: false, err: 'Please keep it to 40 actions or fewer.' };
  return { ok: true, acts };
}
const s4txns = acts => [...new Set(acts.map(a => a.t))].sort((a, b) => a - b);
const s4fmt = a => a.op === 'c' || a.op === 'a' ? `${a.op}${a.t}` : `${a.op}${a.t}(${a.x})`;

// strongly connected components (Tarjan); returns array of node arrays
function s4scc(nodes, edges) {
  const adj = new Map(nodes.map(n => [n, []]));
  for (const e of edges) if (adj.has(e.from) && adj.has(e.to)) adj.get(e.from).push(e.to);
  let idx = 0; const st = [], on = new Set(), ix = new Map(), low = new Map(), out = [];
  const go = v => {
    ix.set(v, idx); low.set(v, idx); idx++; st.push(v); on.add(v);
    for (const w of adj.get(v)) {
      if (!ix.has(w)) { go(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v), ix.get(w)));
    }
    if (low.get(v) === ix.get(v)) { const c = []; let w; do { w = st.pop(); on.delete(w); c.push(w); } while (w !== v); out.push(c); }
  };
  nodes.forEach(n => { if (!ix.has(n)) go(n); });
  return out;
}
// nodes lying on some cycle
function s4cycles(nodes, edges) {
  const s = new Set();
  for (const c of s4scc(nodes, edges)) if (c.length > 1) c.forEach(n => s.add(n));
  return s;
}
// one concrete cycle through v, as a node list [v, …, v]
function s4cyclePath(v, edges, inCyc) {
  const path = [v], seen = new Set([v]);
  const dfs = u => {
    for (const e of edges.filter(e => e.from === u && inCyc.has(e.to))) {
      if (e.to === v) { path.push(v); return true; }
      if (!seen.has(e.to)) { seen.add(e.to); path.push(e.to); if (dfs(e.to)) return true; path.pop(); }
    }
    return false;
  };
  return dfs(v) ? path : null;
}

// ---------- Tool 1: classify a schedule ----------
function s4classify(acts) {
  const txns = s4txns(acts), commit = {}, abort = {}, writes = {}, rf = [], notes = acts.map(() => []);
  const dirtyW = [];       // overwrite of uncommitted data (breaks strictness)
  const errs = [];
  acts.forEach((a, i) => {
    const s = i + 1;
    if (commit[a.t] || abort[a.t]) errs.push(`${s4T(a.t)} has an action (${s4fmt(a)}, step ${s}) after it ${commit[a.t] ? 'committed' : 'aborted'}.`);
    const live = x => (writes[x] || []).filter(w => !abort[w.t]);
    if (a.op === 'r') {
      const w = live(a.x).pop();
      if (w && w.t !== a.t) {
        const dirty = !commit[w.t];
        rf.push({ reader: a.t, writer: w.t, x: a.x, step: s, wstep: w.step, dirty });
        notes[i].push(dirty ? `<b>dirty read</b>: ${s4T(a.t)} reads ${a.x} written by ${s4T(w.t)} (step ${w.step}), which has not committed`
                            : `${s4T(a.t)} reads ${a.x} written by ${s4T(w.t)}, which has already committed`);
      } else if (!w) notes[i].push(`${s4T(a.t)} reads the original (committed) value of ${a.x}`);
    } else if (a.op === 'w') {
      const w = live(a.x).pop();
      if (w && w.t !== a.t && !commit[w.t]) {
        dirtyW.push({ t: a.t, by: w.t, x: a.x, step: s });
        notes[i].push(`${s4T(a.t)} overwrites ${a.x}, which ${s4T(w.t)} wrote and has not committed`);
      }
      (writes[a.x] = writes[a.x] || []).push({ t: a.t, step: s });
    } else if (a.op === 'c') {
      commit[a.t] = s;
      const early = rf.filter(r => r.reader === a.t && !commit[r.writer]);
      notes[i].push(early.length ? `${s4T(a.t)} commits although ${[...new Set(early.map(r => s4T(r.writer)))].join(', ')}, which it read from, has not committed`
                                 : `${s4T(a.t)} commits`);
    } else if (a.op === 'a') {
      abort[a.t] = s;
      const deps = [...new Set(rf.filter(r => r.writer === a.t).map(r => r.reader))];
      notes[i].push(`${s4T(a.t)} aborts` + (deps.length ? `; ${deps.map(s4T).join(', ')} read its data, so a cascading rollback is needed` : ''));
    }
  });
  // recoverable: every reader commits only after each writer it read from has committed
  const recWhy = [];
  for (const r of rf) {
    if (!commit[r.reader]) continue;
    const wc = commit[r.writer];
    if (!wc || wc > commit[r.reader])
      recWhy.push(`${s4T(r.reader)} read ${r.x} from ${s4T(r.writer)} (step ${r.step}) and commits at step ${commit[r.reader]}, but ${s4T(r.writer)} ` +
        (wc ? `commits later, at step ${wc}` : abort[r.writer] ? `aborts at step ${abort[r.writer]}` : 'never commits in this schedule') + '.');
  }
  const acrWhy = rf.filter(r => r.dirty).map(r => `${s4T(r.reader)} reads ${r.x} at step ${r.step}, written by ${s4T(r.writer)} at step ${r.wstep}, before ${s4T(r.writer)} commits (a dirty read).`);
  const strictWhy = [...acrWhy, ...dirtyW.map(d => `${s4T(d.t)} writes ${d.x} at step ${d.step} while ${s4T(d.by)}, the last writer of ${d.x}, has not committed or aborted.`)];
  // conflict-serializability over transactions that do not abort
  const keep = acts.map((a, i) => ({ ...a, s: i + 1 })).filter(a => (a.op === 'r' || a.op === 'w') && !abort[a.t]);
  const pe = [];
  keep.forEach((a, i) => keep.slice(i + 1).forEach(b => {
    if (a.t !== b.t && a.x === b.x && (a.op === 'w' || b.op === 'w') && !pe.some(e => e.from === a.t && e.to === b.t))
      pe.push({ from: a.t, to: b.t, x: a.x, why: `${s4fmt(a)} before ${s4fmt(b)}` });
  }));
  const live = txns.filter(t => !abort[t]), cyc = s4cycles(live, pe);
  let order = null;
  if (!cyc.size) {          // topological sort, smallest number first among ready nodes
    order = []; const indeg = new Map(live.map(t => [t, 0]));
    pe.forEach(e => indeg.set(e.to, indeg.get(e.to) + 1));
    while (order.length < live.length) {
      const t = live.filter(t => !order.includes(t) && indeg.get(t) === 0)[0];
      order.push(t); pe.filter(e => e.from === t).forEach(e => indeg.set(e.to, indeg.get(e.to) - 1));
    }
  }
  return { txns, commit, abort, rf, notes, errs,
    recoverable: { ok: !recWhy.length, why: recWhy }, acr: { ok: !acrWhy.length, why: acrWhy },
    strict: { ok: !strictWhy.length, why: strictWhy }, csr: { ok: !cyc.size, edges: pe, order, cyc } };
}

// Cascading rollback (slide 5's algorithm). Victim aborts at its explicit abort, or instead of its commit,
// or after the last action. Returns {at, steps:[{t, deps:[{t, committed}], cap}], rolled:Set, stuck:[]}.
function s4cascade(acts, victim) {
  const C = s4classify(acts);
  let at = C.abort[victim] || C.commit[victim] || acts.length + 1;   // abort happens at this position
  const how = C.abort[victim] ? `${s4T(victim)} aborts at step ${at}` : C.commit[victim] ? `Suppose ${s4T(victim)} aborts at step ${at} instead of committing` : `Suppose ${s4T(victim)} aborts after the last step`;
  const rolled = new Set([victim]), queue = [victim], steps = [], stuck = [];
  while (queue.length) {
    const T = queue.shift();
    const readers = [...new Set(C.rf.filter(r => r.writer === T && r.step < at).map(r => r.reader))].filter(r => r !== victim);
    const deps = readers.map(r => ({ t: r, committed: !!(C.commit[r] && C.commit[r] < at), already: rolled.has(r) }));
    deps.forEach(d => { if (d.committed) stuck.push(d.t); else if (!d.already) { rolled.add(d.t); queue.push(d.t); } });
    steps.push({ t: T, deps });
  }
  return { at, how, steps, rolled, stuck, C };
}

// ---------- Tools 2 and 3: lock manager with deadlock handling ----------
// opts: {policy: 'detect'|'prevent'|'wait-die'|'wound-wait', victim: 'closer'|'highest', ts: {t: n}, restart: bool}
// Lock tokens: l = exclusive (the textbook's single lock mode), sl/xl, u = unlock; r/w request S/X first if needed.
function s4lockSim(acts, opts = {}) {
  const policy = opts.policy || 'detect', ts = t => (opts.ts && opts.ts[t] != null ? opts.ts[t] : t);
  const txns = s4txns(acts);
  const hold = {};                 // x -> [{t, mode}]
  let waitQ = [];                  // [{t, x, mode, after}]  after = action to run once granted
  const status = {}, pending = {}; let closer = null, laterWake = false;
  txns.forEach(t => { status[t] = 'idle'; pending[t] = []; });
  const frames = []; let lines = [];
  const say = (h, cls = '') => lines.push({ h, cls });
  const held = (t, x) => (hold[x] || []).find(h => h.t === t);
  const conflicts = (t, x, mode) => (hold[x] || []).filter(h => h.t !== t && (mode === 'X' || h.mode === 'X'));
  const L = m => m === 'X' ? 'exclusive' : 'shared';
  const grant = (t, x, mode) => {
    const h = held(t, x);
    if (h) h.mode = mode === 'X' ? 'X' : h.mode; else (hold[x] = hold[x] || []).push({ t, mode });
  };
  const releaseAll = t => { for (const x in hold) hold[x] = hold[x].filter(h => h.t !== t); };
  const edges = () => {
    const E = [];
    for (const w of waitQ) for (const h of conflicts(w.t, w.x, w.mode)) {
      const e = E.find(e => e.from === w.t && e.to === h.t);
      if (e) { if (!e.x.includes(w.x)) e.x.push(w.x); } else E.push({ from: w.t, to: h.t, x: [w.x] });
    }
    return E;
  };
  const nodes = () => txns.filter(t => status[t] !== 'aborted' && status[t] !== 'committed' &&
    (waitQ.some(w => w.t === t) || Object.values(hold).some(hs => hs.some(h => h.t === t))));
  const rollback = (t, why, wake = true) => {
    releaseAll(t); waitQ = waitQ.filter(w => w.t !== t); pending[t] = []; status[t] = 'aborted';
    say(`${s4T(t)} ${why}: it is rolled back and its locks are released.`, 'bad');
    if (wake) wakeUp();
  };
  const doAction = (t, a) => {          // a = r/w/u/c after locks are in place
    if (a.op === 'r' || a.op === 'w') say(`${s4T(t)} ${a.op === 'r' ? 'reads' : 'writes'} ${a.x}.`);
    if (a.op === 'u') { hold[a.x] = (hold[a.x] || []).filter(h => h.t !== t); say(`${s4T(t)} unlocks ${a.x}.`); wakeUp(); }
    if (a.op === 'c') { releaseAll(t); status[t] = 'committed'; say(`${s4T(t)} commits and releases all its locks.`, 'good'); wakeUp(); }
  };
  // Request a lock; returns true if granted now. 'after' is the action to run when the lock is granted.
  const request = (t, x, mode, after, again = false) => {
    let H = conflicts(t, x, mode);
    const verb = `${s4T(t)} requests ${L(mode)} lock on ${x}`;
    if (!H.length) {
      grant(t, x, mode);
      if (!again) say(`${verb}: granted.`);
      if (after) doAction(t, after);
      return true;
    }
    const hs = H.map(h => s4T(h.t)).join(', ');
    let wounded = false;
    if (policy === 'wait-die') {
      const older = H.filter(h => ts(h.t) < ts(t));
      if (older.length) { say(`${verb}, held by ${hs}. ${s4T(t)} (ts ${ts(t)}) is younger than ${older.map(h => `${s4T(h.t)} (ts ${ts(h.t)})`).join(', ')}, so <b>${s4T(t)} dies</b>.`, 'bad'); rollback(t, 'dies'); return false; }
      say(`${verb}, held by ${hs}. ${s4T(t)} (ts ${ts(t)}) is older than ${H.map(h => `${s4T(h.t)} (ts ${ts(h.t)})`).join(', ')}, so <b>${s4T(t)} waits</b>.`, 'mid');
    } else if (policy === 'wound-wait') {
      const younger = H.filter(h => ts(h.t) > ts(t));
      if (younger.length) {
        say(`${verb}, held by ${hs}. ${s4T(t)} (ts ${ts(t)}) is older than ${younger.map(h => `${s4T(h.t)} (ts ${ts(h.t)})`).join(', ')}, so <b>${s4T(t)} wounds ${younger.map(h => s4T(h.t)).join(' and ')}</b>.`, 'bad');
        younger.forEach(h => rollback(h.t, `is wounded by ${s4T(t)}`, false));
        wounded = true;
        H = conflicts(t, x, mode);
        if (!H.length) { grant(t, x, mode); say(`The lock on ${x} is granted to ${s4T(t)}.`); if (after) doAction(t, after); wakeUp(); return true; }
      }
      say(`${again ? '' : verb + ', '}${s4T(t)} (ts ${ts(t)}) is younger than holder ${H.map(h => `${s4T(h.t)} (ts ${ts(h.t)})`).join(', ')}, so <b>${s4T(t)} waits</b>.`, 'mid');
    } else say(`${verb}: <b>denied</b>, ${hs} hold${H.length > 1 ? '' : 's'} a conflicting lock. ${s4T(t)} waits.`, 'mid');
    if (!waitQ.some(w => w.t === t)) waitQ.push({ t, x, mode, after });
    status[t] = 'waiting'; closer = t;
    if (policy === 'prevent') {
      const E = edges(), cyc = s4cycles(nodes(), E);
      if (cyc.has(t)) {
        const p = s4cyclePath(t, E, cyc);
        const v = opts.victim === 'highest' ? Math.max(...cyc) : t;
        say(`This wait would close the cycle ${p.map(s4T).join(' → ')} in the waits-for graph.`, 'bad');
        rollback(v, v === t ? 'would cause a deadlock, so the request is refused' : `is the highest-numbered transaction on the cycle`, false);
        laterWake = true;      // show the graph right after the rollback first (as in the textbook's Fig. 19.7)
      }
    }
    if (wounded) wakeUp();
    return false;
  };
  // after a release: grant waiting requests in arrival order; timestamp schemes re-apply their rule
  let waking = false;
  function wakeUp() {
    if (waking) return; waking = true;
    let changed = true;
    while (changed) {
      changed = false;
      for (const w of [...waitQ]) {
        if (!waitQ.includes(w)) continue;
        const H = conflicts(w.t, w.x, w.mode);
        if (H.length && (policy === 'detect' || policy === 'prevent')) continue;
        if (H.length && policy === 'wait-die' && !H.some(h => ts(h.t) < ts(w.t))) continue;
        if (H.length && policy === 'wound-wait' && !H.some(h => ts(h.t) > ts(w.t))) continue;
        waitQ = waitQ.filter(q => q !== w); status[w.t] = 'active';
        if (!H.length) say(`${w.x} is now free: ${s4T(w.t)} gets its ${L(w.mode)} lock on ${w.x} and continues.`, 'good');
        waking = false;
        const ok = request(w.t, w.x, w.mode, w.after, true);
        waking = true;
        if (ok) runPending(w.t);
        changed = true; break;
      }
    }
    waking = false;
  }
  const runPending = t => {
    while (pending[t].length && status[t] === 'active') { const a = pending[t].shift(); say(`${s4T(t)} now runs its delayed action ${s4fmt(a)}.`); exec(t, a); }
  };
  const exec = (t, a) => {
    if (a.op === 'l' || a.op === 'xl') return request(t, a.x, 'X', null);
    if (a.op === 'sl') return request(t, a.x, 'S', null);
    if (a.op === 'r' || a.op === 'w') {
      const need = a.op === 'w' ? 'X' : 'S', h = held(t, a.x);
      if (h && (h.mode === 'X' || need === 'S')) { doAction(t, a); return true; }
      return request(t, a.x, need, a);
    }
    if (a.op === 'a') { rollback(t, 'aborts'); return true; }
    doAction(t, a); return true;
  };
  acts.forEach((a, i) => {
    lines = []; const t = a.t;
    if (status[t] === 'idle') status[t] = 'active';
    if (status[t] === 'aborted') {
      if (opts.restart) { status[t] = 'active'; pending[t] = []; say(`${s4T(t)} restarts${policy === 'wait-die' || policy === 'wound-wait' ? ` with its old timestamp ${ts(t)}` : ''}.`); exec(t, a); }
      else say(`${s4fmt(a)} is ignored: ${s4T(t)} was rolled back and is not restarted.`, 'dim');
    } else if (status[t] === 'committed') say(`${s4fmt(a)} is ignored: ${s4T(t)} has already committed.`, 'dim');
    else if (status[t] === 'waiting') { pending[t].push(a); say(`${s4T(t)} is blocked, so ${s4fmt(a)} cannot be issued yet. It is delayed until ${s4T(t)} gets its lock.`, 'dim'); }
    else exec(t, a);
    snap(i, a);
    if (laterWake) { laterWake = false; lines = []; wakeUp(); if (lines.length) snap(null, null, 'regrant'); }
  });
  function snap(i, a, extra) {
    const E = edges(), N = nodes(), cyc = s4cycles(N, E);
    frames.push({ step: i == null ? null : i + 1, act: a ? s4fmt(a) : null, lines, edges: E, nodes: N, cyc,
      hold: JSON.parse(JSON.stringify(hold)), waitQ: waitQ.map(w => ({ t: w.t, x: w.x, mode: w.mode })),
      status: { ...status }, extra });
  }
  // periodic detector (policy 'detect'): after the last action, break every cycle
  if (policy === 'detect') {
    let E = edges(), cyc = s4cycles(nodes(), E), guard = 0;
    if (cyc.size) {
      while (cyc.size && guard++ < 10) {
        lines = [];
        const v = opts.victim === 'highest' ? Math.max(...cyc) : (cyc.has(closer) ? closer : Math.max(...cyc));
        const p = s4cyclePath(v, E, cyc);
        say(`The deadlock detector finds the cycle ${p.map(s4T).join(' → ')}. Victim: <b>${s4T(v)}</b> (${opts.victim === 'highest' ? 'highest-numbered on the cycle' : 'its request closed the cycle'}).`, 'bad');
        rollback(v, 'is chosen as the victim', false);
        snap(null, null, 'rollback');
        lines = []; wakeUp();
        if (lines.length) snap(null, null, 'regrant');
        E = edges(); cyc = s4cycles(nodes(), E);
      }
    }
  }
  return { frames, status, hold, txns, ts };
}

// ---------- drawing ----------
// Waits-for graph: nodes on a circle; edges labelled with elements; edges on a cycle in red.
function wfgSVG(f, allTx, { W = 310, H = 262 } = {}) {
  const ids = allTx, n = ids.length, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 46, r = 17;
  const pos = {}; ids.forEach((t, i) => { const a = -Math.PI / 2 + 2 * Math.PI * i / n; pos[t] = [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
  let s = '';
  for (const e of f.edges) {
    const [x1, y1] = pos[e.from], [x2, y2] = pos[e.to], dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
    const both = f.edges.some(o => o.from === e.to && o.to === e.from), off = both ? 16 : 0;
    const nx = -dy / d, ny = dx / d, mx = (x1 + x2) / 2 + nx * off, my = (y1 + y2) / 2 + ny * off;
    const sx = x1 + dx / d * r + nx * off * .35, sy = y1 + dy / d * r + ny * off * .35, ex = x2 - dx / d * (r + 3) + nx * off * .35, ey = y2 - dy / d * (r + 3) + ny * off * .35;
    const red = f.cyc.has(e.from) && f.cyc.has(e.to);
    s += `<path d="M${sx.toFixed(1)} ${sy.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" class="${red ? 's-red' : 's-fg'}" marker-end="url(#${red ? 'm-red' : 'm-fg'})"/>`;
    s += `<text x="${(mx + nx * 9).toFixed(1)}" y="${(my + ny * 9 + 4).toFixed(1)}" text-anchor="middle" class="lbl${red ? ' red' : ''}">${e.x.join(',')}</text>`;
  }
  for (const t of ids) {
    const [x, y] = pos[t], st = f.status[t], inG = f.nodes.includes(t);
    const cls = st === 'aborted' ? 'cell-del' : st === 'committed' ? 'cell-new' : f.cyc.has(t) ? 'cell-hl' : inG ? 'cell' : 'cell-dim';
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" class="${cls}"${f.cyc.has(t) ? ' style="stroke:var(--red);stroke-width:2.5"' : ''}/>`;
    s += `<text x="${x.toFixed(1)}" y="${(y + 4.5).toFixed(1)}" text-anchor="middle" class="big"${st === 'aborted' ? ' style="text-decoration:line-through"' : ''}>${s4T(t)}</text>`;
    const tag = st === 'aborted' ? 'rolled back' : st === 'committed' ? 'committed' : st === 'waiting' ? 'waiting' : '';
    if (tag) s += `<text x="${x.toFixed(1)}" y="${(y + (y < cy - 5 ? -23 : 32)).toFixed(1)}" text-anchor="middle" class="lbl">${tag}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="waits-for graph">${s}</svg>`;
}
// lock table: element | holders | waiting
function s4lockTable(f) {
  const xs = [...new Set([...Object.keys(f.hold), ...f.waitQ.map(w => w.x)])].sort();
  const rows = xs.map(x => {
    const hs = (f.hold[x] || []).map(h => `${s4T(h.t)}:${h.mode}`).join(' '), ws = f.waitQ.filter(w => w.x === x).map(w => `${s4T(w.t)}:${w.mode}`).join(' ');
    return hs || ws ? `<tr><td>${x}</td><td>${hs || '–'}</td><td>${ws || '–'}</td></tr>` : '';
  }).join('');
  return `<table class="s4-lt"><tr><th>elem.</th><th>held by</th><th>waiting</th></tr>${rows || '<tr><td colspan="3">no locks held</td></tr>'}</table>`;
}

// Schedule as a grid: one column per transaction (like the slides' figures).
// mark: {i: cls} per action index (0-based); colCls: {t: cls}; note: {i: html}; upto: last index shown
function s4grid(acts, { mark = {}, colCls = {}, note = {}, upto = acts.length - 1, cur = -1, extraRow = null } = {}) {
  const tx = s4txns(acts);
  let h = `<table class="s4-grid"><tr><th>step</th>${tx.map(t => `<th class="${colCls[t] || ''}">${s4T(t)}</th>`).join('')}<th class="nt">what happens</th></tr>`;
  acts.forEach((a, i) => {
    const show = i <= upto;
    h += `<tr class="${i === cur ? 'cur' : ''}${show ? '' : ' fut'}"><td class="n">${i + 1}</td>` +
      tx.map(t => `<td class="${t === a.t ? (mark[i] || '') : ''} ${colCls[t] || ''}">${t === a.t ? s4fmt(a) : ''}</td>`).join('') +
      `<td class="nt">${show ? (note[i] || '') : ''}</td></tr>`;
  });
  if (extraRow) h += `<tr class="cur"><td class="n">${acts.length + 1}</td>${tx.map(t => `<td class="${t === extraRow.t ? extraRow.cls : ''} ${colCls[t] || ''}">${t === extraRow.t ? extraRow.text : ''}</td>`).join('')}<td class="nt">${extraRow.note || ''}</td></tr>`;
  return h + '</table>';
}
const s4badge = (ok, yes, no) => `<span class="s4-badge ${ok ? 'good' : 'bad'}">${ok ? yes : no}</span>`;

// Stepper frames for a cascading rollback started by victim v (used by Tool 1 and by chapter figures)
function s4cascadeFrames(acts, v) {
  const K = s4cascade(acts, v), C = K.C;
  // the hypothetical abort replaces the victim's commit, or is added after the last step
  let shown = acts, extraRow = null;
  if (!C.abort[v] && C.commit[v]) shown = acts.map((a, k) => k === K.at - 1 ? { op: 'a', t: v, x: null } : a);
  if (!C.abort[v] && !C.commit[v]) extraRow = { t: v, text: `a${v}`, cls: 'ab', note: 'hypothetical abort' };
  const mk = (rolled, hot, stuck) => {
    const mark = {}; shown.forEach((b, k) => { if (b.op === 'c') mark[k] = 'cm'; if (b.op === 'a') mark[k] = 'ab'; });
    C.rf.filter(r => r.step < K.at && hot.includes(r.writer)).forEach(r => { mark[r.step - 1] = 'dirty'; mark[r.wstep - 1] = 'src'; });
    const colCls = {}; rolled.forEach(t => colCls[t] = 'rb'); stuck.forEach(t => colCls[t] = 'stk');
    const note = {}; C.rf.filter(r => r.step < K.at).forEach(r => { note[r.step - 1] = `${s4T(r.reader)} read ${r.x} from ${s4T(r.writer)}${r.dirty ? ' (dirty)' : ''}`; });
    shown.forEach((b, k) => { if (b.op === 'a' && b.t === v) note[k] = C.abort[v] ? `${s4T(v)} aborts` : `${s4T(v)} aborts (hypothetical)`; });
    return s4grid(shown, { mark, colCls, extraRow, note });
  };
  const frames = [{ html: mk([], [], []), cap: `${K.how}.` }];
  const rolled = [v]; const stuck = [];
  for (const st of K.steps) {
    frames.push({ html: mk(rolled, [st.t], stuck), cap: `${s4T(st.t)} is rolled back. Which transactions read a value that ${s4T(st.t)} wrote (before step ${K.at})? ` +
      (st.deps.length ? st.deps.map(d => `<b>${s4T(d.t)}</b>`).join(', ') + ' (orange; the write they read is outlined).' : '<b>None</b>, so nothing more cascades from it.') });
    if (st.deps.length) {
      st.deps.forEach(d => { if (d.committed) stuck.push(d.t); else if (!rolled.includes(d.t)) rolled.push(d.t); });
      frames.push({ html: mk(rolled, [st.t], stuck), cap: st.deps.map(d => d.committed
        ? `<b>${s4T(d.t)} already committed</b> at step ${C.commit[d.t]}, so it cannot be rolled back: the schedule is <b>not recoverable</b>.`
        : d.already ? `${s4T(d.t)} is already being rolled back.` : `${s4T(d.t)} has not committed, so it is rolled back too (cascading rollback), and the algorithm repeats for it.`).join(' ') });
    }
  }
  frames.push({ html: mk(rolled, [], stuck), cap: `Done. Rolled back: <b>${rolled.map(s4T).join(', ')}</b>${K.stuck.length ? `. Stuck (committed, cannot be undone): <b>${[...new Set(K.stuck)].map(s4T).join(', ')}</b>` : ''}. ` +
    'Their writes are undone using the old values in the undo (or undo/redo) log, and their locks are released.' });
  return frames;
}

// ---------- Tool 1 (DOM): schedule classifier + cascading rollback ----------
function scheduleTool(sel, initial, { victim } = {}) {
  const host = $(sel);
  host.innerHTML = `<form class="s4-form"><label>Schedule <input type="text" class="s4-in" value="${s4esc(initial)}" spellcheck="false" autocomplete="off" aria-label="schedule"></label>
    <button type="submit">Classify</button></form><div class="s4-msg" aria-live="polite"></div><div class="s4-verdict"></div><div class="s4-st1"></div>
    <div class="s4-casc"><form class="s4-form s4-cf"><label>Cascading rollback: what if <select aria-label="transaction that aborts"></select> aborts?</label> <button type="submit">Animate</button></form><div class="s4-st2"></div></div>`;
  const msg = host.querySelector('.s4-msg'), inp = host.querySelector('.s4-in'), selT = host.querySelector('select');
  let acts = null;
  const run = () => {
    const P = s4parse(inp.value, 'rwca');
    if (!P.ok) { msg.innerHTML = P.err; msg.className = 's4-msg bad'; return; }
    const C = s4classify(P.acts);
    if (C.errs.length) { msg.innerHTML = C.errs[0]; msg.className = 's4-msg bad'; return; }
    msg.innerHTML = ''; msg.className = 's4-msg'; acts = P.acts;
    const li = w => w.length ? '<ul>' + w.map(x => `<li>${x}</li>`).join('') + '</ul>' : '';
    const pe = C.csr.edges.map(e => `${s4T(e.from)}→${s4T(e.to)} (${e.why})`).join('; ') || 'no edges';
    host.querySelector('.s4-verdict').innerHTML = `<div class="s4-v">
      <p>${s4badge(C.recoverable.ok, 'Recoverable', 'Not recoverable')} ${C.recoverable.ok ? 'Every transaction commits only after each transaction it read from has committed.' : ''}</p>${li(C.recoverable.why)}
      <p>${s4badge(C.acr.ok, 'ACR', 'Not ACR')} ${C.acr.ok ? 'Every read sees only committed data, so no abort can cascade.' : ''}</p>${li(C.acr.why)}
      <p>${s4badge(C.strict.ok, 'Strict', 'Not strict')} ${C.strict.ok ? 'Nobody reads or overwrites an element until the transaction that last wrote it has committed or aborted.' : ''}</p>${C.acr.ok ? li(C.strict.why) : (C.strict.why.length > C.acr.why.length ? li(C.strict.why.slice(C.acr.why.length)) : '<ul><li>Every dirty read above also breaks strictness.</li></ul>')}
      ${C.strict.ok && !C.csr.ok ? '<p class="s4-msg">Note: no transaction reads or overwrites uncommitted data, yet the schedule is not conflict-serializable, so no strict 2PL scheduler could have produced it. The textbook\'s class of strict schedules (those produced by strict locking) lies inside the serializable class.</p>' : ''}
      <p>${s4badge(C.csr.ok, 'Conflict-serializable', 'Not conflict-serializable')} Precedence graph: ${pe}. ${C.csr.ok ? `Equivalent serial order: <b>${C.csr.order.map(s4T).join(', ')}</b>.` : `Cycle among ${[...C.csr.cyc].sort().map(s4T).join(', ')}.`}</p></div>`;
    const frames = P.acts.map((a, i) => {
      const mark = {}; P.acts.slice(0, i + 1).forEach((b, k) => {
        if (b.op === 'c') mark[k] = 'cm'; if (b.op === 'a') mark[k] = 'ab';
        if (C.rf.some(r => r.step === k + 1 && r.dirty)) mark[k] = 'dirty';
      });
      const note = {}; C.notes.forEach((n, k) => { note[k] = n.join('; '); });
      return { html: s4grid(P.acts, { mark, note, upto: i, cur: i }), cap: `Step ${i + 1}, <code>${s4fmt(a)}</code>: ${C.notes[i].join('; ') || `${s4T(a.t)} ${a.op === 'w' ? 'writes' : 'reads'} ${a.x}`}.` };
    });
    frames.push({ html: s4grid(P.acts, { mark: Object.fromEntries(P.acts.map((b, k) => [k, b.op === 'c' ? 'cm' : b.op === 'a' ? 'ab' : C.rf.some(r => r.step === k + 1 && r.dirty) ? 'dirty' : ''])), note: Object.fromEntries(C.notes.map((n, k) => [k, n.join('; ')])) }),
      cap: `<b>Verdict:</b> ${C.recoverable.ok ? 'recoverable' : 'not recoverable'}, ${C.acr.ok ? 'ACR' : 'not ACR'}, ${C.strict.ok ? 'strict' : 'not strict'}, ${C.csr.ok ? 'conflict-serializable' : 'not conflict-serializable'}. Dirty reads are orange, commits green, aborts red.` });
    stepper(host.querySelector('.s4-st1'), frames);
    const tx = s4txns(P.acts), dflt = victim && tx.includes(victim) ? victim : (C.rf.length ? C.rf[0].writer : tx[0]);
    selT.innerHTML = tx.map(t => `<option value="${t}"${t === dflt ? ' selected' : ''}>${s4T(t)}</option>`).join('');
    casc();
  };
  const casc = () => {
    if (!acts) return;
    stepper(host.querySelector('.s4-st2'), s4cascadeFrames(acts, +selT.value));
  };
  host.querySelector('form').addEventListener('submit', e => { e.preventDefault(); run(); });
  host.querySelector('.s4-cf').addEventListener('submit', e => { e.preventDefault(); casc(); });
  run();
}

// ---------- Tool 2 (DOM): waits-for graph builder ----------
function waitsForTool(sel, initial, { policy = 'detect', victim = 'highest' } = {}) {
  const host = $(sel);
  host.innerHTML = `<form class="s4-form"><label>Actions <input type="text" class="s4-in" value="${s4esc(initial)}" spellcheck="false" autocomplete="off" aria-label="actions"></label>
    <label>Deadlocks <select class="s4-pol"><option value="detect">detect after the last action</option><option value="prevent">check on every request</option></select></label>
    <label>Victim <select class="s4-vic"><option value="closer">transaction that closed the cycle</option><option value="highest">highest-numbered on the cycle</option></select></label>
    <button type="submit">Build graph</button></form><div class="s4-msg" aria-live="polite"></div><div class="s4-st"></div>`;
  host.querySelector('.s4-pol').value = policy; host.querySelector('.s4-vic').value = victim;
  const run = () => {
    const P = s4parse(host.querySelector('.s4-in').value, 'lock'), msg = host.querySelector('.s4-msg');
    if (!P.ok) { msg.innerHTML = P.err; msg.className = 's4-msg bad'; return; }
    msg.innerHTML = ''; msg.className = 's4-msg';
    const R = s4lockSim(P.acts, { policy: host.querySelector('.s4-pol').value, victim: host.querySelector('.s4-vic').value });
    const tx = R.txns;
    const hist = k => `<table class="s4-hist">${R.frames.slice(0, k + 1).map((f, j) => `<tr class="${j === k ? 'cur' : ''}"><td class="n">${f.step ?? '·'}</td><td><code>${f.act ?? (f.extra === 'rollback' ? 'detector' : 'release')}</code></td><td>${f.lines.map(l => `<span class="${l.cls}">${l.h}</span>`).join(' ')}</td></tr>`).join('')}</table>`;
    stepper(host.querySelector('.s4-st'), R.frames.map((f, k) => ({
      html: `<div class="s4-two"><div>${hist(k)}</div><div class="s4-side">${wfgSVG(f, tx)}${s4lockTable(f)}</div></div>`,
      cap: (f.step ? `Step ${f.step}, <code>${f.act}</code>: ` : '') + f.lines.map(l => l.h).join(' ') +
        (f.cyc.size ? ` <b class="bad">Cycle: ${[...f.cyc].sort().map(s4T).join(', ')} are deadlocked.</b>` : f.edges.length ? ' The graph has no cycle, so there is no deadlock.' : ''),
    })));
  };
  host.querySelector('form').addEventListener('submit', e => { e.preventDefault(); run(); });
  run();
}

// ---------- Tool 3 (DOM): wait-die vs wound-wait side by side ----------
function s4parseTS(text, tx) {
  const ts = {}; let m; const re = /T?(\d+)\s*[=:]\s*(\d+)/gi;
  while ((m = re.exec(text))) ts[+m[1]] = +m[2];
  for (const t of tx) if (ts[t] == null) ts[t] = t;
  return ts;
}
function wdwwTool(sel, initial, tsText = '', { restart = false } = {}) {
  const host = $(sel);
  host.innerHTML = `<form class="s4-form"><label>Lock requests <input type="text" class="s4-in" value="${s4esc(initial)}" spellcheck="false" autocomplete="off" aria-label="lock requests"></label>
    <label>Timestamps <input type="text" class="s4-ts" value="${s4esc(tsText)}" placeholder="T1=100, T2=150 (default: Ti = i)" spellcheck="false" autocomplete="off" aria-label="timestamps"></label>
    <label><input type="checkbox" class="s4-rs"${restart ? ' checked' : ''}> rolled-back transactions restart</label>
    <button type="submit">Simulate</button></form><div class="s4-msg" aria-live="polite"></div><div class="s4-st"></div>`;
  const run = () => {
    const P = s4parse(host.querySelector('.s4-in').value, 'lock'), msg = host.querySelector('.s4-msg');
    if (!P.ok) { msg.innerHTML = P.err; msg.className = 's4-msg bad'; return; }
    const tx = s4txns(P.acts), ts = s4parseTS(host.querySelector('.s4-ts').value, tx);
    if (new Set(tx.map(t => ts[t])).size < tx.length) { msg.innerHTML = 'Two transactions have the same timestamp. Deadlock timestamps must be distinct.'; msg.className = 's4-msg bad'; return; }
    msg.innerHTML = `Oldest first: ${[...tx].sort((a, b) => ts[a] - ts[b]).map(t => `${s4T(t)} (${ts[t]})`).join(' &lt; ')}.`; msg.className = 's4-msg';
    const rs = host.querySelector('.s4-rs').checked;
    const A = s4lockSim(P.acts, { policy: 'wait-die', ts, restart: rs }), B = s4lockSim(P.acts, { policy: 'wound-wait', ts, restart: rs });
    const word = f => { const l = f.lines.map(x => x.h).join(' '); return /\bdies\b/.test(l) ? 'die' : /wounds/.test(l) ? 'wound' : /waits<\/b>/.test(l) ? 'wait' : /ignored|delayed/.test(l) ? 'skip' : 'ok'; };
    const tag = w => w === 'die' ? '<span class="s4-badge bad">dies</span>' : w === 'wound' ? '<span class="s4-badge bad">wounds</span>' : w === 'wait' ? '<span class="s4-badge mid">waits</span>' : w === 'skip' ? '<span class="s4-badge dim">blocked / gone</span>' : '<span class="s4-badge good">granted</span>';
    const stat = f => s4status(f, tx);
    const frames = P.acts.map((a, k) => ({
      html: `<table class="s4-hist s4-ww"><tr><th>step</th><th>action</th><th>wait-die</th><th>wound-wait</th></tr>${P.acts.slice(0, k + 1).map((b, j) =>
        `<tr class="${j === k ? 'cur' : ''}"><td class="n">${j + 1}</td><td><code>${s4fmt(b)}</code></td><td>${tag(word(A.frames[j]))}</td><td>${tag(word(B.frames[j]))}</td></tr>`).join('')}</table>
        <div class="s4-two"><div><div class="figlabel">wait-die</div>${stat(A.frames[k])}</div><div><div class="figlabel">wound-wait</div>${stat(B.frames[k])}</div></div>`,
      cap: `Step ${k + 1}, <code>${s4fmt(a)}</code>. <b>Wait-die:</b> ${A.frames[k].lines.map(l => l.h).join(' ')} <br><b>Wound-wait:</b> ${B.frames[k].lines.map(l => l.h).join(' ')}`,
    }));
    stepper(host.querySelector('.s4-st'), frames);
  };
  host.querySelector('form').addEventListener('submit', e => { e.preventDefault(); run(); });
  run();
}

// Static schedule table for figures: head = [..], rows = [[cell html, ...]], cls = {'r,c': 'hl'|'del'|'ok'};
// rows after `upto` are hidden (kept for a stable frame height), row `cur` is outlined.
function s4table(head, rows, { upto = rows.length - 1, cur = -1, cls = {} } = {}) {
  return `<table class="s4-grid s4-sch"><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>` +
    rows.map((r, i) => `<tr class="${i === cur ? 'cur' : ''}${i > upto ? ' fut' : ''}">` +
      r.map((c, j) => `<td class="${j === 0 ? 'n' : ''} ${cls[i + ',' + j] || ''}">${c}</td>`).join('') + '</tr>').join('') + '</table>';
}

// transaction status list (active / waiting / rolled back, locks held)
function s4status(f, tx) {
  return `<div class="s4-stat">${tx.map(t => {
    const st = f.status[t], locks = Object.entries(f.hold).filter(([, hs]) => hs.some(h => h.t === t)).map(([x, hs]) => x + (hs.find(h => h.t === t).mode === 'S' ? '(S)' : '')).join(' ');
    const w = f.waitQ.find(q => q.t === t);
    return `<div class="${st}"><b>${s4T(t)}</b> ${st === 'aborted' ? 'rolled back' : st === 'idle' ? 'not started' : st}${w ? ` for ${w.x}` : ''}${locks ? ` · holds ${locks}` : ''}</div>`;
  }).join('')}</div>`;
}
// merge per-action frames into figure rows: rowOf[i] = row number of action i
function s4groupFrames(frames, rowOf) {
  const g = [];
  frames.forEach((f, i) => {
    const row = f.step ? rowOf[f.step - 1] : null, last = g[g.length - 1];
    if (last && (row === last.row || row === null)) { last.f = f; last.lines = last.lines.concat(f.lines); if (f.act) last.acts.push(f.act); }
    else g.push({ row, f, lines: f.lines, acts: f.act ? [f.act] : [] });
  });
  return g;
}
