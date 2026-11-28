/* Personajes y sus fichas; búsqueda y rutas de la saga. */
import { ABBR, artOf, ARTS, ARTS_F, ARTS_T, artVar, DOCS, esc, fmt, h, load, R, scrollHint, signed, store } from '../base.js';
import { page } from '../views.js';
import { zoomImg } from '../blocks.js';
import { ABIL_CATS, CHARS, S, SEASONS, TIPOS, TIPOS_PL, tkey } from './state.js';
import { allSeen, dbWrite, field, inp, localPut, monogram, openModal, pjsSorted, sagaCrumbs, stamp, statusNote, sumRep, toast } from './core.js';
import { edadTxt, abCost, abLvl, academic, artLvl, auraNow, auraTxt, botchDice, calc, canCeremony, canWrite, castAura, castAuraTxt, ceremonialOn, ceremonyTime, ceremonyToggle, curSeason, entriesOf, estadoFisico, formaActiva, formaBlock, formaButtons, formasOf, HER, isRitual, magnitude, labBonos, labDe, malusOf, manaArt, manaHab, numv, pjCar, habAura, impioBonus, impioOn, impioToggle, magiaAura, magiaAuraTxt, realmMod, refocusCer, sagaAura, saveHurt, sgn, sname, spellTotal, vdCards } from './rules.js';
import { openXpEditor, viewSeasons } from './seasons.js';
import { exportPj, importButton } from './pjfile.js';
import { GENERO_TXT, habReino, magiaFx, REINO_POW_TXT, vdLabel, vdNest } from '../creation/rules.js';
import { viewEditor } from '../creation/editor.js';
import { labSummary } from './library.js';
import { pjLab } from './laboratory.js';
import { viewAlianza, viewArmeria } from './covenant.js';
import { viewCronica } from './cronica.js';
import { viewMaster } from '../master.js';
import { viewCov, viewHb } from './hbview.js';
import { castCar, castCarTxt } from './homebrew.js';
import { spellInfo, vdInfo } from '../info.js';

/* ---------- PERSONAJES */
function viewCharacters() {
  page.innerHTML = '';
  page.appendChild(sagaCrumbs([['Personajes', null]]));
  page.appendChild(h('h1', { class: 'doc-title', text: 'Personajes' }));
  page.appendChild(h('p', { class: 'doc-blurb', text: 'Las fichas vivas de la saga. Cada estación se reparte la experiencia y los niveles se recalculan solos.' }));
  if (canWrite()) page.appendChild(h('div', { class: 'actions' }, [h('a', { class: 'btn', href: '#pj-nuevo', text: 'Nuevo personaje' }), ...importButton()]));
  const content = h('div', { class: 'content', style: 'margin-top:22px' });
  const note = statusNote();
  if (note) content.appendChild(note);
  const all = pjsSorted(true);
  if (!all.length && (S.status === 'ready' || allSeen())) content.appendChild(h('div', { class: 'empty' }, [h('p', { text: 'Todavía no hay personajes en la saga.' }), canWrite() ? h('a', { class: 'btn', href: '#pj-nuevo', text: 'Crear el primero' }) : null]));
  const [ca] = curSeason();
  TIPOS.forEach(t => {
    const list = all.filter(p => (TIPOS.includes(p.tipo) ? p.tipo : 'Otro') === t);
    if (!list.length) return;
    content.appendChild(h('h3', { text: TIPOS_PL[t] }));
    const grid = h('div', { class: 'docs saga-cards' });
    list.forEach(p => {
      const ent = entriesOf(p._id);
      grid.appendChild(h('a', { class: 'dcard pj-card' + (p.activo === false ? ' inactive' : ''), href: '#pj--' + p._id }, [monogram(p, 'mono big'), h('div', { class: 'in' }, [
        h('div', { class: 'dp', text: [p.casa, p.jugador ? 'juega ' + p.jugador : ''].filter(Boolean).join(' · ') }),
        h('div', { class: 'dt1', text: p.nombre }),
        p.sub || p.nacimiento ? h('div', { class: 'db', text: [p.sub, edadTxt(ca, p.nacimiento)].filter(Boolean).join(' · ') }) : null,
        h('div', { class: 'dm', text: (ent.length === 1 ? '1 estación' : ent.length + ' estaciones') + (p.activo === false ? ' · fuera de juego' : '') + (p.publicado === false ? ' · sin publicar' : '') })])]));
    });
    content.appendChild(grid);
  });
  page.appendChild(content);
  document.title = 'Personajes — Europa Mítica';
}

function viewPj(id, tab) {
  const pj = S.pj[id];
  page.innerHTML = '';
  if (!pj) {
    page.appendChild(sagaCrumbs([['Personajes', '#personajes']]));
    page.appendChild(h('h1', { class: 'doc-title', text: S.status === 'ready' || allSeen() ? 'Personaje no encontrado' : 'Cargando…' }));
    const n = statusNote(); if (n) page.appendChild(n);
    return;
  }
  const entries = entriesOf(id);
  const c = calc(pj, entries);
  const [ca, ce] = curSeason();
  page.appendChild(sagaCrumbs([['Personajes', '#personajes'], [pj.nombre, null]]));
  const head = h('header', { class: 'pj-head' });
  const ret = monogram(pj, 'pj-portrait');
  if (ret.tagName === 'IMG') zoomImg(ret, ret.src);   // pressed, the portrait opens big
  head.appendChild(ret);
  const hi = h('div', { class: 'pj-hi' });
  hi.appendChild(h('h1', { class: 'doc-title', text: pj.nombre }));
  if (pj.sub) hi.appendChild(h('div', { class: 'pj-sub', text: pj.sub }));
  const role = pj.casa ? (/^(Magus|Maga|Aprendiz)$/.test(pj.tipo || '') ? pj.tipo + ' de la casa ' + pj.casa : [pj.tipo, pj.casa].filter(Boolean).join(', ')) : pj.tipo;
  const meta = h('div', { class: 'doc-meta pj-meta' }, [role, GENERO_TXT[pj.genero] ? 'Género ' + GENERO_TXT[pj.genero] : '', pj.nacimiento ? (edadTxt(ca, pj.nacimiento) ? edadTxt(ca, pj.nacimiento) + ' (n. ' + pj.nacimiento + ')' : 'n. ' + pj.nacimiento) : '', pj.aparenta ? String(pj.aparenta) : '',
    pj.jugador ? 'Juega ' + pj.jugador : '', pj.activo === false ? 'Fuera de juego' : ''].filter(Boolean).map(t => h('span', { text: t })));
  if (pj.excel && DOCS[pj.excel]) meta.appendChild(h('a', { href: '#' + pj.excel, text: 'Hoja de Excel original' }));
  if (pj.publicado === false) meta.appendChild(h('span', { class: 'badge-cur sin-pub', text: 'Sin publicar' }));
  const fa = formaActiva(pj);
  if (fa) meta.appendChild(h('span', { class: 'badge-cur forma-on', text: 'En forma de ' + fa.n.toLowerCase() }));
  hi.appendChild(meta);
  if (pj.concepto) hi.appendChild(h('p', { class: 'doc-blurb', text: pj.concepto }));
  const acts = [];
  if (canWrite()) {
    const has = S.av[id + '--' + ca + '-' + ce];
    acts.push(h('button', { type: 'button', class: 'btn', onclick: () => openXpEditor(id, ca, ce) }, (has ? 'Editar PX de ' : 'Repartir PX de ') + sname(ca, ce)),
      h('a', { class: 'btn ghost', href: '#pj--' + id + '--editar', text: 'Editar ficha' }), ...formaButtons(id, pj));
  }
  // the tab on screen, on paper (or PDF): the print style drops the index, the buttons and the dark theme
  acts.push(h('button', { type: 'button', class: 'btn ghost', onclick: () => window.print() }, 'Imprimir'));
  // a file with the sheet, its seasons and the portrait, to keep or to import into this saga or another one
  acts.push(h('button', { type: 'button', class: 'btn ghost', onclick: () => exportPj(id) }, 'Exportar'));
  hi.appendChild(h('div', { class: 'actions' }, acts));
  // not published yet: only its player and the master see it (a player only receives it if it is theirs: api/lib.php, leer)
  if (pj.publicado === false) {
    const pub = canWrite() ? h('button', { type: 'button', class: 'btn', onclick: async () => {
      pub.disabled = true;
      const datos = stamp({ publicado: true }, false);
      if (await dbWrite(() => S.db.doc('personajes/' + id).update(datos), pj.nombre + ' ya está publicado: lo ve toda la saga')) localPut('pj', id, Object.assign({}, S.pj[id] || pj, datos));
      else pub.disabled = false;
    } }, 'Publicar en la saga') : null;
    hi.appendChild(h('div', { class: 'note pub-note' }, [h('span', { text: 'Sin publicar: de momento solo lo veis ' + (S.owner === true ? 'quien lo creó y tú, como máster' : 'tú y el máster') + '. Cuando esté listo, publícalo para que lo vea toda la saga.' }), pub]));
  }
  head.appendChild(hi);
  page.appendChild(head);
  // the laboratory: for the magi (and anyone who has one assigned)
  const TABS = [['ficha', 'Ficha'], ['avance', 'Avance'], ['hechizos', 'Hechizos'], ['laboratorio', 'Laboratorio'], ['virtudes', 'Virtudes y defectos'], ['notas', 'Notas']]
    .filter(t => t[0] !== 'hechizos' || (pj.hechizos || []).length || /^(Magus|Maga|Aprendiz)$/.test(pj.tipo || '') || tab === 'hechizos')
    .filter(t => t[0] !== 'laboratorio' || /^(Magus|Maga)$/.test(pj.tipo || '') || labDe(id) || tab === 'laboratorio');
  const cur = TABS.some(t => t[0] === tab) ? tab : 'ficha';
  const tabs = h('div', { class: 'tabs', role: 'navigation', 'aria-label': 'Pestañas de ' + pj.nombre }, TABS.map(([k, t]) => h('a', { class: 'tab', href: '#pj--' + id + '--' + k, 'aria-current': k === cur ? 'page' : null, text: t + (k === 'avance' && entries.length ? ' · ' + entries.length : k === 'hechizos' && (pj.hechizos || []).length ? ' · ' + pj.hechizos.length : '') })));
  page.appendChild(h('div', { class: 'tabs-wrap' }, tabs));
  scrollHint(tabs, tabs.querySelector('[aria-current="page"]'));
  const content = h('div', { class: 'content' });
  const note = statusNote(); if (note) content.appendChild(note);
  if (cur === 'ficha') pjFicha(content, pj, c, id);
  else if (cur === 'avance') pjAvance(content, id, entries, c);
  else if (cur === 'laboratorio') pjLab(content, id, pj);
  else if (cur === 'hechizos') {
    const aura = castAura(pj, c), cer = ceremonialOn() && canCeremony(c);
    const ms = s => Math.max(0, Math.round(numv(s.maestria)));
    const anyM = (pj.hechizos || []).some(s => ms(s) > 0);
    const hz = pj.hechizos || [];
    if (hz.length) {
      content.appendChild(ceremonyToggle(c, refocusCer));
      const imp = impioToggle(pj, refocusCer);
      if (imp) content.appendChild(imp);
      const cols = ['Hechizo', 'Técnica', 'Forma', 'Nivel', 'Lanzamiento', 'Alcance', 'Duración', 'Objetivo', 'Notas'];
      if (anyM) cols.splice(4, 0, 'Maestría');
      const tabla = h('div', { class: 'sp-tabla' });
      // voice and gestures add to every spell; the vis only to the spell it is spent on (spellCasting)
      const cast = spellCasting(id, pj, c, hz, aura, cer, () => drawTabla());
      const drawTabla = () => {
        const rows = hz.map((s, i) => {
          const m = ms(s);
          const tot = spellTotal(pj, c, s, aura, cer);
          const slow = isRitual(s) || cer ? 'Lanzamiento: ' + ceremonyTime(s) : '';
          const r = [s.n || '', s.tec || '', s.forma || '', s.nivel != null ? String(s.nivel) : '', tot == null ? '' : String(tot + cast.extra(i)), s.alc || '', s.dur || '', s.obj || '', [s.nota || '', slow].filter(Boolean).join(' · ')];
          if (anyM) r.splice(4, 0, m ? String(m) : '');
          return r;
        });
        tabla.replaceChildren(R.table({ id: 'pjh-' + id, _k: 'pjh', cols: cols, rows: rows, filters: [1, 2], num: anyM ? [3, 4, 5] : [3, 4], art: [1, 2], sort: 3, search: rows.length > 8, info: i => spellInfo(id, i) }));
      };
      content.appendChild(cast.node);
      drawTabla();
      content.appendChild(tabla);
      content.appendChild(h('p', { class: 'fh info-hint', text: 'Pulsa el nombre de un hechizo para ver su descripción.' }));
      const bd = magiaAura(pj, c).botch;
      content.appendChild(h('p', { class: 'note', text: 'Lanzamiento: Técnica + Forma (con sus Mañas) + ' + castCarTxt() + ' + aura (' + castAuraTxt(pj, c) + ')' + (anyM ? ' + maestría' : '') + (malusOf(pj) ? ' + malus por heridas y fatiga (' + sgn(malusOf(pj)) + ')' : '') + ' + voz y gestos + vis (en el hechizo elegido, de cada Arte no más peones que su puntuación)' + (cer ? ' + Artes Liberales + Filosofía (ceremonial)' : hz.some(isRitual) ? '; los rituales suman además Artes Liberales + Filosofía' : '') + (imp && impioOn() ? ' + el Arte más bajo otra vez (acto impío)' : '') + ', sin dado. Un hechizo formulaico se lanza sin fatiga si el total más el dado iguala su nivel.' + (bd ? ' En esta aura se tiran ' + bd + ' dados de pifia más.' : '') }));
      content.appendChild(h('p', { class: 'note', text: 'Ceremonial y rituales: 15 minutos por magnitud. En ArM5 el lanzamiento ceremonial es para hechizos espontáneos; con un formulaico hace falta la maestría Lanzamiento ceremonial (Houses of Hermes: Societates p. 60). La casilla se recuerda en este navegador.' }));
    } else content.appendChild(h('p', { class: 'note', text: 'Sin hechizos todavía.' }));
    if (canWrite()) content.appendChild(h('a', { class: 'btn ghost', href: '#pj--' + id + '--editar', style: 'align-self:flex-start', text: 'Añadir o cambiar hechizos' }));
  } else if (cur === 'virtudes') {
    const pts = l => l.reduce((s, x) => s + (x.valor === 'Mayor' ? 3 : x.valor === 'Menor' ? 1 : 0), 0);
    const V = pj.virtudes || [], D = pj.defectos || [];
    content.appendChild(R.stats({ items: [{ l: 'Virtudes', v: String(V.length), s: pts(V) + ' puntos' }, { l: 'Defectos', v: String(D.length), s: pts(D) + ' puntos' }] }));
    const tree = vdNest(pj);
    [['Virtudes', 'virtud'], ['Defectos', 'defecto']].forEach(([t, col]) => {
      content.appendChild(h('h3', { text: t }));
      // under each one, what it grants (a flaw given by a virtue goes under the virtue)
      const l = tree[col];
      if (l.length) content.appendChild(R.grid({ _k: 'vd-' + t, head: ['Nombre', 'Tipo', 'Valor', 'Nota'], body: l.map(it => [vdSub(it) + vdLabel(it.x, pj.genero), (it.x.cat || '') + (REINO_POW_TXT[it.x.reino] ? ', ' + REINO_POW_TXT[it.x.reino] : '') + (it.clase !== col ? ' (' + it.clase + ')' : ''), it.x.valor || '', it.x.nota || '']), fcl: true, stack: true, info: i => vdInfo(l[i].x, l[i].clase, pj.genero) }));
      else content.appendChild(h('p', { class: 'note', text: 'Ninguno.' }));
    });
    const fa = formaActiva(pj);
    if (fa && (fa.virtudes || []).concat(fa.defectos || []).length) {
      content.appendChild(h('h3', { text: 'Del ' + fa.n.toLowerCase() + ', mientras está transformado' }));
      content.appendChild(vdCards((fa.virtudes || []).concat(fa.defectos || []), x => (fa.defectos || []).includes(x) ? 'defecto' : 'virtud', pj.genero));
    }
  } else {
    if (pj.notas) String(pj.notas).split(/\n+/).forEach(p => content.appendChild(h('p', { text: p })));
    else content.appendChild(h('p', { class: 'note', text: 'Sin notas.' }));
  }
  page.appendChild(content);
  document.title = pj.nombre + ' — Europa Mítica';
  requestAnimationFrame(() => { const t = tabs.querySelector('[aria-current]'); if (t) tabs.scrollLeft = Math.max(0, t.offsetLeft - 40); });
}

/* ---------- the sheet (Ficha tab), laid out as a folio: a margin column with who the character is —Characteristics,
   confidence, warping, personality, Virtues and Flaws— and a text block with what they can do —the animal form, the
   Arts tabula (Technique × Form, the casting or lab totals in its cells) and the Abilities. Narrow screens stack it all
   in the order it is used at the table (ficha.css). */
function pjFicha(content, pj, c, id) {
  const fa = formaActiva(pj);
  const rail = h('div', { class: 'sheet-rail' }), main = h('div', { class: 'sheet-main' });
  rail.appendChild(sheetChars(pj, fa));
  rail.appendChild(sheetState(pj, c));
  rail.appendChild(sheetHurt(pj, id));
  const pers = sheetPers(pj);
  if (pers) rail.appendChild(pers);
  rail.appendChild(sheetVd(pj, id));
  if (fa) main.appendChild(formaBlock(pj, c, fa));
  const hasArts = ARTS.some(a => c.arts[a] > 0);
  if (hasArts || pj.tipo === 'Magus' || pj.tipo === 'Aprendiz') main.appendChild(sheetArts(pj, c, id));
  main.appendChild(sheetAbil(c, id, pj, fa));
  content.appendChild(h('div', { class: 'sheet' }, h('div', { class: 'sheet-in' }, [rail, main])));
}
const shHead = (id, t) => h('h3', { class: 'sh-h', id: id, text: t });
function sheetChars(pj, fa) {
  const car = pjCar(pj, fa);
  const sec = h('section', { class: 'sh-sec s-car', 'aria-labelledby': 'sh-car' }, [shHead('sh-car', 'Características')]);
  // the ArM5 pairs side by side: Inteligencia–Percepción, Fuerza–Vitalidad, Presencia–Comunicación, Destreza–Rapidez
  sec.appendChild(h('div', { class: 'chars sh-chars' }, CHARS.map(n => {
    const v = numv(car[n]), hum = fa && fa.car && n in fa.car ? 'humano ' + sgn(numv(pj.car && pj.car[n])) : '';
    return h('div', { class: hum ? 'alt' : null }, [h('div', { class: 'l', text: n }), h('div', { class: 'v' + (v < 0 ? ' neg' : ''), text: sgn(v) }), h('div', { class: 'd', text: hum })]);
  })));
  if (fa) sec.appendChild(h('p', { class: 'sh-aside', text: 'Las físicas son las del ' + fa.n.toLowerCase() + '; la mente sigue siendo la suya.' }));
  else if (formasOf(pj).length) {
    const por = String(formasOf(pj)[0].por || '').replace(/\s*\([^)]*\)\s*$/, '');
    sec.appendChild(h('p', { class: 'sh-aside', text: 'Puede transformarse en ' + formasOf(pj).map(x => x.n.toLowerCase()).join(' o ') + (por ? ' gracias a ' + por : '') + '.' }));
  }
  return sec;
}
/* a ledger: label (with an optional note) on the left, the figure —or a word, for Virtues and Flaws— on the right */
function ledger(cls, rows) {
  return h('ul', { class: 'sh-ledger ' + (cls || '') }, rows.map(r => h('li', { title: r.title || null }, [
    h('span', null, [r.info ? h('button', { type: 'button', class: 'info-btn', onclick: r.info }, r.l) : r.l].concat(r.n ? [' ', h('small', { text: r.n })] : [])), ' ',
    r.v != null ? h('b', { class: numv(r.neg) ? 'neg' : null }, [r.v].concat(r.u ? [h('small', { text: ' ' + r.u })] : [])) : h('i', { class: 'sh-val', text: r.s || '' })])));
}
function sheetState(pj, c) {
  const sec = h('section', { class: 'sh-sec s-est', 'aria-label': 'Confianza, informidad y experiencia' });
  sec.appendChild(ledger('sh-est', [
    { l: 'Confianza', v: String(numv(pj.confianza)) },
    { l: 'Informidad', n: fmt(c.inf) + ' puntos', v: String(abLvl(c.inf)) },
    { l: 'Experiencia anotada', v: fmt(c.total), u: 'px' }]));
  return sec;
}
function sheetHurt(pj, id) {
  const fa = formaActiva(pj), tam = fa ? numv(fa.tam) : numv(pj.tam), r = Math.max(1, 5 + tam);
  const can = canWrite() && !!id;
  let e = estadoFisico(pj);
  const sec = h('section', { class: 'sh-sec s-her', 'aria-labelledby': 'sh-her' }, [shHead('sh-her', 'Heridas y fatiga')]);
  const sum = h('div', { class: 'her-sum', 'aria-live': 'polite' });
  sec.appendChild(sum);
  const paint = () => {
    sum.innerHTML = '';
    sum.classList.toggle('on', !!(e.total || e.fuera));
    sum.appendChild(h('b', { class: e.total || e.fuera ? 'neg' : null, text: e.fuera ? '—' : e.total ? sgn(e.total) : '0' }));
    sum.appendChild(h('span', null, [h('span', { class: 'her-k', text: e.fuera || 'Malus a las tiradas' }),
      h('small', { text: e.total ? [e.her ? 'heridas ' + sgn(e.her) : '', e.fat ? 'fatiga ' + sgn(e.fat) : ''].filter(Boolean).join(', ') + '; no se aplica a la absorción' : 'Sin heridas ni cansancio que resten' })]));
  };
  paint();
  // wounds: one count per range
  const span = (a, b) => b == null ? a + '+' : a === b ? String(a) : a + '–' + b;
  const rng = [span(1, r), span(r + 1, 2 * r), span(2 * r + 1, 3 * r), span(3 * r + 1, 4 * r), span(4 * r + 1)];
  const grid = h('div', { class: 'her-grid' });
  sec.appendChild(grid);
  const colW = h('div', { class: 'her-col' }, [h('h4', { class: 'sh-rub', text: 'Heridas' + (fa ? ' con el tamaño del ' + fa.n.toLowerCase() + ' (' + sgn(tam) + ')' : '') })]);
  const colF = h('div', { class: 'her-col' }, [h('h4', { class: 'sh-rub', text: 'Fatiga' })]);
  grid.appendChild(colW); grid.appendChild(colF);
  const ul = h('ul', { class: 'sh-ledger her-list fx' });
  const ins = {};
  HER.forEach(([k, n, pen], i) => {
    const inp = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', class: 'her-in', value: String(e.n(k)), 'aria-label': 'Heridas: ' + n.toLowerCase(), disabled: can ? null : true });
    ins[k] = inp;
    inp.addEventListener('input', () => {
      const hw = {};
      HER.forEach(([kk]) => { hw[kk] = Math.max(0, Math.round(numv(ins[kk].value))); });
      e = estadoFisico(Object.assign({}, S.pj[id] || pj, { heridas: hw }));
      paint();
      saveHurt(id, { heridas: hw });
    });
    ul.appendChild(h('li', { class: e.n(k) ? 'on' : null }, [h('span', null, [n, ' ', h('small', { text: rng[i] + (pen ? ' · ' + sgn(pen) + ' cada una' : i === 3 ? ' · no puede actuar' : '') })]), inp]));
  });
  colW.appendChild(ul);
  // fatigue: the current level of the track
  const fl = h('div', { class: 'sh-ledger fat-list', role: 'radiogroup', 'aria-label': 'Nivel de fatiga' });
  e.tr.forEach((lv, i) => {
    const rb = h('input', { type: 'radio', name: 'fat-' + (id || 'x'), value: String(i), checked: i === e.fl ? true : null, disabled: can ? null : true });
    rb.addEventListener('change', () => {
      fl.querySelectorAll('label').forEach((x, j) => x.classList.toggle('on', j === i));
      e = estadoFisico(Object.assign({}, S.pj[id] || pj, { fatiga: i }));
      paint();
      saveHurt(id, { fatiga: i });
    });
    fl.appendChild(h('label', { class: 'fat-l' + (i === e.fl ? ' on' : ''), title: lv.t ? 'Se recupera con ' + lv.t + ' de descanso' : null }, [rb, h('span', null, [lv.n, lv.t ? h('small', { class: 'fat-t', text: lv.t + ' de descanso' }) : null]),
      h('small', { text: lv.p === null ? 'no puede actuar' : lv.p ? sgn(lv.p) : 'sin malus' })]));
  });
  colF.appendChild(fl);
  if (!can) sec.appendChild(h('p', { class: 'sh-aside', text: S.db ? 'Solo quien puede editar la saga marca heridas y fatiga.' : 'Inicia sesión para marcar heridas y fatiga.' }));
  return sec;
}
function sheetPers(pj) {
  const pers = (pj.personalidad || []).filter(t => t && String(t.n || '').trim());
  if (!pers.length) return null;
  const sec = h('section', { class: 'sh-sec s-pers', 'aria-labelledby': 'sh-pers' }, [shHead('sh-pers', 'Personalidad')]);
  sec.appendChild(ledger('sh-pers', pers.map(t => ({ l: String(t.n), v: sgn(numv(t.v)), neg: numv(t.v) < 0 ? 1 : 0 }))));
  return sec;
}
/* «↳ » before what another virtue or flaw grants, once per level */
const vdSub = it => it.depth ? ' '.repeat(it.depth - 1) + '↳ ' : '';
function sheetVd(pj, id) {
  const sec = h('section', { class: 'sh-sec s-vd', 'aria-label': 'Virtudes y defectos' });
  const cols = h('div', { class: 'sh-vdcols' });
  const tree = vdNest(pj);
  [['Virtudes', 'virtud', 'Ninguna.', 'sh-v'], ['Defectos', 'defecto', 'Ninguno.', 'sh-d']].forEach(([t, col, none, k]) => {
    const L = tree[col];
    cols.appendChild(h('div', { class: 'sh-vdcol' }, [shHead(k, t),
      L.length ? ledger('sh-vd', L.map(it => { const x = it.x; return { l: vdSub(it) + vdLabel(x, pj.genero), s: String(x.valor || '').toLowerCase() + (it.clase !== col ? ' · ' + it.clase : '') + (REINO_POW_TXT[x.reino] ? ' · ' + REINO_POW_TXT[x.reino] : ''), title: [x.cat, x.nota].filter(Boolean).join(' — ') || null, info: () => vdInfo(x, it.clase, pj.genero) }; }))
        : h('p', { class: 'sh-aside', text: none })]));
  });
  sec.appendChild(cols);
  if (id) sec.appendChild(h('a', { class: 'vd-more', href: '#pj--' + id + '--virtudes', text: 'Ver las notas de cada una' }));
  return sec;
}
/* the Arts tabula: Techniques across, Forms down, each with its score; the cells hold the totals (casting or laboratory) */
/* spontaneous casting (ArM5, Spontaneous Magic): with fatigue, (Casting Score + stress die) ÷ 2 and a Fatigue level;
   without, Casting Score ÷ 5 and no die. Ceremony adds Artes Liberales + Filosofía. The roll and the switches stay while
   the page is open. */
const ESP = { fat: true, tirada: '', cer: false, oscuro: false, voz: 0, gestos: 0, vis: '', visArt: '', visT: '', visF: '', hz: '', pj: null };
/* voice and gestures (ArM5, Casting Spells) and vis to boost the total (+2 a pawn, of the spell's Technique or Form,
   taken from the magus's own stock: pj.vis {Arte: peones}). For spontaneous spells they are added after dividing, as the
   saga's sheets (TruBros) do. */
const VOZ = [[1, 'Voz firme (+1)'], [0, 'Voz normal'], [-5, 'Voz baja (−5)'], [-10, 'Sin voz (−10)']];
const GESTOS = [[1, 'Gestos exagerados (+1)'], [0, 'Gestos normales'], [-2, 'Gestos sutiles (−2)'], [-5, 'Sin gestos (−5)']];
const visOf = pj => { const o = {}; Object.entries((pj && pj.vis) || {}).forEach(([a, n]) => { const v = Math.max(0, Math.round(numv(n))); if (ARTS.includes(a) && v) o[a] = v; }); return o; };
/* the magus's own vis, by Art: edited by hand (what they gather, buy or receive) */
function openVisPj(id) {
  const pj = S.pj[id];
  if (!pj) return;
  const v = visOf(pj);
  const ins = {};
  const grid = h('div', { class: 'art-inputs' }, ARTS.map(a => h('label', { class: 'ai', style: '--a:' + artVar(a) }, [h('span', { text: a }),
    ins[a] = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', value: v[a] ? String(v[a]) : '', placeholder: '0', 'aria-label': 'Peones de ' + a })])));
  const go = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const close = openModal('Reserva de vis de ' + pj.nombre, [h('p', { class: 'fh', text: 'Los peones que lleva el mago, por Arte. Los que gaste al lanzar se restan de aquí.' }), grid],
    [go, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')]);
  go.addEventListener('click', async () => {
    const out = {};
    ARTS.forEach(a => { const n = Math.max(0, Math.round(numv(ins[a].value))); if (n) out[a] = n; });
    const datos = stamp({ vis: out }, false);
    go.disabled = true;
    if (await dbWrite(() => S.db.doc('personajes/' + id).update(datos), 'Reserva de vis guardada')) { localPut('pj', id, Object.assign({}, S.pj[id] || pj, datos)); close(); }
    else go.disabled = false;
  });
}
const decs = v => Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '');
/* the casting controls are shared by the Arts tabula and the Hechizos tab. The vis chosen belongs to one character:
   it starts empty on another one */
function espDe(id) { if (ESP.pj !== id) { ESP.pj = id; ESP.vis = ''; ESP.visArt = ''; ESP.visT = ''; ESP.visF = ''; ESP.hz = ''; } }
const visPedidos = () => Math.max(0, Math.round(numv(ESP.vis)));
const vozGestosTxt = () => [ESP.voz ? 'voz ' + sgn(ESP.voz) : '', ESP.gestos ? 'gestos ' + sgn(ESP.gestos) : ''].filter(Boolean);
function vozGestos(onChange) {
  const sel = (label, list, k) => {
    const s = h('select', { 'aria-label': label }, list.map(([n, t]) => h('option', { value: String(n), text: t, selected: n === ESP[k] ? true : null })));
    s.addEventListener('change', () => { ESP[k] = Number(s.value); onChange(); });
    return s;
  };
  return [sel('Voz', VOZ, 'voz'), sel('Gestos', GESTOS, 'gestos')];
}
/* vis when casting (ArM5 core, «Using Raw Vis»): of the Technique or the Form, +2 a pawn, and of each Art no more pawns
   than the magus's score in it (a Puissant bonus is for totals, not for this limit). Both Arts may be used at once, each
   with its own limit. A Ritual spends a pawn per magnitude to be cast at all: those add nothing but count for the limit */
const visScore = (c, a) => artLvl(c.arts[a]);
const visMax = (c, reserva, a) => Math.min(visScore(c, a), reserva[a] || 0);
const visPor = (c, reserva, a) => (visScore(c, a) <= (reserva[a] || 0) ? 'su puntuación en ' + a : 'los que le quedan');
/* takes the pawns out of the magus's own stock: gasto {Art: pawns} */
async function gastarVis(id, gasto, para) {
  const pj = S.pj[id];
  const lista = Object.entries(gasto).filter(([a, n]) => a && n > 0);
  if (!pj || !lista.length) return false;
  const live = visOf(pj), nueva = Object.assign({}, live);
  for (const [a, n] of lista) {
    if ((live[a] || 0) < n) { toast('No le quedan tantos peones de ' + a + ': tiene ' + (live[a] || 0) + '.'); return false; }
    nueva[a] = live[a] - n;
    if (!nueva[a]) delete nueva[a];
  }
  const datos = stamp({ vis: nueva }, false);
  const msg = 'Gastados ' + lista.map(([a, n]) => n + (n === 1 ? ' peón' : ' peones') + ' de ' + a + ' (le quedan ' + (nueva[a] || 0) + ')').join(' y ') + (para ? ' en «' + para + '»' : '');
  const ok = await dbWrite(() => S.db.doc('personajes/' + id).update(datos), msg);
  if (ok) { ESP.vis = ''; ESP.visT = ''; ESP.visF = ''; localPut('pj', id, Object.assign({}, S.pj[id] || pj, datos)); }
  return ok;
}
function visReserva(id, pj) {
  const r = visOf(pj), arts = Object.keys(r);
  return h('div', { class: 'sh-vis' }, [h('span', { class: 'sh-vis-l', text: 'Reserva de vis' }),
    h('span', { text: arts.length ? arts.map(a => a + ' ' + r[a]).join(' · ') : 'sin peones' }),
    canWrite() ? h('button', { type: 'button', class: 'lnk', onclick: () => openVisPj(id) }, 'Editar') : null]);
}
/* the Hechizos tab: voice and gestures for every spell, and the vis spent on one of them, of its Technique and of its
   Form, each up to its limit. extra(i): what to add to the casting total of the spell i */
function spellCasting(id, pj, c, hz, aura, cer, onChange) {
  espDe(id);
  const reserva = visOf(pj);
  const artsDe = x => (x ? [...new Set([artOf(x.tec), artOf(x.forma)].filter(Boolean))] : []);
  const elegido = () => (ESP.hz === '' ? null : hz[Number(ESP.hz)] || null);
  if (!elegido()) ESP.hz = '';
  const pedido = k => Math.max(0, Math.round(numv(ESP[k])));
  // what the chosen spell takes: the pawns of each Art (asked, and as many as count), a Ritual's own and the bonus
  function cuenta() {
    const x = elegido();
    const por = artsDe(x).map((a, n) => { const k = n ? 'visF' : 'visT', max = visMax(c, reserva, a), q = pedido(k); return { a: a, k: k, max: max, q: q, n: Math.min(q, max) }; });
    const n = por.reduce((t, y) => t + y.n, 0), max = por.reduce((t, y) => t + y.max, 0);
    const need = x && isRitual(x) ? magnitude(x) : 0;
    return { x: x, por: por, n: n, max: max, need: need, bonus: 2 * Math.max(0, n - need), pasado: por.filter(y => y.q > y.max) };
  }
  const extra = i => ESP.voz + ESP.gestos + (String(i) === ESP.hz ? cuenta().bonus : 0);
  const hzSel = h('select', { 'aria-label': 'Hechizo en el que se gasta la vis' }, [h('option', { value: '', text: 'Elige el hechizo' })]
    .concat(hz.map((x, i) => h('option', { value: String(i), text: x.n || 'Sin nombre', selected: String(i) === ESP.hz ? true : null }))));
  const campos = h('span', { class: 'sp-cast-vis' });
  const res = h('p', { class: 'sh-aside sp-cast-res', 'aria-live': 'polite' });
  const gasta = canWrite() ? h('button', { type: 'button', class: 'btn ghost', id: 'vis-gasta-hz' }) : null;
  // one field for each Art of the chosen spell, with its limit
  function fill() {
    campos.replaceChildren(...cuenta().por.map(y => {
      const ip = h('input', { type: 'number', min: '0', max: String(y.max), step: '1', inputmode: 'numeric', value: ESP[y.k], placeholder: '0', class: 'aura-in', 'data-art': y.a, disabled: y.max ? null : true });
      ip.addEventListener('input', () => { ESP[y.k] = ip.value; cambia(); });
      return h('label', { class: 'sh-aura' }, ['Peones de ' + y.a + ' ', ip, h('small', { class: 'fh', text: 'máx. ' + y.max + ' (' + visPor(c, reserva, y.a) + ')' })]);
    }));
  }
  function draw() {
    const v = cuenta(), x = v.x, parts = vozGestosTxt();
    const gastados = v.por.filter(y => y.n).map(y => y.n + ' de ' + y.a).join(' y ');
    let txt = '';
    if (x) {
      const nombre = '«' + (x.n || 'Sin nombre') + '»', tot = spellTotal(pj, c, x, aura, cer), lv = Number(x.nivel);
      if (v.bonus) parts.push('vis +' + v.bonus + ' (' + gastados + ')');
      if (tot != null) {
        const t = tot + extra(Number(ESP.hz));
        txt = nombre + ': lanzamiento ' + t + (x.nivel !== '' && x.nivel != null && isFinite(lv) ? ' contra nivel ' + lv + ' (margen ' + sgn(t - lv) + ')' : '') + (parts.length ? ', con ' + parts.join(' + ') : '') + '.';
      } else txt = nombre + ' no tiene Técnica y Forma: edítalo para calcularlo.';
      if (v.need) txt += ' Es un ritual: necesita ' + v.need + (v.need === 1 ? ' peón' : ' peones') + ' para lanzarlo, que no suman'
        + (v.max < v.need ? '; ahora no puede reunirlos (su máximo es ' + v.max + ').' : v.n < v.need ? '; le faltan ' + (v.need - v.n) + ' por poner.' : '.');
      v.pasado.forEach(y => { txt += ' De ' + y.a + ' como mucho ' + y.max + ' (' + visPor(c, reserva, y.a) + ').'; });
    } else txt = parts.length ? 'Sumado a todos los hechizos: ' + parts.join(' + ') + '.' : 'Para gastar vis, elige el hechizo: solo vale la de su Técnica y su Forma, y de cada una no más peones que su puntuación en ese Arte.';
    res.textContent = txt;
    if (gasta) {
      gasta.textContent = v.n ? 'Gastar ' + v.por.filter(y => y.n).map(y => y.n + ' de ' + y.a).join(' y ') : 'Gastar los peones';
      gasta.disabled = !(v.n && !v.pasado.length && v.n >= v.need);
    }
  }
  const cambia = () => { draw(); onChange(); };
  hzSel.addEventListener('change', () => { ESP.hz = hzSel.value; ESP.visT = ''; ESP.visF = ''; fill(); cambia(); });
  if (gasta) gasta.addEventListener('click', async () => {
    const v = cuenta();
    if (!v.x) return;
    gasta.disabled = true;
    if (!(await gastarVis(id, Object.fromEntries(v.por.map(y => [y.a, y.n])), v.x.n))) gasta.disabled = false;
  });
  fill();
  draw();
  const node = h('div', { class: 'sp-cast' }, [h('div', { class: 'sh-esp sh-cast fx' }, [...vozGestos(cambia), hzSel, campos, gasta]), res, visReserva(id, pj)]);
  return { node: node, extra: extra };
}
function sheetArts(pj, c, id) {
  const MODES = ['Lanzamiento', 'Espontáneo', 'Laboratorio'];
  let mode = load('castgrid:pj-cg');
  if (!MODES.includes(mode)) mode = 'Lanzamiento';
  // Magia Sagrada: its Ability instead of Teoría Mágica, and the covenant's aura as Divine magic takes it
  const mfx = magiaFx(pj), teo0 = mfx.teoria;
  const habLvN = n => { const x = c.hab.find(y => tkey(y.n) === tkey(n)); return (x ? abLvl(x.xp) : 0) + manaHab(c, n); };
  // Magia Ctónica: for a dark or sinister effect its Ability may stand for Teoría Mágica in the lab
  const mtOf = () => ESP.oscuro && mfx.ctonica ? habLvN('Magia ctónica') : habLvN(teo0);
  const teoOf = () => ESP.oscuro && mfx.ctonica ? 'Magia ctónica' : teo0;
  const labA = magiaAura(pj, c, { tipo: 'magica', nivel: sagaAura() }), labAura = labA.mod;
  const car = pjCar(pj, formaActiva(pj)); // in another shape, its Characteristics
  const int = numv(car['Inteligencia']);
  const carT = t => numv(car[castCar(t)]); // Vitalidad, or with the homebrew rule the Technique's Characteristic
  const carNote = () => castCar('Creo') === 'Vitalidad' ? 'Vitalidad (' + sgn(numv(car['Vitalidad'])) + ')' : castCarTxt();
  const lv = a => artLvl(c.arts[a]) + manaArt(c, a);
  const est = estadoFisico(pj), mal = est.total;
  const ac = academic(c), canCer = ac.xp > 0;
  const sec = h('section', { class: 'sh-sec s-artes', 'aria-labelledby': 'sh-artes' });
  const seg = h('div', { class: 'cg-tools', role: 'group', 'aria-label': 'Totales que se muestran' });
  const auraIn = h('input', { type: 'number', id: 'aura-in', value: String(castAura(pj, c)), step: '1', inputmode: 'numeric', class: 'aura-in' });
  const auraBox = h('label', { class: 'sh-aura', for: 'aura-in' }, ['Aura ', auraIn]);
  sec.appendChild(h('div', { class: 'sh-arts-h' }, [shHead('sh-artes', 'Artes'), h('div', { class: 'sh-arts-tools fx' }, [seg, auraBox])]));
  // under the buttons, for spontaneous spells: effort, the die and the ceremony
  const fatSeg = h('div', { class: 'cg-tools', role: 'group', 'aria-label': 'Esfuerzo' });
  [['Con fatiga', true], ['Sin fatiga', false]].forEach(([t, v]) => fatSeg.appendChild(h('button', { type: 'button', class: 'seg', 'data-f': v ? '1' : '0', onclick: () => { ESP.fat = v; draw(); } }, t)));
  const tirIn = h('input', { type: 'number', id: 'esp-tirada', step: '1', inputmode: 'numeric', value: ESP.tirada, class: 'aura-in' });
  const tirBox = h('label', { class: 'sh-aura', for: 'esp-tirada' }, ['Tirada ', tirIn]);
  const cerIn = h('input', { type: 'checkbox', id: 'esp-cer', checked: ESP.cer && canCer ? true : null, disabled: canCer ? null : true });
  const cerBox = h('label', { class: 'chk cer', for: 'esp-cer' }, [cerIn, h('span', { text: 'Ceremonial' }),
    h('small', { class: 'fh', text: canCer ? sgn(ac.sum) + ' (Artes Liberales ' + ac.al + ', Filosofía ' + ac.fi + ') · 15 min por magnitud' : 'Sin Artes Liberales ni Filosofía' })]);
  const nextF = Math.min(est.tr.length - 1, est.fl + 1);
  const spend = canWrite() && id && est.fl < est.tr.length - 1 ? h('button', { type: 'button', class: 'btn ghost', id: 'esp-gasta',
    onclick: () => { saveHurt(id, { fatiga: nextF }); toast('Fatiga marcada: ' + est.tr[nextF].n.toLowerCase() + '.'); } }, 'Marcar el nivel de fatiga') : null;
  const espBox = h('div', { class: 'sh-esp fx' }, [fatSeg, tirBox, cerBox, spend]);
  sec.appendChild(espBox);
  // casting (formulaic or spontaneous): voice, gestures and the vis spent, from the magus's own stock
  espDe(id);
  const reserva = visOf(pj);
  const visArts = Object.keys(reserva);
  if (!visArts.includes(ESP.visArt)) ESP.visArt = visArts[0] || '';
  const visIn = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', value: ESP.vis, placeholder: '0', class: 'aura-in', 'aria-label': 'Peones de vis' });
  const visSel = h('select', { 'aria-label': 'Arte de la vis', disabled: visArts.length ? null : true },
    visArts.length ? visArts.map(a => h('option', { value: a, text: a + ' (' + reserva[a] + ')', selected: a === ESP.visArt ? true : null })) : [h('option', { value: '', text: 'Sin vis en su reserva' })]);
  const gasta = canWrite() && id ? h('button', { type: 'button', class: 'btn ghost', id: 'vis-gasta' }) : null;
  const castBox = h('div', { class: 'sh-esp sh-cast fx' }, [...vozGestos(() => draw()), h('label', { class: 'sh-aura' }, ['Peones de vis ', visIn]), visSel, gasta]);
  sec.appendChild(castBox);
  visIn.addEventListener('input', () => { ESP.vis = visIn.value; draw(); });
  visSel.addEventListener('change', () => { ESP.visArt = visSel.value; draw(); });
  if (gasta) gasta.addEventListener('click', async () => {
    gasta.disabled = true;
    if (!(await gastarVis(id, { [ESP.visArt]: visPedidos() }))) gasta.disabled = false;
  });
  // the magus's own vis, under the totals
  const visBox = id ? visReserva(id, pj) : null;
  // Magia Ctónica: the sinful act (every mode) and, in the lab, a dark effect
  const impBox = impioToggle(pj, () => draw());
  const oscIn = h('input', { type: 'checkbox', id: 'lab-oscuro', checked: ESP.oscuro ? true : null });
  oscIn.addEventListener('change', () => { ESP.oscuro = oscIn.checked; draw(); });
  const oscBox = mfx.ctonica ? h('label', { class: 'chk cer', for: 'lab-oscuro' }, [oscIn, h('span', { text: 'Efecto oscuro' }), h('small', { class: 'fh', text: 'Magia ctónica (' + habLvN('Magia ctónica') + ') en lugar de ' + teo0 + ' (' + habLvN(teo0) + ')' })]) : null;
  if (impBox || oscBox) sec.appendChild(h('div', { class: 'sh-esp fx' }, [impBox, oscBox]));
  tirIn.addEventListener('input', () => { ESP.tirada = tirIn.value; draw(); });
  cerIn.addEventListener('change', () => { ESP.cer = cerIn.checked; draw(); });
  const head = a => {
    const L = artLvl(c.arts[a]), b = manaArt(c, a), px = Math.round(c.arts[a] * 100) / 100, nxt = (L + 1) * (L + 2) / 2;
    const flags = [b ? 'Maña +' + b : '', c.fx.af.art.has(a) ? 'Afinidad' : ''].filter(Boolean);
    return { L: L, b: b, small: flags.concat([fmt(px) + ' px']).join(' · '),
      title: a + ': ' + L + (b ? ' + ' + b + ' de Maña' : '') + ' · ' + fmt(px) + ' px; faltan ' + fmt(Math.max(0, nxt - px)) + ' para el nivel ' + (L + 1) + (flags.includes('Afinidad') ? ' · Afinidad (×1,5 px)' : '') };
  };
  const artTh = (a, scope, cls) => {
    const x = head(a);
    return h('th', { scope: scope, class: cls, style: '--a:' + artVar(a), 'data-art': a, 'data-base': String(x.L), title: x.title }, [
      h('span', { class: 'mx-n' }, [h('span', { class: 'mx-full', text: a }), h('span', { class: 'mx-ab', 'aria-hidden': 'true', text: ABBR[a] })]),
      h('b', { class: 'mx-lv', text: String(x.L + x.b) }), h('small', { class: 'mx-px', text: x.small })]);
  };
  const table = h('table', { class: 'mx' });
  table.appendChild(h('colgroup', null, [h('col', { class: 'mx-c0' })].concat(ARTS_T.map(() => h('col')))));
  table.appendChild(h('thead', null, h('tr', null, [h('td', { class: 'mx-corner' })].concat(ARTS_T.map(t => artTh(t, 'col', 'mx-t'))))));
  const tb = h('tbody');
  table.appendChild(tb);
  sec.appendChild(h('div', { class: 'mx-frame' }, table));
  const note = h('p', { class: 'sh-aside mx-note' });
  sec.appendChild(note);
  if (visBox) sec.appendChild(visBox);
  function draw() {
    const lab = mode === 'Laboratorio', esp = mode === 'Espontáneo';
    const aura = numv(auraIn.value);
    const cer = esp && ESP.cer && canCer ? ac.sum : 0;
    const roll = esp && ESP.fat ? numv(ESP.tirada) : 0;
    const mt = mtOf(), teo = teoOf();
    const imp = impBox && impioOn();
    const low = (t, f) => imp ? Math.min(lv(t), lv(f)) : 0;
    const extra = lab ? int + mt + labAura : aura + cer + mal;
    const parts = (t, f) => [t + ' ' + lv(t), f + ' ' + lv(f)].concat(imp ? ['acto impío ' + low(t, f)] : []).concat(lab ? ['Inteligencia ' + sgn(int), teo + ' ' + mt, 'aura ' + sgn(labAura)].concat(labBonos(labDe(id), t, f).map(([l, v]) => l + ' ' + sgn(v)))
      : [castCar(t) + ' ' + sgn(carT(t)), 'aura ' + sgn(aura)].concat(cer ? ['ceremonial ' + sgn(cer)] : [], mal ? ['malus ' + sgn(mal)] : [], esp && ESP.fat ? ['tirada ' + roll] : [])).join(' + ');
    const labB = (t, f) => lab ? labBonos(labDe(id), t, f).reduce((s, x) => s + x[1], 0) : 0;
    // voice, gestures and vis: on casting totals only, after dividing a spontaneous one. The vis counts only where its Art
    // is the Technique or the Form, and no more than the magus has of it
    const peones = lab || !ESP.visArt ? 0 : Math.min(visPedidos(), visMax(c, reserva, ESP.visArt));
    const conVis = (t, f) => peones > 0 && (t === ESP.visArt || f === ESP.visArt);
    const post = (t, f) => lab ? 0 : ESP.voz + ESP.gestos + (conVis(t, f) ? 2 * peones : 0);
    const postTxt = (t, f) => lab ? '' : vozGestosTxt().concat(conVis(t, f) ? ['vis +' + 2 * peones] : []).join(' + ');
    const val = (t, f) => { const sc = lv(t) + lv(f) + low(t, f) + extra + labB(t, f) + (lab ? 0 : carT(t)); return (esp ? (ESP.fat ? (sc + roll) / 2 : sc / 5) : sc) + post(t, f); };
    const vals = ARTS_F.map(f => ARTS_T.map(t => val(t, f)));
    const all = [].concat(...vals), max = Math.max(...all), min = Math.min(...all);
    tb.innerHTML = '';
    ARTS_F.forEach((f, i) => tb.appendChild(h('tr', null, [artTh(f, 'row', 'mx-f')].concat(vals[i].map((v, j) => {
      const k = max > min ? (v - min) / (max - min) : 0;
      const expr = parts(ARTS_T[j], f), pt = postTxt(ARTS_T[j], f);
      return h('td', { style: '--k:' + Math.round(4 + k * 24) + '%', title: (esp ? '(' + expr + ') ÷ ' + (ESP.fat ? 2 : 5) : expr) + (pt ? ' + ' + pt : '') + ' = ' + decs(v), text: decs(v) });
    })))));
    table.setAttribute('aria-label', (lab ? 'Totales de laboratorio' : esp ? 'Totales de lanzamiento espontáneo' : 'Totales de lanzamiento') + ' por Técnica y Forma');
    seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === mode ? 'true' : 'false'));
    fatSeg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', (x.dataset.f === '1') === ESP.fat ? 'true' : 'false'));
    auraBox.hidden = lab;
    espBox.hidden = !esp;
    if (oscBox) oscBox.hidden = !lab;
    tirIn.disabled = !ESP.fat;
    if (spend) spend.hidden = !ESP.fat;
    const malTxt = mal ? ' + malus por heridas y fatiga (' + sgn(mal) + ')' : '';
    const auraTxt = String(aura) === String(castAura(pj, c)) ? castAuraTxt(pj, c) : sgn(aura);
    note.textContent = lab
      ? 'Laboratorio: Técnica + Forma + Inteligencia (' + sgn(int) + ') + ' + teo + ' (' + mt + ') + aura de la alianza (' + (labA.reino !== 'magica' || labA.lore ? magiaAuraTxt(labA) : sagaAura()) + ')'
        + (labDe(id) ? ' + su laboratorio (Calidad General y las Especializaciones de la Técnica y la Forma; las de actividades, en cada estación)' : '') + '. Incluye las Mañas; sin dado ni otras virtudes.'
      : esp ? (ESP.fat
        ? 'Espontáneo con fatiga: (Técnica + Forma + ' + carNote() + ' + aura (' + auraTxt + ')' + (cer ? ' + Artes Liberales y Filosofía (' + sgn(cer) + ')' : '') + malTxt + ' + tirada (' + (String(ESP.tirada).trim() === '' ? 'sin poner, cuenta 0' : roll) + ')) ÷ 2. Cuesta un nivel de fatiga.'
        : 'Espontáneo sin fatiga: (Técnica + Forma + ' + carNote() + ' + aura (' + auraTxt + ')' + (cer ? ' + Artes Liberales y Filosofía (' + sgn(cer) + ')' : '') + malTxt + ') ÷ 5, sin tirada.')
        + ' Sin redondear: el hechizo sale si el resultado llega a su nivel. Incluye las Mañas; sin otras virtudes.'
      : 'Lanzamiento: Técnica + Forma + ' + carNote() + ' + aura (' + auraTxt + ')' + malTxt + '. Incluye las Mañas; sin dado ni otras virtudes.';
    if (imp) note.textContent += ' Acto impío (Magia Ctónica): cada casilla suma otra vez el Arte más bajo de los dos.';
    castBox.hidden = lab;
    if (!lab && vozGestosTxt().length) note.textContent += ' Sumado' + (esp ? ' después de dividir' : '') + ': ' + vozGestosTxt().join(' + ') + '.';
    if (peones) note.textContent += ' Vis: +' + 2 * peones + ' (' + peones + ' de ' + ESP.visArt + '), solo en las casillas que usan ' + ESP.visArt + (esp ? ', después de dividir' : '') + '.';
    if (!lab && visPedidos() > peones && ESP.visArt) note.textContent += ' De ' + ESP.visArt + ' como mucho ' + visMax(c, reserva, ESP.visArt) + ' (' + visPor(c, reserva, ESP.visArt) + ').';
    if (gasta) {
      const n = visPedidos(), a = ESP.visArt;
      gasta.textContent = n && a ? 'Gastar ' + n + (n === 1 ? ' peón' : ' peones') + ' de ' + a : 'Gastar los peones';
      gasta.disabled = !n || !a || n > visMax(c, reserva, a);
    }
  }
  MODES.forEach(m => seg.appendChild(h('button', { type: 'button', class: 'seg', 'data-m': m, onclick: () => { mode = m; store('castgrid:pj-cg', m); draw(); } }, m)));
  auraIn.addEventListener('input', draw);
  // crosshair: the Technique and Form of the cell under the pointer
  const clear = () => table.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
  table.addEventListener('mouseover', e => {
    const td = e.target.closest('td');
    clear();
    if (!td || !td.parentNode || td.classList.contains('mx-corner')) return;
    td.classList.add('hl');
    const th = table.tHead.rows[0].cells[td.cellIndex];
    if (th) th.classList.add('hl');
    td.parentNode.cells[0].classList.add('hl');
  });
  table.addEventListener('mouseleave', clear);
  draw();
  return sec;
}
const habLv = (c, x) => abLvl(x.xp) + manaHab(c, x.n);
/* the floating buttons of the Abilities, one per Characteristic by its initials: pressing one turns each Ability into
   its roll (level + that Characteristic + the wound and fatigue malus, without the die); pressing it again goes back
   to the levels. The choice is kept while the page is open, so it survives the redraws of the sheet. */
const CAR_INI = { Inteligencia: 'In', Percepción: 'Pe', Fuerza: 'Fu', Vitalidad: 'Vi', Presencia: 'Pr', Comunicación: 'Co', Destreza: 'De', Rapidez: 'Ra' };
let habCar = '';
function sheetAbil(c, id, pj, fa) {
  const sec = h('section', { class: 'sh-sec s-hab', 'aria-labelledby': 'sh-hab' }, [shHead('sh-hab', 'Habilidades')]);
  const low = c.hab.filter(x => x.xp > 0 && habLv(c, x) < 1).length;
  const more = low && id ? h('a', { class: 'vd-more', href: '#pj--' + id + '--avance', text: low === 1 ? 'Una habilidad más en camino del nivel 1, en Avance' : low + ' habilidades más en camino del nivel 1, en Avance' }) : null;
  if (!c.hab.some(x => habLv(c, x) >= 1)) {
    sec.appendChild(h('p', { class: 'sh-aside', text: 'Ninguna habilidad de nivel 1 o más todavía.' }));
    if (more) sec.appendChild(more);
    return sec;
  }
  const car = pjCar(pj, fa), e = estadoFisico(pj);
  const note = h('p', { class: 'sh-aside hab-roll', 'aria-live': 'polite' });
  const block = h('div');
  const bar = h('div', { class: 'hab-cars', role: 'group', 'aria-label': 'Sumar una característica a las habilidades' });
  // supernatural Abilities belong to a realm (chosen on the virtue that grants them): the aura of the place adds or takes
  // as it does to that realm's powers
  const an = auraNow();
  const sob = n => { const r = habReino(pj, n); return r ? { reino: r, aura: habAura(pj, an.tipo, an.nivel, r) } : null; };
  const anySob = c.hab.some(x => habLv(c, x) >= 1 && sob(x.n));
  const draw = () => {
    const cv = habCar ? numv(car[habCar]) : 0;
    note.hidden = !habCar;
    note.textContent = !habCar ? '' : 'Tiradas con ' + habCar + ' (' + sgn(cv) + ')'
      + (e.total ? ' y el malus por heridas y fatiga (' + sgn(e.total) + ')' : ', sin malus por heridas ni fatiga')
      + ': nivel + característica' + (e.total ? ' + malus' : '') + ', sin el dado.' + (e.fuera ? ' ' + e.fuera + '.' : '')
      + (anySob ? ' Las sobrenaturales suman además el aura según su reino (' + (an.escena && an.lugar ? an.lugar + ', ' : '') + 'aura ' + auraTxt(an.tipo, an.nivel) + ').' : '')
      + ' Pulsa ' + CAR_INI[habCar] + ' otra vez para ver solo los niveles.';
    block.replaceChildren(abilBlock(c, habCar ? cv + e.total : null, sob, espCtl(id)));
    bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.car === habCar)));
  };
  CHARS.forEach(n => bar.appendChild(h('button', { type: 'button', class: 'hab-car', 'data-car': n, title: n + ' ' + sgn(numv(car[n])), 'aria-label': 'Sumar ' + n + ' (' + sgn(numv(car[n])) + ')',
    onclick: () => { habCar = habCar === n ? '' : n; draw(); } }, CAR_INI[n])));
  draw();
  [note, block, more, bar].forEach(x => { if (x) sec.appendChild(x); });
  return sec;
}
// the sheet lists the Abilities of level 1 or more; the ones still on their way to level 1 are in Avance (pjAvance).
// With mod (a Characteristic plus the malus), the figure is the roll and the level goes in small type.
// sob(name): {reino, aura} for a supernatural Ability; its roll adds the aura as its realm takes it
/* the specialty of an Ability: it is set from the sheet, once; after that only the master changes it.
   ctl(x): the small button by the Ability (null when this account may not touch it) */
function espCtl(id) {
  if (!id || !canWrite()) return null;
  return x => {
    const tiene = String(x.esp || '').trim();
    if (tiene && S.owner !== true) return null;
    return h('button', { type: 'button', class: 'esp-btn', title: tiene ? 'Cambiar la especialidad (solo el máster)' : 'Poner la especialidad',
      'aria-label': (tiene ? 'Cambiar la especialidad de ' : 'Poner especialidad a ') + x.n, onclick: () => openEsp(id, x) }, tiene ? 'cambiar' : '+ esp.');
  };
}
function openEsp(id, x) {
  const pj = S.pj[id];
  if (!pj) return;
  const master = S.owner === true;
  const ip = h('input', { type: 'text', value: String(x.esp || ''), maxlength: '60', autocomplete: 'off', placeholder: 'Por ejemplo: magos, espada, leer labios…' });
  const go = h('button', { type: 'button', class: 'btn' }, 'Guardar');
  const close = openModal('Especialidad de ' + x.n, [field('Especialidad', ip, master ? 'Como máster puedes cambiarla o quitarla cuando quieras.' : 'Piénsala bien: una vez puesta, solo el máster puede cambiarla.')],
    [go, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Cancelar')]);
  go.addEventListener('click', async () => {
    const v = ip.value.trim();
    if (!v && !master) { ip.focus(); toast('Escribe la especialidad.'); return; }
    const hab = JSON.parse(JSON.stringify((S.pj[id] || pj).hab || []));
    let r = hab.find(y => tkey(y.n) === tkey(x.n));
    if (r && String(r.esp || '').trim() && !master) { toast('Ya tiene especialidad: solo el máster puede cambiarla.'); close(); return; }
    if (!r) { r = { n: x.n, cat: x.cat || 'Otras', esp: '', base: 0 }; hab.push(r); }   // an Ability that only has the seasons' px
    r.esp = v;
    go.disabled = true;
    const datos = stamp({ hab: hab }, false);
    const ok = await dbWrite(() => S.db.doc('personajes/' + id).update(datos), v ? 'Especialidad guardada' : 'Especialidad quitada');
    if (ok) { localPut('pj', id, Object.assign({}, S.pj[id] || pj, datos)); close(); } else go.disabled = false;
  });
}

function abilBlock(c, mod, sob, ctl) {
  const groups = {};
  c.hab.forEach(x => { if (habLv(c, x) >= 1) (groups[x.cat || 'Otras'] = groups[x.cat || 'Otras'] || []).push(x); });
  const order = ABIL_CATS.filter(g => groups[g]).concat(Object.keys(groups).filter(g => !ABIL_CATS.includes(g)));
  return h('div', { class: 'abil' + (mod == null ? '' : ' roll') }, order.map(g => h('section', null, [h('h4', { text: g })].concat(groups[g].sort((x, y) => x.n.localeCompare(y.n, 'es')).map(x => {
    const L = abLvl(x.xp), need = abCost(L + 1) - x.xp, b = manaHab(c, x.n), lv = L + b, so = sob ? sob(x.n) : null;
    const roll = mod == null ? null : lv + mod + (so ? so.aura : 0);
    const tags = [b ? 'Maña ' + sgn(b) : '', x.af ? 'Afinidad' : '', so ? REINO_POW_TXT[so.reino] + (mod == null ? '' : ' · aura ' + sgn(so.aura)) : ''].filter(Boolean);
    return h('div', { 'data-base': String(L), title: fmt(x.xp) + ' px · faltan ' + fmt(need) + ' para el nivel ' + (L + 1) + (b ? ' · ' + L + ' + ' + b + ' de Maña' : '') + (so ? ' · reino ' + REINO_POW_TXT[so.reino] + ': el aura le da ' + sgn(so.aura) : '') }, [
      h('span', null, [h('span', { html: esc(x.n) + (x.esp ? ' <em>(' + esc(x.esp) + ')</em>' : '') + tags.map(t => ' <small class="vtag">' + esc(t) + '</small>').join('') }), ctl ? ctl(x) : null]),
      h('span', { class: 'ab-r' }, [h('small', { text: roll == null ? fmt(x.xp) + ' px' : 'nivel ' + lv }), h('b', { class: roll != null && roll < 0 ? 'neg' : null, text: roll == null ? String(lv) : sgn(roll) })])]);
  })))));
}
function pjAvance(content, id, entries, c) {
  const total = entries.reduce((s, e) => s + sumRep(e.reparto), 0);
  content.appendChild(R.stats({ items: [
    { l: 'Estaciones registradas', v: String(entries.length), s: entries.length ? sname(entries[0].anio, entries[0].est) + ' – ' + sname(entries[entries.length - 1].anio, entries[entries.length - 1].est) : '' },
    { l: 'Experiencia anotada', v: fmt(total), s: 'px' }] }));
  if (canWrite()) {
    const [ca, ce] = curSeason();
    const oa = h('input', { type: 'number', value: String(ca), min: '1000', max: '1500', inputmode: 'numeric', 'aria-label': 'Año' });
    const oe = h('select', { 'aria-label': 'Estación' }, SEASONS.map((s, i) => h('option', { value: i + 1, selected: i + 1 === ce ? true : null }, s)));
    content.appendChild(h('div', { class: 'actions fx' }, [h('button', { type: 'button', class: 'btn', onclick: () => openXpEditor(id, ca, ce) }, 'Repartir PX de ' + sname(ca, ce)),
      h('span', { class: 'other-season' }, [h('span', { class: 'fh', text: 'u otra estación:' }), oe, oa,
        h('button', { type: 'button', class: 'btn ghost', onclick: () => openXpEditor(id, parseInt(oa.value, 10) || ca, Number(oe.value)) }, 'Abrir')])]));
  }
  if (entries.length > 1 && total > 0) content.appendChild(R.chart({ kind: 'bars', x: entries.map(e => SEASONS[e.est - 1].slice(0, 3) + ' ' + e.anio), series: [{ n: 'PX', v: entries.map(e => sumRep(e.reparto)) }], y: 'PX', cap: 'Experiencia por estación' }));
  // Abilities with experience but still below level 1: not on the sheet yet
  const low = c ? c.hab.filter(x => x.xp > 0 && habLv(c, x) < 1).sort((a, b) => b.xp - a.xp || a.n.localeCompare(b.n, 'es')) : [];
  if (low.length) {
    const sec = h('section', { class: 'sh-sec av-low', 'aria-labelledby': 'av-low' }, [h('h3', { class: 'sh-h', id: 'av-low', text: 'Camino del nivel 1' }),
      h('p', { class: 'sh-aside', text: 'Habilidades con experiencia que aún no llegan a nivel 1 (5 px). Pasan a la ficha cuando lo alcanzan.' })]);
    sec.appendChild(ledger('av-low-l', low.map(x => ({ l: x.n + (x.esp ? ' (' + x.esp + ')' : ''), n: x.cat || '', v: fmt(x.xp), u: 'de 5 px' }))));
    content.appendChild(sec);
  }
  if (!entries.length) { content.appendChild(h('p', { class: 'note', text: 'Sin estaciones registradas.' })); return; }
  const tl = h('div', { class: 'tl' });
  let year = null;
  entries.slice().reverse().forEach(e => {
    if (e.anio !== year) { year = e.anio; tl.appendChild(h('div', { class: 'tl-year', text: String(year) })); }
    tl.appendChild(h('div', { class: 'tl-item', 'data-k': 'av.' + e._id }, [
      h('div', { class: 's', text: SEASONS[e.est - 1] }),
      h('div', { class: 'px', html: sumRep(e.reparto) ? esc(fmt(sumRep(e.reparto))) + ' <small>px</small>' : '' }),
      h('div', null, [
        h('div', { class: 'a' }, [h('span', { text: [e.tipo, e.actividad].filter(Boolean).join(' · ') || 'Sin descripción' }),
          canWrite() ? h('button', { type: 'button', class: 'lnk', onclick: () => openXpEditor(id, e.anio, e.est) }, 'Editar') : null]),
        (e.reparto || []).length ? h('div', { class: 'subj' }, e.reparto.map(r => h('span', { text: r.r + ' ' + signed(numv(r.px)) }))) : null,
        e.lab ? h('div', { class: 'lab-line', text: labSummary(e) }) : null,
        e.nota ? h('div', { class: 'note', text: e.nota }) : null])]));
  });
  content.appendChild(tl);
}

/* ---------- search + routing */
function sagaIndex(push) {
  Object.keys(S.pj).forEach(id => {
    const p = S.pj[id];
    push({ dyn: true, href: '#pj--' + id, group: 'Saga en curso · Personajes', sub: 'Ficha', t: [p.nombre, p.sub, p.tipo, p.casa, p.jugador, p.concepto].filter(Boolean).join(' · ') });
    (p.hechizos || []).forEach(s => push({ dyn: true, href: '#pj--' + id + '--hechizos', group: 'Saga en curso · Personajes', sub: p.nombre + ' · Hechizos', t: [s.n, s.tec, s.forma, s.nivel ? 'nivel ' + s.nivel : ''].filter(Boolean).join(' · ') }));
  });
  Object.keys(S.av).forEach(k => {
    const e = S.av[k], p = S.pj[e.pj];
    if (!p) return;
    push({ dyn: true, href: '#pj--' + e.pj + '--avance', focus: 'av.' + k, group: 'Saga en curso · Estaciones', sub: p.nombre + ' · ' + sname(e.anio, e.est), t: [e.tipo, e.actividad, (e.reparto || []).map(r => r.r + ' ' + signed(numv(r.px))).join(', ')].filter(Boolean).join(' · ') });
  });
}
function sagaRoute(raw) {
  if (raw === 'estaciones' || raw.startsWith('estaciones--')) { viewSeasons(raw.split('--')[1]); return true; }
  if (raw === 'personajes') { viewCharacters(); return true; }
  if (raw === 'armeria') { viewArmeria(); return true; }
  if (raw === 'cronica') { viewCronica(); return true; }
  if (raw.startsWith('alianza--')) { const p = raw.split('--'); viewAlianza(p[1], p[2]); return true; }
  if (raw === 'master' || raw.startsWith('master--')) { viewMaster(raw.split('--')[1]); return true; }
  if (raw === 'hb' || raw.startsWith('hb--')) { const p = raw.split('--'); viewHb(p[1], p[2]); return true; }
  if (raw.startsWith('hbal--')) { const p = raw.split('--'); viewCov(p[1], p[2]); return true; }
  if (raw === 'pj-nuevo') { viewEditor(null); return true; }
  if (raw.startsWith('pj--')) { const p = raw.split('--'); if (p[2] === 'editar') viewEditor(p[1]); else viewPj(p[1], p[2]); return true; }
  return false;
}

export { ledger, sagaIndex, sagaRoute, shHead };
