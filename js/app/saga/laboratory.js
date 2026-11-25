/* El laboratorio de cada magus (Alianzas, sección 9: «Laboratorio»). Cada laboratorio es un documento laboratorios/{id} con su
   dueño (el id del personaje, o vacío si está libre): un magus tiene uno, y puede pasar a otro o quedarse libre en la alianza.

   El laboratorio tiene ocho Características (Tamaño, Perfeccionamiento, Calidad General, Mantenimiento, Seguridad, Informidad,
   Salubridad, Estética), Virtudes y Defectos (Mayores 3 puntos, Menores 1, Gratuitos 0) que las cambian y dan Especializaciones,
   y Especializaciones (como mucho dos de actividades y cuatro de Artes, de ellas dos Técnicas). Las reglas:
   - puntos de Virtudes − puntos de Defectos ≤ Tamaño + Perfeccionamiento; Tamaño ocupado = ese neto − Perfeccionamiento;
   - Seguridad de partida = Perfeccionamiento − Tamaño ocupado (si es positivo); las demás, 0; luego, lo de cada Virtud y Defecto;
   - la Calidad General se suma a todos los Totales de Laboratorio (no a enseñar ni a escribir); una Especialización de Arte, a los
     que usan ese Arte; una de actividad, a esa actividad (Hechizos al inventar, Textos al aprender de textos o traducirlos…).
   Las Virtudes, Defectos, Distintivos y laboratorios de ejemplo salen del libro (data/laboratorio.json, de
   herramientas/laboratorio_alianzas.py). El cálculo se guarda con el laboratorio (calc), y de ahí lo leen los Totales de
   Laboratorio de la ficha y de las estaciones (saga/rules.js: labDe, labBonos). */
import { h, R } from '../base.js';
import { S } from './state.js';
import { confirmButton, dbWrite, field, inp, localPut, openModal, sagaChanged, sel, stamp, toast } from './core.js';
import { canWrite, labDe, numv, sgn } from './rules.js';

let LD = null, LD_P = null;
/* las reglas del libro: se piden la primera vez que hacen falta; al llegar, se vuelve a pintar */
function labData() {
  if (!LD_P) LD_P = fetch('data/laboratorio.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { LD = d; sagaChanged(); }).catch(() => { LD_P = null; });
  return LD;
}

const PTS = { Mayor: 3, Menor: 1 };
const tipoTxt = d => d.clase + ' ' + (d.valor || '').toLowerCase() + ' de ' + d.cat.toLowerCase().replace('sobrenatural', 'lo sobrenatural');
const artesDe = D => D.tecnicas.concat(D.formas);
/* los ajustes que dependen de algo («+(Inteligencia + Teoría Mágica del ayudante) Calidad General»): [[texto, Característica]] */
const variables = d => (d.var || []).map(t => /^\+\((.+)\) (Calidad General|Seguridad)$/.exec(t)).filter(Boolean).map(m => [m[1], m[2]]);
/* Calefacción Mágica e Iluminación Mágica funcionan como la de Calidad o la Excesiva (x.alt), sin su Mantenimiento ni su sitio */
const COMO = { 'Calefacción Mágica': ['Calefacción de Calidad', 'Calefacción Excesiva'], 'Iluminación Mágica': ['Iluminación de Calidad', 'Iluminación Excesiva'] };
const comoDe = x => COMO[x.n].includes(x.alt) ? x.alt : COMO[x.n][0];
function efectivo(d, x, D) {
  const b = COMO[d.n] && D.vd.find(v => v.n === comoDe(x));
  if (!b) return d;
  const mods = Object.assign({}, b.mods);
  delete mods['Mantenimiento'];
  return Object.assign({}, d, { mods: mods, esp: b.esp || [], var: [] });
}

/* qué Especializaciones puede elegir una Virtud o Defecto para su punto o puntos */
function opciones(g, x, d, lab, D) {
  const todas = D.actividades.concat(artesDe(D));
  const expande = L => [].concat(...L.map(e => e === 'Técnica' ? D.tecnicas : [e]));
  if (/^Distintivo/.test(d.n) && x.dist) {
    const di = D.distintivos.find(z => z.n === x.dist);
    if (di) return expande(di.de);
  }
  if (g.libre === 'Distintivo') {
    const L = (lab.vd || []).filter(y => /^Distintivo/.test(y.n) && y.dist).map(y => D.distintivos.find(z => z.n === y.dist)).filter(Boolean);
    return L.length ? [...new Set(expande([].concat(...L.map(z => z.de))))] : todas;
  }
  if (g.de && g.de.length) return expande(g.de);
  return g.libre === 'Arte' ? artesDe(D) : g.libre === 'Forma' ? D.formas : g.libre === 'Técnica' ? D.tecnicas : g.libre === 'Actividad' ? D.actividades : todas;
}

/* el cálculo: Características, puntos, Especializaciones (las que cuentan y las que sobran) y avisos */
function labCalc(lab, D) {
  const car = {};
  D.car.forEach(k => { car[k] = 0; });
  const perf = Math.round(numv(lab.perf));
  const items = (lab.vd || []).map(x => { const d = D.vd.find(v => v.n === x.n); return { x: x, d: d && efectivo(d, x, D) }; }).filter(o => o.d);
  // el Tamaño, con lo que le sumen sus Virtudes (Regio: +3), da el sitio para Virtudes
  const tam = Math.round(numv(lab.tam)) + items.reduce((s, o) => s + (o.d.mods['Tamaño'] || 0), 0);
  let pv = 0, pd = 0;
  items.forEach(({ d }) => { const p = PTS[d.valor] || 0; if (d.clase === 'Virtud') pv += p; else pd += p; });
  const neto = pv - pd, limite = tam + perf, ocupado = neto - perf;
  car['Tamaño'] = tam; car['Perfeccionamiento'] = perf; car['Seguridad'] = perf - Math.max(0, ocupado);
  let tope = null, mitad = false;
  items.forEach(({ x, d }) => {
    let mods = Object.assign({}, d.mods);
    delete mods['Tamaño'];
    if (d.n === 'Restricción' && x.alt) mods = { 'Mantenimiento': 2 };
    if (d.n === 'Vacío') { if (x.alt === 'Salubridad') mods['Salubridad'] = -1; else mods['Mantenimiento'] = 1; }
    if (d.n === 'Estudio') mods['Estética'] = Math.max(1, Math.min(3, Math.round(numv(x.val)) || 1));
    Object.keys(mods).forEach(k => { car[k] = (car[k] || 0) + mods[k]; });
    variables(d).forEach(([, k], i) => { car[k] += Math.round(numv(i ? (x.vals || [])[i] : x.val)); });
    if (d.n === 'Sin Iluminación') tope = -1;
    if (d.n === 'Invisible' || d.n === 'Velado') mitad = true;
  });
  Object.keys(lab.ajuste || {}).forEach(k => { if (k in car) car[k] += Math.round(numv(lab.ajuste[k])); });
  if (mitad) car['Estética'] = Math.floor(car['Estética'] / 2);   // la mitad, después de lo demás
  if (tope != null) car['Estética'] = Math.min(car['Estética'], tope);
  // Especializaciones
  const esp = {}, sinElegir = [];
  const suma = (k, v) => { if (k) esp[k] = (esp[k] || 0) + v; };
  items.forEach(({ x, d }) => {
    let si = 0;
    (d.esp || []).forEach(g => {
      if (!g.libre && g.de && g.de.length === 1) { suma(g.de[0], g.v); return; }
      const n = g.libre ? g.v : 1, v = g.libre ? 1 : g.v;
      for (let k = 0; k < n; k++) { const s = (x.sel || [])[si++]; if (s) suma(s, v); else if (!sinElegir.includes(d.n)) sinElegir.push(d.n); }
    });
  });
  Object.keys(lab.espAjuste || {}).forEach(k => suma(k, Math.round(numv(lab.espAjuste[k]))));
  items.filter(o => o.d.n === 'Sin Decorar').forEach(({ x }) => {   // resta 1 a una Especialización de 2 o más
    const k = (x.sel || [])[0] && esp[(x.sel || [])[0]] >= 2 ? x.sel[0] : Object.keys(esp).filter(e => esp[e] >= 2).sort((a, b) => esp[b] - esp[a])[0];
    if (k) esp[k] -= 1;
  });
  // como mucho 2 de actividades y 4 de Artes (2 Técnicas): las que el jugador descarta, fuera; luego, las de más puntos
  const desc = new Set(lab.descartes || []);
  const positivas = Object.keys(esp).filter(k => esp[k] > 0), orden = (a, b) => esp[b] - esp[a];
  const acts = positivas.filter(k => D.actividades.includes(k) && !desc.has(k)).sort(orden).slice(0, 2);
  const tecs = positivas.filter(k => D.tecnicas.includes(k) && !desc.has(k)).sort(orden).slice(0, 2);
  const formas = positivas.filter(k => D.formas.includes(k) && !desc.has(k));
  const artes = tecs.concat(formas).sort(orden).slice(0, 4);
  const cuenta = {};
  acts.concat(artes).forEach(k => { cuenta[k] = esp[k]; });
  Object.keys(esp).filter(k => esp[k] < 0).forEach(k => { cuenta[k] = esp[k]; });   // las negativas cuentan siempre
  const sobran = positivas.filter(k => !(k in cuenta));
  const avisos = [];
  if (neto > limite) avisos.push('Las Virtudes menos los Defectos suman ' + neto + ' puntos y el laboratorio solo tiene sitio para ' + limite + ' (Tamaño + Perfeccionamiento): quita alguna Virtud, añade un Defecto o sube el Tamaño o el Perfeccionamiento.');
  if (sinElegir.length) avisos.push('Falta elegir la Especialización de: ' + sinElegir.join(', ') + '.');
  if (sobran.length) avisos.push('Tiene más Especializaciones de las permitidas (dos de actividades y cuatro de Artes, dos de ellas Técnicas): no cuentan ' + sobran.join(', ') + '.');
  return { car: car, esp: cuenta, todas: esp, sobran: sobran, puntos: { virtudes: pv, defectos: pd, neto: neto, limite: limite, ocupado: ocupado }, avisos: avisos };
}

/* el texto de lo que hace una Virtud o Defecto: «+2 Seguridad, +1 Estética; +1 Enseñanza» */
function efectoTxt(d) {
  const a = Object.keys(d.mods || {}).map(k => sgn(d.mods[k]) + ' ' + k);
  const b = (d.esp || []).map(g => g.libre ? g.v + (g.v === 1 ? ' punto' : ' puntos') + ' de Especialización' + (g.de && g.de.length ? ' (' + g.de.join(', ') + ')' : g.libre === 'Arte' ? ' de Arte' : g.libre === 'Forma' ? ' de Forma' : g.libre === 'Actividad' ? ' de actividad' : g.libre === 'Distintivo' ? ' del Distintivo' : '')
    : sgn(g.v) + ' ' + g.de.join(' o '));
  return [a.join(', '), b.join(', ')].filter(Boolean).join('; ') + ((d.var || []).length ? (a.length || b.length ? '; ' : '') + d.var.join('; ') : '');
}

const fmt = v => v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0';
const espTxt = esp => Object.keys(esp).sort((a, b) => esp[b] - esp[a]).map(k => k + ' ' + esp[k]).join(', ');

/* ---------- la pestaña «Laboratorio» de la ficha */
function pjLab(content, id, pj) {
  const D = labData(), lab = labDe(id), mio = canWrite();
  if (mio) content.appendChild(h('div', { class: 'actions lab-acts' }, [
    h('button', { type: 'button', class: 'btn', onclick: () => openLabEditor(null, id) }, 'Crear un laboratorio'),
    h('button', { type: 'button', class: 'btn', onclick: () => openLabChooser(id) }, 'Elegir un laboratorio')]));
  if (!lab) {
    content.appendChild(h('p', { class: 'note', text: (pj.nombre || 'Este magus') + ' no tiene laboratorio asignado: sus Totales de Laboratorio son los de uno estándar (todo a 0). ' +
      (mio ? 'Crea uno a su medida o elige uno de la alianza o de los ejemplos del libro.' : '') }));
    content.appendChild(h('p', { class: 'fh', text: 'Las reglas son las de Alianzas, sección 9 (Laboratorio).' }));
    return;
  }
  const c = lab.calc || {}, car = c.car || {}, esp = c.esp || {};
  content.appendChild(h('h2', { class: 'lab-n', text: lab.n || 'Laboratorio' }));
  if (lab.ejemplo) content.appendChild(h('p', { class: 'fh', text: 'Copiado del laboratorio de ejemplo «' + lab.ejemplo + '» de Alianzas.' }));
  content.appendChild(R.stats({ items: (D ? D.car : Object.keys(car)).map(k => ({ l: k, v: k === 'Tamaño' && c.puntos && c.puntos.ocupado !== numv(lab.tam) ? fmt(numv(car[k])) + ' (' + fmt(c.puntos.ocupado) + ')' : fmt(numv(car[k])) })) }));
  if (c.puntos) content.appendChild(h('p', { class: 'fh', text: 'Virtudes ' + c.puntos.virtudes + ' − Defectos ' + c.puntos.defectos + ' = ' + c.puntos.neto + ' puntos, de ' + c.puntos.limite + ' que caben (Tamaño + Perfeccionamiento). Entre paréntesis, el Tamaño ocupado.' }));
  // lo que hace en sus totales
  const efectos = [];
  if (numv(car['Calidad General'])) efectos.push('Calidad General ' + fmt(numv(car['Calidad General'])) + ' a todos sus Totales de Laboratorio (no al enseñar ni al escribir).');
  const ks = Object.keys(esp);
  if (ks.length) efectos.push('Especializaciones: ' + espTxt(esp) + '. Las de un Arte se suman a los Totales de Laboratorio con ese Arte (no a los de avance); las de una actividad, cuando se hace esa actividad.');
  if (numv(car['Seguridad'])) efectos.push(numv(car['Seguridad']) > 0 ? 'Seguridad ' + fmt(numv(car['Seguridad'])) + ': ' + numv(car['Seguridad']) + ' dado(s) de pifia menos en el laboratorio.' : 'Seguridad ' + fmt(numv(car['Seguridad'])) + ': laboratorio inseguro; cada estación, un dado simple ≤ ' + Math.abs(numv(car['Seguridad'])) + ' puede ser un accidente, y tira ' + Math.abs(numv(car['Seguridad'])) + ' dado(s) de pifia más.');
  if (numv(car['Salubridad'])) efectos.push('Salubridad ' + fmt(numv(car['Salubridad'])) + ' a las tiradas de recuperación de heridas, y ' + fmt(Math.floor(numv(car['Salubridad']) / 2)) + ' a las Condiciones de Vida si pasa allí medio año.');
  if (numv(car['Informidad']) > 0) efectos.push('Informidad ' + fmt(numv(car['Informidad'])) + ': cada estación, un dado simple ≤ ' + numv(car['Informidad']) + ' tuerce lo que salga de su trabajo (efecto secundario o modificado).');
  if (numv(car['Estética'])) efectos.push('Estética ' + fmt(numv(car['Estética'])) + ': ' + Math.abs(numv(car['Estética'])) * 5 + ' puntos de experiencia en una Reputación apropiada.');
  if (numv(car['Mantenimiento'])) efectos.push('Mantenimiento ' + fmt(numv(car['Mantenimiento'])) + ': su coste de construcción y anual cambia (Alianzas, sección 5: Riqueza y Pobreza).');
  if (efectos.length) { content.appendChild(h('h3', { text: 'Lo que hace en su trabajo' })); content.appendChild(h('ul', { class: 'lab-ef-l' }, efectos.map(t => h('li', { text: t })))); }
  // virtudes y defectos
  content.appendChild(h('h3', { text: 'Virtudes y defectos' }));
  if ((lab.vd || []).length) {
    content.appendChild(h('ul', { class: 'lab-vd-l' }, lab.vd.map(x => {
      const d = D && D.vd.find(v => v.n === x.n) && efectivo(D.vd.find(v => v.n === x.n), x, D);
      const extra = [COMO[x.n] ? 'Como ' + comoDe(x) + ', sin Mantenimiento' : '', x.dist ? 'Distintivo: ' + x.dist : '', (x.sel || []).filter(Boolean).length ? 'Especialización: ' + x.sel.filter(Boolean).join(', ') : '', x.nota || ''].filter(Boolean).join(' · ');
      return h('li', null, [h('b', { text: x.n }), d ? h('span', { class: 'vtag', text: tipoTxt(d) }) : null, d ? h('span', { class: 'lab-ef', text: efectoTxt(d) }) : null, extra ? h('span', { class: 'fh', text: extra }) : null]);
    })));
  } else content.appendChild(h('p', { class: 'note', text: 'Ninguno: un laboratorio estándar.' }));
  // lo que no sale de la lista (objetos mágicos, o lo que una ficha tenga distinto del libro)
  const ajustes = [lab.ajuste, lab.espAjuste].map(o => Object.keys(o || {}).filter(k => numv(o[k])).map(k => k + ' ' + fmt(numv(o[k])))).flat();
  if (ajustes.length) content.appendChild(h('p', { class: 'fh', text: 'Ajustes que no salen de la lista: ' + ajustes.join(', ') + '.' }));
  if (lab.rasgos) { content.appendChild(h('h3', { text: 'Rasgos de personalidad' })); content.appendChild(h('p', { text: lab.rasgos })); }
  if (lab.foco) { content.appendChild(h('h3', { text: 'Distintivos y foco' })); content.appendChild(h('p', { text: lab.foco })); }
  if (lab.desc) { content.appendChild(h('h3', { text: 'Descripción' })); String(lab.desc).split(/\n{2,}/).forEach(p => content.appendChild(h('p', { text: p }))); }
  if (mio) content.appendChild(h('div', { class: 'actions' }, [
    h('button', { type: 'button', class: 'btn ghost', onclick: () => openLabEditor(lab._id, id) }, 'Editar el laboratorio'),
    confirmButton('Dejar el laboratorio', 'Pulsa otra vez: quedará libre en la alianza', () => asignar(lab._id, '', 'Laboratorio libre'))]));
}

/* ---------- guardar: un laboratorio para un magus (el que tenía queda libre) */
async function guardar(id, doc, pjId, msg) {
  const batch = S.db && S.db.batch();
  if (!batch) { toast('La saga en curso no está disponible en esta vista.'); return null; }
  const nuevo = !id;
  id = id || ('lab' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
  const out = stamp(doc, nuevo);
  if (!nuevo && S.lab[id] && S.lab[id].creado) out.creado = S.lab[id].creado;
  batch.set('laboratorios/' + id, out);
  const libres = [];
  if (pjId) Object.keys(S.lab).forEach(k => { if (k !== id && S.lab[k].dueno === pjId) { const o = Object.assign({}, S.lab[k], { dueno: '' }); batch.set('laboratorios/' + k, o); libres.push([k, o]); } });
  const ok = await dbWrite(() => batch.commit(), msg || 'Laboratorio guardado');
  if (!ok) return null;
  libres.forEach(([k, o]) => localPut('lab', k, o));
  localPut('lab', id, out);
  return id;
}
function asignar(labId, pjId, msg) {
  const lab = S.lab[labId];
  if (!lab) return;
  return guardar(labId, Object.assign({}, lab, { dueno: pjId }), pjId, msg);
}

/* ---------- crear o editar */
function openLabEditor(labId, pjId, base) {
  const D = labData();
  if (!D) { toast('Cargando las reglas del laboratorio… vuelve a pulsar en un momento.'); return; }
  const ex = labId ? S.lab[labId] : null;
  const pj = S.pj[pjId] || {};
  const d = JSON.parse(JSON.stringify(Object.assign({ n: '', tam: 0, perf: 0, vd: [], ajuste: {}, espAjuste: {}, descartes: [], rasgos: '', foco: '', desc: '' }, base || ex || {})));
  if (!d.n) d.n = 'Laboratorio de ' + (pj.nombre || 'magus');
  const lista = h('div', { class: 'lab-vds' }), res = h('div', { class: 'lab-res' }), prev = h('p', { class: 'fh lab-prev' });
  const draw = () => { drawList(); drawRes(); };
  function drawList() {
    lista.innerHTML = '';
    if (!d.vd.length) { lista.appendChild(h('p', { class: 'note', text: 'Ninguna: un laboratorio estándar. Añade Virtudes y Defectos con el desplegable de abajo.' })); return; }
    d.vd.forEach((x, i) => {
      const dd = D.vd.find(v => v.n === x.n);
      if (!dd) { lista.appendChild(h('div', { class: 'lab-vd' }, [h('b', { text: x.n }), h('span', { class: 'fh', text: 'No está en la lista del libro.' })])); return; }
      const ctl = [];
      if (/^Distintivo/.test(dd.n)) ctl.push(field('Distintivo', sel([['', '— cuál —']].concat(D.distintivos.map(z => [z.n, z.n + ' (' + z.de.join(', ') + ')'])), x.dist || '', v => { x.dist = v; x.sel = []; draw(); })));
      if (COMO[dd.n]) ctl.push(field('Funciona como', sel(COMO[dd.n].map(v => [v, v + ' (sin Mantenimiento)']), comoDe(x), v => { x.alt = v; draw(); })));
      let si = 0;
      (efectivo(dd, x, D).esp || []).forEach(g => {
        if (!g.libre && g.de && g.de.length === 1) return;
        const ops = opciones(g, x, dd, d, D), n = g.libre ? g.v : 1;
        for (let k = 0; k < n; k++) {
          const idx = si++;
          ctl.push(field(g.libre ? 'Especialización (' + (k + 1) + ' de ' + n + ')' : 'Especialización (' + sgn(g.v) + ')', sel([['', '— elige —']].concat(ops), (x.sel || [])[idx] || '', v => { x.sel = x.sel || []; x.sel[idx] = v; drawRes(); })));
        }
      });
      variables(dd).forEach(([txt, k], j) => ctl.push(field(k + ' + (' + txt + ')', inp(j ? (x.vals || [])[j] || '' : x.val == null ? '' : x.val, v => { if (j) { x.vals = x.vals || []; x.vals[j] = v; } else x.val = v; drawRes(); }, { type: 'number', step: '1', inputmode: 'numeric' }))));
      if (dd.n === 'Restricción') ctl.push(field('Penalización', sel([['', '−1 Calidad General'], ['1', '+2 Mantenimiento']], x.alt ? '1' : '', v => { x.alt = !!v; drawRes(); })));
      if (dd.n === 'Vacío') ctl.push(field('A elegir', sel([['Mantenimiento', '+1 Mantenimiento'], ['Salubridad', '−1 Salubridad']], x.alt || 'Mantenimiento', v => { x.alt = v; drawRes(); })));
      if (dd.n === 'Estudio') ctl.push(field('Estética', sel([['1', '+1'], ['2', '+2'], ['3', '+3']], String(x.val || 1), v => { x.val = Number(v); drawRes(); })));
      if (dd.n === 'Sin Decorar') ctl.push(field('Pierde 1 punto', sel([['', '— la más alta —']].concat(D.actividades.concat(artesDe(D))), (x.sel || [])[0] || '', v => { x.sel = [v]; drawRes(); })));
      ctl.push(field('Nota', inp(x.nota || '', v => { x.nota = v; }, { placeholder: 'Detalle: de qué es, dónde…' })));
      lista.appendChild(h('div', { class: 'lab-vd' }, [
        h('div', { class: 'lab-vd-h' }, [h('b', { text: dd.n }), h('span', { class: 'vtag', text: tipoTxt(dd) }), h('span', { class: 'lab-ef', text: efectoTxt(dd) }),
          h('button', { type: 'button', class: 'lnk', onclick: () => { d.vd.splice(i, 1); draw(); } }, 'Quitar')]),
        h('div', { class: 'lab-vd-c' }, ctl)]));
    });
  }
  function drawRes() {
    res.innerHTML = '';
    const c = labCalc(d, D);
    res.appendChild(R.stats({ items: D.car.map(k => ({ l: k, v: fmt(c.car[k]) })) }));
    res.appendChild(h('p', { class: 'fh', text: 'Puntos: Virtudes ' + c.puntos.virtudes + ' − Defectos ' + c.puntos.defectos + ' = ' + c.puntos.neto + ' de ' + c.puntos.limite + ' (Tamaño + Perfeccionamiento). Tamaño ocupado ' + fmt(c.puntos.ocupado) + '.' }));
    res.appendChild(h('p', null, [h('b', { text: 'Especializaciones: ' }), document.createTextNode(Object.keys(c.esp).length ? espTxt(c.esp) : 'ninguna')]));
    if (Object.keys(c.todas).filter(k => c.todas[k] > 0).length > Object.keys(c.esp).filter(k => c.esp[k] > 0).length || (d.descartes || []).length) {
      res.appendChild(h('div', { class: 'lab-desc' }, [h('span', { class: 'fh', text: 'Las que cuentan, si sobran (pulsa para descartar o recuperar): ' })].concat(Object.keys(c.todas).filter(k => c.todas[k] > 0).map(k => {
        const fuera = (d.descartes || []).includes(k) || c.sobran.includes(k);
        return h('button', { type: 'button', class: 'hb-tog', 'aria-pressed': fuera ? 'false' : 'true', onclick: () => {
          const s = new Set(d.descartes || []);
          if (s.has(k)) s.delete(k); else s.add(k);
          d.descartes = [...s]; drawRes();
        } }, [h('span', { class: 'hb-tog-i', 'aria-hidden': 'true', text: fuera ? '+' : '✓' }), h('b', { text: k + ' ' + c.todas[k] })]);
      }))));
    }
    c.avisos.forEach(t => res.appendChild(h('p', { class: 'warn', text: t })));
  }
  // añadir: el desplegable con toda la lista del libro, por categoría
  const grupos = [];
  const VAL = { Mayor: 'mayores', Menor: 'menores', Gratuita: 'gratuitas', Gratuito: 'gratuitos' };
  const CAT = { Estructura: 'de estructura', Equipamiento: 'de equipamiento', Sobrenatural: 'sobrenaturales' };
  D.vd.forEach(v => {
    const k = (v.clase === 'Virtud' ? 'Virtudes ' : 'Defectos ') + VAL[v.valor] + ' ' + CAT[v.cat] + (PTS[v.valor] ? ' (' + PTS[v.valor] + (PTS[v.valor] === 1 ? ' punto)' : ' puntos)') : '');
    if (!grupos.some(g => g[0] === k)) grupos.push([k, []]);
    grupos.find(g => g[0] === k)[1].push(v);
  });
  const picker = h('select', { class: 'lab-pick', 'aria-label': 'Virtud o Defecto que añadir' }, [h('option', { value: '', text: '— Añadir una Virtud o un Defecto —' })].concat(grupos.map(([k, L]) =>
    h('optgroup', { label: k }, L.map(v => h('option', { value: v.n, text: v.n + (v.multi ? ' *' : '') + ' — ' + efectoTxt(v) }))))));
  picker.addEventListener('change', () => { const v = D.vd.find(x => x.n === picker.value); prev.textContent = v ? v.txt : ''; });
  const add = h('button', { type: 'button', class: 'btn ghost' }, 'Añadir');
  add.addEventListener('click', () => {
    const v = D.vd.find(x => x.n === picker.value);
    if (!v) { toast('Elige una Virtud o un Defecto.'); return; }
    if (!v.multi && d.vd.some(x => x.n === v.n)) { toast(v.n + ' ya está (solo se puede tener una vez).'); return; }
    d.vd.push({ n: v.n }); picker.value = ''; prev.textContent = ''; draw();
  });
  // ajustes que no salen de la lista (objetos mágicos, Lugar de Leyenda…)
  const ajuste = h('details', { class: 'lab-aj' }, [h('summary', { text: 'Ajustes que no salen de la lista (objetos mágicos, Lugar de Leyenda…)' }),
    h('div', { class: 'lab-aj-g' }, D.car.filter(k => k !== 'Tamaño' && k !== 'Perfeccionamiento').map(k => field(k, inp(d.ajuste[k] || '', v => { d.ajuste[k] = v; drawRes(); }, { type: 'number', step: '1', inputmode: 'numeric' })))),
    field('Especializaciones de más', inp(Object.keys(d.espAjuste || {}).map(k => k + ' ' + sgn(numv(d.espAjuste[k]))).join(', '), v => {
      d.espAjuste = {};
      v.split(',').forEach(t => { const m = /^\s*(.+?)\s*([+\-−]?\d+)\s*$/.exec(t); if (m) { const k = D.actividades.concat(artesDe(D)).find(e => e.toLowerCase() === m[1].toLowerCase()); if (k) d.espAjuste[k] = numv(m[2].replace('−', '-')); } });
      drawRes();
    }, { placeholder: 'Hechizos +1, Herbam +2' }), 'Por ejemplo, las de un objeto mágico del laboratorio.')]);
  const body = [
    field('Nombre del laboratorio', inp(d.n, v => { d.n = v; })),
    h('div', { class: 'fld-row tri' }, [
      field('Tamaño', inp(d.tam, v => { d.tam = v; drawRes(); }, { type: 'number', step: '1', inputmode: 'numeric' }), '0 es una sala estándar (unos 50 m²); cada punto da sitio a una Virtud más.'),
      field('Perfeccionamiento', inp(d.perf, v => { d.perf = v; draw(); }, { type: 'number', step: '1', inputmode: 'numeric' }), 'Sube una estación cada vez, con Teoría Mágica ≥ el nuevo valor + 3.')]),
    h('h3', { class: 'lab-sub', text: 'Virtudes y defectos del laboratorio' }), lista,
    h('div', { class: 'lab-add' }, [picker, add]), prev, ajuste,
    field('Rasgos de personalidad', inp(d.rasgos, v => { d.rasgos = v; }, { placeholder: 'Con Informidad, uno o más: Extravagante +1…' })),
    field('Distintivos y foco', inp(d.foco, v => { d.foco = v; }, { placeholder: 'Un gran caldero de cobre en el centro…' })),
    field('Descripción', h('textarea', { rows: 4, oninput: ev => { d.desc = ev.target.value; } }, d.desc || '')),
    h('h3', { class: 'lab-sub', text: 'Cómo queda' }), res];
  const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const actions = [save, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')];
  if (ex) actions.push(confirmButton('Borrar', 'Pulsa otra vez para borrar el laboratorio', async () => {
    if (await dbWrite(() => S.db.doc('laboratorios/' + labId).delete(), 'Laboratorio borrado')) { const o = Object.assign({}, S.lab); delete o[labId]; S.lab = o; sagaChanged(); close(); }
  }));
  const close = openModal(ex ? 'Laboratorio' : 'Crear un laboratorio', body, actions);
  draw();
  save.addEventListener('click', async () => {
    const n = String(d.n || '').trim();
    if (!n) { toast('Ponle un nombre al laboratorio.'); return; }
    const c = labCalc(d, D);
    const doc = Object.assign({}, d, { n: n, tam: Math.round(numv(d.tam)), perf: Math.round(numv(d.perf)), dueno: ex && !base ? (ex.dueno || '') : pjId,
      calc: { car: c.car, esp: c.esp, puntos: c.puntos } });
    save.disabled = true;
    const ok = await guardar(ex && !base ? labId : null, doc, doc.dueno, ex ? 'Laboratorio guardado' : 'Laboratorio creado para ' + (pj.nombre || 'el magus'));
    save.disabled = false;
    if (ok) close();
  });
}

/* ---------- elegir: uno de la alianza (libre o de otro magus) o uno de ejemplo del libro */
function openLabChooser(pjId) {
  const D = labData();
  if (!D) { toast('Cargando las reglas del laboratorio… vuelve a pulsar en un momento.'); return; }
  const pj = S.pj[pjId] || {};
  const resumen = c => {
    const car = (c && c.car) || {}, esp = (c && c.esp) || {};
    return ['Tamaño ' + fmt(numv(car['Tamaño'])), 'Calidad ' + fmt(numv(car['Calidad General'])), 'Seguridad ' + fmt(numv(car['Seguridad']))].join(' · ') + (Object.keys(esp).length ? ' · ' + espTxt(esp) : '');
  };
  const body = [];
  const propios = Object.keys(S.lab).map(k => Object.assign({ _id: k }, S.lab[k])).sort((a, b) => (a.dueno ? 1 : 0) - (b.dueno ? 1 : 0) || String(a.n).localeCompare(String(b.n), 'es'));
  body.push(h('h3', { class: 'lab-sub', text: 'Laboratorios de la alianza' }));
  if (!propios.length) body.push(h('p', { class: 'note', text: 'Todavía no hay ninguno en la saga: crea uno o elige uno de ejemplo.' }));
  else body.push(h('ul', { class: 'lab-ch' }, propios.map(l => {
    const de = l.dueno ? (S.pj[l.dueno] ? S.pj[l.dueno].nombre : 'otro magus') : '';
    const suyo = l.dueno === pjId;
    const btn = suyo ? h('span', { class: 'fh', text: 'Ya es el suyo' })
      : l.dueno ? confirmButton('Elegir', 'Pulsa otra vez: deja de ser de ' + de, async () => { if (await asignar(l._id, pjId, 'Laboratorio de ' + (pj.nombre || 'el magus'))) close(); })
        : h('button', { type: 'button', class: 'btn ghost', onclick: async () => { if (await asignar(l._id, pjId, 'Laboratorio de ' + (pj.nombre || 'el magus'))) close(); } }, 'Elegir');
    return h('li', null, [h('div', null, [h('b', { text: l.n || 'Laboratorio' }), h('span', { class: 'vtag', text: l.dueno ? 'de ' + de : 'libre' }), h('div', { class: 'fh', text: resumen(l.calc) })]), btn]);
  })));
  body.push(h('h3', { class: 'lab-sub', text: 'Laboratorios de ejemplo (Alianzas)' }));
  body.push(h('p', { class: 'fh', text: 'Se copian a la saga como laboratorio de ' + (pj.nombre || 'este magus') + ', con sus Virtudes, Defectos y Características tal como las da el libro; luego se pueden cambiar.' }));
  const ejemplos = [{ n: 'Laboratorio estándar', txt: 'Un laboratorio Hermético estándar: una sala de unos cincuenta metros cuadrados, Tamaño 0 y Perfeccionamiento 0, sin Virtudes ni Defectos.', lab: { tam: 0, perf: 0, vd: [] }, car: {}, esp: {} }].concat(D.ejemplos);
  body.push(h('ul', { class: 'lab-ch' }, ejemplos.map(e => {
    const base = desdeEjemplo(e, D, pj);
    return h('li', null, [h('div', null, [h('b', { text: e.n }), h('div', { class: 'fh', text: resumen(base.calc) }), e.txt ? h('div', { class: 'lab-ej-t', text: e.txt.length > 260 ? e.txt.slice(0, 257).replace(/\s\S*$/, '') + '…' : e.txt }) : null]),
      h('button', { type: 'button', class: 'btn ghost', onclick: async () => { if (await guardar(null, Object.assign({}, base, { dueno: pjId }), pjId, 'Laboratorio de ' + (pj.nombre || 'el magus'))) close(); } }, 'Elegir')]);
  })));
  const close = openModal('Elegir un laboratorio', body, [h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cerrar')]);
}

/* un laboratorio de ejemplo como laboratorio de la saga: el cálculo, con los ajustes que hagan falta para que quede como en el libro
   (las Especializaciones que el libro descarta, fuera) */
function desdeEjemplo(e, D, pj) {
  const lab = JSON.parse(JSON.stringify(Object.assign({ vd: [], ajuste: {}, espAjuste: {}, descartes: [] }, e.lab || {})));
  lab.n = /^(La |El |Laboratorio)/.test(e.n) ? e.n : 'Laboratorio como el de ' + e.n;
  if (e.n !== 'Laboratorio estándar') lab.ejemplo = e.n;
  lab.rasgos = e.rasgos || '';
  lab.desc = e.txt || '';
  let c = labCalc(lab, D);
  // «Sin Decorar» quita 1 a la Especialización más alta: se fija ahora, para que los ajustes de abajo no la cambien de sitio
  lab.vd.forEach(x => { if (x.n === 'Sin Decorar' && !(x.sel || [])[0]) { const k = Object.keys(c.todas).filter(t => c.todas[t] >= 2).sort((a, b) => c.todas[b] - c.todas[a])[0]; if (k) x.sel = [k]; } });
  c = labCalc(lab, D);
  if (e.esp && Object.keys(e.esp).length) {
    lab.descartes = Object.keys(c.todas).filter(k => c.todas[k] > 0 && !(k in e.esp));
    c = labCalc(lab, D);
    Object.keys(e.esp).forEach(k => { const dif = e.esp[k] - (c.esp[k] || 0); if (dif) lab.espAjuste[k] = (lab.espAjuste[k] || 0) + dif; });
  }
  D.car.forEach(k => { if (k in (e.car || {}) && k !== 'Tamaño' && k !== 'Perfeccionamiento') { const dif = e.car[k] - c.car[k]; if (dif) lab.ajuste[k] = (numv(lab.ajuste[k]) || 0) + dif; } });
  c = labCalc(lab, D);
  lab.calc = { car: c.car, esp: c.esp, puntos: c.puntos };
  return lab;
}

export { desdeEjemplo, labCalc, labData, openLabChooser, openLabEditor, pjLab };
