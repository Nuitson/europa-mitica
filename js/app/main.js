/* Punto de entrada: rutas y arranque. js/gate.js lo importa cuando los datos están listos. */
import { DOCS, h, load, store } from './base.js';
import { currentRaw } from './saga/rules.js';
import { renderTree } from './tree.js';
import { focusPending, pendingFocus, viewDoc, viewHome, viewSaga } from './views.js';
import { sagaInit } from './saga/core.js';
import { renderSagaSide } from './saga/home.js';
import { sagaRoute } from './saga/characters.js';
import './search.js';
import './blocks.js';
import './saga/state.js';
import './saga/rules.js';
import './saga/seasons.js';
import './creation/rules.js';
import './creation/editor.js';
import './master.js';
import './info.js';

function route(keep) {
  const raw = currentRaw();
  const y = window.scrollY;
  // on a phone the index covers the page, so opening a section closes it; on a computer it stays open
  if (!window.matchMedia('(min-width: 901px)').matches) {
    document.body.classList.remove('nav-open');
    document.getElementById('navbtn').setAttribute('aria-expanded', 'false');
  }
  const parts = raw.split('--');
  const doc = DOCS[parts[0]];
  document.querySelectorAll('#tree .t-doc').forEach(a => a.setAttribute('aria-current', doc && a.dataset.doc === doc.id ? 'page' : 'false'));
  renderSagaSide();
  const guest = window.EM_WEB.guest;
  if (!doc && !guest && raw === 'saga') { viewSaga(); return; }
  if (!doc && !guest && sagaRoute(raw)) {
    if (keep) requestAnimationFrame(() => window.scrollTo(0, y));
    else if (!pendingFocus) window.scrollTo(0, 0);
    focusPending();
    return;
  }
  if (!doc) {
    const q = sideQuery;
    const input = viewHome(q);
    sideQuery = '';
    if (q) { const sq = document.getElementById('sideq'); if (window.matchMedia('(max-width: 900px)').matches) { input.focus(); } else { sq.focus(); } }
    return;
  }
  viewDoc(doc, parts[1], parts[2], keep ? y : null);
}

let sideQuery = '';
function init() {
  renderTree();
  const sideq = document.getElementById('sideq');
  sideq.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      sideQuery = sideq.value;
      if (location.hash === '#inicio' || !location.hash) route(); else location.hash = '#inicio';
    }
  });
  sideq.addEventListener('input', () => {
    const onHome = !DOCS[(location.hash.replace(/^#/, '').split('--')[0])];
    const hq = document.getElementById('homeq');
    if (onHome && hq) { hq.value = sideq.value; hq.dispatchEvent(new Event('input')); return; }
    if (sideq.value.trim().length >= 2) {
      // searching from a document: switch to the start page, where results are listed
      sideQuery = sideq.value;
      location.hash = '#inicio';
    }
  });
  sideToggle();
  window.addEventListener('hashchange', () => route());
  route();
  sagaInit();
}

/* the side panel. On a phone, the top bar's button slides it in. On a computer it is hidden too, behind its own button; the
   pin keeps it in its column (remembered in this browser), and unpinned it hides 10 seconds after the pointer leaves it */
const PIN_KEY = 'em:indice-fijo';
const HIDE_MS = 10000;
const PIN_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M9.8 1.8 14.2 6.2 12.6 6.6 10.2 9 10.4 12 9.4 13 6.7 10.3 3 14 2 13l3.7-3.7L3 6.6 4 5.6l3 .2 2.4-2.4z"/></svg>';
function sideToggle() {
  const body = document.body, side = document.getElementById('side'), btn = document.getElementById('navbtn');
  const wide = window.matchMedia('(min-width: 901px)');
  const sbtn = h('button', { type: 'button', id: 'sidebtn', class: 'side-btn', 'aria-controls': 'side', 'aria-expanded': 'false',
    html: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 4h12M2 8h12M2 12h12"/></svg>Índice' });
  const pin = h('button', { type: 'button', class: 'side-pin', html: PIN_SVG });
  side.insertBefore(pin, side.firstChild);
  document.querySelector('.shell').insertAdjacentElement('beforebegin', sbtn);
  let hideT = null;
  const isOpen = () => body.classList.contains('nav-open');
  const pinned = () => body.classList.contains('side-pinned');
  const setOpen = open => {
    clearTimeout(hideT);
    body.classList.toggle('nav-open', open);
    [btn, sbtn].forEach(b => b.setAttribute('aria-expanded', open ? 'true' : 'false'));
  };
  const setPin = on => {
    body.classList.toggle('side-pinned', on);
    store(PIN_KEY, on ? '1' : null);
    pin.setAttribute('aria-pressed', on ? 'true' : 'false');
    pin.setAttribute('aria-label', on ? 'Soltar el índice' : 'Fijar el índice');
    pin.title = on ? 'Soltar el índice: se oculta solo' : 'Fijar el índice: se queda abierto';
    setOpen(!on);   // unpinned, it stays open where it was until the pointer leaves it
  };
  body.classList.toggle('side-pinned', load(PIN_KEY) === '1');
  pin.setAttribute('aria-pressed', pinned() ? 'true' : 'false');
  pin.setAttribute('aria-label', pinned() ? 'Soltar el índice' : 'Fijar el índice');
  pin.title = pinned() ? 'Soltar el índice: se oculta solo' : 'Fijar el índice: se queda abierto';
  pin.addEventListener('click', () => setPin(!pinned()));
  btn.addEventListener('click', () => setOpen(!isOpen()));
  sbtn.addEventListener('click', () => setOpen(!isOpen()));
  document.getElementById('scrim').addEventListener('click', () => setOpen(false));
  side.addEventListener('mouseenter', () => clearTimeout(hideT));
  side.addEventListener('mouseleave', () => {
    if (!wide.matches || pinned() || !isOpen()) return;
    clearTimeout(hideT);
    hideT = setTimeout(() => setOpen(false), HIDE_MS);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen() && !(wide.matches && pinned()) && !document.querySelector('.modal')) setOpen(false); });
}

export { route };

init();
