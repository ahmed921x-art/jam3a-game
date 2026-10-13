/* بايو: cache only this GitHub Pages scope; refresh assets online. */
const CACHE = "bio-v5";
const ASSETS = [
  "./", "./index.html", "./style.css", "./landing.css",
  "./questions.js", "./questions-extra.js", "./questions-kuwait.js", "./questions-pack2.js",
  "./questions-bio.js",
  "./i18n.js", "./firebase-config.js", "./auth.js", "./sounds.js", "./effects.js",
  "./catalog.js", "./game-logic.js", "./game.js", "./bio-ui.js", "./manifest.json", "./icon.svg", "./og-image.svg",
  "./assets/logo-full.png", "./assets/logo-mark.png", "./assets/favicon-48.png",
  "./assets/icon-192.png", "./assets/icon-512.png", "./assets/icon-maskable-512.png", "./assets/apple-touch-icon.png",
];
const FIREBASE_SDK = ["app", "auth", "firestore"].map((name) => `https://www.gstatic.com/firebasejs/10.14.1/firebase-${name}-compat.js`);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    await cache.addAll(ASSETS);
    await Promise.allSettled(FIREBASE_SDK.map(async (url) => {
      const response = await fetch(url, { mode: "no-cors" });
      await cache.put(url, response);
    }));
  }).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE && /^(bio-|jam3a-v)/.test(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !FIREBASE_SDK.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (FIREBASE_SDK.includes(url.href)) {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      cache.put(request, response.clone()).catch(() => {});
      return response;
    }
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch {
      return await cache.match(request) || (request.mode === "navigate" ? await cache.match("./index.html") : Response.error());
    }
  })());
});
