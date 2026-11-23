/* El trabajo de laboratorio de una estación (avance/{id}.lab): aprender hechizos de textos, inventar un hechizo, descifrar
   las notas de otro mago y traducir textos al latín (ArM5 p. 151–161). La página calcula el Total de Laboratorio y avisa
   de lo que no cumple las reglas, sin impedir guardar. Al guardar, lo aprendido o inventado pasa a la ficha (hechizos con
   est: la estación), lo inventado deja su texto en la biblioteca (origen: la estación) y lo traducido queda en latín;
   borrar o cambiar la estación lo deshace. */
import { ARTS_F, ARTS_T, artOf, h } from '../base.js';
import { S, tkey } from './state.js';
import { clone, entriesOf, habLevel, labTotal, labTxt, numv, sname } from './rules.js';
import { datalist, field, inp, localDel, localPut, sel, stamp } from './core.js';
import { autorKey, autorTxt, cifrasDe, ownNotes, tefo, txLabel, txList, txProblems } from './library.js';
import { hechCat } from '../info.js';

const LAB_KIND = { 'Laboratorio: aprender de textos': 'aprender', 'Laboratorio: inventar un hechizo': 'inventar', 'Laboratorio: descifrar un texto': 'descifrar', 'Traducir textos de laboratorio': 'traducir' };
const POR_LATIN = 20; // levels of lab text translated per point of Latin in a season (ArM5 p. 161)
const SPELL_KEYS = ['n', 'tec', 'forma', 'nivel', 'alc', 'dur', 'obj', 'cat', 'ritual'];
const spellOf = t => { const s = {}; SPELL_KEYS.forEach(k => { if (t[k] != null && t[k] !== '') s[k] = t[k]; }); s.nivel = numv(s.nivel); return s; };
const warnList = l => l.length ? h('ul', { class: 'lab-warn' }, l.map(t => h('li', { text: t }))) : null;
const okLine = t => h('p', { class: 'lab-ok', text: t });

/* the panel inside the season's editor. pj: the sheet; base: calc() without this season; ex: the entry being edited (or
   null). Returns { box, draw(kind), collect(entryId, anio, est) → { lab, add, tx, error } } */
function labPanel(pjId, pj, base, origId, ex) {
  const prev = ex && ex.lab ? clone(ex.lab) : null;
  const w = { textos: [], mod: '', proyecto: '', texto: '', hechizo: { n: '', tec: '', forma: '', nivel: '', alc: '', dur: '', obj: '' } };
  if (prev) {
    w.mod = prev.mod || '';
    if (prev.tipo === 'aprender') w.textos = (prev.textos || []).slice();
    if (prev.tipo === 'traducir') w.textos = (prev.textos || []).map(x => x.id);
    if (prev.tipo === 'inventar') { w.proyecto = prev.proyecto || ''; w.hechizo = Object.assign(w.hechizo, prev.hechizo || {}); }
    if (prev.tipo === 'descifrar') w.texto = prev.texto || '';
  }
  // the texts this entry translated, as they were before
  const antes = new Map(prev && prev.tipo === 'traducir' ? (prev.textos || []).map(x => [x.id, x.antes || {}]) : []);
  const txAt = id => { const t = S.tx[id]; return t ? Object.assign({ _id: id }, t, antes.get(id) || {}) : null; };
  const cif = cifrasDe(pjId, origId);
  const known = new Set((pj.hechizos || []).filter(s => !(origId && s.est === origId)).map(s => tkey(s.n)));
  const others = entriesOf(pjId).filter(e => e._id !== origId);
  const box = h('div', { class: 'lab-box' });
  let kind = '';
  const modIn = () => field('Otros bonos al Total de Laboratorio', inp(w.mod, v => { w.mod = v; upd(); }, { type: 'number', step: '1', inputmode: 'numeric', placeholder: '0' }), 'Calidad del laboratorio, familiar, especialidad de Teoría Mágica, hechizos parecidos…');
  const sum = h('div', { class: 'lab-sum', 'aria-live': 'polite' });
  let upd = () => {};

  function check(id, on) { w.textos = w.textos.filter(x => x !== id); if (on) w.textos.push(id); upd(); }
  function textRow(t, extra) {
    return h('label', { class: 'lab-it' + (extra.length ? ' warn' : '') }, [
      h('input', { type: 'checkbox', checked: w.textos.includes(t._id) ? true : null, onchange: ev => check(t._id, ev.target.checked) }),
      h('span', null, [h('b', { text: txLabel(t) }), h('small', { text: [t.idioma || 'Latín', t.cifrado ? (ownNotes(pjId, t) ? 'sus notas cifradas' : 'notas cifradas de ' + autorTxt(t)) : 'legible'].concat(extra).join(' · ') })])]);
  }

  /* ---- learn spells from lab texts: one Technique and Form, levels adding up to the Lab Total */
  function drawAprender() {
    const L = txList();
    if (!L.length) { box.appendChild(h('p', { class: 'note', text: 'La biblioteca no tiene textos todavía: añádelos en Biblioteca.' })); return; }
    box.appendChild(h('span', { class: 'fl', text: 'Textos que estudia' }));
    box.appendChild(h('div', { class: 'lab-list' }, L.map(t => textRow(t, txProblems(pjId, t, base, cif).concat(known.has(tkey(t.n)) ? ['ya lo conoce'] : [])))));
    box.appendChild(modIn());
    box.appendChild(sum);
    upd = () => {
      sum.innerHTML = '';
      const chosen = w.textos.map(txAt).filter(Boolean);
      if (!chosen.length) { sum.appendChild(h('p', { class: 'fh', text: 'Marca los textos de los que aprende esta estación.' })); return; }
      const t0 = chosen[0], ajeno = chosen.some(t => autorKey(t) !== tkey(pjId));
      const LT = labTotal(pj, base, t0.tec, t0.forma, { ajeno: ajeno, mod: w.mod });
      const niv = chosen.reduce((s, t) => s + numv(t.nivel), 0), av = [];
      if (chosen.some(t => t.tec !== t0.tec || t.forma !== t0.forma)) av.push('En una estación solo se aprenden textos de la misma Técnica y Forma.');
      if (niv > LT.total) av.push('Los niveles suman ' + niv + ' y el Total de Laboratorio es ' + LT.total + ': no le da para todos.');
      chosen.forEach(t => {
        const p = txProblems(pjId, t, base, cif);
        if (p.length) av.push(txLabel(t) + ': ' + p.join('; ') + '.');
        if (known.has(tkey(t.n))) av.push(t.n + ': ya lo conoce.');
      });
      sum.appendChild(h('p', { class: 'fh', text: 'Total de Laboratorio de ' + tefo(t0) + ': ' + labTxt(LT) + '. Niveles de esta estación: ' + niv + '.' }));
      sum.appendChild(warnList(av) || okLine('Aprende ' + chosen.map(t => t.n).join(', ') + ': pasa' + (chosen.length > 1 ? 'n' : '') + ' a la ficha al guardar.'));
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
      cur ? w.proyecto : '', v => { w.proyecto = v; if (!v) w.hechizo = { n: '', tec: '', forma: '', nivel: '', alc: '', dur: '', obj: '' }; redraw(); })));
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
      const LT = labTotal(pj, base, x.tec, x.forma, { inventar: true, mod: w.mod });
      const pts = Math.max(0, LT.total - nivel), acc = (cur ? cur.acc : 0) + pts, av = [];
      if (LT.total <= nivel) av.push('El Total de Laboratorio (' + LT.total + ') tiene que superar el nivel del hechizo (' + nivel + ').');
      if (known.has(tkey(x.n))) av.push((x.n || 'Ese hechizo') + ': ya lo conoce.');
      sum.appendChild(h('p', { class: 'fh', text: 'Total de Laboratorio de ' + tefo(x) + ': ' + labTxt(LT) + '. Esta estación suma ' + pts + ' puntos' + (cur ? ' (lleva ' + cur.acc + ')' : '') + ': ' + acc + ' de ' + nivel + '.' }));
      const rest = nivel - acc;
      sum.appendChild(warnList(av) || okLine(rest <= 0 ? 'Lo termina esta estación: pasa a la ficha, y su texto, en sus notas cifradas, a la biblioteca.'
        : 'Faltan ' + rest + ' puntos' + (!pts ? '.' : Math.ceil(rest / pts) === 1 ? ': una estación más a este ritmo.' : ': unas ' + Math.ceil(rest / pts) + ' estaciones más a este ritmo.')));
    };
  }

  /* ---- decipher another magus' notes: each season adds the Lab Total in the text's Technique and Form */
  function decAcc(id) { return others.reduce((s, e) => s + (e.lab && e.lab.tipo === 'descifrar' && e.lab.texto === id ? numv(e.lab.puntos) : 0), 0); }
  function drawDescifrar() {
    const L = txList().filter(t => t._id === w.texto || (t.cifrado && autorKey(t) !== tkey(pjId) && (cif[autorKey(t)] || 0) < numv(t.nivel)));
    if (!L.length) { box.appendChild(h('p', { class: 'note', text: 'No hay en la biblioteca notas cifradas de otro mago que le falte descifrar.' })); return; }
    box.appendChild(field('Texto que descifra', sel([['', '— Elige el texto —']].concat(L.map(t => [t._id, txLabel(t) + ' · notas de ' + autorTxt(t)])), w.texto, v => { w.texto = v; upd(); })));
    box.appendChild(modIn());
    box.appendChild(sum);
    upd = () => {
      sum.innerHTML = '';
      const t = txAt(w.texto);
      if (!t) { sum.appendChild(h('p', { class: 'fh', text: 'Elige las notas cifradas que estudia.' })); return; }
      const LT = labTotal(pj, base, t.tec, t.forma, { mod: w.mod }), before = decAcc(t._id), acc = before + LT.total, nivel = numv(t.nivel);
      sum.appendChild(h('p', { class: 'fh', text: 'Total de Laboratorio de ' + tefo(t) + ': ' + labTxt(LT) + '. Acumula ' + acc + ' de ' + nivel + (before ? ' (llevaba ' + before + ')' : '') + '.' }));
      sum.appendChild(okLine(acc >= nivel ? 'Lo descifra: puede usar y traducir los textos de ' + autorTxt(t) + ' hasta nivel ' + nivel + '.' : 'Faltan ' + (nivel - acc) + ' puntos: necesita más estaciones.'));
    };
  }

  /* ---- translate into Latin: Latin × 20 levels a season; another magus' notes need his cipher first */
  function drawTraducir() {
    const L = txList().map(t => txAt(t._id)).filter(t => w.textos.includes(t._id) || t.cifrado || tkey(t.idioma || 'Latín') !== 'latin');
    if (!L.length) { box.appendChild(h('p', { class: 'note', text: 'Todos los textos de la biblioteca están ya en latín y legibles.' })); return; }
    box.appendChild(h('span', { class: 'fl', text: 'Textos que pasa al latín' }));
    box.appendChild(h('div', { class: 'lab-list' }, L.map(t => textRow(t, trProblems(t)))));
    box.appendChild(sum);
    upd = () => {
      sum.innerHTML = '';
      const chosen = w.textos.map(txAt).filter(Boolean);
      const cap = habLevel(base, 'Latín') * POR_LATIN;
      if (!chosen.length) { sum.appendChild(h('p', { class: 'fh', text: 'Marca los textos que traduce. Le caben ' + cap + ' niveles esta estación (Latín × ' + POR_LATIN + ').' })); return; }
      const niv = chosen.reduce((s, t) => s + numv(t.nivel), 0), av = [];
      if (niv > cap) av.push('Los niveles suman ' + niv + ' y le caben ' + cap + ' (Latín × ' + POR_LATIN + ').');
      chosen.forEach(t => { const p = trProblems(t); if (p.length) av.push(txLabel(t) + ': ' + p.join('; ') + '.'); });
      sum.appendChild(h('p', { class: 'fh', text: 'Niveles: ' + niv + ' de ' + cap + '.' }));
      sum.appendChild(warnList(av) || okLine('Al guardar, ' + (chosen.length === 1 ? 'el texto queda' : 'los ' + chosen.length + ' textos quedan') + ' en latín, legibles para cualquier mago.'));
    };
  }
  function trProblems(t) {
    const out = [];
    if (t.cifrado && autorKey(t) !== tkey(pjId) && (cif[autorKey(t)] || 0) < numv(t.nivel)) out.push('antes hay que descifrar las notas de ' + autorTxt(t));
    const idi = t.idioma || 'Latín';
    if (tkey(idi) !== 'latin' && habLevel(base, idi) < 4) out.push('pide 4 en ' + idi + ' (tiene ' + habLevel(base, idi) + ')');
    return out;
  }

  function redraw() { draw(kind); }
  function draw(k) {
    kind = k || '';
    box.innerHTML = '';
    upd = () => {};
    box.hidden = !kind;
    if (!kind) return;
    if (!/^(Magus|Maga|Aprendiz)$/.test(pj.tipo || '')) box.appendChild(h('p', { class: 'note', text: 'El trabajo de laboratorio es cosa de magos y aprendices.' }));
    ({ aprender: drawAprender, inventar: drawInventar, descifrar: drawDescifrar, traducir: drawTraducir })[kind]();
    upd();
  }

  /* what the entry stores, and what it changes elsewhere: add (spells for the sheet), tx ([[id, doc]] texts for the library) */
  function collect(entryId, anio, est) {
    if (!kind) return { lab: null, add: [], tx: [] };
    if (kind === 'aprender') {
      const chosen = w.textos.map(txAt).filter(Boolean);
      if (!chosen.length) return { error: 'Marca al menos un texto del que aprende.' };
      const t0 = chosen[0], LT = labTotal(pj, base, t0.tec, t0.forma, { ajeno: chosen.some(t => autorKey(t) !== tkey(pjId)), mod: w.mod });
      return { lab: { tipo: kind, textos: chosen.map(t => t._id), hechizos: chosen.map(t => txLabel(t)), tec: t0.tec, forma: t0.forma, total: LT.total, mod: numv(w.mod) || 0 },
        add: chosen.filter(t => !known.has(tkey(t.n))).map(spellOf), tx: [] };
    }
    if (kind === 'inventar') {
      const P = projects(), cur = P.get(w.proyecto), x = cur ? cur.hechizo : w.hechizo, nivel = numv(x.nivel);
      if (!String(x.n || '').trim() || !artOf(x.tec) || !artOf(x.forma) || !nivel) return { error: 'Escribe el hechizo que inventa, su Técnica, su Forma y su nivel.' };
      const hech = spellOf(Object.assign({}, x, { n: String(x.n).trim(), tec: artOf(x.tec), forma: artOf(x.forma) }));
      const LT = labTotal(pj, base, hech.tec, hech.forma, { inventar: true, mod: w.mod });
      const pts = Math.max(0, LT.total - nivel), acc = (cur ? cur.acc : 0) + pts, fin = acc >= nivel;
      const lab = { tipo: kind, proyecto: w.proyecto || ('p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), hechizo: hech, total: LT.total, puntos: pts, acumulado: acc, fin: fin, mod: numv(w.mod) || 0 };
      if (!fin) return { lab: lab, add: [], tx: [] };
      const texto = Object.assign({}, hech, { idioma: 'Latín', cifrado: true, autor: pj.nombre || '', autorPj: pjId, origen: entryId, nota: 'Inventado por ' + (pj.nombre || 'un mago') + ' en ' + sname(anio, est) + '.' });
      return { lab: lab, add: known.has(tkey(hech.n)) ? [] : [hech], tx: [['tx-' + entryId, texto]] };
    }
    if (kind === 'descifrar') {
      const t = txAt(w.texto);
      if (!t) return { error: 'Elige el texto que descifra.' };
      const LT = labTotal(pj, base, t.tec, t.forma, { mod: w.mod }), acc = decAcc(t._id) + LT.total;
      return { lab: { tipo: kind, texto: t._id, nombre: txLabel(t), nivel: numv(t.nivel), autor: autorKey(t), autorTxt: autorTxt(t), tec: t.tec, forma: t.forma, total: LT.total, puntos: LT.total, acumulado: acc, mod: numv(w.mod) || 0 }, add: [], tx: [] };
    }
    const chosen = w.textos.map(txAt).filter(Boolean);
    if (!chosen.length) return { error: 'Marca al menos un texto que traduce.' };
    return { lab: { tipo: kind, textos: chosen.map(t => ({ id: t._id, n: txLabel(t), antes: { idioma: t.idioma || 'Latín', cifrado: !!t.cifrado } })) }, add: [], tx: [] };
  }

  return { box: box, draw: draw, collect: collect };
}

/* adds to the batch what a season's lab work changes outside its own document, undoing what the entry did before.
   oldId: the entry as saved (or null); next: { id, lab, add, tx } (or null when the entry is deleted).
   Returns the local updates to show at once once the batch is written: [[key, id, doc|null]] */
function labOps(b, pjId, oldId, next) {
  const local = [];
  const old = oldId ? S.av[oldId] : null;
  const pj = S.pj[pjId];
  if (pj) {
    const had = (pj.hechizos || []).filter(s => oldId && s.est === oldId);
    const add = next ? next.add : [];
    if (had.length || add.length) {
      const doc = clone(pj);
      doc.hechizos = (pj.hechizos || []).filter(s => !(oldId && s.est === oldId)).concat(add.map(s => Object.assign({}, s, { est: next.id })));
      b.set('personajes/' + pjId, stamp(doc));
      local.push(['pj', pjId, doc]);
    }
  }
  const keep = new Set((next ? next.tx : []).map(([id]) => id));
  if (oldId) Object.keys(S.tx).forEach(id => { if (S.tx[id].origen === oldId && !keep.has(id)) { b.delete('textos/' + id); local.push(['tx', id, null]); } });
  (next ? next.tx : []).forEach(([id, doc]) => { const d = stamp(Object.assign({}, doc), !S.tx[id]); b.set('textos/' + id, d); local.push(['tx', id, d]); });
  // translations: the old entry's go back to how they were, the new entry's go into Latin
  const restore = new Map(old && old.lab && old.lab.tipo === 'traducir' ? (old.lab.textos || []).map(x => [x.id, x.antes || {}]) : []);
  const tr = new Set(next && next.lab && next.lab.tipo === 'traducir' ? next.lab.textos.map(x => x.id) : []);
  new Set([...restore.keys(), ...tr]).forEach(id => {
    if (!S.tx[id]) return;
    const d = Object.assign({}, S.tx[id], restore.get(id) || {}, tr.has(id) ? { idioma: 'Latín', cifrado: false } : {});
    b.set('textos/' + id, stamp(d));
    local.push(['tx', id, d]);
  });
  return local;
}
function applyLocal(local) { local.forEach(([k, id, doc]) => { if (doc) localPut(k, id, doc); else localDel(k, id); }); }

export { applyLocal, LAB_KIND, labOps, labPanel };
