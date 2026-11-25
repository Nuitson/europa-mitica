/* La saga en la barra lateral, en el inicio y en las cifras vivas de las hojas. */
import { ARTS, ARTS_T, DOCS, esc, fmt, h, ICON, R, signed } from '../base.js';
import { foldLi, folderLabel } from '../tree.js';
import { covenantsOf, fichaArchivo, TRIBUNALES, tribHidden } from './covenant.js';
import { S, SEASONS } from './state.js';
import { monogram, pjsSorted, sagaChanged, statusNote } from './core.js';
import { hbActive, hbSync, hbTitle } from './homebrew.js';
import { auraNow, auraTxt, canWrite, currentRaw, curSeason, entriesOf, numv, skey, sname } from './rules.js';
import { openTesEditor, openVisEditor, tesMiniTable } from './seasons.js';

/* ---------- side panel, home and live figures on the Excel pages */
const SVG = {
  saga: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.2 9.6 6h5l-4 3 1.5 4.8L8 10.9l-4.1 2.9L5.4 9l-4-3h5z"/></svg>',
  est: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>',
  pj: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="5.5" r="2.8"/><path d="M2.8 14c.6-3 2.7-4.6 5.2-4.6s4.6 1.6 5.2 4.6"/></svg>',
  master: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 13.5h11M4 13.5V7l4-3.5L12 7v6.5"/><path d="M6.5 13.5v-3h3v3"/></svg>',
  hb: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 2.5h7.5L13 5v8.5H3z"/><path d="M5.5 7h5M5.5 9.5h5M5.5 12h3"/></svg>',
  arm: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 13 11.5 4.5M10 3l3 3M4.5 9.5l2 2M2.5 13.5l1-1"/></svg>',
  cro: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 2.5h8v11H4z"/><path d="M6 5.5h4M6 8h4M6 10.5h2.5"/></svg>',
  trib: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 6 8 2.5 13.5 6M3.5 6v6M6.5 6v6M9.5 6v6M12.5 6v6M2 13.5h12"/></svg>'
};
// the characters by kind, as the side panel groups them (an «Otro» goes with the companions)
const PJ_GRUPOS = [['magi', 'Magi', ['Magus', 'Aprendiz']], ['comp', 'Compañeros', ['Compañero', 'Otro']], ['grogs', 'Grogs', ['Grog']]];
const docLink = (href, icon, text, on, small) => h('a', { class: 't-doc', href: href, 'aria-current': on ? 'page' : null, html: icon + '<span>' + esc(text) + (small ? ' <small>' + esc(small) + '</small>' : '') + '</span>' });
const groupLabel = (icon, text) => h('div', { class: 't-folder t-group', html: icon + '<span>' + esc(text) + '</span>' });
const sheetLink = (d, raw) => h('a', { class: 't-doc', href: '#' + d.id, 'data-doc': d.id, 'aria-current': raw.split('--')[0] === d.id ? 'page' : null, html: ICON.sheet + '<span>' + esc(d.title) + '</span>' });
/* the saga's own spreadsheets (its archive): a character's goes with the characters, the rest with the covenant; the covenant's
   sheet first, then its library and its vis */
function sagaDocs() {
  const rank = d => /ficha|alianza-web/i.test(d.id) ? 0 : d.kind === 'biblioteca' ? 1 : /vis|reserva/i.test(d.id + ' ' + d.title) ? 2 : 3;
  const all = Object.values(DOCS).filter(d => d.saga);
  return { pj: all.filter(d => d.kind === 'personaje'), cov: all.filter(d => d.kind !== 'personaje').sort((a, b) => rank(a) - rank(b)) };
}
function renderSagaSide() {
  const box = document.getElementById('sagaside'), mbox = document.getElementById('masterside');
  if (!box) return;
  box.innerHTML = '';
  if (mbox) mbox.innerHTML = '';
  if (window.EM_WEB.guest) {
    box.appendChild(h('div', { class: 'guest-side' }, [h('p', { text: 'Estás como invitado: ves las ayudas públicas. Entra para abrir tu saga, tus personajes y las estaciones.' }),
      h('button', { type: 'button', class: 'btn', onclick: () => window.EM_WEB.entrar() }, 'Entrar o crear cuenta')]));
    return;
  }
  const raw = currentRaw();
  const [a, e] = curSeason();
  const sd = sagaDocs();
  box.appendChild(h('a', { class: 't-folder', href: '#saga', html: SVG.saga + '<span>Saga en curso</span>' }));
  const u = h('ul');
  u.appendChild(h('li', null, docLink('#estaciones', SVG.est, 'Estaciones', /^estaciones/.test(raw), sname(a, e))));
  // the characters, in three groups that fold, like the folder itself
  const pjs = pjsSorted(false);
  const groups = h('ul');
  PJ_GRUPOS.forEach(([k, name, tipos]) => {
    const L = pjs.filter(p => k === 'comp' ? !['Magus', 'Aprendiz', 'Grog'].includes(p.tipo) : tipos.includes(p.tipo));
    const sub = h('ul', null, L.map(p => h('li', null, h('a', { class: 't-doc t-pj', href: '#pj--' + p._id, 'aria-current': raw === 'pj--' + p._id || raw.startsWith('pj--' + p._id + '--') ? 'page' : null, text: p.nombre }))));
    // the characters' own spreadsheets in the saga's archive (Astrid's…) go with the magi
    if (k === 'magi') sd.pj.forEach(d => sub.appendChild(h('li', null, sheetLink(d, raw))));
    if (!sub.children.length) sub.appendChild(h('li', { class: 't-none', text: 'Ninguno' }));
    groups.appendChild(foldLi('pj-' + k, groupLabel('', name + (L.length ? ' · ' + L.length : '')), sub));
  });
  u.appendChild(foldLi('pjs', docLink('#personajes', SVG.pj, 'Personajes', raw === 'personajes' || raw === 'pj-nuevo'), groups));
  // the homebrew material switched on (and, for the master, the way to it); its spells must be here for the catalogue
  const hb = hbActive();
  if (hb.length || S.owner === true) {
    const li = h('li', null, docLink('#hb', SVG.hb, 'Homebrew', raw === 'hb', hb.length ? hb.length + (hb.length === 1 ? ' activo' : ' activos') : ''));
    if (hb.length) li.appendChild(h('ul', null, hb.map(g => h('li', null, h('a', { class: 't-doc t-pj', href: '#hb--' + g.k, 'aria-current': raw === 'hb--' + g.k || raw.startsWith('hb--' + g.k + '--') ? 'page' : null, text: hbTitle(g) })))));
    u.appendChild(li);
  }
  hbSync(sagaChanged);
  box.appendChild(h('div', { class: 'tree' }, u));
  // the covenant: its sheet, library and vis from the archive, and the armoury and chronicle kept in the web; a saga whose archive
  // has no covenant sheet (one made in the web) has its sheet in the web (saga/covenant.js: viewSagaCov)
  const narm = Object.keys(S.arm).length, ncro = Object.keys(S.cro).length;
  const cov = h('ul', null, sd.cov.map(d => h('li', null, sheetLink(d, raw))));
  if (!fichaArchivo()) {
    const n = window.EM_WEB.saga && window.EM_WEB.saga.alianza;
    cov.insertBefore(h('li', null, docLink('#alianza--propia', ICON.sheet, n ? 'Ficha de ' + n : 'Ficha de la alianza', raw === 'alianza--propia')), cov.firstChild);
  }
  cov.appendChild(h('li', null, docLink('#armeria', SVG.arm, 'Armería', raw === 'armeria', narm ? String(narm) : '')));
  cov.appendChild(h('li', null, docLink('#cronica', SVG.cro, 'Crónica', raw === 'cronica', ncro ? String(ncro) : '')));
  box.appendChild(h('div', { class: 'tree t-sec' }, h('ul', null, foldLi('alianza', folderLabel('Alianza'), cov))));
  // the master's: the screen, and the Tribunals with their covenants (the master hides the ones the saga does not use)
  if (S.owner === true && mbox) {
    const m = h('ul', null, h('li', null, docLink('#master', SVG.master, 'Pantalla del máster', /^master(--|$)/.test(raw) && raw !== 'master--tribunales', auraTxt(auraNow().tipo, auraNow().nivel))));
    const hidden = tribHidden(), tl = h('ul');
    TRIBUNALES.filter(([k]) => !hidden.has(k)).forEach(([k, n]) => {
      const L = covenantsOf(k), vivas = L.filter(c => !c.ruinas), ruinas = L.filter(c => c.ruinas);
      const es = c => c._id && (raw === 'alianza--' + c._id || raw.startsWith('alianza--' + c._id + '--'));
      const li = c => h('li', null, h('a', { class: 't-doc t-pj', href: c.href, 'aria-current': es(c) ? 'page' : null, text: c.n }));
      const sub = h('ul', null, vivas.map(li));
      // the ruined covenants of the books, in their own fold
      if (ruinas.length) sub.appendChild(foldLi('trib-' + k + '-ruinas', groupLabel('', 'En ruinas · ' + ruinas.length), h('ul', null, ruinas.map(li)), ruinas.some(es)));
      if (!L.length) sub.appendChild(h('li', { class: 't-none', text: 'Sin alianzas' }));
      tl.appendChild(foldLi('trib-' + k, groupLabel('', n.replace(/^(el|los) /, '') + (vivas.length ? ' · ' + vivas.length : '')), sub, L.some(es)));
    });
    tl.appendChild(h('li', null, h('a', { class: 't-doc t-more', href: '#master--tribunales', 'aria-current': raw === 'master--tribunales' ? 'page' : null,
      text: hidden.size ? 'Elegir tribunales (' + hidden.size + (hidden.size === 1 ? ' oculto)' : ' ocultos)') : 'Ocultar tribunales y añadir alianzas' })));
    m.appendChild(foldLi('tribunales', groupLabel(SVG.trib, 'Tribunales'), tl, false));
    mbox.appendChild(h('div', { class: 'tree t-sec' }, h('ul', null, foldLi('master', folderLabel('Máster', SVG.master), m))));
  }
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

export { glanceNode, homeSaga, liveStats, liveStock, renderSagaSide, visDbRows };
