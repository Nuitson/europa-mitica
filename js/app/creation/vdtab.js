/* La pestaña para elegir virtudes y defectos al crear o editar un personaje: el compendio entero con buscador y
   filtros, una descripción corta de cada uno (al pulsarla se lee entera) y una casilla para elegirlo o quitarlo.
   Ocupa toda la pantalla sobre el editor, que sigue debajo con lo que ya se ha rellenado. Al abrirse enseña el Libro
   básico y las propias de la saga (los demás libros se añaden en «Libros»), y la lista va por páginas.
   «Crear virtud o defecto» añade uno propio de la saga (virtudes/{id}): solo existe en ella, no en el compendio común
   ni en las sagas que se creen después. Lo cambia o lo borra quien lo creó o un máster. */
import { h, norm } from '../base.js';
import { S, tkey, VD_CATS } from '../saga/state.js';
import { confirmButton, dbWrite, field, openModal, sel, stamp } from '../saga/core.js';
import { newId } from '../saga/rules.js';
import { FX_OBJ, PROPIAS, SLOT_TXT, vdEffTxt, vdEntry, vdFx, vdGen, vdIndex, vdSlots } from './rules.js';

const PAGE = 24;   // cards per page: whole rows with one, two, three or four columns
const SHORT = 150; // characters of the short description
const VALORES = [['', 'Cualquier valor'], ['Mayor', 'Mayor (3)'], ['Menor', 'Menor (1)'], ['Gratuita', 'Gratuita'], ['Especial', 'Especial']];
// the values a virtue or a flaw of the saga can have (no flaw in the books is free)
const VALS = { virtud: ['Menor', 'Mayor', 'Gratuita', 'Especial'], defecto: ['Menor', 'Mayor', 'Especial'] };
const VAL_TXT = { Menor: 'Menor (1 punto)', Mayor: 'Mayor (3 puntos)', Gratuita: 'Gratuita', Especial: 'Especial' };
const short = s => {
  if (s.length <= SHORT) return s;
  const cut = s.lastIndexOf(' ', SHORT - 1);
  return s.slice(0, cut > SHORT * 0.6 ? cut : SHORT - 1).replace(/[\s,;:.]+$/, '') + '…';
};
const CORE = 'Libro básico';
const bookOf = e => e.core ? CORE : (e.libro || 'Sin libro');
// the books in groups, as the table of the sourcebooks is read: the rest go to «Otros libros»
const GRUPOS = [
  ['Reinos', ['Realms of Power: Magic', 'Realms of Power: The Divine', 'Realms of Power: The Infernal', 'Realms of Power: Faerie']],
  ['Casas de Hermes', ['Houses of Hermes: True Lineages', 'Houses of Hermes: Mystery Cults', 'Houses of Hermes: Societates', 'Magi of Hermes', 'Legends of Hermes']],
  ['Magia no hermética', ['Ancient Magic', 'Rival Magic', 'Hedge Magic, Revised Edition', 'The Mysteries, Revised Edition']],
  ['Alianzas', ['Apprentices', 'Grogs']],
  ['Tribunales', ['El Tribunal de Iberia', 'The Cradle and the Crescent', 'Guardians of the Forests: The Rhine Tribunal', 'The Sundered Eagle', 'Against the Dark', 'The Lion and the Lily']]
];
const groupOf = b => { const g = GRUPOS.find(([, l]) => l.includes(b)); return g ? g[0] : 'Otros libros'; };
// alphabetical by the words, so «(Astrológica) Mutable» and «'Alim» sort with the A, not before them
const sortKey = e => e._sk || (e._sk = norm(e.n).replace(/[^a-z0-9]+/g, ' ').trim());
// «A», «A y B», «A, B y C»
const andList = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1] : l.join('');

// the compendium once per virtue: the same rule in several books shows once, from the core book when it is there.
// It is made again when the saga's own virtues change (the index is then a new object); says whether it changed
let IDX = null, LIST = null, BOOKS = null, CATS = null, HAS_CORE = false, HAS_OWN = false;
function compendium() {
  const idx = vdIndex();
  if (idx === IDX) return false;
  IDX = idx;
  LIST = idx.list.filter(e => idx.canon.get(e.dk) === e);
  const n = new Map();
  LIST.forEach(e => n.set(bookOf(e), (n.get(bookOf(e)) || 0) + 1));
  HAS_CORE = n.has(CORE);
  HAS_OWN = n.has(PROPIAS);
  // [group, [[book, count]...]] in the order of GRUPOS, then «Otros libros»; empty groups are left out
  const porGrupo = new Map(GRUPOS.map(([g]) => [g, []]).concat([['Otros libros', []]]));
  [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .forEach(([b, c]) => { if (b !== CORE && b !== PROPIAS) porGrupo.get(groupOf(b)).push([b, c]); });
  // the basic rulebook and the saga's own go first, without a heading
  const first = [CORE, PROPIAS].filter(b => n.has(b)).map(b => [b, n.get(b)]);
  BOOKS = [...(first.length ? [['', first]] : []), ...porGrupo.entries()].filter(([, l]) => l.length);
  const ord = c => { const i = VD_CATS.indexOf(c); return i < 0 ? 99 : i; };
  CATS = [...new Set(idx.cats.virtud.concat(idx.cats.defecto))].sort((a, b) => ord(a) - ord(b) || a.localeCompare(b, 'es'));
  return true;
}

// the filters stay as they were while the page is open: reopening the tab finds the same search, on the same page.
// libDef: the books are the default ones, and follow them (when the saga gets its first virtue of its own)
const st = { q: '', clase: '', tipo: '', valor: '', libros: null, libDef: true, solo: false, pag: 0 };
// the books ticked when the tab first opens, and again after «Quitar filtros»: the basic rulebook and the saga's own
const defLibros = () => new Set([HAS_CORE ? CORE : '', HAS_OWN ? PROPIAS : ''].filter(Boolean));
const isDefLibros = s => { const d = defLibros(); return s.size === d.size && [...d].every(b => s.has(b)); };
const bothDef = s => s.size === 2 && s.has(CORE) && s.has(PROPIAS);
// where the results come from, for the counter: «en el Libro básico», «en los 3 libros elegidos»…
function whereTxt(s) {
  if (!s.size) return 'en todos los libros';
  if (bothDef(s)) return 'en el Libro básico y las propias de la saga';
  if (s.size > 1) return 'en los ' + s.size + ' libros elegidos';
  const b = [...s][0];
  return b === CORE ? 'en el ' + CORE : b === PROPIAS ? 'entre las propias de la saga' : 'en ' + b;
}
// who may change or delete one of the saga's own: whoever made it, or a máster
const canEdit = e => !!e.propia && !!S.db && (!!S.owner || (!!e.autor && e.autor === S.uid));

/* o: { pjId, chosen(e) → bool, locked(e) → bool, toggle(e, on), summary() → text } — the editor keeps the character */
/* the rules for choosing virtues and flaws (ArM5, cap. 4), for the three kinds of character; the kind being made is
   marked and open. The sheet checks the same rules (creation/rules.js, creationCheck). */
const VD_REGLAS = [
  ['mago', 'Magos (y aprendices)', [
    'Defectos hasta 10 puntos (mayor = 3, menor = 1). Las virtudes cuestan lo mismo y no pueden pasar de lo que dan los defectos.',
    'El Don y «Magus Hermético» (su estatus social) son obligatorios y gratuitos, como la virtud gratuita de su casa.',
    'Como mucho una virtud hermética mayor, y al menos un defecto hermético.',
    'No pueden ser Ricos.']],
  ['companero', 'Compañeros', [
    'Defectos hasta 10 puntos (mayor = 3, menor = 1). Las virtudes cuestan lo mismo y no pueden pasar de lo que dan los defectos.',
    'Sin el Don (salvo que vaya a acabar siendo mago), y por tanto sin virtudes ni defectos herméticos.',
    'Pueden llevar virtudes y defectos mayores.']],
  ['grog', 'Grogs', [
    'Defectos hasta 3 puntos, y solo menores: virtudes y defectos, todos menores.',
    'Sin el Don ni virtudes o defectos herméticos, y sin defectos de Historia.',
    'Un defecto de Personalidad como mucho.']]];
const VD_COMUNES = ['Un estatus social, virtud o defecto (los hay gratuitos, como Campesino o Habitante de la Alianza).',
  'Como mucho cinco defectos menores, un defecto de Historia y dos de Personalidad (uno mayor como mucho).'];
function vdRules(clase) {
  const mio = clase === 'aprendiz' ? 'mago' : clase;
  const cards = VD_REGLAS.map(([k, t, l]) => h('div', { class: 'vdr-c' + (k === mio ? ' on' : '') }, [
    h('h4', null, [document.createTextNode(t), k === mio ? h('small', { text: 'Este personaje' }) : null]),
    h('ul', null, l.map(x => h('li', { text: x })))]));
  return h('details', { class: 'vdr', open: mio === 'mago' || mio === 'companero' || mio === 'grog' ? true : null }, [
    h('summary', { text: 'Reglas para elegir virtudes y defectos' }),
    h('div', { class: 'vdr-g' }, cards),
    h('p', { class: 'vdr-com' }, [h('b', { text: 'Para todos: ' }), VD_COMUNES.join(' ')])]);
}

function openVdTab(o) {
  compendium();
  if (!st.libros || st.libDef) st.libros = defLibros();
  const ul = h('ul', { class: 'vdt-list', tabindex: '-1' });
  const count = h('p', { class: 'vdt-count', 'aria-live': 'polite' });
  const sum = h('span', { class: 'vdt-sum', 'aria-live': 'polite' });
  const drawSum = () => { sum.textContent = o.summary(); drawBal(); };
  // the counter at the top: the points of the flaws against the points of the virtues, and whether they balance
  const bal = h('div', { class: 'vdt-bal', 'aria-live': 'polite' });
  function drawBal() {
    const b = o.balance();
    const cap = b.cap == null ? null : b.cap;
    const diff = b.pd - b.pv;
    let st, msg;
    if (cap != null && b.pd > cap) { st = 'over'; msg = 'Te pasas: los defectos pasan del máximo de ' + cap + '.'; }
    else if (diff < 0) { st = 'over'; msg = (-diff === 1 ? 'Falta 1 punto' : 'Faltan ' + (-diff) + ' puntos') + ' de defectos para pagar las virtudes.'; }
    else if (diff === 0) { st = 'ok'; msg = 'Equilibrado'; }
    else { st = 'under'; msg = (diff === 1 ? 'Sobra 1 punto' : 'Sobran ' + diff + ' puntos') + ' de defectos sin gastar.'; }
    bal.className = 'vdt-bal ' + st;
    bal.textContent = '';
    bal.appendChild(h('span', { class: 'vdt-bal-n' }, [h('small', { text: 'Defectos' }), h('b', { text: b.pd + (cap != null ? ' / ' + cap : '') })]));
    bal.appendChild(h('span', { class: 'vdt-bal-n' }, [h('small', { text: 'Virtudes' }), h('b', { text: String(b.pv) })]));
    bal.appendChild(h('span', { class: 'vdt-bal-st', text: msg }));
  }
  let hits = [];

  function card(e) {
    const on = o.chosen(e), lock = o.locked(e), id = 'vdt-' + e.i;
    const li = h('li', { class: 'vdt-it' + (on ? ' on' : '') + (e.clase === 'defecto' ? ' def' : '') + (e.propia ? ' propia' : '') });
    const cb = h('input', { type: 'checkbox', id: id, class: 'vdt-cb', checked: on ? true : null, disabled: lock ? true : null,
      'aria-label': (on ? 'Quitar ' : 'Elegir ') + e.n, title: lock ? 'Obligatoria para los magos' : on ? 'Quitar de la ficha' : 'Elegir' });
    cb.addEventListener('change', () => {
      o.toggle(e, cb.checked);
      const now = o.chosen(e);
      cb.checked = now;
      li.classList.toggle('on', now);
      cb.setAttribute('aria-label', (now ? 'Quitar ' : 'Elegir ') + e.n);
      cb.title = now ? 'Quitar de la ficha' : 'Elegir';
      drawSum();
    });
    const x = { n: e.n, en: e.en, valor: e.valor };
    const fx = vdFx(x, e.clase), eff = vdEffTxt(x, e.clase, fx);
    const desc = String(e.desc || '').trim(), sh = short(String(e.resumen || '').trim() || desc); // the summary, and the book's text when it is opened
    let dEl;
    if (!desc) dEl = h('p', { class: 'vdt-d none', text: e.propia ? 'Sin descripción.' : 'Sin descripción en el compendio.' });
    else if (sh === desc) dEl = h('p', { class: 'vdt-d', text: desc });
    else {
      // the summary; pressing it shows the whole description, and pressing again folds it
      let open = false;
      const txt = document.createTextNode(sh), hint = h('span', { class: 'more', text: ' Leer entera' });
      dEl = h('button', { type: 'button', class: 'vdt-d', 'aria-expanded': 'false' }, [txt, hint]);
      dEl.addEventListener('click', () => {
        open = !open;
        txt.textContent = open ? desc : sh;
        hint.textContent = open ? ' Leer menos' : ' Leer entera';
        dEl.setAttribute('aria-expanded', String(open));
      });
    }
    li.appendChild(cb);
    li.appendChild(h('div', { class: 'vdt-b' }, [
      // the name in the character's gender («Compasiva»)
      h('div', { class: 'vdt-h' }, [h('b', { text: vdGen(e.n, o.genero && o.genero()) }), e.en && norm(e.en) !== norm(e.n) ? h('i', { text: e.en }) : null,
        canEdit(e) ? h('button', { type: 'button', class: 'lnk vdt-edit', 'aria-label': 'Editar ' + e.n, onclick: () => openForm(e) }, 'Editar') : null]),
      h('div', { class: 'vdt-m' }, [h('span', { class: 'k', text: (e.clase === 'virtud' ? 'Virtud' : 'Defecto') + (e.valor ? ' · ' + e.valor : '') }),
        e.cat ? h('span', { text: e.cat }) : null, e.propia ? h('span', { class: 'own', text: 'Propia de la saga' }) : h('span', { text: [bookOf(e), e.pag].filter(Boolean).join(' · ') })]),
      dEl,
      eff ? h('p', { class: 'vdt-fx', text: 'En la ficha: ' + eff + (FX_OBJ[fx] ? ' A qué se aplica lo eliges en la ficha.' : '') }) : null,
      // «(Reino) estigmático», «Vulnerable a (Forma)»…: what is left to choose once it is on the sheet
      !FX_OBJ[fx] && vdSlots(x, e.clase).length ? h('p', { class: 'vdt-fx', text: 'Al añadirlo, en la ficha eliges ' + vdSlots(x, e.clase).map(s => SLOT_TXT[s.k] || '«' + s.w.toLowerCase() + '»').join(' y ') + '.' }) : null,
      lock ? h('p', { class: 'vdt-lock', text: 'Obligatoria y gratuita para los magos: no se puede quitar.' }) : null]));
    return li;
  }

  // the pages: a small control among the filters (‹ Página 2 de 9 ›), which stay on screen on wide screens, and the
  // row of page numbers under the list
  const pages = () => Math.max(1, Math.ceil(hits.length / PAGE));
  const topPrev = h('button', { type: 'button', class: 'vdt-pg', 'aria-label': 'Página anterior', onclick: () => go(st.pag - 1) }, '‹');
  const topNext = h('button', { type: 'button', class: 'vdt-pg', 'aria-label': 'Página siguiente', onclick: () => go(st.pag + 1) }, '›');
  const topTxt = h('span', { class: 'vdt-pg-t', 'aria-live': 'polite' });
  const pagTop = h('div', { class: 'vdt-pag top', role: 'group', 'aria-label': 'Páginas' }, [topPrev, topTxt, topNext]);
  const pagBot = h('nav', { class: 'vdt-pag bot', 'aria-label': 'Páginas de resultados' });
  // at the first or last page the arrow stays, greyed out, instead of being disabled: so it keeps the keyboard focus
  const off = (b, y) => { if (y) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled'); };
  function showPage(p) {
    const n = pages();
    st.pag = Math.min(Math.max(0, p), n - 1);
    const c = st.pag, from = c * PAGE, to = Math.min(hits.length, from + PAGE);
    ul.innerHTML = '';
    hits.slice(from, to).forEach(e => ul.appendChild(card(e)));
    ul.setAttribute('aria-label', hits.length ? 'Resultados del ' + (from + 1) + ' al ' + to + ' de ' + hits.length : 'Sin resultados');
    pagTop.hidden = pagBot.hidden = n < 2;
    topTxt.textContent = 'Página ' + (c + 1) + ' de ' + n;
    off(topPrev, c === 0); off(topNext, c === n - 1);
    // under the list: the first and the last page and those around the current one, in seven places when there are more
    const nums = n <= 7 ? [...Array(n).keys()] : c <= 3 ? [0, 1, 2, 3, 4, -1, n - 1]
      : c >= n - 4 ? [0, -1, n - 5, n - 4, n - 3, n - 2, n - 1] : [0, -1, c - 1, c, c + 1, -1, n - 1];
    const prev = h('button', { type: 'button', class: 'vdt-pg', 'aria-label': 'Página anterior', onclick: () => go(c - 1, true) }, ['‹', h('span', { class: 't', text: 'Anterior' })]);
    const next = h('button', { type: 'button', class: 'vdt-pg', 'aria-label': 'Página siguiente', onclick: () => go(c + 1, true) }, [h('span', { class: 't', text: 'Siguiente' }), '›']);
    off(prev, c === 0); off(next, c === n - 1);
    pagBot.innerHTML = '';
    pagBot.appendChild(prev);
    nums.forEach(i => pagBot.appendChild(i < 0 ? h('span', { class: 'gap', 'aria-hidden': 'true', text: '…' })
      : h('button', { type: 'button', class: 'vdt-pg', 'aria-label': 'Página ' + (i + 1), 'aria-current': i === c ? 'page' : null, onclick: () => go(i, true) }, String(i + 1))));
    pagBot.appendChild(next);
  }
  // the new page starts at the top of the screen, under the filters; it only scrolls upwards, so the small control
  // stays where it was pressed (on a phone it is above the list)
  function toList() {
    const box = ul.closest('.modal-b');
    if (!box) return;
    const bar = box.querySelector('.vdt-f');
    const cover = bar && getComputedStyle(bar).position === 'sticky' ? bar.offsetHeight : 0;
    const top = ul.getBoundingClientRect().top - box.getBoundingClientRect().top - cover;
    if (top < 0) box.scrollTop += top - 10;
  }
  // bottom: pressed in the row under the list, whose buttons are drawn again, so the keyboard goes to the new page
  function go(p, bottom) {
    if (p < 0 || p >= pages() || p === st.pag) return;
    showPage(p);
    toList();
    if (bottom) ul.focus({ preventScroll: true });
  }

  // the saga's own virtues changed (made here or by someone else): the list, the books and the types follow
  function refresh() {
    if (!compendium()) return;
    if (st.libDef) st.libros = defLibros();
    fillLibs();
    fillTipos();
  }
  function draw(keep) {
    refresh();
    const terms = norm(st.q).split(/\s+/).filter(t => t.length > 1);
    // what matches all the filters but the books: the difference is in the books that are not ticked
    const all = LIST.filter(e => (!st.clase || e.clase === st.clase) && (!st.tipo || e.cat === st.tipo) && (!st.valor || e.valor === st.valor)
      && (!st.solo || o.chosen(e)) && terms.every(t => e.key.includes(t)));
    hits = st.libros.size ? all.filter(e => st.libros.has(bookOf(e))) : all;
    const first = terms[0] || '';
    hits.sort((a, b) => (first ? norm(b.n).includes(first) - norm(a.n).includes(first) : 0) || (a.clase === b.clase ? 0 : a.clase === 'virtud' ? -1 : 1) || sortKey(a).localeCompare(sortKey(b), 'es'));
    const otros = all.length - hits.length;
    const any = st.q.trim() || st.clase || st.tipo || st.valor || !isDefLibros(st.libros) || st.solo;
    libSum.textContent = !st.libros.size ? 'Todos los libros' : st.libros.size === 1 ? [...st.libros][0] : bothDef(st.libros) ? 'Libro básico y propias' : st.libros.size + ' libros';
    // the counter, with a way to what matches in the books that are not ticked, or to make what is not anywhere
    const verOtros = t => h('button', { type: 'button', class: 'lnk', onclick: () => setLibros(new Set()) }, t);
    const qq = st.q.trim().replace(/\s+/g, ' ');
    count.textContent = '';
    if (hits.length) {
      count.append(hits.length + (hits.length === 1 ? ' resultado ' : ' resultados ') + whereTxt(st.libros));
      if (otros) count.append(' · ', verOtros('+' + otros + ' en otros libros'));
    } else if (otros) count.append('Nada ' + whereTxt(st.libros) + '. ', verOtros('Ver ' + otros + ' en otros libros'));
    else if (qq && S.db) count.append('Nada coincide con la búsqueda. ', h('button', { type: 'button', class: 'lnk', onclick: () => openForm(null, qq.slice(0, 80)) }, 'Crear «' + qq.slice(0, 80) + '» para esta saga'));
    else count.textContent = 'Nada coincide con la búsqueda.';
    clear.hidden = !any;
    showPage(keep ? st.pag : 0);
    if (!keep) toList();
  }
  function setLibros(s) {
    st.libros = s;
    st.libDef = isDefLibros(s);
    libBoxes.forEach(([b, cb]) => { cb.checked = s.has(b); });
    draw();
  }

  const q = h('input', { type: 'search', value: st.q, placeholder: 'Buscar por nombre o en la descripción…', autocomplete: 'off', 'aria-label': 'Buscar virtud o defecto' });
  let tm = null;
  q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { st.q = q.value; draw(); }, 120); });
  const fClase = sel([['', 'Virtudes y defectos'], ['virtud', 'Solo virtudes'], ['defecto', 'Solo defectos']], st.clase, v => { st.clase = v; draw(); }, { 'aria-label': 'Virtudes o defectos' });
  const fTipo = sel([['', 'Todos los tipos']].concat(CATS.map(c => [c, c])), st.tipo, v => { st.tipo = v; draw(); }, { 'aria-label': 'Tipo' });
  function fillTipos() {
    if (st.tipo && !CATS.includes(st.tipo)) st.tipo = '';
    fTipo.innerHTML = '';
    [['', 'Todos los tipos']].concat(CATS.map(c => [c, c])).forEach(([v, l]) => fTipo.appendChild(h('option', { value: v }, l)));
    fTipo.value = st.tipo;
  }
  const fValor = sel(VALORES, st.valor, v => { st.valor = v; draw(); }, { 'aria-label': 'Valor' });
  // the books: several at once, in groups; the box at the top says which are ticked
  const libSum = h('span', { class: 'vdt-lib-sum' });
  const libPanel = h('div', { class: 'vdt-lib-panel' });
  let libBoxes = [];
  function fillLibs() {
    libBoxes = [];
    libPanel.innerHTML = '';
    const def = defLibros();
    libPanel.appendChild(h('div', { class: 'vdt-lib-q' }, [
      def.size ? h('button', { type: 'button', class: 'lnk', onclick: () => setLibros(defLibros()) }, bothDef(def) ? 'Libro básico y propias' : 'Solo ' + (def.has(CORE) ? 'el Libro básico' : 'las propias')) : null,
      h('button', { type: 'button', class: 'lnk', onclick: () => setLibros(new Set()) }, 'Todos los libros')]));
    BOOKS.forEach(([g, lst]) => libPanel.appendChild(h('div', { class: 'vdt-lib-g' }, [
      g ? h('h5', { text: g }) : null,
      h('div', { class: 'vdt-lib-l' }, lst.map(([b, c]) => {
        const cb = h('input', { type: 'checkbox', checked: st.libros.has(b) ? true : null });
        libBoxes.push([b, cb]);
        cb.addEventListener('change', () => { if (cb.checked) st.libros.add(b); else st.libros.delete(b); st.libDef = isDefLibros(st.libros); draw(); });
        return h('label', { class: 'vdt-lib' }, [cb, h('span', { text: b }), h('small', { text: String(c) })]);
      }))])));
  }
  fillLibs();
  const fLibro = h('details', { class: 'vdt-libros' }, [h('summary', null, [h('span', { text: 'Libros' }), libSum]), libPanel]);
  const fSolo = h('input', { type: 'checkbox', id: 'vdt-solo', checked: st.solo ? true : null });
  fSolo.addEventListener('change', () => { st.solo = fSolo.checked; draw(); });
  const clear = h('button', { type: 'button', class: 'lnk', onclick: () => {
    Object.assign(st, { q: '', clase: '', tipo: '', valor: '', libros: defLibros(), libDef: true, solo: false });
    q.value = ''; fClase.value = ''; fTipo.value = ''; fValor.value = ''; libBoxes.forEach(([b, cb]) => { cb.checked = st.libros.has(b); }); fSolo.checked = false;
    draw(); q.focus();
  } }, 'Quitar filtros');
  // after making or changing one: the list shows it first (searched by its name), with the other filters off
  function showEntry(e) {
    Object.assign(st, { q: e.n, clase: '', tipo: '', valor: '', solo: false });
    q.value = e.n; fClase.value = ''; fTipo.value = ''; fValor.value = ''; fSolo.checked = false;
    if (st.libros.size && !st.libros.has(PROPIAS)) { st.libros.add(PROPIAS); st.libDef = isDefLibros(st.libros); libBoxes.forEach(([b, cb]) => { cb.checked = st.libros.has(b); }); }
    draw();
    const cb = ul.querySelector('.vdt-cb');
    if (cb) cb.focus();
  }

  /* ---------- the saga's own: a form in place of the list, to make one or to change it */
  const fbar = h('div', { class: 'vdt-f' }, [bal, q, fClase, fTipo, fValor, fLibro, h('label', { class: 'chk', for: 'vdt-solo' }, [fSolo, h('span', { text: 'Solo las elegidas' })]), clear,
    h('div', { class: 'vdt-cnt' }, [count, pagTop])]);
  const help = h('p', { class: 'fh vdt-help', text: 'Marca la casilla para elegir una virtud o un defecto, y desmárcala para quitarlo. Pulsa la descripción para leerla entera. De entrada se ve el Libro básico, y las propias de la saga si las hay: añade otros libros en «Libros». Si falta alguna, créala con «Crear virtud o defecto»: solo existirá en esta saga.' });
  const rules = vdRules(o.clase ? o.clase() : 'otro');
  const formBox = h('section', { class: 'vdt-new', 'aria-labelledby': 'vdt-new-h' });
  formBox.hidden = true;
  const newBtn = h('button', { type: 'button', class: 'btn ghost', onclick: () => openForm(null) }, 'Crear virtud o defecto');
  newBtn.hidden = !S.db;
  let formFrom = null;
  // who has it: the saved characters (this one apart, as it may have changed) and this one as it is now
  function usersOf(e) {
    const k = e.clase === 'virtud' ? 'virtudes' : 'defectos';
    const names = Object.entries(S.pj || {}).filter(([id, p]) => id !== o.pjId && p && (Array.isArray(p[k]) ? p[k] : [])
      .some(x => x && String(x.n || '').trim() && (vdEntry(x, e.clase) || {}).propia === e.propia)).map(([, p]) => p.nombre || 'un personaje sin nombre');
    names.sort((a, b) => a.localeCompare(b, 'es'));
    if (o.chosen(e)) names.unshift('este personaje');
    return names;
  }
  function openForm(e, nombre) {
    const edit = !!e;
    const x = edit ? Object.assign({ clase: e.clase, valor: e.valor, cat: e.cat }, S.vd[e.propia])
      : { n: nombre || '', clase: st.clase || 'virtud', valor: 'Menor', cat: st.tipo || 'General', desc: '' };
    const users = edit ? usersOf(e) : [];
    // the sheets find it by its name: once a character has it, the name and whether it is a virtue or a flaw stay
    const fixed = users.length > 0;
    const lo = () => x.clase === 'defecto' ? 'lo' : 'la';
    formFrom = document.activeElement;
    formBox.innerHTML = '';
    const err = h('p', { class: 'vdt-err', role: 'alert' });
    const nIn = h('input', { type: 'text', value: x.n || '', maxlength: '80', autocomplete: 'off', disabled: fixed ? true : null });
    const vSel = h('select');
    const addTxt = h('span');
    function fillVals() {
      if (!VALS[x.clase].includes(x.valor)) x.valor = 'Menor';
      vSel.innerHTML = '';
      VALS[x.clase].forEach(v => vSel.appendChild(h('option', { value: v }, VAL_TXT[v])));
      vSel.value = x.valor;
      addTxt.textContent = 'Añadir' + lo() + ' a este personaje';
    }
    vSel.addEventListener('change', () => { x.valor = vSel.value; });
    const cSel = sel([['virtud', 'Virtud'], ['defecto', 'Defecto']], x.clase, v => { x.clase = v; fillVals(); }, { disabled: fixed ? true : null });
    const tSel = sel(CATS.map(c => [c, c]), x.cat || 'General', v => { x.cat = v; });
    x.cat = tSel.value;
    fillVals();
    const dIn = h('textarea', { rows: '6', maxlength: '4000' });
    dIn.value = x.desc || '';
    const addCb = edit ? null : h('input', { type: 'checkbox', id: 'vdt-new-add', checked: true });
    const save = h('button', { type: 'button', class: 'btn' }, edit ? 'Guardar cambios' : 'Crear');
    const cancel = h('button', { type: 'button', class: 'btn ghost', onclick: () => closeForm(true) }, 'Cancelar');
    const del = edit ? confirmButton('Borrar', 'Pulsa otra vez para borrar' + lo(), async () => {
      const ok = await dbWrite(() => S.db.doc('virtudes/' + e.propia).delete(), (e.clase === 'defecto' ? 'Borrado «' : 'Borrada «') + e.n + '».');
      if (!ok) return;
      closeForm();
      draw(true);
      newBtn.focus();
    }) : null;
    save.addEventListener('click', async () => {
      const n = nIn.value.trim().replace(/\s+/g, ' ');
      const desc = dIn.value.trim();
      err.textContent = '';
      if (n.length < 2) { err.textContent = 'Ponle un nombre.'; nIn.focus(); return; }
      // a name already in the compendium or in the saga would be two entries the sheets cannot tell apart
      const same = (vdIndex().byKey.get(tkey(n) + '|' + x.clase) || []).find(y => !edit || y.propia !== e.propia);
      if (same) {
        const una = x.clase === 'virtud' ? 'una virtud' : 'un defecto';
        err.textContent = same.propia ? 'Ya hay ' + una + ' de la saga con ese nombre.' : 'Ya hay ' + una + ' con ese nombre en el compendio (' + bookOf(same) + '): búsca' + lo() + ' en la lista o usa otro nombre.';
        nIn.focus();
        return;
      }
      save.disabled = true;
      const id = edit ? e.propia : newId('vd ' + n);
      const prev = (edit && S.vd[id]) || {};
      const data = stamp({ n: n, clase: x.clase, valor: vSel.value, cat: x.cat, desc: desc, autor: prev.autor || S.uid || null }, !edit);
      if (prev.creado) data.creado = prev.creado;
      const ok = await dbWrite(() => S.db.doc('virtudes/' + id).set(data), (edit ? 'Guardad' : 'Cread') + (x.clase === 'defecto' ? 'o' : 'a') + ' «' + n + '»' + (edit ? '.' : ' en esta saga.'));
      save.disabled = false;
      if (!ok) return;
      refresh();
      const ne = LIST.find(y => y.propia === id);
      if (ne && addCb && addCb.checked) { o.toggle(ne, true); drawSum(); }
      closeForm();
      if (ne) showEntry(ne);
    });
    formBox.append(...[
      h('h3', { id: 'vdt-new-h', text: edit ? 'Editar «' + e.n + '»' : 'Nueva virtud o defecto de la saga' }),
      h('p', { class: 'fh', text: 'Solo existe en esta saga: no pasa al compendio común ni a las sagas que se creen después. En «Libros» aparece como «Propias de la saga».' }),
      h('div', { class: 'fld-row' }, [field('Nombre', nIn), field('Virtud o defecto', cSel)]),
      h('div', { class: 'fld-row' }, [field('Valor', vSel), field('Tipo', tSel)]),
      field('Descripción', dIn, 'Lo que hace, como en los libros: es lo que se lee en esta lista y en las fichas.'),
      fixed ? h('p', { class: 'note warn', text: (x.clase === 'defecto' ? 'Lo ' : 'La ') + (users.length > 1 ? 'tienen ' : 'tiene ') + andList(users) + ': el nombre y si es virtud o defecto ya no se pueden cambiar. Si ' + lo() + ' borras, en esas fichas se queda solo el nombre.' }) : null,
      addCb ? h('label', { class: 'chk', for: 'vdt-new-add' }, [addCb, addTxt]) : null,
      err,
      h('div', { class: 'vdt-new-act' }, [save, cancel, del])].filter(Boolean)); // append() would write «null» for the parts left out
    [fbar, help, rules, ul, pagBot, newBtn].forEach(n => { n.hidden = true; });
    formBox.hidden = false;
    const box = formBox.closest('.modal-b');
    if (box) box.scrollTop = 0;
    setTimeout(() => (fixed ? dIn : nIn).focus(), 0);
  }
  // back to the list as it was (back: to whatever opened the form)
  function closeForm(back) {
    formBox.hidden = true;
    formBox.innerHTML = '';
    [fbar, help, rules, ul].forEach(n => { n.hidden = false; });
    newBtn.hidden = !S.db;
    pagBot.hidden = pages() < 2;
    if (back) (formFrom && formFrom.isConnected && formFrom !== document.body ? formFrom : newBtn).focus();
  }

  const done = h('button', { type: 'button', class: 'btn' }, 'Listo');
  const close = openModal('Virtudes y defectos', [fbar, help, rules, formBox, ul, pagBot], [sum, newBtn, done]);
  done.addEventListener('click', () => close());
  const box = document.body.lastElementChild;
  if (box && box.classList.contains('modal')) box.classList.add('vd-tab');
  drawSum();
  draw(true);
}

export { openVdTab };
