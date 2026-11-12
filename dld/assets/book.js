// Web book shell (table of contents + prev/next) and learning widgets for CSE 205.
// BOOK.parts is the table of contents: [file, title, tag]. Add every chapter here.
const BOOK = {
  parts: [
    { group: 'Start here' },
    { title: 'Plan', chapters: [
      ['start/01-exam-map.html', 'What the exam asks, and how to answer', 'start'],
      ['plan.html', 'The plan to 19 Nov (with progress)', 'plan'],
      ['start/02-what-to-write.html', 'What to write: answer templates', 'must'],
      ['last-night.html', 'Last-night plan and sheet', 'plan'],
    ] },
    { group: 'Section A · Tanzima ma\'am (combinational)' },
    { title: 'Algebra and numbers', chapters: [
      ['comb/01-boolean.html', 'Boolean algebra, duality, XOR, canonical forms', 'L1–4'],
      ['comb/02-numbers.html', 'Number systems, complements, codes, overflow', 'L5–7'],
    ] },
    { title: 'Minimisation', chapters: [
      ['comb/03-kmap.html', 'K-maps: PI, EPI, don\'t-cares, SOP and POS', 'L8–10'],
      ['comb/04-nand-nor.html', 'Universal gates and the eight two-level forms', 'L17–18'],
      ['comb/05-tabulation.html', 'Tabulation (Quine-McCluskey)', 'L10'],
    ] },
    { title: 'Combinational circuits', chapters: [
      ['comb/06-arith.html', 'Adders, subtractors, BCD adder, CLA, multiplier', 'L11–13'],
      ['comb/07-compare-codes.html', 'Comparators, code converters, parity', 'L13–14'],
      ['comb/08-decoder-encoder.html', 'Decoders, encoders, priority encoders', 'L13–15'],
      ['comb/09-mux.html', 'Multiplexers: implementing any function', 'L15–17'],
      ['comb/10-pla.html', 'PLA (and ROM, memory decoding)', 'L19'],
    ] },
    { group: 'Section B · Adnan sir (sequential)' },
    { title: 'Memory elements', chapters: [
      ['seq/01-latches-ff.html', 'Latches, flip-flops, master-slave, race-around', 'L1–3'],
      ['seq/02-ff-conversion.html', 'Flip-flop conversion', 'L4, L8'],
      ['seq/03-registers.html', 'Shift registers, ring and Johnson counters', 'L10–11'],
    ] },
    { title: 'Counters and clocked circuits', chapters: [
      ['seq/04-ripple.html', 'Ripple counters: mod-N, up/down, BCD', 'L10'],
      ['seq/05-sync-counter.html', 'Synchronous counters, any sequence', 'L4–8'],
      ['seq/06-analysis.html', 'Analysing a clocked circuit', 'L7, L9'],
      ['seq/07-mealy-moore.html', 'Mealy and Moore, slowly (weak spot)', 'must'],
      ['seq/08-sync-design.html', 'Designing from words: detectors, vending, traffic', 'L4–9'],
    ] },
    { title: 'State minimisation', chapters: [
      ['seq/09-state-min.html', 'Equivalent states: partitions, implication table', 'L12–13'],
      ['seq/10-incomplete.html', 'Incompletely specified: compatibles, bounds, cover', 'L13–16'],
    ] },
    { title: 'Asynchronous circuits', chapters: [
      ['seq/11-pulse.html', 'Pulse mode: locks, vending, sequences', 'L17'],
      ['seq/12-fund-flow.html', 'Fundamental mode: primitive and reduced flow tables', 'L18–19'],
      ['seq/13-fund-races.html', 'Races and race-free state assignment', 'L19'],
    ] },
    { group: 'Exam' },
    { title: 'Past papers, solved', chapters: [
      ['exam/repeats.html', 'Questions that come back', 'must'],
      ['exam/2024-25.html', 'Term final 2024–25', 'TF'],
      ['exam/2023-24.html', 'Term final 2023–24', 'TF'],
      ['exam/2022-23.html', 'Term final 2022–23', 'TF'],
      ['exam/2021-22.html', 'Term final 2021–22', 'TF'],
      ['exam/2020-21.html', 'Term final 2020–21', 'TF'],
      ['exam/2019-20.html', 'Term final 2019–20', 'TF'],
      ['exam/2018-19.html', 'Term final 2018–19', 'TF'],
      ['exam/2017-18.html', 'Term final 2017–18', 'TF'],
      ['exam/older.html', 'Older papers 2011–17', 'TF'],
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
    let h = `<a class="home" href="${root}index.html">CSE 205 Notes</a>`;
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
  const nav = shell.querySelector('nav.toc'), KEY = 'cse205-sidebar';
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

