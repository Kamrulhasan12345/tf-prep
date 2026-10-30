// Lec 01 (Ishrak): small SVG kit for box-and-arrow diagrams.
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
