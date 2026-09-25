// 改了 index.html 或其他檔案後，把版本號加 1，手機才會拿到新版。
const VERSION = "v1";
const CACHE = `quota-ledger-${VERSION}`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon.svg"
];
// 外部元件另外快取；拿不到也不影響安裝
const EXTRA = ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL).then(() => Promise.all(EXTRA.map(u => cache.add(u).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("quota-ledger-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  // 頁面：先上網拿最新版，離線時用快取
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); return res; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // 其他檔案（圖示、字型、Excel 元件）：先用快取，背景更新
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => { if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
