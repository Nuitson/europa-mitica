/* La saga en curso: tablas fijas (estaciones, características, habilidades…) y el estado compartido S. */
import { norm } from '../base.js';

/* ================================================================== SAGA EN CURSO
   Live data kept in the saga's database on the server (window.EM_WEB.db, see js/gate.js):
     personajes/{id}      one document per character (sheet + starting experience)
     avance/{pj}--{y}-{s} one document per character and season: activity + XP split
     vis/{id}             vis movements recorded from the web
     tesoreria/{id}       treasury movements recorded from the web
     saga/estado          the saga's current season and the covenant aura
     virtudes/{id}        virtues and flaws made for this saga alone (creation/vdtab.js); new sagas start without them
   The Excel pages stay as the archive; these views grow season by season. */
const SEASONS = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
const CHARS = ['Inteligencia', 'Percepción', 'Fuerza', 'Vitalidad', 'Presencia', 'Comunicación', 'Destreza', 'Rapidez'];
const TIPOS = ['Magus', 'Aprendiz', 'Compañero', 'Grog', 'Otro'];
const TIPOS_PL = { Magus: 'Magi', Aprendiz: 'Aprendices', 'Compañero': 'Compañeros', Grog: 'Grogs', Otro: 'Otros' };
const CASAS = ['Bjornaer', 'Bonisagus', 'Criamon', 'Ex Miscellanea', 'Flambeau', 'Guernicus', 'Jerbiton', 'Mercere', 'Merinita', 'Tremere', 'Tytalus', 'Verditius'];
const VALORES = ['Menor', 'Mayor', 'Gratuita', 'Especial'];
const VD_CATS = ['General', 'Hermética', 'Sobrenatural', 'Estatus Social', 'Mistérica', 'Personalidad', 'Historia', 'Heroica', 'Corrupta', 'Infantil', 'Especial'];
const ACT_TIPOS = [
  ['Estudio: summa', 'la calidad de la summa; no sube por encima de su nivel.'],
  ['Estudio: tractatus', 'la calidad del tractatus.'],
  ['Estudio: vis', 'dado de estrés + aura (solo Artes).'],
  ['Enseñanza', 'Comunicación del maestro + Enseñanza + 3 + bonos; límite: la puntuación del maestro.'],
  ['Entrenamiento', 'puntuación del maestro + 3; límite: la puntuación del maestro.'],
  ['Aventura', '5 a 10, repartida entre lo que se usó.'],
  ['Práctica', '4 a 8, normalmente 4.'],
  ['Exposición', '2 px.'],
  ['Laboratorio', 'exposición: 2 px en algo relacionado.'],
  ['Otro', '']
];
const ABIL_CATS = ['Generales', 'Marciales', 'Académicas', 'Arcanas', 'Sobrenaturales', 'Idiomas vivos', 'Lenguas muertas', 'Conocimientos de área', 'Conocimientos de Organización', 'Profesiones', 'Reputaciones', 'Otras'];
const ABIL_STD = {
  'Generales': ['Atención', 'Atletismo', 'Cazar', 'Cirugía', 'Concentración', 'Don de gentes', 'Embaucar', 'Encanto', 'Enseñanza', 'Etiqueta', 'Intriga', 'Liderazgo', 'Manejo de animales', 'Montar', 'Música', 'Nadar', 'Pelea', 'Prestidigitación', 'Regatear', 'Sigilo', 'Socializar', 'Supervivencia'],
  'Marciales': ['Un arma', 'Arma grande', 'Arco', 'Arrojadiza'],
  'Académicas': ['Artes Liberales', 'Filosofía', 'Ley civil y canónica', 'Ley común', 'Medicina', 'Teología'],
  'Arcanas': ['Con. divino', 'Con. feérico', 'Con. infernal', 'Con. mágico', 'Derecho Hermético', 'Parma Mágica', 'Penetración', 'Precisión', 'Sab. Enigmática', 'Teoría Mágica'],
  'Sobrenaturales': ['Augurios', 'Segunda vista', 'Sentir lo santo y lo profano', 'Zahorí'],
  'Lenguas muertas': ['Latin', 'Griego', 'Hebreo'],
  'Conocimientos de Organización': ['Orden de Hermes', 'Iglesia']
};
const tkey = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const CAT_OF = {};
Object.keys(ABIL_STD).forEach(c => ABIL_STD[c].forEach(n => { CAT_OF[tkey(n)] = c; }));

/* js/gate.js sets window.EM_WEB (saga, role, database) before starting the page; keys in this browser carry the saga */
const KEYP = (window.EM_WEB.saga ? window.EM_WEB.saga.id : 'invitado') + ':';
const S = { db: null, assets: null, uid: null, canWrite: null, owner: null, status: 'loading', pj: {}, av: {}, vis: {}, tes: {}, vd: {}, estado: null, seen: {}, fresh: {}, timer: null };
const SUBS = [['personajes', 'pj'], ['avance', 'av'], ['vis', 'vis'], ['tesoreria', 'tes'], ['virtudes', 'vd'], ['saga/estado', 'estado']];

export { ABIL_CATS, ABIL_STD, ACT_TIPOS, CASAS, CAT_OF, CHARS, KEYP, S, SEASONS, SUBS, TIPOS, TIPOS_PL, tkey, VD_CATS };
