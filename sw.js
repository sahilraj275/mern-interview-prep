// Service worker: keeps a copy of the guide so it opens offline.
// The page itself is network-first (you always get the latest when online, the saved copy when not);
// icons and Google Fonts are cache-first and refreshed in the background.
const CACHE = 'mern-prep-v1';
const PAGE = '/mern-interview-prep.html';
const CORE = ['/', PAGE, '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const savedPage = () => caches.match(PAGE).then(hit => hit || caches.match('/'));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    const fromNet = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(PAGE, copy)); }
      return res;
    });
    // offline: use the saved copy at once; a very slow network: fall back to it after 4 s
    const slow = new Promise(r => setTimeout(r, 4000)).then(savedPage);
    e.respondWith(Promise.race([fromNet.catch(savedPage), slow.then(hit => hit || fromNet)]));
    return;
  }

  const fonts = url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !fonts) return;
  e.respondWith(caches.match(req).then(hit => {
    const fresh = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || fresh;
  }));
});
