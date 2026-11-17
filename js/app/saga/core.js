/* La saga en curso: carga, suscripciones, escrituras, avisos y controles de formulario. */
import { artOf, artVar, DATA, DOCS, h, IMG, inertOthers, signed } from '../base.js';
import { resetIndex } from '../search.js';
import { page } from '../views.js';
import { S, SEASONS, SUBS, TIPOS, tkey } from './state.js';
import { currentRaw, numv } from './rules.js';
import { glanceNode, homeSaga, renderSagaSide } from './home.js';
import { route } from '../main.js';

let modalOpen = false, pendingRerender = false;

/* ---------- loading: subscribe once per collection, time-limit the wait */
function sagaInit() {
  const W = window.EM_WEB;
  if (!W.db) { S.status = 'off'; sagaChanged(); return; }
  S.db = W.db; S.assets = W.assets; S.uid = W.uid;
  S.canWrite = true; // the server decides what each role may write
  S.owner = W.rol === 'master';
  // the server stops (or starts again) answering: say so, and drop the note once it is back
  W.db.onConnection(ok => {
    if (!ok && S.status !== 'revoked' && S.status !== 'error') { clearTimeout(S.timer); S.status = 'error'; sagaChanged(); }
    else if (ok && S.status === 'error') { S.status = SUBS.every(([, k]) => S.fresh[k]) ? 'ready' : 'loading'; sagaChanged(); }
  });
  S.timer =setTimeout(() => { if (S.status === 'loading') { S.status = 'slow'; sagaChanged(); } }, 10000);
  SUBS.forEach(sub => subscribe(sub, 0));
}
function subscribe(sub, attempt) {
  if (!S.db) return;
  const [path, key] = sub;
  const onErr = e => {
    const code = e && e.code;
    if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') {
      clearTimeout(S.timer);
      S.db = null; S.status = 'revoked';
      sagaChanged(); return;
    }
    if ((code === 'unavailable' || !code) && attempt < 3) { setTimeout(() => subscribe(sub, attempt + 1), 2500 * (attempt + 1)); return; }
    clearTimeout(S.timer); S.status = 'error'; sagaChanged();
  };
  if (path.split('/').length % 2 === 0) {
    S.db.doc(path).onSnapshot(s => { S[key] = s.exists ? s.data() : null; gotSnap(key, s.metadata); }, onErr);
  } else {
    S.db.collection(path).onSnapshot(snap => {
      const o = {};
      snap.docs.forEach(d => { o[d.id] = d.data(); });
      S[key] = o;
      gotSnap(key, snap.metadata);
    }, onErr);
  }
}
function gotSnap(key, meta) {
  S.seen[key] = true;
  if (!meta || !meta.fromCache) S.fresh[key] = true;
  if ((S.status === 'loading' || S.status === 'slow') && SUBS.every(([, k]) => S.fresh[k])) { S.status = 'ready'; clearTimeout(S.timer); }
  sagaChanged();
}
function allSeen() { return SUBS.every(([, k]) => S.seen[k]); }

let chTimer = null;
function sagaChanged() { resetIndex(); clearTimeout(chTimer); chTimer = setTimeout(applySagaChange, 60); }
function hasLive(blocks) {
  return (blocks || []).some(b => b.live || b.t === 'dynvis' || b.t === 'dyntes' || b.t === 'pjlink' || (b.t === 'cols' && b.items.some(c => hasLive(c))));
}
function applySagaChange() {
  renderSagaSide();
  if (modalOpen) { pendingRerender = true; return; }
  const raw = currentRaw();
  const parts = raw.split('--');
  const doc = DOCS[parts[0]];
  // someone is typing in the page (wounds, fatigue, a filter): redraw when they leave the field, not under their fingers
  const a = document.activeElement;
  const typing = () => a && page.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) ? (a.addEventListener('blur', () => sagaChanged(), { once: true }), true) : false;
  if (doc) {
    const sh = doc.sheets.find(s => s.id === parts[1]) || doc.sheets[0];
    if (hasLive(sh.blocks) && !typing()) route(true);
    return;
  }
  if (raw === 'pj-nuevo' || /--editar$/.test(raw)) { if (!page.querySelector('form.pj-form')) route(true); return; } // never clobber a form being filled in
  if (raw === 'master' || /^(estaciones|personajes|pj--)/.test(raw)) { if (!typing()) route(true); return; }
  const box = document.getElementById('home-saga');
  if (box) box.replaceWith(homeSaga());
  document.querySelectorAll('.glance').forEach(el => { if (el._g) el.replaceWith(glanceNode(el._g)); });
}

/* ---------- writes */
async function dbWrite(fn, okMsg) {
  if (!S.db) { toast('La saga en curso no está disponible en esta vista.'); return false; }
  const fail = e => {
    const code = e && e.code;
    if (code === 'permission_denied') toast('No tienes permiso para guardar este cambio: pídeselo al máster.');
    else if (code === 'invalid_argument' || code === 'transform_error') toast('No se ha podido guardar: los datos no son válidos.');
    else if (code === 'quota_exceeded') toast('La base de datos de la página está llena. Borra entradas antiguas para seguir guardando.');
    else if (code === 'resource_exhausted') toast('Demasiados cambios seguidos. Espera un momento y vuelve a intentarlo.');
    else if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') { S.db = null; S.status = 'revoked'; sagaChanged(); toast('La saga en curso ya no está disponible en esta vista.'); }
    else toast('No se ha podido guardar. Inténtalo de nuevo.');
    return false;
  };
  try { await fn(); if (okMsg) toast(okMsg); return true; } catch (e) {
    if (e && e.code === 'unavailable') {
      await new Promise(r => setTimeout(r, 500 + Math.random() * 700));
      try { await fn(); if (okMsg) toast(okMsg); return true; } catch (e2) { return fail(e2); }
    }
    return fail(e);
  }
}
function stamp(o, isNew) { o.actualizado = Date.now(); if (S.uid) o.por = S.uid; if (isNew) o.creado = o.actualizado; return o; }
/* show a confirmed write at once; the next snapshot replaces the collection anyway */
function localPut(key, id, doc) { S[key] = Object.assign({}, S[key], { [id]: doc }); sagaChanged(); }
function localDel(key, ids) { const o = Object.assign({}, S[key]); [].concat(ids).forEach(id => { delete o[id]; }); S[key] = o; sagaChanged(); }

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('on'), 4200);
}

/* ---------- form bits */
function openModal(title, body, actions) {
  modalOpen = true;
  const opener = document.activeElement;
  const box = h('div', { class: 'modal' });
  const card = h('div', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  card.appendChild(h('div', { class: 'modal-h' }, [h('h2', { text: title }), h('button', { type: 'button', class: 'x', 'aria-label': 'Cerrar', onclick: () => close() }, '×')]));
  card.appendChild(h('div', { class: 'modal-b fx' }, body));
  card.appendChild(h('div', { class: 'modal-f' }, actions));
  box.appendChild(card);
  const onkey = e => { if (e.key === 'Escape') close(); };
  let release = () => {};
  function close() {
    if (!box.isConnected) return;
    release(); window.removeEventListener('hashchange', close);
    box.remove(); document.removeEventListener('keydown', onkey); document.body.classList.remove('modal-on'); modalOpen = false;
    if (opener && opener.isConnected) opener.focus();
    if (pendingRerender) { pendingRerender = false; sagaChanged(); }
  }
  box.addEventListener('mousedown', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', onkey);
  window.addEventListener('hashchange', close); // Back, or a link inside: the dialog belongs to the page it was opened on
  document.body.appendChild(box);
  document.body.classList.add('modal-on');
  release = inertOthers(box); // the keyboard stays in the dialog
  // focus goes into the dialog: its first field, or the dialog itself so screen readers read it
  const first = card.querySelector('.modal-b input, .modal-b select, .modal-b textarea');
  card.setAttribute('tabindex', '-1');
  setTimeout(() => (first || card).focus(), 30);
  return close;
}
function confirmButton(label, confirmLabel, fn) {
  let armed = false, tm = null;
  const b = h('button', { type: 'button', class: 'btn danger' }, label);
  b.addEventListener('click', () => {
    if (!armed) { armed = true; b.textContent = confirmLabel; b.classList.add('armed'); tm = setTimeout(() => { armed = false; b.textContent = label; b.classList.remove('armed'); }, 4000); return; }
    clearTimeout(tm); armed = false; b.classList.remove('armed'); b.textContent = label; fn();
  });
  return b;
}
function field(label, ctl, hint, cls) {
  return h('label', { class: 'fld' + (cls ? ' ' + cls : '') }, [h('span', { class: 'fl', text: label }), ctl, hint ? h('span', { class: 'fh', text: hint }) : null]);
}
function cell(label, ctl) { return h('label', { class: 'cell', 'data-l': label }, ctl); }
function inp(value, on, attrs) {
  const i = h('input', Object.assign({ type: 'text', value: value == null ? '' : value }, attrs || {}));
  i.addEventListener('input', () => on(i.value, i));
  return i;
}
function sel(options, value, on, attrs) {
  const opts = options.map(o => Array.isArray(o) ? o : [o, o]);
  if (value != null && value !== '' && !opts.some(o => String(o[0]) === String(value))) opts.push([value, value]);
  const s = h('select', attrs || {}, opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) ? true : null }, l)));
  s.addEventListener('change', () => on(s.value, s));
  return s;
}
function datalist(id, values) {
  let dl = document.getElementById(id);
  if (dl) dl.remove();
  const seen = new Set(), list = [];
  values.forEach(v => { const k = tkey(v); if (v && !seen.has(k)) { seen.add(k); list.push(v); } });
  dl = h('datalist', { id: id }, list.map(v => h('option', { value: v })));
  document.body.appendChild(dl);
  return id;
}
function seasonPicker(d) {
  return h('div', { class: 'fld-row' }, [
    field('Estación', sel(SEASONS.map((s, i) => [i + 1, s]), d.est, v => { d.est = Number(v); })),
    field('Año', inp(d.anio, v => { const n = parseInt(v, 10); if (n) d.anio = n; }, { type: 'number', min: '1000', max: '1500', inputmode: 'numeric' }))]);
}
function portraitSrc(pj) {
  if (!pj) return null;
  if (pj._retUrl) return pj._retUrl;
  if (pj.retrato && pj.retrato.id) return window.EM_WEB.blobUrl(pj.retrato.id) || null;
  if (pj.retratoStatic && DATA.portraits && IMG[DATA.portraits[pj.retratoStatic]]) return IMG[DATA.portraits[pj.retratoStatic]];
  return null;
}
function monogram(pj, cls) {
  const ini = String((pj && pj.nombre) || '?').split(/\s+/).filter(w => w && /^\p{L}/u.test(w) && !/^(ex|de|del|la|el)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const fallback = () => h('span', { class: cls + ' ini', 'aria-hidden': 'true', text: ini });
  const src = portraitSrc(pj);
  if (!src) return fallback();
  const img = h('img', { class: cls, src: src, alt: '' });
  img.addEventListener('error', () => { if (img.isConnected) img.replaceWith(fallback()); });
  return img;
}
function shrinkImage(file, max) {
  return new Promise(resolve => {
    let url;
    try { url = URL.createObjectURL(file); } catch (e) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k)), hh = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = hh;
        const g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, hh);
        g.drawImage(img, 0, 0, w, hh);
        URL.revokeObjectURL(url);
        c.toBlob(b => resolve(b), 'image/jpeg', 0.86);
      } catch (e) { URL.revokeObjectURL(url); resolve(null); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
function pjLink(id) { const pj = S.pj[id]; return h('a', { href: '#pj--' + id, text: pj ? pj.nombre : id }); }
function sumRep(rep) { return (rep || []).reduce((s, r) => s + numv(r.px), 0); }
function repChips(rep) {
  return h('span', { class: 'reps' }, (rep || []).filter(r => r.r && numv(r.px)).map(r => {
    const a = artOf(r.r);
    return h('span', { class: 'rep' + (a ? ' art' : ''), style: a ? '--a:' + artVar(a) : null, text: r.r + ' ' + signed(numv(r.px)) });
  }));
}
function statusNote() {
  if (S.status === 'off') return h('p', { class: 'note saga-note', text: 'No se puede conectar con el servidor de la saga. Comprueba la conexión y recarga la página.' });
  if (S.status === 'revoked') return h('p', { class: 'note saga-note', text: 'La saga en curso no está disponible en esta vista.' });
  if (S.status === 'error') return h('p', { class: 'note saga-note', role: 'status' }, ['Se ha perdido la conexión con el servidor de la saga; lo que ves puede estar desactualizado y lo que guardes puede no llegar. Se reintenta solo. ',
    h('button', { type: 'button', class: 'lnk', onclick: () => window.EM_WEB.refresh() }, 'Reintentar ahora')]);
  if (S.status === 'slow') return h('p', { class: 'note saga-note', text: allSeen() ? 'Los datos todavía no han llegado del todo; puede que lo que ves esté desactualizado.' : 'Los datos de la saga todavía no llegan.' });
  if (S.status === 'loading' && !allSeen()) return h('p', { class: 'note saga-note', text: 'Cargando los datos de la saga…' });
  if (S.db && S.canWrite === false) return h('p', { class: 'note saga-note', text: 'Puedes consultar la saga, pero no tienes permiso para guardar cambios.' });
  return null;
}
function sagaCrumbs(items) {
  const c = h('div', { class: 'crumbs' }, [h('a', { href: '#inicio', text: DATA.root.short }), h('span', { class: 'sep', text: '/' }), h('a', { href: '#estaciones', text: 'Saga en curso' })]);
  items.forEach(([t, href]) => { c.appendChild(h('span', { class: 'sep', text: '/' })); c.appendChild(href ? h('a', { href: href, text: t }) : h('span', { text: t })); });
  return c;
}
function pjsSorted(includeInactive) {
  return Object.keys(S.pj).map(id => Object.assign({ _id: id }, S.pj[id])).filter(p => includeInactive || p.activo !== false)
    .sort((a, b) => (TIPOS.indexOf(a.tipo) + 9) % 9 - (TIPOS.indexOf(b.tipo) + 9) % 9 || String(a.nombre).localeCompare(String(b.nombre), 'es'));
}

export { allSeen, cell, confirmButton, datalist, dbWrite, field, inp, localDel, localPut, monogram, openModal, pjLink, pjsSorted, repChips, sagaChanged, sagaCrumbs, sagaInit, seasonPicker, sel, shrinkImage, stamp, statusNote, sumRep, toast };
