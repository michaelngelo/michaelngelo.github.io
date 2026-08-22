const CACHE_NAME = 'verseflow-cache-v1';
const URLS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './default-bg.avif'
];

// Install Event - Cache Files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(URLS_TO_CACHE))
    );
    self.skipWaiting();
});

// Activate Event - Clean Up Old Caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Serve Offline First & Dynamically Cache External Links
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    if (requestUrl.search.includes('mode=projector')) {
        event.respondWith(fetch(event.request).catch(() => caches.match('./index.html', { ignoreSearch: true })));
        return;
    }

    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((response) => {
            return response || fetch(event.request).then((networkResponse) => {
                // Dynamically cache any KaTeX assets fetched from the CDN
                if (requestUrl.hostname === 'cdn.jsdelivr.net') {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return networkResponse;
            });
        })
    );
});