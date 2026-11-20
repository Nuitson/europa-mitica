/* ================================================================== EUROPA MÍTICA · VERSIÓN WEB
   Runs before the page: asks for the account (js/cuenta.js: sign in, sign up, recover the password, «Mi zona»), opens
   the chosen saga (the server, api/lib.php, says which role that account has in it), loads that saga's own documents
   and hands the page (window.EM_WEB) a database that talks to the server. Only the chosen saga's data ever reach
   this browser. */
(function () {
'use strict';
const CFG = window.EM_CONFIG || {};
const K_SES = 'em:sesion', K_ARC = 'em:archivo:', K_MSG = 'em:aviso', K_ZONA = 'em:zona', K_LAST = 'em:ultima';
const POLL_MS = 15000;
const APP = new URL('app/main.js', document.currentScript.src).href; // the app's modules, next to this script
const CUENTA = new URL('cuenta.js', document.currentScript.src).href; // the account screens, loaded when needed
// a copy of the page in this browser, for the game aids without a connection (sw.js, at the site's root)
if ('serviceWorker' in navigator) navigator.serviceWorker.register(new URL('../sw.js', document.currentScript.src)).catch(() => {});

/* ---------- small helpers */
function lsGet(k, sess) { try { return (sess ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } }
function lsSet(k, v, sess) { try { const s = sess ? sessionStorage : localStorage; if (v == null) s.removeItem(k); else s.setItem(k, v); } catch (e) { /* storage unavailable */ } }
function el(tag, attrs, kids) {
  const n = document.createElement(tag);
  Object.keys(attrs || {}).forEach(k => {
    const v = attrs[k];
    if (v == null || v === false) return;
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k === 'html') n.innerHTML = v;
    else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
  });
  [].concat(kids == null ? [] : kids).forEach(c => { if (c != null && c !== false) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return n;
}
const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
function rid(n) { const a = 'abcdefghijklmnopqrstuvwxyz0123456789'; let s = ''; const r = new Uint32Array(n || 20); crypto.getRandomValues(r); r.forEach(x => { s += a[x % 36]; }); return s; }
/* ---------- the server */
class ApiError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
async function api(accion, datos) {
  if (!CFG.backend) throw new ApiError('config', 'Falta la dirección del servidor: ponla en config.js (está explicado en el README).');
  let res;
  try { res = await fetch(CFG.backend, { method: 'POST', body: JSON.stringify(Object.assign({ accion: accion }, datos || {})), redirect: 'follow' }); }
  catch (e) { throw new ApiError('unavailable', 'No hay conexión con el servidor de la saga.'); }
  if (!res.ok) throw new ApiError('unavailable', 'El servidor de la saga ha respondido con un error (' + res.status + ').');
  let o;
  try { o = await res.json(); } catch (e) { throw new ApiError('unavailable', 'El servidor de la saga ha dado una respuesta que no entiendo. ¿Está bien publicada la aplicación web?'); }
  if (o && o.error) throw new ApiError(o.error, o.mensaje || 'Error del servidor.');
  return o;
}

/* ---------- the shared aids, the spell catalogue and the image list: static files served next to the page */
const STATIC = { data: 'data/ayudas.json', img: 'data/imagenes.json', hech: 'data/hechizos.json', hb: 'data/homebrew/index.json' };
let staticLoad = null;
function loadStatic() {
  if (!staticLoad) {
    staticLoad = Promise.all(Object.keys(STATIC).map(async k => {
      const res = await fetch(STATIC[k]);
      if (!res.ok) throw new Error(STATIC[k] + ': ' + res.status);
      return [k, await res.json()];
    })).then(pairs => {
      const o = {};
      pairs.forEach(([k, v]) => { o[k] = v; });
      return o;
    }).catch(() => {
      staticLoad = null; // let «Reintentar» fetch them again
      throw new ApiError('estaticos', 'No se han podido cargar las ayudas de juego. Comprueba la conexión y vuelve a intentarlo.');
    });
  }
  return staticLoad;
}

/* ---------- session: the account's token, in localStorage when the user asks to be remembered, else for this tab only */
function getSession() {
  const raw = lsGet(K_SES) || lsGet(K_SES, true);
  try { const s = raw ? JSON.parse(raw) : null; return s && s.token ? { token: s.token } : null; } catch (e) { return null; }
}
function putSession(s, remember) {
  lsSet(K_SES, null); lsSet(K_SES, null, true);
  if (s) lsSet(K_SES, JSON.stringify({ token: s.token }), !remember);
}
// sign out, or go back to «Mi zona» (the page reloads: the next start shows what was asked for)
function salir(msg) { putSession(null); if (msg) lsSet(K_MSG, msg, true); location.hash = ''; location.reload(); }
function aZona(msg) { if (msg) lsSet(K_MSG, msg, true); lsSet(K_ZONA, '1', true); location.hash = ''; location.reload(); }
function sessionLost(msg) { putSession(null); lsSet(K_MSG, msg || 'Tu sesión ha caducado. Vuelve a entrar.', true); location.hash = '#entrar'; location.reload(); }
// guests browse the public part; «Entrar» (or the sign-in link) asks for the account
function aEntrar() { location.hash = '#entrar'; location.reload(); }
function comoInvitado() { location.hash = ''; location.reload(); }

/* ================================================================== the gate */
const gate = el('div', { id: 'gate', class: 'gate', role: 'main' });
function showGate(content) {
  document.body.classList.add('gate-on');
  if (!gate.isConnected) document.body.appendChild(gate);
  gate.innerHTML = '';
  gate.appendChild(el('div', { class: 'gate-card' }, [
    el('div', { class: 'gate-k', text: 'Ars Magica · Quinta edición' }),
    el('h1', { class: 'gate-t', text: 'Europa Mítica' })].concat(content)));
  const f = gate.querySelector('[autofocus]');
  if (f) setTimeout(() => f.focus(), 30);
}
function busy(text) { showGate([el('p', { class: 'gate-busy', role: 'status', text: text })]); }
function errBox() { return el('p', { class: 'gate-err', role: 'alert', hidden: true }); }
function showErr(box, msg) { box.textContent = msg; box.hidden = !msg; }

/* the account's avatar (its picture, or its initials on a coloured disc) */
function avatar(p, px) {
  const box = el('span', { class: 'avatar', style: 'width:' + px + 'px;height:' + px + 'px;font-size:' + Math.round(px * 0.42) + 'px', 'aria-hidden': 'true' });
  if (p && p.avatar) box.appendChild(el('img', { src: p.avatar, alt: '' }));
  else box.textContent = String((p && (p.nombre || p.usuario)) || '?').trim().slice(0, 1).toUpperCase();
  return box;
}

let cuentaMod = null;
async function cuenta() {
  if (!cuentaMod) cuentaMod = (await import(CUENTA)).crear(CTX);
  return cuentaMod;
}
const CTX = { el: el, api: api, showGate: showGate, busy: busy, errBox: errBox, showErr: showErr, lsGet: lsGet, lsSet: lsSet, avatar: avatar,
  K_MSG: K_MSG, K_LAST: K_LAST, invitado: () => comoInvitado(), putSession: putSession, salir: salir, openSaga: (ses, id) => openSaga(ses, id), continuar: ses => continuar(ses),
  sessionLost: sessionLost, offlineButton: e => offlineButton(e), retry: () => gateStart() };

/* the entry: without a session, sign in or sign up; with one, straight into the last saga (or «Mi zona» if there is none, or it was asked for) */
async function gateStart() {
  const rec = /^#recuperar=([0-9a-f]{64})$/.exec(location.hash);
  if (rec) { putSession(null); (await cuenta()).auth({ recuperar: rec[1] }); return; }
  const ses = getSession();
  if (!ses) {
    if (location.hash === '#entrar') (await cuenta()).auth(); else openGuest();
    return;
  }
  if (location.hash === '#entrar') history.replaceState(null, '', location.pathname + location.search);
  busy('Abriendo tu cuenta…');
  try { ses.perfil = (await api('perfil', { token: ses.token })).perfil; }
  catch (e) {
    if (e.code === 'sesion') { putSession(null); (await cuenta()).auth({ nota: e.message }); return; }
    const retry = el('button', { type: 'button', class: 'gbtn', text: 'Reintentar', onclick: gateStart });
    showGate([el('p', { class: 'gate-err', role: 'alert', text: e.message }), el('div', { class: 'gate-act' }, [retry, offlineButton(e)])]);
    return;
  }
  const zona = lsGet(K_ZONA, true);
  lsSet(K_ZONA, null, true);
  if (zona) (await cuenta()).zona(ses); else continuar(ses);
}
/* with the account open: into the last saga, into the only one it has, or «Mi zona» */
async function continuar(ses) {
  const sagas = ses.perfil.sagas;
  const last = lsGet(K_LAST);
  const id = sagas.some(s => s.id === last) ? last : sagas.length === 1 ? sagas[0].id : null;
  if (id) openSaga(ses, id); else (await cuenta()).zona(ses);
}

/* ================================================================== guests: the public part, with no account and no saga */
async function openGuest() {
  busy('Abriendo Europa Mítica…');
  let st;
  try { st = await loadStatic(); }
  catch (e) {
    showGate([el('p', { class: 'gate-err', role: 'alert', text: e.message }), el('div', { class: 'gate-act' }, [
      el('button', { type: 'button', class: 'gbtn', text: 'Reintentar', onclick: () => location.reload() }),
      el('button', { type: 'button', class: 'glink', text: 'Entrar con mi cuenta', onclick: aEntrar })])]);
    return;
  }
  st.data.tree = st.data.tree.slice();
  st.data.saga = { anio: 1220, est: 1, aura: 0 };
  window.EM_DATA = st;
  const none = () => Promise.reject(new ApiError('sesion', 'Entra con tu cuenta para ver la saga.'));
  window.EM_WEB = { guest: true, saga: null, rol: null, uid: null, user: null, db: null, assets: null, api: none, blobUrl: () => null,
    salir: salir, entrar: aEntrar, session: () => ({ guest: true }), setToken: () => {}, refresh: () => Promise.resolve() };
  startApp({ guest: true });
}

/* ================================================================== opening a saga */
async function openSaga(ses, sagaId) {
  const entry = (ses.perfil && ses.perfil.sagas.find(s => s.id === sagaId)) || { nombre: 'saga' };
  busy('Abriendo la ' + entry.nombre + '…');
  let arc = null, st = null;
  const statics = loadStatic();
  statics.catch(() => {}); // awaited below; this only keeps an early failure from being reported as unhandled
  try {
    // the saga may have changed since this session began (members, archive): ask the server, which also says the role here
    const info = await api('info', { token: ses.token, saga: sagaId });
    ses.saga = info.saga; ses.rol = info.rol;
    lsSet(K_LAST, sagaId);
    if (ses.saga.archivo) arc = await loadArchive(ses);
    st = await statics;
  } catch (e) {
    if (e.code === 'sesion') return sessionLost(e.message);
    if (e.code === 'saga') return aZona(e.message);
    const retry = el('button', { type: 'button', class: 'gbtn', text: 'Reintentar', onclick: () => openSaga(ses, sagaId) });
    const out = el('button', { type: 'button', class: 'glink', text: 'Mi zona', onclick: () => aZona() });
    showGate([el('p', { class: 'gate-err', role: 'alert', text: e.message }), el('div', { class: 'gate-act' }, [retry, offlineButton(e), out])]);
    return;
  }
  lsSet(K_OFF, JSON.stringify({ saga: offlineSaga(ses.saga), rol: ses.rol }));
  window.EM_DATA = merge(ses, arc, st);
  const db = makeDb(ses);
  const assets = { upload: (blob, opts) => db._upload(blob, opts) };
  window.EM_WEB = { saga: ses.saga, rol: ses.rol, uid: ses.perfil.id, user: ses.perfil, db: db, assets: assets,
    api: (a, d) => api(a, Object.assign({ token: ses.token, saga: ses.saga.id }, d || {})), blobUrl: id => db._blob(id),
    salir: salir, zona: aZona, session: () => ses, setToken: t => { ses.token = t; putSession(ses, !!lsGet(K_SES)); }, refresh: () => db._poll(true) };
  startApp(ses);
}

/* ---------- without a connection: the last saga opened in this browser, with the game aids only
   (the service worker, sw.js, keeps the page and data/*.json; the saga's archive comes from its localStorage copy) */
const K_OFF = 'em:sin-conexion';
// what the page needs of a saga to show it, and nothing else kept beyond the session
function offlineSaga(s) { const o = {}; ['id', 'nombre', 'alianza', 'anio', 'est', 'aura'].forEach(k => { if (s[k] != null) o[k] = s[k]; }); return o; }
function offlineButton(e) {
  let off = null;
  try { off = JSON.parse(lsGet(K_OFF) || 'null'); } catch (x) { off = null; }
  if (!off || !off.saga || !off.saga.id || (e && e.code !== 'unavailable')) return null;
  return el('button', { type: 'button', class: 'glink', text: 'Abrir la ' + off.saga.nombre + ' sin conexión (solo las ayudas de juego)', onclick: () => openOffline(off) });
}
async function openOffline(off) {
  busy('Abriendo sin conexión…');
  let st;
  try { st = await loadStatic(); }
  catch (e) {
    const retry = el('button', { type: 'button', class: 'gbtn', text: 'Reintentar', onclick: () => location.reload() });
    showGate([el('p', { class: 'gate-err', role: 'alert', text: 'No hay conexión y las ayudas de juego todavía no están guardadas en este navegador: ábrelas una vez con conexión.' }), retry]);
    return;
  }
  let arc = null;
  try { const c = JSON.parse(lsGet(K_ARC + off.saga.id) || 'null'); arc = c && c.archivo || null; } catch (e) { arc = null; }
  const ses = { saga: off.saga, rol: off.rol, offline: true, perfil: null };
  window.EM_DATA = merge(ses, arc, st);
  const none = () => Promise.reject(new ApiError('unavailable', 'Sin conexión con el servidor de la saga.'));
  window.EM_WEB = { saga: ses.saga, rol: ses.rol, uid: null, user: null, db: null, assets: null, api: none, blobUrl: () => null,
    salir: salir, session: () => ses, setToken: () => {}, refresh: () => Promise.resolve(), offline: true };
  startApp(ses);
}

async function startApp(ses) {
  gate.remove();
  document.body.classList.remove('gate-on');
  document.title = ses.saga ? ses.saga.nombre + ' — Europa Mítica' : 'Europa Mítica';
  // importing the app starts it (js/app/main.js reads window.EM_DATA and window.EM_WEB as it loads)
  try { await import(APP); }
  catch (e) {
    console.error(e);
    showGate([el('p', { class: 'gate-err', role: 'alert', text: 'No se ha podido cargar la página. Recárgala para volver a intentarlo.' })]);
    return;
  }
  sessionStrip(ses);
}

async function loadArchive(ses) {
  const key = K_ARC + ses.saga.id;
  try {
    const c = JSON.parse(lsGet(key) || 'null');
    if (c && c.rev === ses.saga.archivo && c.archivo) return c.archivo;
  } catch (e) { /* stale cache */ }
  const r = await api('archivo', { token: ses.token, saga: ses.saga.id });
  if (r.archivo) lsSet(key, JSON.stringify({ rev: r.rev, archivo: r.archivo }));
  return r.archivo;
}

/* the saga's own folder joins the shared aids: its spreadsheets (archive) or, for a new saga, the web's vis and treasury */
function merge(ses, arc, st) {
  const D = st.data, I = st.img;
  const s = ses.saga;
  const node = { f: s.nombre, saga: true, glance: [], children: [] }; // saga: true = exclusive to this saga (the rest of the tree is shared by all)
  if (arc && Array.isArray(arc.docs)) {
    D.docs = D.docs.concat(arc.docs);
    Object.assign(I, arc.img || {});
    node.children = arc.tree || [];
    node.glance = arc.glance || [];
    D.portraits = arc.portraits || {};
  }
  if (!(arc && arc.vis)) {
    D.docs.push(alianzaWeb(s));
    node.children.unshift({ d: 'alianza-web' });
    node.glance = node.glance.concat([
      { l: 'Vis en reserva', v: '0', href: 'alianza-web--vis', live: 'vis' },
      { l: 'Tesorería (libras)', v: '0', href: 'alianza-web--tesoreria', live: 'tes' }]);
  }
  D.tree = D.tree.concat([node]);
  D.saga = { anio: Number(s.anio) || 1220, est: Number(s.est) || 1, aura: Number(s.aura) || 0 };
  D.sagaLead = 'La ' + s.nombre.replace(/^saga/i, 'saga') + ', que crece cada estación: personajes, estaciones, vis y tesorería.';
  return st;
}
function alianzaWeb(s) {
  const name = s.alianza ? 'La alianza de ' + s.alianza : 'La alianza';
  return { id: 'alianza-web', title: name, file: '', web: true,
    blurb: 'La reserva de vis y la tesorería de la alianza, con los movimientos que se apuntan desde la web.',
    sheets: [
      { id: 'vis', title: 'Reserva de vis', blocks: [
        { t: 'stats', live: 'vis', items: [{ l: 'Vis en reserva', v: '0', s: 'peones' }, { l: 'Técnicas', v: '0' }, { l: 'Formas', v: '0' }] },
        { t: 'artstock', live: true, v: {} }, { t: 'dynvis' },
        { t: 'visledger', live: true, id: 'movimientos', rows: [] }] },
      { id: 'tesoreria', title: 'Tesorería', blocks: [
        { t: 'stats', live: 'tes', items: [{ l: 'Saldo', v: '0', s: 'libras' }, { l: 'Movimientos', v: '0' }] }, { t: 'dyntes' }] }] };
}

function sessionStrip(ses) {
  const side = document.getElementById('side');
  const brand = side && side.querySelector('.brand');
  if (!brand) return;
  const p = ses.perfil;
  if (ses.guest) {
    brand.insertAdjacentElement('afterend', el('div', { class: 'sess' }, [el('div', { class: 'sess-s', text: 'Invitado' }),
      el('div', { class: 'sess-r' }, [el('span', { text: 'Solo ayudas públicas' }), el('button', { type: 'button', class: 'sess-out', text: 'Entrar', onclick: aEntrar })])]));
    return;
  }
  const box = el('div', { class: 'sess' }, [
    el('div', { class: 'sess-s', text: ses.saga.nombre }),
    p ? el('div', { class: 'sess-u' }, [avatar(p, 22), el('span', { text: p.nombre })]) : null,
    el('div', { class: 'sess-r' }, [el('span', { text: (ses.rol === 'master' ? 'Máster' : 'Jugador') + (ses.offline ? ' · sin conexión' : '') }),
      el('button', { type: 'button', class: 'sess-out', text: 'Mi zona', onclick: () => aZona() })])]);
  brand.insertAdjacentElement('afterend', box);
}

/* ================================================================== the database the page sees
   Firestore-like calls (doc, collection, onSnapshot, set, update, delete), kept in memory and
   refreshed from the server every few seconds while the page is visible; only what changed travels. */
function makeDb(ses) {
  const docs = new Map();
  const subs = new Set();
  let rev = null, desde = 0, loaded = false, busyPoll = null, timer = null, fails = 0;
  // whether the server is answering, for the page's «connection lost» note (db.onConnection)
  let online = true;
  const connSubs = new Set();
  function setOnline(v) {
    if (v === online) return;
    online = v;
    connSubs.forEach(cb => { try { cb(v); } catch (e) { /* a listener's own problem */ } });
  }
  const colOf = p => p.slice(0, p.lastIndexOf('/'));
  // the session expired (back to the sign-in) or this account is no longer in the saga (back to «Mi zona»)
  const call = (a, d) => api(a, Object.assign({ token: ses.token, saga: ses.saga.id }, d)).catch(e => { if (e.code === 'sesion') sessionLost(e.message); else if (e.code === 'saga') aZona(e.message); throw e; });
  function deliver(s) {
    if (s.kind === 'doc') {
      const d = docs.get(s.path);
      s.cb({ exists: d !== undefined, id: s.path.split('/').pop(), data: () => clone(d), metadata: { fromCache: false, hasPendingWrites: false } });
    } else {
      const list = [];
      docs.forEach((d, p) => { if (colOf(p) === s.path) list.push({ id: p.slice(s.path.length + 1), exists: true, data: () => clone(d) }); });
      s.cb({ docs: list, size: list.length, empty: !list.length, metadata: { fromCache: false, hasPendingWrites: false } });
    }
  }
  function notify(paths) {
    subs.forEach(s => { if (!paths || paths.some(p => (s.kind === 'doc' ? p === s.path : colOf(p) === s.path))) deliver(s); });
  }
  // bumped when a write starts and when it ends: a read that was in flight meanwhile may predate the write
  let wseq = 0;
  function poll(force) {
    if (busyPoll) return busyPoll;
    clearTimeout(timer);
    let stale = false;
    busyPoll = (async () => {
      try {
        const seq = wseq;
        const r = await call('leer', { rev: force ? null : rev, desde: loaded ? desde : 0 });
        fails = 0;
        setOnline(true);
        // a write overlapped this read: its answer could undo that write here, so drop it and read again
        if (seq !== wseq && loaded) { stale = true; return; }
        if (!r.igual) {
          const changed = [];
          if (!loaded || !r.rutas) {
            docs.forEach((d, p) => { if (!(p in r.docs)) { docs.delete(p); changed.push(p); } });
            Object.keys(r.docs).forEach(p => { docs.set(p, r.docs[p]); changed.push(p); });
            const first = !loaded;
            loaded = true;
            notify(first ? null : changed);
          } else {
            const live = new Set(r.rutas);
            docs.forEach((d, p) => { if (!live.has(p)) { docs.delete(p); changed.push(p); } });
            Object.keys(r.docs).forEach(p => { if (JSON.stringify(docs.get(p)) !== JSON.stringify(r.docs[p])) { docs.set(p, r.docs[p]); changed.push(p); } });
            if (changed.length) notify(changed);
          }
          rev = r.rev; desde = r.ahora;
        }
      } catch (e) {
        fails++;
        // one failed refresh can be a blip; two in a row (or the very first load failing) means the page is out of date
        if (fails >= (loaded ? 2 : 1)) setOnline(false);
      }
      finally { busyPoll = null; schedule(stale ? 1000 : null); }
    })();
    return busyPoll;
  }
  function schedule(ms) {
    clearTimeout(timer);
    if (document.visibilityState === 'hidden') return;
    timer = setTimeout(() => poll(), ms != null ? ms : fails ? Math.min(120000, POLL_MS * Math.pow(2, Math.min(fails, 3))) : POLL_MS);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll(); else clearTimeout(timer); });
  window.addEventListener('online', () => poll());
  window.addEventListener('offline', () => setOnline(false));
  const mapErr = e => {
    const code = { unavailable: 'unavailable', sesion: 'revoked', permiso: 'permission_denied', ruta: 'invalid_argument', peticion: 'invalid_argument', grande: 'invalid_argument', no_encontrado: 'not_found' }[e.code] || 'internal';
    return Object.assign(new Error(e.message), { code: code });
  };
  async function write(ops) {
    let r;
    wseq++;
    try { r = await call('escribir', { ops: ops }); } catch (e) {
      if (e.code === 'unavailable') setOnline(false);
      throw mapErr(e);
    } finally { wseq++; }
    setOnline(true);
    const changed = [];
    ops.forEach(op => {
      if (op.op === 'delete') docs.delete(op.ruta);
      else if (op.op === 'update') docs.set(op.ruta, Object.assign({}, docs.get(op.ruta) || {}, op.datos));
      else docs.set(op.ruta, op.datos);
      changed.push(op.ruta);
    });
    notify(changed);
    return r;
  }
  const clean = o => JSON.parse(JSON.stringify(o == null ? {} : o));
  function docRef(path) {
    const id = path.split('/').pop();
    return {
      id: id, path: path,
      get: async () => { if (!loaded) await poll(); const d = docs.get(path); return { exists: d !== undefined, id: id, data: () => clone(d) }; },
      set: data => write([{ op: 'set', ruta: path, datos: clean(data) }]),
      update: data => write([{ op: 'update', ruta: path, datos: clean(data) }]),
      delete: () => write([{ op: 'delete', ruta: path }]),
      onSnapshot: (cb, err) => { const s = { kind: 'doc', path: path, cb: cb, err: err }; subs.add(s); if (loaded) setTimeout(() => deliver(s), 0); else poll(); return () => subs.delete(s); }
    };
  }
  const db = {
    doc: docRef,
    collection: path => ({
      path: path,
      doc: id => docRef(path + '/' + (id || rid(20))),
      get: async () => { if (!loaded) await poll(); const list = []; docs.forEach((d, p) => { if (colOf(p) === path) list.push({ id: p.slice(path.length + 1), data: () => clone(d) }); }); return { docs: list, size: list.length, empty: !list.length }; },
      onSnapshot: (cb, err) => { const s = { kind: 'col', path: path, cb: cb, err: err }; subs.add(s); if (loaded) setTimeout(() => deliver(s), 0); else poll(); return () => subs.delete(s); }
    }),
    onConnection: cb => { connSubs.add(cb); return () => connSubs.delete(cb); },
    // several changes in one request, so a retry never repeats only half of them
    batch: () => { const ops = []; return { set: (p, d) => { ops.push({ op: 'set', ruta: p, datos: clean(d) }); }, delete: p => { ops.push({ op: 'delete', ruta: p }); }, commit: () => write(ops) }; },
    _poll: poll,
    _blob: id => { const d = docs.get(id); return d && d.data ? d.data : null; },
    _upload: async (blob, opts) => {
      const url = await new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ko(fr.error); fr.readAsDataURL(blob); });
      const id = 'retratos/' + rid(16);
      await write([{ op: 'set', ruta: id, datos: { data: url, tipo: blob.type || (opts && opts.type) || '', subido: Date.now() } }]);
      return { id: id, url: url, sizeBytes: blob.size, contentType: blob.type };
    }
  };
  return db;
}

/* ---------- start */
gateStart();
})();
