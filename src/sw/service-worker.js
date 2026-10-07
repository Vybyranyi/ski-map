/* Service worker: офлайн-режим для застосунку в горах, де нема зв'язку.
 *
 * `__BUILD__` підставляє маршрут /sw.js під час збірки, тож кожен деплой дає новий SW і новий кеш.
 *
 * Стратегії:
 *  - сторінка: мережа з таймаутом 3 с, інакше кеш (слабкий сигнал гірший за повну відсутність);
 *  - /_next/static/*: спершу кеш (файли з хешем у назві не змінюються);
 *  - карта, шрифт, іконки: з кешу, оновлюємо у фоні;
 *  - /api/*: не чіпаємо (останній статус зберігає сам застосунок).
 */

const BUILD = "__BUILD__";
const APP_CACHE = `app-${BUILD}`; // сторінка і хешовані чанки цієї версії
const ASSET_CACHE = "assets-v1"; // великі файли без хешу (карта 1,2 МБ) — не перекачуємо кожен деплой
const NAVIGATE_TIMEOUT = 3000;

const STABLE_ASSETS = [
  "/map/background.webp",
  "/map/map-font.ttf",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const app = await caches.open(APP_CACHE);

      // сторінка + усі чанки, на які вона посилається, щоб офлайн працювало одразу після встановлення
      const res = await fetch("/", { cache: "reload" });
      if (!res.ok) throw new Error(`precache /: HTTP ${res.status}`);
      const html = await res.clone().text();
      await app.put("/", res);
      const chunks = new Set(html.match(/\/_next\/static\/[^"'\\\s)<>]+/g) ?? []);
      await Promise.all(
        [...chunks].map(async (url) => {
          try {
            const r = await fetch(url);
            if (r.ok) await app.put(url, r);
          } catch {
            /* дозавантажиться під час роботи */
          }
        }),
      );

      const assets = await caches.open(ASSET_CACHE);
      await Promise.all(
        STABLE_ASSETS.map(async (url) => {
          if (await assets.match(url)) return;
          try {
            const r = await fetch(url);
            if (r.ok) await assets.put(url, r);
          } catch {
            /* повторимо при першому запиті */
          }
        }),
      );
    })(),
  );
  // skipWaiting не викликаємо: нова версія активується, коли закриються всі вкладки
  // (або за командою зі сторінки, див. SKIP_WAITING), щоб не підмінити код під відкритим застосунком.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== APP_CACHE && key !== ASSET_CACHE) await caches.delete(key);
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(navigate(req));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
  } else if (
    url.pathname.startsWith("/map/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(staleWhileRevalidate(event, req));
  }
});

async function navigate(req) {
  const cache = await caches.open(APP_CACHE);
  const network = fetch(req).then(async (res) => {
    if (res.ok) await cache.put("/", res.clone());
    return res;
  });
  network.catch(() => {}); // якщо програємо гонку з таймаутом, не лишаємо необроблену помилку

  try {
    return await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAVIGATE_TIMEOUT)),
    ]);
  } catch {
    return (await cache.match("/")) ?? (await caches.match("/")) ?? Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(APP_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then(async (res) => {
      if (res.ok) await cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  return (await refresh) ?? Response.error();
}
