/* LinsoftPhone OS - service worker (offline rezim) */
const CACHE = "linsoftos-v7";
const SOUBORY = [
  "./", "index.html", "app.css", "core.js", "ikony.js", "system.js", "start.js", "manifest.webmanifest",
  "apps/telefon.js", "apps/zpravy.js", "apps/kontakty.js", "apps/kalkulacka.js", "apps/hodiny.js", "apps/kalendar.js", "apps/poznamky.js", "apps/galerie.js", "apps/fotak.js", "apps/terminal.js", "apps/prehliadac.js", "apps/obchod.js", "apps/nastaveni.js",
  "icons/logo.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SOUBORY)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) =>
      Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

/* nejdriv sit (at se nova verze dostane do telefonu), bez signalu cache */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  /* /api/ = zive udaje telefonu (LinsoftPhone OS), nikdy z cache */
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.indexOf("/api/") === 0) return;
  e.respondWith(
    fetch(req)
      .then((r) => {
        if (r.ok) { const kopie = r.clone(); caches.open(CACHE).then((c) => c.put(req, kopie)); }
        return r;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./")))
  );
});

/* klepnuti na notifikaci telefonu otevre LinsoftOS */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((okna) =>
      okna.length ? okna[0].focus() : self.clients.openWindow("./"))
  );
});
