/* Service worker: app shell works offline; API calls always go to the network. */
const CACHE = 'annapurna-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  "./css/app.css",
  "./fonts/fraunces-latin-400-italic.woff2",
  "./fonts/fraunces-latin-400-normal.woff2",
  "./fonts/fraunces-latin-600-normal.woff2",
  "./fonts/fraunces-latin-700-normal.woff2",
  "./fonts/hind-guntur-latin-400-normal.woff2",
  "./fonts/hind-guntur-latin-500-normal.woff2",
  "./fonts/hind-guntur-latin-600-normal.woff2",
  "./fonts/hind-guntur-latin-700-normal.woff2",
  "./fonts/hind-guntur-telugu-400-normal.woff2",
  "./fonts/hind-guntur-telugu-500-normal.woff2",
  "./fonts/hind-guntur-telugu-600-normal.woff2",
  "./fonts/hind-guntur-telugu-700-normal.woff2",
  "./fonts/yeseva-one-latin-400-normal.woff2",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./img/logo-160.png",
  "./img/logo.png",
  "./img/products/idly-karam-closeup.jpg",
  "./img/products/idly-karam-pack.jpg",
  "./img/products/idly-karam.jpg",
  "./img/products/kandi-closeup.jpg",
  "./img/products/kandi-pack.jpg",
  "./img/products/kandi.jpg",
  "./img/products/karivepaku-closeup.jpg",
  "./img/products/karivepaku-pack.jpg",
  "./img/products/karivepaku.jpg",
  "./img/products/munagaku-closeup.jpg",
  "./img/products/munagaku-pack.jpg",
  "./img/products/munagaku.jpg",
  "./img/products/nuvvula-closeup.jpg",
  "./img/products/nuvvula-pack.jpg",
  "./img/products/nuvvula.jpg",
  "./img/products/rasam-closeup.jpg",
  "./img/products/rasam-pack.jpg",
  "./img/products/rasam.jpg",
  "./img/products/sambar-closeup.jpg",
  "./img/products/sambar-pack.jpg",
  "./img/products/sambar.jpg",
  "./js/admin.js",
  "./js/app.js",
  "./js/data.js",
  "./js/qrcode.js",
  "./js/store.js",
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('/api/')) return;
  // uploaded product photos & pages: network first, fall back to cache
  e.respondWith(fetch(e.request).then(r => { if (r.ok && url.origin === location.origin) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match('./index.html'))));
});
