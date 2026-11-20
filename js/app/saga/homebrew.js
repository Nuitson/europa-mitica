/* Reglas caseras (homebrew): reglas fanmade que el máster activa para toda la saga en la pestaña «Homebrew» de su pantalla.
   Cada regla es una entrada de HOMEBREW:
     { k: 'clave-unica', n: 'Nombre', desc: 'Qué cambia', fuente: 'De dónde sale (opcional)' }
   y el código que la aplica pregunta homebrewOn('clave-unica'). El estado se guarda en saga/estado, en homebrew: { clave: true }.
   Además, el material de blogs (magos, aprendices, alianzas, objetos mágicos, hechizos) por tipo y autor: data/homebrew/,
   hecho con herramientas/homebrew_csv.py. Cada grupo se activa igual, con la clave «c:<grupo>»; activo, sale en la barra
   lateral (Homebrew) y sus hechizos entran en el catálogo. */
import { S } from './state.js';

/* Lanzamiento con atributos afines: cada Técnica suma su Característica en lugar de Vitalidad */
const CAST_CAR = { Creo: 'Comunicación', Muto: 'Destreza', Intellego: 'Percepción', Rego: 'Presencia', Perdo: 'Fuerza' };

const HOMEBREW = [
  { k: 'lanzamiento-atributos', n: 'Lanzamiento con atributos afines',
    desc: 'Al lanzar hechizos (formulaicos, espontáneos, ceremoniales y rituales) no se suma Vitalidad, sino la Característica afín a la Técnica: Creo, Comunicación; Muto, Destreza; Intellego, Percepción; Rego, Presencia; Perdo, Fuerza. El laboratorio no cambia.',
    fuente: 'Homebrew de la saga' }
];

const homebrewOf = () => { const o = S.estado && S.estado.homebrew; return o && typeof o === 'object' ? o : {}; };
const homebrewOn = k => homebrewOf()[k] === true;
/* the Characteristic a spell of Technique t adds to its casting total */
const castCar = t => (homebrewOn('lanzamiento-atributos') && CAST_CAR[t]) || 'Vitalidad';
/* for the notes under the totals: «Vitalidad» or the rule in short */
const castCarTxt = () => homebrewOn('lanzamiento-atributos') ? 'Característica afín a la Técnica (Cr Comunicación, In Percepción, Mu Destreza, Pe Fuerza, Re Presencia; regla casera)' : 'Vitalidad';

/* ---------- material from blogs, by type and author (data/homebrew/index.json lists the groups; each one is its own file) */
const HB_KEY = k => 'c:' + k;
const hbGroups = () => { const d = window.EM_DATA && window.EM_DATA.hb; return d && Array.isArray(d.grupos) ? d.grupos : []; };
const hbGroup = k => hbGroups().find(g => g.k === k) || null;
const hbOn = k => homebrewOn(HB_KEY(k));
const hbActive = () => hbGroups().filter(g => hbOn(g.k));
const hbTitle = g => g.autor + ' · ' + g.tipo;
const HBD = {}; // group → its data, or the promise while it loads
const hbData = k => HBD[k] && typeof HBD[k].then !== 'function' ? HBD[k] : null;
function hbLoad(k) {
  if (HBD[k]) return Promise.resolve(HBD[k]);
  HBD[k] = fetch('data/homebrew/' + encodeURIComponent(k) + '.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { HBD[k] = d; return d; }, e => { delete HBD[k]; throw e; });
  return HBD[k];
}
/* fetch the groups switched on that are not here yet; then() runs once they arrive (to draw again) */
function hbSync(then) {
  const miss = hbActive().filter(g => !HBD[g.k]);
  if (miss.length) Promise.all(miss.map(g => hbLoad(g.k).catch(() => null))).then(() => then && then());
}
/* the spells of the active groups, for the catalogue; the signature changes when a group comes or goes */
let hbSpellMemo = { sig: null, list: [] };
const hbSpellSig = () => hbActive().filter(g => g.hechizos && hbData(g.k)).map(g => g.k).join('|');
function hbSpells() {
  const sig = hbSpellSig();
  if (sig !== hbSpellMemo.sig) {
    const list = [];
    hbActive().forEach(g => { const d = hbData(g.k); if (d) (d.hechizos || []).forEach(s => list.push(Object.assign({ hb: g.k, autor: g.autor, blog: (g.blogs || [])[0] || '' }, s))); });
    hbSpellMemo = { sig: sig, list: list };
  }
  return hbSpellMemo.list;
}

export { CAST_CAR, castCar, castCarTxt, HB_KEY, hbActive, hbData, hbGroup, hbGroups, hbLoad, hbOn, hbSpells, hbSpellSig, hbSync, hbTitle, HOMEBREW, homebrewOf, homebrewOn };
