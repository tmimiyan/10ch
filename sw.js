// Offline shell. Push notifications are handled by onesignal/OneSignalSDKWorker.js.
const CACHE_NAME = "10ch-v11";
const ASSETS = ["./", "./index.html", "./login.html", "./thread.html", "./css/style.css", "./js/app.js", "./js/auth.js", "./js/thread.js", "./js/theme.js", "./js/util.js", "./js/user.js", "./js/media.js", "./js/notifications-mobile.js", "./js/notification-devices.js", "./js/notify-api-mobile.js", "./manifest.json"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => { if (event.request.method !== "GET") return; event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))); });
