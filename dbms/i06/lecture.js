// Lec 06 (Ishrak): shared sample data, figure helpers and the foreign-key simulator.

// ---------- sample databases (Oracle syntax; sqlplay.js translates for SQLite) ----------
const EMP0 = [[1, 'A', 'X', 'M'], [2, 'B', 'Y', 'M'], [3, 'C', 'Z', 'F'], [4, 'D', 'W', 'M']];
const DEPT0 = [['CSE', 2], ['EEE', 4], ['ME', 1]];
const EMP_SQL = `CREATE TABLE Employee (
  id      INT PRIMARY KEY,
  name    CHAR(20),
  address CHAR(20),
  gender  CHAR(1)
);
` + EMP0.map(r => `INSERT INTO Employee VALUES (${r[0]}, '${r[1]}', '${r[2]}', '${r[3]}');`).join('\n') + '\n';
const DEPT_ROWS = DEPT0.map(r => `INSERT INTO Department VALUES ('${r[0]}', ${r[1]});`).join('\n') + '\n';
// Employee (master) + Department (foreign table) exactly as on slides 10–23, with a chosen referential action.
const edSetup = (action = '') => EMP_SQL + `CREATE TABLE Department (
  name CHAR(3),
  head INT REFERENCES Employee(id)${action ? '\n           ' + action : ''}
);
` + DEPT_ROWS;
const ED = edSetup();
const ED_SETNULL = edSetup('ON DELETE SET NULL');
const ED_CASCADE = edSetup('ON DELETE CASCADE');
// Same tables with NO foreign key declared, and one bad row, to show what goes wrong without it.
const ED_NOFK = EMP_SQL + `CREATE TABLE Department (
  name CHAR(3),
  head INT
);
` + DEPT_ROWS + `INSERT INTO Department VALUES ('CE', 5);\n`;

// The PC / Laptop / Printer database of slides 29–49 (the textbook's sample data, Fig. 2.21;
// the slides show its first rows).
const PROD = [['A', '1001', 'pc'], ['A', '1002', 'pc'], ['A', '1003', 'pc'], ['A', '2004', 'laptop'], ['A', '2005', 'laptop'], ['A', '2006', 'laptop'],
  ['B', '1004', 'pc'], ['B', '1005', 'pc'], ['B', '1006', 'pc'], ['B', '2007', 'laptop'], ['C', '1007', 'pc'],
  ['D', '1008', 'pc'], ['D', '1009', 'pc'], ['D', '1010', 'pc'], ['D', '3004', 'printer'], ['D', '3005', 'printer'],
  ['E', '1011', 'pc'], ['E', '1012', 'pc'], ['E', '1013', 'pc'], ['E', '2001', 'laptop'], ['E', '2002', 'laptop'], ['E', '2003', 'laptop'],
  ['E', '3001', 'printer'], ['E', '3002', 'printer'], ['E', '3003', 'printer'], ['F', '2008', 'laptop'], ['F', '2009', 'laptop'],
  ['G', '2010', 'laptop'], ['H', '3006', 'printer'], ['H', '3007', 'printer']];
const PCS = [['1001', 2.66, 1024, 250, 2114], ['1002', 2.10, 512, 250, 995], ['1003', 1.42, 512, 80, 478], ['1004', 2.80, 1024, 250, 649],
  ['1005', 3.20, 512, 250, 630], ['1006', 3.20, 1024, 320, 1049], ['1007', 2.20, 1024, 200, 510], ['1008', 2.20, 2048, 250, 770],
  ['1009', 2.00, 1024, 250, 650], ['1010', 2.80, 2048, 300, 770], ['1011', 1.86, 2048, 160, 959], ['1012', 2.80, 1024, 160, 649],
  ['1013', 3.06, 512, 80, 529]];
const LAPS = [['2001', 2.00, 2048, 240, 20.1, 3673], ['2002', 1.73, 1024, 80, 17.0, 949], ['2003', 1.80, 512, 60, 15.4, 549],
  ['2004', 2.00, 512, 60, 13.3, 1150], ['2005', 2.16, 1024, 120, 17.0, 2500], ['2006', 2.00, 2048, 80, 15.4, 1700],
  ['2007', 1.83, 1024, 120, 13.3, 1429], ['2008', 1.60, 1024, 100, 15.4, 900], ['2009', 1.60, 512, 80, 14.1, 680],
  ['2010', 2.00, 2048, 160, 15.4, 2300]];
const PRNS = [['3001', 'T', 'ink-jet', 99], ['3002', 'F', 'laser', 239], ['3003', 'T', 'laser', 899], ['3004', 'T', 'ink-jet', 120],
  ['3005', 'F', 'laser', 120], ['3006', 'T', 'ink-jet', 100], ['3007', 'T', 'laser', 200]];
const q = v => typeof v === 'string' ? `'${v}'` : v;
const ins = (t, rows) => rows.map(r => `INSERT INTO ${t} VALUES (${r.map(q).join(', ')});`).join('\n') + '\n';
const PCDB = `CREATE TABLE Product (maker CHAR(1), model CHAR(4) PRIMARY KEY, type VARCHAR2(10));
CREATE TABLE PC (model CHAR(4) PRIMARY KEY, speed NUMBER(3,2), ram INT, hd INT, price NUMBER(7,2));
CREATE TABLE Laptop (model CHAR(4) PRIMARY KEY, speed NUMBER(3,2), ram INT, hd INT, screen NUMBER(3,1), price NUMBER(7,2));
CREATE TABLE Printer (model CHAR(4) PRIMARY KEY, color CHAR(1), type VARCHAR2(10), price NUMBER(7,2));
` + ins('Product', PROD) + ins('PC', PCS) + ins('Laptop', LAPS) + ins('Printer', PRNS);

// ---------- figures ----------
// Two record tables side by side: Department (foreign table) and Employee (master table).
// dc / ec: {rowIndex: 'hl' | 'del' | 'new'}; ds / es: {rowIndex: side note}
function edFig(dept, emp, { dc = {}, ec = {}, ds = {}, es = {} } = {}) {
  const fmt = v => v == null ? '<i>NULL</i>' : String(v);
  const d = recTable(null, dept.map((r, i) => ({ lab: '', cells: r.map(fmt), cls: dc[i], side: ds[i] })), ['name', 'head']);
  const e = recTable(null, emp.map((r, i) => ({ lab: '', cells: r.map(fmt), cls: ec[i], side: es[i] })), ['id', 'name', 'address', 'gender']);
  return `<div class="figrow"><div><div class="figlabel">Department · foreign (child) table · FK head</div>${d}</div>` +
    `<div><div class="figlabel">Employee · master (parent) table · PK id</div>${e}</div></div>`;
}
const sqlLine = s => `<pre style="margin:0 0 10px">${s}</pre>`;
const OK = t => `<span class="good">OK</span> ${t || ''}`;
const REJ = t => `<span class="bad">REJECT</span> ${t || ''}`;

// Foreign-key simulator. op: {t: insDept|updDept|delDept|insEmp|updEmp|delEmp, ...}; pol: {del, upd} in
// 'NO ACTION' | 'CASCADE' | 'SET NULL'. Returns stepper frames.
function fkSteps(op, pol = { del: 'NO ACTION', upd: 'NO ACTION' }, dept0 = DEPT0, emp0 = EMP0) {
  let dept = dept0.map(r => [...r]), emp = emp0.map(r => [...r]);
  const steps = [], st = (sql, o, cap) => steps.push({ html: sqlLine(sql) + edFig(dept, emp, o), cap });
  const ids = emp.map(r => r[0]);
  if (op.t === 'insDept' || op.t === 'updDept') {
    const sql = op.t === 'insDept' ? `INSERT INTO Department VALUES ('${op.name}', ${op.head ?? 'NULL'});`
      : `UPDATE Department SET head = ${op.head ?? 'NULL'} WHERE name = '${op.name}';`;
    let di;
    if (op.t === 'insDept') { dept.push([op.name, op.head]); di = dept.length - 1; }
    else {
      di = dept.findIndex(r => r[0] === op.name);
      if (di < 0) { st(sql, {}, `No department is named '${op.name}', so the UPDATE changes 0 rows. Nothing to check. ${OK()}`); return steps; }
    }
    const old = dept[di][1];
    if (op.t === 'updDept') st(sql, { dc: { [di]: 'hl' }, ds: { [di]: `head is now ${old}` } }, `The statement changes the foreign-key column <b>head</b> of the ${op.name} row from ${old} to ${op.head ?? 'NULL'}. A change to a foreign-key value must be checked.`);
    dept[di][1] = op.head;
    if (op.head == null) {
      st(sql, { dc: { [di]: 'new' } }, `The new head is NULL. A NULL foreign key references nothing, so the constraint is satisfied. ${OK()}`);
      return steps;
    }
    st(sql, { dc: { [di]: 'hl' }, ds: { [di]: `head = ${op.head} ?` } }, `The DBMS must find an Employee whose primary key id equals ${op.head} <b>before</b> it accepts the row.`);
    const ei = ids.indexOf(op.head);
    if (ei >= 0) {
      st(sql, { dc: { [di]: 'new' }, ec: { [ei]: 'hl' }, es: { [ei]: '← found' } }, `Employee ${op.head} exists, so the reference is valid. ${OK('The row is stored.')}`);
    } else {
      st(sql, { dc: { [di]: 'del' }, ds: { [di]: 'no id ' + op.head } }, `No Employee has id ${op.head}. The row would point at nothing (a <i>dangling reference</i>). ${REJ('Oracle: ORA-02291: integrity constraint violated - parent key not found.')}`);
    }
    return steps;
  }
  if (op.t === 'delDept') {
    const di = dept.findIndex(r => r[0] === op.name), sql = `DELETE FROM Department WHERE name = '${op.name}';`;
    if (di < 0) { st(sql, {}, `No such department: 0 rows deleted. ${OK()}`); return steps; }
    st(sql, { dc: { [di]: 'del' } }, `Deleting a row of the <b>foreign</b> table removes a reference. Nobody points <i>at</i> a Department row through this constraint, so nothing can dangle.`);
    dept.splice(di, 1);
    st(sql, {}, `${OK('Always permitted (slide 17).')} Employee is unchanged.`);
    return steps;
  }
  if (op.t === 'insEmp') {
    const sql = `INSERT INTO Employee VALUES (${op.row.map(q).join(', ')});`;
    emp.push(op.row);
    const ei = emp.length - 1, dup = ids.indexOf(op.row[0]);
    if (dup >= 0) {
      st(sql, { ec: { [ei]: 'del', [dup]: 'hl' }, es: { [ei]: 'duplicate id' } }, `The foreign key is not a problem, but the <b>primary key</b> is: id ${op.row[0]} already exists. ${REJ('Oracle: ORA-00001: unique constraint violated.')}`);
    } else {
      st(sql, { ec: { [ei]: 'new' } }, `A new master row cannot break any reference: Department rows can only point at ids that already existed. ${OK('Always permitted as far as the foreign key is concerned (slide 18).')}`);
    }
    return steps;
  }
  // updEmp / delEmp: the interesting cases
  const isDel = op.t === 'delEmp', id = isDel ? op.id : op.from, ei = ids.indexOf(id);
  const sql = isDel ? `DELETE FROM Employee WHERE id = ${id};` : `UPDATE Employee SET id = ${op.to} WHERE id = ${id};`;
  if (ei < 0) { st(sql, {}, `No Employee has id ${id}: 0 rows affected. ${OK()}`); return steps; }
  if (!isDel && op.to !== id && ids.includes(op.to)) {
    st(sql, { ec: { [ei]: 'hl', [ids.indexOf(op.to)]: 'del' } }, `id ${op.to} already belongs to another employee, so the <b>primary key</b> would be duplicated. ${REJ('Oracle: ORA-00001.')}`);
    return steps;
  }
  st(sql, { ec: { [ei]: isDel ? 'del' : 'hl' } }, `The statement ${isDel ? 'removes' : 'changes the key of'} Employee ${id}. Any Department row whose head = ${id} would be left pointing at nothing, so the DBMS searches the foreign table.`);
  const refs = dept.map((r, i) => r[1] === id ? i : -1).filter(i => i >= 0);
  const mark = (cls) => Object.fromEntries(refs.map(i => [i, cls]));
  if (!refs.length) {
    if (isDel) emp.splice(ei, 1); else emp[ei][0] = op.to;
    st(sql, { ec: isDel ? {} : { [ei]: 'new' } }, `No department has head = ${id}. Nothing refers to this row. ${OK()}`);
    return steps;
  }
  const names = refs.map(i => dept[i][0]).join(', ');
  st(sql, { dc: mark('hl'), ds: Object.fromEntries(refs.map(i => [i, `→ ${id}`])), ec: { [ei]: isDel ? 'del' : 'hl' } }, `Found: ${names} ${refs.length > 1 ? 'have' : 'has'} head = ${id}. What happens now depends on the referential action declared with the foreign key: <b>ON ${isDel ? 'DELETE' : 'UPDATE'} ${isDel ? pol.del : pol.upd}</b>.`);
  const p = isDel ? pol.del : pol.upd;
  if (p === 'NO ACTION') {
    st(sql, { dc: mark('hl'), ec: { [ei]: 'del' }, es: { [ei]: 'still referenced' } }, `No action was declared (the default), so the statement is rolled back and both tables stay as they were. ${REJ('Oracle: ORA-02292: integrity constraint violated - child record found.')}`);
    return steps;
  }
  if (p === 'CASCADE') {
    if (isDel) {
      st(sql, { dc: mark('del'), ec: { [ei]: 'del' } }, `CASCADE: the referencing Department rows are deleted together with the employee.`);
      emp.splice(ei, 1); dept = dept.filter((r, i) => !refs.includes(i));
      st(sql, {}, `${OK()} Employee ${id} and department ${names} are gone. No reference dangles.`);
    } else {
      emp[ei][0] = op.to; refs.forEach(i => dept[i][1] = op.to);
      st(sql, { dc: mark('new'), ec: { [ei]: 'new' } }, `CASCADE: the new key ${op.to} is copied into every referencing row. ${OK()} (Standard SQL; Oracle has no ON UPDATE CASCADE.)`);
    }
    return steps;
  }
  // SET NULL
  refs.forEach(i => dept[i][1] = null);
  if (isDel) emp.splice(ei, 1); else emp[ei][0] = op.to;
  st(sql, { dc: mark('new'), ec: isDel ? {} : { [ei]: 'new' } }, `SET NULL: the referencing rows stay, but their head becomes NULL ("no head at the moment"). ${OK()}${isDel ? '' : ' (Standard SQL; Oracle offers SET NULL only for DELETE.)'}`);
  return steps;
}

// Interactive explorer around fkSteps.
function fkExplorer(sel) {
  const host = $(sel);
  host.innerHTML = `<form class="bp-form">
    <label>Statement <select data-op>
      <option value="insDept">INSERT INTO Department VALUES (name, head)</option>
      <option value="updDept">UPDATE Department SET head = b WHERE name = a</option>
      <option value="delDept">DELETE FROM Department WHERE name = a</option>
      <option value="insEmp">INSERT INTO Employee VALUES (id, 'N', 'Q', 'M')</option>
      <option value="updEmp">UPDATE Employee SET id = b WHERE id = a</option>
      <option value="delEmp" selected>DELETE FROM Employee WHERE id = a</option></select></label>
    <label>a <input data-a value="4" style="width:6em"></label>
    <label>b <input data-b value="" style="width:6em"></label>
    <label>ON DELETE <select data-del><option>NO ACTION</option><option>CASCADE</option><option>SET NULL</option></select></label>
    <label>ON UPDATE <select data-upd><option>NO ACTION</option><option>CASCADE</option><option>SET NULL</option></select></label>
    <button type="submit">Run it</button></form><p class="sq-msg err" data-msg></p><div class="fk-st"></div>`;
  const g = s => host.querySelector(s), msg = g('[data-msg]');
  const num = s => /^\s*(null)?\s*$/i.test(s) ? null : (/^\s*\d+\s*$/.test(s) ? +s : NaN);
  const run = () => {
    msg.textContent = '';
    const t = g('[data-op]').value, a = g('[data-a]').value.trim(), b = g('[data-b]').value.trim();
    let op;
    if (t === 'insDept' || t === 'updDept' || t === 'delDept') {
      if (!/^[A-Za-z]{1,3}$/.test(a)) return msg.textContent = 'For this statement, a is a department name of 1–3 letters (e.g. CSE or CE).';
      const h = num(b);
      if (t !== 'delDept' && Number.isNaN(h)) return msg.textContent = 'b must be a whole number (an employee id) or NULL.';
      op = { t, name: a.toUpperCase(), head: h };
    } else {
      const x = num(a), y = num(b);
      if (x == null || Number.isNaN(x)) return msg.textContent = 'a must be a whole number (an employee id).';
      if (t === 'updEmp' && (y == null || Number.isNaN(y))) return msg.textContent = 'b must be the new id (a whole number).';
      op = t === 'insEmp' ? { t, row: [x, 'N', 'Q', 'M'] } : t === 'updEmp' ? { t, from: x, to: y } : { t, id: x };
    }
    stepper(g('.fk-st'), fkSteps(op, { del: g('[data-del]').value, upd: g('[data-upd]').value }));
  };
  g('form').addEventListener('submit', e => { e.preventDefault(); run(); });
  run();
}

// Small SVG table with highlighted columns (for key anatomy). colCls: {colIndex: 'cell-hl' | 'cell-new' | 'cell-del'}
// rowCls: {rowIndex: class}; tags: {colIndex: label above the column}
function gridSVG(head, rows, { colCls = {}, rowCls = {}, tags = {}, w = [], note = '' } = {}) {
  const rh = 24, top = 44, W = head.map((h, i) => w[i] || 110), X = [10];
  W.forEach((x, i) => X.push(X[i] + x));
  let s = '';
  head.forEach((h, c) => {
    s += `<rect class="${colCls[c] || 'cell-plain'}" x="${X[c]}" y="${top}" width="${W[c]}" height="${rh}"/><text x="${X[c] + 6}" y="${top + 16}" class="big">${h}</text>`;
    if (tags[c]) s += `<text x="${X[c] + W[c] / 2}" y="${top - 10}" text-anchor="middle" class="lbl acc" style="font-weight:600">${tags[c]}</text>`;
  });
  rows.forEach((r, i) => r.forEach((v, c) => {
    const cls = rowCls[i] || colCls[c] || 'cell', y = top + rh * (i + 1);
    s += `<rect class="${cls}" x="${X[c]}" y="${y}" width="${W[c]}" height="${rh}"/><text x="${X[c] + 6}" y="${y + 16}" style="font-size:12px">${v}</text>`;
  }));
  const H = top + rh * (rows.length + 1) + (note ? 30 : 10), Wt = X.at(-1) + 10;
  if (note) s += `<text x="10" y="${H - 10}" class="lbl">${note}</text>`;
  return `<svg viewBox="0 0 ${Wt} ${H}" width="${Wt}" role="img" aria-label="table">${s}</svg>`;
}

// ---------- structure probes for auto-checked DDL exercises (SQLite catalogue, used as sqlCheck `table`) ----------
// KEYS: primary key columns, single/compound UNIQUE sets, NOT NULL columns and the column list of table t.
const KEYS = t => `(SELECT 'primary key' AS kind, (SELECT group_concat(n, ', ') FROM (SELECT lower(name) n FROM pragma_table_info('${t}') WHERE pk > 0 ORDER BY n)) AS cols
  UNION ALL SELECT 'unique', (SELECT group_concat(n, ', ') FROM (SELECT lower(name) n FROM pragma_index_info(il.name) ORDER BY n)) FROM pragma_index_list('${t}') il WHERE il.origin = 'u'
  UNION ALL SELECT 'not null', lower(name) FROM pragma_table_info('${t}') WHERE "notnull" = 1 AND pk = 0
  UNION ALL SELECT 'column', lower(name) FROM pragma_table_info('${t}'))`;
// FKS: every foreign key of table t with its referential actions.
const FKS = t => `(SELECT lower(f."table") AS parent, lower(f."from") AS fk_column,
  coalesce(lower(f."to"), (SELECT lower(name) FROM pragma_table_info(f."table") WHERE pk = 1)) AS ref_column, f.on_delete, f.on_update
  FROM pragma_foreign_key_list('${t}') f)`;
