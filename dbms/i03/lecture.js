// Shared data and figure helpers for Ishrak sir's Lec 03 (DDL), Lec 04 (single-table queries) and Lec 05 (DML).
// Loaded by i03/*, i04/* and i05/* pages after book.js and sqlplay.js:  <script src="../i03/lecture.js"></script>

// ---------- sample databases (Oracle syntax; sqlplay.js translates for SQLite) ----------
// Oracle's LIKE is case-sensitive; SQLite's is not unless this pragma is set.
const CS = 'PRAGMA case_sensitive_like = ON;\n';

// Lec 03: students, movies, courses, the slide-44 Student table.
const UNI = CS + `CREATE TABLE Students (
  sid      CHAR(10),
  name     VARCHAR2(50),
  email    VARCHAR2(50),
  gpa      FLOAT,
  dob      DATE,
  username CHAR(5) UNIQUE,
  PRIMARY KEY (sid)
);
INSERT INTO Students VALUES ('1905001', 'Ayesha Rahman',   'ayesha@cse.buet.ac.bd', 3.85, DATE '2001-03-14', 'ayesh');
INSERT INTO Students VALUES ('1905002', 'Tanvir Hasan',    NULL,                    3.42, DATE '2000-11-02', 'tanvr');
INSERT INTO Students VALUES ('1905004', 'Sadia Islam',     'sadia@cse.buet.ac.bd',  3.97, NULL,              'sadia');
INSERT INTO Students VALUES ('2005011', 'Mahir Chowdhury', NULL,                    2.95, DATE '2002-05-30', NULL);
INSERT INTO Students VALUES ('2305010', 'Rafid Ahmed',     'rafid@cse.buet.ac.bd',  NULL, DATE '2004-01-09', NULL);
INSERT INTO Students VALUES ('2305027', 'Nusrat Jahan',    'nusrat@cse.buet.ac.bd', NULL, DATE '2005-07-21', 'nusrt');
CREATE TABLE Movie (
  title  VARCHAR2(50),
  year   INTEGER,
  length INTEGER,
  genre  CHAR(10),
  PRIMARY KEY (title, year)
);
INSERT INTO Movie VALUES ('Gone With the Wind', 1939, 231, 'drama');
INSERT INTO Movie VALUES ('Star Wars',          1977, 124, 'sciFi');
INSERT INTO Movie VALUES ('Wayne''s World',     1992,  95, 'comedy');
INSERT INTO Movie VALUES ('King Kong',          1933, 100, 'adventure');
INSERT INTO Movie VALUES ('King Kong',          2005, 187, 'adventure');
CREATE TABLE MovieStar (
  name      VARCHAR2(50),
  address   VARCHAR2(50),
  gender    CHAR(1),
  birthdate DATE,
  PRIMARY KEY (name)
);
INSERT INTO MovieStar VALUES ('Carrie Fisher',  '123 Maple St., Hollywood',   'F', DATE '1999-09-09');
INSERT INTO MovieStar VALUES ('Mark Hamill',    '456 Oak Rd., Brentwood',     'M', DATE '1988-08-08');
INSERT INTO MovieStar VALUES ('Harrison Ford',  '789 Palm Dr., Beverly Hills','M', DATE '1977-07-07');
CREATE TABLE Course (
  dept       VARCHAR2(10),
  num        NUMBER(3),
  section    CHAR(1),
  instructor VARCHAR2(20),
  PRIMARY KEY (dept, num, section)
);
INSERT INTO Course VALUES ('MATH', 101, 'A', 'Jones');
INSERT INTO Course VALUES ('MATH', 101, 'B', 'Smith');
INSERT INTO Course VALUES ('MATH', 102, 'A', 'Williams');
INSERT INTO Course VALUES ('PHYS', 101, 'A', 'Baker');
INSERT INTO Course VALUES ('PHYS', 102, 'B', 'Baker');
CREATE TABLE Student (
  id         VARCHAR2(10) PRIMARY KEY,
  first_name VARCHAR2(20),
  last_name  VARCHAR2(20),
  city       VARCHAR2(20),
  state      CHAR(2)
);
`;
// The three rows inserted on Lec 03 slide 44 / Lec 05 slide 2.
const STUDENT_ROWS = `INSERT INTO Student VALUES ('S123456789', 'John', 'Doe', 'Houston', 'TX');
INSERT INTO Student VALUES ('S111111111', 'Mary', 'Jones', 'Houston', 'TX');
INSERT INTO Student (id, first_name, last_name) VALUES ('S987654321', 'Jane', 'Smith');
`;

// Lec 04: the slides' Product table, CDCollection (slides 44-45), and tables for the escape examples (slides 31-33).
const GIZ = CS + `CREATE TABLE Product (
  pname        VARCHAR2(20) PRIMARY KEY,
  price        NUMBER(7,2),
  category     VARCHAR2(20),
  manufacturer VARCHAR2(20)
);
INSERT INTO Product VALUES ('Gizmo',       19.99,  'Gadgets',     'GizmoWorks');
INSERT INTO Product VALUES ('Powergizmo',  29.99,  'Gadgets',     'GizmoWorks');
INSERT INTO Product VALUES ('SingleTouch', 149.99, 'Photography', 'Canon');
INSERT INTO Product VALUES ('MultiTouch',  203.99, 'Household',   'Hitachi');
CREATE TABLE CDCollection (
  artist  VARCHAR2(20),
  album   VARCHAR2(30),
  tracks  NUMBER(3),
  company VARCHAR2(20),
  year    NUMBER(4)
);
INSERT INTO CDCollection VALUES ('U2',         'The Unforgettable', 10, 'Island', 1984);
INSERT INTO CDCollection VALUES ('U2',         'Rattle and Hum',    17, 'Island', 1988);
INSERT INTO CDCollection VALUES ('U2',         'Achtung Boys',      12, 'Island', 1991);
INSERT INTO CDCollection VALUES ('Underworld', 'Second Toughest',    8, 'Junior', 1996);
CREATE TABLE Company (
  cname   VARCHAR2(30),
  country VARCHAR2(20)
);
INSERT INTO Company VALUES ('Baby''s World',    'USA');
INSERT INTO Company VALUES ('Aarong',           'Bangladesh');
INSERT INTO Company VALUES ('Mother''s Choice', 'USA_Canada');
INSERT INTO Company VALUES ('Walton',           'Bangladesh');
INSERT INTO Company VALUES ('North_Star Ltd',   'Canada');
CREATE TABLE Bank (
  bname         VARCHAR2(30),
  interestRates VARCHAR2(10)
);
INSERT INTO Bank VALUES ('Sonali Bank',       '7.5%');
INSERT INTO Bank VALUES ('BRAC Bank',         '9%');
INSERT INTO Bank VALUES ('City Bank',         '8.25');
INSERT INTO Bank VALUES ('Dutch-Bangla Bank', '10%');
INSERT INTO Bank VALUES ('Prime Bank',        '%6 promo');
`;

// Practice table modelled on Oracle's HR sample schema (the EMPLOYEES table used in the exam questions).
const HR = CS + `CREATE TABLE Employees (
  employee_id    NUMBER(6) PRIMARY KEY,
  first_name     VARCHAR2(20),
  last_name      VARCHAR2(25),
  email          VARCHAR2(25),
  phone_number   VARCHAR2(20),
  hire_date      DATE,
  job_id         VARCHAR2(10),
  salary         NUMBER(8,2),
  commission_pct NUMBER(2,2),
  manager_id     NUMBER(6),
  department_id  NUMBER(4)
);
INSERT INTO Employees VALUES (100, 'Steven',    'King',      'SKING',    '515.123.4567',       DATE '2003-06-17', 'AD_PRES',  24000, NULL, NULL, 90);
INSERT INTO Employees VALUES (101, 'Neena',     'Kochhar',   'NKOCHHAR', '515.123.4568',       DATE '2005-09-21', 'AD_VP',    17000, NULL, 100,  90);
INSERT INTO Employees VALUES (102, 'Lex',       'De Haan',   'LDEHAAN',  '515.123.4569',       DATE '2001-01-13', 'AD_VP',    17000, NULL, 100,  90);
INSERT INTO Employees VALUES (103, 'Alexander', 'Hunold',    'AHUNOLD',  '590.423.4567',       DATE '2006-01-03', 'IT_PROG',   9000, NULL, 102,  60);
INSERT INTO Employees VALUES (104, 'Bruce',     'Ernst',     'BERNST',   '590.423.4568',       DATE '2007-05-21', 'IT_PROG',   6000, NULL, 103,  60);
INSERT INTO Employees VALUES (107, 'Diana',     'Lorentz',   'DLORENTZ', '590.423.5567',       DATE '2007-02-07', 'IT_PROG',   4200, NULL, 103,  60);
INSERT INTO Employees VALUES (124, 'Kevin',     'Mourgos',   'KMOURGOS', '650.123.5234',       DATE '2007-11-16', 'ST_MAN',    5800, NULL, 100,  50);
INSERT INTO Employees VALUES (141, 'Trenna',    'Rajs',      'TRAJS',    '650.121.8009',       DATE '2003-10-17', 'ST_CLERK',  3500, NULL, 124,  50);
INSERT INTO Employees VALUES (142, 'Curtis',    'Davies',    'CDAVIES',  '650.121.2994',       DATE '2005-01-29', 'ST_CLERK',  3100, NULL, 124,  50);
INSERT INTO Employees VALUES (143, 'Randall',   'Matos',     'RMATOS',   '650.121.2874',       DATE '2006-03-15', 'ST_CLERK',  2600, NULL, 124,  50);
INSERT INTO Employees VALUES (149, 'Eleni',     'Zlotkey',   'EZLOTKEY', '011.44.1344.429018', DATE '2008-01-29', 'SA_MAN',   10500, 0.2,  100,  80);
INSERT INTO Employees VALUES (174, 'Ellen',     'Abel',      'EABEL',    '011.44.1644.429267', DATE '2004-05-11', 'SA_REP',   11000, 0.3,  149,  80);
INSERT INTO Employees VALUES (176, 'Jonathon',  'Taylor',    'JTAYLOR',  '011.44.1644.429265', DATE '2006-03-24', 'SA_REP',    8600, 0.2,  149,  80);
INSERT INTO Employees VALUES (178, 'Kimberely', 'Grant',     'KGRANT',   '011.44.1644.429263', DATE '2007-05-24', 'SA_REP',    7000, 0.15, 149,  NULL);
INSERT INTO Employees VALUES (200, 'Jennifer',  'Whalen',    'JWHALEN',  '515.123.4444',       DATE '2003-09-17', 'AD_ASST',   4400, NULL, 101,  10);
INSERT INTO Employees VALUES (201, 'Michael',   'Hartstein', 'MHARTSTE', '515.123.5555',       DATE '2004-02-17', 'MK_MAN',   13000, NULL, 100,  20);
INSERT INTO Employees VALUES (202, 'Pat',       'Fay',       'PFAY',     '603.123.6666',       DATE '2005-08-17', 'MK_REP',    6000, NULL, 201,  20);
`;

// Lec 04 slides 12-15 and all of Lec 05: the textbook's products database (Garcia-Molina et al., Figs. 2.20 and 2.21).
const PCS = CS + `CREATE TABLE Product (
  maker CHAR(1),
  model NUMBER(4) PRIMARY KEY,
  type  VARCHAR2(10)
);
INSERT INTO Product VALUES ('A', 1001, 'pc');
INSERT INTO Product VALUES ('A', 1002, 'pc');
INSERT INTO Product VALUES ('A', 1003, 'pc');
INSERT INTO Product VALUES ('A', 2004, 'laptop');
INSERT INTO Product VALUES ('A', 2005, 'laptop');
INSERT INTO Product VALUES ('A', 2006, 'laptop');
INSERT INTO Product VALUES ('B', 1004, 'pc');
INSERT INTO Product VALUES ('B', 1005, 'pc');
INSERT INTO Product VALUES ('B', 1006, 'pc');
INSERT INTO Product VALUES ('B', 2007, 'laptop');
INSERT INTO Product VALUES ('C', 1007, 'pc');
INSERT INTO Product VALUES ('D', 1008, 'pc');
INSERT INTO Product VALUES ('D', 1009, 'pc');
INSERT INTO Product VALUES ('D', 1010, 'pc');
INSERT INTO Product VALUES ('D', 3004, 'printer');
INSERT INTO Product VALUES ('D', 3005, 'printer');
INSERT INTO Product VALUES ('E', 1011, 'pc');
INSERT INTO Product VALUES ('E', 1012, 'pc');
INSERT INTO Product VALUES ('E', 1013, 'pc');
INSERT INTO Product VALUES ('E', 2001, 'laptop');
INSERT INTO Product VALUES ('E', 2002, 'laptop');
INSERT INTO Product VALUES ('E', 2003, 'laptop');
INSERT INTO Product VALUES ('E', 3001, 'printer');
INSERT INTO Product VALUES ('E', 3002, 'printer');
INSERT INTO Product VALUES ('E', 3003, 'printer');
INSERT INTO Product VALUES ('F', 2008, 'laptop');
INSERT INTO Product VALUES ('F', 2009, 'laptop');
INSERT INTO Product VALUES ('G', 2010, 'laptop');
INSERT INTO Product VALUES ('H', 3006, 'printer');
INSERT INTO Product VALUES ('H', 3007, 'printer');
CREATE TABLE PC (
  model NUMBER(4) PRIMARY KEY,
  speed NUMBER(3,2),
  ram   NUMBER(5),
  hd    NUMBER(4),
  price NUMBER(6)
);
INSERT INTO PC VALUES (1001, 2.66, 1024, 250, 2114);
INSERT INTO PC VALUES (1002, 2.10,  512, 250,  995);
INSERT INTO PC VALUES (1003, 1.42,  512,  80,  478);
INSERT INTO PC VALUES (1004, 2.80, 1024, 250,  649);
INSERT INTO PC VALUES (1005, 3.20,  512, 250,  630);
INSERT INTO PC VALUES (1006, 3.20, 1024, 320, 1049);
INSERT INTO PC VALUES (1007, 2.20, 1024, 200,  510);
INSERT INTO PC VALUES (1008, 2.20, 2048, 250,  770);
INSERT INTO PC VALUES (1009, 2.00, 1024, 250,  650);
INSERT INTO PC VALUES (1010, 2.80, 2048, 300,  770);
INSERT INTO PC VALUES (1011, 1.86, 2048, 160,  959);
INSERT INTO PC VALUES (1012, 2.80, 1024, 160,  649);
INSERT INTO PC VALUES (1013, 3.06,  512,  80,  529);
CREATE TABLE Laptop (
  model  NUMBER(4) PRIMARY KEY,
  speed  NUMBER(3,2),
  ram    NUMBER(5),
  hd     NUMBER(4),
  screen NUMBER(3,1),
  price  NUMBER(6)
);
INSERT INTO Laptop VALUES (2001, 2.00, 2048, 240, 20.1, 3673);
INSERT INTO Laptop VALUES (2002, 1.73, 1024,  80, 17.0,  949);
INSERT INTO Laptop VALUES (2003, 1.80,  512,  60, 15.4,  549);
INSERT INTO Laptop VALUES (2004, 2.00,  512,  60, 13.3, 1150);
INSERT INTO Laptop VALUES (2005, 2.16, 1024, 120, 17.0, 2500);
INSERT INTO Laptop VALUES (2006, 2.00, 2048,  80, 15.4, 1700);
INSERT INTO Laptop VALUES (2007, 1.83, 1024, 120, 13.3, 1429);
INSERT INTO Laptop VALUES (2008, 1.60, 1024, 100, 15.4,  900);
INSERT INTO Laptop VALUES (2009, 1.60,  512,  80, 14.1,  680);
INSERT INTO Laptop VALUES (2010, 2.00, 2048, 160, 15.4, 2300);
CREATE TABLE Printer (
  model NUMBER(4) PRIMARY KEY,
  color CHAR(1),
  type  VARCHAR2(10),
  price NUMBER(6)
);
INSERT INTO Printer VALUES (3001, 'T', 'ink-jet',  99);
INSERT INTO Printer VALUES (3002, 'F', 'laser',   239);
INSERT INTO Printer VALUES (3003, 'T', 'laser',   899);
INSERT INTO Printer VALUES (3004, 'T', 'ink-jet', 120);
INSERT INTO Printer VALUES (3005, 'F', 'laser',   120);
INSERT INTO Printer VALUES (3006, 'T', 'ink-jet', 100);
INSERT INTO Printer VALUES (3007, 'T', 'laser',   200);
`;

// The slides' 4-row Product table as JS data (for animations).
const GIZ_HEAD = ['pname', 'price', 'category', 'manufacturer'];
const GIZ_ROWS = [['Gizmo', 19.99, 'Gadgets', 'GizmoWorks'], ['Powergizmo', 29.99, 'Gadgets', 'GizmoWorks'],
  ['SingleTouch', 149.99, 'Photography', 'Canon'], ['MultiTouch', 203.99, 'Household', 'Hitachi']];

// ---------- figure helpers ----------
const NUL = '<span class="sq-null">NULL</span>';
const cellTxt = v => v == null ? NUL : String(v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Relation drawn as a table. rows: arrays or {c: [...], cls: 'hl'|'del'|'new'|'dim', side, lab}.
// o: {name, dim: [colIdx], hl: [colIdx], lab: bool}
function T(head, rows, o = {}) {
  const dim = new Set(o.dim || []), hl = new Set(o.hl || []);
  const cc = j => dim.has(j) ? ' class="dimc"' : hl.has(j) ? ' class="hlc"' : '';
  let h = (o.name ? `<div class="figlabel">${o.name}</div>` : '') + '<table class="rec">';
  h += `<tr>${o.lab ? '<td class="lab"></td>' : ''}${head.map((c, j) => `<th${cc(j)}>${c}</th>`).join('')}</tr>`;
  for (const r0 of rows) {
    const r = Array.isArray(r0) ? { c: r0 } : r0;
    h += `<tr class="${r.cls || ''}">${o.lab ? `<td class="lab">${r.lab ?? ''}</td>` : ''}` +
      r.c.map((v, j) => `<td${cc(j)}>${cellTxt(v)}</td>`).join('') + `<td class="side">${r.side || ''}</td></tr>`;
  }
  if (!rows.length) h += `<tr><td colspan="${head.length + (o.lab ? 1 : 0)}" class="empty-rel">(no rows)</td></tr>`;
  return `<div class="relt">${h}</table></div>`;
}
// SQL text with one or more clause lines highlighted. lines: [[key, text]], on: key or [keys], done: [keys]
function Q(lines, on, done = []) {
  const ons = [].concat(on || []);
  return `<pre class="qcode">${lines.map(([k, t]) => `<span class="${ons.includes(k) ? 'on' : done.includes(k) ? 'done' : ''}">${cellTxt(t)}</span>`).join('')}</pre>`;
}
const frameHTML = (q, body) => `<div class="evf">${q}<div class="evt">${body}</div></div>`;

// Oracle's default ORDER BY: NULLs sort as if larger than any value (last for ASC, first for DESC).
function oraCmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
const tv = x => x === true ? '<b class="good">TRUE</b>' : x === false ? '<b class="bad">FALSE</b>' : '<b class="mid">UNKNOWN</b>';

// Step-through evaluation of a single-table SELECT in the logical order FROM → WHERE → SELECT → DISTINCT → ORDER BY.
// s = {name, head, rows, sql: [[key, text]] with keys from/where/select/order, where: {test(r) → true/false/null, why(r)},
//      cols: [colIdx] (null = *), distinct, order: [[colIdx in head, 'ASC'|'DESC']], perRow, colsNote}
function selectSteps(s) {
  const steps = [], L = s.sql, hasWhere = !!s.where;
  const done = [];
  steps.push({ html: frameHTML(Q(L, 'from'), T(s.head, s.rows, { name: s.name })),
    cap: `<b>1 · FROM.</b> Evaluation starts with the table in the FROM clause: all ${s.rows.length} rows of <code>${s.name}</code>.${s.colsNote ? ' ' + s.colsNote : ''}` });
  done.push('from');
  let keep = s.rows.map(r => ({ r, ok: true }));
  if (hasWhere) {
    const res = s.rows.map(r => s.where.test(r));
    const mark = (upto) => s.rows.map((r, i) => i > upto ? { c: r } :
      { c: r, cls: res[i] === true ? 'hl' : 'del', side: (s.where.why ? s.where.why(r) + ' → ' : '') + tv(res[i]) });
    if (s.perRow) s.rows.forEach((r, i) => steps.push({ html: frameHTML(Q(L, 'where', done), T(s.head, mark(i), { name: s.name })),
      cap: `<b>2 · WHERE, row ${i + 1}.</b> Test the condition on this row: ${s.where.why ? s.where.why(r) + ', so the condition is ' : ''}${tv(res[i])}. ${res[i] === true ? 'The row is kept.' : 'Only TRUE rows are kept, so this row is dropped.'}` }));
    else steps.push({ html: frameHTML(Q(L, 'where', done), T(s.head, mark(s.rows.length), { name: s.name })),
      cap: `<b>2 · WHERE.</b> The condition is tested on every row. Rows where it is TRUE are kept (highlighted); rows where it is FALSE${res.includes(null) ? ' or UNKNOWN' : ''} are dropped (struck through).` });
    keep = s.rows.map((r, i) => ({ r, ok: res[i] === true })).filter(x => x.ok);
    steps.push({ html: frameHTML(Q(L, 'where', done), T(s.head, keep.map(x => x.r), { name: 'after WHERE' })),
      cap: `<b>2 · WHERE, result.</b> ${keep.length} of ${s.rows.length} rows survive. This is <i>selection</i> (σ in relational algebra): it chooses rows.` });
    done.push('where');
  }
  const cols = s.cols || s.head.map((_, j) => j);
  if (s.cols) {
    const dim = s.head.map((_, j) => j).filter(j => !cols.includes(j));
    steps.push({ html: frameHTML(Q(L, 'select', done), T(s.head, keep.map(x => x.r), { name: hasWhere ? 'after WHERE' : s.name, dim })),
      cap: `<b>3 · SELECT.</b> Only now is the SELECT list used: keep the columns ${cols.map(j => `<code>${s.head[j]}</code>`).join(', ')} and drop the greyed ones. This is <i>projection</i> (π): it chooses columns.` });
  }
  let out = keep.map(x => ({ r: x.r, p: cols.map(j => x.r[j]) }));
  const ph = cols.map(j => s.head[j]);
  steps.push({ html: frameHTML(Q(L, 'select', done), T(ph, out.map(x => x.p), { name: 'after SELECT' })),
    cap: `<b>3 · SELECT, result.</b> ${s.cols ? `Each surviving row is cut down to ${cols.length} column${cols.length > 1 ? 's' : ''}.` : '<code>*</code> keeps every column.'} ${s.distinct ? 'Notice the duplicate rows: projection can create them.' : `The output has ${out.length} row${out.length === 1 ? '' : 's'}.`}` });
  done.push('select');
  if (s.distinct) {
    const seen = new Set(), dup = out.map(x => { const k = JSON.stringify(x.p); const d = seen.has(k); seen.add(k); return d; });
    steps.push({ html: frameHTML(Q(L, 'select', done.filter(k => k !== 'select')), T(ph, out.map((x, i) => ({ c: x.p, cls: dup[i] ? 'del' : '', side: dup[i] ? 'duplicate' : '' })), { name: 'DISTINCT' })),
      cap: '<b>4 · DISTINCT.</b> Compare whole output rows. A row equal to an earlier one (in every selected column) is a duplicate and is removed.' });
    out = out.filter((_, i) => !dup[i]);
    steps.push({ html: frameHTML(Q(L, 'select', done), T(ph, out.map(x => x.p), { name: 'after DISTINCT' })),
      cap: `<b>4 · DISTINCT, result.</b> ${out.length} distinct row${out.length === 1 ? '' : 's'} remain. Without DISTINCT, SQL keeps duplicates (a <i>bag</i>, not a set).` });
  }
  if (s.order) {
    const keyIdx = s.order.map(([j, d]) => [cols.indexOf(j), d, j]);
    const sorted = [...out].sort((a, b) => {
      for (const [pj, d, j] of keyIdx) {
        const va = pj >= 0 ? a.p[pj] : a.r[j], vb = pj >= 0 ? b.p[pj] : b.r[j];
        const c = oraCmp(va, vb) * (d === 'DESC' ? -1 : 1);
        if (c) return c;
      }
      return 0;
    });
    steps.push({ html: frameHTML(Q(L, 'order', done), T(ph, sorted.map(x => x.p), { name: 'final result', hl: keyIdx.filter(k => k[0] >= 0).map(k => k[0]) })),
      cap: `<b>5 · ORDER BY.</b> Last of all, the output rows are sorted by ${s.order.map(([j, d]) => `<code>${s.head[j]}</code> ${d === 'DESC' ? 'descending' : 'ascending'}`).join(', then ')}. ORDER BY never adds or removes rows.` });
    out = sorted;
  } else {
    steps[steps.length - 1].cap += ' <b>This is the final result.</b>' + (s.distinct || !s.order ? ' With no ORDER BY, the order of rows is not guaranteed.' : '');
  }
  return steps;
}
function selectAnim(sel, s) { return stepper(sel, selectSteps(s), { interval: 2300 }); }

// ---------- query anatomy (labelled clauses and evaluation order) ----------
function anatomySVG() {
  const cw = 9.6, x0 = 64, ys = [52, 112, 172, 232];
  const lines = [
    [['SELECT', 'kw'], [' '], ['DISTINCT', 'kw2'], [' '], ['category', 'id']],
    [['FROM', 'kw'], ['   '], ['Product', 'id']],
    [['WHERE', 'kw'], ['  '], ['price < 200', 'id']],
    [['ORDER BY', 'kw'], [' '], ['category', 'id'], [' '], ['DESC', 'kw2'], [';', 'id']],
  ];
  const piece = [[[0, 'keyword'], [7, 'modifier'], [16, 'select list']], [[0, 'keyword'], [7, 'table name']],
    [[0, 'keyword'], [7, 'condition (predicate)']], [[0, 'keyword'], [9, 'sort key'], [18, 'direction']]];
  const badge = [3, 1, 2, 5];
  let s = '';
  lines.forEach((ln, i) => {
    let col = 0, t = '';
    ln.forEach(([txt, k]) => { if (k) t += `<tspan x="${x0 + col * cw}" class="${k === 'kw' ? 'acc' : k === 'kw2' ? 'red' : ''}" style="font-weight:${k === 'id' ? 400 : 600}">${txt.replace(/</g, '&lt;')}</tspan>`; col += txt.length; });
    s += `<text y="${ys[i]}" style="font-size:16px">${t}</text>`;
    piece[i].forEach(([c, lab]) => { s += `<text x="${x0 + c * cw}" y="${ys[i] + 20}" class="lbl">${lab}</text>`; });
    s += `<circle cx="34" cy="${ys[i] - 6}" r="13" class="cell-hl"/><text x="34" y="${ys[i] - 1}" text-anchor="middle" class="big">${badge[i]}</text>`;
  });
  s += `<circle cx="${x0 + 10.5 * cw}" cy="${ys[0] - 30}" r="11" class="cell-hl"/><text x="${x0 + 10.5 * cw}" y="${ys[0] - 26}" text-anchor="middle" class="big" style="font-size:12px">4</text>`;
  s += `<rect x="14" y="10" width="${x0 + 26 * cw - 4}" height="250" rx="8" class="s-fg dash"/>`;
  const R = 360, notes = [
    ['1 · FROM', 'which table the rows come from', 'required'],
    ['2 · WHERE', 'keep only rows where the condition is TRUE', 'optional (selection, σ)'],
    ['3 · SELECT', 'which columns or expressions to output', 'required (projection, π)'],
    ['4 · DISTINCT', 'remove duplicate output rows', 'optional; default is ALL'],
    ['5 · ORDER BY', 'sort the output (ASC default, or DESC)', 'optional; always written last'],
  ];
  notes.forEach(([a, b, c], i) => {
    const y = 26 + i * 50;
    s += `<text x="${R}" y="${y}" class="big">${a}</text><text x="${R}" y="${y + 17}" style="font-size:13px">${b}</text><text x="${R}" y="${y + 31}" class="lbl">${c}</text>`;
  });
  return `<svg viewBox="0 0 700 270" width="700" role="img" aria-label="Anatomy of a SELECT statement: clauses labelled with their evaluation order 1 FROM, 2 WHERE, 3 SELECT, 4 DISTINCT, 5 ORDER BY">${s}</svg>`;
}

// ---------- LIKE pattern matching ----------
function likeTokens(p, esc) {
  const t = [];
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (esc && c === esc && i + 1 < p.length) { t.push({ k: 'lit', c: p[++i], esc: true }); continue; }
    t.push(c === '%' ? { k: 'any' } : c === '_' ? { k: 'one' } : { k: 'lit', c });
  }
  return t;
}
// Returns {ok, spans: [[a, b)] per matched token, upto (tokens matched), at (position reached)}
function likeAlign(s, p, esc) {
  const T = likeTokens(p, esc), n = s.length, reach = [new Map([[0, -1]])];
  for (let i = 0; i < T.length; i++) {
    const nx = new Map(), tk = T[i];
    for (const j of [...reach[i].keys()].sort((a, b) => a - b)) {
      if (tk.k === 'any') { for (let k = j; k <= n; k++) if (!nx.has(k)) nx.set(k, j); }
      else if (j < n && (tk.k === 'one' || s[j] === tk.c)) { if (!nx.has(j + 1)) nx.set(j + 1, j); }
    }
    reach.push(nx);
    if (!nx.size) break;
  }
  const back = (i, j) => { const sp = []; for (let k = i; k > 0; k--) { const pj = reach[k].get(j); sp.unshift([pj, j]); j = pj; } return sp; };
  if (reach.length === T.length + 1 && reach[T.length].has(n)) return { T, ok: true, spans: back(T.length, n), upto: T.length, at: n };
  let i = reach.length - 1; if (!reach[i].size) i--;
  const at = Math.max(...reach[i].keys());
  return { T, ok: false, spans: back(i, at), upto: i, at };
}
const tokName = t => t.k === 'any' ? '%' : t.k === 'one' ? '_' : (t.esc ? '\\' : '') + t.c;
function likeSVG(s, res, upto, failTok) {
  const cw = 24, x0 = 16, n = s.length, W = Math.max(260, x0 * 2 + n * cw + 40);
  let g = '';
  const owner = new Array(n).fill(-1);
  res.spans.slice(0, upto).forEach(([a, b], k) => { for (let j = a; j < b; j++) owner[j] = k; });
  for (let j = 0; j < n; j++) {
    const k = owner[j], t = k >= 0 ? res.T[k] : null;
    const cls = !t ? 'cell-plain' : t.k === 'lit' ? 'cell-hl' : t.k === 'one' ? 'cell-new' : 'cell';
    g += `<rect x="${x0 + j * cw}" y="20" width="${cw - 2}" height="28" class="${cls}"/><text x="${x0 + j * cw + 11}" y="39" text-anchor="middle" style="font-size:14px">${s[j] === ' ' ? '␣' : cellTxt(s[j])}</text>`;
    g += `<text x="${x0 + j * cw + 11}" y="14" text-anchor="middle" class="lbl">${j + 1}</text>`;
  }
  res.spans.slice(0, upto).forEach(([a, b], k) => {
    const t = res.T[k], cur = k === upto - 1;
    const xa = x0 + a * cw, xb = x0 + b * cw - 2, cls = cur ? 's-red' : 's-acc';
    if (b > a) g += `<path d="M${xa} 54 L${xa} 60 L${xb} 60 L${xb} 54" class="${cls}"/><text x="${(xa + xb) / 2}" y="76" text-anchor="middle" class="${cur ? 'red' : 'acc'} big">${cellTxt(tokName(t))}</text>`;
    else g += `<path d="M${xa - 1} 52 l-5 10 l10 0 z" class="${cls}"/><text x="${xa - 1}" y="76" text-anchor="middle" class="${cur ? 'red' : 'acc'} big">${cellTxt(tokName(t))}</text><text x="${xa - 1}" y="90" text-anchor="middle" class="lbl">empty</text>`;
  });
  if (failTok != null) {
    const xa = x0 + res.at * cw;
    g += `<path d="M${xa} 52 L${xa} 64" class="s-red"/><text x="${xa + 4}" y="${n ? 100 : 76}" class="red big">${failTok}</text>`;
  }
  return `<svg viewBox="0 0 ${W} 108" width="${Math.round(W * 1.5)}" role="img" aria-label="LIKE alignment">${g}</svg>`;
}
function likeSteps(s, p, esc) {
  const res = likeAlign(s, p, esc), steps = [];
  const desc = t => t.k === 'any' ? '<code>%</code> matches any sequence of characters, including none' : t.k === 'one' ? '<code>_</code> matches exactly one character' : `the literal <code>${cellTxt(t.c)}</code>${t.esc ? ' (escaped, so it is an ordinary character)' : ''} must match itself exactly (case matters)`;
  steps.push({ html: likeSVG(s, res, 0), cap: `Test <code>'${cellTxt(s)}' LIKE '${cellTxt(p)}'</code>${esc ? ` ESCAPE '${cellTxt(esc)}'` : ''}. The pattern has ${res.T.length} token${res.T.length === 1 ? '' : 's'}: ${res.T.map(t => `<code>${cellTxt(tokName(t))}</code>`).join(' ')}. The whole string must be covered by the whole pattern, left to right.` });
  res.spans.forEach(([a, b], k) => {
    const t = res.T[k], got = s.slice(a, b);
    steps.push({ html: likeSVG(s, res, k + 1), cap: `Token ${k + 1}: ${desc(t)}. It takes ${b > a ? `<code>'${cellTxt(got)}'</code> (${b - a === 1 ? 'character ' + (a + 1) : `characters ${a + 1}–${b}`})` : 'nothing (an empty sequence)'}.${t.k === 'any' ? ' Of all the lengths % could take, this is the one that lets the rest of the pattern match.' : ''}` });
  });
  if (res.ok) steps.push({ html: likeSVG(s, res, res.T.length), cap: `Every token matched and every character is covered: the result is ${tv(true)}.` });
  else {
    const t = res.T[res.upto];
    const why = res.upto === res.T.length ? `The pattern is used up, but characters ${res.at + 1}–${s.length} (<code>'${cellTxt(s.slice(res.at))}'</code>) are left over and there is no final <code>%</code> to absorb them`
      : t.k === 'lit' ? `Token ${res.upto + 1} needs <code>${cellTxt(t.c)}</code>, but ${res.at < s.length ? `the next character is <code>${cellTxt(s[res.at])}</code>` : 'the string has ended'}${res.upto && res.T.slice(0, res.upto).some(x => x.k === 'any') ? ', and no other length for the earlier % fixes this' : ''}`
      : `Token ${res.upto + 1} (<code>_</code>) needs one more character, but the string has ended`;
    steps.push({ html: likeSVG(s, res, res.upto, res.upto < res.T.length ? 'no match for ' + tokName(t) : 'left over'), cap: `${why}. The result is ${tv(false)}.` });
  }
  return steps;
}
// Interactive tool: pattern + string (+ optional escape) → animated match.
function likeTool(sel, init) {
  const host = $(sel);
  host.innerHTML = `<form class="bp-form" data-f><label>string <input data-s value="${init.s}" style="width:12em"></label>
    <label>LIKE <input data-p value="${init.p}" style="width:9em"></label>
    <label>ESCAPE <input data-e value="${init.e || ''}" maxlength="1" style="width:3em"></label><button type="submit">Match ▶</button></form><div data-out></div>`;
  const out = host.querySelector('[data-out]');
  const go = () => {
    const s = host.querySelector('[data-s]').value, p = host.querySelector('[data-p]').value, e = host.querySelector('[data-e]').value;
    if (!p) { out.innerHTML = '<p class="sq-msg err">Type a pattern, for example <code>%Touch</code>.</p>'; return; }
    if (s.length > 28) { out.innerHTML = '<p class="sq-msg err">Please use a string of at most 28 characters so the figure fits.</p>'; return; }
    out.innerHTML = '<div></div>'; stepper(out.firstChild, likeSteps(s, p, e || null), { interval: 1800 });
  };
  host.querySelector('[data-f]').addEventListener('submit', ev => { ev.preventDefault(); go(); });
  go();
}

// ---------- Oracle NUMBER(p, s) ----------
// Returns {ok, stored, msg}. Rounds half away from zero at scale s, then requires |value| < 10^(p - s).
function oraNumber(v, p, s) {
  v = String(v).replace(/[,\s]/g, '');
  const m = v.match(/^([+-]?)(\d*)(?:\.(\d*))?$/);
  if (!m || (!m[2] && !m[3])) return { err: 'Enter a plain decimal number such as 7456123.89.' };
  if (p === '' || p == null) return { ok: true, stored: v.replace(/^\+/, ''), msg: 'NUMBER with no precision stores the value as given (up to 38 significant digits).' };
  p = +p; s = s === '' || s == null ? 0 : +s;
  if (!Number.isInteger(p) || p < 1 || p > 38) return { err: 'Precision p must be a whole number from 1 to 38.' };
  if (!Number.isInteger(s) || s < -84 || s > 127) return { err: 'Scale s must be a whole number from −84 to 127.' };
  const neg = m[1] === '-', frac = m[3] || '', digits = BigInt((m[2] || '0') + frac);
  let q;                                          // value × 10^s, rounded to an integer
  if (s >= frac.length) q = digits * 10n ** BigInt(s - frac.length);
  else { const d = 10n ** BigInt(frac.length - s); q = digits / d; if ((digits % d) * 2n >= d) q += 1n; }
  const fmt = () => {
    if (s <= 0) return (q * 10n ** BigInt(-s)).toString();
    const t = q.toString().padStart(s + 1, '0'); return t.slice(0, -s) + '.' + t.slice(-s);
  };
  const lim = 10n ** BigInt(p);
  if (q >= lim) return { ok: false, msg: `After rounding to ${s} decimal place${Math.abs(s) === 1 ? '' : 's'}${s < 0 ? ' (that is, to the nearest ' + 10 ** -s + ')' : ''}, the value needs more than p − s = ${p - s} digit${p - s === 1 ? '' : 's'} before the decimal point. Oracle rejects it (ORA-01438: value larger than specified precision allowed for this column).` };
  return { ok: true, stored: (neg && q ? '-' : '') + fmt(), msg: `Rounded at scale ${s}; it fits, because at most p − s = ${p - s} digit${p - s === 1 ? ' is' : 's are'} allowed before the decimal point.` };
}
function numberTool(sel, init = { v: '7456123.89', p: '9', s: '2' }) {
  const host = $(sel);
  host.innerHTML = `<form class="bp-form" data-f><label>value <input data-v value="${init.v}" style="width:9em"></label>
    <label>NUMBER( <input data-p value="${init.p}" style="width:3.5em"></label><label>, <input data-s value="${init.s}" style="width:3.5em"> )</label>
    <button type="submit">Store ▶</button></form><div class="ask-r" data-o aria-live="polite"></div>`;
  const go = () => {
    const r = oraNumber(host.querySelector('[data-v]').value, host.querySelector('[data-p]').value.trim(), host.querySelector('[data-s]').value.trim()), o = host.querySelector('[data-o]');
    o.className = 'ask-r ' + (r.err ? 'bad' : r.ok ? 'ok' : 'bad');
    o.innerHTML = r.err ? r.err : r.ok ? `<b>Stored: ${r.stored}</b>. ${r.msg}` : `<b>Rejected.</b> ${r.msg}`;
  };
  host.querySelector('[data-f]').addEventListener('submit', e => { e.preventDefault(); go(); });
  go();
}

// ---------- three-valued logic ----------
const TV = { T: true, F: false, U: null };
const and3 = (a, b) => a === false || b === false ? false : a === true && b === true ? true : null;
const or3 = (a, b) => a === true || b === true ? true : a === false && b === false ? false : null;
const not3 = a => a == null ? null : !a;
const tvs = x => x === true ? '<span class="tv-t">TRUE</span>' : x === false ? '<span class="tv-f">FALSE</span>' : '<span class="tv-u">UNKNOWN</span>';
function truthTables(sel) {
  const vals = [true, null, false];
  const grid = (name, f) => `<div><div class="figlabel">${name}</div><table class="tvt"><tr><th>A \\ B</th>${vals.map(b => `<th>${tvs(b)}</th>`).join('')}</tr>` +
    vals.map(a => `<tr><th>${tvs(a)}</th>${vals.map(b => `<td>${tvs(f(a, b))}</td>`).join('')}</tr>`).join('') + '</table></div>';
  $(sel).innerHTML = `<div class="figrow">${grid('A AND B', and3)}${grid('A OR B', or3)}<div><div class="figlabel">NOT A</div><table class="tvt"><tr><th>A</th><th>NOT A</th></tr>${vals.map(a => `<tr><th>${tvs(a)}</th><td>${tvs(not3(a))}</td></tr>`).join('')}</table></div></div>`;
}
function tvlTool(sel) {
  const host = $(sel), opt = `<option value="T">TRUE</option><option value="U">UNKNOWN</option><option value="F">FALSE</option>`;
  host.innerHTML = `<form class="bp-form" data-f><label>A = <select data-a>${opt}</select></label><label>B = <select data-b>${opt}</select></label></form><div data-o></div>`;
  const num = x => x === true ? '1' : x === false ? '0' : '½';
  const go = () => {
    const a = TV[host.querySelector('[data-a]').value], b = TV[host.querySelector('[data-b]').value];
    host.querySelector('[data-o]').innerHTML = `<div class="tbl"><table><tr><th>Expression</th><th>As numbers (TRUE = 1, UNKNOWN = ½, FALSE = 0)</th><th>Result</th></tr>
      <tr><td>A AND B</td><td>min(${num(a)}, ${num(b)}) = ${num(and3(a, b))}</td><td>${tvs(and3(a, b))}</td></tr>
      <tr><td>A OR B</td><td>max(${num(a)}, ${num(b)}) = ${num(or3(a, b))}</td><td>${tvs(or3(a, b))}</td></tr>
      <tr><td>NOT A</td><td>1 − ${num(a)} = ${num(not3(a))}</td><td>${tvs(not3(a))}</td></tr></table></div>
      <p class="sq-note">A row is returned by WHERE only if the whole condition is TRUE.</p>`;
  };
  host.querySelector('[data-f]').addEventListener('change', go);
  go();
}

// ---------- DML before/after frames ----------
// Build a stepper frame: SQL (with highlighted lines) above one or two tables.
const dmlFrame = (lines, on, tables) => frameHTML(Q(lines, on), `<div class="figrow">${tables.join('')}</div>`);

// Exercise shorthand: chk('#x', SETUP, 'task', 'solution', {ordered, hint, check, table})
function chk(sel, setup, task, solution, o = {}) { sqlCheck(sel, { setup, task, solution, ...o }); }
