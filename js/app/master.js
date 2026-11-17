/* La pantalla del máster. */
import { ABBR, artOf, esc, h, load, R, store, toNum } from './base.js';
import { page } from './views.js';
import { KEYP, S, TIPOS, TIPOS_PL, tkey } from './saga/state.js';
import { field, monogram, pjsSorted, sagaCrumbs, statusNote, toast } from './saga/core.js';
import { edadTxt, AURA_TIPOS, AURA_X, auraNow, auraTxt, botchDice, calc, canCeremony, canWrite, ceremonialOn, ceremonyToggle, curSeason, entriesOf, estadoFisico, estadoTxt, formaActiva, formaButtons, formasOf, isRitual, malusOf, numv, REALM_POW, realmMod, refocusCer, sagaAura, sgn, spellTotal, vdCards } from './saga/rules.js';
import { writeEstado } from './saga/seasons.js';
import { spellInfo } from './info.js';

/* ================================================================== PANTALLA DEL MÁSTER
   Solo para el máster (quien entra con el código de máster). El aura de la escena —reino y nivel— cambia los totales de lanzamiento
   de todas las fichas según la tabla de interacción de reinos de ArM5 (cap. 12, «Realms»): para la magia hermética,
   aura mágica ×1, feérica ×½ (redondeando hacia arriba), divina ×−3 e infernal ×−1, y en un aura de otro reino un dado de
   pifia más por cada punto de aura. El laboratorio sigue usando el aura de la alianza. Un desplegable muestra los rasgos
   de personalidad, virtudes y defectos de cualquier personaje, y sus hechizos con el aura elegida. */
const MST = { tipo: null, nivel: null, lugar: null, redraw: null };

function viewMaster() {
  page.innerHTML = '';
  page.appendChild(sagaCrumbs([['Pantalla del máster', null]]));
  page.appendChild(h('h1', { class: 'doc-title', text: 'Pantalla del máster' }));
  const content = h('div', { class: 'content fx' });
  page.appendChild(content);
  document.title = 'Pantalla del máster — Europa Mítica';
  const note = statusNote(); if (note) content.appendChild(note);
  if (S.owner !== true) {
    content.appendChild(h('p', { class: 'note', text: window.EM_WEB.offline ? 'Sin conexión: la pantalla del máster necesita el servidor de la saga.' : S.owner == null && S.db ? 'Comprobando quién eres…' : 'Esta pantalla es solo para el máster: entra en la saga con el código de máster.' }));
    return;
  }
  content.appendChild(h('p', { class: 'doc-blurb', text: 'Elige el aura de la escena: al aplicarla cambian los totales de lanzamiento de todas las fichas. Debajo, cualquier personaje con sus rasgos de personalidad, virtudes y defectos.' }));
  content.appendChild(h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => window.print() }, 'Imprimir la pantalla')));
  content.appendChild(masterAura());
  content.appendChild(masterWeb());
  content.appendChild(masterPjs());
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
    h('div', { class: 'xt', text: [p.tipo, p.casa, edadTxt(ca, p.nacimiento), p.jugador ? 'juega ' + p.jugador : ''].filter(Boolean).join(' · ') })])]));
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
    if (L.length) card.appendChild(vdCards(L, t === 'Virtudes' ? 'virtud' : 'defecto'));
    else card.appendChild(h('p', { class: 'note', text: 'Ninguno.' }));
  });
  if (fa && (fa.virtudes || []).concat(fa.defectos || []).length) {
    card.appendChild(h('h3', { class: 'm-sub', text: 'Del ' + fa.n.toLowerCase() + ', mientras está transformado' }));
    card.appendChild(vdCards((fa.virtudes || []).concat(fa.defectos || []), x => (fa.defectos || []).includes(x) ? 'defecto' : 'virtud'));
  }
  const sp = (p.hechizos || []).filter(x => x && String(x.n || '').trim());
  if (sp.length) {
    const m = realmMod(MST.tipo, MST.nivel, 'magica'), cer = ceremonialOn() && canCeremony(c);
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
    wrap.appendChild(h('summary', null, [h('span', { class: 'm-sub', text: 'Hechizos con el aura elegida · ' + sp.length }), h('small', { text: auraTxt(MST.tipo, MST.nivel) + ': ' + sgn(m) })]));
    wrap.appendChild(ceremonyToggle(c, refocusCer));
    wrap.appendChild(R.grid({ _k: 'm-sp-' + id, head: ['Hechizo', 'Arte', 'Nivel', 'Lanzamiento', 'Margen'], body: body, fcl: true, info: i => spellInfo(id, (p.hechizos || []).indexOf(rows[i].x)) }));
    wrap.appendChild(h('p', { class: 'note', text: 'Lanzamiento: Técnica + Forma (con sus Mañas) + Vitalidad + aura' + (sp.some(x => numv(x.maestria) > 0) ? ' + maestría' : '') + (malusOf(p) ? ' + malus por heridas y fatiga (' + sgn(malusOf(p)) + ')' : '') + (cer ? ' + Artes Liberales + Filosofía (ceremonial, 15 min por magnitud)' : sp.some(isRitual) ? '; los rituales suman además Artes Liberales + Filosofía' : '') + ', sin dado. Margen: lanzamiento menos nivel; con el dado, si llega a 0 el hechizo sale sin fatiga, y hasta −10 sale gastando un nivel de fatiga.' }));
    card.appendChild(wrap);
  }
  return card;
}

/* ================================================================== PANTALLA DEL MÁSTER · LA SAGA EN LA WEB
   The saga's codes, a backup copy and importing one. */
function masterWeb() {
  const W = window.EM_WEB;
  const sec = h('section', { class: 'm-sec m-web', 'aria-labelledby': 'm-web-h' }, [h('h2', { class: 'm-h', id: 'm-web-h', text: 'La saga en la web' })]);
  const s = W.saga;
  sec.appendChild(h('p', { class: 'doc-blurb' }, ['Los datos de la ' + s.nombre + ' se guardan en una hoja de cálculo de su carpeta de Drive. ',
    h('a', { href: s.carpeta, target: '_blank', rel: 'noopener', text: 'Abrir la carpeta' }), s.datos ? ' · ' : null,
    s.datos ? h('a', { href: s.datos, target: '_blank', rel: 'noopener', text: 'la hoja de datos' }) : null, '.']));

  // codes
  const cj = h('input', { type: 'text', id: 'm-cj', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none', placeholder: 'Sin cambios' });
  const cm = h('input', { type: 'text', id: 'm-cm', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none', placeholder: 'Sin cambios' });
  const save = h('button', { type: 'button', class: 'btn' }, 'Cambiar los códigos');
  save.addEventListener('click', async () => {
    const j = cj.value.trim(), m = cm.value.trim();
    if (!j && !m) { toast('Escribe al menos un código nuevo.'); return; }
    if ((j && j.length < 6) || (m && m.length < 6)) { toast('Cada código tiene que tener al menos 6 caracteres.'); return; }
    save.disabled = true;
    try {
      const r = await W.api('codigos', { jugador: j || null, master: m || null });
      W.setToken(r.token);
      cj.value = ''; cm.value = '';
      toast('Códigos cambiados. Quien estaba dentro tendrá que entrar con el nuevo.');
    } catch (e) { toast(e.message || 'No se han podido cambiar los códigos.'); }
    save.disabled = false;
  });
  sec.appendChild(h('h3', { class: 'm-sub', text: 'Códigos de entrada' }));
  sec.appendChild(h('p', { class: 'note', text: 'Al cambiar un código, todos los que estaban dentro (también los demás másteres) tienen que volver a entrar. Tú sigues dentro.' }));
  sec.appendChild(h('div', { class: 'fld-row fx' }, [field('Nuevo código de jugador', cj), field('Nuevo código de máster', cm)]));
  sec.appendChild(h('div', { class: 'actions' }, [save]));

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
