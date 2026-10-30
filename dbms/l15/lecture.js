// Lec 15: B+ tree insertion and deletion for any fan-out n (Silberschatz algorithms),
// a general-n renderer, and an interactive animator built on stepper() from book.js.
// Node: {k: [keys], c: [children]}; a node without c is a leaf. Leaves are chained left to right.

// keys compare as numbers when both look numeric, otherwise as text
function bptCmp(a, b) {
  const x = Number(a), y = Number(b);
  if (a !== '' && b !== '' && !isNaN(x) && !isNaN(y)) return x - y;
  return a < b ? -1 : a > b ? 1 : 0;
}
const bptClone = t => t && JSON.parse(JSON.stringify(t));
const bptList = ks => '[' + ks.join(', ') + ']';
const bptLeafMin = n => Math.ceil((n - 1) / 2);
const bptPtrMin = n => Math.ceil(n / 2);

// root-to-leaf path for key v (equal keys go right, as in find(v))
function bptPath(root, v) {
  const path = [root];
  let C = root;
  while (C.c) {
    let i = 0;
    while (i < C.k.length && bptCmp(v, C.k[i]) >= 0) i++;
    C = C.c[i]; path.push(C);
  }
  return path;
}

// Run a list of operations [{op: 'insert'|'delete', key}] on a copy of start.
// opts.pref: 'merge' (Silberschatz: use the left sibling if there is one, coalesce if both fit, else borrow)
//            'borrow' (borrow from a sibling that can spare a key, merge only if neither can).
// Returns {root, frames: [{tree, cap, op}], log: [messages]}.
function bptRun(start, n, ops, opts = {}) {
  const pref = opts.pref || 'merge';
  let root = bptClone(start) || null;
  const frames = [], marked = [];
  let curOp = '', pending = '';
  const mark = (node, cls, key) => { if (!node) return; node.hl = cls; if (key !== undefined) node.hk = key; marked.push(node); };
  const snap = cap => {
    frames.push({ tree: bptClone(root), cap: (pending ? pending + ' ' : '') + cap, op: curOp });
    pending = '';
    for (const m of marked) { delete m.hl; delete m.hk; }
    marked.length = 0;
  };
  const L = bptList;

  function insertInParent(path, i, N, K, N2) {
    if (i === 0) {
      root = { k: [K], c: [N, N2] };
      mark(root, 'new', K); mark(N, 'hl'); mark(N2, 'new');
      snap(`[${N.k.join(', ')}] was the root, so there is no parent to receive ${K}. A <b>new root</b> ${L(root.k)} is created with two children. The tree grows one level taller, at the top, so every leaf stays at the same depth.`);
      return;
    }
    const P = path[i - 1], j = P.c.indexOf(N);
    P.k.splice(j, 0, K); P.c.splice(j + 1, 0, N2);
    if (P.c.length <= n) {
      mark(P, 'hl', K); mark(N2, 'new');
      snap(`Insert ${K} and a pointer to the new node into the parent, which becomes ${L(P.k)} with ${P.c.length} pointers. That is within the limit of n = ${n} pointers, so the insertion is finished.`);
      return;
    }
    mark(P, 'del', K); mark(N2, 'new');
    snap(`Insert ${K} into the parent: it becomes ${L(P.k)} with ${P.c.length} pointers, one more than n = ${n}. <b>The internal node overflows</b> and must split too.`);
    const m = Math.ceil((n + 1) / 2), up = P.k[m - 1];
    const R = { k: P.k.slice(m), c: P.c.slice(m) };
    P.k = P.k.slice(0, m - 1); P.c = P.c.slice(0, m);
    const why = `Split the internal node: the first ⌈(n+1)/2⌉ = ${m} pointers stay in ${L(P.k)}, the other ${R.c.length} move to a new node ${L(R.k)}. The middle key <b>${up} is pushed up</b> (moved, not copied): it no longer appears at this level, because an internal node with k pointers needs only k − 1 keys.`;
    pending = why;
    insertInParent(path, i - 1, P, up, R);
  }

  function insert(key) {
    curOp = `insert ${key}`;
    if (!root) { root = { k: [key] }; mark(root, 'new', key); snap(`The tree is empty. Create one leaf holding ${key}. This leaf is also the root.`); return; }
    const path = bptPath(root, key), leaf = path[path.length - 1];
    if (leaf.k.some(x => bptCmp(x, key) === 0)) { mark(leaf, 'del', key); snap(`${key} is already in the tree (leaf ${L(leaf.k)}). This index assumes unique keys, so the insert is skipped.`); return; }
    path.forEach(p => mark(p, 'path'));
    snap(`<b>Insert ${key}.</b> First search for it as find(${key}) would: ${path.map(p => L(p.k)).join(' → ')}. The key belongs in leaf ${L(leaf.k)}.`);
    let pos = 0; while (pos < leaf.k.length && bptCmp(leaf.k[pos], key) < 0) pos++;
    leaf.k.splice(pos, 0, key);
    if (leaf.k.length <= n - 1) {
      mark(leaf, 'hl', key);
      snap(`The leaf has room (at most n − 1 = ${n - 1} keys), so put ${key} in its sorted place: ${L(leaf.k)}. Done, no split.`);
      return;
    }
    mark(leaf, 'del', key);
    snap(`Put ${key} in sorted place: ${L(leaf.k)} now has ${leaf.k.length} keys, but a leaf holds at most n − 1 = ${n - 1}. <b>The leaf overflows</b> and must split.`);
    const m = Math.ceil(n / 2), R = { k: leaf.k.slice(m) };
    leaf.k = leaf.k.slice(0, m);
    const sep = R.k[0];
    pending = `Split the leaf: the first ⌈n/2⌉ = ${m} keys stay in ${L(leaf.k)}, the rest move to a new leaf ${L(R.k)} (linked into the leaf chain right after it). The smallest key of the new leaf, <b>${sep}, is copied up</b> to the parent. It stays in the leaf too, because every key must remain at the leaf level.`;
    insertInParent(path, path.length - 1, leaf, sep, R);
  }

  const size = N => N.c ? N.c.length : N.k.length;
  const minOf = (N, isRoot) => isRoot ? (N.c ? 2 : 0) : N.c ? bptPtrMin(n) : bptLeafMin(n);
  const unit = N => (N.c ? 'pointer' : 'key') + (size(N) === 1 ? '' : 's');

  function fix(path, i) {
    const N = path[i];
    if (i === 0) {
      if (N.c && N.c.length === 1) {
        root = N.c[0]; mark(root, 'hl');
        snap(`The root has lost its last key and now has only one child, so it is useless: delete it and make that child the new root. <b>The tree gets one level shorter.</b>`);
      } else if (!N.c && N.k.length === 0) {
        root = null; snap('The last key is gone. The tree is now empty.');
      } else { mark(N, 'hl'); snap(`The root may hold as few as ${N.c ? '2 pointers' : '0 keys'}, so ${L(N.k)} is fine. Done.`); }
      return;
    }
    const mn = minOf(N, false);
    if (size(N) >= mn) {
      mark(N, 'hl');
      snap(`${N.c ? 'The internal node' : 'The leaf'} ${L(N.k)} still has ${size(N)} ${unit(N)} (minimum ${mn}), so there is no underflow. Done.`);
      return;
    }
    const P = path[i - 1], j = P.c.indexOf(N);
    const left = j > 0 ? P.c[j - 1] : null, right = j < P.c.length - 1 ? P.c[j + 1] : null;
    const fits = (A, B) => N.c ? A.c.length + B.c.length <= n : A.k.length + B.k.length <= n - 1;
    const canLend = S => size(S) > mn;
    mark(N, 'del');
    snap(`${N.c ? 'The internal node' : 'The leaf'} ${L(N.k)} has only ${size(N)} ${unit(N)}, below the minimum of ${mn} (${N.c ? `⌈n/2⌉ = ${mn} pointers` : `⌈(n−1)/2⌉ = ${mn} keys`}). <b>Underflow.</b> Look at a sibling under the same parent ${L(P.k)}.`);
    let act, S;
    if (pref === 'merge') { S = left || right; act = fits(N, S) ? 'merge' : 'borrow'; }
    else if (left && canLend(left)) { S = left; act = 'borrow'; }
    else if (right && canLend(right)) { S = right; act = 'borrow'; }
    else { S = left || right; act = 'merge'; }
    const side = S === left ? 'left' : 'right';
    if (act === 'merge') {
      const A = S === left ? S : N, B = S === left ? N : S, ki = P.c.indexOf(A), Kp = P.k[ki];
      const before = `${L(A.k)} and ${L(B.k)}`, sib = L(S.k);
      if (N.c) { A.k = A.k.concat([Kp], B.k); A.c = A.c.concat(B.c); } else A.k = A.k.concat(B.k);
      P.k.splice(ki, 1); P.c.splice(ki + 1, 1);
      mark(A, 'new'); mark(P, 'hl');
      snap(`The ${side} sibling is ${sib}. ${pref === 'merge' ? `Together with this node it fits in one node (at most ${N.c ? `n = ${n} pointers` : `n − 1 = ${n - 1} keys`}), so` : `No sibling can spare ${N.c ? 'a pointer' : 'a key'} without underflowing itself, so`} <b>coalesce (merge)</b> ${before} into ${L(A.k)}. ` +
        (N.c ? `For internal nodes the separator ${Kp} is <b>pulled down</b> from the parent into the merged node, between the two halves.` : `The leaf chain skips the removed leaf.`) +
        ` The parent loses separator ${Kp} and one pointer: it is now ${L(P.k)}. Check the parent next.`);
      fix(path, i - 1);
      return;
    }
    // redistribution
    if (S === left) {
      const ki = j - 1;
      if (N.c) { const c = S.c.pop(), kk = S.k.pop(); N.c.unshift(c); N.k.unshift(P.k[ki]); P.k[ki] = kk;
        mark(N, 'new'); mark(S, 'hl'); mark(P, 'hl', kk);
        snap(`${pref === 'merge' ? `The left sibling and this node do not fit in one node, so <b>redistribute</b>` : `The left sibling has a spare pointer, so <b>borrow</b> from it`}: its last pointer moves over, the old separator ${N.k[0]} comes down from the parent as this node's first key, and the sibling's last key <b>${kk} goes up</b> to replace it.`);
      } else { const x = S.k.pop(); N.k.unshift(x); P.k[ki] = x;
        mark(N, 'new', x); mark(S, 'hl'); mark(P, 'hl', x);
        snap(`${pref === 'merge' ? `The left sibling and this leaf do not fit in one leaf (more than n − 1 = ${n - 1} keys), so <b>redistribute</b>` : `The left sibling ${L(S.k.concat([x]))} can spare a key, so <b>borrow</b> from it`}: move its largest key ${x} into this leaf → ${L(N.k)}. The separator in the parent must now be the new smallest key of this leaf, so it becomes <b>${x}</b>.`);
      }
    } else {
      const ki = j;
      if (N.c) { const c = S.c.shift(), kk = S.k.shift(); N.c.push(c); N.k.push(P.k[ki]); P.k[ki] = kk;
        mark(N, 'new'); mark(S, 'hl'); mark(P, 'hl', kk);
        snap(`${pref === 'merge' ? `The right sibling and this node do not fit in one node, so <b>redistribute</b>` : `The right sibling has a spare pointer, so <b>borrow</b> from it`}: its first pointer moves over, the old separator ${N.k[N.k.length - 1]} comes down from the parent as this node's last key, and the sibling's first key <b>${kk} goes up</b> to replace it.`);
      } else { const x = S.k.shift(); N.k.push(x); P.k[ki] = S.k[0];
        mark(N, 'new', x); mark(S, 'hl'); mark(P, 'hl', S.k[0]);
        snap(`${pref === 'merge' ? `The right sibling and this leaf do not fit in one leaf (more than n − 1 = ${n - 1} keys), so <b>redistribute</b>` : `The right sibling ${L([x].concat(S.k))} can spare a key, so <b>borrow</b> from it`}: move its smallest key ${x} into this leaf → ${L(N.k)}. The separator between them must be the right sibling's new smallest key, so it becomes <b>${S.k[0]}</b>.`);
      }
    }
  }

  function del(key) {
    curOp = `delete ${key}`;
    if (!root) { snap(`The tree is empty, so there is no ${key} to delete.`); return; }
    const path = bptPath(root, key), leaf = path[path.length - 1];
    const pos = leaf.k.findIndex(x => bptCmp(x, key) === 0);
    path.forEach(p => mark(p, 'path'));
    if (pos < 0) { mark(leaf, 'del'); snap(`<b>Delete ${key}.</b> The search ends at leaf ${L(leaf.k)}, which does not contain ${key}. Nothing to delete.`); return; }
    mark(leaf, 'path', key);
    snap(`<b>Delete ${key}.</b> Search for it: ${path.map(p => L(p.k)).join(' → ')}. It is in leaf ${L(leaf.k)}.`);
    leaf.k.splice(pos, 1);
    pending = `Remove ${key} from the leaf, leaving ${L(leaf.k)}.`;
    if (path.slice(0, -1).some(p => p.k.some(x => bptCmp(x, key) === 0)))
      pending += ` (${key} also appears as a separator in an internal node. Silberschatz leaves it there: it still separates the subtrees correctly, because everything to its right is still ≥ ${key}. Many exam answers replace it with the new smallest key on its right. Both are accepted.)`;
    fix(path, path.length - 1);
  }

  for (const o of ops) o.op === 'delete' ? del(o.key) : insert(o.key);
  return { root, frames };
}

// Parse "insert 2 3 5 delete 23" / "+2 +3 -23" / "2, 3, 5". Returns {ops} or {error}.
function bptParse(text) {
  const toks = text.replace(/[,;]/g, ' ').trim().split(/\s+/).filter(Boolean);
  let mode = 'insert'; const ops = [];
  for (const t of toks) {
    const w = t.toLowerCase();
    if (/^(insert|ins|add|i)$/.test(w)) { mode = 'insert'; continue; }
    if (/^(delete|del|remove|rem|d)$/.test(w)) { mode = 'delete'; continue; }
    let op = mode, key = t;
    if (t[0] === '+' || t[0] === '-') { op = t[0] === '+' ? 'insert' : 'delete'; key = t.slice(1); }
    if (!/^[A-Za-z0-9_.]{1,12}$/.test(key)) return { error: `“${t}” is not a key I understand. Use numbers or short names (letters, digits, _ or .), separated by spaces or commas.` };
    ops.push({ op, key });
  }
  if (!ops.length) return { error: 'Type at least one key, for example: insert 2 3 5 7 11 delete 3' };
  if (ops.length > 80) return { error: 'That is a lot of operations. Please use at most 80 at a time.' };
  return { ops };
}

// ---------- renderer for any n ----------
function bptSVG(root, n, o = {}) {
  if (!root) return `<svg viewBox="0 0 300 60" width="300" role="img" aria-label="empty tree"><text x="10" y="34" class="lbl">(empty tree)</text></svg>`;
  const all = [];
  (function walk(t, d) { t._d = d; all.push(t); (t.c || []).forEach(c => walk(c, d + 1)); })(root, 0);
  const maxLen = Math.max(2, ...all.flatMap(t => t.k.map(x => String(x).length)));
  const KW = Math.max(28, maxLen * 8 + 10), PW = 8, NH = 26, LV = o.lv || 84, GAP = 14;
  const slots = t => Math.max(n - 1, t.k.length);
  const nw = t => slots(t) * KW + (slots(t) + 1) * PW;
  const width = t => t._w = t.c ? Math.max(nw(t), t.c.map(width).reduce((a, b) => a + b, 0) + GAP * (t.c.length - 1)) : nw(t);
  const W0 = width(root);
  (function place(t, x0) {
    if (t.c) {
      const inner = t.c.reduce((a, c) => a + c._w, 0) + GAP * (t.c.length - 1);
      let x = x0 + (t._w - inner) / 2;
      t.c.forEach(c => { place(c, x); x += c._w + GAP; });
      const mid = (t.c[0]._x + nw(t.c[0]) / 2 + t.c[t.c.length - 1]._x + nw(t.c[t.c.length - 1]) / 2) / 2;
      t._x = Math.max(x0, Math.min(x0 + t._w - nw(t), mid - nw(t) / 2));
    } else t._x = x0 + (t._w - nw(t)) / 2;
    t._y = 12 + t._d * LV;
  })(root, 10);
  let e = '', s = '';
  const leaves = all.filter(t => !t.c);
  for (const t of all) {
    const k = slots(t), cls = { hl: 'cell-hl', new: 'cell-new', del: 'cell-del', path: 'cell-path' }[t.hl] || 'cell';
    for (let i = 0; i <= k; i++) {
      const px = t._x + i * (KW + PW);
      s += `<rect class="cell-plain" x="${px}" y="${t._y}" width="${PW}" height="${NH}"/>`;
      if (i < k) {
        const key = t.k[i];
        const kc = key === undefined ? 'cell-plain' : (t.hk !== undefined && bptCmp(String(t.hk), String(key)) === 0) ? 'cell-cmp' : cls;
        s += `<rect class="${kc}" x="${px + PW}" y="${t._y}" width="${KW}" height="${NH}"/>`;
        if (key !== undefined) s += `<text x="${px + PW + KW / 2}" y="${t._y + 17}" text-anchor="middle" style="font-size:12px">${key}</text>`;
      }
    }
    if (t.hl === 'del') s += `<rect x="${t._x - 3}" y="${t._y - 3}" width="${nw(t) + 6}" height="${NH + 6}" rx="3" class="s-red" style="stroke-width:2.5"/>`;
    if (t.hl === 'new') s += `<rect x="${t._x - 3}" y="${t._y - 3}" width="${nw(t) + 6}" height="${NH + 6}" rx="3" class="s-grn" style="stroke-width:2.5"/>`;
    if (t.c) t.c.forEach((c, j) => {
      const sx = t._x + j * (KW + PW) + PW / 2;
      e += `<path d="M${sx} ${t._y + NH} L${c._x + nw(c) / 2} ${c._y - 2}" class="s-fg" marker-end="url(#m-fg)"/>`;
    });
  }
  if (!o.noChain) leaves.forEach((l, i) => {
    const nx = leaves[i + 1]; if (!nx) return;
    e += `<path d="M${l._x + nw(l) - PW / 2} ${l._y + NH / 2} H${nx._x - 2}" class="s-acc" marker-end="url(#m-acc)"/>`;
  });
  const depth = Math.max(...all.map(t => t._d));
  const W = W0 + 20, H = 12 + depth * LV + NH + 10;
  for (const t of all) { delete t._d; delete t._w; delete t._x; delete t._y; }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" style="max-width:100%;height:auto;display:block;margin:0 auto" role="img" aria-label="${o.aria || 'B+ tree with n = ' + n}">${e}${s}</svg>`;
}

// Static figure of the tree after running ops (used for worked answers).
function bptFigure(sel, start, n, opsText, pref, o) {
  const r = bptRun(start, n, opsText ? bptParse(opsText).ops : [], { pref });
  document.querySelector(sel).innerHTML = bptSVG(r.root, n, o);
  return r.root;
}
// A column of labelled static figures: stages = [[label, cumulative ops text], ...]
function bptStages(sel, start, n, stages, pref) {
  document.querySelector(sel).innerHTML = stages.map(([lab, ops]) => {
    const r = bptRun(start, n, ops ? bptParse(ops).ops : [], { pref });
    return `<div class="figlabel" style="text-align:left;margin-top:12px">${lab}</div>${bptSVG(r.root, n)}`;
  }).join('');
}

// ---------- interactive animator ----------
// o = {n, ops (text), start (tree or null), startLabel, pref}
function bptTool(sel, o = {}) {
  const host = document.querySelector(sel), id = host.id || 'bpt';
  const nOpts = [3, 4, 5, 6, 7, 8].map(v => `<option value="${v}"${v === (o.n || 4) ? ' selected' : ''}>${v}</option>`).join('');
  host.innerHTML = `<form class="bp-form bpt-form">
      <label>n (max pointers per node) <select id="${id}-n">${nOpts}</select></label>
      <label>Underflow rule <select id="${id}-p"><option value="merge">merge first (Silberschatz)</option><option value="borrow"${o.pref === 'borrow' ? ' selected' : ''}>borrow first</option></select></label>
      ${o.start ? `<label><input type="checkbox" id="${id}-s" checked style="width:auto"> start from ${o.startLabel || 'the given tree'}</label>` : ''}
      <label style="flex:1 1 100%">Operations <input type="text" id="${id}-o" value="${o.ops || ''}" autocomplete="off" spellcheck="false" style="width:100%;max-width:none" aria-label="operations"></label>
      <button type="submit">Animate</button>
    </form>
    <p class="bpt-help" style="font-size:.88rem;color:var(--muted);margin:.2em 0 .8em">Type keys to insert, and “delete” before keys to delete: <code>insert 2 3 5 7 delete 3</code>. You can also write <code>+8 +9 -8</code>. Keys may be numbers or short names.</p>
    <div class="bpt-msg ask-r bad" aria-live="polite"></div><div class="bpt-st"></div>`;
  const msg = host.querySelector('.bpt-msg');
  const run = () => {
    const n = +host.querySelector(`#${id}-n`).value, pref = host.querySelector(`#${id}-p`).value;
    const p = bptParse(host.querySelector(`#${id}-o`).value);
    if (p.error) { msg.textContent = p.error; return; }
    msg.textContent = '';
    const useStart = o.start && host.querySelector(`#${id}-s`).checked;
    const start = useStart ? o.start : null;
    if (useStart && n !== o.n) { msg.textContent = `The given tree was built with n = ${o.n}. Untick “start from …” to use a different n.`; return; }
    const r = bptRun(start, n, p.ops, { pref });
    const steps = [{ html: `<div>${bptSVG(start, n)}</div>`, cap: `${start ? 'The starting tree' : 'An empty tree'}, n = ${n}: leaves hold ${bptLeafMin(n)} to ${n - 1} keys, internal nodes ${bptPtrMin(n)} to ${n} pointers (the root may have fewer). ${p.ops.length} operation${p.ops.length > 1 ? 's' : ''} to run. Press Next or Play.` }]
      .concat(r.frames.map(f => ({ html: `<div>${bptSVG(f.tree, n)}</div>`, cap: `<span style="font:600 12px var(--mono);color:var(--accent)">${f.op}</span> · ${f.cap}` })));
    stepper(host.querySelector('.bpt-st'), steps, { interval: 2600 });
  };
  host.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); run(); });
  run();
}

if (typeof module !== 'undefined') module.exports = { bptRun, bptParse, bptSVG, bptCmp, bptPath, bptLeafMin, bptPtrMin };
