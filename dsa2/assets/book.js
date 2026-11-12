// Web book shell (table of contents + prev/next) and learning widgets for CSE 207.
// BOOK.parts is the table of contents: [file, title, tag]. Add every chapter here.
const BOOK = {
  parts: [
    { group: 'Start here' },
    { title: 'Plan', chapters: [
      ['start/01-exam-map.html', 'What the exam asks, and how to answer it', 'start'],
      ['plan.html', 'The 4-day plan (with progress)', 'plan'],
      ['last-night.html', 'Last-night plan and sheet', 'plan'],
    ] },
    { group: 'Part 1 · Monirul Islam sir' },
    { title: 'Minimum spanning trees', chapters: [
      ['graph/01-mst.html', 'Cut property, Kruskal, Prim, uniqueness', 'L1–3'],
    ] },
    { title: 'Shortest paths', chapters: [
      ['graph/02-bellman-dag.html', 'Relaxation, Bellman-Ford, DAG', 'L4–7'],
      ['graph/03-dijkstra.html', 'Dijkstra: trace, proof, variants', 'L8'],
      ['graph/04-apsp.html', 'Matrix squaring, Floyd-Warshall, closure', 'L9–12'],
      ['graph/05-johnson.html', 'Johnson\'s algorithm', 'L12'],
    ] },
    { title: 'Maximum flow', chapters: [
      ['graph/06-flow.html', 'Flow networks, residuals, Ford-Fulkerson', 'L13–15'],
      ['graph/07-mincut-ek.html', 'Max-flow min-cut, Edmonds-Karp', 'L16–17'],
      ['graph/08-matching-modelling.html', 'Bipartite matching and modelling', 'L18'],
    ] },
    { title: 'Balanced trees (start here if RB is new)', chapters: [
      ['tree/01-rotations-avl.html', 'Rotations and AVL trees', 'L18'],
      ['tree/02-rb-properties.html', 'Red-black trees from zero', 'L19'],
      ['tree/03-rb-insert.html', 'RB insertion: the 3 cases', 'must'],
      ['tree/04-rb-delete.html', 'RB deletion: the 4 cases', 'must'],
      ['tree/05-rb-gauntlet.html', 'RB gauntlet: full exam runs', 'drill'],
      ['tree/06-splay.html', 'Splay trees', 'out of syllabus'],
    ] },
    { group: 'Part 2 · Bayzid sir' },
    { title: 'Hashing', chapters: [
      ['heap/01-hashing.html', 'Chaining and open addressing', 'L1–3'],
    ] },
    { title: 'Advanced heaps', chapters: [
      ['heap/02-binomial-trees.html', 'Binomial trees and their proofs', 'L4'],
      ['heap/03-binomial-heap.html', 'Binomial heap operations', 'L5–6'],
      ['heap/04-fibonacci.html', 'Fibonacci heap', 'L7–8'],
      ['heap/05-amortized.html', 'Potential method and damaged trees', 'L8'],
    ] },
    { title: 'Hard problems', chapters: [
      ['np/01-classes.html', 'P, NP, co-NP, NP-complete', 'L9–12'],
      ['np/02-reductions.html', 'Reductions, with proof templates', 'L13'],
      ['np/03-backtracking.html', 'Backtracking state-space trees', 'L14'],
      ['np/04-branch-bound.html', 'Branch and bound; TSP by DP', 'L14'],
      ['np/05-randomized.html', 'Randomized quicksort, Monte Carlo, Karger', 'L15–16'],
      ['np/06-approximation.html', 'Approximation algorithms', 'L17'],
    ] },
    { group: 'Exam' },
    { title: 'Past papers, solved', chapters: [
      ['exam/2024-25.html', 'Term final 2024–25', 'TF'],
      ['exam/2023-24.html', 'Term final 2023–24', 'TF'],
      ['exam/2022-23.html', 'Term final 2022–23', 'TF'],
      ['exam/2021-22.html', 'Term final 2021–22', 'TF'],
      ['exam/2020-21.html', 'Term final 2020–21', 'TF'],
      ['exam/2019-20.html', 'Term final 2019–20', 'TF'],
      ['exam/2018-19.html', 'Term final 2018–19', 'TF'],
      ['exam/2017-18.html', 'Term final 2017–18', 'TF'],
      ['exam/ct.html', 'Class tests', 'CT'],
    ] },
  ],
};
const $ = s => document.querySelector(s);

(function shell() {
  // the book root is wherever assets/book.js lives, so pages work from any sub-folder
  const rootURL = new URL('..', document.currentScript.src).href;
  const here = location.href.split(/[?#]/)[0].slice(rootURL.length);
  const root = rootURL;
  const flat = BOOK.parts.flatMap(p => p.chapters || []);
  const idx = flat.findIndex(c => c[0] === here);

  const toc = () => {
    let h = `<a class="home" href="${root}index.html">CSE 207 Notes</a>`;
    for (const p of BOOK.parts) {
      if (p.group) { h += `<div class="group">${p.group}</div>`; continue; }
      const open = p.chapters.some(c => c[0] === here);
      h += `<details class="part-d"${open ? ' open' : ''}><summary class="part">${p.title}</summary>`;
      for (const [f, t, s] of p.chapters)
        h += `<a href="${root}${f}"${f === here ? ' class="here" aria-current="page"' : ''}>${t} <span class="slides">${s}</span></a>`;
      h += '</details>';
    }
    return h;
  };
  const main = document.querySelector('main');
  if (!main || document.body.dataset.noshell !== undefined) return;
  const shell = document.createElement('div');
  shell.className = 'shell';
  shell.innerHTML = `<nav class="toc" aria-label="Contents">${toc()}</nav><div class="content"></div>`;
  const content = shell.querySelector('.content');
  const m = document.createElement('details');
  m.className = 'mtoc';
  m.innerHTML = `<summary>Contents</summary><nav class="toc" aria-label="Contents">${toc()}</nav>`;
  document.body.prepend(m);
  main.replaceWith(shell);
  content.append(main);

  // sidebar: hide/show (button or the \\ key) and drag the right edge to resize; both remembered in this browser
  const nav = shell.querySelector('nav.toc'), KEY = 'cse207-sidebar';
  let st = { w: 280, off: false };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY)) || {}); } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
  const tg = document.createElement('button'), grip = document.createElement('div');
  tg.type = 'button'; tg.className = 'toc-toggle';
  grip.className = 'toc-grip'; grip.title = 'Drag to resize the contents · double-click to reset';
  const apply = () => {
    shell.style.setProperty('--toc-w', st.w + 'px');
    shell.classList.toggle('toc-off', st.off);
    tg.textContent = st.off ? '☰' : '«';
    tg.title = (st.off ? 'Show contents' : 'Hide contents') + ' (shortcut: \\)';
    tg.setAttribute('aria-label', tg.title); tg.setAttribute('aria-expanded', String(!st.off));
  };
  const flip = () => { st.off = !st.off; save(); apply(); };
  tg.addEventListener('click', flip);
  grip.addEventListener('pointerdown', e => {
    e.preventDefault(); grip.setPointerCapture(e.pointerId); grip.classList.add('drag');
    const move = ev => { st.w = Math.round(Math.max(180, Math.min(520, ev.clientX))); shell.style.setProperty('--toc-w', st.w + 'px'); };
    const up = () => { grip.classList.remove('drag'); grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); save(); };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
  });
  grip.addEventListener('dblclick', () => { st.w = 280; save(); apply(); });
  document.addEventListener('keydown', e => {
    if (e.key !== '\\' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
    flip();
  });
  shell.prepend(tg); shell.append(grip); apply();
  const cur = nav.querySelector('a.here'); // keep the open chapter in view inside the sidebar
  if (cur) nav.scrollTop = cur.offsetTop - nav.clientHeight / 3;

  if (idx >= 0) {
    const prev = flat[idx - 1], next = flat[idx + 1];
    const pg = document.createElement('div');
    pg.className = 'pager';
    pg.innerHTML = (prev ? `<a href="${root}${prev[0]}"><small>← Previous</small>${prev[1]}</a>` : '<span></span>') +
                   (next ? `<a class="next" href="${root}${next[0]}"><small>Next →</small>${next[1]}</a>` : '');
    main.append(pg);
  }
})();

// ---------- shared arrow markers (one copy per page, referenced by every SVG) ----------
(function markers() {
  const mk = (id, c) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--${c})"/></marker>`;
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  d.setAttribute('aria-hidden', 'true');
  d.innerHTML = `<svg width="0" height="0"><defs>${mk('ah', 'accent')}${mk('ahr', 'red')}${mk('m-fg', 'fg')}${mk('m-red', 'red')}${mk('m-acc', 'accent')}${mk('m-grn', 'green')}</defs></svg>`;
  document.body.prepend(d);
})();

// ---------- step-through animation player ----------
// steps: [{html, cap}] (html may be a function). Frames are stacked in one grid cell so the
// figure keeps the height of its tallest frame and frames cross-fade.
function stepper(sel, steps, { interval = 1900 } = {}) {
  const host = typeof sel === 'string' ? $(sel) : sel;
  host.classList.add('stepper');
  host.innerHTML = `<div class="st-stage">${steps.map((s, i) =>
      `<div class="st-frame" data-i="${i}">${typeof s.html === 'function' ? s.html() : s.html}</div>`).join('')}</div>
    <div class="st-cap" aria-live="polite"></div>
    <div class="st-ctl">
      <button type="button" data-a="first" title="Back to the start">⏮</button>
      <button type="button" data-a="prev">◀ Prev</button>
      <span class="st-count"></span>
      <button type="button" data-a="next">Next ▶</button>
      <button type="button" data-a="play">▶ Play</button>
    </div>`;
  const frames = host.querySelectorAll('.st-frame'), cap = host.querySelector('.st-cap'),
        count = host.querySelector('.st-count'), btn = a => host.querySelector(`[data-a="${a}"]`);
  // ?step=N opens every animation on the page at step N (clamped)
  let i = Math.min(steps.length - 1, Math.max(0, (+new URLSearchParams(location.search).get('step') || 1) - 1)), timer = null;
  const show = () => {
    frames.forEach((f, k) => f.classList.toggle('on', k === i));
    cap.innerHTML = steps[i].cap || '';
    count.textContent = `Step ${i + 1} of ${steps.length}`;
    btn('prev').disabled = btn('first').disabled = i === 0;
    btn('next').disabled = i === steps.length - 1;
  };
  const stop = () => { clearInterval(timer); timer = null; btn('play').textContent = '▶ Play'; };
  host.querySelector('.st-ctl').addEventListener('click', e => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return;
    if (a === 'play') {
      if (timer) return stop();
      if (i === steps.length - 1) i = 0;
      btn('play').textContent = '⏸ Pause';
      timer = setInterval(() => { if (i < steps.length - 1) { i++; show(); } else stop(); }, interval);
    } else {
      stop();
      if (a === 'next' && i < steps.length - 1) i++;
      if (a === 'prev' && i > 0) i--;
      if (a === 'first') i = 0;
    }
    show();
  });
  host.tabIndex = 0;
  host.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') btn('next').click();
    if (e.key === 'ArrowLeft') btn('prev').click();
  });
  show();
  return host;
}


// ---------- learning components ----------
// Multiple-choice self-check with instant feedback and a running score.
// items: [{q, opts: [html...], a: correctIndex, why: html}]
function quiz(sel, items) {
  const host = $(sel);
  host.classList.add('quiz');
  let right = 0, done = 0;
  host.innerHTML = `<div class="qz-score" aria-live="polite">Score: 0 / ${items.length}</div>` + items.map((it, k) =>
    `<div class="qz-item" data-k="${k}"><div class="qz-q"><span class="qz-n">${k + 1}</span>${it.q}</div>
      <div class="qz-opts">${it.opts.map((o, j) => `<button type="button" class="qz-opt" data-j="${j}">${o}</button>`).join('')}</div>
      <div class="qz-why" hidden></div></div>`).join('');
  host.addEventListener('click', e => {
    const b = e.target.closest('.qz-opt'); if (!b) return;
    const item = b.closest('.qz-item'), it = items[+item.dataset.k];
    if (item.dataset.done) return;
    item.dataset.done = 1; done++;
    const ok = +b.dataset.j === it.a; if (ok) right++;
    item.querySelectorAll('.qz-opt').forEach((o, j) => { o.disabled = true; if (j === it.a) o.classList.add('ok'); });
    if (!ok) b.classList.add('bad');
    const why = item.querySelector('.qz-why');
    why.innerHTML = `<b>${ok ? 'Correct.' : 'Not quite.'}</b> ${it.why || ''}`; why.hidden = false;
    host.querySelector('.qz-score').textContent = `Score: ${right} / ${items.length}${done === items.length ? (right === items.length ? ' · all correct' : ' · review the explanations above') : ''}`;
  });
}

// Type-in answer checker. spec: {q, a: number | string | [strings] | (input)=>bool, tol, why, hint}
function ask(sel, spec) {
  const host = $(sel), id = host.id || ('ask' + Math.random().toString(36).slice(2));
  host.classList.add('ask');
  host.innerHTML = `<div class="ask-q">${spec.q}</div><form class="ask-f"><input type="text" id="${id}-in" autocomplete="off" spellcheck="false" aria-label="Your answer">
    <button type="submit">Check</button>${spec.hint ? '<button type="button" data-h>Hint</button>' : ''}<button type="button" data-s>Show answer</button></form><div class="ask-r" aria-live="polite"></div>`;
  const out = host.querySelector('.ask-r'), norm = x => String(x).toLowerCase().replace(/\s+/g, '').replace(/[{}()\[\]]/g, '');
  const check = v => typeof spec.a === 'function' ? spec.a(v)
    : typeof spec.a === 'number' ? Math.abs(parseFloat(v.replace(/,/g, '')) - spec.a) <= (spec.tol ?? 1e-9)
    : [].concat(spec.a).some(x => norm(x) === norm(v));
  host.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const v = host.querySelector('input').value; if (!v.trim()) return;
    const ok = check(v);
    out.className = 'ask-r ' + (ok ? 'ok' : 'bad');
    out.innerHTML = ok ? `<b>Correct.</b> ${spec.why || ''}` : '<b>Not yet.</b> Try again, use the hint, or show the answer.';
  });
  host.querySelector('[data-s]').addEventListener('click', () => { out.className = 'ask-r show'; out.innerHTML = `<b>Answer:</b> ${spec.show ?? spec.a}. ${spec.why || ''}`; });
  host.querySelector('[data-h]')?.addEventListener('click', () => { out.className = 'ask-r show'; out.innerHTML = `<b>Hint:</b> ${spec.hint}`; });
}

// Flip cards for terms. cards: [{f: front html, b: back html}]
function flashcards(sel, cards) {
  const host = $(sel);
  host.classList.add('cards');
  host.innerHTML = cards.map((c, i) => `<button type="button" class="card" aria-pressed="false"><span class="card-f">${c.f}</span><span class="card-b">${c.b}</span></button>`).join('') +
    '<p class="cards-tip">Click a card to flip it. Try to say the answer before you flip.</p>';
  host.addEventListener('click', e => {
    const c = e.target.closest('.card'); if (!c) return;
    c.classList.toggle('flip'); c.setAttribute('aria-pressed', c.classList.contains('flip'));
  });
}

