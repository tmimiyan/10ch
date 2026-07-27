// Minimal offline shell cache. Firestore data still requires a network connection.
const CACHE_NAME = "10ch-v2";
const ASSETS = ["./", "./index.html", "./login.html", "./thread.html", "./css/style.css", "./js/app.js", "./js/auth.js", "./js/thread.js", "./js/theme.js", "./js/util.js", "./js/media.js", "./manifest.webmanifest"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => { if (event.request.method !== "GET") return; event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))); });
