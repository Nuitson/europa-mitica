/* El material homebrew de blogs en la web: la lista de lo activo (#hb), cada grupo de tipo y autor (#hb--grupo)
   y cada entrada (#hb--grupo--id). Los grupos se activan en la pestaña «Homebrew» de la pantalla del máster;
   quien no es máster solo ve los activos. */
import { esc, h, R } from '../base.js';
import { page } from '../views.js';
import { S } from './state.js';
import { sagaChanged, sagaCrumbs, statusNote } from './core.js';
import { hbActive, hbData, hbGroup, hbGroups, hbLoad, hbOn, hbTitle } from './homebrew.js';
import { catInfo } from '../info.js';

const IDIOMA = { en: 'en inglés', es: '' };
const fechaTxt = f => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || ''); return m ? Number(m[3]) + '/' + Number(m[2]) + '/' + m[1] : f || ''; };

/* the posts come as plain text with a little Markdown: headings, lists, quotes, bold and italics */
function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(«“])_(\S(?:.*?\S)?)_(?=[\s.,;:)»”!?]|$)/g, '$1<i>$2</i>');
}
function mdBlocks(txt) {
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
  if (textos.length) {
    content.appendChild(h('h2', { class: 'm-h', text: 'Entradas · ' + textos.length }));
    // posts of one covenant or character together, in their order; the rest after
    const groups = [], by = {};
    textos.forEach(x => { const gk = x.grupo || ''; if (!by[gk]) { by[gk] = []; groups.push(gk); } by[gk].push(x); });
    groups.sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1));
    groups.forEach(gk => {
      if (gk && groups.length > 1) content.appendChild(h('h3', { class: 'm-sub', text: gk }));
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
  const sp = (d.hechizos || []).filter(x => x.entrada === e.id);
  if (sp.length) content.appendChild(h('div', { class: 'actions hb-sp' }, sp.map(x => h('button', { type: 'button', class: 'btn ghost', onclick: () => catInfo(Object.assign({ hb: k, autor: g.autor, blog: e.blog }, x)) }, 'Ficha del hechizo: ' + x.n))));
  if (e.pres) content.appendChild(h('div', { class: 'hb-pres' }, mdBlocks(e.pres)));
  content.appendChild(h('article', { class: 'hb-text' }, mdBlocks(e.texto)));
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
  const grid = h('div', { class: 'docs' });
  list.forEach(g => grid.appendChild(h('a', { class: 'dcard' + (hbOn(g.k) ? '' : ' hb-card-off'), href: '#hb--' + g.k }, h('div', { class: 'in' }, [
    h('div', { class: 'dp', text: g.tipo + (own && !hbOn(g.k) ? ' · no activo' : '') }),
    h('div', { class: 'dt1', text: g.autor }),
    h('div', { class: 'db', text: (g.blogs || []).join(', ') }),
    h('div', { class: 'dm', text: [g.textos ? g.textos + (g.textos === 1 ? ' entrada' : ' entradas') : '', g.hechizos ? g.hechizos + ' hechizos' : ''].filter(Boolean).join(' · ') + ' →' })]))));
  content.appendChild(grid);
}

export { viewHb };
