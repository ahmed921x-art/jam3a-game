/* جمعة — Service Worker للعمل بدون اتصال */
const CACHE = "jam3a-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./landing.css",
  "./questions.js",
  "./questions-extra.js",
  "./questions-kuwait.js",
  "./questions-pack2.js",
  "./i18n.js",
  "./firebase-config.js",
  "./auth.js",
  "./sounds.js",
  "./effects.js",
  "./game.js",
  "./manifest.json",
  "./icon.svg",
  "./og-image.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return (
        cached ||
        fetch(e.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached)
      );
    })
  );
});
