// OJO: el navegador detecta actualizaciones del service worker comparando los
// BYTES de este archivo, no lo que importa ni el contenido de otros archivos.
// Por eso la versión va escrita literal aquí (debe coincidir con APP_VERSION
// en js/config.js) y no vía importScripts: así cualquier bump de versión
// cambia este archivo y el navegador sí dispara la actualización.
const APP_VERSION = '1.10.0';
const CACHE_NAME = 'lavadero-cache-v' + APP_VERSION;
const APP_SHELL = [
  './login.html',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/supabaseClient.js',
  './js/auth.js',
  './js/app.js',
  './js/toast.js',
  './js/pwaUpdate.js',
  './js/vendor/jsQR.js',
  './js/qrScanner.js',
  './js/scan.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // No interceptar llamadas a Supabase ni a otros orígenes (siempre requieren red)
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
