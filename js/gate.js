/* ================================================================== EUROPA MÍTICA · VERSIÓN WEB
   Runs before the page: asks which saga and role, checks the code with the server (Google Apps Script, see
   backend/Code.gs), loads that saga's own documents and hands the page (window.EM_WEB) a database that talks to
   the server. Only the chosen saga's data ever reach this browser. */
(function () {
'use strict';
const CFG = window.EM_CONFIG || {};
const K_SES = 'em:sesion', K_UID = 'em:uid', K_ARC = 'em:archivo:', K_MSG = 'em:aviso';
const SEASONS = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
const POLL_MS = 15000;

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
const WORDS = ['vis', 'aura', 'creo', 'rego', 'muto', 'perdo', 'ignem', 'aquam', 'auram', 'terram', 'herbam', 'corpus', 'mentem',
  'parma', 'aegis', 'regio', 'summa', 'grog', 'magus', 'lumen', 'draco', 'verbum', 'arcana', 'silva', 'lupus', 'ursus', 'stella', 'ventus', 'umbra', 'flamma', 'petra'];
function suggestCode() { const r = new Uint32Array(3); crypto.getRandomValues(r); return WORDS[r[0] % WORDS.length] + '-' + WORDS[r[1] % WORDS.length] + '-' + (100 + r[2] % 900); }

/* ---------- the server */
class ApiError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
async function api(accion, datos) {
  if (!CFG.backend || !/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/])/.test(CFG.backend)) throw new ApiError('config', 'Falta la dirección del servidor: pégala en config.js (está explicado en INSTALAR.md).');
  let res;
  // a plain-text body keeps this a «simple» request: Apps Script answers it without a CORS preflight
  try { res = await fetch(CFG.backend, { method: 'POST', body: JSON.stringify(Object.assign({ accion: accion }, datos || {})), redirect: 'follow' }); }
  catch (e) { throw new ApiError('unavailable', 'No hay conexión con el servidor de la saga.'); }
  if (!res.ok) throw new ApiError('unavailable', 'El servidor de la saga ha respondido con un error (' + res.status + ').');
  let o;
  try { o = await res.json(); } catch (e) { throw new ApiError('unavailable', 'El servidor de la saga ha dado una respuesta que no entiendo. ¿Está bien publicada la aplicación web?'); }
  if (o && o.error) throw new ApiError(o.error, o.mensaje || 'Error del servidor.');
  return o;
}

/* ---------- the shared aids, the spell catalogue and the image list: static files served next to the page */
const STATIC = { data: 'data/ayudas.json', img: 'data/imagenes.json', hech: 'data/hechizos.json' };
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

/* ---------- session: in localStorage when the player asks to be remembered, else for this tab only */
function getSession() {
  const raw = lsGet(K_SES) || lsGet(K_SES, true);
  try { const s = raw ? JSON.parse(raw) : null; return s && s.token && s.saga && s.saga.id ? s : null; } catch (e) { return null; }
}
function putSession(s, remember) {
  lsSet(K_SES, null); lsSet(K_SES, null, true);
  if (s) lsSet(K_SES, JSON.stringify(s), !remember);
}
function salir(msg) {
  const s = getSession();
  putSession(null);
  if (msg) lsSet(K_MSG, msg, true);
  if (s) lsSet('em:ultima', JSON.stringify({ saga: s.saga.id, rol: s.rol }));
  location.hash = '';
  location.reload();
}
function sessionLost(msg) { salir(msg || 'Tu sesión ha caducado. Vuelve a entrar.'); }

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

async function gateStart() {
  busy('Buscando las sagas…');
  let sagas;
  try { sagas = (await api('sagas')).sagas || []; }
  catch (e) {
    const retry = el('button', { type: 'button', class: 'gbtn', text: 'Reintentar', onclick: gateStart });
    showGate([el('p', { class: 'gate-err', role: 'alert', text: e.message }), retry]);
    return;
  }
  gateForm(sagas);
}

function gateForm(sagas, pre) {
  pre = pre || {};
  let last = {};
  try { last = JSON.parse(lsGet('em:ultima') || '{}') || {}; } catch (e) { last = {}; }
  const st = { saga: pre.saga || (sagas.some(s => s.id === last.saga) ? last.saga : sagas.length === 1 ? sagas[0].id : null), rol: pre.rol || last.rol || 'jugador' };
  const err = errBox();
  const notice = lsGet(K_MSG, true);
  lsSet(K_MSG, null, true);
  const kids = [];
  if (notice) kids.push(el('p', { class: 'gate-note', role: 'status', text: notice }));
  // which saga
  const sagaSet = el('fieldset', { class: 'gate-set' }, [el('legend', { text: '¿Qué saga juegas?' })]);
  if (!sagas.length) sagaSet.appendChild(el('p', { class: 'gate-hint', text: 'Todavía no hay ninguna saga. Entra como máster para crear la primera.' }));
  sagas.forEach(s => sagaSet.appendChild(choice('saga', s.id, s.nombre, null, st.saga === s.id, v => { st.saga = v; })));
  kids.push(sagaSet);
  // which role
  const rolSet = el('fieldset', { class: 'gate-set gate-roles' }, [el('legend', { text: '¿Cómo entras?' }),
    choice('rol', 'jugador', 'Jugador', 'Las fichas, las estaciones y el reparto de experiencia.', st.rol === 'jugador', v => { st.rol = v; sync(); }),
    choice('rol', 'master', 'Máster', 'Además, la pantalla del máster y la gestión de la saga.', st.rol === 'master', v => { st.rol = v; sync(); })]);
  kids.push(rolSet);
  // code
  const code = el('input', { type: 'password', id: 'g-code', autocomplete: 'current-password', autocapitalize: 'none', spellcheck: 'false', autofocus: st.saga ? true : null });
  const show = el('button', { type: 'button', class: 'gate-eye', 'aria-pressed': 'false', text: 'Ver' });
  show.addEventListener('click', () => { const on = code.type === 'password'; code.type = on ? 'text' : 'password'; show.textContent = on ? 'Ocultar' : 'Ver'; show.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  const codeLab = el('label', { for: 'g-code', class: 'gate-lab' });
  const codeHint = el('span', { class: 'gate-hint' });
  kids.push(el('div', { class: 'gate-fld' }, [codeLab, el('div', { class: 'gate-code' }, [code, show]), codeHint]));
  const rem = el('input', { type: 'checkbox', id: 'g-rem', checked: true });
  kids.push(el('label', { class: 'gate-chk', for: 'g-rem' }, [rem, ' Recordarme en este navegador']));
  kids.push(err);
  const go = el('button', { type: 'submit', class: 'gbtn', text: 'Entrar' });
  const crear = el('button', { type: 'button', class: 'glink', text: 'Crear una saga nueva', onclick: () => gateCreate(sagas) });
  kids.push(el('div', { class: 'gate-act' }, [go, crear]));
  const form = el('form', { class: 'gate-form', novalidate: true }, kids);
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    showErr(err, '');
    if (!st.saga) return showErr(err, 'Elige la saga.');
    if (!code.value.trim()) { code.focus(); return showErr(err, 'Escribe el código.'); }
    go.disabled = true; go.textContent = 'Comprobando…';
    try {
      const r = await api('entrar', { saga: st.saga, rol: st.rol, codigo: code.value });
      const ses = { token: r.token, rol: r.rol, saga: r.saga };
      putSession(ses, rem.checked);
      lsSet('em:ultima', JSON.stringify({ saga: st.saga, rol: st.rol }));
      openSaga(ses);
    } catch (e) {
      go.disabled = false; go.textContent = 'Entrar';
      showErr(err, e.message);
      code.select();
    }
  });
  function sync() {
    codeLab.textContent = st.rol === 'master' ? 'Código de máster' : 'Código de jugador';
    codeHint.textContent = st.rol === 'master' ? 'El que se dio al crear la saga; se cambia desde la pantalla del máster.' : 'Te lo da el máster de la saga.';
    crear.hidden = st.rol !== 'master';
  }
  sync();
  showGate([form]);
}

function choice(name, value, label, desc, checked, on) {
  const id = 'g-' + name + '-' + value;
  const i = el('input', { type: 'radio', name: name, id: id, value: value, checked: checked ? true : null });
  i.addEventListener('change', () => { if (i.checked) on(value); });
  return el('label', { class: 'gate-opt', for: id }, [i, el('span', { class: 'gate-opt-t' }, [el('b', { text: label }), desc ? el('small', { text: desc }) : null])]);
}

function gateCreate(sagas) {
  const err = errBox();
  const fld = (id, label, input, hint) => el('div', { class: 'gate-fld' }, [el('label', { for: id, class: 'gate-lab', text: label }), input, hint ? el('span', { class: 'gate-hint', text: hint }) : null]);
  const nombre = el('input', { id: 'c-nombre', placeholder: 'Saga de …', autofocus: true, maxlength: '80' });
  const alianza = el('input', { id: 'c-alianza', placeholder: 'Nombre de la alianza', maxlength: '60' });
  const est = el('select', { id: 'c-est', 'aria-label': 'Estación' }, SEASONS.map((s, i) => el('option', { value: String(i + 1), text: s })));
  const anio = el('input', { id: 'c-anio', type: 'number', min: '600', max: '1600', value: '1220', inputmode: 'numeric', 'aria-label': 'Año' });
  const aura = el('input', { id: 'c-aura', type: 'number', min: '0', max: '10', value: '3', inputmode: 'numeric' });
  const cj = el('input', { id: 'c-cj', value: suggestCode(), autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none' });
  const cm = el('input', { id: 'c-cm', value: suggestCode(), autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none' });
  const otros = el('button', { type: 'button', class: 'glink', text: 'Otros', onclick: () => { cj.value = suggestCode(); cm.value = suggestCode(); } });
  const crearCode = el('input', { id: 'c-crear', type: 'password', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
  const yaChk = el('input', { type: 'checkbox', id: 'c-ya' });
  const carpeta = el('input', { id: 'c-carpeta', placeholder: 'https://drive.google.com/drive/folders/…' });
  const ya = el('div', { class: 'gate-fld', hidden: true }, [el('label', { for: 'c-carpeta', class: 'gate-lab', text: 'Enlace de la carpeta de Drive' }), carpeta,
    el('span', { class: 'gate-hint', text: 'Se usa esa carpeta tal cual: no se crean carpetas ni hojas nuevas, solo la hoja de datos de la web.' })]);
  yaChk.addEventListener('change', () => { ya.hidden = !yaChk.checked; });
  const go = el('button', { type: 'submit', class: 'gbtn', text: 'Crear la saga' });
  const back = el('button', { type: 'button', class: 'glink', text: 'Volver', onclick: () => gateForm(sagas, { rol: 'master' }) });
  const form = el('form', { class: 'gate-form', novalidate: true }, [
    el('h2', { class: 'gate-h', text: 'Saga nueva' }),
    el('p', { class: 'gate-hint', text: 'Se crea en Drive una carpeta con la misma estructura que la Saga de Arazas —Alianza, Personajes, Ambientación…— con la ficha de la alianza, la reserva de vis y la ficha de personaje en blanco.' }),
    fld('c-nombre', 'Nombre de la saga', nombre),
    fld('c-alianza', 'Alianza', alianza, 'Da nombre a su ficha en Drive.'),
    el('div', { class: 'gate-row' }, [
      el('div', { class: 'gate-fld' }, [el('span', { class: 'gate-lab', text: 'Primera estación' }), el('div', { class: 'gate-pair' }, [est, anio])]),
      fld('c-aura', 'Aura de la alianza', aura)]),
    el('fieldset', { class: 'gate-set' }, [el('legend', { text: 'Códigos de la saga' }),
      el('div', { class: 'gate-row' }, [fld('c-cj', 'De jugador', cj), fld('c-cm', 'De máster', cm)]),
      el('div', { class: 'gate-hint' }, ['Apúntalos: el de jugador es para tu mesa; el de máster, solo para ti. ', otros])]),
    fld('c-crear', 'Código para crear sagas', crearCode, 'Lo tiene quien instaló la web.'),
    el('label', { class: 'gate-chk', for: 'c-ya' }, [yaChk, ' La saga ya tiene carpeta en Drive']), ya,
    err, el('div', { class: 'gate-act' }, [go, back])]);
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    showErr(err, '');
    if (nombre.value.trim().length < 3) { nombre.focus(); return showErr(err, 'Ponle un nombre a la saga.'); }
    if (cj.value.trim().length < 6 || cm.value.trim().length < 6) return showErr(err, 'Cada código tiene que tener al menos 6 caracteres.');
    if (cj.value.trim().toLowerCase() === cm.value.trim().toLowerCase()) return showErr(err, 'Los dos códigos tienen que ser distintos.');
    if (!crearCode.value.trim()) { crearCode.focus(); return showErr(err, 'Falta el código para crear sagas.'); }
    if (yaChk.checked && !carpeta.value.trim()) { carpeta.focus(); return showErr(err, 'Pega el enlace de la carpeta.'); }
    const datos = { nombre: nombre.value.trim(), alianza: alianza.value.trim(), est: Number(est.value), anio: Number(anio.value), aura: Number(aura.value),
      codigoJugador: cj.value.trim(), codigoMaster: cm.value.trim(), codigoCrear: crearCode.value, carpeta: yaChk.checked ? carpeta.value.trim() : '' };
    busy(yaChk.checked ? 'Registrando la saga…' : 'Creando la carpeta y las hojas en Drive. Puede tardar un minuto…');
    try {
      const r = await api('crear', datos);
      created(r, datos);
    } catch (e) {
      gateCreateAgain(sagas, datos, e.message);
    }
  });
  showGate([form]);
  function gateCreateAgain(s, d, msg) {
    gateCreate(s);
    const set = (id, v) => { const i = document.getElementById(id); if (i) i.value = v; };
    set('c-nombre', d.nombre); set('c-alianza', d.alianza); set('c-est', String(d.est)); set('c-anio', String(d.anio)); set('c-aura', String(d.aura));
    set('c-cj', d.codigoJugador); set('c-cm', d.codigoMaster); set('c-crear', d.codigoCrear);
    if (d.carpeta) { const c = document.getElementById('c-ya'); c.checked = true; c.dispatchEvent(new Event('change')); set('c-carpeta', d.carpeta); }
    const e = gate.querySelector('.gate-err'); if (e) { e.textContent = msg; e.hidden = false; }
  }
}

function created(r, datos) {
  const ses = { token: r.token, rol: 'master', saga: r.saga };
  const row = (l, v) => el('div', { class: 'gate-codes-r' }, [el('span', { text: l }), el('code', { text: v })]);
  const go = el('button', { type: 'button', class: 'gbtn', text: 'Entrar como máster', autofocus: true, onclick: () => { putSession(ses, true); lsSet('em:ultima', JSON.stringify({ saga: ses.saga.id, rol: 'master' })); openSaga(ses); } });
  showGate([el('div', { class: 'gate-form' }, [
    el('h2', { class: 'gate-h', text: r.saga.nombre + ' está creada' }),
    el('div', { class: 'gate-codes' }, [row('Código de jugador', r.codigos.jugador), row('Código de máster', r.codigos.master)]),
    el('p', { class: 'gate-hint', text: 'Apúntalos ahora: aquí no se vuelven a mostrar. Desde la pantalla del máster puedes cambiarlos.' }),
    el('p', { class: 'gate-hint' }, [datos.carpeta ? 'Usa la carpeta que indicaste. ' : 'La carpeta ya está en Drive. ', el('a', { href: r.saga.carpeta, target: '_blank', rel: 'noopener', text: 'Abrir la carpeta' })]),
    (r.avisos || []).length ? el('div', { class: 'gate-note', role: 'status' }, r.avisos.map(t => el('p', { text: t }))) : null,
    el('div', { class: 'gate-act' }, [go])])]);
}

/* ================================================================== opening a saga */
async function openSaga(ses) {
  busy('Abriendo la ' + ses.saga.nombre + '…');
  let arc = null, st = null;
  const statics = loadStatic();
  statics.catch(() => {}); // awaited below; this only keeps an early failure from being reported as unhandled
  try {
    // the saga may have changed since this session began (codes, archive): ask the server
    const info = await api('info', { token: ses.token });
    ses.saga = info.saga; ses.rol = info.rol;
    const rem = !!lsGet(K_SES);
    putSession(ses, rem);
    if (ses.saga.archivo) arc = await loadArchive(ses);
    st = await statics;
  } catch (e) {
    if (e.code === 'sesion' || e.code === 'saga') return sessionLost(e.message);
    const retry = el('button', { type: 'button', class: 'gbtn', text: 'Reintentar', onclick: () => openSaga(ses) });
    const out = el('button', { type: 'button', class: 'glink', text: 'Cambiar de saga', onclick: () => salir() });
    showGate([el('p', { class: 'gate-err', role: 'alert', text: e.message }), el('div', { class: 'gate-act' }, [retry, out])]);
    return;
  }
  window.EM_DATA = merge(ses, arc, st);
  const db = makeDb(ses);
  const assets = { upload: (blob, opts) => db._upload(blob, opts) };
  window.EM_WEB = { saga: ses.saga, rol: ses.rol, uid: browserId(), db: db, assets: assets, api: (a, d) => api(a, Object.assign({ token: ses.token }, d || {})), blobUrl: id => db._blob(id),
    salir: salir, session: () => ses, setToken: t => { ses.token = t; putSession(ses, !!lsGet(K_SES)); }, refresh: () => db._poll(true) };
  gate.remove();
  document.body.classList.remove('gate-on');
  document.title = ses.saga.nombre + ' — Europa Mítica';
  window.EM_START();
  sessionStrip(ses);
}

async function loadArchive(ses) {
  const key = K_ARC + ses.saga.id;
  try {
    const c = JSON.parse(lsGet(key) || 'null');
    if (c && c.rev === ses.saga.archivo && c.archivo) return c.archivo;
  } catch (e) { /* stale cache */ }
  const r = await api('archivo', { token: ses.token });
  if (r.archivo) lsSet(key, JSON.stringify({ rev: r.rev, archivo: r.archivo }));
  return r.archivo;
}

/* the saga's own folder joins the shared aids: its spreadsheets (archive) or, for a new saga, the web's vis and treasury */
function merge(ses, arc, st) {
  const D = st.data, I = st.img;
  const s = ses.saga;
  const node = { f: s.nombre, drive: s.carpeta, glance: [], children: [] };
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
  D.lead = 'La ' + s.nombre.replace(/^saga/i, 'saga') + ', que crece cada estación, y las ayudas de juego de la carpeta compartida.';
  return st;
}
function alianzaWeb(s) {
  const name = s.alianza ? 'La alianza de ' + s.alianza : 'La alianza';
  return { id: 'alianza-web', title: name, file: '', web: true, drive: s.carpeta,
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
  const box = el('div', { class: 'sess' }, [
    el('div', { class: 'sess-s', text: ses.saga.nombre }),
    el('div', { class: 'sess-r' }, [el('span', { text: ses.rol === 'master' ? 'Máster' : 'Jugador' }),
      el('button', { type: 'button', class: 'sess-out', text: 'Cambiar de saga', onclick: () => salir() })])]);
  brand.insertAdjacentElement('afterend', box);
}

/* ================================================================== the database the page sees
   Firestore-like calls (doc, collection, onSnapshot, set, update, delete), kept in memory and
   refreshed from the server every few seconds while the page is visible; only what changed travels. */
function makeDb(ses) {
  const docs = new Map();
  const subs = new Set();
  let rev = null, desde = 0, loaded = false, busyPoll = null, timer = null, fails = 0;
  const colOf = p => p.slice(0, p.lastIndexOf('/'));
  const call = (a, d) => api(a, Object.assign({ token: ses.token }, d)).catch(e => { if (e.code === 'sesion') sessionLost(e.message); throw e; });
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
  function poll(force) {
    if (busyPoll) return busyPoll;
    clearTimeout(timer);
    busyPoll = (async () => {
      try {
        const r = await call('leer', { rev: force ? null : rev, desde: loaded ? desde : 0 });
        fails = 0;
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
      } catch (e) { fails++; }
      finally { busyPoll = null; schedule(); }
    })();
    return busyPoll;
  }
  function schedule() {
    clearTimeout(timer);
    if (document.visibilityState === 'hidden') return;
    timer = setTimeout(() => poll(), fails ? Math.min(120000, POLL_MS * Math.pow(2, Math.min(fails, 3))) : POLL_MS);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll(); else clearTimeout(timer); });
  window.addEventListener('online', () => poll());
  const mapErr = e => {
    const code = { unavailable: 'unavailable', sesion: 'revoked', permiso: 'invalid_argument', ruta: 'invalid_argument', peticion: 'invalid_argument', grande: 'invalid_argument', no_encontrado: 'not_found' }[e.code] || 'internal';
    return Object.assign(new Error(e.message), { code: code });
  };
  async function write(ops) {
    let r;
    try { r = await call('escribir', { ops: ops }); } catch (e) { throw mapErr(e); }
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

/* who wrote what (the «por» field): an id kept in this browser */
function browserId() {
  let uid = lsGet(K_UID);
  if (!uid) { uid = 'u' + rid(12); lsSet(K_UID, uid); }
  return uid;
}

/* ---------- start */
const ses = getSession();
if (ses) openSaga(ses); else gateStart();
})();
