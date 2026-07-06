/**
 * Floss-Cake 实验平台 — Service Worker
 * 首次访问：预缓存全部 196 个音视频资源
 * 后续访问：直接从缓存读取，无需重新下载
 */
const CACHE_NAME = 'floss-cake-v3';
const ASSETS = [
  // === 午餐音频 (diningHall) ===
  'assets/audio/diningHall/1-1.mp3', 'assets/audio/diningHall/1-2.mp3', 'assets/audio/diningHall/1-3.mp3',
  'assets/audio/diningHall/2-1.mp3', 'assets/audio/diningHall/2-2.mp3', 'assets/audio/diningHall/2-3.mp3',
  'assets/audio/diningHall/3-1.mp3', 'assets/audio/diningHall/3-2.mp3', 'assets/audio/diningHall/3-3.mp3',
  'assets/audio/diningHall/5-1.mp3', 'assets/audio/diningHall/5-2.mp3', 'assets/audio/diningHall/5-3.mp3',
  'assets/audio/diningHall/6-1.mp3', 'assets/audio/diningHall/6-2.mp3', 'assets/audio/diningHall/6-3.mp3',
  'assets/audio/diningHall/7-1.mp3', 'assets/audio/diningHall/7-2.mp3', 'assets/audio/diningHall/7-3.mp3',
  'assets/audio/diningHall/8-1.mp3', 'assets/audio/diningHall/8-2.mp3', 'assets/audio/diningHall/8-3.mp3',
  'assets/audio/diningHall/9-1.mp3', 'assets/audio/diningHall/9-2.mp3', 'assets/audio/diningHall/9-3.mp3',
  'assets/audio/diningHall/Scenario3.mp4.mp3',

  // === 游泳课音频 (swim) ===
  'assets/audio/swim/1_1.wav','assets/audio/swim/1_2.wav','assets/audio/swim/1_3.wav',
  'assets/audio/swim/2_1.wav','assets/audio/swim/2_2.wav','assets/audio/swim/2_3.wav',
  'assets/audio/swim/3_1.wav','assets/audio/swim/3_2.wav','assets/audio/swim/3_3.wav',
  'assets/audio/swim/4_1.wav','assets/audio/swim/4_2.wav','assets/audio/swim/4_3.wav',
  'assets/audio/swim/5_1.wav','assets/audio/swim/5_2.wav','assets/audio/swim/5_3.wav',
  'assets/audio/swim/6_1.wav','assets/audio/swim/6_2.wav','assets/audio/swim/6_3.wav',
  'assets/audio/swim/7_1.wav','assets/audio/swim/7_2.wav','assets/audio/swim/7_3.wav',
  'assets/audio/swim/8_1.wav','assets/audio/swim/8_2.wav','assets/audio/swim/8_3.wav',
  'assets/audio/swim/9_1.wav','assets/audio/swim/9_2.wav','assets/audio/swim/9_3.wav',
  'assets/audio/swim/q1.wav','assets/audio/swim/q2.wav','assets/audio/swim/q3.wav',
  'assets/audio/swim/q4.wav','assets/audio/swim/q5.wav','assets/audio/swim/q6.wav',

  // === 校运会音频 (playground) ===
  'assets/audio/playground/1-1.mp3','assets/audio/playground/1-2.mp3','assets/audio/playground/1-3.mp3',
  'assets/audio/playground/2-1.mp3','assets/audio/playground/2-2.mp3','assets/audio/playground/2-3.mp3',
  'assets/audio/playground/3-1.mp3','assets/audio/playground/3-2.mp3','assets/audio/playground/3-3.mp3',
  'assets/audio/playground/4-1.mp3','assets/audio/playground/4-2.mp3','assets/audio/playground/4-3.mp3',
  'assets/audio/playground/5-1.mp3','assets/audio/playground/5-2.mp3','assets/audio/playground/5-3.mp3',
  'assets/audio/playground/6-1.mp3','assets/audio/playground/6-2.mp3','assets/audio/playground/6-3.mp3',
  'assets/audio/playground/7-1.mp3','assets/audio/playground/7-2.mp3','assets/audio/playground/7-3.mp3',
  'assets/audio/playground/8-1.mp3','assets/audio/playground/8-2.mp3','assets/audio/playground/8-3.mp3',
  'assets/audio/playground/9-1.mp3','assets/audio/playground/9-2.mp3','assets/audio/playground/9-3.mp3',

  // === 重返校园音频 (brokeleg) ===
  'assets/audio/brokeleg/1-1.mp3','assets/audio/brokeleg/1-2.mp3','assets/audio/brokeleg/1-3.mp3',
  'assets/audio/brokeleg/1-3.wav',
  'assets/audio/brokeleg/2-1.mp3','assets/audio/brokeleg/2-2.mp3','assets/audio/brokeleg/2-3.mp3',
  'assets/audio/brokeleg/3-1.mp3','assets/audio/brokeleg/3-2.mp3','assets/audio/brokeleg/3-3.mp3',
  'assets/audio/brokeleg/4-1.mp3','assets/audio/brokeleg/4-2.mp3','assets/audio/brokeleg/4-3.mp3',
  'assets/audio/brokeleg/5-1.mp3','assets/audio/brokeleg/5-2.mp3','assets/audio/brokeleg/5-3.mp3',
  'assets/audio/brokeleg/6-1.mp3','assets/audio/brokeleg/6-2.mp3','assets/audio/brokeleg/6-3.mp3',
  'assets/audio/brokeleg/7-1.mp3','assets/audio/brokeleg/7-2.mp3','assets/audio/brokeleg/7-3.mp3',
  'assets/audio/brokeleg/8-1.mp3','assets/audio/brokeleg/8-2.mp3','assets/audio/brokeleg/8-3.mp3',
  'assets/audio/brokeleg/9-1.mp3','assets/audio/brokeleg/9-2.mp3','assets/audio/brokeleg/9-3.mp3',

  // === 切换图片 ===
  'assets/video/diningHall/小华.png','assets/video/diningHall/小哲.png',
  'assets/video/playground/小星.png',

  // === 午餐视频 ===
  'assets/video/diningHall/Scenario1.mp4','assets/video/diningHall/Scenario2.mp4',
  'assets/video/diningHall/Scenario3.mp4','assets/video/diningHall/Scenario4.mp4',
  'assets/video/diningHall/Scenario5.mp4','assets/video/diningHall/Scenario6.mp4',
  'assets/video/diningHall/Scenario7.mp4','assets/video/diningHall/Scenario8.mp4',
  'assets/video/diningHall/Scenario9.mp4','assets/video/diningHall/Scenario10.mp4',

  // === 游泳课视频 ===
  'assets/video/swim/Scenario1.mp4','assets/video/swim/Scenario2.mp4',
  'assets/video/swim/Scenario3.mp4','assets/video/swim/Scenario4.mp4',
  'assets/video/swim/Scenario5.mp4','assets/video/swim/Scenario6.mp4',
  'assets/video/swim/Scenario7.mp4','assets/video/swim/Scenario8.mp4',
  'assets/video/swim/Scenario9.mp4','assets/video/swim/Scenario10.mp4',

  // === 校运会视频 ===
  'assets/video/playground/Scenario1.mp4','assets/video/playground/Scenario2.mp4',
  'assets/video/playground/Scenario3.mp4','assets/video/playground/Scenario4.mp4',
  'assets/video/playground/Scenario5.mp4','assets/video/playground/Scenario6.mp4',
  'assets/video/playground/Scenario7.mp4','assets/video/playground/Scenario8.mp4',
  'assets/video/playground/Scenario9.mp4','assets/video/playground/Scenario10.mp4',

  // === 重返校园视频 ===
  'assets/video/brokeleg/Scenario1.mp4','assets/video/brokeleg/Scenario2.mp4',
  'assets/video/brokeleg/Scenario3.mp4','assets/video/brokeleg/Scenario4.mp4',
  'assets/video/brokeleg/Scenario5.mp4','assets/video/brokeleg/Scenario6.mp4',
  'assets/video/brokeleg/Scenario7.mp4','assets/video/brokeleg/Scenario8.mp4',
  'assets/video/brokeleg/Scenario9.mp4','assets/video/brokeleg/Scenario10.mp4',
];

// ============ Install: pre-cache all assets ============
self.addEventListener('install', event => {
  console.log('[SW] Install — caching', ASSETS.length, 'assets');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      let cached = 0;
      const total = ASSETS.length;

      for (const url of ASSETS) {
        try {
          const resp = await fetch(url, { mode: 'no-cors', cache: 'reload' });
          if (resp.ok || resp.type === 'opaque') {
            await cache.put(url, resp);
          }
        } catch (_) { /* skip missing files */ }
        cached++;
        // Report progress to page
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        clients.forEach(c => c.postMessage({ type: 'sw-progress', cached, total }));
      }

      console.log('[SW] Install complete:', cached, '/', total);
      await self.skipWaiting();
    })()
  );
});

// ============ Activate: clean old caches ============
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  event.waitUntil(self.clients.claim());
});

// ============ Fetch: serve from cache, live-cache misses ============
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Only intercept asset files
  if (!url.pathname.startsWith('/assets')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      // Not yet cached — fetch and cache for next time
      return fetch(event.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return resp;
      });
    })
  );
});
