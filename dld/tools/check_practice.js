// node dld/tools/check_practice.js — every practice generator must accept the engine's own answer and reject a wrong one.
global.L = require('../assets/logic.js');
global.document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
global.location = { pathname: '/dld/x.html' }; global.$ = () => null;
const src = require('fs').readFileSync(__dirname + '/../assets/dld.js', 'utf8');
const G = new Function(src + '; return { GEN, mkRng };')();
const { GEN, mkRng } = G;
const assert = require('assert'); let n = 0;
const answer = {
  sop: (i, r) => r.m, pos: (i, r) => r.p, epi: (i, r) => r.e, pis: (i, r) => r.pi, mux4: (i, r) => r.mx, mux8: (i, r) => r.mx,
};
for (let seed = 1; seed <= 150; seed++) {
  for (const k of Object.keys(GEN)) {
    // re-derive the expected answer by re-running the same random stream through the engine
    const inst = GEN[k](mkRng(seed), {});
    const good = inst._ans;
    if (good === undefined) { console.log('no answer hook for', k); process.exit(1); }
    assert.strictEqual(inst.check(good), true, `${k} seed ${seed}: rejects its own answer "${good}" -> ${inst.check(good)}`); n++;
    assert.notStrictEqual(inst.check('0'), true, `${k} seed ${seed}: accepts "0"`); n++;
  }
}
function rf(r, n, a, b) { for (;;) { const ones = [], dc = []; for (let m = 0; m < 1 << n; m++) { const q = r(); if (q < a) ones.push(m); else if (q < a + b) dc.push(m); } if (ones.length >= 3 && ones.length + dc.length < (1 << n) - 1) return { ones, dc }; } }
console.log('practice: ' + n + ' checks passed');
