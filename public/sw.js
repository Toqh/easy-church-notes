/* Cache only public assets. Notes, HTML documents, account requests and Bible APIs stay network-only. */
const SHELL_CACHE="easychurchnotes-shell-v1";
const ASSET_CACHE="easychurchnotes-assets-v1";
const SHELL=["/offline.html","/favicon.svg","/icons/icon-192.png","/icons/icon-512.png","/icons/icon-maskable-512.png","/apple-touch-icon.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
  const keep=new Set([SHELL_CACHE,ASSET_CACHE]);
  await Promise.all((await caches.keys()).filter(key=>key.startsWith("easychurchnotes-")&&!keep.has(key)).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
  if(request.mode==="navigate"){
    event.respondWith(fetch(request).catch(async()=> (await caches.match("/offline.html"))||new Response("Reconnect to open EasyChurchNotes.",{status:503,headers:{"Content-Type":"text/plain"}})));
    return;
  }
  if(!SHELL.includes(url.pathname)&&!url.pathname.startsWith("/_next/static/"))return;
  event.respondWith((async()=>{
    const cached=await caches.match(request);if(cached)return cached;
    const response=await fetch(request);
    if(response.ok&&!/no-store|private/i.test(response.headers.get("cache-control")||"")){
      const copy=response.clone();
      event.waitUntil((async()=>{const cache=await caches.open(ASSET_CACHE);await cache.put(request,copy);const keys=await cache.keys();await Promise.all(keys.slice(0,Math.max(0,keys.length-60)).map(key=>cache.delete(key)));})());
    }
    return response;
  })());
});
