/* Creación de personajes: el compendio de virtudes y defectos y las reglas de creación. */
import { artOf, ARTS, ARTS_F, ARTS_T, DATA, DOCS, esc, norm } from '../base.js';
import { ABIL_STD, CASAS, CAT_OF, CHARS, KEYP, S, tkey, VD_CATS } from '../saga/state.js';
import { abCost, abLvl, afXp, artLvl, curSeason, guessCat, numv, sgn } from '../saga/rules.js';
import { GEN_F } from './generos.js';

/* ---------- the character's grammatical gender (pj.genero: 'm', 'f' or 'n'; none means the compendium's masculine).
   The neutral form is inclusive Spanish in -e, taken from the feminine word by word: -a → -e, -ca → -que, -ga → -gue */
const GENERO = [['m', 'Masculino'], ['f', 'Femenino'], ['n', 'Neutro']];
const GENERO_TXT = { m: 'masculino', f: 'femenino', n: 'neutro' };
function neutroDe(m, f) {
  const mw = m.split(' '), fw = f.split(' ');
  if (mw.length !== fw.length) return f;
  return fw.map((w, i) => w === mw[i] ? w : w.replace(/ca(s?)$/, 'que$1').replace(/ga(s?)$/, 'gue$1').replace(/a(s?)$/, 'e$1')).join(' ');
}
// tkey of every form → {m, f, n}: the masculine of the compendium, the feminine and the neutral
const GEN = new Map();
Object.keys(GEN_F).forEach(m => {
  const v = GEN_F[m], f = Array.isArray(v) ? v[0] : v, n = Array.isArray(v) ? v[1] : neutroDe(m, f);
  const e = { m: m, f: f, n: n };
  [m, f, n].forEach(w => { if (!GEN.has(tkey(w))) GEN.set(tkey(w), e); });
});
/* a virtue's or flaw's name in the character's gender, whichever form it was written in («Compasiva» → «Compasive» for
   neutral); without a gender, the name as it is written */
function vdGen(name, g) {
  const s = String(name || '');
  const e = g && GEN.get(tkey(s));
  if (!e) return s;
  return g === 'f' ? e.f : g === 'n' ? e.n : e.m;
}

/* ================================================================== CREACIÓN DE PERSONAJES
   Rules of ArM5 character creation, checked live in the editor. Sources: ArM5 core, chapters 3 and 4 (Project Redcap's open
   text); Apprentices, chapter 2, for characters still in apprenticeship; the saga's own Excel template
   for the childhood packages. Virtues and flaws are picked from the compendium in drop-downs; the ones
   whose rule the page knows (Puissant, Affinity, Great/Poor Characteristic, and the statuses and virtues
   that grant experience or open restricted Abilities) change the sheet and the budget directly. */
const CLASE = { Magus: 'mago', Aprendiz: 'aprendiz', 'Compañero': 'companero', Grog: 'grog', Otro: 'otro' };
const CLASE_TXT = { mago: 'un mago', aprendiz: 'un aprendiz', companero: 'un compañero', grog: 'un grog', otro: 'este personaje' };
const CHAR_COST = { '-3': -6, '-2': -3, '-1': -1, '0': 0, '1': 1, '2': 3, '3': 6 };
const DRAFT_KEY = KEYP + 'pj-nuevo';
const vdPts = v => v === 'Mayor' ? 3 : v === 'Menor' ? 1 : 0;
const isMagic = cls => cls === 'mago' || cls === 'aprendiz';
const PRESETS = () => (DATA.creacion && DATA.creacion.infancias) || [];
/* virtues and flaws whose rules the page applies, by their original (English) name, or the Spanish one when the compendium has none */
const FX = {
  'the-gift': 'don', 'el-don': 'don', 'hermetic-magus': 'magus', 'improved-characteristics': 'carMas', 'weak-characteristics': 'carMenos',
  'great-characteristic': 'carGrande', 'poor-characteristic': 'carPobre', 'wealthy': 'rico', 'poor': 'pobre', 'privileged-upbringing': 'crianza',
  'warrior': 'guerrero', 'educated': 'instruido', 'educated-islamic': 'instruido', 'educated-hebrew': 'instruido',
  'skilled-parens': 'maestro', 'weak-parens': 'malMaestro', 'arcane-lore': 'arcano', 'well-traveled': 'trotamundos', 'mastered-spells': 'dominados',
  'magister-in-artibus': 'magister', 'redcap': 'redcap', 'feral-upbringing': 'feral', 'custos': 'custos',
  'affinity-with-ability': 'afHab', 'affinity-with-art': 'afArte', 'puissant-ability': 'manaHab', 'puissant-art': 'manaArte'
};
/* the ones that apply to something the player chooses: an Ability, an Art or a Characteristic */
const FX_OBJ = { afHab: 'hab', manaHab: 'hab', afArte: 'art', manaArte: 'art', carGrande: 'car', carPobre: 'car' };
const FX_GENERIC = { afHab: 'Affinity with Ability', afArte: 'Affinity with Art', manaHab: 'Puissant (Ability)', manaArte: 'Puissant Art' };
/* the brackets of a name that the player fills in: «(Reino) estigmático», «Vulnerable a (Forma)», «Inofensivo para
   (Seres)»… A list for the ones the page knows (realm, Form, Technique, Ability, Characteristic, House), a typed word
   for the rest. Brackets that name a fixed variant («(Tribunal del Rin)», «(Zmey)», «(Islámico)») are not choices. */
const REINOS = [['Magia', 'Magia'], ['Feérico', 'Feérico'], ['Dominio', 'Dominio (divino)'], ['Infernal', 'Infernal']];
const SLOT_KIND = { reino: 'reino', forma: 'forma', tecnica: 'tec', habilidad: 'hab', arte: 'art', caracteristica: 'car', casa: 'casa',
  tipo: 'txt', seres: 'txt', ser: 'txt', 'ser-magico': 'txt', terreno: 'txt', 'tipo-de-terreno': 'txt', 'de-un-terreno': 'txt', pnj: 'txt', pj: 'txt',
  'signo-planeta': 'txt', 'signo-o-planeta': 'txt', pecado: 'txt', gremio: 'txt', facultad: 'txt', mercancia: 'txt', enemigo: 'txt', rol: 'txt', 'tipo-habilidad': 'txt' };
const SLOT_TXT = { reino: 'el reino', forma: 'la Forma', tec: 'la Técnica', hab: 'la habilidad', art: 'el Arte', car: 'la característica', casa: 'la casa' };
/* what the page does with each one (shown under the row) */
const FX_TXT = {
  don: 'Obligatoria y gratuita para magos y aprendices.',
  afHab: 'La página multiplica por 1,5 los px de la habilidad elegida (al crearlo y en cada estación) y le deja pasar 2 del límite por edad.',
  afArte: 'La página multiplica por 1,5 los px del Arte elegido, al crearlo y en cada estación.',
  manaHab: 'Suma +2 a la habilidad elegida en la ficha.',
  manaArte: 'Suma +3 al Arte elegido en la ficha y en los totales de lanzamiento y laboratorio.',
  carGrande: 'Sube un punto la característica elegida, que ya debe estar en +3.',
  carPobre: 'Baja un punto la característica elegida, que ya debe estar en −3.',
  carMas: 'Da 3 puntos más para características.', carMenos: 'Quita 3 puntos de características.',
  rico: 'Vida posterior a 20 px por año en vez de 15.', pobre: 'Vida posterior a 10 px por año en vez de 15.',
  crianza: 'Suma 50 px (habilidades generales, académicas o marciales) y permite las académicas y marciales.',
  guerrero: 'Suma 50 px para habilidades marciales y las permite.', instruido: 'Suma 50 px para Latín y Artes Liberales y permite las académicas.',
  arcano: 'Suma 50 px para habilidades arcanas y las permite.', trotamundos: 'Suma 50 px al presupuesto.',
  dominados: 'Da 50 px para la maestría de hechizos.', magister: 'Suma 240 px (8 años × 30) para habilidades académicas o Enseñanza.',
  redcap: 'Sus 15 años de formación dan 20 px por año en vez de 15 (300 en total) y permite académicas, arcanas y marciales.',
  maestro: 'El aprendizaje da 60 px y 30 niveles de hechizo más.', malMaestro: 'El aprendizaje da 60 px y 30 niveles de hechizo menos.',
  feral: 'Sin lengua materna: la infancia da sus 120 px a otras habilidades.', custos: 'Permite un grupo de habilidades restringidas, a elegir.'
};
/* restricted Abilities at creation (ArM5 p. 31): magi always; anyone else needs one of these virtues or flaws */
const G_RESTR = ['Marciales', 'Académicas', 'Arcanas'];
const ACCESS = {
  'knight': ['Marciales'], 'mercenary-captain': ['Marciales'], 'branded-criminal': ['Marciales'], 'outlaw': ['Marciales'], 'outlaw-leader': ['Marciales'],
  'brother-knight': ['Marciales'], 'warrior': ['Marciales'],
  'mendicant-friar': ['Académicas'], 'priest': ['Académicas'], 'clerk': ['Académicas'], 'magister-in-artibus': ['Académicas'], 'magister-in-medicina': ['Académicas'],
  'educated': ['Académicas'], 'educated-islamic': ['Académicas'], 'educated-hebrew': ['Académicas'],
  'wise-one': ['Académicas', 'Arcanas'], 'arcane-lore': ['Arcanas'], 'privileged-upbringing': ['Académicas', 'Marciales'],
  'failed-apprentice': G_RESTR, 'redcap': G_RESTR
};
const G_TXT = { Marciales: 'marciales', 'Académicas': 'académicas', Arcanas: 'arcanas' };
const G_HOW = { Marciales: 'Guerrero, Caballero, Capitán mercenario o Infancia Privilegiada', 'Académicas': 'Instruido, Letrado, Sacerdote, Magister in Artibus o Infancia Privilegiada', Arcanas: 'Conocimiento arcano, Sabio, Aprendiz Fracasado o Boina Roja' };

/* ---------- the compendium as an index */
// the saga's own virtues and flaws (virtudes/{id}, in S.vd) join the shared compendium as one more book, «Propias de la
// saga»; they live in this saga alone. Each snapshot of them is a new object, so the index is built again when they change
const PROPIAS = 'Propias de la saga';
let VD_IDX = null;
const vdReset = () => { VD_IDX = null; }; // an administrator edited the compendium: the index is built again on the next use
function vdIndex() {
  const own = S.vd || {};
  if (VD_IDX && VD_IDX.own === own) return VD_IDX;
  VD_IDX = { own: own, list: [], byKey: new Map(), core: [], canon: new Map(), cats: { virtud: [], defecto: [] } };
  Object.keys(VD_OPTS).forEach(k => { delete VD_OPTS[k]; }); // the options point at places in the list
  function add(e) {
    if (!String(e.n || '').trim()) return;
    e.i = VD_IDX.list.length;
    const ge = GEN.get(tkey(e.n));
    e.key = norm([e.n, e.en, e.cat, e.desc, e.resumen].concat(ge ? [ge.f, ge.n] : []).join(' ')); // «compasiva» finds «Compasivo»
    e.core = e.libro === 'Core Rulebook';
    // one option per virtue: the same rule from several books (or two Spanish names of it) shows once, from the core book if it is there;
    // the saga's own are always apart
    e.dk = e.propia ? 'propia|' + e.propia : e.clase + '|' + tkey(e.en || e.n) + '|' + e.valor + '|' + tkey(e.cat);
    VD_IDX.list.push(e);
    if (e.core) VD_IDX.core.push(e);
    const c = VD_IDX.canon.get(e.dk);
    if (!c || (e.core && !c.core)) VD_IDX.canon.set(e.dk, e);
    if (e.cat && !VD_IDX.cats[e.clase].includes(e.cat)) VD_IDX.cats[e.clase].push(e.cat);
    [tkey(e.n), e.en ? 'en:' + tkey(e.en) : null].forEach(k => {
      if (!k) return;
      const kk = k + '|' + e.clase;
      if (!VD_IDX.byKey.has(kk)) VD_IDX.byKey.set(kk, []);
      VD_IDX.byKey.get(kk).push(e);
    });
  }
  const doc = DOCS['virtudes-defectos'];
  if (doc) doc.sheets.slice(0, 2).forEach((s, si) => s.blocks.forEach(b => {
    if (b.t !== 'table') return;
    b.rows.forEach(r => add({ clase: si === 0 ? 'virtud' : 'defecto', n: r[0], en: r[1] || '', cat: r[2] || '', valor: r[3] || '', libro: r[4] || '', pag: r[5] || '', resumen: r[6] || '', desc: r[7] || r[6] || '' })); // r[6] = Resumen, r[7] = Descripción (el texto del libro, si lo hay)
  }));
  Object.keys(own).sort().forEach(id => {
    const x = own[id];
    if (!x || (x.clase !== 'virtud' && x.clase !== 'defecto')) return;
    add({ clase: x.clase, n: String(x.n || '').trim(), en: '', cat: String(x.cat || ''), valor: String(x.valor || ''), libro: PROPIAS, pag: '', desc: String(x.desc || ''), propia: id, autor: x.autor || null });
  });
  // the feminine and neutral forms find the same entries as the masculine: «Compasiva» written by hand is «Compasivo»
  GEN.forEach((g, k) => ['virtud', 'defecto'].forEach(cl => {
    const arr = VD_IDX.byKey.get(tkey(g.m) + '|' + cl);
    if (arr && !VD_IDX.byKey.has(k + '|' + cl)) VD_IDX.byKey.set(k + '|' + cl, arr);
  }));
  // names the compendium used to have (before they were matched to the Spanish books): sheets that still use them find the entry
  const al = (doc && doc.alias) || {};
  Object.keys(al).forEach(old => ['virtud', 'defecto'].forEach(cl => {
    const arr = VD_IDX.byKey.get(tkey(al[old]) + '|' + cl), k = tkey(old) + '|' + cl;
    if (arr && !VD_IDX.byKey.has(k)) VD_IDX.byKey.set(k, arr);
  }));
  const ord = c => { const i = VD_CATS.indexOf(c); return i < 0 ? 99 : i; };
  Object.values(VD_IDX.cats).forEach(l => l.sort((a, b) => ord(a) - ord(b) || a.localeCompare(b, 'es')));
  return VD_IDX;
}
/* the same name can exist as a major and a minor version: the value decides; otherwise core book, minor first */
function vdFind(name, clase, valor) {
  if (!name) return null;
  const idx = vdIndex(), k = tkey(name);
  const arr = idx.byKey.get(k + '|' + clase) || idx.byKey.get('en:' + k + '|' + clase);
  if (!arr) return null;
  return (valor && arr.find(e => e.valor === valor)) || arr.find(e => e.core && e.valor === 'Menor') || arr.find(e => e.core) || arr.find(e => e.valor === 'Menor') || arr[0];
}
function vdEntry(x, clase) { return x ? vdFind(x.en, clase, x.valor) || vdFind(x.n, clase, x.valor) : null; }
const vdKeyOf = (x, clase, e) => { e = e === undefined ? vdEntry(x, clase) : e; return tkey((e && e.en) || x.en || (e && e.n) || x.n); };
const vdNota = e => e ? (e.propia ? 'Propia de la saga' : e.pag || (e.core ? '' : e.libro)) : '';
const bookAbbr = e => e.propia ? 'propia de la saga' : (String(e.pag || '').split(/\s+/)[0] || e.libro || '').replace(/[,;]$/, '');
/* older sheets name the target inside the virtue: «Afinidad con Vim», «Maña con Concentración» */
function legacyObj(name) {
  const m = String(name || '').trim().match(/^(afinidad|ma[ñn]a)\s+con\s+\(?\s*([^()]+?)\s*\)?$/i);
  if (!m || /^(habilidad|arte|competencia)$/i.test(m[2])) return null;
  const art = artOf(m[2]), mana = /^ma/i.test(m[1]);
  return { fx: art ? (mana ? 'manaArte' : 'afArte') : (mana ? 'manaHab' : 'afHab'), obj: art || m[2] };
}
function vdFx(x, clase) {
  if (!x || !String(x.n || x.en || '').trim()) return null;
  const e = vdEntry(x, clase);
  const f = FX[vdKeyOf(x, clase, e)];
  if (f) return f;
  if (!e && clase === 'virtud') { const L = legacyObj(x.n); if (L) return L.fx; }
  return null;
}
/* what a Maña, Afinidad or Característica Notable/Mediocre applies to ('' while the player has not chosen) */
function vdTarget(x, f) {
  const kind = FX_OBJ[f];
  if (!kind) return '';
  let o = String(x.obj || '').trim();
  if (!o) { const L = legacyObj(x.n); if (L && FX_OBJ[L.fx] === kind) o = L.obj; }
  if (!o && kind !== 'hab') { const words = tkey(x.nota || '').split('-'); o = (kind === 'art' ? ARTS : CHARS).find(a => words.includes(tkey(a))) || ''; }
  if (!o) return '';
  if (kind === 'art') return artOf(o) || '';
  if (kind === 'car') return CHARS.find(c => tkey(c) === tkey(o)) || '';
  return o;
}
/* status virtues that grow into another one: the apprentice who passes the Gauntlet becomes a magus (and, in the Rhine
   Tribunal, a journeyman, then a master, then an archmage). By the original name: [the next one, the button, the note] */
const EVOLVE = {
  'apprentice': ['Hermetic Magus', 'Superar el guantelete', 'Superó el guantelete'],
  'apprentice-rhine-tribunal': ['Journeyman (Rhine Tribunal)', 'Superar el guantelete', 'Superó el guantelete'],
  'journeyman-rhine-tribunal': ['Master (Rhine Tribunal)', 'Hacerse maestro', 'Se hizo maestro'],
  'master-rhine-tribunal': ['Archmage (Rhine Tribunal)', 'Hacerse archimago', 'Se hizo archimago']
};
function vdEvolve(x, clase) {
  if (clase !== 'virtud' || !x || !String(x.n || '').trim()) return null;
  const e = vdEntry(x, 'virtud');
  // «Aprendiz hermético» written by hand is the compendium's «Aprendiz»
  const ev = EVOLVE[tkey(e ? (e.en || e.n) : (x.en || x.n))] || (tkey(x.n) === 'aprendiz-hermetico' ? EVOLVE.apprentice : null);
  const to = ev && vdFind(ev[0], 'virtud');
  return to ? { to: to, label: ev[1], nota: ev[2], magus: ev[0] === 'Hermetic Magus' } : null;
}
/* virtues and flaws that come with others at no cost, by the original name of the one that grants them (plus «|value»
   when only one version grants). Each grant: c, its class; en, the original name, or the names to choose from; or, with no
   names, cat and valor narrow the list to choose from (libre: any of that class). obj fills its bracket, nota adds to its note;
   opc: the book says it «may» be taken. Each one is added as Gratuita with por (the reference of the one that grants it) and
   og (which grant it is), and shown under it */
const GRANTS = {
  'virtud:mythic-blood-zmey': [{ c: 'virtud', en: ['Minor Magical Focus'], nota: 'Tormentas' }, { c: 'defecto', en: ['Meddler', 'Lecherous', 'Proud'], valor: 'Menor' }],
  'virtud:hyperborean-descent|Mayor': [{ c: 'virtud', en: ['Hyperborean Descent'], valor: 'Menor' }, { c: 'defecto', en: ['Dutybound'], nota: 'Código de Apolo' }],
  'virtud:faerie-doctor': [{ c: 'virtud', en: ['Dowsing'] }],
  'virtud:spirit-votary': [{ c: 'virtud', en: ['Second Sight'] }],
  'virtud:strong-faerie-blood': [{ c: 'virtud', en: ['Second Sight'] }],
  'virtud:maestro': [{ c: 'virtud', en: ['Affinity with Ability', 'Puissant (Ability)', 'Free Expression', 'Inspirational'] }],
  'virtud:commander': [{ c: 'virtud', en: ['Temporal Influence'] }],
  'virtud:leper-magus': [{ c: 'virtud', en: ['Life Boost'] }],
  'virtud:mythic-mimicry': [{ c: 'virtud', en: ["Messenger's Memory"] }],
  'virtud:vis-sensitivity': [{ c: 'virtud', en: ['Magic Sensitivity'], opc: true }],
  'virtud:olympian-pact': [{ c: 'defecto', cat: 'Personalidad', valor: 'Mayor' }],
  'defecto:a-deal-with-the-devil': [{ c: 'defecto', en: ['Plagued by Supernatural Entity'] }],
  'defecto:warped-by-magic': [{ c: 'defecto', valor: 'Menor', libre: true }]
};
/* «virtud:mythic-blood»: what por points at */
const vdRef = (x, clase) => clase + ':' + vdKeyOf(x, clase);
function vdGrants(x, clase) {
  if (!x || !String(x.n || x.en || '').trim()) return null;
  const k = vdRef(x, clase);
  return GRANTS[k + '|' + valorOf(x, clase)] || GRANTS[k] || null;
}
/* the compendium entries a grant may be (one: it is filled in by itself; several: the player chooses; none: any, by cat/valor) */
const grantOpts = g => (g.en || []).map(n => vdFind(n, g.c, g.valor)).filter(Boolean);
function grantItem(g, ref, gi) {
  const o = grantOpts(g), e = o.length === 1 ? o[0] : null;
  const x = { n: e ? e.n : '', en: e ? e.en : '', cat: e ? e.cat : (g.cat || ''), valor: 'Gratuita', nota: '', por: ref, og: gi };
  if (g.obj) x.obj = g.obj;
  x.nota = [g.nota, e ? vdNota(e) : ''].filter(Boolean).join(' · ');
  return x;
}
/* adds what the virtues and flaws on the sheet grant, and takes out what was granted by one no longer there; true if it changed.
   A grant the player took out is kept out (sinOtorgar on the one that grants it) */
function vdGrantSync(d) {
  const lists = { virtud: d.virtudes || (d.virtudes = []), defecto: d.defectos || (d.defectos = []) };
  const present = new Set();
  let ch = false;
  ['virtud', 'defecto'].forEach(cl => lists[cl].slice().forEach(x => {
    const G = vdGrants(x, cl);
    if (!G) return;
    const ref = vdRef(x, cl);
    if (present.has(ref)) return;
    present.add(ref);
    G.forEach((g, gi) => {
      if ((x.sinOtorgar || []).includes(gi)) return;
      if (lists[g.c].some(y => y && y.por === ref && y.og === gi)) return;
      lists[g.c].push(grantItem(g, ref, gi));
      ch = true;
    });
  }));
  ['virtud', 'defecto'].forEach(cl => {
    const L = lists[cl];
    for (let i = L.length - 1; i >= 0; i--) {
      const y = L[i];
      if (y && y.og != null && !present.has(y.por)) { L.splice(i, 1); ch = true; }
    }
  });
  return ch;
}
/* the grant behind a granted virtue or flaw: {g, parent: {x, clase}} or null */
function vdGrantOf(d, y) {
  if (!y || y.og == null || !y.por) return null;
  let parent = null;
  [['virtudes', 'virtud'], ['defectos', 'defecto']].some(([k, cl]) => (d[k] || []).some(x => { if (x && x !== y && String(x.n || '').trim() && vdRef(x, cl) === y.por) { parent = { x: x, clase: cl }; return true; } return false; }));
  const G = parent && vdGrants(parent.x, parent.clase);
  return G && G[y.og] ? { g: G[y.og], parent: parent, opts: grantOpts(G[y.og]) } : null;
}
/* the virtues and flaws as a tree: each column (virtud, defecto) with its own, and under each one what it grants or what
   was marked as given by it (por), whatever its class: [{x, clase, depth, parent}]. all: also the rows still without a name */
function vdNest(pj, all) {
  const items = [];
  [['virtudes', 'virtud'], ['defectos', 'defecto']].forEach(([k, cl]) => (Array.isArray(pj && pj[k]) ? pj[k] : []).forEach(x => {
    if (x && typeof x === 'object' && (all || String(x.n || '').trim())) items.push({ x: x, clase: cl, depth: 0, parent: null });
  }));
  const byRef = new Map();
  items.forEach(it => { if (String(it.x.n || '').trim()) { const r = vdRef(it.x, it.clase); if (!byRef.has(r)) byRef.set(r, it); } });
  items.forEach(it => { const p = it.x.por ? byRef.get(it.x.por) : null; it.parent = p && p !== it ? p : null; });
  items.forEach(it => { let p = it.parent, n = 0; while (p && n++ < 20) { if (p === it) { it.parent = null; break; } p = p.parent; } });
  const out = { virtud: [], defecto: [] }, done = new Set();
  const put = (col, it, depth) => {
    if (done.has(it)) return;
    done.add(it); it.depth = depth; out[col].push(it);
    items.filter(y => y.parent === it).forEach(y => put(col, y, depth + 1));
  };
  items.filter(it => !it.parent).forEach(it => put(it.clase, it, 0));
  items.forEach(it => { if (!done.has(it)) put(it.clase, it, 0); });
  return out;
}
/* ---------- supernatural Abilities and their realm: a Virtue that grants one («Da la habilidad sobrenatural Segunda
   vista 1…», in the compendium) is aligned with a realm the player chooses (x.reino), and the aura of the place adds to
   or takes from the Ability's rolls as it does to that realm's powers (AURA_X in saga/rules.js) */
const REINO_POW = [['magica', 'Magia'], ['feerica', 'Feérico'], ['divina', 'Divino'], ['infernal', 'Infernal']];
const REINO_POW_TXT = { magica: 'mágico', feerica: 'feérico', divina: 'divino', infernal: 'infernal' };
/* the supernatural Ability this virtue grants (its name), or '' — a hand-written supernatural virtue grants one of its own name */
function vdSobHab(x, clase) {
  if (clase !== 'virtud' || !x || !String(x.n || '').trim()) return '';
  const e = vdEntry(x, 'virtud');
  if (!e) return norm(x.cat || '') === 'sobrenatural' ? String(x.n).trim() : '';
  const m = String(e.desc || '').match(/habilidad sobrenatural\s+(?:de\s+)?(.+?)\s*(?:\d|:|;|,|\(|\.|$)/i);
  return m ? m[1].replace(/^«|»$/g, '').trim() : '';
}
/* the same Ability written another way: «Augurio» / «Augurios», «Segunda vista» / «Clarividencia» (the virtue's name) */
const habKey = s => tkey(s).replace(/s$/, '');
/* the realm of one of the character's Abilities ('' when no supernatural virtue of the sheet grants it, or none was chosen) */
function habReino(pj, habName) {
  const k = habKey(habName);
  if (!k) return '';
  const x = (Array.isArray(pj && pj.virtudes) ? pj.virtudes : []).find(v => {
    const sh = vdSobHab(v, 'virtud');
    if (!sh) return false;
    const ge = GEN.get(tkey(v.n));
    return [sh, v.n, v.en, vdLabel(v)].concat(ge ? [ge.f, ge.n] : []).some(n => n && habKey(n) === k);
  });
  if (!x) return '';
  return vdReinoFijo(x) || (REINO_POW_TXT[x.reino] ? x.reino : '');
}
/* the realm a virtue's own rule fixes (Magia Sagrada: Divine), so the player does not choose it */
const vdReinoFijo = x => { const f = MAGIA_FX[vdKeyOf(x, 'virtud')] || {}; return f.hab || f.reino || ''; };
/* ---------- virtues that tie a magus's magic to a realm (by their original name). Magia Sagrada and Magia karaita
   (Realms of Power: The Divine): the magic is Divine and the Ability Magia sagrada takes the place of Teoría Mágica.
   Verdadera Comprensión de los Reinos (Legends of Hermes p. 15): an aura of another realm counts as its level minus the
   magus's Lore of that realm (not below 0) */
const MAGIA_FX = {
  'holy-magic': { reino: 'divina', teoria: 'Magia sagrada' },
  'karaite-magic': { reino: 'divina', teoria: 'Magia sagrada' },
  'true-understanding-of-the-realms': { comprension: true },
  // Magia Ctónica (Realms of Power: The Infernal p. 123): attuned to Magic and Infernal auras, it has the benefits of both;
  // its Ability may stand for Teoría Mágica in the lab for dark effects; a sinful act adds the lowest Art once more
  'chthonic-magic': { ctonica: true, hab: 'infernal', afin: 'infernal' },
  // Magia Feérica (ArM5 p. 42 and 148, the Merinita Outer Mystery): attuned to Magic and Faerie auras, it has the benefits of both
  'faerie-magic': { afin: 'feerica' }
};
/* who makes an aura of another realm count as the magic's own */
const AFIN_POR = { infernal: 'Magia Ctónica', feerica: 'Magia Feérica' };
/* {reino, teoria, comprension, por: the virtues that change it} for a sheet */
function magiaFx(pj) {
  const o = { reino: 'magica', teoria: 'Teoría Mágica', comprension: false, ctonica: false, afines: [], por: [] };
  (Array.isArray(pj && pj.virtudes) ? pj.virtudes : []).forEach(x => {
    if (!x || !String(x.n || '').trim()) return;
    const f = MAGIA_FX[vdKeyOf(x, 'virtud')];
    if (!f) return;
    Object.keys(f).forEach(k => { if (k !== 'afin' && k !== 'hab') o[k] = f[k]; });
    if (f.afin && !o.afines.includes(f.afin)) o.afines.push(f.afin);
    o.por.push(vdLabel(x, pj.genero));
  });
  return o;
}
/* what the player fills in for this virtue or flaw: [{k: kind, w: the bracket's word}] — the target of a Maña,
   Afinidad or Característica Notable/Mediocre (stored in obj), or each bracket of the name (obj, then obj2) */
function vdSlots(x, clase) {
  const f = vdFx(x, clase);
  if (FX_OBJ[f]) return [{ k: FX_OBJ[f], w: '' }];
  const e = x && String(x.n || x.en || '').trim() ? vdEntry(x, clase) : null;
  if (!e) return [];
  return [...String(e.n).matchAll(/\(([^)]+)\)/g)].map(m => ({ k: SLOT_KIND[tkey(m[1])], w: m[1].trim() })).filter(s => s.k).slice(0, 2);
}
/* the effects on the sheet: used by the editor, the live sheet (calc) and the season editor */
function vdEffects(pj) {
  const fx = { af: { hab: new Set(), art: new Set() }, mana: { hab: {}, art: {} }, car: {} };
  if (!pj) return fx;
  [['virtudes', 'virtud'], ['defectos', 'defecto']].forEach(([k, clase]) => (Array.isArray(pj[k]) ? pj[k] : []).forEach(x => {
    if (!x || typeof x !== 'object') return;
    const f = vdFx(x, clase);
    if (!FX_OBJ[f]) return;
    const t = vdTarget(x, f);
    if (!t) return;
    if (f === 'afHab') fx.af.hab.add(tkey(t));
    else if (f === 'afArte') fx.af.art.add(t);
    else if (f === 'manaHab') fx.mana.hab[tkey(t)] = 2;
    else if (f === 'manaArte') fx.mana.art[t] = 3;
    else fx.car[t] = (fx.car[t] || 0) + (f === 'carGrande' ? 1 : -1);
  }));
  return fx;
}
/* «Maña con (Habilidad)» + Concentración → «Maña con Concentración» */
/* «(Reino) estigmático» + Dominio → «Dominio estigmático»: each bracket to fill takes its choice, in order;
   g, the character's gender, turns the name into its feminine or neutral form first («Dominio estigmática») */
function vdLabel(x, g) {
  const n = vdGen(String((x && x.n) || '').trim(), g), o = String((x && x.obj) || '').trim(), o2 = String((x && x.obj2) || '').trim();
  if (!o && !o2) return n;
  const vals = [o, o2];
  let i = 0, used = 0;
  const b = n.replace(/\(([^)]+)\)/g, (m, w) => { if (!SLOT_KIND[tkey(w)]) return m; const v = vals[i++]; if (!v) return m; used++; return v; });
  if (used) return b;
  if (!o) return n;
  const r = n.replace(/\b(habilidad|arte)\b/i, o);
  return r !== n ? r : n + ' (' + o + ')';
}
/* «Afinidad con Vim» (Excel) → the compendium's «Afinidad con Arte» applied to Vim */
function vdNormalize(x) {
  if (!x || typeof x !== 'object' || x.obj || !String(x.n || '').trim() || vdEntry(x, 'virtud')) return x;
  const L = legacyObj(x.n);
  const e = L && vdFind(FX_GENERIC[L.fx], 'virtud');
  if (!e) return x;
  return Object.assign({}, x, { n: e.n, en: e.en, cat: e.cat, valor: x.valor || e.valor, obj: L.obj });
}
const valorOf = (x, clase) => x.valor || (vdEntry(x, clase) || {}).valor || '';
const catOf = (x, clase) => x.cat || (vdEntry(x, clase) || {}).cat || '';
function ensureGift(d) {
  // the House's virtue comes and goes with the type too (only magi have it)
  ensureHouse(d);
  if (!isMagic(CLASE[d.tipo])) return;
  if (!(d.virtudes || []).some(x => vdFx(x, 'virtud') === 'don')) d.virtudes.unshift({ n: 'El Don', en: 'The Gift', cat: 'Especial', valor: 'Gratuita', nota: 'ArM 68' });
}
/* ---------- the House's free virtue (ArM5 p. 39; Casas de Hermes: Castas, Cultos Mistéricos and Societates): a magus of the
   House gains it at creation, at no cost. Branches, lineages, schools and traditions give different ones: the player picks
   the variant (d.linaje). Each gift by the compendium's name; obj: its Ability or Art; nota: what the book says it is about;
   cat: for the ones the compendium lacks. Ex Miscellanea's traditions also give a Major Hermetic Flaw (def) and, like the
   rest, do not count against the points (ArM5 p. 39: «son extras») */
const gv = (n, o) => Object.assign({ n: n }, o);
const gd = (n, o) => Object.assign({ n: n, def: true }, o);
const solo = (k, vd) => [{ k: k, n: k.charAt(0).toUpperCase() + k.slice(1), vd: vd }];
// Societates, «Virtud gratuita» of Jerbiton: a Minor Virtue of study, the arts or social life
const JERBITON = ['Afinidad con Habilidad', 'Alentador', 'Amor verdadero (PJ)', 'Aprender (Habilidad) a Partir de Tus Errores', 'Bendición de Venus',
  'Chismoso', 'Contactos sociales', 'Creatividad', 'Criado en el circo', 'Cuidadoso con Habilidad', 'Dedos ligeros', 'Instruido',
  'Estudiante Competente', 'Infancia Privilegiada', 'Influencia Política', 'Lector perceptivo', 'Maña con (Habilidad)', 'Mirada penetrante',
  'Música Encantada', 'Pedagogo', 'Protección', 'Trotamundos', 'Vigoroso'];
const CASA_VD = {
  bjornaer: solo('bjornaer', [gv('Bestia Interior')]),
  bonisagus: [
    { k: 'bonisagi', n: 'Bonisagi (teóricos)', vd: [gv('Maña con (Habilidad)', { obj: 'Teoría Mágica' })] },
    { k: 'trianomae', n: 'Trianomae, seguidores de Trianoma (políticos)', vd: [gv('Maña con (Habilidad)', { obj: 'Intriga' })] }],
  criamon: solo('criamon', [gv('El Enigma')]),
  'ex-miscellanea': [
    { k: 'senores-bestias', n: 'Señores de las bestias', vd: [gv('Invocar Animales'), gv('Inofensivo para los Animales'), gd('Requerimientos de estudio')] },
    { k: 'damhadh-cambiaformas', n: 'Damhadh-Duidsan, con Cambiaformas', vd: [gv('Cambiaformas'), gv('Maña con Arte', { obj: 'Corpus' }), gd('Condición necesaria', { nota: 'runas' })] },
    { k: 'damhadh-gigantes', n: 'Damhadh-Duidsan, con Sangre de Gigantes', vd: [gv('Sangre de Gigantes'), gv('Maña con Arte', { obj: 'Corpus' }), gd('Condición necesaria', { nota: 'runas' })] },
    { k: 'aruspices', n: 'Arúspices herméticos', vd: [gv('Adivinación'), gv('Afinidad con Arte', { obj: 'Intellego' }), gd('Propenso al Crepúsculo')] },
    { k: 'malocchi', n: 'Malocchi', aviso: 'Los malocchi llevan también Mirada Penetrante.',
      vd: [gv('Fascinación'), gv('Circunstancias Especiales', { nota: 'cruce de miradas' }), gd('Resistencia mágica débil', { nota: 'cuando hay alguien encima de su sombra' })] },
    { k: 'tempestariae', n: 'Tempestariae (brujas del clima)', vd: [gv('Silbo de Viento', { cat: 'Sobrenatural' }), gv('Afinidad con Arte', { obj: 'Auram' }), gd('Condición necesaria', { nota: 'objetos indispensables para su magia' })] },
    { k: 'tesalia', n: 'Brujas de Tesalia', aviso: 'Las brujas de Tesalia llevan además, gratis, una virtud mayor no hermética de invocación de criaturas infernales.',
      vd: [gv('Afinidad con Arte', { obj: 'Vim' }), gd('Magia dolorosa')] },
    { k: 'donatores', n: 'Donatores requietis aeternae', vd: [gv('Destierro', { cat: 'Sobrenatural' }), gv('Focus Mágico Menor', { nota: 'Mentem para espíritus o fantasmas, o Corpus para animar cadáveres' }), gd('Restricción', { nota: 'no puede lanzar hechizos en suelo consagrado' })] },
    { k: 'orfeo', n: 'El culto a Orfeo', vd: [gv('Bendición del Humor Sanguíneo'), gv('Magia Órfica', { cat: 'Hermética' }), gd('Restricción', { nota: 'vínculo emocional' })] },
    { k: 'pharmacopolae', n: 'Pharmacopolae', aviso: 'Los pharmacopolae llevan también Focus Mágico Menor (curación) y Blando de corazón, No combatiente o Voto (pacifismo).',
      vd: [gv('Herbología Mítica', { cat: 'Sobrenatural' }), gv('Estaquillar', { cat: 'Hermética' }), gd('Deficiencia en (Técnica)', { obj: 'Perdo' })] },
    { k: 'pralix', n: 'El linaje de Pralix', vd: [gv('Comprensión Mágica', { cat: 'Sobrenatural' }), gv('Focus Mágico Menor', { nota: 'magia exótica' }), gd('Resistencia mágica débil', { nota: 'contra quien no haya analizado con Comprensión Mágica' })] },
    { k: 'rusticani', n: 'Magi rústicos (rusticani)', vd: [gv('Magia Artesanal'), gv('Foci de Hechizos', { cat: 'Hermética' }), gd('Magia Espontánea débil')] },
    { k: 'sahirs', n: 'Saḥirs herméticos', vd: [gv('Siḥr'), gv('Focus Mágico Menor', { nota: 'yinn' }), gd('Propenso al Crepúsculo')] },
    { k: 'seirenes', n: 'Seirenes', vd: [gv('Canto de Sirena', { cat: 'Sobrenatural' }), gv('Focus Mágico Menor', { nota: 'Mentem, una emoción' }), gd('Condición necesaria')] },
    { k: 'otra', n: 'Otra tradición', aviso: 'Ex Miscellanea: añade, gratis, la virtud hermética menor, la virtud mayor no hermética y el defecto hermético mayor de su tradición.', vd: [] }],
  flambeau: [
    { k: 'ignem', n: 'Escuela del Fundador o de Bóreas', vd: [gv('Maña con Arte', { obj: 'Ignem' })] },
    { k: 'perdo', n: 'Escuela de Apromor o de Bóreas', vd: [gv('Maña con Arte', { obj: 'Perdo' })] },
    { k: 'ramius', n: 'Escuela de Ramius (si lo permite el narrador)', vd: [gv('Guerrero')] },
    { k: 'sebastian', n: 'Escuela de Sebastian (si lo permite el narrador)', vd: [gv('Focus Mágico Menor', { nota: 'una Forma distinta de Ignem para atacar' })] },
    { k: 'vilano-mana', n: 'Escuela de Vilano (si lo permite el narrador)', vd: [gv('Maña con (Habilidad)', { obj: 'Precisión' })] },
    { k: 'vilano-cuidadoso', n: 'Escuela de Vilano (si lo permite el narrador)', vd: [gv('Cuidadoso con Habilidad', { nota: 'Precisión' })] }],
  guernicus: solo('guernicus', [gv('Prestigio Hermético')]),
  jerbiton: JERBITON.map(n => ({ k: tkey(n), n: '', vd: [gv(n)] })),
  mercere: [
    { k: 'creo', n: '', vd: [gv('Maña con Arte', { obj: 'Creo' })] },
    { k: 'muto', n: '', vd: [gv('Maña con Arte', { obj: 'Muto' })] },
    { k: 'milvi', n: 'Milvi Antiquiti, del linaje de los Mutantes', vd: [gv('Magia Mutantum')] }],
  merinita: solo('merinita', [gv('Magia Feérica')]),
  tremere: solo('tremere', [gv('Focus Mágico Menor', { nota: 'Certamen' })]),
  tytalus: solo('tytalus', [gv('Determinación')]),
  verditius: solo('verditius', [gv('Magia Verditius')])
};
const casaKey = d => Object.keys(CASA_VD).find(k => tkey(d && d.casa).includes(k)) || '';
const isMerinita = d => casaKey(d) === 'merinita';
// what a variant gives: the compendium's entry when it has one, and the key that tells whether the character has it
const casaGifts = v => v.vd.map(s => {
  const clase = s.def ? 'defecto' : 'virtud', e = vdFind(s.n, clase);
  return Object.assign({}, s, { clase: clase, e: e, key: e ? vdKeyOf(e, clase, e) : tkey(s.n) });
});
const giftList = (d, s) => s.clase === 'virtud' ? (d.virtudes || (d.virtudes = [])) : (d.defectos || (d.defectos = []));
const giftHas = (x, s) => !!x && !!String(x.n || '').trim() && vdKeyOf(x, s.clase) === s.key && (!s.obj || tkey(x.obj) === tkey(s.obj));
// «Maña con Intriga», «Condición necesaria (runas)»: for the variant list
const giftTxt = s => { const t = vdLabel({ n: s.e ? s.e.n : s.n, obj: s.obj }); return s.nota ? t + ' (' + s.nota + ')' : t; };
/* the variants of the character's House: [{ k, n, txt, aviso }] ([] for a House the page does not know, or not a magus) */
function casaVariantes(d) {
  return (CLASE[d.tipo] === 'mago' ? CASA_VD[casaKey(d)] || [] : []).map(v => {
    const g = casaGifts(v), vs = g.filter(s => s.clase === 'virtud').map(giftTxt), ds = g.filter(s => s.clase === 'defecto').map(giftTxt);
    return { k: v.k, n: v.n, aviso: v.aviso || '', txt: vs.join(', ') + (ds.length ? '; defecto: ' + ds.join(', ') : '') };
  });
}
/* adds the free virtues (and flaw) of the House's variant to a magus who lacks them, and takes out those of a House or variant
   it no longer has (casaGratis marks them: «casa:variante»). A House with one variant takes it; with several, an older sheet
   keeps the one its free virtue shows (Bonisagus with Maña con Intriga → Trianomae), else the player picks it. True if it changed */
function ensureHouse(d) {
  const k = CLASE[d.tipo] === 'mago' ? casaKey(d) : '';
  const vars = CASA_VD[k] || [];
  let ch = false;
  if (vars.length && !vars.some(v => v.k === d.linaje)) {
    // (only from what this House gave: another House's gift is not a clue)
    const g = vars.length === 1 ? vars[0] : vars.find(v => v.vd.length && casaGifts(v).every(s => giftList(d, s).some(x => x.casaGratis === k && giftHas(x, s))));
    if (g || d.linaje) { d.linaje = g ? g.k : ''; ch = true; }
  }
  const v = vars.find(x => x.k === d.linaje);
  const gifts = v ? casaGifts(v) : [];
  const tag = v ? k + ':' + v.k : '';
  [['virtudes', 'virtud'], ['defectos', 'defecto']].forEach(([lk, cl]) => {
    const L = d[lk] || (d[lk] = []);
    for (let i = L.length - 1; i >= 0; i--) {
      const x = L[i];
      if (!x || !x.casaGratis || x.casaGratis === tag) continue;
      // marked by an older version of the page (the House alone): it stays if it is one of this variant's
      if (x.casaGratis === k && gifts.some(s => s.clase === cl && giftHas(x, s))) { x.casaGratis = tag; ch = true; continue; }
      L.splice(i, 1); ch = true;
      // and the Ability row it put on the sheet, while it is still empty
      const hi = (d.hab || []).findIndex(y => y.casaHab && tkey(y.n) === tkey(x.obj) && !Number(y.base) && !String(y.esp || '').trim());
      if (hi >= 0) d.hab.splice(hi, 1);
    }
  });
  const casa = String(d.casa || '').trim(), varTxt = vars.length > 1 && v && v.n ? ' (' + v.n + ')' : '';
  gifts.forEach(s => {
    const L = giftList(d, s);
    if (L.some(x => giftHas(x, s))) return;
    const e = s.e;
    const x = { n: e ? e.n : s.n, en: e ? e.en : '', cat: e ? e.cat : (s.cat || ''), valor: 'Gratuita',
      nota: ['Gratuita por la casa ' + casa + varTxt, s.nota, vdNota(e)].filter(Boolean).join(' · '), casaGratis: tag };
    if (s.obj) x.obj = s.obj;
    L.push(x);
    ch = true;
    // the Ability it raises goes on the sheet, as when the player picks it in the row
    if (s.obj && FX_OBJ[vdFx(x, s.clase)] === 'hab' && !(d.hab || []).some(y => tkey(y.n) === tkey(s.obj))) (d.hab || (d.hab = [])).push({ n: s.obj, cat: CAT_OF[tkey(s.obj)] || '', esp: '', base: 0, casaHab: true });
  });
  return ch;
}
function ageOf(d) { const [ca] = curSeason(); const n = parseInt(d.nacimiento, 10); return n ? ca - n : null; }
function abilityCap(age) { return age == null || age < 30 ? 5 : age <= 35 ? 6 : age <= 40 ? 7 : age <= 45 ? 8 : 9; }

/* restricted Abilities a companion or grog may learn ({cls, acc, custos}); null for magi (all) and «Otro» (not checked) */
function accessOf(d) {
  const cls = CLASE[d.tipo] || 'otro';
  if (cls !== 'companero' && cls !== 'grog') return null;
  const acc = new Set();
  let custos = false;
  (d.virtudes || []).forEach(x => { if (!x || !String(x.n || '').trim()) return; const k = vdKeyOf(x, 'virtud'); if (k === 'custos') custos = true; (ACCESS[k] || []).forEach(g => acc.add(g)); });
  (d.defectos || []).forEach(x => { if (!x || !String(x.n || '').trim()) return; (ACCESS[vdKeyOf(x, 'defecto')] || []).forEach(g => acc.add(g)); });
  return { cls: cls, acc: acc, custos: custos };
}
const grpOf = c => c === 'Lenguas muertas' ? 'Académicas' : c; // a dead language is an Academic Ability
/* ---------- the rules: what a new character may spend, and what it spends */
function creationCheck(d) {
  const cls = CLASE[d.tipo] || 'otro';
  const age = ageOf(d);
  const cr = d.creacion || {};
  const V = (d.virtudes || []).filter(x => x && String(x.n || '').trim());
  const D = (d.defectos || []).filter(x => x && String(x.n || '').trim());
  const fxV = V.map(x => vdFx(x, 'virtud')), fxD = D.map(x => vdFx(x, 'defecto'));
  const hasV = f => fxV.includes(f), hasD = f => fxD.includes(f);
  const valV = x => valorOf(x, 'virtud'), valD = x => valorOf(x, 'defecto');
  const catV = x => norm(catOf(x, 'virtud')), catD = x => norm(catOf(x, 'defecto'));
  const fx = vdEffects(d);
  const errors = [], avisos = [], lines = [];
  // 1. virtues and flaws: start with 0 points; flaws give them (major 3, minor 1), virtues spend them
  const pv = V.reduce((s, x) => s + vdPts(valV(x)), 0), pd = D.reduce((s, x) => s + vdPts(valD(x)), 0);
  const vdCap = cls === 'grog' ? 3 : cls === 'otro' ? null : 10;
  if (vdCap != null && pd > vdCap) errors.push('Los defectos suman ' + pd + ' puntos y el máximo para ' + CLASE_TXT[cls] + ' es ' + vdCap + '.');
  if (pv > pd) errors.push('Las virtudes cuestan ' + pv + (pv === 1 ? ' punto' : ' puntos') + ' y los defectos solo dan ' + pd + '.');
  const gift = hasV('don');
  if (isMagic(cls) && !gift) errors.push('Falta El Don, obligatorio y gratuito para los magos.');
  if (cls === 'grog') {
    if (V.some(x => valV(x) === 'Mayor') || D.some(x => valD(x) === 'Mayor')) avisos.push('Según el reglamento, los grogs no llevan virtudes ni defectos mayores.');
    if (gift) avisos.push('Según el reglamento, un grog nunca tiene el Don.');
    if (D.some(x => catD(x) === 'historia')) avisos.push('Según el reglamento, los grogs no llevan defectos de Historia.');
  }
  if (cls === 'companero' && gift) avisos.push('Un compañero con el Don solo tiene sentido si va a acabar siendo mago.');
  const nMinor = D.filter(x => valD(x) === 'Menor').length;
  if (nMinor > 5) avisos.push('Hay ' + nMinor + ' defectos menores; el reglamento permite cinco como mucho.');
  const story = D.filter(x => catD(x) === 'historia').length;
  if (story > 1) avisos.push('Hay ' + story + ' defectos de Historia; lo normal es uno como mucho.');
  const pers = D.filter(x => catD(x) === 'personalidad');
  if (pers.filter(x => valD(x) === 'Mayor').length > 1 || pers.length > (cls === 'grog' ? 1 : 2)) avisos.push('Demasiados defectos de Personalidad: ' + (cls === 'grog' ? 'un grog lleva uno como mucho.' : 'como mucho uno mayor y dos en total.'));
  const hermV = V.filter(x => /^herm/.test(catV(x))), hermD = D.filter(x => /^herm/.test(catD(x)));
  if ((hermV.length || hermD.length) && !gift) avisos.push('Las virtudes y defectos herméticos solo los llevan personajes con el Don.');
  if (cls === 'mago' && hermV.filter(x => valV(x) === 'Mayor').length > 1) avisos.push('Un mago solo puede llevar una virtud hermética mayor.');
  if (cls === 'mago' && !hermD.length) avisos.push('Según el reglamento, un mago debería llevar al menos un defecto hermético.');
  if (cls !== 'otro' && !V.some(x => catV(x) === 'estatus social') && !D.some(x => catD(x) === 'estatus social')) {
    avisos.push(cls === 'mago' ? 'Falta el estatus social: los magos llevan «Magus Hermético», que es gratuito.' : 'Falta el estatus social: todos los personajes llevan uno (hay gratuitos, como Campesino o Habitante de la Alianza).');
  }
  if (cls === 'mago' && hasV('rico')) avisos.push('Según el reglamento, un mago no puede ser Rico.');
  const vars = casaVariantes(d), cv = vars.find(v => v.k === d.linaje);
  if (vars.length > 1 && !cv) avisos.push('Elige la variante de la casa ' + String(d.casa || '').trim() + ': cada una da una virtud gratuita distinta.');
  if (cv && cv.aviso) avisos.push(cv.aviso);
  // the House's free ones the compendium lacks (Ex Miscellanea's traditions) come from the House books
  const unknown = V.filter(x => !x.casaGratis && !vdEntry(x, 'virtud') && !legacyObj(x.n)).map(x => x.n).concat(D.filter(x => !x.casaGratis && !vdEntry(x, 'defecto')).map(x => x.n));
  if (unknown.length) avisos.push('No están en el compendio (revisa el nombre y el valor): ' + unknown.join(', ') + '.');
  // Maña, Afinidad and Característica Notable/Mediocre need their target, once per target
  const noObj = [], twice = [], seenObj = new Set();
  [[V, fxV, 'virtud'], [D, fxD, 'defecto']].forEach(([L, F, clase]) => L.forEach((x, i) => {
    if (!FX_OBJ[F[i]]) {
      // the other brackets to fill: the realm, the Form, the beings…
      const sl = vdSlots(x, clase);
      if (sl.some((s, j) => !String((j ? x.obj2 : x.obj) || '').trim())) noObj.push('«' + x.n + '»');
      return;
    }
    const t = vdTarget(x, F[i]);
    if (!t) { noObj.push('«' + x.n + '»'); return; }
    const k = F[i] + '|' + tkey(t);
    if (seenObj.has(k) && F[i] !== 'carGrande' && F[i] !== 'carPobre') twice.push(vdLabel(Object.assign({}, x, { obj: t })));
    seenObj.add(k);
  }));
  // the Merinita Outer Mystery needs a character touched by faeries: without a faerie Virtue or Flaw, one Warping Point (ArM5 p. 148)
  if (cls === 'mago' && isMerinita(d) && !V.concat(D).some(x => vdKeyOf(x, 'virtud') !== 'faerie-magic' && /feeric|faerie|hada/.test(tkey((x.en || '') + ' ' + x.n))) && numv(d.informidad) < 1)
    avisos.push('Un Merinita sin virtud ni defecto feérico empieza con un punto de Informidad (sus maestros se lo dan para la Magia Feérica).');
  const noReino = V.filter(x => vdSobHab(x, 'virtud') && !vdReinoFijo(x) && !REINO_POW_TXT[x.reino]).map(x => '«' + x.n + '»');
  if (noReino.length) avisos.push('Elige el reino de ' + noReino.join(', ') + ': su habilidad sobrenatural suma o resta el aura según el reino.');
  if (noObj.length) avisos.push('Elige a qué se aplica' + (noObj.length > 1 ? 'n ' : ' ') + noObj.join(', ') + ' (columna «Se aplica a»).');
  if (twice.length) avisos.push('Solo se puede coger una vez para lo mismo: ' + twice.join(', ') + '.');
  lines.push({ k: 'vd', l: 'Virtudes y defectos', s: 'Def.', short: pd + (vdCap != null ? '/' + vdCap : '') + ' · Virt. ' + pv + '/' + pd,
    txt: 'defectos ' + pd + (vdCap != null ? ' de ' + vdCap : '') + ' · virtudes ' + pv + ' de ' + pd,
    st: (vdCap != null && pd > vdCap) || pv > pd ? 'over' : pv < pd ? 'under' : 'ok' });
  // 2. characteristics: 7 points; +1 costs 1, +2 costs 3, +3 costs 6, negatives give the same back.
  //    Característica Notable / Mediocre move one past ±3 for free: the cost is that of the score without them.
  const nMas = fxV.filter(f => f === 'carMas').length, nMenos = fxD.filter(f => f === 'carMenos').length;
  const cBudget = 7 + 3 * nMas - 3 * nMenos;
  let cSpent = 0;
  const outR = [], badAdj = [];
  CHARS.forEach(n => {
    const v = Math.round(numv(d.car && d.car[n])), adj = fx.car[n] || 0, b = v - adj;
    cSpent += CHAR_COST[Math.max(-3, Math.min(3, b))];
    if (b > 3 || b < -3) outR.push(n + ' ' + sgn(v));
    if ((adj > 0 && b < 3) || (adj < 0 && b > -3)) badAdj.push(n + ' (' + sgn(v) + ')');
  });
  if (cSpent > cBudget) errors.push('Las características cuestan ' + cSpent + ' puntos y hay ' + cBudget + '.');
  if (outR.length) avisos.push('Fuera del rango normal de −3 a +3: ' + outR.join(', ') + '. Por encima hace falta Característica Notable y por debajo, Característica Mediocre.');
  if (badAdj.length) avisos.push('Característica Notable y Mediocre se aplican a una característica que ya está en +3 o −3 antes de la virtud: ' + badAdj.join(', ') + '.');
  lines.push({ k: 'car', l: 'Características', s: 'Car.', short: cSpent + '/' + cBudget, txt: cSpent + ' de ' + cBudget + ' puntos', st: cSpent > cBudget ? 'over' : cSpent < cBudget ? 'under' : 'ok' });
  // 3. experience by age, plus what virtues and statuses add
  const parts = [];
  const preset = cr.infancia ? PRESETS().find(p => p.n === cr.infancia) : null;
  parts.push([preset ? 'Infancia: paquete «' + preset.n + '»' : hasD('feral') ? 'Infancia entre fieras (120, sin lengua materna)' : 'Lengua materna (75) e infancia (45)', preset ? preset.total : 120]);
  let spBudget = 0, shared = 0;
  const ea = Math.max(5, Math.min(30, parseInt(cr.edadAprendizaje, 10) || 10));
  if (isMagic(cls)) {
    if (ea > 5) parts.push(['Antes del aprendizaje (' + (ea - 5) + ' años × 15)', (ea - 5) * 15]);
    if (cls === 'mago') {
      parts.push(['Aprendizaje (15 años)', 240 + (hasV('maestro') ? 60 : 0) - (hasD('malMaestro') ? 60 : 0)]);
      spBudget = 120 + (hasV('maestro') ? 30 : 0) - (hasD('malMaestro') ? 30 : 0);
      if (age != null && age < ea + 15) avisos.push('Con ' + age + ' años y el aprendizaje empezado a los ' + ea + ', aún no habría pasado el Guantelete (el aprendizaje dura 15 años).');
      shared = age != null ? Math.max(0, age - (ea + 15)) * 30 : 0;
    } else {
      const yrs = age != null ? Math.max(0, Math.min(15, age - ea)) : 0;
      parts.push(['Aprendizaje (' + yrs + (yrs === 1 ? ' año' : ' años') + ')', 19 * Math.min(yrs, 12) + 6 * Math.max(0, yrs - 12)]);
      spBudget = 40 * Math.max(0, yrs - 12);
    }
  } else if (cls !== 'otro') {
    const yrs = age != null ? Math.max(0, age - 5) : 0;
    const per = hasV('rico') ? 20 : hasD('pobre') ? 10 : 15;
    parts.push(['Vida posterior (' + yrs + ' años × ' + per + ')', yrs * per]);
  }
  if (hasV('crianza')) parts.push(['Infancia Privilegiada', 50]);
  if (hasV('guerrero')) parts.push(['Guerrero (habilidades marciales)', 50]);
  if (hasV('instruido')) parts.push(['Instruido (Latín y Artes Liberales)', 50]);
  if (hasV('arcano')) parts.push(['Conocimiento arcano (habilidades arcanas)', 50]);
  if (hasV('trotamundos')) parts.push(['Trotamundos', 50]);
  if (hasV('magister')) parts.push(['Magister in Artibus (8 años de universidad × 30)', 240]);
  if (hasV('redcap')) {
    const y = age != null ? Math.max(0, Math.min(15, age - 5)) : 0;
    if (y) parts.push(['Boina Roja (' + y + ' años de formación a 20 px en vez de 15)', y * 5]);
  }
  const xpBudget = parts.reduce((s, p) => s + p[1], 0);
  // what is spent: the px typed in each row (Affinity raises them when they count, not here)
  let xpSpent = 0, artXp = 0, latAL = 0, teach = 0;
  const byCat = {};
  (d.hab || []).forEach(x => {
    if (!String(x.n || '').trim()) return;
    const b = Math.max(0, numv(x.base)), c = x.cat || guessCat(x.n), k = tkey(x.n);
    xpSpent += b;
    byCat[c] = (byCat[c] || 0) + b;
    if (k === 'latin' || k === 'artes-liberales') latAL += b;
    if (k === 'ensenanza') teach += b;
  });
  ARTS.forEach(a => { const b = Math.max(0, numv(d.artes && d.artes[a])); artXp += b; xpSpent += b; });
  // spell mastery: a score bought like an Ability (1 = 5 px, 2 = 15, 3 = 30); Hechizos dominados pays the first 50
  const msXp = (d.hechizos || []).filter(x => String(x.n || '').trim()).reduce((s, x) => s + abCost(Math.max(0, Math.round(numv(x.maestria)))), 0);
  const msBonus = hasV('dominados') ? 50 : 0;
  xpSpent += Math.max(0, msXp - msBonus);
  if (!isMagic(cls) && cls !== 'otro' && artXp > 0) errors.push('Solo los magos y los aprendices tienen Artes.');
  const spSpent = (d.hechizos || []).filter(x => String(x.n || '').trim()).reduce((s, x) => s + Math.max(0, numv(x.nivel)), 0);
  const overXp = Math.max(0, xpSpent - xpBudget), overSp = Math.max(0, spSpent - spBudget);
  const usedShared = overXp + overSp;
  const native = (d.hab || []).some(x => (x.cat || guessCat(x.n)) === 'Idiomas vivos' && numv(x.base) >= 75);
  if (cls !== 'otro') {
    if (usedShared > shared) {
      if (overXp && overSp) errors.push('Te pasas: ' + overXp + ' px y ' + overSp + ' niveles de hechizo' + (shared ? ' (lo que hay tras el Guantelete son ' + shared + ' puntos)' : '') + '.');
      else if (overXp) errors.push('La experiencia gastada (' + xpSpent + ' px) supera el presupuesto (' + xpBudget + (shared ? ' + ' + shared + ' tras el Guantelete' : '') + ').');
      else errors.push('Los hechizos suman ' + spSpent + ' niveles y el presupuesto es de ' + spBudget + (shared ? ' (+' + shared + ' tras el Guantelete)' : '') + '.');
    }
    if (!native && !(preset && !preset.nativa) && !hasD('feral')) avisos.push('Falta la lengua materna, a nivel 5 (sus 75 px ya están en el presupuesto).');
    lines.push({ k: 'px', l: 'Experiencia', s: 'PX', short: xpSpent + '/' + xpBudget, txt: xpSpent + ' de ' + xpBudget + ' px', st: usedShared > shared && overXp ? 'over' : xpSpent < xpBudget ? 'under' : 'ok' });
    if (isMagic(cls)) lines.push({ k: 'hz', l: 'Hechizos', s: 'Hechizos', short: spSpent + '/' + spBudget, txt: spSpent + ' de ' + spBudget + ' niveles', st: usedShared > shared && overSp ? 'over' : spSpent < spBudget ? 'under' : 'ok' });
    if (shared) lines.push({ k: 'post', l: 'Tras el Guantelete', s: 'Post', short: usedShared + '/' + shared, txt: usedShared + ' de ' + shared + ' puntos (PX o niveles)', st: usedShared > shared ? 'over' : usedShared < shared ? 'under' : 'ok' });
    if (msBonus) lines.push({ k: 'ms', l: 'Maestría de hechizos', s: 'Maest.', short: Math.min(msXp, msBonus) + '/' + msBonus,
      txt: Math.min(msXp, msBonus) + ' de ' + msBonus + ' px' + (msXp > msBonus ? ' (y ' + (msXp - msBonus) + ' de la experiencia)' : ''), st: msXp < msBonus ? 'under' : 'ok' });
    // the extra experience of some virtues has to go to their Abilities
    const need = (on, have, amt, what) => { if (on && have < amt) avisos.push('Los ' + amt + ' px de ' + what + ' (' + have + ' gastados).'); };
    need(hasV('guerrero'), byCat['Marciales'] || 0, 50, 'Guerrero son para habilidades marciales');
    need(hasV('instruido'), latAL, 50, 'Instruido son para Latín y Artes Liberales');
    need(hasV('arcano'), byCat['Arcanas'] || 0, 50, 'Conocimiento arcano son para habilidades arcanas');
    need(hasV('magister'), (byCat['Académicas'] || 0) + (byCat['Lenguas muertas'] || 0) + teach, 240, 'Magister in Artibus son para habilidades académicas o Enseñanza');
  }
  // 4. limits on abilities (Affinity lets one pass the age cap by 2)
  const cap = abilityCap(age);
  const over = [];
  (d.hab || []).forEach(x => {
    if (!String(x.n || '').trim()) return;
    const on = fx.af.hab.has(tkey(x.n)), L = abLvl(afXp(numv(x.base), on));
    if (L > cap + (on ? 2 : 0)) over.push(x.n + ' ' + L);
  });
  if (over.length && cls !== 'otro') avisos.push('Con ' + (age == null ? '?' : age) + ' años, ninguna habilidad debería pasar de ' + cap + ' al crear el personaje (' + (cap + 2) + ' con Afinidad): ' + over.join(', ') + '.');
  const ax = accessOf(d);
  if (ax) {
    const used = {};
    (d.hab || []).forEach(x => { const c = grpOf(x.cat || guessCat(x.n)); if (numv(x.base) > 0 && G_RESTR.includes(c) && !ax.acc.has(c)) (used[c] = used[c] || []).push(x.n); });
    let gs = Object.keys(used).sort((a, b) => used[b].length - used[a].length);
    if (ax.custos) gs = gs.slice(1); // Custos opens one group, the player's choice
    gs.forEach(g => avisos.push(used[g].join(', ') + ': las habilidades ' + G_TXT[g] + ' necesitan una virtud que las permita (' + G_HOW[g] + (ax.custos ? '; Custos solo abre un grupo' : '') + ').'));
  }
  const sobre = (d.hab || []).filter(x => numv(x.base) > 0 && (x.cat || guessCat(x.n)) === 'Sobrenaturales');
  if (sobre.length && !V.some(x => catV(x) === 'sobrenatural')) avisos.push(sobre.map(x => x.n).join(', ') + ': las habilidades sobrenaturales necesitan su virtud sobrenatural.');
  // 5. each spell at most Technique + Form + Intelligence + Magic Theory + 3 (Arts as the sheet counts them, Puissant included)
  if (isMagic(cls)) {
    const intv = numv(d.car && d.car['Inteligencia']);
    // Magia Sagrada: its Ability instead of Teoría Mágica
    const teo = magiaFx(d).teoria, tk = tkey(teo);
    const mtRow = (d.hab || []).find(x => tkey(x.n) === tk);
    const mt = (mtRow ? abLvl(afXp(numv(mtRow.base), fx.af.hab.has(tk))) : 0) + (fx.mana.hab[tk] || 0);
    const artV = a => artLvl(afXp(numv(d.artes && d.artes[a]), fx.af.art.has(a))) + (fx.mana.art[a] || 0);
    const big = [];
    (d.hechizos || []).forEach(s => {
      const t = artOf(s.tec), f = artOf(s.forma), lv = numv(s.nivel);
      if (!t || !f || !lv) return;
      const lab = artV(t) + artV(f) + intv + mt + 3;
      if (lv > lab) big.push('«' + s.n + '» (' + lv + ', máximo ' + lab + ')');
    });
    if (big.length) avisos.push('Hechizos por encima de Técnica + Forma + Inteligencia + ' + teo + ' + 3: ' + big.join(', ') + '.');
  }
  if (cls !== 'otro' && !(d.personalidad || []).some(t => String(t.n || '').trim())) avisos.push('Faltan los rasgos de personalidad: tres, con valores de −3 a +3.');
  return { cls, age, lines, errors, avisos, parts, xpBudget, xpSpent, spBudget, spSpent, shared, cBudget, cSpent, vdCap, pv, pd, cap, unknown, msXp, msBonus };
}

/* ---------- drop-down options */
const VALOR_ORD = ['Menor', 'Mayor', 'Gratuita', 'Especial'];
const VALOR_TXT = {
  virtud: { Mayor: 'mayores, cuestan 3', Menor: 'menores, cuestan 1', Gratuita: 'gratuitas', Especial: 'especiales' },
  defecto: { Mayor: 'mayores, dan 3', Menor: 'menores, dan 1', Gratuita: 'gratuitos', Especial: 'especiales' }
};
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
const optH = (v, l) => '<option value="' + esc(v) + '">' + esc(l == null ? v : l) + '</option>';
const grpH = (label, inner) => inner ? '<optgroup label="' + esc(label) + '">' + inner + '</optgroup>' : '';
const VD_OPTS = {};
/* every virtue (or flaw) of a type, grouped by value; without a type, all of them grouped by type and value */
function vdOptionsHtml(clase, tipo) {
  const key = clase + '|' + (tipo || '');
  if (VD_OPTS[key]) return VD_OPTS[key];
  const idx = vdIndex();
  const groups = new Map();
  idx.list.forEach(e => {
    if (e.clase !== clase || (tipo && e.cat !== tipo) || idx.canon.get(e.dk) !== e) return;
    const v = VALOR_ORD.includes(e.valor) ? e.valor : 'Especial';
    const gk = e.cat + '|' + v;
    if (!groups.has(gk)) groups.set(gk, { cat: e.cat, v: v, items: [] });
    groups.get(gk).items.push(e);
  });
  const catOrd = c => { const i = idx.cats[clase].indexOf(c); return i < 0 ? 99 : i; };
  let html = optH('', clase === 'virtud' ? '— Elige una virtud —' : '— Elige un defecto —');
  [...groups.values()].sort((a, b) => catOrd(a.cat) - catOrd(b.cat) || VALOR_ORD.indexOf(a.v) - VALOR_ORD.indexOf(b.v)).forEach(g => {
    g.items.sort((a, b) => a.n.localeCompare(b.n, 'es'));
    html += grpH(tipo ? capFirst(VALOR_TXT[clase][g.v]) : g.cat + ' · ' + VALOR_TXT[clase][g.v], g.items.map(e => optH(e.i, e.n + (e.core ? '' : ' · ' + bookAbbr(e)))).join(''));
  });
  html += optH('__otra', '✎ Otra, escrita a mano');
  VD_OPTS[key] = html;
  return html;
}
/* what a Maña, Afinidad or Característica Notable/Mediocre can apply to; abilities already on the sheet first */
function objOptionsHtml(kind, d) {
  if (kind === 'art') return optH('', '— Elige —') + grpH('Técnicas', ARTS_T.map(a => optH(a)).join('')) + grpH('Formas', ARTS_F.map(a => optH(a)).join(''));
  if (kind === 'car') return optH('', '— Elige —') + CHARS.map(c => optH(c)).join('');
  if (kind === 'reino') return optH('', '— Elige el reino —') + REINOS.map(([v, l]) => optH(v, l)).join('');
  if (kind === 'forma') return optH('', '— Elige la Forma —') + ARTS_F.map(a => optH(a)).join('');
  if (kind === 'tec') return optH('', '— Elige la Técnica —') + ARTS_T.map(a => optH(a)).join('');
  if (kind === 'casa') return optH('', '— Elige la casa —') + CASAS.map(c => optH(c)).join('');
  const mine = [], seen = new Set();
  (d.hab || []).forEach(x => { const n = String(x.n || '').trim(); if (n && !seen.has(tkey(n))) { seen.add(tkey(n)); mine.push(n); } });
  let html = optH('', '— Elige —') + grpH('En la ficha', mine.sort((a, b) => a.localeCompare(b, 'es')).map(n => optH(n)).join(''));
  Object.keys(ABIL_STD).forEach(c => { html += grpH(c, ABIL_STD[c].filter(n => !seen.has(tkey(n))).map(n => optH(n)).join('')); });
  return html;
}
function vdEffTxt(x, clase, f) {
  if (FX_TXT[f]) return FX_TXT[f];
  const acc = ACCESS[vdKeyOf(x, clase)];
  return acc ? 'Permite habilidades ' + acc.map(g => G_TXT[g]).join(', ').replace(/, ([^,]*)$/, ' y $1') + ' al crearlo.' : '';
}

export { vdReset, AFIN_POR, casaVariantes, ensureHouse, habReino, magiaFx, vdReinoFijo, REINO_POW, REINO_POW_TXT, vdSobHab, abilityCap, accessOf, ageOf, catOf, CLASE, CLASE_TXT, creationCheck, DRAFT_KEY, ensureGift, FX_OBJ, G_HOW, G_RESTR, G_TXT, GENERO, GENERO_TXT, grpOf, isMagic, vdGen, objOptionsHtml, PRESETS, PROPIAS, SLOT_TXT, valorOf, vdEffects, vdEffTxt, vdEntry, vdFind, vdFx, vdGrantOf, vdGrantSync, vdIndex, vdLabel, vdNest, vdNormalize, vdEvolve, vdNota, vdRef, vdOptionsHtml, vdSlots, vdTarget };
