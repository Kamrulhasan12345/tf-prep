// Run every practice-box generator on the given pages for 300 seeds and report errors.
// Usage (from the repo root): node eee/tools/check_drills.js $(ls eee/*/*.html | grep -v exam/)
const fs = require('fs'), path = require('path'), vm = require('vm');
const stubEl = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : stubEl(), apply: () => stubEl(), set: () => true });
let bad = 0;
for (const page of process.argv.slice(2)) {
  const html = fs.readFileSync(page, 'utf8');
  const eee = fs.readFileSync(path.join(path.dirname(page), html.match(/src="([^"]*eee\.js)"/)[1]), 'utf8');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  const specs = [];
  const ctx = { setTimeout() {}, document: stubEl(), window: {}, localStorage: { getItem: () => null, setItem() {} }, console, Math, JSON, URLSearchParams, location: { search: '' } };
  vm.createContext(ctx);
  vm.runInContext(eee + `\n;var $ = () => ({});var flashcards = () => {}, quiz = () => {}, ask = () => {}, stepper = () => {};`, ctx);
  ctx.drill = (sel, spec) => specs.push(spec); ctx.worked = () => {}; ctx.tex = () => {};
  try { vm.runInContext(inline.replace(/\$\('([^']*)'\)\.innerHTML\s*=/g, 'void '), ctx); } catch (e) { console.log(`FAIL ${page}: page script: ${e.message}`); bad++; continue; }
  const ids = new Set();
  for (const s of specs) {
    if (ids.has(s.id)) { console.log(`${page}: DUPLICATE id ${s.id}`); bad++; } ids.add(s.id);
    let nulls = 0, errs = 0, first = '';
    for (let seed = 1; seed <= 300; seed++) {
      try {
        const p = s.gen(ctx.rng(seed * 7919));
        if (!p) { nulls++; continue; }
        const vals = [...p.ask.map(a => a.v), ...p.steps.filter(x => x && x.a).map(x => x.a.v)];
        const txt = p.given + (p.fig || '') + p.steps.map(x => typeof x === 'string' ? x : x.t).join('');
        if (vals.some(v => typeof v !== 'number' || !isFinite(v)) || /NaN|undefined|Infinity/.test(txt)) { errs++; first ||= `seed ${seed}: ${(txt.match(/.{0,60}(NaN|undefined|Infinity).{0,20}/) || [''])[0]}`; }
      } catch (e) { errs++; first ||= `seed ${seed}: ${e.message}`; }
    }
    const st = errs || nulls > 270 ? 'FAIL' : 'ok'; if (st !== 'ok') bad++;
    console.log(`${st.padEnd(4)} ${path.basename(page)} ${s.id.padEnd(28)} nulls ${String(nulls).padStart(3)}/300 errs ${errs} ${first}`);
  }
}
process.exit(bad ? 1 : 0);
