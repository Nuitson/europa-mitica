/* Las descripciones al pulsar: hechizos, virtudes y defectos. */
import { artChip, artOf, h, toNum } from './base.js';
import { S, tkey } from './saga/state.js';
import { dbWrite, field, localPut, openModal, stamp, toast } from './saga/core.js';
import { auraNow, botchDice, calc, canCeremony, canWrite, castAura, castAuraTxt, ceremonialOn, entriesOf, isRitual, spellTotal } from './saga/rules.js';
import { vdEntry, vdLabel } from './creation/rules.js';

/* ================================================================== DESCRIPCIONES AL PULSAR
   On a character, a spell or a Virtue/Flaw opens a card with its description: the catalogue's (summarised in Spanish
   from the open-licence Ars Magica books) and, for spells the troupe invented or adapted, the one the player wrote.
   The spell catalogue comes from data/hechizos.json; Virtues and Flaws come from the compendium (vdEntry). */
let HECH = null;
function hechCat() {
  if (HECH) return HECH;
  HECH = { list: [], byId: new Map(), byKey: new Map(), src: null };
  try {
    const d = window.EM_DATA && window.EM_DATA.hech;
    if (d && Array.isArray(d.h)) { HECH.list = d.h; HECH.src = d.src || null; }
  } catch (e) { /* no catalogue */ }
  HECH.list.forEach(x => {
    HECH.byId.set(x.id, x);
    [x.n, x.en].concat(x.alias || []).filter(Boolean).forEach(n => {
      const k = tkey(n);
      if (!HECH.byKey.has(k)) HECH.byKey.set(k, []);
      HECH.byKey.get(k).push(x);
    });
  });
  return HECH;
}
/* the catalogue entry of a character's spell: the one linked by hand, else by name (with or without what is in brackets) */
function spellCat(s) {
  if (!s) return null;
  const C = hechCat();
  if (s.cat === '-') return null;
  if (s.cat && C.byId.has(s.cat)) return C.byId.get(s.cat);
  const t = artOf(s.tec), f = artOf(s.forma);
  const fits = x => (!t || x.tec === t) && (!f || x.forma === f);
  const name = String(s.n || '');
  for (const k of [tkey(name), tkey(name.replace(/\(.*?\)/g, ' ')), tkey((name.match(/\(([^)]+)\)/) || [])[1] || '')]) {
    if (!k) continue;
    const hit = (C.byKey.get(k) || []).find(fits);
    if (hit) return hit;
  }
  return null;
}
const lvlTxt = v => (String(v) === 'Gen' ? 'nivel general' : 'nivel ' + v);
function rdtTxt(o) { return [o.alc, o.dur, o.obj].filter(Boolean).join(' · '); }
function catSource(x) {
  const C = hechCat();
  const p = h('p', { class: 'info-src' });
  p.appendChild(document.createTextNode((x.libro || 'Ars Magica, edición definitiva') + ': «' + (x.en || x.n) + '»' + (x.pag ? ', pág. ' + x.pag : '') + '. '));
  if (C.src) {
    p.appendChild(document.createTextNode(C.src.t + ' '));
    (C.src.links || []).forEach(([t, u], i) => { if (i) p.appendChild(document.createTextNode(' · ')); p.appendChild(h('a', { href: u, target: '_blank', rel: 'noopener', text: t })); });
  }
  return p;
}
function paras(txt, cls) { return String(txt || '').split(/\n+/).filter(s => s.trim()).map(s => h('p', { class: cls || null, text: s.trim() })); }

/* a spell of a character: catalogue text, the player's own description, notes; writers can add or change theirs */
/* ---------- casting a formulaic spell at the table (ArM5): casting total + stress die against the spell's level */
const d10 = () => { const r = new Uint32Array(1); crypto.getRandomValues(r); return r[0] % 10; }; // faces 0–9
// a 1 means roll again and double (×4 on a second 1…), and then a 0 counts as 10; a 0 on the first roll may botch
function stressDie() {
  let r = d10();
  if (r === 0) return { v: 0, zero: true, caras: [0], x: 1 };
  const caras = [r];
  let x = 1;
  while (r === 1) { x *= 2; r = d10(); caras.push(r); }
  return { v: x * (r === 0 ? 10 : r), zero: false, caras: caras, x: x };
}
const sg = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n);
// formulaic: at or over the level it works; up to 10 short it works but costs a Fatigue level; more, it fails (and costs it)
function castOutcome(total, lv, rit) {
  if (!isFinite(lv)) return 'total ' + total + '.';
  const m = total - lv;
  if (rit) return 'total ' + total + ' (' + sg(m) + ' respecto al nivel). Un ritual cansa siempre: mira la fatiga en las reglas.';
  if (m >= 0) return 'total ' + total + ': sale (' + sg(m) + ').';
  if (m >= -10) return 'total ' + total + ': sale, pero cuesta un nivel de fatiga (' + sg(m) + ').';
  return 'total ' + total + ': falla y cuesta un nivel de fatiga (' + sg(m) + ').';
}
function castBox(pj, pjId, s) {
  const c = calc(pj, entriesOf(pjId));
  const cer = ceremonialOn() && canCeremony(c);
  const tot = spellTotal(pj, c, s, castAura(), cer);
  if (tot == null) return null;
  const lv = toNum(s.nivel), rit = isRitual(s);
  const an = auraNow();
  // one botch die, plus one per point of an aura of another realm; each point of mastery takes one away
  const bd = Math.max(0, 1 + botchDice(an.tipo, an.nivel, 'magica') - Math.max(0, Math.round(Number(s.maestria) || 0)));
  const log = h('ol', { class: 'roll-log', 'aria-live': 'polite' });
  const roll = () => {
    const d = stressDie();
    let txt = 'Dado ' + d.caras.join(' → ') + (d.x > 1 ? ' (×' + d.x + ' = ' + d.v + ')' : '');
    let cls = '';
    if (d.zero && bd) {
      const dice = Array.from({ length: bd }, d10), zeros = dice.filter(x => x === 0).length;
      txt += ' · pifia: ' + dice.join(', ');
      if (zeros) { txt += ' → ¡pifia' + (zeros > 1 ? ' de ' + zeros + ' ceros' : '') + '!'; cls = 'botch'; }
      else txt += ' → sin pifia, ' + castOutcome(tot, lv, rit);
    } else txt += ' → ' + castOutcome(tot + d.v, lv, rit);
    if (!cls) cls = isFinite(lv) && tot + d.v >= lv ? 'ok' : isFinite(lv) && !rit && tot + d.v < lv - 10 ? 'fail' : '';
    log.prepend(h('li', { class: cls || null, text: txt }));
    while (log.children.length > 6) log.lastChild.remove();
  };
  return h('section', { class: 'roll' }, [
    h('div', { class: 'info-lab', text: 'Lanzarlo' }),
    h('p', { class: 'roll-tot' }, [h('b', { text: 'Lanzamiento ' + tot }), isFinite(lv) ? ' contra nivel ' + lv : '', ' · ' + castAuraTxt() + (cer ? ' · ceremonial' : '') + ' · ' + (bd ? bd + (bd === 1 ? ' dado' : ' dados') + ' de pifia' : 'sin dados de pifia')]),
    h('div', { class: 'roll-act' }, [h('button', { type: 'button', class: 'btn', onclick: roll }, 'Tirar dado de estrés')]),
    log]);
}

function spellInfo(pjId, i) {
  const pj = S.pj[pjId];
  const s = pj && (pj.hechizos || [])[i];
  if (!s) return;
  const cat = spellCat(s);
  const body = [];
  const t = artOf(s.tec) || (cat && cat.tec), f = artOf(s.forma) || (cat && cat.forma);
  const lv = s.nivel != null && s.nivel !== '' ? s.nivel : cat && cat.nivel;
  const head = h('div', { class: 'info-head' });
  if (t) head.appendChild(artChip(t));
  if (f) head.appendChild(artChip(f));
  if (lv != null && lv !== '') head.appendChild(h('span', { class: 'info-lv', text: lvlTxt(lv) }));
  const rdt = rdtTxt(s) || (cat ? rdtTxt(cat) : '');
  if (rdt) head.appendChild(h('span', { class: 'info-rdt', text: rdt }));
  if (isRitual(s) || (cat && cat.rit)) head.appendChild(h('span', { class: 'info-rdt', text: 'ritual' }));
  body.push(head);
  const cast = castBox(pj, pjId, s);
  if (cast) body.push(cast);
  if (cat && cat.req) body.push(h('p', { class: 'info-req', text: 'Requisito: ' + cat.req }));
  const own = String(s.desc || '').trim();
  if (own) body.push(h('div', { class: 'info-own' }, [h('div', { class: 'info-lab', text: cat ? 'Descripción de la ficha' : 'Descripción' })].concat(paras(own))));
  if (cat) {
    body.push(h('div', { class: 'info-cat' }, [h('div', { class: 'info-lab', text: own ? 'En el manual' : 'Descripción' })].concat(paras(cat.desc), cat.base ? [h('p', { class: 'info-base', text: cat.base })] : [])));
    body.push(catSource(cat));
  } else if (!own) {
    body.push(h('p', { class: 'note', text: 'Este hechizo no está en el catálogo (lo inventasteis o viene de otro libro) y la ficha no trae descripción.' }));
  }
  if (s.nota) body.push(h('p', { class: 'info-nota' }, [h('i', { text: 'Notas: ' }), String(s.nota)]));
  if (s.maestria) body.push(h('p', { class: 'info-nota', text: 'Maestría ' + s.maestria + '.' }));
  const actions = [];
  let close = null;
  if (canWrite()) {
    const edit = h('button', { type: 'button', class: 'btn' + (own || cat ? ' ghost' : '') }, own ? 'Cambiar la descripción' : cat ? 'Añadir una descripción propia' : 'Escribir la descripción');
    edit.addEventListener('click', () => {
      edit.remove();
      const ta = h('textarea', { rows: '6', 'aria-label': 'Descripción del hechizo', placeholder: cat ? 'Si en vuestra saga funciona distinto, cuéntalo aquí. Se muestra encima de la del manual.' : 'Qué hace el hechizo, cómo se lanza, sus efectos…' });
      ta.value = own;
      const save = h('button', { type: 'button', class: 'btn' }, 'Guardar');
      save.addEventListener('click', async () => {
        save.disabled = true;
        const v = ta.value.trim();
        if (await saveSpellPatch(pjId, i, s, v ? { desc: v } : { desc: null }, v ? 'Descripción guardada' : 'Descripción borrada')) { close(); spellInfo(pjId, i); }
        else save.disabled = false;
      });
      const box = h('div', { class: 'info-edit' }, [field(own ? 'Tu descripción' : 'Descripción', ta), save]);
      const b = document.querySelector('.modal-card.info .modal-b');
      if (b) { b.appendChild(box); ta.focus(); }
    });
    actions.push(edit);
    if (!cat) {
      const cands = spellCands(s);
      if (cands.length) {
        const pick = h('details', { class: 'info-pick' }, [h('summary', { text: '¿Es un hechizo del manual?' }),
          h('p', { class: 'fh', text: 'Hechizos del catálogo con la misma Técnica y Forma; si es uno de ellos, enlázalo y la ficha mostrará su descripción.' }),
          h('ul', null, cands.map(x => h('li', null, h('button', { type: 'button', class: 'lnk', onclick: async () => {
            if (await saveSpellPatch(pjId, i, s, { cat: x.id }, 'Enlazado con «' + x.n + '»')) { close(); spellInfo(pjId, i); }
          } }, x.n + ' (' + lvlTxt(x.nivel) + ')'))))]);
        body.push(pick);
      }
    } else if (s.cat === cat.id || canUnlink(s, cat)) {
      actions.push(h('button', { type: 'button', class: 'lnk', onclick: async () => {
        if (await saveSpellPatch(pjId, i, s, { cat: '-' }, 'Ya no se muestra la descripción del manual')) { close(); spellInfo(pjId, i); }
      } }, 'No es este hechizo'));
    }
  }
  close = openModal(s.n || 'Hechizo', body, actions);
  const card = document.querySelector('.modal-card');
  if (card) card.classList.add('info');
}
const canUnlink = (s, cat) => !!cat;
function spellCands(s) {
  const t = artOf(s.tec), f = artOf(s.forma), lv = toNum(s.nivel);
  if (!t || !f) return [];
  return hechCat().list.filter(x => x.tec === t && x.forma === f)
    .sort((a, b) => Math.abs((toNum(a.nivel) || 0) - (lv || 0)) - Math.abs((toNum(b.nivel) || 0) - (lv || 0))).slice(0, 8);
}
/* one spell changes inside the character's list; the list is written back whole */
async function saveSpellPatch(pjId, i, s, patch, msg) {
  const pj = S.pj[pjId];
  if (!pj) return false;
  const list = (pj.hechizos || []).slice();
  const at = list[i] === s ? i : list.findIndex(x => x && x.n === s.n && x.tec === s.tec && x.forma === s.forma);
  if (at < 0) { toast('La ficha ha cambiado mientras tanto; vuelve a abrir el hechizo.'); return false; }
  const nx = Object.assign({}, list[at], patch);
  Object.keys(patch).forEach(k => { if (patch[k] == null) delete nx[k]; });
  list[at] = nx;
  const ok = await dbWrite(() => S.db.doc('personajes/' + pjId).update(stamp({ hechizos: list })), msg);
  if (ok) localPut('pj', pjId, Object.assign({}, pj, { hechizos: list }));
  return ok;
}

/* a Virtue or Flaw: the compendium's text, its book and the note on the sheet; g, the character's gender, for its name */
function vdInfo(x, clase, g) {
  if (!x) return;
  const e = vdEntry(x, clase);
  const body = [];
  const head = h('div', { class: 'info-head' }, [h('span', { class: 'info-lv', text: [clase === 'defecto' ? 'Defecto' : 'Virtud', String(x.valor || (e && e.valor) || '').toLowerCase()].filter(Boolean).join(' ') }),
    (x.cat || (e && e.cat)) ? h('span', { class: 'info-rdt', text: x.cat || e.cat }) : null]);
  body.push(head);
  if (e && e.desc) body.push(h('div', { class: 'info-cat' }, paras(e.desc)));
  else body.push(h('p', { class: 'note', text: 'No está en el compendio de virtudes y defectos.' }));
  if (x.nota) body.push(h('p', { class: 'info-nota' }, [h('i', { text: 'En la ficha: ' }), String(x.nota)]));
  if (e) {
    const src = [e.en && tkey(e.en) !== tkey(e.n) ? '«' + e.en + '»' : '', e.libro, e.pag].filter(Boolean).join(', ');
    if (src) body.push(h('p', { class: 'info-src', text: src + '.' }));
  }
  const close = openModal(vdLabel(x, g), body, [h('a', { class: 'btn ghost', href: '#virtudes-defectos--' + (clase === 'defecto' ? 'defectos' : 'virtudes'), onclick: () => { close(); }, text: 'Compendio' })]);
  const card = document.querySelector('.modal-card');
  if (card) card.classList.add('info');
}

export { hechCat, spellCat, spellInfo, vdInfo };
