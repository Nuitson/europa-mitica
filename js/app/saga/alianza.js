/* La ficha de la alianza de la saga y su creación (libro básico, «Personalizar la creación de la alianza», y «Alianzas»,
   capítulo II): sus datos, el nivel de poder, las Ventajas y Trabas, que se compensan, y el reparto de los Puntos de
   Construcción. Se guarda en saga/estado → ficha; la rellena y la cambia el máster, y la ven todos.
   Las Ventajas y Trabas salen de data/alianza.json: cada una con un resumen propio, el texto completo del libro (bajo
   licencia CC BY-SA 4.0, que pide decir de quién es allí donde se enseña) y su página del PDF. Una saga con ficha en su archivo (la «Ficha de Arazas») la tiene hecha con esos datos hasta
   que el máster guarda la suya; la del archivo sigue ahí para compararlas. */
import { h, LIBROS, norm, R } from '../base.js';
import { page } from '../views.js';
import { S } from './state.js';
import { confirmButton, datalist, field, inp, openModal, sagaChanged, sagaCrumbs, sel, statusNote, toast } from './core.js';
import { canWrite, curSeason, numv, sagaAura, sname } from './rules.js';
import { writeEstado } from './seasons.js';
import { fichaArchivo, sagaCov, sagaTrib, TRIBUNALES, tribName, tribTitle } from './covenant.js';

/* ---------- the book's data, fetched the first time it is needed */
let DAT = null, DAT_P = null;
function cargar() {
  if (!DAT_P) DAT_P = fetch('data/alianza.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { d.byId = new Map(d.vt.map(x => [x.id, x])); DAT = d; sagaChanged(); return d; })
    .catch(e => { DAT_P = null; throw e; });
  return DAT_P;
}
function datos() { if (!DAT) cargar().catch(() => null); return DAT; }

const PTS = { Mayor: 3, Menor: 1, Gratuita: 0 };
// the power levels (core book, «Niveles de poder accesibles»): name, most Build Points, highest level of one lab text or of
// one effect of an enchanted item (null: no limit), and the covenant's minimum age
const PODER = [['Bajo', 300, 25, 0], ['Medio', 1250, 40, 10], ['Alto', 2500, null, 50], ['Legendario', Infinity, null, 100]];
const PC_CATS = ['Biblioteca', 'Textos de laboratorio', 'Vis', 'Objetos encantados', 'Especialistas', 'Construcción', 'Personal', 'Dinero', 'Otros'];
// what an entry needs («requiere …» in the book), as any of these
const SOLDADOS = ['armas-de-proyectiles-v1', 'ballesteros-v1', 'caballeria-pesada-v3', 'criminales-v1', 'guerreros-veteranos-v1', 'jinetes-v1', 'campesinos-g0', 'cazadores-o-marineros-g0'];
const REQ = {
  Castillo: { t: 'la Traba Castillo (salvo que no haya vecinos mundanos en unos quince kilómetros)', ids: ['castillo-t3'] },
  'Murallas y Torres': { t: 'Murallas y Torres', ids: ['murallas-y-torres-v3'] },
  Regio: { t: 'una regio', ids: ['regio-t3', 'regio-t1', 'regio-v3', 'regio-v1', 'regio-con-accesos-inesperados-t1'] },
  'cualquier otro tipo de soldado': { t: 'otro tipo de soldados', ids: SOLDADOS }
};
// what the book says cannot go together
const EXCL = [['aislamiento-v1', ['via-t3', 'via-t1', 'urbana-t3', 'urbana-t1']], ['pobreza-t1', ['fuente-de-ingresos-extra-v1', 'riquezas-v3', 'riquezas-v1']]];
const REGLAS = [
  'Cada Ventaja o Traba Mayor vale 3 puntos y cada Menor, 1. Las Elecciones Gratuitas no cuentan.',
  'La alianza de los personajes jugadores tiene que estar compensada: los puntos de Trabas y los de Ventajas, iguales. Las Ventajas no se compran con Puntos de Construcción.',
  'Trabas Desconocidas: a un jugador se le asigna una Traba Menor que pueda sorprender a los demás; cuenta como Mayor para compensar. Solo tienen sentido en la interpretación en grupo.',
  'Como guía, no más Trabas de las que se puedan usar en seis meses de juego; las que van juntas en un relato cuentan como una.',
  'Con el juego se ganan y se pierden Ventajas y Trabas: solo se compensan al crear la alianza. Las alianzas que no son de los jugadores no tienen por qué estar compensadas.'];

/* ---------- the sheet: saga/estado → ficha (v: 2) */
const vacia = () => ({ v: 2, lugar: '', fundada: '', estacion: '', aegis: '', notas: '', poder: '', vt: [], reputaciones: [], tierras: [], pc: [] });
const ent = p => (p && p.id && DAT && DAT.byId.get(p.id)) || null;
const tipoDe = p => p.tipo || (ent(p) || {}).tipo || 'Ventaja';
const valorDe = p => p.valor || (ent(p) || {}).valor || 'Menor';
const nombreDe = p => (ent(p) || {}).n || p.n || 'Sin nombre';
// an Unknown Hook counts as a Major one
const ptsDe = p => (tipoDe(p) === 'Traba' && p.desc ? 3 : PTS[valorDe(p)] || 0);
const plural = (n, una, varias) => n + ' ' + (n === 1 ? una : varias);
const k = s => norm(s).replace(/[^a-z0-9]+/g, ' ').trim();

// a Boon or a Hook by its name, as an old sheet writes it: «Refugiado (Siv)» is Refugiado, for Siv; «Aura +1» is Aura
const ALIAS = { 'soldados veteranos': 'guerreros veteranos', 'casas senoriales': 'casa senorial', 'regio cercano': 'regio', 'regio cercana': 'regio',
  'frontera disputada': 'frontera del tribunal', 'aura 1': 'aura' };
function buscaEnt(nombre, tipo, pts) {
  const m = String(nombre || '').match(/^(.*?)\s*\((.+)\)\s*$/);
  const base = (m ? m[1] : String(nombre || '')).trim(), nota = m ? m[2].trim() : '';
  const val = pts === '' || pts == null || !isFinite(Number(pts)) ? null : ({ 3: 'Mayor', 1: 'Menor', 0: 'Gratuita' })[Number(pts)] || null;
  const kk = ALIAS[k(base)] || k(base);
  const L = DAT ? DAT.vt.filter(e => k(e.n) === kk) : [];
  const e = L.find(x => x.tipo === tipo && (!val || x.valor === val)) || L.find(x => x.tipo === tipo) || L.find(x => x.tipo === 'Gratuita') || L[0];
  if (!e) return Object.assign({ n: base, tipo: val === 'Gratuita' ? 'Gratuita' : tipo, valor: val || (tipo === 'Gratuita' ? 'Gratuita' : 'Menor') }, nota ? { nota: nota } : {});
  const p = { id: e.id };
  if (nota) p.nota = nota;
  if (val && val !== e.valor) { p.valor = val; p.tipo = val === 'Gratuita' ? 'Gratuita' : e.tipo === 'Gratuita' ? tipo : e.tipo; }
  return p;
}
// the sheet of the archive (the «Ficha de Arazas»): its data, Boons and Hooks, government, Reputations, lands and Build Points
function desdeArchivo(doc) {
  const f = vacia();
  const hoja = id => ((doc.sheets || []).find(s => s.id === id || k(s.title) === k(id)) || { blocks: [] }).blocks;
  // the blocks in order, the columns' too
  const plano = (bl, out) => { (bl || []).forEach(b => { if (b && b.t === 'cols') (b.items || []).forEach(c => plano(c, out)); else if (b) out.push(b); }); return out; };
  const filas = b => (b.body || []).filter(r => r && String(r[0] || '').trim() && k(r[0]) !== 'total');
  let tit = '';
  plano(hoja('ficha'), []).forEach(b => {
    if (b.t === 'h3' || b.t === 'h4') { tit = k(b.x); return; }
    if (b.t === 'kv') (b.items || []).forEach(([kk, v]) => {
      const x = k(kk);
      if (x.includes('fundacion')) f.fundada = parseInt(v, 10) || '';
      else if (x === 'lugar') f.lugar = String(v || '');
      else if (x.startsWith('aegis')) f.aegis = String(v || '');
    });
    if (b.t !== 'grid') return;
    if (/^(don|ventaja)/.test(tit)) filas(b).forEach(r => f.vt.push(buscaEnt(r[0], 'Ventaja', r[1])));
    else if (/^(gancho|traba)/.test(tit)) filas(b).forEach(r => f.vt.push(buscaEnt(r[0], 'Traba', r[1])));
    else if (tit.startsWith('reputacion')) f.reputaciones = filas(b).map(r => [String(r[0]), String(r[1] == null ? '' : r[1])]);
    else if (tit.startsWith('tierras')) f.tierras = filas(b).map(r => [0, 1, 2, 3].map(i => String(r[i] == null ? '' : r[i])));
  });
  // the government is an Elección Gratuita, in its «Habitantes»
  plano(hoja('habitantes'), []).forEach(b => {
    if (b.t === 'kv') (b.items || []).forEach(([kk, v]) => { if (k(kk).includes('gobierno') && String(v || '').trim()) f.vt.push(buscaEnt(v, 'Gratuita', 0)); });
  });
  // the Build Points: each heading with its rows
  tit = '';
  plano(hoja('puntos-de-construccion'), []).forEach(b => {
    if (b.t === 'h3' || b.t === 'h4') { tit = String(b.x || ''); return; }
    if (b.t === 'grid') filas(b).forEach(r => f.pc.push([tit, String(r[0]), String(r[1] == null ? '' : r[1])]));
  });
  return f;
}
// a sheet saved before Boons and Hooks came from the book (Dones, Ganchos)
function deVieja(o) {
  const f = Object.assign(vacia(), o, { v: 2, vt: [] });
  (o.dones || []).forEach(r => f.vt.push(buscaEnt(r[0], 'Ventaja', r[1])));
  (o.ganchos || []).forEach(r => f.vt.push(buscaEnt(r[0], 'Traba', r[1])));
  delete f.dones; delete f.ganchos;
  return f;
}
function normaliza(f) {
  const out = Object.assign(vacia(), f);
  ['vt', 'reputaciones', 'tierras', 'pc'].forEach(x => { if (!Array.isArray(out[x])) out[x] = []; });
  return out;
}
// the sheet as it is now: the saved one; else, the archive's (once the book's data is here); else, an empty one
function fichaDe() {
  const st = S.estado && S.estado.ficha;
  if (st && st.v === 2) return normaliza(JSON.parse(JSON.stringify(st)));
  if (st) return normaliza(deVieja(JSON.parse(JSON.stringify(st))));
  const doc = fichaArchivo();
  if (doc && DAT) return normaliza(desdeArchivo(doc));
  return vacia();
}
const guardada = () => !!(S.estado && S.estado.ficha);
// what is saved: without empty notes nor what the book already says
function limpia(f) {
  const t = v => String(v == null ? '' : v).trim();
  return {
    v: 2, lugar: t(f.lugar), fundada: parseInt(f.fundada, 10) || '', estacion: f.estacion || '', aegis: t(f.aegis), notas: t(f.notas), poder: f.poder || '',
    vt: f.vt.map(p => {
      const e = ent(p), o = e ? { id: e.id } : { n: t(p.n), tipo: p.tipo || 'Ventaja', valor: p.valor || 'Menor' };
      if (e && p.tipo && p.valor && (p.tipo !== e.tipo || p.valor !== e.valor)) { o.tipo = p.tipo; o.valor = p.valor; }
      if (t(p.nota)) o.nota = t(p.nota);
      if (p.desc && tipoDe(o) === 'Traba') o.desc = true;
      return o;
    }).filter(o => o.id || o.n),
    reputaciones: f.reputaciones.map(r => r.map(t)).filter(r => r[0]),
    tierras: f.tierras.map(r => r.map(t)).filter(r => r[0]),
    pc: f.pc.map(r => [t(r[0]), t(r[1]), t(r[2])]).filter(r => r[1] || r[2])
  };
}
async function guarda(f, extra, msg) {
  return writeEstado(Object.assign({ ficha: limpia(f) }, extra || {}), msg);
}

/* ---------- the balance and what does not fit */
function balance(vt) {
  let t = 0, v = 0;
  vt.forEach(p => { const x = tipoDe(p); if (x === 'Traba') t += ptsDe(p); else if (x === 'Ventaja') v += ptsDe(p); });
  return { t: t, v: v };
}
function avisos(vt) {
  if (!DAT) return [];
  const out = [], ids = new Set(vt.map(p => p.id).filter(Boolean)), cuenta = new Map();
  vt.forEach(p => { if (p.id) cuenta.set(p.id, (cuenta.get(p.id) || 0) + 1); });
  const visto = new Set();
  vt.forEach(p => {
    const e = ent(p), r = e && e.req && REQ[e.req];
    if (r && !r.ids.some(i => ids.has(i)) && !visto.has(e.id)) { visto.add(e.id); out.push(e.n + ' requiere ' + r.t + '.'); }
  });
  cuenta.forEach((n, id) => { const e = DAT.byId.get(id); if (e && e.max > 0 && n > e.max) out.push(e.n + ' está ' + n + ' veces: se puede coger hasta ' + e.max + '.'); });
  EXCL.forEach(([a, l]) => { if (ids.has(a)) l.filter(x => ids.has(x)).forEach(x => out.push(DAT.byId.get(a).n + ' no se puede coger con ' + DAT.byId.get(x).n + '.')); });
  const desc = vt.filter(p => p.desc && tipoDe(p) === 'Traba');
  if (desc.length > 1) out.push('Solo una Traba puede ser Desconocida, y hay ' + desc.length + '.');
  desc.filter(p => { const e = ent(p); return e && (!e.desc || e.valor !== 'Menor'); }).forEach(p => out.push(nombreDe(p) + ': el libro no la da como Traba Menor que pueda ser Desconocida.'));
  return out;
}
function balanceEl(vt) {
  const b = balance(vt), d = b.t - b.v;
  const [cls, msg] = d === 0 ? ['ok', 'Compensadas'] : d < 0 ? ['over', 'Las Ventajas pasan de las Trabas en ' + plural(-d, 'punto', 'puntos')]
    : ['under', 'Las Trabas pasan de las Ventajas en ' + plural(d, 'punto', 'puntos')];
  return h('div', { class: 'vdt-bal cov-bal ' + cls, 'aria-live': 'polite' }, [
    h('span', { class: 'vdt-bal-n' }, [h('small', { text: 'Trabas' }), h('b', { text: String(b.t) })]),
    h('span', { class: 'vdt-bal-n' }, [h('small', { text: 'Ventajas' }), h('b', { text: String(b.v) })]),
    h('span', { class: 'vdt-bal-st', text: msg })]);
}
const libro = p => {
  const url = LIBROS.libros.Cov && LIBROS.libros.Cov.es, t = 'En el PDF: «Alianzas», página ' + p;
  return url ? h('a', { class: 'cov-src-a', href: url + '#page=' + p, target: '_blank', rel: 'noopener', text: t }) : h('span', { text: t });
};
// the book's whole text of an entry, folded under its summary
const textoCompleto = e => (e.t && e.t.length ? h('details', { class: 'cov-t' }, [h('summary', { text: 'Texto completo del libro' }), ...e.t.map(x => h('p', { text: x }))]) : null);
// whose text it is and under which licence (CC BY-SA 4.0 asks for it wherever the text is shown)
const licencia = () => (DAT && DAT.licencia ? h('p', { class: 'fh cov-lic' }, [document.createTextNode(DAT.licencia.t + ' '),
  h('a', { href: DAT.licencia.url, target: '_blank', rel: 'noopener license', text: 'Ver la licencia' }), document.createTextNode('.')]) : null);
const valorTxt = p => (tipoDe(p) === 'Gratuita' ? 'Gratuita' : valorDe(p)) + (p.desc && tipoDe(p) === 'Traba' ? ' · Desconocida (cuenta como Mayor)' : '');
// «el libro: Traba Menor», when the sheet gives it another value
const otroValor = p => { const e = ent(p); return e && (p.tipo || p.valor) && (tipoDe(p) !== e.tipo || valorDe(p) !== e.valor) ? 'En el libro, ' + (e.tipo === 'Gratuita' ? 'Elección Gratuita' : e.tipo + ' ' + e.valor) : ''; };

/* ---------- the power level and the Build Points */
const totalPC = f => f.pc.reduce((s, r) => s + (numv(r[2]) || 0), 0);
function nivelDe(f) {
  const tot = totalPC(f), auto = PODER.find(n => tot <= n[1]);
  const elegido = f.poder ? PODER.find(n => n[0] === f.poder) || null : null;
  return { tot: tot, n: elegido || auto, elegido: !!elegido, pasa: !!elegido && tot > elegido[1] };
}
const poderTxt = n => (n[3] ? 'Edad mínima de la alianza, ' + n[3] + ' años' : 'Sin edad mínima') + ' · ' + (n[2] ? 'textos de laboratorio y efectos de objetos hasta nivel ' + n[2] : 'textos de laboratorio y objetos sin límite de nivel');
const rango = n => { const i = PODER.indexOf(n), de = i ? PODER[i - 1][1] : 0; return isFinite(n[1]) ? de + '–' + n[1] : 'más de ' + de; };
function pcGrupos(f) {
  const g = new Map();
  f.pc.forEach(r => { const c = String(r[0] || '').trim() || 'Otros'; if (!g.has(c)) g.set(c, []); g.get(c).push(r); });
  return g;
}

/* ---------- the page */
function viewFicha() {
  const D = datos();
  const c = sagaCov(), can = canWrite() && S.owner === true, doc = fichaArchivo();
  const f = fichaDe(), niv = nivelDe(f);
  page.appendChild(sagaCrumbs([['Alianza', null], ['Ficha', null]]));
  page.appendChild(h('h1', { class: 'doc-title', text: c.n }));
  document.title = 'Ficha de ' + c.n + ' — Europa Mítica';
  page.appendChild(h('div', { class: 'doc-meta' }, [h('span', { text: tribTitle(sagaTrib()) }), f.fundada ? h('span', { text: 'Fundada en ' + f.fundada }) : null,
    f.estacion ? h('span', { text: 'Estación de ' + f.estacion.toLowerCase() }) : null, f.pc.length || f.poder ? h('span', { text: 'Poder ' + niv.n[0].toLowerCase() }) : null]));
  const acts = (can ? [h('button', { type: 'button', class: 'btn', onclick: () => openDatos() }, 'Editar la ficha'),
    h('button', { type: 'button', class: 'btn ghost', onclick: () => openVT() }, 'Ventajas y Trabas'),
    h('button', { type: 'button', class: 'btn ghost', onclick: () => openPC() }, 'Puntos de construcción')] : [])
    .concat(doc ? [h('a', { class: 'btn ghost', href: '#' + doc.id, text: doc.title + ' (archivo)' })] : []);
  if (acts.length) page.appendChild(h('div', { class: 'actions' }, acts));
  const content = h('div', { class: 'content' });
  const note = statusNote(); if (note) content.appendChild(note);
  if (doc && !guardada()) content.appendChild(h('p', { class: 'note cov-origen', text: D
    ? 'Esta ficha está hecha con los datos de «' + doc.title + '», la ficha del archivo, que sigue en el índice para compararlas. ' + (can ? 'Al guardar cualquier cambio (con los botones de arriba), queda guardada en la web.' : 'Cuando el máster la guarde, quedará guardada en la web.')
    : 'Cargando las Ventajas y Trabas de «Alianzas» para hacer la ficha con los datos de «' + doc.title + '»…' }));
  const [a, e] = curSeason();
  const kv = [['Año actual', sname(a, e)], ['Año de fundación', f.fundada], ['Tribunal', tribName(sagaTrib()).replace(/^(el|los) /, '')], ['Lugar', f.lugar],
    ['Aura', 'Mágica de nivel ' + sagaAura()], ['Aegis de la Alianza', f.aegis]].filter(x => String(x[1]).trim());
  content.appendChild(R.kv({ items: kv.map(([x, v]) => [x, String(v)]) }));

  // Ventajas y Trabas
  content.appendChild(h('h2', { class: 'sheet-h', text: 'Ventajas y Trabas' }));
  if (!D) content.appendChild(h('p', { class: 'note', text: 'Cargando las Ventajas y Trabas de «Alianzas»…' }));
  else if (!f.vt.length) content.appendChild(h('p', { class: 'note', text: can ? 'Sin Ventajas ni Trabas todavía: elígelas con «Ventajas y Trabas».' : 'El máster aún no ha elegido las Ventajas y Trabas de la alianza.' }));
  else {
    content.appendChild(balanceEl(f.vt));
    const av = avisos(f.vt);
    if (av.length) content.appendChild(h('ul', { class: 'cov-av' }, av.map(t => h('li', { text: t }))));
    const cols = h('div', { class: 'cov-cols' });
    [['Traba', 'Trabas'], ['Ventaja', 'Ventajas'], ['Gratuita', 'Elecciones gratuitas']].forEach(([x, t]) => {
      const L = f.vt.filter(p => tipoDe(p) === x);
      if (!L.length) return;
      const pts = L.reduce((s, p) => s + ptsDe(p), 0);
      cols.appendChild(h('div', { class: 'cov-g' }, [h('h3', null, [document.createTextNode(t), x !== 'Gratuita' ? h('small', { text: plural(pts, 'punto', 'puntos') }) : null]),
        h('ul', { class: 'cov-l' }, L.map(p => h('li', null, itemVista(p))))]));
    });
    content.appendChild(cols);
    content.appendChild(h('p', { class: 'fh', text: 'Pulsa una para leer su resumen y, debajo, el texto completo del libro.' }));
    const lic = licencia(); if (lic) content.appendChild(lic);
  }

  // Puntos de construcción
  content.appendChild(h('h2', { class: 'sheet-h', text: 'Puntos de construcción' }));
  if (!f.pc.length && !f.poder) content.appendChild(h('p', { class: 'note', text: can ? 'Sin repartir todavía: elige el nivel de poder y reparte los puntos con «Puntos de construcción».' : 'El máster aún no ha repartido los Puntos de Construcción.' }));
  else {
    content.appendChild(R.stats({ items: [{ l: 'Repartidos', v: String(niv.tot), s: niv.elegido && isFinite(niv.n[1]) ? 'de ' + niv.n[1] + ' como mucho' : 'Puntos de Construcción' },
      { l: 'Nivel de poder', v: niv.n[0], s: rango(niv.n) + ' puntos' }] }));
    content.appendChild(h('p', { class: 'fh', text: poderTxt(niv.n) + '.' }));
    if (niv.pasa) content.appendChild(h('p', { class: 'note warn', text: 'Se reparten ' + niv.tot + ' puntos: pasan de los ' + niv.n[1] + ' del nivel ' + niv.n[0].toLowerCase() + '.' }));
    const g = pcGrupos(f);
    if (g.size) {
      const items = [...g.entries()].map(([cat, rows]) => [{ t: 'h3', x: cat }, { t: 'grid', head: ['Concepto', 'Puntos'], body: rows.map(r => [r[1], r[2]]).concat([['Total', String(rows.reduce((s, r) => s + (numv(r[2]) || 0), 0))]]), cls: 'narrow total' }]);
      for (let i = 0; i < items.length; i += 3) content.appendChild(R.cols({ items: items.slice(i, i + 3) }));
    }
  }

  // Reputaciones, tierras y notas
  const rc = [];
  if (f.reputaciones.length) rc.push([{ t: 'h3', x: 'Reputaciones' }, { t: 'grid', head: ['Reputación', 'Nivel'], body: f.reputaciones, cls: 'narrow' }]);
  if (rc.length) content.appendChild(R.cols({ items: rc }));
  if (f.tierras.length) { content.appendChild(R.h3({ x: 'Tierras y posesiones' })); content.appendChild(R.grid({ head: ['Tierra', 'Área / dimensiones / pisos', 'Habitantes', 'Notas'], body: f.tierras })); }
  String(f.notas || '').split(/\n{2,}/).filter(p => p.trim()).forEach(p => content.appendChild(h('p', { text: p.trim() })));
  page.appendChild(content);
}
// one Boon or Hook on the sheet: its name and value; opened, its summary and the way to its page in the book
function itemVista(p) {
  const e = ent(p), otro = otroValor(p);
  return h('details', { class: 'cov-i' + (tipoDe(p) === 'Traba' ? ' tr' : '') }, [
    h('summary', null, [h('b', { text: nombreDe(p) }), p.nota ? h('span', { class: 'cov-nota', text: p.nota }) : null, h('span', { class: 'cov-tag', text: valorTxt(p) })]),
    e ? h('p', { class: 'cov-r', text: e.r }) : h('p', { class: 'cov-r none', text: 'Propia de la saga: no está en el libro.' }),
    e ? textoCompleto(e) : null,
    e ? h('p', { class: 'cov-src' }, [h('span', { text: e.cat + (e.req ? ' · requiere ' + e.req : '') + ' · ' }), libro(e.p)]) : null,
    otro ? h('p', { class: 'cov-src', text: otro + '.' }) : null,
    e && e.nota ? h('p', { class: 'cov-src', text: e.nota }) : null]);
}

/* ---------- «Editar la ficha»: the data, the Reputations, the lands and the notes */
function filas(rows, cols, add) {
  const box = h('div', { class: 'fa-rows' });
  const draw = () => {
    box.innerHTML = '';
    rows.forEach((r, i) => box.appendChild(h('div', { class: 'fa-row' }, cols.map(([l, ph, cl, attrs], j) => inp(r[j] == null ? '' : r[j], v => { r[j] = v; if (cols.onChange) cols.onChange(); }, Object.assign({ placeholder: ph || '', 'aria-label': l, class: cl || null }, attrs || {})))
      .concat(h('button', { type: 'button', class: 'lnk', onclick: () => { rows.splice(i, 1); draw(); if (cols.onChange) cols.onChange(); } }, 'Quitar')))));
    box.appendChild(h('button', { type: 'button', class: 'btn ghost', onclick: () => { rows.push(cols.map(() => '')); draw(); const x = box.querySelectorAll('.fa-row'); if (x.length) x[x.length - 1].querySelector('input').focus(); } }, add));
  };
  draw();
  return box;
}
async function openDatos() {
  if (S.owner !== true) return;
  try { await cargar(); } catch (e) { /* the data and the lands do not need the book */ }
  const f = fichaDe(), d = { tribunal: sagaTrib() };
  const grupo = (t, x, cols, add) => h('div', { class: 'fld' }, [h('span', { class: 'fl', text: t }), filas(f[x], cols, add)]);
  const body = [
    h('div', { class: 'fld-row tri' }, [field('Tribunal', sel(TRIBUNALES, d.tribunal, v => { d.tribunal = v; })),
      field('Fundada en', inp(f.fundada, v => { f.fundada = v; }, { type: 'number', inputmode: 'numeric' })),
      field('Estación', sel([['', '—'], 'Primavera', 'Verano', 'Otoño', 'Invierno'], f.estacion, v => { f.estacion = v; }))]),
    h('div', { class: 'fld-row' }, [field('Lugar', inp(f.lugar, v => { f.lugar = v; }, { placeholder: 'Al pie de las Tres Sorores…' })),
      field('Aegis de la Alianza', inp(f.aegis, v => { f.aegis = v; }, { placeholder: 'Nivel 40' }))]),
    grupo('Reputaciones', 'reputaciones', [['Reputación', 'Hechiceros…'], ['Nivel', '1', 'fa-n']], 'Añadir una reputación'),
    grupo('Tierras y posesiones', 'tierras', [['Tierra', 'Valle de Ordesa…'], ['Área', '4,5 km²', 'fa-m'], ['Habitantes', '70', 'fa-n'], ['Notas', 'Notas']], 'Añadir una tierra'),
    field('Notas', h('textarea', { rows: 5, oninput: ev => { f.notas = ev.target.value; } }, f.notas || ''), 'Su historia, sus vecinos… Una línea en blanco separa los párrafos.')];
  const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const close = openModal('Ficha de ' + sagaCov().n, body, [save, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')]);
  save.addEventListener('click', async () => {
    save.disabled = true;
    const ok = await guarda(f, { tribunal: d.tribunal }, 'Ficha de la alianza guardada');
    save.disabled = false;
    if (ok) close();
  });
}

/* ---------- «Puntos de construcción»: the power level and the rows of the distribution */
async function openPC() {
  if (S.owner !== true) return;
  try { await cargar(); } catch (e) { /* not needed here */ }
  const f = fichaDe();
  const tot = h('p', { class: 'cov-pc-tot', 'aria-live': 'polite' });
  const dl = datalist('dl-pc-cat', PC_CATS.concat(f.pc.map(r => r[0])));
  function drawTot() {
    const n = nivelDe(f);
    tot.textContent = 'Repartidos ' + n.tot + ' Puntos de Construcción: nivel ' + n.n[0].toLowerCase() + (n.elegido ? '' : ' (por los puntos)') + '. ' + poderTxt(n.n) + '.'
      + (n.pasa ? ' Pasan de los ' + n.n[1] + ' del nivel elegido.' : '');
    tot.classList.toggle('bad', n.pasa);
  }
  const cols = [['Grupo', 'Biblioteca…', 'fa-m', { list: dl, autocomplete: 'off' }], ['Concepto', 'Summa de Vim, nivel 10, calidad 10…'], ['Puntos', '20', 'fa-n', { type: 'number', inputmode: 'numeric' }]];
  cols.onChange = drawTot;
  const body = [
    field('Nivel de poder', sel([['', 'Según los puntos repartidos']].concat(PODER.map(n => [n[0], n[0] + ' (' + rango(n) + ' puntos)'])), f.poder, v => { f.poder = v; drawTot(); }),
      'Lo que tienen a mano los personajes: en una alianza de Otoño con mucha jerarquía puede ser bajo aunque la alianza sea rica.'),
    tot,
    h('div', { class: 'fld' }, [h('span', { class: 'fl', text: 'Reparto' }), filas(f.pc, cols, 'Añadir una fila')]),
    h('details', { class: 'vdr cov-costes' }, [h('summary', { text: 'Lo que cuesta cada cosa (libro básico)' }), h('ul', null, [
      'Summa de un Arte: nivel + calidad. Nivel 20 como mucho; calidad hasta 11 + 1 por cada punto de nivel por debajo de 20, y nunca más de 22.',
      'Summa de una Habilidad: 3 × nivel + calidad. Nivel 8 como mucho; calidad hasta 11 + 3 por cada punto de nivel por debajo de 8, y nunca más de 22.',
      'Tractatus: su calidad (11 como mucho).',
      'Textos de laboratorio: 1 punto por cada 5 niveles.',
      'Fuente de vis: 5 puntos por cada peón al año. Reserva de vis: 1 punto por cada 5 peones.',
      'Objetos encantados: 2 puntos por cada 5 niveles de efectos.',
      'Profesor: Comunicación + Enseñanza + su mejor Habilidad. Otros especialistas: su mejor Habilidad.',
      'Dinero: 1 punto por cada 10 libras de plata.'].map(t => h('li', { text: t })))])];
  drawTot();
  const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const close = openModal('Puntos de construcción', body, [save, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')]);
  save.addEventListener('click', async () => {
    save.disabled = true;
    const ok = await guarda(f, null, 'Puntos de construcción guardados');
    save.disabled = false;
    if (ok) close();
  });
}

/* ---------- «Ventajas y Trabas»: the book's list, with a search and filters, the balance on top and the chosen ones */
const VT_ST = { q: '', tipo: '', cat: '', valor: '', solo: false };
const TV = [['Ventaja|Mayor', 'Ventaja Mayor (3)'], ['Ventaja|Menor', 'Ventaja Menor (1)'], ['Traba|Mayor', 'Traba Mayor (3)'], ['Traba|Menor', 'Traba Menor (1)'], ['Gratuita|Gratuita', 'Elección Gratuita']];
async function openVT() {
  if (S.owner !== true) return;
  try { await cargar(); } catch (e) { toast('No se han podido cargar las Ventajas y Trabas del libro: prueba otra vez.'); return; }
  const f = fichaDe(), vt = f.vt.map(p => Object.assign({}, p)), st = VT_ST;
  const ORD_T = { Ventaja: 0, Traba: 1, Gratuita: 2 };
  const LIST = DAT.vt.slice().sort((a, b) => ORD_T[a.tipo] - ORD_T[b.tipo] || DAT.cats.indexOf(a.cat) - DAT.cats.indexOf(b.cat) || a.n.localeCompare(b.n, 'es'));
  const balBox = h('div', { class: 'cov-bal-box' });
  const sum = h('span', { class: 'vdt-sum', 'aria-live': 'polite' });
  function drawBal() {
    balBox.replaceChildren(balanceEl(vt));
    const av = avisos(vt);
    if (av.length) balBox.appendChild(h('ul', { class: 'cov-av' }, av.map(t => h('li', { text: t }))));
    sum.textContent = plural(vt.length, 'elegida', 'elegidas');
  }
  const ul = h('ul', { class: 'vdt-list cov-list' });
  const count = h('p', { class: 'vdt-count', 'aria-live': 'polite' });
  const picksOf = e => vt.filter(p => p.id === e.id);
  // the rows of one entry on the sheet: a note, its value if it is not the book's, Unknown, and «Quitar»
  function pickRow(p, e, redraw) {
    const val = sel(TV, tipoDe(p) + '|' + valorDe(p), v => {
      const [t, x] = v.split('|');
      if (t === e.tipo && x === e.valor) { delete p.tipo; delete p.valor; } else { p.tipo = t; p.valor = x; }
      if (tipoDe(p) !== 'Traba') delete p.desc;
      redraw(); drawBal();
    }, { 'aria-label': 'Valor de ' + e.n + ' en esta alianza' });
    const desc = tipoDe(p) === 'Traba' && valorDe(p) === 'Menor' && e.desc ? h('label', { class: 'chk cov-desc' }, [
      h('input', { type: 'checkbox', checked: p.desc ? true : null, onchange: ev => { if (ev.target.checked) p.desc = true; else delete p.desc; drawBal(); } }), h('span', { text: 'Desconocida' })]) : null;
    return h('div', { class: 'cov-pick' }, [inp(p.nota || '', v => { p.nota = v; }, { placeholder: 'Nota: cuál, quién, dónde…', 'aria-label': 'Nota de ' + e.n }), val, desc,
      h('button', { type: 'button', class: 'lnk', onclick: () => { vt.splice(vt.indexOf(p), 1); redraw(); drawBal(); } }, 'Quitar')]);
  }
  // «Leer el texto completo»: the book's text under the summary, and folded again; it stays open while the card is redrawn
  const abiertos = new Set();
  function leer(e) {
    if (!e.t || !e.t.length) return null;
    const box = h('div', { class: 'cov-tx' }, e.t.map(x => h('p', { text: x })));
    const b = h('button', { type: 'button', class: 'lnk cov-leer', 'aria-expanded': 'false' });
    const pon = () => { const on = abiertos.has(e.id); box.hidden = !on; b.textContent = on ? 'Ocultar el texto completo' : 'Leer el texto completo'; b.setAttribute('aria-expanded', String(on)); };
    b.addEventListener('click', () => { if (abiertos.has(e.id)) abiertos.delete(e.id); else abiertos.add(e.id); pon(); });
    pon();
    return h('div', { class: 'cov-leer-b' }, [b, box]);
  }
  function card(e) {
    const li = h('li', { class: 'vdt-it' + (e.tipo === 'Traba' ? ' tr' : '') });
    function redraw() {
      const L = picksOf(e), on = L.length > 0;
      li.classList.toggle('on', on);
      const cb = h('input', { type: 'checkbox', class: 'vdt-cb', checked: on ? true : null, 'aria-label': (on ? 'Quitar ' : 'Elegir ') + e.n });
      cb.addEventListener('change', () => {
        if (cb.checked) vt.push({ id: e.id }); else for (let i = vt.length - 1; i >= 0; i--) if (vt[i].id === e.id) vt.splice(i, 1);
        redraw(); drawBal();
      });
      const meta = [h('span', { class: 'k', text: e.tipo === 'Gratuita' ? 'Elección Gratuita' : e.tipo + ' · ' + e.valor }), h('span', { text: e.cat }),
        e.req ? h('span', { text: 'Requiere ' + e.req }) : null, e.desc ? h('span', { text: 'Puede ser Desconocida' }) : null,
        e.max > 0 ? h('span', { text: 'Hasta ' + e.max + ' veces' }) : e.max === 0 ? h('span', { text: 'Varias veces' }) : null];
      const otra = on && !(e.max > 0 && L.length >= e.max) ? h('button', { type: 'button', class: 'lnk cov-otra', onclick: () => { vt.push({ id: e.id }); redraw(); drawBal(); } }, 'Otra vez') : null;
      li.replaceChildren(cb, h('div', { class: 'vdt-b' }, [
        h('div', { class: 'vdt-h' }, [h('b', { text: e.n }), L.length > 1 ? h('i', { text: '× ' + L.length }) : null]),
        h('div', { class: 'vdt-m' }, meta),
        h('p', { class: 'vdt-d', text: e.r }),
        leer(e),
        e.nota ? h('p', { class: 'vdt-lock', text: e.nota }) : null,
        h('p', { class: 'cov-src' }, libro(e.p)),
        ...L.map(p => pickRow(p, e, redraw)), otra]));
    }
    redraw();
    return li;
  }
  function draw() {
    const terms = norm(st.q).split(/\s+/).filter(t => t.length > 1);
    const hits = LIST.filter(e => (!st.tipo || e.tipo === st.tipo) && (!st.cat || e.cat === st.cat) && (!st.valor || e.valor === st.valor)
      && (!st.solo || vt.some(p => p.id === e.id)) && terms.every(t => (e._k || (e._k = norm(e.n + ' ' + e.r + ' ' + e.cat + ' ' + (e.t || []).join(' ')))).includes(t)));
    const first = terms[0] || '';
    if (first) hits.sort((a, b) => norm(b.n).includes(first) - norm(a.n).includes(first));
    ul.replaceChildren(...hits.map(card));
    // «Monstruo del Foso: ver Aliado Local»
    const ver = terms.length ? DAT.ver.filter(x => terms.every(t => norm(x.n).includes(t))) : [];
    count.textContent = (hits.length ? plural(hits.length, 'resultado', 'resultados') : 'Nada coincide con la búsqueda') + (ver.length ? ' · ' + ver.map(x => '«' + x.n + '»: en el libro, ver ' + x.ver).join(' · ') : '') + '.';
    clear.hidden = !(st.q || st.tipo || st.cat || st.valor || st.solo);
  }
  const q = h('input', { type: 'search', value: st.q, placeholder: 'Buscar por nombre o en el texto…', autocomplete: 'off', 'aria-label': 'Buscar Ventaja o Traba' });
  let tm = null;
  q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { st.q = q.value; draw(); }, 120); });
  const fTipo = sel([['', 'Ventajas, Trabas y Gratuitas'], ['Ventaja', 'Solo Ventajas'], ['Traba', 'Solo Trabas'], ['Gratuita', 'Solo Elecciones Gratuitas']], st.tipo, v => { st.tipo = v; draw(); }, { 'aria-label': 'Ventajas o Trabas' });
  const fCat = sel([['', 'Todas las categorías']].concat(DAT.cats.map(c => [c, c])), st.cat, v => { st.cat = v; draw(); }, { 'aria-label': 'Categoría' });
  const fValor = sel([['', 'Cualquier valor'], ['Mayor', 'Mayor (3)'], ['Menor', 'Menor (1)']], st.valor, v => { st.valor = v; draw(); }, { 'aria-label': 'Valor' });
  const fSolo = h('input', { type: 'checkbox', id: 'cov-solo', checked: st.solo ? true : null });
  fSolo.addEventListener('change', () => { st.solo = fSolo.checked; draw(); });
  const clear = h('button', { type: 'button', class: 'lnk', onclick: () => {
    Object.assign(st, { q: '', tipo: '', cat: '', valor: '', solo: false });
    q.value = ''; fTipo.value = ''; fCat.value = ''; fValor.value = ''; fSolo.checked = false;
    draw(); q.focus();
  } }, 'Quitar filtros');
  const fbar = h('div', { class: 'vdt-f' }, [balBox, q, fTipo, fCat, fValor, h('label', { class: 'chk', for: 'cov-solo' }, [fSolo, h('span', { text: 'Solo las elegidas' })]), clear,
    h('div', { class: 'vdt-cnt' }, [count])]);

  // the book's example covenants: one replaces what is chosen
  const sit = { i: '' };
  const sitTxt = h('p', { class: 'fh' });
  const sitSel = sel([['', 'Elige una situación']].concat(DAT.situaciones.map((s, i) => [String(i), s.n])), '', v => { sit.i = v; drawSit(); }, { 'aria-label': 'Situación del libro' });
  function drawSit() {
    const s = DAT.situaciones[Number(sit.i)];
    if (sit.i === '' || !s) { sitTxt.textContent = 'Conjuntos de Ventajas y Trabas del libro para empezar rápido; luego se ajustan a la saga.'; usar.hidden = true; return; }
    const tmp = s.vt.flatMap(x => Array.from({ length: x.x || 1 }, () => x)), b = balance(tmp);
    sitTxt.textContent = s.d + ' Trabas ' + b.t + ', Ventajas ' + b.v + (b.t === b.v ? '.' : ' (así viene en el libro).');
    sitTxt.appendChild(document.createTextNode(' '));
    sitTxt.appendChild(libro(s.p));
    usar.hidden = false;
  }
  const usar = confirmButton('Usar esta situación', 'Pulsa otra vez: sustituye las elegidas', () => {
    const s = DAT.situaciones[Number(sit.i)];
    if (!s) return;
    vt.splice(0, vt.length);
    s.vt.forEach(x => { for (let i = 0; i < (x.x || 1); i++) vt.push(Object.assign({ id: x.id }, x.nota ? { nota: x.nota } : {}, x.tipo ? { tipo: x.tipo, valor: x.valor } : {})); });
    drawBal(); drawOwn(); draw();
    toast('Situación «' + s.n + '»: ' + plural(vt.length, 'elección', 'elecciones') + '. Guarda para que quede en la ficha.');
  });
  usar.classList.remove('danger');
  usar.classList.add('ghost');
  const sitBox = h('details', { class: 'vdr cov-sit' }, [h('summary', { text: 'Partir de una situación del libro' }), h('div', { class: 'cov-sit-b' }, [sitSel, usar]), sitTxt]);
  drawSit();
  const rules = h('details', { class: 'vdr' }, [h('summary', { text: 'Reglas de las Ventajas y Trabas' }), h('ul', null, REGLAS.map(t => h('li', { text: t })))]);

  // the saga's own, not in the book: a name and a value
  const ownBox = h('section', { class: 'cov-own', 'aria-label': 'Propias de la saga' });
  function drawOwn() {
    const L = vt.filter(p => !p.id);
    const nIn = h('input', { type: 'text', placeholder: 'Nombre', 'aria-label': 'Nombre de la Ventaja o Traba propia', maxlength: '80' });
    let tv = 'Ventaja|Menor';
    const tvSel = sel(TV, tv, v => { tv = v; }, { 'aria-label': 'Valor de la propia' });
    const add = h('button', { type: 'button', class: 'btn ghost', onclick: () => {
      const n = nIn.value.trim();
      if (!n) { nIn.focus(); return; }
      const [t, x] = tv.split('|');
      vt.push({ n: n, tipo: t, valor: x });
      drawOwn(); drawBal();
    } }, 'Añadir');
    ownBox.replaceChildren(h('h3', { text: 'Propias de la saga' }), h('p', { class: 'fh', text: 'Las que no están en el libro: solo un nombre y su valor.' }),
      ...L.map(p => h('div', { class: 'cov-pick' }, [inp(p.n || '', v => { p.n = v; }, { 'aria-label': 'Nombre' }),
        sel(TV, tipoDe(p) + '|' + valorDe(p), v => { const [t, x] = v.split('|'); p.tipo = t; p.valor = x; if (t !== 'Traba') delete p.desc; drawBal(); }, { 'aria-label': 'Valor' }),
        inp(p.nota || '', v => { p.nota = v; }, { placeholder: 'Nota', 'aria-label': 'Nota' }),
        h('button', { type: 'button', class: 'lnk', onclick: () => { vt.splice(vt.indexOf(p), 1); drawOwn(); drawBal(); } }, 'Quitar')])),
      h('div', { class: 'cov-pick' }, [nIn, tvSel, add]));
  }
  drawOwn();

  const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const cancel = h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar');
  const close = openModal('Ventajas y Trabas de ' + sagaCov().n, [fbar, h('p', { class: 'fh vdt-help', text: 'Marca la casilla para elegirla y desmárcala para quitarla. Debajo de cada elegida se le pone una nota (a quién, cuál…) o se cambia su valor si la saga la usa de otra forma. Cada una tiene su resumen y, con «Leer el texto completo», el texto del libro.' }),
    rules, sitBox, ul, ownBox, licencia()].filter(Boolean), [sum, save, cancel]);
  save.addEventListener('click', async () => {
    save.disabled = true;
    f.vt = vt;
    const ok = await guarda(f, null, 'Ventajas y Trabas guardadas');
    save.disabled = false;
    if (ok) close();
  });
  const box = document.body.lastElementChild;
  if (box && box.classList.contains('modal')) box.classList.add('vd-tab');
  drawBal();
  draw();
}

export { desdeArchivo, fichaDe, viewFicha };
