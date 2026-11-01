// Web book shell (table of contents + prev/next), learning widgets, and KaTeX loading for EEE 263.
// BOOK.parts is the table of contents: [file, title, tag]. Add every chapter here.
const BOOK = {
  parts: [
    { group: 'Start here' },
    { title: 'How this book works', chapters: [
      ['start/01-how-to-use.html', 'How to use this book', 'start'],
      ['start/02-math-toolkit.html', 'The maths toolkit', 'start'],
      ['start/03-atlas.html', 'Problem-type atlas and mixed practice', 'drill'],
      ['start/04-exam-strategy.html', 'Exam format and strategy', 'exam'],
    ] },
    { group: 'Diodes' },
    { title: 'Diodes I · physics, models, analysis', chapters: [
      ['diode/01-semiconductors-and-junction.html', 'Semiconductors and the pn junction', 'theory'],
      ['diode/02-diode-models.html', 'Diode models: ideal, CVD, piecewise linear', 'D-03'],
      ['diode/03-multi-diode-analysis.html', 'Circuits with several diodes', 'D-04'],
      ['diode/04-exponential-model.html', 'The exponential model and diode strings', 'D-01'],
      ['diode/05-small-signal.html', 'Small-signal model', 'D-02'],
      ['diode/06-temperature.html', 'Temperature and thermal resistance', 'D-08'],
    ] },
    { title: 'Diodes II · Zener, rectifiers, wave shaping', chapters: [
      ['diode/07-zener.html', 'Zener diodes and shunt regulators', 'D-09/10'],
      ['diode/08-rectifiers.html', 'Rectifiers and battery chargers', 'D-07/11'],
      ['diode/09-peak-rectifier.html', 'Peak rectifier: ripple, conduction angle, diode current', 'D-06'],
      ['diode/10-clippers.html', 'Clippers and transfer characteristics', 'D-13/14'],
      ['diode/11-clampers.html', 'Clampers and voltage doublers', 'D-15'],
      ['diode/12-special-diodes.html', 'Special diodes and thyristors', 'theory'],
    ] },
    { group: 'BJT' },
    { title: 'BJT I · device and DC', chapters: [
      ['bjt/01-structure-and-modes.html', 'Structure and modes of operation', 'theory'],
      ['bjt/02-iv-and-early-effect.html', 'I–V characteristics and the Early effect', 'B-12'],
      ['bjt/03-dc-analysis.html', 'DC analysis: active, saturation, cutoff', 'B-01/05'],
      ['bjt/04-bias-circuits.html', 'Bias circuits, stability and bias design', 'B-02/04'],
      ['bjt/05-multi-bjt-dc.html', 'Circuits with several transistors', 'B-03'],
      ['bjt/06-graphical-and-switching.html', 'Load lines, transfer curves, switching', 'B-06'],
    ] },
    { title: 'BJT II · amplifiers', chapters: [
      ['bjt/07-small-signal-models.html', 'Small-signal models: hybrid-π and T', 'theory'],
      ['bjt/08-ce-amplifier.html', 'Common-emitter amplifier', 'B-07'],
      ['bjt/09-ce-with-re.html', 'CE amplifier with emitter resistance', 'B-08'],
      ['bjt/10-cb-and-follower.html', 'Common base and emitter follower', 'B-09/10'],
      ['bjt/11-multistage-and-output-stages.html', 'Multistage amplifiers and output stages', 'B-11'],
    ] },
    { group: 'MOSFET' },
    { title: 'MOSFET I · device and DC', chapters: [
      ['mosfet/01-structure-and-operation.html', 'Structure and operation', 'theory'],
      ['mosfet/02-iv-regions.html', 'I–V, regions, channel-length modulation', 'M-01'],
      ['mosfet/03-dc-analysis.html', 'DC analysis', 'M-03/05/06'],
      ['mosfet/04-diode-connected-sizing.html', 'Diode-connected transistors and sizing', 'M-02'],
      ['mosfet/05-mirrors-and-pairs.html', 'Current mirrors, pairs, complementary stages', 'M-04/07'],
    ] },
    { title: 'MOSFET II · amplifiers', chapters: [
      ['mosfet/06-small-signal.html', 'Small-signal model and biasing', 'theory'],
      ['mosfet/07-cs-amplifier.html', 'Common-source amplifier', 'M-10/11'],
      ['mosfet/08-cs-feedback-cg-cd.html', 'Feedback-biased CS, CG and CD', 'M-12'],
      ['mosfet/09-cmos.html', 'CMOS inverter and gates', 'M-08/09'],
    ] },
    { group: 'Op-amps' },
    { title: 'Op-amps', chapters: [
      ['opamp/01-ideal-opamp.html', 'The ideal op-amp; inverting and non-inverting', 'O-01'],
      ['opamp/02-summers-and-difference.html', 'Summers, difference amplifier, V-to-I', 'O-04/10'],
      ['opamp/03-integrator-differentiator.html', 'Integrator and differentiator', 'O-06'],
      ['opamp/04-expression-synthesis.html', 'Building a given expression', 'O-05'],
      ['opamp/05-analog-computer.html', 'Analog computer for differential equations', 'O-07'],
      ['opamp/06-log-antilog.html', 'Log, antilog and nonlinear circuits', 'O-02/03'],
      ['opamp/07-active-filters.html', 'Active filters', 'O-08/09'],
      ['opamp/08-comparators.html', 'Comparators and interfaces', 'O-11'],
    ] },
    { group: 'Oscillators and generators' },
    { title: 'Oscillators and waveform generators', chapters: [
      ['osc/01-barkhausen-and-limiters.html', 'Barkhausen criterion and amplitude limiters', 'theory'],
      ['osc/02-wien-bridge.html', 'Wien-bridge oscillator', 'S-01'],
      ['osc/03-rc-phase-shift.html', 'RC phase-shift oscillator', 'S-02'],
      ['osc/04-lc-and-crystal.html', 'Colpitts, Hartley and crystal oscillators', 'S-03/04'],
      ['osc/05-schmitt-trigger.html', 'Bistables and Schmitt triggers', 'S-09'],
      ['osc/06-astable-and-generators.html', 'Astable, monostable, square–triangle generators', 'S-05/08'],
      ['osc/07-555-timer.html', 'The 555 timer', 'S-06/07'],
    ] },
    { group: 'Exam' },
    { title: 'Past papers and class tests', chapters: [
      ['exam/ct.html', 'Class tests and assignments', 'CT'],
      ['exam/2024-25.html', 'Term final 2024–25', 'TF'],
      ['exam/2023-24.html', 'Term final 2023–24', 'TF'],
      ['exam/2022-23.html', 'Term final 2022–23', 'TF'],
      ['exam/2021-22.html', 'Term final 2021–22', 'TF'],
      ['exam/2020-21.html', 'Term final 2020–21', 'TF'],
      ['exam/2019-20.html', 'Term final 2019–20', 'TF'],
      ['exam/2018-19.html', 'Term final 2018–19', 'TF'],
      ['exam/2017-18.html', 'Term final 2017–18', 'TF'],
      ['exam/2016-17.html', 'Term final 2016–17', 'TF'],
      ['exam/2015-16.html', 'Term final 2015–16', 'TF'],
      ['exam/2014-15.html', 'Term final 2014–15', 'TF'],
      ['exam/2013-14.html', 'Term final 2013–14', 'TF'],
      ['exam/2012-13.html', 'Term final 2012–13', 'TF'],
      ['exam/2011-12.html', 'Term final 2011–12', 'TF'],
      ['last-night.html', 'Last-night formula sheet and priorities', 'exam'],
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
    let h = `<a class="home" href="${root}index.html">EEE 263 Notes</a>`;
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

