/* La crónica de la saga (cronica/{id}): una entrada por aventura o por estación, con su estación, título, texto y, si se
   quiere, una imagen (guardada como los retratos, en retratos/{id}). Se ve como un cronograma: una barra con un punto por
   entrada, de la más antigua a la más reciente, y debajo la línea de tiempo con cada una; la imagen se amplía al pulsarla.
   «Importar resúmenes» crea varias de golpe a partir de archivos de texto (.txt o .md) y sus imágenes: cada texto da una
   entrada, su título sale de la primera línea y la estación, de lo que diga el texto («Primavera de 1225»); una imagen
   con el mismo nombre que un texto va con él. Todo se revisa antes de guardarlo. */
import { h, norm } from '../base.js';
import { lightbox, zoomImg } from '../blocks.js';
import { page } from '../views.js';
import { S, SEASONS } from './state.js';
import { confirmButton, dbWrite, field, inp, localDel, localPut, openModal, sagaCrumbs, seasonPicker, shrinkImage, stamp, statusNote, toast } from './core.js';
import { canWrite, curSeason, numv, skey, sname } from './rules.js';

const IMG_MAX = 1280;   // the longest side of a chronicle image, in pixels: big enough to be enlarged
const SUBIDAS = {};     // the images just uploaded, until the saga's data brings them
const imgSrc = x => (x && x.img && x.img.id ? SUBIDAS[x.img.id] || window.EM_WEB.blobUrl(x.img.id) || null : null);
const parrafos = t => String(t || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
const orden = (a, b) => skey(a.anio, a.est) - skey(b.anio, b.est) || numv(a.creado) - numv(b.creado);

/* ---------- the page: the timeline bar and the entries, from the oldest */
function viewCronica() {
  page.innerHTML = '';
  page.appendChild(sagaCrumbs([['Alianza', null], ['Crónica', null]]));
  page.appendChild(h('h1', { class: 'doc-title', text: 'Crónica' }));
  document.title = 'Crónica — Europa Mítica';
  page.appendChild(h('p', { class: 'doc-blurb', text: 'Lo que ha pasado en la saga, aventura a aventura, de la más antigua a la más reciente.' }));
  if (canWrite()) page.appendChild(h('div', { class: 'actions' }, [h('button', { type: 'button', class: 'btn', onclick: () => openCroEditor(null) }, 'Añadir a la crónica'),
    h('button', { type: 'button', class: 'btn ghost', onclick: () => openImport() }, 'Importar resúmenes')]));
  const content = h('div', { class: 'content', style: 'margin-top:18px' });
  const note = statusNote(); if (note) content.appendChild(note);
  const L = Object.keys(S.cro).map(id => Object.assign({ _id: id }, S.cro[id])).sort(orden);
  if (!L.length) {
    content.appendChild(h('p', { class: 'note', text: 'La crónica está vacía: cuenta aquí lo que pase en la saga, o importa los resúmenes de las aventuras.' }));
    page.appendChild(content);
    return;
  }
  content.appendChild(cronograma(L));
  const tl = h('div', { class: 'cro-tl' });
  let year = null;
  L.forEach(x => {
    if (x.anio !== year) { year = x.anio; tl.appendChild(h('h2', { class: 'cro-y', id: 'cro-y-' + year, text: String(year) })); }
    const src = imgSrc(x), titulo = x.titulo || sname(x.anio, x.est);
    let fig = null;
    if (src) {
      const img = h('img', { src: src, alt: 'Imagen de «' + titulo + '»', loading: 'lazy' });
      zoomImg(img, src);
      fig = h('figure', { class: 'cro-img' }, img);
    }
    tl.appendChild(h('article', { class: 'cro-e', id: 'cro-' + x._id, 'data-k': 'cro.' + x._id, tabindex: '-1' }, [
      h('div', { class: 'cro-h' }, [h('span', { class: 'cro-s', text: SEASONS[x.est - 1] || '' }), h('h3', { text: titulo }),
        canWrite() ? h('button', { type: 'button', class: 'lnk', onclick: () => openCroEditor(x._id) }, 'Editar') : null]),
      h('div', { class: 'cro-b' }, [fig, ...parrafos(x.texto).map(p => h('p', { text: p }))])]));
  });
  content.appendChild(tl);
  page.appendChild(content);
}
// the bar: a point for each entry where its season falls between the first and the last; pressing one goes to it
function cronograma(L) {
  const t = x => x.anio * 4 + (x.est - 1);
  const a = t(L[0]), b = t(L[L.length - 1]), span = Math.max(1, b - a);
  const pos = x => (L.length === 1 || a === b ? 50 : ((t(x) - a) / span) * 100);
  const bar = h('div', { class: 'crg-bar' }, h('span', { class: 'crg-l' }));
  // the years: the first, the last and some between, so they do not overlap
  const years = [...new Set(L.map(x => x.anio))];
  const step = Math.max(1, Math.ceil(years.length / 8));
  years.forEach((y, i) => {
    if (i % step && i !== years.length - 1) return;
    const p = L.length === 1 || a === b ? 50 : ((y * 4 - a) / span) * 100;
    bar.appendChild(h('span', { class: 'crg-y', style: 'left:' + Math.min(100, Math.max(0, p)) + '%', text: String(y) }));
  });
  // entries of the same season share their place: the later ones go a little higher
  const usados = new Map();
  L.forEach(x => {
    const k = t(x), n = usados.get(k) || 0;
    usados.set(k, n + 1);
    const titulo = x.titulo || sname(x.anio, x.est);
    bar.appendChild(h('button', { type: 'button', class: 'crg-p' + (imgSrc(x) ? ' img' : ''), style: 'left:' + pos(x) + '%;--n:' + n,
      title: sname(x.anio, x.est) + ' · ' + titulo, 'aria-label': sname(x.anio, x.est) + ': ' + titulo,
      onclick: () => { const el = document.getElementById('cro-' + x._id); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.focus({ preventScroll: true }); } } }));
  });
  return h('nav', { class: 'crg', 'aria-label': 'Cronograma de la saga' }, [bar,
    h('p', { class: 'fh crg-txt', text: L.length + (L.length === 1 ? ' entrada' : ' entradas') + ', de ' + sname(L[0].anio, L[0].est).toLowerCase() + (L.length > 1 ? ' a ' + sname(L[L.length - 1].anio, L[L.length - 1].est).toLowerCase() : '') + '. Pulsa un punto para ir a su entrada.' })]);
}

/* ---------- an image: chosen, shown, and uploaded when the entry is saved */
// d.file: the image chosen now (a File); d.img: the one it had ({id}); d.quitar: take it away
function imgField(d) {
  const prev = h('div', { class: 'cro-prev' });
  const fi = h('input', { type: 'file', accept: 'image/*' });
  const quitar = h('button', { type: 'button', class: 'lnk' }, 'Quitar la imagen');
  let url = null;
  function draw() {
    prev.innerHTML = '';
    if (url) { URL.revokeObjectURL(url); url = null; }
    let src = null;
    if (d.file) src = url = URL.createObjectURL(d.file);
    else if (!d.quitar) src = imgSrc(d);
    if (src) { const img = h('img', { src: src, alt: '' }); zoomImg(img, src); prev.appendChild(img); }
    quitar.hidden = !src;
  }
  fi.addEventListener('change', () => { const f = fi.files && fi.files[0]; if (f) { d.file = f; d.quitar = false; } fi.value = ''; draw(); });
  quitar.addEventListener('click', () => { d.file = null; d.quitar = true; draw(); });
  draw();
  return h('div', { class: 'fld cro-imgf' }, [h('span', { class: 'fl', text: 'Imagen' }), prev, h('div', { class: 'cro-imgc' }, [fi, quitar]),
    h('span', { class: 'fh', text: 'JPG o PNG. Se reduce a ' + IMG_MAX + ' píxeles y se guarda con la saga; pulsándola se ve en grande.' })]);
}
async function subir(file) {
  const small = await shrinkImage(file, IMG_MAX);
  const up = () => (small ? S.assets.upload(small, { type: 'image/jpeg' }) : S.assets.upload(file));
  let r;
  try { r = await up(); } catch (e) { if (e && e.code === 'store_unavailable') r = await up(); else throw e; }
  SUBIDAS[r.id] = r.url;
  return { id: r.id };
}
// an image no other entry uses goes away with its entry
function imgLibre(id, sin) { return id && !Object.keys(S.cro).some(k => k !== sin && S.cro[k] && S.cro[k].img && S.cro[k].img.id === id); }

/* ---------- one entry */
function openCroEditor(id) {
  const ex = id ? S.cro[id] : null;
  const [ca, ce] = curSeason();
  const d = Object.assign({ anio: ca, est: ce, titulo: '', texto: '' }, ex || {});
  const body = [seasonPicker(d), field('Título', inp(d.titulo, v => { d.titulo = v; }, { placeholder: 'La llegada de los Boinas Rojas, el asedio de Jaca…' })),
    field('Qué pasó', h('textarea', { rows: 9, oninput: ev => { d.texto = ev.target.value; } }, d.texto || ''), 'Una línea en blanco separa los párrafos.'),
    imgField(d)];
  const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const actions = [save, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')];
  if (ex) actions.push(confirmButton('Borrar', 'Pulsa otra vez para borrar', async () => {
    const old = ex.img && ex.img.id;
    const ok = await dbWrite(() => { const b = S.db.batch(); b.delete('cronica/' + id); if (imgLibre(old, id)) b.delete(old); return b.commit(); }, 'Borrado de la crónica');
    if (ok) { localDel('cro', id); close(); }
  }));
  const close = openModal(ex ? 'Crónica' : 'Añadir a la crónica', body, actions);
  save.addEventListener('click', async () => {
    if (!String(d.texto || '').trim() && !String(d.titulo || '').trim()) { toast('Escribe qué pasó.'); return; }
    save.disabled = true;
    try {
      const out = { anio: Number(d.anio), est: Number(d.est), titulo: String(d.titulo || '').trim(), texto: String(d.texto || '').trim() };
      const old = ex && ex.img && ex.img.id;
      if (d.file) { toast('Subiendo la imagen…'); out.img = await subir(d.file); }
      else if (!d.quitar && old) out.img = { id: old };
      if (ex && ex.creado) out.creado = ex.creado;
      const ruta = ex ? 'cronica/' + id : 'cronica/' + S.db.collection('cronica').doc().id;
      const datos = stamp(out, !ex);
      const ok = await dbWrite(() => { const b = S.db.batch(); b.set(ruta, datos); if (old && (!out.img || out.img.id !== old) && imgLibre(old, id)) b.delete(old); return b.commit(); }, 'Guardado en la crónica');
      if (ok) { localPut('cro', ruta.slice(8), datos); close(); }
    } catch (e) {
      toast(e && (e.code === 'unsupported_type' || e.code === 'invalid_request') ? 'Ese formato de imagen no se admite; prueba con JPG o PNG.' : 'No se ha podido subir la imagen.');
    }
    save.disabled = false;
  });
}

/* ---------- «Importar resúmenes»: several text files (and their images) at once */
const TXT_OK = /\.(txt|md|markdown|text)$/i;
const ESTACIONES = { primavera: 1, verano: 2, otono: 3, invierno: 4 };
const base = n => norm(String(n || '').replace(/\.[^.]+$/, '')).replace(/[^a-z0-9]+/g, ' ').trim();
// the title (a «# heading» or a short first line; else the file's name) and the season the text names, if any
function leeResumen(nombre, texto) {
  const lineas = String(texto || '').replace(/\r\n?/g, '\n').split('\n');
  while (lineas.length && !lineas[0].trim()) lineas.shift();
  let titulo = '';
  const l0 = (lineas[0] || '').trim();
  if (/^#{1,6}\s+/.test(l0) || (l0 && l0.length <= 90 && !/[.:;,]$/.test(l0) && lineas.length > 1)) { titulo = l0.replace(/^#{1,6}\s+/, '').replace(/[*_]/g, '').trim(); lineas.shift(); }
  if (!titulo) titulo = String(nombre || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  const cuerpo = lineas.join('\n').replace(/^#{1,6}\s+/gm, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
  const donde = norm(titulo + ' ' + nombre + ' ' + cuerpo.slice(0, 300));
  const [ca, ce] = curSeason();
  let anio = ca, est = ce;
  const m = donde.match(/(primavera|verano|otono|invierno)\s+(?:de(?:l ano)?\s+)?(1[0-4]\d\d)/);
  if (m) { est = ESTACIONES[m[1]]; anio = Number(m[2]); }
  else { const y = donde.match(/\b(1[0-4]\d\d)\b/); if (y) { anio = Number(y[1]); est = 1; } }
  return { titulo: titulo, texto: cuerpo, anio: anio, est: est, origen: nombre };
}
function openImport() {
  const drafts = [];
  const list = h('div', { class: 'cro-imp-l' });
  const resumen = h('span', { class: 'vdt-sum', 'aria-live': 'polite' });
  const fi = h('input', { type: 'file', multiple: true, accept: '.txt,.md,.markdown,text/plain,text/markdown,image/*' });
  function draw() {
    list.innerHTML = '';
    drafts.forEach((d, i) => list.appendChild(h('section', { class: 'cro-imp' }, [
      h('div', { class: 'cro-imp-h' }, [h('b', { text: 'Entrada ' + (i + 1) }), d.origen ? h('small', { text: d.origen }) : null,
        h('button', { type: 'button', class: 'lnk', onclick: () => { drafts.splice(i, 1); draw(); } }, 'Quitar')]),
      seasonPicker(d),
      field('Título', inp(d.titulo, v => { d.titulo = v; })),
      field('Resumen', h('textarea', { rows: 6, oninput: ev => { d.texto = ev.target.value; } }, d.texto || '')),
      imgField(d)])));
    resumen.textContent = drafts.length ? drafts.length + (drafts.length === 1 ? ' entrada por guardar' : ' entradas por guardar') : '';
    save.disabled = !drafts.length;
  }
  fi.addEventListener('change', async () => {
    const files = [...(fi.files || [])];
    fi.value = '';
    const textos = files.filter(f => TXT_OK.test(f.name) || /^text\//.test(f.type)), imgs = files.filter(f => /^image\//.test(f.type));
    const otros = files.length - textos.length - imgs.length;
    const nuevos = [];
    for (const f of textos) {
      try { nuevos.push(leeResumen(f.name, await f.text())); } catch (e) { toast('No se ha podido leer ' + f.name + '.'); }
    }
    // an image goes with the text of the same name; the rest, in order, with the entries still without one
    const sueltas = [];
    imgs.forEach(im => { const d = nuevos.find(x => !x.file && base(x.origen) === base(im.name)); if (d) d.file = im; else sueltas.push(im); });
    [...nuevos, ...drafts].filter(x => !x.file && !(x.img && x.img.id)).forEach(x => { if (sueltas.length) x.file = sueltas.shift(); });
    sueltas.forEach(im => nuevos.push(Object.assign(leeResumen(im.name, ''), { file: im })));
    nuevos.sort(orden).forEach(x => drafts.push(x));
    if (otros) toast((otros === 1 ? 'Un archivo no es' : otros + ' archivos no son') + ' de texto ni imagen: guárdalos como .txt o copia el texto en «Añadir una a mano».');
    draw();
  });
  const save = h('button', { type: 'button', class: 'btn' }, 'Guardar en la crónica');
  const body = [
    h('p', { class: 'fh', text: 'Elige los resúmenes de las aventuras (archivos .txt o .md; de Word, guárdalos como texto) y sus imágenes, todos a la vez. Cada texto es una entrada: su título sale de la primera línea y su estación, de lo que diga el texto («Primavera de 1225»); una imagen con el mismo nombre que un texto va con él. Revísalo todo antes de guardar.' }),
    field('Archivos', fi),
    list,
    h('button', { type: 'button', class: 'btn ghost', onclick: () => { const [ca, ce] = curSeason(); drafts.push({ titulo: '', texto: '', anio: ca, est: ce }); draw(); } }, 'Añadir una a mano')];
  const close = openModal('Importar resúmenes a la crónica', body, [resumen, save, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')]);
  save.addEventListener('click', async () => {
    const L = drafts.filter(d => String(d.titulo || '').trim() || String(d.texto || '').trim());
    if (!L.length) { toast('No hay nada que guardar: cada entrada necesita un título o un resumen.'); return; }
    save.disabled = true;
    let hechas = 0;
    try {
      for (const d of L) {
        const out = { anio: Number(d.anio), est: Number(d.est), titulo: String(d.titulo || '').trim(), texto: String(d.texto || '').trim() };
        if (d.file && !d.quitar) { toast('Subiendo la imagen de «' + (out.titulo || sname(out.anio, out.est)) + '»…'); out.img = await subir(d.file); }
        const ruta = 'cronica/' + S.db.collection('cronica').doc().id, datos = stamp(out, true);
        const ok = await dbWrite(() => S.db.doc(ruta).set(datos), null);
        if (!ok) break;
        localPut('cro', ruta.slice(8), datos);
        drafts.splice(drafts.indexOf(d), 1);
        hechas++;
      }
    } catch (e) {
      toast(e && (e.code === 'unsupported_type' || e.code === 'invalid_request') ? 'Una imagen no tiene un formato admitido; prueba con JPG o PNG.' : 'No se ha podido subir una imagen.');
    }
    if (hechas) toast(hechas + (hechas === 1 ? ' entrada guardada' : ' entradas guardadas') + ' en la crónica.');
    if (!drafts.length) close(); else { draw(); save.disabled = false; }
  });
  draw();
  setTimeout(() => fi.focus(), 40);
}

export { viewCronica };
