window.EM_START = function () {
'use strict';
// js/gate.js loads data/*.json, joins the saga's own folder and leaves it all in window.EM_DATA before starting the page
const DATA = window.EM_DATA.data;
const IMG = window.EM_DATA.img;
const DOCS = {};
DATA.docs.forEach(d => { DOCS[d.id] = d; });
const ARTS_T = ['Creo', 'Intellego', 'Muto', 'Perdo', 'Rego'];
const ARTS_F = ['Animal', 'Aquam', 'Auram', 'Corpus', 'Herbam', 'Ignem', 'Imaginem', 'Mentem', 'Terram', 'Vim'];
const ARTS = ARTS_T.concat(ARTS_F);
const ABBR = { Creo: 'Cr', Intellego: 'In', Muto: 'Mu', Perdo: 'Pe', Rego: 'Re', Animal: 'An', Aquam: 'Aq', Auram: 'Au',
  Corpus: 'Co', Herbam: 'He', Ignem: 'Ig', Imaginem: 'Im', Mentem: 'Me', Terram: 'Te', Vim: 'Vi' };
const ICON = {
  folder: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 3.5A1 1 0 0 1 2.5 2.5h3.6l1.5 1.6h5.9a1 1 0 0 1 1 1v7.4a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/></svg>',
  sheet: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M2.5 5.5h11M2.5 9h11M2.5 12h11M6.5 5.5v9"/></svg>',
  ext: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 2H2v8h8V7M7 1.5h3.5V5M10.5 1.5 5.5 6.5"/></svg>',
  cube: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 2 17 6v8l-7 4-7-4V6z M3 6l7 4 7-4 M10 10v8"/></svg>',
  search: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>'
};

/* ---------------------------------------------------------------- helpers */
function h(tag, attrs, kids) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style') n.setAttribute('style', v);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  if (kids != null) (Array.isArray(kids) ? kids : [kids]).forEach(c => {
    if (c == null || c === false) return;
    n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  });
  return n;
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function br(s) { return esc(s).replace(/\n/g, '<br>'); }
function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function artOf(s) {
  if (!s) return null;
  const k = norm(s).trim();
  for (const a of ARTS) if (norm(a) === k) return a;
  if (k === 'imagem' || k === 'imaggen' || k === 'imagen') return 'Imaginem';
  return null;
}
function artVar(a) { return a ? 'var(--' + ABBR[a].toLowerCase() + ')' : 'var(--ink-3)'; }
function artChip(a, label) {
  const c = artOf(a);
  return h('span', { class: 'art', style: '--a:' + artVar(c), title: a }, label != null ? label : a);
}
function toNum(s) {
  if (s == null || s === '') return NaN;
  const t = String(s).replace(/\s/g, '').replace('−', '-').replace(',', '.');
  return /^[-+]?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : NaN;
}
function fmt(n) {
  if (!isFinite(n)) return '';
  const r = Math.round(n * 100) / 100;
  return String(r).replace('.', ',');
}
function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n)); }
function opify(s) {
  return esc(s).replace(/(\s)(\+|–|-|×|x|\/|vs\.)(\s)/g, '$1<span class="op">$2</span>$3').replace(/\n/g, '<br>');
}
function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

/* ---------------------------------------------------------------- tree / paths */
const PATH = {}; // doc id -> [folder nodes]
(function walk(nodes, trail) {
  nodes.forEach(n => {
    if (n.d) PATH[n.d] = trail.slice();
    else walk(n.children || [], trail.concat([n]));
  });
})(DATA.tree, []);

function renderTree() {
  const root = document.getElementById('tree');
  function ul(nodes) {
    const u = h('ul');
    nodes.forEach(n => {
      if (n.d) {
        const d = DOCS[n.d];
        u.appendChild(h('li', null, h('a', { class: 't-doc', href: '#' + d.id, 'data-doc': d.id, html: ICON.sheet + '<span>' + esc(d.title) + '</span>' })));
      } else {
        const li = h('li');
        const f = h('div', { class: 't-folder', html: ICON.folder + '<span>' + esc(n.f) + '</span>' });
        if (n.drive) f.appendChild(h('a', { href: n.drive, target: '_blank', rel: 'noopener', title: 'Abrir carpeta en Drive', 'aria-label': 'Abrir ' + n.f + ' en Drive', html: ICON.ext }));
        li.appendChild(f);
        li.appendChild(ul(n.children || []));
        u.appendChild(li);
      }
    });
    return u;
  }
  root.appendChild(ul(DATA.tree));
  document.getElementById('sidefoot').innerHTML = 'Hecho a partir de ' + DATA.docs.length + ' hojas de cálculo de la carpeta <a href="' + esc(DATA.root.drive) + '" target="_blank" rel="noopener">' + esc(DATA.root.name) + '</a>.';
}

/* ---------------------------------------------------------------- search index */
let INDEX = null;
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

/* ---------------------------------------------------------------- block renderers */
const R = {};
function renderBlocks(blocks, ctx) {
  const frag = document.createDocumentFragment();
  blocks.forEach(b => {
    const fn = R[b.t];
    if (!fn) return;
    const node = fn(b, ctx);
    if (node) {
      if (node.nodeType === 1 && b._k && !node.hasAttribute('data-k')) node.setAttribute('data-k', b._k);
      frag.appendChild(node);
    }
  });
  return frag;
}
R.p = b => h('p', { html: br(b.x) });
R.note = b => {
  const p = h('p', { class: 'note', html: br(b.x) });
  (b.links || []).forEach(([t, u]) => { p.appendChild(document.createTextNode(' ')); p.appendChild(h('a', { href: u, target: '_blank', rel: 'noopener', text: t })); });
  return p;
};
R.lbl = b => h('div', { class: 'lbl', html: br(b.x) });
R.kicker = b => h('div', { class: 'kicker', text: b.x });
R.ref = b => h('span', { class: 'ref', text: b.x });
R.ex = b => h('div', { class: 'ex', html: br(b.x.replace(/^(ejemplo|example)\s*:?\s*/i, '')) });
R.base = b => {
  const label = 'Individuo base';
  let rest = b.x.replace(/^individuo base\s*[,:]?\s*(de\s+)?/i, '');
  rest = rest.charAt(0).toUpperCase() + rest.slice(1);
  const n = h('div', { class: 'base', html: ICON.cube + '<div><b>' + esc(label) + '</b>' + br(rest || '') + '</div>' });
  if (b.imgs && b.imgs.length) n.lastChild.appendChild(R.gallery({ items: b.imgs, small: true }));
  return n;
};
R.h3 = b => h('h3', { id: b.id ? 'a-' + b.id : null, text: b.x });
R.h4 = b => h('h4', { text: b.x });
R.ul = b => h('ul', { class: 'list' }, b.items.map(x => h('li', { html: br(x) })));
R.sec = (b, ctx) => {
  const tech = artOf(b.a), form = artOf(b.b);
  const n = h('div', { class: 'sec', id: 'a-' + b.id });
  n.appendChild(h('h3', { html: esc(b.a) + (b.b ? ' <em>' + esc(b.b) + '</em>' : '') }));
  if (tech && form) n.appendChild(h('span', { class: 'abbr', text: ABBR[tech] + ABBR[form] }));
  return n;
};
R.levels = (b) => {
  const hasHead = b.cols.some(c => c);
  const wrap = h('div', { class: 'tw' });
  const t = h('table', { class: 'lv' + (b.cols.length <= 1 ? ' one' : '') });
  if (hasHead) {
    const tr = h('tr', null, [h('th', { class: 'lvl', scope: 'col', text: 'Nivel' })]);
    b.cols.forEach(c => {
      const parts = (c || '').split('\n');
      tr.appendChild(h('th', { scope: 'col', html: esc(parts[0]) + (parts.length > 1 ? '<small>' + esc(parts.slice(1).join(' ')) + '</small>' : '') }));
    });
    t.appendChild(h('thead', null, tr));
  }
  const tb = h('tbody');
  b.rows.forEach((r, i) => {
    const tr = h('tr', { 'data-k': b._k + '.' + i }, [h('th', { class: 'lvl', scope: 'row', text: r[0] === 'General' ? 'Gen.' : r[0], title: r[0] === 'General' ? 'General' : 'Nivel ' + r[0] })]);
    r[1].forEach(cell => tr.appendChild(h('td', null, cell.map(e => h('div', { class: 'e', html: br(e).replace(/&lt;=\s*/g, '≤ ').replace(/&gt;=\s*/g, '≥ ') })))));
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  wrap.appendChild(t);
  if (!b.notes) return wrap;
  const box = h('div', { class: 'content', style: 'gap:8px' }, [wrap]);
  box.appendChild(h('details', { class: 'lv-notes' }, [h('summary', { text: 'Notas al margen de la tabla' })].concat(b.notes.map(x => h('p', { html: br(x) })))));
  return box;
};
R.grid = b => {
  const narrow = /narrow|calc/.test(b.cls || '');
  const wrap = h('div', { class: 'tw' + (narrow ? ' fit' : '') });
  const t = h('table', { class: 'grid ' + (b.cls || '') });
  if (b.cap) t.appendChild(h('caption', { text: b.cap }));
  const ncol = Math.max(b.head ? b.head.length : 0, ...(b.body || []).map(r => r.length));
  const isNum = [];
  for (let j = 0; j < ncol; j++) {
    const vals = (b.body || []).map(r => r[j]).filter(v => v !== '' && v != null);
    isNum[j] = vals.length > 0 && vals.every(v => isFinite(toNum(v)) || /^[-+]?\d+([.,]\d+)?\s*%?$/.test(String(v)));
  }
  if (b.head && b.head.some(Boolean)) {
    t.appendChild(h('thead', null, h('tr', null, b.head.map((c, j) => h('th', { scope: 'col', class: isNum[j] ? 'num' : null, text: c || '' })))));
  }
  const tb = h('tbody');
  (b.body || []).forEach((r, i) => {
    const tr = h('tr', { 'data-k': b._k + '.' + i });
    for (let j = 0; j < ncol; j++) {
      const v = r[j] == null ? '' : r[j];
      const cls = [isNum[j] ? 'num' : '', (b.fcl && j === 0) ? 'fcl' : ''].filter(Boolean).join(' ');
      const c = h(j === 0 && b.fcl ? 'th' : 'td', { class: cls || null, scope: j === 0 && b.fcl ? 'row' : null, html: j === 0 && b.info ? null : br(v) });
      if (j === 0 && b.info) c.appendChild(h('button', { type: 'button', class: 'info-btn', title: 'Ver la descripción', onclick: () => b.info(i) }, String(v)));
      tr.appendChild(c);
    }
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  wrap.appendChild(t);
  return wrap;
};
R.kv = b => {
  const dl = h('dl', { class: 'kv' + (b.cls ? ' ' + b.cls : '') });
  b.items.forEach(([k, v]) => {
    if (b.cls === 'compact') dl.appendChild(h('div', null, [h('dt', { text: k }), h('dd', { html: br(v) })]));
    else { dl.appendChild(h('dt', { text: k })); dl.appendChild(h('dd', { html: br(v) })); }
  });
  return dl;
};
R.stats = b => h('div', { class: 'stats' }, (b.live ? liveStats(b) : b.items).map(it => {
  const n = toNum(it.v);
  return h('div', { class: 'stat' }, [h('div', { class: 'l', text: it.l }), h('div', { class: 'v' + (n < 0 ? ' neg' : ''), text: isFinite(n) ? signedIfNeg(it.v) : it.v }), it.s ? h('div', { class: 's', text: it.s }) : null]);
}));
function signedIfNeg(v) { return String(v).replace(/^-/, '−'); }
R.cols = (b, ctx) => {
  const n = h('div', { class: 'cols', style: '--n:' + b.items.length + (b.w ? ';grid-template-columns:' + b.w.map(x => 'minmax(0,' + x + 'fr)').join(' ') : '') });
  b.items.forEach(col => { const c = h('div', { class: 'col' }); c.appendChild(renderBlocks(col, ctx)); n.appendChild(c); });
  return n;
};
R.cards = (b, ctx) => h('div', { class: 'cards' + (b.cls ? ' ' + b.cls : '') }, b.items.map((it, i) => {
  const c = h('article', { class: 'card', 'data-k': b._k + '.' + i });
  if (it.meta) c.appendChild(h('div', { class: 'meta', text: it.meta }));
  c.appendChild(h('h4', { text: it.title }));
  if (it.arts && it.arts.length) c.appendChild(h('div', { class: 'arts-row' }, it.arts.map(a => artChip(a))));
  if (it.body) c.appendChild(renderBlocks(it.body, ctx));
  return c;
}));
R.formula = b => {
  const n = h('div', { class: 'formula' });
  b.items.forEach((it, i) => {
    n.appendChild(h('div', { class: 'fn', 'data-k': b._k + '.' + i, text: it.n }));
    n.appendChild(h('div', { class: 'ff', html: opify(it.f) + (it.e ? '<span class="fe">' + esc(it.e) + '</span>' : '') }));
  });
  return n;
};
R.defs = b => h('div', { class: 'defs' }, b.items.map((it, i) => h('div', { class: 'def', 'data-k': b._k + '.' + i }, [
  h('div', null, [h('div', { class: 'n', text: it.n }), it.m ? h('div', { class: 'm', text: isFinite(toNum(it.m)) ? '+' + it.m + ' magnitudes' : it.m }) : null]),
  h('p', { class: it.x ? null : 'empty', html: it.x ? br(it.x) : 'Sin descripción en la hoja.' })
])));
R.steps = (b, ctx) => h('ol', { class: 'steps' }, b.items.map(it => {
  const sb = h('div', { class: 'sb' });
  sb.appendChild(renderBlocks(it.body || [], ctx));
  return h('li', null, h('div', null, [h('h4', { text: it.title }), sb]));
}));
R.formbonus = b => h('div', { class: 'formbonus' }, b.items.map(([a, x]) => h('div', null, [h('span', null, artChip(a)), h('span', { text: x })])));
R.links = b => h('div', { class: 'links' }, [b.cap ? h('span', { class: 'cap', text: b.cap }) : null].concat(b.items.map(([t, href]) => h('a', { class: 'chip', href: '#' + href, text: t }))));
R.img = b => {
  const src = IMG[b.src];
  if (!src) return null;
  return h('figure', { class: 'img' }, [h('img', { src: src, alt: b.cap || '', loading: 'lazy', style: b.w ? 'width:' + b.w + 'px' : null }), b.cap ? h('figcaption', { text: b.cap }) : null]);
};
R.gallery = b => {
  const items = b.items.filter(it => IMG[it.src]);
  if (!items.length) return null;
  const g = h('div', { class: 'gal' + (b.small ? ' small' : '') }, items.map(it => h('button', { type: 'button', 'aria-label': 'Ampliar imagen', onclick: () => lightbox(IMG[it.src]) }, h('img', { src: IMG[it.src], alt: '', loading: 'lazy' }))));
  if (!b.cap) return g;
  return h('div', { class: 'content', style: 'gap:8px' }, [h('h4', { text: b.cap }), g]);
};
function lightbox(src) {
  const lb = h('div', { class: 'lightbox', role: 'dialog', 'aria-label': 'Imagen ampliada', tabindex: '-1' }, h('img', { src: src, alt: '' }));
  const close = () => { lb.remove(); document.removeEventListener('keydown', onkey); };
  const onkey = e => { if (e.key === 'Escape') close(); };
  lb.addEventListener('click', close);
  document.addEventListener('keydown', onkey);
  document.body.appendChild(lb);
  lb.focus();
}
R.hero = b => {
  const src = IMG[b.src];
  if (!src) return null;
  return h('div', { class: 'hero' }, [h('img', { src: src, alt: '' }), h('div', null, [h('h3', { text: b.title }), b.sub ? h('p', { text: b.sub }) : null])]);
};
R.details = (b, ctx) => {
  const d = h('details', { class: 'det' }, [h('summary', { text: b.title })]);
  const di = h('div', { class: 'di' });
  b.items.forEach(it => { di.appendChild(h('h5', { text: it.title })); di.appendChild(renderBlocks(it.body || [], ctx)); });
  d.appendChild(di);
  return d;
};
R.matrix = b => {
  const wrap = h('div', { class: 'tw fit' });
  const t = h('table', { class: 'matrix' });
  t.appendChild(h('thead', null, h('tr', null, [h('th', { scope: 'col', text: 'Forma' })].concat(b.rows.map(tc => h('th', { scope: 'col', text: tc }))))));
  const tb = h('tbody');
  b.cols.forEach(form => {
    const tr = h('tr', null, [h('th', { class: 'fcl', scope: 'row' }, h('a', { href: '#' + b.doc + '--' + norm(form), style: '--a:' + artVar(form) + ';display:inline;background:none;border:0;padding:0;font:inherit;color:var(--ink)', text: form }))]);
    b.rows.forEach(tc => tr.appendChild(h('td', null, h('a', { href: '#' + b.doc + '--' + norm(form) + '--' + norm(tc), style: '--a:' + artVar(form), title: tc + ' ' + form, text: (b.abbr[tc] || tc) + (b.abbr[form] || form) }))));
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  wrap.appendChild(t);
  return wrap;
};
R.person = b => {
  const n = h('div', { class: 'person' });
  if (b.src && IMG[b.src]) n.appendChild(h('img', { src: IMG[b.src], alt: 'Retrato de ' + b.name }));
  const info = h('div');
  info.appendChild(h('h3', { text: b.name }));
  info.appendChild(h('div', { class: 'sub', text: b.sub }));
  info.appendChild(h('p', { class: 'concept', text: b.concept }));
  info.appendChild(R.kv({ items: b.facts }));
  n.appendChild(info);
  return n;
};
R.chars = b => h('div', { class: 'chars' }, b.items.map(it => {
  const v = toNum(it.v);
  return h('div', null, [h('div', { class: 'l', text: it.n }), h('div', { class: 'v' + (v < 0 ? ' neg' : ''), text: isFinite(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) : it.v }), h('div', { class: 'd', text: it.d || '' })]);
}));
R.arts = b => {
  const wrap = h('div', { class: 'artsb' });
  [['Técnicas', ARTS_T], ['Formas', ARTS_F]].forEach(([title, list]) => {
    const col = h('div');
    col.appendChild(h('h4', { text: title }));
    b.items.filter(it => list.includes(it.n)).forEach(it => {
      const L = it.lv != null ? (toNum(it.lv) || 0) : (toNum(it.v) || 0), px = toNum(it.px) || 0;
      const cur = L * (L + 1) / 2, nxt = (L + 1) * (L + 2) / 2;
      const pct = Math.max(0, Math.min(1, (px - cur) / (nxt - cur)));
      const row = h('div', { class: 'artrow', style: '--a:' + artVar(it.n), 'data-base': String(L) }, [
        h('div', { class: 'nm', text: it.n }), h('div', { class: 'lv', text: it.v }),
        h('div', { class: 'bar', title: px + ' px; ' + (nxt - px) + ' para el nivel ' + (L + 1) }, h('i', { style: 'width:' + Math.round(pct * 100) + '%' }))
      ]);
      row.appendChild(h('div', { class: 'px', text: px + ' px · faltan ' + (nxt - px) + (it.extra ? ' · ' + it.extra : '') }));
      col.appendChild(row);
    });
    wrap.appendChild(col);
  });
  return wrap;
};
R.abilities = b => h('div', { class: 'abil' }, b.groups.map(g => h('section', null, [h('h4', { text: g.g })].concat(g.items.map(it => h('div', null, [h('span', { html: esc(it.n) + (it.e ? ' <em>(' + esc(it.e) + ')</em>' : '') }), h('b', { text: it.v })]))))));
R.castgrid = b => {
  const modes = Object.keys(b.modes);
  const wrap = h('div', { class: 'content', style: 'gap:10px' });
  let cur = modes[0];
  const saved = load('castgrid:' + b._k);
  if (saved && modes.includes(saved)) cur = saved;
  const tools = modes.length > 1 ? h('div', { class: 'cg-tools', role: 'group', 'aria-label': 'Tipo de total' }) : null;
  const tw = h('div', { class: 'tw fit' });
  function draw() {
    tw.innerHTML = '';
    const data = b.modes[cur];
    const forms = b.forms.filter(f => data[f]);
    let max = 0, min = Infinity;
    forms.forEach(f => data[f].forEach(v => { const n = toNum(v); if (isFinite(n)) { max = Math.max(max, n); min = Math.min(min, n); } }));
    const t = h('table', { class: 'cg' });
    t.appendChild(h('thead', null, h('tr', null, [h('th', { scope: 'col', text: cur })].concat(b.techs.map(tc => h('th', { scope: 'col', style: 'text-align:center', html: '<span class="art" style="--a:' + artVar(tc) + '">' + esc(tc) + '</span>' }))))));
    const tb = h('tbody');
    forms.forEach(f => {
      const tr = h('tr', null, [h('th', { class: 'fcl', scope: 'row' }, artChip(f))]);
      data[f].forEach(v => {
        const n = toNum(v);
        const a = isFinite(n) && max > min ? (n - min) / (max - min) : 0;
        tr.appendChild(h('td', { style: 'background:color-mix(in srgb, var(--blood) ' + Math.round(a * 26) + '%, transparent)', text: v }));
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    tw.appendChild(t);
    if (tools) tools.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === cur ? 'true' : 'false'));
  }
  if (tools) {
    modes.forEach(m => tools.appendChild(h('button', { type: 'button', class: 'seg', 'data-m': m, onclick: () => { cur = m; store('castgrid:' + b._k, m); draw(); } }, m)));
    wrap.appendChild(tools);
  }
  wrap.appendChild(tw);
  draw();
  return wrap;
};
R.timeline = b => {
  const n = h('div', { class: 'tl' });
  let year = null;
  b.items.forEach((it, i) => {
    if (it.y !== year) { year = it.y; n.appendChild(h('div', { class: 'tl-year', text: year })); }
    const row = h('div', { class: 'tl-item' + (it.future ? ' future' : ''), 'data-k': b._k + '.' + i }, [
      h('div', { class: 's', text: it.s }),
      h('div', { class: 'px', html: it.px ? esc(it.px) + ' <small>px</small>' : '' }),
      h('div', null, [it.a ? h('div', { class: 'a', text: it.a }) : null,
        it.subj.length ? h('div', { class: 'subj' }, it.subj.map(s => h('span', { text: s[0] + (s[1] ? ' +' + s[1] : '') }))) : null])
    ]);
    n.appendChild(row);
  });
  return n;
};
R.artstock = b => { const vals = b.live ? liveStock(b.v) : b.v; return h('div', { class: 'stock' }, ARTS.map(a => {
  const v = vals[a] || 0;
  return h('div', { style: '--a:' + artVar(a) }, [h('div', { class: 'n', text: a }), h('div', { class: 'v' + (v === 0 ? ' zero' : v < 0 ? ' neg' : ''), text: v === 0 ? '0' : signed(v) })]);
})); };

/* ---------------------------------------------------------------- data table */
R.table = (b) => {
  const st = { q: '', f: {}, sort: null, dir: 1 };
  const wrap = h('div', { class: 'dt' });
  const tools = h('div', { class: 'dt-tools' });
  const count = h('span', { class: 'dt-count' });
  const num = new Set(b.num || []), long = new Set(b.long || []), art = new Set(b.art || []), auto = new Set(b.auto || []), nw = new Set(b.nw || []);
  let input = null;
  if (b.search !== false) {
    input = h('input', { type: 'search', id: 'q-' + b.id, placeholder: 'Filtrar ' + b.rows.length + ' filas…', 'aria-label': 'Filtrar tabla', autocomplete: 'off' });
    input.addEventListener('input', () => { st.q = norm(input.value); draw(); });
    tools.appendChild(input);
  }
  const selects = [];
  (b.filters || []).forEach(ci => {
    const vals = {};
    b.rows.forEach(r => { const v = r[ci]; if (v) vals[v] = (vals[v] || 0) + 1; });
    const keys = Object.keys(vals).sort((x, y) => isFinite(toNum(x)) && isFinite(toNum(y)) ? toNum(x) - toNum(y) : x.localeCompare(y, 'es'));
    if (keys.length < 2) return;
    const sel = h('select', { id: 'f-' + b.id + '-' + ci, 'aria-label': b.cols[ci] || 'Filtro' }, [h('option', { value: '' }, (b.cols[ci] || 'Filtro') + ': todos')].concat(keys.map(k => h('option', { value: k }, k + ' (' + vals[k] + ')'))));
    sel.addEventListener('change', () => { st.f[ci] = sel.value; draw(); });
    selects.push(sel);
    tools.appendChild(sel);
  });
  const clear = h('button', { type: 'button', class: 'dt-clear', hidden: true, onclick: () => { st.q = ''; st.f = {}; if (input) input.value = ''; selects.forEach(s => { s.value = ''; }); draw(); } }, 'Quitar filtros');
  tools.appendChild(clear);
  tools.appendChild(count);
  wrap.appendChild(tools);
  const tw = h('div', { class: 'tw' });
  const t = h('table');
  const ths = b.cols.map((c, ci) => {
    const th = h('th', { scope: 'col', class: num.has(ci) ? 'num' : null, 'aria-sort': 'none' });
    th.appendChild(h('button', { type: 'button', onclick: () => { if (st.sort === ci) st.dir = -st.dir; else { st.sort = ci; st.dir = 1; } draw(); } }, c || ' '));
    return th;
  });
  t.appendChild(h('thead', null, h('tr', null, ths)));
  const tb = h('tbody');
  t.appendChild(tb);
  tw.appendChild(t);
  wrap.appendChild(tw);
  const rowsN = b.rows.map((r, i) => ({ r: r, i: i, n: norm(r.join(' ')) }));
  function cmp(a, c) {
    const x = a.r[st.sort], y = c.r[st.sort];
    const nx = toNum(x), ny = toNum(y);
    if (isFinite(nx) && isFinite(ny)) return (nx - ny) * st.dir;
    if (!x && y) return 1;
    if (x && !y) return -1;
    return String(x).localeCompare(String(y), 'es') * st.dir;
  }
  function draw() {
    const terms = st.q.split(/\s+/).filter(Boolean);
    let rows = rowsN.filter(o => terms.every(tm => o.n.includes(tm)) && Object.keys(st.f).every(ci => !st.f[ci] || o.r[ci] === st.f[ci]));
    if (st.sort != null) rows = rows.slice().sort(cmp);
    ths.forEach((th, ci) => th.setAttribute('aria-sort', st.sort === ci ? (st.dir > 0 ? 'ascending' : 'descending') : 'none'));
    tb.innerHTML = '';
    let grp = null;
    const useGroup = b.group != null && st.sort == null;
    const frag = document.createDocumentFragment();
    rows.forEach(o => {
      if (useGroup && o.r[b.group] !== grp) {
        grp = o.r[b.group];
        frag.appendChild(h('tr', { class: 'grp' }, h('td', { colspan: b.cols.length, text: grp })));
      }
      const tr = h('tr', { 'data-k': b._k + '.' + o.i });
      o.r.forEach((v, ci) => {
        if (useGroup && ci === b.group) { tr.appendChild(h('td', { class: 'sub', text: '' })); return; }
        let cls = [];
        if (num.has(ci)) cls.push('num');
        if (ci === 0 && !num.has(0)) cls.push('name');
        if (nw.has(ci)) cls.push('nw');
        const td = h('td', { class: cls.join(' ') || null });
        if (art.has(ci) && artOf(v)) td.appendChild(artChip(v));
        else if (long.has(ci) && v) { td.className = 'long'; const d = h('div', { class: 'clamp', title: 'Pulsa para ver entero', html: br(v) }); d.addEventListener('click', () => d.classList.toggle('open')); td.appendChild(d); }
        else if (ci === 0 && b.info) td.appendChild(h('button', { type: 'button', class: 'info-btn', title: 'Ver la descripción', onclick: () => b.info(o.i) }, v));
        else if (ci === 0 && auto.has(o.i)) td.appendChild(h('i', { title: 'Traducción automática', text: v }));
        else if (num.has(ci) && isFinite(toNum(v))) td.textContent = String(v).replace(/^-/, '−');
        else td.innerHTML = br(v);
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    });
    tb.appendChild(frag);
    if (!rows.length) tb.appendChild(h('tr', null, h('td', { colspan: b.cols.length, class: 'dt-empty', text: 'Ninguna fila coincide con el filtro.' })));
    count.textContent = rows.length === b.rows.length ? b.rows.length + ' filas' : rows.length + ' de ' + b.rows.length;
    clear.hidden = !(st.q || Object.values(st.f).some(Boolean));
  }
  if (b.sort != null && b.group == null) { st.sort = b.sort; }
  draw();
  wrap._reset = () => { st.q = ''; st.f = {}; draw(); };
  return wrap;
};

/* ---------------------------------------------------------------- vis ledger */
R.visledger = (b) => {
  const rows = b.live ? b.rows.concat(visDbRows()) : b.rows; // web movements follow the sheet's
  const st = { q: '', y: '', tp: '', a: '' };
  const wrap = h('div', { class: 'dt vl' });
  const tools = h('div', { class: 'dt-tools' });
  const input = h('input', { type: 'search', id: 'q-' + b.id, placeholder: 'Filtrar movimientos…', 'aria-label': 'Filtrar movimientos', autocomplete: 'off' });
  input.addEventListener('input', () => { st.q = norm(input.value); draw(); });
  tools.appendChild(input);
  const years = [...new Set(rows.map(r => r.y).filter(Boolean))].sort();
  const types = [...new Set(rows.map(r => r.tp).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'es'));
  const mk = (id, label, vals, key) => {
    const s = h('select', { id: id, 'aria-label': label }, [h('option', { value: '' }, label + ': todos')].concat(vals.map(v => h('option', { value: v }, v))));
    s.addEventListener('change', () => { st[key] = s.value; draw(); });
    tools.appendChild(s);
    return s;
  };
  mk('fy-' + b.id, 'Año', years, 'y');
  if (types.length > 1) mk('ft-' + b.id, 'Movimiento', types, 'tp');
  mk('fa-' + b.id, 'Arte', ARTS.filter(a => rows.some(r => r.v[a] != null)), 'a');
  const count = h('span', { class: 'dt-count' });
  tools.appendChild(count);
  wrap.appendChild(tools);
  const tw = h('div', { class: 'tw' });
  const t = h('table');
  t.appendChild(h('thead', null, h('tr', null, ['Año', 'Estación', 'Movimiento', 'Vis', 'Neto'].map((c, i) => h('th', { scope: 'col', class: i === 4 ? 'num' : null, text: c })))));
  const tb = h('tbody');
  t.appendChild(tb);
  tw.appendChild(t);
  wrap.appendChild(tw);
  function draw() {
    tb.innerHTML = '';
    let shown = 0;
    const frag = document.createDocumentFragment();
    rows.forEach((r, i) => {
      if (st.y && r.y !== st.y) return;
      if (st.tp && r.tp !== st.tp) return;
      if (st.a && r.v[st.a] == null) return;
      if (st.q && !norm([r.y, r.s, r.tp, r.n, Object.keys(r.v).join(' ')].join(' ')).includes(st.q)) return;
      shown++;
      let net = 0;
      const vv = h('span', { class: 'vv' });
      ARTS.forEach(a => {
        const v = r.v[a];
        if (v == null) return;
        const n = typeof v === 'number' ? v : toNum(v);
        if (isFinite(n)) net += n;
        vv.appendChild(h('span', { class: 'art', style: '--a:' + artVar(a), title: a, html: '<b>' + esc(typeof v === 'number' ? signed(v) : v) + '</b> ' + ABBR[a] }));
      });
      const what = h('td', { text: r.tp + (r.n ? ' · ' + r.n : '') });
      if (r.web) {
        what.appendChild(h('span', { class: 'webtag', title: 'Añadido desde la web', text: 'web' }));
        if (canWrite()) what.appendChild(h('button', { type: 'button', class: 'lnk', style: 'margin-left:6px', onclick: () => openVisEditor(r.web) }, 'Editar'));
      }
      frag.appendChild(h('tr', { 'data-k': r.web ? 'vw.' + r.web : b._k + '.' + i, class: r.web ? 'web' : null }, [
        h('td', { class: 'num', text: r.y }), h('td', { text: r.s }), what,
        h('td', { class: 'vis' }, vv), h('td', { class: 'num net ' + (net > 0 ? 'p' : net < 0 ? 'n' : ''), text: net ? signed(net) : '0' })
      ]));
    });
    tb.appendChild(frag);
    if (!shown) tb.appendChild(h('tr', null, h('td', { colspan: 5, class: 'dt-empty', text: 'Ningún movimiento coincide con el filtro.' })));
    count.textContent = shown === rows.length ? rows.length + ' movimientos' : shown + ' de ' + rows.length;
  }
  draw();
  return wrap;
};

/* ---------------------------------------------------------------- charts */
R.chart = b => {
  const W = 760, H = 230, m = { l: 44, r: 12, t: 12, b: 34 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const xs = b.x, n = xs.length;
  const all = b.series.flatMap(s => s.v.filter(v => v != null));
  let lo = Math.min(0, ...all), hi = Math.max(...all);
  if (b.ymin != null) lo = b.ymin;
  if (hi === lo) hi = lo + 1;
  const step = niceStep((hi - lo) / 4);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const y = v => m.t + ih - (v - lo) / (hi - lo) * ih;
  const colors = ['var(--blood)', 'var(--aq)', 'var(--he)'];
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(b.cap || '') + '">';
  for (let v = lo; v <= hi + 1e-9; v += step) {
    svg += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--rule)" stroke-width="1"' + (Math.abs(v) < 1e-9 && lo < 0 ? ' stroke="var(--rule-2)"' : '') + '/>';
    svg += '<text x="' + (m.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + fmt(v) + '</text>';
  }
  const bandW = iw / n;
  // years on a line/step chart are placed to scale; everything else is categorical
  const numericX = b.kind !== 'bars' && b.kind !== 'bars2' && xs.length > 1 && xs.every(v => isFinite(toNum(v)));
  const x0v = numericX ? toNum(xs[0]) : 0, x1v = numericX ? toNum(xs[n - 1]) : 1;
  const xc = numericX ? (i => m.l + 10 + (toNum(xs[i]) - x0v) / (x1v - x0v || 1) * (iw - 20)) : (i => m.l + bandW * (i + .5));
  if (numericX) {
    const span = x1v - x0v, stepX = niceStep(span / 8);
    for (let v = Math.ceil(x0v / stepX) * stepX; v <= x1v; v += stepX) {
      const px = m.l + 10 + (v - x0v) / (span || 1) * (iw - 20);
      svg += '<text x="' + px + '" y="' + (H - m.b + 18) + '" text-anchor="middle">' + v + '</text>';
    }
  } else {
    const every = Math.max(1, Math.ceil(n / 12));
    const lastShown = Math.floor((n - 1) / every) * every;
    xs.forEach((lab, i) => {
      if (!lab) return;
      if (i % every !== 0 && !(i === n - 1 && n - 1 - lastShown >= every * .7)) return;
      if (i === lastShown && n - 1 - lastShown < every * .7 && n - 1 !== lastShown && i !== 0) { /* keep */ }
      svg += '<text x="' + xc(i) + '" y="' + (H - m.b + 18) + '" text-anchor="middle">' + esc(lab) + '</text>';
    });
  }
  if (b.kind === 'bars' || b.kind === 'bars2') {
    const k = b.series.length;
    const bw = Math.max(2, Math.min(26, bandW * .72 / k));
    b.series.forEach((s, si) => {
      s.v.forEach((v, i) => {
        if (v == null) return;
        const x0 = xc(i) - (bw * k) / 2 + si * bw;
        const y0 = y(Math.max(0, v)), y1 = y(Math.min(0, v));
        svg += '<rect x="' + x0.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + (bw - 1).toFixed(1) + '" height="' + Math.max(1, y1 - y0).toFixed(1) + '" rx="1.5" fill="' + colors[si] + '" opacity="' + (si ? .75 : .9) + '"><title>' + esc((xs[i] || '') + ' · ' + s.n + ': ' + fmt(v)) + '</title></rect>';
      });
    });
  } else {
    b.series.forEach((s, si) => {
      let d = '';
      s.v.forEach((v, i) => {
        if (v == null) return;
        if (b.kind === 'step' && d) d += ' H' + xc(i).toFixed(1);
        d += (d ? ' L' : 'M') + xc(i).toFixed(1) + ' ' + y(v).toFixed(1);
      });
      if (b.kind !== 'step') {
        const base = y(Math.max(lo, 0));
        const pts = s.v.map((v, i) => v == null ? null : [xc(i), y(v)]).filter(Boolean);
        if (pts.length) svg += '<path d="M' + pts[0][0] + ' ' + base + ' ' + pts.map(p => 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + ' L' + pts[pts.length - 1][0] + ' ' + base + ' Z" fill="' + colors[si] + '" opacity=".08"/>';
      }
      svg += '<path d="' + d + '" fill="none" stroke="' + colors[si] + '" stroke-width="2" stroke-linejoin="round"/>';
      const last = s.v.length - 1;
      s.v.forEach((v, i) => {
        if (v == null) return;
        const big = i === last;
        svg += '<circle cx="' + xc(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="' + (big ? 4.5 : 2.6) + '" fill="' + (big ? colors[si] : 'var(--card)') + '" stroke="' + colors[si] + '" stroke-width="1.5"><title>' + esc((xs[i] || '') + ' · ' + fmt(v)) + '</title></circle>';
      });
      if (last >= 0 && s.v[last] != null) svg += '<text x="' + (xc(last) - 8) + '" y="' + (y(s.v[last]) - 10) + '" text-anchor="end" style="fill:var(--ink);font-weight:500">' + fmt(s.v[last]) + '</text>';
    });
  }
  svg += '</svg>';
  const cap = h('div', { class: 'cap' }, [h('span', { text: b.cap || '' })].concat(b.series.length > 1 ? b.series.map((s, si) => h('span', { class: 'leg', style: '--c:' + colors[si], html: '<i></i>' + esc(s.n) })) : []));
  return h('div', { class: 'chart' }, [cap, h('div', { html: svg })]);
};
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/* ---------------------------------------------------------------- views */
const page = document.getElementById('page');
let pendingFocus = null;

function crumbs(docId) {
  const c = h('div', { class: 'crumbs' }, [h('a', { href: '#inicio', text: DATA.root.short })]);
  (PATH[docId] || []).forEach(f => { c.appendChild(h('span', { class: 'sep', text: '/' })); c.appendChild(f.drive ? h('a', { href: f.drive, target: '_blank', rel: 'noopener', text: f.f }) : h('span', { text: f.f })); });
  return c;
}

function viewDoc(doc, sheetId, anchor, keepY) {
  const sheet = doc.sheets.find(s => s.id === sheetId) || doc.sheets[0];
  page.innerHTML = '';
  page.appendChild(crumbs(doc.id));
  page.appendChild(h('h1', { class: 'doc-title', text: doc.title }));
  const meta = h('div', { class: 'doc-meta' }, [
    h('span', { text: doc.web ? 'Se lleva desde la web' : 'Hoja de cálculo «' + doc.file + '»' }),
    h('span', { text: doc.sheets.length === 1 ? '1 pestaña' : doc.sheets.length + ' pestañas' }),
    doc.drive ? h('a', { href: doc.drive, target: '_blank', rel: 'noopener', html: (doc.web ? 'Carpeta en Drive ' : 'Abrir en Drive ') + ICON.ext }) : null
  ]);
  page.appendChild(meta);
  if (doc.blurb) page.appendChild(h('p', { class: 'doc-blurb', text: doc.blurb }));
  if (doc.sheets.length > 1) {
    const tabs = h('div', { class: 'tabs', role: 'navigation', 'aria-label': 'Pestañas de ' + doc.title });
    doc.sheets.forEach(s => {
      const a = h('a', { class: 'tab', href: '#' + doc.id + '--' + s.id, 'aria-current': s === sheet ? 'page' : null });
      if (s.art) a.appendChild(h('span', { class: 'dot', style: '--art:' + artVar(s.art) }));
      a.appendChild(document.createTextNode(s.title));
      tabs.appendChild(a);
    });
    page.appendChild(h('div', { class: 'tabs-wrap' }, tabs));
    requestAnimationFrame(() => { const cur = tabs.querySelector('[aria-current]'); if (cur) tabs.scrollLeft = Math.max(0, cur.offsetLeft - 40); });
  } else {
    page.appendChild(h('div', { style: 'height:22px' }));
  }
  const content = h('div', { class: 'content' });
  if (doc.sheets.length > 1) content.appendChild(h('h2', { class: 'sheet-h', text: sheet.title }));
  const secs = sheet.blocks.filter(b => b.t === 'sec');
  if (secs.length > 1) {
    content.appendChild(h('nav', { class: 'toc', 'aria-label': 'Secciones' }, secs.map(s => h('a', { class: 'chip', href: '#' + doc.id + '--' + sheet.id + '--' + s.id, html: (artOf(s.a) ? '<span class="dot" style="--art:' + artVar(artOf(s.a)) + '"></span>' : '') + esc(s.a) }))));
  }
  content.appendChild(renderBlocks(sheet.blocks, { doc: doc, sheet: sheet }));
  page.appendChild(content);
  document.title = doc.title + (doc.sheets.length > 1 ? ' · ' + sheet.title : '') + ' — Europa Mítica';
  // focus handling
  requestAnimationFrame(() => {
    if (keepY != null) { window.scrollTo(0, keepY); return; } // live data re-render: stay put
    let target = null;
    if (pendingFocus) { target = page.querySelector('[data-k="' + pendingFocus + '"]'); pendingFocus = null; }
    else if (anchor) target = document.getElementById('a-' + anchor);
    if (target) {
      target.scrollIntoView({ block: anchor ? 'start' : 'center' });
      if (!anchor) { target.classList.add('flash'); setTimeout(() => target.classList.remove('flash'), 2400); }
    } else window.scrollTo(0, 0);
  });
}

function docCard(d, path) {
  const ns = d.sheets.length;
  const cover = d.cover && IMG[d.cover];
  const a = h('a', { class: 'dcard' + (cover ? ' cov' : ''), href: '#' + d.id });
  if (cover) a.appendChild(h('img', { src: cover, alt: '' }));
  const inner = h('div', { class: 'in' }, [
    path ? h('div', { class: 'dp', html: ICON.folder + esc(path) }) : null,
    h('div', { class: 'dt1', text: d.title }), h('div', { class: 'db', text: d.blurb || '' }),
    h('div', { class: 'dm', text: (ns === 1 ? '1 pestaña' : ns + ' pestañas') })]);
  a.appendChild(inner);
  return a;
}

function viewHome(q) {
  page.innerHTML = '';
  const hero = h('header', { class: 'home-hero' });
  hero.appendChild(h('div', null, [
    h('div', { class: 'k', text: 'Ars Magica · Quinta edición' }),
    h('h1', { text: 'Europa Mítica' }),
    h('p', { class: 'lead', text: DATA.lead })
  ]));
  const hs = h('div', { class: 'home-search' });
  hs.appendChild(h('label', { for: 'homeq', text: 'Buscar en todas las hojas' }));
  const sw = h('div', { class: 'search', html: ICON.search });
  const input = h('input', { type: 'search', id: 'homeq', placeholder: 'Un hechizo, una virtud, un libro, un habitante…', autocomplete: 'off' });
  sw.appendChild(input);
  hs.appendChild(sw);
  hs.appendChild(h('div', { class: 'hint', text: 'Prueba «Perdo Corpus», «Sangre Feérica», «Ordesa» o «summa».' }));
  hero.appendChild(hs);
  page.appendChild(hero);
  const results = h('div', { class: 'results', 'aria-live': 'polite' });
  page.appendChild(results);
  const folders = h('div');
  page.appendChild(folders);
  folders.appendChild(homeSaga());
  function sec(node, trail) {
    const docsHere = [];
    const subs = [];
    (node.children || []).forEach(c => { if (c.d) docsHere.push(c.d); else subs.push(c); });
    return { docsHere, subs };
  }
  DATA.tree.forEach(top => {
    const s = h('section', { class: 'folder-sec' });
    const head = h('div', { class: 'folder-h' }, [h('h2', { text: top.f })]);
    if (top.drive) head.appendChild(h('a', { href: top.drive, target: '_blank', rel: 'noopener', html: 'Carpeta en Drive ' + ICON.ext }));
    s.appendChild(head);
    if (top.glance) s.appendChild(glanceNode(top.glance));
    const grid = h('div', { class: 'docs' });
    let count = 0;
    (function walk(node, trail) {
      const { docsHere, subs } = sec(node, trail);
      docsHere.forEach(id => { count++; grid.appendChild(docCard(DOCS[id], trail.join(' / '))); });
      subs.forEach(sub => walk(sub, trail.concat([sub.f])));
    })(top, []);
    grid.dataset.n = count;
    s.appendChild(grid);
    folders.appendChild(s);
  });
  function run() {
    const v = input.value.trim();
    results.innerHTML = '';
    folders.hidden = !!v;
    if (!v) { if (location.hash.startsWith('#buscar')) history.replaceState(null, '', '#inicio'); return; }
    const res = search(v);
    if (!res.length) { results.appendChild(h('div', { class: 'more', text: 'Nada coincide con «' + v + '».' })); return; }
    const byDoc = {};
    res.forEach(r => { const g = r.dyn ? 'dyn:' + r.group : r.d; (byDoc[g] = byDoc[g] || []).push(r); });
    let shown = 0;
    // the live saga first, then the spreadsheets
    Object.keys(byDoc).filter(g => g.startsWith('dyn:')).forEach(g => {
      const list = byDoc[g];
      results.appendChild(h('div', { class: 'rh', text: g.slice(4) + ' · ' + list.length }));
      list.slice(0, 8).forEach(r => results.appendChild(h('button', { type: 'button', onclick: () => { pendingFocus = r.focus || null; location.hash = r.href; } }, [
        h('div', { class: 'rs', text: r.sub }), h('div', { class: 'rt', html: highlight(r.t, v) })])));
      if (list.length > 8) results.appendChild(h('div', { class: 'more', text: 'y ' + (list.length - 8) + ' resultados más.' }));
    });
    Object.keys(byDoc).filter(g => !g.startsWith('dyn:')).forEach(did => {
      const d = DOCS[did];
      results.appendChild(h('div', { class: 'rh', text: d.title + ' · ' + byDoc[did].length }));
      byDoc[did].slice(0, 8).forEach(r => {
        const sh = d.sheets.find(s => s.id === r.s);
        results.appendChild(h('button', { type: 'button', onclick: () => { pendingFocus = r.k; location.hash = '#' + d.id + '--' + r.s; } }, [
          h('div', { class: 'rs', text: sh.title }), h('div', { class: 'rt', html: highlight(r.t, v) })]));
        shown++;
      });
      if (byDoc[did].length > 8) results.appendChild(h('div', { class: 'more', text: 'y ' + (byDoc[did].length - 8) + ' resultados más en este documento.' }));
    });
  }
  input.addEventListener('input', run);
  if (q) { input.value = q; run(); }
  document.title = 'Europa Mítica';
  window.scrollTo(0, 0);
  return input;
}

/* ================================================================== SAGA EN CURSO
   Live data kept in the saga's database on the server (window.EM_WEB.db, see js/gate.js):
     personajes/{id}      one document per character (sheet + starting experience)
     avance/{pj}--{y}-{s} one document per character and season: activity + XP split
     vis/{id}             vis movements recorded from the web
     tesoreria/{id}       treasury movements recorded from the web
     saga/estado          the saga's current season and the covenant aura
   The Excel pages stay as the archive; these views grow season by season. */
const SEASONS = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
const CHARS = ['Inteligencia', 'Percepción', 'Fuerza', 'Vitalidad', 'Presencia', 'Comunicación', 'Destreza', 'Rapidez'];
const TIPOS = ['Magus', 'Aprendiz', 'Compañero', 'Grog', 'Otro'];
const TIPOS_PL = { Magus: 'Magi', Aprendiz: 'Aprendices', 'Compañero': 'Compañeros', Grog: 'Grogs', Otro: 'Otros' };
const CASAS = ['Bjornaer', 'Bonisagus', 'Criamon', 'Ex Miscellanea', 'Flambeau', 'Guernicus', 'Jerbiton', 'Mercere', 'Merinita', 'Tremere', 'Tytalus', 'Verditius'];
const VALORES = ['Menor', 'Mayor', 'Gratuita', 'Especial'];
const VD_CATS = ['General', 'Hermética', 'Sobrenatural', 'Estatus Social', 'Mistérica', 'Personalidad', 'Historia', 'Heroica', 'Corrupta', 'Infantil', 'Especial'];
const ACT_TIPOS = [
  ['Estudio: summa', 'la calidad de la summa; no sube por encima de su nivel.'],
  ['Estudio: tractatus', 'la calidad del tractatus.'],
  ['Estudio: vis', 'dado de estrés + aura (solo Artes).'],
  ['Enseñanza', 'Comunicación del maestro + Enseñanza + 3 + bonos; límite: la puntuación del maestro.'],
  ['Entrenamiento', 'puntuación del maestro + 3; límite: la puntuación del maestro.'],
  ['Aventura', '5 a 10, repartida entre lo que se usó.'],
  ['Práctica', '4 a 8, normalmente 4.'],
  ['Exposición', '2 px.'],
  ['Laboratorio', 'exposición: 2 px en algo relacionado.'],
  ['Otro', '']
];
const ABIL_CATS = ['Generales', 'Marciales', 'Académicas', 'Arcanas', 'Sobrenaturales', 'Idiomas vivos', 'Lenguas muertas', 'Conocimientos de área', 'Conocimientos de Organización', 'Profesiones', 'Reputaciones', 'Otras'];
const ABIL_STD = {
  'Generales': ['Atención', 'Atletismo', 'Cazar', 'Cirugía', 'Concentración', 'Don de gentes', 'Embaucar', 'Encanto', 'Enseñanza', 'Etiqueta', 'Intriga', 'Liderazgo', 'Manejo de animales', 'Montar', 'Música', 'Nadar', 'Pelea', 'Prestidigitación', 'Regatear', 'Sigilo', 'Socializar', 'Supervivencia'],
  'Marciales': ['Un arma', 'Arma grande', 'Arco', 'Arrojadiza'],
  'Académicas': ['Artes Liberales', 'Filosofía', 'Ley civil y canónica', 'Ley común', 'Medicina', 'Teología'],
  'Arcanas': ['Con. divino', 'Con. feérico', 'Con. infernal', 'Con. mágico', 'Derecho Hermético', 'Parma Mágica', 'Penetración', 'Precisión', 'Sab. Enigmática', 'Teoría Mágica'],
  'Sobrenaturales': ['Augurios', 'Segunda vista', 'Sentir lo santo y lo profano', 'Zahorí'],
  'Lenguas muertas': ['Latin', 'Griego', 'Hebreo'],
  'Conocimientos de Organización': ['Orden de Hermes', 'Iglesia']
};
const tkey = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const CAT_OF = {};
Object.keys(ABIL_STD).forEach(c => ABIL_STD[c].forEach(n => { CAT_OF[tkey(n)] = c; }));

/* js/gate.js sets window.EM_WEB (saga, role, database) before starting the page; keys in this browser carry the saga */
const KEYP = window.EM_WEB.saga.id + ':';
const S = { db: null, assets: null, uid: null, canWrite: null, owner: null, status: 'loading', pj: {}, av: {}, vis: {}, tes: {}, estado: null, seen: {}, fresh: {}, timer: null };
const SUBS = [['personajes', 'pj'], ['avance', 'av'], ['vis', 'vis'], ['tesoreria', 'tes'], ['saga/estado', 'estado']];
let modalOpen = false, pendingRerender = false;

/* ---------- small helpers */
const skey = (a, e) => Number(a) * 10 + Number(e);
const sname = (a, e) => (SEASONS[e - 1] || '?') + ' de ' + a;
const snext = (a, e) => e === 4 ? [a + 1, 1] : [a, e + 1];
const sprev = (a, e) => e === 1 ? [a - 1, 4] : [a, e - 1];
function curSeason() {
  const e = S.estado;
  if (e && Number(e.anio) && Number(e.est) >= 1 && Number(e.est) <= 4) return [Number(e.anio), Number(e.est)];
  return [DATA.saga.anio, DATA.saga.est];
}
function sagaAura() { const e = S.estado; return e && e.aura != null && isFinite(Number(e.aura)) ? Number(e.aura) : DATA.saga.aura; }
/* Realm Interaction Table (ArM5, ch. 12 «Realms»): AURA_X[aura realm][power realm] multiplies the aura level */
const AURA_TIPOS = [['magica', 'Mágica'], ['feerica', 'Feérica'], ['divina', 'Divina'], ['infernal', 'Infernal']];
const AURA_ADJ = { magica: 'mágica', feerica: 'feérica', divina: 'divina', infernal: 'infernal' };
const REALM_POW = { magica: 'Magia (hermética)', feerica: 'Feérico', divina: 'Divino', infernal: 'Infernal' };
const AURA_X = {
  magica: { magica: 1, feerica: 0.5, divina: 0, infernal: -1 },
  feerica: { magica: 0.5, feerica: 1, divina: 0, infernal: -1 },
  divina: { magica: -3, feerica: -4, divina: 1, infernal: -5 },
  infernal: { magica: -1, feerica: -2, divina: 0, infernal: 1 }
};
function realmMod(tipo, nivel, pow) { const x = (AURA_X[tipo] || AURA_X.magica)[pow || 'magica']; const v = x * numv(nivel); return v > 0 ? Math.ceil(v - 1e-9) : Math.round(v); }
/* one extra botch die per point of a foreign realm's aura; the Divine is not hampered by other auras */
function botchDice(tipo, nivel, pow) { pow = pow || 'magica'; return (tipo || 'magica') === pow || pow === 'divina' ? 0 : Math.max(0, numv(nivel)); }
const auraTxt = (tipo, nivel) => (AURA_ADJ[tipo] || 'mágica') + ' ' + numv(nivel);
/* where the troupe is now: the master's scene aura, or the covenant's (magic) */
function auraNow() {
  const e = S.estado && S.estado.escena;
  if (e && AURA_X[e.tipo] && isFinite(Number(e.nivel))) return { tipo: e.tipo, nivel: Number(e.nivel), lugar: String(e.lugar || ''), escena: true };
  return { tipo: 'magica', nivel: sagaAura(), lugar: '', escena: false };
}
function castAura() { const a = auraNow(); return realmMod(a.tipo, a.nivel, 'magica'); }
function castAuraTxt() { const a = auraNow(); return (a.escena && a.lugar ? a.lugar + ', ' : '') + 'aura ' + auraTxt(a.tipo, a.nivel) + ': ' + sgn(realmMod(a.tipo, a.nivel, 'magica')); }
/* ---------- other shapes (Cambiapieles): «Transformarse en …» swaps size, physical Characteristics, natural weapons and
   the animal's Virtues and Flaws for the animal's; the mind, Abilities and the rest of the sheet stay the character's own */
function formasOf(pj) { return Array.isArray(pj && pj.formas) ? pj.formas.filter(f => f && f.id && f.n) : []; }
function formaActiva(pj) { const id = pj && pj.formaActiva; return id ? formasOf(pj).find(f => f.id === id) || null : null; }
function pjCar(pj, f) { const car = Object.assign({}, (pj && pj.car) || {}); if (f && f.car) Object.keys(f.car).forEach(k => { car[k] = numv(f.car[k]); }); return car; }
async function setForma(id, fid) {
  const pj = S.pj[id];
  if (!pj) return false;
  const f = fid ? formasOf(pj).find(x => x.id === fid) : null;
  const who = String(pj.nombre || '').split(/\s+/)[0];
  const ok = await dbWrite(() => S.db.doc('personajes/' + id).update(stamp({ formaActiva: f ? f.id : null })), f ? who + ' se transforma en ' + f.n.toLowerCase() : who + ' vuelve a su forma humana');
  if (ok) localPut('pj', id, Object.assign({}, pj, { formaActiva: f ? f.id : null }));
  return ok;
}
/* ---------- wounds and fatigue, marked on the sheet during play (ArM5, Combat and Injury): the penalties of all wounds
   add up, the current fatigue level's penalty adds to them, and the sum applies to every roll and total except Soak and
   recovery. The wound ranges are 5 + Size points wide; a form can bring its own fatigue track. Stored on the character
   as heridas {ligera, media, grave, incapacitado, muerto} and fatiga (levels lost). */
const HER = [['ligera', 'Ligera', -1], ['media', 'Media', -3], ['grave', 'Grave', -5], ['incapacitado', 'Incapacitado', null], ['muerto', 'Muerto', null]];
const FAT_N = { '0': 'Sin aliento', '-1': 'Cansado', '-3': 'Fatigado', '-5': 'Aturdido' };
function fatTrack(pj) {
  let pens = [0, -1, -3, -5];
  const fa = formaActiva(pj);
  if (fa && fa.cansancio) {
    // «Descansado, 0/0, −1/−1, −3, −5, inconsciente»: the levels between the first and the last
    const mid = String(fa.cansancio).split(',').map(x => x.trim()).filter(Boolean).slice(1, -1);
    const p2 = [].concat(...mid.map(x => x.split('/').map(y => Number(y.replace(/[−–]/g, '-').trim()))));
    if (p2.length && p2.every(n => isFinite(n))) pens = p2;
  }
  return [{ n: 'Descansado', p: 0 }].concat(pens.map(p => ({ n: FAT_N[String(p)] || 'Cansancio ' + sgn(p), p: p }))).concat([{ n: 'Inconsciente', p: null }]);
}
function estadoFisico(pj) {
  const hw = pj && pj.heridas && typeof pj.heridas === 'object' ? pj.heridas : {};
  const n = k => Math.max(0, Math.round(numv(hw[k])));
  const her = HER.reduce((t, x) => t + (x[2] ? x[2] * n(x[0]) : 0), 0);
  const tr = fatTrack(pj);
  const fl = Math.min(tr.length - 1, Math.max(0, Math.round(numv(pj && pj.fatiga))));
  const fat = tr[fl].p || 0;
  const fuera = n('muerto') ? 'Muerto' : n('incapacitado') ? 'Incapacitado: no puede actuar' : tr[fl].p === null ? 'Inconsciente' : '';
  return { her: her, fat: fat, total: her + fat, fl: fl, tr: tr, n: n, fuera: fuera };
}
const malusOf = pj => estadoFisico(pj).total;
function estadoTxt(pj) {
  const e = estadoFisico(pj);
  const w = HER.filter(x => e.n(x[0])).map(x => e.n(x[0]) + ' ' + x[1].toLowerCase());
  const parts = [];
  if (w.length) parts.push('heridas: ' + w.join(', ') + (e.her ? ' (' + sgn(e.her) + ')' : ''));
  if (e.fl) parts.push('fatiga: ' + e.tr[e.fl].n.toLowerCase() + (e.fat ? ' (' + sgn(e.fat) + ')' : ''));
  if (!parts.length) return '';
  return (e.fuera ? e.fuera + '. ' : e.total ? 'Malus ' + sgn(e.total) + ' — ' : '') + parts.join('; ');
}
// marks are saved half a second after the last change, as one write per character
const HURT = {};
function saveHurt(id, patch) {
  const pj = S.pj[id];
  if (!pj || !canWrite()) return;
  localPut('pj', id, Object.assign({}, pj, patch));
  const q = HURT[id] = HURT[id] || { patch: {}, t: null };
  Object.assign(q.patch, patch);
  clearTimeout(q.t);
  q.t = setTimeout(() => { const send = q.patch; q.patch = {}; dbWrite(() => S.db.doc('personajes/' + id).update(stamp(send)), null); }, 500);
}
function formaButtons(id, pj) {
  if (!canWrite()) return [];
  const act = formaActiva(pj);
  return formasOf(pj).filter(f => !act || act.id === f.id).map(f => h('button', { type: 'button', class: 'btn ghost forma-btn', 'data-forma': f.id,
    onclick: async e => { const b = e.currentTarget; b.disabled = true; if (!(await setForma(id, act ? null : f.id))) b.disabled = false; } }, act ? 'Volver a forma humana' : 'Transformarse en ' + f.n.toLowerCase()));
}
function vdCards(list, clase) {
  const L = (Array.isArray(list) ? list : []).filter(x => x && String(x.n || '').trim());
  return h('ul', { class: 'm-vd' }, L.map(x => h('li', null, [
    h('div', { class: 'm-vd-h' }, [clase ? h('button', { type: 'button', class: 'info-btn', onclick: () => vdInfo(x, typeof clase === 'function' ? clase(x) : clase) }, h('b', { text: vdLabel(x) })) : h('b', { text: vdLabel(x) }), h('span', { class: 'xt', text: [x.cat, x.valor].filter(Boolean).join(' · ') })]),
    x.nota ? h('div', { class: 'm-vd-n', text: x.nota }) : null])));
}
function formaBlock(pj, c, f) {
  const car = pjCar(pj, f), ab = f.hab || 'Pelea';
  const hb = c.hab.find(x => tkey(x.n) === tkey(ab));
  const lv = (hb ? abLvl(hb.xp) : 0) + manaHab(c, ab);
  const Q = numv(car['Rapidez']), D = numv(car['Destreza']), F = numv(car['Fuerza']), V = numv(car['Vitalidad']);
  const abs = (Array.isArray(f.absorcion) ? f.absorcion : []).filter(x => Array.isArray(x));
  const soak = V + abs.reduce((s, x) => s + numv(x[1]), 0);
  const tam = numv(f.tam), r = 5 + tam;
  const sec = h('section', { class: 'sh-sec forma', 'aria-labelledby': 'sh-forma' }, [shHead('sh-forma', 'Forma de ' + f.n.toLowerCase())]);
  sec.appendChild(ledger('forma-st', [
    { l: 'Tamaño', n: 'humano ' + sgn(numv(pj.tam)) + '; las heridas se cuentan con este tamaño', v: sgn(tam) },
    { l: 'Absorción', n: ['Vitalidad ' + sgn(V)].concat(abs.map(x => x[0] + ' ' + sgn(numv(x[1])))).join(', '), v: sgn(soak) },
    { l: ab, n: 'su habilidad de combate', v: String(lv) }]));
  const m = malusOf(pj);
  sec.appendChild(R.grid({ _k: 'forma-' + f.id, head: ['Arma natural', 'Inic.', 'Atq.', 'Def.', 'Daño'], fcl: true,
    body: (f.armas || []).map(a => [a.n, sgn(Q + numv(a.ini) + m), sgn(D + lv + numv(a.atq) + m), sgn(Q + lv + numv(a.def) + m), a.dano == null ? '—' : sgn(F + numv(a.dano))]) }));
  const notas = (f.armas || []).filter(a => a.nota).map(a => a.n + ': ' + String(a.nota).toLowerCase() + '.');
  sec.appendChild(h('p', { class: 'sh-aside', text: notas.concat(['Iniciativa: Rapidez + arma. Ataque: Destreza + ' + ab + ' + arma. Defensa: Rapidez + ' + ab + ' + arma. Daño: Fuerza + arma.' + (m ? ' Iniciativa, ataque y defensa llevan ya el malus por heridas y fatiga (' + sgn(m) + ').' : '') + ' Sin dado ni otras virtudes. La ropa y el equipo no se transforman.']).join(' ') }));
  if ((f.cualidades || []).length) sec.appendChild(h('p', { class: 'forma-line' }, [h('i', { text: 'Cualidades: ' }), f.cualidades.join(', ') + '.']));
  const vd = (f.virtudes || []).concat(f.defectos || []).filter(x => x && String(x.n || '').trim());
  if (vd.length) {
    sec.appendChild(h('h4', { class: 'sh-rub', text: 'Virtudes y defectos del ' + f.n.toLowerCase() }));
    sec.appendChild(ledger('sh-vd', vd.map(x => ({ l: vdLabel(x), n: x.nota || '', s: [(f.defectos || []).includes(x) ? 'defecto' : 'virtud', String(x.valor || '').toLowerCase()].filter(Boolean).join(' ') }))));
  }
  if (f.fuente) sec.appendChild(h('p', { class: 'sh-aside', text: 'Fuente: ' + f.fuente }));
  return sec;
}
/* a formulaic spell's casting total: Technique + Form (with Puissant Arts) + Stamina + aura modifier + mastery */
function spellTotal(pj, c, s, aura, cer) {
  const t = artOf(s.tec), f = artOf(s.forma);
  if (!t || !f) return null;
  const ac = isRitual(s) || (cer && canCeremony(c)) ? academic(c).sum : 0;
  return artLvl(c.arts[t]) + manaArt(c, t) + artLvl(c.arts[f]) + manaArt(c, f) + numv(pj.car && pj.car['Vitalidad']) + aura + Math.max(0, Math.round(numv(s.maestria))) + ac + malusOf(pj);
}
/* Ceremonial casting and Ritual spells (ArM5, Hermetic Magic): + Artes Liberales + Filosofía, fifteen minutes per magnitude.
   Ceremony needs some experience in at least one of the two; a Ritual always adds them. */
function isRitual(s) { return !!s && (s.ritual === true || /\britual\b/i.test(String(s.nota || ''))); }
function academic(c) {
  const one = n => { const x = (c.hab || []).find(a => tkey(a.n) === tkey(n)); return { lv: x ? abLvl(x.xp) + manaHab(c, n) : 0, xp: x ? x.xp : 0 }; };
  const al = one('Artes Liberales'), fi = one('Filosofía');
  return { al: al.lv, fi: fi.lv, sum: al.lv + fi.lv, xp: al.xp + fi.xp };
}
const canCeremony = c => academic(c).xp > 0;
const magnitude = s => Math.max(1, Math.ceil(toNum(s.nivel) / 5) || 1);
function ceremonyTime(s) { const m = 15 * magnitude(s); return m < 60 ? m + ' min' : (m % 60 ? (m / 60).toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + ' h' : m / 60 + ' h'); }
function ceremonialOn() { return load(KEYP + 'ceremonial') === '1'; }
/* checkbox shared by the character's Hechizos tab and the master screen */
function refocusCer() { route(true); const b = page.querySelector('.cer-in'); if (b) b.focus({ preventScroll: true }); }
function ceremonyToggle(c, onChange) {
  const a = academic(c), ok = a.xp > 0;
  const box = h('input', { type: 'checkbox', class: 'cer-in', checked: ok && ceremonialOn() ? true : null, disabled: ok ? null : true });
  box.addEventListener('change', () => { store(KEYP + 'ceremonial', box.checked ? '1' : null); onChange(); });
  return h('label', { class: 'chk cer' }, [box, h('span', { text: 'Lanzamiento ceremonial' }),
    h('small', { class: 'fh', text: ok ? sgn(a.sum) + ' (Artes Liberales ' + a.al + ', Filosofía ' + a.fi + ') · 15 min por magnitud' : 'Sin Artes Liberales ni Filosofía: no puede lanzar ceremonialmente' })]);
}
function numv(v) { const n = typeof v === 'number' ? v : toNum(v); return isFinite(n) ? n : 0; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function canWrite() { return !!S.db && S.canWrite !== false; }
function slugify(s) { return tkey(s).slice(0, 40); }
function newId(prefix) { return (slugify(prefix) || 'pj') + '-' + Math.random().toString(36).slice(2, 7); }
function currentRaw() { return decodeURIComponent(location.hash.replace(/^#/, '')); }

/* ---------- experience (ArM5): an Art at level L costs L(L+1)/2 px; an Ability or Warping 5·L(L+1)/2 */
const artCost = l => l * (l + 1) / 2;
const abCost = l => 5 * l * (l + 1) / 2;
function artLvl(xp) { let l = 0; while (artCost(l + 1) <= xp + 1e-9) l++; return l; }
function abLvl(xp) { let l = 0; while (abCost(l + 1) <= xp + 1e-9) l++; return l; }
function entriesOf(id) {
  return Object.keys(S.av).map(k => Object.assign({ _id: k }, S.av[k])).filter(e => e.pj === id)
    .sort((x, y) => skey(x.anio, x.est) - skey(y.anio, y.est));
}
function guessCat(name) { return CAT_OF[tkey(name)] || 'Otras'; }
/* starting xp + every season's allocation → totals per Art, Ability and Warping */
/* Affinity (ArM5): creation xp in that Ability or Art rises by half, rounded up; season entries store it already applied */
const afXp = (b, on) => on ? Math.ceil(b * 1.5) : b;
function calc(pj, entries, skip) {
  const fx = vdEffects(pj);
  const arts = {};
  ARTS.forEach(a => { arts[a] = afXp(numv(pj.artes && pj.artes[a]), fx.af.art.has(a)); });
  const hab = new Map();
  (pj.hab || []).forEach(x => {
    if (!x || !x.n) return;
    const k = tkey(x.n), on = fx.af.hab.has(k), b = afXp(numv(x.base), on);
    hab.set(k, { n: String(x.n).trim(), esp: x.esp || '', cat: x.cat || guessCat(x.n), base: b, paid: numv(x.base), xp: b, af: on });
  });
  let inf = numv(pj.informidad), total = 0;
  entries.forEach(e => {
    if (skip && e._id === skip) return;
    (e.reparto || []).forEach(r => {
      const px = numv(r.px);
      if (!r.r || !px) return;
      total += px;
      const art = artOf(r.r);
      if (art) { arts[art] += px; return; }
      const k = tkey(r.r);
      if (k === 'informidad') { inf += px; return; }
      if (!hab.has(k)) hab.set(k, { n: String(r.r).trim(), esp: '', cat: guessCat(r.r), base: 0, paid: 0, xp: 0, implicit: true, af: fx.af.hab.has(k) });
      hab.get(k).xp += px;
    });
  });
  return { arts, hab: [...hab.values()], inf, total, fx };
}
/* Puissant (Maña): +2 to an Ability, +3 to an Art, whenever it is used */
const manaHab = (c, n) => (c.fx && c.fx.mana.hab[tkey(n)]) || 0;
const manaArt = (c, a) => (c.fx && c.fx.mana.art[a]) || 0;
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
function traitLevel(c, name) {
  const art = artOf(name);
  if (art) return { lv: artLvl(c.arts[art]), xp: c.arts[art], art: true };
  const k = tkey(name);
  if (k === 'informidad') return { lv: abLvl(c.inf), xp: c.inf };
  const hb = c.hab.find(x => tkey(x.n) === k);
  return hb ? { lv: abLvl(hb.xp), xp: hb.xp } : { lv: 0, xp: 0, nuevo: true };
}

/* ---------- loading: subscribe once per collection, time-limit the wait */
function sagaInit() {
  const W = window.EM_WEB;
  if (!W.db) { S.status = 'off'; sagaChanged(); return; }
  S.db = W.db; S.assets = W.assets; S.uid = W.uid;
  S.canWrite = true; // the server decides what each role may write
  S.owner = W.rol === 'master';
  S.timer = setTimeout(() => { if (S.status === 'loading') { S.status = 'slow'; sagaChanged(); } }, 10000);
  SUBS.forEach(sub => subscribe(sub, 0));
}
function subscribe(sub, attempt) {
  if (!S.db) return;
  const [path, key] = sub;
  const onErr = e => {
    const code = e && e.code;
    if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') {
      clearTimeout(S.timer);
      S.db = null; S.status = 'revoked';
      sagaChanged(); return;
    }
    if ((code === 'unavailable' || !code) && attempt < 3) { setTimeout(() => subscribe(sub, attempt + 1), 2500 * (attempt + 1)); return; }
    clearTimeout(S.timer); S.status = 'error'; sagaChanged();
  };
  if (path.split('/').length % 2 === 0) {
    S.db.doc(path).onSnapshot(s => { S[key] = s.exists ? s.data() : null; gotSnap(key, s.metadata); }, onErr);
  } else {
    S.db.collection(path).onSnapshot(snap => {
      const o = {};
      snap.docs.forEach(d => { o[d.id] = d.data(); });
      S[key] = o;
      gotSnap(key, snap.metadata);
    }, onErr);
  }
}
function gotSnap(key, meta) {
  S.seen[key] = true;
  if (!meta || !meta.fromCache) S.fresh[key] = true;
  if ((S.status === 'loading' || S.status === 'slow') && SUBS.every(([, k]) => S.fresh[k])) { S.status = 'ready'; clearTimeout(S.timer); }
  sagaChanged();
}
function allSeen() { return SUBS.every(([, k]) => S.seen[k]); }

let chTimer = null;
function sagaChanged() { INDEX = null; clearTimeout(chTimer); chTimer = setTimeout(applySagaChange, 60); }
function hasLive(blocks) {
  return (blocks || []).some(b => b.live || b.t === 'dynvis' || b.t === 'dyntes' || b.t === 'pjlink' || (b.t === 'cols' && b.items.some(c => hasLive(c))));
}
function applySagaChange() {
  renderSagaSide();
  if (modalOpen) { pendingRerender = true; return; }
  const raw = currentRaw();
  const parts = raw.split('--');
  const doc = DOCS[parts[0]];
  if (doc) {
    const sh = doc.sheets.find(s => s.id === parts[1]) || doc.sheets[0];
    if (hasLive(sh.blocks)) route(true);
    return;
  }
  if (raw === 'pj-nuevo' || /--editar$/.test(raw)) { if (!page.querySelector('form.pj-form')) route(true); return; } // never clobber a form being filled in
  if (raw === 'master') { const a = document.activeElement; if (!(a && page.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName))) route(true); return; }
  if (/^(estaciones|personajes|pj--)/.test(raw)) { route(true); return; }
  const box = document.getElementById('home-saga');
  if (box) box.replaceWith(homeSaga());
  document.querySelectorAll('.glance').forEach(el => { if (el._g) el.replaceWith(glanceNode(el._g)); });
}

/* ---------- writes */
async function dbWrite(fn, okMsg) {
  if (!S.db) { toast('La saga en curso no está disponible en esta vista.'); return false; }
  const fail = e => {
    const code = e && e.code;
    if (code === 'invalid_argument' || code === 'transform_error') {
      if (S.canWrite !== true) { S.canWrite = false; sagaChanged(); toast('No tienes permiso para guardar cambios. Pide al máster que te dé acceso.'); }
      else toast('No se ha podido guardar: los datos no son válidos.');
    } else if (code === 'quota_exceeded') toast('La base de datos de la página está llena. Borra entradas antiguas para seguir guardando.');
    else if (code === 'resource_exhausted') toast('Demasiados cambios seguidos. Espera un momento y vuelve a intentarlo.');
    else if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') { S.db = null; S.status = 'revoked'; sagaChanged(); toast('La saga en curso ya no está disponible en esta vista.'); }
    else toast('No se ha podido guardar. Inténtalo de nuevo.');
    return false;
  };
  try { await fn(); if (okMsg) toast(okMsg); return true; } catch (e) {
    if (e && e.code === 'unavailable') {
      await new Promise(r => setTimeout(r, 500 + Math.random() * 700));
      try { await fn(); if (okMsg) toast(okMsg); return true; } catch (e2) { return fail(e2); }
    }
    return fail(e);
  }
}
function stamp(o, isNew) { o.actualizado = Date.now(); if (S.uid) o.por = S.uid; if (isNew) o.creado = o.actualizado; return o; }
/* show a confirmed write at once; the next snapshot replaces the collection anyway */
function localPut(key, id, doc) { S[key] = Object.assign({}, S[key], { [id]: doc }); sagaChanged(); }
function localDel(key, ids) { const o = Object.assign({}, S[key]); [].concat(ids).forEach(id => { delete o[id]; }); S[key] = o; sagaChanged(); }

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('on'), 4200);
}

/* ---------- form bits */
function openModal(title, body, actions) {
  modalOpen = true;
  const opener = document.activeElement;
  const box = h('div', { class: 'modal' });
  const card = h('div', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  card.appendChild(h('div', { class: 'modal-h' }, [h('h2', { text: title }), h('button', { type: 'button', class: 'x', 'aria-label': 'Cerrar', onclick: () => close() }, '×')]));
  card.appendChild(h('div', { class: 'modal-b fx' }, body));
  card.appendChild(h('div', { class: 'modal-f' }, actions));
  box.appendChild(card);
  const onkey = e => { if (e.key === 'Escape') close(); };
  function close() {
    if (!box.isConnected) return;
    box.remove(); document.removeEventListener('keydown', onkey); document.body.classList.remove('modal-on'); modalOpen = false;
    if (opener && opener.isConnected) opener.focus();
    if (pendingRerender) { pendingRerender = false; sagaChanged(); }
  }
  box.addEventListener('mousedown', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', onkey);
  document.body.appendChild(box);
  document.body.classList.add('modal-on');
  const first = card.querySelector('.modal-b input, .modal-b select, .modal-b textarea');
  if (first) setTimeout(() => first.focus(), 30);
  return close;
}
function confirmButton(label, confirmLabel, fn) {
  let armed = false, tm = null;
  const b = h('button', { type: 'button', class: 'btn danger' }, label);
  b.addEventListener('click', () => {
    if (!armed) { armed = true; b.textContent = confirmLabel; b.classList.add('armed'); tm = setTimeout(() => { armed = false; b.textContent = label; b.classList.remove('armed'); }, 4000); return; }
    clearTimeout(tm); armed = false; b.classList.remove('armed'); b.textContent = label; fn();
  });
  return b;
}
function field(label, ctl, hint, cls) {
  return h('label', { class: 'fld' + (cls ? ' ' + cls : '') }, [h('span', { class: 'fl', text: label }), ctl, hint ? h('span', { class: 'fh', text: hint }) : null]);
}
function cell(label, ctl) { return h('label', { class: 'cell', 'data-l': label }, ctl); }
function inp(value, on, attrs) {
  const i = h('input', Object.assign({ type: 'text', value: value == null ? '' : value }, attrs || {}));
  i.addEventListener('input', () => on(i.value, i));
  return i;
}
function sel(options, value, on, attrs) {
  const opts = options.map(o => Array.isArray(o) ? o : [o, o]);
  if (value != null && value !== '' && !opts.some(o => String(o[0]) === String(value))) opts.push([value, value]);
  const s = h('select', attrs || {}, opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) ? true : null }, l)));
  s.addEventListener('change', () => on(s.value, s));
  return s;
}
function datalist(id, values) {
  let dl = document.getElementById(id);
  if (dl) dl.remove();
  const seen = new Set(), list = [];
  values.forEach(v => { const k = tkey(v); if (v && !seen.has(k)) { seen.add(k); list.push(v); } });
  dl = h('datalist', { id: id }, list.map(v => h('option', { value: v })));
  document.body.appendChild(dl);
  return id;
}
function seasonPicker(d) {
  return h('div', { class: 'fld-row' }, [
    field('Estación', sel(SEASONS.map((s, i) => [i + 1, s]), d.est, v => { d.est = Number(v); })),
    field('Año', inp(d.anio, v => { const n = parseInt(v, 10); if (n) d.anio = n; }, { type: 'number', min: '1000', max: '1500', inputmode: 'numeric' }))]);
}
function portraitSrc(pj) {
  if (!pj) return null;
  if (pj._retUrl) return pj._retUrl;
  if (pj.retrato && pj.retrato.id) return window.EM_WEB.blobUrl(pj.retrato.id) || null;
  if (pj.retratoStatic && DATA.portraits && IMG[DATA.portraits[pj.retratoStatic]]) return IMG[DATA.portraits[pj.retratoStatic]];
  return null;
}
function monogram(pj, cls) {
  const ini = String((pj && pj.nombre) || '?').split(/\s+/).filter(w => w && /^\p{L}/u.test(w) && !/^(ex|de|del|la|el)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const fallback = () => h('span', { class: cls + ' ini', 'aria-hidden': 'true', text: ini });
  const src = portraitSrc(pj);
  if (!src) return fallback();
  const img = h('img', { class: cls, src: src, alt: '' });
  img.addEventListener('error', () => { if (img.isConnected) img.replaceWith(fallback()); });
  return img;
}
function shrinkImage(file, max) {
  return new Promise(resolve => {
    let url;
    try { url = URL.createObjectURL(file); } catch (e) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k)), hh = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = hh;
        const g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, hh);
        g.drawImage(img, 0, 0, w, hh);
        URL.revokeObjectURL(url);
        c.toBlob(b => resolve(b), 'image/jpeg', 0.86);
      } catch (e) { URL.revokeObjectURL(url); resolve(null); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
function pjLink(id) { const pj = S.pj[id]; return h('a', { href: '#pj--' + id, text: pj ? pj.nombre : id }); }
function sumRep(rep) { return (rep || []).reduce((s, r) => s + numv(r.px), 0); }
function repChips(rep) {
  return h('span', { class: 'reps' }, (rep || []).filter(r => r.r && numv(r.px)).map(r => {
    const a = artOf(r.r);
    return h('span', { class: 'rep' + (a ? ' art' : ''), style: a ? '--a:' + artVar(a) : null, text: r.r + ' ' + signed(numv(r.px)) });
  }));
}
function statusNote() {
  if (S.status === 'off') return h('p', { class: 'note saga-note', text: 'No se puede conectar con el servidor de la saga. Comprueba la conexión y recarga la página.' });
  if (S.status === 'revoked') return h('p', { class: 'note saga-note', text: 'La saga en curso no está disponible en esta vista.' });
  if (S.status === 'error') return h('p', { class: 'note saga-note', text: 'Se ha perdido la conexión con el servidor de la saga; lo que ves puede estar desactualizado. Se reintenta solo.' });
  if (S.status === 'slow') return h('p', { class: 'note saga-note', text: allSeen() ? 'Los datos todavía no han llegado del todo; puede que lo que ves esté desactualizado.' : 'Los datos de la saga todavía no llegan.' });
  if (S.status === 'loading' && !allSeen()) return h('p', { class: 'note saga-note', text: 'Cargando los datos de la saga…' });
  if (S.db && S.canWrite === false) return h('p', { class: 'note saga-note', text: 'Puedes consultar la saga, pero no tienes permiso para guardar cambios.' });
  return null;
}
function sagaCrumbs(items) {
  const c = h('div', { class: 'crumbs' }, [h('a', { href: '#inicio', text: DATA.root.short }), h('span', { class: 'sep', text: '/' }), h('a', { href: '#estaciones', text: 'Saga en curso' })]);
  items.forEach(([t, href]) => { c.appendChild(h('span', { class: 'sep', text: '/' })); c.appendChild(href ? h('a', { href: href, text: t }) : h('span', { text: t })); });
  return c;
}
function pjsSorted(includeInactive) {
  return Object.keys(S.pj).map(id => Object.assign({ _id: id }, S.pj[id])).filter(p => includeInactive || p.activo !== false)
    .sort((a, b) => (TIPOS.indexOf(a.tipo) + 9) % 9 - (TIPOS.indexOf(b.tipo) + 9) % 9 || String(a.nombre).localeCompare(String(b.nombre), 'es'));
}
function focusPending() {
  requestAnimationFrame(() => {
    if (!pendingFocus) return;
    const t = page.querySelector('[data-k="' + pendingFocus + '"]');
    pendingFocus = null;
    if (t) { t.scrollIntoView({ block: 'center' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 2400); }
  });
}

/* ---------- side panel, home and live figures on the Excel pages */
function renderSagaSide() {
  const box = document.getElementById('sagaside');
  if (!box) return;
  box.innerHTML = '';
  const raw = currentRaw();
  const [a, e] = curSeason();
  box.appendChild(h('div', { class: 't-folder', html: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.2 9.6 6h5l-4 3 1.5 4.8L8 10.9l-4.1 2.9L5.4 9l-4-3h5z"/></svg><span>Saga en curso</span>' }));
  const u = h('ul');
  u.appendChild(h('li', null, h('a', { class: 't-doc', href: '#estaciones', 'aria-current': /^estaciones/.test(raw) ? 'page' : null, html: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg><span>Estaciones <small>' + esc(sname(a, e)) + '</small></span>' })));
  const li = h('li', null, h('a', { class: 't-doc', href: '#personajes', 'aria-current': raw === 'personajes' || raw === 'pj-nuevo' ? 'page' : null, html: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="5.5" r="2.8"/><path d="M2.8 14c.6-3 2.7-4.6 5.2-4.6s4.6 1.6 5.2 4.6"/></svg><span>Personajes</span>' }));
  const pjs = pjsSorted(false);
  if (pjs.length) {
    const sub = h('ul');
    pjs.forEach(p => sub.appendChild(h('li', null, h('a', { class: 't-doc t-pj', href: '#pj--' + p._id, 'aria-current': raw === 'pj--' + p._id || raw.startsWith('pj--' + p._id + '--') ? 'page' : null, text: p.nombre }))));
    li.appendChild(sub);
  }
  u.appendChild(li);
  if (S.owner === true) u.appendChild(h('li', null, h('a', { class: 't-doc', href: '#master', 'aria-current': raw === 'master' ? 'page' : null, html: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 13.5h11M4 13.5V7l4-3.5L12 7v6.5"/><path d="M6.5 13.5v-3h3v3"/></svg><span>Pantalla del máster <small>' + esc(auraTxt(auraNow().tipo, auraNow().nivel)) + '</small></span>' })));
  box.appendChild(h('div', { class: 'tree' }, u));
}
function homeSaga() {
  const s = h('section', { class: 'folder-sec home-saga', id: 'home-saga' });
  const [a, e] = curSeason();
  s.appendChild(h('div', { class: 'folder-h' }, [h('h2', { text: 'Saga en curso' }), h('span', { class: 'path', text: 'Personajes y estaciones · crece cada estación' })]));
  const note = statusNote();
  if (S.status === 'off' || S.status === 'revoked') { s.appendChild(note); return s; }
  const pjs = pjsSorted(false);
  const done = pjs.filter(p => S.av[p._id + '--' + a + '-' + e]).length;
  const grid = h('div', { class: 'docs saga-cards' });
  grid.appendChild(h('a', { class: 'dcard season-card', href: '#estaciones' }, h('div', { class: 'in' }, [
    h('div', { class: 'dp', text: 'Estación actual' }),
    h('div', { class: 'dt1', text: sname(a, e) }),
    h('div', { class: 'db', text: pjs.length ? done + ' de ' + pjs.length + (pjs.length === 1 ? ' personaje' : ' personajes') + ' con el reparto de PX hecho.' : 'Crea los personajes y reparte la experiencia de cada estación.' }),
    h('div', { class: 'dm', text: 'Repartir la experiencia →' })])));
  pjs.slice(0, 7).forEach(p => {
    const ent = entriesOf(p._id);
    const last = ent[ent.length - 1];
    grid.appendChild(h('a', { class: 'dcard pj-card', href: '#pj--' + p._id }, [monogram(p, 'mono big'), h('div', { class: 'in' }, [
      h('div', { class: 'dp', text: [p.tipo, p.casa].filter(Boolean).join(' · ') }),
      h('div', { class: 'dt1', text: p.nombre }),
      h('div', { class: 'dm', text: last ? 'Última estación: ' + sname(last.anio, last.est) : 'Sin estaciones registradas' })])]));
  });
  if (pjs.length > 7) grid.appendChild(h('a', { class: 'dcard', href: '#personajes' }, h('div', { class: 'in' }, [h('div', { class: 'dt1', text: 'Ver los ' + pjs.length }), h('div', { class: 'dm', text: 'Personajes →' })])));
  if (canWrite()) grid.appendChild(h('a', { class: 'dcard add-card', href: '#pj-nuevo' }, h('div', { class: 'in' }, [h('div', { class: 'plus', 'aria-hidden': 'true', text: '+' }), h('div', { class: 'dt1', text: 'Nuevo personaje' }), h('div', { class: 'db', text: 'Magus, aprendiz, compañero o grog.' })])));
  s.appendChild(grid);
  if (note) s.appendChild(note);
  return s;
}
function webVis() {
  const rows = Object.values(S.vis), sums = {};
  rows.forEach(v => ARTS.forEach(a => { const n = numv(v.v && v.v[a]); if (n) sums[a] = (sums[a] || 0) + n; }));
  return { n: rows.length, sums: sums, net: Object.values(sums).reduce((s, x) => s + x, 0) };
}
function webTes() { const rows = Object.values(S.tes); return { n: rows.length, sum: rows.reduce((s, r) => s + numv(r.libras), 0) }; }
function liveStats(b) {
  if (b.live === 'vis') {
    const w = webVis();
    if (!w.n) return b.items;
    const tech = ARTS_T.reduce((s, a) => s + (w.sums[a] || 0), 0);
    const add = [w.net, tech, w.net - tech];
    return b.items.map((it, i) => Object.assign({}, it, { v: fmt(numv(it.v) + (add[i] || 0)), s: i === 0 ? (it.s ? it.s + ' · ' : '') + 'con ' + w.n + ' de la web' : it.s }));
  }
  if (b.live === 'tes') {
    const w = webTes();
    if (!w.n) return b.items;
    return b.items.map((it, i) => Object.assign({}, it, i === 0 ? { v: fmt(numv(it.v) + w.sum), s: (it.s ? it.s + ' · ' : '') + 'con ' + w.n + ' de la web' } : { v: String(numv(it.v) + w.n) }));
  }
  return b.items;
}
function liveStock(v) { const add = webVis().sums, o = {}; ARTS.forEach(a => { o[a] = (v[a] || 0) + (add[a] || 0); }); return o; }
function liveGlance(g) {
  if (g.live === 'vis') { const w = webVis(); return w.n ? fmt(numv(g.v) + w.net) : g.v; }
  if (g.live === 'tes') { const w = webTes(); return w.n ? fmt(numv(g.v) + w.sum) : g.v; }
  return g.v;
}
function glanceNode(list) {
  const el = h('div', { class: 'glance' }, list.map(g => h('a', { href: '#' + g.href }, [h('div', { class: 'l', text: g.l }), h('div', { class: 'v', text: String(liveGlance(g)).replace(/^-/, '−') })])));
  el._g = list;
  return el;
}
function visDbRows() {
  return Object.keys(S.vis).map(id => { const v = S.vis[id]; return { y: String(v.anio || ''), s: SEASONS[(Number(v.est) || 1) - 1], tp: v.tipo || 'Movimiento', n: v.nota || '', v: v.v || {}, web: id, _o: skey(v.anio || 0, v.est || 1) }; })
    .sort((a, b) => a._o - b._o);
}
R.dynvis = b => {
  const w = webVis();
  const box = h('div', { class: 'dynbox' });
  if (w.n) box.appendChild(h('p', { class: 'note', text: (b.x ? b.x.replace(/\.\s*$/, '') + ', más ' : 'Incluye ') + w.n + (w.n === 1 ? ' movimiento añadido' : ' movimientos añadidos') + ' desde la web (neto ' + (signed(w.net) || '0') + ' peones).' }));
  else if (b.x) box.appendChild(h('p', { class: 'note', text: b.x }));
  if (canWrite()) { const [ca, ce] = curSeason(); box.appendChild(h('button', { type: 'button', class: 'btn ghost', onclick: () => openVisEditor(null, ca, ce) }, 'Añadir movimiento de vis')); }
  return box.children.length ? box : null;
};
R.dyntes = () => {
  if (!S.db) return null;
  const rows = Object.keys(S.tes).map(id => Object.assign({ _id: id }, S.tes[id])).sort((x, y) => skey(x.anio, x.est) - skey(y.anio, y.est));
  if (!rows.length && !canWrite()) return null;
  const box = h('div', { class: 'dynbox' }, [h('h4', { text: 'Movimientos añadidos desde la web' })]);
  if (rows.length) box.appendChild(tesMiniTable(rows, true));
  else box.appendChild(h('p', { class: 'note', text: 'Todavía no hay ninguno: los nuevos ingresos y gastos se apuntan aquí o en cada estación.' }));
  if (canWrite()) { const [ca, ce] = curSeason(); box.appendChild(h('button', { type: 'button', class: 'btn ghost', onclick: () => openTesEditor(null, ca, ce) }, 'Añadir movimiento de tesorería')); }
  return box;
};
R.pjlink = b => {
  const pj = S.pj[b.pj];
  if (!pj) return null;
  return h('div', { class: 'dynbox pjlink' }, [h('p', { html: 'Esta es la hoja de Excel tal como estaba. La ficha viva de <b>' + esc(pj.nombre) + '</b>, que se actualiza con cada reparto de PX, está en la Saga en curso.' }), h('a', { class: 'btn ghost', href: '#pj--' + b.pj, text: 'Abrir la ficha viva' })]);
};

/* ---------- ESTACIONES */
function viewSeasons(slug) {
  let [a, e] = curSeason();
  const m = /^(\d{3,4})-([1-4])$/.exec(slug || '');
  if (m) { a = Number(m[1]); e = Number(m[2]); }
  const [ca, ce] = curSeason();
  const isCur = a === ca && e === ce;
  const k = '--' + a + '-' + e;
  const pjs = pjsSorted(true).filter(p => p.activo !== false || S.av[p._id + k]);
  const pending = pjs.filter(p => !S.av[p._id + k]).length;
  page.innerHTML = '';
  page.appendChild(sagaCrumbs([['Estaciones', '#estaciones'], [sname(a, e), null]]));
  const [pa, pe] = sprev(a, e), [na, ne] = snext(a, e);
  page.appendChild(h('div', { class: 'season-nav' }, [
    h('a', { class: 'chip', href: '#estaciones--' + pa + '-' + pe, text: '‹ ' + sname(pa, pe) }),
    h('a', { class: 'chip', href: '#estaciones--' + na + '-' + ne, text: sname(na, ne) + ' ›' })]));
  page.appendChild(h('h1', { class: 'doc-title', text: sname(a, e) }));
  const meta = h('div', { class: 'doc-meta' }, [isCur ? h('span', { class: 'badge-cur', text: 'Estación actual' }) : h('span', { text: 'Estación actual: ' + sname(ca, ce) })]);
  if (!isCur) meta.appendChild(h('a', { href: '#estaciones', text: 'Ir a la actual' }));
  meta.appendChild(h('span', { text: 'Aura de la alianza ' + sagaAura() }));
  if (canWrite()) meta.appendChild(h('button', { type: 'button', class: 'lnk', onclick: editAura }, 'Cambiar aura'));
  page.appendChild(meta);
  if (canWrite()) {
    const actions = h('div', { class: 'actions' });
    if (isCur) {
      actions.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => advanceSeason(a, e) }, 'Pasar a ' + sname(na, ne)));
      if (pending && pjs.length) actions.appendChild(h('span', { class: 'fh', text: pending === 1 ? 'Queda 1 personaje sin reparto en esta estación.' : 'Quedan ' + pending + ' personajes sin reparto en esta estación.' }));
    } else actions.appendChild(h('button', { type: 'button', class: 'btn ghost', onclick: () => setCurrent(a, e) }, 'Marcar como estación actual'));
    page.appendChild(actions);
  }
  const content = h('div', { class: 'content', style: 'margin-top:22px' });
  const note = statusNote();
  if (note) content.appendChild(note);
  const visRows = Object.keys(S.vis).map(id => Object.assign({ _id: id }, S.vis[id])).filter(v => Number(v.anio) === a && Number(v.est) === e);
  const tesRows = Object.keys(S.tes).map(id => Object.assign({ _id: id }, S.tes[id])).filter(v => Number(v.anio) === a && Number(v.est) === e);
  const pxTotal = pjs.reduce((s, p) => s + sumRep((S.av[p._id + k] || {}).reparto), 0);
  content.appendChild(R.stats({ items: [
    { l: 'Reparto hecho', v: (pjs.length - pending) + ' / ' + pjs.length, s: 'personajes' },
    { l: 'PX repartidos', v: fmt(pxTotal) },
    { l: 'Vis', v: String(visRows.length), s: visRows.length === 1 ? 'movimiento' : 'movimientos' },
    { l: 'Tesorería', v: String(tesRows.length), s: tesRows.length === 1 ? 'movimiento' : 'movimientos' }] }));
  content.appendChild(h('h3', { text: 'Experiencia de la estación' }));
  if (!pjs.length) {
    if (S.status === 'ready' || allSeen()) content.appendChild(h('div', { class: 'empty' }, [h('p', { text: 'Todavía no hay personajes. Crea el primero y aquí aparecerá para repartirle la experiencia de cada estación.' }),
      canWrite() ? h('a', { class: 'btn', href: '#pj-nuevo', text: 'Nuevo personaje' }) : null]));
  } else {
    const list = h('div', { class: 'xp-list' });
    pjs.forEach(p => {
      const ent = S.av[p._id + k];
      const row = h('div', { class: 'xp-row' + (ent ? '' : ' pending'), 'data-k': 'xp.' + p._id });
      row.appendChild(monogram(p, 'mono'));
      const info = h('div', { class: 'xi' }, [h('div', { class: 'xn' }, [pjLink(p._id), h('span', { class: 'xt', text: [p.tipo, p.casa].filter(Boolean).join(' · ') })])]);
      if (ent) {
        info.appendChild(h('div', { class: 'xa', text: [ent.tipo, ent.actividad].filter(Boolean).join(' · ') || 'Sin descripción' }));
        info.appendChild(repChips(ent.reparto));
        if (ent.nota) info.appendChild(h('div', { class: 'note', text: ent.nota }));
      } else info.appendChild(h('div', { class: 'xa muted', text: 'Sin reparto de experiencia.' }));
      row.appendChild(info);
      const side = h('div', { class: 'xs' }, [ent && sumRep(ent.reparto) ? h('div', { class: 'xpx', html: '<b>' + esc(fmt(sumRep(ent.reparto))) + '</b> px' }) : null]);
      if (canWrite()) side.appendChild(h('button', { type: 'button', class: 'btn' + (ent ? ' ghost' : ''), onclick: () => openXpEditor(p._id, a, e) }, ent ? 'Editar' : 'Repartir PX'));
      row.appendChild(side);
      list.appendChild(row);
    });
    content.appendChild(list);
  }
  content.appendChild(h('h3', { text: 'Alianza' }));
  const cols = h('div', { class: 'cols', style: '--n:2' });
  const cv = h('div', { class: 'col' }, [h('h4', { text: 'Movimientos de vis' })]);
  cv.appendChild(visRows.length ? visMiniTable(visRows) : h('p', { class: 'note', text: 'Ninguno en esta estación.' }));
  if (canWrite()) cv.appendChild(h('button', { type: 'button', class: 'btn ghost', onclick: () => openVisEditor(null, a, e) }, 'Añadir movimiento de vis'));
  const ct = h('div', { class: 'col' }, [h('h4', { text: 'Tesorería' })]);
  ct.appendChild(tesRows.length ? tesMiniTable(tesRows) : h('p', { class: 'note', text: 'Ninguno en esta estación.' }));
  if (canWrite()) ct.appendChild(h('button', { type: 'button', class: 'btn ghost', onclick: () => openTesEditor(null, a, e) }, 'Añadir movimiento de tesorería'));
  cols.appendChild(cv); cols.appendChild(ct);
  content.appendChild(cols);
  const seasons = new Map();
  const addS = (y, s, kind, px) => { const kk = skey(y, s); if (!isFinite(kk) || !Number(y)) return; const o = seasons.get(kk) || { a: Number(y), e: Number(s), pj: 0, px: 0, vis: 0, tes: 0 }; o[kind]++; o.px += px || 0; seasons.set(kk, o); };
  Object.values(S.av).forEach(x => addS(x.anio, x.est, 'pj', sumRep(x.reparto)));
  Object.values(S.vis).forEach(x => addS(x.anio, x.est, 'vis'));
  Object.values(S.tes).forEach(x => addS(x.anio, x.est, 'tes'));
  if (seasons.size) {
    content.appendChild(h('h3', { text: 'Estaciones registradas' }));
    const byYear = {};
    seasons.forEach(o => { (byYear[o.a] = byYear[o.a] || []).push(o); });
    const yearRow = y => h('div', { class: 'sh-row' }, [h('span', { class: 'sh-y', text: y }), h('span', { class: 'sh-s' }, SEASONS.map((sn, i) => {
      const o = byYear[y].find(z => z.e === i + 1);
      const here = Number(y) === a && i + 1 === e;
      if (!o) return h('a', { class: 'chip off' + (here ? ' on' : ''), href: '#estaciones--' + y + '-' + (i + 1), text: sn });
      const mov = o.vis + o.tes;
      const parts = [o.px ? fmt(o.px) + ' px' : '', mov ? mov + ' mov.' : ''].filter(Boolean).join(' · ');
      return h('a', { class: 'chip' + (here ? ' on' : ''), href: '#estaciones--' + o.a + '-' + o.e,
        title: [o.pj && (o.pj === 1 ? '1 reparto de PX' : o.pj + ' repartos de PX'), o.vis && o.vis + ' de vis', o.tes && o.tes + ' de tesorería'].filter(Boolean).join(', '),
        html: esc(sn) + (parts ? ' <small>' + esc(parts) + '</small>' : '') });
    }))]);
    const years = Object.keys(byYear).sort((x, y) => y - x);
    const hist = h('div', { class: 'season-hist' }, years.slice(0, 6).map(yearRow));
    if (years.length > 6) {
      const older = years.slice(6);
      const det = h('details', { class: 'det sh-more', open: older.includes(String(a)) ? true : null }, [h('summary', { text: 'Años anteriores · ' + older[older.length - 1] + '–' + older[0] }),
        h('div', { class: 'season-hist' }, older.map(yearRow))]);
      hist.appendChild(det);
    }
    content.appendChild(hist);
  }
  page.appendChild(content);
  document.title = sname(a, e) + ' — Europa Mítica';
}
async function writeEstado(patch, msg) {
  const doc = Object.assign({ aura: sagaAura() }, S.estado || {}, patch);
  if (!doc.anio || !doc.est) { const [ca, ce] = curSeason(); doc.anio = doc.anio || ca; doc.est = doc.est || ce; }
  const ok = await dbWrite(() => S.db.doc('saga/estado').set(stamp(doc)), msg);
  if (ok) { S.estado = doc; sagaChanged(); }
  return ok;
}
async function setCurrent(a, e) { if (await writeEstado({ anio: a, est: e }, 'Estación actual: ' + sname(a, e))) location.hash = '#estaciones'; }
async function advanceSeason(a, e) { const [na, ne] = snext(a, e); if (await writeEstado({ anio: na, est: ne }, 'La saga pasa a ' + sname(na, ne))) location.hash = '#estaciones'; }
function editAura() {
  const d = { aura: sagaAura() };
  const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const close = openModal('Aura de la alianza', [field('Nivel del aura', inp(d.aura, v => { d.aura = v; }, { type: 'number', step: '1', inputmode: 'numeric' }), 'Se usa por defecto en los totales de lanzamiento y laboratorio de las fichas.')],
    [save, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')]);
  save.addEventListener('click', async () => {
    const n = toNum(d.aura);
    if (!isFinite(n)) { toast('Indica el nivel del aura.'); return; }
    save.disabled = true;
    const ok = await writeEstado({ aura: n }, 'Aura: ' + n);
    save.disabled = false;
    if (ok) close();
  });
}
function visNet(v) { return ARTS.reduce((s, a) => s + numv(v.v && v.v[a]), 0); }
function visChips(v) {
  const span = h('span', { class: 'vv' });
  ARTS.forEach(a => { const n = numv(v.v && v.v[a]); if (n) span.appendChild(h('span', { class: 'art', style: '--a:' + artVar(a), title: a, html: '<b>' + esc(signed(n)) + '</b> ' + ABBR[a] })); });
  return span;
}
function visMiniTable(rows) {
  const t = h('table', { class: 'mini' });
  const tb = h('tbody');
  rows.forEach(v => tb.appendChild(h('tr', { 'data-k': 'vw.' + v._id }, [h('td', null, [h('div', { text: v.tipo || 'Movimiento' }), v.nota ? h('div', { class: 'note', text: v.nota }) : null, visChips(v)]),
    h('td', { class: 'num', text: signed(visNet(v)) || '0' }), canWrite() ? h('td', { class: 'act' }, h('button', { type: 'button', class: 'lnk', onclick: () => openVisEditor(v._id) }, 'Editar')) : null])));
  t.appendChild(tb);
  return h('div', { class: 'tw' }, t);
}
function tesMiniTable(rows, withSeason) {
  const t = h('table', { class: 'mini' });
  const tb = h('tbody');
  rows.forEach(v => tb.appendChild(h('tr', { 'data-k': 'tw.' + v._id }, [withSeason ? h('td', { class: 'nw', text: sname(v.anio, v.est) }) : null, h('td', { text: v.concepto || 'Movimiento' }),
    h('td', { class: 'num ' + (numv(v.libras) < 0 ? 'neg' : 'pos'), text: signed(numv(v.libras)) + ' £' }),
    canWrite() ? h('td', { class: 'act' }, h('button', { type: 'button', class: 'lnk', onclick: () => openTesEditor(v._id) }, 'Editar')) : null])));
  t.appendChild(tb);
  return h('div', { class: 'tw' }, t);
}

/* ---------- XP editor */
function openXpEditor(pjId, anio, est) {
  const pj = S.pj[pjId];
  if (!pj) return;
  const origId = pjId + '--' + anio + '-' + est;
  const existing = S.av[origId];
  const d = existing ? clone(existing) : { pj: pjId, anio: anio, est: est, tipo: '', actividad: '', reparto: [], nota: '' };
  // what the player types: the advancement total; with Affinity the page stores it ×1.5 (and keeps the typed figure as raw).
  // Entries written before this (e.g. from the Excel) already hold the final px and are left as they are.
  (d.reparto || []).forEach(r => { r._in = r.raw != null ? r.raw : r.px; r._raw = r.raw != null; });
  if (!d.reparto || !d.reparto.length) d.reparto = [{ r: '', px: '', _in: '', _raw: true }];
  const base = calc(pj, entriesOf(pjId), origId);
  const affOn = name => { const a = artOf(name); return a ? base.fx.af.art.has(a) : base.fx.af.hab.has(tkey(name)); };
  const effPx = r => { const v = numv(r._in); return r._raw && affOn(r.r) ? Math.ceil(v * 1.5) : v; };
  const dl = datalist('dl-rasgos', ARTS.concat(base.hab.map(x => x.n), ['Informidad'], ...Object.values(ABIL_STD)));
  const hint = h('p', { class: 'fh' });
  const setHint = () => { const t = ACT_TIPOS.find(x => x[0] === d.tipo); hint.textContent = t && t[1] ? 'PX de referencia: ' + t[1] : ''; hint.hidden = !hint.textContent; };
  const rows = h('div', { class: 'rep-rows' });
  const total = h('div', { class: 'rep-total' });
  const updTotal = () => { total.textContent = 'Total: ' + fmt(d.reparto.reduce((s, r) => s + (String(r.r || '').trim() ? effPx(r) : 0), 0)) + ' px'; };
  function drawRows(focusLast) {
    rows.innerHTML = '';
    rows.appendChild(h('div', { class: 'rep-head', 'aria-hidden': 'true' }, [h('span', { text: 'Arte o habilidad' }), h('span', { text: 'PX' }), h('span', { text: 'Nivel' }), h('span')]));
    d.reparto.forEach((r, i) => {
      const prev = h('span', { class: 'rep-prev' });
      const upd = () => {
        updTotal();
        if (!String(r.r || '').trim()) { prev.textContent = ''; prev.className = 'rep-prev'; return; }
        const before = traitLevel(base, r.r);
        const px = effPx(r);
        const after = before.art ? artLvl(before.xp + px) : abLvl(before.xp + px);
        prev.textContent = (before.nuevo ? 'nueva · ' : '') + before.lv + (after !== before.lv ? ' → ' + after : '') + ' · ' + fmt(before.xp + px) + ' px' +
          (r._raw && affOn(r.r) && numv(r._in) ? ' · Afinidad: ' + fmt(numv(r._in)) + ' × 1,5 = ' + fmt(px) : '');
        prev.className = 'rep-prev' + (after > before.lv ? ' up' : '') + (before.nuevo ? ' new' : '');
      };
      const ri = inp(r.r, v => { r.r = v; upd(); }, { list: dl, placeholder: 'Vim, Latin, Teoría Mágica…', 'aria-label': 'Arte o habilidad', autocomplete: 'off' });
      const pi = inp(r._in, v => { r._in = v === '' ? '' : Number(v); upd(); }, { type: 'number', step: '1', inputmode: 'numeric', placeholder: 'PX', 'aria-label': 'PX' });
      rows.appendChild(h('div', { class: 'rep-row' }, [ri, pi, prev, h('button', { type: 'button', class: 'x', 'aria-label': 'Quitar fila', onclick: () => { d.reparto.splice(i, 1); if (!d.reparto.length) d.reparto.push({ r: '', px: '', _in: '', _raw: true }); drawRows(); } }, '×')]));
      upd();
      if (focusLast && i === d.reparto.length - 1) setTimeout(() => ri.focus(), 0);
    });
  }
  drawRows();
  const body = [
    seasonPicker(d),
    field('Tipo de actividad', sel([['', '—']].concat(ACT_TIPOS.map(x => x[0])), d.tipo, v => { d.tipo = v; setHint(); })),
    hint,
    field('Actividad', inp(d.actividad, v => { d.actividad = v; }, { placeholder: 'Estudiar la summa de Vim de la biblioteca…' })),
    h('div', { class: 'fld' }, [h('span', { class: 'fl', text: 'Reparto de experiencia' }), rows,
      h('div', { class: 'rep-foot' }, [h('button', { type: 'button', class: 'lnk', onclick: () => { d.reparto.push({ r: '', px: '', _in: '', _raw: true }); drawRows(true); } }, '+ Añadir arte o habilidad'), total])]),
    field('Nota', h('textarea', { rows: 2, oninput: ev => { d.nota = ev.target.value; } }, d.nota || ''))];
  setHint();
  const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const actions = [save, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')];
  if (existing) actions.push(confirmButton('Borrar', 'Pulsa otra vez para borrar', async () => { if (await dbWrite(() => S.db.doc('avance/' + origId).delete(), 'Reparto borrado')) { localDel('av', origId); close(); } }));
  const close = openModal('Reparto de PX · ' + pj.nombre, body, actions);
  save.addEventListener('click', async () => {
    const out = { pj: pjId, anio: Number(d.anio), est: Number(d.est), tipo: d.tipo || '', actividad: String(d.actividad || '').trim(), nota: String(d.nota || '').trim(), reparto: [] };
    for (const r of d.reparto) {
      const name = String(r.r || '').trim();
      if (!name) continue;
      if (r._in === '' || r._in == null || !isFinite(Number(r._in))) { toast('Faltan los PX de «' + name + '».'); return; }
      const px = effPx(Object.assign({}, r, { r: name }));
      if (!px) continue;
      const art = artOf(name);
      const known = art ? null : base.hab.find(x => tkey(x.n) === tkey(name));
      const row = { r: art || (known ? known.n : tkey(name) === 'informidad' ? 'Informidad' : name), px: px };
      if (r._raw && affOn(name)) row.raw = Number(r._in);
      out.reparto.push(row);
    }
    if (existing && existing.origen) out.origen = existing.origen;
    if (existing && existing.creado) out.creado = existing.creado;
    if (!out.reparto.length && !out.actividad) { toast('Añade al menos un arte o habilidad con sus PX, o describe la actividad.'); return; }
    if (!out.anio) { toast('Indica el año.'); return; }
    const id = pjId + '--' + out.anio + '-' + out.est;
    if (id !== origId && S.av[id]) { toast(pj.nombre + ' ya tiene un reparto en ' + sname(out.anio, out.est) + '.'); return; }
    save.disabled = true;
    const ok = await dbWrite(async () => {
      await S.db.doc('avance/' + id).set(stamp(out, !existing));
      if (existing && id !== origId) await S.db.doc('avance/' + origId).delete();
    }, 'Reparto guardado: ' + sname(out.anio, out.est));
    save.disabled = false;
    if (ok) { if (existing && id !== origId) localDel('av', origId); localPut('av', id, out); close(); }
  });
}

/* ---------- vis / treasury editors */
function openVisEditor(id, anio, est) {
  const ex = id ? S.vis[id] : null;
  const d = ex ? clone(ex) : { anio: anio, est: est, tipo: '', nota: '', v: {} };
  d.v = d.v || {};
  const types = [];
  const rv = DOCS['reserva-vis'];
  if (rv) rv.sheets.forEach(s => s.blocks.forEach(b => { if (b.t === 'visledger') b.rows.forEach(r => { if (r.tp) types.push(r.tp); }); }));
  Object.values(S.vis).forEach(v => { if (v.tipo) types.push(v.tipo); });
  const dl = datalist('dl-vis', types);
  const net = h('div', { class: 'rep-total' });
  const upd = () => { net.textContent = 'Neto: ' + (signed(visNet(d)) || '0') + ' peones'; };
  const grid = h('div', { class: 'art-inputs' });
  ARTS.forEach(a => grid.appendChild(h('label', { class: 'ai', style: '--a:' + artVar(a) }, [h('span', { text: a }), inp(d.v[a] || '', v => { if (v === '' || !isFinite(Number(v))) delete d.v[a]; else d.v[a] = Number(v); upd(); }, { type: 'number', step: '1', inputmode: 'numeric', 'aria-label': 'Peones de ' + a })])));
  upd();
  const body = [seasonPicker(d), field('Tipo de movimiento', inp(d.tipo, v => { d.tipo = v; }, { list: dl, placeholder: 'Recolección, Aegis, reparto…' })),
    field('Nota', inp(d.nota, v => { d.nota = v; }, { placeholder: 'Opcional' })),
    h('div', { class: 'fld' }, [h('span', { class: 'fl', text: 'Peones por Arte (en negativo si salen)' }), grid, net])];
  const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const actions = [save, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')];
  if (ex) actions.push(confirmButton('Borrar', 'Pulsa otra vez para borrar', async () => { if (await dbWrite(() => S.db.doc('vis/' + id).delete(), 'Movimiento borrado')) { localDel('vis', id); close(); } }));
  const close = openModal(ex ? 'Movimiento de vis' : 'Nuevo movimiento de vis', body, actions);
  save.addEventListener('click', async () => {
    const v = {};
    ARTS.forEach(a => { const n = numv(d.v[a]); if (n) v[a] = n; });
    if (!Object.keys(v).length) { toast('Indica los peones de al menos un Arte.'); return; }
    const out = stamp({ anio: Number(d.anio), est: Number(d.est), tipo: String(d.tipo || '').trim() || 'Movimiento', nota: String(d.nota || '').trim(), v: v }, !ex);
    if (ex && ex.creado) out.creado = ex.creado;
    const ref = ex ? S.db.doc('vis/' + id) : S.db.collection('vis').doc();
    save.disabled = true;
    const ok = await dbWrite(() => ref.set(out), 'Movimiento de vis guardado');
    save.disabled = false;
    if (ok) { localPut('vis', ref.id, out); close(); }
  });
}
function openTesEditor(id, anio, est) {
  const ex = id ? S.tes[id] : null;
  const d = ex ? clone(ex) : { anio: anio, est: est, concepto: '', libras: '' };
  const body = [seasonPicker(d), field('Movimiento', inp(d.concepto, v => { d.concepto = v; }, { placeholder: 'Balance de la estación, compra de libros…' })),
    field('Libras de plata', inp(d.libras, v => { d.libras = v; }, { type: 'number', step: '0.01', inputmode: 'decimal' }), 'En negativo si es un gasto.')];
  const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const actions = [save, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')];
  if (ex) actions.push(confirmButton('Borrar', 'Pulsa otra vez para borrar', async () => { if (await dbWrite(() => S.db.doc('tesoreria/' + id).delete(), 'Movimiento borrado')) { localDel('tes', id); close(); } }));
  const close = openModal(ex ? 'Movimiento de tesorería' : 'Nuevo movimiento de tesorería', body, actions);
  save.addEventListener('click', async () => {
    const lb = toNum(d.libras);
    if (!isFinite(lb) || !lb) { toast('Indica las libras del movimiento.'); return; }
    const out = stamp({ anio: Number(d.anio), est: Number(d.est), concepto: String(d.concepto || '').trim() || 'Movimiento', libras: lb }, !ex);
    if (ex && ex.creado) out.creado = ex.creado;
    const ref = ex ? S.db.doc('tesoreria/' + id) : S.db.collection('tesoreria').doc();
    save.disabled = true;
    const ok = await dbWrite(() => ref.set(out), 'Movimiento de tesorería guardado');
    save.disabled = false;
    if (ok) { localPut('tes', ref.id, out); close(); }
  });
}

/* ---------- PERSONAJES */
function viewCharacters() {
  page.innerHTML = '';
  page.appendChild(sagaCrumbs([['Personajes', null]]));
  page.appendChild(h('h1', { class: 'doc-title', text: 'Personajes' }));
  page.appendChild(h('p', { class: 'doc-blurb', text: 'Las fichas vivas de la saga. Cada estación se reparte la experiencia y los niveles se recalculan solos.' }));
  if (canWrite()) page.appendChild(h('div', { class: 'actions' }, h('a', { class: 'btn', href: '#pj-nuevo', text: 'Nuevo personaje' })));
  const content = h('div', { class: 'content', style: 'margin-top:22px' });
  const note = statusNote();
  if (note) content.appendChild(note);
  const all = pjsSorted(true);
  if (!all.length && (S.status === 'ready' || allSeen())) content.appendChild(h('div', { class: 'empty' }, [h('p', { text: 'Todavía no hay personajes en la saga.' }), canWrite() ? h('a', { class: 'btn', href: '#pj-nuevo', text: 'Crear el primero' }) : null]));
  const [ca] = curSeason();
  TIPOS.forEach(t => {
    const list = all.filter(p => (TIPOS.includes(p.tipo) ? p.tipo : 'Otro') === t);
    if (!list.length) return;
    content.appendChild(h('h3', { text: TIPOS_PL[t] }));
    const grid = h('div', { class: 'docs saga-cards' });
    list.forEach(p => {
      const ent = entriesOf(p._id);
      grid.appendChild(h('a', { class: 'dcard pj-card' + (p.activo === false ? ' inactive' : ''), href: '#pj--' + p._id }, [monogram(p, 'mono big'), h('div', { class: 'in' }, [
        h('div', { class: 'dp', text: [p.casa, p.jugador ? 'juega ' + p.jugador : ''].filter(Boolean).join(' · ') }),
        h('div', { class: 'dt1', text: p.nombre }),
        p.sub || p.nacimiento ? h('div', { class: 'db', text: [p.sub, p.nacimiento ? (ca - Number(p.nacimiento)) + ' años' : ''].filter(Boolean).join(' · ') }) : null,
        h('div', { class: 'dm', text: (ent.length === 1 ? '1 estación' : ent.length + ' estaciones') + (p.activo === false ? ' · fuera de juego' : '') })])]));
    });
    content.appendChild(grid);
  });
  page.appendChild(content);
  document.title = 'Personajes — Europa Mítica';
}

function viewPj(id, tab) {
  const pj = S.pj[id];
  page.innerHTML = '';
  if (!pj) {
    page.appendChild(sagaCrumbs([['Personajes', '#personajes']]));
    page.appendChild(h('h1', { class: 'doc-title', text: S.status === 'ready' || allSeen() ? 'Personaje no encontrado' : 'Cargando…' }));
    const n = statusNote(); if (n) page.appendChild(n);
    return;
  }
  const entries = entriesOf(id);
  const c = calc(pj, entries);
  const [ca, ce] = curSeason();
  page.appendChild(sagaCrumbs([['Personajes', '#personajes'], [pj.nombre, null]]));
  const head = h('header', { class: 'pj-head' });
  head.appendChild(monogram(pj, 'pj-portrait'));
  const hi = h('div', { class: 'pj-hi' });
  hi.appendChild(h('h1', { class: 'doc-title', text: pj.nombre }));
  if (pj.sub) hi.appendChild(h('div', { class: 'pj-sub', text: pj.sub }));
  const role = pj.casa ? (/^(Magus|Maga|Aprendiz)$/.test(pj.tipo || '') ? pj.tipo + ' de la casa ' + pj.casa : [pj.tipo, pj.casa].filter(Boolean).join(', ')) : pj.tipo;
  const meta = h('div', { class: 'doc-meta pj-meta' }, [role, pj.nacimiento ? (ca - Number(pj.nacimiento)) + ' años (n. ' + pj.nacimiento + ')' : '', pj.aparenta ? String(pj.aparenta) : '',
    pj.jugador ? 'Juega ' + pj.jugador : '', pj.activo === false ? 'Fuera de juego' : ''].filter(Boolean).map(t => h('span', { text: t })));
  if (pj.excel && DOCS[pj.excel]) meta.appendChild(h('a', { href: '#' + pj.excel, text: 'Hoja de Excel original' }));
  const fa = formaActiva(pj);
  if (fa) meta.appendChild(h('span', { class: 'badge-cur forma-on', text: 'En forma de ' + fa.n.toLowerCase() }));
  hi.appendChild(meta);
  if (pj.concepto) hi.appendChild(h('p', { class: 'doc-blurb', text: pj.concepto }));
  if (canWrite()) {
    const has = S.av[id + '--' + ca + '-' + ce];
    hi.appendChild(h('div', { class: 'actions' }, [h('button', { type: 'button', class: 'btn', onclick: () => openXpEditor(id, ca, ce) }, (has ? 'Editar PX de ' : 'Repartir PX de ') + sname(ca, ce)),
      h('a', { class: 'btn ghost', href: '#pj--' + id + '--editar', text: 'Editar ficha' })].concat(formaButtons(id, pj))));
  }
  head.appendChild(hi);
  page.appendChild(head);
  const TABS = [['ficha', 'Ficha'], ['avance', 'Avance'], ['hechizos', 'Hechizos'], ['virtudes', 'Virtudes y defectos'], ['notas', 'Notas']]
    .filter(t => t[0] !== 'hechizos' || (pj.hechizos || []).length || /^(Magus|Maga|Aprendiz)$/.test(pj.tipo || '') || tab === 'hechizos');
  const cur = TABS.some(t => t[0] === tab) ? tab : 'ficha';
  const tabs = h('div', { class: 'tabs', role: 'navigation', 'aria-label': 'Pestañas de ' + pj.nombre }, TABS.map(([k, t]) => h('a', { class: 'tab', href: '#pj--' + id + '--' + k, 'aria-current': k === cur ? 'page' : null, text: t + (k === 'avance' && entries.length ? ' · ' + entries.length : k === 'hechizos' && (pj.hechizos || []).length ? ' · ' + pj.hechizos.length : '') })));
  page.appendChild(h('div', { class: 'tabs-wrap' }, tabs));
  const content = h('div', { class: 'content' });
  const note = statusNote(); if (note) content.appendChild(note);
  if (cur === 'ficha') pjFicha(content, pj, c, id);
  else if (cur === 'avance') pjAvance(content, id, entries, c);
  else if (cur === 'hechizos') {
    const aura = castAura(), cer = ceremonialOn() && canCeremony(c);
    const ms = s => Math.max(0, Math.round(numv(s.maestria)));
    const anyM = (pj.hechizos || []).some(s => ms(s) > 0);
    const rows = (pj.hechizos || []).map(s => {
      const m = ms(s);
      const tot = spellTotal(pj, c, s, aura, cer);
      const slow = isRitual(s) || cer ? 'Lanzamiento: ' + ceremonyTime(s) : '';
      const r = [s.n || '', s.tec || '', s.forma || '', s.nivel != null ? String(s.nivel) : '', tot == null ? '' : String(tot), s.alc || '', s.dur || '', s.obj || '', [s.nota || '', slow].filter(Boolean).join(' · ')];
      if (anyM) r.splice(4, 0, m ? String(m) : '');
      return r;
    });
    if (rows.length) {
      content.appendChild(ceremonyToggle(c, refocusCer));
      const cols = ['Hechizo', 'Técnica', 'Forma', 'Nivel', 'Lanzamiento', 'Alcance', 'Duración', 'Objetivo', 'Notas'];
      if (anyM) cols.splice(4, 0, 'Maestría');
      content.appendChild(R.table({ id: 'pjh-' + id, _k: 'pjh', cols: cols, rows: rows, filters: [1, 2], num: anyM ? [3, 4, 5] : [3, 4], art: [1, 2], sort: 3, search: rows.length > 8, info: i => spellInfo(id, i) }));
      content.appendChild(h('p', { class: 'fh info-hint', text: 'Pulsa el nombre de un hechizo para ver su descripción.' }));
      const an = auraNow(), bd = botchDice(an.tipo, an.nivel, 'magica');
      content.appendChild(h('p', { class: 'note', text: 'Lanzamiento: Técnica + Forma (con sus Mañas) + Vitalidad + aura (' + castAuraTxt() + ')' + (anyM ? ' + maestría' : '') + (malusOf(pj) ? ' + malus por heridas y fatiga (' + sgn(malusOf(pj)) + ')' : '') + (cer ? ' + Artes Liberales + Filosofía (ceremonial)' : rows.some((r, i) => isRitual(pj.hechizos[i])) ? '; los rituales suman además Artes Liberales + Filosofía' : '') + ', sin dado. Un hechizo formulaico se lanza sin fatiga si el total más el dado iguala su nivel.' + (bd ? ' En esta aura se tiran ' + bd + ' dados de pifia más.' : '') }));
      content.appendChild(h('p', { class: 'note', text: 'Ceremonial y rituales: 15 minutos por magnitud. En ArM5 el lanzamiento ceremonial es para hechizos espontáneos; con un formulaico hace falta la maestría Lanzamiento ceremonial (Houses of Hermes: Societates p. 60). La casilla se recuerda en este navegador.' }));
    } else content.appendChild(h('p', { class: 'note', text: 'Sin hechizos todavía.' }));
    if (canWrite()) content.appendChild(h('a', { class: 'btn ghost', href: '#pj--' + id + '--editar', style: 'align-self:flex-start', text: 'Añadir o cambiar hechizos' }));
  } else if (cur === 'virtudes') {
    const pts = l => l.reduce((s, x) => s + (x.valor === 'Mayor' ? 3 : x.valor === 'Menor' ? 1 : 0), 0);
    const V = pj.virtudes || [], D = pj.defectos || [];
    content.appendChild(R.stats({ items: [{ l: 'Virtudes', v: String(V.length), s: pts(V) + ' puntos' }, { l: 'Defectos', v: String(D.length), s: pts(D) + ' puntos' }] }));
    [['Virtudes', V], ['Defectos', D]].forEach(([t, l]) => {
      content.appendChild(h('h3', { text: t }));
      if (l.length) content.appendChild(R.grid({ _k: 'vd-' + t, head: ['Nombre', 'Tipo', 'Valor', 'Nota'], body: l.map(x => [vdLabel(x), x.cat || '', x.valor || '', x.nota || '']), fcl: true, info: i => vdInfo(l[i], t === 'Virtudes' ? 'virtud' : 'defecto') }));
      else content.appendChild(h('p', { class: 'note', text: 'Ninguno.' }));
    });
    const fa = formaActiva(pj);
    if (fa && (fa.virtudes || []).concat(fa.defectos || []).length) {
      content.appendChild(h('h3', { text: 'Del ' + fa.n.toLowerCase() + ', mientras está transformado' }));
      content.appendChild(vdCards((fa.virtudes || []).concat(fa.defectos || []), x => (fa.defectos || []).includes(x) ? 'defecto' : 'virtud'));
    }
  } else {
    if (pj.notas) String(pj.notas).split(/\n+/).forEach(p => content.appendChild(h('p', { text: p })));
    else content.appendChild(h('p', { class: 'note', text: 'Sin notas.' }));
  }
  page.appendChild(content);
  document.title = pj.nombre + ' — Europa Mítica';
  requestAnimationFrame(() => { const t = tabs.querySelector('[aria-current]'); if (t) tabs.scrollLeft = Math.max(0, t.offsetLeft - 40); });
}

/* ---------- the sheet (Ficha tab), laid out as a folio: a margin column with who the character is —Characteristics,
   confidence, warping, personality, Virtues and Flaws— and a text block with what they can do —the animal form, the
   Arts tabula (Technique × Form, the casting or lab totals in its cells) and the Abilities. Narrow screens stack it all
   in the order it is used at the table (ficha.css). */
function pjFicha(content, pj, c, id) {
  const fa = formaActiva(pj);
  const rail = h('div', { class: 'sheet-rail' }), main = h('div', { class: 'sheet-main' });
  rail.appendChild(sheetChars(pj, fa));
  rail.appendChild(sheetState(pj, c));
  rail.appendChild(sheetHurt(pj, id));
  const pers = sheetPers(pj);
  if (pers) rail.appendChild(pers);
  rail.appendChild(sheetVd(pj, id));
  if (fa) main.appendChild(formaBlock(pj, c, fa));
  const hasArts = ARTS.some(a => c.arts[a] > 0);
  if (hasArts || pj.tipo === 'Magus' || pj.tipo === 'Aprendiz') main.appendChild(sheetArts(pj, c, id));
  main.appendChild(sheetAbil(c, id));
  content.appendChild(h('div', { class: 'sheet' }, h('div', { class: 'sheet-in' }, [rail, main])));
}
const shHead = (id, t) => h('h3', { class: 'sh-h', id: id, text: t });
function sheetChars(pj, fa) {
  const car = pjCar(pj, fa);
  const sec = h('section', { class: 'sh-sec s-car', 'aria-labelledby': 'sh-car' }, [shHead('sh-car', 'Características')]);
  // the ArM5 pairs side by side: Inteligencia–Percepción, Fuerza–Vitalidad, Presencia–Comunicación, Destreza–Rapidez
  sec.appendChild(h('div', { class: 'chars sh-chars' }, CHARS.map(n => {
    const v = numv(car[n]), hum = fa && fa.car && n in fa.car ? 'humano ' + sgn(numv(pj.car && pj.car[n])) : '';
    return h('div', { class: hum ? 'alt' : null }, [h('div', { class: 'l', text: n }), h('div', { class: 'v' + (v < 0 ? ' neg' : ''), text: sgn(v) }), h('div', { class: 'd', text: hum })]);
  })));
  if (fa) sec.appendChild(h('p', { class: 'sh-aside', text: 'Las físicas son las del ' + fa.n.toLowerCase() + '; la mente sigue siendo la suya.' }));
  else if (formasOf(pj).length) {
    const por = String(formasOf(pj)[0].por || '').replace(/\s*\([^)]*\)\s*$/, '');
    sec.appendChild(h('p', { class: 'sh-aside', text: 'Puede transformarse en ' + formasOf(pj).map(x => x.n.toLowerCase()).join(' o ') + (por ? ' gracias a ' + por : '') + '.' }));
  }
  return sec;
}
/* a ledger: label (with an optional note) on the left, the figure —or a word, for Virtues and Flaws— on the right */
function ledger(cls, rows) {
  return h('ul', { class: 'sh-ledger ' + (cls || '') }, rows.map(r => h('li', { title: r.title || null }, [
    h('span', null, [r.info ? h('button', { type: 'button', class: 'info-btn', onclick: r.info }, r.l) : r.l].concat(r.n ? [' ', h('small', { text: r.n })] : [])), ' ',
    r.v != null ? h('b', { class: numv(r.neg) ? 'neg' : null }, [r.v].concat(r.u ? [h('small', { text: ' ' + r.u })] : [])) : h('i', { class: 'sh-val', text: r.s || '' })])));
}
function sheetState(pj, c) {
  const sec = h('section', { class: 'sh-sec s-est', 'aria-label': 'Confianza, informidad y experiencia' });
  sec.appendChild(ledger('sh-est', [
    { l: 'Confianza', v: String(numv(pj.confianza)) },
    { l: 'Informidad', n: fmt(c.inf) + ' puntos', v: String(abLvl(c.inf)) },
    { l: 'Experiencia anotada', v: fmt(c.total), u: 'px' }]));
  return sec;
}
function sheetHurt(pj, id) {
  const fa = formaActiva(pj), tam = fa ? numv(fa.tam) : numv(pj.tam), r = Math.max(1, 5 + tam);
  const can = canWrite() && !!id;
  let e = estadoFisico(pj);
  const sec = h('section', { class: 'sh-sec s-her', 'aria-labelledby': 'sh-her' }, [shHead('sh-her', 'Heridas y fatiga')]);
  const sum = h('div', { class: 'her-sum', 'aria-live': 'polite' });
  sec.appendChild(sum);
  const paint = () => {
    sum.innerHTML = '';
    sum.classList.toggle('on', !!(e.total || e.fuera));
    sum.appendChild(h('b', { class: e.total || e.fuera ? 'neg' : null, text: e.fuera ? '—' : e.total ? sgn(e.total) : '0' }));
    sum.appendChild(h('span', null, [h('span', { class: 'her-k', text: e.fuera || 'Malus a las tiradas' }),
      h('small', { text: e.total ? [e.her ? 'heridas ' + sgn(e.her) : '', e.fat ? 'fatiga ' + sgn(e.fat) : ''].filter(Boolean).join(', ') + '; no se aplica a la absorción' : 'Sin heridas ni cansancio que resten' })]));
  };
  paint();
  // wounds: one count per range
  const span = (a, b) => b == null ? a + '+' : a === b ? String(a) : a + '–' + b;
  const rng = [span(1, r), span(r + 1, 2 * r), span(2 * r + 1, 3 * r), span(3 * r + 1, 4 * r), span(4 * r + 1)];
  const grid = h('div', { class: 'her-grid' });
  sec.appendChild(grid);
  const colW = h('div', { class: 'her-col' }, [h('h4', { class: 'sh-rub', text: 'Heridas' + (fa ? ' con el tamaño del ' + fa.n.toLowerCase() + ' (' + sgn(tam) + ')' : '') })]);
  const colF = h('div', { class: 'her-col' }, [h('h4', { class: 'sh-rub', text: 'Fatiga' })]);
  grid.appendChild(colW); grid.appendChild(colF);
  const ul = h('ul', { class: 'sh-ledger her-list fx' });
  const ins = {};
  HER.forEach(([k, n, pen], i) => {
    const inp = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', class: 'her-in', value: String(e.n(k)), 'aria-label': 'Heridas: ' + n.toLowerCase(), disabled: can ? null : true });
    ins[k] = inp;
    inp.addEventListener('input', () => {
      const hw = {};
      HER.forEach(([kk]) => { hw[kk] = Math.max(0, Math.round(numv(ins[kk].value))); });
      e = estadoFisico(Object.assign({}, S.pj[id] || pj, { heridas: hw }));
      paint();
      saveHurt(id, { heridas: hw });
    });
    ul.appendChild(h('li', { class: e.n(k) ? 'on' : null }, [h('span', null, [n, ' ', h('small', { text: rng[i] + (pen ? ' · ' + sgn(pen) + ' cada una' : i === 3 ? ' · no puede actuar' : '') })]), inp]));
  });
  colW.appendChild(ul);
  // fatigue: the current level of the track
  const fl = h('div', { class: 'sh-ledger fat-list', role: 'radiogroup', 'aria-label': 'Nivel de fatiga' });
  e.tr.forEach((lv, i) => {
    const rb = h('input', { type: 'radio', name: 'fat-' + (id || 'x'), value: String(i), checked: i === e.fl ? true : null, disabled: can ? null : true });
    rb.addEventListener('change', () => {
      fl.querySelectorAll('label').forEach((x, j) => x.classList.toggle('on', j === i));
      e = estadoFisico(Object.assign({}, S.pj[id] || pj, { fatiga: i }));
      paint();
      saveHurt(id, { fatiga: i });
    });
    fl.appendChild(h('label', { class: 'fat-l' + (i === e.fl ? ' on' : '') }, [rb, h('span', { text: lv.n }), h('small', { text: lv.p === null ? 'no puede actuar' : lv.p ? sgn(lv.p) : 'sin malus' })]));
  });
  colF.appendChild(fl);
  if (!can) sec.appendChild(h('p', { class: 'sh-aside', text: S.db ? 'Solo quien puede editar la saga marca heridas y fatiga.' : 'Inicia sesión para marcar heridas y fatiga.' }));
  return sec;
}
function sheetPers(pj) {
  const pers = (pj.personalidad || []).filter(t => t && String(t.n || '').trim());
  if (!pers.length) return null;
  const sec = h('section', { class: 'sh-sec s-pers', 'aria-labelledby': 'sh-pers' }, [shHead('sh-pers', 'Personalidad')]);
  sec.appendChild(ledger('sh-pers', pers.map(t => ({ l: String(t.n), v: sgn(numv(t.v)), neg: numv(t.v) < 0 ? 1 : 0 }))));
  return sec;
}
function sheetVd(pj, id) {
  const sec = h('section', { class: 'sh-sec s-vd', 'aria-label': 'Virtudes y defectos' });
  const cols = h('div', { class: 'sh-vdcols' });
  [['Virtudes', pj.virtudes, 'Ninguna.', 'sh-v'], ['Defectos', pj.defectos, 'Ninguno.', 'sh-d']].forEach(([t, l, none, k]) => {
    const L = (Array.isArray(l) ? l : []).filter(x => x && String(x.n || '').trim());
    const clase = t === 'Virtudes' ? 'virtud' : 'defecto';
    cols.appendChild(h('div', { class: 'sh-vdcol' }, [shHead(k, t),
      L.length ? ledger('sh-vd', L.map(x => ({ l: vdLabel(x), s: String(x.valor || '').toLowerCase(), title: [x.cat, x.nota].filter(Boolean).join(' — ') || null, info: () => vdInfo(x, clase) })))
        : h('p', { class: 'sh-aside', text: none })]));
  });
  sec.appendChild(cols);
  if (id) sec.appendChild(h('a', { class: 'vd-more', href: '#pj--' + id + '--virtudes', text: 'Ver las notas de cada una' }));
  return sec;
}
/* the Arts tabula: Techniques across, Forms down, each with its score; the cells hold the totals (casting or laboratory) */
/* spontaneous casting (ArM5, Spontaneous Magic): with fatigue, (Casting Score + stress die) ÷ 2 and a Fatigue level;
   without, Casting Score ÷ 5 and no die. Ceremony adds Artes Liberales + Filosofía. The roll and the switches stay while
   the page is open. */
const ESP = { fat: true, tirada: '', cer: false };
const decs = v => Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '');
function sheetArts(pj, c, id) {
  const MODES = ['Lanzamiento', 'Espontáneo', 'Laboratorio'];
  let mode = load('castgrid:pj-cg');
  if (!MODES.includes(mode)) mode = 'Lanzamiento';
  const tm = c.hab.find(x => tkey(x.n) === 'teoria-magica');
  const mt = (tm ? abLvl(tm.xp) : 0) + manaHab(c, 'Teoría Mágica');
  const vit = numv(pj.car && pj.car['Vitalidad']), int = numv(pj.car && pj.car['Inteligencia']);
  const lv = a => artLvl(c.arts[a]) + manaArt(c, a);
  const est = estadoFisico(pj), mal = est.total;
  const ac = academic(c), canCer = ac.xp > 0;
  const sec = h('section', { class: 'sh-sec s-artes', 'aria-labelledby': 'sh-artes' });
  const seg = h('div', { class: 'cg-tools', role: 'group', 'aria-label': 'Totales que se muestran' });
  const auraIn = h('input', { type: 'number', id: 'aura-in', value: String(castAura()), step: '1', inputmode: 'numeric', class: 'aura-in' });
  const auraBox = h('label', { class: 'sh-aura', for: 'aura-in' }, ['Aura ', auraIn]);
  sec.appendChild(h('div', { class: 'sh-arts-h' }, [shHead('sh-artes', 'Artes'), h('div', { class: 'sh-arts-tools fx' }, [seg, auraBox])]));
  // under the buttons, for spontaneous spells: effort, the die and the ceremony
  const fatSeg = h('div', { class: 'cg-tools', role: 'group', 'aria-label': 'Esfuerzo' });
  [['Con fatiga', true], ['Sin fatiga', false]].forEach(([t, v]) => fatSeg.appendChild(h('button', { type: 'button', class: 'seg', 'data-f': v ? '1' : '0', onclick: () => { ESP.fat = v; draw(); } }, t)));
  const tirIn = h('input', { type: 'number', id: 'esp-tirada', step: '1', inputmode: 'numeric', value: ESP.tirada, class: 'aura-in' });
  const tirBox = h('label', { class: 'sh-aura', for: 'esp-tirada' }, ['Tirada ', tirIn]);
  const cerIn = h('input', { type: 'checkbox', id: 'esp-cer', checked: ESP.cer && canCer ? true : null, disabled: canCer ? null : true });
  const cerBox = h('label', { class: 'chk cer', for: 'esp-cer' }, [cerIn, h('span', { text: 'Ceremonial' }),
    h('small', { class: 'fh', text: canCer ? sgn(ac.sum) + ' (Artes Liberales ' + ac.al + ', Filosofía ' + ac.fi + ') · 15 min por magnitud' : 'Sin Artes Liberales ni Filosofía' })]);
  const nextF = Math.min(est.tr.length - 1, est.fl + 1);
  const spend = canWrite() && id && est.fl < est.tr.length - 1 ? h('button', { type: 'button', class: 'btn ghost', id: 'esp-gasta',
    onclick: () => { saveHurt(id, { fatiga: nextF }); toast('Fatiga marcada: ' + est.tr[nextF].n.toLowerCase() + '.'); } }, 'Marcar el nivel de fatiga') : null;
  const espBox = h('div', { class: 'sh-esp fx' }, [fatSeg, tirBox, cerBox, spend]);
  sec.appendChild(espBox);
  tirIn.addEventListener('input', () => { ESP.tirada = tirIn.value; draw(); });
  cerIn.addEventListener('change', () => { ESP.cer = cerIn.checked; draw(); });
  const head = a => {
    const L = artLvl(c.arts[a]), b = manaArt(c, a), px = Math.round(c.arts[a] * 100) / 100, nxt = (L + 1) * (L + 2) / 2;
    const flags = [b ? 'Maña +' + b : '', c.fx.af.art.has(a) ? 'Afinidad' : ''].filter(Boolean);
    return { L: L, b: b, small: flags.concat([fmt(px) + ' px']).join(' · '),
      title: a + ': ' + L + (b ? ' + ' + b + ' de Maña' : '') + ' · ' + fmt(px) + ' px; faltan ' + fmt(Math.max(0, nxt - px)) + ' para el nivel ' + (L + 1) + (flags.includes('Afinidad') ? ' · Afinidad (×1,5 px)' : '') };
  };
  const artTh = (a, scope, cls) => {
    const x = head(a);
    return h('th', { scope: scope, class: cls, style: '--a:' + artVar(a), 'data-art': a, 'data-base': String(x.L), title: x.title }, [
      h('span', { class: 'mx-n' }, [h('span', { class: 'mx-full', text: a }), h('span', { class: 'mx-ab', 'aria-hidden': 'true', text: ABBR[a] })]),
      h('b', { class: 'mx-lv', text: String(x.L + x.b) }), h('small', { class: 'mx-px', text: x.small })]);
  };
  const table = h('table', { class: 'mx' });
  table.appendChild(h('colgroup', null, [h('col', { class: 'mx-c0' })].concat(ARTS_T.map(() => h('col')))));
  table.appendChild(h('thead', null, h('tr', null, [h('td', { class: 'mx-corner' })].concat(ARTS_T.map(t => artTh(t, 'col', 'mx-t'))))));
  const tb = h('tbody');
  table.appendChild(tb);
  sec.appendChild(h('div', { class: 'mx-frame' }, table));
  const note = h('p', { class: 'sh-aside mx-note' });
  sec.appendChild(note);
  function draw() {
    const lab = mode === 'Laboratorio', esp = mode === 'Espontáneo';
    const aura = numv(auraIn.value);
    const cer = esp && ESP.cer && canCer ? ac.sum : 0;
    const roll = esp && ESP.fat ? numv(ESP.tirada) : 0;
    const extra = lab ? int + mt + sagaAura() : vit + aura + cer + mal;
    const parts = (t, f) => [t + ' ' + lv(t), f + ' ' + lv(f)].concat(lab ? ['Inteligencia ' + sgn(int), 'Teoría Mágica ' + mt, 'aura ' + sagaAura()]
      : ['Vitalidad ' + sgn(vit), 'aura ' + sgn(aura)].concat(cer ? ['ceremonial ' + sgn(cer)] : [], mal ? ['malus ' + sgn(mal)] : [], esp && ESP.fat ? ['tirada ' + roll] : [])).join(' + ');
    const val = (t, f) => { const sc = lv(t) + lv(f) + extra; return esp ? (ESP.fat ? (sc + roll) / 2 : sc / 5) : sc; };
    const vals = ARTS_F.map(f => ARTS_T.map(t => val(t, f)));
    const all = [].concat(...vals), max = Math.max(...all), min = Math.min(...all);
    tb.innerHTML = '';
    ARTS_F.forEach((f, i) => tb.appendChild(h('tr', null, [artTh(f, 'row', 'mx-f')].concat(vals[i].map((v, j) => {
      const k = max > min ? (v - min) / (max - min) : 0;
      const expr = parts(ARTS_T[j], f);
      return h('td', { style: '--k:' + Math.round(4 + k * 24) + '%', title: (esp ? '(' + expr + ') ÷ ' + (ESP.fat ? 2 : 5) : expr) + ' = ' + decs(v), text: decs(v) });
    })))));
    table.setAttribute('aria-label', (lab ? 'Totales de laboratorio' : esp ? 'Totales de lanzamiento espontáneo' : 'Totales de lanzamiento') + ' por Técnica y Forma');
    seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === mode ? 'true' : 'false'));
    fatSeg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', (x.dataset.f === '1') === ESP.fat ? 'true' : 'false'));
    auraBox.hidden = lab;
    espBox.hidden = !esp;
    tirIn.disabled = !ESP.fat;
    if (spend) spend.hidden = !ESP.fat;
    const malTxt = mal ? ' + malus por heridas y fatiga (' + sgn(mal) + ')' : '';
    const auraTxt = String(aura) === String(castAura()) ? castAuraTxt() : sgn(aura);
    note.textContent = lab
      ? 'Laboratorio: Técnica + Forma + Inteligencia (' + sgn(int) + ') + Teoría Mágica (' + mt + ') + aura de la alianza (' + sagaAura() + '). Incluye las Mañas; sin dado ni otras virtudes.'
      : esp ? (ESP.fat
        ? 'Espontáneo con fatiga: (Técnica + Forma + Vitalidad (' + sgn(vit) + ') + aura (' + auraTxt + ')' + (cer ? ' + Artes Liberales y Filosofía (' + sgn(cer) + ')' : '') + malTxt + ' + tirada (' + (String(ESP.tirada).trim() === '' ? 'sin poner, cuenta 0' : roll) + ')) ÷ 2. Cuesta un nivel de fatiga.'
        : 'Espontáneo sin fatiga: (Técnica + Forma + Vitalidad (' + sgn(vit) + ') + aura (' + auraTxt + ')' + (cer ? ' + Artes Liberales y Filosofía (' + sgn(cer) + ')' : '') + malTxt + ') ÷ 5, sin tirada.')
        + ' Sin redondear: el hechizo sale si el resultado llega a su nivel. Incluye las Mañas; sin otras virtudes.'
      : 'Lanzamiento: Técnica + Forma + Vitalidad (' + sgn(vit) + ') + aura (' + auraTxt + ')' + malTxt + '. Incluye las Mañas; sin dado ni otras virtudes.';
  }
  MODES.forEach(m => seg.appendChild(h('button', { type: 'button', class: 'seg', 'data-m': m, onclick: () => { mode = m; store('castgrid:pj-cg', m); draw(); } }, m)));
  auraIn.addEventListener('input', draw);
  // crosshair: the Technique and Form of the cell under the pointer
  const clear = () => table.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
  table.addEventListener('mouseover', e => {
    const td = e.target.closest('td');
    clear();
    if (!td || !td.parentNode || td.classList.contains('mx-corner')) return;
    td.classList.add('hl');
    const th = table.tHead.rows[0].cells[td.cellIndex];
    if (th) th.classList.add('hl');
    td.parentNode.cells[0].classList.add('hl');
  });
  table.addEventListener('mouseleave', clear);
  draw();
  return sec;
}
const habLv = (c, x) => abLvl(x.xp) + manaHab(c, x.n);
function sheetAbil(c, id) {
  const sec = h('section', { class: 'sh-sec s-hab', 'aria-labelledby': 'sh-hab' }, [shHead('sh-hab', 'Habilidades')]);
  if (c.hab.some(x => habLv(c, x) >= 1)) sec.appendChild(abilBlock(c));
  else sec.appendChild(h('p', { class: 'sh-aside', text: 'Ninguna habilidad de nivel 1 o más todavía.' }));
  const low = c.hab.filter(x => x.xp > 0 && habLv(c, x) < 1).length;
  if (low && id) sec.appendChild(h('a', { class: 'vd-more', href: '#pj--' + id + '--avance', text: low === 1 ? 'Una habilidad más en camino del nivel 1, en Avance' : low + ' habilidades más en camino del nivel 1, en Avance' }));
  return sec;
}
// the sheet lists the Abilities of level 1 or more; the ones still on their way to level 1 are in Avance (pjAvance)
function abilBlock(c) {
  const groups = {};
  c.hab.forEach(x => { if (habLv(c, x) >= 1) (groups[x.cat || 'Otras'] = groups[x.cat || 'Otras'] || []).push(x); });
  const order = ABIL_CATS.filter(g => groups[g]).concat(Object.keys(groups).filter(g => !ABIL_CATS.includes(g)));
  return h('div', { class: 'abil' }, order.map(g => h('section', null, [h('h4', { text: g })].concat(groups[g].sort((x, y) => x.n.localeCompare(y.n, 'es')).map(x => {
    const L = abLvl(x.xp), need = abCost(L + 1) - x.xp, b = manaHab(c, x.n);
    const tags = [b ? 'Maña ' + sgn(b) : '', x.af ? 'Afinidad' : ''].filter(Boolean);
    return h('div', { 'data-base': String(L), title: fmt(x.xp) + ' px · faltan ' + fmt(need) + ' para el nivel ' + (L + 1) + (b ? ' · ' + L + ' + ' + b + ' de Maña' : '') }, [
      h('span', { html: esc(x.n) + (x.esp ? ' <em>(' + esc(x.esp) + ')</em>' : '') + tags.map(t => ' <small class="vtag">' + esc(t) + '</small>').join('') }),
      h('span', { class: 'ab-r' }, [h('small', { text: fmt(x.xp) + ' px' }), h('b', { text: String(L + b) })])]);
  })))));
}
function pjAvance(content, id, entries, c) {
  const total = entries.reduce((s, e) => s + sumRep(e.reparto), 0);
  content.appendChild(R.stats({ items: [
    { l: 'Estaciones registradas', v: String(entries.length), s: entries.length ? sname(entries[0].anio, entries[0].est) + ' – ' + sname(entries[entries.length - 1].anio, entries[entries.length - 1].est) : '' },
    { l: 'Experiencia anotada', v: fmt(total), s: 'px' }] }));
  if (canWrite()) {
    const [ca, ce] = curSeason();
    const oa = h('input', { type: 'number', value: String(ca), min: '1000', max: '1500', inputmode: 'numeric', 'aria-label': 'Año' });
    const oe = h('select', { 'aria-label': 'Estación' }, SEASONS.map((s, i) => h('option', { value: i + 1, selected: i + 1 === ce ? true : null }, s)));
    content.appendChild(h('div', { class: 'actions fx' }, [h('button', { type: 'button', class: 'btn', onclick: () => openXpEditor(id, ca, ce) }, 'Repartir PX de ' + sname(ca, ce)),
      h('span', { class: 'other-season' }, [h('span', { class: 'fh', text: 'u otra estación:' }), oe, oa,
        h('button', { type: 'button', class: 'btn ghost', onclick: () => openXpEditor(id, parseInt(oa.value, 10) || ca, Number(oe.value)) }, 'Abrir')])]));
  }
  if (entries.length > 1 && total > 0) content.appendChild(R.chart({ kind: 'bars', x: entries.map(e => SEASONS[e.est - 1].slice(0, 3) + ' ' + e.anio), series: [{ n: 'PX', v: entries.map(e => sumRep(e.reparto)) }], y: 'PX', cap: 'Experiencia por estación' }));
  // Abilities with experience but still below level 1: not on the sheet yet
  const low = c ? c.hab.filter(x => x.xp > 0 && habLv(c, x) < 1).sort((a, b) => b.xp - a.xp || a.n.localeCompare(b.n, 'es')) : [];
  if (low.length) {
    const sec = h('section', { class: 'sh-sec av-low', 'aria-labelledby': 'av-low' }, [h('h3', { class: 'sh-h', id: 'av-low', text: 'Camino del nivel 1' }),
      h('p', { class: 'sh-aside', text: 'Habilidades con experiencia que aún no llegan a nivel 1 (5 px). Pasan a la ficha cuando lo alcanzan.' })]);
    sec.appendChild(ledger('av-low-l', low.map(x => ({ l: x.n + (x.esp ? ' (' + x.esp + ')' : ''), n: x.cat || '', v: fmt(x.xp), u: 'de 5 px' }))));
    content.appendChild(sec);
  }
  if (!entries.length) { content.appendChild(h('p', { class: 'note', text: 'Sin estaciones registradas.' })); return; }
  const tl = h('div', { class: 'tl' });
  let year = null;
  entries.slice().reverse().forEach(e => {
    if (e.anio !== year) { year = e.anio; tl.appendChild(h('div', { class: 'tl-year', text: String(year) })); }
    tl.appendChild(h('div', { class: 'tl-item', 'data-k': 'av.' + e._id }, [
      h('div', { class: 's', text: SEASONS[e.est - 1] }),
      h('div', { class: 'px', html: sumRep(e.reparto) ? esc(fmt(sumRep(e.reparto))) + ' <small>px</small>' : '' }),
      h('div', null, [
        h('div', { class: 'a' }, [h('span', { text: [e.tipo, e.actividad].filter(Boolean).join(' · ') || 'Sin descripción' }),
          canWrite() ? h('button', { type: 'button', class: 'lnk', onclick: () => openXpEditor(id, e.anio, e.est) }, 'Editar') : null]),
        (e.reparto || []).length ? h('div', { class: 'subj' }, e.reparto.map(r => h('span', { text: r.r + ' ' + signed(numv(r.px)) }))) : null,
        e.nota ? h('div', { class: 'note', text: e.nota }) : null])]));
  });
  content.appendChild(tl);
}

/* ---------- search + routing */
function sagaIndex(push) {
  Object.keys(S.pj).forEach(id => {
    const p = S.pj[id];
    push({ dyn: true, href: '#pj--' + id, group: 'Saga en curso · Personajes', sub: 'Ficha', t: [p.nombre, p.sub, p.tipo, p.casa, p.jugador, p.concepto].filter(Boolean).join(' · ') });
    (p.hechizos || []).forEach(s => push({ dyn: true, href: '#pj--' + id + '--hechizos', group: 'Saga en curso · Personajes', sub: p.nombre + ' · Hechizos', t: [s.n, s.tec, s.forma, s.nivel ? 'nivel ' + s.nivel : ''].filter(Boolean).join(' · ') }));
  });
  Object.keys(S.av).forEach(k => {
    const e = S.av[k], p = S.pj[e.pj];
    if (!p) return;
    push({ dyn: true, href: '#pj--' + e.pj + '--avance', focus: 'av.' + k, group: 'Saga en curso · Estaciones', sub: p.nombre + ' · ' + sname(e.anio, e.est), t: [e.tipo, e.actividad, (e.reparto || []).map(r => r.r + ' ' + signed(numv(r.px))).join(', ')].filter(Boolean).join(' · ') });
  });
}
function sagaRoute(raw) {
  if (raw === 'estaciones' || raw.startsWith('estaciones--')) { viewSeasons(raw.split('--')[1]); return true; }
  if (raw === 'personajes') { viewCharacters(); return true; }
  if (raw === 'master') { viewMaster(); return true; }
  if (raw === 'pj-nuevo') { viewEditor(null); return true; }
  if (raw.startsWith('pj--')) { const p = raw.split('--'); if (p[2] === 'editar') viewEditor(p[1]); else viewPj(p[1], p[2]); return true; }
  return false;
}

/* ================================================================== CREACIÓN DE PERSONAJES
   Rules of ArM5 character creation, checked live in the editor. Sources: ArM5 core, chapters 3 and 4 (Project Redcap's open
   text); Apprentices, chapter 2, for characters still in apprenticeship; the saga's own Excel template
   for the childhood packages. Virtues and flaws are picked from the compendium in drop-downs; the ones
   whose rule the page knows (Puissant, Affinity, Great/Poor Characteristic, and the statuses and virtues
   that grant experience or open restricted Abilities) change the sheet and the budget directly. */
const CLASE = { Magus: 'mago', Aprendiz: 'aprendiz', 'Compañero': 'companero', Grog: 'grog', Otro: 'otro' };
const CLASE_TXT = { mago: 'un mago', aprendiz: 'un aprendiz', companero: 'un compañero', grog: 'un grog', otro: 'este personaje' };
const CHAR_COST = { '-3': -6, '-2': -3, '-1': -1, '0': 0, '1': 1, '2': 3, '3': 6 };
const DRAFT_KEY = KEYP + 'pj-nuevo';
const vdPts = v => v === 'Mayor' ? 3 : v === 'Menor' ? 1 : 0;
const isMagic = cls => cls === 'mago' || cls === 'aprendiz';
const PRESETS = () => (DATA.creacion && DATA.creacion.infancias) || [];
/* virtues and flaws whose rules the page applies, by their original (English) name, or the Spanish one when the compendium has none */
const FX = {
  'the-gift': 'don', 'el-don': 'don', 'hermetic-magus': 'magus', 'improved-characteristics': 'carMas', 'weak-characteristics': 'carMenos',
  'great-characteristic': 'carGrande', 'poor-characteristic': 'carPobre', 'wealthy': 'rico', 'poor': 'pobre', 'privileged-upbringing': 'crianza',
  'warrior': 'guerrero', 'educated': 'instruido', 'educated-islamic': 'instruido', 'educated-hebrew': 'instruido',
  'skilled-parens': 'maestro', 'weak-parens': 'malMaestro', 'arcane-lore': 'arcano', 'well-traveled': 'trotamundos', 'mastered-spells': 'dominados',
  'magister-in-artibus': 'magister', 'redcap': 'redcap', 'feral-upbringing': 'feral', 'custos': 'custos',
  'affinity-with-ability': 'afHab', 'affinity-with-art': 'afArte', 'puissant-ability': 'manaHab', 'puissant-art': 'manaArte'
};
/* the ones that apply to something the player chooses: an Ability, an Art or a Characteristic */
const FX_OBJ = { afHab: 'hab', manaHab: 'hab', afArte: 'art', manaArte: 'art', carGrande: 'car', carPobre: 'car' };
const FX_GENERIC = { afHab: 'Affinity with Ability', afArte: 'Affinity with Art', manaHab: 'Puissant (Ability)', manaArte: 'Puissant Art' };
/* what the page does with each one (shown under the row) */
const FX_TXT = {
  don: 'Obligatoria y gratuita para magos y aprendices.',
  afHab: 'La página multiplica por 1,5 los px de la habilidad elegida (al crearlo y en cada estación) y le deja pasar 2 del límite por edad.',
  afArte: 'La página multiplica por 1,5 los px del Arte elegido, al crearlo y en cada estación.',
  manaHab: 'Suma +2 a la habilidad elegida en la ficha.',
  manaArte: 'Suma +3 al Arte elegido en la ficha y en los totales de lanzamiento y laboratorio.',
  carGrande: 'Sube un punto la característica elegida, que ya debe estar en +3.',
  carPobre: 'Baja un punto la característica elegida, que ya debe estar en −3.',
  carMas: 'Da 3 puntos más para características.', carMenos: 'Quita 3 puntos de características.',
  rico: 'Vida posterior a 20 px por año en vez de 15.', pobre: 'Vida posterior a 10 px por año en vez de 15.',
  crianza: 'Suma 50 px (habilidades generales, académicas o marciales) y permite las académicas y marciales.',
  guerrero: 'Suma 50 px para habilidades marciales y las permite.', instruido: 'Suma 50 px para Latín y Artes Liberales y permite las académicas.',
  arcano: 'Suma 50 px para habilidades arcanas y las permite.', trotamundos: 'Suma 50 px al presupuesto.',
  dominados: 'Da 50 px para la maestría de hechizos.', magister: 'Suma 240 px (8 años × 30) para habilidades académicas o Enseñanza.',
  redcap: 'Sus 15 años de formación dan 20 px por año en vez de 15 (300 en total) y permite académicas, arcanas y marciales.',
  maestro: 'El aprendizaje da 60 px y 30 niveles de hechizo más.', malMaestro: 'El aprendizaje da 60 px y 30 niveles de hechizo menos.',
  feral: 'Sin lengua materna: la infancia da sus 120 px a otras habilidades.', custos: 'Permite un grupo de habilidades restringidas, a elegir.'
};
/* restricted Abilities at creation (ArM5 p. 31): magi always; anyone else needs one of these virtues or flaws */
const G_RESTR = ['Marciales', 'Académicas', 'Arcanas'];
const ACCESS = {
  'knight': ['Marciales'], 'mercenary-captain': ['Marciales'], 'branded-criminal': ['Marciales'], 'outlaw': ['Marciales'], 'outlaw-leader': ['Marciales'],
  'brother-knight': ['Marciales'], 'warrior': ['Marciales'],
  'mendicant-friar': ['Académicas'], 'priest': ['Académicas'], 'clerk': ['Académicas'], 'magister-in-artibus': ['Académicas'], 'magister-in-medicina': ['Académicas'],
  'educated': ['Académicas'], 'educated-islamic': ['Académicas'], 'educated-hebrew': ['Académicas'],
  'wise-one': ['Académicas', 'Arcanas'], 'arcane-lore': ['Arcanas'], 'privileged-upbringing': ['Académicas', 'Marciales'],
  'failed-apprentice': G_RESTR, 'redcap': G_RESTR
};
const G_TXT = { Marciales: 'marciales', 'Académicas': 'académicas', Arcanas: 'arcanas' };
const G_HOW = { Marciales: 'Guerrero, Caballero, Capitán mercenario o Infancia Privilegiada', 'Académicas': 'Instruido, Letrado, Sacerdote, Magister in Artibus o Infancia Privilegiada', Arcanas: 'Conocimiento arcano, Sabio, Aprendiz Fracasado o Boina Roja' };

/* ---------- the compendium as an index */
let VD_IDX = null;
function vdIndex() {
  if (VD_IDX) return VD_IDX;
  VD_IDX = { list: [], byKey: new Map(), core: [], canon: new Map(), cats: { virtud: [], defecto: [] } };
  const doc = DOCS['virtudes-defectos'];
  if (doc) doc.sheets.slice(0, 2).forEach((s, si) => s.blocks.forEach(b => {
    if (b.t !== 'table') return;
    b.rows.forEach(r => {
      const e = { clase: si === 0 ? 'virtud' : 'defecto', n: r[0], en: r[1] || '', cat: r[2] || '', valor: r[3] || '', libro: r[4] || '', pag: r[5] || '', desc: r[6] || '' };
      if (!String(e.n || '').trim()) return;
      e.i = VD_IDX.list.length;
      e.key = norm([e.n, e.en, e.cat, e.desc].join(' '));
      e.core = e.libro === 'Core Rulebook';
      // one option per virtue: the same rule from several books (or two Spanish names of it) shows once, from the core book if it is there
      e.dk = e.clase + '|' + tkey(e.en || e.n) + '|' + e.valor + '|' + tkey(e.cat);
      VD_IDX.list.push(e);
      if (e.core) VD_IDX.core.push(e);
      const c = VD_IDX.canon.get(e.dk);
      if (!c || (e.core && !c.core)) VD_IDX.canon.set(e.dk, e);
      if (e.cat && !VD_IDX.cats[e.clase].includes(e.cat)) VD_IDX.cats[e.clase].push(e.cat);
      [tkey(e.n), e.en ? 'en:' + tkey(e.en) : null].forEach(k => {
        if (!k) return;
        const kk = k + '|' + e.clase;
        if (!VD_IDX.byKey.has(kk)) VD_IDX.byKey.set(kk, []);
        VD_IDX.byKey.get(kk).push(e);
      });
    });
  }));
  const ord = c => { const i = VD_CATS.indexOf(c); return i < 0 ? 99 : i; };
  Object.values(VD_IDX.cats).forEach(l => l.sort((a, b) => ord(a) - ord(b) || a.localeCompare(b, 'es')));
  return VD_IDX;
}
/* the same name can exist as a major and a minor version: the value decides; otherwise core book, minor first */
function vdFind(name, clase, valor) {
  if (!name) return null;
  const idx = vdIndex(), k = tkey(name);
  const arr = idx.byKey.get(k + '|' + clase) || idx.byKey.get('en:' + k + '|' + clase);
  if (!arr) return null;
  return (valor && arr.find(e => e.valor === valor)) || arr.find(e => e.core && e.valor === 'Menor') || arr.find(e => e.core) || arr.find(e => e.valor === 'Menor') || arr[0];
}
function vdEntry(x, clase) { return x ? vdFind(x.en, clase, x.valor) || vdFind(x.n, clase, x.valor) : null; }
const vdKeyOf = (x, clase, e) => { e = e === undefined ? vdEntry(x, clase) : e; return tkey((e && e.en) || x.en || (e && e.n) || x.n); };
const vdNota = e => e ? (e.pag || (e.core ? '' : e.libro)) : '';
const bookAbbr = e => (String(e.pag || '').split(/\s+/)[0] || e.libro || '').replace(/[,;]$/, '');
/* older sheets name the target inside the virtue: «Afinidad con Vim», «Maña con Concentración» */
function legacyObj(name) {
  const m = String(name || '').trim().match(/^(afinidad|ma[ñn]a)\s+con\s+\(?\s*([^()]+?)\s*\)?$/i);
  if (!m || /^(habilidad|arte|competencia)$/i.test(m[2])) return null;
  const art = artOf(m[2]), mana = /^ma/i.test(m[1]);
  return { fx: art ? (mana ? 'manaArte' : 'afArte') : (mana ? 'manaHab' : 'afHab'), obj: art || m[2] };
}
function vdFx(x, clase) {
  if (!x || !String(x.n || x.en || '').trim()) return null;
  const e = vdEntry(x, clase);
  const f = FX[vdKeyOf(x, clase, e)];
  if (f) return f;
  if (!e && clase === 'virtud') { const L = legacyObj(x.n); if (L) return L.fx; }
  return null;
}
/* what a Maña, Afinidad or Característica Notable/Mediocre applies to ('' while the player has not chosen) */
function vdTarget(x, f) {
  const kind = FX_OBJ[f];
  if (!kind) return '';
  let o = String(x.obj || '').trim();
  if (!o) { const L = legacyObj(x.n); if (L && FX_OBJ[L.fx] === kind) o = L.obj; }
  if (!o && kind !== 'hab') { const words = tkey(x.nota || '').split('-'); o = (kind === 'art' ? ARTS : CHARS).find(a => words.includes(tkey(a))) || ''; }
  if (!o) return '';
  if (kind === 'art') return artOf(o) || '';
  if (kind === 'car') return CHARS.find(c => tkey(c) === tkey(o)) || '';
  return o;
}
/* the effects on the sheet: used by the editor, the live sheet (calc) and the season editor */
function vdEffects(pj) {
  const fx = { af: { hab: new Set(), art: new Set() }, mana: { hab: {}, art: {} }, car: {} };
  if (!pj) return fx;
  [['virtudes', 'virtud'], ['defectos', 'defecto']].forEach(([k, clase]) => (Array.isArray(pj[k]) ? pj[k] : []).forEach(x => {
    if (!x || typeof x !== 'object') return;
    const f = vdFx(x, clase);
    if (!FX_OBJ[f]) return;
    const t = vdTarget(x, f);
    if (!t) return;
    if (f === 'afHab') fx.af.hab.add(tkey(t));
    else if (f === 'afArte') fx.af.art.add(t);
    else if (f === 'manaHab') fx.mana.hab[tkey(t)] = 2;
    else if (f === 'manaArte') fx.mana.art[t] = 3;
    else fx.car[t] = (fx.car[t] || 0) + (f === 'carGrande' ? 1 : -1);
  }));
  return fx;
}
/* «Maña con (Habilidad)» + Concentración → «Maña con Concentración» */
function vdLabel(x) {
  const n = String((x && x.n) || '').trim(), o = String((x && x.obj) || '').trim();
  if (!o) return n;
  const r = n.replace(/\(\s*(habilidad|arte|caracter[ií]stica)\s*\)|\b(habilidad|arte)\b/i, o);
  return r !== n ? r : n + ' (' + o + ')';
}
/* «Afinidad con Vim» (Excel) → the compendium's «Afinidad con Arte» applied to Vim */
function vdNormalize(x) {
  if (!x || typeof x !== 'object' || x.obj || !String(x.n || '').trim() || vdEntry(x, 'virtud')) return x;
  const L = legacyObj(x.n);
  const e = L && vdFind(FX_GENERIC[L.fx], 'virtud');
  if (!e) return x;
  return Object.assign({}, x, { n: e.n, en: e.en, cat: e.cat, valor: x.valor || e.valor, obj: L.obj });
}
const valorOf = (x, clase) => x.valor || (vdEntry(x, clase) || {}).valor || '';
const catOf = (x, clase) => x.cat || (vdEntry(x, clase) || {}).cat || '';
function ensureGift(d) {
  if (!isMagic(CLASE[d.tipo])) return;
  if (!(d.virtudes || []).some(x => vdFx(x, 'virtud') === 'don')) d.virtudes.unshift({ n: 'El Don', en: 'The Gift', cat: 'Especial', valor: 'Gratuita', nota: 'ArM 68' });
}
function ageOf(d) { const [ca] = curSeason(); const n = parseInt(d.nacimiento, 10); return n ? ca - n : null; }
function abilityCap(age) { return age == null || age < 30 ? 5 : age <= 35 ? 6 : age <= 40 ? 7 : age <= 45 ? 8 : 9; }

/* restricted Abilities a companion or grog may learn ({cls, acc, custos}); null for magi (all) and «Otro» (not checked) */
function accessOf(d) {
  const cls = CLASE[d.tipo] || 'otro';
  if (cls !== 'companero' && cls !== 'grog') return null;
  const acc = new Set();
  let custos = false;
  (d.virtudes || []).forEach(x => { if (!x || !String(x.n || '').trim()) return; const k = vdKeyOf(x, 'virtud'); if (k === 'custos') custos = true; (ACCESS[k] || []).forEach(g => acc.add(g)); });
  (d.defectos || []).forEach(x => { if (!x || !String(x.n || '').trim()) return; (ACCESS[vdKeyOf(x, 'defecto')] || []).forEach(g => acc.add(g)); });
  return { cls: cls, acc: acc, custos: custos };
}
const grpOf = c => c === 'Lenguas muertas' ? 'Académicas' : c; // a dead language is an Academic Ability
/* ---------- the rules: what a new character may spend, and what it spends */
function creationCheck(d) {
  const cls = CLASE[d.tipo] || 'otro';
  const age = ageOf(d);
  const cr = d.creacion || {};
  const V = (d.virtudes || []).filter(x => x && String(x.n || '').trim());
  const D = (d.defectos || []).filter(x => x && String(x.n || '').trim());
  const fxV = V.map(x => vdFx(x, 'virtud')), fxD = D.map(x => vdFx(x, 'defecto'));
  const hasV = f => fxV.includes(f), hasD = f => fxD.includes(f);
  const valV = x => valorOf(x, 'virtud'), valD = x => valorOf(x, 'defecto');
  const catV = x => norm(catOf(x, 'virtud')), catD = x => norm(catOf(x, 'defecto'));
  const fx = vdEffects(d);
  const errors = [], avisos = [], lines = [];
  // 1. virtues and flaws: start with 0 points; flaws give them (major 3, minor 1), virtues spend them
  const pv = V.reduce((s, x) => s + vdPts(valV(x)), 0), pd = D.reduce((s, x) => s + vdPts(valD(x)), 0);
  const vdCap = cls === 'grog' ? 3 : cls === 'otro' ? null : 10;
  if (vdCap != null && pd > vdCap) errors.push('Los defectos suman ' + pd + ' puntos y el máximo para ' + CLASE_TXT[cls] + ' es ' + vdCap + '.');
  if (pv > pd) errors.push('Las virtudes cuestan ' + pv + (pv === 1 ? ' punto' : ' puntos') + ' y los defectos solo dan ' + pd + '.');
  const gift = hasV('don');
  if (isMagic(cls) && !gift) errors.push('Falta El Don, obligatorio y gratuito para los magos.');
  if (cls === 'grog') {
    if (V.some(x => valV(x) === 'Mayor') || D.some(x => valD(x) === 'Mayor')) avisos.push('Según el reglamento, los grogs no llevan virtudes ni defectos mayores.');
    if (gift) avisos.push('Según el reglamento, un grog nunca tiene el Don.');
    if (D.some(x => catD(x) === 'historia')) avisos.push('Según el reglamento, los grogs no llevan defectos de Historia.');
  }
  if (cls === 'companero' && gift) avisos.push('Un compañero con el Don solo tiene sentido si va a acabar siendo mago.');
  const nMinor = D.filter(x => valD(x) === 'Menor').length;
  if (nMinor > 5) avisos.push('Hay ' + nMinor + ' defectos menores; el reglamento permite cinco como mucho.');
  const story = D.filter(x => catD(x) === 'historia').length;
  if (story > 1) avisos.push('Hay ' + story + ' defectos de Historia; lo normal es uno como mucho.');
  const pers = D.filter(x => catD(x) === 'personalidad');
  if (pers.filter(x => valD(x) === 'Mayor').length > 1 || pers.length > (cls === 'grog' ? 1 : 2)) avisos.push('Demasiados defectos de Personalidad: ' + (cls === 'grog' ? 'un grog lleva uno como mucho.' : 'como mucho uno mayor y dos en total.'));
  const hermV = V.filter(x => /^herm/.test(catV(x))), hermD = D.filter(x => /^herm/.test(catD(x)));
  if ((hermV.length || hermD.length) && !gift) avisos.push('Las virtudes y defectos herméticos solo los llevan personajes con el Don.');
  if (cls === 'mago' && hermV.filter(x => valV(x) === 'Mayor').length > 1) avisos.push('Un mago solo puede llevar una virtud hermética mayor.');
  if (cls === 'mago' && !hermD.length) avisos.push('Según el reglamento, un mago debería llevar al menos un defecto hermético.');
  if (cls !== 'otro' && !V.some(x => catV(x) === 'estatus social') && !D.some(x => catD(x) === 'estatus social')) {
    avisos.push(cls === 'mago' ? 'Falta el estatus social: los magos llevan «Magus Hermético», que es gratuito.' : 'Falta el estatus social: todos los personajes llevan uno (hay gratuitos, como Campesino o Habitante de la Alianza).');
  }
  if (cls === 'mago' && hasV('rico')) avisos.push('Según el reglamento, un mago no puede ser Rico.');
  const unknown = V.filter(x => !vdEntry(x, 'virtud') && !legacyObj(x.n)).map(x => x.n).concat(D.filter(x => !vdEntry(x, 'defecto')).map(x => x.n));
  if (unknown.length) avisos.push('No están en el compendio (revisa el nombre y el valor): ' + unknown.join(', ') + '.');
  // Maña, Afinidad and Característica Notable/Mediocre need their target, once per target
  const noObj = [], twice = [], seenObj = new Set();
  [[V, fxV], [D, fxD]].forEach(([L, F]) => L.forEach((x, i) => {
    if (!FX_OBJ[F[i]]) return;
    const t = vdTarget(x, F[i]);
    if (!t) { noObj.push('«' + x.n + '»'); return; }
    const k = F[i] + '|' + tkey(t);
    if (seenObj.has(k) && F[i] !== 'carGrande' && F[i] !== 'carPobre') twice.push(vdLabel(Object.assign({}, x, { obj: t })));
    seenObj.add(k);
  }));
  if (noObj.length) avisos.push('Elige a qué se aplica' + (noObj.length > 1 ? 'n ' : ' ') + noObj.join(', ') + ' (columna «Se aplica a»).');
  if (twice.length) avisos.push('Solo se puede coger una vez para lo mismo: ' + twice.join(', ') + '.');
  lines.push({ k: 'vd', l: 'Virtudes y defectos', s: 'Def.', short: pd + (vdCap != null ? '/' + vdCap : '') + ' · Virt. ' + pv + '/' + pd,
    txt: 'defectos ' + pd + (vdCap != null ? ' de ' + vdCap : '') + ' · virtudes ' + pv + ' de ' + pd,
    st: (vdCap != null && pd > vdCap) || pv > pd ? 'over' : pv < pd ? 'under' : 'ok' });
  // 2. characteristics: 7 points; +1 costs 1, +2 costs 3, +3 costs 6, negatives give the same back.
  //    Característica Notable / Mediocre move one past ±3 for free: the cost is that of the score without them.
  const nMas = fxV.filter(f => f === 'carMas').length, nMenos = fxD.filter(f => f === 'carMenos').length;
  const cBudget = 7 + 3 * nMas - 3 * nMenos;
  let cSpent = 0;
  const outR = [], badAdj = [];
  CHARS.forEach(n => {
    const v = Math.round(numv(d.car && d.car[n])), adj = fx.car[n] || 0, b = v - adj;
    cSpent += CHAR_COST[Math.max(-3, Math.min(3, b))];
    if (b > 3 || b < -3) outR.push(n + ' ' + sgn(v));
    if ((adj > 0 && b < 3) || (adj < 0 && b > -3)) badAdj.push(n + ' (' + sgn(v) + ')');
  });
  if (cSpent > cBudget) errors.push('Las características cuestan ' + cSpent + ' puntos y hay ' + cBudget + '.');
  if (outR.length) avisos.push('Fuera del rango normal de −3 a +3: ' + outR.join(', ') + '. Por encima hace falta Característica Notable y por debajo, Característica Mediocre.');
  if (badAdj.length) avisos.push('Característica Notable y Mediocre se aplican a una característica que ya está en +3 o −3 antes de la virtud: ' + badAdj.join(', ') + '.');
  lines.push({ k: 'car', l: 'Características', s: 'Car.', short: cSpent + '/' + cBudget, txt: cSpent + ' de ' + cBudget + ' puntos', st: cSpent > cBudget ? 'over' : cSpent < cBudget ? 'under' : 'ok' });
  // 3. experience by age, plus what virtues and statuses add
  const parts = [];
  const preset = cr.infancia ? PRESETS().find(p => p.n === cr.infancia) : null;
  parts.push([preset ? 'Infancia: paquete «' + preset.n + '»' : hasD('feral') ? 'Infancia entre fieras (120, sin lengua materna)' : 'Lengua materna (75) e infancia (45)', preset ? preset.total : 120]);
  let spBudget = 0, shared = 0;
  const ea = Math.max(5, Math.min(30, parseInt(cr.edadAprendizaje, 10) || 10));
  if (isMagic(cls)) {
    if (ea > 5) parts.push(['Antes del aprendizaje (' + (ea - 5) + ' años × 15)', (ea - 5) * 15]);
    if (cls === 'mago') {
      parts.push(['Aprendizaje (15 años)', 240 + (hasV('maestro') ? 60 : 0) - (hasD('malMaestro') ? 60 : 0)]);
      spBudget = 120 + (hasV('maestro') ? 30 : 0) - (hasD('malMaestro') ? 30 : 0);
      if (age != null && age < ea + 15) avisos.push('Con ' + age + ' años y el aprendizaje empezado a los ' + ea + ', aún no habría pasado el Guantelete (el aprendizaje dura 15 años).');
      shared = age != null ? Math.max(0, age - (ea + 15)) * 30 : 0;
    } else {
      const yrs = age != null ? Math.max(0, Math.min(15, age - ea)) : 0;
      parts.push(['Aprendizaje (' + yrs + (yrs === 1 ? ' año' : ' años') + ')', 19 * Math.min(yrs, 12) + 6 * Math.max(0, yrs - 12)]);
      spBudget = 40 * Math.max(0, yrs - 12);
    }
  } else if (cls !== 'otro') {
    const yrs = age != null ? Math.max(0, age - 5) : 0;
    const per = hasV('rico') ? 20 : hasD('pobre') ? 10 : 15;
    parts.push(['Vida posterior (' + yrs + ' años × ' + per + ')', yrs * per]);
  }
  if (hasV('crianza')) parts.push(['Infancia Privilegiada', 50]);
  if (hasV('guerrero')) parts.push(['Guerrero (habilidades marciales)', 50]);
  if (hasV('instruido')) parts.push(['Instruido (Latín y Artes Liberales)', 50]);
  if (hasV('arcano')) parts.push(['Conocimiento arcano (habilidades arcanas)', 50]);
  if (hasV('trotamundos')) parts.push(['Trotamundos', 50]);
  if (hasV('magister')) parts.push(['Magister in Artibus (8 años de universidad × 30)', 240]);
  if (hasV('redcap')) {
    const y = age != null ? Math.max(0, Math.min(15, age - 5)) : 0;
    if (y) parts.push(['Boina Roja (' + y + ' años de formación a 20 px en vez de 15)', y * 5]);
  }
  const xpBudget = parts.reduce((s, p) => s + p[1], 0);
  // what is spent: the px typed in each row (Affinity raises them when they count, not here)
  let xpSpent = 0, artXp = 0, latAL = 0, teach = 0;
  const byCat = {};
  (d.hab || []).forEach(x => {
    if (!String(x.n || '').trim()) return;
    const b = Math.max(0, numv(x.base)), c = x.cat || guessCat(x.n), k = tkey(x.n);
    xpSpent += b;
    byCat[c] = (byCat[c] || 0) + b;
    if (k === 'latin' || k === 'artes-liberales') latAL += b;
    if (k === 'ensenanza') teach += b;
  });
  ARTS.forEach(a => { const b = Math.max(0, numv(d.artes && d.artes[a])); artXp += b; xpSpent += b; });
  // spell mastery: a score bought like an Ability (1 = 5 px, 2 = 15, 3 = 30); Hechizos dominados pays the first 50
  const msXp = (d.hechizos || []).filter(x => String(x.n || '').trim()).reduce((s, x) => s + abCost(Math.max(0, Math.round(numv(x.maestria)))), 0);
  const msBonus = hasV('dominados') ? 50 : 0;
  xpSpent += Math.max(0, msXp - msBonus);
  if (!isMagic(cls) && cls !== 'otro' && artXp > 0) errors.push('Solo los magos y los aprendices tienen Artes.');
  const spSpent = (d.hechizos || []).filter(x => String(x.n || '').trim()).reduce((s, x) => s + Math.max(0, numv(x.nivel)), 0);
  const overXp = Math.max(0, xpSpent - xpBudget), overSp = Math.max(0, spSpent - spBudget);
  const usedShared = overXp + overSp;
  const native = (d.hab || []).some(x => (x.cat || guessCat(x.n)) === 'Idiomas vivos' && numv(x.base) >= 75);
  if (cls !== 'otro') {
    if (usedShared > shared) {
      if (overXp && overSp) errors.push('Te pasas: ' + overXp + ' px y ' + overSp + ' niveles de hechizo' + (shared ? ' (lo que hay tras el Guantelete son ' + shared + ' puntos)' : '') + '.');
      else if (overXp) errors.push('La experiencia gastada (' + xpSpent + ' px) supera el presupuesto (' + xpBudget + (shared ? ' + ' + shared + ' tras el Guantelete' : '') + ').');
      else errors.push('Los hechizos suman ' + spSpent + ' niveles y el presupuesto es de ' + spBudget + (shared ? ' (+' + shared + ' tras el Guantelete)' : '') + '.');
    }
    if (!native && !(preset && !preset.nativa) && !hasD('feral')) avisos.push('Falta la lengua materna, a nivel 5 (sus 75 px ya están en el presupuesto).');
    lines.push({ k: 'px', l: 'Experiencia', s: 'PX', short: xpSpent + '/' + xpBudget, txt: xpSpent + ' de ' + xpBudget + ' px', st: overXp > shared ? 'over' : xpSpent < xpBudget ? 'under' : 'ok' });
    if (isMagic(cls)) lines.push({ k: 'hz', l: 'Hechizos', s: 'Hechizos', short: spSpent + '/' + spBudget, txt: spSpent + ' de ' + spBudget + ' niveles', st: usedShared > shared && overSp ? 'over' : spSpent < spBudget ? 'under' : 'ok' });
    if (shared) lines.push({ k: 'post', l: 'Tras el Guantelete', s: 'Post', short: usedShared + '/' + shared, txt: usedShared + ' de ' + shared + ' puntos (PX o niveles)', st: usedShared > shared ? 'over' : usedShared < shared ? 'under' : 'ok' });
    if (msBonus) lines.push({ k: 'ms', l: 'Maestría de hechizos', s: 'Maest.', short: Math.min(msXp, msBonus) + '/' + msBonus,
      txt: Math.min(msXp, msBonus) + ' de ' + msBonus + ' px' + (msXp > msBonus ? ' (y ' + (msXp - msBonus) + ' de la experiencia)' : ''), st: msXp < msBonus ? 'under' : 'ok' });
    // the extra experience of some virtues has to go to their Abilities
    const need = (on, have, amt, what) => { if (on && have < amt) avisos.push('Los ' + amt + ' px de ' + what + ' (' + have + ' gastados).'); };
    need(hasV('guerrero'), byCat['Marciales'] || 0, 50, 'Guerrero son para habilidades marciales');
    need(hasV('instruido'), latAL, 50, 'Instruido son para Latín y Artes Liberales');
    need(hasV('arcano'), byCat['Arcanas'] || 0, 50, 'Conocimiento arcano son para habilidades arcanas');
    need(hasV('magister'), (byCat['Académicas'] || 0) + (byCat['Lenguas muertas'] || 0) + teach, 240, 'Magister in Artibus son para habilidades académicas o Enseñanza');
  }
  // 4. limits on abilities (Affinity lets one pass the age cap by 2)
  const cap = abilityCap(age);
  const over = [];
  (d.hab || []).forEach(x => {
    if (!String(x.n || '').trim()) return;
    const on = fx.af.hab.has(tkey(x.n)), L = abLvl(afXp(numv(x.base), on));
    if (L > cap + (on ? 2 : 0)) over.push(x.n + ' ' + L);
  });
  if (over.length && cls !== 'otro') avisos.push('Con ' + (age == null ? '?' : age) + ' años, ninguna habilidad debería pasar de ' + cap + ' al crear el personaje (' + (cap + 2) + ' con Afinidad): ' + over.join(', ') + '.');
  const ax = accessOf(d);
  if (ax) {
    const used = {};
    (d.hab || []).forEach(x => { const c = grpOf(x.cat || guessCat(x.n)); if (numv(x.base) > 0 && G_RESTR.includes(c) && !ax.acc.has(c)) (used[c] = used[c] || []).push(x.n); });
    let gs = Object.keys(used).sort((a, b) => used[b].length - used[a].length);
    if (ax.custos) gs = gs.slice(1); // Custos opens one group, the player's choice
    gs.forEach(g => avisos.push(used[g].join(', ') + ': las habilidades ' + G_TXT[g] + ' necesitan una virtud que las permita (' + G_HOW[g] + (ax.custos ? '; Custos solo abre un grupo' : '') + ').'));
  }
  const sobre = (d.hab || []).filter(x => numv(x.base) > 0 && (x.cat || guessCat(x.n)) === 'Sobrenaturales');
  if (sobre.length && !V.some(x => catV(x) === 'sobrenatural')) avisos.push(sobre.map(x => x.n).join(', ') + ': las habilidades sobrenaturales necesitan su virtud sobrenatural.');
  // 5. each spell at most Technique + Form + Intelligence + Magic Theory + 3 (Arts as the sheet counts them, Puissant included)
  if (isMagic(cls)) {
    const intv = numv(d.car && d.car['Inteligencia']);
    const mtRow = (d.hab || []).find(x => tkey(x.n) === 'teoria-magica');
    const mt = (mtRow ? abLvl(afXp(numv(mtRow.base), fx.af.hab.has('teoria-magica'))) : 0) + (fx.mana.hab['teoria-magica'] || 0);
    const artV = a => artLvl(afXp(numv(d.artes && d.artes[a]), fx.af.art.has(a))) + (fx.mana.art[a] || 0);
    const big = [];
    (d.hechizos || []).forEach(s => {
      const t = artOf(s.tec), f = artOf(s.forma), lv = numv(s.nivel);
      if (!t || !f || !lv) return;
      const lab = artV(t) + artV(f) + intv + mt + 3;
      if (lv > lab) big.push('«' + s.n + '» (' + lv + ', máximo ' + lab + ')');
    });
    if (big.length) avisos.push('Hechizos por encima de Técnica + Forma + Inteligencia + Teoría Mágica + 3: ' + big.join(', ') + '.');
  }
  if (cls !== 'otro' && !(d.personalidad || []).some(t => String(t.n || '').trim())) avisos.push('Faltan los rasgos de personalidad: tres, con valores de −3 a +3.');
  return { cls, age, lines, errors, avisos, parts, xpBudget, xpSpent, spBudget, spSpent, shared, cBudget, cSpent, vdCap, pv, pd, cap, unknown, msXp, msBonus };
}

/* ---------- drop-down options */
const VALOR_ORD = ['Menor', 'Mayor', 'Gratuita', 'Especial'];
const VALOR_TXT = {
  virtud: { Mayor: 'mayores, cuestan 3', Menor: 'menores, cuestan 1', Gratuita: 'gratuitas', Especial: 'especiales' },
  defecto: { Mayor: 'mayores, dan 3', Menor: 'menores, dan 1', Gratuita: 'gratuitos', Especial: 'especiales' }
};
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
const optH = (v, l) => '<option value="' + esc(v) + '">' + esc(l == null ? v : l) + '</option>';
const grpH = (label, inner) => inner ? '<optgroup label="' + esc(label) + '">' + inner + '</optgroup>' : '';
const VD_OPTS = {};
/* every virtue (or flaw) of a type, grouped by value; without a type, all of them grouped by type and value */
function vdOptionsHtml(clase, tipo) {
  const key = clase + '|' + (tipo || '');
  if (VD_OPTS[key]) return VD_OPTS[key];
  const idx = vdIndex();
  const groups = new Map();
  idx.list.forEach(e => {
    if (e.clase !== clase || (tipo && e.cat !== tipo) || idx.canon.get(e.dk) !== e) return;
    const v = VALOR_ORD.includes(e.valor) ? e.valor : 'Especial';
    const gk = e.cat + '|' + v;
    if (!groups.has(gk)) groups.set(gk, { cat: e.cat, v: v, items: [] });
    groups.get(gk).items.push(e);
  });
  const catOrd = c => { const i = idx.cats[clase].indexOf(c); return i < 0 ? 99 : i; };
  let html = optH('', clase === 'virtud' ? '— Elige una virtud —' : '— Elige un defecto —');
  [...groups.values()].sort((a, b) => catOrd(a.cat) - catOrd(b.cat) || VALOR_ORD.indexOf(a.v) - VALOR_ORD.indexOf(b.v)).forEach(g => {
    g.items.sort((a, b) => a.n.localeCompare(b.n, 'es'));
    html += grpH(tipo ? capFirst(VALOR_TXT[clase][g.v]) : g.cat + ' · ' + VALOR_TXT[clase][g.v], g.items.map(e => optH(e.i, e.n + (e.core ? '' : ' · ' + bookAbbr(e)))).join(''));
  });
  html += optH('__otra', '✎ Otra, escrita a mano');
  VD_OPTS[key] = html;
  return html;
}
/* what a Maña, Afinidad or Característica Notable/Mediocre can apply to; abilities already on the sheet first */
function objOptionsHtml(kind, d) {
  if (kind === 'art') return optH('', '— Elige —') + grpH('Técnicas', ARTS_T.map(a => optH(a)).join('')) + grpH('Formas', ARTS_F.map(a => optH(a)).join(''));
  if (kind === 'car') return optH('', '— Elige —') + CHARS.map(c => optH(c)).join('');
  const mine = [], seen = new Set();
  (d.hab || []).forEach(x => { const n = String(x.n || '').trim(); if (n && !seen.has(tkey(n))) { seen.add(tkey(n)); mine.push(n); } });
  let html = optH('', '— Elige —') + grpH('En la ficha', mine.sort((a, b) => a.localeCompare(b, 'es')).map(n => optH(n)).join(''));
  Object.keys(ABIL_STD).forEach(c => { html += grpH(c, ABIL_STD[c].filter(n => !seen.has(tkey(n))).map(n => optH(n)).join('')); });
  return html;
}
function vdEffTxt(x, clase, f) {
  if (FX_TXT[f]) return FX_TXT[f];
  const acc = ACCESS[vdKeyOf(x, clase)];
  return acc ? 'Permite habilidades ' + acc.map(g => G_TXT[g]).join(', ').replace(/, ([^,]*)$/, ' y $1') + ' al crearlo.' : '';
}

/* ---------- editor */
let EDITOR = null; // {d, isNew} of the form on screen
function blankPj() {
  const car = {}; CHARS.forEach(n => { car[n] = 0; });
  const artes = {}; ARTS.forEach(a => { artes[a] = 0; });
  const [ca] = curSeason();
  const d = { nombre: '', sub: '', tipo: 'Magus', casa: '', jugador: '', nacimiento: ca - 25, activo: true, concepto: '', car: car, virtudes: [], defectos: [], hab: [], artes: artes,
    informidad: 0, confianza: 1, hechizos: [], notas: '', personalidad: [{ n: '', v: 0 }, { n: '', v: 0 }, { n: '', v: 0 }],
    creacion: { lengua: '', tierra: '', infancia: '', edadAprendizaje: 10, infAplicada: [], nativaAuto: false } };
  ensureGift(d);
  return d;
}
function loadDraft() {
  try { const o = JSON.parse(load(DRAFT_KEY) || 'null'); return o && typeof o === 'object' && !Array.isArray(o) && o.car ? o : null; } catch (e) { return null; }
}
function draftHasContent(d) {
  return !!(String(d.nombre || '').trim() || (d.hab || []).length || (d.defectos || []).some(x => String(x.n || '').trim()) || (d.virtudes || []).some(x => String(x.n || '').trim() && vdFx(x, 'virtud') !== 'don') || (d.hechizos || []).length || String(d.concepto || '').trim());
}
const cleanVd = l => (l || []).filter(x => x && String(x.n || '').trim()).map(x => { const o = Object.assign({}, x); delete o._otra; o.n = String(o.n).trim(); if (!String(o.obj || '').trim()) delete o.obj; return o; });
function viewEditor(id, override) {
  const orig = id ? S.pj[id] : null;
  page.innerHTML = '';
  page.appendChild(sagaCrumbs(orig ? [['Personajes', '#personajes'], [orig.nombre, '#pj--' + id], ['Editar', null]] : [['Personajes', '#personajes'], ['Nuevo personaje', null]]));
  if (id && !orig) { page.appendChild(h('h1', { class: 'doc-title', text: S.status === 'ready' || allSeen() ? 'Personaje no encontrado' : 'Cargando…' })); const n = statusNote(); if (n) page.appendChild(n); return; }
  if (!canWrite()) { page.appendChild(h('h1', { class: 'doc-title', text: orig ? orig.nombre : 'Nuevo personaje' })); page.appendChild(statusNote() || h('p', { class: 'note', text: 'No tienes permiso para guardar cambios.' })); return; }
  let restored = false;
  let d = override ? clone(override) : null;
  if (!d && !orig) { d = loadDraft(); restored = !!(d && draftHasContent(d)); if (!restored) d = null; }
  if (!d) d = orig ? clone(orig) : blankPj();
  ['virtudes', 'defectos', 'hab', 'hechizos', 'personalidad'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
  d.virtudes = d.virtudes.map(vdNormalize);
  // one row per ability (older forms allowed the same name twice): their px add up
  d.hab = d.hab.filter(x => x && typeof x === 'object').reduce((acc, x) => {
    const o = acc.find(y => String(x.n || '').trim() && tkey(y.n) === tkey(x.n));
    if (o) { o.base = numv(o.base) + numv(x.base); if (!o.esp && x.esp) o.esp = x.esp; } else acc.push(x);
    return acc;
  }, []);
  d.car = d.car || {}; d.artes = d.artes || {};
  d.creacion = Object.assign({ lengua: '', tierra: '', infancia: '', edadAprendizaje: 10, infAplicada: [], nativaAuto: false }, d.creacion || {});
  if (!Array.isArray(d.creacion.infAplicada)) d.creacion.infAplicada = [];
  const entries = id ? entriesOf(id) : [];
  const showRules = !orig || !entries.length;
  const now = calc(d, entries);
  now.hab.filter(x => x.implicit).forEach(x => d.hab.push({ n: x.n, cat: x.cat, esp: '', base: 0 }));
  // what the seasons added on top of the starting px (fixed while the form is open)
  const artExtra = {};
  ARTS.forEach(a => { artExtra[a] = now.arts[a] - afXp(numv(d.artes[a]), now.fx.af.art.has(a)); });
  EDITOR = { d: d, isNew: !orig };
  const [ca] = curSeason();
  page.appendChild(h('h1', { class: 'doc-title', text: orig ? 'Editar ' + orig.nombre : 'Nuevo personaje' }));
  page.appendChild(h('p', { class: 'doc-blurb', text: entries.length ? 'Los PX de este formulario son los iniciales, anteriores a las ' + entries.length + ' estaciones registradas; lo que se gane después se reparte en Estaciones. La columna «Actual» ya incluye esas estaciones.'
    : 'Rellena la ficha con las reglas de creación de Ars Magica: la página va comprobando los puntos mientras escribes. Lo que se gane después se reparte en cada estación.' }));
  if (restored) page.appendChild(h('p', { class: 'note draft-note' }, ['Se ha recuperado el personaje que dejaste a medias. ',
    h('button', { type: 'button', class: 'lnk', onclick: () => { store(DRAFT_KEY, null); viewEditor(null, blankPj()); } }, 'Empezar de cero')]));
  const f = h('form', { class: 'pj-form fx', id: 'pj-form', novalidate: true });
  f.addEventListener('submit', ev => ev.preventDefault());
  const meta = {};
  const sec = (t, kids, key) => { const m = key ? h('span', { class: 'sec-meta', id: 'sm-' + key }) : null; if (m) meta[key] = m; return h('section', { class: 'fs', id: key ? 'fs-' + key : null }, [h('h3', null, [document.createTextNode(t), m])].concat(kids)); };
  // datos
  const casaDl = datalist('dl-casas', CASAS);
  let artSec = null, eaField = null;
  const ageNote = h('span', { class: 'fh' });
  const drawAge = () => { const a = ageOf(d); ageNote.textContent = a != null ? a + ' años en ' + ca : ''; };
  drawAge();
  f.appendChild(sec('Datos', [h('div', { class: 'fgrid' }, [
    field('Nombre', inp(d.nombre, v => { d.nombre = v; }, { required: true, placeholder: 'Nombre ex Casa', id: 'pj-nombre', autocomplete: 'off' }), null, 'w2'),
    field('Epíteto o apodo', inp(d.sub, v => { d.sub = v; }, { placeholder: 'fili de…' })),
    field('Tipo', sel(TIPOS, d.tipo, v => { d.tipo = v; ensureGift(d); drawVd(); if (artSec) artSec.hidden = !showArts(); if (eaField) eaField.hidden = !isMagic(CLASE[d.tipo]); }, { id: 'pj-tipo' })),
    field('Casa', inp(d.casa, v => { d.casa = v; }, { list: casaDl, autocomplete: 'off' })),
    field('Jugador', inp(d.jugador, v => { d.jugador = v; })),
    h('label', { class: 'fld' }, [h('span', { class: 'fl', text: 'Año de nacimiento' }), inp(d.nacimiento, v => { d.nacimiento = parseInt(v, 10) || ''; drawAge(); }, { type: 'number', inputmode: 'numeric', id: 'pj-nac' }), ageNote]),
    field('En juego', h('span', { class: 'chk' }, [h('input', { type: 'checkbox', checked: d.activo !== false ? true : null, onchange: ev => { d.activo = ev.target.checked; } }), h('span', { text: 'Activo en la saga' })])),
    field('Concepto', h('textarea', { rows: 2, oninput: ev => { d.concepto = ev.target.value; } }, d.concepto || ''), null, 'w3')])]));
  // creation rules
  const panel = h('div', { class: 'cc-panel', id: 'cc-panel' });
  if (showRules) {
    const cr = d.creacion;
    const presets = PRESETS();
    const lenIn = inp(cr.lengua, () => {}, { placeholder: 'Aragonés, occitano, vasco…', id: 'cr-lengua' });
    lenIn.addEventListener('change', () => { renameSlot(d, 'lengua', cr.lengua, lenIn.value.trim()); cr.lengua = lenIn.value.trim(); drawHab(); });
    const tieIn = inp(cr.tierra, () => {}, { placeholder: 'Sobrarbe, Ribagorza, Jaca…', id: 'cr-tierra' });
    tieIn.addEventListener('change', () => { renameSlot(d, 'tierra', cr.tierra, tieIn.value.trim()); cr.tierra = tieIn.value.trim(); drawHab(); });
    const preSel = sel([['', '— Ninguno —']].concat(presets.map(p => [p.n, p.n + ' · ' + p.resumen])), cr.infancia, v => { applyPreset(d, v); drawHab(); }, { id: 'cr-infancia' });
    eaField = field('Edad al empezar el aprendizaje', inp(cr.edadAprendizaje, v => { cr.edadAprendizaje = parseInt(v, 10) || 10; }, { type: 'number', min: '5', max: '30', inputmode: 'numeric', id: 'cr-ea' }), 'Magos y aprendices; el aprendizaje dura 15 años.');
    eaField.hidden = !isMagic(CLASE[d.tipo]);
    f.appendChild(sec('Creación', [
      h('div', { class: 'fgrid' }, [field('Lengua materna', lenIn, 'Se empieza con ella a 5; sus 75 px van aparte.'), field('Tierra natal', tieIn, 'Su conocimiento de área.'),
        field('Paquete de infancia', preSel, 'Los de tu Excel de creación: reparten la infancia (y la lengua materna).', 'w2'), eaField]),
      panel], 'cr'));
  }
  // portrait
  const prev = h('div', { class: 'ret-prev' });
  const drawPrev = () => { prev.innerHTML = ''; prev.appendChild(monogram(d, 'pj-portrait')); };
  drawPrev();
  const retKids = [prev];
  if (S.assets) {
    const fi = h('input', { type: 'file', accept: 'image/*', id: 'pj-retrato' });
    const rm = h('button', { type: 'button', class: 'lnk', hidden: !(d.retrato || d.retratoStatic), onclick: () => { delete d.retrato; delete d.retratoStatic; delete d._retUrl; rm.hidden = true; drawPrev(); refresh(); } }, 'Quitar retrato');
    fi.addEventListener('change', async () => {
      const file = fi.files && fi.files[0];
      if (!file) return;
      toast('Subiendo el retrato…');
      const small = await shrinkImage(file, 720);
      const up = () => small ? S.assets.upload(small, { type: 'image/jpeg' }) : S.assets.upload(file);
      try {
        let r;
        try { r = await up(); } catch (e) { if (e && e.code === 'store_unavailable') r = await up(); else throw e; }
        d.retrato = { id: r.id }; d._retUrl = r.url; delete d.retratoStatic; rm.hidden = false; drawPrev(); refresh();
        toast('Retrato subido. Guarda la ficha para conservarlo.');
      } catch (e) { toast(e && (e.code === 'unsupported_type' || e.code === 'invalid_request') ? 'Ese formato de imagen no se admite; prueba con JPG o PNG.' : 'No se ha podido subir la imagen.'); }
      fi.value = '';
    });
    retKids.push(h('div', { class: 'ret-ctl' }, [field('Subir retrato', fi, 'JPG o PNG; se reduce y se guarda con la página.'), rm]));
  } else retKids.push(h('p', { class: 'fh', text: 'Solo quien puede editar la página sube retratos.' }));
  f.appendChild(sec('Retrato', [h('div', { class: 'ret-row' }, retKids)]));
  // characteristics (the value shown is the final one; Característica Notable/Mediocre move it by one and are not paid)
  const carIns = {}, carHints = {};
  const drawCarHints = () => {
    const adj = vdEffects(d).car;
    CHARS.forEach(n => { const a = adj[n] || 0; carHints[n].textContent = a ? (a > 0 ? 'Notable' : 'Mediocre') + ' ' + sgn(a) + ' · cuesta como ' + sgn(numv(d.car[n]) - a) : ''; });
  };
  f.appendChild(sec('Características', [
    showRules ? h('p', { class: 'fh', text: '7 puntos: +1 cuesta 1, +2 cuesta 3 y +3 cuesta 6; −1 da 1 punto, −2 da 3 y −3 da 6. Característica Notable y Mediocre suben o bajan un punto más sin coste.' }) : null,
    h('div', { class: 'fgrid chars-in' }, CHARS.map(n => {
      carIns[n] = inp(d.car[n] != null ? d.car[n] : 0, v => { d.car[n] = parseInt(v, 10) || 0; drawCarHints(); }, { type: 'number', min: '-6', max: '6', inputmode: 'numeric', 'data-car': n });
      carHints[n] = h('span', { class: 'fh car-adj' });
      return h('label', { class: 'fld' }, [h('span', { class: 'fl', text: n }), carIns[n], carHints[n]]);
    }))], 'car'));
  drawCarHints();
  // personality
  const persBox = h('div', { class: 'rowlist' });
  const drawPers = focusLast => {
    persBox.innerHTML = '';
    d.personalidad.forEach((t, i) => {
      const nameIn = inp(t.n, v => { t.n = v; }, { 'aria-label': 'Rasgo', placeholder: i === 0 ? 'Valiente, leal, curiosa…' : 'Rasgo' });
      persBox.appendChild(h('div', { class: 'lrow pers' }, [cell('Rasgo', nameIn),
        cell('Valor', sel([3, 2, 1, 0, -1, -2, -3].map(v => [v, sgn(v)]), t.v || 0, v => { t.v = Number(v); }, { 'aria-label': 'Valor del rasgo' })),
        h('button', { type: 'button', class: 'x', 'aria-label': 'Quitar rasgo', onclick: () => { d.personalidad.splice(i, 1); drawPers(); refresh(); } }, '×')]));
      if (focusLast && i === d.personalidad.length - 1) setTimeout(() => nameIn.focus(), 0);
    });
    if (d.personalidad.length < 6) persBox.appendChild(h('button', { type: 'button', class: 'lnk', onclick: () => { d.personalidad.push({ n: '', v: 0 }); drawPers(true); } }, '+ Añadir rasgo'));
  };
  drawPers();
  f.appendChild(sec('Personalidad', [h('p', { class: 'fh', text: 'Tres rasgos que lo definan, de −3 a +3.' }), persBox]));
  // virtues & flaws: drop-downs from the compendium that fill the row and apply what the page knows of them
  const vdBox = h('div', { class: 'vd-cols' });
  /* keep the characteristics in step with Característica Notable/Mediocre */
  function vdCarSync(before) {
    const after = vdEffects(d).car;
    CHARS.forEach(n => { const dl = (after[n] || 0) - (before[n] || 0); if (dl) { d.car[n] = numv(d.car[n]) + dl; carIns[n].value = String(d.car[n]); } });
    drawCarHints();
  }
  function vdMutate(fn) { const before = vdEffects(d).car; fn(); vdCarSync(before); }
  function afterVd(focus) { drawVd(focus); drawHab(); drawArts(); }
  function vdRow(k, clase, x, i, focus) {
    const idx = vdIndex();
    const fxk = vdFx(x, clase), kind = FX_OBJ[fxk];
    const locked = clase === 'virtud' && fxk === 'don' && isMagic(CLASE[d.tipo]);
    const named = !!String(x.n || '').trim();
    const e = named ? vdEntry(x, clase) : null;
    const canon = e ? (idx.canon.get(e.dk) || e) : null;
    const manual = !canon && (named || !!x._otra);
    const auto = canon ? vdNota(canon) : '';
    const tipo = canon ? canon.cat : (x.cat || '');
    const pts = h('span', { class: 'vd-pts', title: 'Puntos' });
    const drawPts = () => { const v = valorOf(x, clase); pts.textContent = v === 'Mayor' ? '3' : v === 'Menor' ? '1' : v ? '0' : '·'; };
    drawPts();
    // type: narrows the list of names
    const tipoSel = h('select', { 'aria-label': 'Tipo', disabled: locked ? true : null }, [h('option', { value: '' }, 'Todos los tipos')].concat(idx.cats[clase].map(c => h('option', { value: c }, c))));
    if (tipo && !idx.cats[clase].includes(tipo)) tipoSel.appendChild(h('option', { value: tipo }, tipo));
    tipoSel.value = tipo;
    tipoSel.addEventListener('change', () => {
      const t = tipoSel.value;
      if (canon && !t) { nameSel.innerHTML = vdOptionsHtml(clase, ''); nameSel.value = String(canon.i); return; } // just widen the list
      if (canon && canon.cat !== t) vdMutate(() => { x.n = ''; delete x.en; delete x.obj; delete x._otra; x.valor = ''; if (x.nota === auto) x.nota = ''; x.cat = t; });
      else x.cat = t;
      afterVd({ k: k, i: i, el: 'name' });
    });
    // name: the compendium's entries, or one typed by hand
    const nameSel = h('select', { 'aria-label': 'Nombre', disabled: locked ? true : null });
    nameSel.innerHTML = vdOptionsHtml(clase, tipo);
    nameSel.value = canon ? String(canon.i) : manual ? '__otra' : '';
    if (canon && nameSel.value !== String(canon.i)) { nameSel.innerHTML = vdOptionsHtml(clase, ''); nameSel.value = String(canon.i); }
    nameSel.addEventListener('change', () => {
      const v = nameSel.value;
      let need = false;
      vdMutate(() => {
        delete x._otra;
        if (v === '__otra') { x.n = ''; delete x.en; delete x.obj; x._otra = true; x.valor = x.valor || 'Menor'; if (x.nota === auto) x.nota = ''; }
        else if (!v) { x.n = ''; delete x.en; delete x.obj; x.valor = ''; if (x.nota === auto) x.nota = ''; }
        else {
          const ne = idx.list[Number(v)];
          Object.assign(x, { n: ne.n, en: ne.en, cat: ne.cat, valor: ne.valor });
          if (!x.nota || x.nota === auto) x.nota = vdNota(ne);
          const nk = FX_OBJ[vdFx(x, clase)];
          if (nk !== kind) delete x.obj;
          need = !!nk && !x.obj;
        }
      });
      afterVd({ k: k, i: i, el: v === '__otra' ? 'other' : need ? 'obj' : 'name' });
    });
    let before = null;
    const other = inp(manual ? x.n : '', v => { x.n = v; delete x.en; drawPts(); }, { 'aria-label': 'Nombre escrito a mano', placeholder: 'Escribe el nombre', class: 'vd-other', autocomplete: 'off' });
    other.hidden = !manual;
    other.addEventListener('focus', () => { before = vdEffects(d).car; });
    other.addEventListener('change', () => {
      // a name typed by hand that is in the compendium becomes that entry
      const e2 = vdEntry(x, clase);
      if (e2) { x.en = e2.en; x.cat = e2.cat; if (!x.valor) x.valor = e2.valor; delete x._otra; }
      if (before) vdCarSync(before);
      before = null;
      if (e2 || vdFx(x, clase)) afterVd({ k: k, i: i, el: 'name' }); else { drawHab(); drawArts(); }
    });
    // what it applies to (Maña, Afinidad, Característica Notable/Mediocre)
    let objCell;
    if (kind) {
      const objSel = h('select', { 'aria-label': 'Se aplica a', class: vdTarget(x, fxk) ? null : 'need' });
      objSel.innerHTML = objOptionsHtml(kind, d);
      const cur = vdTarget(x, fxk);
      if (cur && ![...objSel.options].some(o => o.value === cur)) objSel.appendChild(h('option', { value: cur }, cur));
      objSel.value = cur || '';
      objSel.addEventListener('change', () => {
        vdMutate(() => { x.obj = objSel.value; });
        objSel.classList.toggle('need', !objSel.value);
        if (kind === 'hab' && x.obj && !d.hab.some(y => tkey(y.n) === tkey(x.obj))) d.hab.push({ n: x.obj, cat: guessCat(x.obj), esp: '', base: 0 });
        drawHab(); drawArts(); refresh();
      });
      objCell = h('label', { class: 'cell vd-o', 'data-l': 'Se aplica a' }, objSel);
      if (focus && focus.el === 'obj') setTimeout(() => objSel.focus(), 0);
    } else objCell = h('span', { class: 'cell vd-o none', 'aria-hidden': 'true' });
    // value: the compendium's, or another (a House's free virtue); the same name may exist as major and minor
    const valSel = sel([['', '—'], ['Mayor', 'Mayor (3)'], ['Menor', 'Menor (1)'], ['Gratuita', 'Gratuita'], ['Especial', 'Especial']], x.valor || '', v => {
      const alt = canon ? vdFind(canon.en || canon.n, clase, v) : null;
      const altC = alt && alt.valor === v ? (idx.canon.get(alt.dk) || alt) : null;
      if (altC && altC !== canon) {
        vdMutate(() => { Object.assign(x, { n: altC.n, en: altC.en, cat: altC.cat, valor: v }); if (!x.nota || x.nota === auto) x.nota = vdNota(altC); });
        afterVd({ k: k, i: i, el: 'valor' });
      } else { x.valor = v; drawPts(); refresh(); }
    }, { 'aria-label': 'Valor', disabled: locked ? true : null });
    const notaIn = inp(x.nota, v => { x.nota = v; }, { 'aria-label': 'Nota', placeholder: 'Nota o página' });
    const eff = named ? vdEffTxt(x, clase, fxk) : '';
    const full = canon && canon.desc ? canon.desc : '';
    const desc = full.length > 220 ? full.slice(0, 218) + '…' : full;
    const row = h('div', { class: 'lrow vd' + (locked ? ' locked' : '') + (kind ? '' : ' noobj') }, [
      h('label', { class: 'cell vd-t', 'data-l': 'Tipo' }, tipoSel),
      h('div', { class: 'cell vd-n', 'data-l': clase === 'virtud' ? 'Virtud' : 'Defecto' }, [nameSel, other]),
      objCell,
      h('label', { class: 'cell vd-v', 'data-l': 'Valor' }, valSel),
      h('label', { class: 'cell vd-nota', 'data-l': 'Nota' }, notaIn),
      pts,
      locked ? h('span', { class: 'lock', title: 'Obligatorio para los magos', text: 'oblig.' }) : h('button', { type: 'button', class: 'x', 'aria-label': 'Quitar ' + (vdLabel(x) || 'fila'), onclick: () => { vdMutate(() => { d[k].splice(i, 1); }); afterVd(); } }, '×'),
      desc || eff ? h('p', { class: 'vd-desc', title: full.length > 220 ? full : null }, [desc ? document.createTextNode(desc + (eff ? ' ' : '')) : null, eff ? h('b', { text: eff }) : null]) : null]);
    if (focus && focus.el !== 'obj') setTimeout(() => { const t = focus.el === 'other' ? other : focus.el === 'valor' ? valSel : nameSel; if (t && !t.disabled) t.focus(); }, 0);
    return row;
  }
  function drawVd(focus) {
    vdBox.innerHTML = '';
    [['virtudes', 'Virtudes', 'virtud'], ['defectos', 'Defectos', 'defecto']].forEach(([k, t, clase]) => {
      const n = d[k].filter(x => String(x.n || '').trim()).length;
      const list = h('div', { class: 'rowlist' }, [h('h4', { text: t + (n ? ' · ' + n : '') })]);
      if (d[k].length) list.appendChild(h('div', { class: 'lrow vd head', 'aria-hidden': 'true' }, ['Tipo', clase === 'virtud' ? 'Virtud' : 'Defecto', 'Se aplica a', 'Valor', 'Nota', 'Pts.', ''].map(s => h('span', { text: s }))));
      d[k].forEach((x, i) => list.appendChild(vdRow(k, clase, x, i, focus && focus.k === k && focus.i === i ? focus : null)));
      list.appendChild(h('button', { type: 'button', class: 'lnk', onclick: () => { d[k].push({ n: '', cat: '', valor: '', nota: '' }); drawVd({ k: k, i: d[k].length - 1, el: 'name' }); } }, clase === 'virtud' ? '+ Añadir virtud' : '+ Añadir defecto'));
      vdBox.appendChild(list);
    });
    refresh();
  }
  const picker = vdPicker((item, kind) => {
    const clase = kind === 'virtudes' ? 'virtud' : 'defecto';
    const objKind = FX_OBJ[vdFx(item, clase)];
    if (!objKind && d[kind].some(x => tkey(x.n) === tkey(item.n))) { toast(item.n + ' ya está en la ficha.'); return; }
    vdMutate(() => { d[kind].push(item); });
    afterVd(objKind ? { k: kind, i: d[kind].length - 1, el: 'obj' } : null);
    toast('Añadida a ' + kind + ': ' + item.n + (objKind ? '. Elige a qué se aplica.' : ''));
  });
  f.appendChild(sec('Virtudes y defectos', [h('p', { class: 'fh', text: (showRules ? 'Se empieza con 0 puntos: cada defecto mayor da 3 y cada menor 1; cada virtud mayor cuesta 3 y cada menor 1. Magos y compañeros, hasta 10 puntos de defectos; grogs, hasta 3. El Don es gratuito y obligatorio para los magos. ' : '') +
    'Elige el tipo y la virtud o el defecto en los desplegables, o búscalo por nombre: se rellenan el valor y la página, y las Mañas, Afinidades, Características Notables y los estatus o virtudes que dan experiencia se aplican solos a la ficha.' }),
    picker, vdBox], 'vd'));
  // abilities: every standard Ability plus this character's own, in balanced columns. Only the px are typed;
  // the level and the px missing for the next one follow (Affinity: the px count ×1.5; Puissant: +2 on the level)
  const habGrid = h('div', { class: 'hab-grid', id: 'hab-grid', lang: 'es' });
  const espBox = h('div', { class: 'hab-esp' });
  const abDl = datalist('dl-hab', Object.values(ABIL_STD).flat().concat(...Object.values(S.pj).map(p => (p.hab || []).map(x => x.n))));
  const rowOf = n => d.hab.find(x => tkey(x.n) === tkey(n));
  const seasonXp = n => { const live = now.hab.find(y => tkey(y.n) === tkey(n)); return live ? live.xp - live.base : 0; };
  /* the abilities on screen, by category: the standard list always, then the character's own (languages, lores, crafts…) */
  function habList() {
    const groups = new Map(ABIL_CATS.map(c => [c, []]));
    const seen = new Set();
    Object.keys(ABIL_STD).forEach(c => ABIL_STD[c].forEach(n => { seen.add(tkey(n)); groups.get(c).push({ n: n, std: true }); }));
    const own = [];
    d.hab.forEach(x => {
      const n = String(x.n || '').trim(), k = tkey(n);
      if (!n || seen.has(k)) return;
      seen.add(k);
      own.push({ n: n, std: false, cat: ABIL_CATS.includes(x.cat) ? x.cat : guessCat(n) });
    });
    own.sort((a, b) => a.n.localeCompare(b.n, 'es')).forEach(a => groups.get(a.cat).push(a));
    return groups;
  }
  function habCell(a, F, cap, cat) {
    const k = tkey(a.n), extra = seasonXp(a.n);
    const on = F.af.hab.has(k), b = F.mana.hab[k] || 0;
    const r0 = rowOf(a.n);
    const lv = h('output', { class: 'hg-lv', 'aria-label': 'Nivel de ' + a.n });
    const fa = h('output', { class: 'hg-fa', 'aria-label': 'PX que faltan para el siguiente nivel de ' + a.n });
    const px = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', class: 'hg-px', placeholder: '0', 'aria-label': 'PX de ' + a.n, value: r0 && numv(r0.base) ? String(numv(r0.base)) : '' });
    const row = h('div', { class: 'hg-row', 'data-k': k });
    const upd = () => {
      const r = rowOf(a.n), paid = r ? Math.max(0, numv(r.base)) : 0;
      const eff = afXp(paid, on) + extra, L = abLvl(eff), next = abCost(L + 1);
      // what is still to be typed in this box for the next level (with Affinity, in px before the ×1.5)
      const need = on ? Math.max(1, Math.ceil((next - extra - 0.5) / 1.5) - paid) : next - eff;
      lv.textContent = String(L + b);
      fa.textContent = fmt(need);
      lv.title = (b ? L + ' + ' + b + ' de Maña · ' : '') + fmt(eff) + ' px' + (on && paid ? ' (' + fmt(paid) + ' × 1,5' + (extra ? ' + ' + fmt(extra) + ' de estaciones' : '') + ')' : extra ? ' (' + fmt(paid) + ' iniciales + ' + fmt(extra) + ' de estaciones)' : '');
      fa.title = 'Faltan ' + fmt(need) + ' px para el nivel ' + (L + 1);
      const over = showRules && L > cap + (on ? 2 : 0);
      lv.classList.toggle('over', over);
      if (over) lv.title += ' · pasa del límite por edad (' + (cap + (on ? 2 : 0)) + ')';
      row.classList.toggle('zero', !eff && !b);
    };
    px.addEventListener('input', () => {
      const v = Math.max(0, numv(px.value));
      let r = rowOf(a.n);
      if (!r && v) { r = { n: a.n, cat: a.std ? (CAT_OF[k] || guessCat(a.n)) : cat, esp: '', base: 0 }; d.hab.push(r); }
      if (r) r.base = v;
      upd();
    });
    px.addEventListener('change', drawEsp);
    upd();
    const tags = [on ? h('small', { class: 'vtag', text: '×1,5', title: 'Afinidad: los px de ' + a.n + ' cuentan ×1,5' }) : null, b ? h('small', { class: 'vtag', text: '+' + b, title: 'Maña con ' + a.n + ': +' + b + ' al nivel' }) : null];
    const rm = !a.std && !extra ? h('button', { type: 'button', class: 'hg-x', title: 'Quitar', 'aria-label': 'Quitar ' + a.n, onclick: () => { d.hab = d.hab.filter(x => tkey(x.n) !== k); drawHab(); } }, '×') : null;
    row.appendChild(h('span', { class: 'hg-n' }, [h('span', { class: 'hg-nt', text: a.n })].concat(tags, [rm])));
    row.appendChild(lv); row.appendChild(fa); row.appendChild(px);
    return row;
  }
  function drawHab(focusKey) {
    const F = vdEffects(d), cap = abilityCap(ageOf(d)), ax = accessOf(d);
    const sup = (d.virtudes || []).some(x => x && String(x.n || '').trim() && norm(catOf(x, 'virtud')) === 'sobrenatural');
    habGrid.innerHTML = '';
    habList().forEach((list, cat) => {
      if (!list.length) return;
      const g = grpOf(cat);
      const warn = cat === 'Sobrenaturales' ? (!sup ? 'necesita su virtud' : '') : ax && !ax.custos && G_RESTR.includes(g) && !ax.acc.has(g) ? 'necesita virtud' : '';
      habGrid.appendChild(h('div', { class: 'hg-h' }, [h('span', { class: 'hg-t', text: cat }), h('i', { text: 'Nivel' }), h('i', { text: 'Faltan' }), h('i', { text: 'PX' }),
        warn ? h('small', { class: 'vtag warn hg-warn', text: warn, title: cat === 'Sobrenaturales' ? 'Cada habilidad sobrenatural necesita su virtud.' : 'Para ' + CLASE_TXT[ax.cls] + ', las habilidades ' + G_TXT[g] + ' necesitan una virtud: ' + G_HOW[g] + '.' }) : null]));
      list.forEach(a => habGrid.appendChild(habCell(a, F, cap, cat)));
    });
    drawEsp();
    if (focusKey) { const t = habGrid.querySelector('.hg-row[data-k="' + focusKey + '"] .hg-px'); if (t) setTimeout(() => t.focus(), 0); }
    refresh();
  }
  /* specialties, for the abilities that have px */
  function drawEsp() {
    espBox.innerHTML = '';
    const list = [];
    habList().forEach(l => l.forEach(a => { const r = rowOf(a.n); if ((r && (numv(r.base) > 0 || String(r.esp || '').trim())) || seasonXp(a.n) > 0) list.push(a); }));
    if (!list.length) return;
    espBox.appendChild(h('h4', { text: 'Especialidades' }));
    espBox.appendChild(h('div', { class: 'esp-grid' }, list.map(a => {
      const ip = inp((rowOf(a.n) || {}).esp, v => { let r = rowOf(a.n); if (!r) { r = { n: a.n, cat: CAT_OF[tkey(a.n)] || guessCat(a.n), esp: '', base: 0 }; d.hab.push(r); } r.esp = v; }, { placeholder: 'Especialidad', 'aria-label': 'Especialidad de ' + a.n });
      return h('label', { class: 'esp-row' }, [h('span', { text: a.n }), ip]);
    })));
  }
  // add an ability of one's own: a language, a homeland, a craft…
  const addName = h('input', { type: 'text', list: abDl, id: 'hab-new', placeholder: 'Idioma, tierra, oficio…', 'aria-label': 'Nueva habilidad', autocomplete: 'off' });
  const addCat = sel(ABIL_CATS, 'Idiomas vivos', () => {}, { id: 'hab-new-cat', 'aria-label': 'Categoría de la nueva habilidad' });
  addName.addEventListener('input', () => { const g = guessCat(addName.value); if (g !== 'Otras') addCat.value = g; });
  const doAdd = () => {
    const n = addName.value.trim();
    if (!n) { addName.focus(); return; }
    const k = tkey(n);
    if (!rowOf(n) && !CAT_OF[k]) d.hab.push({ n: n, cat: addCat.value, esp: '', base: 0 });
    addName.value = '';
    drawHab(k);
  };
  addName.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); doAdd(); } });
  const addRow = h('div', { class: 'hab-add' }, [addName, addCat, h('button', { type: 'button', class: 'btn ghost', id: 'hab-add', onclick: doAdd }, 'Añadir habilidad')]);
  f.appendChild(sec('Habilidades', [h('p', { class: 'fh', text: 'Escribe los PX de cada habilidad: el nivel y lo que falta para el siguiente salen solos (nivel L = 5·L·(L+1)/2 px: 1 = 5, 2 = 15, 3 = 30, 4 = 50, 5 = 75). Con Afinidad los PX cuentan ×1,5 y la Maña suma +2 al nivel.' + (entries.length ? ' Con estaciones registradas, el nivel incluye lo ganado en ellas.' : '') }),
    habGrid, addRow, espBox], 'hab'));
  // arts
  const showArts = () => isMagic(CLASE[d.tipo]) || ARTS.some(a => numv(d.artes[a]) > 0 || now.arts[a] > 0);
  const artBox = h('div', { class: 'arts-in' });
  function drawArts() {
    const F = vdEffects(d);
    artBox.innerHTML = '';
    [['Técnicas', ARTS_T], ['Formas', ARTS_F]].forEach(([t, list]) => {
      const g = h('div', { class: 'ag' }, [h('h4', { text: t }), h('div', { class: 'arow head', 'aria-hidden': 'true' }, [h('span'), h('span', { text: 'Nivel' }), h('span', { text: 'PX ini.' }), h('span', { text: 'Actual' })])]);
      list.forEach(a => {
        const on = F.af.art.has(a), b = F.mana.art[a] || 0;
        const act = h('span', { class: 'act-lv' + (b ? ' boost' : '') });
        const lv = h('input', { type: 'number', min: '0', max: '60', inputmode: 'numeric', value: String(artLvl(afXp(numv(d.artes[a]), on))), 'aria-label': 'Nivel inicial de ' + a });
        const px = h('input', { type: 'number', min: '0', inputmode: 'numeric', value: String(numv(d.artes[a])), 'aria-label': 'PX iniciales de ' + a });
        const updAct = () => { const eff = afXp(numv(d.artes[a]), on), L = artLvl(eff + artExtra[a]); act.textContent = String(L + b); act.title = fmt(eff + artExtra[a]) + ' px' + (artExtra[a] ? ' con las estaciones' : '') + (b ? ' · ' + L + ' + ' + b + ' de Maña' : ''); };
        lv.addEventListener('input', () => { const L = Math.max(0, parseInt(lv.value, 10) || 0); d.artes[a] = on ? Math.max(0, Math.ceil((artCost(L) - 0.5) / 1.5)) : artCost(L); px.value = String(d.artes[a]); updAct(); });
        px.addEventListener('input', () => { d.artes[a] = Math.max(0, numv(px.value)); lv.value = String(artLvl(afXp(d.artes[a], on))); updAct(); });
        updAct();
        const tg = [on ? h('small', { class: 'vtag', text: '×1,5', title: 'Afinidad: los px cuentan ×1,5' }) : null, b ? h('small', { class: 'vtag', text: '+' + b, title: 'Maña con ' + a }) : null];
        g.appendChild(h('div', { class: 'arow', style: '--a:' + artVar(a) }, [h('span', { class: 'an' }, [document.createTextNode(a)].concat(tg)), lv, px, act]));
      });
      artBox.appendChild(g);
    });
  }
  artSec = sec('Artes', [h('p', { class: 'fh', text: 'Nivel y PX iniciales: el nivel L de un Arte cuesta L·(L+1)/2 px (5 = 15, 10 = 55, 15 = 120). Con Afinidad los PX cuentan ×1,5 y la Maña suma +3 en «Actual».' }), artBox], 'art');
  artSec.hidden = !showArts();
  f.appendChild(artSec);
  // spells
  const spBox = h('div', { class: 'rowlist' });
  const dlAlc = datalist('dl-alc', ['Personal', 'Toque', 'Ojo', 'Voz', 'Vista', 'Conexión Arcana']);
  const dlDur = datalist('dl-dur', ['Momentáneo', 'Concentración', 'Diámetro', 'Sol', 'Anillo', 'Luna', 'Año']);
  const dlObj = datalist('dl-obj', ['Individuo', 'Círculo', 'Parte', 'Grupo', 'Habitación', 'Estructura', 'Límite']);
  const dlHech = hechCat().list.length ? datalist('dl-hech', hechCat().list.map(x => x.n)) : null;
  /* a name picked from the catalogue fills in what the row is missing */
  function fromCat(x, name) {
    const e = (hechCat().byKey.get(tkey(name)) || [])[0];
    if (!e) return false;
    x.cat = e.id;
    if (!x.tec) x.tec = e.tec;
    if (!x.forma) x.forma = e.forma;
    if ((x.nivel == null || x.nivel === '') && String(e.nivel) !== 'Gen') x.nivel = e.nivel;
    ['alc', 'dur', 'obj'].forEach(k => { if (!x[k]) x[k] = e[k] || ''; });
    if (e.rit && !isRitual(x)) x.ritual = true;
    return true;
  }
  function drawSp(focusLast) {
    spBox.innerHTML = '';
    if (d.hechizos.length) spBox.appendChild(h('div', { class: 'lrow sp head', 'aria-hidden': 'true' }, ['Hechizo', 'Técnica', 'Forma', 'Nivel', 'Maestría', 'Alcance', 'Duración', 'Objetivo', 'Notas', ''].map(t => h('span', { text: t }))));
    d.hechizos.forEach((x, i) => {
      const nameIn = inp(x.n, v => { x.n = v; if (x.cat && x.cat !== '-') delete x.cat; }, { 'aria-label': 'Hechizo', placeholder: dlHech ? 'Nombre (o elige del catálogo)' : 'Nombre del hechizo', list: dlHech });
      nameIn.addEventListener('change', () => { if (fromCat(x, nameIn.value)) drawSp(); });
      spBox.appendChild(h('div', { class: 'lrow sp' }, [
        cell('Hechizo', nameIn),
        cell('Técnica', sel([['', '—']].concat(ARTS_T), x.tec, v => { x.tec = v; }, { 'aria-label': 'Técnica' })),
        cell('Forma', sel([['', '—']].concat(ARTS_F), x.forma, v => { x.forma = v; }, { 'aria-label': 'Forma' })),
        cell('Nivel', inp(x.nivel, v => { x.nivel = v; }, { type: 'number', inputmode: 'numeric', 'aria-label': 'Nivel' })),
        cell('Maestría', inp(x.maestria || '', v => { x.maestria = v; }, { type: 'number', min: '0', max: '10', inputmode: 'numeric', 'aria-label': 'Maestría', placeholder: '0' })),
        cell('Alcance', inp(x.alc, v => { x.alc = v; }, { 'aria-label': 'Alcance', list: dlAlc })),
        cell('Duración', inp(x.dur, v => { x.dur = v; }, { 'aria-label': 'Duración', list: dlDur })),
        cell('Objetivo', inp(x.obj, v => { x.obj = v; }, { 'aria-label': 'Objetivo', list: dlObj })),
        cell('Notas', inp(x.nota, v => { x.nota = v; }, { 'aria-label': 'Notas' })),
        h('button', { type: 'button', class: 'x', 'aria-label': 'Quitar ' + (x.n || 'hechizo'), onclick: () => { d.hechizos.splice(i, 1); drawSp(); } }, '×')]));
      const catE = spellCat(x);
      const ta = h('textarea', { rows: '3', 'aria-label': 'Descripción de ' + (x.n || 'el hechizo'), placeholder: catE ? 'Se muestra la del manual; escribe aquí solo si en vuestra saga funciona distinto.' : 'Qué hace el hechizo: hace falta si es inventado o de un libro que no está en el catálogo.' });
      ta.value = x.desc || '';
      ta.addEventListener('input', () => { x.desc = ta.value; });
      spBox.appendChild(h('details', { class: 'sp-desc', open: String(x.desc || '').trim() ? true : null }, [
        h('summary', { text: String(x.desc || '').trim() ? 'Descripción propia' : catE ? 'Descripción: la del manual, «' + catE.n + '»' : 'Añadir una descripción' }), ta]));
      if (focusLast && i === d.hechizos.length - 1) setTimeout(() => nameIn.focus(), 0);
    });
    spBox.appendChild(h('button', { type: 'button', class: 'lnk', onclick: () => { d.hechizos.push({ n: '', tec: '', forma: '', nivel: '', alc: '', dur: '', obj: '', nota: '' }); drawSp(true); } }, '+ Añadir hechizo'));
    refresh();
  }
  f.appendChild(sec('Hechizos', [showRules ? h('p', { class: 'fh', text: 'Magos: 120 niveles al acabar el aprendizaje, y ninguno por encima de Técnica + Forma + Inteligencia + Teoría Mágica + 3. La maestría se paga como una habilidad (1 = 5 px, 2 = 15, 3 = 30); Hechizos dominados da 50 px para ella.' }) : null, spBox], 'hz'));
  // the rest
  f.appendChild(sec('Otros', [h('div', { class: 'fgrid' }, [
    field('Informidad (puntos iniciales)', inp(d.informidad || 0, v => { d.informidad = numv(v); }, { type: 'number', min: '0', inputmode: 'numeric' })),
    field('Confianza', inp(d.confianza != null ? d.confianza : 1, v => { d.confianza = numv(v); }, { type: 'number', min: '0', inputmode: 'numeric' }), 'Normalmente 1, con 3 puntos.'),
    field('Notas: historia, familia, equipo…', h('textarea', { rows: 6, oninput: ev => { d.notas = ev.target.value; } }, d.notas || ''), null, 'w3')])]));
  // save bar with the live budget
  const chips = h('div', { class: 'cc-chips', 'aria-live': 'polite' });
  const save = h('button', { type: 'button', class: 'btn', id: 'pj-save' }, orig ? 'Guardar cambios' : 'Crear personaje');
  const bar = h('div', { class: 'form-bar' }, [showRules ? chips : null, save, h('a', { class: 'btn ghost', href: orig ? '#pj--' + id : '#personajes', text: 'Cancelar' })]);
  if (orig) bar.appendChild(confirmButton('Borrar personaje', entries.length ? 'Pulsa otra vez: se borra con sus ' + entries.length + ' estaciones' : 'Pulsa otra vez para borrar', async () => {
    let n = 0;
    const ok = await dbWrite(async () => {
      for (const e of entries) { await S.db.doc('avance/' + e._id).delete(); n++; if (n % 10 === 0) toast('Borrando estaciones… ' + n + ' de ' + entries.length); }
      await S.db.doc('personajes/' + id).delete();
    }, 'Personaje borrado');
    if (ok) { localDel('av', entries.map(e => e._id)); localDel('pj', id); location.hash = '#personajes'; }
  }));
  f.appendChild(bar);
  // live check
  let rt = null;
  function refresh() { clearTimeout(rt); rt = setTimeout(doRefresh, 90); }
  function doRefresh() {
    if (!f.isConnected) return;
    if (!orig) { try { const o = clone(d); delete o._retUrl; store(DRAFT_KEY, JSON.stringify(o)); } catch (e) { /* storage unavailable */ } }
    if (!showRules) return;
    const r = creationCheck(d);
    drawPanel(panel, r);
    chips.innerHTML = '';
    r.lines.forEach(l => chips.appendChild(h('button', { type: 'button', class: 'cc-chip st-' + l.st, title: l.l + ': ' + l.txt, onclick: () => { const t = document.getElementById('fs-cr'); if (t) t.scrollIntoView({ block: 'start' }); } }, [h('b', { text: l.s }), ' ' + l.short])));
    if (r.errors.length || r.avisos.length) chips.appendChild(h('span', { class: 'cc-chip st-' + (r.errors.length ? 'over' : 'warn'), text: (r.errors.length ? r.errors.length + (r.errors.length === 1 ? ' error' : ' errores') : '') + (r.errors.length && r.avisos.length ? ' · ' : '') + (r.avisos.length ? r.avisos.length + (r.avisos.length === 1 ? ' aviso' : ' avisos') : '') }));
    const byK = {}; r.lines.forEach(l => { byK[l.k] = l; });
    const setMeta = (k, l) => { if (meta[k]) { meta[k].textContent = l ? l.txt : ''; meta[k].className = 'sec-meta' + (l ? ' st-' + l.st : ''); } };
    setMeta('car', byK.car); setMeta('vd', byK.vd); setMeta('hab', byK.px); setMeta('art', byK.px); setMeta('hz', byK.hz);
  }
  f.addEventListener('input', refresh);
  f.addEventListener('change', refresh);
  drawVd(); drawHab(); drawArts(); drawSp();
  save.addEventListener('click', async () => {
    const name = String(d.nombre || '').trim();
    if (!name) { toast('El personaje necesita un nombre.'); const n = document.getElementById('pj-nombre'); if (n) n.focus(); return; }
    const out = clone(d);
    delete out._retUrl;
    out.nombre = name;
    // abilities without px or specialty are not stored when the sheet lists them anyway (standard ones, or learnt in a season)
    out.hab = out.hab.filter(x => String(x.n || '').trim()).map(x => ({ n: String(x.n).trim(), cat: x.cat || guessCat(x.n), esp: String(x.esp || '').trim(), base: numv(x.base) }))
      .filter(x => x.base > 0 || x.esp || x.cat !== guessCat(x.n) || !(CAT_OF[tkey(x.n)] || now.hab.some(y => y.implicit && tkey(y.n) === tkey(x.n))));
    out.hechizos = out.hechizos.filter(x => String(x.n || '').trim()).map(x => { const m = Math.max(0, Math.round(numv(x.maestria))); const o = Object.assign({}, x); if (m) o.maestria = m; else delete o.maestria; if (String(o.desc || '').trim()) o.desc = String(o.desc).trim(); else delete o.desc; return o; });
    out.virtudes = cleanVd(out.virtudes);
    out.defectos = cleanVd(out.defectos);
    out.personalidad = (out.personalidad || []).filter(t => String(t.n || '').trim()).map(t => ({ n: String(t.n).trim(), v: numv(t.v) }));
    ARTS.forEach(a => { out.artes[a] = numv(out.artes[a]); });
    CHARS.forEach(n => { out.car[n] = numv(out.car[n]); });
    const pid = id || newId(name);
    save.disabled = true;
    const ok = await dbWrite(() => S.db.doc('personajes/' + pid).set(stamp(out, !orig)), orig ? 'Ficha guardada' : 'Personaje creado');
    save.disabled = false;
    if (ok) {
      if (!orig) store(DRAFT_KEY, null);
      localPut('pj', pid, out);
      location.hash = '#pj--' + pid;
    }
  });
  page.appendChild(f);
  document.title = (orig ? 'Editar ' + orig.nombre : 'Nuevo personaje') + ' — Europa Mítica';
}
function drawPanel(panel, r) {
  panel.innerHTML = '';
  panel.appendChild(h('div', { class: 'cc-lines' }, r.lines.map(l => h('div', { class: 'cc-line st-' + l.st }, [h('span', { class: 'l', text: l.l }), h('span', { class: 'v', text: l.txt }),
    h('span', { class: 'm', text: l.st === 'over' ? 'te pasas' : l.st === 'under' ? 'sin gastar del todo' : 'justo' })]))));
  if (r.errors.length || r.avisos.length) panel.appendChild(h('ul', { class: 'cc-issues' }, r.errors.map(t => h('li', { class: 'err', text: t })).concat(r.avisos.map(t => h('li', { class: 'warn', text: t })))));
  else panel.appendChild(h('p', { class: 'cc-ok', text: 'Todo cuadra con las reglas de creación.' }));
  panel.appendChild(h('details', { class: 'cc-more' }, [h('summary', { text: 'De dónde sale el presupuesto de experiencia' }),
    h('ul', null, r.parts.map(p => h('li', { text: p[0] + ': ' + p[1] + ' px' })).concat(r.spBudget ? [h('li', { text: 'Hechizos: ' + r.spBudget + ' niveles' })] : [], r.shared ? [h('li', { text: 'Años tras el Guantelete: ' + r.shared + ' puntos para PX o niveles de hechizo (30 por año)' })] : [],
      r.msBonus ? [h('li', { text: 'Hechizos dominados: ' + r.msBonus + ' px para maestría de hechizos' })] : [],
      [h('li', { text: 'Límite de habilidad por edad: ' + r.cap + (r.age != null ? ' (' + r.age + ' años)' : '') + '; ' + (r.cap + 2) + ' con Afinidad' })])),
    h('p', { class: 'fh', text: 'Reglas de creación de Ars Magica 5.ª edición (capítulos 3 y 4) y, para aprendices, del suplemento Apprentices. Los paquetes de infancia salen de tu Excel.' })]));
}
/* childhood packages from the saga's Excel: slots resolve to this character's language and homeland */
function slotName(d, slot) {
  const cr = d.creacion;
  return slot === 'lengua' ? (cr.lengua || 'Lengua materna') : slot === 'lengua2' ? 'Segundo idioma' : slot === 'tierra' ? (cr.tierra || 'Tierra natal') : slot === 'tierra2' ? 'Región vecina' : '';
}
function addXp(d, n, cat, px) {
  let row = d.hab.find(x => tkey(x.n) === tkey(n));
  if (!row) { row = { n: n, cat: cat, esp: '', base: 0 }; d.hab.push(row); }
  row.base = Math.max(0, numv(row.base) + px);
  return row;
}
function dropEmpty(d, names) {
  const ks = names.map(tkey);
  d.hab = d.hab.filter(x => !(numv(x.base) <= 0 && !String(x.esp || '').trim() && ks.includes(tkey(x.n))));
}
function applyPreset(d, name) {
  const cr = d.creacion;
  const old = cr.infAplicada || [];
  old.forEach(it => addXp(d, it.n, 'Otras', -it.px));
  dropEmpty(d, old.map(it => it.n));
  cr.infAplicada = [];
  cr.infancia = name || '';
  const p = PRESETS().find(x => x.n === name);
  const natName = cr.lengua || 'Lengua materna';
  if (p) {
    if (cr.nativaAuto) { addXp(d, natName, 'Idiomas vivos', -75); dropEmpty(d, [natName]); cr.nativaAuto = false; }
    p.items.forEach(it => {
      const n = it.slot ? slotName(d, it.slot) : it.n;
      addXp(d, n, it.cat, it.px);
      cr.infAplicada.push({ n: n, px: it.px, slot: it.slot || '' });
    });
  } else if (cr.lengua && !cr.nativaAuto) { addXp(d, natName, 'Idiomas vivos', 75); cr.nativaAuto = true; }
}
function renameSlot(d, slot, oldVal, newVal) {
  const cr = d.creacion;
  const def = slot === 'lengua' ? 'Lengua materna' : 'Tierra natal';
  const from = oldVal || def, to = newVal || def;
  if (tkey(from) !== tkey(to)) {
    const row = d.hab.find(x => tkey(x.n) === tkey(from));
    if (row && !d.hab.some(x => tkey(x.n) === tkey(to))) row.n = to;
    (cr.infAplicada || []).forEach(it => { if (it.slot === slot) it.n = to; });
  }
  if (slot === 'lengua' && newVal && !cr.infancia && !cr.nativaAuto && !d.hab.some(x => tkey(x.n) === tkey(newVal))) { addXp(d, newVal, 'Idiomas vivos', 75); cr.nativaAuto = true; }
  // the homeland's Area Lore shows among the abilities, ready for its px
  if (slot === 'tierra' && newVal && !d.hab.some(x => tkey(x.n) === tkey(newVal))) d.hab.push({ n: newVal, cat: 'Conocimientos de área', esp: '', base: 0 });
}
/* compendium search with filters, next to the drop-downs */
function vdSearch(q, f) {
  f = f || {};
  const terms = norm(q || '').split(/\s+/).filter(t => t.length > 1);
  const hits = vdIndex().list.filter(e => (!f.clase || e.clase === f.clase) && (!f.tipo || norm(e.cat) === norm(f.tipo)) && (!f.valor || e.valor === f.valor) && terms.every(t => e.key.includes(t)));
  const first = terms[0] || '';
  return hits.sort((a, b) => (norm(b.n).includes(first) - norm(a.n).includes(first)) || (b.core - a.core) || a.n.localeCompare(b.n, 'es'));
}
function vdPicker(onAdd) {
  const st = { q: '', clase: '', tipo: '', valor: '' };
  const box = h('div', { class: 'picker' });
  const q = h('input', { type: 'search', id: 'vd-q', placeholder: 'Buscar en el compendio…', autocomplete: 'off', 'aria-label': 'Buscar virtud o defecto' });
  const res = h('div', { class: 'picker-res' });
  const draw = () => {
    res.innerHTML = '';
    if (!st.q.trim() && !st.tipo && !st.valor) return;
    const hits = vdSearch(st.q, st);
    hits.slice(0, 12).forEach(e => {
      res.appendChild(h('button', { type: 'button', class: 'pick', onclick: () => onAdd({ n: e.n, en: e.en, cat: e.cat, valor: e.valor, nota: vdNota(e) }, e.clase === 'virtud' ? 'virtudes' : 'defectos') }, [
        h('span', { class: 'pk' + (e.clase === 'defecto' ? ' def' : ''), text: (e.clase === 'virtud' ? 'Virtud' : 'Defecto') + (e.valor ? ' · ' + e.valor : '') }),
        h('b', { text: e.n + (e.en && norm(e.en) !== norm(e.n) ? ' ' : '') }, e.en && norm(e.en) !== norm(e.n) ? h('i', { text: '(' + e.en + ')' }) : null),
        h('span', { class: 'pm', text: [e.cat, e.libro === 'Core Rulebook' ? 'reglamento' : e.libro, e.pag].filter(Boolean).join(' · ') }),
        e.desc ? h('span', { class: 'pdsc', text: e.desc.length > 170 ? e.desc.slice(0, 168) + '…' : e.desc }) : null]));
    });
    if (hits.length > 12) res.appendChild(h('p', { class: 'fh', text: 'y ' + (hits.length - 12) + ' más; afina la búsqueda.' }));
    if (!hits.length) res.appendChild(h('p', { class: 'fh', text: 'Nada coincide; usa «Otra, escrita a mano» en el desplegable.' }));
  };
  q.addEventListener('input', () => { st.q = q.value; draw(); });
  const filters = h('div', { class: 'picker-f' }, [q,
    sel([['', 'Virtudes y defectos'], ['virtud', 'Solo virtudes'], ['defecto', 'Solo defectos']], '', v => { st.clase = v; draw(); }, { 'aria-label': 'Clase' }),
    sel([['', 'Todos los tipos']].concat(VD_CATS), '', v => { st.tipo = v; draw(); }, { 'aria-label': 'Tipo' }),
    sel([['', 'Mayor y menor'], ['Mayor', 'Mayor (3)'], ['Menor', 'Menor (1)'], ['Gratuita', 'Gratuita']], '', v => { st.valor = v; draw(); }, { 'aria-label': 'Valor' })]);
  box.appendChild(filters);
  box.appendChild(res);
  return box;
}

/* ================================================================== PANTALLA DEL MÁSTER
   Solo para el máster (quien entra con el código de máster). El aura de la escena —reino y nivel— cambia los totales de lanzamiento
   de todas las fichas según la tabla de interacción de reinos de ArM5 (cap. 12, «Realms»): para la magia hermética,
   aura mágica ×1, feérica ×½ (redondeando hacia arriba), divina ×−3 e infernal ×−1, y en un aura de otro reino un dado de
   pifia más por cada punto de aura. El laboratorio sigue usando el aura de la alianza. Un desplegable muestra los rasgos
   de personalidad, virtudes y defectos de cualquier personaje, y sus hechizos con el aura elegida. */
const MST = { tipo: null, nivel: null, lugar: null, redraw: null };

function viewMaster() {
  page.innerHTML = '';
  page.appendChild(sagaCrumbs([['Pantalla del máster', null]]));
  page.appendChild(h('h1', { class: 'doc-title', text: 'Pantalla del máster' }));
  const content = h('div', { class: 'content fx' });
  page.appendChild(content);
  document.title = 'Pantalla del máster — Europa Mítica';
  const note = statusNote(); if (note) content.appendChild(note);
  if (S.owner !== true) {
    content.appendChild(h('p', { class: 'note', text: S.owner == null && S.db ? 'Comprobando quién eres…' : 'Esta pantalla es solo para el máster: entra en la saga con el código de máster.' }));
    return;
  }
  content.appendChild(h('p', { class: 'doc-blurb', text: 'Elige el aura de la escena: al aplicarla cambian los totales de lanzamiento de todas las fichas. Debajo, cualquier personaje con sus rasgos de personalidad, virtudes y defectos.' }));
  content.appendChild(masterAura());
  content.appendChild(masterWeb());
  content.appendChild(masterPjs());
}

/* ---------- the scene aura */
function masterAura() {
  const now = auraNow();
  if (MST.tipo == null) { MST.tipo = now.tipo; MST.nivel = now.nivel; MST.lugar = now.escena ? now.lugar : ''; }
  const sec = h('section', { class: 'm-sec', 'aria-labelledby': 'm-aura-h' });
  sec.appendChild(h('h2', { class: 'm-h', id: 'm-aura-h', text: 'Aura de la escena' }));
  const nowP = h('p', { class: 'm-now' });
  const modNow = realmMod(now.tipo, now.nivel, 'magica');
  nowP.appendChild(h('span', { class: 'fl', text: 'Ahora en la saga' }));
  nowP.appendChild(h('span', { text: (now.escena ? (now.lugar || 'Escena') : 'Alianza') + ': aura ' + auraTxt(now.tipo, now.nivel) + ' → magia hermética ' + sgn(modNow) }));
  sec.appendChild(nowP);

  const segs = h('div', { class: 'cg-tools', role: 'group', 'aria-label': 'Tipo de aura' });
  AURA_TIPOS.forEach(([k, t]) => segs.appendChild(h('button', { type: 'button', class: 'seg', 'data-t': k, onclick: () => { MST.tipo = k; draw(); } }, t)));
  const nivel = h('input', { type: 'number', id: 'm-nivel', min: '0', max: '10', step: '1', inputmode: 'numeric', value: String(MST.nivel) });
  nivel.addEventListener('input', () => { const n = parseInt(nivel.value, 10); MST.nivel = isFinite(n) ? Math.max(0, Math.min(10, n)) : 0; draw(); });
  const lugar = h('input', { type: 'text', id: 'm-lugar', value: MST.lugar || '', placeholder: 'Por ejemplo, la iglesia de Boltaña', autocomplete: 'off' });
  lugar.addEventListener('input', () => { MST.lugar = lugar.value; });
  sec.appendChild(h('div', { class: 'm-form' }, [
    field('Reino del aura', segs),
    h('div', { class: 'fld-row m-row' }, [field('Nivel (0 a 10)', nivel), field('Lugar', lugar, 'Opcional: sale en las fichas.')])]));

  const eff = h('div', { class: 'm-eff' });
  sec.appendChild(eff);
  const apply = h('button', { type: 'button', class: 'btn', id: 'm-apply' }, 'Aplicar a la saga');
  apply.addEventListener('click', async () => {
    apply.disabled = true;
    const esc0 = { tipo: MST.tipo, nivel: MST.nivel, lugar: String(MST.lugar || '').trim() };
    await writeEstado({ escena: esc0 }, 'Aura de la escena: ' + (esc0.lugar ? esc0.lugar + ', ' : '') + auraTxt(esc0.tipo, esc0.nivel));
    apply.disabled = false;
  });
  const back = h('button', { type: 'button', class: 'btn ghost', id: 'm-back' }, 'Volver a la alianza');
  back.addEventListener('click', async () => {
    back.disabled = true;
    if (await writeEstado({ escena: null }, 'De vuelta en la alianza: aura ' + auraTxt('magica', sagaAura()))) { MST.tipo = 'magica'; MST.nivel = sagaAura(); MST.lugar = ''; }
    back.disabled = false;
  });
  const keep = h('button', { type: 'button', class: 'btn ghost', id: 'm-keep' }, 'Guardar lugar');
  keep.addEventListener('click', async () => {
    const n = String(MST.lugar || '').trim();
    if (!n) { toast('Escribe el nombre del lugar para guardarlo.'); lugar.focus(); return; }
    const list = lugaresOf().filter(x => tkey(x.n) !== tkey(n)).concat([{ n: n, tipo: MST.tipo, nivel: MST.nivel }]);
    keep.disabled = true;
    await writeEstado({ lugares: list }, 'Lugar guardado: ' + n);
    keep.disabled = false;
  });
  sec.appendChild(h('div', { class: 'actions' }, canWrite() ? [apply, back, keep] : [h('p', { class: 'note', text: 'Sin permiso para guardar: los cambios solo se ven aquí.' })]));

  const places = lugaresOf();
  if (places.length) {
    const box = h('div', { class: 'm-places', role: 'list', 'aria-label': 'Lugares guardados' });
    places.forEach((x, i) => {
      const go = h('button', { type: 'button', class: 'chip m-place', title: 'Usar este lugar', onclick: () => { MST.tipo = x.tipo; MST.nivel = numv(x.nivel); MST.lugar = x.n; nivel.value = String(MST.nivel); lugar.value = x.n; draw(); } },
        [document.createTextNode(x.n + ' '), h('small', { text: auraTxt(x.tipo, numv(x.nivel)) })]);
      const del = canWrite() ? h('button', { type: 'button', class: 'x m-del', 'aria-label': 'Quitar ' + x.n, title: 'Quitar', onclick: async () => {
        await writeEstado({ lugares: places.filter((_, j) => j !== i) }, 'Lugar quitado: ' + x.n);
      } }, '×') : null;
      box.appendChild(h('span', { class: 'm-pl', role: 'listitem' }, [go, del]));
    });
    sec.appendChild(h('div', { class: 'fld' }, [h('span', { class: 'fl', text: 'Lugares guardados' }), box]));
  }
  sec.appendChild(h('p', { class: 'note', html: 'Tabla de interacción de reinos de <i>Ars Magica</i> 5ª ed., cap. 12 (Reinos): el modificador se suma a los totales de lanzamiento; los medios se redondean hacia arriba. En un aura de otro reino se tira un dado de pifia más por cada punto de aura. El laboratorio usa el aura de la alianza (' + esc(auraTxt('magica', sagaAura())) + ').' }));

  function draw() {
    segs.querySelectorAll('.seg').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === MST.tipo ? 'true' : 'false'));
    const m = realmMod(MST.tipo, MST.nivel, 'magica'), bd = botchDice(MST.tipo, MST.nivel, 'magica');
    eff.innerHTML = '';
    eff.appendChild(R.stats({ items: [
      { l: 'Magia hermética', v: sgn(m), s: 'a los totales de lanzamiento' },
      { l: 'Dados de pifia', v: bd ? '+' + bd : '0', s: bd ? 'más al lanzar en esta aura' : 'sin dados extra' }] }));
    eff.appendChild(R.grid({ _k: 'm-realms', cls: 'narrow', head: ['Poder de reino', 'Modificador', 'Dados de pifia'], fcl: true,
      body: AURA_TIPOS.map(([k]) => [REALM_POW[k], sgn(realmMod(MST.tipo, MST.nivel, k)), String(botchDice(MST.tipo, MST.nivel, k) || '—')]) }));
    if (MST.redraw) MST.redraw();
  }
  MST.drawAura = draw;
  draw();
  return sec;
}
function lugaresOf() { const l = S.estado && S.estado.lugares; return Array.isArray(l) ? l.filter(x => x && String(x.n || '').trim() && AURA_X[x.tipo]) : []; }

/* ---------- a character's personality, virtues, flaws and spells */
function masterPjs() {
  const sec = h('section', { class: 'm-sec', 'aria-labelledby': 'm-pj-h' });
  sec.appendChild(h('h2', { class: 'm-h', id: 'm-pj-h', text: 'Personajes' }));
  const all = pjsSorted(true);
  if (!all.length) { sec.appendChild(h('p', { class: 'note', text: 'Todavía no hay personajes en la saga.' })); return sec; }
  let cur = load(KEYP + 'master-pj') || all[0]._id;
  if (cur !== '*' && !S.pj[cur]) cur = all[0]._id;
  const s = h('select', { id: 'm-pj' });
  s.appendChild(h('option', { value: '*', selected: cur === '*' ? true : null }, 'Todos los personajes'));
  TIPOS.forEach(t => {
    const list = all.filter(p => (TIPOS.includes(p.tipo) ? p.tipo : 'Otro') === t);
    if (list.length) s.appendChild(h('optgroup', { label: TIPOS_PL[t] }, list.map(p => h('option', { value: p._id, selected: p._id === cur ? true : null }, p.nombre))));
  });
  const out = h('div', { class: 'm-pjs' });
  const draw = () => {
    out.innerHTML = '';
    const list = cur === '*' ? all : all.filter(p => p._id === cur);
    list.forEach(p => out.appendChild(masterCard(p, cur === '*')));
  };
  s.addEventListener('change', () => { cur = s.value; store(KEYP + 'master-pj', cur); draw(); });
  sec.appendChild(h('div', { class: 'm-pick' }, field('Personaje', s)));
  sec.appendChild(out);
  MST.redraw = draw;
  draw();
  return sec;
}
function masterCard(p, compact) {
  const id = p._id, c = calc(p, entriesOf(id));
  const [ca] = curSeason();
  const card = h('article', { class: 'm-card', 'aria-label': p.nombre });
  card.appendChild(h('div', { class: 'm-card-h' }, [monogram(p, 'mono'), h('div', { class: 'm-id' }, [
    h('a', { class: 'm-name', href: '#pj--' + id, text: p.nombre }),
    h('div', { class: 'xt', text: [p.tipo, p.casa, p.nacimiento ? (ca - Number(p.nacimiento)) + ' años' : '', p.jugador ? 'juega ' + p.jugador : ''].filter(Boolean).join(' · ') })])]));
  // wounds and fatigue marked on the sheet: the master sees the malus at a glance
  const et = estadoTxt(p);
  if (et) card.appendChild(h('p', { class: 'm-her' + (estadoFisico(p).fuera ? ' out' : ''), text: et }));
  const fa = formaActiva(p);
  if (formasOf(p).length) card.appendChild(h('div', { class: 'actions m-forma' }, [fa ? h('span', { class: 'badge-cur forma-on', text: 'En forma de ' + fa.n.toLowerCase() }) : null].concat(formaButtons(id, p))));
  const pers = (p.personalidad || []).filter(t => t && String(t.n || '').trim());
  card.appendChild(h('h3', { class: 'm-sub', text: 'Rasgos de personalidad' }));
  card.appendChild(pers.length ? h('div', { class: 'pers-chips' }, pers.map(t => h('span', { class: 'rep', text: t.n + ' ' + sgn(numv(t.v)) })))
    : h('p', { class: 'note', text: 'Sin rasgos anotados en la ficha.' }));
  [['Virtudes', p.virtudes], ['Defectos', p.defectos]].forEach(([t, l]) => {
    const L = (Array.isArray(l) ? l : []).filter(x => x && String(x.n || '').trim());
    const pts = L.reduce((s, x) => s + (x.valor === 'Mayor' ? 3 : x.valor === 'Menor' ? 1 : 0), 0);
    card.appendChild(h('h3', { class: 'm-sub', text: t + (L.length ? ' · ' + L.length + ' (' + pts + ' puntos)' : '') }));
    if (L.length) card.appendChild(vdCards(L, t === 'Virtudes' ? 'virtud' : 'defecto'));
    else card.appendChild(h('p', { class: 'note', text: 'Ninguno.' }));
  });
  if (fa && (fa.virtudes || []).concat(fa.defectos || []).length) {
    card.appendChild(h('h3', { class: 'm-sub', text: 'Del ' + fa.n.toLowerCase() + ', mientras está transformado' }));
    card.appendChild(vdCards((fa.virtudes || []).concat(fa.defectos || []), x => (fa.defectos || []).includes(x) ? 'defecto' : 'virtud'));
  }
  const sp = (p.hechizos || []).filter(x => x && String(x.n || '').trim());
  if (sp.length) {
    const m = realmMod(MST.tipo, MST.nivel, 'magica'), cer = ceremonialOn() && canCeremony(c);
    const rows = sp.map(x => {
      const tot = spellTotal(p, c, x, m, cer), lv = toNum(x.nivel);
      return { x: x, r: [x.n, [x.tec, x.forma].filter(Boolean).map(a => ABBR[artOf(a)] || a).join(''), x.nivel != null ? String(x.nivel) : '', tot == null ? '' : String(tot),
        tot == null || !isFinite(lv) ? '' : sgn(tot - lv)] };
    }).sort((a, b) => toNum(b.r[3]) - toNum(a.r[3]));
    const body = rows.map(o => o.r);
    const wrap = h('details', { class: 'm-spells', open: compact ? null : true });
    wrap.appendChild(h('summary', null, [h('span', { class: 'm-sub', text: 'Hechizos con el aura elegida · ' + sp.length }), h('small', { text: auraTxt(MST.tipo, MST.nivel) + ': ' + sgn(m) })]));
    wrap.appendChild(ceremonyToggle(c, refocusCer));
    wrap.appendChild(R.grid({ _k: 'm-sp-' + id, head: ['Hechizo', 'Arte', 'Nivel', 'Lanzamiento', 'Margen'], body: body, fcl: true, info: i => spellInfo(id, (p.hechizos || []).indexOf(rows[i].x)) }));
    wrap.appendChild(h('p', { class: 'note', text: 'Lanzamiento: Técnica + Forma (con sus Mañas) + Vitalidad + aura' + (sp.some(x => numv(x.maestria) > 0) ? ' + maestría' : '') + (malusOf(p) ? ' + malus por heridas y fatiga (' + sgn(malusOf(p)) + ')' : '') + (cer ? ' + Artes Liberales + Filosofía (ceremonial, 15 min por magnitud)' : sp.some(isRitual) ? '; los rituales suman además Artes Liberales + Filosofía' : '') + ', sin dado. Margen: lanzamiento menos nivel; con el dado, si llega a 0 el hechizo sale sin fatiga, y hasta −10 sale gastando un nivel de fatiga.' }));
    card.appendChild(wrap);
  }
  return card;
}

/* ================================================================== DESCRIPCIONES AL PULSAR
   On a character, a spell or a Virtue/Flaw opens a card with its description: the catalogue's (summarised in Spanish
   from the open-licence Ars Magica books) and, for spells the troupe invented or adapted, the one the player wrote.
   The spell catalogue comes from data/hechizos.json; Virtues and Flaws come from the compendium (vdEntry). */
let HECH = null;
function hechCat() {
  if (HECH) return HECH;
  HECH = { list: [], byId: new Map(), byKey: new Map(), src: null };
  try {
    const d = window.EM_DATA && window.EM_DATA.hech;
    if (d && Array.isArray(d.h)) { HECH.list = d.h; HECH.src = d.src || null; }
  } catch (e) { /* no catalogue */ }
  HECH.list.forEach(x => {
    HECH.byId.set(x.id, x);
    [x.n, x.en].concat(x.alias || []).filter(Boolean).forEach(n => {
      const k = tkey(n);
      if (!HECH.byKey.has(k)) HECH.byKey.set(k, []);
      HECH.byKey.get(k).push(x);
    });
  });
  return HECH;
}
/* the catalogue entry of a character's spell: the one linked by hand, else by name (with or without what is in brackets) */
function spellCat(s) {
  if (!s) return null;
  const C = hechCat();
  if (s.cat === '-') return null;
  if (s.cat && C.byId.has(s.cat)) return C.byId.get(s.cat);
  const t = artOf(s.tec), f = artOf(s.forma);
  const fits = x => (!t || x.tec === t) && (!f || x.forma === f);
  const name = String(s.n || '');
  for (const k of [tkey(name), tkey(name.replace(/\(.*?\)/g, ' ')), tkey((name.match(/\(([^)]+)\)/) || [])[1] || '')]) {
    if (!k) continue;
    const hit = (C.byKey.get(k) || []).find(fits);
    if (hit) return hit;
  }
  return null;
}
const lvlTxt = v => (String(v) === 'Gen' ? 'nivel general' : 'nivel ' + v);
function rdtTxt(o) { return [o.alc, o.dur, o.obj].filter(Boolean).join(' · '); }
function catSource(x) {
  const C = hechCat();
  const p = h('p', { class: 'info-src' });
  p.appendChild(document.createTextNode((x.libro || 'Ars Magica, edición definitiva') + ': «' + x.en + '»' + (x.pag ? ', pág. ' + x.pag : '') + '. '));
  if (C.src) {
    p.appendChild(document.createTextNode(C.src.t + ' '));
    (C.src.links || []).forEach(([t, u], i) => { if (i) p.appendChild(document.createTextNode(' · ')); p.appendChild(h('a', { href: u, target: '_blank', rel: 'noopener', text: t })); });
  }
  return p;
}
function paras(txt, cls) { return String(txt || '').split(/\n+/).filter(s => s.trim()).map(s => h('p', { class: cls || null, text: s.trim() })); }

/* a spell of a character: catalogue text, the player's own description, notes; writers can add or change theirs */
function spellInfo(pjId, i) {
  const pj = S.pj[pjId];
  const s = pj && (pj.hechizos || [])[i];
  if (!s) return;
  const cat = spellCat(s);
  const body = [];
  const t = artOf(s.tec) || (cat && cat.tec), f = artOf(s.forma) || (cat && cat.forma);
  const lv = s.nivel != null && s.nivel !== '' ? s.nivel : cat && cat.nivel;
  const head = h('div', { class: 'info-head' });
  if (t) head.appendChild(artChip(t));
  if (f) head.appendChild(artChip(f));
  if (lv != null && lv !== '') head.appendChild(h('span', { class: 'info-lv', text: lvlTxt(lv) }));
  const rdt = rdtTxt(s) || (cat ? rdtTxt(cat) : '');
  if (rdt) head.appendChild(h('span', { class: 'info-rdt', text: rdt }));
  if (isRitual(s) || (cat && cat.rit)) head.appendChild(h('span', { class: 'info-rdt', text: 'ritual' }));
  body.push(head);
  if (cat && cat.req) body.push(h('p', { class: 'info-req', text: 'Requisito: ' + cat.req }));
  const own = String(s.desc || '').trim();
  if (own) body.push(h('div', { class: 'info-own' }, [h('div', { class: 'info-lab', text: cat ? 'Descripción de la ficha' : 'Descripción' })].concat(paras(own))));
  if (cat) {
    body.push(h('div', { class: 'info-cat' }, [h('div', { class: 'info-lab', text: own ? 'En el manual' : 'Descripción' })].concat(paras(cat.desc), cat.base ? [h('p', { class: 'info-base', text: cat.base })] : [])));
    body.push(catSource(cat));
  } else if (!own) {
    body.push(h('p', { class: 'note', text: 'Este hechizo no está en el catálogo (lo inventasteis o viene de otro libro) y la ficha no trae descripción.' }));
  }
  if (s.nota) body.push(h('p', { class: 'info-nota' }, [h('i', { text: 'Notas: ' }), String(s.nota)]));
  if (s.maestria) body.push(h('p', { class: 'info-nota', text: 'Maestría ' + s.maestria + '.' }));
  const actions = [];
  let close = null;
  if (canWrite()) {
    const edit = h('button', { type: 'button', class: 'btn' + (own || cat ? ' ghost' : '') }, own ? 'Cambiar la descripción' : cat ? 'Añadir una descripción propia' : 'Escribir la descripción');
    edit.addEventListener('click', () => {
      edit.remove();
      const ta = h('textarea', { rows: '6', 'aria-label': 'Descripción del hechizo', placeholder: cat ? 'Si en vuestra saga funciona distinto, cuéntalo aquí. Se muestra encima de la del manual.' : 'Qué hace el hechizo, cómo se lanza, sus efectos…' });
      ta.value = own;
      const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
      save.addEventListener('click', async () => {
        save.disabled = true;
        const v = ta.value.trim();
        if (await saveSpellPatch(pjId, i, s, v ? { desc: v } : { desc: null }, v ? 'Descripción guardada' : 'Descripción borrada')) { close(); spellInfo(pjId, i); }
        else save.disabled = false;
      });
      const box = h('div', { class: 'info-edit' }, [field(own ? 'Tu descripción' : 'Descripción', ta), save]);
      const b = document.querySelector('.modal-card.info .modal-b');
      if (b) { b.appendChild(box); ta.focus(); }
    });
    actions.push(edit);
    if (!cat) {
      const cands = spellCands(s);
      if (cands.length) {
        const pick = h('details', { class: 'info-pick' }, [h('summary', { text: '¿Es un hechizo del manual?' }),
          h('p', { class: 'fh', text: 'Hechizos del catálogo con la misma Técnica y Forma; si es uno de ellos, enlázalo y la ficha mostrará su descripción.' }),
          h('ul', null, cands.map(x => h('li', null, h('button', { type: 'button', class: 'lnk', onclick: async () => {
            if (await saveSpellPatch(pjId, i, s, { cat: x.id }, 'Enlazado con «' + x.n + '»')) { close(); spellInfo(pjId, i); }
          } }, x.n + ' (' + lvlTxt(x.nivel) + ')'))))]);
        body.push(pick);
      }
    } else if (s.cat === cat.id || canUnlink(s, cat)) {
      actions.push(h('button', { type: 'button', class: 'lnk', onclick: async () => {
        if (await saveSpellPatch(pjId, i, s, { cat: '-' }, 'Ya no se muestra la descripción del manual')) { close(); spellInfo(pjId, i); }
      } }, 'No es este hechizo'));
    }
  }
  close = openModal(s.n || 'Hechizo', body, actions);
  const card = document.querySelector('.modal-card');
  if (card) card.classList.add('info');
}
const canUnlink = (s, cat) => !!cat;
function spellCands(s) {
  const t = artOf(s.tec), f = artOf(s.forma), lv = toNum(s.nivel);
  if (!t || !f) return [];
  return hechCat().list.filter(x => x.tec === t && x.forma === f)
    .sort((a, b) => Math.abs((toNum(a.nivel) || 0) - (lv || 0)) - Math.abs((toNum(b.nivel) || 0) - (lv || 0))).slice(0, 8);
}
/* one spell changes inside the character's list; the list is written back whole */
async function saveSpellPatch(pjId, i, s, patch, msg) {
  const pj = S.pj[pjId];
  if (!pj) return false;
  const list = (pj.hechizos || []).slice();
  const at = list[i] === s ? i : list.findIndex(x => x && x.n === s.n && x.tec === s.tec && x.forma === s.forma);
  if (at < 0) { toast('La ficha ha cambiado mientras tanto; vuelve a abrir el hechizo.'); return false; }
  const nx = Object.assign({}, list[at], patch);
  Object.keys(patch).forEach(k => { if (patch[k] == null) delete nx[k]; });
  list[at] = nx;
  const ok = await dbWrite(() => S.db.doc('personajes/' + pjId).update(stamp({ hechizos: list })), msg);
  if (ok) localPut('pj', pjId, Object.assign({}, pj, { hechizos: list }));
  return ok;
}

/* a Virtue or Flaw: the compendium's text, its book and the note on the sheet */
function vdInfo(x, clase) {
  if (!x) return;
  const e = vdEntry(x, clase);
  const body = [];
  const head = h('div', { class: 'info-head' }, [h('span', { class: 'info-lv', text: [clase === 'defecto' ? 'Defecto' : 'Virtud', String(x.valor || (e && e.valor) || '').toLowerCase()].filter(Boolean).join(' ') }),
    (x.cat || (e && e.cat)) ? h('span', { class: 'info-rdt', text: x.cat || e.cat }) : null]);
  body.push(head);
  if (e && e.desc) body.push(h('div', { class: 'info-cat' }, paras(e.desc)));
  else body.push(h('p', { class: 'note', text: 'No está en el compendio de virtudes y defectos.' }));
  if (x.nota) body.push(h('p', { class: 'info-nota' }, [h('i', { text: 'En la ficha: ' }), String(x.nota)]));
  if (e) {
    const src = [e.en && tkey(e.en) !== tkey(e.n) ? '«' + e.en + '»' : '', e.libro, e.pag].filter(Boolean).join(', ');
    if (src) body.push(h('p', { class: 'info-src', text: src + '.' }));
  }
  const close = openModal(vdLabel(x), body, [h('a', { class: 'btn ghost', href: '#virtudes-defectos--' + (clase === 'defecto' ? 'defectos' : 'virtudes'), onclick: () => { close(); }, text: 'Compendio' })]);
  const card = document.querySelector('.modal-card');
  if (card) card.classList.add('info');
}

/* ================================================================== PANTALLA DEL MÁSTER · LA SAGA EN LA WEB
   The saga's codes, a backup copy and importing one. */
function masterWeb() {
  const W = window.EM_WEB;
  const sec = h('section', { class: 'm-sec m-web', 'aria-labelledby': 'm-web-h' }, [h('h2', { class: 'm-h', id: 'm-web-h', text: 'La saga en la web' })]);
  const s = W.saga;
  sec.appendChild(h('p', { class: 'doc-blurb' }, ['Los datos de la ' + s.nombre + ' se guardan en una hoja de cálculo de su carpeta de Drive. ',
    h('a', { href: s.carpeta, target: '_blank', rel: 'noopener', text: 'Abrir la carpeta' }), s.datos ? ' · ' : null,
    s.datos ? h('a', { href: s.datos, target: '_blank', rel: 'noopener', text: 'la hoja de datos' }) : null, '.']));

  // codes
  const cj = h('input', { type: 'text', id: 'm-cj', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none', placeholder: 'Sin cambios' });
  const cm = h('input', { type: 'text', id: 'm-cm', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none', placeholder: 'Sin cambios' });
  const save = h('button', { type: 'button', class: 'btn' }, 'Cambiar los códigos');
  save.addEventListener('click', async () => {
    const j = cj.value.trim(), m = cm.value.trim();
    if (!j && !m) { toast('Escribe al menos un código nuevo.'); return; }
    if ((j && j.length < 6) || (m && m.length < 6)) { toast('Cada código tiene que tener al menos 6 caracteres.'); return; }
    save.disabled = true;
    try {
      const r = await W.api('codigos', { jugador: j || null, master: m || null });
      W.setToken(r.token);
      cj.value = ''; cm.value = '';
      toast('Códigos cambiados. Quien estaba dentro tendrá que entrar con el nuevo.');
    } catch (e) { toast(e.message || 'No se han podido cambiar los códigos.'); }
    save.disabled = false;
  });
  sec.appendChild(h('h3', { class: 'm-sub', text: 'Códigos de entrada' }));
  sec.appendChild(h('p', { class: 'note', text: 'Al cambiar un código, todos los que estaban dentro (también los demás másteres) tienen que volver a entrar. Tú sigues dentro.' }));
  sec.appendChild(h('div', { class: 'fld-row fx' }, [field('Nuevo código de jugador', cj), field('Nuevo código de máster', cm)]));
  sec.appendChild(h('div', { class: 'actions' }, [save]));

  // backup
  const down = h('button', { type: 'button', class: 'btn ghost' }, 'Descargar una copia');
  down.addEventListener('click', async () => {
    down.disabled = true;
    try {
      const r = await W.api('exportar');
      const blob = new Blob([JSON.stringify(r, null, 1)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: tkey(s.nombre) + '-' + new Date().toISOString().slice(0, 10) + '.json' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Copia descargada: ' + Object.keys(r.docs || {}).length + ' documentos.');
    } catch (e) { toast(e.message || 'No se ha podido descargar la copia.'); }
    down.disabled = false;
  });
  const file = h('input', { type: 'file', accept: 'application/json,.json', id: 'm-imp', hidden: true });
  const repl = h('input', { type: 'checkbox', id: 'm-repl' });
  const up = h('button', { type: 'button', class: 'btn ghost', onclick: () => file.click() }, 'Importar una copia');
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    let d;
    try { d = JSON.parse(await f.text()); } catch (e) { toast('Ese archivo no es una copia de la saga.'); return; }
    if (!d || typeof d.docs !== 'object') { toast('Ese archivo no es una copia de la saga.'); return; }
    toast('Importando…');
    try {
      const r = await W.api('importar', { docs: d.docs, archivo: d.archivo || null, reemplazar: repl.checked });
      await W.refresh();
      toast('Importados ' + r.n + ' documentos.' + (d.archivo ? ' Recarga la página para ver las hojas de Excel.' : ''));
    } catch (e) { toast(e.message || 'No se ha podido importar.'); }
  });
  sec.appendChild(h('h3', { class: 'm-sub', text: 'Copia de seguridad' }));
  sec.appendChild(h('p', { class: 'note', text: 'Una copia de todos los personajes, estaciones y movimientos en un archivo. Importarla junta su contenido con el de la saga; marca la casilla para sustituir lo que hay.' }));
  sec.appendChild(h('div', { class: 'actions' }, [down, up, file, h('label', { class: 'chk', for: 'm-repl' }, [repl, h('span', { text: 'Sustituir lo que hay' })])]));
  return sec;
}


function route(keep) {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  const y = window.scrollY;
  document.body.classList.remove('nav-open');
  document.getElementById('navbtn').setAttribute('aria-expanded', 'false');
  const parts = raw.split('--');
  const doc = DOCS[parts[0]];
  document.querySelectorAll('#tree .t-doc').forEach(a => a.setAttribute('aria-current', doc && a.dataset.doc === doc.id ? 'page' : 'false'));
  renderSagaSide();
  if (!doc && sagaRoute(raw)) {
    if (keep) requestAnimationFrame(() => window.scrollTo(0, y));
    else if (!pendingFocus) window.scrollTo(0, 0);
    focusPending();
    return;
  }
  if (!doc) {
    const q = sideQuery;
    const input = viewHome(q);
    sideQuery = '';
    if (q) { const sq = document.getElementById('sideq'); if (window.matchMedia('(max-width: 900px)').matches) { input.focus(); } else { sq.focus(); } }
    return;
  }
  viewDoc(doc, parts[1], parts[2], keep ? y : null);
}

let sideQuery = '';
function init() {
  renderTree();
  const sideq = document.getElementById('sideq');
  sideq.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      sideQuery = sideq.value;
      if (location.hash === '#inicio' || !location.hash) route(); else location.hash = '#inicio';
    }
  });
  sideq.addEventListener('input', () => {
    const onHome = !DOCS[(location.hash.replace(/^#/, '').split('--')[0])];
    const hq = document.getElementById('homeq');
    if (onHome && hq) { hq.value = sideq.value; hq.dispatchEvent(new Event('input')); return; }
    if (sideq.value.trim().length >= 2) {
      // searching from a document: switch to the start page, where results are listed
      sideQuery = sideq.value;
      location.hash = '#inicio';
    }
  });
  const btn = document.getElementById('navbtn');
  btn.addEventListener('click', () => { const open = !document.body.classList.contains('nav-open'); document.body.classList.toggle('nav-open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); });
  document.getElementById('scrim').addEventListener('click', () => { document.body.classList.remove('nav-open'); btn.setAttribute('aria-expanded', 'false'); });
  window.addEventListener('hashchange', () => route());
  route();
  sagaInit();
}
init();
};
