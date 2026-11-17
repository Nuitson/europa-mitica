/* Estaciones: reparto de experiencia, vis y tesorería. */
import { ABBR, artOf, ARTS, artVar, DOCS, esc, fmt, h, R, signed, toNum } from '../base.js';
import { page } from '../views.js';
import { ABIL_STD, ACT_TIPOS, S, SEASONS, tkey } from './state.js';
import { allSeen, confirmButton, datalist, dbWrite, field, inp, localDel, localPut, monogram, openModal, pjLink, pjsSorted, repChips, sagaChanged, sagaCrumbs, seasonPicker, sel, stamp, statusNote, sumRep, toast } from './core.js';
import { abLvl, artLvl, calc, canWrite, clone, curSeason, entriesOf, numv, sagaAura, skey, sname, snext, sprev, traitLevel } from './rules.js';

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
  // the saga's season and the covenant aura are the master's to change
  const master = canWrite() && S.owner === true;
  if (master) meta.appendChild(h('button', { type: 'button', class: 'lnk', onclick: editAura }, 'Cambiar aura'));
  page.appendChild(meta);
  if (canWrite()) {
    const actions = h('div', { class: 'actions' });
    if (isCur) {
      if (master) actions.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => advanceSeason(a, e) }, 'Pasar a ' + sname(na, ne)));
      if (pending && pjs.length) actions.appendChild(h('span', { class: 'fh', text: pending === 1 ? 'Queda 1 personaje sin reparto en esta estación.' : 'Quedan ' + pending + ' personajes sin reparto en esta estación.' }));
    } else if (master) actions.appendChild(h('button', { type: 'button', class: 'btn ghost', onclick: () => setCurrent(a, e) }, 'Marcar como estación actual'));
    if (actions.firstChild) page.appendChild(actions);
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
  // the saga's state has not arrived yet: writing now would rebuild it from defaults and lose the scene aura
  if (!S.seen.estado) { toast('Espera a que lleguen los datos de la saga y vuelve a intentarlo.'); return false; }
  if (S.owner !== true) { toast('Solo el máster puede cambiar la estación y el aura de la saga.'); return false; }
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
    // moved to another season: the new entry and the removal of the old one go in one request, never half of it
    const ok = await dbWrite(() => {
      const b = S.db.batch();
      b.set('avance/' + id, stamp(out, !existing));
      if (existing && id !== origId) b.delete('avance/' + origId);
      return b.commit();
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

export { openTesEditor, openVisEditor, openXpEditor, tesMiniTable, viewSeasons, writeEstado };
