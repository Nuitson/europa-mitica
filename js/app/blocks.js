/* Los bloques de las ayudas de juego: texto, tablas, registro de vis y gráficos (R). */
import { LIBROS, ABBR, artChip, artOf, ARTS, ARTS_F, ARTS_T, artVar, br, esc, fmt, h, ICON, IMG, inertOthers, load, norm, opify, R, signed, store, toNum } from './base.js';
import { cell, sel } from './saga/core.js';
import { canWrite } from './saga/rules.js';
import { liveStats, liveStock, visDbRows } from './saga/home.js';
import { openVisEditor } from './saga/seasons.js';

/* ---------------------------------------------------------------- block renderers */
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
  const gal = b.imgs && b.imgs.length ? R.gallery({ items: b.imgs, small: true }) : null; // null when none of the images exist
  if (gal) n.lastChild.appendChild(gal);
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
  const opener = document.activeElement;
  const lb = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Imagen ampliada (pulsa para cerrar)', tabindex: '-1' }, h('img', { src: src, alt: '' }));
  let release = () => {};
  const close = () => {
    if (!lb.isConnected) return;
    release(); lb.remove(); document.removeEventListener('keydown', onkey); window.removeEventListener('hashchange', close);
    if (opener && opener.isConnected) opener.focus();
  };
  const onkey = e => { if (e.key === 'Escape') close(); };
  lb.addEventListener('click', close);
  document.addEventListener('keydown', onkey);
  window.addEventListener('hashchange', close); // Back: the image belongs to the page it was opened on
  document.body.appendChild(lb);
  release = inertOthers(lb);
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
        else if (refBook(b.cols[ci], v)) td.appendChild(refCell(v, o.r[0]));
        else if (long.has(ci) && v) { td.className = 'long'; td.appendChild(clampCell(v)); }
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
// each ledger's filters, kept while the page is open: a redraw (someone saved a movement) must not clear them
const VL_FILTERS = new Map();
R.visledger = (b) => {
  const rows = b.live ? b.rows.concat(visDbRows()) : b.rows; // web movements follow the sheet's
  const st = VL_FILTERS.get(b.id) || { q: '', raw: '', y: '', tp: '', a: '' };
  VL_FILTERS.set(b.id, st);
  const wrap = h('div', { class: 'dt vl' });
  const tools = h('div', { class: 'dt-tools' });
  const input = h('input', { type: 'search', id: 'q-' + b.id, placeholder: 'Filtrar movimientos…', 'aria-label': 'Filtrar movimientos', autocomplete: 'off' });
  input.value = st.raw;
  input.addEventListener('input', () => { st.raw = input.value; st.q = norm(input.value); draw(); });
  tools.appendChild(input);
  const years = [...new Set(rows.map(r => r.y).filter(Boolean))].sort();
  const types = [...new Set(rows.map(r => r.tp).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'es'));
  const mk = (id, label, vals, key) => {
    const s = h('select', { id: id, 'aria-label': label }, [h('option', { value: '' }, label + ': todos')].concat(vals.map(v => h('option', { value: v }, v))));
    s.addEventListener('change', () => { st[key] = s.value; draw(); });
    if (st[key] && !vals.includes(st[key])) st[key] = ''; // that year or Art is no longer in the ledger
    s.value = st[key];
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
    svg += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="' + (Math.abs(v) < 1e-9 && lo < 0 ? 'var(--rule-2)' : 'var(--rule)') + '" stroke-width="1"/>';
    svg += '<text x="' + (m.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + fmt(v) + '</text>';
  }
  const bandW = iw / n;
  // years on a line/step chart are placed to scale; everything else is categorical
  const numericX = b.kind !== 'bars' && b.kind !== 'bars2' && xs.length > 1 && xs.every(v => isFinite(toNum(v)));
  const x0v = numericX ? toNum(xs[0]) : 0, x1v = numericX ? toNum(xs[n - 1]) : 1;
  const xc = numericX ? (i => m.l + 10 + (toNum(xs[i]) - x0v) / (x1v - x0v || 1) * (iw - 20)) : (i => m.l + bandW * (i + .5));
  if (numericX) {
    const span = x1v - x0v, stepX = Math.max(1, niceStep(span / 8)); // whole years: no «1220.5» ticks
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

/* a long cell: three lines and an arrow (▾ folded, ▴ open) that unfolds and folds it back; no arrow if it all fits */
function clampCell(v) {
  const txt = h('div', { class: 'clamp', html: br(v) });
  const btn = h('button', { type: 'button', class: 'clamp-btn', 'aria-expanded': 'false', 'aria-label': 'Ver la descripción entera', title: 'Ver entera', html: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>' });
  const box = h('div', { class: 'clamp-w' }, [txt, btn]);
  const toggle = () => {
    const open = !txt.classList.contains('open');
    txt.classList.toggle('open', open);
    box.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Plegar la descripción' : 'Ver la descripción entera');
    btn.title = open ? 'Plegar' : 'Ver entera';
  };
  btn.addEventListener('click', toggle);
  txt.addEventListener('click', toggle);
  // only offer the arrow when the text is cut (measured once laid out, and again if the width changes)
  const check = () => { if (txt.classList.contains('open') || !txt.clientHeight) return; btn.hidden = txt.scrollHeight <= txt.clientHeight + 1; txt.style.cursor = btn.hidden ? 'default' : ''; };
  if (window.ResizeObserver) new ResizeObserver(check).observe(txt); else requestAnimationFrame(check);
  return box;
}

/* the «Pág.» column of the books' compendium: «ArM 41», «RoP:D 34, 36, 49-51»… each page opens the book's PDF there.
   The compendium quotes the English edition, whose PDF has the same page numbers (libros/en/); where the Spanish PDF
   has the entry checked, a small «ES» link opens it in Spanish (libros/es/). */
const refBook = (col, v) => /^P.g/i.test(col || '') && /^\S+\s+\d/.test(v || '') && !!LIBROS.libros[String(v).split(/\s+/)[0]];
function pdfLink(href, text, title, cls) {
  return h('a', { class: cls || 'ref-a', href: href, target: '_blank', rel: 'noopener', title: title, text: text });
}
function refCell(v, name) {
  const ab = String(v).split(/\s+/)[0], bk = LIBROS.libros[ab];
  const box = h('span', { class: 'ref' });
  String(v).slice(ab.length).split(',').forEach((piece, i) => {
    const n = parseInt(piece, 10);
    if (i) box.appendChild(document.createTextNode(', '));
    if (!isFinite(n)) { box.appendChild(document.createTextNode(piece.trim())); return; }
    box.appendChild(pdfLink(bk.en + '#page=' + n, (i ? '' : ab + ' ') + piece.trim(), 'Abrir «' + bk.nombre + '» (inglés) en la página ' + n));
  });
  const es = bk.es && LIBROS.es[ab + '|' + name + '|' + v];
  if (es) { box.appendChild(document.createTextNode(' ')); box.appendChild(pdfLink(bk.es + '#page=' + es, 'ES', 'Abrir «' + bk.nombre + '» en castellano, página ' + es, 'ref-a ref-es')); }
  return box;
}

export { renderBlocks };
