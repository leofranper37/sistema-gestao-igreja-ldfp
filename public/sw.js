/**
 * Service Worker para LDFP Igreja PWA - Versão Corrigida
 */

const CACHE_NAME = 'ldfp-v9';
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
  '/style.css',
  '/app.css',
  '/app.js',
  '/session.js',
  '/enterprise-shell.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - CORRIGIDO
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. SEGURANÇA: Bloqueia POST/PATCH/PUT/DELETE do Cache (Correção do seu erro)
  if (request.method !== 'GET') {
    return; // Deixa o navegador/servidor lidar com a requisição normalmente
  }

  // 2. API: Sempre busca na rede primeiro
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // 3. NAVEGAÇÃO (Páginas HTML): Network-first com fallback para cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Em caso de falha de rede (offline), tenta buscar do cache
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/'); // Retorna pro início se não achar
          });
        })
    );
    return;
  }

  // 4. ESTÁTICOS (CSS, JS, Imagens): Cache-first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(request)
          .then((networkResponse) => {
            // Faz cache dinâmico apenas de requisições válidas da própria origem (evita estourar limite do cache)
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === 'basic'
            ) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Tratamento genérico caso o recurso não esteja em cache e não haja rede
          })
      );
    })
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || 'Nova notificação',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
  };
  event.waitUntil(self.registration.showNotification(data.title || 'LDFP Igreja', options));
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
