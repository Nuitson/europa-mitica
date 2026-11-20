/* La saga en la barra lateral, en el inicio y en las cifras vivas de las hojas. */
import { ARTS, ARTS_T, esc, fmt, h, R, signed } from '../base.js';
import { S, SEASONS } from './state.js';
import { monogram, pjsSorted, sagaChanged, statusNote } from './core.js';
import { hbActive, hbSync, hbTitle } from './homebrew.js';
import { auraNow, auraTxt, canWrite, currentRaw, curSeason, entriesOf, numv, skey, sname } from './rules.js';
import { openTesEditor, openVisEditor, tesMiniTable } from './seasons.js';

/* ---------- side panel, home and live figures on the Excel pages */
function renderSagaSide() {
  const box = document.getElementById('sagaside');
  if (!box) return;
  box.innerHTML = '';
  if (window.EM_WEB.guest) {
    box.appendChild(h('div', { class: 'guest-side' }, [h('p', { text: 'Estás como invitado: ves las ayudas públicas. Entra para abrir tu saga, tus personajes y las estaciones.' }),
      h('button', { type: 'button', class: 'btn', onclick: () => window.EM_WEB.entrar() }, 'Entrar o crear cuenta')]));
    return;
  }
  const raw = currentRaw();
  const [a, e] = curSeason();
  box.appendChild(h('a', { class: 't-folder', href: '#saga', html: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.2 9.6 6h5l-4 3 1.5 4.8L8 10.9l-4.1 2.9L5.4 9l-4-3h5z"/></svg><span>Saga en curso</span>' }));
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
  if (S.owner === true) u.appendChild(h('li', null, h('a', { class: 't-doc', href: '#master', 'aria-current': /^master(--|$)/.test(raw) ? 'page' : null, html: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 13.5h11M4 13.5V7l4-3.5L12 7v6.5"/><path d="M6.5 13.5v-3h3v3"/></svg><span>Pantalla del máster <small>' + esc(auraTxt(auraNow().tipo, auraNow().nivel)) + '</small></span>' })));
  // the homebrew material switched on (and, for the master, the way to it); its spells must be here for the catalogue
  const hb = hbActive();
  if (hb.length || S.owner === true) {
    const li = h('li', null, h('a', { class: 't-doc', href: '#hb', 'aria-current': raw === 'hb' ? 'page' : null, html: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 2.5h7.5L13 5v8.5H3z"/><path d="M5.5 7h5M5.5 9.5h5M5.5 12h3"/></svg><span>Homebrew' + (hb.length ? ' <small>' + hb.length + (hb.length === 1 ? ' activo' : ' activos') + '</small>' : '') + '</span>' }));
    if (hb.length) li.appendChild(h('ul', null, hb.map(g => h('li', null, h('a', { class: 't-doc t-pj', href: '#hb--' + g.k, 'aria-current': raw === 'hb--' + g.k || raw.startsWith('hb--' + g.k + '--') ? 'page' : null, text: hbTitle(g) })))));
    u.appendChild(li);
  }
  hbSync(sagaChanged);
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

export { glanceNode, homeSaga, liveStats, liveStock, renderSagaSide, visDbRows };
