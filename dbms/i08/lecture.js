// Shared sample databases and figure helpers for Ishrak sir's SQL lectures 08–11
// (queries over multiple tables, joins, aggregation, subqueries).
// Loaded after book.js and sqlplay.js by every chapter in i08/, i09/, i10/ and i11/.

// ---------- extra Oracle → SQLite translation for these chapters ----------
// 1. NUMBER becomes REAL, so 43/3 = 14.33 as in Oracle (SQLite would do integer division).
// 2. Oracle's implicit DATE conversion of 'DD-MON-YY' literals, e.g. day > '04-OCT-05' (slide 10.20).
// 3. OFFSET n ROWS FETCH NEXT m ROWS ONLY.
// 4. Quantified comparisons  x op ALL (subquery)  /  x op ANY|SOME (subquery), which SQLite lacks.
//    They are rewritten with MIN/MAX/COUNT over the subquery; the result is the same as Oracle's in a
//    WHERE or HAVING clause (an UNKNOWN that Oracle would produce becomes FALSE here, and both drop the row).
const _baseCompat = sqlCompat;
let _qn = 0;
function _quantified(q) {
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
    const L = q.slice(start, k + 1), n = ++_qn;
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
sqlCompat = function (q) {
  q = q.replace(/\bnumber\b(\s*\(\s*\d+\s*(,\s*\d+\s*)?\))?/gi, 'REAL')
    .replace(/'(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})'/g, (s, d, m, y) => MON[m.toUpperCase()] ? `'${oraToDate(`${d}-${m}-${y}`)}'` : s)
    .replace(/\boffset\s+(\d+)\s+rows?\s+fetch\s+(?:first|next)\s+(\d+)\s+rows?\s+only\b/gi, 'LIMIT $2 OFFSET $1');
  return _quantified(_baseCompat(q));
};

// ---------- sample databases (Oracle SQL) ----------
// Lec 08 slides 7–12: the tiny R and S.
const RS = `CREATE TABLE R (A NUMBER, B VARCHAR2(1));
CREATE TABLE S (B VARCHAR2(1), C NUMBER);
INSERT INTO R VALUES (1, 'x'); INSERT INTO R VALUES (2, 'y');
INSERT INTO S VALUES ('x', 5); INSERT INTO S VALUES ('y', 6); INSERT INTO S VALUES ('z', 7);`;

// Lec 08 slides 2–19: Product and Company exactly as on the slides.
const PRODCO = `CREATE TABLE Company (
  cname VARCHAR2(20) PRIMARY KEY, stockPrice NUMBER, country VARCHAR2(20));
CREATE TABLE Product (
  pname VARCHAR2(20) PRIMARY KEY, price NUMBER(8,2), category VARCHAR2(20),
  manufacturer VARCHAR2(20) REFERENCES Company(cname));
INSERT INTO Company VALUES ('GizmoWorks', 25, 'USA');
INSERT INTO Company VALUES ('Canon', 65, 'Japan');
INSERT INTO Company VALUES ('Hitachi', 15, 'Japan');
INSERT INTO Product VALUES ('Gizmo', 19.99, 'Gadgets', 'GizmoWorks');
INSERT INTO Product VALUES ('Powergizmo', 29.99, 'Gadgets', 'GizmoWorks');
INSERT INTO Product VALUES ('SingleTouch', 149.99, 'Photography', 'Canon');
INSERT INTO Product VALUES ('MultiTouch', 203.99, 'Household', 'Hitachi');`;
// The same plus a few invented rows, so that queries like slide 16 (Chinese companies) return something.
const PRODCO_X = PRODCO + `
INSERT INTO Company VALUES ('Xiaomi', 18, 'China');
INSERT INTO Company VALUES ('Lenovo', 12, 'China');
INSERT INTO Company VALUES ('Walton', 40, 'Bangladesh');
INSERT INTO Product VALUES ('RedmiPad', 199.00, 'electronic', 'Xiaomi');
INSERT INTO Product VALUES ('MiRobot', 59.50, 'toy', 'Xiaomi');
INSERT INTO Product VALUES ('ThinkPad', 899.00, 'Computers', 'Lenovo');
INSERT INTO Product VALUES ('Primo', 120.00, 'electronic', 'Walton');
INSERT INTO Product VALUES ('GizmoCam', 89.99, 'Photography', 'GizmoWorks');
INSERT INTO Product VALUES ('ZoomTouch', 349.00, 'Photography', 'Canon');`;

// Lec 08 slides 20–22: Person and Company with addresses (invented data).
const PERSONCO = `CREATE TABLE Company (cname VARCHAR2(20) PRIMARY KEY, address VARCHAR2(40));
CREATE TABLE Person (pname VARCHAR2(20) PRIMARY KEY, address VARCHAR2(40),
  worksfor VARCHAR2(20) REFERENCES Company(cname));
INSERT INTO Company VALUES ('GizmoWorks', '12 Kawran Bazar, Dhaka');
INSERT INTO Company VALUES ('Canon', '3 Gulshan Ave, Dhaka');
INSERT INTO Company VALUES ('Hitachi', '7 Agrabad, Chattogram');
INSERT INTO Person VALUES ('Rahim', '12 Kawran Bazar, Dhaka', 'GizmoWorks');
INSERT INTO Person VALUES ('Karim', '45 Dhanmondi, Dhaka', 'GizmoWorks');
INSERT INTO Person VALUES ('Salma', '3 Gulshan Ave, Dhaka', 'Canon');
INSERT INTO Person VALUES ('Nabila', '45 Dhanmondi, Dhaka', 'Hitachi');
INSERT INTO Person VALUES ('Tanvir', '7 Agrabad, Chattogram', 'Canon');
INSERT INTO Person VALUES ('Mitu', '45 Dhanmondi, Dhaka', 'Canon');`;

// The PC/Laptop/Printer database (Lec 08 s.24–36, Lec 10 s.28–37, Lec 11 s.16–22).
// The data is the textbook's (Garcia-Molina et al., Exercise 2.4.1, Figs. 2.20–2.21); the slides show parts of it.
const PCDB = `CREATE TABLE Product (maker VARCHAR2(5), model NUMBER(4) PRIMARY KEY, type VARCHAR2(10));
CREATE TABLE PC (model NUMBER(4) PRIMARY KEY REFERENCES Product(model), speed NUMBER(4,2), ram NUMBER(5), hd NUMBER(5), price NUMBER(6));
CREATE TABLE Laptop (model NUMBER(4) PRIMARY KEY REFERENCES Product(model), speed NUMBER(4,2), ram NUMBER(5), hd NUMBER(5), screen NUMBER(4,1), price NUMBER(6));
CREATE TABLE Printer (model NUMBER(4) PRIMARY KEY REFERENCES Product(model), color CHAR(1), type VARCHAR2(10), price NUMBER(6));
INSERT INTO Product VALUES ('A', 1001, 'pc'); INSERT INTO Product VALUES ('A', 1002, 'pc'); INSERT INTO Product VALUES ('A', 1003, 'pc');
INSERT INTO Product VALUES ('A', 2004, 'laptop'); INSERT INTO Product VALUES ('A', 2005, 'laptop'); INSERT INTO Product VALUES ('A', 2006, 'laptop');
INSERT INTO Product VALUES ('B', 1004, 'pc'); INSERT INTO Product VALUES ('B', 1005, 'pc'); INSERT INTO Product VALUES ('B', 1006, 'pc');
INSERT INTO Product VALUES ('B', 2007, 'laptop'); INSERT INTO Product VALUES ('C', 1007, 'pc');
INSERT INTO Product VALUES ('D', 1008, 'pc'); INSERT INTO Product VALUES ('D', 1009, 'pc'); INSERT INTO Product VALUES ('D', 1010, 'pc');
INSERT INTO Product VALUES ('D', 3004, 'printer'); INSERT INTO Product VALUES ('D', 3005, 'printer');
INSERT INTO Product VALUES ('E', 1011, 'pc'); INSERT INTO Product VALUES ('E', 1012, 'pc'); INSERT INTO Product VALUES ('E', 1013, 'pc');
INSERT INTO Product VALUES ('E', 2001, 'laptop'); INSERT INTO Product VALUES ('E', 2002, 'laptop'); INSERT INTO Product VALUES ('E', 2003, 'laptop');
INSERT INTO Product VALUES ('E', 3001, 'printer'); INSERT INTO Product VALUES ('E', 3002, 'printer'); INSERT INTO Product VALUES ('E', 3003, 'printer');
INSERT INTO Product VALUES ('F', 2008, 'laptop'); INSERT INTO Product VALUES ('F', 2009, 'laptop'); INSERT INTO Product VALUES ('G', 2010, 'laptop');
INSERT INTO Product VALUES ('H', 3006, 'printer'); INSERT INTO Product VALUES ('H', 3007, 'printer');
INSERT INTO PC VALUES (1001, 2.66, 1024, 250, 2114); INSERT INTO PC VALUES (1002, 2.10, 512, 250, 995);
INSERT INTO PC VALUES (1003, 1.42, 512, 80, 478);   INSERT INTO PC VALUES (1004, 2.80, 1024, 250, 649);
INSERT INTO PC VALUES (1005, 3.20, 512, 250, 630);  INSERT INTO PC VALUES (1006, 3.20, 1024, 320, 1049);
INSERT INTO PC VALUES (1007, 2.20, 1024, 200, 510); INSERT INTO PC VALUES (1008, 2.20, 2048, 250, 770);
INSERT INTO PC VALUES (1009, 2.00, 1024, 250, 650); INSERT INTO PC VALUES (1010, 2.80, 2048, 300, 770);
INSERT INTO PC VALUES (1011, 1.86, 2048, 160, 959); INSERT INTO PC VALUES (1012, 2.80, 1024, 160, 649);
INSERT INTO PC VALUES (1013, 3.06, 512, 80, 529);
INSERT INTO Laptop VALUES (2001, 2.00, 2048, 240, 20.1, 3673); INSERT INTO Laptop VALUES (2002, 1.73, 1024, 80, 17.0, 949);
INSERT INTO Laptop VALUES (2003, 1.80, 512, 60, 15.4, 549);    INSERT INTO Laptop VALUES (2004, 2.00, 512, 60, 13.3, 1150);
INSERT INTO Laptop VALUES (2005, 2.16, 1024, 120, 17.0, 2500); INSERT INTO Laptop VALUES (2006, 2.00, 2048, 80, 15.4, 1700);
INSERT INTO Laptop VALUES (2007, 1.83, 1024, 120, 13.3, 1429); INSERT INTO Laptop VALUES (2008, 1.60, 1024, 100, 15.4, 900);
INSERT INTO Laptop VALUES (2009, 1.60, 512, 80, 14.1, 680);    INSERT INTO Laptop VALUES (2010, 2.00, 2048, 160, 15.4, 2300);
INSERT INTO Printer VALUES (3001, 'T', 'ink-jet', 99);  INSERT INTO Printer VALUES (3002, 'F', 'laser', 239);
INSERT INTO Printer VALUES (3003, 'T', 'laser', 899);   INSERT INTO Printer VALUES (3004, 'T', 'ink-jet', 120);
INSERT INTO Printer VALUES (3005, 'F', 'laser', 120);   INSERT INTO Printer VALUES (3006, 'T', 'ink-jet', 100);
INSERT INTO Printer VALUES (3007, 'T', 'laser', 200);`;

// Lec 08 slides 31–35 (and the bank's T3): single-column bags.
const BAGS = `CREATE TABLE T1 (x NUMBER); CREATE TABLE T2 (x NUMBER); CREATE TABLE T3 (x NUMBER);
INSERT INTO T1 VALUES (1); INSERT INTO T1 VALUES (2); INSERT INTO T1 VALUES (2); INSERT INTO T1 VALUES (2);
INSERT INTO T1 VALUES (3); INSERT INTO T1 VALUES (4); INSERT INTO T1 VALUES (4);
INSERT INTO T2 VALUES (2); INSERT INTO T2 VALUES (3); INSERT INTO T2 VALUES (4); INSERT INTO T2 VALUES (4);
INSERT INTO T2 VALUES (4); INSERT INTO T2 VALUES (5);
INSERT INTO T3 VALUES (2); INSERT INTO T3 VALUES (2); INSERT INTO T3 VALUES (3); INSERT INTO T3 VALUES (3);
INSERT INTO T3 VALUES (4); INSERT INTO T3 VALUES (4); INSERT INTO T3 VALUES (5); INSERT INTO T3 VALUES (5);`;

// Lec 09 (and Lec 11 slides 14–15): the two small tables PC(model, maker) and Laptop(model, maker).
const JOINPC = `CREATE TABLE PC (model NUMBER(4) PRIMARY KEY, maker VARCHAR2(5));
CREATE TABLE Laptop (model NUMBER(4) PRIMARY KEY, maker VARCHAR2(5));
INSERT INTO PC VALUES (1001, 'A'); INSERT INTO PC VALUES (1002, 'B'); INSERT INTO PC VALUES (1003, 'C');
INSERT INTO Laptop VALUES (2001, 'A'); INSERT INTO Laptop VALUES (2002, 'B'); INSERT INTO Laptop VALUES (2003, 'D');`;

// Lec 10: Purchase, Marks (with a NULL), Person (NULL logic) and a car-style Product table (slides 13, 16).
const AGG = `CREATE TABLE Purchase (product VARCHAR2(10), day DATE, price NUMBER(6,2), quantity NUMBER);
INSERT INTO Purchase VALUES ('Bagel',  DATE '2005-10-21', 1,    20);
INSERT INTO Purchase VALUES ('Banana', DATE '2005-10-03', 0.5,  10);
INSERT INTO Purchase VALUES ('Banana', DATE '2005-10-10', 1,    10);
INSERT INTO Purchase VALUES ('Bagel',  DATE '2005-10-25', 1.50, 20);
CREATE TABLE Marks (student VARCHAR2(20), mark NUMBER);
INSERT INTO Marks VALUES ('Paul Smith', 43); INSERT INTO Marks VALUES ('Rachel Sewell', 57);
INSERT INTO Marks VALUES ('Helen Treacy', 72); INSERT INTO Marks VALUES ('Pinder Surree', NULL);
CREATE TABLE Person (name VARCHAR2(10), age NUMBER, height NUMBER(3,1), weight NUMBER);
INSERT INTO Person VALUES ('Asif', 20, NULL, 200);  INSERT INTO Person VALUES ('Babu', NULL, 5, 200);
INSERT INTO Person VALUES ('Chaya', 30, 5.5, 130);  INSERT INTO Person VALUES ('Dipu', 22, 6.2, 180);
INSERT INTO Person VALUES ('Era', NULL, 5.4, 120);
CREATE TABLE Product (pname VARCHAR2(15), maker VARCHAR2(10), category VARCHAR2(10), year NUMBER(4), price NUMBER(8));
INSERT INTO Product VALUES ('Corolla', 'Toyota', 'sedan', 1998, 18000);
INSERT INTO Product VALUES ('Camry', 'Toyota', 'sedan', 2001, 24000);
INSERT INTO Product VALUES ('RAV4', 'Toyota', 'SUV', 1996, 21000);
INSERT INTO Product VALUES ('Prius', 'Toyota', 'hybrid', 2003, 23000);
INSERT INTO Product VALUES ('Civic', 'Honda', 'sedan', 1995, 15000);
INSERT INTO Product VALUES ('CR-V', 'Honda', 'SUV', 1997, 20000);
INSERT INTO Product VALUES ('Pajero', 'Mitsubishi', 'SUV', 1999, 30000);
INSERT INTO Product VALUES ('Lancer', 'Mitsubishi', NULL, 2000, 16000);`;

// Lec 11 slides 4–12: Employee(id, dept, salary).
const EMP11 = `CREATE TABLE Employee (id NUMBER(4) PRIMARY KEY, dept VARCHAR2(5), salary NUMBER(8));
INSERT INTO Employee VALUES (5001, 'EEE', 50000); INSERT INTO Employee VALUES (5002, 'EEE', 55000);
INSERT INTO Employee VALUES (5003, 'CSE', 60000); INSERT INTO Employee VALUES (5004, 'CSE', 75000);`;
const EMP11B = EMP11 + `\nUPDATE Employee SET salary = 55000 WHERE id = 5003;`;   // slide 9's version

// HR schema of the question bank: EMPLOYEE, JOB, DEPARTMENT, JOB_HISTORY (data modelled on Oracle's HR sample).
// EMPLOYEE also has MANAGERID and COMMISSIONPCT, as Oracle's HR schema does. The view "employees" exposes the
// same rows with Oracle-HR column names (employee_id, last_name, manager_id, …) for questions that use them.
const HR = `CREATE TABLE JOB (JOBID VARCHAR2(10) PRIMARY KEY, JOBTITLE VARCHAR2(35), MINSALARY NUMBER(6), MAXSALARY NUMBER(6));
CREATE TABLE DEPARTMENT (DEPARTMENTID NUMBER(4) PRIMARY KEY, DEPARTMENTNAME VARCHAR2(30), MANAGERID NUMBER(6));
CREATE TABLE EMPLOYEE (EMPLOYEEID NUMBER(6) PRIMARY KEY, FIRSTNAME VARCHAR2(20), LASTNAME VARCHAR2(25), PHONE VARCHAR2(20),
  HIREDATE DATE, JOBID VARCHAR2(10) REFERENCES JOB(JOBID), SALARY NUMBER(8,2), COMMISSIONPCT NUMBER(2,2),
  MANAGERID NUMBER(6) REFERENCES EMPLOYEE(EMPLOYEEID), DEPARTMENTID NUMBER(4) REFERENCES DEPARTMENT(DEPARTMENTID));
CREATE TABLE JOB_HISTORY (EMPLOYEEID NUMBER(6) REFERENCES EMPLOYEE(EMPLOYEEID), JOBID VARCHAR2(10) REFERENCES JOB(JOBID),
  DEPARTMENTID NUMBER(4) REFERENCES DEPARTMENT(DEPARTMENTID), STARTDATE DATE, ENDDATE DATE, PRIMARY KEY (EMPLOYEEID, STARTDATE));
INSERT INTO JOB VALUES ('AD_PRES', 'President', 20000, 40000);
INSERT INTO JOB VALUES ('AD_VP', 'Administration Vice President', 15000, 30000);
INSERT INTO JOB VALUES ('AD_ASST', 'Administration Assistant', 3000, 6000);
INSERT INTO JOB VALUES ('AC_MGR', 'Accounting Manager', 8200, 16000);
INSERT INTO JOB VALUES ('AC_ACCOUNT', 'Public Accountant', 4200, 9000);
INSERT INTO JOB VALUES ('MK_MAN', 'Marketing Manager', 9000, 15000);
INSERT INTO JOB VALUES ('MK_REP', 'Marketing Representative', 4000, 9000);
INSERT INTO JOB VALUES ('IT_PROG', 'Programmer', 4000, 10000);
INSERT INTO JOB VALUES ('SA_MAN', 'Sales Manager', 10000, 20000);
INSERT INTO JOB VALUES ('SA_REP', 'Sales Representative', 6000, 12000);
INSERT INTO JOB VALUES ('ST_MAN', 'Stock Manager', 5500, 8500);
INSERT INTO JOB VALUES ('ST_CLERK', 'Stock Clerk', 2000, 5000);
INSERT INTO JOB VALUES ('PU_CLERK', 'Purchasing Clerk', 2500, 5500);
INSERT INTO DEPARTMENT VALUES (10, 'Administration', 200);
INSERT INTO DEPARTMENT VALUES (20, 'Marketing', 201);
INSERT INTO DEPARTMENT VALUES (50, 'Shipping', 120);
INSERT INTO DEPARTMENT VALUES (60, 'IT', 103);
INSERT INTO DEPARTMENT VALUES (80, 'Sales', 145);
INSERT INTO DEPARTMENT VALUES (90, 'Executive', 100);
INSERT INTO DEPARTMENT VALUES (110, 'Accounting', 205);
INSERT INTO DEPARTMENT VALUES (190, 'Contracting', NULL);
INSERT INTO EMPLOYEE VALUES (100, 'Steven', 'King', '515.123.4567', DATE '2003-06-17', 'AD_PRES', 24000, NULL, NULL, 90);
INSERT INTO EMPLOYEE VALUES (101, 'Neena', 'Kochhar', '515.123.4568', DATE '1997-09-21', 'AD_VP', 17000, NULL, 100, 90);
INSERT INTO EMPLOYEE VALUES (102, 'Lex', 'De Haan', '515.123.4569', DATE '2001-01-13', 'AD_VP', 17000, NULL, 100, 90);
INSERT INTO EMPLOYEE VALUES (103, 'Alexander', 'Hunold', '590.423.4567', DATE '2006-01-03', 'IT_PROG', 9000, NULL, 102, 60);
INSERT INTO EMPLOYEE VALUES (104, 'Bruce', 'Ernst', '590.423.4568', DATE '2007-05-21', 'IT_PROG', 6000, NULL, 103, 60);
INSERT INTO EMPLOYEE VALUES (107, 'Diana', 'Lorentz', '590.423.5567', DATE '2007-02-07', 'IT_PROG', 4200, NULL, 103, 60);
INSERT INTO EMPLOYEE VALUES (120, 'Matthew', 'Weiss', '650.123.1234', DATE '2004-07-18', 'ST_MAN', 8000, NULL, 100, 50);
INSERT INTO EMPLOYEE VALUES (141, 'Trenna', 'Rajs', '650.121.8009', DATE '2003-10-17', 'ST_CLERK', 3500, NULL, 120, 50);
INSERT INTO EMPLOYEE VALUES (142, 'Curtis', 'Davies', '650.121.2994', DATE '2005-01-29', 'ST_CLERK', 3100, NULL, 120, 50);
INSERT INTO EMPLOYEE VALUES (143, 'Randall', 'Matos', '650.121.2874', DATE '2006-03-15', 'ST_CLERK', 2600, NULL, 120, 50);
INSERT INTO EMPLOYEE VALUES (145, 'John', 'Russell', '011.44.1344.429268', DATE '2004-10-01', 'SA_MAN', 14000, 0.40, 100, 80);
INSERT INTO EMPLOYEE VALUES (149, 'Eleni', 'Zlotkey', '011.44.1344.429018', DATE '2008-01-29', 'SA_MAN', 10500, 0.20, 100, 80);
INSERT INTO EMPLOYEE VALUES (174, 'Ellen', 'Abel', '011.44.1644.429267', DATE '2004-05-11', 'SA_REP', 11000, 0.30, 149, 80);
INSERT INTO EMPLOYEE VALUES (176, 'Jonathon', 'Taylor', '011.44.1644.429265', DATE '2006-03-24', 'SA_REP', 8600, 0.20, 149, 80);
INSERT INTO EMPLOYEE VALUES (178, 'Kimberely', 'Grant', '011.44.1644.429263', DATE '2007-05-24', 'SA_REP', 7000, 0.15, 149, NULL);
INSERT INTO EMPLOYEE VALUES (200, 'Jennifer', 'Whalen', '515.123.4444', DATE '1995-09-17', 'AD_ASST', 4400, NULL, 101, 10);
INSERT INTO EMPLOYEE VALUES (201, 'Michael', 'Hartstein', '515.123.5555', DATE '2004-02-17', 'MK_MAN', 13000, NULL, 100, 20);
INSERT INTO EMPLOYEE VALUES (202, 'Pat', 'Fay', '603.123.6666', DATE '2005-08-17', 'MK_REP', 6000, NULL, 201, 20);
INSERT INTO EMPLOYEE VALUES (205, 'Shelley', 'Higgins', '515.123.8080', DATE '2002-06-07', 'AC_MGR', 12008, NULL, 101, 110);
INSERT INTO EMPLOYEE VALUES (206, 'William', 'Gietz', '515.123.8181', DATE '2002-06-07', 'AC_ACCOUNT', 8300, NULL, 205, 110);
INSERT INTO JOB_HISTORY VALUES (101, 'AC_ACCOUNT', 110, DATE '1997-09-21', DATE '2001-10-27');
INSERT INTO JOB_HISTORY VALUES (101, 'AC_MGR', 110, DATE '2001-10-28', DATE '2005-03-15');
INSERT INTO JOB_HISTORY VALUES (102, 'IT_PROG', 60, DATE '2001-01-13', DATE '2006-07-24');
INSERT INTO JOB_HISTORY VALUES (176, 'SA_MAN', 80, DATE '2006-03-24', DATE '2006-12-31');
INSERT INTO JOB_HISTORY VALUES (200, 'AD_ASST', 90, DATE '1995-09-17', DATE '2001-06-17');
INSERT INTO JOB_HISTORY VALUES (200, 'AC_ACCOUNT', 90, DATE '2002-07-01', DATE '2006-12-31');
INSERT INTO JOB_HISTORY VALUES (201, 'MK_REP', 20, DATE '2004-02-17', DATE '2007-12-19');
CREATE VIEW employees AS SELECT EMPLOYEEID employee_id, FIRSTNAME first_name, LASTNAME last_name, PHONE phone_number,
  HIREDATE hire_date, JOBID job_id, SALARY salary, COMMISSIONPCT commission_pct, MANAGERID manager_id, DEPARTMENTID department_id
  FROM EMPLOYEE;`;

// ---------- figure helpers ----------
document.head.insertAdjacentHTML('beforeend', '<style>.bp-form button[aria-pressed="true"]{background:var(--accent);color:var(--bg);border-color:var(--accent)}</style>');
const NUL = '<i class="mid">NULL</i>';
const _cell = v => v === null || v === undefined ? NUL : String(v);
// A relation drawn as a record table with a caption. rows: arrays; o.cls / o.side: {rowIndex: …}; o.lab: labels
function rel(title, head, rows, o = {}) {
  const t = recTable(null, rows.map((r, i) => ({ lab: o.lab ? o.lab[i] ?? '' : '', cells: r.map(_cell), cls: (o.cls || {})[i], side: (o.side || {})[i] })), head);
  return `<div>${title ? `<div class="figlabel">${title}</div>` : ''}${t}${o.note ? `<div class="figlabel" style="font-weight:400">${o.note}</div>` : ''}</div>`;
}
const row2 = (...blocks) => `<div class="figrow">${blocks.join('')}</div>`;

// Join animation: one frame per left row, then (for RIGHT/FULL) one for the dangling right rows.
// spec: {L, R, lname, rname, lhead, rhead, on(l, r), cond (text), type: 'inner'|'left'|'right'|'full', outHead, sel}
function joinSteps(sp) {
  const type = sp.type || 'inner', outHead = sp.outHead || [...sp.lhead.map(h => `${sp.lname}.${h}`), ...sp.rhead.map(h => `${sp.rname}.${h}`)];
  const nullL = sp.lhead.map(() => null), nullR = sp.rhead.map(() => null);
  const out = [], outCls = [], usedR = new Set(), steps = [];
  const frame = (lcls, rcls, lside, rside, newIdx, cap) => ({
    html: row2(rel(sp.lname, sp.lhead, sp.L, { cls: lcls, side: lside }), rel(sp.rname, sp.rhead, sp.R, { cls: rcls, side: rside }),
      rel(`Result (${out.length} row${out.length === 1 ? '' : 's'})`, outHead, out.length ? out : [], { cls: Object.fromEntries(out.map((r, i) => [i, outCls[i] || (newIdx.includes(i) ? 'new' : '')])) })), cap });
  steps.push(frame({}, {}, {}, {}, [], sp.intro || `${type === 'inner' ? 'INNER' : type.toUpperCase() + ' OUTER'} JOIN on <code>${sp.cond}</code>. Each ${sp.lname} row is compared with every ${sp.rname} row.`));
  sp.L.forEach((l, i) => {
    const hits = sp.R.map((r, j) => sp.on(l, r) ? j : -1).filter(j => j >= 0), fresh = [];
    hits.forEach(j => { usedR.add(j); fresh.push(out.length); out.push([...l, ...sp.R[j]]); });
    let cap = `${sp.lname} row <b>${l.map(_cell).join(', ')}</b>: `;
    if (hits.length) cap += `matches ${hits.length} ${sp.rname} row${hits.length > 1 ? 's' : ''}, so ${hits.length} joined row${hits.length > 1 ? 's are' : ' is'} added.`;
    else if (type === 'left' || type === 'full') { fresh.push(out.length); outCls[out.length] = 'hl'; out.push([...l, ...nullR]); cap += `no match. It is a <b>dangling tuple</b>; an outer join keeps it and pads the ${sp.rname} columns with NULL.`; }
    else cap += `no match, so it contributes nothing${type === 'right' ? ' (a RIGHT join keeps only dangling rows of the right table)' : ''}.`;
    const rcls = Object.fromEntries(sp.R.map((r, j) => [j, hits.includes(j) ? 'new' : 'del']));
    steps.push(frame({ [i]: hits.length ? 'hl' : 'del' }, rcls, { [i]: '◀ now' }, {}, fresh, cap));
  });
  if (type === 'right' || type === 'full') {
    const dang = sp.R.map((r, j) => usedR.has(j) ? -1 : j).filter(j => j >= 0), fresh = [];
    dang.forEach(j => { fresh.push(out.length); outCls[out.length] = 'hl'; out.push([...nullL, ...sp.R[j]]); });
    steps.push(frame({}, Object.fromEntries(dang.map(j => [j, 'hl'])), {}, Object.fromEntries(dang.map(j => [j, 'dangling'])), fresh,
      dang.length ? `Finally the ${sp.rname} rows that matched nothing (${dang.map(j => sp.R[j].map(_cell).join(', ')).join('; ')}) are added, with NULL in every ${sp.lname} column.` : `Every ${sp.rname} row matched something, so nothing more is added.`));
  }
  steps.push(frame({}, {}, {}, {}, [], sp.outro || `Done: ${out.length} rows. Green rows came from matches${type !== 'inner' ? '; amber rows are dangling tuples padded with NULL' : ''}.`));
  return steps;
}

// GROUP BY animation. spec: {head, rows, where(r)?, whereText, key(r) → group label, aggs:[{name, f(rows)}], having?(aggRow), havingText, order?(a,b), orderText, keyHead}
function groupSteps(sp) {
  const steps = [], rows = sp.rows;
  steps.push({ html: row2(rel('FROM: the input rows', sp.head, rows)), cap: sp.intro || 'Step 1: FROM produces the input rows.' });
  let kept = rows;
  if (sp.where) {
    kept = rows.filter(sp.where);
    steps.push({ html: row2(rel(`WHERE ${sp.whereText}`, sp.head, rows, { cls: Object.fromEntries(rows.map((r, i) => [i, sp.where(r) ? 'new' : 'del'])) })),
      cap: `Step 2: WHERE ${sp.whereText} is tested on each row <em>before</em> grouping. ${rows.length - kept.length} row(s) fail and are removed.` });
  }
  const groups = [];
  kept.forEach(r => { const k = sp.key(r); let g = groups.find(g => g.k === k); if (!g) groups.push(g = { k, rows: [] }); g.rows.push(r); });
  steps.push({ html: row2(...groups.map(g => rel(`group ${g.k}`, sp.head, g.rows))), cap: `Step 3: GROUP BY ${sp.keyText} puts rows with equal ${sp.keyText} values in the same group: ${groups.length} group(s).` });
  const out = groups.map(g => [g.k, ...sp.aggs.map(a => a.f(g.rows))]), oh = [sp.keyHead || sp.keyText, ...sp.aggs.map(a => a.name)];
  steps.push({ html: row2(...groups.map(g => rel(`group ${g.k}`, sp.head, g.rows)), rel('one row per group', oh, out)),
    cap: `Step 4: each group collapses to <b>one</b> row: the grouping value plus the aggregates (${sp.aggs.map(a => a.name).join(', ')}).` });
  let fin = out;
  if (sp.having) {
    steps.push({ html: row2(rel(`HAVING ${sp.havingText}`, oh, out, { cls: Object.fromEntries(out.map((r, i) => [i, sp.having(r) ? 'new' : 'del'])) })),
      cap: `Step 5: HAVING ${sp.havingText} is tested once per <em>group</em>. Groups that fail are removed.` });
    fin = out.filter(sp.having);
  }
  if (sp.order) {
    fin = [...fin].sort(sp.order);
    steps.push({ html: row2(rel(`ORDER BY ${sp.orderText}`, oh, fin)), cap: `Last step: ORDER BY ${sp.orderText} sorts the surviving rows. ORDER BY always runs last.` });
  } else steps.push({ html: row2(rel('Result', oh, fin)), cap: `Result: ${fin.length} row(s).` });
  return steps;
}
