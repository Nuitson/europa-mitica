/* Reglas de ArM5 para las fichas: formas, heridas y fatiga, totales de hechizos y experiencia. */
import { artOf, ARTS, DATA, h, load, R, store, toNum } from '../base.js';
import { page } from '../views.js';
import { CAT_OF, KEYP, S, SEASONS, tkey } from './state.js';
import { dbWrite, localPut, stamp } from './core.js';
import { ledger, shHead } from './characters.js';
import { AFIN_POR, magiaFx, vdEffects, vdLabel, vdNest } from '../creation/rules.js';
import { spellCat, vdInfo } from '../info.js';
import { castCar } from './homebrew.js';
import { route } from '../main.js';

/* ---------- small helpers */
const skey = (a, e) => Number(a) * 10 + Number(e);
const sname = (a, e) => (SEASONS[e - 1] || '?') + ' de ' + a;
const snext = (a, e) => e === 4 ? [a + 1, 1] : [a, e + 1];
const sprev = (a, e) => e === 1 ? [a - 1, 4] : [a, e - 1];
function curSeason() {
  const e = S.estado;
  if (e && Number(e.anio) && Number(e.est) >= 1 && Number(e.est) <= 4) return [Number(e.anio), Number(e.est)];
  return [DATA.saga.anio, DATA.saga.est];
}
function sagaAura() { const e = S.estado; return e && e.aura != null && isFinite(Number(e.aura)) ? Number(e.aura) : DATA.saga.aura; }
/* Realm Interaction Table (ArM5, ch. 12 «Realms»): AURA_X[aura realm][power realm] multiplies the aura level */
const AURA_TIPOS = [['magica', 'Mágica'], ['feerica', 'Feérica'], ['divina', 'Divina'], ['infernal', 'Infernal']];
const AURA_ADJ = { magica: 'mágica', feerica: 'feérica', divina: 'divina', infernal: 'infernal' };
const REALM_POW = { magica: 'Magia (hermética)', feerica: 'Feérico', divina: 'Divino', infernal: 'Infernal' };
const AURA_X = {
  magica: { magica: 1, feerica: 0.5, divina: 0, infernal: -1 },
  feerica: { magica: 0.5, feerica: 1, divina: 0, infernal: -1 },
  divina: { magica: -3, feerica: -4, divina: 1, infernal: -5 },
  infernal: { magica: -1, feerica: -2, divina: 0, infernal: 1 }
};
function realmMod(tipo, nivel, pow) { const x = (AURA_X[tipo] || AURA_X.magica)[pow || 'magica']; const v = x * numv(nivel); return v > 0 ? Math.ceil(v - 1e-9) : Math.round(v); }
/* one extra botch die per point of a foreign realm's aura; the Divine is not hampered by other auras */
function botchDice(tipo, nivel, pow) { pow = pow || 'magica'; return (tipo || 'magica') === pow || pow === 'divina' ? 0 : Math.max(0, numv(nivel)); }
const auraTxt = (tipo, nivel) => (AURA_ADJ[tipo] || 'mágica') + ' ' + numv(nivel);
/* where the troupe is now: the master's scene aura, or the covenant's (magic) */
function auraNow() {
  const e = S.estado && S.estado.escena;
  if (e && AURA_X[e.tipo] && isFinite(Number(e.nivel))) return { tipo: e.tipo, nivel: Number(e.nivel), lugar: String(e.lugar || ''), escena: true };
  return { tipo: 'magica', nivel: sagaAura(), lugar: '', escena: false };
}
/* the aura as a character's magic takes it: its realm (Magia Sagrada: Divine) and, with Verdadera Comprensión de los Reinos,
   an aura of another realm lowered by the Lore of that realm (creation/rules.js, magiaFx). a: {tipo, nivel}, the place's by default;
   without a sheet, Hermetic magic */
const LORE_RE = { magica: /magic/, feerica: /feeric|faerie|hada/, divina: /divin|dominio/, infernal: /infern/ };
const LORE_TXT = { magica: 'Conocimiento mágico', feerica: 'Conocimiento feérico', divina: 'Conocimiento divino', infernal: 'Conocimiento infernal' };
function loreLv(c, realm) {
  const x = ((c && c.hab) || []).find(a => { const k = tkey(a.n); return /^con(ocimiento)?-/.test(k) && LORE_RE[realm] && LORE_RE[realm].test(k); });
  return x ? abLvl(x.xp) + manaHab(c, x.n) : 0;
}
/* Magia Ctónica (Infernal) and Magia Feérica (Faerie): the magic is attuned to that realm's auras as well as Magic's */
const ownAura = (m, tipo) => tipo === m.reino || (m.afines || []).includes(tipo);
function magiaAura(pj, c, a) {
  a = a || auraNow();
  const m = pj ? magiaFx(pj) : { reino: 'magica', comprension: false, ctonica: false, afines: [], por: [] };
  const base = numv(a.nivel), own = ownAura(m, a.tipo);
  const lore = m.comprension && !own && c ? Math.min(base, loreLv(c, a.tipo)) : 0;
  const nivel = Math.max(0, base - lore);
  const pow = own ? a.tipo : m.reino;
  return { tipo: a.tipo, base: base, nivel: nivel, lore: lore, reino: m.reino, afin: own && a.tipo !== m.reino ? AFIN_POR[a.tipo] || '' : '', por: m.por, lugar: a.lugar || '', escena: !!a.escena,
    mod: realmMod(a.tipo, nivel, pow), botch: botchDice(a.tipo, nivel, pow) };
}
/* a supernatural Ability's aura for this sheet: Magia Ctónica's own Ability is attuned like the magic */
function habAura(pj, tipo, nivel, r) {
  const m = magiaFx(pj);
  return r === 'infernal' && m.ctonica && ownAura(m, tipo) ? realmMod(tipo, nivel, tipo) : realmMod(tipo, nivel, r);
}
/* Magia Ctónica: a sinful act during the casting adds the lowest of the two Arts once more (shared switch, kept in this browser) */
const impioOn = () => load(KEYP + 'impio') === '1';
function impioBonus(pj, c, t, f) {
  if (!impioOn() || !magiaFx(pj).ctonica || !t || !f) return 0;
  return Math.min(artLvl(c.arts[t]) + manaArt(c, t), artLvl(c.arts[f]) + manaArt(c, f));
}
function impioToggle(pj, onChange) {
  if (!magiaFx(pj).ctonica) return null;
  const box = h('input', { type: 'checkbox', class: 'impio-in', checked: impioOn() ? true : null });
  box.addEventListener('change', () => { store(KEYP + 'impio', box.checked ? '1' : null); onChange(); });
  return h('label', { class: 'chk cer' }, [box, h('span', { text: 'Acto impío' }),
    h('small', { class: 'fh', text: 'Magia Ctónica: un acto deliberadamente malvado al lanzar suma otra vez el Arte más bajo (la Técnica o la Forma)' })]);
}
function castAura(pj, c) { return magiaAura(pj, c).mod; }
function magiaAuraTxt(r) {
  return 'aura ' + auraTxt(r.tipo, r.base) + (r.lore ? ' − ' + r.lore + ' de ' + LORE_TXT[r.tipo] : '')
    + (r.afin ? ', propia por ' + r.afin : r.reino !== 'magica' ? ', para magia ' + AURA_ADJ[r.reino] : '') + ': ' + sgn(r.mod);
}
function castAuraTxt(pj, c) { const r = magiaAura(pj, c); return (r.escena && r.lugar ? r.lugar + ', ' : '') + magiaAuraTxt(r); }
/* ---------- other shapes (Cambiapieles): «Transformarse en …» swaps size, physical Characteristics, natural weapons and
   the animal's Virtues and Flaws for the animal's; the mind, Abilities and the rest of the sheet stay the character's own */
function formasOf(pj) { return Array.isArray(pj && pj.formas) ? pj.formas.filter(f => f && f.id && f.n) : []; }
function formaActiva(pj) { const id = pj && pj.formaActiva; return id ? formasOf(pj).find(f => f.id === id) || null : null; }
function pjCar(pj, f) { const car = Object.assign({}, (pj && pj.car) || {}); if (f && f.car) Object.keys(f.car).forEach(k => { car[k] = numv(f.car[k]); }); return car; }
async function setForma(id, fid) {
  const pj = S.pj[id];
  if (!pj) return false;
  const f = fid ? formasOf(pj).find(x => x.id === fid) : null;
  const who = String(pj.nombre || '').split(/\s+/)[0];
  const ok = await dbWrite(() => S.db.doc('personajes/' + id).update(stamp({ formaActiva: f ? f.id : null })), f ? who + ' se transforma en ' + f.n.toLowerCase() : who + ' vuelve a su forma humana');
  if (ok) localPut('pj', id, Object.assign({}, pj, { formaActiva: f ? f.id : null }));
  return ok;
}
/* ---------- wounds and fatigue, marked on the sheet during play (ArM5, Combat and Injury): the penalties of all wounds
   add up, the current fatigue level's penalty adds to them, and the sum applies to every roll and total except Soak and
   recovery. The wound ranges are 5 + Size points wide; a form can bring its own fatigue track. Stored on the character
   as heridas {ligera, media, grave, incapacitado, muerto} and fatiga (levels lost). */
const HER = [['ligera', 'Ligera', -1], ['media', 'Media', -3], ['grave', 'Grave', -5], ['incapacitado', 'Incapacitado', null], ['muerto', 'Muerto', null]];
const FAT_N = { '0': 'Sin aliento', '-1': 'Cansado', '-3': 'Fatigado', '-5': 'Aturdido' };
function fatTrack(pj) {
  let pens = [0, -1, -3, -5];
  const fa = formaActiva(pj);
  if (fa && fa.cansancio) {
    // «Descansado, 0/0, −1/−1, −3, −5, inconsciente»: the levels between the first and the last
    const mid = String(fa.cansancio).split(',').map(x => x.trim()).filter(Boolean).slice(1, -1);
    const p2 = [].concat(...mid.map(x => x.split('/').map(y => Number(y.replace(/[−–]/g, '-').trim()))));
    if (p2.length && p2.every(n => isFinite(n))) pens = p2;
  }
  return [{ n: 'Descansado', p: 0 }].concat(pens.map(p => ({ n: FAT_N[String(p)] || 'Cansancio ' + sgn(p), p: p }))).concat([{ n: 'Inconsciente', p: null }]);
}
function estadoFisico(pj) {
  const hw = pj && pj.heridas && typeof pj.heridas === 'object' ? pj.heridas : {};
  const n = k => Math.max(0, Math.round(numv(hw[k])));
  const her = HER.reduce((t, x) => t + (x[2] ? x[2] * n(x[0]) : 0), 0);
  const tr = fatTrack(pj);
  const fl = Math.min(tr.length - 1, Math.max(0, Math.round(numv(pj && pj.fatiga))));
  const fat = tr[fl].p || 0;
  const fuera = n('muerto') ? 'Muerto' : n('incapacitado') ? 'Incapacitado: no puede actuar' : tr[fl].p === null ? 'Inconsciente' : '';
  return { her: her, fat: fat, total: her + fat, fl: fl, tr: tr, n: n, fuera: fuera };
}
const malusOf = pj => estadoFisico(pj).total;
function estadoTxt(pj) {
  const e = estadoFisico(pj);
  const w = HER.filter(x => e.n(x[0])).map(x => e.n(x[0]) + ' ' + x[1].toLowerCase());
  const parts = [];
  if (w.length) parts.push('heridas: ' + w.join(', ') + (e.her ? ' (' + sgn(e.her) + ')' : ''));
  if (e.fl) parts.push('fatiga: ' + e.tr[e.fl].n.toLowerCase() + (e.fat ? ' (' + sgn(e.fat) + ')' : ''));
  if (!parts.length) return '';
  return (e.fuera ? e.fuera + '. ' : e.total ? 'Malus ' + sgn(e.total) + ' — ' : '') + parts.join('; ');
}
// marks are saved half a second after the last change, as one write per character
const HURT = {};
function saveHurt(id, patch) {
  const pj = S.pj[id];
  if (!pj || !canWrite()) return;
  localPut('pj', id, Object.assign({}, pj, patch));
  const q = HURT[id] = HURT[id] || { patch: {}, t: null };
  Object.assign(q.patch, patch);
  clearTimeout(q.t);
  q.t = setTimeout(() => { const send = q.patch; q.patch = {}; dbWrite(() => S.db.doc('personajes/' + id).update(stamp(send)), null); }, 500);
}
function formaButtons(id, pj) {
  if (!canWrite()) return [];
  const act = formaActiva(pj);
  return formasOf(pj).filter(f => !act || act.id === f.id).map(f => h('button', { type: 'button', class: 'btn ghost forma-btn', 'data-forma': f.id,
    onclick: async e => { const b = e.currentTarget; b.disabled = true; if (!(await setForma(id, act ? null : f.id))) b.disabled = false; } }, act ? 'Volver a forma humana' : 'Transformarse en ' + f.n.toLowerCase()));
}
// g: the character's gender, for the names («Compasiva»); depth(x): how deep it goes under the one that grants it
function vdCards(list, clase, g, depth) {
  const L = (Array.isArray(list) ? list : []).filter(x => x && String(x.n || '').trim());
  return h('ul', { class: 'm-vd' }, L.map(x => h('li', depth && depth(x) ? { class: 'sub', style: '--depth:' + Math.min(depth(x), 3) } : null, [
    h('div', { class: 'm-vd-h' }, [clase ? h('button', { type: 'button', class: 'info-btn', onclick: () => vdInfo(x, typeof clase === 'function' ? clase(x) : clase, g) }, h('b', { text: vdLabel(x, g) })) : h('b', { text: vdLabel(x, g) }), h('span', { class: 'xt', text: [x.cat, x.valor].filter(Boolean).join(' · ') })]),
    x.nota ? h('div', { class: 'm-vd-n', text: x.nota }) : null])));
}
/* one column of a character's virtues or flaws (col: 'virtud' or 'defecto') as cards, each with what it grants under it */
function vdTreeCards(pj, col) {
  const T = vdNest(pj)[col], m = new Map(T.map(t => [t.x, t]));
  return vdCards(T.map(t => t.x), x => m.get(x).clase, pj.genero, x => m.get(x).depth);
}
function formaBlock(pj, c, f) {
  const car = pjCar(pj, f), ab = f.hab || 'Pelea';
  const hb = c.hab.find(x => tkey(x.n) === tkey(ab));
  const lv = (hb ? abLvl(hb.xp) : 0) + manaHab(c, ab);
  const Q = numv(car['Rapidez']), D = numv(car['Destreza']), F = numv(car['Fuerza']), V = numv(car['Vitalidad']);
  const abs = (Array.isArray(f.absorcion) ? f.absorcion : []).filter(x => Array.isArray(x));
  const soak = V + abs.reduce((s, x) => s + numv(x[1]), 0);
  const tam = numv(f.tam), r = 5 + tam;
  const sec = h('section', { class: 'sh-sec forma', 'aria-labelledby': 'sh-forma' }, [shHead('sh-forma', 'Forma de ' + f.n.toLowerCase())]);
  sec.appendChild(ledger('forma-st', [
    { l: 'Tamaño', n: 'humano ' + sgn(numv(pj.tam)) + '; las heridas se cuentan con este tamaño', v: sgn(tam) },
    { l: 'Absorción', n: ['Vitalidad ' + sgn(V)].concat(abs.map(x => x[0] + ' ' + sgn(numv(x[1])))).join(', '), v: sgn(soak) },
    { l: ab, n: 'su habilidad de combate', v: String(lv) }]));
  const m = malusOf(pj);
  sec.appendChild(R.grid({ _k: 'forma-' + f.id, head: ['Arma natural', 'Inic.', 'Atq.', 'Def.', 'Daño'], fcl: true,
    body: (f.armas || []).map(a => [a.n, sgn(Q + numv(a.ini) + m), sgn(D + lv + numv(a.atq) + m), sgn(Q + lv + numv(a.def) + m), a.dano == null ? '—' : sgn(F + numv(a.dano))]) }));
  const notas = (f.armas || []).filter(a => a.nota).map(a => a.n + ': ' + String(a.nota).toLowerCase() + '.');
  sec.appendChild(h('p', { class: 'sh-aside', text: notas.concat(['Iniciativa: Rapidez + arma. Ataque: Destreza + ' + ab + ' + arma. Defensa: Rapidez + ' + ab + ' + arma. Daño: Fuerza + arma.' + (m ? ' Iniciativa, ataque y defensa llevan ya el malus por heridas y fatiga (' + sgn(m) + ').' : '') + ' Sin dado ni otras virtudes. La ropa y el equipo no se transforman.']).join(' ') }));
  if ((f.cualidades || []).length) sec.appendChild(h('p', { class: 'forma-line' }, [h('i', { text: 'Cualidades: ' }), f.cualidades.join(', ') + '.']));
  const vd = (f.virtudes || []).concat(f.defectos || []).filter(x => x && String(x.n || '').trim());
  if (vd.length) {
    sec.appendChild(h('h4', { class: 'sh-rub', text: 'Virtudes y defectos del ' + f.n.toLowerCase() }));
    sec.appendChild(ledger('sh-vd', vd.map(x => ({ l: vdLabel(x, pj.genero), n: x.nota || '', s: [(f.defectos || []).includes(x) ? 'defecto' : 'virtud', String(x.valor || '').toLowerCase()].filter(Boolean).join(' ') }))));
  }
  if (f.fuente) sec.appendChild(h('p', { class: 'sh-aside', text: 'Fuente: ' + f.fuente }));
  return sec;
}
/* a formulaic spell's casting total: Technique + Form (with Puissant Arts) + Stamina (of the shape the character is in) + aura modifier + mastery;
   with the homebrew rule «lanzamiento-atributos», the Technique's own Characteristic instead of Stamina */
function spellTotal(pj, c, s, aura, cer) {
  const t = artOf(s.tec), f = artOf(s.forma);
  if (!t || !f) return null;
  const ac = isRitual(s) || (cer && canCeremony(c)) ? academic(c).sum : 0;
  return artLvl(c.arts[t]) + manaArt(c, t) + artLvl(c.arts[f]) + manaArt(c, f) + numv(pjCar(pj, formaActiva(pj))[castCar(t)]) + aura + Math.max(0, Math.round(numv(s.maestria))) + ac + malusOf(pj) + impioBonus(pj, c, t, f);
}
/* Ceremonial casting and Ritual spells (ArM5, Hermetic Magic): + Artes Liberales + Filosofía, fifteen minutes per magnitude.
   Ceremony needs some experience in at least one of the two; a Ritual always adds them. */
// ritual if the sheet says so, or the catalogue entry it is linked to does (as its description popup shows)
function isRitual(s) { return !!s && (s.ritual === true || /\britual\b/i.test(String(s.nota || '')) || !!(spellCat(s) || {}).rit); }
/* age in the current year from the birth year; '' when it is not a plain year («c. 1190») */
function edadTxt(ca, nac) { const n = parseInt(nac, 10); return n ? (ca - n) + ' años' : ''; }
function academic(c) {
  const one = n => { const x = (c.hab || []).find(a => tkey(a.n) === tkey(n)); return { lv: x ? abLvl(x.xp) + manaHab(c, n) : 0, xp: x ? x.xp : 0 }; };
  const al = one('Artes Liberales'), fi = one('Filosofía');
  return { al: al.lv, fi: fi.lv, sum: al.lv + fi.lv, xp: al.xp + fi.xp };
}
const canCeremony = c => academic(c).xp > 0;
const magnitude = s => Math.max(1, Math.ceil(toNum(s.nivel) / 5) || 1);
function ceremonyTime(s) { const m = 15 * magnitude(s); return m < 60 ? m + ' min' : (m % 60 ? (m / 60).toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + ' h' : m / 60 + ' h'); }
function ceremonialOn() { return load(KEYP + 'ceremonial') === '1'; }
/* checkbox shared by the character's Hechizos tab and the master screen */
function refocusCer() { route(true); const b = page.querySelector('.cer-in'); if (b) b.focus({ preventScroll: true }); }
function ceremonyToggle(c, onChange) {
  const a = academic(c), ok = a.xp > 0;
  const box = h('input', { type: 'checkbox', class: 'cer-in', checked: ok && ceremonialOn() ? true : null, disabled: ok ? null : true });
  box.addEventListener('change', () => { store(KEYP + 'ceremonial', box.checked ? '1' : null); onChange(); });
  return h('label', { class: 'chk cer' }, [box, h('span', { text: 'Lanzamiento ceremonial' }),
    h('small', { class: 'fh', text: ok ? sgn(a.sum) + ' (Artes Liberales ' + a.al + ', Filosofía ' + a.fi + ') · 15 min por magnitud' : 'Sin Artes Liberales ni Filosofía: no puede lanzar ceremonialmente' })]);
}
function numv(v) { const n = typeof v === 'number' ? v : toNum(v); return isFinite(n) ? n : 0; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function canWrite() { return !!S.db && S.canWrite !== false; }
function slugify(s) { return tkey(s).slice(0, 40); }
function newId(prefix) { return (slugify(prefix) || 'pj') + '-' + Math.random().toString(36).slice(2, 7); }
// a malformed % sequence in the address (#100%) must not stop the page: keep the hash as it is
function currentRaw() { const r = location.hash.replace(/^#/, ''); try { return decodeURIComponent(r); } catch (e) { return r; } }

/* ---------- experience (ArM5): an Art at level L costs L(L+1)/2 px; an Ability or Warping 5·L(L+1)/2 */
const artCost = l => l * (l + 1) / 2;
const abCost = l => 5 * l * (l + 1) / 2;
function artLvl(xp) { let l = 0; while (artCost(l + 1) <= xp + 1e-9) l++; return l; }
function abLvl(xp) { let l = 0; while (abCost(l + 1) <= xp + 1e-9) l++; return l; }
function entriesOf(id) {
  return Object.keys(S.av).map(k => Object.assign({ _id: k }, S.av[k])).filter(e => e.pj === id)
    .sort((x, y) => skey(x.anio, x.est) - skey(y.anio, y.est));
}
function guessCat(name) { return CAT_OF[tkey(name)] || 'Otras'; }
/* starting xp + every season's allocation → totals per Art, Ability and Warping */
/* Affinity (ArM5): creation xp in that Ability or Art rises by half, rounded up; season entries store it already applied */
const afXp = (b, on) => on ? Math.ceil(b * 1.5) : b;
function calc(pj, entries, skip) {
  const fx = vdEffects(pj);
  const arts = {};
  ARTS.forEach(a => { arts[a] = afXp(numv(pj.artes && pj.artes[a]), fx.af.art.has(a)); });
  const hab = new Map();
  (pj.hab || []).forEach(x => {
    if (!x || !x.n) return;
    const k = tkey(x.n), on = fx.af.hab.has(k), b = afXp(numv(x.base), on);
    hab.set(k, { n: String(x.n).trim(), esp: x.esp || '', cat: x.cat || guessCat(x.n), base: b, paid: numv(x.base), xp: b, af: on });
  });
  let inf = numv(pj.informidad), total = 0;
  entries.forEach(e => {
    if (skip && e._id === skip) return;
    (e.reparto || []).forEach(r => {
      const px = numv(r.px);
      if (!r.r || !px) return;
      total += px;
      const art = artOf(r.r);
      if (art) { arts[art] += px; return; }
      const k = tkey(r.r);
      if (k === 'informidad') { inf += px; return; }
      if (!hab.has(k)) hab.set(k, { n: String(r.r).trim(), esp: '', cat: guessCat(r.r), base: 0, paid: 0, xp: 0, implicit: true, af: fx.af.hab.has(k) });
      hab.get(k).xp += px;
    });
  });
  return { arts, hab: [...hab.values()], inf, total, fx };
}
/* Puissant (Maña): +2 to an Ability, +3 to an Art, whenever it is used */
const manaHab = (c, n) => (c.fx && c.fx.mana.hab[tkey(n)]) || 0;
const manaArt = (c, a) => (c.fx && c.fx.mana.art[a]) || 0;
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
/* an Ability's score with its Puissant bonus (0 when the character lacks it) */
function habLevel(c, name) { const hb = c.hab.find(x => tkey(x.n) === tkey(name)); return (hb ? abLvl(hb.xp) : 0) + manaHab(c, name); }
/* Lab Total (ArM5 p. 102): Technique + Form (with their Puissant Art) + Intelligence + Magic Theory + the covenant's aura.
   From another magus' lab text, Adept Laboratory Student adds 6 and Weak Scholar takes 6; inventing without a text,
   Creative Block takes 3 (ArM5 p. 73, 52 and 61). mod: what the player adds (lab, familiar, specialty, similar spells…).
   Returns { total, parts: [[label, value]] } */
const LAB_VD = { aplicado: ['adept-laboratory-student', 'estudiante-aplicado'], malEst: ['weak-scholar', 'mal-estudiante'], bloqueo: ['creative-block', 'bloqueo-creativo'] };
const hasVd = (pj, keys) => (pj.virtudes || []).concat(pj.defectos || []).some(x => x && (keys.includes(tkey(x.en)) || keys.includes(tkey(x.n))));
/* the magus' laboratory (laboratorios/{id} with «dueno» = his id; saga/laboratory.js keeps its calculation in «calc») */
function labDe(pjId) {
  if (!pjId) return null;
  const L = Object.keys(S.lab || {}).filter(k => S.lab[k] && S.lab[k].dueno === pjId).map(k => Object.assign({ _id: k }, S.lab[k]));
  return L.sort((a, b) => numv(b.actualizado) - numv(a.actualizado))[0] || null;
}
/* what the laboratory adds to a Lab Total (Covenants p. 149–152): its General Quality, always; the Specialization of the Technique
   and of the Form; and those of the activities done (act: ['Hechizos', 'Textos']…). [[label, value]] */
function labBonos(lab, tec, forma, act) {
  const c = lab && lab.calc;
  if (!c) return [];
  const out = [], esp = c.esp || {};
  const q = numv(c.car && c.car['Calidad General']);
  if (q) out.push(['Calidad General del laboratorio', q]);
  [...new Set([artOf(tec), artOf(forma)])].forEach(a => { if (a && numv(esp[a])) out.push(['laboratorio en ' + a, numv(esp[a])]); });
  (act || []).forEach(x => { if (numv(esp[x])) out.push(['laboratorio en ' + x, numv(esp[x])]); });
  return out;
}
function labTotal(pj, c, tec, forma, o) {
  o = o || {};
  const parts = [];
  const add = (l, v) => { if (v) parts.push([l, v]); };
  [artOf(tec), artOf(forma)].forEach(a => { if (a) add(a, artLvl(c.arts[a]) + manaArt(c, a)); });
  add('Inteligencia', numv(pjCar(pj).Inteligencia));
  add('Teoría Mágica', habLevel(c, 'Teoría Mágica'));
  add('aura', sagaAura());
  if (o.pjId) labBonos(labDe(o.pjId), tec, forma, o.act).forEach(([l, v]) => add(l, v));
  if (o.ajeno && hasVd(pj, LAB_VD.aplicado)) add('Estudiante Aplicado', 6);
  if (o.ajeno && hasVd(pj, LAB_VD.malEst)) add('Mal estudiante', -6);
  if (o.inventar && hasVd(pj, LAB_VD.bloqueo)) add('Bloqueo Creativo', -3);
  add('otros bonos', numv(o.mod));
  return { total: parts.reduce((s, x) => s + x[1], 0), parts: parts };
}
const labTxt = L => L.parts.map(([l, v], i) => (i ? (v < 0 ? ' − ' : ' + ') : v < 0 ? '−' : '') + l + ' ' + Math.abs(v)).join('') + ' = ' + L.total;
function traitLevel(c, name) {
  const art = artOf(name);
  if (art) return { lv: artLvl(c.arts[art]), xp: c.arts[art], art: true };
  const k = tkey(name);
  if (k === 'informidad') return { lv: abLvl(c.inf), xp: c.inf };
  const hb = c.hab.find(x => tkey(x.n) === k);
  return hb ? { lv: abLvl(hb.xp), xp: hb.xp } : { lv: 0, xp: 0, nuevo: true };
}

export { habLevel, labBonos, labDe, labTotal, labTxt, habAura, impioBonus, impioOn, impioToggle, magiaAura, magiaAuraTxt, edadTxt, abCost, abLvl, academic, afXp, artCost, artLvl, AURA_TIPOS, AURA_X, auraNow, auraTxt, botchDice, calc, canCeremony, canWrite, castAura, castAuraTxt, ceremonialOn, ceremonyTime, ceremonyToggle, clone, currentRaw, curSeason, entriesOf, estadoFisico, estadoTxt, formaActiva, formaBlock, formaButtons, formasOf, guessCat, HER, isRitual, malusOf, manaArt, manaHab, newId, numv, pjCar, REALM_POW, realmMod, refocusCer, sagaAura, saveHurt, sgn, skey, sname, snext, spellTotal, sprev, traitLevel, vdCards, vdTreeCards };
