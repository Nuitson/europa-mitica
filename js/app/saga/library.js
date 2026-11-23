/* La biblioteca de la alianza para el trabajo de laboratorio: la hoja «Textos de laboratorio» de la biblioteca de la saga
   (en Arazas, la Biblioteca de Duxmollis, del archivo de la saga) y, encima, lo que han hecho las estaciones: quién ha
   agotado (aprendido) cada texto, los que se han traducido al latín y los hechizos inventados, más los textos que se
   añaden a mano en la web (textos/{id}). Todo se calcula a partir de las estaciones, así que borrar una lo deshace.
   La columna Idioma dice en qué está el texto: «Latín» (o griego, árabe…) es legible para quien sepa el idioma a 4
   (ArM5 p. 164); el nombre de un mago («Nuit ex Merenita») son sus notas cifradas, que otro tiene que descifrar o
   traducir antes (ArM5 p. 161). «Agotado por» lleva los nombres de pila de quien ya lo ha aprendido. */
import { ABBR, ARTS_F, ARTS_T, artOf, DOCS, h, R } from '../base.js';
import { S, tkey } from './state.js';
import { canWrite, numv, sname, skey } from './rules.js';
import { confirmButton, datalist, dbWrite, field, inp, localDel, localPut, openModal, pjsSorted, sel, stamp, toast } from './core.js';
import { hechCat } from '../info.js';

const IDIOMAS = ['Latín', 'Griego', 'Árabe', 'Hebreo'];
const LEER = 4; // score in the language needed to read a text
// the library sheet's columns, by the field each one fills
const COL = { n: 'Efecto', autor: 'Autor/Escriba', idioma: 'Idioma', tec: 'Técnica', forma: 'Forma', nivel: 'Nivel', alc: 'Alcance', dur: 'Duración', obj: 'Objetivo',
  pag: 'Página', prop: 'Propietario', agotado: 'Agotado por', ritual: 'Ritual', req: 'Requisitos' };
const isLibTable = b => !!b && b.t === 'table' && Array.isArray(b.cols) && ['Efecto', 'Técnica', 'Forma', 'Nivel', 'Idioma', 'Agotado por'].every(c => b.cols.includes(c));
/* the saga's library sheet of lab texts: { doc, sheet, block } or null */
function libSheet() {
  for (const id in DOCS) {
    const d = DOCS[id];
    if (!d.saga || d.kind !== 'biblioteca') continue;
    for (const sh of d.sheets) { const b = sh.blocks.find(isLibTable); if (b) return { doc: d, sheet: sh, block: b }; }
  }
  return null;
}
const first = s => tkey(String(s || '').trim().split(/\s+/)[0]);   // «Nuit ex Merenita» → «nuit»
const names = s => Array.isArray(s) ? s.slice() : String(s || '').split(/\s*[,;]\s*|\s+y\s+/).map(x => x.trim()).filter(Boolean);
const tefo = t => (ABBR[artOf(t.tec)] || '?') + (ABBR[artOf(t.forma)] || '?');
const txLabel = t => (t.n || 'Sin nombre') + ' (' + tefo(t) + ' ' + (t.nivel || '?') + ')';
/* whose notes a text is in, when the Idioma column holds a magus («Nuit ex Merenita») and not a language */
function cipherOf(t) {
  const v = String(t.idioma || '').trim();
  if (!v) return '';
  if (/\sex\s/i.test(v) || (t.autor && tkey(v) === tkey(t.autor)) || Object.values(S.pj).some(p => first(p.nombre) === first(v) && /^(Magus|Aprendiz)$/.test(p.tipo || ''))) return v;
  return '';
}
const ownNotes = (pj, t) => !!t.cifra && first(t.cifra) === first(pj && pj.nombre);
const hasUsed = (pj, t) => (t.agotado || []).some(n => first(n) === first(pj && pj.nombre));

/* every text, with what the seasons did (in their order); skip: an entry to leave out (the one being edited) */
function txList(skip) {
  const out = [], byId = new Map();
  const put = t => { t.cifra = cipherOf(t); out.push(t); byId.set(t._id, t); };
  const L = libSheet();
  if (L) {
    const b = L.block, ix = {};
    Object.keys(COL).forEach(k => { ix[k] = b.cols.indexOf(COL[k]); });
    const seen = {};
    b.rows.forEach((r, i) => {
      const t = { _id: '', fila: i, src: 'hoja' };
      Object.keys(ix).forEach(k => { if (ix[k] >= 0) t[k] = String(r[ix[k]] == null ? '' : r[ix[k]]).trim(); });
      t.nivel = numv(t.nivel);
      t.tec = artOf(t.tec) || t.tec; t.forma = artOf(t.forma) || t.forma;
      t.ritual = /^s[ií]/i.test(t.ritual || '');
      t.agotado = names(t.agotado);
      const k = 'a:' + tkey(t.n) + '-' + t.nivel + '-' + first(t.autor);
      seen[k] = (seen[k] || 0) + 1;
      t._id = seen[k] > 1 ? k + '~' + seen[k] : k;
      put(t);
    });
  }
  Object.keys(S.tx).forEach(id => {
    const d = S.tx[id];
    put(Object.assign({}, d, { _id: 'tx:' + id, doc: id, src: 'web', nivel: numv(d.nivel), agotado: names(d.agotado) }));
  });
  // the seasons, oldest first: inventions add their text, learning marks it used, translations put it in Latin
  Object.keys(S.av).filter(id => id !== skip && S.av[id].lab).map(id => Object.assign({ _id: id }, S.av[id]))
    .sort((x, y) => skey(x.anio, x.est) - skey(y.anio, y.est)).forEach(e => {
      const L2 = e.lab, pj = S.pj[e.pj] || {}, who = String(pj.nombre || '').trim();
      if (L2.tipo === 'inventar' && L2.fin && L2.hechizo) {
        put(Object.assign({}, L2.hechizo, { _id: 'inv:' + e._id, src: 'estacion', autor: who, idioma: who, prop: who, agotado: [who.split(/\s+/)[0]],
          nivel: numv(L2.hechizo.nivel), nota: 'Inventado en ' + sname(e.anio, e.est) }));
      } else if (L2.tipo === 'aprender') (L2.textos || []).forEach(id => { const t = byId.get(id); if (t && !hasUsed(pj, t)) t.agotado = t.agotado.concat(who.split(/\s+/)[0]); });
      else if (L2.tipo === 'traducir') (L2.textos || []).forEach(x => { const t = byId.get(x.id || x); if (t) { t.idioma = 'Latín'; t.cifra = ''; t.traducido = sname(e.anio, e.est); } });
    });
  return out;
}

/* the ciphers a magus has broken: { first name of the cipher's magus: highest level deciphered }. Deciphering a text takes
   seasons of Lab Total points (lab.tipo «descifrar»); once they reach its level, the magus reads that author's notes up to it */
function cifrasDe(pjId, skip) {
  const acc = new Map(), out = {};
  Object.keys(S.av).forEach(id => {
    const e = S.av[id], L = e.lab;
    if (e.pj !== pjId || id === skip || !L || L.tipo !== 'descifrar' || !L.texto) return;
    const a = acc.get(L.texto) || { pts: 0, nivel: numv(L.nivel), autor: L.autor || '' };
    a.pts += numv(L.puntos);
    acc.set(L.texto, a);
  });
  acc.forEach(a => { if (a.autor && a.nivel && a.pts >= a.nivel) out[a.autor] = Math.max(out[a.autor] || 0, a.nivel); });
  return out;
}
/* what stops a magus from working from a text: [] when nothing does. c: calc() of the magus; cif: cifrasDe(); lvl(c, n): an
   Ability's score (rules.habLevel) */
function txProblems(pj, t, c, cif, lvl) {
  const out = [];
  if (t.cifra && !ownNotes(pj, t)) {
    if ((cif[first(t.cifra)] || 0) < numv(t.nivel)) out.push('está en las notas cifradas de ' + t.cifra + ': hay que descifrarlo o traducirlo antes');
    return out;
  }
  const idi = t.cifra ? 'Latín' : (t.idioma || 'Latín'), lv = lvl(c, idi);
  if (lv < LEER) out.push('pide ' + LEER + ' en ' + idi + ' para leerlo (tiene ' + lv + ')');
  return out;
}

/* one line for a season's lab work: «Aprende Pilum de fuego (CrIg 20)», «Inventa … · 12 de 25 puntos» */
function labSummary(e) {
  const L = e && e.lab;
  if (!L) return '';
  if (L.tipo === 'aprender') return 'Aprende de textos: ' + ((L.hechizos || []).join(', ') || 'ningún hechizo') + (L.total != null ? ' · Total de Laboratorio ' + L.total : '');
  if (L.tipo === 'inventar') return 'Inventa ' + txLabel(L.hechizo || {}) + ' · ' + numv(L.acumulado) + ' de ' + numv((L.hechizo || {}).nivel) + ' puntos' + (L.fin ? ' · terminado' : '');
  if (L.tipo === 'descifrar') return 'Descifra ' + (L.nombre || 'un texto') + ' de ' + (L.autorTxt || 'otro mago') + ' · ' + numv(L.acumulado) + ' de ' + numv(L.nivel) + ' puntos' + (numv(L.acumulado) >= numv(L.nivel) ? ' · descifrado' : '');
  if (L.tipo === 'traducir') return 'Traduce al latín: ' + ((L.textos || []).map(x => x.n || x).join(', ') || 'ningún texto');
  return '';
}

/* ---------- the library sheet in the web: its rows with what the seasons did, and the texts added here */
R.tableRows = (b, ctx) => {
  if (!ctx || !ctx.doc || !ctx.doc.saga || ctx.doc.kind !== 'biblioteca' || !isLibTable(b)) return null;
  const rows = txList().map(t => b.cols.map(c => {
    const k = Object.keys(COL).find(x => COL[x] === c);
    if (!k) return '';
    if (k === 'agotado') return t.agotado.join(', ');
    if (k === 'ritual') return t.ritual ? 'Sí' : 'No';
    if (k === 'nivel') return t.nivel ? String(t.nivel) : '';
    return t[k] == null ? '' : String(t[k]);
  }));
  return { rows: rows, foot: libFoot };
};
R.tableRows.is = isLibTable;
function libFoot() {
  const L = txList(), web = L.filter(t => t.src === 'web'), est = L.filter(t => t.src === 'estacion');
  const box = h('div', { class: 'lib-foot' }, [h('p', { class: 'fh', text: 'La tabla junta la hoja de Drive con lo que se hace en las estaciones de la web: quién agota cada texto, los que se traducen al latín y ' +
    (est.length ? (est.length === 1 ? 'el hechizo inventado' : 'los ' + est.length + ' hechizos inventados') : 'los hechizos inventados') + (web.length ? ', más ' + (web.length === 1 ? 'un texto añadido' : web.length + ' textos añadidos') + ' aquí' : '') + '. La hoja de Drive no cambia.' })]);
  if (canWrite()) {
    const row = h('div', { class: 'actions' }, [h('button', { type: 'button', class: 'btn ghost', onclick: () => openTextEditor(null) }, 'Añadir texto')]);
    web.forEach(t => row.appendChild(h('button', { type: 'button', class: 'lnk', onclick: () => openTextEditor(t.doc) }, 'Editar ' + txLabel(t))));
    box.appendChild(row);
  }
  return box;
}

/* ---------- a text added in the web: one the covenant gets (bought, copied, a gift…) */
function openTextEditor(id) {
  const ex = id ? S.tx[id] : null;
  const d = Object.assign({ n: '', tec: '', forma: '', nivel: '', alc: '', dur: '', obj: '', idioma: 'Latín', autor: '', prop: 'Alianza', nota: '' }, ex || {});
  const cat = hechCat();
  const dlH = cat.list.length ? datalist('dl-tx-hech', cat.list.map(x => x.n)) : null;
  const magi = pjsSorted(true).filter(p => /^(Magus|Aprendiz)$/.test(p.tipo || '')).map(p => p.nombre);
  const dlA = datalist('dl-tx-autor', magi);
  const dlI = datalist('dl-tx-idioma', IDIOMAS.concat(magi));
  const tecS = sel([['', '—']].concat(ARTS_T), d.tec, v => { d.tec = v; }, { 'aria-label': 'Técnica' });
  const forS = sel([['', '—']].concat(ARTS_F), d.forma, v => { d.forma = v; }, { 'aria-label': 'Forma' });
  const nivI = inp(d.nivel, v => { d.nivel = v; }, { type: 'number', min: '1', inputmode: 'numeric' });
  const alcI = inp(d.alc, v => { d.alc = v; }), durI = inp(d.dur, v => { d.dur = v; }), objI = inp(d.obj, v => { d.obj = v; });
  const nameI = inp(d.n, v => { d.n = v; }, { list: dlH, placeholder: dlH ? 'Nombre (o elige del catálogo)' : 'Nombre del hechizo', autocomplete: 'off' });
  // a name from the catalogue fills in the rest
  nameI.addEventListener('change', () => {
    const e = (cat.byKey.get(tkey(nameI.value)) || [])[0];
    if (!e) return;
    d.cat = e.id;
    if (!d.tec) { d.tec = e.tec; tecS.value = e.tec; }
    if (!d.forma) { d.forma = e.forma; forS.value = e.forma; }
    if (!d.nivel && String(e.nivel) !== 'Gen') { d.nivel = e.nivel; nivI.value = e.nivel; }
    [['alc', alcI], ['dur', durI], ['obj', objI]].forEach(([k, el]) => { if (!d[k] && e[k]) { d[k] = e[k]; el.value = e[k]; } });
    if (e.rit) d.ritual = true;
  });
  const body = [
    field('Efecto', nameI),
    h('div', { class: 'fld-row tri' }, [field('Técnica', tecS), field('Forma', forS), field('Nivel', nivI)]),
    h('div', { class: 'fld-row tri' }, [field('Alcance', alcI), field('Duración', durI), field('Objetivo', objI)]),
    h('div', { class: 'fld-row' }, [field('Idioma', inp(d.idioma, v => { d.idioma = v; }, { list: dlI, autocomplete: 'off' }), 'Latín u otro idioma; el nombre de un mago si son sus notas cifradas.'),
      field('Autor o escriba', inp(d.autor, v => { d.autor = v; }, { list: dlA, autocomplete: 'off' }))]),
    h('div', { class: 'fld-row' }, [field('Propietario', inp(d.prop, v => { d.prop = v; })), field('Nota', inp(d.nota, v => { d.nota = v; }, { placeholder: 'De dónde viene…' }))])];
  const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const actions = [save, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')];
  if (ex) actions.push(confirmButton('Borrar', 'Pulsa otra vez para borrar', async () => { if (await dbWrite(() => S.db.doc('textos/' + id).delete(), 'Texto borrado')) { localDel('tx', id); close(); } }));
  const close = openModal(ex ? 'Texto de laboratorio' : 'Nuevo texto de laboratorio', body, actions);
  save.addEventListener('click', async () => {
    const n = String(d.n || '').trim(), nivel = parseInt(d.nivel, 10);
    if (!n) { toast('Escribe el efecto (el nombre del hechizo).'); return; }
    if (!artOf(d.tec) || !artOf(d.forma)) { toast('Elige la Técnica y la Forma.'); return; }
    if (!(nivel > 0)) { toast('Indica el nivel del hechizo.'); return; }
    const out = { n: n, tec: artOf(d.tec), forma: artOf(d.forma), nivel: nivel, alc: String(d.alc || '').trim(), dur: String(d.dur || '').trim(), obj: String(d.obj || '').trim(),
      idioma: String(d.idioma || '').trim() || 'Latín', autor: String(d.autor || '').trim(), prop: String(d.prop || '').trim(), nota: String(d.nota || '').trim() };
    ['cat', 'ritual', 'agotado'].forEach(k => { if (d[k]) out[k] = d[k]; });
    if (ex && ex.creado) out.creado = ex.creado;
    const ref = ex ? S.db.doc('textos/' + id) : S.db.collection('textos').doc();
    save.disabled = true;
    const ok = await dbWrite(() => ref.set(stamp(out, !ex)), 'Texto guardado');
    save.disabled = false;
    if (ok) { localPut('tx', ref.id, out); close(); }
  });
}

export { cifrasDe, first, hasUsed, IDIOMAS, labSummary, libSheet, ownNotes, tefo, txLabel, txList, txProblems };
