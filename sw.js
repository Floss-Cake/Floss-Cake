/**
 * Floss-Cake 实验平台 — Service Worker
 * 策略：运行时缓存。第一次播放时缓存，第二次直接从缓存读取。
 * 不做预安装（避免首次打开等几分钟）。
 */
const CACHE_NAME = 'floss-cake-v3';

// ============ Install: 不做任何事，避免阻塞 ============
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ============ Activate: 清理旧缓存 ============
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ============ Fetch: 运行时缓存 assets ============
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!url.pathname.includes('/assets/')) return;

  // 只缓存 mp4 / mp3 / wav / png
  const ext = url.pathname.split('.').pop().toLowerCase();
  if (!['mp4', 'mp3', 'wav', 'png', 'jpg'].includes(ext)) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (resp.ok || resp.status === 0) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return resp;
      });
    })
  );
});
