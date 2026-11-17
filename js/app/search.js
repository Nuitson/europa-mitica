/* El índice de búsqueda y las claves de los bloques. */
import { DATA, esc, norm } from './base.js';
import { sagaIndex } from './saga/characters.js';

/* ---------------------------------------------------------------- search index */
let INDEX = null;
function resetIndex() { INDEX = null; } // for saga/core.js: the saga changed, rebuild on the next search
function blockTexts(b, push) {
  const k = b._k;
  switch (b.t) {
    case 'p': case 'ex': case 'base': case 'note': case 'lbl': case 'kicker': case 'h3': case 'h4': case 'ref':
      push(k, b.x); break;
    case 'sec': push(k, b.a + ' ' + b.b); break;
    case 'levels': b.rows.forEach((r, i) => r[1].forEach((c, j) => c.forEach(e => push(k + '.' + i, (b.cols[j] ? b.cols[j].split('\n')[0] + ' · ' : '') + 'Nivel ' + r[0] + ': ' + e)))); break;
    case 'table': b.rows.forEach((r, i) => push(k + '.' + i, r.filter(Boolean).join(' · '))); break;
    case 'grid': (b.body || []).forEach((r, i) => push(k + '.' + i, r.filter(Boolean).join(' · '))); break;
    case 'kv': b.items.forEach(it => push(k, it[0] + ': ' + it[1])); break;
    case 'formula': b.items.forEach((it, i) => push(k + '.' + i, it.n + ': ' + it.f)); break;
    case 'defs': b.items.forEach((it, i) => push(k + '.' + i, it.n + ': ' + (it.x || ''))); break;
    case 'cards': b.items.forEach((it, i) => { push(k + '.' + i, [it.title, it.meta].filter(Boolean).join(' · ')); (it.body || []).forEach(x => blockTexts(x, push)); }); break;
    case 'steps': b.items.forEach(it => { push(k, it.title); (it.body || []).forEach(x => blockTexts(x, push)); }); break;
    case 'cols': b.items.forEach(col => col.forEach(x => blockTexts(x, push))); break;
    case 'details': b.items.forEach(it => (it.body || []).forEach(x => blockTexts(x, push))); break;
    case 'ul': b.items.forEach(x => push(k, x)); break;
    case 'timeline': b.items.forEach((it, i) => push(k + '.' + i, it.s + ' ' + it.y + ': ' + (it.a || '') + ' ' + it.subj.map(s => s[0]).join(', '))); break;
    case 'visledger': b.rows.forEach((r, i) => push(k + '.' + i, [r.s, r.y, r.tp, r.n].filter(Boolean).join(' · '))); break;
    case 'formbonus': b.items.forEach(it => push(k, it[0] + ': ' + it[1])); break;
    case 'person': push(k, b.name + ' · ' + b.concept); break;
    case 'hero': push(k, b.title + ' · ' + (b.sub || '')); break;
    case 'abilities': b.groups.forEach(g => g.items.forEach(it => push(k, it.n + (it.e ? ' (' + it.e + ')' : '') + ' ' + it.v))); break;
    default: break;
  }
}
function buildIndex() {
  INDEX = [];
  DATA.docs.forEach(d => d.sheets.forEach(s => {
    INDEX.push({ d: d.id, s: s.id, k: null, t: d.title + ' · ' + s.title, n: norm(d.title + ' ' + s.title), title: true });
    s.blocks.forEach(b => blockTexts(b, (k, t) => { if (t) INDEX.push({ d: d.id, s: s.id, k: k, t: t, n: norm(t) }); }));
  }));
  sagaIndex(e => { e.n = norm(e.t + ' ' + e.sub); INDEX.push(e); });
}
function search(q) {
  if (!INDEX) buildIndex();
  const terms = norm(q).split(/\s+/).filter(t => t.length > 1);
  if (!terms.length) return [];
  const out = [];
  for (const e of INDEX) {
    if (terms.every(t => e.n.includes(t))) out.push(e);
    if (out.length > 400) break;
  }
  out.sort((a, b) => (b.title ? 1 : 0) - (a.title ? 1 : 0));
  return out;
}
function highlight(text, q) {
  const terms = norm(q).split(/\s+/).filter(t => t.length > 1);
  let s = text.length > 240 ? text : text;
  const n = norm(s);
  // window around first match
  let first = -1;
  terms.forEach(t => { const i = n.indexOf(t); if (i >= 0 && (first < 0 || i < first)) first = i; });
  let start = 0;
  if (s.length > 220 && first > 80) start = first - 70;
  let piece = s.slice(start, start + 220);
  const pn = norm(piece);
  const marks = [];
  terms.forEach(t => { let i = pn.indexOf(t); while (i >= 0) { marks.push([i, i + t.length]); i = pn.indexOf(t, i + t.length); } });
  marks.sort((a, b) => a[0] - b[0]);
  let html = '', pos = 0;
  marks.forEach(([a, b]) => { if (a < pos) return; html += esc(piece.slice(pos, a)) + '<mark>' + esc(piece.slice(a, b)) + '</mark>'; pos = b; });
  html += esc(piece.slice(pos));
  return (start > 0 ? '… ' : '') + html + (start + 220 < s.length ? ' …' : '');
}

/* ---------------------------------------------------------------- block keys */
function keyBlocks(blocks, counter) {
  blocks.forEach(b => {
    b._k = 'b' + (counter.n++);
    if (b.t === 'cols') b.items.forEach(col => keyBlocks(col, counter));
    if (b.t === 'cards') b.items.forEach(it => keyBlocks(it.body || [], counter));
    if (b.t === 'steps') b.items.forEach(it => keyBlocks(it.body || [], counter));
    if (b.t === 'details') b.items.forEach(it => keyBlocks(it.body || [], counter));
  });
}
DATA.docs.forEach(d => d.sheets.forEach(s => keyBlocks(s.blocks, { n: 0 })));

export { highlight, resetIndex, search };
