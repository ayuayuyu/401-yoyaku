// 401予約管理システム のサービスワーカー。
// 目的: PWA としてインストール可能にし、オフライン時に最低限の表示を返す。
// 方針: API/認証はキャッシュせず常にネットワークへ。静的アセットはキャッシュ優先、
//       ページ遷移はネットワーク優先＋失敗時にオフラインページへフォールバック。

const CACHE = 'yoyaku-cache-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = ['/', OFFLINE_URL, '/manifest.webmanifest', '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 別オリジン (バックエンド API / Google OAuth 等) はそのまま通す。
  if (url.origin !== self.location.origin) return;

  // 同一オリジンでも API・認証は動的なのでキャッシュせずネットワークへ。
  if (
    url.pathname.startsWith('/api') ||
    url.pathname === '/login' ||
    url.pathname === '/callback'
  ) {
    return;
  }

  // ページ遷移: ネットワーク優先。失敗時はキャッシュ→オフラインページ。
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match(request)
          .then((cached) => cached || caches.match(OFFLINE_URL)),
      ),
    );
    return;
  }

  // 静的アセット: キャッシュ優先、無ければ取得してキャッシュに保存。
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
