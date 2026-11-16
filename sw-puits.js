// Service worker de la CARTE DES PUITS seule (portée : puits.html). Il garde la page, ses scripts et les tuiles de fond de carte déjà vues,
// pour que la carte s'ouvre sans réseau sur le terrain. Le service worker général (sw.js, qui rend le portail installable) reste sans cache.
// Les POSITIONS des puits ne sont jamais ici : la page les garde dans le stockage de l'appareil après une connexion réussie.
const COQUILLE = 'puits-coquille-v1', TUILES = 'puits-tuiles-v1', MAX_TUILES = 3000;
const FICHIERS = ['puits.html', 'js/config.js', 'js/api.js', 'js/puits-geo.js', 'js/puits-kml.js', 'icon-192.png', 'manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(COQUILLE).then((c) => Promise.all(FICHIERS.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('puits-') && k !== COQUILLE && k !== TUILES).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
async function limiter(cache) {
  const ks = await cache.keys();
  if (ks.length > MAX_TUILES) await Promise.all(ks.slice(0, ks.length - MAX_TUILES).map((k) => cache.delete(k)));
}
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname === 'tile.openstreetmap.org' || u.hostname.endsWith('.tile.openstreetmap.org')) {   // tuiles : d'abord celles de l'appareil, sinon réseau (et on les garde)
    e.respondWith(caches.open(TUILES).then(async (c) => {
      const vu = await c.match(r.url); if (vu) return vu;
      try { const rep = await fetch(r.url, { mode: 'cors', credentials: 'omit' }); if (rep.ok) { c.put(r.url, rep.clone()); limiter(c); } return rep; }
      catch (err) { return new Response('', { status: 504 }); }
    }));
    return;
  }
  if (u.origin !== location.origin) return;
  const chemin = u.pathname.split('/').pop() || '', rel = u.pathname.replace(/^.*?\/(puits\.html|js\/[^/]+|icon-192\.png|manifest\.json)$/, '$1');
  if (!FICHIERS.includes(rel) && chemin !== 'puits.html') return;
  // réseau d'abord (toujours à jour en ligne), la copie de l'appareil en secours hors réseau
  e.respondWith(fetch(r).then((rep) => { if (rep.ok) { const copie = rep.clone(); caches.open(COQUILLE).then((c) => c.put(FICHIERS.includes(rel) ? rel : 'puits.html', copie)); } return rep; })
    .catch(() => caches.open(COQUILLE).then((c) => c.match(FICHIERS.includes(rel) ? rel : 'puits.html', { ignoreSearch: true }).then((m) => m || Response.error()))));
});
