/* La ventana para elegir hechizos al crear o editar una ficha: todos los del catálogo (data/hechizos.json y los del
   homebrew activado), con buscador, Técnica y Forma, «Solo los que puede aprender» (nivel hasta Técnica + Forma +
   Inteligencia + Teoría Mágica + 3) y el contador de niveles contra el presupuesto (120 para un mago recién salido del
   aprendizaje). Marcar un hechizo lo añade a la ficha al momento; desmarcarlo lo quita.
   o: { list, cap(tec, forma), teo, chosen(e), toggle(e, on), spent(), budget (o null), aMano() } */
import { ABBR, ARTS_F, ARTS_T, h, norm } from '../base.js';
import { openModal } from '../saga/core.js';

const PAGE = 60;
const st = { q: '', tec: '', forma: '', puede: true };   // the filters stay as they were for the next opening
const lvOf = e => { const n = Number(e.nivel); return e.nivel !== '' && e.nivel != null && isFinite(n) ? n : null; };   // null: a general spell («Gen»), of the level one chooses
const ORD = [...ARTS_T, ...ARTS_F];

function openSpellTab(o) {
  const all = o.list.slice().sort((a, b) => ORD.indexOf(a.tec) - ORD.indexOf(b.tec) || ORD.indexOf(a.forma) - ORD.indexOf(b.forma)
    || (lvOf(a) ?? -1) - (lvOf(b) ?? -1) || String(a.n).localeCompare(String(b.n), 'es'));
  const key = e => norm([e.n, e.en].concat(e.alias || []).join(' '));
  const puede = e => lvOf(e) == null || lvOf(e) <= o.cap(e.tec, e.forma);

  // the counter: the levels of the sheet's spells against the budget
  const bal = h('div', { class: 'vdt-bal', 'aria-live': 'polite' });
  function drawBal() {
    const n = o.spent(), b = o.budget;
    bal.textContent = '';
    bal.appendChild(h('span', { class: 'vdt-bal-n' }, [h('small', { text: 'Niveles de hechizo' }), h('b', { text: n + (b != null ? ' / ' + b : '') })]));
    if (b == null) { bal.className = 'vdt-bal'; return; }
    const st2 = n > b ? 'over' : n === b ? 'ok' : 'under';
    bal.className = 'vdt-bal ' + st2;
    bal.appendChild(h('span', { class: 'vdt-bal-st', text: n > b ? 'Te pasas ' + (n - b) + (n - b === 1 ? ' nivel' : ' niveles') : n === b ? 'Justo' : 'Quedan ' + (b - n) + (b - n === 1 ? ' nivel' : ' niveles') }));
  }

  // the filters
  const q = h('input', { type: 'search', placeholder: 'Buscar un hechizo…', 'aria-label': 'Buscar un hechizo', value: st.q });
  const opts = (lab, arr, v) => h('select', { 'aria-label': lab }, [h('option', { value: '', text: lab === 'Técnica' ? 'Todas las Técnicas' : 'Todas las Formas' })]
    .concat(arr.map(a => h('option', { value: a, text: a, selected: a === v ? true : null }))));
  const tec = opts('Técnica', ARTS_T, st.tec), forma = opts('Forma', ARTS_F, st.forma);
  const pcb = h('input', { type: 'checkbox', id: 'spt-puede', checked: st.puede ? true : null });
  const count = h('p', { class: 'vdt-count', 'aria-live': 'polite' });
  const help = h('p', { class: 'fh vdt-help', text: 'Puede aprender un hechizo de nivel hasta Técnica + Forma + Inteligencia + ' + o.teo + ' + 3, con las puntuaciones de ahora de la ficha. Los de nivel general (sin nivel fijo) salen siempre: su nivel lo eliges en la ficha.' });
  const fbar = h('div', { class: 'vdt-f' }, [bal, q, tec, forma, h('label', { class: 'chk', for: 'spt-puede' }, [pcb, h('span', { text: 'Solo los que puede aprender' })]), h('div', { class: 'vdt-cnt' }, [count])]);
  const ul = h('ul', { class: 'vdt-list', tabindex: '-1' });
  const more = h('button', { type: 'button', class: 'btn ghost spt-more' });
  let hits = [], shown = 0;

  function card(e) {
    const on = o.chosen(e), lv = lvOf(e), cap = o.cap(e.tec, e.forma), alto = lv != null && lv > cap;
    const li = h('li', { class: 'vdt-it' + (on ? ' on' : '') });
    const cb = h('input', { type: 'checkbox', class: 'vdt-cb', checked: on ? true : null, 'aria-label': (on ? 'Quitar ' : 'Elegir ') + e.n });
    cb.addEventListener('change', () => {
      o.toggle(e, cb.checked);
      const now = o.chosen(e);
      cb.checked = now;
      li.classList.toggle('on', now);
      cb.setAttribute('aria-label', (now ? 'Quitar ' : 'Elegir ') + e.n);
      drawBal();
    });
    const desc = String(e.desc || '').trim(), sh = desc.length > 170 ? desc.slice(0, 160).replace(/\s+\S*$/, '') + '…' : desc;
    let dEl = null;
    if (desc && sh !== desc) {
      let open = false;
      const txt = document.createTextNode(sh), hint = h('span', { class: 'more', text: ' Leer entera' });
      dEl = h('button', { type: 'button', class: 'vdt-d', 'aria-expanded': 'false' }, [txt, hint]);
      dEl.addEventListener('click', () => { open = !open; txt.textContent = open ? desc : sh; hint.textContent = open ? ' Leer menos' : ' Leer entera'; dEl.setAttribute('aria-expanded', String(open)); });
    } else if (desc) dEl = h('p', { class: 'vdt-d', text: desc });
    li.appendChild(cb);
    li.appendChild(h('div', { class: 'vdt-b' }, [
      h('div', { class: 'vdt-h' }, [h('b', { text: e.n }), e.en && norm(e.en) !== norm(e.n) ? h('i', { text: e.en }) : null]),
      h('div', { class: 'vdt-m' }, [
        h('span', { class: 'k', text: (ABBR[e.tec] || e.tec) + (ABBR[e.forma] || e.forma) + ' ' + (lv != null ? lv : 'general') }),
        e.rit ? h('span', { text: 'Ritual' }) : null,
        h('span', { text: [e.alc, e.dur, e.obj].filter(Boolean).join(' · ') }),
        e.hb ? h('span', { text: 'Homebrew' + (e.autor ? ' de ' + e.autor : '') }) : e.pag ? h('span', { text: 'pág. ' + e.pag }) : null]),
      alto ? h('p', { class: 'spt-alto', text: 'Por encima de lo que puede aprender ahora: su máximo en ' + (ABBR[e.tec] || e.tec) + (ABBR[e.forma] || e.forma) + ' es ' + cap + '.' }) : null,
      dEl]));
    return li;
  }
  function showMore() {
    const to = Math.min(hits.length, shown + PAGE);
    hits.slice(shown, to).forEach(e => ul.appendChild(card(e)));
    shown = to;
    more.hidden = shown >= hits.length;
    more.textContent = 'Ver más (' + (hits.length - shown) + ')';
  }
  function draw() {
    st.q = q.value; st.tec = tec.value; st.forma = forma.value; st.puede = pcb.checked;
    const words = norm(st.q).split(/\s+/).filter(Boolean);
    hits = all.filter(e => (!st.tec || e.tec === st.tec) && (!st.forma || e.forma === st.forma) && (!st.puede || puede(e))
      && words.every(w => key(e).includes(w)));
    count.textContent = hits.length === 1 ? '1 hechizo' : hits.length + ' hechizos' + (st.puede ? ' que puede aprender' : '');
    ul.innerHTML = '';
    shown = 0;
    if (!hits.length) ul.appendChild(h('li', { class: 'note', text: st.puede ? 'Ninguno a su alcance con estos filtros: quita «Solo los que puede aprender» para verlos todos.' : 'Ningún hechizo con estos filtros.' }));
    showMore();
  }
  let tm = null;
  q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(draw, 120); });
  [tec, forma, pcb].forEach(c => c.addEventListener('change', draw));
  more.addEventListener('click', showMore);

  const done = h('button', { type: 'button', class: 'btn' }, 'Listo');
  const mano = h('button', { type: 'button', class: 'btn ghost' }, 'Escribir uno a mano');
  const close = openModal('Hechizos', [fbar, help, ul, more], [mano, done]);
  done.addEventListener('click', () => close());
  mano.addEventListener('click', () => { close(); o.aMano(); });
  const box = document.body.lastElementChild;
  if (box && box.classList.contains('modal')) box.classList.add('vd-tab');
  drawBal();
  draw();
}

export { openSpellTab };
