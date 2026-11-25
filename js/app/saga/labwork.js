/* El trabajo de laboratorio de una estación (avance/{id}.lab): aprender hechizos de textos, inventar un hechizo, descifrar
   las notas de otro mago y traducir textos al latín (ArM5 p. 151–161), con los textos de la biblioteca de la saga
   (library.js). La página calcula el Total de Laboratorio y avisa de lo que no cumple las reglas, sin impedir guardar.
   Al guardar, lo aprendido o inventado pasa a la ficha (hechizos con est: la estación); lo que la estación hace en la
   biblioteca (agotar, traducir, el texto de lo inventado) lo calcula library.js a partir de ella. Borrar o cambiar la
   estación lo deshace. */
import { ARTS_F, ARTS_T, artOf, h, norm } from '../base.js';
import { S, tkey } from './state.js';
import { clone, entriesOf, habLevel, labTotal, labTxt, numv } from './rules.js';
import { datalist, field, inp, localPut, sel, stamp } from './core.js';
import { cifrasDe, first, hasUsed, ownNotes, tefo, txLabel, txList, txProblems } from './library.js';
import { hechCat } from '../info.js';

const LAB_KIND = { 'Laboratorio: aprender de textos': 'aprender', 'Laboratorio: inventar un hechizo': 'inventar', 'Laboratorio: descifrar un texto': 'descifrar', 'Traducir textos de laboratorio': 'traducir' };
const POR_LATIN = 20; // levels of lab text translated per point of Latin in a season (ArM5 p. 161)
const SPELL_KEYS = ['n', 'tec', 'forma', 'nivel', 'alc', 'dur', 'obj', 'cat', 'ritual'];
const spellOf = t => { const s = {}; SPELL_KEYS.forEach(k => { if (t[k] != null && t[k] !== '' && t[k] !== false) s[k] = t[k]; }); s.nivel = numv(s.nivel); return s; };
const warnList = l => l.length ? h('ul', { class: 'lab-warn' }, l.map(t => h('li', { text: t }))) : null;
const okLine = t => h('p', { class: 'lab-ok', text: t });
const BLANK = () => ({ n: '', tec: '', forma: '', nivel: '', alc: '', dur: '', obj: '' });

/* the panel inside the season's editor. pj: the sheet; base: calc() without this season; origId: the entry being edited (or
   null). Returns { box, draw(kind), collect() → { lab, add } or { error } } */
function labPanel(pjId, pj, base, origId) {
  const ex = origId ? S.av[origId] : null;
  const prev = ex && ex.lab ? clone(ex.lab) : null;
  const w = { textos: [], mod: '', proyecto: '', texto: '', hechizo: BLANK(), q: '' };
  if (prev) {
    w.mod = prev.mod || '';
    if (prev.tipo === 'aprender') w.textos = (prev.textos || []).slice();
    if (prev.tipo === 'traducir') w.textos = (prev.textos || []).map(x => x.id || x);
    if (prev.tipo === 'inventar') { w.proyecto = prev.proyecto || ''; w.hechizo = Object.assign(BLANK(), prev.hechizo || {}); }
    if (prev.tipo === 'descifrar') w.texto = prev.texto || '';
  }
  // the library as it was before this season
  const lib = txList(origId), byId = new Map(lib.map(t => [t._id, t]));
  const cif = cifrasDe(pjId, origId);
  const spells = new Set((pj.hechizos || []).filter(s => !(origId && s.est === origId)).map(s => tkey(s.n)));
  const known = t => spells.has(tkey(t.n)) || hasUsed(pj, t);
  const ajeno = t => !(t.autor && first(t.autor) === first(pj.nombre));
  const problems = t => txProblems(pj, t, base, cif, habLevel);
  const others = entriesOf(pjId).filter(e => e._id !== origId);
  const box = h('div', { class: 'lab-box' });
  let kind = '';
  const modIn = () => field('Otros bonos al Total de Laboratorio', inp(w.mod, v => { w.mod = v; upd(); }, { type: 'number', step: '1', inputmode: 'numeric', placeholder: '0' }), 'Calidad del laboratorio, familiar, especialidad de Teoría Mágica, hechizos parecidos…');
  const sum = h('div', { class: 'lab-sum', 'aria-live': 'polite' });
  let upd = () => {};

  /* a searchable list of texts with a checkbox each; extra(t): the notes for one text */
  function textList(L, extra) {
    const list = h('div', { class: 'lab-list' });
    const draw = () => {
      list.innerHTML = '';
      const q = norm(w.q);
      // the ticked ones first, then the rest that match the search
      const shown = L.filter(t => w.textos.includes(t._id)).concat(L.filter(t => !w.textos.includes(t._id) && (!q || norm([t.n, tefo(t), t.autor, t.idioma, t.prop].join(' ')).includes(q))));
      if (!shown.length) list.appendChild(h('p', { class: 'fh', text: 'Ningún texto coincide con la búsqueda.' }));
      shown.forEach(t => {
        const x = extra(t);
        list.appendChild(h('label', { class: 'lab-it' + (x.length ? ' warn' : '') }, [
          h('input', { type: 'checkbox', checked: w.textos.includes(t._id) ? true : null, onchange: ev => { w.textos = w.textos.filter(id => id !== t._id); if (ev.target.checked) w.textos.push(t._id); draw(); upd(); } }),
          h('span', null, [h('b', { text: txLabel(t) }), h('small', { text: [t.cifra ? (ownNotes(pj, t) ? 'sus notas cifradas' : 'notas cifradas de ' + t.cifra) : (t.idioma || 'Latín'), t.autor, t.prop && t.prop !== t.autor ? 'de ' + t.prop : ''].filter(Boolean).concat(x).join(' · ') })])]));
      });
    };
    const q = h('input', { type: 'search', value: w.q, placeholder: 'Buscar por hechizo, arte (CrIg), autor…', 'aria-label': 'Buscar textos', autocomplete: 'off' });
    q.addEventListener('input', () => { w.q = q.value; draw(); });
    draw();
    return [q, list];
  }

  /* ---- learn spells from lab texts: one Technique and Form, levels adding up to the Lab Total */
  function drawAprender() {
    if (!lib.length) { box.appendChild(h('p', { class: 'note', text: 'La saga no tiene biblioteca con textos de laboratorio.' })); return; }
    box.appendChild(h('span', { class: 'fl', text: 'Textos de la biblioteca que estudia' }));
    textList(lib, t => problems(t).concat(known(t) ? ['ya lo conoce'] : [])).forEach(n => box.appendChild(n));
    box.appendChild(modIn());
    box.appendChild(sum);
    upd = () => {
      sum.innerHTML = '';
      const chosen = w.textos.map(id => byId.get(id)).filter(Boolean);
      if (!chosen.length) { sum.appendChild(h('p', { class: 'fh', text: 'Marca los textos de los que aprende esta estación.' })); return; }
      const t0 = chosen[0];
      const LT = labTotal(pj, base, t0.tec, t0.forma, { ajeno: chosen.some(ajeno), mod: w.mod, pjId: pjId, act: ['Hechizos', 'Textos'] });
      const niv = chosen.reduce((s, t) => s + numv(t.nivel), 0), av = [];
      if (chosen.some(t => t.tec !== t0.tec || t.forma !== t0.forma)) av.push('En una estación solo se aprenden textos de la misma Técnica y Forma.');
      if (niv > LT.total) av.push('Los niveles suman ' + niv + ' y el Total de Laboratorio es ' + LT.total + ': no le da para todos.');
      chosen.forEach(t => {
        const p = problems(t);
        if (p.length) av.push(txLabel(t) + ': ' + p.join('; ') + '.');
        if (known(t)) av.push(t.n + ': ya lo conoce.');
      });
      sum.appendChild(h('p', { class: 'fh', text: 'Total de Laboratorio de ' + tefo(t0) + ': ' + labTxt(LT) + '. Niveles de esta estación: ' + niv + '.' }));
      sum.appendChild(warnList(av) || okLine('Aprende ' + chosen.map(t => t.n).join(', ') + ': pasa' + (chosen.length > 1 ? 'n' : '') + ' a la ficha y a «Agotado por» al guardar.'));
    };
  }

  /* ---- invent a spell: each season adds Lab Total − level, until the points reach the level */
  function projects() {
    const m = new Map();
    others.forEach(e => {
      const L = e.lab;
      if (!L || L.tipo !== 'inventar' || !L.proyecto) return;
      const p = m.get(L.proyecto) || { id: L.proyecto, hechizo: L.hechizo || {}, acc: 0, fin: false };
      p.acc += numv(L.puntos);
      p.fin = p.fin || !!L.fin;
      m.set(L.proyecto, p);
    });
    return m;
  }
  function drawInventar() {
    const P = projects(), open = [...P.values()].filter(p => !p.fin);
    const cur = P.get(w.proyecto);
    if (open.length || cur) box.appendChild(field('Proyecto', sel([['', 'Un hechizo nuevo']].concat(open.concat(cur && cur.fin ? [cur] : []).map(p => [p.id, txLabel(p.hechizo) + ' · lleva ' + p.acc + ' de ' + numv(p.hechizo.nivel) + ' puntos'])),
      cur ? w.proyecto : '', v => { w.proyecto = v; if (!v) w.hechizo = BLANK(); draw(kind); })));
    if (!cur) {
      const x = w.hechizo, cat = hechCat();
      const dl = cat.list.length ? datalist('dl-lab-hech', cat.list.map(e => e.n)) : null;
      const tecS = sel([['', '—']].concat(ARTS_T), x.tec, v => { x.tec = v; upd(); }, { 'aria-label': 'Técnica' });
      const forS = sel([['', '—']].concat(ARTS_F), x.forma, v => { x.forma = v; upd(); }, { 'aria-label': 'Forma' });
      const nivI = inp(x.nivel, v => { x.nivel = v; upd(); }, { type: 'number', min: '1', inputmode: 'numeric', 'aria-label': 'Nivel' });
      const nameI = inp(x.n, v => { x.n = v; upd(); }, { list: dl, placeholder: dl ? 'Nombre (o elige del catálogo)' : 'Nombre del hechizo', autocomplete: 'off' });
      nameI.addEventListener('change', () => {
        const e = (cat.byKey.get(tkey(nameI.value)) || [])[0];
        if (!e) return;
        x.cat = e.id;
        if (!x.tec) { x.tec = e.tec; tecS.value = e.tec; }
        if (!x.forma) { x.forma = e.forma; forS.value = e.forma; }
        if (!x.nivel && String(e.nivel) !== 'Gen') { x.nivel = e.nivel; nivI.value = e.nivel; }
        ['alc', 'dur', 'obj'].forEach(k => { if (!x[k] && e[k]) x[k] = e[k]; });
        if (e.rit) x.ritual = true;
        upd();
      });
      box.appendChild(field('Hechizo que inventa', nameI));
      box.appendChild(h('div', { class: 'fld-row tri' }, [field('Técnica', tecS), field('Forma', forS), field('Nivel', nivI)]));
    }
    box.appendChild(modIn());
    box.appendChild(sum);
    upd = () => {
      sum.innerHTML = '';
      const x = cur ? cur.hechizo : w.hechizo, nivel = numv(x.nivel);
      if (!artOf(x.tec) || !artOf(x.forma) || !nivel) { sum.appendChild(h('p', { class: 'fh', text: 'Elige el hechizo, su Técnica, su Forma y su nivel.' })); return; }
      const LT = labTotal(pj, base, x.tec, x.forma, { inventar: true, mod: w.mod, pjId: pjId, act: ['Hechizos'] });
      const pts = Math.max(0, LT.total - nivel), acc = (cur ? cur.acc : 0) + pts, av = [];
      if (LT.total <= nivel) av.push('El Total de Laboratorio (' + LT.total + ') tiene que superar el nivel del hechizo (' + nivel + ').');
      if (spells.has(tkey(x.n))) av.push((x.n || 'Ese hechizo') + ': ya lo conoce.');
      sum.appendChild(h('p', { class: 'fh', text: 'Total de Laboratorio de ' + tefo(x) + ': ' + labTxt(LT) + '. Esta estación suma ' + pts + ' puntos' + (cur ? ' (lleva ' + cur.acc + ')' : '') + ': ' + acc + ' de ' + nivel + '.' }));
      const rest = nivel - acc, more = pts ? Math.ceil(rest / pts) : 0;
      sum.appendChild(warnList(av) || okLine(rest <= 0 ? 'Lo termina esta estación: pasa a la ficha, y su texto, en sus notas cifradas, a la biblioteca.'
        : 'Faltan ' + rest + ' puntos' + (!pts ? '.' : more === 1 ? ': una estación más a este ritmo.' : ': unas ' + more + ' estaciones más a este ritmo.')));
    };
  }

  /* ---- decipher another magus' notes: each season adds the Lab Total in the text's Technique and Form */
  const decAcc = id => others.reduce((s, e) => s + (e.lab && e.lab.tipo === 'descifrar' && e.lab.texto === id ? numv(e.lab.puntos) : 0), 0);
  function drawDescifrar() {
    const L = lib.filter(t => t._id === w.texto || (t.cifra && !ownNotes(pj, t) && (cif[first(t.cifra)] || 0) < numv(t.nivel)));
    if (!L.length) { box.appendChild(h('p', { class: 'note', text: 'No hay en la biblioteca notas cifradas de otro mago que le falte descifrar.' })); return; }
    box.appendChild(field('Notas cifradas que descifra', sel([['', '— Elige el texto —']].concat(L.map(t => [t._id, txLabel(t) + ' · notas de ' + t.cifra])), w.texto, v => { w.texto = v; upd(); })));
    box.appendChild(modIn());
    box.appendChild(sum);
    upd = () => {
      sum.innerHTML = '';
      const t = byId.get(w.texto);
      if (!t) { sum.appendChild(h('p', { class: 'fh', text: 'Elige las notas cifradas que estudia.' })); return; }
      const LT = labTotal(pj, base, t.tec, t.forma, { mod: w.mod, pjId: pjId, act: ['Textos'] }), before = decAcc(t._id), acc = before + LT.total, nivel = numv(t.nivel);
      sum.appendChild(h('p', { class: 'fh', text: 'Total de Laboratorio de ' + tefo(t) + ': ' + labTxt(LT) + '. Acumula ' + acc + ' de ' + nivel + (before ? ' (llevaba ' + before + ')' : '') + '.' }));
      sum.appendChild(okLine(acc >= nivel ? 'Lo descifra: puede usar y traducir las notas de ' + t.cifra + ' hasta nivel ' + nivel + '.' : 'Faltan ' + (nivel - acc) + ' puntos: necesita más estaciones.'));
    };
  }

  /* ---- translate into Latin: Latin × 20 levels a season; another magus' notes need his cipher first */
  function trProblems(t) {
    const out = [];
    if (t.cifra && !ownNotes(pj, t) && (cif[first(t.cifra)] || 0) < numv(t.nivel)) out.push('antes hay que descifrar las notas de ' + t.cifra);
    const idi = t.idioma || 'Latín';
    if (!t.cifra && tkey(idi) !== 'latin' && habLevel(base, idi) < 4) out.push('pide 4 en ' + idi + ' (tiene ' + habLevel(base, idi) + ')');
    return out;
  }
  function drawTraducir() {
    const L = lib.filter(t => w.textos.includes(t._id) || t.cifra || tkey(t.idioma || 'Latín') !== 'latin');
    if (!L.length) { box.appendChild(h('p', { class: 'note', text: 'Todos los textos de la biblioteca están ya en latín.' })); return; }
    box.appendChild(h('span', { class: 'fl', text: 'Textos que pasa al latín' }));
    textList(L, trProblems).forEach(n => box.appendChild(n));
    box.appendChild(sum);
    upd = () => {
      sum.innerHTML = '';
      const chosen = w.textos.map(id => byId.get(id)).filter(Boolean);
      const cap = habLevel(base, 'Latín') * POR_LATIN;
      if (!chosen.length) { sum.appendChild(h('p', { class: 'fh', text: 'Marca los textos que traduce. Le caben ' + cap + ' niveles esta estación (Latín × ' + POR_LATIN + ').' })); return; }
      const niv = chosen.reduce((s, t) => s + numv(t.nivel), 0), av = [];
      if (niv > cap) av.push('Los niveles suman ' + niv + ' y le caben ' + cap + ' (Latín × ' + POR_LATIN + ').');
      chosen.forEach(t => { const p = trProblems(t); if (p.length) av.push(txLabel(t) + ': ' + p.join('; ') + '.'); });
      sum.appendChild(h('p', { class: 'fh', text: 'Niveles: ' + niv + ' de ' + cap + '.' }));
      sum.appendChild(warnList(av) || okLine('Al guardar, ' + (chosen.length === 1 ? 'el texto queda' : 'los ' + chosen.length + ' textos quedan') + ' en latín en la biblioteca, legibles para cualquier mago.'));
    };
  }

  function draw(k) {
    kind = k || '';
    box.innerHTML = '';
    upd = () => {};
    box.hidden = !kind;
    if (!kind) return;
    if (!/^(Magus|Aprendiz)$/.test(pj.tipo || '')) box.appendChild(h('p', { class: 'note', text: 'El trabajo de laboratorio es cosa de magos y aprendices.' }));
    ({ aprender: drawAprender, inventar: drawInventar, descifrar: drawDescifrar, traducir: drawTraducir })[kind]();
    upd();
  }

  /* what the entry stores (lab) and the spells it puts on the sheet (add) */
  function collect() {
    if (!kind) return { lab: null, add: [] };
    if (kind === 'aprender') {
      const chosen = w.textos.map(id => byId.get(id)).filter(Boolean);
      if (!chosen.length) return { error: 'Marca al menos un texto del que aprende.' };
      const t0 = chosen[0], LT = labTotal(pj, base, t0.tec, t0.forma, { ajeno: chosen.some(ajeno), mod: w.mod, pjId: pjId, act: ['Hechizos', 'Textos'] });
      return { lab: { tipo: kind, textos: chosen.map(t => t._id), hechizos: chosen.map(txLabel), tec: t0.tec, forma: t0.forma, total: LT.total, mod: numv(w.mod) || 0 },
        add: chosen.filter(t => !spells.has(tkey(t.n))).map(spellOf) };
    }
    if (kind === 'inventar') {
      const cur = projects().get(w.proyecto), x = cur ? cur.hechizo : w.hechizo, nivel = numv(x.nivel);
      if (!String(x.n || '').trim() || !artOf(x.tec) || !artOf(x.forma) || !nivel) return { error: 'Escribe el hechizo que inventa, su Técnica, su Forma y su nivel.' };
      const hech = spellOf(Object.assign({}, x, { n: String(x.n).trim(), tec: artOf(x.tec), forma: artOf(x.forma) }));
      const LT = labTotal(pj, base, hech.tec, hech.forma, { inventar: true, mod: w.mod, pjId: pjId, act: ['Hechizos'] });
      const pts = Math.max(0, LT.total - nivel), acc = (cur ? cur.acc : 0) + pts, fin = acc >= nivel;
      const lab = { tipo: kind, proyecto: w.proyecto || ('p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), hechizo: hech, total: LT.total, puntos: pts, acumulado: acc, fin: fin, mod: numv(w.mod) || 0 };
      return { lab: lab, add: fin && !spells.has(tkey(hech.n)) ? [hech] : [] };
    }
    if (kind === 'descifrar') {
      const t = byId.get(w.texto);
      if (!t) return { error: 'Elige las notas cifradas que descifra.' };
      const LT = labTotal(pj, base, t.tec, t.forma, { mod: w.mod, pjId: pjId, act: ['Textos'] }), acc = decAcc(t._id) + LT.total;
      return { lab: { tipo: kind, texto: t._id, nombre: txLabel(t), nivel: numv(t.nivel), autor: first(t.cifra), autorTxt: t.cifra, tec: t.tec, forma: t.forma, total: LT.total, puntos: LT.total, acumulado: acc, mod: numv(w.mod) || 0 }, add: [] };
    }
    const chosen = w.textos.map(id => byId.get(id)).filter(Boolean);
    if (!chosen.length) return { error: 'Marca al menos un texto que traduce.' };
    return { lab: { tipo: kind, textos: chosen.map(t => ({ id: t._id, n: txLabel(t) })) }, add: [] };
  }

  return { box: box, draw: draw, collect: collect };
}

/* adds to the batch the spells a season's lab work puts on the sheet, taking out what the entry put there before.
   oldId: the entry as saved (or null); next: { id, add } (or null when the entry is deleted). Returns the local updates */
function labOps(b, pjId, oldId, next) {
  const pj = S.pj[pjId];
  if (!pj) return [];
  const had = (pj.hechizos || []).some(s => oldId && s.est === oldId);
  const add = next ? next.add : [];
  if (!had && !add.length) return [];
  const doc = clone(pj);
  doc.hechizos = (pj.hechizos || []).filter(s => !(oldId && s.est === oldId)).concat(add.map(s => Object.assign({}, s, { est: next.id })));
  b.set('personajes/' + pjId, stamp(doc));
  return [['pj', pjId, doc]];
}
function applyLocal(local) { local.forEach(([k, id, doc]) => localPut(k, id, doc)); }

export { applyLocal, LAB_KIND, labOps, labPanel };
