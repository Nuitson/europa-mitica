/* Reglas caseras (homebrew): reglas fanmade que el máster activa para toda la saga en la pestaña «Homebrew» de su pantalla.
   Cada regla es una entrada de HOMEBREW:
     { k: 'clave-unica', n: 'Nombre', desc: 'Qué cambia', fuente: 'De dónde sale (opcional)' }
   y el código que la aplica pregunta homebrewOn('clave-unica'). El estado se guarda en saga/estado, en homebrew: { clave: true }. */
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

export { CAST_CAR, castCar, castCarTxt, HOMEBREW, homebrewOf, homebrewOn };
