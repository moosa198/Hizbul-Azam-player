const SHELL_CACHE = 'hizbul-azam-shell-v5';
const CONTENT_CACHE = 'hizbul-azam-content-v5';
const SHELL = [
  './', './index.html', './style.css?v=7', './app.js?v=7', './pdf-viewer.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './saturday.html', './sunday.html', './monday.html', './tuesday.html',
  './wednesday.html', './thursday.html', './friday.html'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL_CACHE, CONTENT_CACHE].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'CACHE_DAY') return;
  const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
  const port = event.ports && event.ports[0];
  event.waitUntil(
    caches.open(CONTENT_CACHE).then(async cache => {
      for (const url of urls) {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Failed to cache ' + url);
        await cache.put(new URL(url, self.location.href).href, response.clone());
      }
      if (port) port.postMessage({ ok: true });
    }).catch(() => {
      if (port) port.postMessage({ ok: false });
    })
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Keep same-origin app/content available offline.
  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/pdfs/') || url.pathname.includes('/audio/')) {
      event.respondWith(
        caches.open(CONTENT_CACHE).then(cache =>
          cache.match(request).then(cached => cached || fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }))
        )
      );
      return;
    }

    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok) caches.open(SHELL_CACHE).then(cache => cache.put(request, response.clone()));
        return response;
      }).catch(() => caches.match('./index.html')))
    );
    return;
  }

  // Cache PDF.js after its first successful online load so it can be reused offline.
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(
      caches.open(SHELL_CACHE).then(cache =>
        cache.match(request).then(cached => cached || fetch(request).then(response => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }))
      )
    );
  }
});
