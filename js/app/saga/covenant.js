/* La alianza y la Orden en la web: la armería (armeria/{id}), la crónica de la saga (cronica/{id}) y las demás alianzas de
   cada Tribunal (alianzas/{id}), que añade el máster. Los Tribunales son los trece de la Orden en 1220 (ArM5 cap. 1); la
   alianza de la saga está en el suyo (saga/estado → tribunal; Arazas, en Iberia) y el máster puede ocultar los que no use
   (saga/estado → tribOcultos). */
import { DOCS, h, LIBROS, scrollHint } from '../base.js';
import { page } from '../views.js';
import { S, SEASONS, tkey } from './state.js';
import { confirmButton, datalist, dbWrite, field, inp, localDel, localPut, openModal, pjsSorted, sagaChanged, sagaCrumbs, seasonPicker, sel, stamp, statusNote, toast } from './core.js';
import { canWrite, curSeason, numv, skey, sname } from './rules.js';
import { writeEstado } from './seasons.js';

const TRIBUNALES = [['hibernia', 'Hibernia'], ['loch-leglean', 'Loch Leglean'], ['stonehenge', 'Stonehenge'], ['normandia', 'Normandía'], ['rin', 'el Rin'],
  ['alpes', 'los Grandes Alpes'], ['provenza', 'Provenza'], ['iberia', 'Iberia'], ['roma', 'Roma'], ['tebas', 'Tebas'], ['levante', 'Levante'],
  ['transilvania', 'Transilvania'], ['novgorod', 'Nóvgorod']];
const tribName = k => { const t = TRIBUNALES.find(x => x[0] === k); return t ? t[1] : k; };
const tribTitle = k => { const n = tribName(k); return 'Tribunal ' + (/^(el|los) /.test(n) ? n.replace(/^el /, 'del ').replace(/^los /, 'de los ') : 'de ' + n); };
const sagaTrib = () => (S.estado && S.estado.tribunal) || 'iberia';
const tribHidden = () => new Set((S.estado && Array.isArray(S.estado.tribOcultos)) ? S.estado.tribOcultos : []);
/* the saga's own covenant: its name and where it opens (the covenant's sheet in the saga's archive, or the saga's page) */
function sagaCov() {
  const W = window.EM_WEB, n = (W.saga && W.saga.alianza) || 'La alianza de la saga';
  const doc = Object.values(DOCS).find(d => d.saga && d.kind === 'alianza' && /ficha/i.test(d.id + ' ' + d.title)) || Object.values(DOCS).find(d => d.saga && d.kind === 'alianza');
  return { n: n, href: doc ? '#' + doc.id : '#saga', propia: true };
}
/* the covenants of the Tribunal books (data/alianzas.json, made by herramientas/alianzas_libros.py): with their magi and, when the
   book has it, each magus's sheet. Loaded once, the first time the Tribunals are drawn; then everything is redrawn. */
let BOOK = null, BOOK_P = null;
const normName = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function bookCovs() {
  if (!BOOK_P) BOOK_P = fetch('data/alianzas.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { BOOK = d; sagaChanged(); }).catch(() => { BOOK_P = null; });
  return BOOK ? BOOK.alianzas : [];
}
const bookOf = n => bookCovs().find(b => normName(b.n) === normName(n)) || null;
/* the covenants of a Tribunal: the saga's own first, then the master's and the books', by name (one added by the master with a
   book covenant's name is that one, with the book's magi) */
function covenantsOf(k) {
  const L = Object.keys(S.al).map(id => Object.assign({ _id: id, href: '#alianza--' + id }, S.al[id])).filter(a => a.tribunal === k);
  const own = new Set(L.map(a => normName(a.n)).concat(sagaTrib() === k ? [normName(sagaCov().n)] : []));
  bookCovs().filter(b => b.trib === k && !own.has(normName(b.n))).forEach(b => L.push({ _id: 'l-' + b.id, href: '#alianza--l-' + b.id, n: b.n, libro: b.ab, ruinas: !!b.estado }));
  L.sort((a, b) => String(a.n || '').localeCompare(String(b.n || ''), 'es'));
  return (sagaTrib() === k ? [sagaCov()] : []).concat(L);
}

/* ---------- armoury */
const ARM_TIPOS = ['Arma', 'Armadura', 'Escudo', 'Munición', 'Objeto mágico', 'Equipo', 'Otro'];
// how many there are: 0 is kept (spent, lost or lent), a missing figure counts as one
const cantOf = x => x.cant === '' || x.cant == null ? 1 : numv(x.cant);
function viewArmeria() {
  page.innerHTML = '';
  page.appendChild(sagaCrumbs([['Alianza', null], ['Armería', null]]));
  page.appendChild(h('h1', { class: 'doc-title', text: 'Armería' }));
  document.title = 'Armería — Europa Mítica';
  page.appendChild(h('p', { class: 'doc-blurb', text: 'Las armas, armaduras y el equipo de la alianza, y quién los lleva.' }));
  if (canWrite()) page.appendChild(h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: () => openArmEditor(null) }, 'Añadir a la armería')));
  const content = h('div', { class: 'content', style: 'margin-top:18px' });
  const note = statusNote(); if (note) content.appendChild(note);
  const L = Object.keys(S.arm).map(id => Object.assign({ _id: id }, S.arm[id]))
    .sort((a, b) => ARM_TIPOS.indexOf(a.tipo) - ARM_TIPOS.indexOf(b.tipo) || String(a.n || '').localeCompare(String(b.n || ''), 'es'));
  if (!L.length) content.appendChild(h('p', { class: 'note', text: 'La armería está vacía.' }));
  else {
    content.appendChild(h('p', { class: 'fh', text: L.reduce((s, x) => s + cantOf(x), 0) + ' piezas en ' + L.length + (L.length === 1 ? ' entrada' : ' entradas') }));
    const tb = h('tbody');
    L.forEach(x => tb.appendChild(h('tr', { 'data-k': 'arm.' + x._id }, [
      h('td', null, [h('b', { text: x.n }), x.nota ? h('div', { class: 'note', text: x.nota }) : null]),
      h('td', { text: x.tipo || '' }), h('td', { class: 'num', text: String(cantOf(x)) }), h('td', { text: x.donde || '' }),
      canWrite() ? h('td', { class: 'act' }, h('button', { type: 'button', class: 'lnk', onclick: () => openArmEditor(x._id) }, 'Editar')) : null])));
    content.appendChild(h('div', { class: 'tw' }, h('table', { class: 'mini' }, [
      h('thead', null, h('tr', null, ['Objeto', 'Tipo', 'Cantidad', 'Quién lo lleva o dónde está'].concat(canWrite() ? [''] : []).map(t => h('th', { scope: 'col', text: t })))), tb])));
  }
  page.appendChild(content);
}
function openArmEditor(id) {
  const ex = id ? S.arm[id] : null;
  const d = Object.assign({ n: '', tipo: 'Arma', cant: 1, donde: '', nota: '' }, ex || {});
  const dl = datalist('dl-arm-donde', ['En la armería'].concat(pjsSorted(true).map(p => p.nombre)));
  const body = [field('Objeto', inp(d.n, v => { d.n = v; }, { placeholder: 'Espada larga, cota de malla, ballesta…' })),
    h('div', { class: 'fld-row tri' }, [field('Tipo', sel(ARM_TIPOS, d.tipo, v => { d.tipo = v; })), field('Cantidad', inp(d.cant, v => { d.cant = v; }, { type: 'number', min: '0', inputmode: 'numeric' })),
      field('Quién lo lleva', inp(d.donde, v => { d.donde = v; }, { list: dl, autocomplete: 'off' }))]),
    field('Nota', inp(d.nota, v => { d.nota = v; }, { placeholder: 'Calidad, estado, de dónde viene…' }))];
  saveModal(ex ? 'Armería' : 'Añadir a la armería', 'armeria', 'arm', id, ex, body, () => {
    const n = String(d.n || '').trim();
    if (!n) { toast('Escribe qué es.'); return null; }
    return { n: n, tipo: d.tipo, cant: d.cant === '' || d.cant == null ? 1 : Math.max(0, parseInt(d.cant, 10) || 0), donde: String(d.donde || '').trim(), nota: String(d.nota || '').trim() };
  });
}

/* ---------- chronicle */
function viewCronica() {
  page.innerHTML = '';
  page.appendChild(sagaCrumbs([['Alianza', null], ['Crónica', null]]));
  page.appendChild(h('h1', { class: 'doc-title', text: 'Crónica' }));
  document.title = 'Crónica — Europa Mítica';
  page.appendChild(h('p', { class: 'doc-blurb', text: 'Lo que ha pasado en la saga, estación a estación.' }));
  if (canWrite()) page.appendChild(h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: () => openCroEditor(null) }, 'Añadir a la crónica')));
  const content = h('div', { class: 'content', style: 'margin-top:18px' });
  const note = statusNote(); if (note) content.appendChild(note);
  const L = Object.keys(S.cro).map(id => Object.assign({ _id: id }, S.cro[id])).sort((a, b) => skey(b.anio, b.est) - skey(a.anio, a.est) || numv(b.creado) - numv(a.creado));
  if (!L.length) content.appendChild(h('p', { class: 'note', text: 'La crónica está vacía: cuenta aquí lo que pase en la saga.' }));
  let year = null;
  const tl = h('div', { class: 'cro' });
  L.forEach(x => {
    if (x.anio !== year) { year = x.anio; tl.appendChild(h('h2', { class: 'cro-y', text: String(year) })); }
    tl.appendChild(h('article', { class: 'cro-e', 'data-k': 'cro.' + x._id }, [
      h('div', { class: 'cro-h' }, [h('span', { class: 'cro-s', text: SEASONS[x.est - 1] || '' }), h('h3', { text: x.titulo || sname(x.anio, x.est) }),
        canWrite() ? h('button', { type: 'button', class: 'lnk', onclick: () => openCroEditor(x._id) }, 'Editar') : null]),
      ...String(x.texto || '').split(/\n{2,}/).filter(p => p.trim()).map(p => h('p', { text: p.trim() }))]));
  });
  content.appendChild(tl);
  page.appendChild(content);
}
function openCroEditor(id) {
  const ex = id ? S.cro[id] : null;
  const [ca, ce] = curSeason();
  const d = Object.assign({ anio: ca, est: ce, titulo: '', texto: '' }, ex || {});
  const body = [seasonPicker(d), field('Título', inp(d.titulo, v => { d.titulo = v; }, { placeholder: 'La llegada de los Boinas Rojas, el asedio de Jaca…' })),
    field('Qué pasó', h('textarea', { rows: 9, oninput: ev => { d.texto = ev.target.value; } }, d.texto || ''), 'Una línea en blanco separa los párrafos.')];
  saveModal(ex ? 'Crónica' : 'Añadir a la crónica', 'cronica', 'cro', id, ex, body, () => {
    if (!String(d.texto || '').trim() && !String(d.titulo || '').trim()) { toast('Escribe qué pasó.'); return null; }
    return { anio: Number(d.anio), est: Number(d.est), titulo: String(d.titulo || '').trim(), texto: String(d.texto || '').trim() };
  });
}

/* ---------- other covenants */
function viewAlianza(id, tab) {
  page.innerHTML = '';
  if (String(id).startsWith('l-')) { viewBookCov(id.slice(2), tab); return; }
  const a = S.al[id];
  page.appendChild(sagaCrumbs([['Alianzas', canWrite() && S.owner === true ? '#master--tribunales' : null], [a ? a.n : 'Alianza', null]]));
  const content = h('div', { class: 'content' });
  if (!a) {
    page.appendChild(h('h1', { class: 'doc-title', text: 'Alianza' }));
    content.appendChild(statusNote() || h('p', { class: 'note', text: 'Esta alianza ya no está en la saga.' }));
    page.appendChild(content);
    return;
  }
  page.appendChild(h('h1', { class: 'doc-title', text: a.n }));
  document.title = a.n + ' — Europa Mítica';
  page.appendChild(h('div', { class: 'doc-meta' }, [h('span', { text: tribTitle(a.tribunal) }), a.fundada ? h('span', { text: 'Fundada en ' + a.fundada }) : null, a.estacion ? h('span', { text: 'Estación de ' + a.estacion.toLowerCase() }) : null]));
  const b = bookOf(a.n);
  const acts = [canWrite() && S.owner === true ? h('button', { type: 'button', class: 'btn ghost', onclick: () => openAlEditor(id) }, 'Editar') : null,
    b ? h('a', { class: 'btn ghost', href: '#alianza--l-' + b.id, text: 'La alianza en ' + libroTit(b.ab) }) : null].filter(Boolean);
  if (acts.length) page.appendChild(h('div', { class: 'actions' }, acts));
  String(a.notas || '').split(/\n{2,}/).filter(p => p.trim()).forEach(p => content.appendChild(h('p', { text: p.trim() })));
  if (!String(a.notas || '').trim()) content.appendChild(h('p', { class: 'note', text: b ? 'Sin notas de la saga todavía: su ficha, su descripción y sus magi, en el libro (el botón de arriba).' : 'Sin notas todavía.' }));
  page.appendChild(content);
}

/* a covenant of a Tribunal book (data/alianzas.json): the tabs Ficha (what the book says of it: its box in Iberia and Rome, what its
   text says in the others), Descripción (its text in the book) and Magi (each with its text and its sheet). The texts are one file per
   book (data/alianzas/<libro>.json), fetched the first time one of its covenants is opened. */
const TEXTOS = {}, TEXTOS_P = {};
function bookTexts(ab) {
  const f = BOOK && BOOK.libros[ab] && BOOK.libros[ab].f;
  if (!f) return null;
  if (!TEXTOS_P[ab]) TEXTOS_P[ab] = fetch('data/alianzas/' + f + '.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { TEXTOS[ab] = d; sagaChanged(); }).catch(() => { TEXTOS_P[ab] = null; });
  return TEXTOS[ab] || null;
}
const libroTit = ab => ((BOOK && BOOK.libros[ab]) || { t: ab }).t;
const ESCANEADO = new Set(['ToH:R']);   // tercera edición, escaneada: el texto tiene errores de reconocimiento
function bookRef(ab, p, text) {
  const bk = LIBROS.libros[ab], info = (BOOK && BOOK.libros[ab]) || { t: ab, idi: 'en' };
  const url = bk && (info.idi === 'es' ? bk.es : bk.en);
  return url ? h('a', { class: 'ref-a', href: url + '#page=' + p, target: '_blank', rel: 'noopener', title: 'Abrir «' + info.t + '» en la página ' + p + ' del PDF', text: text })
    : h('span', { text: text });
}
const paginas = b => b.pf && b.pf !== b.p ? 'páginas ' + b.p + '–' + b.pf : 'página ' + b.p;
function textoLibro(bls) {
  const out = [];
  (bls || []).forEach(([hd, ps]) => {
    if (hd) out.push(h('h3', { class: 'bal-sh', text: hd }));
    ps.forEach(p => out.push(h('p', { text: p })));
  });
  return out;
}
function viewBookCov(id, tab) {
  bookCovs();
  const b = BOOK && BOOK.alianzas.find(x => x.id === id);
  page.appendChild(sagaCrumbs([['Alianzas', canWrite() && S.owner === true ? '#master--tribunales' : null], [b ? b.n : 'Alianza', null]]));
  const content = h('div', { class: 'content' });
  if (!b) {
    page.appendChild(h('h1', { class: 'doc-title', text: 'Alianza' }));
    content.appendChild(h('p', { class: 'note', text: BOOK ? 'Esta alianza no está en los libros.' : 'Cargando las alianzas de los libros…' }));
    page.appendChild(content);
    return;
  }
  const sheets = [['ficha', 'Ficha'], ['descripcion', 'Descripción']].concat(b.magos.length ? [['magi', 'Magi · ' + b.magos.length]] : []);
  const cur = sheets.some(s => s[0] === tab) ? tab : 'ficha';
  const curT = sheets.find(s => s[0] === cur)[1];
  page.appendChild(h('h1', { class: 'doc-title', text: b.n }));
  document.title = b.n + (cur !== 'ficha' ? ' · ' + curT.replace(/ · \d+$/, '') : '') + ' — Europa Mítica';
  page.appendChild(h('div', { class: 'doc-meta' }, [h('span', { text: tribTitle(b.trib) }), h('span', { text: libroTit(b.ab) }), b.estado ? h('span', { text: 'En ruinas' }) : null]));
  const tabs = h('div', { class: 'tabs', role: 'navigation', 'aria-label': 'Pestañas de ' + b.n },
    sheets.map(([k, t]) => h('a', { class: 'tab', href: '#alianza--l-' + b.id + (k === 'ficha' ? '' : '--' + k), 'aria-current': k === cur ? 'page' : null, text: t })));
  page.appendChild(h('div', { class: 'tabs-wrap' }, tabs));
  scrollHint(tabs, tabs.querySelector('[aria-current="page"]'));
  page.appendChild(content);
  content.appendChild(h('h2', { class: 'sheet-h', text: curT.replace(/ · \d+$/, '') }));
  const T = bookTexts(b.ab), t = T && T[b.id];
  const fuente = ['De ', h('i', { text: libroTit(b.ab) }), ', ', bookRef(b.ab, b.p, paginas(b) + ' del PDF'), '.'];
  if (cur === 'ficha') {
    const dl = h('dl', { class: 'kv' });
    b.ficha.forEach(([k, v]) => { dl.appendChild(h('dt', { text: k })); dl.appendChild(h('dd', { text: v })); });
    dl.appendChild(h('dt', { text: 'Libro' }));
    dl.appendChild(h('dd', null, [h('i', { text: libroTit(b.ab) }), ', ', bookRef(b.ab, b.p, paginas(b) + ' del PDF')]));
    content.appendChild(dl);
    content.appendChild(h('p', { class: 'note bal-nota', text: b.ab === 'TdI' ? 'La ficha es el recuadro de la alianza en el libro.'
      : ESCANEADO.has(b.ab) ? 'La ficha es el recuadro de la alianza en el libro (tercera edición, escaneada: puede tener errores de reconocimiento).'
      : 'La estación, el año de fundación, el aura, la domus magna y el espíritu patrón salen del texto del libro cuando lo dice; si falta alguno, el libro no lo da de forma explícita.' }));
    return;
  }
  if (!t) { content.appendChild(h('p', { class: 'note', text: TEXTOS_P[b.ab] ? 'Cargando los textos del libro…' : 'No se han podido cargar los textos del libro.' })); return; }
  if (ESCANEADO.has(b.ab)) content.appendChild(h('p', { class: 'note bal-nota', text: 'Texto del escaneado de la tercera edición: tiene errores de reconocimiento y algún párrafo de la columna de al lado. Ante la duda, abre el PDF.' }));
  if (cur === 'descripcion') {
    content.appendChild(h('p', { class: 'bal-src' }, fuente));
    const ps = textoLibro(t.desc);
    if (ps.length) ps.forEach(n => content.appendChild(n));
    else content.appendChild(h('p', { class: 'note', text: 'Sin texto: mira la página del libro.' }));
    return;
  }
  // magi: cada uno con su texto y su ficha
  content.appendChild(h('p', { class: 'bal-src' }, fuente));
  b.magos.forEach((m, i) => {
    const x = t.magos[i] || { t: [], f: '' };
    const sec = h('section', { class: 'bal-mago' }, [
      h('div', { class: 'bal-mh' }, [h('h3', { class: 'bal-n', text: m.n }), m.casa ? h('span', { class: 'vtag', text: m.casa }) : null,
        m.cargo ? h('span', { class: 'bal-c', text: m.cargo }) : null, m.p ? h('span', { class: 'bal-p' }, bookRef(b.ab, m.p, 'p. ' + m.p)) : null])]);
    textoLibro(x.t).forEach(n => sec.appendChild(n));
    if (x.f) sec.appendChild(h('details', { class: 'bal-fd', open: !x.t.length ? true : null }, [h('summary', { text: 'Ficha' }), h('div', { class: 'bal-ficha', text: x.f })]));
    if (!x.t.length && !x.f) sec.appendChild(h('p', { class: 'note', text: 'El libro solo lo nombra aquí: mira su página.' }));
    content.appendChild(sec);
  });
}
function openAlEditor(id, trib) {
  const ex = id ? S.al[id] : null;
  const d = Object.assign({ n: '', tribunal: trib || sagaTrib(), fundada: '', estacion: '', notas: '' }, ex || {});
  const body = [field('Nombre', inp(d.n, v => { d.n = v; }, { placeholder: 'Jaferia, Barcelona…' })),
    h('div', { class: 'fld-row tri' }, [field('Tribunal', sel(TRIBUNALES, d.tribunal, v => { d.tribunal = v; })),
      field('Fundada en', inp(d.fundada, v => { d.fundada = v; }, { type: 'number', inputmode: 'numeric' })),
      field('Estación', sel([['', '—'], 'Primavera', 'Verano', 'Otoño', 'Invierno'], d.estacion, v => { d.estacion = v; }))]),
    field('Notas', h('textarea', { rows: 8, oninput: ev => { d.notas = ev.target.value; } }, d.notas || ''), 'Sus magi, su relación con la alianza, rumores… Una línea en blanco separa los párrafos.')];
  saveModal(ex ? 'Alianza' : 'Nueva alianza', 'alianzas', 'al', id, ex, body, () => {
    const n = String(d.n || '').trim();
    if (!n) { toast('Escribe el nombre de la alianza.'); return null; }
    return { n: n, tribunal: d.tribunal, fundada: parseInt(d.fundada, 10) || '', estacion: d.estacion || '', notas: String(d.notas || '').trim() };
  });
}

/* a modal that saves one document of a collection: col (server path), key (in S), build() → the document or null */
function saveModal(title, col, key, id, ex, body, build) {
  const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const actions = [save, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')];
  if (ex) actions.push(confirmButton('Borrar', 'Pulsa otra vez para borrar', async () => { if (await dbWrite(() => S.db.doc(col + '/' + id).delete(), 'Borrado')) { localDel(key, id); close(); } }));
  const close = openModal(title, body, actions);
  save.addEventListener('click', async () => {
    const out = build();
    if (!out) return;
    if (ex && ex.creado) out.creado = ex.creado;
    const ref = ex ? S.db.doc(col + '/' + id) : S.db.collection(col).doc();
    save.disabled = true;
    const ok = await dbWrite(() => ref.set(stamp(out, !ex)), 'Guardado');
    save.disabled = false;
    if (ok) { localPut(key, ref.id, out); close(); }
  });
}

/* ---------- the master's screen: the Tribunals in the side panel and the covenants in each */
function masterTribunales() {
  const sec = h('section', { class: 'm-sec', 'aria-labelledby': 'm-tr-h' });
  sec.appendChild(h('h2', { class: 'm-h', id: 'm-tr-h', text: 'Tribunales y alianzas' }));
  sec.appendChild(h('p', { class: 'doc-blurb', text: 'Los Tribunales salen en el índice, en la sección del máster, con sus alianzas dentro: las de los libros de Tribunales (con sus magi y sus fichas) y las que añadas. Oculta los que no uses en la saga.' }));
  const hidden = tribHidden(), can = canWrite();
  sec.appendChild(field('Tribunal de la alianza de la saga', sel(TRIBUNALES, sagaTrib(), v => { writeEstado({ tribunal: v }, sagaCov().n + ': ' + tribTitle(v)); }, { disabled: can ? null : true, style: 'max-width:320px' })));
  const row = h('div', { class: 'hb-row m-trib', role: 'group', 'aria-label': 'Tribunales que salen en el índice' });
  TRIBUNALES.forEach(([k, n]) => {
    const on = !hidden.has(k), cnt = covenantsOf(k).length;
    const b = h('button', { type: 'button', class: 'hb-tog', 'aria-pressed': on ? 'true' : 'false', disabled: can ? null : true, title: (on ? 'Ocultar en el índice: ' : 'Mostrar en el índice: ') + tribTitle(k) },
      [h('span', { class: 'hb-tog-i', 'aria-hidden': 'true', text: on ? '✓' : '+' }), h('b', { text: n.replace(/^(el|los) /, '') }), h('small', { text: cnt ? cnt + (cnt === 1 ? ' alianza' : ' alianzas') : 'sin alianzas' })]);
    b.addEventListener('click', async () => {
      b.disabled = true;
      const next = new Set(tribHidden());
      if (on) next.add(k); else next.delete(k);
      if (!await writeEstado({ tribOcultos: [...next] }, (on ? 'Oculto: ' : 'Visible: ') + tribTitle(k))) b.disabled = !can;
    });
    row.appendChild(b);
  });
  sec.appendChild(h('div', { class: 'fld' }, [h('span', { class: 'fl', text: 'Tribunales en el índice' }), row]));
  if (can) sec.appendChild(h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: () => openAlEditor(null) }, 'Añadir alianza')));
  const list = h('div', { class: 'm-covs' });
  TRIBUNALES.forEach(([k]) => {
    const L = covenantsOf(k);
    if (!L.length) return;
    list.appendChild(h('h3', { class: 'm-sub', text: tribTitle(k) + (hidden.has(k) ? ' · oculto en el índice' : '') }));
    const li = a => h('li', null, [h('a', { class: 'lnk', href: a.href, text: a.n }), a.propia ? h('small', { text: ' · la alianza de la saga' })
      : a.libro ? h('small', { text: ' · ' + a.libro }) : can ? h('button', { type: 'button', class: 'lnk', onclick: () => openAlEditor(a._id) }, ' Editar') : null]);
    list.appendChild(h('ul', { class: 'm-cov-l' }, L.filter(a => !a.ruinas).map(li)));
    const R = L.filter(a => a.ruinas);
    if (R.length) list.appendChild(h('details', { class: 'm-ruinas' }, [h('summary', { text: 'En ruinas o desaparecidas · ' + R.length }), h('ul', { class: 'm-cov-l' }, R.map(li))]));
  });
  sec.appendChild(list);
  return sec;
}

export { covenantsOf, masterTribunales, TRIBUNALES, tribHidden, tribName, viewAlianza, viewArmeria, viewCronica };
