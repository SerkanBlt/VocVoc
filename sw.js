/* Bump VERSION whenever any app-shell byte changes; deploy the entire folder atomically. */
'use strict';
const VERSION='1.0.0';
const PREFIX='vocvoc-shell-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=PREFIX+VERSION;
const ASSETS=['./','./index.html','./storage.js','./pwa.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/apple-touch-icon.png'];
const shellUrl=new URL('./index.html',self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  // Complete shell required before install succeeds. No unconditional skipWaiting.
  await cache.addAll(ASSETS.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url),scope=new URL(self.registration.scope);
  // Never intercept AI, secrets, external resources, POSTs or unrelated same-origin URLs.
  if(req.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  if(req.mode==='navigate'){
    // Installed shell is internally version-consistent; SW updates provide newer HTML.
    if(url.pathname!==scope.pathname&&url.pathname!==new URL(shellUrl).pathname)return;
    event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(shellUrl)||fetch(req);})());return;
  }
  if(!ASSETS.some(path=>new URL(path,scope).pathname===url.pathname))return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(url.origin+url.pathname)||fetch(req);})());
});
