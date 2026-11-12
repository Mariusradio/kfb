// Offline copy of the KFB tablet page (2026-11-12: CACHE FIRST).
// The page ALWAYS opens at once from the copy kept in the tablet - with or without Wi-Fi / internet.
// Before: it asked GitHub first and used the copy only when that failed; with Wi-Fi on but no internet
// (or a weak signal) the app stayed on its icon screen, as if it needed internet.
// With internet, a newer version is downloaded in the background and used at the NEXT opening.
const CACHE = "kfb-tableta-v13";
const FISIERE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FISIERE.map(f => new Request(f, {cache: "reload"}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

function anuntaVersiuneNoua() {
  self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage("versiune_noua")));
}

// background: ask GitHub for the file ("no-cache" = not the browser's 10-min copy); keep it if it changed
function actualizeaza(cerere, copieVeche) {
  return fetch(new Request(cerere.url, {cache: "no-cache"})).then(r => {
    if (!r || !r.ok) return r;
    const deSalvat = r.clone();
    const html = cerere.mode === "navigate" || /\/(index\.html)?$/.test(new URL(cerere.url).pathname);
    const comparat = (html && copieVeche)
      ? Promise.all([r.clone().text(), copieVeche.clone().text()]).then(([nou, vechi]) => {
          if (nou !== vechi) anuntaVersiuneNoua();
        }).catch(() => {})
      : Promise.resolve();
    return comparat
      .then(() => caches.open(CACHE))
      .then(c => c.put(cerere, deSalvat))
      .then(() => r, () => r);
  }).catch(() => null);                      // no internet: nothing to do, the copy was already used
}

self.addEventListener("fetch", e => {
  const cerere = e.request;
  if (cerere.method !== "GET" || new URL(cerere.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(cerere, {ignoreSearch: true}).then(copie => {
      if (copie) {
        e.waitUntil(actualizeaza(cerere, copie));   // in the background, the page does not wait for it
        return copie;
      }
      // not kept yet (first opening): from the internet; without internet the main page as a last resort
      return actualizeaza(cerere, null).then(r => r || caches.match("index.html", {ignoreSearch: true}))
        .then(r => r || Response.error());
    })
  );
});
