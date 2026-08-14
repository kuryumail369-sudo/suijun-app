// SiteLogger（水準測量 現場野帳）— Service Worker
// v2: ネットワーク優先＋オフライン時はキャッシュにフォールバック。
// 旧キャッシュ(suijun-v1)は活性化時に破棄する。
const CACHE = 'sitelogger-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './manual.html',
  './terms.html',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// インストール時にアプリ本体をキャッシュ
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// 古いキャッシュ（旧sw.jsが誤って作成したもの含む）を削除し、即座に制御を引き継ぐ
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// GETリクエストのみ対象。ネットワーク優先で常に最新版を取得し、
// オフライン時のみキャッシュから返す（現場での電波なし環境に対応）。
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // 他オリジンのリクエスト（Google Analytics・Anthropic API中継・ライセンス検証・
  // Stripe決済など）はService Workerで扱わずブラウザに任せる。
  // ここで横取りしてindex.htmlを誤って返すと、スクリプト読み込みが構文エラーになるため注意。
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, resClone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => {
        if (cached) return cached;
        // ページ本体のナビゲーションだけ、オフライン時はキャッシュ済みindex.htmlを返す
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }))
  );
});
