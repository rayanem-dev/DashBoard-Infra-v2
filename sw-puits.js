// Service worker de la CARTE DES PUITS et des SIGNALEMENTS TERRAIN (portées : puits.html et signalements.html). Il garde la page et ses scripts,
// pour que la carte s'ouvre sans réseau sur le terrain. Le service worker général (sw.js, qui rend le portail installable) reste sans cache.
// Les POSITIONS des puits ne sont jamais ici : la page les garde dans le stockage de l'appareil après une connexion réussie.
const COQUILLE = 'puits-coquille-v1', TUILES = 'puits-tuiles-v2';   // TUILES : copie du relief sur l'appareil, écrite par la page (jamais par le service worker)
const FICHIERS = ['puits.html', 'signalements.html', 'js/config.js', 'js/api.js', 'js/puits-geo.js', 'js/puits-kml.js', 'icon-192.png', 'manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(COQUILLE).then((c) => Promise.all(FICHIERS.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('puits-') && k !== COQUILLE && k !== TUILES).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  const rel = u.pathname.replace(/^.*?\/(puits\.html|signalements\.html|js\/[^/]+|icon-192\.png|manifest\.json)$/, '$1');
  if (!FICHIERS.includes(rel)) return;
  // réseau d'abord (toujours à jour en ligne), la copie de l'appareil en secours hors réseau
  e.respondWith(fetch(r).then((rep) => { if (rep.ok) { const copie = rep.clone(); caches.open(COQUILLE).then((c) => c.put(rel, copie)); } return rep; })
    .catch(() => caches.open(COQUILLE).then((c) => c.match(rel, { ignoreSearch: true }).then((m) => m || Response.error()))));
});
