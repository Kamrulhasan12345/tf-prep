// MATH 241 widgets: KaTeX, solve-on-paper question cards (step reveal, self-grade, redo list),
// final-answer checking with math.js, optional AI check of a photo of your notebook (Amos), and
// mandatory-practice bookkeeping. Load after book.js. Every helper is a plain global function.

// ---------- KaTeX: \( inline \) and \[ display \] ----------
const KX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/'; let kxReady = null;
const loadJs = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); });
function loadKatex() { if (kxReady) return kxReady; const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = KX + 'katex.min.css'; document.head.append(css); return kxReady = loadJs(KX + 'katex.min.js').then(() => loadJs(KX + 'contrib/auto-render.min.js')); }
function tex(el = document.body) { loadKatex().then(() => renderMathInElement(el, { delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }], throwOnError: false })).catch(() => {}); }
const host = sel => typeof sel === 'string' ? $(sel) : sel;

// ---------- mandatory-practice bookkeeping (localStorage; pages still work without it) ----------
const PAGE = (() => { const m = /math\/(.*?)(?:[?#].*)?$/.exec(location.pathname); return (m && m[1]) || location.pathname.split('/').slice(-2).join('/'); })();
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const Must = {
  KEY: 'math241-must', items: {},
  load() { return store.get(this.KEY, {}); },
  save(o) { store.set(this.KEY, o); },
  reg(id, need) { this.items[id] = need; },
  got(id) { return (this.load()[PAGE]?.w?.[id]) || 0; },
  setv(id, v) { const o = this.load(), p = o[PAGE] ||= { w: {} }; p.w ||= {}; p.w[id] = v; this.sync(o); },
  sync(o = this.load()) { const p = o[PAGE] ||= { w: {} }; p.total = Object.values(this.items).reduce((a, b) => a + b, 0); p.done = Object.entries(this.items).reduce((a, [k, n]) => a + Math.min(n, p.w?.[k] || 0), 0); this.save(o); paintToc(o); paintGate(); return p; },
};
function paintToc(o = Must.load()) { document.querySelectorAll('nav.toc a[href]').forEach(a => { const m = /math\/(.*)$/.exec(a.href); const p = m && o[m[1]]; a.classList.toggle('fin', !!p && p.total > 0 && p.done >= p.total); a.classList.toggle('debt', !!p && !!p.skipped && !(p.done >= p.total)); }); }
function paintGate() {
  const next = document.querySelector('.pager a.next'), old = document.querySelector('.gate'); if (old) old.remove();
  if (!next || !Object.keys(Must.items).length) return;
  const total = Object.values(Must.items).reduce((a, b) => a + b, 0), done = Object.keys(Must.items).reduce((a, k) => a + Math.min(Must.items[k], Must.got(k)), 0);
  if (done >= total || Must.load()[PAGE]?.skipped) { next.style.opacity = ''; next.onclick = null; return; }
  next.style.opacity = .45; next.onclick = e => { e.preventDefault(); document.querySelector('.gate')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const g = document.createElement('div'); g.className = 'gate';
  g.innerHTML = `<b>Practice first: ${done} of ${total} mandatory questions graded.</b> This chapter is finished when every amber box is solved on paper and graded. <button class="must-b" type="button">Skip for now, and log it as debt</button>`;
  g.querySelector('button').onclick = () => { const o = Must.load(); (o[PAGE] ||= { w: {} }).skipped = true; Must.save(o); paintGate(); paintToc(o); };
  next.closest('.pager').before(g);
}

// ---------- grades: one record per question, read by the redo page ----------
// GRADES[page#id] = {g: 'ok'|'slip'|'no', t: time, s: source label, q: plain question text}
const GKEY = 'math241-grades';
const grades = () => store.get(GKEY, {});
function setGrade(id, g, c) { const a = grades(); if (g) a[PAGE + '#' + id] = { g, t: Date.now(), s: c.src || '', q: plain(c.q).slice(0, 160) }; else delete a[PAGE + '#' + id]; store.set(GKEY, a); }

// ---------- final-answer check (math.js, loaded on first use) ----------
// ans: {num: 12.5} or {expr: 'x^2*y + C', vars: ['x','y'], upto: 'const'} ; upto 'const' ignores an added constant, 'scale' a constant factor.
let mjReady = null;
const loadMath = () => mjReady ||= loadJs('https://cdn.jsdelivr.net/npm/mathjs@13.2.0/lib/browser/math.js');
const cleanIn = s => String(s).replace(/\s+/g, ' ').replace(/\bln\b/g, 'log').replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/×|·/g, '*').replace(/−/g, '-').replace(/\bC\b|\bc\d?\b/g, '0').trim();
async function checkAns(ans, text) {
  await loadMath();
  const ev = (s, sc) => { const v = math.evaluate(cleanIn(s), { ...sc }); return typeof v === 'number' ? v : math.complex(v).re + 1e-7 * math.complex(v).im; };
  try {
    if (ans.num !== undefined) { const v = ev(text, {}); return Math.abs(v - ans.num) <= Math.max(1e-6, Math.abs(ans.num) * (ans.tol ?? 2e-3)); }
    const vars = ans.vars || ['x', 'y', 'z'], pts = [];
    for (let k = 0; k < 6; k++) pts.push(Object.fromEntries(vars.map((v, i) => [v, 0.37 + 0.61 * k + 0.23 * i * (k % 3) + 0.11 * i])));
    const A = pts.map(p => ev(text, p)), B = pts.map(p => ev(ans.expr, p));
    if (A.some(v => !isFinite(v)) || B.some(v => !isFinite(v))) return false;
    const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
    if (ans.upto === 'const') return A.every((a, i) => close(a - A[0], B[i] - B[0]));
    if (ans.upto === 'scale') { const k = A[0] / B[0]; return isFinite(k) && A.every((a, i) => close(a, k * B[i])); }
    return A.every((a, i) => close(a, B[i]));
  } catch { return null; }
}

// ---------- the question card ----------
// c = {id, src: '2023-24 Q1(a) · 10 marks', q: html, steps: [html...], ans?: {...}, fmt?: 'how to type the answer',
//      points?: [key steps the marker looks for; defaults to step text], must: true|false}
function solve(sel, c) {
  const el = host(sel); el.id ||= 'q-' + c.id; el.classList.add('must', 'solve'); if (!c.must) el.classList.add('opt');
  if (c.must) Must.reg(c.id, 1);
  let shown = 0;
  const label = { ok: '✓ got it', slip: '~ small slip', no: '✗ could not' };
  function paint() {
    const g = grades()[PAGE + '#' + c.id]?.g, done = !!g;
    el.classList.toggle('ok', done && g === 'ok');
    el.innerHTML = `<div class="must-h"><span>${c.must ? 'Mandatory · ' : ''}solve on paper${c.src ? ' · ' + c.src : ''}</span><span>${done ? label[g] : ''}</span></div>
      <div class="must-q">${c.q}</div>
      ${c.ans ? `<form class="must-f"><input aria-label="Your final answer" autocomplete="off" spellcheck="false" placeholder="${c.fmt || 'final answer (optional check), e.g. 3*x^2*y + C'}"><button class="must-b" type="submit">Check answer</button></form><div class="must-r" aria-live="polite"></div>` : ''}
      <div class="must-f" style="margin-top:8px"><button class="must-b" type="button" data-step>${shown ? 'Next step' : 'I solved it on paper: show step 1'}</button><button class="must-b" type="button" data-all>Show all steps</button></div>
      <ol class="steps">${c.steps.slice(0, shown).map(s => `<li>${s}</li>`).join('')}</ol>
      <div class="grade" ${shown >= c.steps.length ? '' : 'hidden'}><span class="tracer-hint">Compare with your page, then grade yourself honestly. ✗ and ~ go to the <a href="${ROOT}start/03-redo.html">redo list</a>.</span><div class="must-f"><button class="must-b" data-g="ok" type="button">✓ Got it right</button><button class="must-b" data-g="slip" type="button">~ Small slip</button><button class="must-b" data-g="no" type="button">✗ Could not / wrong method</button>${done ? '<button class="must-b" data-g="" type="button">Reset</button>' : ''}</div></div>`;
    const res = el.querySelector('.must-r');
    el.querySelector('form')?.addEventListener('submit', async e => { e.preventDefault(); const v = el.querySelector('input').value; if (!v.trim()) return; res.className = 'must-r'; res.textContent = 'Checking…'; const r = await checkAns(c.ans, v); res.className = 'must-r ' + (r ? 'good' : 'bad'); res.innerHTML = r === null ? 'Could not read that. Use * for multiply, ^ for powers, sqrt(), sin(), exp(), log() (= ln), pi.' : r ? '<b>Correct final answer.</b> Now check your working against the steps.' : '<b>Not this.</b> Find your first wrong line before opening the steps.'; });
    el.querySelector('[data-step]').onclick = () => { shown = Math.min(c.steps.length, shown + 1); paint(); };
    el.querySelector('[data-all]').onclick = () => { shown = c.steps.length; paint(); };
    el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { const v = b.dataset.g; setGrade(c.id, v, c); if (c.must) Must.setv(c.id, v ? 1 : 0); paint(); });
    if (shown >= c.steps.length) aiBox(el.querySelector('.grade'), c);
    tex(el);
  }
  paint(); if (c.must) Must.sync();
}
// worked example: same card, not mandatory (steps start hidden so you try it first)
function worked(sel, c) { solve(sel, { ...c, must: false, id: c.id || 'w' + Math.random().toString(36).slice(2, 7) }); }

// ---------- optional AI check of a photo of your written solution (Amos: free, no key, from the browser) ----------
const AMOS = 'https://api.amos.scira.ai/v1/systemone';
const plain = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); };
const photoB64 = f => new Promise((ok, no) => { const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { const k = Math.min(1, 1600 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = im.width * k; cv.height = im.height * k; cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); ok(cv.toDataURL('image/jpeg', .85).split(',')[1]); }; im.onerror = () => no(new Error('That file could not be read as an image.')); im.src = u; });
async function amosMark(c, image) {
  const pts = (c.points || c.steps).map(plain), qs = {};
  pts.forEach((p, i) => { qs['kp_' + i] = { type: 'choice', instructions: `Model-solution step: "${p}". Does the handwritten solution in the attached photo contain this step (or an equivalent correct one)? Judge the mathematics, not the notation.`, criteria: { established: 'Present and correct', partial: 'Attempted but incomplete or with an algebra slip', contradicted: 'Present but mathematically wrong', absent: 'Not there' } }; });
  qs.on_topic = { type: 'noul', instructions: 'The photo shows a handwritten attempt at this question.' };
  const body = JSON.stringify({ model: 'amos-1-large', questions: qs, images: [image], state: { question: plain(c.q), model_solution: c.steps.map(plain).join(' | ').slice(0, 12000) } });
  let r; for (let n = 0; n < 4; n++) { r = await fetch(AMOS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }); if (![429, 503].includes(r.status) || n === 3) break; await new Promise(ok => setTimeout(ok, Math.min(+r.headers.get('Retry-After') || 2 ** (n + 1), 30) * 1000)); }
  if (!r.ok) throw new Error('The AI service answered ' + r.status + '. Grade it yourself against the steps.');
  const a = (await r.json()).answers;
  return { onTopic: a.on_topic?.noul ?? 1, st: pts.map((p, i) => { const pr = a['kp_' + i]?.probabilities || {}, e = pr.established || 0, m = pr.partial || 0; return [p, (pr.contradicted || 0) >= .5 ? '⚠ wrong' : e >= .7 ? '✓' : e + m <= .3 ? '✗ missing' : '~ partly']; }) };
}
function aiBox(where, c) {
  const box = document.createElement('details'); box.className = 'must-model';
  box.innerHTML = `<summary>AI check of your notebook page (optional)</summary><p class="tracer-hint">Photo goes to Amos (scira.ai), which keeps requests to improve its models: photograph only the working, no name or roll. It can misread handwriting; your own grade is what counts.</p><div class="must-f"><label class="must-b">📷 Choose photo <input type="file" accept="image/*" capture="environment" hidden></label><button class="must-b" type="button">Check my working</button></div><div class="must-r" aria-live="polite"></div>`;
  const file = box.querySelector('input'), go = box.querySelector('button'), out = box.querySelector('.must-r');
  file.onchange = () => { file.closest('label').firstChild.textContent = file.files[0] ? '📷 Photo chosen ' : '📷 Choose photo '; };
  go.onclick = async () => {
    if (!file.files[0]) { out.className = 'must-r bad'; out.textContent = 'Choose a photo first.'; return; }
    go.disabled = true; out.className = 'must-r'; out.textContent = 'Reading your page, about 15 seconds…';
    try {
      const m = await amosMark(c, await photoB64(file.files[0]));
      if (m.onTopic < .3) { out.className = 'must-r bad'; out.textContent = 'This does not look like an attempt at this question. Retake the photo in good light.'; return; }
      out.className = 'must-r'; out.innerHTML = '<ul class="pts">' + m.st.map(([p, s]) => `<li><b>${s}</b> ${p.slice(0, 140)}</li>`).join('') + '</ul>';
    } catch (e) { out.className = 'must-r bad'; out.textContent = e.message || 'Could not reach the AI service.'; }
    finally { go.disabled = false; }
  };
  where.append(box);
}

// ---------- redo list (start/03-redo.html) ----------
function redoList(sel) {
  const el = host(sel), a = grades(), rows = Object.entries(a).filter(([, v]) => v.g !== 'ok').sort((x, y) => (x[1].g === 'no' ? 0 : 1) - (y[1].g === 'no' ? 0 : 1) || x[1].t - y[1].t);
  const ok = Object.values(a).filter(v => v.g === 'ok').length;
  el.innerHTML = `<p class="key">${ok} questions graded ✓ · ${rows.length} to redo.</p>` + (rows.length ? '<ol>' + rows.map(([k, v]) => { const [p, id] = k.split('#'); return `<li><b>${v.g === 'no' ? '✗' : '~'}</b> <a href="${ROOT}${p}#q-${id}">${v.s || p}</a> <span class="tracer-hint">${p}</span><br><span class="tracer-hint">${v.q}</span></li>`; }).join('') + '</ol>' : '<p>Nothing to redo yet. Grade questions in the chapters and the ✗ / ~ ones land here.</p>');
}

const ROOT = new URL('..', document.currentScript.src).href;
document.addEventListener('DOMContentLoaded', () => { tex(); paintToc(); });
