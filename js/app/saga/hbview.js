/* El material homebrew de blogs en la web: la lista de lo activo (#hb), cada grupo de tipo y autor (#hb--grupo)
   y cada entrada (#hb--grupo--id). Los grupos se activan en la pestaña «Homebrew» de la pantalla del máster;
   quien no es máster solo ve los activos. */
import { esc, h, R, scrollHint } from '../base.js';
import { renderBlocks } from '../blocks.js';
import { page } from '../views.js';
import { S } from './state.js';
import { sagaChanged, sagaCrumbs, statusNote } from './core.js';
import { hbActive, hbData, hbGroup, hbGroups, hbLoad, hbOn, hbTitle } from './homebrew.js';
import { catInfo, hbThanks } from '../info.js';

const IDIOMA = { en: 'en inglés', es: '' };
const fechaTxt = f => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || ''); return m ? Number(m[3]) + '/' + Number(m[2]) + '/' + m[1] : f || ''; };

/* the posts come as plain text with a little Markdown: headings, lists, quotes, bold and italics */
function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(«“])_(\S(?:.*?\S)?)_(?=[\s.,;:)»”!?]|$)/g, '$1<i>$2</i>');
}
function mdBlocks(txt, heads) {
  const out = [];
  let list = null, kind = '';
  const close = () => { list = null; kind = ''; };
  String(txt || '').split('\n').forEach(raw => {
    const l = raw.trim();
    if (!l) { close(); return; }
    let m;
    if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { close(); out.push(h(m[1].length <= 2 ? 'h3' : 'h4', { html: inline(m[2]) })); return; }
    if ((m = /^[-*•]\s+(.*)$/.exec(l))) { if (kind !== 'ul') { list = h('ul', { class: 'list' }); kind = 'ul'; out.push(list); } list.appendChild(h('li', { html: inline(m[1]) })); return; }
    if ((m = /^(\d+)[.)]\s+(.*)$/.exec(l))) { if (kind !== 'ol') { list = h('ol', { class: 'list', start: m[1] !== '1' ? m[1] : null }); kind = 'ol'; out.push(list); } list.appendChild(h('li', { html: inline(m[2]) })); return; }
    if ((m = /^>\s?(.*)$/.exec(l))) { close(); out.push(h('blockquote', { class: 'hb-q', html: inline(m[1]) })); return; }
    close();
    // the English posts write their section titles as a short line of their own
    if (heads && l.length < 60 && l.length > 3 &&!/[.:,;!?"”»)]$/.test(l) && !/^["“«(]/.test(l)) { out.push(h('h4', { html: inline(l) })); return; }
    out.push(h('p', { html: inline(l) }));
  });
  return out;
}

function viewHb(k, id) {
  page.innerHTML = '';
  if (!k) return hbIndex();
  const g = hbGroup(k);
  const visible = g && (hbOn(k) || S.owner === true);
  page.appendChild(sagaCrumbs([['Homebrew', '#hb']].concat(g && visible ? (id ? [[hbTitle(g), '#hb--' + k], ['Entrada', null]] : [[hbTitle(g), null]]) : [])));
  const content = h('div', { class: 'content fx hb-page' });
  if (!visible) {
    page.appendChild(h('h1', { class: 'doc-title', text: 'Homebrew' }));
    page.appendChild(content);
    content.appendChild(h('p', { class: 'note', text: g ? 'Este material no está activo en la saga: el máster lo activa en la pestaña «Homebrew» de su pantalla.' : 'No hay ningún material homebrew con ese nombre.' }));
    return;
  }
  const d = hbData(k);
  if (!d) {
    page.appendChild(h('h1', { class: 'doc-title', text: hbTitle(g) }));
    page.appendChild(content);
    content.appendChild(h('p', { class: 'note', text: 'Cargando el material…' }));
    hbLoad(k).then(() => sagaChanged(), () => { content.innerHTML = ''; content.appendChild(h('p', { class: 'note', text: 'No se ha podido cargar este material. Comprueba la conexión y vuelve a intentarlo.' })); });
    return;
  }
  const e = id ? (d.textos || []).find(x => x.id === id) : null;
  if (id && e) return hbEntry(g, d, e, content);
  document.title = hbTitle(g) + ' — Europa Mítica';
  page.appendChild(h('h1', { class: 'doc-title', text: hbTitle(g) }));
  page.appendChild(content);
  const note = statusNote(); if (note) content.appendChild(note);
  if (!hbOn(k)) content.appendChild(h('p', { class: 'note hb-off', text: 'Vista previa del máster: este material no está activo y los jugadores no lo ven.' }));
  content.appendChild(h('p', { class: 'doc-blurb', text: 'Material fanmade de ' + g.autor + (g.blogs && g.blogs.length ? ', publicado en ' + g.blogs.join(' y ') : '') + '. No es de los libros de Ars Magica.' }));
  const textos = d.textos || [], sp = d.hechizos || [];
  content.appendChild(hbThanks([{ autor: g.autor, blog: (g.blogs || [])[0], url: (textos[0] || sp[0] || {}).url }], g.tipo === 'Hechizos' ? 'estos hechizos' : 'este material'));
  if (textos.length) {
    content.appendChild(h('h2', { class: 'm-h', text: 'Entradas · ' + textos.length }));
    // posts of one covenant or character together, in their order; the rest after
    const groups = [], by = {};
    textos.forEach(x => { const gk = x.grupo || ''; if (!by[gk]) { by[gk] = []; groups.push(gk); } by[gk].push(x); });
    groups.sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1));
    groups.forEach(gk => {
      const cov = g.tipo === 'Alianzas' && by[gk].some(isCovPart);
      if (gk && (groups.length > 1 || cov)) content.appendChild(h('h3', { class: 'm-sub' }, cov ? [h('a', { href: '#hbal--' + slugify(gk), text: gk }), h('small', { class: 'xt', text: ' · ficha de la alianza →' })] : gk));
      content.appendChild(h('ul', { class: 'hb-list-e' }, by[gk].map(x => h('li', null, [
        h('a', { href: '#hb--' + k + '--' + x.id, text: gk && x.parte && groups.length > 1 ? x.parte : x.n }),
        h('small', { class: 'xt', text: [fechaTxt(x.fecha), IDIOMA[x.idioma] || '', x.colab ? 'con ' + x.colab : ''].filter(Boolean).join(' · ') })]))));
    });
  }
  if (sp.length) {
    content.appendChild(h('h2', { class: 'm-h', text: 'Hechizos · ' + sp.length }));
    if (hbOn(k)) content.appendChild(h('p', { class: 'note', text: 'Están en el catálogo de hechizos: al escribir su nombre en una ficha se rellenan solos y su descripción se ve al pulsarlo.' }));
    const rows = sp.map(x => [x.n, x.tec, x.forma, String(x.nivel), x.alc || '', x.dur || '', x.obj || '', x.rit ? 'Ritual' : '']);
    content.appendChild(R.table({ id: 'hb-' + k, _k: 'hb-sp', cols: ['Hechizo', 'Técnica', 'Forma', 'Nivel', 'Alcance', 'Duración', 'Objetivo', 'Ritual'], rows: rows,
      filters: [1, 2, 7], num: [3], art: [1, 2], sort: 3, search: rows.length > 8, info: i => catInfo(Object.assign({ hb: k, autor: g.autor, blog: (g.blogs || [])[0] }, sp[i])) }));
  }
}

function hbEntry(g, d, e, content) {
  const k = g.k, list = d.textos || [], i = list.indexOf(e);
  document.title = e.n + ' — Europa Mítica';
  page.appendChild(h('h1', { class: 'doc-title', text: e.n }));
  page.appendChild(h('div', { class: 'doc-meta' }, [hbTitle(g), e.blog, e.colab ? 'Con ' + e.colab : '', fechaTxt(e.fecha), e.serie, IDIOMA[e.idioma] ? 'En inglés' : '']
    .filter(Boolean).map(t => h('span', { text: t })).concat(e.url ? [h('a', { href: e.url, target: '_blank', rel: 'noopener', text: 'Entrada original' })] : [])));
  page.appendChild(content);
  if (!hbOn(k)) content.appendChild(h('p', { class: 'note hb-off', text: 'Vista previa del máster: este material no está activo y los jugadores no lo ven.' }));
  const thanks = () => hbThanks([{ autor: g.autor, blog: e.blog, url: e.url, colab: e.colab }], 'esta entrada');
  content.appendChild(thanks());
  const sp = (d.hechizos || []).filter(x => x.entrada === e.id);
  if (g.tipo === 'Alianzas' && isCovPart(e)) content.appendChild(h('div', { class: 'actions' }, h('a', { class: 'btn ghost', href: '#hbal--' + slugify(e.grupo), text: 'Ficha de la alianza ' + e.grupo })));
  if (sp.length) content.appendChild(h('div', { class: 'actions hb-sp' }, sp.map(x => h('button', { type: 'button', class: 'btn ghost', onclick: () => catInfo(Object.assign({ hb: k, autor: g.autor, blog: e.blog, colab: e.colab }, x)) }, 'Ficha del hechizo: ' + x.n))));
  if (e.pres) content.appendChild(h('div', { class: 'hb-pres' }, mdBlocks(e.pres)));
  content.appendChild(h('article', { class: 'hb-text' }, mdBlocks(e.texto)));
  content.appendChild(thanks());
  const prev = list[i - 1], next = list[i + 1];
  content.appendChild(h('nav', { class: 'hb-nav', 'aria-label': 'Entradas de ' + hbTitle(g) }, [
    prev ? h('a', { class: 'btn ghost', href: '#hb--' + k + '--' + prev.id, text: '← ' + prev.n }) : h('span'),
    h('a', { class: 'btn ghost', href: '#hb--' + k, text: 'Todas las entradas' }),
    next ? h('a', { class: 'btn ghost', href: '#hb--' + k + '--' + next.id, text: next.n + ' →' }) : h('span')]));
}

function hbIndex() {
  page.appendChild(sagaCrumbs([['Homebrew', null]]));
  page.appendChild(h('h1', { class: 'doc-title', text: 'Homebrew' }));
  document.title = 'Homebrew — Europa Mítica';
  const content = h('div', { class: 'content fx' });
  page.appendChild(content);
  const own = S.owner === true, list = own ? hbGroups() : hbActive();
  content.appendChild(h('p', { class: 'doc-blurb', text: 'Material fanmade de blogs de Ars Magica, por tipo y autor. ' + (own ? 'Actívalo en la pestaña «Homebrew» de la pantalla del máster para que lo vean los jugadores.' : 'El máster decide qué se usa en la saga.') }));
  if (!list.length) { content.appendChild(h('p', { class: 'note', text: 'No hay material homebrew activo en la saga.' })); return; }
  content.appendChild(hbThanks(list.map(g => ({ autor: g.autor, blog: (g.blogs || [])[0] }))));
  const grid = h('div', { class: 'docs' });
  list.forEach(g => grid.appendChild(h('a', { class: 'dcard' + (hbOn(g.k) ? '' : ' hb-card-off'), href: '#hb--' + g.k }, h('div', { class: 'in' }, [
    h('div', { class: 'dp', text: g.tipo + (own && !hbOn(g.k) ? ' · no activo' : '') }),
    h('div', { class: 'dt1', text: g.autor }),
    h('div', { class: 'db', text: (g.blogs || []).join(', ') }),
    h('div', { class: 'dm', text: [g.textos ? g.textos + (g.textos === 1 ? ' entrada' : ' entradas') : '', g.hechizos ? g.hechizos + ' hechizos' : ''].filter(Boolean).join(' · ') + ' →' })]))));
  content.appendChild(grid);
}

/* ================================================================== THE COVENANTS, AS A SHEET LIKE ARAZAS'S
   The 2024 posts split each covenant in parts, written by two authors in turns (description, boons, hooks, resources,
   vis, magi…); the English ones are one post each. A covenant gathers its parts from the Alianzas groups that are on
   (and, for the master, from all of them): a «Ficha» tab with its facts and its boons and hooks from the book, a
   «Descripción» tab and one tab per part. */
const PARTES = ['Descripción', 'Ventajas', 'Trabas', 'Recursos', 'Fuentes de vis', 'Magi', 'Hechizos y biblioteca', 'Especialistas', 'Compañeros y grogs', 'Objetos encantados'];
const slugify = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const isCovPart = x => !!x.grupo && (PARTES.includes(x.parte) || (!x.parte && /covenant of/i.test(x.n)));
const partIdx = x => { const i = PARTES.indexOf(x.parte || 'Descripción'); return i < 0 ? 99 : i; };
const alGroups = () => hbGroups().filter(g => g.tipo === 'Alianzas' && (hbOn(g.k) || S.owner === true));
function covenants() {
  const out = new Map();
  alGroups().forEach(g => {
    const d = hbData(g.k);
    if (d) (d.textos || []).forEach(x => {
      if (!isCovPart(x)) return;
      const s = slugify(x.grupo);
      if (!out.has(s)) out.set(s, { slug: s, n: x.grupo, parts: [] });
      out.get(s).parts.push(Object.assign({ g: g }, x));
    });
  });
  out.forEach(c => c.parts.sort((a, b) => partIdx(a) - partIdx(b) || String(a.fecha).localeCompare(String(b.fecha))));
  return out;
}
/* «- Denominación: Nummularia», «Tribunal: Roma»…: the facts at the head of the description */
const KV_KEY = { 'fundada en': 'Año de fundación' };
function kvHead(txt) {
  const L = String(txt || '').split('\n'), items = [];
  let i = 0;
  for (; i < L.length; i++) {
    const l = L[i].trim();
    if (!l) { if (items.length) { i++; break; } continue; }
    const m = /^-?\s*([A-ZÁÉÍÓÚÑ][^:]{1,28}):\s*(.+)$/.exec(l);
    if (!m) break;
    items.push([KV_KEY[m[1].trim().toLowerCase()] || m[1].trim(), m[2].trim()]);
  }
  return items.length >= 2 ? { items: items, rest: L.slice(i).join('\n') } : { items: [], rest: String(txt || '') };
}
/* the boons and hooks named with their page in Covenants: «un Ambiente Saludable (Alianzas, pág. 12)» */
function bookRefs(txt) {
  const out = [], re = /([^()\n]{0,80}?)\s*\((?:Alianzas|Covenants),?\s*p[áa]g\.?\s*(\d+)\)/g;
  let m;
  while ((m = re.exec(String(txt || '')))) {
    const w = /((?:[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü'’-]*)(?:\s+(?:de|del|la|las|los|el|y|en|a)?\s*[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü'’-]*)*)\s*$/.exec(m[1]);
    const n = w ? w[1] : m[1].trim().split(/\s+/).slice(-2).join(' ');
    if (n && !out.some(o => o[0] === n)) out.push([n, 'pág. ' + m[2]]);
  }
  return out;
}
function byLine(x) {
  return h('p', { class: 'hb-by' }, ['Por ' + x.g.autor + (x.colab ? ', con ' + x.colab : '') + (x.fecha ? ' · ' + fechaTxt(x.fecha) : '') + (x.blog ? ' · ' + x.blog : '') + (x.idioma === 'en' ? ' · en inglés' : '') + ' · ',
    x.url ? h('a', { href: x.url, target: '_blank', rel: 'noopener', text: 'Entrada original' }) : null,
    hbOn(x.g.k) ? null : h('span', { class: 'hb-off-t', text: ' · vista previa: ' + hbTitle(x.g) + ' no está activo' })]);
}
function viewCov(slug, tab) {
  page.innerHTML = '';
  page.appendChild(sagaCrumbs([['Homebrew', '#hb'], ['Alianzas', null]]));
  const content = h('div', { class: 'content' });
  const need = alGroups().filter(g => !hbData(g.k));
  if (need.length) {
    page.appendChild(h('h1', { class: 'doc-title', text: 'Alianza' }));
    page.appendChild(content);
    content.appendChild(h('p', { class: 'note', text: 'Cargando las alianzas…' }));
    Promise.all(need.map(g => hbLoad(g.k).catch(() => null))).then(() => sagaChanged());
    return;
  }
  const c = covenants().get(slug);
  if (!c) {
    page.appendChild(h('h1', { class: 'doc-title', text: 'Alianza' }));
    page.appendChild(content);
    content.appendChild(h('p', { class: 'note', text: 'Esta alianza no está en el material homebrew activo de la saga.' }));
    return;
  }
  const desc = c.parts.find(x => partIdx(x) === 0) || null;
  const head = desc ? kvHead(desc.texto) : { items: [], rest: '' };
  const sheets = [{ id: 'ficha', title: 'Ficha' }, { id: 'descripcion', title: 'Descripción' }];
  c.parts.filter(x => x !== desc).forEach(x => {
    let id = slugify(x.parte || x.n), n = 2;
    while (sheets.some(s => s.id === id)) id = slugify(x.parte || x.n) + '-' + n++;
    sheets.push({ id: id, title: x.parte || x.n, x: x });
  });
  const sheet = sheets.find(s => s.id === tab) || sheets[0];
  const autores = [...new Set(c.parts.map(x => x.g.autor))];
  const kv = Object.fromEntries(head.items.map(([k, v]) => [k.toLowerCase(), v]));
  document.title = c.n + (sheet.id !== 'ficha' ? ' · ' + sheet.title : '') + ' — Europa Mítica';
  page.appendChild(h('h1', { class: 'doc-title', text: c.n }));
  page.appendChild(h('div', { class: 'doc-meta' }, ['Homebrew de ' + autores.join(' y '), sheets.length + ' pestañas'].map(t => h('span', { text: t }))));
  const blurb = [kv.tribunal ? 'Tribunal de ' + kv.tribunal : '', kv['año de fundación'] ? 'fundada en ' + kv['año de fundación'] : '', kv['estación'] ? 'estación de ' + kv['estación'].toLowerCase() : ''].filter(Boolean);
  page.appendChild(h('p', { class: 'doc-blurb', text: 'Alianza fanmade' + (blurb.length ? ': ' + blurb.join(', ') : '') + '. No es de los libros de Ars Magica.' }));
  const tabs = h('div', { class: 'tabs', role: 'navigation', 'aria-label': 'Pestañas de ' + c.n },
    sheets.map(s => h('a', { class: 'tab', href: '#hbal--' + slug + '--' + s.id, 'aria-current': s === sheet ? 'page' : null, text: s.title })));
  page.appendChild(h('div', { class: 'tabs-wrap' }, tabs));
  scrollHint(tabs, tabs.querySelector('[aria-current="page"]'));
  page.appendChild(content);
  content.appendChild(h('h2', { class: 'sheet-h', text: sheet.title }));
  if (sheet.id === 'ficha') {
    const items = head.items.concat([['Autores', autores.join(', ')]], desc && desc.serie ? [['Publicada en', desc.serie]] : []);
    const vent = bookRefs(c.parts.filter(x => x.parte === 'Ventajas').map(x => x.texto).join('\n'));
    const trab = bookRefs(c.parts.filter(x => x.parte === 'Trabas').map(x => x.texto).join('\n'));
    const blocks = [{ t: 'kv', items: items }];
    const cols = [];
    if (vent.length) cols.push([{ t: 'h3', x: 'Ventajas' }, { t: 'grid', head: ['Ventaja', 'Alianzas'], body: vent, cls: 'narrow' }]);
    if (trab.length) cols.push([{ t: 'h3', x: 'Trabas' }, { t: 'grid', head: ['Traba', 'Alianzas'], body: trab, cls: 'narrow' }]);
    if (cols.length) blocks.push({ t: 'cols', items: cols });
    content.appendChild(hbThanks(c.parts.map(x => ({ autor: x.g.autor, blog: x.blog, url: x.url, colab: x.colab })), 'esta alianza'));
    content.appendChild(renderBlocks(blocks, { doc: { id: 'hbal-' + slug }, sheet: { id: 'ficha' } }));
    if (cols.length) content.appendChild(h('p', { class: 'note', text: 'Ventajas y trabas nombradas en los textos, con su página del suplemento Alianzas (Covenants).' }));
    content.appendChild(h('h3', { text: 'Partes' }));
    content.appendChild(h('ul', { class: 'hb-list-e' }, sheets.slice(1).map(s => {
      const x = s.x || desc;
      return h('li', null, [h('a', { href: '#hbal--' + slug + '--' + s.id, text: s.title }), x ? h('small', { class: 'xt', text: [x.g.autor, fechaTxt(x.fecha), hbOn(x.g.k) ? '' : 'no activo'].filter(Boolean).join(' · ') }) : h('small', { class: 'xt', text: 'sin entrada' })]);
    })));
    return;
  }
  const x = sheet.id === 'descripcion' ? desc : sheet.x;
  if (!x) {
    content.appendChild(h('p', { class: 'note', text: S.owner === true
      ? 'Esta alianza no tiene una entrada de descripción en ningún blog: su historia y su lugar están repartidos por las otras pestañas.'
      : 'La descripción de esta alianza no está en el material activo de la saga: lo que se cuenta de ella está en las otras pestañas.' }));
    return;
  }
  content.appendChild(byLine(x));
  const thanks = () => hbThanks([{ autor: x.g.autor, blog: x.blog, url: x.url, colab: x.colab }], 'este texto');
  content.appendChild(thanks());
  if (x.pres) content.appendChild(h('div', { class: 'hb-pres' }, mdBlocks(x.pres)));
  content.appendChild(h('article', { class: 'hb-text' }, mdBlocks(x === desc ? head.rest : x.texto, x.idioma === 'en')));
  content.appendChild(thanks());
}

export { viewCov, viewHb };

