// "AI check my answer" on every .exam block.
// Published site: key points come from keypoints.json (tools/build_keypoints.py) and Amos marks the answer
// straight from the browser (free, no key). With tools/ai_proxy.py running locally you also get photo
// reading and key points for questions the JSON does not cover yet.
(function aicheck() {
  const API = 'http://127.0.0.1:8765';
  const KP_URL = new URL('keypoints.json', document.currentScript.src).href;
  const AMOS = 'https://api.amos.scira.ai/v1/systemone';
  // only look for the helper when opened locally: on a public site Chrome would ask every visitor for local-network access
  const LOCAL = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  const exams = document.querySelectorAll('.exam');
  if (!exams.length) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const call = async (path, body) => {
    const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `The helper answered ${r.status}`);
    return j;
  };
  const key = q => q.replace(/\s+/g, '');   // must match key() in tools/build_keypoints.py
  const sleep = ms => new Promise(ok => setTimeout(ok, ms));

  // port of mark() in tools/ai_proxy.py
  const LEVELS = ['No credit: wrong, irrelevant or blank', 'Little: one minor idea', 'Partial: some key points, major gaps',
    'Good: most key points, minor gaps', 'Full: all key points, correct'];
  const amosMark = async (question, model, points, student, maxMarks) => {
    const qs = {};
    points.forEach((p, i) => { qs[`kp_${i}`] = { type: 'choice',
      instructions: `Key point: "${p}". How does the \`student_answer\` relate to this key point? Judge meaning, not wording; ignore spelling and notation differences.`,
      criteria: { established: 'The student states this point or something equivalent, correctly',
        partial: 'The student gestures at it but leaves out an essential part or is vague',
        contradicted: 'The student states something incompatible with this point',
        absent: 'The student does not address this point' } }; });
    qs.on_topic = { type: 'noul', instructions: 'The `student_answer` is a genuine attempt to answer the `question`.' };
    qs.error = { type: 'noul', instructions: 'The `student_answer` contains a factual error when compared with the `model_answer`.' };
    qs.overall = { type: 'score', criteria: LEVELS, instructions: 'Compared with the `model_answer`, how well does the `student_answer` answer the `question`?' };
    const body = JSON.stringify({ model: 'amos-1-large', questions: qs,
      state: { question, model_answer: model.slice(0, 12000), student_answer: student.slice(0, 8000) } });
    let r;
    for (let n = 0; n < 4; n++) {   // retry 429/503 like the helper does
      r = await fetch(AMOS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (![429, 503].includes(r.status) || n === 3) break;
      await sleep(Math.min(+r.headers.get('Retry-After') || 2 ** (n + 1), 30) * 1000);
    }
    if (!r.ok) throw new Error(`Amos answered HTTP ${r.status}`);
    const ans = (await r.json()).answers;
    let total = 0;
    const out = points.map((point, i) => {
      const pr = ans[`kp_${i}`]?.probabilities || {};
      const est = pr.established || 0, par = pr.partial || 0, con = pr.contradicted || 0;
      total += est + 0.5 * par;
      const status = con >= 0.5 ? 'contradicted' : est >= 0.7 ? 'established' : est + par <= 0.3 ? 'missing' : 'partial';
      return { point, status };
    });
    const onTopic = ans.on_topic?.noul ?? 1;
    const frac = onTopic < 0.3 || !points.length ? 0 : total / points.length;
    const ov = ans.overall || {};
    return { points: out, fraction: frac, mark: maxMarks ? Math.round(maxMarks * frac * 2) / 2 : null, max: maxMarks,
      on_topic: onTopic, error: ans.error?.noul ?? 0,
      unsure: Math.abs((ov.score || 0) / 4 - frac) > 0.35 || (ov.confidence ?? 1) < 0.5 };
  };
  // ER chapters load i07/lecture.js, whose converter lets a student answer with a typed ER diagram
  const ERD = typeof erConvert === 'function' && typeof erd === 'function' && typeof erAutoSpec === 'function';
  const attrText = a => (a.key ? 'key ' : a.pkey ? 'partial key ' : a.der ? 'derived ' : a.multi ? 'multivalued ' : '') + a.name +
    (a.parts ? ` (composite of ${a.parts.map(x => x.name).join(', ')})` : '');
  const erDescribe = (M, rels) => [
    ...Object.values(M.entities).map(e => `Entity set ${e.name}${e.weak ? ` (weak, identified through its owner ${e.owner})` : ''}` +
      (e.attrs.length ? `: ${e.attrs.map(attrText).join(', ')}.` : '.')),
    ...M.rels.map(r => `Relationship ${r.name} between ${r.parts.map(x => `${x.e}${x.role ? ` as ${x.role}` : ''} (${x.one ? 'one' : 'many'}${x.total ? ', total participation' : ''})`).join(' and ')}` +
      (r.attrs.length ? `, with attributes ${r.attrs.map(attrText).join(', ')}.` : '.')),
    ...M.isas.map(i => `${i.sup} isA hierarchy with subclasses ${i.subs.map(x => x.name + (x.attrs.length ? ` (${x.attrs.map(attrText).join(', ')})` : '')).join(', ')}; converted in the ${i.how.toUpperCase()} style.`),
    '', 'Relational schema (underlined = primary key, italic = foreign key):',
    ...rels.map(r => { const d = document.createElement('div'); d.innerHTML = relLine(r); return d.textContent; }),
  ].join('\n');
  const ICON = { established: ['✓', 'ok', 'Covered'], partial: ['~', 'mid', 'Partly covered'], missing: ['✗', 'bad', 'Missing'], contradicted: ['⚠', 'bad', 'Contradicts the model answer'] };

  const getJSON = (url, opt) => fetch(url, opt).then(r => r.ok ? r.json() : null).catch(() => null);
  Promise.all([LOCAL && getJSON(API + '/health', { signal: AbortSignal.timeout(1500) }), getJSON(KP_URL)]).then(([h, KP]) => {
    const helper = !!h?.ok;
    KP = KP || {};
    exams.forEach((ex, k) => {
      // textContent, not innerText: the worked answer sits inside a closed <details>, which innerText skips
      const text = el => (el?.textContent || '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
      const q = text(ex.querySelector('.exam-q')), model = text(ex.querySelector('.exam-a'));
      if (!q || !model) return;
      const known = KP[key(q)];
      if (!helper && !known) return;   // no key points and no helper to make them: leave this question as it was
      const marks = +((ex.querySelector('.exam-src')?.textContent.match(/(\d+(?:\.\d+)?)\s*marks?/i) || [])[1] || 0) || null;
      const id = `aic${k}`;
      const box = document.createElement('details');
      box.className = 'aic';
      box.innerHTML = `<summary>AI check my answer</summary>
        <p class="aic-note">Write your answer as you would in the exam, or upload a photo of your written answer. The AI marks it against the
        key points of the worked answer${marks ? ` (out of ${marks})` : ''}. Your answer is sent to Amos (scira.ai), which keeps requests to improve its models${helper ? '; photos go to TypeLLM' : ''}.</p>
        <textarea id="${id}-t" class="sq-ed" rows="6" aria-label="Your answer" placeholder="Your answer…"></textarea>
        ${ERD ? `<details class="aic-erd"><summary>✏️ Answer with an ER diagram</summary>
          <p class="aic-note">One statement per line, same format as the <a href="13-er-to-schema-tool.html">ER to Schema Converter</a>:
          <code>entity Student: _sid, name</code> · <code>weak entity Room of Building: ~no</code> · <code>rel enrolls: Student N, Course N total; grade</code> ·
          <code>isa Person: Staff(salary), Student(cgpa) [er]</code>. Your diagram draws as you type, and “Mark my answer” sends it with any text above.</p>
          <textarea id="${id}-e" class="sq-ed ert-in" rows="7" spellcheck="false" aria-label="Your ER diagram" placeholder="entity …"></textarea>
          <div class="aic-erd-out" aria-live="polite"></div></details>` : ''}
        <div class="sq-btns"><button type="button" data-mark>Mark my answer</button>
          ${helper ? `<label class="aic-file">📷 Photo of my answer <input type="file" accept="image/*" capture="environment" id="${id}-f"></label>` : ''}
          <button type="button" data-keys>Show key points</button></div>
        <div class="aic-out" aria-live="polite"></div>`;
      ex.append(box);
      const ta = box.querySelector('textarea'), out = box.querySelector('.aic-out');
      let points = known || null;
      const erIn = box.querySelector('.aic-erd textarea'), erOut = box.querySelector('.aic-erd-out');
      const erRead = () => {   // {text} for marking, or {errors}; null when the diagram box is empty
        if (!erIn || !erIn.value.trim()) return null;
        const res = erConvert(erIn.value);
        if (res.errors) return res;
        if (!res.rels.length) return { errors: ['Add at least one entity.'] };
        return { res, text: erDescribe(res.model, res.rels) };
      };
      let erTimer;
      if (erIn) erIn.addEventListener('input', () => { clearTimeout(erTimer); erTimer = setTimeout(() => {
        const r = erRead();
        if (!r) { erOut.innerHTML = ''; return; }
        if (r.errors) { erOut.innerHTML = `<div class="ert-err"><ul>${r.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`; return; }
        let pic = '';
        try { pic = erd(erAutoSpec(r.res.model)); } catch (e) { /* layout failed: still show the schema */ }
        erOut.innerHTML = `<figure class="wide"><div class="figlabel">Your ER diagram (automatic layout; lines may cross)</div>${pic}</figure>
          <p class="ert-lines">${r.res.rels.map(relLine).join('<br>')}</p>`;
      }, 400); });
      const getPoints = async () => points || (points = (await call('/keypoints', { question: q, model_answer: model })).points);
      const busy = msg => { out.innerHTML = `<p class="sq-msg">${msg}</p>`; };
      const fail = e => { out.innerHTML = `<p class="sq-msg err"><b>Could not finish:</b> ${esc(e.message)}. Try again in a minute.</p>`; };

      box.querySelector('[data-keys]').onclick = async () => {
        busy('Finding the key points in the worked answer…');
        try { out.innerHTML = `<p><b>Key points a marker looks for:</b></p><ol>${(await getPoints()).map(p => `<li>${esc(p)}</li>`).join('')}</ol>`; }
        catch (e) { fail(e); }
      };
      box.querySelector('[data-mark]').onclick = async () => {
        const er = erRead();
        if (er?.errors) { out.innerHTML = `<p class="sq-msg err">Fix your ER diagram first: ${esc(er.errors[0])}</p>`; return; }
        const a = [ta.value.trim(), er ? 'My ER diagram:\n' + er.text : ''].filter(Boolean).join('\n\n');
        if (a.length < 3) { out.innerHTML = '<p class="sq-msg err">Write your answer first.</p>'; return; }
        busy('Marking… (about 5–20 seconds)');
        try {
          const pts = await getPoints();
          const r = await amosMark(q, model, pts, a, marks);
          const pct = Math.round(r.fraction * 100);
          out.innerHTML = `<div class="aic-score"><b>${r.max ? `${r.mark} / ${r.max}` : `${pct}%`}</b> <span>estimated from ${r.points.length} key points</span></div>
            <ul class="aic-pts">${r.points.map(p => { const [ic, cls, word] = ICON[p.status]; return `<li class="${cls}"><span class="aic-ic">${ic}</span> <b>${word}:</b> ${esc(p.point)}</li>`; }).join('')}</ul>
            ${r.on_topic < 0.3 ? '<p class="sq-msg err">This does not look like an answer to the question, so it gets no credit.</p>' : ''}
            ${r.error >= 0.7 ? '<p class="sq-msg err">The AI thinks your answer contains a factual error. Compare it with the worked answer.</p>' : ''}
            ${r.unsure ? '<p class="sq-msg">The AI is unsure about this one. Compare your answer with the worked answer yourself.</p>' : ''}
            <p class="aic-note">An estimate, not an official mark. Open “Show worked answer” above to see each point in full.</p>`;
        } catch (e) { fail(e); }
      };
      if (helper) box.querySelector('input[type=file]').onchange = async ev => {
        const f = ev.target.files[0]; if (!f) return;
        if (f.size > 8e6) { out.innerHTML = '<p class="sq-msg err">That photo is over 8 MB. Use a smaller one.</p>'; return; }
        busy('Reading your handwriting…');
        try {
          const img = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
          const r = await call('/read', { question: q, image: img });
          if (r.legible < 0.7) { out.innerHTML = '<p class="sq-msg err">The photo is hard to read, so it was not marked. Retake it in good light, or type your answer.</p>'; return; }
          ta.value = r.transcript;
          out.innerHTML = `<p class="sq-msg ok">Read by ${esc(r.reader)}. <b>Check the text above and fix any misread words</b>, then press “Mark my answer”.</p>`;
          ta.focus();
        } catch (e) { fail(e); }
        ev.target.value = '';
      };
    });
  });
})();
