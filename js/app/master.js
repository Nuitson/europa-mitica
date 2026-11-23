/* La pantalla del máster. */
import { ABBR, artOf, DOCS, esc, h, LIBROS, load, R, scrollHint, store, toNum } from './base.js';
import { castCarTxt, HB_KEY, hbActive, hbGroups, hbOn, HOMEBREW, homebrewOf, homebrewOn } from './saga/homebrew.js';
import { page } from './views.js';
import { KEYP, S, TIPOS, TIPOS_PL, tkey } from './saga/state.js';
import { confirmButton, field, monogram, pjsSorted, sagaCrumbs, statusNote, toast } from './saga/core.js';
import { edadTxt, AURA_TIPOS, AURA_X, auraNow, auraTxt, botchDice, calc, canCeremony, canWrite, ceremonialOn, ceremonyToggle, curSeason, entriesOf, estadoFisico, estadoTxt, formaActiva, formaButtons, formasOf, isRitual, malusOf, numv, REALM_POW, realmMod, refocusCer, sagaAura, sgn, spellTotal, vdCards, vdTreeCards, impioToggle, magiaAura, magiaAuraTxt } from './saga/rules.js';
import { writeEstado } from './saga/seasons.js';
import { spellInfo } from './info.js';
import { GENERO_TXT } from './creation/rules.js';
import { cargarAstro, cielo, cuando, fechaError, hora, MESES } from './astro.js';

/* ================================================================== PANTALLA DEL MÁSTER
   Solo para el máster (quien es máster de la saga). El aura de la escena —reino y nivel— cambia los totales de lanzamiento
   de todas las fichas según la tabla de interacción de reinos de ArM5 (cap. 12, «Realms»): para la magia hermética,
   aura mágica ×1, feérica ×½ (redondeando hacia arriba), divina ×−3 e infernal ×−1, y en un aura de otro reino un dado de
   pifia más por cada punto de aura. El laboratorio sigue usando el aura de la alianza. Un desplegable muestra los rasgos
   de personalidad, virtudes y defectos de cualquier personaje, y sus hechizos con el aura elegida. */
const MST = { tipo: null, nivel: null, lugar: null, redraw: null };

const M_TABS = [['escena', 'Escena'], ['saga', 'La saga en la web'], ['homebrew', 'Homebrew'], ['libros', 'Libros', 'dev']];
/* «dev»: only for the developers of the web (accounts with the administrator level) */
const isDev = () => !!(window.EM_WEB && window.EM_WEB.user && window.EM_WEB.user.admin);
const mTabs = () => M_TABS.filter(t => t[2] !== 'dev' || isDev());

function viewMaster(tab) {
  page.innerHTML = '';
  MST.redraw = null; MST.drawAura = null;
  page.appendChild(sagaCrumbs([['Pantalla del máster', null]]));
  page.appendChild(h('h1', { class: 'doc-title', text: 'Pantalla del máster' }));
  document.title = 'Pantalla del máster — Europa Mítica';
  const cur = mTabs().some(t => t[0] === tab) ? tab : 'escena';
  if (S.owner === true) {
    const tabs = h('div', { class: 'tabs', role: 'navigation', 'aria-label': 'Pestañas de la pantalla del máster' },
      mTabs().map(([k, t]) => h('a', { class: 'tab', href: k === 'escena' ? '#master' : '#master--' + k, 'aria-current': k === cur ? 'page' : null,
        text: t + (k === 'homebrew' && hbCount() ? ' · ' + hbCount() : '') })));
    page.appendChild(h('div', { class: 'tabs-wrap' }, tabs));
    scrollHint(tabs, tabs.querySelector('[aria-current="page"]'));
  }
  const content = h('div', { class: 'content fx' });
  page.appendChild(content);
  const note = statusNote(); if (note) content.appendChild(note);
  if (S.owner !== true) {
    content.appendChild(h('p', { class: 'note', text: window.EM_WEB.offline ? 'Sin conexión: la pantalla del máster necesita el servidor de la saga.' : S.owner == null && S.db ? 'Comprobando quién eres…' : 'Esta pantalla es solo para el máster: entra en la saga con el código de máster.' }));
    return;
  }
  if (cur === 'saga') { content.appendChild(masterWeb()); return; }
  if (cur === 'homebrew') { content.appendChild(masterHomebrew()); content.appendChild(masterHbContent()); return; }
  if (cur === 'libros') { content.appendChild(masterLibros()); return; }
  content.appendChild(h('p', { class: 'doc-blurb', text: 'Elige el aura de la escena: al aplicarla cambian los totales de lanzamiento de todas las fichas. Debajo, cualquier personaje con sus rasgos de personalidad, virtudes y defectos.' }));
  content.appendChild(h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => window.print() }, 'Imprimir la pantalla')));
  content.appendChild(masterAura());
  content.appendChild(masterFecha());
  content.appendChild(masterPjs());
}

/* ---------- the date of the session and its sky (js/app/astro.js); kept in this browser, per saga */
const EST_DIA = { 1: [3, 21], 2: [6, 21], 3: [9, 21], 4: [12, 21] };
function masterFecha() {
  const sec = h('section', { class: 'm-sec', 'aria-labelledby': 'm-fe-h' });
  sec.appendChild(h('h2', { class: 'm-h', id: 'm-fe-h', text: 'Fecha de la partida' }));
  sec.appendChild(h('p', { class: 'doc-blurb', text: 'El cielo del día de la partida: el Sol, la Luna y los planetas en los signos, la fase de la Luna y lo que cambia ese día. Calendario juliano hasta el 4 de octubre de 1582; horas en hora solar de Arazas.' }));
  let f = null;
  try { f = JSON.parse(load(KEYP + 'master-fecha') || 'null'); } catch (e) { f = null; }
  if (!f || !f.y) { const [y, est] = curSeason(), md = EST_DIA[est] || [3, 21]; f = { y: y, m: md[0], d: md[1] }; }
  const dia = h('input', { type: 'number', id: 'm-dia', min: '1', max: '31', step: '1', inputmode: 'numeric', value: String(f.d) });
  const mes = h('select', { id: 'm-mes' }, MESES.map((n, i) => h('option', { value: String(i + 1), selected: i + 1 === f.m ? true : null }, n)));
  const anio = h('input', { type: 'number', id: 'm-anio', min: '900', max: '1600', step: '1', inputmode: 'numeric', value: String(f.y) });
  sec.appendChild(h('div', { class: 'm-form' }, h('div', { class: 'm-fecha' }, [field('Día', dia), field('Mes', mes), field('Año', anio)])));
  const out = h('div', { class: 'm-astro-out', 'aria-live': 'polite' });
  sec.appendChild(out);
  const draw = () => {
    const y = parseInt(anio.value, 10), m = parseInt(mes.value, 10), d = parseInt(dia.value, 10);
    const err = fechaError(y, m, d);
    out.innerHTML = '';
    if (err) { out.appendChild(h('p', { class: 'note', text: err })); return; }
    store(KEYP + 'master-fecha', JSON.stringify({ y: y, m: m, d: d }));
    out.appendChild(h('p', { class: 'note', text: 'Cargando el calendario…' }));
    cargarAstro().then(A => {
      if (fechaError(parseInt(anio.value, 10), parseInt(mes.value, 10), parseInt(dia.value, 10)) || parseInt(anio.value, 10) !== y || parseInt(mes.value, 10) !== m || parseInt(dia.value, 10) !== d) return;
      out.innerHTML = '';
      out.appendChild(astroView(cielo(A, y, m, d), y, m, d));
    }).catch(() => { out.innerHTML = ''; out.appendChild(h('p', { class: 'note', text: 'No se ha podido cargar el calendario astrológico (data/astro.json).' })); });
  };
  [dia, mes, anio].forEach(x => x.addEventListener(x === mes ? 'change' : 'input', draw));
  draw();
  return sec;
}
function astroView(c, y, m, d) {
  const box = h('div', { class: 'm-astro' });
  const cap = s => s[0].toUpperCase() + s.slice(1);
  box.appendChild(h('p', { class: 'm-now' }, [h('span', { class: 'fl', text: 'Ese día' }),
    h('span', { text: cap(c.dia) + ', ' + d + ' de ' + MESES[m - 1] + ' de ' + y + (c.gregoriano ? ' (gregoriano)' : '') + ' · día de ' + c.diaPl + (c.diaRef ? ': ' + c.diaRef.ambito : '') })]));
  const sol = c.sol, luna = c.luna, fa = luna && luna.fase;
  box.appendChild(R.stats({ items: [
    sol ? { l: 'Sol', v: sol.signo.n, s: ['1.er', '2.º', '3.er'][sol.dec] + ' decanato · ' + sol.signo.cualidad.toLowerCase() } : { l: 'Sol', v: '—' },
    luna ? { l: 'Luna', v: luna.signo.n, s: fa ? (fa.crece ? 'creciente' : 'menguante') : '' } : { l: 'Luna', v: '—' },
    { l: 'Día de', v: c.diaPl, s: c.diaRef ? c.diaRef.car : '' }] }));

  if (sol) {
    const g = sol.signo;
    box.appendChild(h('h3', { class: 'm-sub', text: 'El Sol en ' + g.n }));
    box.appendChild(R.kv({ cls: 'compact', items: [
      ['En el signo', 'desde el ' + cuando(sol.desde, y) + (sol.hasta != null ? '; entra en ' + sol.sigue + ' el ' + cuando(sol.hasta, y) : '')],
      ['Decanato', ['1.er', '2.º', '3.er'][sol.dec] + ': ' + sol.decTxt],
      ['Magia cíclica', g.genero + ' (±3), ' + g.cualidad.toLowerCase() + ' (±5), ' + g.elemento.toLowerCase() + ' (±6) · humor ' + g.humor.toLowerCase() + ' · regente ' + g.regente],
      g.cualidad === 'Mutable' ? ['Mutable', 'Signo mutable: actúan las virtudes y defectos mutables.'] : null,
      sol.est.length ? ['Duración Año', 'hasta la salida del Sol del ' + (sol.est[3] ? sol.est[3].n.toLowerCase() + ' del ' + cuando(sol.est[3].t, y, true) : '4.º equinoccio o solsticio') + ' (lanzado ese día). Próximo: ' + sol.est[0].n.toLowerCase() + ', ' + cuando(sol.est[0].t, y)] : null
    ].filter(Boolean) }));
  }
  if (luna) {
    box.appendChild(h('h3', { class: 'm-sub', text: 'La Luna en ' + luna.signo.n }));
    box.appendChild(R.kv({ cls: 'compact', items: [
      ['En el signo', 'desde el ' + cuando(luna.desde, y) + (luna.hasta != null ? ' hasta el ' + cuando(luna.hasta, y) : '')],
      fa ? ['Fase', (fa.crece ? 'Creciente' : 'Menguante') + ': ' + fa.ant.toLowerCase() + ' el ' + cuando(fa.antT, y) + '; ' + fa.sig.toLowerCase() + ' el ' + cuando(fa.sigT, y)] : null,
      fa && fa.nueva != null && fa.llena != null ? ['Duración Luna', 'hasta que se hayan puesto la próxima luna nueva (' + cuando(fa.nueva, y) + ') y la próxima luna llena (' + cuando(fa.llena, y) + ')'] : null
    ].filter(Boolean) }));
  }
  box.appendChild(h('h3', { class: 'm-sub', text: 'Los planetas' }));
  box.appendChild(R.grid({ _k: 'm-astro-pl', cls: 'm-astro-t', fcl: true, stack: true, head: ['Planeta', 'Signo', 'Desde', 'Hasta', 'Ámbito'],
    body: c.planetas.map(p => [p.n + (p.ref ? ' (' + p.ref.car + ')' : ''), p.signo ? p.signo.n + (p.retro ? ', entró retrógrado' : '') : '—',
      p.desde != null ? cuando(p.desde, y, true) : '—', p.hasta != null ? cuando(p.hasta, y, true) : '—', p.ref ? p.ref.ambito : '']) }));
  box.appendChild(h('h3', { class: 'm-sub', text: 'Durante el día' }));
  box.appendChild(c.hoy.length ? h('ul', { class: 'm-hoy' }, c.hoy.map(e => h('li', null, [h('b', { text: e.t == null ? 'Todo el día' : hora(e.t) }), document.createTextNode(e.txt)])))
    : h('p', { class: 'note', text: 'Ese día no cambia nada: ni signos ni fases.' }));
  box.appendChild(h('p', { class: 'note', html: 'Signos a mediodía. Magia cíclica, virtudes mutables y duraciones: <i>Ars Magica</i> 5.ª ed., p. 41, 52 y 112, y <i>The Mysteries</i>, cap. 4 y 6.' }));
  return box;
}

/* ---------- homebrew: fanmade rules the master switches on for the whole saga (saga/estado → homebrew) */
const hbCount = () => HOMEBREW.filter(r => homebrewOn(r.k)).length + hbActive().length;
/* the material from blogs: one button per type and author («Teotimus · Hechizos») adds it to the saga or takes it out */
function masterHbContent() {
  const sec = h('section', { class: 'm-sec', 'aria-labelledby': 'm-hbc-h' });
  sec.appendChild(h('h2', { class: 'm-h', id: 'm-hbc-h', text: 'Material de blogs' }));
  sec.appendChild(h('p', { class: 'doc-blurb', text: 'Magos, aprendices, alianzas, objetos mágicos y hechizos fanmade, por tipo y autor. Lo que añadas sale en la barra lateral, en «Homebrew», para toda la saga; los hechizos entran además en el catálogo de las fichas.' }));
  const groups = hbGroups();
  if (!groups.length) { sec.appendChild(h('p', { class: 'note', text: 'No hay material de blogs en la web (data/homebrew/).' })); return sec; }
  const tipos = [];
  groups.forEach(g => { if (!tipos.includes(g.tipo)) tipos.push(g.tipo); });
  tipos.forEach(t => {
    const row = h('div', { class: 'hb-row', role: 'group', 'aria-label': t });
    groups.filter(g => g.tipo === t).forEach(g => {
      const on = hbOn(g.k);
      const n = [g.textos ? g.textos + (g.textos === 1 ? ' entrada' : ' entradas') : '', g.hechizos ? g.hechizos + ' hechizos' : ''].filter(Boolean).join(' · ');
      const b = h('button', { type: 'button', class: 'hb-tog', 'aria-pressed': on ? 'true' : 'false', disabled: canWrite() ? null : true,
        title: (on ? 'Quitar de la saga: ' : 'Añadir a la saga: ') + g.autor + ' · ' + t + ((g.blogs || []).length ? ' (' + g.blogs.join(', ') + ')' : '') },
        [h('span', { class: 'hb-tog-i', 'aria-hidden': 'true', text: on ? '✓' : '+' }), h('b', { text: g.autor + ' · ' + t }), h('small', { text: n })]);
      b.addEventListener('click', async () => {
        b.disabled = true;
        const next = Object.assign({}, homebrewOf());
        if (on) delete next[HB_KEY(g.k)]; else next[HB_KEY(g.k)] = true;
        if (!await writeEstado({ homebrew: next }, (on ? 'Quitado de la saga: ' : 'Añadido a la saga: ') + g.autor + ' · ' + t)) b.disabled = !canWrite();
      });
      row.appendChild(h('span', { class: 'hb-item' }, [b, h('a', { class: 'lnk hb-see', href: '#hb--' + g.k, text: on ? 'Ver' : 'Vista previa' })]));
    });
    sec.appendChild(h('h3', { class: 'm-sub', text: t }));
    sec.appendChild(row);
  });
  if (!canWrite()) sec.appendChild(h('p', { class: 'note', text: 'Sin permiso para guardar: no se puede cambiar.' }));
  return sec;
}
function masterHomebrew() {
  const sec = h('section', { class: 'm-sec', 'aria-labelledby': 'm-hb-h' });
  sec.appendChild(h('h2', { class: 'm-h', id: 'm-hb-h', text: 'Reglas caseras' }));
  sec.appendChild(h('p', { class: 'doc-blurb', text: 'Reglas fanmade que no son de los libros de Ars Magica. Las que actives aquí se aplican a todas las fichas de la saga; las desactivadas no cambian nada.' }));
  if (!HOMEBREW.length) {
    sec.appendChild(h('p', { class: 'note', text: 'Todavía no hay reglas caseras. Cuando se añadan, aparecerán aquí para activarlas o desactivarlas.' }));
    return sec;
  }
  const on = homebrewOf();
  const list = h('div', { class: 'hb-list', role: 'list' });
  HOMEBREW.forEach(r => {
    const id = 'hb-' + r.k;
    const cb = h('input', { type: 'checkbox', id: id, checked: on[r.k] === true ? true : null, disabled: canWrite() ? null : true });
    cb.addEventListener('change', async () => {
      cb.disabled = true;
      const next = Object.assign({}, homebrewOf(), { [r.k]: cb.checked });
      if (!next[r.k]) delete next[r.k];
      if (!await writeEstado({ homebrew: next }, (cb.checked ? 'Regla casera activada: ' : 'Regla casera desactivada: ') + r.n)) cb.checked = !cb.checked;
      cb.disabled = !canWrite();
    });
    list.appendChild(h('div', { class: 'hb-rule', role: 'listitem' }, [
      h('label', { class: 'chk', for: id }, [cb, h('b', { text: r.n })]),
      r.desc ? h('p', { class: 'hb-desc', text: r.desc }) : null,
      r.fuente ? h('small', { class: 'xt', text: 'Fuente: ' + r.fuente }) : null]));
  });
  sec.appendChild(list);
  if (!canWrite()) sec.appendChild(h('p', { class: 'note', text: 'Sin permiso para guardar: no se pueden cambiar.' }));
  return sec;
}

/* ---------- books: how far the compendium of virtues and flaws is filled in, book by book (data/ayudas.json + data/libros.json) */
function librosEstado() {
  const doc = DOCS['virtudes-defectos'], by = new Map();
  if (!doc) return [];
  doc.sheets.filter(sh => sh.id === 'virtudes' || sh.id === 'defectos').forEach(sh => sh.blocks.filter(b => b.t === 'table').forEach(b => {
    const c = n => b.cols.indexOf(n);
    const [iN, iL, iP, iD] = [c('Nombre'), c('Libro'), c('Pág.'), c('Descripción')];
    b.rows.forEach(r => {
      const pag = String(r[iP] || ''), ab = pag.split(/\s+/)[0];
      const k = String(r[iL] || '') || ab || '—';
      if (!by.has(k)) by.set(k, { libro: k, abs: {}, v: 0, d: 0, desc: 0, es: 0 });
      const x = by.get(k);
      if (LIBROS.libros[ab]) x.abs[ab] = (x.abs[ab] || 0) + 1;
      x[sh.id === 'virtudes' ? 'v' : 'd']++;
      if (iD >= 0 && String(r[iD] || '').trim()) x.desc++;
      if (LIBROS.es[ab + '|' + r[iN] + '|' + pag]) x.es++;
    });
  }));
  // the books the web knows (data/libros.json) without any entry yet («El Tribunal de Iberia») are listed too
  const con = new Set([...by.values()].flatMap(x => Object.keys(x.abs)));
  const slugs = new Set([...con].map(ab => LIBROS.libros[ab].slug));
  Object.keys(LIBROS.libros).forEach(ab => {
    if (con.has(ab) || slugs.has(LIBROS.libros[ab].slug)) return;
    by.set('ab:' + ab, { libro: LIBROS.libros[ab].nombre, abs: { [ab]: 0 }, v: 0, d: 0, desc: 0, es: 0 });
  });
  const ORD = ['Completo', 'En curso', 'Pendiente', 'Sin libro en castellano', 'Sin entradas'];
  return [...by.values()].map(x => {
    const ab = Object.keys(x.abs).sort((a, b) => x.abs[b] - x.abs[a])[0] || '', bk = LIBROS.libros[ab] || null;
    const n = x.v + x.d, esPdf = !!(bk && bk.es);
    const estado = !n ? 'Sin entradas' : x.desc >= n ? 'Completo' : x.desc ? 'En curso' : esPdf ? 'Pendiente' : 'Sin libro en castellano';
    return Object.assign(x, { ab: ab, bk: bk, n: n, esPdf: esPdf, estado: estado, nombre: (bk && bk.nombre) || x.libro });
  }).sort((a, b) => ORD.indexOf(a.estado) - ORD.indexOf(b.estado) || (b.n && b.desc / b.n) - (a.n && a.desc / a.n) || b.n - a.n);
}
function masterLibros() {
  const sec = h('section', { class: 'm-sec', 'aria-labelledby': 'm-lib-h' });
  sec.appendChild(h('h2', { class: 'm-h', id: 'm-lib-h' }, ['Virtudes y defectos por libro', h('span', { class: 'vtag', text: 'Solo desarrolladores' })]));
  sec.appendChild(h('p', { class: 'doc-blurb', html: 'Lo que tiene ya el <a class="lnk" href="#virtudes-defectos">compendio de virtudes y defectos</a> de cada libro: el texto completo del libro (columna «Descripción»), y el enlace a la página del PDF en castellano. Un libro está completo cuando todas sus entradas tienen el texto del libro.' }));
  const L = librosEstado();
  if (!L.length) { sec.appendChild(h('p', { class: 'note', text: 'No se ha podido leer el compendio de virtudes y defectos.' })); return sec; }
  const tot = L.reduce((s, x) => ({ n: s.n + x.n, desc: s.desc + x.desc }), { n: 0, desc: 0 });
  const cnt = e => L.filter(x => x.estado === e).length;
  sec.appendChild(h('div', { class: 'lib-sum' }, [
    ['Libros', String(L.length)], ['Completos', String(cnt('Completo'))], ['En curso', String(cnt('En curso'))],
    ['Entradas con texto', tot.desc + ' de ' + tot.n + ' (' + Math.round(100 * tot.desc / tot.n) + ' %)']].map(([l, v]) => h('div', null, [h('span', { class: 'l', text: l }), h('b', { text: v })]))));
  const bar = (a, n) => h('span', { class: 'lib-bar', role: 'img', 'aria-label': a + ' de ' + n }, [h('span', { class: 'lib-bar-t' }, h('i', { style: 'width:' + (n ? Math.round(100 * a / n) : 0) + '%' })), h('span', { class: 'lib-bar-n', text: a + '/' + n })]);
  const pdf = (href, t, title) => h('a', { class: 'ref-a' + (t === 'ES' ? ' ref-es' : ''), href: href, target: '_blank', rel: 'noopener', title: title, text: t });
  const tb = h('tbody');
  L.forEach(x => {
    const links = h('span', { class: 'lib-pdf' }, [x.bk && x.bk.en ? pdf(x.bk.en, 'EN', 'Abrir el PDF en inglés') : null, x.esPdf ? pdf(x.bk.es, 'ES', 'Abrir el PDF en castellano') : null]);
    tb.appendChild(h('tr', null, [
      h('td', { class: 'lib-n' }, [h('b', { text: x.nombre }), h('small', { text: [x.ab, x.nombre !== x.libro ? x.libro : ''].filter(Boolean).join(' · ') }), links]),
      h('td', { class: 'num', text: String(x.v) }),
      h('td', { class: 'num', text: String(x.d) }),
      h('td', null, x.n ? bar(x.desc, x.n) : h('span', { class: 'xt', text: 'Aún no hay entradas en el compendio' })),
      h('td', null, x.esPdf ? bar(x.es, x.n) : h('span', { class: 'xt', text: 'Sin PDF' })),
      h('td', null, h('span', { class: 'vtag lib-st' + (x.estado === 'Completo' ? ' ok' : x.estado === 'En curso' ? ' warn' : ''), text: x.estado }))]));
  });
  sec.appendChild(h('div', { class: 'tw' }, h('table', { class: 'mini lib-t' }, [
    h('thead', null, h('tr', null, ['Libro', 'Virtudes', 'Defectos', 'Texto del libro', 'Página en castellano', 'Estado'].map(t => h('th', { scope: 'col', text: t })))), tb])));
  return sec;
}

/* ---------- the scene aura */
function masterAura() {
  const now = auraNow();
  if (MST.tipo == null) { MST.tipo = now.tipo; MST.nivel = now.nivel; MST.lugar = now.escena ? now.lugar : ''; }
  const sec = h('section', { class: 'm-sec', 'aria-labelledby': 'm-aura-h' });
  sec.appendChild(h('h2', { class: 'm-h', id: 'm-aura-h', text: 'Aura de la escena' }));
  const nowP = h('p', { class: 'm-now' });
  const modNow = realmMod(now.tipo, now.nivel, 'magica');
  nowP.appendChild(h('span', { class: 'fl', text: 'Ahora en la saga' }));
  nowP.appendChild(h('span', { text: (now.escena ? (now.lugar || 'Escena') : 'Alianza') + ': aura ' + auraTxt(now.tipo, now.nivel) + ' → magia hermética ' + sgn(modNow) }));
  sec.appendChild(nowP);

  const segs = h('div', { class: 'cg-tools', role: 'group', 'aria-label': 'Tipo de aura' });
  AURA_TIPOS.forEach(([k, t]) => segs.appendChild(h('button', { type: 'button', class: 'seg', 'data-t': k, onclick: () => { MST.tipo = k; draw(); } }, t)));
  const nivel = h('input', { type: 'number', id: 'm-nivel', min: '0', max: '10', step: '1', inputmode: 'numeric', value: String(MST.nivel) });
  nivel.addEventListener('input', () => { const n = parseInt(nivel.value, 10); MST.nivel = isFinite(n) ? Math.max(0, Math.min(10, n)) : 0; draw(); });
  const lugar = h('input', { type: 'text', id: 'm-lugar', value: MST.lugar || '', placeholder: 'Por ejemplo, la iglesia de Boltaña', autocomplete: 'off' });
  lugar.addEventListener('input', () => { MST.lugar = lugar.value; });
  sec.appendChild(h('div', { class: 'm-form' }, [
    field('Reino del aura', segs),
    h('div', { class: 'fld-row m-row' }, [field('Nivel (0 a 10)', nivel), field('Lugar', lugar, 'Opcional: sale en las fichas.')])]));

  const eff = h('div', { class: 'm-eff' });
  sec.appendChild(eff);
  const apply = h('button', { type: 'button', class: 'btn', id: 'm-apply' }, 'Aplicar a la saga');
  apply.addEventListener('click', async () => {
    apply.disabled = true;
    const esc0 = { tipo: MST.tipo, nivel: MST.nivel, lugar: String(MST.lugar || '').trim() };
    await writeEstado({ escena: esc0 }, 'Aura de la escena: ' + (esc0.lugar ? esc0.lugar + ', ' : '') + auraTxt(esc0.tipo, esc0.nivel));
    apply.disabled = false;
  });
  const back = h('button', { type: 'button', class: 'btn ghost', id: 'm-back' }, 'Volver a la alianza');
  back.addEventListener('click', async () => {
    back.disabled = true;
    if (await writeEstado({ escena: null }, 'De vuelta en la alianza: aura ' + auraTxt('magica', sagaAura()))) { MST.tipo = 'magica'; MST.nivel = sagaAura(); MST.lugar = ''; }
    back.disabled = false;
  });
  const keep = h('button', { type: 'button', class: 'btn ghost', id: 'm-keep' }, 'Guardar lugar');
  keep.addEventListener('click', async () => {
    const n = String(MST.lugar || '').trim();
    if (!n) { toast('Escribe el nombre del lugar para guardarlo.'); lugar.focus(); return; }
    const list = lugaresOf().filter(x => tkey(x.n) !== tkey(n)).concat([{ n: n, tipo: MST.tipo, nivel: MST.nivel }]);
    keep.disabled = true;
    await writeEstado({ lugares: list }, 'Lugar guardado: ' + n);
    keep.disabled = false;
  });
  sec.appendChild(h('div', { class: 'actions' }, canWrite() ? [apply, back, keep] : [h('p', { class: 'note', text: 'Sin permiso para guardar: los cambios solo se ven aquí.' })]));

  const places = lugaresOf();
  if (places.length) {
    const box = h('div', { class: 'm-places', role: 'list', 'aria-label': 'Lugares guardados' });
    places.forEach((x, i) => {
      const go = h('button', { type: 'button', class: 'chip m-place', title: 'Usar este lugar', onclick: () => { MST.tipo = x.tipo; MST.nivel = numv(x.nivel); MST.lugar = x.n; nivel.value = String(MST.nivel); lugar.value = x.n; draw(); } },
        [document.createTextNode(x.n + ' '), h('small', { text: auraTxt(x.tipo, numv(x.nivel)) })]);
      const del = canWrite() ? h('button', { type: 'button', class: 'x m-del', 'aria-label': 'Quitar ' + x.n, title: 'Quitar', onclick: async () => {
        await writeEstado({ lugares: places.filter((_, j) => j !== i) }, 'Lugar quitado: ' + x.n);
      } }, '×') : null;
      box.appendChild(h('span', { class: 'm-pl', role: 'listitem' }, [go, del]));
    });
    sec.appendChild(h('div', { class: 'fld' }, [h('span', { class: 'fl', text: 'Lugares guardados' }), box]));
  }
  sec.appendChild(h('p', { class: 'note', html: 'Tabla de interacción de reinos de <i>Ars Magica</i> 5ª ed., cap. 12 (Reinos): el modificador se suma a los totales de lanzamiento; los medios se redondean hacia arriba. En un aura de otro reino se tira un dado de pifia más por cada punto de aura. El laboratorio usa el aura de la alianza (' + esc(auraTxt('magica', sagaAura())) + ').' }));

  function draw() {
    segs.querySelectorAll('.seg').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === MST.tipo ? 'true' : 'false'));
    const m = realmMod(MST.tipo, MST.nivel, 'magica'), bd = botchDice(MST.tipo, MST.nivel, 'magica');
    eff.innerHTML = '';
    eff.appendChild(R.stats({ items: [
      { l: 'Magia hermética', v: sgn(m), s: 'a los totales de lanzamiento' },
      { l: 'Dados de pifia', v: bd ? '+' + bd : '0', s: bd ? 'más al lanzar en esta aura' : 'sin dados extra' }] }));
    eff.appendChild(R.grid({ _k: 'm-realms', cls: 'narrow', head: ['Poder de reino', 'Modificador', 'Dados de pifia'], fcl: true,
      body: AURA_TIPOS.map(([k]) => [REALM_POW[k], sgn(realmMod(MST.tipo, MST.nivel, k)), String(botchDice(MST.tipo, MST.nivel, k) || '—')]) }));
    if (MST.redraw) MST.redraw();
  }
  MST.drawAura = draw;
  draw();
  return sec;
}
function lugaresOf() { const l = S.estado && S.estado.lugares; return Array.isArray(l) ? l.filter(x => x && String(x.n || '').trim() && AURA_X[x.tipo]) : []; }

/* ---------- a character's personality, virtues, flaws and spells */
function masterPjs() {
  const sec = h('section', { class: 'm-sec', 'aria-labelledby': 'm-pj-h' });
  sec.appendChild(h('h2', { class: 'm-h', id: 'm-pj-h', text: 'Personajes' }));
  const all = pjsSorted(true);
  if (!all.length) { sec.appendChild(h('p', { class: 'note', text: 'Todavía no hay personajes en la saga.' })); return sec; }
  let cur = load(KEYP + 'master-pj') || all[0]._id;
  if (cur !== '*' && !S.pj[cur]) cur = all[0]._id;
  const s = h('select', { id: 'm-pj' });
  s.appendChild(h('option', { value: '*', selected: cur === '*' ? true : null }, 'Todos los personajes'));
  TIPOS.forEach(t => {
    const list = all.filter(p => (TIPOS.includes(p.tipo) ? p.tipo : 'Otro') === t);
    if (list.length) s.appendChild(h('optgroup', { label: TIPOS_PL[t] }, list.map(p => h('option', { value: p._id, selected: p._id === cur ? true : null }, p.nombre))));
  });
  const out = h('div', { class: 'm-pjs' });
  const draw = () => {
    out.innerHTML = '';
    const list = cur === '*' ? all : all.filter(p => p._id === cur);
    list.forEach(p => out.appendChild(masterCard(p, cur === '*')));
  };
  s.addEventListener('change', () => { cur = s.value; store(KEYP + 'master-pj', cur); draw(); });
  sec.appendChild(h('div', { class: 'm-pick' }, field('Personaje', s)));
  sec.appendChild(out);
  MST.redraw = draw;
  draw();
  return sec;
}
function masterCard(p, compact) {
  const id = p._id, c = calc(p, entriesOf(id));
  const [ca] = curSeason();
  const card = h('article', { class: 'm-card', 'aria-label': p.nombre });
  card.appendChild(h('div', { class: 'm-card-h' }, [monogram(p, 'mono'), h('div', { class: 'm-id' }, [
    h('a', { class: 'm-name', href: '#pj--' + id, text: p.nombre }),
    h('div', { class: 'xt', text: [p.tipo, p.casa, GENERO_TXT[p.genero] ? 'género ' + GENERO_TXT[p.genero] : '', edadTxt(ca, p.nacimiento), p.jugador ? 'juega ' + p.jugador : ''].filter(Boolean).join(' · ') })])]));
  // wounds and fatigue marked on the sheet: the master sees the malus at a glance
  const et = estadoTxt(p);
  if (et) card.appendChild(h('p', { class: 'm-her' + (estadoFisico(p).fuera ? ' out' : ''), text: et }));
  const fa = formaActiva(p);
  if (formasOf(p).length) card.appendChild(h('div', { class: 'actions m-forma' }, [fa ? h('span', { class: 'badge-cur forma-on', text: 'En forma de ' + fa.n.toLowerCase() }) : null].concat(formaButtons(id, p))));
  const pers = (p.personalidad || []).filter(t => t && String(t.n || '').trim());
  card.appendChild(h('h3', { class: 'm-sub', text: 'Rasgos de personalidad' }));
  card.appendChild(pers.length ? h('div', { class: 'pers-chips' }, pers.map(t => h('span', { class: 'rep', text: t.n + ' ' + sgn(numv(t.v)) })))
    : h('p', { class: 'note', text: 'Sin rasgos anotados en la ficha.' }));
  [['Virtudes', p.virtudes], ['Defectos', p.defectos]].forEach(([t, l]) => {
    const L = (Array.isArray(l) ? l : []).filter(x => x && String(x.n || '').trim());
    const pts = L.reduce((s, x) => s + (x.valor === 'Mayor' ? 3 : x.valor === 'Menor' ? 1 : 0), 0);
    card.appendChild(h('h3', { class: 'm-sub', text: t + (L.length ? ' · ' + L.length + ' (' + pts + ' puntos)' : '') }));
    if (L.length) card.appendChild(vdTreeCards(p, t === 'Virtudes' ? 'virtud' : 'defecto'));
    else card.appendChild(h('p', { class: 'note', text: 'Ninguno.' }));
  });
  if (fa && (fa.virtudes || []).concat(fa.defectos || []).length) {
    card.appendChild(h('h3', { class: 'm-sub', text: 'Del ' + fa.n.toLowerCase() + ', mientras está transformado' }));
    card.appendChild(vdCards((fa.virtudes || []).concat(fa.defectos || []), x => (fa.defectos || []).includes(x) ? 'defecto' : 'virtud', p.genero));
  }
  const sp = (p.hechizos || []).filter(x => x && String(x.n || '').trim());
  if (sp.length) {
    // the aura as this magus's magic takes it (Magia Sagrada, Verdadera Comprensión de los Reinos)
    const ma = magiaAura(p, c, { tipo: MST.tipo, nivel: MST.nivel }), m = ma.mod, cer = ceremonialOn() && canCeremony(c);
    const rows = sp.map(x => {
      const tot = spellTotal(p, c, x, m, cer), lv = toNum(x.nivel);
      return { x: x, r: [x.n, [x.tec, x.forma].filter(Boolean).map(a => ABBR[artOf(a)] || a).join(''), x.nivel != null ? String(x.nivel) : '', tot == null ? '' : String(tot),
        tot == null || !isFinite(lv) ? '' : sgn(tot - lv)] };
    }).sort((a, b) => { // highest total first; spells without a total (unknown Art) last
      const x = toNum(a.r[3]), y = toNum(b.r[3]), fx = isFinite(x), fy = isFinite(y);
      return fx && fy ? y - x : fx ? -1 : fy ? 1 : 0;
    });
    const body = rows.map(o => o.r);
    const wrap = h('details', { class: 'm-spells', open: compact ? null : true });
    wrap.appendChild(h('summary', null, [h('span', { class: 'm-sub', text: 'Hechizos con el aura elegida · ' + sp.length }), h('small', { text: magiaAuraTxt(ma) })]));
    wrap.appendChild(ceremonyToggle(c, refocusCer));
    const imp = impioToggle(p, refocusCer);
    if (imp) wrap.appendChild(imp);
    wrap.appendChild(R.grid({ _k: 'm-sp-' + id, head: ['Hechizo', 'Arte', 'Nivel', 'Lanzamiento', 'Margen'], body: body, fcl: true, info: i => spellInfo(id, (p.hechizos || []).indexOf(rows[i].x)) }));
    wrap.appendChild(h('p', { class: 'note', text: 'Lanzamiento: Técnica + Forma (con sus Mañas) + ' + castCarTxt() + ' + aura' + (sp.some(x => numv(x.maestria) > 0) ? ' + maestría' : '') + (malusOf(p) ? ' + malus por heridas y fatiga (' + sgn(malusOf(p)) + ')' : '') + (cer ? ' + Artes Liberales + Filosofía (ceremonial, 15 min por magnitud)' : sp.some(isRitual) ? '; los rituales suman además Artes Liberales + Filosofía' : '') + ', sin dado. Margen: lanzamiento menos nivel; con el dado, si llega a 0 el hechizo sale sin fatiga, y hasta −10 sale gastando un nivel de fatiga.' }));
    card.appendChild(wrap);
  }
  return card;
}

/* ================================================================== PANTALLA DEL MÁSTER · LA SAGA EN LA WEB
   The saga's members, who plays each character, a backup copy and importing one. */
function masterWeb() {
  const W = window.EM_WEB;
  const sec = h('section', { class: 'm-sec m-web', 'aria-labelledby': 'm-web-h' }, [h('h2', { class: 'm-h', id: 'm-web-h', text: 'La saga en la web' })]);
  const s = W.saga;
  sec.appendChild(h('p', { class: 'doc-blurb', text: 'Los datos de la ' + s.nombre + ' se guardan en la base de datos de la web.' }));

  // members: who is in the saga and with which role (the master adds people by their username)
  const lista = h('div', { class: 'members' });
  const avatarMini = (m, px) => {
    const a = h('span', { class: 'avatar', style: 'width:' + px + 'px;height:' + px + 'px;font-size:' + Math.round(px * 0.42) + 'px', 'aria-hidden': 'true' });
    if (m.avatar) a.appendChild(h('img', { src: m.avatar, alt: '' })); else a.textContent = String(m.nombre || m.usuario).slice(0, 1).toUpperCase();
    return a;
  };
  const yo = W.user ? W.user.usuario : null;
  let miembros = [];
  function pintaMiembros() {
    lista.innerHTML = '';
    miembros.forEach(m => {
      const rol = h('select', { 'aria-label': 'Rol de ' + m.nombre }, [h('option', { value: 'master', text: 'Máster' }), h('option', { value: 'jugador', text: 'Jugador' })]);
      rol.value = m.rol;
      rol.addEventListener('change', async () => {
        try { miembros = (await W.api('cambiarRol', { usuario: m.usuario, rol: rol.value })).miembros; toast(m.nombre + ' ahora es ' + (rol.value === 'master' ? 'máster' : 'jugador') + '.'); }
        catch (e) { toast(e.message || 'No se ha podido cambiar el rol.'); }
        pintaMiembros(); pintaAsignar();
      });
      const quitar = confirmButton('Quitar', 'Pulsa otra vez para quitar', async () => {
        try { miembros = (await W.api('quitarMiembro', { usuario: m.usuario })).miembros; toast(m.nombre + ' ya no está en la saga.'); }
        catch (e) { toast(e.message || 'No se ha podido quitar.'); }
        pintaMiembros(); pintaAsignar();
      });
      lista.appendChild(h('div', { class: 'member' }, [avatarMini(m, 36),
        h('div', { class: 'member-t' }, [h('b', { text: m.nombre + (m.usuario === yo ? ' (tú)' : '') }), h('small', { text: '@' + m.usuario })]), rol, quitar]));
    });
    if (!miembros.length) lista.appendChild(h('p', { class: 'note', text: 'Cargando los miembros…' }));
  }
  const nuevo = h('input', { type: 'text', id: 'm-nuevo', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none', placeholder: 'usuario' });
  const nuevoRol = h('select', { id: 'm-nuevo-rol', 'aria-label': 'Rol' }, [h('option', { value: 'jugador', text: 'Jugador' }), h('option', { value: 'master', text: 'Máster' })]);
  const add = h('button', { type: 'button', class: 'btn' }, 'Añadir a la saga');
  add.addEventListener('click', async () => {
    const u = nuevo.value.trim().replace(/^@/, '');
    if (!u) { toast('Escribe el usuario de quien quieras añadir.'); return; }
    add.disabled = true;
    try { miembros = (await W.api('anadirMiembro', { usuario: u, rol: nuevoRol.value })).miembros; nuevo.value = ''; toast('Añadido a la saga.'); pintaMiembros(); pintaAsignar(); }
    catch (e) { toast(e.message || 'No se ha podido añadir.'); }
    add.disabled = false;
  });
  sec.appendChild(h('h3', { class: 'm-sub', text: 'Quién está en la saga' }));
  sec.appendChild(h('p', { class: 'note', text: 'Cada persona entra con su cuenta. Para que alguien juegue en la saga, tiene que crearse una cuenta y tú la añades aquí con su usuario. Un máster puede cambiar los roles y quitar a cualquiera; la saga siempre necesita al menos un máster.' }));
  sec.appendChild(lista);
  sec.appendChild(h('div', { class: 'fld-row fx' }, [field('Usuario', nuevo), field('Rol', nuevoRol)]));
  sec.appendChild(h('div', { class: 'actions' }, [add]));

  // characters and their players: whose each character is (it appears in that account's «Mis creaciones»)
  const asig = h('div', { class: 'members' });
  let autores = {};
  function pintaAsignar() {
    asig.innerHTML = '';
    const pjs = pjsSorted(true);
    if (!pjs.length) { asig.appendChild(h('p', { class: 'note', text: 'Todavía no hay personajes.' })); return; }
    pjs.forEach(p => {
      const s = h('select', { 'aria-label': 'Jugador de ' + p.nombre }, [h('option', { value: '', text: 'De nadie' })].concat(miembros.map(m => h('option', { value: m.usuario, text: m.nombre + ' (@' + m.usuario + ')' }))));
      s.value = autores['personajes/' + p._id] || '';
      s.addEventListener('change', async () => {
        try { await W.api('asignar', { ruta: 'personajes/' + p._id, usuario: s.value || null }); autores['personajes/' + p._id] = s.value; toast(s.value ? p.nombre + ' asignado.' : p.nombre + ' ya no es de nadie.'); }
        catch (e) { toast(e.message || 'No se ha podido asignar.'); s.value = autores['personajes/' + p._id] || ''; }
      });
      asig.appendChild(h('div', { class: 'member' }, [h('div', { class: 'member-t' }, [h('b', { text: p.nombre }), h('small', { text: [p.tipo, p.jugador ? 'jugador: ' + p.jugador : ''].filter(Boolean).join(' · ') })]), s]));
    });
  }
  sec.appendChild(h('h3', { class: 'm-sub', text: 'Personajes y jugadores' }));
  sec.appendChild(h('p', { class: 'note', text: 'Elige de quién es cada personaje: aparecerá en «Mis creaciones» de esa cuenta, junto con sus hechizos. Lo que cada uno crea desde ahora queda a su nombre sin hacer nada.' }));
  sec.appendChild(asig);
  pintaMiembros(); pintaAsignar();
  Promise.all([W.api('miembros'), W.api('autores')]).then(([m, a]) => { miembros = m.miembros; autores = a.autores || {}; pintaMiembros(); pintaAsignar(); },
    e => { lista.innerHTML = ''; lista.appendChild(h('p', { class: 'note', text: e.message || 'No se han podido cargar los miembros.' })); });

  // backup
  const down = h('button', { type: 'button', class: 'btn ghost' }, 'Descargar una copia');
  down.addEventListener('click', async () => {
    down.disabled = true;
    try {
      const r = await W.api('exportar');
      const blob = new Blob([JSON.stringify(r, null, 1)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: tkey(s.nombre) + '-' + new Date().toISOString().slice(0, 10) + '.json' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Copia descargada: ' + Object.keys(r.docs || {}).length + ' documentos.');
    } catch (e) { toast(e.message || 'No se ha podido descargar la copia.'); }
    down.disabled = false;
  });
  const file = h('input', { type: 'file', accept: 'application/json,.json', id: 'm-imp', hidden: true });
  const repl = h('input', { type: 'checkbox', id: 'm-repl' });
  const up = h('button', { type: 'button', class: 'btn ghost', onclick: () => file.click() }, 'Importar una copia');
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    let d;
    try { d = JSON.parse(await f.text()); } catch (e) { toast('Ese archivo no es una copia de la saga.'); return; }
    if (!d || typeof d.docs !== 'object') { toast('Ese archivo no es una copia de la saga.'); return; }
    toast('Importando…');
    try {
      const r = await W.api('importar', { docs: d.docs, archivo: d.archivo || null, reemplazar: repl.checked });
      await W.refresh();
      toast('Importados ' + r.n + ' documentos.' + (d.archivo ? ' Recarga la página para ver las hojas de Excel.' : ''));
    } catch (e) { toast(e.message || 'No se ha podido importar.'); }
  });
  sec.appendChild(h('h3', { class: 'm-sub', text: 'Copia de seguridad' }));
  sec.appendChild(h('p', { class: 'note', text: 'Una copia de todos los personajes, estaciones y movimientos en un archivo. Importarla junta su contenido con el de la saga; marca la casilla para sustituir lo que hay.' }));
  sec.appendChild(h('div', { class: 'actions' }, [down, up, file, h('label', { class: 'chk', for: 'm-repl' }, [repl, h('span', { text: 'Sustituir lo que hay' })])]));
  return sec;
}

export { viewMaster };
