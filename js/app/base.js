/* Datos de la página, artes y utilidades comunes (h, esc, números, almacenamiento local). */

// js/gate.js loads data/*.json, joins the saga's own folder and leaves it all in window.EM_DATA before starting the page
const DATA = window.EM_DATA.data;
const IMG = window.EM_DATA.img;
const DOCS = {};
DATA.docs.forEach(d => { DOCS[d.id] = d; });
const ARTS_T = ['Creo', 'Intellego', 'Muto', 'Perdo', 'Rego'];
const ARTS_F = ['Animal', 'Aquam', 'Auram', 'Corpus', 'Herbam', 'Ignem', 'Imaginem', 'Mentem', 'Terram', 'Vim'];
const ARTS = ARTS_T.concat(ARTS_F);
const ABBR = { Creo: 'Cr', Intellego: 'In', Muto: 'Mu', Perdo: 'Pe', Rego: 'Re', Animal: 'An', Aquam: 'Aq', Auram: 'Au',
  Corpus: 'Co', Herbam: 'He', Ignem: 'Ig', Imaginem: 'Im', Mentem: 'Me', Terram: 'Te', Vim: 'Vi' };
const ICON = {
  folder: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 3.5A1 1 0 0 1 2.5 2.5h3.6l1.5 1.6h5.9a1 1 0 0 1 1 1v7.4a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/></svg>',
  sheet: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M2.5 5.5h11M2.5 9h11M2.5 12h11M6.5 5.5v9"/></svg>',
  ext: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 2H2v8h8V7M7 1.5h3.5V5M10.5 1.5 5.5 6.5"/></svg>',
  cube: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 2 17 6v8l-7 4-7-4V6z M3 6l7 4 7-4 M10 10v8"/></svg>',
  search: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>'
};

/* ---------------------------------------------------------------- helpers */
function h(tag, attrs, kids) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style') n.setAttribute('style', v);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  if (kids != null) (Array.isArray(kids) ? kids : [kids]).forEach(c => {
    if (c == null || c === false) return;
    n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  });
  return n;
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function br(s) { return esc(s).replace(/\n/g, '<br>'); }
function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function artOf(s) {
  if (!s) return null;
  const k = norm(s).trim();
  for (const a of ARTS) if (norm(a) === k) return a;
  if (k === 'imagem' || k === 'imaggen' || k === 'imagen') return 'Imaginem';
  return null;
}
function artVar(a) { return a ? 'var(--' + ABBR[a].toLowerCase() + ')' : 'var(--ink-3)'; }
function artChip(a, label) {
  const c = artOf(a);
  return h('span', { class: 'art', style: '--a:' + artVar(c), title: a }, label != null ? label : a);
}
function toNum(s) {
  if (s == null || s === '') return NaN;
  const t = String(s).replace(/\s/g, '').replace('−', '-').replace(',', '.');
  return /^[-+]?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : NaN;
}
function fmt(n) {
  if (!isFinite(n)) return '';
  const r = Math.round(n * 100) / 100;
  return String(r).replace('.', ',');
}
function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n)); }
function opify(s) {
  return esc(s).replace(/(\s)(\+|–|-|×|x|\/|vs\.)(\s)/g, '$1<span class="op">$2</span>$3').replace(/\n/g, '<br>');
}
function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

/* a row that scrolls sideways (tabs, the editor's budget chips): fade the edge that has more, since phones hide the
   scrollbar, and bring the current tab into view */
function scrollHint(el, current) {
  const set = () => {
    el.classList.toggle('more-l', el.scrollLeft > 2);
    el.classList.toggle('more-r', el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };
  el.addEventListener('scroll', set, { passive: true });
  new ResizeObserver(set).observe(el);
  requestAnimationFrame(() => {
    if (current && current.offsetLeft + current.offsetWidth > el.clientWidth) el.scrollLeft = current.offsetLeft - 24;
    set();
  });
  return el;
}

/* a dialog on top of the page: everything else is inert (no focus, hidden from screen readers) until it closes,
   except the status messages (#toast), which must still be announced; returns the function that undoes it */
function inertOthers(top) {
  const set = [...document.body.children].filter(el => el !== top && el.id !== 'toast' && !el.inert);
  set.forEach(el => { el.inert = true; });
  return () => set.forEach(el => { el.inert = false; });
}

/* block renderers by type (R.p, R.table, …): js/app/blocks.js fills most, saga/home.js the live ones */
const R = {};

export { inertOthers, scrollHint, ABBR, artChip, artOf, ARTS, ARTS_F, ARTS_T, artVar, br, DATA, DOCS, esc, fmt, h, ICON, IMG, load, norm, opify, R, signed, store, toNum };
