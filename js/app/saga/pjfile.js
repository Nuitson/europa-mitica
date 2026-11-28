/* Exportar, importar y borrar personajes: un archivo JSON con la ficha, sus estaciones (avance) y su retrato.
   Importar crea siempre un personaje nuevo, en esta saga o en otra: nunca toca los que ya hay. */
import { h } from '../base.js';
import { S, SEASONS, tkey } from './state.js';
import { dbWrite, localDel, localPut, openModal, stamp, toast } from './core.js';
import { canWrite, clone, entriesOf, newId, sname } from './rules.js';

const FORMATO = 'europa-mitica/personaje/1';
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_OPS = 300; // the server takes at most 300 changes per request (api/lib.php, escribir)
// bookkeeping the server and the page add to every document: the importer stamps its own
const SELLO = ['actualizado', 'por', 'creado', '_id'];
const sinSello = o => { const c = clone(o); SELLO.forEach(k => { delete c[k]; }); return c; };
const IMG_OK = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

/* ---------- export: the sheet as it is now, its seasons (oldest first) and the portrait */
function exportPj(id) {
  const pj = S.pj[id];
  if (!pj) { toast('No se encuentra el personaje.'); return; }
  const personaje = sinSello(pj);
  delete personaje.retrato; // travels as an image in «retrato»: its id only means something in this saga
  const estaciones = entriesOf(id).map(e => { const c = sinSello(e); delete c.pj; return c; });
  const img = pj.retrato && pj.retrato.id ? window.EM_WEB.blobUrl(pj.retrato.id) : null;
  const out = { formato: FORMATO, fecha: Date.now(), origen: { saga: window.EM_WEB.saga.nombre || '', id: id }, personaje: personaje, estaciones: estaciones, retrato: img && IMG_OK.test(img) ? img : null };
  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: (tkey(pj.nombre) || 'personaje') + '-' + new Date().toISOString().slice(0, 10) + '.json' });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(pj.nombre + ' exportado' + (estaciones.length ? ' con ' + (estaciones.length === 1 ? '1 estación' : estaciones.length + ' estaciones') : '') + (out.retrato ? ' y su retrato' : '') + '.');
}

/* ---------- import: read and check the file, show what it brings, and create the character on confirmation */
// a sheet from an older version or edited by hand: drop the fields that do not have the shape the page expects
const LISTAS = ['hab', 'hechizos', 'virtudes', 'defectos', 'personalidad', 'formas'];
const OBJETOS = ['car', 'artes', 'heridas'];
const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
function leerArchivo(d) {
  if (!isObj(d)) throw new Error('Ese archivo no es un personaje exportado.');
  if (d.formato === 'europa-mitica/1' && isObj(d.docs)) throw new Error('Ese archivo es la copia de una saga entera: se importa en la pantalla del máster.');
  if (typeof d.formato !== 'string' || !d.formato.startsWith('europa-mitica/personaje/')) throw new Error('Ese archivo no es un personaje exportado.');
  if (d.formato !== FORMATO) throw new Error('Ese personaje se exportó con otra versión de la web (' + d.formato + ').');
  const p = isObj(d.personaje) ? clone(d.personaje) : null;
  const nombre = p && typeof p.nombre === 'string' ? p.nombre.trim() : '';
  if (!nombre) throw new Error('Al personaje del archivo le falta el nombre.');
  SELLO.forEach(k => { delete p[k]; });
  delete p.retrato;
  p.nombre = nombre;
  LISTAS.forEach(k => { if (k in p && !Array.isArray(p[k])) delete p[k]; });
  OBJETOS.forEach(k => { if (k in p && !isObj(p[k])) delete p[k]; });
  // seasons: a valid year and season, one entry per season (the page keys them by character, year and season)
  const vistas = new Set();
  let malas = 0;
  const estaciones = [];
  (Array.isArray(d.estaciones) ? d.estaciones : []).forEach(e => {
    const anio = isObj(e) ? Math.round(Number(e.anio)) : NaN, est = isObj(e) ? Math.round(Number(e.est)) : NaN;
    if (!(anio >= 1 && anio <= 9999) || !(est >= 1 && est <= SEASONS.length) || vistas.has(anio + '-' + est)) { malas++; return; }
    vistas.add(anio + '-' + est);
    const c = clone(e);
    SELLO.forEach(k => { delete c[k]; });
    c.anio = anio; c.est = est;
    if ('reparto' in c && !Array.isArray(c.reparto)) c.reparto = [];
    estaciones.push(c);
  });
  const retrato = typeof d.retrato === 'string' && IMG_OK.test(d.retrato) ? d.retrato : null;
  return { p: p, estaciones: estaciones, malas: malas, retrato: retrato, origen: isObj(d.origen) ? d.origen : {} };
}
function rid(n) { const a = 'abcdefghijklmnopqrstuvwxyz0123456789'; const r = new Uint32Array(n); crypto.getRandomValues(r); return Array.from(r, x => a[x % 36]).join(''); }

async function crearPj(x) {
  const pid = newId(x.p.nombre);
  const pj = clone(x.p);
  // like a new one: a player's starts unpublished, for them and the master only (api/lib.php, leer)
  if (S.owner !== true) pj.publicado = false; else delete pj.publicado;
  const ops = [];
  if (x.retrato) {
    const rp = 'retratos/' + rid(16);
    ops.push(['retratos', rp, { data: x.retrato, tipo: x.retrato.slice(5, x.retrato.indexOf(';')), subido: Date.now() }]);
    pj.retrato = { id: rp };
  }
  ops.unshift(['pj', 'personajes/' + pid, stamp(pj, true)]);
  x.estaciones.forEach(e => ops.push(['av', 'avance/' + pid + '--' + e.anio + '-' + e.est, stamp(Object.assign(clone(e), { pj: pid }), true)]));
  // one request when it fits (all or nothing); a character with a very long history goes in several, the sheet first
  for (let i = 0; i < ops.length; i += MAX_OPS) {
    const part = ops.slice(i, i + MAX_OPS);
    const last = i + MAX_OPS >= ops.length;
    const ok = await dbWrite(() => { const b = S.db.batch(); part.forEach(([, ruta, datos]) => b.set(ruta, datos)); return b.commit(); },
      last ? x.p.nombre + ' importado' + (x.estaciones.length ? ' con ' + (x.estaciones.length === 1 ? '1 estación' : x.estaciones.length + ' estaciones') : '') + '.' : null);
    if (!ok) {
      if (i) toast(x.p.nombre + ' se ha creado, pero faltan estaciones: ' + (ops.length - i) + ' cambios no se han guardado. Bórralo y vuelve a importarlo.');
      return i ? pid : null;
    }
    part.forEach(([key, ruta, datos]) => { if (key !== 'retratos') localPut(key, ruta.slice(ruta.indexOf('/') + 1), datos); });
  }
  return pid;
}

/* ---------- delete: the sheet with its seasons and its portrait; its laboratory stays in the covenant, free.
   The vis and treasury movements stay too: they are the covenant's stores, not the character's */
async function borrarPj(id) {
  const pj = S.pj[id];
  if (!pj) { toast('No se encuentra el personaje.'); return false; }
  const nombre = pj.nombre || 'el personaje';
  const ops = entriesOf(id).map(e => ['av', 'avance/' + e._id]);
  const ret = pj.retrato && pj.retrato.id;
  if (ret && !Object.keys(S.pj).some(k => k !== id && S.pj[k].retrato && S.pj[k].retrato.id === ret)) ops.push(['retratos', ret]);
  Object.keys(S.lab).forEach(k => { if (S.lab[k].dueno === id) ops.push(['lab', 'laboratorios/' + k, Object.assign({}, S.lab[k], { dueno: '' })]); });
  ops.push(['pj', 'personajes/' + id]); // the sheet last: if a very long history needs several requests and one fails, «Borrar» again finishes it
  for (let i = 0; i < ops.length; i += MAX_OPS) {
    const part = ops.slice(i, i + MAX_OPS);
    const last = i + MAX_OPS >= ops.length;
    const ok = await dbWrite(() => { const b = S.db.batch(); part.forEach(([, ruta, datos]) => { if (datos) b.set(ruta, datos); else b.delete(ruta); }); return b.commit(); },
      last ? 'Personaje borrado: ' + nombre + '.' : null);
    if (!ok) {
      if (i) toast('No se ha terminado de borrar a ' + nombre + ': vuelve a pulsar «Borrar».');
      return false;
    }
    part.forEach(([key, ruta, datos]) => { if (key === 'retratos') return; const k = ruta.slice(ruta.indexOf('/') + 1); if (datos) localPut(key, k, datos); else localDel(key, k); });
  }
  return true;
}

function importDialog(x) {
  const p = x.p, n = x.estaciones.length;
  const repe = Object.keys(S.pj).filter(k => tkey(S.pj[k].nombre) === tkey(p.nombre)).length;
  const desde = x.origen.saga && x.origen.saga !== (window.EM_WEB.saga.nombre || '') ? ' Viene de «' + x.origen.saga + '».' : '';
  const span = n ? sname(x.estaciones[0].anio, x.estaciones[0].est) + (n > 1 ? ' – ' + sname(x.estaciones[n - 1].anio, x.estaciones[n - 1].est) : '') : '';
  const body = [
    h('p', null, [h('b', { text: p.nombre }), [p.tipo, p.casa].filter(Boolean).length ? ' · ' + [p.tipo, p.casa].filter(Boolean).join(', ') : '']),
    h('ul', { class: 'imp-list' }, [
      h('li', { text: n ? (n === 1 ? '1 estación' : n + ' estaciones') + ' (' + span + ')' : 'Sin estaciones registradas' }),
      h('li', { text: (p.hechizos || []).length ? (p.hechizos.length === 1 ? '1 hechizo' : p.hechizos.length + ' hechizos') : 'Sin hechizos' }),
      h('li', { text: x.retrato ? 'Con retrato' : 'Sin retrato' })]),
    h('p', { class: 'fh', text: 'Se crea como un personaje nuevo, a tu nombre; no cambia ningún personaje que ya esté en la saga.' + desde }),
    repe ? h('p', { class: 'note warn', text: 'Ya hay ' + (repe === 1 ? 'un personaje' : repe + ' personajes') + ' con ese nombre en la saga: tendrás los dos.' }) : null,
    x.malas ? h('p', { class: 'note warn', text: (x.malas === 1 ? 'Una estación' : x.malas + ' estaciones') + ' del archivo no se importan: sin año o estación válidos, o repetidas.' }) : null];
  const go = h('button', { type: 'button', class: 'btn' }, 'Importar');
  const close = openModal('Importar personaje', body, [go, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')]);
  go.addEventListener('click', async () => {
    go.disabled = true;
    const pid = await crearPj(x);
    go.disabled = false;
    if (!pid) return;
    close();
    location.hash = '#pj--' + pid;
  });
}

/* the «Importar personaje» button and its hidden file field */
function importButton() {
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, 'aria-label': 'Archivo del personaje' });
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    if (!canWrite()) { toast('No tienes permiso para crear personajes en esta saga.'); return; }
    if (f.size > MAX_BYTES) { toast('El archivo es demasiado grande para ser un personaje.'); return; }
    let x;
    try {
      let d;
      try { d = JSON.parse(await f.text()); } catch (e) { throw new Error('Ese archivo no es un personaje exportado.'); }
      x = leerArchivo(d);
    } catch (e) { toast(e.message); return; }
    importDialog(x);
  });
  return [h('button', { type: 'button', class: 'btn ghost', onclick: () => file.click() }, 'Importar personaje'), file];
}

export { borrarPj, exportPj, importButton };
