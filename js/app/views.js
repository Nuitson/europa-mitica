/* Las páginas de los documentos y la de inicio. */
import { artOf, artVar, DATA, DOCS, esc, h, ICON, IMG, scrollHint } from './base.js';
import { PATH } from './tree.js';
import { highlight, search } from './search.js';
import { renderBlocks } from './blocks.js';
import { glanceNode, homeSaga } from './saga/home.js';

/* ---------------------------------------------------------------- views */
const page = document.getElementById('page');
let pendingFocus = null;

function crumbs(docId) {
  const trail = PATH[docId] || [];
  const inSaga = trail[0] && trail[0].saga;
  const c = h('div', { class: 'crumbs' }, [h('a', { href: inSaga ? '#saga' : '#inicio', text: inSaga ? 'La saga' : DATA.root.short })]);
  (inSaga ? trail.slice(1) : trail).forEach(f => { c.appendChild(h('span', { class: 'sep', text: '/' })); c.appendChild(h('span', { text: f.f })); });
  return c;
}

function viewDoc(doc, sheetId, anchor, keepY) {
  const sheet = doc.sheets.find(s => s.id === sheetId) || doc.sheets[0];
  page.innerHTML = '';
  page.appendChild(crumbs(doc.id));
  page.appendChild(h('h1', { class: 'doc-title', text: doc.title }));
  const meta = h('div', { class: 'doc-meta' }, [
    h('span', { text: doc.web ? 'Se lleva desde la web' : 'Hoja de cálculo «' + doc.file + '»' }),
    h('span', { text: doc.sheets.length === 1 ? '1 pestaña' : doc.sheets.length + ' pestañas' })
  ]);
  page.appendChild(meta);
  if (doc.blurb) page.appendChild(h('p', { class: 'doc-blurb', text: doc.blurb }));
  if (doc.sheets.length > 1) {
    const tabs = h('div', { class: 'tabs', role: 'navigation', 'aria-label': 'Pestañas de ' + doc.title });
    doc.sheets.forEach(s => {
      const a = h('a', { class: 'tab', href: '#' + doc.id + '--' + s.id, 'aria-current': s === sheet ? 'page' : null });
      if (s.art) a.appendChild(h('span', { class: 'dot', style: '--art:' + artVar(s.art) }));
      a.appendChild(document.createTextNode(s.title));
      tabs.appendChild(a);
    });
    page.appendChild(h('div', { class: 'tabs-wrap' }, tabs));
    scrollHint(tabs, tabs.querySelector('[aria-current="page"]'));
    requestAnimationFrame(() => { const cur = tabs.querySelector('[aria-current]'); if (cur) tabs.scrollLeft = Math.max(0, cur.offsetLeft - 40); });
  } else {
    page.appendChild(h('div', { style: 'height:22px' }));
  }
  const content = h('div', { class: 'content' });
  if (doc.sheets.length > 1) content.appendChild(h('h2', { class: 'sheet-h', text: sheet.title }));
  const secs = sheet.blocks.filter(b => b.t === 'sec');
  if (secs.length > 1) {
    content.appendChild(h('nav', { class: 'toc', 'aria-label': 'Secciones' }, secs.map(s => h('a', { class: 'chip', href: '#' + doc.id + '--' + sheet.id + '--' + s.id, html: (artOf(s.a) ? '<span class="dot" style="--art:' + artVar(artOf(s.a)) + '"></span>' : '') + esc(s.a) }))));
  }
  content.appendChild(renderBlocks(sheet.blocks, { doc: doc, sheet: sheet }));
  page.appendChild(content);
  document.title = doc.title + (doc.sheets.length > 1 ? ' · ' + sheet.title : '') + ' — Europa Mítica';
  // focus handling
  requestAnimationFrame(() => {
    if (keepY != null) { window.scrollTo(0, keepY); return; } // live data re-render: stay put
    let target = null;
    if (pendingFocus) { target = page.querySelector('[data-k="' + CSS.escape(pendingFocus) + '"]'); pendingFocus = null; }
    else if (anchor) target = document.getElementById('a-' + anchor);
    if (target) {
      openDetails(target);
      target.scrollIntoView({ block: anchor ? 'start' : 'center' });
      if (!anchor) { target.classList.add('flash'); setTimeout(() => target.classList.remove('flash'), 2400); }
    } else window.scrollTo(0, 0);
  });
}

function docCard(d, path) {
  const ns = d.sheets.length;
  const cover = d.cover && IMG[d.cover];
  const a = h('a', { class: 'dcard' + (cover ? ' cov' : ''), href: '#' + d.id });
  if (cover) a.appendChild(h('img', { src: cover, alt: '' }));
  const inner = h('div', { class: 'in' }, [
    path ? h('div', { class: 'dp', html: ICON.folder + esc(path) }) : null,
    h('div', { class: 'dt1', text: d.title }), h('div', { class: 'db', text: d.blurb || '' }),
    h('div', { class: 'dm', text: (ns === 1 ? '1 pestaña' : ns + ' pestañas') })]);
  a.appendChild(inner);
  return a;
}

/* the cards of one folder of the tree (its documents and those of its subfolders) */
function folderSection(top) {
  const s = h('section', { class: 'folder-sec' });
  s.appendChild(h('div', { class: 'folder-h' }, [h('h2', { text: top.f }), top.about ? h('span', { class: 'path', text: top.about }) : null]));
  if (top.glance && top.glance.length) s.appendChild(glanceNode(top.glance));
  const grid = h('div', { class: 'docs' });
  (function walk(node, trail) {
    (node.children || []).forEach(c => { if (c.d) grid.appendChild(docCard(DOCS[c.d], trail.join(' / '))); });
    (node.children || []).forEach(c => { if (!c.d) walk(c, trail.concat([c.f])); });
  })(top, []);
  if (grid.children.length) s.appendChild(grid);
  return s;
}

/* the saga's own page: what belongs to this saga only (season, characters, its vis and treasury, its spreadsheets) */
function viewSaga() {
  page.innerHTML = '';
  const saga = DATA.tree.find(n => n.saga);
  const name = (window.EM_WEB && window.EM_WEB.saga && window.EM_WEB.saga.nombre) || (saga && saga.f) || 'La saga';
  page.appendChild(h('div', { class: 'crumbs' }, [h('a', { href: '#inicio', text: DATA.root.short }), h('span', { class: 'sep', text: '/' }), h('span', { text: 'La saga' })]));
  page.appendChild(h('header', { class: 'home-hero saga-hero' }, h('div', null, [
    h('div', { class: 'k', text: 'Tu saga' }), h('h1', { text: name }), h('p', { class: 'lead', text: DATA.sagaLead || '' })])));
  page.appendChild(homeSaga());
  if (saga) {
    const sec = folderSection(Object.assign({}, saga, { f: 'Documentos de la saga', about: 'Solo los ve esta saga' }));
    if (sec.querySelector('.dcard') || sec.querySelector('.glance')) page.appendChild(sec);
  }
  document.title = name + ' — Europa Mítica';
  window.scrollTo(0, 0);
}

/* the start page: the same for every saga (search and the shared game aids), with a way into your saga */
function viewHome(q) {
  page.innerHTML = '';
  const hero = h('header', { class: 'home-hero' });
  hero.appendChild(h('div', null, [
    h('div', { class: 'k', text: 'Ars Magica · Quinta edición' }),
    h('h1', { text: 'Europa Mítica' }),
    h('p', { class: 'lead', text: DATA.lead })
  ]));
  const hs = h('div', { class: 'home-search' });
  hs.appendChild(h('label', { for: 'homeq', text: 'Buscar en todas las hojas' }));
  const sw = h('div', { class: 'search', html: ICON.search });
  const input = h('input', { type: 'search', id: 'homeq', placeholder: 'Un hechizo, una virtud, un libro, un habitante…', autocomplete: 'off' });
  sw.appendChild(input);
  hs.appendChild(sw);
  hs.appendChild(h('div', { class: 'hint', text: 'Prueba «Perdo Corpus», «Sangre Feérica», «Ordesa» o «summa».' }));
  hero.appendChild(hs);
  page.appendChild(hero);
  const results = h('div', { class: 'results', 'aria-live': 'polite' });
  page.appendChild(results);
  const folders = h('div');
  page.appendChild(folders);
  const W = window.EM_WEB && window.EM_WEB.saga;
  if (window.EM_WEB && window.EM_WEB.guest) {
    folders.appendChild(h('div', { class: 'saga-banner' }, [
      h('div', null, [h('div', { class: 'k', text: 'Invitado' }), h('div', { class: 'sb-t', text: '¿Juegas en una saga?' }), h('div', { class: 'sb-s', text: 'Entra con tu cuenta para abrir tu saga: personajes, estaciones, vis y tesorería.' })]),
      h('button', { type: 'button', class: 'btn', onclick: () => window.EM_WEB.entrar() }, 'Entrar o crear cuenta')]));
  } else if (W) {
    folders.appendChild(h('a', { class: 'saga-banner', href: '#saga' }, [
      h('div', null, [h('div', { class: 'k', text: 'Tu saga' }), h('div', { class: 'sb-t', text: W.nombre }), h('div', { class: 'sb-s', text: DATA.sagaLead || '' })]),
      h('span', { class: 'sb-go', text: 'Abrir la saga →' })]));
  }
  folders.appendChild(h('div', { class: 'home-intro' }, [
    h('h2', { text: 'Ayudas de juego' }),
    h('p', { text: 'Material de consulta compartido por todas las sagas: guías para diseñar hechizos, maleficios y ritos feéricos, el compendio de virtudes y defectos, la pantalla del jugador y las tablas de artesanía.' })]));
  DATA.tree.filter(n => !n.saga).forEach(top => folders.appendChild(folderSection(top)));
  function run() {
    const v = input.value.trim();
    results.innerHTML = '';
    folders.hidden = !!v;
    if (!v) { if (location.hash.startsWith('#buscar')) history.replaceState(null, '', '#inicio'); return; }
    const res = search(v);
    if (!res.length) { results.appendChild(h('div', { class: 'more', text: 'Nada coincide con «' + v + '».' })); return; }
    const byDoc = {};
    res.forEach(r => { const g = r.dyn ? 'dyn:' + r.group : r.d; (byDoc[g] = byDoc[g] || []).push(r); });
    let shown = 0;
    // the live saga first, then the spreadsheets
    Object.keys(byDoc).filter(g => g.startsWith('dyn:')).forEach(g => {
      const list = byDoc[g];
      results.appendChild(h('div', { class: 'rh', text: g.slice(4) + ' · ' + list.length }));
      list.slice(0, 8).forEach(r => results.appendChild(h('button', { type: 'button', onclick: () => { pendingFocus = r.focus || null; location.hash = r.href; } }, [
        h('div', { class: 'rs', text: r.sub }), h('div', { class: 'rt', html: highlight(r.t, v) })])));
      if (list.length > 8) results.appendChild(h('div', { class: 'more', text: 'y ' + (list.length - 8) + ' resultados más.' }));
    });
    Object.keys(byDoc).filter(g => !g.startsWith('dyn:')).forEach(did => {
      const d = DOCS[did];
      results.appendChild(h('div', { class: 'rh', text: d.title + ' · ' + byDoc[did].length }));
      byDoc[did].slice(0, 8).forEach(r => {
        const sh = d.sheets.find(s => s.id === r.s);
        results.appendChild(h('button', { type: 'button', onclick: () => { pendingFocus = r.k; location.hash = '#' + d.id + '--' + r.s; } }, [
          h('div', { class: 'rs', text: sh.title }), h('div', { class: 'rt', html: highlight(r.t, v) })]));
        shown++;
      });
      if (byDoc[did].length > 8) results.appendChild(h('div', { class: 'more', text: 'y ' + (byDoc[did].length - 8) + ' resultados más en este documento.' }));
    });
  }
  input.addEventListener('input', run);
  if (q) { input.value = q; run(); }
  document.title = 'Europa Mítica';
  window.scrollTo(0, 0);
  return input;
}

/* a search hit inside a closed «details» (the English original…): open it, or there is nothing to scroll to */
function openDetails(el) { for (let d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true; }
function focusPending() {
  requestAnimationFrame(() => {
    if (!pendingFocus) return;
    const t = page.querySelector('[data-k="' + CSS.escape(pendingFocus) + '"]');
    pendingFocus = null;
    if (t) { openDetails(t); t.scrollIntoView({ block: 'center' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 2400); }
  });
}

export { focusPending, page, pendingFocus, viewDoc, viewHome, viewSaga };
