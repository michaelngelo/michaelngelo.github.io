const CACHE_NAME = 'verseflow-cache-v1';
const URLS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json'
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

// Fetch Event - Serve Offline First
self.addEventListener('fetch', (event) => {
    // Exclude projector mode URL parameters from caching strictness
    const requestUrl = new URL(event.request.url);
    if (requestUrl.search.includes('mode=projector')) {
        event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});