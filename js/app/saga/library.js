/* Biblioteca de la alianza: los textos de laboratorio de la saga (textos/{id}) y lo que cada mago puede leer de ellos.
   Un texto es el de un hechizo (nombre, Técnica, Forma, nivel y sus parámetros), en un idioma (latín, griego, árabe…), y
   puede estar en las notas cifradas de su autor (ArM5 p. 161): para usarlo, otro mago tiene que descifrarlo antes en el
   laboratorio o leer una traducción. Leer un texto pide 4 o más en su idioma (ArM5 p. 164). Las estaciones (seasons.js)
   aprenden, inventan, descifran y traducen textos de aquí. */
import { ABBR, ARTS_F, ARTS_T, artOf, h } from '../base.js';
import { page } from '../views.js';
import { S, tkey } from './state.js';
import { canWrite, entriesOf, habLevel, numv } from './rules.js';
import { confirmButton, datalist, dbWrite, field, inp, localDel, localPut, openModal, pjsSorted, sagaCrumbs, sel, stamp, statusNote, toast } from './core.js';
import { hechCat } from '../info.js';

const IDIOMAS = ['Latín', 'Griego', 'Árabe', 'Hebreo'];
const LEER = 4; // score in the language needed to read a text
const tefo = t => (ABBR[artOf(t.tec)] || '?') + (ABBR[artOf(t.forma)] || '?');
const txLabel = t => (t.n || 'Sin nombre') + ' (' + tefo(t) + ' ' + (t.nivel || '?') + ')';
const autorKey = t => tkey(t.autorPj || t.autor || '');
const autorTxt = t => (t.autorPj && S.pj[t.autorPj] ? S.pj[t.autorPj].nombre : t.autor) || 'su autor';
function txList() {
  return Object.keys(S.tx).map(id => Object.assign({ _id: id }, S.tx[id]))
    .sort((a, b) => tefo(a).localeCompare(tefo(b)) || numv(a.nivel) - numv(b.nivel) || String(a.n || '').localeCompare(String(b.n || ''), 'es'));
}

/* the ciphers a magus has broken: { autorKey: highest level deciphered }. Deciphering a text takes seasons of Lab Total
   points (lab.tipo «descifrar»); once they reach its level, the magus reads that author's notes up to that level */
function cifrasDe(pjId, skip) {
  const acc = new Map(), out = {};
  entriesOf(pjId).forEach(e => {
    const L = e.lab;
    if (!L || L.tipo !== 'descifrar' || !L.texto || (skip && e._id === skip)) return;
    const a = acc.get(L.texto) || { pts: 0, nivel: numv(L.nivel), autor: L.autor || '' };
    a.pts += numv(L.puntos);
    acc.set(L.texto, a);
  });
  acc.forEach(a => { if (a.autor && a.nivel && a.pts >= a.nivel) out[a.autor] = Math.max(out[a.autor] || 0, a.nivel); });
  return out;
}
/* what stops a magus from working from a text: [] when nothing does. c: calc() of the magus; cif: cifrasDe() */
function txProblems(pjId, t, c, cif) {
  const out = [];
  if (t.cifrado && autorKey(t) !== tkey(pjId) && (cif[autorKey(t)] || 0) < numv(t.nivel))
    out.push('está en las notas cifradas de ' + autorTxt(t) + ': hay que descifrarlo o traducirlo antes');
  const idi = t.idioma || 'Latín', lv = habLevel(c, idi);
  if (lv < LEER) out.push('pide ' + LEER + ' en ' + idi + ' para leerlo (tiene ' + lv + ')');
  return out;
}
const ownNotes = (pjId, t) => !!t.cifrado && autorKey(t) === tkey(pjId);

/* one line for a season's lab work: «Aprende Pilum de fuego (CrIg 20)», «Inventa … · 12 de 25 puntos» */
function labSummary(e) {
  const L = e && e.lab;
  if (!L) return '';
  if (L.tipo === 'aprender') return 'Aprende de textos: ' + ((L.hechizos || []).join(', ') || 'ningún hechizo') + (L.total != null ? ' · Total de Laboratorio ' + L.total : '');
  if (L.tipo === 'inventar') return 'Inventa ' + txLabel(L.hechizo || {}) + ' · ' + numv(L.acumulado) + ' de ' + numv((L.hechizo || {}).nivel) + ' puntos' + (L.fin ? ' · terminado' : '');
  if (L.tipo === 'descifrar') return 'Descifra ' + (L.nombre || 'un texto') + ' de ' + (L.autorTxt || 'otro mago') + ' · ' + numv(L.acumulado) + ' de ' + numv(L.nivel) + ' puntos' + (numv(L.acumulado) >= numv(L.nivel) ? ' · descifrado' : '');
  if (L.tipo === 'traducir') return 'Traduce al latín: ' + ((L.textos || []).map(x => x.n).join(', ') || 'ningún texto');
  return '';
}

/* ---------- the library page */
function viewLibrary() {
  page.innerHTML = '';
  page.appendChild(sagaCrumbs([['Biblioteca', null]]));
  page.appendChild(h('h1', { class: 'doc-title', text: 'Biblioteca' }));
  document.title = 'Biblioteca — Europa Mítica';
  page.appendChild(h('p', { class: 'doc-blurb', text: 'Los textos de laboratorio de la alianza. Con un texto, un mago aprende el hechizo en una estación si su Total de Laboratorio llega a su nivel; las notas cifradas de otro mago hay que descifrarlas o traducirlas antes, y leer un texto pide 4 en su idioma. Lo que se inventa en las estaciones entra aquí solo.' }));
  if (canWrite()) page.appendChild(h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: () => openTextEditor(null) }, 'Añadir texto')));
  const content = h('div', { class: 'content', style: 'margin-top:18px' });
  const note = statusNote(); if (note) content.appendChild(note);
  const L = txList();
  if (!L.length) { content.appendChild(h('p', { class: 'note', text: 'Todavía no hay textos de laboratorio en la biblioteca.' })); page.appendChild(content); return; }
  content.appendChild(h('p', { class: 'fh', text: L.length + (L.length === 1 ? ' texto · ' : ' textos · ') + L.reduce((s, t) => s + numv(t.nivel), 0) + ' niveles · ' + L.filter(t => t.cifrado).length + ' en notas cifradas' }));
  const tb = h('tbody');
  L.forEach(t => tb.appendChild(h('tr', { 'data-k': 'tx.' + t._id }, [
    h('td', null, [h('b', { text: t.n || 'Sin nombre' }), t.nota ? h('div', { class: 'note', text: t.nota }) : null]),
    h('td', { class: 'nw', text: tefo(t) }),
    h('td', { class: 'num', text: String(t.nivel || '') }),
    h('td', { text: t.idioma || 'Latín' }),
    h('td', { text: t.cifrado ? 'Notas cifradas' : 'Legible' }),
    h('td', { text: t.autor || (t.autorPj && S.pj[t.autorPj] ? S.pj[t.autorPj].nombre : '') }),
    canWrite() ? h('td', { class: 'act' }, h('button', { type: 'button', class: 'lnk', onclick: () => openTextEditor(t._id) }, 'Editar')) : null])));
  content.appendChild(h('div', { class: 'tw' }, h('table', { class: 'mini' }, [
    h('thead', null, h('tr', null, ['Hechizo', 'Arte', 'Nivel', 'Idioma', 'Estado', 'Autor'].concat(canWrite() ? [''] : []).map(x => h('th', { scope: 'col', text: x })))), tb])));
  page.appendChild(content);
}

/* ---------- a text: add, change or delete */
function openTextEditor(id) {
  const ex = id ? S.tx[id] : null;
  const d = Object.assign({ n: '', tec: '', forma: '', nivel: '', alc: '', dur: '', obj: '', idioma: 'Latín', cifrado: false, autor: '', nota: '' }, ex || {});
  if (!d.autor && d.autorPj && S.pj[d.autorPj]) d.autor = S.pj[d.autorPj].nombre;
  const cat = hechCat();
  const dlH = cat.list.length ? datalist('dl-tx-hech', cat.list.map(x => x.n)) : null;
  const magi = pjsSorted(true).filter(p => /^(Magus|Maga|Aprendiz)$/.test(p.tipo || ''));
  const dlA = datalist('dl-tx-autor', magi.map(p => p.nombre));
  const dlI = datalist('dl-tx-idioma', IDIOMAS);
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
  const cif = h('input', { type: 'checkbox', checked: d.cifrado ? true : null, onchange: ev => { d.cifrado = ev.target.checked; } });
  const body = [
    field('Hechizo', nameI),
    h('div', { class: 'fld-row tri' }, [field('Técnica', tecS), field('Forma', forS), field('Nivel', nivI)]),
    h('div', { class: 'fld-row tri' }, [field('Alcance', alcI), field('Duración', durI), field('Objetivo', objI)]),
    h('div', { class: 'fld-row' }, [field('Idioma', inp(d.idioma, v => { d.idioma = v; }, { list: dlI, autocomplete: 'off' })), field('Autor', inp(d.autor, v => { d.autor = v; }, { list: dlA, autocomplete: 'off', placeholder: 'Un mago de la saga u otro' }))]),
    field('Estado', h('label', { class: 'chk' }, [cif, h('span', { text: 'En las notas cifradas de su autor' })]), 'Sin marcar: transcrito para que cualquiera que sepa el idioma pueda usarlo.'),
    field('Nota', inp(d.nota, v => { d.nota = v; }, { placeholder: 'De dónde viene, en qué estado está…' }))];
  const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const actions = [save, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')];
  if (ex) actions.push(confirmButton('Borrar', 'Pulsa otra vez para borrar', async () => { if (await dbWrite(() => S.db.doc('textos/' + id).delete(), 'Texto borrado')) { localDel('tx', id); close(); } }));
  const close = openModal(ex ? 'Texto de laboratorio' : 'Nuevo texto de laboratorio', body, actions);
  save.addEventListener('click', async () => {
    const n = String(d.n || '').trim(), nivel = parseInt(d.nivel, 10);
    if (!n) { toast('Escribe el nombre del hechizo.'); return; }
    if (!artOf(d.tec) || !artOf(d.forma)) { toast('Elige la Técnica y la Forma.'); return; }
    if (!(nivel > 0)) { toast('Indica el nivel del hechizo.'); return; }
    const autor = String(d.autor || '').trim(), pa = magi.find(p => tkey(p.nombre) === tkey(autor));
    const out = { n: n, tec: artOf(d.tec), forma: artOf(d.forma), nivel: nivel, alc: String(d.alc || '').trim(), dur: String(d.dur || '').trim(), obj: String(d.obj || '').trim(),
      idioma: String(d.idioma || '').trim() || 'Latín', cifrado: !!d.cifrado, autor: autor, nota: String(d.nota || '').trim() };
    if (pa) out.autorPj = pa._id;
    ['cat', 'ritual', 'origen'].forEach(k => { if (d[k]) out[k] = d[k]; });
    if (ex && ex.creado) out.creado = ex.creado;
    const ref = ex ? S.db.doc('textos/' + id) : S.db.collection('textos').doc();
    save.disabled = true;
    const ok = await dbWrite(() => ref.set(stamp(out, !ex)), 'Texto guardado');
    save.disabled = false;
    if (ok) { localPut('tx', ref.id, out); close(); }
  });
}

export { autorKey, autorTxt, cifrasDe, IDIOMAS, labSummary, ownNotes, tefo, txLabel, txList, txProblems, viewLibrary, openTextEditor };
