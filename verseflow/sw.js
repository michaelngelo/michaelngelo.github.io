const CACHE_NAME = 'verseflow-cache-v2';
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

// Fetch Event - Stale-While-Revalidate & Dynamic CDN Caching
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    if (requestUrl.search.includes('mode=projector')) {
        event.respondWith(caches.match('./index.html', { ignoreSearch: true }));
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
                
                // Background Fetch (Revalidate)
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // Cache dynamic KaTeX CDN requests OR our core static assets
                    if (requestUrl.hostname === 'cdn.jsdelivr.net' || URLS_TO_CACHE.includes(requestUrl.pathname)) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    console.log('Offline: Using stale cache for', requestUrl.pathname);
                });

                // Return cache immediately if available, otherwise network
                return cachedResponse || fetchPromise;
            });
        })
    );
});
