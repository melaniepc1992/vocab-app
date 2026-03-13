const CACHE_NAME = 'vocab-app-v1';
const BASE_PATH = '/vocab-app'; // CAMBIA ESTO por el nombre de tu repo
const urlsToCache = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/app.js`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icon-192.png`,
  `${BASE_PATH}/icon-512.png`
];

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BACKUP_ALARM_KEY = 'next_backup_notification';
const KV_CACHE = 'sw-kv-store'; // Cache separado para datos internos del SW

// ─── INSTALL ────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cacheando archivos');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('Error al cachear:', err))
  );
  self.skipWaiting();
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Eliminar caches viejos EXCEPTO el KV store interno
          if (cacheName !== CACHE_NAME && cacheName !== KV_CACHE) {
            console.log('Eliminando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ─── FETCH (modo offline) ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
      .catch(() => {
        return caches.match(`${BASE_PATH}/index.html`);
      })
  );
});

// ─── MENSAJES DESDE LA APP ───────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'SCHEDULE_BACKUP_NOTIFICATION') {
    scheduleBackupNotification();
  }
  if (event.data.type === 'BACKUP_DONE') {
    rescheduleAfterBackup();
  }
});

// ─── PERIODIC SYNC (browsers compatibles) ────────────────────────────────────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'backup-reminder') {
    event.waitUntil(checkAndNotify());
  }
});

// ─── CLIC EN LA NOTIFICACIÓN ─────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(BASE_PATH) || client.url.endsWith('/')) {
            client.focus();
            client.postMessage({ type: 'OPEN_EXPORT_MENU' });
            return;
          }
        }
        return clients.openWindow(`${BASE_PATH}/`);
      })
    );
  }
});

// ─── FUNCIONES DE NOTIFICACIÓN ───────────────────────────────────────────────
async function checkAndNotify() {
  const now = Date.now();
  const nextNotif = await getStoredValue(BACKUP_ALARM_KEY);

  if (!nextNotif || now >= parseInt(nextNotif)) {
    await showBackupNotification();
    await setStoredValue(BACKUP_ALARM_KEY, String(now + ONE_WEEK_MS));
  }
}

async function scheduleBackupNotification() {
  const existing = await getStoredValue(BACKUP_ALARM_KEY);
  if (!existing) {
    await setStoredValue(BACKUP_ALARM_KEY, String(Date.now() + ONE_WEEK_MS));
    console.log('[SW] Recordatorio de backup programado para dentro de 7 días');
  }
}

async function rescheduleAfterBackup() {
  await setStoredValue(BACKUP_ALARM_KEY, String(Date.now() + ONE_WEEK_MS));
  console.log('[SW] Backup realizado — próximo recordatorio en 7 días');
}

async function showBackupNotification() {
  await self.registration.showNotification('📚 Mi Vocabulario — Recordatorio de backup', {
    body: 'Pasó una semana desde tu último backup. ¡Exportá tus palabras para no perder tu progreso!',
    icon: `${BASE_PATH}/icon-192.png`,
    badge: `${BASE_PATH}/icon-192.png`,
    tag: 'backup-reminder',
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'open', title: '📥 Ir a exportar' },
      { action: 'dismiss', title: 'Más tarde' }
    ]
  });
}

// ─── KV STORE INTERNO ────────────────────────────────────────────────────────
// Usa un cache separado (KV_CACHE) para no interferir con el cache de la app
async function getStoredValue(key) {
  try {
    const cache = await caches.open(KV_CACHE);
    const response = await cache.match(key);
    if (!response) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function setStoredValue(key, value) {
  try {
    const cache = await caches.open(KV_CACHE);
    await cache.put(key, new Response(value));
  } catch (e) {
    console.error('[SW] Error guardando valor:', e);
  }
}
