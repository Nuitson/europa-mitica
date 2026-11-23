/* El árbol de carpetas de la barra lateral. */
import { DATA, DOCS, esc, h, ICON, load, store } from './base.js';

/* ---------------------------------------------------------------- tree / paths */
const PATH = {}; // doc id -> [folder nodes]
(function walk(nodes, trail) {
  nodes.forEach(n => {
    if (n.d) PATH[n.d] = trail.slice();
    else walk(n.children || [], trail.concat([n]));
  });
})(DATA.tree, []);

/* a folder of the side panel that folds: the arrow before its name opens or closes it, and this browser remembers it.
   key: what it is remembered by; label: the name (a link or a plain heading); list: the <ul> inside; open0: open at first */
function foldLi(key, label, list, open0) {
  const k = 'em:pliegue:' + key, v = load(k);
  let open = v == null ? open0 !== false : v === '1';
  const name = label.textContent.trim();
  const btn = h('button', { type: 'button', class: 't-fold' });
  const li = h('li', { class: 't-fl' }, [h('div', { class: 't-row' }, [btn, label]), list]);
  const set = () => {
    list.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', (open ? 'Contraer ' : 'Expandir ') + name);
    li.classList.toggle('shut', !open);
  };
  btn.addEventListener('click', () => { open = !open; store(k, open ? '1' : '0'); set(); });
  set();
  return li;
}
const folderLabel = (name, icon) => h('div', { class: 't-folder', html: (icon || ICON.folder) + '<span>' + esc(name) + '</span>' });

/* the shared aids (game aids, homework…); the saga's own folder goes in its sections (saga/home.js) */
function renderTree() {
  const root = document.getElementById('tree');
  function ul(nodes, trail) {
    const u = h('ul');
    nodes.forEach(n => {
      if (n.d) {
        const d = DOCS[n.d];
        u.appendChild(h('li', null, h('a', { class: 't-doc', href: '#' + d.id, 'data-doc': d.id, html: ICON.sheet + '<span>' + esc(d.title) + '</span>' })));
      } else {
        const key = trail.concat(n.f).join('/');
        u.appendChild(foldLi('t:' + key, folderLabel(n.f), ul(n.children || [], trail.concat(n.f))));
      }
    });
    return u;
  }
  root.appendChild(ul(DATA.tree.filter(n => !n.saga), []));
}

export { foldLi, folderLabel, PATH, renderTree };
