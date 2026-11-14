const SHELL = 'shell-v1', MAP = 'map-v1';
const SHELL_URLS = ['./', 'places.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js', 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(SHELL_URLS.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== MAP).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Tile URLs carry a weekly version segment; key them by z/x/y so saved tiles keep working.
function mapKey(url) {
  const m = url.pathname.match(/^\/planet\/[^/]+\/(\d+\/\d+\/\d+\.pbf)$/);
  return m ? 'https://tiles.openfreemap.org/t/' + m[1] : url.href;
}
async function cacheFirst(req, key) {
  const c = await caches.open(MAP), hit = await c.match(key);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(key, res.clone());
  return res;
}
async function staleWhileRevalidate(req, cacheName, key) {
  const c = await caches.open(cacheName), hit = await c.match(key, { ignoreSearch: true });
  const net = fetch(req).then(res => { if (res.ok) c.put(key, res.clone()); return res; });
  if (hit) { net.catch(() => {}); return hit; }
  return net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'tiles.openfreemap.org') {
    const isAsset = /\.(pbf|png|json)$/.test(url.pathname);
    e.respondWith(isAsset ? cacheFirst(req, mapKey(url)) : staleWhileRevalidate(req, MAP, url.href));
  } else if (url.origin === location.origin || url.hostname === 'unpkg.com') {
    const key = req.mode === 'navigate' ? './' : req.url;
    e.respondWith(staleWhileRevalidate(req, SHELL, key));
  }
});
