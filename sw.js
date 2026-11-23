const C="hisab135-cache",F=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>Promise.allSettled(F.map(f=>c.add(f)))).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// Open instantly from the saved copy, then refresh the copy in the background (no waiting on a slow network).
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin)return;
 e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>{
  const net=fetch(e.request).then(n=>{if(n&&n.ok){const c=n.clone();caches.open(C).then(x=>x.put(e.request,c))}return n}).catch(()=>null);
  if(hit){e.waitUntil(net);return hit}
  return net.then(n=>n||caches.match("index.html")||caches.match("./"))}))});
