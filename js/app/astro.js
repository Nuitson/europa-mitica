/* El cielo de un día entre los años 900 y 1600, para la pantalla del máster: data/astro.json, que hace
   herramientas/calendario_astrologico.py con el calendario astrológico (Swiss Ephemeris) en hora solar de Arazas.
   Calendario juliano hasta el 4 de octubre de 1582 y gregoriano desde el 15 (del 5 al 14 no existen).
   astro.json (600 KB) se pide solo al abrir la pantalla del máster; el service worker lo guarda entonces. */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']; // JDN % 7: 0 = lunes
const SIGNOS = ['Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo', 'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'];
const FASES = ['Luna nueva', 'Cuarto creciente', 'Luna llena', 'Cuarto menguante'];
const PLANETAS = ['Mercurio', 'Venus', 'Marte', 'Júpiter', 'Saturno'];
const ESTACION = { 0: 'Equinoccio de primavera', 3: 'Solsticio de verano', 6: 'Equinoccio de otoño', 9: 'Solsticio de invierno' };
const ORD = ['1.er', '2.º', '3.er'];

/* día juliano: juliano hasta el 4-10-1582, gregoriano después */
function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  const n = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4);
  if (y < 1582 || (y === 1582 && (m < 10 || (m === 10 && d <= 4)))) return n - 32083;
  return n - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
function fechaDe(jd) {
  let b = 0, c = jd + 32082;
  if (jd >= 2299161) { const a = jd + 32044; b = Math.floor((4 * a + 3) / 146097); c = a - Math.floor(146097 * b / 4); }
  const d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4), m = Math.floor((5 * e + 2) / 153);
  return { y: 100 * b + d - 4800 + Math.floor(m / 10), m: m + 3 - 12 * Math.floor(m / 10), d: e - Math.floor((153 * m + 2) / 5) + 1 };
}
const J0 = jdn(900, 1, 1);

/* null if the date exists in the calendar of the time, otherwise why not */
function fechaError(y, m, d) {
  if (!Number.isInteger(y) || y < 900 || y > 1600) return 'El calendario va del año 900 al 1600.';
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(d) || d < 1) return 'Elige el día y el mes.';
  const bis = y < 1582 ? y % 4 === 0 : y > 1582 && (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));
  const dim = [31, bis ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  if (d > dim) return MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1) + ' de ' + y + ' tiene ' + dim + ' días.';
  if (y === 1582 && m === 10 && d > 4 && d < 15) return 'Del 5 al 14 de octubre de 1582 no existen: el 4 (juliano) lo sigue el 15 (gregoriano).';
  return null;
}

/* ---------- data/astro.json, decoded once: each series as ascending minutes since 1-1-900 00:00 */
let ASTRO = null;
function serie(o, w) {
  const n = o.d.length / w, t = new Array(n + 1);
  t[0] = o.t;
  for (let i = 0; i < n; i++) t[i + 1] = t[i] + parseInt(o.d.substr(i * w, 3), 36);
  return t;
}
function decode(A) {
  const sol = { s: A.sol.s, t: serie(A.sol, 5), dec: [] };
  for (let i = 0; i < A.sol.d.length; i += 5) sol.dec.push(A.sol.d.substr(i + 3, 2));
  sol.dec.push(A.sol.u);
  const pl = {};
  PLANETAS.forEach(p => {
    const o = { t: [], s: [], r: [] };
    let t = A.planetas[p].t;
    A.planetas[p].d.split(',').forEach((x, i) => {
      const r = x.endsWith('r'), y = r ? x.slice(0, -1) : x;
      t = i ? t + parseInt(y.slice(0, -1), 36) : t;
      o.t.push(t); o.s.push(parseInt(y.slice(-1), 36)); o.r.push(r);
    });
    pl[p] = o;
  });
  return { signos: A.signos, ref: A.planetasRef, sol: sol, luna: { s: A.luna.s, t: serie(A.luna, 3) }, fases: { f: A.fases.f, t: serie(A.fases, 3) }, pl: pl };
}
function cargarAstro() {
  if (!ASTRO) ASTRO = fetch('data/astro.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(decode)
    .catch(e => { ASTRO = null; throw e; });
  return ASTRO;
}

/* index of the last moment <= x (-1 when x is before the first) */
function antes(t, x) {
  let lo = 0, hi = t.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (t[mid] <= x) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

/* «15 de marzo de 1258, 17:44»; the year only when it is not the year of the chosen day */
function cuando(t, y0, sinHora) {
  const f = fechaDe(J0 + Math.floor(t / 1440)), mi = ((t % 1440) + 1440) % 1440;
  const hh = String(Math.floor(mi / 60)).padStart(2, '0') + ':' + String(mi % 60).padStart(2, '0');
  return f.d + ' de ' + MESES[f.m - 1] + (f.y !== y0 ? ' de ' + f.y : '') + (sinHora ? '' : ', ' + hh);
}
const hora = t => String(Math.floor((t % 1440) / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');

/* the sky of the day y-m-d: at noon (the signs) and what changes during the day */
function cielo(A, y, m, d) {
  const jd = jdn(y, m, d), t0 = (jd - J0) * 1440, noon = t0 + 720, t1 = t0 + 1440;
  const dia = DIAS[jd % 7], diaPl = Object.keys(A.ref).find(p => A.ref[p].dia === dia);
  const hoy = [];
  const enDia = t => t >= t0 && t < t1;

  // the Sun: sign, decan, the next equinox or solstice
  const S = A.sol, si = antes(S.t, noon);
  let sol = null;
  if (si >= 0) {
    const sg = (S.s + si) % 12, ej = J0 + Math.floor(S.t[si] / 1440), dc = S.dec[si];
    const j2 = ej + parseInt(dc[0], 36), j3 = ej + parseInt(dc[1], 36), k = jd >= j3 ? 2 : jd >= j2 ? 1 : 0;
    const est = [];
    for (let i = antes(S.t, t0 - 1) + 1; i < S.t.length && est.length < 4; i++) {
      const g = (S.s + i) % 12;
      if (ESTACION[g] != null) est.push({ n: ESTACION[g], t: S.t[i] });
    }
    sol = { signo: A.signos[sg], desde: S.t[si], hasta: S.t[si + 1], sigue: SIGNOS[(sg + 1) % 12], dec: k, decTxt: A.signos[sg].decanatos[k], est: est };
    if (jd === j2 || jd === j3) hoy.push({ t: null, txt: 'Empieza el ' + ORD[k] + ' decanato de ' + SIGNOS[sg] + ': ' + A.signos[sg].decanatos[k] });
    [si, si + 1].forEach(i => { if (i < S.t.length && enDia(S.t[i])) { const g = (S.s + i) % 12; hoy.push({ t: S.t[i], txt: 'El Sol entra en ' + SIGNOS[g] + (ESTACION[g] ? ' (' + ESTACION[g].toLowerCase() + ')' : '') }); } });
  }

  // the Moon: sign at noon, phase between the last event and the next
  const L = A.luna, li = antes(L.t, noon);
  for (let i = Math.max(0, antes(L.t, t0)); i < L.t.length && L.t[i] < t1; i++) if (enDia(L.t[i])) hoy.push({ t: L.t[i], txt: 'La Luna entra en ' + SIGNOS[(L.s + i) % 12] });
  const F = A.fases, fi = antes(F.t, noon);
  let fase = null;
  if (fi >= 0 && fi + 1 < F.t.length) {
    const f = (F.f + fi) % 4;
    const prox = n => { for (let i = Math.max(fi, 0); i < F.t.length; i++) if ((F.f + i) % 4 === n && F.t[i] >= t0) return F.t[i]; return null; };
    fase = { ant: FASES[f], antT: F.t[fi], sig: FASES[(f + 1) % 4], sigT: F.t[fi + 1], crece: f < 2, nueva: prox(0), llena: prox(2) };
  }
  for (let i = Math.max(0, antes(F.t, t0)); i < F.t.length && F.t[i] < t1; i++) if (enDia(F.t[i])) hoy.push({ t: F.t[i], txt: FASES[(F.f + i) % 4] });
  const luna = li >= 0 ? { signo: A.signos[(L.s + li) % 12], desde: L.t[li], hasta: L.t[li + 1], fase: fase } : null;

  // the planets
  const planetas = PLANETAS.map(p => {
    const o = A.pl[p], i = antes(o.t, noon);
    for (let j = Math.max(0, antes(o.t, t0)); j < o.t.length && o.t[j] < t1; j++)
      if (enDia(o.t[j])) hoy.push({ t: o.t[j], txt: p + ' entra en ' + SIGNOS[o.s[j]] + (o.r[j] ? ', retrógrado' : '') });
    return { n: p, ref: A.ref[p], signo: i >= 0 ? A.signos[o.s[i]] : null, desde: i >= 0 ? o.t[i] : null, retro: i >= 0 && o.r[i], hasta: i + 1 < o.t.length ? o.t[i + 1] : null };
  });
  hoy.sort((a, b) => (a.t == null ? -1 : a.t) - (b.t == null ? -1 : b.t));
  return { jd: jd, dia: dia, diaPl: diaPl, diaRef: A.ref[diaPl], gregoriano: jd >= 2299161, sol: sol, luna: luna, planetas: planetas, hoy: hoy };
}

export { cargarAstro, cielo, cuando, fechaError, hora, MESES };
