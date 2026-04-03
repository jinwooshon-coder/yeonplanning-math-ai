const CACHE_NAME = 'supulai-cache-v14';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
    'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
  ];

// 설치: 정적 파일 캐시
self.addEventListener('install', (e) => {
    e.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
        );
    self.skipWaiting();
});

// 활성화: 이전 캐시 삭제
self.addEventListener('activate', (e) => {
    e.waitUntil(
          caches.keys().then((keys) =>
                  Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
                                 )
        );
    self.clients.claim();
});

// 요청 처리
self.addEventListener('fetch', (e) => {
    // API 요청은 항상 네트워크
                        if (e.request.url.includes('/api/') || e.request.url.includes('/.netlify/')) {
                              return;
                        }

                        // HTML은 네트워크 우선 (항상 최신 버전 제공)
                        if (e.request.mode === 'navigate' || e.request.url.endsWith('.html')) {
                              e.respondWith(
                                      fetch(e.request)
                                        .then((res) => {
                                   