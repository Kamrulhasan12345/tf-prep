// Lec 07 (Ishrak): ER diagrams. Shared code for every chapter in i07/.
//  erd(spec, opts)        → SVG markup of an ER diagram, drawn in the slides' notation
//  erdSteps(sel, spec, frames)  → step-by-step construction of a diagram (uses stepper)
//  relSchema(rels, opts)  → relational schema drawn as table cards (HTML)
//  ddl(rels)              → Oracle CREATE TABLE script for those relations
//  erConvert(text)        → parse the converter's text format and convert it to relations
//  erTool(sel, initial)   → interactive ER → schema converter
//  cardDrill(sel)         → random "read the multiplicity" drill

// ---------------------------------------------------------------- ER renderer
// spec = {
//   n: [[id, type, x, y, label?]]   type: E entity, W weak entity, R relationship, I identifying
//                                   relationship (double diamond), T isa triangle, D isa diamond ("isA")
//   a: [[owner, name, dx, dy]]      attribute, placed at owner centre + (dx, dy). name prefixes:
//                                   _key  ~partial key  {multi}  /derived  ; owner may be another
//                                   attribute ("Employee.name") for composite attributes
//   l: [[entity, rel, opts]]        opts: one (arrow toward entity), total (double line), card '1'/'N',
//                                   role 'manager', bend (curve offset), at (0..1 label position)
//   t: [[x, y, text, cls]]          free text
// }
// opts = {show: [ids], hl: [ids], mult: true, scale}
// ids: node id, attribute id "owner.name", link id "entity-rel" (second link to the same pair: "entity-rel#2")
const ER = {
  nodeSize(n) {
    const lines = String(n.label).split('\n'), L = Math.max(...lines.map(s => s.length));
    if (n.t === 'E' || n.t === 'W') return { w: Math.max(84, L * 8.4 + 26), h: 18 + lines.length * 16 };
    if (n.t === 'T') return { w: 46, h: 36 };
    return { w: Math.max(86, L * 8.2 + 50), h: Math.max(48, 26 + lines.length * 16) };
  },
  attrSize(label) { return { w: Math.max(56, label.length * 7.3 + 26), h: 28 }; },
  // point on the boundary of shape s, on the ray from its centre toward (px, py)
  clip(s, px, py) {
    const dx = px - s.x, dy = py - s.y;
    if (!dx && !dy) return { x: s.x, y: s.y };
    const hw = s.w / 2, hh = s.h / 2;
    let t;
    if (s.shape === 'diamond') t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
    else if (s.shape === 'ellipse') t = 1 / Math.sqrt((dx / hw) ** 2 + (dy / hh) ** 2);
    else t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return { x: s.x + dx * t, y: s.y + dy * t };
  },
};
// arrowheads sized in diagram units (the book's shared markers are a little small for ER lines)
(function erMarkers() {
  if (typeof document === "undefined") return;
  const mk = (id, c) => `<marker id="${id}" viewBox="0 0 10 10" refX="9.6" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M0,0.5 L10,5 L0,9.5 z" style="fill:var(--${c})"/></marker>`;
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; d.setAttribute('aria-hidden', 'true');
  d.innerHTML = `<svg width="0" height="0"><defs>${mk('er-a', 'fg')}${mk('er-ar', 'red')}</defs></svg>`;
  document.body.prepend(d);
})();
const _x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function erd(spec, opts = {}) {
  const show = opts.show ? new Set(opts.show) : null, hl = new Set(opts.hl || []), mult = opts.mult !== false;
  const dim = new Set(opts.dim || []);
  const S = {};   // id → shape
  for (const [id, t, x, y, label] of spec.n || []) {
    const n = { id, t, x, y, label: label ?? id };
    Object.assign(n, ER.nodeSize(n), { shape: t === 'R' || t === 'I' || t === 'D' ? 'diamond' : 'rect' });
    S[id] = n;
  }
  const attrs = [];
  for (const [owner, raw, dx, dy] of spec.a || []) {
    const kind = raw[0] === '_' ? 'key' : raw[0] === '~' ? 'pkey' : raw[0] === '/' ? 'der' : raw[0] === '{' ? 'multi' : 'plain';
    const name = kind === 'plain' ? raw : kind === 'multi' ? raw.slice(1, -1) : raw.slice(1);
    const o = S[owner];
    if (!o) throw new Error('erd: unknown owner ' + owner);
    const a = { id: owner + '.' + name, owner, name, kind, x: o.x + dx, y: o.y + dy, shape: 'ellipse', ...ER.attrSize(name) };
    S[a.id] = a; attrs.push(a);
  }
  const vis = id => {
    if (!show) return true;
    if (show.has(id)) return true;
    const s = S[id];
    return s && s.owner !== undefined && show.has(s.owner + '.*');
  };
  const cls = (id, base) => base + (hl.has(id) ? ' er-hl' : '') + (dim.has(id) ? ' er-dim' : '');
  let edges = '', shapes = '', labels = '';
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (x, y, w = 0, h = 0) => { box.x0 = Math.min(box.x0, x - w / 2); box.x1 = Math.max(box.x1, x + w / 2); box.y0 = Math.min(box.y0, y - h / 2); box.y1 = Math.max(box.y1, y + h / 2); };

  // attribute → owner lines
  for (const a of attrs) {
    if (!vis(a.id) || !vis(a.owner)) continue;
    const o = S[a.owner], p = ER.clip(a, o.x, o.y), q = ER.clip(o, a.x, a.y);
    edges += `<line class="${cls(a.id, 'er-e')}" x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}"/>`;
  }
  // entity ↔ relationship links
  const seen = {};
  for (const [e, r, o = {}] of spec.l || []) {
    const base = e + '-' + r; seen[base] = (seen[base] || 0) + 1;
    const id = seen[base] > 1 ? base + '#' + seen[base] : base;
    if (!vis(e) || !vis(r) || (show && o.step && !show.has(id))) continue;
    const A = S[e], B = S[r];
    if (!A || !B) throw new Error('erd: bad link ' + id);
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    const nx = -(B.y - A.y) / len, ny = (B.x - A.x) / len, bend = o.bend || 0;
    const cx = mx + nx * bend, cy = my + ny * bend;
    const pA = ER.clip(A, bend ? cx : B.x, bend ? cy : B.y), pB = ER.clip(B, bend ? cx : A.x, bend ? cy : A.y);
    const d = bend ? `M${pB.x.toFixed(1)} ${pB.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${pA.x.toFixed(1)} ${pA.y.toFixed(1)}`
                   : `M${pB.x.toFixed(1)} ${pB.y.toFixed(1)} L${pA.x.toFixed(1)} ${pA.y.toFixed(1)}`;
    // rev: draw the path from the entity to the diamond, so an arrowhead (one/rev) lands on the diamond (as in some exam figures)
    const dd = o.rev ? (bend ? `M${pA.x.toFixed(1)} ${pA.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${pB.x.toFixed(1)} ${pB.y.toFixed(1)}` : `M${pA.x.toFixed(1)} ${pA.y.toFixed(1)} L${pB.x.toFixed(1)} ${pB.y.toFixed(1)}`) : d;
    const total = mult && o.total, one = mult && (o.one || o.rev), c = cls(id, 'er-e');
    if (total) {
      // two parallel strokes: a wide stroke with a narrower background stroke on top
      edges += `<path class="${c} er-tot" d="${d}"/><path class="er-totgap" d="${d}"/>`;
      if (one) edges += `<path class="er-ghost" d="${d}" marker-end="url(#${hl.has(id) ? 'er-ar' : 'er-a'})"/>`;
    } else edges += `<path class="${c}" d="${dd}"${one ? ` marker-end="url(#${hl.has(id) ? 'er-ar' : 'er-a'})"` : ''}/>`;
    // labels: role near the middle, cardinality near the entity end
    const t = o.at ?? 0.5, lx = bend ? (1 - t) ** 2 * pB.x + 2 * (1 - t) * t * cx + t * t * pA.x : pB.x + (pA.x - pB.x) * t,
          ly = bend ? (1 - t) ** 2 * pB.y + 2 * (1 - t) * t * cy + t * t * pA.y : pB.y + (pA.y - pB.y) * t;
    if (o.role) {
      const side = o.roleSide ?? (bend ? Math.sign(bend) : 1);
      const rx = lx + nx * 13 * side, ry = ly + ny * 13 * side + 4;
      labels += `<text class="er-role" x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" text-anchor="middle">${_x(o.role)}</text>`;
      grow(rx, ry, o.role.length * 7, 14);
    }
    if (mult && o.card) {
      // a fixed distance from the entity end, so long labels like (1,N) clear the box
      const L = Math.hypot(pA.x - pB.x, pA.y - pB.y) || 1, back = 12 + o.card.length * 3.8, k = Math.max(0.5, 1 - back / L);
      const side = o.cardSide ?? 1;
      const bx = bend ? (1 - k) ** 2 * pB.x + 2 * (1 - k) * k * cx + k * k * pA.x : pB.x + (pA.x - pB.x) * k,
            by = bend ? (1 - k) ** 2 * pB.y + 2 * (1 - k) * k * cy + k * k * pA.y : pB.y + (pA.y - pB.y) * k;
      const qx = bx + nx * 12 * side, qy = by + ny * 12 * side + 4;
      labels += `<text class="er-card" x="${qx.toFixed(1)}" y="${qy.toFixed(1)}" text-anchor="middle">${_x(o.card)}</text>`;
    }
  }
  const textLines = (x, y, label, c, dy = 16) => {
    const ls = String(label).split('\n'), y0 = y - (ls.length - 1) * dy / 2 + 4.5;
    return ls.map((s, i) => `<text class="${c}" x="${x}" y="${(y0 + i * dy).toFixed(1)}" text-anchor="middle">${_x(s)}</text>`).join('');
  };
  for (const n of Object.values(S)) {
    if (n.owner !== undefined || !vis(n.id)) continue;
    const { x, y, w, h } = n, c = cls(n.id, '');
    grow(x, y, w, h);
    if (n.t === 'E' || n.t === 'W') {
      shapes += `<rect class="er-ent${c}" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="5"/>`;
      if (n.t === 'W') shapes += `<rect class="er-in${c}" x="${x - w / 2 + 4}" y="${y - h / 2 + 4}" width="${w - 8}" height="${h - 8}" rx="3"/>`;
      shapes += textLines(x, y, n.label, 'er-et');
    } else if (n.t === 'T') {
      shapes += `<path class="er-isa${c}" d="M${x} ${y - h / 2} L${x + w / 2} ${y + h / 2} L${x - w / 2} ${y + h / 2} Z"/>` +
                `<text class="er-at" x="${x + w / 2 + 6}" y="${y + 6}">${_x(n.label === 'T' || n.label === n.id ? 'isa' : n.label)}</text>`;
      grow(x + w / 2 + 34, y, 0, 0);
    } else {
      const pts = (k = 0) => `${x},${y - h / 2 + k} ${x + w / 2 - k * 1.7},${y} ${x},${y + h / 2 - k} ${x - w / 2 + k * 1.7},${y}`;
      shapes += `<polygon class="er-rel${c}" points="${pts()}"/>`;
      if (n.t === 'I') shapes += `<polygon class="er-in${c}" points="${pts(5)}"/>`;
      shapes += textLines(x, y, n.label, 'er-rt', 14);
    }
  }
  for (const a of attrs) {
    if (!vis(a.id) || !vis(a.owner)) continue;
    const { x, y, w, h } = a, c = cls(a.id, '');
    grow(x, y, w, h);
    shapes += `<ellipse class="er-att${a.kind === 'der' ? ' dash' : ''}${c}" cx="${x}" cy="${y}" rx="${w / 2}" ry="${h / 2}"/>`;
    if (a.kind === 'multi') shapes += `<ellipse class="er-in${c}" cx="${x}" cy="${y}" rx="${w / 2 - 4}" ry="${h / 2 - 4}"/>`;
    shapes += `<text class="er-at${a.kind === 'key' ? ' er-key' : ''}" x="${x}" y="${y + 4}" text-anchor="middle">${_x(a.name)}</text>`;
    if (a.kind === 'key' || a.kind === 'pkey') {
      const uw = a.name.length * 7.1 / 2;
      shapes += `<line class="er-ul${a.kind === 'pkey' ? ' dash' : ''}" x1="${x - uw}" x2="${x + uw}" y1="${y + 7}" y2="${y + 7}"/>`;
    }
  }
  for (const [x, y, s, c] of spec.t || []) {
    if (show && !show.has('#t')) continue;   // free text shows only in full views or when '#t' is listed
    labels += textLines(x, y, s, 'er-note ' + (c || ''), 15);
    grow(x, y, String(s).split('\n').reduce((m, l) => Math.max(m, l.length), 0) * 7, 16);
  }
  if (!isFinite(box.x0)) { box.x0 = box.y0 = 0; box.x1 = box.y1 = 10; }
  const fb = opts.frame;   // fixed bounding box keeps every animation frame the same size
  const [X0, Y0, X1, Y1] = fb || [box.x0 - 12, box.y0 - 12, box.x1 + 12, box.y1 + 12];
  const W = X1 - X0, H = Y1 - Y0, sc = opts.scale || (W < 520 ? 1.3 : 1);
  return `<svg class="erd" viewBox="${X0.toFixed(0)} ${Y0.toFixed(0)} ${W.toFixed(0)} ${H.toFixed(0)}" width="${(W * sc).toFixed(0)}" role="img" aria-label="${_x(opts.label || 'ER diagram')}">${edges}${shapes}${labels}</svg>`;
}
// Bounding box of the full diagram (so animation frames keep one size).
function erdBox(spec) {
  const m = erd(spec).match(/viewBox="(-?\d+) (-?\d+) (\d+) (\d+)"/).slice(1).map(Number);
  return [m[0], m[1], m[0] + m[2], m[1] + m[3]];
}
// frames: [{add: [ids], hl: [ids], cap, mult, set: [ids] (replace instead of add)}]; shapes accumulate.
function erdSteps(sel, spec, frames, o = {}) {
  const frame = erdBox(spec), shown = new Set();
  const steps = frames.map(f => {
    if (f.set) shown.clear();
    for (const id of f.add || f.set || []) shown.add(id);
    const extra = f.after ? `<div class="er-after">${f.after}</div>` : '';
    return { html: erd(spec, { show: f.all ? null : [...shown], hl: f.hl, mult: f.mult ?? o.mult ?? true, frame, scale: o.scale }) + extra, cap: f.cap };
  });
  return stepper(sel, steps, { interval: o.interval || 2600 });
}
// all ids of a spec (handy for "show everything" frames)
const erIds = spec => [...(spec.n || []).map(n => n[0]), ...(spec.a || []).map(a => a[0] + '.' + a[1].replace(/^[_~\/{]|}$/g, ''))];
// put a diagram into an element
function erdInto(sel, spec, opts) { $(sel).innerHTML = erd(spec, opts); }

// ---------------------------------------------------------------- relational schema cards
// rels: [{n: 'Student', c: ['*id', 'name', 'dept_id>Department(id)'], cls: 'new'|'hl'|'del', note}]
//   column prefix * = primary key; suffix >T or >T(col) = foreign key; ! = NOT NULL; ? = UNIQUE; name:TYPE sets a type
function relParse(col) {
  // *name:TYPE!?>Table(col)@group^   (^ = ON DELETE CASCADE, @group = columns forming one composite FK)
  const m = col.match(/^(\*)?([^>:!?]+)(:[^>!?]+)?([!?]*)(?:>(\w+)(?:\(([\w, ]+)\))?(?:@(\w+))?(\^)?)?([!?]*)$/);
  if (!m) throw new Error('bad column ' + col);
  const flags = (m[4] || '') + (m[9] || '');
  return { pk: !!m[1], name: m[2].trim(), type: m[3] ? m[3].slice(1) : null, nn: flags.includes('!'), uq: flags.includes('?'),
           fk: m[5] || null, fkcol: m[6] || null, grp: m[7] || '', cascade: !!m[8] };
}
function relSchema(rels, opts = {}) {
  return `<div class="rs">${rels.map(r => {
    const cols = r.c.map(relParse);
    const fks = cols.filter(c => c.fk);
    return `<div class="rs-t ${r.cls || ''}"><div class="rs-n">${_x(r.n)}</div><table class="rs-c"><tr>${cols.map(c =>
      `<td class="${c.pk ? 'pk' : ''}${c.fk ? ' fk' : ''}">${_x(c.name)}</td>`).join('')}</tr></table>` +
      (fks.length ? `<div class="rs-f">${fks.map(c => `${_x(c.name)} → ${_x(c.fk)}${c.fkcol ? '(' + _x(c.fkcol) + ')' : ''}`).join('<br>')}</div>` : '') +
      (r.note ? `<div class="rs-note">${r.note}</div>` : '') + '</div>';
  }).join('')}</div>`;
}
function relInto(sel, rels) { $(sel).innerHTML = relSchema(rels); }
// one-line textbook notation: Student(id, name, dept_id)
function relLine(r) {
  return `<b>${_x(r.n)}</b>(${r.c.map(relParse).map(c => c.pk ? `<u>${_x(c.name)}</u>` : c.fk ? `<i>${_x(c.name)}</i>` : _x(c.name)).join(', ')})`;
}

// Oracle DDL. Types: explicit name:TYPE, otherwise a guess from the column name.
function guessType(n) {
  n = n.toLowerCase();
  if (/date|_on$|dob|birth/.test(n)) return 'DATE';
  if (/(price|salary|cost|amount|amt|budget|balance|fee|rate|value|assets|stockprice|weight|gpa)/.test(n)) return 'NUMBER(10,2)';
  if (/(^|_)(qty|quantity|count|credits?|rating|year|age|units|level|term|hours|percentage|pct|capacity|speed|pages|limit|days|no|num|number|ssn|nid)$/.test(n)) return 'NUMBER(10)';
  return 'VARCHAR2(40)';
}
function ddl(rels, { drop = false } = {}) {
  const byName = Object.fromEntries(rels.map(r => [r.n, r.c.map(relParse)]));
  // referenced tables first (Oracle checks REFERENCES at CREATE time); a cycle keeps the given order
  const sorted = [], left = [...rels];
  while (left.length) {
    const i = left.findIndex(r => byName[r.n].every(c => !c.fk || c.fk === r.n || !left.some(x => x.n === c.fk)));
    sorted.push(...left.splice(i < 0 ? 0 : i, 1));
  }
  const out = [];
  for (const r of sorted) {
    const cols = byName[r.n], pk = cols.filter(c => c.pk).map(c => c.name);
    const lines = cols.map(c => {
      let t = c.type;
      if (!t && c.fk && byName[c.fk]) {   // FK column takes the referenced column's type
        const tc = byName[c.fk].filter(x => x.pk), ref = c.fkcol ? byName[c.fk].find(x => x.name === c.fkcol) : tc.length === 1 ? tc[0] : tc.find(x => x.name === c.name);
        if (ref) t = ref.type || guessType(ref.name);
      }
      t = t || guessType(c.name);
      return `  ${c.name.padEnd(14)} ${t}${c.nn && !c.pk ? ' NOT NULL' : ''}${c.uq ? ' UNIQUE' : ''}`;
    });
    if (pk.length) lines.push(`  CONSTRAINT ${(r.n + '_pk').toLowerCase()} PRIMARY KEY (${pk.join(', ')})`);
    // group FK columns by target table (composite FKs to a weak entity / composite key)
    const groups = {};
    cols.filter(c => c.fk).forEach(c => { const k = c.fk + '|' + c.grp; (groups[k] = groups[k] || []).push(c); });
    let k = 1;
    for (const g of Object.values(groups)) {
      const T = g[0].fk, refPk = byName[T] ? byName[T].filter(x => x.pk).map(x => x.name) : [];
      // a composite FK must list every column of the referenced key; split repeated single FKs (two roles)
      if (refPk.length > 1 && g.length === refPk.length) {
        lines.push(`  CONSTRAINT ${(r.n + '_fk' + k++).toLowerCase()} FOREIGN KEY (${g.map(c => c.name).join(', ')}) REFERENCES ${T} (${g.map(c => c.fkcol || refPk[g.indexOf(c)]).join(', ')})${g[0].cascade ? ' ON DELETE CASCADE' : ''}`);
      } else for (const c of g)
        lines.push(`  CONSTRAINT ${(r.n + '_fk' + k++).toLowerCase()} FOREIGN KEY (${c.name}) REFERENCES ${T} (${c.fkcol || refPk[0] || c.name})${c.cascade ? ' ON DELETE CASCADE' : ''}`);
    }
    out.push(`${drop ? `DROP TABLE ${r.n} CASCADE CONSTRAINTS;\n` : ''}CREATE TABLE ${r.n} (\n${lines.join(',\n')}\n);`);
  }
  return out.join('\n\n');
}

// ---------------------------------------------------------------- ER → relational converter
// Text format, one statement per line ('#' starts a comment):
//   entity Student: _id, name, {phone}, address(street, city), /age
//   weak entity Room of Building: ~room_no, capacity            (identifying relationship implied)
//   rel enrolls: Student N, Course M; grade, semester
//   rel advises: Student N total, Faculty 1; start_date
//   rel manages: Employee 1 as manager, Employee N as subordinate
//   rel contract: Actor N, Film N, Studio 1; salary              (3 or more = multi-way)
//   isa Product: SoftwareProduct(platforms), EducationalProduct(ageGroup) [er | oo | null]
function erParse(text) {
  const M = { entities: {}, rels: [], isas: [], errors: [] };
  const attrList = s => {
    const out = []; let depth = 0, cur = '';
    for (const ch of s + ',') {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    return out.map(a => {
      const m = a.match(/^([_~\/]?)\{?([A-Za-z]\w*)\}?\s*(?:\((.*)\))?$/);
      if (!m) throw new Error(`cannot read the attribute "${a}"`);
      return { name: m[2], key: m[1] === '_', pkey: m[1] === '~', der: m[1] === '/', multi: /^[_~\/]?\{/.test(a), parts: m[3] ? attrList(m[3]) : null };
    });
  };
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').trim(); if (!line) return;
    const err = msg => M.errors.push(`Line ${i + 1}: ${msg}`);
    try {
      let m;
      if ((m = line.match(/^(weak\s+)?entity\s+(\w+)(?:\s+of\s+(\w+))?\s*(?::\s*(.*))?$/i))) {
        if (m[1] && !m[3]) return err('a weak entity needs an owner: "weak entity Room of Building: ~room_no".');
        if (M.entities[m[2]]) return err(`entity ${m[2]} is defined twice.`);
        M.entities[m[2]] = { name: m[2], weak: !!m[1], owner: m[3] || null, attrs: m[4] ? attrList(m[4]) : [], line: i + 1 };
      } else if ((m = line.match(/^rel(?:ationship)?\s+(\w+)\s*:\s*([^;]*)(?:;\s*(.*))?$/i))) {
        const parts = m[2].split(',').map(s => s.trim()).filter(Boolean).map(p => {
          const q = p.match(/^(\w+)\s+(1|N|M|many|one)(\s+total)?(?:\s+as\s+(\w+))?$/i);
          if (!q) throw new Error(`cannot read "${p}". Write it as "Entity 1" or "Entity N", optionally followed by "total" and "as role".`);
          return { e: q[1], one: /^(1|one)$/i.test(q[2]), total: !!q[3], role: q[4] || null };
        });
        if (parts.length < 2) return err(`relationship ${m[1]} needs at least two participants.`);
        M.rels.push({ name: m[1], parts, attrs: m[3] ? attrList(m[3]) : [], line: i + 1 });
      } else if ((m = line.match(/^isa\s+(\w+)\s*:\s*(.*?)\s*(?:\[(\w+)\])?$/i))) {
        const subs = attrList(m[2]).map(s => ({ name: s.name, attrs: s.parts || [] }));
        const how = (m[3] || 'er').toLowerCase();
        if (!['er', 'oo', 'null'].includes(how)) return err('the isa strategy must be [er], [oo] or [null].');
        M.isas.push({ sup: m[1], subs, how, line: i + 1 });
      } else err('start the line with "entity", "weak entity", "rel" or "isa".');
    } catch (e) { err(e.message); }
  });
  // semantic checks
  for (const e of Object.values(M.entities)) {
    if (e.weak && !M.entities[e.owner]) M.errors.push(`Line ${e.line}: the owner ${e.owner} of weak entity ${e.name} is not defined.`);
    const keys = e.attrs.filter(a => a.key), pk = e.attrs.filter(a => a.pkey);
    if (!e.weak && !keys.length && !M.isas.some(s => s.subs.some(x => x.name === e.name)))
      M.errors.push(`Line ${e.line}: entity ${e.name} has no key. Mark its key attribute with _ (for example _id).`);
    if (e.weak && !pk.length) M.errors.push(`Line ${e.line}: weak entity ${e.name} has no partial key. Mark it with ~ (for example ~room_no).`);
  }
  const isSub = n => M.isas.some(s => s.subs.some(x => x.name === n));
  for (const r of M.rels) for (const p of r.parts) if (!M.entities[p.e] && !isSub(p.e)) M.errors.push(`Line ${r.line}: relationship ${r.name} uses ${p.e}, which is not defined as an entity.`);
  for (const s of M.isas) if (!M.entities[s.sup]) M.errors.push(`Line ${s.line}: the superclass ${s.sup} is not defined as an entity.`);
  return M;
}
// Convert a parsed model. Returns {rels: [...relSchema rels], steps: [{cap, rels (cumulative), hl}]}
function erConvert(text) {
  const M = typeof text === 'string' ? erParse(text) : text;
  if (M.errors.length) return { errors: M.errors };
  const T = {}, order = [], steps = [];
  const table = (n) => { if (!T[n]) { T[n] = { n, c: [] }; order.push(n); } return T[n]; };
  const col = (t, spec) => { const name = relParse(spec).name; if (!t.c.some(c => relParse(c).name === name)) t.c.push(spec); };
  const snap = (cap, hl) => steps.push({ cap, rels: order.map(n => ({ ...T[n], c: [...T[n].c], cls: hl.includes(n) ? 'new' : '' })) });
  const flat = (attrs, pre = '') => attrs.flatMap(a => a.parts ? flat(a.parts, '') : [{ ...a, name: pre + a.name }]);
  // superclass of an entity in an [er]-style hierarchy shares its key
  const subOf = {}; M.isas.forEach(s => s.subs.forEach(x => subOf[x.name] = s));
  const keyOf = name => {   // [{name, from}] the primary key columns of an entity's table
    const e = M.entities[name];
    if (subOf[name] && !e?.attrs.some(a => a.key)) return keyOf(subOf[name].sup);
    if (!e) return [];
    const own = flat(e.attrs).filter(a => a.key || a.pkey).map(a => a.name);
    return e.weak ? [...keyOf(e.owner).map(k => (k === 'id' || own.includes(k) ? e.owner.toLowerCase() + '_' + k : k)), ...own] : own;
  };
  const nullHier = new Set(M.isas.filter(s => s.how === 'null').flatMap(s => s.subs.map(x => x.name)));
  const ooHier = new Set(M.isas.filter(s => s.how === 'oo').flatMap(s => s.subs.map(x => x.name)));
  const tabOf = name => nullHier.has(name) ? tabOf(subOf[name].sup) : name;

  // 1. strong entities
  for (const e of Object.values(M.entities)) {
    if (e.weak || nullHier.has(e.name) || ooHier.has(e.name) || (subOf[e.name] && !e.attrs.some(a => a.key))) continue;
    const t = table(e.name), simple = flat(e.attrs).filter(a => !a.multi && !a.der);
    simple.forEach(a => col(t, (a.key ? '*' : '') + a.name));
    const comp = e.attrs.filter(a => a.parts && !a.multi), der = e.attrs.filter(a => a.der);
    snap(`<b>Strong entity ${e.name}</b> becomes a table with the same name. Its simple attributes become columns and its key ` +
      `(${keyOf(e.name).join(', ')}) becomes the primary key.` +
      (comp.length ? ` The composite attribute${comp.length > 1 ? 's' : ''} ${comp.map(a => a.name).join(', ')} ${comp.length > 1 ? 'are' : 'is'} flattened: only the component attributes (${flat(comp).map(a => a.name).join(', ')}) become columns.` : '') +
      (der.length ? ` Derived attribute${der.length > 1 ? 's' : ''} ${der.map(a => a.name).join(', ')} ${der.length > 1 ? 'are' : 'is'} not stored; a query or view computes ${der.length > 1 ? 'them' : 'it'}.` : ''), [e.name]);
  }
  // 2. weak entities (owners first)
  const weak = Object.values(M.entities).filter(e => e.weak);
  const done = new Set(); let guard = 0;
  while (done.size < weak.length && guard++ < 50) for (const e of weak) {
    if (done.has(e.name) || (M.entities[e.owner].weak && !done.has(e.owner))) continue;
    done.add(e.name);
    const t = table(e.name), own = keyOf(e.owner), mine = keyOf(e.name);
    own.forEach((k, j) => col(t, '*' + mine[j] + '>' + tabOf(e.owner) + '(' + k + ')@own^'));
    flat(e.attrs).filter(a => !a.multi && !a.der).forEach(a => col(t, (a.pkey ? '*' : '') + a.name));
    snap(`<b>Weak entity ${e.name}</b> becomes a table. It borrows the key of its owner ${e.owner} (${own.join(', ')}) as a foreign key, ` +
      `and its primary key is that borrowed key plus its partial key: (${mine.join(', ')}). The identifying relationship needs no table of its own.`, [e.name]);
  }
  // 3. isa hierarchies
  for (const s of M.isas) {
    const supKey = keyOf(s.sup), supAttrs = flat(M.entities[s.sup].attrs).filter(a => !a.multi && !a.der);
    if (s.how === 'er') {
      for (const x of s.subs) {
        const t = table(x.name);
        supKey.forEach(k => col(t, '*' + k + '>' + s.sup + '(' + k + ')@sup^'));
        flat([...(M.entities[x.name]?.attrs || []), ...x.attrs]).filter(a => !a.multi && !a.der && !a.key).forEach(a => col(t, a.name));
      }
      snap(`<b>isA hierarchy under ${s.sup}, E/R style:</b> every subclass gets its own table holding the superclass key (${supKey.join(', ')}) ` +
        `plus only its own attributes. The key is also a foreign key to ${s.sup}. Inherited attributes stay in ${s.sup}.`, s.subs.map(x => x.name));
    } else if (s.how === 'oo') {
      for (const x of s.subs) {
        const t = table(x.name);
        supAttrs.forEach(a => col(t, (a.key ? '*' : '') + a.name));
        flat([...(M.entities[x.name]?.attrs || []), ...x.attrs]).filter(a => !a.multi && !a.der && !a.key).forEach(a => col(t, a.name));
      }
      snap(`<b>isA hierarchy under ${s.sup}, object-oriented style:</b> each subclass table repeats all the superclass attributes, so one tuple ` +
        `holds everything about an entity. ${s.sup} keeps only the entities that belong to no subclass. (With overlapping subclasses the textbook ` +
        `creates one table per combination of classes; this tool shows the disjoint case.)`, s.subs.map(x => x.name));
    } else {
      const t = table(s.sup);
      s.subs.forEach(x => flat([...(M.entities[x.name]?.attrs || []), ...x.attrs]).filter(a => !a.multi && !a.der && !a.key).forEach(a => col(t, a.name)));
      snap(`<b>isA hierarchy under ${s.sup}, null style:</b> one table ${s.sup} holds the attributes of the superclass and of every subclass. ` +
        `An entity that is not in some subclass has NULL in that subclass's columns.`, [s.sup]);
    }
  }
  // 4. multivalued attributes
  for (const e of Object.values(M.entities)) for (const a of e.attrs.filter(a => a.multi)) {
    const owner = tabOf(e.name), n = e.name + '_' + a.name, t = table(n), key = keyOf(e.name);
    key.forEach(k => col(t, '*' + k + '>' + owner + '(' + k + ')@own^'));
    (a.parts ? flat(a.parts) : [a]).forEach(p => col(t, '*' + p.name));
    snap(`<b>Multivalued attribute ${a.name}</b> of ${e.name} gets its own table ${n}: one row per value, holding the owner's key ` +
      `(${key.join(', ')}) as a foreign key. The primary key is all the columns, so the same value cannot be stored twice for one ${e.name}.`, [n]);
  }
  // 5. relationships
  for (const r of M.rels) {
    const ra = flat(r.attrs).filter(a => !a.der);
    const cols = r.parts.map((p, j) => {
      const ks = keyOf(p.e), dup = r.parts.filter(q => q.e === p.e).length > 1;
      return { p, ks, names: ks.map(k => (p.role ? p.role + '_' : dup ? p.e.toLowerCase() + (j + 1) + '_' : '') + k) };
    });
    // two participants with the same key name (both "id") would collide in one table: prefix with the entity name
    cols.filter(c => cols.some(d => d !== c && d.names.some(n => c.names.includes(n)))).forEach(c => c.names = c.names.map(n => c.p.e.toLowerCase() + '_' + n));
    const ones = cols.filter(c => c.p.one), many = cols.filter(c => !c.p.one);
    if (r.parts.length === 2 && ones.length >= 1) {
      // binary 1:N or 1:1 → foreign key on the "many" side (or the total side for 1:1)
      let host, other;
      if (ones.length === 1) { host = many[0]; other = ones[0]; }
      else { host = cols.find(c => c.p.total) || cols[0]; other = cols.find(c => c !== host); }
      const t = table(tabOf(host.p.e)), nn = host.p.total ? '!' : '', uq = ones.length === 2 ? '?' : '';
      // the borrowed key must not collide with a column the host table already has (Student.id vs Dept.id)
      if (other.names.some(n => t.c.some(c => relParse(c).name === n))) other.names = other.names.map(n => other.p.e.toLowerCase() + '_' + n);
      other.names.forEach((n, j) => col(t, n + nn + uq + '>' + tabOf(other.p.e) + '(' + other.ks[j] + ')@' + r.name));
      ra.forEach(a => col(t, a.name));
      const who = c => c.p.role ? `${c.p.e} (as ${c.p.role})` : c.p.e;
      snap(ones.length === 1
        ? `<b>${r.name}</b> is many-to-one from ${who(host)} to ${who(other)}. No new table: the key of the "one" side (${other.ks.join(', ')}) is added to ` +
          `<b>${host.p.e}</b> as a foreign key${other.names.join() !== other.ks.join() ? ` named ${other.names.join(', ')}` : ''}` +
          `${ra.length ? `, together with the relationship's attribute${ra.length > 1 ? 's' : ''} ${ra.map(a => a.name).join(', ')}` : ''}.` +
          (host.p.total ? ` ${host.p.e} participates totally, so the column is NOT NULL.` : ` ${host.p.e} participates partially, so the column may be NULL.`)
        : `<b>${r.name}</b> is one-to-one. The key of ${other.p.e} goes into ${host.p.e}${host.p.total ? ' (the side with total participation, so the column is NOT NULL)' : ''}, ` +
          `with a UNIQUE constraint so that no ${other.p.e} is used twice.`, [tabOf(host.p.e)]);
    } else {
      // many-to-many or multi-way → its own table
      // key = all participants except one with an arrow (that one is determined by the others; with several
      // arrows, any one of them may be dropped, so we drop the first)
      const t = table(r.name), keyCols = r.parts.length === 2 || !ones.length ? cols : cols.filter(c => c !== ones[0]);
      cols.forEach((c, i) => c.names.forEach((n, j) => col(t, (keyCols.includes(c) ? '*' : '') + n + '>' + tabOf(c.p.e) + '(' + c.ks[j] + ')@p' + i)));
      ra.forEach(a => col(t, a.name));
      const pk = keyCols.flatMap(c => c.names);
      snap(r.parts.length === 2
        ? `<b>${r.name}</b> is many-to-many, so it becomes its own table holding the keys of both entity sets as foreign keys` +
          `${ra.length ? ` and its attribute${ra.length > 1 ? 's' : ''} ${ra.map(a => a.name).join(', ')}` : ''}. The primary key is (${pk.join(', ')}).` +
          (r.parts[0].e === r.parts[1].e ? ` Both participants are ${r.parts[0].e}, so the columns are renamed by role.` : '')
        : `<b>${r.name}</b> connects ${r.parts.length} entity sets, so it becomes its own table with all their keys. ` +
          (ones.length ? `The arrow toward ${ones[0].p.e} means the other participants together determine it, so the primary key is (${pk.join(', ')}).` +
            (ones.length > 1 ? ` (Each further arrow gives another candidate key; declare it UNIQUE if needed.)` : '')
                       : `With no arrows, the primary key is all the keys together: (${pk.join(', ')}).`), [r.name]);
    }
  }
  const rels = order.map(n => T[n]);
  return { rels, steps, model: M };
}

// Simple automatic layout for the converter's preview diagram.
function erAutoSpec(M) {
  const names = Object.keys(M.entities), n = names.length, R = 110 + n * 26, P = {};
  names.forEach((e, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; P[e] = [R * Math.cos(a) * 1.45, R * Math.sin(a)]; });
  const spec = { n: [], a: [], l: [] }, used = [];
  const free = (x, y) => { for (let k = 0; k < 12; k++) { if (!used.some(([u, v]) => Math.abs(u - x) < 100 && Math.abs(v - y) < 54)) break; y += 56; } used.push([x, y]); return [x, y]; };
  names.forEach(e => { const E = M.entities[e]; spec.n.push([e, E.weak ? 'W' : 'E', ...P[e]]); used.push(P[e]); });
  const subOf = {}; M.isas.forEach(s => s.subs.forEach(x => subOf[x.name] = s));
  for (const s of M.isas) {
    const sp = P[s.sup]; if (!sp) continue;
    const id = 'isa_' + s.sup, [x, y] = free(sp[0], sp[1] + 70);
    spec.n.push([id, 'D', x, y, 'isA']);
    spec.l.push([s.sup, id]);
    s.subs.forEach((x2, j) => {
      if (!P[x2.name]) { P[x2.name] = free(x + (j - (s.subs.length - 1) / 2) * 150, y + 80); spec.n.push([x2.name, 'E', ...P[x2.name]]); }
      spec.l.push([x2.name, id]);
      x2.attrs.forEach((a, k) => spec.a.push([x2.name, a.name, (k - (x2.attrs.length - 1) / 2) * 90, 50]));
    });
  }
  for (const e of Object.values(M.entities).filter(e => e.weak)) {
    const id = 'id_' + e.name, [x, y] = free((P[e.name][0] + P[e.owner][0]) / 2, (P[e.name][1] + P[e.owner][1]) / 2);
    spec.n.push([id, 'I', x, y, 'owned']);
    spec.l.push([e.owner, id, { one: true }], [e.name, id, { total: true }]);
  }
  M.rels.forEach(r => {
    const xs = r.parts.map(p => P[p.e]), cx = xs.reduce((s, p) => s + p[0], 0) / xs.length, cy = xs.reduce((s, p) => s + p[1], 0) / xs.length;
    const self = r.parts.length === 2 && r.parts[0].e === r.parts[1].e;
    const [x, y] = free(self ? cx + 150 : cx, self ? cy : cy);
    spec.n.push([r.name, 'R', x, y]);
    r.parts.forEach((p, j) => spec.l.push([p.e, r.name, { one: p.one, total: p.total, role: p.role || undefined, bend: self ? (j ? -40 : 40) : 0 }]));
    r.attrs.forEach((a, k) => spec.a.push([r.name, a.name, (k - (r.attrs.length - 1) / 2) * 92, 52]));
  });
  // attributes on the outer side of each entity
  names.forEach(e => {
    const E = M.entities[e], [x, y] = P[e], ang = Math.atan2(y, x / 1.45), m = E.attrs.length;
    E.attrs.forEach((a, k) => {
      const t = ang + (k - (m - 1) / 2) * 0.55, d = 92;
      const nm = (a.key ? '_' : a.pkey ? '~' : a.der ? '/' : '') + (a.multi ? '{' + a.name + '}' : a.name);
      spec.a.push([e, nm, Math.cos(t) * d * 1.35, Math.sin(t) * d * 0.75]);
      (a.parts || []).forEach((p, j) => { const u = t + (j - (a.parts.length - 1) / 2) * 0.9; spec.a.push([e + '.' + a.name, p.name, Math.cos(u) * 115, Math.sin(u) * 62]); });
    });
  });
  return spec;
}

// Interactive converter (chapter 13).
function erTool(sel, initial) {
  const host = $(sel);
  host.classList.add('ertool');
  host.innerHTML = `<label class="ert-l" for="${host.id}-in">Describe your design (one statement per line):</label>
    <textarea id="${host.id}-in" class="sq-ed ert-in" spellcheck="false" rows="9">${_x(initial)}</textarea>
    <div class="sq-btns"><button type="button" data-go>Convert ▶</button><button type="button" data-reset>Reset example</button></div>
    <div class="ert-out" aria-live="polite"></div>`;
  const ta = host.querySelector('textarea'), out = host.querySelector('.ert-out');
  const run = () => {
    const res = erConvert(ta.value);
    if (res.errors) { out.innerHTML = `<div class="ert-err"><b>Please fix ${res.errors.length === 1 ? 'this' : 'these'} first:</b><ul>${res.errors.map(e => `<li>${_x(e)}</li>`).join('')}</ul></div>`; return; }
    if (!res.steps.length) { out.innerHTML = '<div class="ert-err">Nothing to convert yet. Add at least one entity.</div>'; return; }
    let pic = '';
    try { pic = `<figure class="wide"><div class="figlabel">Your design as an ER diagram (automatic layout; lines may cross)</div>${erd(erAutoSpec(res.model))}</figure>`; } catch (e) { pic = ''; }
    out.innerHTML = pic + `<figure class="wide"><span class="anim-tag">Animation</span><div class="ert-st"></div></figure>
      <h4>Final schema</h4><p class="ert-lines">${res.rels.map(relLine).join('<br>')}</p><div class="ert-sql"></div>`;
    stepper(out.querySelector('.ert-st'), res.steps.map(s => ({ html: relSchema(s.rels), cap: s.cap })));
    const box = out.querySelector('.ert-sql'); box.id = host.id + '-sql';
    if (typeof sqlPlay === 'function') sqlPlay('#' + box.id, { query: ddl(res.rels) + "\n\nSELECT table_name FROM (SELECT name AS table_name FROM sqlite_master WHERE type = 'table');", note: 'The generated Oracle DDL. Run it to check that the keys and foreign keys are consistent (SQLite underneath).' });
    else box.innerHTML = `<pre>${_x(ddl(res.rels))}</pre>`;
  };
  host.querySelector('[data-go]').onclick = run;
  host.querySelector('[data-reset]').onclick = () => { ta.value = initial; run(); };
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } });
  run();
}

// ---------------------------------------------------------------- multiplicity drill
const DRILL = [['Student', 'enrolls', 'Course'], ['Manager', 'manages', 'Branch'], ['Course', 'offeredBy', 'Department'], ['Member', 'borrows', 'Book'],
  ['Employee', 'worksIn', 'Department'], ['Person', 'owns', 'Passport'], ['Film', 'producedBy', 'Studio'], ['Customer', 'places', 'Order'],
  ['Doctor', 'treats', 'Patient'], ['Team', 'hasCaptain', 'Player']];
function cardDrill(sel) {
  const host = $(sel); host.classList.add('drill');
  let score = 0, n = 0;
  const next = () => {
    const [A, R, B] = DRILL[Math.floor(Math.random() * DRILL.length)];
    const oa = Math.random() < 0.5, ob = Math.random() < 0.5, ta = Math.random() < 0.3, tb = Math.random() < 0.3;
    const spec = { n: [[A, 'E', 0, 0], [R, 'R', 190, 0], [B, 'E', 380, 0]], l: [[A, R, { one: oa, total: ta }], [B, R, { one: ob, total: tb }]] };
    const kinds = ['many-to-many', `many-to-one (each ${A} with at most one ${B})`, `one-to-many (each ${B} with at most one ${A})`, 'one-to-one'];
    const right = oa && ob ? 3 : ob ? 1 : oa ? 2 : 0;
    const qs = [
      { q: `What kind of relationship is <b>${R}</b>?`, opts: kinds, a: right },
      { q: `Must every <b>${A}</b> take part in ${R}?`, opts: ['Yes: total participation (double line)', 'No: partial participation (single line)'], a: ta ? 0 : 1 },
      { q: `Must every <b>${B}</b> take part in ${R}?`, opts: ['Yes: total participation (double line)', 'No: partial participation (single line)'], a: tb ? 0 : 1 },
    ];
    host.innerHTML = `<div class="drill-score">Drill score: ${score} / ${n}</div><figure>${erd(spec)}</figure>` + qs.map((q, k) =>
      `<div class="qz-item" data-k="${k}"><div class="qz-q">${q.q}</div><div class="qz-opts">${q.opts.map((o, j) => `<button type="button" class="qz-opt" data-j="${j}">${o}</button>`).join('')}</div><div class="qz-why" hidden></div></div>`).join('') +
      `<div class="sq-btns"><button type="button" data-next>New diagram ▶</button></div>`;
    const why = [
      `${ob ? `The arrow points at ${B}, so a ${A} is related to at most one ${B}.` : `No arrow at ${B}, so a ${A} may be related to many ${B}s.`} ${oa ? `The arrow at ${A} means a ${B} is related to at most one ${A}.` : `No arrow at ${A}, so a ${B} may be related to many ${A}s.`}`,
      ta ? `The line from ${A} is doubled: every ${A} must appear in at least one ${R} pair.` : `A single line: some ${A}s may have no ${R} at all.`,
      tb ? `The line from ${B} is doubled: every ${B} must appear in at least one ${R} pair.` : `A single line: some ${B}s may have no ${R} at all.`];
    host.querySelectorAll('.qz-item').forEach(item => item.addEventListener('click', e => {
      const b = e.target.closest('.qz-opt'); if (!b || item.dataset.done) return;
      item.dataset.done = 1; const k = +item.dataset.k, ok = +b.dataset.j === qs[k].a; n++; if (ok) score++;
      item.querySelectorAll('.qz-opt').forEach((o, j) => { o.disabled = true; if (j === qs[k].a) o.classList.add('ok'); });
      if (!ok) b.classList.add('bad');
      const w = item.querySelector('.qz-why'); w.hidden = false; w.innerHTML = `<b>${ok ? 'Correct.' : 'Not quite.'}</b> ${why[k]}`;
      host.querySelector('.drill-score').textContent = `Drill score: ${score} / ${n}`;
    }));
    host.querySelector('[data-next]').onclick = next;
  };
  next();
}
