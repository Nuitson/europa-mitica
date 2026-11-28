/* El editor de personajes. */
import { ARTS, ARTS_F, ARTS_T, artVar, fmt, h, load, norm, scrollHint, store } from '../base.js';
import { page } from '../views.js';
import { ABIL_CATS, ABIL_STD, CASAS, CAT_OF, CHARS, S, TIPOS, tkey } from '../saga/state.js';
import { allSeen, cell, confirmButton, datalist, dbWrite, field, inp, localPut, monogram, sagaCrumbs, sel, shrinkImage, stamp, statusNote, toast } from '../saga/core.js';
import { borrarPj } from '../saga/pjfile.js';
import { abCost, abLvl, afXp, artCost, artLvl, calc, canWrite, clone, curSeason, entriesOf, guessCat, isRitual, newId, numv, sgn } from '../saga/rules.js';
import { spellCap, abilityCap, accessOf, ageOf, catOf, CLASE, CLASE_TXT, casaVariantes, creationCheck, DRAFT_KEY, ensureGift, ensureHouse, FX_OBJ, G_HOW, G_RESTR, G_TXT, GENERO, grpOf, isMagic, objOptionsHtml, PRESETS, SLOT_TXT, vdEvolve, vdGen, valorOf, vdEffects, vdEffTxt, REINO_POW, vdReinoFijo, vdSobHab, vdEntry, vdFind, vdFx, vdGrantOf, vdGrantSync, vdIndex, vdLabel, vdNest, vdNormalize, vdNota, vdOptionsHtml, vdRef, vdSlots, vdTarget } from './rules.js';
import { hechCat, spellCat } from '../info.js';
import { openVdTab } from './vdtab.js';
import { openSpellTab } from './sptab.js';

/* ---------- editor */
let EDITOR = null; // {d, isNew} of the form on screen
function blankPj() {
  const car = {}; CHARS.forEach(n => { car[n] = 0; });
  const artes = {}; ARTS.forEach(a => { artes[a] = 0; });
  const [ca] = curSeason();
  const d = { nombre: '', sub: '', tipo: 'Magus', casa: '', jugador: '', nacimiento: ca - 25, activo: true, concepto: '', car: car, virtudes: [], defectos: [], hab: [], artes: artes,
    informidad: 0, confianza: 1, hechizos: [], notas: '', personalidad: [{ n: '', v: 0 }, { n: '', v: 0 }, { n: '', v: 0 }],
    creacion: { lengua: '', tierra: '', infancia: '', edadAprendizaje: 10, infAplicada: [], nativaAuto: false } };
  ensureGift(d);
  return d;
}
function loadDraft() {
  try { const o = JSON.parse(load(DRAFT_KEY) || 'null'); return o && typeof o === 'object' && !Array.isArray(o) && o.car ? o : null; } catch (e) { return null; }
}
function draftHasContent(d) {
  return !!(String(d.nombre || '').trim() || (d.hab || []).length || (d.defectos || []).some(x => String(x.n || '').trim()) || (d.virtudes || []).some(x => String(x.n || '').trim() && vdFx(x, 'virtud') !== 'don') || (d.hechizos || []).length || String(d.concepto || '').trim());
}
const cleanVd = l => (l || []).filter(x => x && String(x.n || '').trim()).map(x => { const o = Object.assign({}, x); delete o._otra; o.n = String(o.n).trim(); if (!String(o.obj || '').trim()) delete o.obj; if (!String(o.obj2 || '').trim()) delete o.obj2; if (!(o.sinOtorgar || []).length) delete o.sinOtorgar; if (!o.por) { delete o.por; delete o.og; } return o; });
function viewEditor(id, override) {
  const orig = id ? S.pj[id] : null;
  page.innerHTML = '';
  page.appendChild(sagaCrumbs(orig ? [['Personajes', '#personajes'], [orig.nombre, '#pj--' + id], ['Editar', null]] : [['Personajes', '#personajes'], ['Nuevo personaje', null]]));
  if (id && !orig) { page.appendChild(h('h1', { class: 'doc-title', text: S.status === 'ready' || allSeen() ? 'Personaje no encontrado' : 'Cargando…' })); const n = statusNote(); if (n) page.appendChild(n); return; }
  if (!canWrite()) { page.appendChild(h('h1', { class: 'doc-title', text: orig ? orig.nombre : 'Nuevo personaje' })); page.appendChild(statusNote() || h('p', { class: 'note', text: 'No tienes permiso para guardar cambios.' })); return; }
  let restored = false;
  let d = override ? clone(override) : null;
  if (!d && !orig) { d = loadDraft(); restored = !!(d && draftHasContent(d)); if (!restored) d = null; }
  if (!d) d = orig ? clone(orig) : blankPj();
  ['virtudes', 'defectos', 'hab', 'hechizos', 'personalidad'].forEach(k => { d[k] = Array.isArray(d[k]) ? d[k].filter(x => x && typeof x === 'object') : []; });
  d.virtudes = d.virtudes.map(vdNormalize);
  // El Don is always free, and its row is locked for magi: one saved without a value gets it here
  d.virtudes.forEach(x => { if (!x.valor && vdFx(x, 'virtud') === 'don') x.valor = 'Gratuita'; });
  // one row per ability (older forms allowed the same name twice): their px add up
  d.hab = d.hab.filter(x => x && typeof x === 'object').reduce((acc, x) => {
    const o = acc.find(y => String(x.n || '').trim() && tkey(y.n) === tkey(x.n));
    if (o) { o.base = numv(o.base) + numv(x.base); if (!o.esp && x.esp) o.esp = x.esp; } else acc.push(x);
    return acc;
  }, []);
  d.car = d.car || {}; d.artes = d.artes || {};
  d.creacion = Object.assign({ lengua: '', tierra: '', infancia: '', edadAprendizaje: 10, infAplicada: [], nativaAuto: false }, d.creacion || {});
  if (!Array.isArray(d.creacion.infAplicada)) d.creacion.infAplicada = [];
  const entries = id ? entriesOf(id) : [];
  const showRules = !orig || !entries.length;
  const now = calc(d, entries);
  now.hab.filter(x => x.implicit).forEach(x => d.hab.push({ n: x.n, cat: x.cat, esp: '', base: 0 }));
  // what the seasons added on top of the starting px (fixed while the form is open)
  const artExtra = {};
  ARTS.forEach(a => { artExtra[a] = now.arts[a] - afXp(numv(d.artes[a]), now.fx.af.art.has(a)); });
  EDITOR = { d: d, isNew: !orig };
  const [ca] = curSeason();
  page.appendChild(h('h1', { class: 'doc-title', text: orig ? 'Editar ' + orig.nombre : 'Nuevo personaje' }));
  page.appendChild(h('p', { class: 'doc-blurb', text: entries.length ? 'Los PX de este formulario son los iniciales, anteriores a las ' + entries.length + ' estaciones registradas; lo que se gane después se reparte en Estaciones. La columna «Actual» ya incluye esas estaciones.'
    : 'Rellena la ficha con las reglas de creación de Ars Magica: la página va comprobando los puntos mientras escribes. Lo que se gane después se reparte en cada estación.' }));
  if (restored) page.appendChild(h('p', { class: 'note draft-note' }, ['Se ha recuperado el personaje que dejaste a medias. ',
    h('button', { type: 'button', class: 'lnk', onclick: () => { store(DRAFT_KEY, null); viewEditor(null, blankPj()); } }, 'Empezar de cero')]));
  const f = h('form', { class: 'pj-form fx', id: 'pj-form', novalidate: true });
  f.addEventListener('submit', ev => ev.preventDefault());
  const meta = {};
  const sec = (t, kids, key) => { const m = key ? h('span', { class: 'sec-meta', id: 'sm-' + key }) : null; if (m) meta[key] = m; return h('section', { class: 'fs', id: key ? 'fs-' + key : null }, [h('h3', null, [document.createTextNode(t), m])].concat(kids)); };
  // datos
  const casaDl = datalist('dl-casas', CASAS);
  let artSec = null, eaField = null;
  const ageNote = h('span', { class: 'fh' });
  const drawAge = () => { const a = ageOf(d); ageNote.textContent = a != null ? a + ' años en ' + ca : ''; };
  drawAge();
  // the House's variant (branch, lineage, school or tradition): it decides the free virtue
  const linSel = h('select', { id: 'pj-linaje' });
  const linFld = field('Variante de la casa', linSel, 'Rama, linaje, escuela o tradición: cada una da su virtud gratuita.', 'w2');
  const drawLin = () => {
    const vars = casaVariantes(d);
    linFld.hidden = vars.length < 2;
    linSel.innerHTML = '';
    linSel.appendChild(h('option', { value: '' }, '— Elige la variante —'));
    vars.forEach(v => linSel.appendChild(h('option', { value: v.k }, (v.n ? v.n + ': ' : '') + v.txt)));
    linSel.value = vars.some(v => v.k === d.linaje) ? d.linaje : '';
    linSel.classList.toggle('need', !linSel.value);
  };
  linSel.addEventListener('change', () => { d.linaje = linSel.value; ensureHouse(d); drawLin(); drawVd(); drawHab(); });
  drawLin();
  f.appendChild(sec('Datos', [h('div', { class: 'fgrid' }, [
    field('Nombre', inp(d.nombre, v => { d.nombre = v; }, { required: true, placeholder: 'Nombre ex Casa', id: 'pj-nombre', autocomplete: 'off' }), null, 'w2'),
    field('Epíteto o apodo', inp(d.sub, v => { d.sub = v; }, { placeholder: 'fili de…' })),
    field('Tipo', sel(TIPOS, d.tipo, v => { d.tipo = v; ensureGift(d); drawLin(); drawVd(); drawHab(); if (artSec) artSec.hidden = !showArts(); if (eaField) eaField.hidden = !isMagic(CLASE[d.tipo]); }, { id: 'pj-tipo' })),
    // the gender of the names of the virtues and flaws on the sheet: «Compasivo», «Compasiva», «Compasive»
    field('Género', sel(GENERO, d.genero || 'm', v => { d.genero = v; drawVd(); }, { id: 'pj-genero' }), 'Para los nombres de virtudes y defectos; el neutro, en -e.'),
    field('Casa', inp(d.casa, v => { d.casa = v; const ch = ensureHouse(d); drawLin(); if (ch) { drawVd(); drawHab(); } }, { list: casaDl, autocomplete: 'off' }), 'Un mago recibe gratis la virtud de su casa.'),
    linFld,
    field('Jugador', inp(d.jugador, v => { d.jugador = v; })),
    h('label', { class: 'fld' }, [h('span', { class: 'fl', text: 'Año de nacimiento' }), inp(d.nacimiento, v => { d.nacimiento = parseInt(v, 10) || ''; drawAge(); drawHab(); }, { type: 'number', inputmode: 'numeric', id: 'pj-nac' }), ageNote]),
    field('En juego', h('span', { class: 'chk' }, [h('input', { type: 'checkbox', checked: d.activo !== false ? true : null, onchange: ev => { d.activo = ev.target.checked; } }), h('span', { text: 'Activo en la saga' })])),
    field('Concepto', h('textarea', { rows: 2, oninput: ev => { d.concepto = ev.target.value; } }, d.concepto || ''), null, 'w3')])]));
  // creation rules
  const panel = h('div', { class: 'cc-panel', id: 'cc-panel' });
  if (showRules) {
    const cr = d.creacion;
    const presets = PRESETS();
    const lenIn = inp(cr.lengua, () => {}, { placeholder: 'Aragonés, occitano, vasco…', id: 'cr-lengua' });
    lenIn.addEventListener('change', () => { renameSlot(d, 'lengua', cr.lengua, lenIn.value.trim()); cr.lengua = lenIn.value.trim(); drawHab(); });
    const tieIn = inp(cr.tierra, () => {}, { placeholder: 'Sobrarbe, Ribagorza, Jaca…', id: 'cr-tierra' });
    tieIn.addEventListener('change', () => { renameSlot(d, 'tierra', cr.tierra, tieIn.value.trim()); cr.tierra = tieIn.value.trim(); drawHab(); });
    const preSel = sel([['', '— Ninguno —']].concat(presets.map(p => [p.n, p.n + ' · ' + p.resumen])), cr.infancia, v => { applyPreset(d, v); drawHab(); }, { id: 'cr-infancia' });
    eaField = field('Edad al empezar el aprendizaje', inp(cr.edadAprendizaje, v => { cr.edadAprendizaje = parseInt(v, 10) || 10; }, { type: 'number', min: '5', max: '30', inputmode: 'numeric', id: 'cr-ea' }), 'Magos y aprendices; el aprendizaje dura 15 años.');
    eaField.hidden = !isMagic(CLASE[d.tipo]);
    f.appendChild(sec('Creación', [
      h('div', { class: 'fgrid' }, [field('Lengua materna', lenIn, 'Se empieza con ella a 5; sus 75 px van aparte.'), field('Tierra natal', tieIn, 'Su conocimiento de área.'),
        field('Paquete de infancia', preSel, 'Los de tu Excel de creación: reparten la infancia (y la lengua materna).', 'w2'), eaField]),
      panel], 'cr'));
  }
  // portrait
  const prev = h('div', { class: 'ret-prev' });
  const drawPrev = () => { prev.innerHTML = ''; prev.appendChild(monogram(d, 'pj-portrait')); };
  drawPrev();
  const retKids = [prev];
  if (S.assets) {
    const fi = h('input', { type: 'file', accept: 'image/*', id: 'pj-retrato' });
    const rm = h('button', { type: 'button', class: 'lnk', hidden: !(d.retrato || d.retratoStatic), onclick: () => { delete d.retrato; delete d.retratoStatic; delete d._retUrl; rm.hidden = true; drawPrev(); refresh(); } }, 'Quitar retrato');
    fi.addEventListener('change', async () => {
      const file = fi.files && fi.files[0];
      if (!file) return;
      toast('Subiendo el retrato…');
      const small = await shrinkImage(file, 720);
      const up = () => small ? S.assets.upload(small, { type: 'image/jpeg' }) : S.assets.upload(file);
      try {
        let r;
        try { r = await up(); } catch (e) { if (e && e.code === 'store_unavailable') r = await up(); else throw e; }
        d.retrato = { id: r.id }; d._retUrl = r.url; delete d.retratoStatic; rm.hidden = false; drawPrev(); refresh();
        toast('Retrato subido. Guarda la ficha para conservarlo.');
      } catch (e) { toast(e && (e.code === 'unsupported_type' || e.code === 'invalid_request') ? 'Ese formato de imagen no se admite; prueba con JPG o PNG.' : 'No se ha podido subir la imagen.'); }
      fi.value = '';
    });
    retKids.push(h('div', { class: 'ret-ctl' }, [field('Subir retrato', fi, 'JPG o PNG; se reduce y se guarda con la página.'), rm]));
  } else retKids.push(h('p', { class: 'fh', text: 'Solo quien puede editar la página sube retratos.' }));
  f.appendChild(sec('Retrato', [h('div', { class: 'ret-row' }, retKids)]));
  // characteristics (the value shown is the final one; Característica Notable/Mediocre move it by one and are not paid)
  const carIns = {}, carHints = {};
  const drawCarHints = () => {
    const adj = vdEffects(d).car;
    CHARS.forEach(n => { const a = adj[n] || 0; carHints[n].textContent = a ? (a > 0 ? 'Notable' : 'Mediocre') + ' ' + sgn(a) + ' · cuesta como ' + sgn(numv(d.car[n]) - a) : ''; });
  };
  f.appendChild(sec('Características', [
    showRules ? h('p', { class: 'fh', text: '7 puntos: +1 cuesta 1, +2 cuesta 3 y +3 cuesta 6; −1 da 1 punto, −2 da 3 y −3 da 6. Característica Notable y Mediocre suben o bajan un punto más sin coste.' }) : null,
    h('div', { class: 'fgrid chars-in' }, CHARS.map(n => {
      carIns[n] = inp(d.car[n] != null ? d.car[n] : 0, v => { d.car[n] = parseInt(v, 10) || 0; drawCarHints(); }, { type: 'number', min: '-6', max: '6', inputmode: 'numeric', 'data-car': n });
      carHints[n] = h('span', { class: 'fh car-adj' });
      return h('label', { class: 'fld' }, [h('span', { class: 'fl', text: n }), carIns[n], carHints[n]]);
    }))], 'car'));
  drawCarHints();
  // personality
  const persBox = h('div', { class: 'rowlist' });
  const drawPers = focusLast => {
    persBox.innerHTML = '';
    d.personalidad.forEach((t, i) => {
      const nameIn = inp(t.n, v => { t.n = v; }, { 'aria-label': 'Rasgo', placeholder: i === 0 ? 'Valiente, leal, curiosa…' : 'Rasgo' });
      persBox.appendChild(h('div', { class: 'lrow pers' }, [cell('Rasgo', nameIn),
        cell('Valor', sel([3, 2, 1, 0, -1, -2, -3].map(v => [v, sgn(v)]), t.v || 0, v => { t.v = Number(v); }, { 'aria-label': 'Valor del rasgo' })),
        h('button', { type: 'button', class: 'x', 'aria-label': 'Quitar rasgo', onclick: () => { d.personalidad.splice(i, 1); drawPers(); refresh(); } }, '×')]));
      if (focusLast && i === d.personalidad.length - 1) setTimeout(() => nameIn.focus(), 0);
    });
    if (d.personalidad.length < 6) persBox.appendChild(h('button', { type: 'button', class: 'lnk', onclick: () => { d.personalidad.push({ n: '', v: 0 }); drawPers(true); } }, '+ Añadir rasgo'));
  };
  drawPers();
  f.appendChild(sec('Personalidad', [h('p', { class: 'fh', text: 'Tres rasgos que lo definan, de −3 a +3.' }), persBox]));
  // virtues & flaws: drop-downs from the compendium that fill the row and apply what the page knows of them
  const vdBox = h('div', { class: 'vd-cols' });
  /* keep the characteristics in step with Característica Notable/Mediocre */
  function vdCarSync(before) {
    const after = vdEffects(d).car;
    CHARS.forEach(n => { const dl = (after[n] || 0) - (before[n] || 0); if (dl) { d.car[n] = numv(d.car[n]) + dl; carIns[n].value = String(d.car[n]); } });
    drawCarHints();
  }
  function vdMutate(fn) { const before = vdEffects(d).car; fn(); vdCarSync(before); }
  function afterVd(focus) { drawVd(focus); drawHab(); drawArts(); }
  function vdRow(k, clase, x, i, focus) {
    const idx = vdIndex();
    const fxk = vdFx(x, clase), kind = FX_OBJ[fxk];
    // the other brackets the player fills in: «(Reino) estigmático», «Vulnerable a (Forma)»…
    const slots = kind ? [] : vdSlots(x, clase);
    const locked = clase === 'virtud' && fxk === 'don' && isMagic(CLASE[d.tipo]);
    const named = !!String(x.n || '').trim();
    const e = named ? vdEntry(x, clase) : null;
    const canon = e ? (idx.canon.get(e.dk) || e) : null;
    const manual = !canon && (named || !!x._otra);
    const auto = canon ? vdNota(canon) : '';
    const tipo = canon ? canon.cat : (x.cat || '');
    // given by another virtue or flaw at no cost: its name is fixed, or one of a few
    const gr = vdGrantOf(d, x);
    const fixedName = !!gr && gr.opts.length === 1;
    const pts = h('span', { class: 'vd-pts', title: 'Puntos' });
    const drawPts = () => { const v = valorOf(x, clase); pts.textContent = v === 'Mayor' ? '3' : v === 'Menor' ? '1' : v ? '0' : '·'; };
    drawPts();
    // type: narrows the list of names
    const tipoSel = h('select', { 'aria-label': 'Tipo', disabled: locked || (gr && gr.opts.length) ? true : null }, [h('option', { value: '' }, 'Todos los tipos')].concat(idx.cats[clase].map(c => h('option', { value: c }, c))));
    if (tipo && !idx.cats[clase].includes(tipo)) tipoSel.appendChild(h('option', { value: tipo }, tipo));
    tipoSel.value = tipo;
    tipoSel.addEventListener('change', () => {
      const t = tipoSel.value;
      if (canon && !t) { nameSel.innerHTML = vdOptionsHtml(clase, ''); nameSel.value = String(canon.i); return; } // just widen the list
      if (canon && canon.cat !== t) vdMutate(() => { x.n = ''; delete x.en; delete x.obj; delete x._otra; x.valor = ''; if (x.nota === auto) x.nota = ''; x.cat = t; });
      else x.cat = t;
      afterVd({ k: k, i: i, el: 'name' });
    });
    // name: the compendium's entries, or one typed by hand
    const nameSel = h('select', { 'aria-label': 'Nombre', disabled: locked || fixedName ? true : null });
    if (gr && gr.opts.length > 1) {
      // one of the few the grant allows
      nameSel.appendChild(h('option', { value: '' }, '— Elige ' + (clase === 'virtud' ? 'la virtud' : 'el defecto') + ' —'));
      gr.opts.forEach(o => nameSel.appendChild(h('option', { value: String(o.i) }, vdGen(o.n, d.genero))));
      const cur = e && gr.opts.find(o => o.dk === e.dk || tkey(o.en || o.n) === tkey(e.en || e.n));
      nameSel.value = cur ? String(cur.i) : '';
      nameSel.classList.toggle('need', !cur);
    } else {
      nameSel.innerHTML = vdOptionsHtml(clase, tipo);
      nameSel.value = canon ? String(canon.i) : manual ? '__otra' : '';
      if (canon && nameSel.value !== String(canon.i)) { nameSel.innerHTML = vdOptionsHtml(clase, ''); nameSel.value = String(canon.i); }
    }
    nameSel.addEventListener('change', () => {
      const v = nameSel.value;
      let need = false;
      vdMutate(() => {
        delete x._otra;
        if (v === '__otra') { x.n = ''; delete x.en; delete x.obj; delete x.obj2; x._otra = true; x.valor = x.valor || 'Menor'; if (x.nota === auto) x.nota = ''; }
        else if (!v) { x.n = ''; delete x.en; delete x.obj; delete x.obj2; x.valor = ''; if (x.nota === auto) x.nota = ''; }
        else {
          const ne = idx.list[Number(v)];
          Object.assign(x, { n: ne.n, en: ne.en, cat: ne.cat, valor: x.og != null ? 'Gratuita' : ne.valor });
          if (!x.nota || x.nota === auto) x.nota = vdNota(ne);
          const nk = FX_OBJ[vdFx(x, clase)];
          const ns = nk ? [] : vdSlots(x, clase);
          // another kind of choice (an Ability instead of a realm…): the old one no longer applies
          if (nk !== kind || ns.map(s => s.k).join() !== slots.map(s => s.k).join()) { delete x.obj; delete x.obj2; }
          need = (!!nk || ns.length > 0) && !x.obj;
        }
      });
      afterVd({ k: k, i: i, el: v === '__otra' ? 'other' : need ? 'obj' : 'name' });
    });
    let before = null;
    const other = inp(manual ? x.n : '', v => { x.n = v; delete x.en; drawPts(); }, { 'aria-label': 'Nombre escrito a mano', placeholder: 'Escribe el nombre', class: 'vd-other', autocomplete: 'off' });
    other.hidden = !manual;
    other.addEventListener('focus', () => { before = vdEffects(d).car; });
    other.addEventListener('change', () => {
      // a name typed by hand that is in the compendium becomes that entry
      const e2 = vdEntry(x, clase);
      if (e2) { x.en = e2.en; x.cat = e2.cat; if (!x.valor) x.valor = e2.valor; delete x._otra; }
      if (before) vdCarSync(before);
      before = null;
      if (e2 || vdFx(x, clase)) afterVd({ k: k, i: i, el: 'name' }); else { drawHab(); drawArts(); }
    });
    // what it applies to (Maña, Afinidad, Característica Notable/Mediocre)
    let objCell;
    if (kind) {
      const objSel = h('select', { 'aria-label': 'Se aplica a', class: vdTarget(x, fxk) ? null : 'need' });
      objSel.innerHTML = objOptionsHtml(kind, d);
      const cur = vdTarget(x, fxk);
      if (cur && ![...objSel.options].some(o => o.value === cur)) objSel.appendChild(h('option', { value: cur }, cur));
      objSel.value = cur || '';
      objSel.addEventListener('change', () => {
        vdMutate(() => { x.obj = objSel.value; });
        objSel.classList.toggle('need', !objSel.value);
        if (kind === 'hab' && x.obj && !d.hab.some(y => tkey(y.n) === tkey(x.obj))) d.hab.push({ n: x.obj, cat: guessCat(x.obj), esp: '', base: 0 });
        drawHab(); drawArts(); refresh();
      });
      objCell = h('label', { class: 'cell vd-o', 'data-l': 'Se aplica a' }, objSel);
      if (focus && focus.el === 'obj') setTimeout(() => objSel.focus(), 0);
    } else if (slots.length) {
      // a list for the realm, the Form, the Technique…; a word to type for the beings, the land, the guild…
      const ctl = slots.map((s, j) => {
        const key = j ? 'obj2' : 'obj', cur = String(x[key] || '').trim();
        const lbl = 'Elige ' + (SLOT_TXT[s.k] || s.w.toLowerCase());
        if (s.k === 'txt') {
          const ti = inp(cur, v => { x[key] = v.trim(); ti.classList.toggle('need', !v.trim()); }, { 'aria-label': lbl, title: lbl, placeholder: s.w, autocomplete: 'off', class: cur ? null : 'need' });
          ti.addEventListener('change', () => refresh());
          return ti;
        }
        const sl = h('select', { 'aria-label': lbl, title: lbl, class: cur ? null : 'need' });
        sl.innerHTML = objOptionsHtml(s.k, d);
        if (cur && ![...sl.options].some(o => o.value === cur)) sl.appendChild(h('option', { value: cur }, cur));
        sl.value = cur;
        sl.addEventListener('change', () => { x[key] = sl.value; sl.classList.toggle('need', !sl.value); refresh(); });
        return sl;
      });
      objCell = h('div', { class: 'cell vd-o' + (ctl.length > 1 ? ' two' : ''), 'data-l': 'Se aplica a' }, ctl);
      if (focus && focus.el === 'obj') setTimeout(() => ctl[0].focus(), 0);
    } else objCell = h('span', { class: 'cell vd-o none', 'aria-hidden': 'true' });
    // a virtue that grants a supernatural Ability: the realm it belongs to (the aura adds to or takes from its rolls)
    // (not when the virtue's own rule fixes it: Magia Sagrada is Divine)
    const sobHab = vdReinoFijo(x) ? '' : vdSobHab(x, clase);
    if (sobHab) {
      const rs = sel([['', '— Elige el reino —']].concat(REINO_POW), x.reino || '', v => { if (v) x.reino = v; else delete x.reino; rs.classList.toggle('need', !v); refresh(); },
        { 'aria-label': 'Reino de ' + sobHab, title: 'Reino de la habilidad sobrenatural ' + sobHab + ': el aura le suma o le resta según él', class: x.reino ? null : 'need' });
      if (objCell.classList.contains('none')) objCell = h('label', { class: 'cell vd-o', 'data-l': 'Reino' }, rs);
      else { objCell.classList.add('two'); objCell.appendChild(rs); }
    }
    // value: the compendium's, or another (a House's free virtue); the same name may exist as major and minor
    const valSel = sel([['', '—'], ['Mayor', 'Mayor (3)'], ['Menor', 'Menor (1)'], ['Gratuita', 'Gratuita'], ['Especial', 'Especial']], x.valor || '', v => {
      const alt = canon ? vdFind(canon.en || canon.n, clase, v) : null;
      const altC = alt && alt.valor === v ? (idx.canon.get(alt.dk) || alt) : null;
      if (altC && altC !== canon) {
        vdMutate(() => { Object.assign(x, { n: altC.n, en: altC.en, cat: altC.cat, valor: v }); if (!x.nota || x.nota === auto) x.nota = vdNota(altC); });
        afterVd({ k: k, i: i, el: 'valor' });
      } else {
        const was = x.valor;
        x.valor = v;
        // free or not changes whether «Otorgada por» shows
        if ((was === 'Gratuita') !== (v === 'Gratuita')) afterVd({ k: k, i: i, el: 'valor' }); else { drawPts(); refresh(); }
      }
    }, { 'aria-label': 'Valor', disabled: locked ? true : null });
    const notaIn = inp(x.nota, v => { x.nota = v; }, { 'aria-label': 'Nota', placeholder: 'Nota o página' });
    const eff = named ? vdEffTxt(x, clase, fxk) : '';
    // the name as the sheet will show it in the character's gender («Compasiva»), when it changes
    const shown = named && d.genero && d.genero !== 'm' ? vdLabel(x, d.genero) : '';
    const asTxt = shown && shown !== vdLabel(x) ? 'En la ficha: «' + shown + '». ' : '';
    // a status that grows into another: «Aprendiz» → «Magus Hermético» when the Gauntlet is passed
    const evo = vdEvolve(x, clase);
    const evoBtn = evo ? h('button', { type: 'button', class: 'lnk vd-evo', title: vdLabel(x, d.genero) + ' → ' + vdGen(evo.to.n, d.genero), onclick: () => {
      vdMutate(() => {
        Object.assign(x, { n: evo.to.n, en: evo.to.en, cat: evo.to.cat, valor: evo.to.valor });
        delete x._otra; delete x.obj; delete x.obj2;
        x.nota = evo.nota + (vdNota(evo.to) ? ' · ' + vdNota(evo.to) : '');
      });
      // an apprentice who becomes a magus is a Magus from now on
      if (evo.magus && d.tipo === 'Aprendiz') { const t = document.getElementById('pj-tipo'); if (t) { t.value = 'Magus'; t.dispatchEvent(new Event('change')); } }
      afterVd({ k: k, i: i, el: 'name' });
      toast(evo.nota + ': ahora es ' + vdGen(evo.to.n, d.genero) + '. Guarda la ficha para conservarlo.');
    } }, evo.label + ' → ' + vdGen(evo.to.n, d.genero)) : null;
    // what gives it: the grant of the compendium, or one marked by hand (a free virtue of a variant the saga made up)
    let porCtl = null;
    if (gr) porCtl = h('span', { class: 'vd-por', text: 'Otorgada por «' + vdLabel(gr.parent.x, d.genero) + '»' + (gr.g.opc ? ' (opcional)' : '') });
    else if (x.casaGratis) porCtl = h('span', { class: 'vd-por', text: 'Gratuita por la casa ' + String(d.casa || '').trim() });
    // (only for one that is free here but costs in the book: El Don or a free status need no one to give them)
    else if (named && (x.por || (x.valor === 'Gratuita' && fxk !== 'don' && !(canon && canon.valor === 'Gratuita')))) {
      const myRef = vdRef(x, clase);
      const others = [];
      [['virtudes', 'virtud'], ['defectos', 'defecto']].forEach(([k2, cl2]) => d[k2].forEach(y => {
        if (y === x || !y || !String(y.n || '').trim()) return;
        const r = vdRef(y, cl2);
        if (y.por === myRef || others.some(o => o[0] === r)) return; // not what it gives itself
        others.push([r, vdLabel(y, d.genero)]);
      }));
      if (x.por && !others.some(o => o[0] === x.por)) others.push([x.por, x.por.replace(/^[^:]*:/, '')]);
      porCtl = h('label', { class: 'vd-por' }, ['Otorgada por ', sel([['', '— ninguna —']].concat(others), x.por || '', v => {
        if (v) x.por = v; else delete x.por;
        delete x.og;
        afterVd({ k: k, i: d[k].indexOf(x), el: 'name' });
      }, { 'aria-label': 'Otorgada por' })]);
    }
    // what this one gives that the player took out
    const lost = (x.sinOtorgar || []).length ? h('button', { type: 'button', class: 'lnk vd-evo', onclick: () => { delete x.sinOtorgar; afterVd(); } }, 'Volver a añadir lo que otorga') : null;
    const full = canon ? (canon.resumen || canon.desc || '') : '';
    const desc = full.length > 220 ? full.slice(0, 218) + '…' : full;
    const row = h('div', { class: 'lrow vd' + (locked ? ' locked' : '') + (kind || slots.length || sobHab ? '' : ' noobj') }, [
      h('label', { class: 'cell vd-t', 'data-l': 'Tipo' }, tipoSel),
      h('div', { class: 'cell vd-n', 'data-l': clase === 'virtud' ? 'Virtud' : 'Defecto' }, [nameSel, other, evoBtn, lost, porCtl]),
      objCell,
      h('label', { class: 'cell vd-v', 'data-l': 'Valor' }, valSel),
      h('label', { class: 'cell vd-nota', 'data-l': 'Nota' }, notaIn),
      pts,
      locked ? h('span', { class: 'lock', title: 'Obligatorio para los magos', text: 'oblig.' }) : h('button', { type: 'button', class: 'x', 'aria-label': 'Quitar ' + (vdLabel(x) || 'fila'), onclick: () => { vdMutate(() => { dropGranted(x); d[k].splice(i, 1); }); afterVd(); } }, '×'),
      desc || eff || asTxt ? h('p', { class: 'vd-desc', title: full.length > 220 ? full : null }, [asTxt ? h('i', { text: asTxt }) : null, desc ? document.createTextNode(desc + (eff ? ' ' : '')) : null, eff ? h('b', { text: eff }) : null]) : null]);
    if (focus && focus.el !== 'obj') setTimeout(() => { const t = focus.el === 'other' ? other : focus.el === 'valor' ? valSel : nameSel; if (t && !t.disabled) t.focus(); }, 0);
    return row;
  }
  /* a granted one taken out by hand stays out (the one that grants it remembers it) */
  function dropGranted(y) {
    const gr = vdGrantOf(d, y);
    if (gr) gr.parent.x.sinOtorgar = [...new Set((gr.parent.x.sinOtorgar || []).concat([y.og]))];
  }
  function drawVd(focus) {
    // what the virtues and flaws grant comes with them, and goes with them
    const beforeCar = vdEffects(d).car;
    if (vdGrantSync(d)) vdCarSync(beforeCar);
    vdBox.innerHTML = '';
    const tree = vdNest(d, true);
    [['virtudes', 'Virtudes', 'virtud'], ['defectos', 'Defectos', 'defecto']].forEach(([k, t, clase]) => {
      const n = d[k].filter(x => String(x.n || '').trim()).length;
      const list = h('div', { class: 'rowlist' }, [h('h4', { text: t + (n ? ' · ' + n : '') })]);
      if (tree[clase].length) list.appendChild(h('div', { class: 'lrow vd head', 'aria-hidden': 'true' }, ['Tipo', clase === 'virtud' ? 'Virtud' : 'Defecto', 'Se aplica a', 'Valor', 'Nota', 'Pts.', ''].map(s => h('span', { text: s }))));
      // each one with what it grants under it, even a flaw under a virtue (it still counts as a flaw)
      tree[clase].forEach(it => {
        const k2 = it.clase === 'virtud' ? 'virtudes' : 'defectos', i2 = d[k2].indexOf(it.x);
        const row = vdRow(k2, it.clase, it.x, i2, focus && focus.k === k2 && focus.i === i2 ? focus : null);
        if (it.depth) {
          row.classList.add('sub');
          row.style.setProperty('--depth', String(Math.min(it.depth, 3)));
          const nc = row.querySelector('.vd-n');
          if (it.clase !== clase && nc) nc.insertBefore(h('span', { class: 'vd-kind', text: it.clase === 'virtud' ? 'Virtud' : 'Defecto' }), nc.firstChild);
        }
        list.appendChild(row);
      });
      list.appendChild(h('button', { type: 'button', class: 'lnk', onclick: () => { d[k].push({ n: '', cat: '', valor: '', nota: '' }); drawVd({ k: k, i: d[k].length - 1, el: 'name' }); } }, clase === 'virtud' ? '+ Añadir virtud' : '+ Añadir defecto'));
      vdBox.appendChild(list);
    });
    refresh();
  }
  // the compendium tab (vdtab.js): a box per entry adds it to the sheet or takes it out; the rows below keep the rest
  const vdKind = clase => clase === 'virtud' ? 'virtudes' : 'defectos';
  const sameVd = (x, e) => { const xe = String(x.n || '').trim() ? vdEntry(x, e.clase) : null; return !!xe && xe.dk === e.dk; };
  const vdTab = {
    pjId: id || null, // to tell this character apart from the saved ones that also have a virtue of the saga
    genero: () => d.genero,
    chosen: e => d[vdKind(e.clase)].some(x => sameVd(x, e)),
    locked: e => e.clase === 'virtud' && vdFx({ n: e.n, en: e.en, valor: e.valor }, 'virtud') === 'don' && isMagic(CLASE[d.tipo]),
    toggle(e, on) {
      const kind = vdKind(e.clase);
      if (on) {
        if (vdTab.chosen(e)) return;
        if (d[kind].some(x => tkey(x.n) === tkey(e.n))) { toast(e.n + ' ya está en la ficha con otro valor.'); return; }
        vdMutate(() => { d[kind].push({ n: e.n, en: e.en, cat: e.cat, valor: e.valor, nota: vdNota(e) }); });
      } else {
        if (vdTab.locked(e)) return;
        vdMutate(() => { d[kind].filter(x => sameVd(x, e)).forEach(dropGranted); d[kind] = d[kind].filter(x => !sameVd(x, e)); });
      }
      afterVd();
    },
    // the same rule as the check of the budget (creation/rules.js): flaws give points, virtues spend them
    balance() {
      const cls = CLASE[d.tipo] || 'otro';
      const pts = (k, clase) => d[k].filter(x => x && String(x.n || '').trim()).reduce((s, x) => { const v = valorOf(x, clase); return s + (v === 'Mayor' ? 3 : v === 'Menor' ? 1 : 0); }, 0);
      return { pv: pts('virtudes', 'virtud'), pd: pts('defectos', 'defecto'), cap: cls === 'grog' ? 3 : cls === 'otro' ? null : 10 };
    },
    summary() {
      const named = k => d[k].filter(x => String(x.n || '').trim());
      const pts = (k, clase) => named(k).reduce((s, x) => { const v = valorOf(x, clase); return s + (v === 'Mayor' ? 3 : v === 'Menor' ? 1 : 0); }, 0);
      const nv = named('virtudes').length, nd = named('defectos').length;
      return (nv === 1 ? '1 virtud' : nv + ' virtudes') + ' (' + pts('virtudes', 'virtud') + ' pts) · ' + (nd === 1 ? '1 defecto' : nd + ' defectos') + ' (' + pts('defectos', 'defecto') + ' pts)';
    }
  };
  const vdOpen = h('div', { class: 'actions vd-open' }, h('button', { type: 'button', class: 'btn', id: 'vd-open', onclick: () => openVdTab(vdTab) }, 'Elegir virtudes y defectos'));
  f.appendChild(sec('Virtudes y defectos', [h('p', { class: 'fh', text: (showRules ? 'Se empieza con 0 puntos: cada defecto mayor da 3 y cada menor 1; cada virtud mayor cuesta 3 y cada menor 1. Magos y compañeros, hasta 10 puntos de defectos; grogs, hasta 3. El Don es gratuito y obligatorio para los magos. ' : '') +
    '«Elegir virtudes y defectos» abre el compendio con buscador y filtros: marca la casilla de cada una para añadirla. Aquí abajo eliges a qué se aplican las Mañas, Afinidades y Características Notables, cambias el valor o escribes notas; el valor y la página se rellenan solos, y lo que da experiencia se aplica a la ficha.' }),
    vdOpen, vdBox], 'vd'));
  // abilities: every standard Ability plus this character's own, in balanced columns. Only the px are typed;
  // the level and the px missing for the next one follow (Affinity: the px count ×1.5; Puissant: +2 on the level)
  const habGrid = h('div', { class: 'hab-grid', id: 'hab-grid', lang: 'es' });
  const espBox = h('div', { class: 'hab-esp' });
  const abDl = datalist('dl-hab', Object.values(ABIL_STD).flat().concat(...Object.values(S.pj).map(p => (p.hab || []).map(x => x.n))));
  const rowOf = n => d.hab.find(x => tkey(x.n) === tkey(n));
  const seasonXp = n => { const live = now.hab.find(y => tkey(y.n) === tkey(n)); return live ? live.xp - live.base : 0; };
  /* the abilities on screen, by category: the standard list always, then the character's own (languages, lores, crafts…) */
  function habList() {
    const groups = new Map(ABIL_CATS.map(c => [c, []]));
    const seen = new Set();
    Object.keys(ABIL_STD).forEach(c => ABIL_STD[c].forEach(n => { seen.add(tkey(n)); groups.get(c).push({ n: n, std: true }); }));
    const own = [];
    d.hab.forEach(x => {
      const n = String(x.n || '').trim(), k = tkey(n);
      if (!n || seen.has(k)) return;
      seen.add(k);
      own.push({ n: n, std: false, cat: ABIL_CATS.includes(x.cat) ? x.cat : guessCat(n) });
    });
    own.sort((a, b) => a.n.localeCompare(b.n, 'es')).forEach(a => groups.get(a.cat).push(a));
    return groups;
  }
  function habCell(a, F, cap, cat) {
    const k = tkey(a.n), extra = seasonXp(a.n);
    const on = F.af.hab.has(k), b = F.mana.hab[k] || 0;
    const r0 = rowOf(a.n);
    const lv = h('output', { class: 'hg-lv', 'aria-label': 'Nivel de ' + a.n });
    const fa = h('output', { class: 'hg-fa', 'aria-label': 'PX que faltan para el siguiente nivel de ' + a.n });
    const px = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', class: 'hg-px', placeholder: '0', 'aria-label': 'PX de ' + a.n, value: r0 && numv(r0.base) ? String(numv(r0.base)) : '' });
    const row = h('div', { class: 'hg-row', 'data-k': k });
    const upd = () => {
      const r = rowOf(a.n), paid = r ? Math.max(0, numv(r.base)) : 0;
      const eff = afXp(paid, on) + extra, L = abLvl(eff), next = abCost(L + 1);
      // what is still to be typed in this box for the next level (with Affinity, in px before the ×1.5)
      const need = on ? Math.max(1, Math.ceil((next - extra - 0.5) / 1.5) - paid) : next - eff;
      lv.textContent = String(L + b);
      fa.textContent = fmt(need);
      lv.title = (b ? L + ' + ' + b + ' de Maña · ' : '') + fmt(eff) + ' px' + (on && paid ? ' (' + fmt(paid) + ' × 1,5' + (extra ? ' + ' + fmt(extra) + ' de estaciones' : '') + ')' : extra ? ' (' + fmt(paid) + ' iniciales + ' + fmt(extra) + ' de estaciones)' : '');
      fa.title = 'Faltan ' + fmt(need) + ' px para el nivel ' + (L + 1);
      const over = showRules && L > cap + (on ? 2 : 0);
      lv.classList.toggle('over', over);
      if (over) lv.title += ' · pasa del límite por edad (' + (cap + (on ? 2 : 0)) + ')';
      row.classList.toggle('zero', !eff && !b);
    };
    px.addEventListener('input', () => {
      const v = Math.max(0, numv(px.value));
      let r = rowOf(a.n);
      if (!r && v) { r = { n: a.n, cat: a.std ? (CAT_OF[k] || guessCat(a.n)) : cat, esp: '', base: 0 }; d.hab.push(r); }
      if (r) r.base = v;
      upd();
    });
    px.addEventListener('change', drawEsp);
    upd();
    const tags = [on ? h('small', { class: 'vtag', text: '×1,5', title: 'Afinidad: los px de ' + a.n + ' cuentan ×1,5' }) : null, b ? h('small', { class: 'vtag', text: '+' + b, title: 'Maña con ' + a.n + ': +' + b + ' al nivel' }) : null];
    const rm = !a.std && !extra ? h('button', { type: 'button', class: 'hg-x', title: 'Quitar', 'aria-label': 'Quitar ' + a.n, onclick: () => { d.hab = d.hab.filter(x => tkey(x.n) !== k); drawHab(); } }, '×') : null;
    row.appendChild(h('span', { class: 'hg-n' }, [h('span', { class: 'hg-nt', text: a.n })].concat(tags, [rm])));
    row.appendChild(lv); row.appendChild(fa); row.appendChild(px);
    return row;
  }
  function drawHab(focusKey) {
    const F = vdEffects(d), cap = abilityCap(ageOf(d)), ax = accessOf(d);
    const sup = (d.virtudes || []).some(x => x && String(x.n || '').trim() && norm(catOf(x, 'virtud')) === 'sobrenatural');
    habGrid.innerHTML = '';
    habList().forEach((list, cat) => {
      if (!list.length) return;
      const g = grpOf(cat);
      const warn = cat === 'Sobrenaturales' ? (!sup ? 'necesita su virtud' : '') : ax && !ax.custos && G_RESTR.includes(g) && !ax.acc.has(g) ? 'necesita virtud' : '';
      habGrid.appendChild(h('div', { class: 'hg-h' }, [h('span', { class: 'hg-t', text: cat }), h('i', { text: 'Nivel' }), h('i', { text: 'Faltan' }), h('i', { text: 'PX' }),
        warn ? h('small', { class: 'vtag warn hg-warn', text: warn, title: cat === 'Sobrenaturales' ? 'Cada habilidad sobrenatural necesita su virtud.' : 'Para ' + CLASE_TXT[ax.cls] + ', las habilidades ' + G_TXT[g] + ' necesitan una virtud: ' + G_HOW[g] + '.' }) : null]));
      list.forEach(a => habGrid.appendChild(habCell(a, F, cap, cat)));
    });
    drawEsp();
    if (focusKey) { const t = habGrid.querySelector('.hg-row[data-k="' + focusKey + '"] .hg-px'); if (t) setTimeout(() => t.focus(), 0); }
    refresh();
  }
  /* specialties, for the abilities that have px */
  function drawEsp() {
    espBox.innerHTML = '';
    const list = [];
    habList().forEach(l => l.forEach(a => { const r = rowOf(a.n); if ((r && (numv(r.base) > 0 || String(r.esp || '').trim())) || seasonXp(a.n) > 0) list.push(a); }));
    if (!list.length) return;
    espBox.appendChild(h('h4', { text: 'Especialidades' }));
    espBox.appendChild(h('div', { class: 'esp-grid' }, list.map(a => {
      const ip = inp((rowOf(a.n) || {}).esp, v => { let r = rowOf(a.n); if (!r) { r = { n: a.n, cat: CAT_OF[tkey(a.n)] || guessCat(a.n), esp: '', base: 0 }; d.hab.push(r); } r.esp = v; }, { placeholder: 'Especialidad', 'aria-label': 'Especialidad de ' + a.n });
      return h('label', { class: 'esp-row' }, [h('span', { text: a.n }), ip]);
    })));
  }
  // add an ability of one's own: a language, a homeland, a craft…
  const addName = h('input', { type: 'text', list: abDl, id: 'hab-new', placeholder: 'Idioma, tierra, oficio…', 'aria-label': 'Nueva habilidad', autocomplete: 'off' });
  const addCat = sel(ABIL_CATS, 'Idiomas vivos', () => {}, { id: 'hab-new-cat', 'aria-label': 'Categoría de la nueva habilidad' });
  addName.addEventListener('input', () => { const g = guessCat(addName.value); if (g !== 'Otras') addCat.value = g; });
  const doAdd = () => {
    const n = addName.value.trim();
    if (!n) { addName.focus(); return; }
    const k = tkey(n);
    if (!rowOf(n) && !CAT_OF[k]) d.hab.push({ n: n, cat: addCat.value, esp: '', base: 0 });
    addName.value = '';
    drawHab(k);
  };
  addName.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); doAdd(); } });
  const addRow = h('div', { class: 'hab-add' }, [addName, addCat, h('button', { type: 'button', class: 'btn ghost', id: 'hab-add', onclick: doAdd }, 'Añadir habilidad')]);
  f.appendChild(sec('Habilidades', [h('p', { class: 'fh', text: 'Escribe los PX de cada habilidad: el nivel y lo que falta para el siguiente salen solos (nivel L = 5·L·(L+1)/2 px: 1 = 5, 2 = 15, 3 = 30, 4 = 50, 5 = 75). Con Afinidad los PX cuentan ×1,5 y la Maña suma +2 al nivel.' + (entries.length ? ' Con estaciones registradas, el nivel incluye lo ganado en ellas.' : '') }),
    habGrid, addRow, espBox], 'hab'));
  // arts
  const showArts = () => isMagic(CLASE[d.tipo]) || ARTS.some(a => numv(d.artes[a]) > 0 || now.arts[a] > 0);
  const artBox = h('div', { class: 'arts-in' });
  function drawArts() {
    const F = vdEffects(d);
    artBox.innerHTML = '';
    [['Técnicas', ARTS_T], ['Formas', ARTS_F]].forEach(([t, list]) => {
      const g = h('div', { class: 'ag' }, [h('h4', { text: t }), h('div', { class: 'arow head', 'aria-hidden': 'true' }, [h('span'), h('span', { text: 'Nivel' }), h('span', { text: 'PX ini.' }), h('span', { text: 'Actual' })])]);
      list.forEach(a => {
        const on = F.af.art.has(a), b = F.mana.art[a] || 0;
        const act = h('span', { class: 'act-lv' + (b ? ' boost' : '') });
        const lv = h('input', { type: 'number', min: '0', max: '60', inputmode: 'numeric', value: String(artLvl(afXp(numv(d.artes[a]), on))), 'aria-label': 'Nivel inicial de ' + a });
        const px = h('input', { type: 'number', min: '0', inputmode: 'numeric', value: String(numv(d.artes[a])), 'aria-label': 'PX iniciales de ' + a });
        const updAct = () => { const eff = afXp(numv(d.artes[a]), on), L = artLvl(eff + artExtra[a]); act.textContent = String(L + b); act.title = fmt(eff + artExtra[a]) + ' px' + (artExtra[a] ? ' con las estaciones' : '') + (b ? ' · ' + L + ' + ' + b + ' de Maña' : ''); };
        lv.addEventListener('input', () => { const L = Math.max(0, parseInt(lv.value, 10) || 0); d.artes[a] = on ? Math.max(0, Math.ceil((artCost(L) - 0.5) / 1.5)) : artCost(L); px.value = String(d.artes[a]); updAct(); });
        px.addEventListener('input', () => { d.artes[a] = Math.max(0, numv(px.value)); lv.value = String(artLvl(afXp(d.artes[a], on))); updAct(); });
        updAct();
        const tg = [on ? h('small', { class: 'vtag', text: '×1,5', title: 'Afinidad: los px cuentan ×1,5' }) : null, b ? h('small', { class: 'vtag', text: '+' + b, title: 'Maña con ' + a }) : null];
        g.appendChild(h('div', { class: 'arow', style: '--a:' + artVar(a) }, [h('span', { class: 'an' }, [document.createTextNode(a)].concat(tg)), lv, px, act]));
      });
      artBox.appendChild(g);
    });
  }
  artSec = sec('Artes', [h('p', { class: 'fh', text: 'Nivel y PX iniciales: el nivel L de un Arte cuesta L·(L+1)/2 px (5 = 15, 10 = 55, 15 = 120). Con Afinidad los PX cuentan ×1,5 y la Maña suma +3 en «Actual».' }), artBox], 'art');
  artSec.hidden = !showArts();
  f.appendChild(artSec);
  // spells
  const spBox = h('div', { class: 'rowlist' });
  const dlAlc = datalist('dl-alc', ['Personal', 'Toque', 'Ojo', 'Voz', 'Vista', 'Conexión Arcana']);
  const dlDur = datalist('dl-dur', ['Momentáneo', 'Concentración', 'Diámetro', 'Sol', 'Anillo', 'Luna', 'Año']);
  const dlObj = datalist('dl-obj', ['Individuo', 'Círculo', 'Parte', 'Grupo', 'Habitación', 'Estructura', 'Límite']);
  const dlHech = hechCat().list.length ? datalist('dl-hech', hechCat().list.map(x => x.n)) : null;
  /* a name picked from the catalogue fills in what the row is missing */
  function fromCat(x, name) {
    const e = (hechCat().byKey.get(tkey(name)) || [])[0];
    if (!e) return false;
    x.cat = e.id;
    if (!x.tec) x.tec = e.tec;
    if (!x.forma) x.forma = e.forma;
    if ((x.nivel == null || x.nivel === '') && String(e.nivel) !== 'Gen') x.nivel = e.nivel;
    ['alc', 'dur', 'obj'].forEach(k => { if (!x[k]) x[k] = e[k] || ''; });
    if (e.rit && !isRitual(x)) x.ritual = true;
    return true;
  }
  function drawSp(focusLast) {
    spBox.innerHTML = '';
    if (d.hechizos.length) spBox.appendChild(h('div', { class: 'lrow sp head', 'aria-hidden': 'true' }, ['Hechizo', 'Técnica', 'Forma', 'Nivel', 'Maestría', 'Alcance', 'Duración', 'Objetivo', 'Notas', ''].map(t => h('span', { text: t }))));
    d.hechizos.forEach((x, i) => {
      const nameIn = inp(x.n, v => { x.n = v; if (x.cat && x.cat !== '-') delete x.cat; }, { 'aria-label': 'Hechizo', placeholder: dlHech ? 'Nombre (o elige del catálogo)' : 'Nombre del hechizo', list: dlHech });
      nameIn.addEventListener('change', () => { if (fromCat(x, nameIn.value)) drawSp(); });
      spBox.appendChild(h('div', { class: 'lrow sp' }, [
        cell('Hechizo', nameIn),
        cell('Técnica', sel([['', '—']].concat(ARTS_T), x.tec, v => { x.tec = v; }, { 'aria-label': 'Técnica' })),
        cell('Forma', sel([['', '—']].concat(ARTS_F), x.forma, v => { x.forma = v; }, { 'aria-label': 'Forma' })),
        cell('Nivel', inp(x.nivel, v => { x.nivel = v; }, { type: 'number', inputmode: 'numeric', 'aria-label': 'Nivel' })),
        cell('Maestría', inp(x.maestria || '', v => { x.maestria = v; }, { type: 'number', min: '0', max: '10', inputmode: 'numeric', 'aria-label': 'Maestría', placeholder: '0' })),
        cell('Alcance', inp(x.alc, v => { x.alc = v; }, { 'aria-label': 'Alcance', list: dlAlc })),
        cell('Duración', inp(x.dur, v => { x.dur = v; }, { 'aria-label': 'Duración', list: dlDur })),
        cell('Objetivo', inp(x.obj, v => { x.obj = v; }, { 'aria-label': 'Objetivo', list: dlObj })),
        cell('Notas', inp(x.nota, v => { x.nota = v; }, { 'aria-label': 'Notas' })),
        h('button', { type: 'button', class: 'x', 'aria-label': 'Quitar ' + (x.n || 'hechizo'), onclick: () => { d.hechizos.splice(i, 1); drawSp(); } }, '×')]));
      const catE = spellCat(x);
      const ta = h('textarea', { rows: '3', 'aria-label': 'Descripción de ' + (x.n || 'el hechizo'), placeholder: catE ? 'Se muestra la del manual; escribe aquí solo si en vuestra saga funciona distinto.' : 'Qué hace el hechizo: hace falta si es inventado o de un libro que no está en el catálogo.' });
      ta.value = x.desc || '';
      ta.addEventListener('input', () => { x.desc = ta.value; });
      spBox.appendChild(h('details', { class: 'sp-desc', open: String(x.desc || '').trim() ? true : null }, [
        h('summary', { text: String(x.desc || '').trim() ? 'Descripción propia' : catE ? 'Descripción: la del manual, «' + catE.n + '»' : 'Añadir una descripción' }), ta]));
      if (focusLast && i === d.hechizos.length - 1) setTimeout(() => nameIn.focus(), 0);
    });
    spBox.appendChild(h('button', { type: 'button', class: 'lnk', onclick: () => (hechCat().list.length ? openSpells() : aMano()) }, '+ Añadir hechizo'));
    refresh();
  }
  const aMano = () => { d.hechizos.push({ n: '', tec: '', forma: '', nivel: '', alc: '', dur: '', obj: '', nota: '' }); drawSp(true); };
  /* the window with the whole catalogue: what is ticked there goes onto the sheet at once */
  const isCatOf = (x, e) => x.cat === e.id || (!x.cat && spellCat(x) === e);
  function openSpells() {
    const { teo, cap } = spellCap(d, entries);
    const budget = showRules && isMagic(CLASE[d.tipo]) ? creationCheck(d).spBudget : null;
    openSpellTab({
      list: hechCat().list, teo: teo, cap: cap, budget: budget, aMano: aMano,
      chosen: e => d.hechizos.some(x => isCatOf(x, e)),
      spent: () => d.hechizos.filter(x => String(x.n || '').trim()).reduce((s, x) => s + Math.max(0, numv(x.nivel)), 0),
      toggle: (e, on) => {
        if (on) {
          const x = { n: e.n, tec: e.tec, forma: e.forma, nivel: String(e.nivel) === 'Gen' ? '' : e.nivel, alc: e.alc || '', dur: e.dur || '', obj: e.obj || '', nota: '', cat: e.id };
          if (e.rit) x.ritual = true;
          d.hechizos.push(x);
        } else {
          const i = d.hechizos.findIndex(x => isCatOf(x, e));
          if (i >= 0) d.hechizos.splice(i, 1);
        }
        drawSp();
      }
    });
  }
  f.appendChild(sec('Hechizos', [showRules ? h('p', { class: 'fh', text: 'Magos: 120 niveles al acabar el aprendizaje, y ninguno por encima de Técnica + Forma + Inteligencia + Teoría Mágica + 3. La maestría se paga como una habilidad (1 = 5 px, 2 = 15, 3 = 30); Hechizos dominados da 50 px para ella.' }) : null, spBox], 'hz'));
  // the rest
  f.appendChild(sec('Otros', [h('div', { class: 'fgrid' }, [
    field('Informidad (puntos iniciales)', inp(d.informidad || 0, v => { d.informidad = numv(v); }, { type: 'number', min: '0', inputmode: 'numeric' })),
    field('Confianza', inp(d.confianza != null ? d.confianza : 1, v => { d.confianza = numv(v); }, { type: 'number', min: '0', inputmode: 'numeric' }), 'Normalmente 1, con 3 puntos.'),
    field('Notas: historia, familia, equipo…', h('textarea', { rows: 6, oninput: ev => { d.notas = ev.target.value; } }, d.notas || ''), null, 'w3')])]));
  // save bar with the live budget
  const chips = scrollHint(h('div', { class: 'cc-chips', 'aria-live': 'polite' }));
  const save = h('button', { type: 'button', class: 'btn', id: 'pj-save' }, orig ? 'Guardar cambios' : 'Crear personaje');
  const bar = h('div', { class: 'form-bar' }, [showRules ? chips : null, save, h('a', { class: 'btn ghost', href: orig ? '#pj--' + id : '#personajes', text: 'Cancelar' })]);
  if (orig) bar.appendChild(confirmButton('Borrar personaje', entries.length ? 'Pulsa otra vez: se borra con sus ' + entries.length + ' estaciones' : 'Pulsa otra vez para borrar', async () => {
    if (await borrarPj(id)) location.hash = '#personajes';
  }));
  f.appendChild(bar);
  // live check
  let rt = null;
  function refresh() { clearTimeout(rt); rt = setTimeout(doRefresh, 90); }
  function doRefresh() {
    if (!f.isConnected) return;
    if (!orig) { try { const o = clone(d); delete o._retUrl; store(DRAFT_KEY, JSON.stringify(o)); } catch (e) { /* storage unavailable */ } }
    if (!showRules) return;
    const r = creationCheck(d);
    drawPanel(panel, r);
    chips.innerHTML = '';
    r.lines.forEach(l => chips.appendChild(h('button', { type: 'button', class: 'cc-chip st-' + l.st, title: l.l + ': ' + l.txt, onclick: () => { const t = document.getElementById('fs-cr'); if (t) t.scrollIntoView({ block: 'start' }); } }, [h('b', { text: l.s }), ' ' + l.short])));
    if (r.errors.length || r.avisos.length) chips.appendChild(h('span', { class: 'cc-chip st-' + (r.errors.length ? 'over' : 'warn'), text: (r.errors.length ? r.errors.length + (r.errors.length === 1 ? ' error' : ' errores') : '') + (r.errors.length && r.avisos.length ? ' · ' : '') + (r.avisos.length ? r.avisos.length + (r.avisos.length === 1 ? ' aviso' : ' avisos') : '') }));
    const byK = {}; r.lines.forEach(l => { byK[l.k] = l; });
    const setMeta = (k, l) => { if (meta[k]) { meta[k].textContent = l ? l.txt : ''; meta[k].className = 'sec-meta' + (l ? ' st-' + l.st : ''); } };
    setMeta('car', byK.car); setMeta('vd', byK.vd); setMeta('hab', byK.px); setMeta('art', byK.px); setMeta('hz', byK.hz);
  }
  f.addEventListener('input', refresh);
  f.addEventListener('change', refresh);
  // the virtues and flaws as stored: what they grant is added on the first drawing, and that is a change to save
  const vd0 = orig ? clone({ virtudes: d.virtudes, defectos: d.defectos }) : null;
  drawVd(); drawHab(); drawArts(); drawSp();
  // the sheet as this form opened it: on save, what the form did not change is taken from the latest copy instead
  const start = orig ? Object.assign(clone(d), vd0) : null;
  save.addEventListener('click', async () => {
    const name = String(d.nombre || '').trim();
    if (!name) { toast('El personaje necesita un nombre.'); const n = document.getElementById('pj-nombre'); if (n) n.focus(); return; }
    const out = clone(d);
    delete out._retUrl;
    out.nombre = name;
    // abilities without px or specialty are not stored when the sheet lists them anyway (standard ones, or learnt in a season)
    out.hab = out.hab.filter(x => String(x.n || '').trim()).map(x => ({ n: String(x.n).trim(), cat: x.cat || guessCat(x.n), esp: String(x.esp || '').trim(), base: numv(x.base) }))
      .filter(x => x.base > 0 || x.esp || x.cat !== guessCat(x.n) || !(CAT_OF[tkey(x.n)] || now.hab.some(y => y.implicit && tkey(y.n) === tkey(x.n))));
    out.hechizos = out.hechizos.filter(x => String(x.n || '').trim()).map(x => { const m = Math.max(0, Math.round(numv(x.maestria))); const o = Object.assign({}, x); if (m) o.maestria = m; else delete o.maestria; if (String(o.desc || '').trim()) o.desc = String(o.desc).trim(); else delete o.desc; return o; });
    out.virtudes = cleanVd(out.virtudes);
    out.defectos = cleanVd(out.defectos);
    out.personalidad = (out.personalidad || []).filter(t => String(t.n || '').trim()).map(t => ({ n: String(t.n).trim(), v: numv(t.v) }));
    ARTS.forEach(a => { out.artes[a] = numv(out.artes[a]); });
    CHARS.forEach(n => { out.car[n] = numv(out.car[n]); });
    const pid = id || newId(name);
    // others may have written to this sheet while the form was open (wounds and fatigue, the shape, a spell from the
    // catalogue): keep their changes in every field this form left as it found it
    const live = orig && S.pj[pid];
    if (live) {
      const same = k => JSON.stringify(d[k]) === JSON.stringify(start[k]);
      Object.keys(Object.assign({}, live, start)).forEach(k => {
        if (k === 'actualizado' || k === 'por' || !same(k)) return;
        if (k in live) out[k] = clone(live[k]); else delete out[k];
      });
    }
    // El Don without a value (older sheets): always free, also when the rest of the virtues come from the live copy
    (out.virtudes || []).forEach(x => { if (x && !x.valor && vdFx(x, 'virtud') === 'don') x.valor = 'Gratuita'; });
    save.disabled = true;
    const ok = await dbWrite(() => S.db.doc('personajes/' + pid).set(stamp(out, !orig)), orig ? 'Ficha guardada' : 'Personaje creado');
    save.disabled = false;
    if (ok) {
      if (!orig) store(DRAFT_KEY, null);
      localPut('pj', pid, out);
      location.hash = '#pj--' + pid;
    }
  });
  page.appendChild(f);
  document.title = (orig ? 'Editar ' + orig.nombre : 'Nuevo personaje') + ' — Europa Mítica';
}
function drawPanel(panel, r) {
  panel.innerHTML = '';
  panel.appendChild(h('div', { class: 'cc-lines' }, r.lines.map(l => h('div', { class: 'cc-line st-' + l.st }, [h('span', { class: 'l', text: l.l }), h('span', { class: 'v', text: l.txt }),
    h('span', { class: 'm', text: l.st === 'over' ? 'te pasas' : l.st === 'under' ? 'sin gastar del todo' : 'justo' })]))));
  if (r.errors.length || r.avisos.length) panel.appendChild(h('ul', { class: 'cc-issues' }, r.errors.map(t => h('li', { class: 'err', text: t })).concat(r.avisos.map(t => h('li', { class: 'warn', text: t })))));
  else panel.appendChild(h('p', { class: 'cc-ok', text: 'Todo cuadra con las reglas de creación.' }));
  panel.appendChild(h('details', { class: 'cc-more' }, [h('summary', { text: 'De dónde sale el presupuesto de experiencia' }),
    h('ul', null, r.parts.map(p => h('li', { text: p[0] + ': ' + p[1] + ' px' })).concat(r.spBudget ? [h('li', { text: 'Hechizos: ' + r.spBudget + ' niveles' })] : [], r.shared ? [h('li', { text: 'Años tras el Guantelete: ' + r.shared + ' puntos para PX o niveles de hechizo (30 por año)' })] : [],
      r.msBonus ? [h('li', { text: 'Hechizos dominados: ' + r.msBonus + ' px para maestría de hechizos' })] : [],
      [h('li', { text: 'Límite de habilidad por edad: ' + r.cap + (r.age != null ? ' (' + r.age + ' años)' : '') + '; ' + (r.cap + 2) + ' con Afinidad' })])),
    h('p', { class: 'fh', text: 'Reglas de creación de Ars Magica 5.ª edición (capítulos 3 y 4) y, para aprendices, del suplemento Apprentices. Los paquetes de infancia salen de tu Excel.' })]));
}
/* childhood packages from the saga's Excel: slots resolve to this character's language and homeland */
function slotName(d, slot) {
  const cr = d.creacion;
  return slot === 'lengua' ? (cr.lengua || 'Lengua materna') : slot === 'lengua2' ? 'Segundo idioma' : slot === 'tierra' ? (cr.tierra || 'Tierra natal') : slot === 'tierra2' ? 'Región vecina' : '';
}
function addXp(d, n, cat, px) {
  let row = d.hab.find(x => tkey(x.n) === tkey(n));
  if (!row) { row = { n: n, cat: cat, esp: '', base: 0 }; d.hab.push(row); }
  row.base = Math.max(0, numv(row.base) + px);
  return row;
}
function dropEmpty(d, names) {
  const ks = names.map(tkey);
  d.hab = d.hab.filter(x => !(numv(x.base) <= 0 && !String(x.esp || '').trim() && ks.includes(tkey(x.n))));
}
function applyPreset(d, name) {
  const cr = d.creacion;
  const old = cr.infAplicada || [];
  old.forEach(it => addXp(d, it.n, 'Otras', -it.px));
  dropEmpty(d, old.map(it => it.n));
  cr.infAplicada = [];
  cr.infancia = name || '';
  const p = PRESETS().find(x => x.n === name);
  const natName = cr.lengua || 'Lengua materna';
  if (p) {
    if (cr.nativaAuto) { addXp(d, natName, 'Idiomas vivos', -75); dropEmpty(d, [natName]); cr.nativaAuto = false; }
    p.items.forEach(it => {
      const n = it.slot ? slotName(d, it.slot) : it.n;
      addXp(d, n, it.cat, it.px);
      cr.infAplicada.push({ n: n, px: it.px, slot: it.slot || '' });
    });
  } else if (cr.lengua && !cr.nativaAuto) { addXp(d, natName, 'Idiomas vivos', 75); cr.nativaAuto = true; }
}
function renameSlot(d, slot, oldVal, newVal) {
  const cr = d.creacion;
  const def = slot === 'lengua' ? 'Lengua materna' : 'Tierra natal';
  const from = oldVal || def, to = newVal || def;
  if (tkey(from) !== tkey(to)) {
    const row = d.hab.find(x => tkey(x.n) === tkey(from)), dest = d.hab.find(x => tkey(x.n) === tkey(to));
    // the new name is already on the sheet: its row takes this one's px, so the package's px stay where it will look for them
    if (row && dest && row !== dest) { dest.base = numv(dest.base) + numv(row.base); if (!dest.esp && row.esp) dest.esp = row.esp; d.hab.splice(d.hab.indexOf(row), 1); }
    else if (row) row.n = to;
    (cr.infAplicada || []).forEach(it => { if (it.slot === slot) it.n = to; });
  }
  if (slot === 'lengua' && newVal && !cr.infancia && !cr.nativaAuto && !d.hab.some(x => tkey(x.n) === tkey(newVal))) { addXp(d, newVal, 'Idiomas vivos', 75); cr.nativaAuto = true; }
  // the homeland's Area Lore shows among the abilities, ready for its px
  if (slot === 'tierra' && newVal && !d.hab.some(x => tkey(x.n) === tkey(newVal))) d.hab.push({ n: newVal, cat: 'Conocimientos de área', esp: '', base: 0 });
}
export { viewEditor };
