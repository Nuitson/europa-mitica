/* El árbol de carpetas de la barra lateral. */
import { DATA, DOCS, esc, h, ICON } from './base.js';

/* ---------------------------------------------------------------- tree / paths */
const PATH = {}; // doc id -> [folder nodes]
(function walk(nodes, trail) {
  nodes.forEach(n => {
    if (n.d) PATH[n.d] = trail.slice();
    else walk(n.children || [], trail.concat([n]));
  });
})(DATA.tree, []);

function renderTree() {
  const root = document.getElementById('tree');
  function ul(nodes) {
    const u = h('ul');
    nodes.forEach(n => {
      if (n.d) {
        const d = DOCS[n.d];
        u.appendChild(h('li', null, h('a', { class: 't-doc', href: '#' + d.id, 'data-doc': d.id, html: ICON.sheet + '<span>' + esc(d.title) + '</span>' })));
      } else {
        const li = h('li');
        const f = h('div', { class: 't-folder', html: ICON.folder + '<span>' + esc(n.f) + '</span>' });
        li.appendChild(f);
        li.appendChild(ul(n.children || []));
        u.appendChild(li);
      }
    });
    return u;
  }
  root.appendChild(ul(DATA.tree));
}

export { PATH, renderTree };
