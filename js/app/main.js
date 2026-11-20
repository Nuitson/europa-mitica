/* Punto de entrada: rutas y arranque. js/gate.js lo importa cuando los datos están listos. */
import { DOCS } from './base.js';
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
  document.body.classList.remove('nav-open');
  document.getElementById('navbtn').setAttribute('aria-expanded', 'false');
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
  const btn = document.getElementById('navbtn');
  btn.addEventListener('click', () => { const open = !document.body.classList.contains('nav-open'); document.body.classList.toggle('nav-open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); });
  document.getElementById('scrim').addEventListener('click', () => { document.body.classList.remove('nav-open'); btn.setAttribute('aria-expanded', 'false'); });
  window.addEventListener('hashchange', () => route());
  route();
  sagaInit();
}

export { route };

init();
