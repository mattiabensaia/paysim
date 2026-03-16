const CACHE_NAME = 'paysim-v14';
const ASSETS_TO_CACHE = [
    '/paysim/',
    '/paysim/wallet.html',
    '/paysim/pos.html',
    '/paysim/styles.css',
    '/paysim/wallet.js',
    '/paysim/pos.js',
    '/paysim/icon-192.png',
    '/paysim/icon-512.png'
];

// Install: cache all essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching app shell v9');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: serve from cache first, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        // CRITICAL FIX: ignoreSearch:true ensures that URLs like /wallet.html?amount=1.10
        // correctly match the cached /wallet.html file!
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // Cache successful GET requests for future offline use
                if (event.request.method === 'GET' && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // If both cache and network fail, return a fallback for HTML pages
                if (event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('/paysim/wallet.html', { ignoreSearch: true });
                }
            });
        })
    );
});
