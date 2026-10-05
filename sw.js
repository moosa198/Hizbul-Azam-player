const VERSION = 'v17';
const SHELL_CACHE = 'hizbul-azam-shell-' + VERSION;
const CONTENT_CACHE = 'hizbul-azam-content-' + VERSION;
const SHELL = [
  './', './index.html', './style.css?v=17', './completion.css?v=1', './app.js?v=18', './completion.js?v=1', './pdf-viewer.js?v=1', './manifest.webmanifest?v=11',
  './icons/hizbul-azam-favicon-32.png?v=14', './icons/hizbul-azam-icon-192.png?v=14', './icons/hizbul-azam-icon-512.png?v=14',
  './translations/saturday.json', './translations/sunday.json', './translations/monday.json', './translations/tuesday.json', './translations/wednesday.json', './translations/thursday.json', './translations/friday.json',
  './saturday.html', './sunday.html', './monday.html', './tuesday.html', './wednesday.html', './thursday.html', './friday.html'
];

async function enhanceHtml(response) {
  if (!response || !response.ok) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  const html = await response.clone().text();
  if (html.includes('completion.js?v=1')) return response;

  const enhanced = html.replace(
    '</head>',
    '<link rel="stylesheet" href="completion.css?v=1"><script src="completion.js?v=1" defer></script></head>'
  );
  return new Response(enhanced, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![SHELL_CACHE, CONTENT_CACHE].includes(k)).map(k => caches.delete(k))))
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

  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/pdfs/') || url.pathname.includes('/audio/') || url.pathname.includes('/translations/')) {
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
      caches.match(request).then(async cached => {
        if (cached) return enhanceHtml(cached);
        const response = await fetch(request);
        if (response.ok) {
          caches.open(SHELL_CACHE).then(cache => cache.put(request, response.clone()));
        }
        return enhanceHtml(response);
      }).catch(() => caches.match('./index.html').then(enhanceHtml))
    );
    return;
  }

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
