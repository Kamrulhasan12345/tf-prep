// Concurrency-control tools shared by s02/ and s03/ (Sukarna Lec 02 and Lec 03).
// Pure functions first (tested with node), DOM tools at the end.
// Notation: r1(A) read, w1(A) write, c1 commit, a1 abort, st1 start,
//           l1(A) single lock, sl1(A) shared, xl1(A) exclusive, ul1(A) update, u1(A) unlock.

const CC = (() => {
  const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
  const NEEDS_X = new Set(['r', 'w', 'l', 'sl', 'xl', 'ul', 'u']);
  const OP_NAME = { r: 'read', w: 'write', c: 'commit', a: 'abort', st: 'start', l: 'lock', sl: 'shared lock', xl: 'exclusive lock', ul: 'update lock', u: 'unlock' };

  // ---------- parsing ----------
  // returns {acts:[{op,t,x,txt}], err}
  function parse(str, allowed) {
    const s = String(str).replace(/[₀-₉]/g, c => SUB[c]).replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')')
      .replace(/\b(READ|WRITE)\s*\(\s*([A-Za-z]\w*)\s*\)\s*_?T?(\d+)/gi, (m, o, x, t) => `${o[0]}${t}(${x})`);
    const toks = s.split(/[\s;,]+/).filter(Boolean);
    const acts = [];
    if (!toks.length) return { acts, err: 'The schedule is empty. Type actions such as r1(A) w2(A) c1.' };
    for (const tok of toks) {
      const m = /^(st|sl|xl|ul|r|w|l|u|c|a)_?(\d+)(?:\(([A-Za-z]\w*)\))?$/i.exec(tok);
      if (!m) return { acts, err: `I could not read “${tok}”. Write each action like r1(A), w2(B), c1 (commit), a1 (abort)${allowed && allowed.includes('sl') ? ', sl1(A), xl1(A), ul1(A), l1(A), u1(A)' : ''}${allowed && allowed.includes('st') ? ', st1 (start)' : ''}.` };
      const op = m[1].toLowerCase(), t = +m[2], x = m[3] ? m[3].toUpperCase() : null;
      if (allowed && !allowed.includes(op)) return { acts, err: `“${tok}” (${OP_NAME[op]}) is not used by this tool. Allowed: ${allowed.join(', ')}.` };
      if (NEEDS_X.has(op) && !x) return { acts, err: `“${tok}” needs a database element in brackets, e.g. ${op}${t}(A).` };
      if (!NEEDS_X.has(op) && x) return { acts, err: `“${tok}”: ${OP_NAME[op]} takes no element. Write ${op}${t}.` };
      if (t < 1 || t > 99) return { acts, err: `“${tok}”: use transaction numbers 1–99.` };
      acts.push({ op, t, x, txt: x ? `${op}${t}(${x})` : `${op}${t}` });
    }
    return { acts, err: null };
  }
  // pretty action with subscript: r₁(A)
  const subs = n => String(n).split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[d]).join('');
  const fmt = a => a.x ? `${a.op}${subs(a.t)}(${a.x})` : `${a.op}${subs(a.t)}`;
  const txnsOf = acts => [...new Set(acts.map(a => a.t))].sort((p, q) => p - q);

  // ---------- conflict serializability ----------
  const conflicts = (a, b) => a.t !== b.t && a.x === b.x && (a.op === 'w' || b.op === 'w');
  function csAnalyze(all) {
    const acts = all.filter(a => a.op === 'r' || a.op === 'w');
    const txns = txnsOf(acts);
    const pairs = [], edges = new Map();
    for (let i = 0; i < acts.length; i++) for (let j = i + 1; j < acts.length; j++) {
      if (!conflicts(acts[i], acts[j])) continue;
      pairs.push([i, j]);
      const k = acts[i].t + '>' + acts[j].t;
      if (!edges.has(k)) edges.set(k, { from: acts[i].t, to: acts[j].t, pairs: [], elems: new Set() });
      edges.get(k).pairs.push([i, j]); edges.get(k).elems.add(acts[i].x);
    }
    const E = [...edges.values()];
    const succ = t => E.filter(e => e.from === t).map(e => e.to);
    // one cycle via DFS
    let cycle = null;
    const color = {}, stack = [];
    const dfs = u => {
      color[u] = 1; stack.push(u);
      for (const v of succ(u)) {
        if (cycle) return;
        if (color[v] === 1) { cycle = stack.slice(stack.indexOf(v)); return; }
        if (!color[v]) dfs(v);
      }
      stack.pop(); color[u] = 2;
    };
    for (const t of txns) if (!color[t] && !cycle) dfs(t);
    // Kahn's algorithm, smallest available first, with a trace
    const indeg = Object.fromEntries(txns.map(t => [t, E.filter(e => e.to === t).length]));
    const removed = new Set(), kahn = [];
    while (removed.size < txns.length) {
      const ready = txns.filter(t => !removed.has(t) && E.filter(e => e.to === t && !removed.has(e.from)).length === 0);
      if (!ready.length) break;
      kahn.push({ ready, pick: ready[0] });
      removed.add(ready[0]);
    }
    const order = cycle ? null : kahn.map(k => k.pick);
    // every topological order (capped)
    const orders = [];
    if (!cycle) (function rec(done, left) {
      if (orders.length >= 120) return;
      if (!left.length) { orders.push(done); return; }
      for (const t of left) if (E.every(e => e.to !== t || done.includes(e.from))) rec([...done, t], left.filter(u => u !== t));
    })([], txns);
    // adjacent non-conflicting swaps that turn the schedule into the serial order (insertion sort, as in Fig. 18.8)
    let swaps = null;
    if (order) {
      const rank = Object.fromEntries(order.map((t, i) => [t, i]));
      const cur = acts.map((a, i) => ({ ...a, id: i }));
      swaps = [{ seq: cur.slice(), at: -1 }];
      for (let i = 1; i < cur.length; i++) {
        let j = i;
        while (j > 0 && rank[cur[j - 1].t] > rank[cur[j].t]) {
          if (conflicts(cur[j - 1], cur[j])) throw new Error('internal: conflicting swap');
          swaps.push({ seq: cur.slice(), at: j - 1 });           // pair (j-1, j) about to be swapped
          [cur[j - 1], cur[j]] = [cur[j], cur[j - 1]];
          j--;
        }
      }
      swaps.push({ seq: cur.slice(), at: -1 });
    }
    return { acts, txns, pairs, edges: E, cycle, kahn, order, orders, swaps };
  }

  // ---------- locking scheduler ----------
  // compat[held][requested]
  const COMPAT = {
    S: { S: true, X: false, U: true, L: false },
    X: { S: false, X: false, U: false, L: false },
    U: { S: false, X: false, U: false, L: false },
    L: { S: false, X: false, U: false, L: false },
  };
  const MODE_OF = { l: 'L', sl: 'S', xl: 'X', ul: 'U' };
  const covers = (held, want) => held.has(want) || held.has('X') || (held.has('L') && want === 'L') || (want === 'S' && (held.has('U')));
  const strongest = modes => ['X', 'L', 'U', 'S'].find(m => modes.has(m));

  // Part I of the book's scheduler (§18.5.1): insert lock actions into a stream of r/w/c actions.
  // scheme: 'single' | 'upgrade' (sl then xl) | 'xfirst' (xl if the txn will write) | 'update' (ul then xl)
  // release: 'end' (all unlocks after the txn's last action, 2PL) | 'early' (2PL, unlock as soon as allowed) | 'asap' (after last access; may break 2PL)
  function insertLocks(acts, scheme = 'upgrade', release = 'end') {
    const own = {};
    acts.forEach((a, i) => { (own[a.t] = own[a.t] || []).push(i); });
    const before = acts.map(() => []), after = acts.map(() => []);
    for (const t in own) {
      const idx = own[t].filter(i => acts[i].op === 'r' || acts[i].op === 'w');
      const has = {}, firstLockAt = [];
      idx.forEach((i, k) => {
        const a = acts[i], later = idx.slice(k + 1).some(j => acts[j].x === a.x && acts[j].op === 'w');
        const h = has[a.x] || (has[a.x] = new Set());
        let need = null;
        if (scheme === 'single') { if (!h.size) need = 'l'; }
        else if (a.op === 'r') {
          if (!h.size) need = scheme === 'update' && later ? 'ul' : scheme === 'xfirst' && later ? 'xl' : 'sl';
        } else if (!h.has('xl')) need = 'xl';
        if (need) { h.add(need); before[i].push({ op: need, t: a.t, x: a.x }); firstLockAt.push(k); }
      });
      const lockPoint = firstLockAt.length ? Math.max(...firstLockAt) : -1;
      const elems = [...new Set(idx.map(i => acts[i].x))];
      const lastOwn = own[t][own[t].length - 1], commitIdx = own[t].find(i => acts[i].op === 'c' || acts[i].op === 'a');
      for (const x of elems) {
        const lastK = Math.max(...idx.map((i, k) => acts[i].x === x ? k : -1));
        let at;
        if (release === 'asap') at = idx[lastK];
        else if (release === 'early') at = idx[Math.max(lastK, lockPoint)];
        else at = null;
        const u = { op: 'u', t: +t, x };
        if (at != null) after[at].push(u);
        else if (commitIdx == null) after[lastOwn].push(u);
        // with a commit action the scheduler releases everything at commit (book §18.5), so no explicit unlock
      }
    }
    const out = [];
    acts.forEach((a, i) => { out.push(...before[i], a, ...after[i]); });
    return out.map(a => ({ ...a, txt: a.x ? `${a.op}${a.t}(${a.x})` : `${a.op}${a.t}` }));
  }

  // Part II: run lock/read/write/unlock/commit requests. Returns {frames, log, deadlock, final}
  function lockRun(acts) {
    const holds = new Map();            // x -> Map(t -> Set(mode))
    const waits = [];                   // [{t, x, mode}]
    const tx = {};
    for (const t of txnsOf(acts)) tx[t] = { blocked: null, queue: [], unlocked: false, lockPoint: null, firstUnlock: null, done: false, warn: [] };
    const log = [], frames = [];
    let deadlock = null;
    const H = x => holds.get(x) || holds.set(x, new Map()).get(x);
    const usesU = acts.some(a => a.op === 'ul');
    const table = () => {
      const xs = [...new Set([...[...holds.entries()].filter(([, m]) => m.size).map(([x]) => x), ...waits.map(w => w.x)])].sort();
      return xs.map(x => {
        const m = holds.get(x) || new Map();
        const all = new Set(); m.forEach(s => s.forEach(v => all.add(v)));
        const group = all.has('X') ? 'X' : all.has('L') ? 'L' : all.has('U') ? 'U' : all.size ? 'S' : '–';
        return { x, group, waiting: waits.some(w => w.x === x), list: [...[...m.entries()].map(([t, s]) => ({ t, mode: strongest(s), modes: [...s], wait: false })), ...waits.filter(w => w.x === x).map(w => ({ t: w.t, mode: w.mode, wait: true }))] };
      });
    };
    const blockers = (t, x, mode) => [...H(x).entries()].filter(([u, s]) => u !== t && [...s].some(h => !COMPAT[h][mode])).map(([u, s]) => ({ t: u, mode: strongest(s) }));
    const waitsFor = () => {
      const E = [];
      for (const w of waits) for (const b of blockers(w.t, w.x, w.mode)) E.push([w.t, b.t, w.x]);
      return E;
    };
    const findCycle = () => {
      const E = waitsFor(), nodes = [...new Set(E.flatMap(e => [e[0], e[1]]))];
      let cyc = null; const col = {}, st = [];
      const dfs = u => { col[u] = 1; st.push(u); for (const e of E.filter(e => e[0] === u)) { if (cyc) return; const v = e[1]; if (col[v] === 1) { cyc = st.slice(st.indexOf(v)); return; } if (!col[v]) dfs(v); } st.pop(); col[u] = 2; };
      for (const n of nodes) if (!col[n] && !cyc) dfs(n);
      return cyc;
    };
    const push = (cap, hi = {}) => frames.push({ cap, log: log.map(l => ({ ...l })), table: table(), wf: waitsFor(), hi, status: Object.fromEntries(Object.entries(tx).map(([t, s]) => [t, { ...s, warn: [...s.warn], queue: s.queue.map(a => a.txt) }])) });
    let step = 0;
    const lockTxt = (op, t, x) => `${op}${t}(${x})`;

    function grantWaiters(x, why) {
      let i = 0;
      while (i < waits.length) {
        const w = waits[i];
        if (w.x !== x) { i++; continue; }
        if (blockers(w.t, w.x, w.mode).length) break;        // first-come-first-served: stop at the first that still must wait
        waits.splice(i, 1);
        H(x).has(w.t) || H(x).set(w.t, new Set());
        H(x).get(w.t).add(w.mode);
        tx[w.t].blocked = null; tx[w.t].lockPoint = log.length;
        log.push({ t: w.t, txt: lockTxt(w.op, w.t, x), kind: 'granted' });
        push(`${why} The waiting request <b>${w.op}${subs(w.t)}(${x})</b> of T${w.t} can now be granted, so T${w.t} resumes.`, { row: log.length - 1, held: null, req: w.mode, x });
        while (tx[w.t].queue.length && !tx[w.t].blocked) exec(tx[w.t].queue.shift(), true);
        i = 0;
      }
    }
    function release(t, x) {
      const m = H(x);
      if (!m.has(t)) return false;
      m.delete(t);
      return true;
    }
    function exec(a, resumed) {
      const T = tx[a.t], who = `T${a.t}`, f = fmt(a);
      const pre = resumed ? `(delayed action of ${who} now runs) ` : '';
      if (a.op in MODE_OF) {
        const mode = MODE_OF[a.op], mine = H(a.x).get(a.t) || new Set();
        if (T.unlocked) T.warn.push(`${f} comes after an unlock: ${who} is not two-phase locked`);
        if (mode === 'X' && usesU && mine.has('S') && !mine.has('U') && !mine.has('X')) {
          // only meaningful in an S/X/U system: book footnote 3
          T.warn.push(`${f}: in an S/X/U system a shared lock may not be upgraded (only an update lock may)`);
        }
        if (covers(mine, mode)) {
          log.push({ t: a.t, txt: a.txt, kind: 'ok' });
          push(`${pre}${who} already holds a lock on ${a.x} that covers ${f}; nothing changes.`, { row: log.length - 1 });
          return;
        }
        const b = blockers(a.t, a.x, mode);
        if (!b.length) {
          H(a.x).has(a.t) || H(a.x).set(a.t, new Set());
          H(a.x).get(a.t).add(mode);
          T.lockPoint = log.length;
          log.push({ t: a.t, txt: a.txt, kind: 'ok' });
          const others = [...H(a.x).entries()].filter(([u]) => u !== a.t);
          push(`${pre}<b>${f} granted.</b> ` + (others.length && mode !== 'L' ? `Other locks on ${a.x}: ${others.map(([u, s]) => `${strongest(s)} by T${u}`).join(', ')}; the matrix says ${others.map(([, s]) => strongest(s)).join('/')} held + ${mode} requested = Yes.` : `No other transaction holds a lock on ${a.x}.`) + (mine.size ? ` (${who} now holds ${a.x} in modes ${[...H(a.x).get(a.t)].join(', ')}: an upgrade.)` : ''),
            { row: log.length - 1, held: others.length ? strongest(others[0][1]) : null, req: mode, x: a.x, ok: true });
        } else {
          T.blocked = { x: a.x, mode }; waits.push({ t: a.t, x: a.x, mode, op: a.op });
          log.push({ t: a.t, txt: a.txt, kind: 'denied' });
          const cyc = findCycle();
          let cap = mode === 'L' ? `${pre}<b>${f} denied.</b> T${b[0].t} holds the lock on ${a.x}; granting a second lock would make the schedule illegal. ${who} must wait; its later actions are delayed.` : `${pre}<b>${f} denied.</b> ${b.map(z => `T${z.t} holds a${z.mode === 'X' ? 'n' : ''} ${z.mode} lock on ${a.x}`).join(' and ')}, and the matrix entry (held ${b[0].mode}, requested ${mode}) is No. ${who} must wait; its later actions are delayed.`;
          if (cyc && !deadlock) { deadlock = { cycle: cyc, at: log.length - 1 }; cap += ` <b class="bad">Deadlock:</b> ${[...cyc, cyc[0]].map(c => 'T' + c).join(' waits for ')}. No transaction in this cycle can ever proceed.`; }
          push(cap, { row: log.length - 1, held: b[0].mode, req: mode, x: a.x, ok: false });
        }
        return;
      }
      if (a.op === 'r' || a.op === 'w') {
        const mine = H(a.x).get(a.t) || new Set();
        const okLock = a.op === 'r' ? mine.size > 0 : (mine.has('X') || mine.has('L'));
        if (!okLock) T.warn.push(`${f} without ${a.op === 'r' ? 'a' : 'an exclusive'} lock on ${a.x}: ${who} is not consistent`);
        log.push({ t: a.t, txt: a.txt, kind: okLock ? 'ok' : 'warn' });
        push(`${pre}${f}: ${who} ${a.op === 'r' ? 'reads' : 'writes'} ${a.x}${okLock ? `, allowed because it holds ${strongest(mine)} on ${a.x}.` : `. <b class="bad">It has no suitable lock on ${a.x}</b>, so the transaction is not consistent.`}`, { row: log.length - 1 });
        return;
      }
      if (a.op === 'u') {
        const had = release(a.t, a.x);
        if (!had) T.warn.push(`${f}: ${who} unlocks ${a.x} without holding a lock on it`);
        if (!T.unlocked) T.firstUnlock = log.length;
        T.unlocked = true;
        log.push({ t: a.t, txt: a.txt, kind: 'ok' });
        push(`${pre}${f}: ${who} releases its lock(s) on ${a.x}.` + (T.firstUnlock === log.length - 1 ? ` This is ${who}'s first unlock: its growing phase is over and its shrinking phase begins.` : ''), { row: log.length - 1 });
        grantWaiters(a.x, `${a.x} is free of conflicting locks.`);
        return;
      }
      if (a.op === 'c' || a.op === 'a') {
        const xs = [...holds.entries()].filter(([, m]) => m.has(a.t)).map(([x]) => x);
        xs.forEach(x => release(a.t, x));
        if (!T.unlocked && xs.length) T.firstUnlock = log.length;
        T.unlocked = true; T.done = true;
        log.push({ t: a.t, txt: a.txt, kind: 'ok' });
        push(`${pre}${f}: ${who} ${a.op === 'c' ? 'commits' : 'aborts'}. The scheduler releases all its locks${xs.length ? ` (${xs.join(', ')})` : ' (none held)'}.`, { row: log.length - 1 });
        xs.forEach(x => grantWaiters(x, `T${a.t} released ${x}.`));
      }
    }
    push('Start: the lock table is empty.', {});
    for (const a of acts) {
      step++;
      const T = tx[a.t];
      if (T.blocked || T.queue.length) {
        T.queue.push(a);
        push(`T${a.t} is waiting for ${T.blocked ? `a ${T.blocked.mode} lock on ${T.blocked.x}` : 'an earlier delayed action'}, so <b>${fmt(a)}</b> is held back and added to T${a.t}'s list of delayed actions.`, {});
        continue;
      }
      exec(a, false);
    }
    const stuck = Object.entries(tx).filter(([, s]) => s.blocked || s.queue.length).map(([t]) => +t);
    // the read/write order that actually reached the database
    const done = log.filter(l => l.kind !== 'denied').map(l => parse(l.txt).acts[0]).filter(a => a && (a.op === 'r' || a.op === 'w'));
    return { frames, log, deadlock, stuck, tx, executed: done };
  }

  // ---------- timestamp scheduler (§18.8.4) and multiversion (§18.8.5) ----------
  // opts: {ts: {t: number}, commitBits: bool, multi: bool}
  function tsRun(acts, opts = {}) {
    const ts = {}, given = opts.ts || {};
    let counter = 0;
    const txns = txnsOf(acts);
    const hasSt = acts.some(a => a.op === 'st');
    if (hasSt) {
      const maxGiven = Math.max(0, ...Object.values(given));
      counter = maxGiven;
    }
    for (const t of txns) if (given[t] != null) ts[t] = given[t];
    if (!hasSt) for (const t of txns) if (ts[t] == null) ts[t] = t;
    const el = {};                       // x -> {rt, ver:[{wt,t,committed,rt}]}
    const E = x => el[x] || (el[x] = { rt: 0, ver: [{ wt: 0, t: null, committed: true, rt: 0 }] });
    const tx = {};
    for (const t of txns) tx[t] = { status: 'active', queue: [], waitOn: null };
    const rows = [], frames = [];
    const state = () => Object.keys(el).sort().map(x => {
      const e = el[x], top = e.ver[e.ver.length - 1];
      return { x, rt: e.rt, wt: top.wt, c: top.committed, ver: e.ver.map(v => ({ ...v })) };
    });
    const push = (cap, hiRow) => frames.push({ cap, rows: rows.map(r => ({ ...r })), state: state(), tx: Object.fromEntries(Object.entries(tx).map(([t, s]) => [t, { ...s, queue: s.queue.map(q => q.txt) }])), ts: { ...ts }, hi: hiRow });
    const C = t => `T${t}`;
    const undo = t => {
      const touched = [];
      for (const x in el) {
        const before = el[x].ver.length;
        el[x].ver = el[x].ver.filter(v => v.t !== t || v.wt === 0);
        if (el[x].ver.length !== before) touched.push(x);
      }
      return touched;
    };
    function retry(xs, why) {
      for (const t of txns) {
        const s = tx[t];
        if (s.status !== 'waiting' || !xs.includes(s.waitOn)) continue;
        s.status = 'active'; s.waitOn = null;
        push(`${why} T${t} was waiting on this element, so it repeats its request.`, null);
        while (s.queue.length && s.status === 'active') exec(s.queue.shift(), true);
      }
    }
    function abort(t, rule, a) {
      tx[t].status = 'aborted';
      const xs = undo(t);
      tx[t].queue = [];
      return xs;
    }
    function exec(a, resumed) {
      const t = a.t, s = tx[t], T = ts[t], pre = resumed ? '(retried) ' : '';
      const row = { t, txt: a.txt, note: '', cls: '', x: a.x };
      if (a.op === 'st') {
        if (ts[t] == null) ts[t] = ++counter;
        row.note = `TS(T${t}) = ${ts[t]}`;
        rows.push(row); push(`T${t} starts and receives timestamp ${ts[t]}.`, rows.length - 1); return;
      }
      if (T == null) { ts[t] = ++counter; }
      const TS = ts[t];
      if (a.op === 'c') {
        s.status = 'committed';
        const xs = Object.keys(el).filter(x => el[x].ver.some(v => v.t === t));
        for (const x of xs) el[x].ver.forEach(v => { if (v.t === t) v.committed = true; });
        row.note = xs.length && !opts.multi ? xs.map(x => `C(${x})=true`).join(', ') : 'commit';
        rows.push(row);
        push(`${pre}<b>Rule R3 (commit):</b> T${t} commits. ${xs.length ? `Set C(X) := true for every X it wrote: ${xs.join(', ')}.` : 'It wrote nothing, so no commit bit changes.'}`, rows.length - 1);
        if (xs.length) retry(xs, `C(${xs.join('), C(')}) became true.`);
        return;
      }
      if (a.op === 'a') {
        const xs = abort(t);
        row.note = 'Abort'; row.cls = 'bad'; rows.push(row);
        push(`${pre}<b>Rule R4 (abort):</b> T${t} aborts. Its tentative writes are cancelled${xs.length ? ` (${xs.join(', ')} get back their previous value and write time)` : ''}.`, rows.length - 1);
        if (xs.length) retry(xs, `T${t}'s writes were cancelled.`);
        return;
      }
      const e = E(a.x), top = e.ver[e.ver.length - 1], WT = top.wt, RT = e.rt;
      if (opts.multi) {
        const prev = e.ver.filter(v => v.wt <= TS).reduce((p, v) => v.wt > p.wt ? v : p);
        if (a.op === 'r') {
          const old = prev.rt; prev.rt = Math.max(prev.rt, TS); e.rt = Math.max(e.rt, TS);
          row.note = `read ${a.x}${subs(prev.wt)}`; row.ver = `${a.x}${prev.wt}`; rows.push(row);
          push(`${pre}<b>Read:</b> T${t} (TS ${TS}) reads the latest version of ${a.x} whose write time is ≤ ${TS}: <b>${a.x}<sub>${prev.wt}</sub></b>. ${prev.rt > old ? `RT(${a.x}<sub>${prev.wt}</sub>) becomes ${prev.rt}.` : `Its read time stays ${prev.rt}.`} A multiversion read never aborts.`, rows.length - 1);
        } else {
          if (prev.rt > TS) {
            row.note = 'Abort'; row.cls = 'bad'; rows.push(row);
            abort(t);
            push(`${pre}<b>Write rejected:</b> the version T${t} would follow is ${a.x}<sub>${prev.wt}</sub>, and it was read by a transaction with timestamp ${prev.rt} &gt; ${TS}. That reader should have seen T${t}'s value, so T${t} is rolled back.`, rows.length - 1);
          } else if (prev.wt === TS) {
            row.note = `overwrite ${a.x}${subs(TS)}`; rows.push(row);
            push(`${pre}T${t} writes ${a.x} again; it overwrites its own version ${a.x}<sub>${TS}</sub>.`, rows.length - 1);
          } else {
            e.ver.push({ wt: TS, t, committed: true, rt: 0 }); e.ver.sort((p, q) => p.wt - q.wt);
            row.note = `create ${a.x}${subs(TS)}`; row.ver = `${a.x}${TS}`; rows.push(row);
            push(`${pre}<b>Write:</b> the version before TS ${TS} is ${a.x}<sub>${prev.wt}</sub> with read time ${prev.rt} ≤ ${TS}, so the write is legal. A new version <b>${a.x}<sub>${TS}</sub></b> is created; the older versions stay.`, rows.length - 1);
          }
        }
        return;
      }
      if (a.op === 'r') {
        if (TS < WT) {
          row.note = 'Abort'; row.cls = 'bad'; rows.push(row);
          const xs = abort(t);
          push(`${pre}<b>Rule R1(b), read too late:</b> TS(T${t}) = ${TS} &lt; WT(${a.x}) = ${WT}. The value of ${a.x} was written by a transaction that is later in the serial order, so T${t} is rolled back (aborted, to restart with a new timestamp).`, rows.length - 1);
          if (xs.length) retry(xs, `T${t}'s writes were cancelled.`);
        } else if (opts.commitBits !== false && !top.committed) {
          s.status = 'waiting'; s.waitOn = a.x; s.queue.unshift(a);
          row.note = 'Wait'; row.cls = 'mid'; rows.push(row);
          push(`${pre}<b>Rule R1(a), C(${a.x}) false:</b> TS(T${t}) = ${TS} ≥ WT(${a.x}) = ${WT}, so the read is physically realizable, but T${top.t}, which wrote ${a.x}, has not committed. Reading now would be a dirty read, so T${t} is <b>delayed</b> until T${top.t} commits or aborts.`, rows.length - 1);
        } else {
          const up = TS > RT;
          if (up) e.rt = TS;
          row.note = up ? `RT=${TS}` : '(RT unchanged)'; rows.push(row);
          push(`${pre}<b>Rule R1(a):</b> TS(T${t}) = ${TS} ≥ WT(${a.x}) = ${WT}${opts.commitBits !== false ? ` and C(${a.x}) is true` : ''}: <b>grant</b> the read. ${up ? `TS(T${t}) &gt; RT(${a.x}) = ${RT}, so RT(${a.x}) := ${TS}.` : `RT(${a.x}) = ${RT} is already ≥ ${TS}, so it does not change.`}`, rows.length - 1);
        }
        return;
      }
      // write
      if (TS < RT) {
        row.note = 'Abort'; row.cls = 'bad'; rows.push(row);
        const xs = abort(t);
        push(`${pre}<b>Rule R2(c), write too late:</b> TS(T${t}) = ${TS} &lt; RT(${a.x}) = ${RT}. A transaction later in the serial order has already read ${a.x} and should have seen T${t}'s value, so T${t} is rolled back.`, rows.length - 1);
        if (xs.length) retry(xs, `T${t}'s writes were cancelled.`);
      } else if (TS >= WT) {
        if (top.t === t) { top.committed = opts.commitBits === false; }
        else e.ver.push({ wt: TS, t, committed: opts.commitBits === false, rt: 0 });
        row.note = `WT=${TS}` + (opts.commitBits !== false ? ', C=false' : ''); rows.push(row);
        push(`${pre}<b>Rule R2(a):</b> TS(T${t}) = ${TS} ≥ RT(${a.x}) = ${RT} and ≥ WT(${a.x}) = ${WT}: the write is physically realizable. Write ${a.x}, set WT(${a.x}) := ${TS}${opts.commitBits !== false ? ` and C(${a.x}) := false (the write is tentative until T${t} commits)` : ''}.`, rows.length - 1);
      } else if (opts.commitBits === false || top.committed) {
        row.note = 'Skip (Thomas)'; row.cls = 'mid'; rows.push(row);
        push(`${pre}<b>Rule R2(b), Thomas write rule:</b> TS(T${t}) = ${TS} ≥ RT(${a.x}) = ${RT}, but TS(T${t}) &lt; WT(${a.x}) = ${WT}${opts.commitBits !== false ? ` and C(${a.x}) is true` : ''}. A later value is already in ${a.x} and nobody later has read ${a.x}, so T${t}'s write is simply <b>ignored</b>; T${t} continues. WT(${a.x}) stays ${WT}.`, rows.length - 1);
      } else {
        s.status = 'waiting'; s.waitOn = a.x; s.queue.unshift(a);
        row.note = 'Wait'; row.cls = 'mid'; rows.push(row);
        push(`${pre}<b>Rule R2(b), C(${a.x}) false:</b> TS(T${t}) = ${TS} &lt; WT(${a.x}) = ${WT}, so the Thomas write rule would skip this write, but the later writer T${top.t} has not committed and might abort. T${t} is <b>delayed</b> until T${top.t} commits or aborts.`, rows.length - 1);
      }
    }
    push('Start: every element has RT = WT = 0' + (opts.multi ? ' and one version written at time 0.' : ' and C = true.'), null);
    for (const a of acts) {
      const s = tx[a.t];
      if (s.status === 'aborted') {
        rows.push({ t: a.t, txt: a.txt, note: 'ignored', cls: 'dim', x: a.x });
        push(`T${a.t} has been rolled back, so <b>${fmt(a)}</b> is not executed. (The restarted T${a.t} would get a new, larger timestamp; that run is not part of this schedule.)`, rows.length - 1);
        continue;
      }
      if (s.status === 'waiting') {
        s.queue.push(a);
        push(`T${a.t} is delayed (waiting on ${s.waitOn}), so <b>${fmt(a)}</b> is queued behind its delayed request.`, null);
        continue;
      }
      exec(a, false);
    }
    return { frames, rows, ts, tx, state: state() };
  }

  return { parse, fmt, subs, txnsOf, conflicts, csAnalyze, insertLocks, lockRun, tsRun, COMPAT };
})();
if (typeof module !== 'undefined') module.exports = CC;

// ======================= DOM rendering =======================
if (typeof document !== 'undefined') {
  // schedule grid: one column per transaction, time going down
  // rows: [{t, html, cls}] ; extra: optional {head:[..], cells: rowIndex -> [..]}
  CC.grid = function (txns, rows, o = {}) {
    const head = `<tr><th class="n">#</th>${txns.map(t => `<th>T${CC.subs(t)}${o.ts ? `<div class="tsv">${o.ts[t] ?? ''}</div>` : ''}</th>`).join('')}${(o.extra || []).map(h => `<th class="ex">${h}</th>`).join('')}</tr>`;
    const body = rows.map((r, i) => `<tr class="${r.cls || ''}${o.hi === i ? ' cur' : ''}"><td class="n">${i + 1}</td>${txns.map(t => `<td class="${t === r.t ? 'on' : ''}">${t === r.t ? r.html : ''}</td>`).join('')}${(r.ex || []).map(c => `<td class="ex">${c}</td>`).join('')}</tr>`).join('');
    return `<table class="sg">${head}${body}</table>`;
  };
  // tokens in one line, pair (at, at+1) underlined
  CC.tokens = function (seq, at, rank) {
    return `<div class="toks">${seq.map((a, i) => `<span class="tok tx${(rank ? rank[a.t] : a.t) % 5}${at >= 0 && (i === at || i === at + 1) ? ' sw' : ''}">${CC.fmt(a)}</span>`).join('<span class="semi">;</span>')}</div>`;
  };
  // precedence / waits-for graph. edges: [{from,to,label,cls}], nodes: [t], mark: Set of t (highlight), dim: Set
  CC.graphSVG = function (nodes, edges, o = {}) {
    const n = nodes.length, R = n <= 2 ? 90 : n <= 4 ? 100 : 120, W = 2 * R + 120, Hh = n <= 2 ? 110 : 2 * R + 80, cx = W / 2, cy = Hh / 2, r = 20;
    const pos = {};
    nodes.forEach((t, i) => {
      const ang = n === 1 ? 0 : -Math.PI / 2 + (n === 2 ? Math.PI / 2 : 0) + i * 2 * Math.PI / n;
      pos[t] = n === 1 ? [cx, cy] : [cx + R * Math.cos(ang) * (n === 2 ? 1.2 : 1), cy + R * Math.sin(ang) * (n === 2 ? 0 : 1)];
      if (n === 2) pos[t] = [cx + (i === 0 ? -R : R), cy];
    });
    let s = '';
    for (const e of edges) {
      const [x1, y1] = pos[e.from], [x2, y2] = pos[e.to];
      const both = edges.some(f => f.from === e.to && f.to === e.from);
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const bend = both ? 26 : 0, mx = (x1 + x2) / 2 - uy * bend, my = (y1 + y2) / 2 + ux * bend;
      // trim ends to the circle edge (approximate along the chord direction toward the control point)
      const a1 = Math.atan2(my - y1, mx - x1), a2 = Math.atan2(my - y2, mx - x2);
      const sx = x1 + r * Math.cos(a1), sy = y1 + r * Math.sin(a1), ex = x2 + (r + 3) * Math.cos(a2), ey = y2 + (r + 3) * Math.sin(a2);
      const cls = e.cls === 'red' ? 's-red' : e.cls === 'new' ? 's-acc' : e.cls === 'dim' ? 's-fg dash' : 's-fg';
      const mk = e.cls === 'red' ? 'm-red' : e.cls === 'new' ? 'm-acc' : 'm-fg';
      s += `<path d="M${sx.toFixed(1)} ${sy.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" class="${cls}" marker-end="url(#${mk})"/>`;
      if (e.label) {
        const lx = 0.25 * x1 + 0.5 * mx + 0.25 * x2 - uy * 12, ly = 0.25 * y1 + 0.5 * my + 0.25 * y2 + ux * 12 + 4;
        s += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" class="lbl ${e.cls === 'red' ? 'red' : ''}">${e.label}</text>`;
      }
    }
    for (const t of nodes) {
      const [x, y] = pos[t], cl = o.mark && o.mark.has(t) ? 'cell-hl' : o.dim && o.dim.has(t) ? 'cell-dim' : o.done && o.done.has(t) ? 'cell-new' : 'cell';
      s += `<circle cx="${x}" cy="${y}" r="${r}" class="${cl}"/><text x="${x}" y="${y + 5}" text-anchor="middle" class="big ${o.dim && o.dim.has(t) ? 'dimt' : ''}">T${CC.subs(t)}</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${Hh}" width="${W}" role="img" aria-label="${o.aria || 'precedence graph'}">${s}</svg>`;
  };

  // frames that reveal a vertical schedule one row at a time. rows: [{t, html, ex:[...], cap}]
  CC.growSteps = function (txns, rows, o = {}) {
    const steps = [];
    if (o.startCap) steps.push({ html: CC.grid(txns, o.init ? [o.init] : [], { extra: o.extra }), cap: o.startCap });
    rows.forEach((r, k) => {
      if (r.cap == null) return;            // rows without a caption are revealed together with the next captioned row
      steps.push({ html: CC.grid(txns, (o.init ? [o.init] : []).concat(rows.slice(0, k + 1)), { extra: o.extra, hi: k + (o.init ? 1 : 0) }), cap: r.cap });
    });
    return steps;
  };

  const form = (host, label, value, btn, extra = '') => {
    host.innerHTML = `<form class="cc-form"><label>${label}<input type="text" value="${value}" autocomplete="off" spellcheck="false"></label>${extra}<button type="submit">${btn}</button></form><div class="cc-msg" aria-live="polite"></div><div class="cc-out"></div>`;
    return { input: host.querySelector('input'), msg: host.querySelector('.cc-msg'), out: host.querySelector('.cc-out'), f: host.querySelector('form') };
  };

  // ---------- Tool 1: conflict-serializability tester ----------
  CC.csSteps = function (R, o = {}) {
    const { acts, txns } = R, steps = [];
    const rows = (hiIdx = new Set(), red = new Set()) => acts.map((a, i) => ({ t: a.t, html: CC.fmt(a), cls: red.has(i) ? 'pair' : hiIdx.has(i) ? 'hl' : '' }));
    const both = (g, sched) => `<div class="cc-two"><div>${sched}</div><div>${g}</div></div>`;
    steps.push({ html: both(CC.graphSVG(txns, []), CC.grid(txns, rows())), cap: `The schedule has ${acts.length} read/write actions from ${txns.length} transaction${txns.length > 1 ? 's' : ''}. Time goes down; each transaction has its own column. Step 1: one node per transaction.` });
    const elems = [...new Set(acts.map(a => a.x))].sort();
    const shown = new Set();
    for (const x of elems) {
      const ps = R.pairs.filter(([i]) => acts[i].x === x);
      const idx = new Set(acts.map((a, i) => a.x === x ? i : -1).filter(i => i >= 0));
      const red = new Set(ps.flat());
      const newE = [...new Set(ps.map(([i, j]) => acts[i].t + '>' + acts[j].t))];
      const edges = R.edges.filter(e => shown.has(e.from + '>' + e.to) || newE.includes(e.from + '>' + e.to)).map(e => ({ from: e.from, to: e.to, cls: newE.includes(e.from + '>' + e.to) && !shown.has(e.from + '>' + e.to) ? 'new' : '' }));
      const cap = ps.length
        ? `Element <b>${x}</b>: conflicting pairs (same element, different transactions, at least one write): ${ps.map(([i, j]) => `${CC.fmt(acts[i])} before ${CC.fmt(acts[j])} ⇒ T${CC.subs(acts[i].t)} → T${CC.subs(acts[j].t)}`).join('; ')}.`
        : `Element <b>${x}</b>: no conflicting pair (${[...idx].length < 2 ? 'only one action' : 'all accesses are reads or come from one transaction'}), so no arc.`;
      newE.forEach(k => shown.add(k));
      steps.push({ html: both(CC.graphSVG(txns, edges), CC.grid(txns, rows(idx, red))), cap });
    }
    const allE = R.edges.map(e => ({ from: e.from, to: e.to, label: [...e.elems].join(',') }));
    if (R.cycle) {
      const cyc = R.cycle, inC = (f, t) => cyc.some((c, i) => c === f && cyc[(i + 1) % cyc.length] === t);
      steps.push({ html: both(CC.graphSVG(txns, allE.map(e => ({ ...e, cls: inC(e.from, e.to) ? 'red' : '' })), { mark: new Set(cyc) }), CC.grid(txns, rows())),
        cap: `The graph has a <b>cycle</b>: ${[...cyc, cyc[0]].map(c => 'T' + CC.subs(c)).join(' → ')}. Every serial order would need each of these transactions before the next one and also after it, which is impossible. <b>The schedule is not conflict-serializable.</b>` });
      return steps;
    }
    const removed = new Set();
    R.kahn.forEach((k, i) => {
      steps.push({ html: both(CC.graphSVG(txns, allE.map(e => ({ ...e, cls: removed.has(e.from) ? 'dim' : '' })), { dim: removed, mark: new Set([k.pick]) }), CC.grid(txns, rows(new Set(acts.map((a, j) => a.t === k.pick ? j : -1))))),
        cap: `Topological sort, round ${i + 1}: transactions with no incoming arc from the remaining ones: ${k.ready.map(t => 'T' + CC.subs(t)).join(', ')}. Take <b>T${CC.subs(k.pick)}</b> next in the serial order${k.ready.length > 1 ? ' (any of them would do, so there is more than one serial order)' : ''}.` });
      removed.add(k.pick);
    });
    steps.push({ html: both(CC.graphSVG(txns, allE, { done: new Set(txns) }), CC.grid(txns, rows())),
      cap: `No cycle, so the schedule <b>is conflict-serializable</b>. Serial order found: <b>(${R.order.map(t => 'T' + CC.subs(t)).join(', ')})</b>.${R.orders.length > 1 ? ` All valid serial orders: ${R.orders.map(o => '(' + o.map(t => 'T' + CC.subs(t)).join(', ') + ')').join(', ')}.` : ' It is the only one.'}` });
    if (o.swaps !== false) {
      const rank = Object.fromEntries(R.order.map((t, i) => [t, i]));
      const sw = R.swaps, many = sw.length > 42;
      const list = many ? sw.filter((s, i) => i === 0 || i === sw.length - 1 || (s.at >= 0 && (i + 1 >= sw.length || sw[i + 1].seq[sw[i + 1].at + 1]?.id !== s.seq[s.at + 1].id))) : sw;
      list.forEach((s, k) => {
        let cap;
        if (k === 0) cap = `Now prove it by <b>swapping adjacent non-conflicting actions</b> until the schedule is serial in the order (${R.order.map(t => 'T' + CC.subs(t)).join(', ')}). Each swap is legal because the two actions are from different transactions and do not conflict.`;
        else if (s.at < 0) cap = `Done after ${sw.length - 2} swaps: the schedule is now the serial schedule (${R.order.map(t => 'T' + CC.subs(t)).join(', ')}), and every swap kept the order of every conflicting pair. So the original schedule is conflict-equivalent to it.`;
        else { const p = s.seq[s.at], q = s.seq[s.at + 1]; cap = `Swap ${CC.fmt(p)} and ${CC.fmt(q)}: different transactions, ${p.x !== q.x ? `different elements (${p.x} ≠ ${q.x})` : 'both are reads'}, so they do not conflict.${many ? ' (Only the last swap of each moved action is shown.)' : ''}`; }
        steps.push({ html: `<div class="swapbox">${CC.tokens(s.seq, s.at, rank)}</div>`, cap });
      });
    }
    return steps;
  };
  CC.csTool = function (sel, initial) {
    const host = typeof sel === 'string' ? $(sel) : sel;
    const ui = form(host, 'Schedule', initial, 'Test conflict-serializability');
    const run = () => {
      const p = CC.parse(ui.input.value, ['r', 'w', 'c', 'a']);
      if (p.err) { ui.msg.className = 'cc-msg bad'; ui.msg.textContent = p.err; return; }
      const rw = p.acts.filter(a => a.op === 'r' || a.op === 'w');
      if (rw.length < 2) { ui.msg.className = 'cc-msg bad'; ui.msg.textContent = 'Give at least two read or write actions.'; return; }
      if (CC.txnsOf(rw).length > 8) { ui.msg.className = 'cc-msg bad'; ui.msg.textContent = 'Use at most 8 transactions so the graph stays readable.'; return; }
      if (rw.length > 30) { ui.msg.className = 'cc-msg bad'; ui.msg.textContent = 'Use at most 30 actions.'; return; }
      ui.msg.className = 'cc-msg'; ui.msg.textContent = p.acts.length !== rw.length ? 'Commit and abort actions do not affect conflicts, so they are left out.' : '';
      const R = CC.csAnalyze(rw);
      ui.out.innerHTML = '<div></div>';
      stepper(ui.out.firstChild, CC.csSteps(R));
    };
    ui.f.addEventListener('submit', e => { e.preventDefault(); run(); });
    run();
  };

  // ---------- Tool 2: locking scheduler ----------
  CC.matrixHTML = function (modes, hi) {
    const M = CC.COMPAT;
    return `<table class="cm"><tr><th class="corner">held ↓ req →</th>${modes.map(m => `<th>${m}</th>`).join('')}</tr>${modes.map(h => `<tr><th>${h}</th>${modes.map(r => `<td class="${M[h][r] ? 'y' : 'n'}${hi && hi.held === h && hi.req === r ? (hi.ok ? ' on ok' : ' on') : ''}">${M[h][r] ? 'Yes' : 'No'}</td>`).join('')}</tr>`).join('')}</table>`;
  };
  CC.lockTableHTML = function (table) {
    if (!table.length) return '<p class="lt-empty">Lock table: empty (no element is locked).</p>';
    return `<div class="lt">${table.map(e => `<div class="lt-e"><div class="lt-h"><b>${e.x}</b> · ${e.group === 'L' ? 'locked' : `group mode <b>${e.group}</b>`} · waiting? <b>${e.waiting ? 'yes' : 'no'}</b></div><table><tr><th>Tran</th><th>Mode</th><th>Wait?</th></tr>${e.list.map(l => `<tr class="${l.wait ? 'w' : ''}"><td>T${CC.subs(l.t)}</td><td>${l.modes ? l.modes.join('+') : l.mode}</td><td>${l.wait ? 'yes' : 'no'}</td></tr>`).join('')}</table></div>`).join('')}</div>`;
  };
  CC.lockSteps = function (acts, o = {}) {
    const R = CC.lockRun(acts), txns = CC.txnsOf(acts);
    const modes = o.modes || (acts.some(a => a.op === 'ul') ? ['S', 'X', 'U'] : acts.some(a => a.op === 'sl' || a.op === 'xl') ? ['S', 'X'] : ['L']);
    const steps = R.frames.map(f => {
      const rows = f.log.map(l => ({ t: l.t, html: (l.kind === 'denied' ? `${CC.fmt(CC.parse(l.txt).acts[0])} <b class="bad">Denied</b>` : CC.fmt(CC.parse(l.txt).acts[0])) + (l.kind === 'granted' ? ' <span class="mid">(granted)</span>' : '') + (l.kind === 'warn' ? ' <b class="bad">!</b>' : ''), cls: l.kind === 'denied' ? 'den' : '' }));
      const st = txns.map(t => {
        const s = f.status[t];
        const phase = s.done ? 'finished' : s.blocked ? `<span class="bad">waiting for ${s.blocked.mode}(${s.blocked.x})</span>` : s.unlocked ? 'shrinking phase' : 'growing phase';
        return `<li><b>T${CC.subs(t)}</b>: ${phase}${s.queue.length ? `; delayed: ${s.queue.join(' ')}` : ''}${s.warn.length ? `; <span class="bad">${s.warn[s.warn.length - 1]}</span>` : ''}</li>`;
      }).join('');
      const wf = f.wf.length ? CC.graphSVG(txns, [...new Map(f.wf.map(e => [e[0] + '>' + e[1], { from: e[0], to: e[1], label: e[2], cls: 'red' }])).values()], { aria: 'waits-for graph' }) : '';
      return {
        html: `<div class="cc-two"><div>${CC.grid(txns, rows, { hi: f.hi.row })}</div><div>${o.matrix !== false && modes[0] !== 'L' ? CC.matrixHTML(modes, f.hi.x ? f.hi : null) : ''}${CC.lockTableHTML(f.table)}<ul class="txs">${st}</ul>${wf ? `<div class="figlabel">waits-for graph (arc T → U: T waits for U)</div>${wf}` : ''}</div></div>`,
        cap: f.cap,
      };
    });
    return { steps, R };
  };
  CC.lockTool = function (sel, initial, o = {}) {
    const host = typeof sel === 'string' ? $(sel) : sel;
    const extra = o.auto ? `<label class="sm">Locks <select data-k="scheme"><option value="none">as written</option><option value="single">insert l / u (one lock type)</option><option value="upgrade">insert S and X (upgrade S→X)</option><option value="xfirst">insert S and X (X up front if it will write)</option><option value="update">insert S, U and X</option></select></label><label class="sm">Unlock <select data-k="release"><option value="end">all at the end (2PL)</option><option value="early">as early as 2PL allows</option><option value="asap">right after last use (may break 2PL)</option></select></label>` : '';
    const ui = form(host, o.label || 'Requests', initial, 'Run the scheduler', extra);
    if (o.scheme) host.querySelector('[data-k=scheme]').value = o.scheme;
    if (o.release) host.querySelector('[data-k=release]').value = o.release;
    const run = () => {
      const p = CC.parse(ui.input.value, ['r', 'w', 'c', 'a', 'l', 'sl', 'xl', 'ul', 'u']);
      if (p.err) { ui.msg.className = 'cc-msg bad'; ui.msg.textContent = p.err; return; }
      if (CC.txnsOf(p.acts).length > 6) { ui.msg.className = 'cc-msg bad'; ui.msg.textContent = 'Use at most 6 transactions.'; return; }
      let acts = p.acts;
      const sch = o.auto ? host.querySelector('[data-k=scheme]').value : 'none';
      if (sch !== 'none') {
        if (acts.some(a => ['l', 'sl', 'xl', 'ul', 'u'].includes(a.op))) { ui.msg.className = 'cc-msg bad'; ui.msg.textContent = 'To let the scheduler insert locks, type only reads, writes and commits (or choose “as written”).'; return; }
        acts = CC.insertLocks(acts, sch, host.querySelector('[data-k=release]').value);
      }
      if (acts.length > 60) { ui.msg.className = 'cc-msg bad'; ui.msg.textContent = 'That is too long; use at most 60 actions.'; return; }
      const { steps, R } = CC.lockSteps(acts, o);
      const cs = CC.csAnalyze(R.executed);
      ui.msg.className = 'cc-msg';
      ui.msg.innerHTML = (sch !== 'none' ? `With locks inserted: <code>${acts.map(a => a.txt).join(' ')}</code><br>` : '') +
        (R.deadlock ? `<b class="bad">Deadlock</b> among ${R.deadlock.cycle.map(t => 'T' + t).join(', ')}. ` : R.stuck.length ? `<b class="bad">Still waiting at the end:</b> ${R.stuck.map(t => 'T' + t).join(', ')}. ` : '') +
        (R.executed.length > 1 && !R.stuck.length ? `Reads and writes executed: <code>${R.executed.map(a => a.txt).join(' ')}</code> — ${cs.cycle ? '<b class="bad">not conflict-serializable</b>' : `conflict-serializable, serial order (${cs.order.map(t => 'T' + t).join(', ')})`}.` : '');
      ui.out.innerHTML = '<div></div>';
      stepper(ui.out.firstChild, steps, { interval: 2300 });
    };
    ui.f.addEventListener('submit', e => { e.preventDefault(); run(); });
    host.querySelectorAll('select').forEach(s => s.addEventListener('change', run));
    run();
  };

  // ---------- Tool 3: timestamp scheduler ----------
  CC.tsSteps = function (acts, opts) {
    const R = CC.tsRun(acts, opts), txns = CC.txnsOf(acts);
    const elems = [...new Set(acts.filter(a => a.x).map(a => a.x))].sort();
    const steps = R.frames.map(f => {
      const rows = f.rows.map(r => ({ t: r.t, html: CC.fmt(CC.parse(r.txt).acts[0]) + (r.note && ['Abort', 'Wait', 'ignored'].some(k => r.note.startsWith(k)) || (r.note || '').startsWith('Skip') ? ` <b class="${r.cls}">${r.note}</b>` : ''), cls: r.cls === 'dim' ? 'dimrow' : '', ex: elems.map(x => r.x === x && r.note && !['Abort', 'Wait', 'ignored'].some(k => r.note.startsWith(k)) && !r.note.startsWith('Skip') ? r.note : (r.note && r.note.includes('C(' + x + ')') ? `C=true` : '')) }));
      const tsHead = Object.fromEntries(txns.map(t => [t, f.ts[t] ?? '?']));
      const stTab = `<table class="tst"><tr><th></th>${opts.multi ? '<th>versions (write time · read time)</th>' : '<th>RT</th><th>WT</th>' + (opts.commitBits !== false ? '<th>C</th>' : '')}</tr>${f.state.map(s => `<tr><th>${s.x}</th>${opts.multi ? `<td>${s.ver.map(v => `${s.x}<sub>${v.wt}</sub>·${v.rt || (v.wt ? '–' : 0)}`).join(', ')}</td>` : `<td>${s.rt}</td><td>${s.wt}</td>${opts.commitBits !== false ? `<td>${s.c ? 'true' : '<span class="bad">false</span>'}</td>` : ''}`}</tr>`).join('')}</table>`;
      const txTab = `<ul class="txs">${txns.map(t => { const s = f.tx[t]; return `<li><b>T${CC.subs(t)}</b> (TS ${f.ts[t] ?? 'not started'}): ${s.status === 'aborted' ? '<span class="bad">rolled back</span>' : s.status === 'waiting' ? `<span class="mid">delayed on ${s.waitOn}</span>${s.queue.length ? ' · queued ' + s.queue.join(' ') : ''}` : s.status}</li>`; }).join('')}</ul>`;
      return { html: `<div class="cc-two"><div>${CC.grid(txns, rows, { ts: tsHead, extra: elems, hi: f.hi })}</div><div>${f.state.length ? stTab : ''}${txTab}</div></div>`, cap: f.cap };
    });
    return { steps, R };
  };
  CC.tsTool = function (sel, initial, o = {}) {
    const host = typeof sel === 'string' ? $(sel) : sel;
    const extra = `<label class="sm">Timestamps <input type="text" data-k="ts" value="${o.ts || ''}" placeholder="T1=200, T2=150 (blank: TS(Ti)=i or start order)" style="min-width:16em"></label>` +
      `<label class="sm"><input type="checkbox" data-k="cb" ${o.commitBits === false ? '' : 'checked'}> use commit bits C(X)</label>` +
      `<label class="sm"><input type="checkbox" data-k="mv" ${o.multi ? 'checked' : ''}> multiversion (MVCC)</label>`;
    const ui = form(host, 'Schedule', initial, 'Run the timestamp scheduler', extra);
    const run = () => {
      const p = CC.parse(ui.input.value, ['r', 'w', 'c', 'a', 'st']);
      if (p.err) { ui.msg.className = 'cc-msg bad'; ui.msg.textContent = p.err; return; }
      if (p.acts.length > 40) { ui.msg.className = 'cc-msg bad'; ui.msg.textContent = 'Use at most 40 actions.'; return; }
      const tsTxt = host.querySelector('[data-k=ts]').value.trim(), ts = {};
      if (tsTxt) for (const part of tsTxt.split(/[,;\s]+/).filter(Boolean)) {
        const m = /^T?(\d+)\s*[=:]\s*(\d+)$/i.exec(part);
        if (!m) { ui.msg.className = 'cc-msg bad'; ui.msg.textContent = `Timestamps: I could not read “${part}”. Write them like T1=200, T2=150.`; return; }
        ts[+m[1]] = +m[2];
      }
      const vals = Object.values(ts);
      if (new Set(vals).size !== vals.length) { ui.msg.className = 'cc-msg bad'; ui.msg.textContent = 'Timestamps must be unique.'; return; }
      const opts = { ts, commitBits: host.querySelector('[data-k=cb]').checked, multi: host.querySelector('[data-k=mv]').checked };
      const { steps, R } = CC.tsSteps(p.acts, opts);
      const ab = Object.entries(R.tx).filter(([, s]) => s.status === 'aborted').map(([t]) => 'T' + t), wt = Object.entries(R.tx).filter(([, s]) => s.status === 'waiting').map(([t]) => 'T' + t);
      ui.msg.className = 'cc-msg';
      ui.msg.innerHTML = `Rolled back: <b>${ab.length ? ab.join(', ') : 'none'}</b>.${wt.length ? ` Still delayed at the end: <b>${wt.join(', ')}</b> (they wait for a commit that never comes in this schedule).` : ''}`;
      ui.out.innerHTML = '<div></div>';
      stepper(ui.out.firstChild, steps, { interval: 2300 });
    };
    ui.f.addEventListener('submit', e => { e.preventDefault(); run(); });
    host.querySelectorAll('input[type=checkbox]').forEach(s => s.addEventListener('change', run));
    run();
  };
}
