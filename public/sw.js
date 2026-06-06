/**
 * Service Worker para LDFP Igreja PWA
 * Handles caching, offline support, and background sync
 */

const CACHE_NAME = 'ldfp-v8';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/login.html',
    '/dashboard.html',
    '/lista_membros.html',
    '/agenda.html',
    '/oracoes.html',
    '/visitantes.html',
    '/bancos_lancamentos.html',
    '/portaria.html',
    '/membros.html',
    '/app_membro.html',
    '/app_membro_v2.html',
    '/app_midia.html',
    '/dashboard_membro.html',
    '/planos.html',
    '/planos-data.json',
    '/style.css',
    '/app.css',
    '/app.js',
    '/session.js',
    '/enterprise-shell.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

const NETWORK_FIRST_PATHS = new Set([
    '/enterprise-shell.js',
    '/session.js',
    '/style.css',
    '/app.css',
    '/planos.html',
    '/planos-data.json'
]);

// Install event - cache essential assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching assets');
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[Service Worker] Some assets failed to cache:', err);
                // Continue even if some assets fail
            });
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignora requisições que não sejam GET (POST, PUT, PATCH, DELETE) 
    // para evitar erros de "unsupported method" na API de Cache
    if (request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests and certain paths
    if (url.origin !== location.origin) {
        return;
    }

    // Skip api calls for dynamic data, but cache them for offline
    if (url.pathname.startsWith('/api/') || url.pathname.includes('.json')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful responses
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Return cached version if offline
                    return caches.match(request).then((cached) => {
                        return cached || new Response(
                            JSON.stringify({ offline: true, message: 'Dados em cache' }),
                            { headers: { 'Content-Type': 'application/json' } }
                        );
                    });
                })
        );
        return;
    }

    // Keep shell scripts/styles and HTML always fresh to avoid stale UI bugs.
    if (request.destination === 'document' || NETWORK_FIRST_PATHS.has(url.pathname)) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then((cached) => {
                        if (cached) {
                            return cached;
                        }

                        if (request.destination === 'document') {
                            return caches.match('/index.html');
                        }

                        return Response.error();
                    });
                })
        );
        return;
    }

    // For HTML and static assets, try cache first, then network
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                return cached;
            }
            return fetch(request)
                .then((response) => {
                    if (!response || response.status !== 200 || response.type === 'error') {
                        return response;
                    }
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Offline fallback
                    if (request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                });
        })
    );
});

// Handle push notifications
self.addEventListener('push', (event) => {
    if (!event.data) {
        return;
    }

    try {
        const data = event.data.json();
        const options = {
            body: data.body || 'Nova notificação',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            tag: data.tag || 'notification',
            requireInteraction: data.requireInteraction || false,
            actions: data.actions || [],
            data: data.data || {}
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'LDFP Igreja', options)
        );
    } catch (error) {
        console.error('[Service Worker] Push notification error:', error);
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action) {
        // Handle action button clicks
        console.log('[Service Worker] Action clicked:', event.action);
    }

    // Open or focus window
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Check if app is already open
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open app if not already open
            if (clients.openWindow) {
                const url = event.notification.data.url || '/';
                return clients.openWindow(url);
            }
        })
    );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-oracoes') {
        event.waitUntil(syncOracoes());
    } else if (event.tag === 'sync-visitantes') {
        event.waitUntil(syncVisitantes());
    }
});

async function syncOracoes() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        // Aqui você implementaria a sincronização de dados pendentes
        console.log('[Service Worker] Syncing orações...');
    } catch (error) {
        console.error('[Service Worker] Sync error:', error);
        throw error;
    }
}

async function syncVisitantes() {
    try {
        console.log('[Service Worker] Syncing visitantes...');
    } catch (error) {
        console.error('[Service Worker] Sync error:', error);
        throw error;
    }
}

// Escutar mensagens da página e forçar atualização sem travar o canal prematuramente
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('[Service Worker] Loaded');
