const CACHE_NAME = 'versesurf-v1';
const URLS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.css',
    'https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.js',
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.2/dist/peerjs.min.js',
    'https://cdn.jsdelivr.net/npm/mqtt/dist/mqtt.min.js',
    'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'
];

// Install Event - Pre-cache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                URLS_TO_CACHE.map(url =>
                    cache.add(new Request(url, { mode: url.startsWith('http') ? 'cors' : 'same-origin' }))
                )
            );
        })
    );
    self.skipWaiting();
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Stale-While-Revalidate with Projector & Remote route handling
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const requestUrl = new URL(event.request.url);
    if (!requestUrl.protocol.startsWith('http')) return;

    // Route query-based routes (projector / remote) back to cached index.html
    const mode = requestUrl.searchParams.get('mode');
    if (mode === 'projector' || mode === 'remote') {
        event.respondWith(
            caches.match('./index.html', { ignoreSearch: true })
                .then(response => response || caches.match('./', { ignoreSearch: true }))
                .then(response => response || fetch(event.request))
                .catch(() => caches.match('./index.html', { ignoreSearch: true }))
        );
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const isCacheable = (
                            requestUrl.hostname === 'cdn.jsdelivr.net' ||
                            requestUrl.hostname === 'fonts.googleapis.com' ||
                            requestUrl.hostname === 'fonts.gstatic.com' ||
                            URLS_TO_CACHE.some(u => {
                                if (u.startsWith('http')) {
                                    return requestUrl.href === u;
                                } else {
                                    const clean = u.replace(/^\.\//, '');
                                    return clean.length > 0 && requestUrl.pathname.endsWith('/' + clean);
                                }
                            })
                        );

                        if (isCacheable) {
                            cache.put(event.request, networkResponse.clone());
                        }
                    }
                    return networkResponse;
                }).catch(() => {
                    return cachedResponse;
                });

                return cachedResponse || fetchPromise;
            });
        })
    );
});