/* La pestaña para elegir virtudes y defectos al crear o editar un personaje: el compendio entero con buscador y
   filtros, una descripción corta de cada uno (al pulsarla se lee entera) y una casilla para elegirlo o quitarlo.
   Ocupa toda la pantalla sobre el editor, que sigue debajo con lo que ya se ha rellenado. */
import { h, norm } from '../base.js';
import { VD_CATS } from '../saga/state.js';
import { openModal, sel } from '../saga/core.js';
import { FX_OBJ, SLOT_TXT, vdEffTxt, vdFx, vdGen, vdIndex, vdSlots } from './rules.js';

const PAGE = 40;   // cards drawn at a time; «Mostrar más» adds the next ones
const SHORT = 150; // characters of the short description
const VALORES = [['', 'Cualquier valor'], ['Mayor', 'Mayor (3)'], ['Menor', 'Menor (1)'], ['Gratuita', 'Gratuita'], ['Especial', 'Especial']];
const short = s => {
  if (s.length <= SHORT) return s;
  const cut = s.lastIndexOf(' ', SHORT - 1);
  return s.slice(0, cut > SHORT * 0.6 ? cut : SHORT - 1).replace(/[\s,;:.]+$/, '') + '…';
};
const bookOf = e => e.core ? 'Libro básico' : (e.libro || 'Sin libro');
// the books in groups, as the table of the sourcebooks is read: the rest go to «Otros libros»
const GRUPOS = [
  ['Reinos', ['Realms of Power: Magic', 'Realms of Power: The Divine', 'Realms of Power: The Infernal', 'Realms of Power: Faerie']],
  ['Casas de Hermes', ['Houses of Hermes: True Lineages', 'Houses of Hermes: Mystery Cults', 'Houses of Hermes: Societates', 'Magi of Hermes', 'Legends of Hermes']],
  ['Magia no hermética', ['Ancient Magic', 'Rival Magic', 'Hedge Magic, Revised Edition', 'The Mysteries, Revised Edition']],
  ['Alianzas', ['Apprentices', 'Grogs']],
  ['Tribunales', ['The Cradle and the Crescent', 'Guardians of the Forests: The Rhine Tribunal', 'The Sundered Eagle', 'Against the Dark', 'The Lion and the Lily']]
];
const groupOf = b => { const g = GRUPOS.find(([, l]) => l.includes(b)); return g ? g[0] : 'Otros libros'; };
// alphabetical by the words, so «(Astrológica) Mutable» and «'Alim» sort with the A, not before them
const sortKey = e => e._sk || (e._sk = norm(e.n).replace(/[^a-z0-9]+/g, ' ').trim());

// the compendium once per virtue: the same rule in several books shows once, from the core book when it is there
let LIST = null, BOOKS = null, CATS = null;
function compendium() {
  if (LIST) return;
  const idx = vdIndex();
  LIST = idx.list.filter(e => idx.canon.get(e.dk) === e);
  const n = new Map();
  LIST.forEach(e => n.set(bookOf(e), (n.get(bookOf(e)) || 0) + 1));
  // [group, [[book, count]...]] in the order of GRUPOS, then «Otros libros»; empty groups are left out
  const porGrupo = new Map(GRUPOS.map(([g]) => [g, []]).concat([['Otros libros', []]]));
  [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .forEach(([b, c]) => { if (b !== 'Libro básico') porGrupo.get(groupOf(b)).push([b, c]); });
  // the basic rulebook goes first, on its own, without a heading
  BOOKS = [...(n.has('Libro básico') ? [['', [['Libro básico', n.get('Libro básico')]]]] : []), ...porGrupo.entries()].filter(([, l]) => l.length);
  const ord = c => { const i = VD_CATS.indexOf(c); return i < 0 ? 99 : i; };
  CATS = [...new Set(idx.cats.virtud.concat(idx.cats.defecto))].sort((a, b) => ord(a) - ord(b) || a.localeCompare(b, 'es'));
}

// the filters stay as they were while the page is open: reopening the tab finds the same search
const st = { q: '', clase: '', tipo: '', valor: '', libros: new Set(), solo: false };

/* o: { chosen(e) → bool, locked(e) → bool, toggle(e, on), summary() → text } — the editor keeps the character */
function openVdTab(o) {
  compendium();
  const ul = h('ul', { class: 'vdt-list' });
  const count = h('p', { class: 'vdt-count', 'aria-live': 'polite' });
  const moreBtn = h('button', { type: 'button', class: 'btn ghost vdt-more-btn' });
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
    else if (diff < 0) { st = 'over'; msg = 'Faltan ' + (-diff) + (-diff === 1 ? ' punto' : ' puntos') + ' de defectos para pagar las virtudes.'; }
    else if (diff === 0) { st = 'ok'; msg = 'Equilibrado'; }
    else { st = 'under'; msg = 'Sobran ' + diff + (diff === 1 ? ' punto' : ' puntos') + ' de defectos sin gastar.'; }
    bal.className = 'vdt-bal ' + st;
    bal.textContent = '';
    bal.appendChild(h('span', { class: 'vdt-bal-n' }, [h('small', { text: 'Defectos' }), h('b', { text: b.pd + (cap != null ? ' / ' + cap : '') })]));
    bal.appendChild(h('span', { class: 'vdt-bal-n' }, [h('small', { text: 'Virtudes' }), h('b', { text: String(b.pv) })]));
    bal.appendChild(h('span', { class: 'vdt-bal-st', text: msg }));
  }
  let hits = [], shown = 0;

  function card(e) {
    const on = o.chosen(e), lock = o.locked(e), id = 'vdt-' + e.i;
    const li = h('li', { class: 'vdt-it' + (on ? ' on' : '') + (e.clase === 'defecto' ? ' def' : '') });
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
    const desc = String(e.desc || '').trim(), sh = short(desc);
    let dEl;
    if (!desc) dEl = h('p', { class: 'vdt-d none', text: 'Sin descripción en el compendio.' });
    else if (sh === desc) dEl = h('p', { class: 'vdt-d', text: desc });
    else {
      // the short text; pressing it shows the whole description, and pressing again folds it
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
      h('div', { class: 'vdt-h' }, [h('b', { text: vdGen(e.n, o.genero && o.genero()) }), e.en && norm(e.en) !== norm(e.n) ? h('i', { text: e.en }) : null]),
      h('div', { class: 'vdt-m' }, [h('span', { class: 'k', text: (e.clase === 'virtud' ? 'Virtud' : 'Defecto') + (e.valor ? ' · ' + e.valor : '') }),
        e.cat ? h('span', { text: e.cat }) : null, h('span', { text: [bookOf(e), e.pag].filter(Boolean).join(' · ') })]),
      dEl,
      eff ? h('p', { class: 'vdt-fx', text: 'En la ficha: ' + eff + (FX_OBJ[fx] ? ' A qué se aplica lo eliges en la ficha.' : '') }) : null,
      // «(Reino) estigmático», «Vulnerable a (Forma)»…: what is left to choose once it is on the sheet
      !FX_OBJ[fx] && vdSlots(x, e.clase).length ? h('p', { class: 'vdt-fx', text: 'Al añadirlo, en la ficha eliges ' + vdSlots(x, e.clase).map(s => SLOT_TXT[s.k] || '«' + s.w.toLowerCase() + '»').join(' y ') + '.' }) : null,
      lock ? h('p', { class: 'vdt-lock', text: 'Obligatoria y gratuita para los magos: no se puede quitar.' }) : null]));
    return li;
  }

  function more() {
    hits.slice(shown, shown + PAGE).forEach(e => ul.appendChild(card(e)));
    shown = Math.min(hits.length, shown + PAGE);
    const left = hits.length - shown;
    moreBtn.hidden = !left;
    moreBtn.textContent = 'Mostrar ' + Math.min(PAGE, left) + ' más (quedan ' + left + ')';
  }
  function draw() {
    const terms = norm(st.q).split(/\s+/).filter(t => t.length > 1);
    hits = LIST.filter(e => (!st.clase || e.clase === st.clase) && (!st.tipo || e.cat === st.tipo) && (!st.valor || e.valor === st.valor)
      && (!st.libros.size || st.libros.has(bookOf(e))) && (!st.solo || o.chosen(e)) && terms.every(t => e.key.includes(t)));
    const first = terms[0] || '';
    hits.sort((a, b) => (first ? norm(b.n).includes(first) - norm(a.n).includes(first) : 0) || (a.clase === b.clase ? 0 : a.clase === 'virtud' ? -1 : 1) || sortKey(a).localeCompare(sortKey(b), 'es'));
    ul.innerHTML = '';
    shown = 0;
    more();
    const any = st.q.trim() || st.clase || st.tipo || st.valor || st.libros.size || st.solo;
    libSum.textContent = st.libros.size ? (st.libros.size === 1 ? '1 libro' : st.libros.size + ' libros') : 'Todos los libros';
    count.textContent = hits.length ? hits.length + (hits.length === 1 ? ' resultado' : ' resultados') + (any ? '' : ' en el compendio') : 'Nada coincide con la búsqueda. Si no está en el compendio, añádela a mano en la ficha.';
    clear.hidden = !any;
  }

  const q = h('input', { type: 'search', value: st.q, placeholder: 'Buscar por nombre o en la descripción…', autocomplete: 'off', 'aria-label': 'Buscar virtud o defecto' });
  let tm = null;
  q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { st.q = q.value; draw(); }, 120); });
  const fClase = sel([['', 'Virtudes y defectos'], ['virtud', 'Solo virtudes'], ['defecto', 'Solo defectos']], st.clase, v => { st.clase = v; draw(); }, { 'aria-label': 'Virtudes o defectos' });
  const fTipo = sel([['', 'Todos los tipos']].concat(CATS.map(c => [c, c])), st.tipo, v => { st.tipo = v; draw(); }, { 'aria-label': 'Tipo' });
  const fValor = sel(VALORES, st.valor, v => { st.valor = v; draw(); }, { 'aria-label': 'Valor' });
  // the books: several at once, in groups; the box at the top says how many are picked
  const libSum = h('span', { class: 'vdt-lib-sum' });
  const libBoxes = [];
  const libPanel = h('div', { class: 'vdt-lib-panel' }, BOOKS.map(([g, lst]) => h('div', { class: 'vdt-lib-g' }, [
    g ? h('h5', { text: g }) : null,
    h('div', { class: 'vdt-lib-l' }, lst.map(([b, c]) => {
      const cb = h('input', { type: 'checkbox', checked: st.libros.has(b) ? true : null });
      libBoxes.push([b, cb]);
      cb.addEventListener('change', () => { if (cb.checked) st.libros.add(b); else st.libros.delete(b); draw(); });
      return h('label', { class: 'vdt-lib' }, [cb, h('span', { text: b }), h('small', { text: String(c) })]);
    }))])));
  const fLibro = h('details', { class: 'vdt-libros' }, [h('summary', null, [h('span', { text: 'Libros' }), libSum]), libPanel]);
  const fSolo = h('input', { type: 'checkbox', id: 'vdt-solo', checked: st.solo ? true : null });
  fSolo.addEventListener('change', () => { st.solo = fSolo.checked; draw(); });
  const clear = h('button', { type: 'button', class: 'lnk', onclick: () => {
    Object.assign(st, { q: '', clase: '', tipo: '', valor: '', libros: new Set(), solo: false });
    q.value = ''; fClase.value = ''; fTipo.value = ''; fValor.value = ''; libBoxes.forEach(([, cb]) => { cb.checked = false; }); fSolo.checked = false;
    draw(); q.focus();
  } }, 'Quitar filtros');
  moreBtn.addEventListener('click', more);

  const body = [
    h('div', { class: 'vdt-f' }, [bal, q, fClase, fTipo, fValor, fLibro, h('label', { class: 'chk', for: 'vdt-solo' }, [fSolo, h('span', { text: 'Solo las elegidas' })]), clear, count]),
    h('p', { class: 'fh vdt-help', text: 'Marca la casilla para elegir una virtud o un defecto, y desmárcala para quitarlo. Pulsa la descripción para leerla entera.' }),
    ul, moreBtn];
  const done = h('button', { type: 'button', class: 'btn' }, 'Listo');
  const close = openModal('Virtudes y defectos', body, [sum, done]);
  done.addEventListener('click', () => close());
  const box = document.body.lastElementChild;
  if (box && box.classList.contains('modal')) box.classList.add('vd-tab');
  drawSum();
  draw();
}

export { openVdTab };
