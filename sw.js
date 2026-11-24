// 離線快取：素材（圖、音、模型、圖集 json）先用快取、背景更新；帶 ?v= 的程式直接用快取；頁面與其他請求照常走網路
const C = 'edo-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || r.headers.has('range')) return;
  const asset = /\/(img|audio|vendor)\//.test(u.pathname) && /\.(png|webp|jpe?g|glb|mp3|ogg|m4a|json|js)$/.test(u.pathname);
  const ver = /\.js$/.test(u.pathname) && u.searchParams.has('v');
  if (!asset && !ver) return;
  e.respondWith(caches.open(C).then(async c => {
    const hit = await c.match(r);
    const net = fetch(r).then(res => { if (res.ok && res.status === 200) c.put(r, res.clone()); return res; });
    if (hit) { if (!ver) e.waitUntil(net.catch(() => { })); return hit; }
    return net;
  }));
});
