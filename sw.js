/* Europa Mítica: keeps the page in this browser so the game aids open without a connection.
   Network first: online, every file comes fresh from the server (and refreshes the copy); offline, or when the network
   takes too long, the copy answers. The saga's server (api/api.php) is never cached: its data stay live, and writes
   (POST) never reach this worker.
   The hosting tells browsers to keep .js and .css for a month (Cache-Control: max-age=2592000), so «fresh from the
   server» has to say so: every request asks the server (cache: 'no-cache', a short 304 when nothing changed), and a new
   version fetches all its files again (cache: 'reload'). When a new version replaces an older one, the open tabs
   reload once, so they stop running the old files.
   Keep FILES in step with the repository: a new module, image or data file goes here too. */
const CACHE = 'europa-mitica-v52';
const FILES = [
  './',
  'index.html',
  'config.js',
  'css/styles.css',
  'js/gate.js',
  'js/cuenta.js',
  'js/app/astro.js',
  'js/app/base.js',
  'js/app/blocks.js',
  'js/app/creation/editor.js',
  'js/app/creation/rules.js',
  'js/app/creation/vdtab.js',
  'js/app/creation/sptab.js',
  'js/app/creation/generos.js',
  'js/app/info.js',
  'js/app/main.js',
  'js/app/master.js',
  'js/app/saga/alianza.js',
  'js/app/saga/characters.js',
  'js/app/saga/core.js',
  'js/app/saga/covenant.js',
  'js/app/saga/cronica.js',
  'js/app/saga/hbview.js',
  'js/app/saga/home.js',
  'js/app/saga/homebrew.js',
  'js/app/saga/labwork.js',
  'js/app/saga/library.js',
  'js/app/saga/pjfile.js',
  'js/app/saga/rules.js',
  'js/app/saga/seasons.js',
  'js/app/saga/state.js',
  'js/app/search.js',
  'js/app/tree.js',
  'js/app/views.js',
  'data/alianza.json',
  'data/ayudas.json',
  'data/hechizos.json',
  'data/imagenes.json',
  'data/libros.json',
  'data/homebrew/index.json', // each group's file is kept the first time it is opened
  // data/astro.json (600 KB, only the master's screen uses it) is kept the first time it is opened
  'img/i0.webp',
  'img/i1.webp',
  'img/i2.webp',
  'img/i3.webp',
  'img/i4.webp',
  'img/i5.webp',
  'img/i6.webp',
  'img/i7.webp',
  'img/i8.webp',
  'img/i9.webp',
  'img/i10.webp',
  'img/i11.webp',
  'img/i12.webp',
  'img/i13.webp',
  'img/i14.webp'
];
const FONTS = /^(fonts\.googleapis\.com|fonts\.gstatic\.com)$/;
const TIMEOUT = 4000; // after this, answer from the copy and let the network refresh it in the background

self.addEventListener('install', e => {
  // one missing file must not leave the whole site without a copy; each comes from the server, not the browser's cache
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const viejas = (await caches.keys()).filter(k => k.startsWith('europa-mitica-') && k !== CACHE);
    await Promise.all(viejas.map(k => caches.delete(k)));
    await self.clients.claim();
    // an update, not the first visit: the open tabs still run the old files
    if (viejas.length) (await self.clients.matchAll({ type: 'window' })).forEach(c => { if (c.navigate) c.navigate(c.url).catch(() => null); });
  })());
});

async function fromNetwork(req, cache) {
  const res = await fetch(req, { cache: 'no-cache' });
  if (res.ok || res.type === 'opaque') await cache.put(req, res.clone());
  return res;
}
async function networkFirst(e) {
  const req = e.request, cache = await caches.open(CACHE);
  const net = fromNetwork(req, cache);
  e.waitUntil(net.catch(() => null)); // a late answer still refreshes the copy
  const late = new Promise(ok => setTimeout(ok, TIMEOUT, null));
  try {
    const res = await Promise.race([net, late]);
    if (res) return res;
  } catch (err) { /* offline: the copy answers */ }
  const copy = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
  return copy || net; // no copy: wait for the network after all, or its error
}
async function cacheFirst(e) {
  const cache = await caches.open(CACHE);
  return (await cache.match(e.request)) || fromNetwork(e.request, cache);
}
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin && /\/libros\//.test(url.pathname)) return; // the books' PDFs are big: the browser fetches them itself, never kept here
  if (url.origin === location.origin) e.respondWith(networkFirst(e));
  else if (FONTS.test(url.hostname)) e.respondWith(cacheFirst(e)); // a font's address never changes its content
});
