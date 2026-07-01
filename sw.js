// こどもカレンダー Service Worker
// ・アプリ本体（HTML）: ネットワーク優先 → 修正がすぐ反映され、オフライン時はキャッシュで起動
// ・アイコン/フォント: キャッシュ優先＋裏で更新 → 2回目以降は高速・オフラインOK
// ・天気API: 常にネットワーク（オフライン時はアプリ側が前回の天気を表示）
const CACHE = 'kids-calendar-v1';
const ASSETS = ['./', './index.html', './icon.png', './icon-512.png', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // 天気APIはキャッシュしない
  if (url.hostname.includes('open-meteo.com')) return;

  // ページ本体：ネットワーク優先、失敗したらキャッシュ（オフライン起動）
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return r;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // その他（アイコン・マニフェスト・Webフォント）：キャッシュ優先＋バックグラウンド更新
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request)
        .then(r => {
          const cacheable = r && r.status === 200 &&
            (url.origin === self.location.origin ||
             url.hostname.includes('fonts.googleapis.com') ||
             url.hostname.includes('fonts.gstatic.com'));
          if (cacheable) {
            const copy = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return r;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
