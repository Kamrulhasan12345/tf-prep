// Live SQL in the browser (SQLite compiled to WebAssembly, via sql.js from cdnjs).
// Load after book.js on pages that need it:  <script src="../assets/sqlplay.js"></script>
// Needs an internet connection the first time (the engine is fetched from the CDN).
const SQLJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
let _sqlReady = null;
function loadSQL() {
  if (_sqlReady) return _sqlReady;
  _sqlReady = new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = SQLJS_BASE + 'sql-wasm.js';
    s.onload = () => initSqlJs({ locateFile: f => SQLJS_BASE + f }).then(ok, fail);
    s.onerror = () => fail(new Error('Could not load the SQL engine. Check your internet connection and reload.'));
    document.head.append(s);
  });
  return _sqlReady;
}

// Oracle → SQLite translation, so the course's Oracle SQL runs as written in most cases.
// What cannot be translated (PL/SQL blocks, sequences, ROWNUM, hierarchical queries) is explained in the
// chapters instead; the playground reports SQLite's error for those.
var sqlCompat = function (q) {
  return q
    .replace(/\bvarchar2\b/gi, 'varchar').replace(/\bnvarchar2\b/gi, 'varchar')
    .replace(/\bnumber\s*\(/gi, 'numeric(').replace(/\bnumber\b/gi, 'numeric')
    .replace(/\bsysdate\b/gi, 'CURRENT_DATE').replace(/\bsystimestamp\b/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bfrom\s+dual\b/gi, '')
    .replace(/\bminus\b/gi, 'EXCEPT')
    .replace(/\bdate\s+'(\d{4}-\d\d-\d\d)'/gi, "'$1'")
    .replace(/\bfetch\s+(?:first|next)\s+(\d+)\s+rows?\s+only\b/gi, 'LIMIT $1')
    .replace(/\bcreate\s+or\s+replace\s+view\s+([\w.]+)/gi, 'DROP VIEW IF EXISTS $1; CREATE VIEW $1')
    .replace(/\bcascade\s+constraints\b/gi, '')
    .replace(/\bmodify\s*\(/gi, 'MODIFY (');   // left as-is: SQLite has no MODIFY, error explains
}
const _sqlCompatBase = sqlCompat;
sqlCompat = q => oraQuantified(_sqlCompatBase(q));
// Quantified comparisons  x op ALL/ANY/SOME (subquery), which SQLite lacks, rewritten with MIN/MAX/COUNT
// over the subquery (same result as Oracle in WHERE/HAVING). Written for the Lec 08–11 chapters, shared here.
let _oraQn = 0;
function oraQuantified(q) {
  const re = /(>=|<=|<>|!=|=|>|<)\s*(ALL|ANY|SOME)\s*\(/gi;
  for (let guard = 0; guard < 50; guard++) {
    let m, last = null;
    re.lastIndex = 0;
    while ((m = re.exec(q))) last = { i: m.index, op: m[1], kw: m[2].toUpperCase(), open: m.index + m[0].length - 1 };
    if (!last) return q;
    // the subquery: balanced parentheses after the keyword
    let d = 0, j = last.open;
    for (; j < q.length; j++) { if (q[j] === '(') d++; else if (q[j] === ')' && --d === 0) break; }
    const S = q.slice(last.open + 1, j);
    // the left operand: an identifier (a.b), a literal, or a function call / parenthesised expression
    let k = last.i - 1;
    while (k >= 0 && /\s/.test(q[k])) k--;
    let start;
    if (q[k] === ')') {
      let e = 0; start = k;
      for (; start >= 0; start--) { if (q[start] === ')') e++; else if (q[start] === '(' && --e === 0) break; }
      while (start > 0 && /[\w.]/.test(q[start - 1])) start--;
    } else {
      start = k + 1;
      while (start > 0 && /[\w.$"']/.test(q[start - 1])) start--;
    }
    const L = q.slice(start, k + 1), n = ++_oraQn;
    const A = f => `(WITH _q${n}_${f.length}(v) AS (${S}) SELECT ${f} FROM _q${n}_${f.length})`;
    const cnt = A('COUNT(*)'), cntv = A('COUNT(v)'), mn = A('MIN(v)'), mx = A('MAX(v)');
    const op = last.op === '!=' ? '<>' : last.op;
    let r;
    if (last.kw === 'ALL') {
      if (op === '>' || op === '>=') r = `(${cnt} = 0 OR (${L} ${op} ${mx} AND ${cntv} = ${cnt}))`;
      else if (op === '<' || op === '<=') r = `(${cnt} = 0 OR (${L} ${op} ${mn} AND ${cntv} = ${cnt}))`;
      else if (op === '=') r = `(${cnt} = 0 OR (${L} = ${mn} AND ${L} = ${mx} AND ${cntv} = ${cnt}))`;
      else r = `(${L} NOT IN (${S}))`;
    } else {
      if (op === '>' || op === '>=') r = `(${L} ${op} ${mn})`;
      else if (op === '<' || op === '<=') r = `(${L} ${op} ${mx})`;
      else if (op === '=') r = `(${L} IN (${S}))`;
      else r = `(${L} <> ${mn} OR ${L} <> ${mx})`;
    }
    q = q.slice(0, start) + r + q.slice(j + 1);
  }
  return q;
}
const MON = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
// TO_DATE for the common Oracle formats: 'DD-MON-YYYY', 'DD-MON-YY', 'YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'.
function oraToDate(s, fmt) {
  if (s == null) return null;
  s = String(s).trim(); fmt = String(fmt || 'DD-MON-YYYY').toUpperCase();
  let m;
  if ((m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/))) {
    const y = m[3].length === 2 ? (+m[3] < 50 ? '20' : '19') + m[3] : m[3];
    return `${y}-${MON[m[2].toUpperCase()]}-${m[1].padStart(2, '0')}`;
  }
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    const [d, mo] = fmt.startsWith('MM') ? [m[2], m[1]] : [m[1], m[2]];
    return `${m[3]}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}
// TO_CHAR for dates/numbers with the most common format masks.
function oraToChar(v, fmt) {
  if (v == null) return null;
  if (!fmt) return String(v);
  const d = new Date(String(v).length <= 10 ? v + 'T00:00:00' : v);
  if (isNaN(d)) return String(v);
  const M = Object.keys(MON), mon = M[d.getMonth()], pad = n => String(n).padStart(2, '0');
  const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return String(fmt).replace(/YYYY|YY|MONTH|MON|MM|DD|DAY|HH24|MI|SS/gi, t => ({
    YYYY: d.getFullYear(), YY: String(d.getFullYear()).slice(2), MONTH: months[d.getMonth()], MON: mon, MM: pad(d.getMonth() + 1),
    DD: pad(d.getDate()), DAY: days[d.getDay()], HH24: pad(d.getHours()), MI: pad(d.getMinutes()), SS: pad(d.getSeconds()) }[t.toUpperCase()]));
}
// sql.js registers a function with nArg = fn.length; length -1 makes it variadic in SQLite,
// which Oracle functions with optional arguments (TRUNC, TO_CHAR, LPAD, DECODE…) need.
const variadic = f => Object.defineProperty(f, 'length', { value: -1 });
async function newDB(setup) {
  const SQL = await loadSQL();
  const db = new SQL.Database();
  db.create_function('NVL', (a, b) => a ?? b);
  db.create_function('NVL2', (a, b, c) => a == null ? c : b);
  db.create_function('INITCAP', s => s == null ? s : String(s).toLowerCase().replace(/\b\w/g, c => c.toUpperCase()));
  db.create_function('TO_DATE', variadic((s, f) => oraToDate(s, f)));
  db.create_function('TO_CHAR', variadic((v, f) => oraToChar(v, f)));
  db.create_function('TO_NUMBER', s => s == null ? null : Number(s));
  db.create_function('TRUNC', variadic((x, n) => x == null ? null : (n ? Math.trunc(x * 10 ** n) / 10 ** n : Math.trunc(x))));
  db.create_function('MOD', (a, b) => a == null || b == null ? null : (b === 0 ? a : a % b));
  db.create_function('POWER', (a, b) => a == null || b == null ? null : a ** b);
  db.create_function('CEIL', x => x == null ? null : Math.ceil(x));
  db.create_function('FLOOR', x => x == null ? null : Math.floor(x));
  db.create_function('SQRT', x => x == null ? null : Math.sqrt(x));
  db.create_function('LPAD', variadic((s, n, c) => s == null ? null : String(s).padStart(n, c ?? ' ').slice(0, n)));
  db.create_function('RPAD', variadic((s, n, c) => s == null ? null : String(s).padEnd(n, c ?? ' ').slice(0, n)));
  db.create_function('CONCAT', (a, b) => (a ?? '') + (b ?? ''));
  db.create_function('ADD_MONTHS', (d, n) => {   // Oracle rule: clamp to month end; last day stays last day
    if (d == null) return null;
    const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number), last = (Y, M) => new Date(Date.UTC(Y, M, 0)).getUTCDate();
    const t = new Date(Date.UTC(y, m - 1 + n, 1)), Y = t.getUTCFullYear(), M = t.getUTCMonth() + 1;
    const day = dd === last(y, m) ? last(Y, M) : Math.min(dd, last(Y, M));
    return `${Y}-${String(M).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  });
  db.create_function('MONTHS_BETWEEN', (a, b) => { if (a == null || b == null) return null; const x = new Date(a), y = new Date(b); return (x.getFullYear() - y.getFullYear()) * 12 + x.getMonth() - y.getMonth() + (x.getDate() - y.getDate()) / 31; });
  db.create_function('DECODE', variadic((...a) => {   // DECODE(x, s1, r1, s2, r2, …, default)
    for (let i = 1; i + 1 < a.length; i += 2) if (a[0] === a[i] || (a[0] == null && a[i] == null)) return a[i + 1];
    return a.length % 2 === 0 ? a[a.length - 1] : null;
  }));
  db.exec('PRAGMA foreign_keys = ON;');
  if (setup) db.exec(sqlCompat(setup));
  return db;
}
const _esc = v => v == null ? '<span class="sq-null">NULL</span>' : String(v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function resultHTML(res) {
  if (!res.length) return '';
  return res.map(r => `<div class="sq-res"><table class="sq-t"><tr>${r.columns.map(c => `<th>${_esc(c)}</th>`).join('')}</tr>` +
    r.values.map(v => `<tr>${v.map(x => `<td>${_esc(x)}</td>`).join('')}</tr>`).join('') +
    `</table><div class="sq-n">${r.values.length} row${r.values.length === 1 ? '' : 's'}</div></div>`).join('');
}

// Editable query box. spec: {setup, query, note}
const _sqlRegistry = [];   // every box on the page, for the ?sqltest=1 self-test
function sqlPlay(sel, spec) {
  _sqlRegistry.push({ kind: 'play', sel: String(sel), setup: spec.setup, q: spec.query });
  const host = $(sel), id = host.id || ('sq' + Math.random().toString(36).slice(2));
  host.classList.add('sqlplay');
  host.innerHTML = `<div class="sq-bar"><span class="sq-tag">SQL playground</span><span class="sq-tip">Oracle syntax, run on SQLite · Ctrl+Enter runs · changes stay until Reset</span></div>
    <textarea id="${id}-ed" class="sq-ed" spellcheck="false" aria-label="SQL query">${_esc(spec.query || '').replace(/<span class="sq-null">NULL<\/span>/g, '')}</textarea>
    <div class="sq-btns"><button type="button" data-run>Run ▶</button><button type="button" data-reset>Reset</button><button type="button" data-tables>Show tables</button></div>
    <div class="sq-out" aria-live="polite"></div>`;
  const ed = host.querySelector('textarea'), out = host.querySelector('.sq-out');
  let db = null;
  const fresh = async () => { db?.close?.(); db = await newDB(spec.setup); };
  const run = async () => {
    out.innerHTML = '<p class="sq-msg">Running…</p>';
    try {
      if (!db) await fresh();
      const before = db.getRowsModified();
      const res = db.exec(sqlCompat(ed.value));
      const changed = db.getRowsModified() - before;
      out.innerHTML = resultHTML(res) || `<p class="sq-msg ok">Done.${changed ? ` ${changed} row${changed === 1 ? '' : 's'} affected.` : ' (No rows returned.)'}</p>`;
    } catch (e) { out.innerHTML = `<p class="sq-msg err"><b>Error:</b> ${_esc(e.message)}</p>`; }
  };
  const tables = async () => {
    try {
      if (!db) await fresh();
      const names = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values.map(v => v[0]) || [];
      out.innerHTML = names.map(n => `<div class="sq-tn">${_esc(n)}</div>` + resultHTML(db.exec(`SELECT * FROM "${n}"`)) ).join('') || '<p class="sq-msg">No tables.</p>';
    } catch (e) { out.innerHTML = `<p class="sq-msg err"><b>Error:</b> ${_esc(e.message)}</p>`; }
  };
  host.querySelector('[data-run]').onclick = run;
  host.querySelector('[data-tables]').onclick = tables;
  host.querySelector('[data-reset]').onclick = async () => { ed.value = spec.query || ''; await fresh().catch(e => out.innerHTML = `<p class="sq-msg err">${_esc(e.message)}</p>`); out.innerHTML = '<p class="sq-msg">Database reset to the starting data.</p>'; };
  ed.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } });
  if (spec.note) host.insertAdjacentHTML('beforeend', `<p class="sq-note">${spec.note}</p>`);
}

// Auto-checked exercise: the student's query must return the same rows as the solution.
// spec: {setup, task, solution, ordered (compare order too), hint, check: 'rows' | 'state' (compare a table after DML), table}
function sqlCheck(sel, spec) {
  _sqlRegistry.push({ kind: 'check', sel: String(sel), setup: spec.setup, q: spec.solution, rows: spec.check !== 'state' });
  const host = $(sel), id = host.id || ('sc' + Math.random().toString(36).slice(2));
  host.classList.add('sqlplay', 'sqlcheck');
  host.innerHTML = `<div class="sq-bar"><span class="sq-tag">Try it · auto-checked</span></div><div class="sq-task">${spec.task}</div>
    <textarea id="${id}-ed" class="sq-ed" spellcheck="false" aria-label="Your SQL" placeholder="Write your SQL here, then press Check (Ctrl+Enter)"></textarea>
    <div class="sq-btns"><button type="button" data-chk>Check ✓</button>${spec.hint ? '<button type="button" data-hint>Hint</button>' : ''}<button type="button" data-ans>Show answer</button><button type="button" data-tables>Show tables</button></div>
    <div class="sq-out" aria-live="polite"></div>`;
  const ed = host.querySelector('textarea'), out = host.querySelector('.sq-out');
  const rowsOf = async q => {
    const db = await newDB(spec.setup);
    try {
      const res = db.exec(sqlCompat(q));
      if (spec.check === 'state') return db.exec(`SELECT * FROM ${spec.table}`).at(-1) || { columns: [], values: [] };
      return res.at(-1) || { columns: [], values: [] };
    } finally { db.close(); }
  };
  const key = r => JSON.stringify(r.map(v => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v));
  host.querySelector('[data-chk]').onclick = async () => {
    if (!ed.value.trim()) return;
    out.innerHTML = '<p class="sq-msg">Checking…</p>';
    try {
      const [want, got] = [await rowsOf(spec.solution), await rowsOf(ed.value)];
      const a = want.values.map(key), b = got.values.map(key);
      const same = a.length === b.length && (spec.ordered ? a.every((x, i) => x === b[i]) : [...a].sort().join('\n') === [...b].sort().join('\n'))
        && want.columns.length === got.columns.length;
      out.innerHTML = same ? `<p class="sq-msg ok"><b>Correct.</b> Your result matches (${b.length} rows).</p>` + resultHTML([got])
        : `<p class="sq-msg err"><b>Not yet.</b> Expected ${a.length} row(s) with ${want.columns.length} column(s); yours gave ${b.length} row(s) with ${got.columns.length} column(s)${spec.ordered && a.length === b.length ? ' (check the ORDER BY)' : ''}.</p>` + resultHTML([got]);
    } catch (e) { out.innerHTML = `<p class="sq-msg err"><b>Error:</b> ${_esc(e.message)}</p>`; }
  };
  host.querySelector('[data-ans]').onclick = async () => {
    try { out.innerHTML = `<pre class="sq-sol">${_esc(spec.solution)}</pre>` + resultHTML([await rowsOf(spec.solution)]); }
    catch (e) { out.innerHTML = `<p class="sq-msg err">${_esc(e.message)}</p>`; }
  };
  host.querySelector('[data-hint]')?.addEventListener('click', () => { out.innerHTML = `<p class="sq-msg"><b>Hint:</b> ${spec.hint}</p>`; });
  host.querySelector('[data-tables]').onclick = async () => {
    const db = await newDB(spec.setup);
    const names = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values.map(v => v[0]) || [];
    out.innerHTML = names.map(n => `<div class="sq-tn">${_esc(n)}</div>` + resultHTML(db.exec(`SELECT * FROM "${n}"`))).join('');
    db.close();
  };
  ed.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); host.querySelector('[data-chk]').click(); } });
}

// Render the tables created by a setup script as static figures (for "here is the data" figures).
async function sqlTables(sel, setup, only) {
  const host = $(sel);
  try {
    const db = await newDB(setup);
    const names = only || db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values.map(v => v[0]) || [];
    host.innerHTML = `<div class="figrow">${names.map(n => `<div><div class="figlabel">${_esc(n)}</div>${resultHTML(db.exec(`SELECT * FROM "${n}"`))}</div>`).join('')}</div>`;
    db.close();
  } catch (e) { host.innerHTML = `<p class="sq-msg err">${_esc(e.message)}</p>`; }
}

// ?sqltest=1 : run every box's setup + query/solution and print a report into <pre id="sqltest"> (used by the book's checks).
if (new URLSearchParams(location.search).get('sqltest')) window.addEventListener('load', () => setTimeout(async () => {
  const lines = [];
  let fail = 0;
  for (const b of _sqlRegistry) {
    try {
      const db = await newDB(b.setup);
      const res = b.q ? db.exec(sqlCompat(b.q)) : [];
      if (b.kind === 'check' && b.rows && !res.length) lines.push(`EMPTY ${b.kind} ${b.sel}`);
      db.close();
    } catch (e) { fail++; lines.push(`FAIL ${b.kind} ${b.sel}: ${e.message}`); }
  }
  const pre = document.createElement('pre'); pre.id = 'sqltest';
  pre.textContent = `SQLTEST boxes=${_sqlRegistry.length} failures=${fail}\n` + lines.join('\n');
  document.body.append(pre);
}, 1500));
