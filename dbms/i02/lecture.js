// Lec 02 (Ishrak): small SVG kit for box-and-arrow diagrams.
// T: text; box: rounded box with a bold title and optional muted sub-lines; arrow: line with a marker and optional label.
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.a || 'middle'}"${o.cls ? ` class="${o.cls}"` : ''} style="font-size:${o.size || 12}px${o.w ? ';font-weight:600' : ''}">${s}</text>`;
function box(x, y, w, h, title, sub = [], cls = 'cell') {
  const lines = [].concat(sub), n = 1 + lines.length, top = y + h / 2 - (n - 1) * 8 + 4;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="${cls}"/>` + T(x + w / 2, top, title, { w: 1, size: 13 }) +
    lines.map((l, i) => T(x + w / 2, top + 16 * (i + 1), l, { cls: 'lbl', size: 11 })).join('');
}
function arrow(x1, y1, x2, y2, { cls = 's-fg', m = 'm-fg', label = '', dx = 0, dy = -6, lcls = 'lbl' } = {}) {
  return `<path d="M${x1} ${y1} L${x2} ${y2}" class="${cls}" marker-end="url(#${m})"/>` +
    (label ? T((x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy, label, { cls: lcls, size: 11 }) : '');
}
const svgWrap = (w, h, inner, aria) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" role="img" aria-label="${aria}">${inner}</svg>`;

// The slides' course-management example (slides 5–8), as an Oracle setup script for the SQL boxes.
const CMS = `CREATE TABLE Students (
  sid   NUMBER(7) PRIMARY KEY,
  name  VARCHAR2(30) NOT NULL,
  email VARCHAR2(40) UNIQUE
);
CREATE TABLE Courses (
  cid     NUMBER(3) PRIMARY KEY,
  cname   VARCHAR2(30) NOT NULL,
  credits NUMBER(3,1)
);
CREATE TABLE Enrolled (
  sid  NUMBER(7) REFERENCES Students(sid),
  cid  NUMBER(3) REFERENCES Courses(cid),
  term VARCHAR2(6),
  PRIMARY KEY (sid, cid, term)
);
INSERT INTO Students VALUES (2405190, 'Jalil', 'jalil@university.edu');
INSERT INTO Students VALUES (2405191, 'Karim', 'karim@university.edu');
INSERT INTO Students VALUES (2505200, 'Faria', 'faria@university.edu');
INSERT INTO Courses VALUES (101, 'SPL', 3);
INSERT INTO Courses VALUES (215, 'DB', 3);
INSERT INTO Courses VALUES (205, 'DLD', 3);
INSERT INTO Courses VALUES (102, 'SPL Lab', 1.5);
INSERT INTO Enrolled VALUES (2405190, 215, 'Jan26');
INSERT INTO Enrolled VALUES (2405190, 205, 'Jan26');
INSERT INTO Enrolled VALUES (2405191, 215, 'Jan26');
INSERT INTO Enrolled VALUES (2505200, 101, 'Jan26');
INSERT INTO Enrolled VALUES (2405190, 101, 'Jan25');
INSERT INTO Enrolled VALUES (2505200, 102, 'Jan26');`;

// Draw a small table as SVG. o = {x, y, title, head, rows, w: [col widths], hl: {rowIndex: cls}, hlCol: {colIndex: cls}}
function tblSVG({ x, y, title, head, rows, w, hl = {}, hlCol = {} }) {
  let s = title ? T(x + w.reduce((a, b) => a + b) / 2, y - 8, title, { w: 1, size: 13 }) : '';
  let cx = x;
  head.forEach((h, j) => { s += `<rect x="${cx}" y="${y}" width="${w[j]}" height="22" class="${hlCol[j] || 'cell-hl'}"/>` + T(cx + w[j] / 2, y + 15, h, { w: 1, size: 11 }); cx += w[j]; });
  rows.forEach((r, i) => {
    cx = x;
    r.forEach((v, j) => { s += `<rect x="${cx}" y="${y + 22 + i * 22}" width="${w[j]}" height="22" class="${hl[i] || hlCol[j] || 'cell'}"/>` + T(cx + w[j] / 2, y + 37 + i * 22, v, { size: 11 }); cx += w[j]; });
  });
  return s;
}
