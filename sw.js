/* Bump VERSION whenever any app-shell byte (or this file) changes; deploy the entire folder atomically.
   The same number lives in index.html (<meta name="vocvoc-shell">) and tests/shell-lock.json: `node tools/lock-shell.js` records it. */
'use strict';
const VERSION='1.0.10';
const PREFIX='vocvoc-shell-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=PREFIX+VERSION;
const ASSETS=['./','./index.html','./storage.js','./a11y.js','./pwa.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/apple-touch-icon.png'];
const scopeUrl=new URL(self.registration.scope).href;
const shellUrl=new URL('./index.html',self.registration.scope).href;
const SHELL_META=/<meta\s+name="vocvoc-shell"\s+content="([^"]+)"/;
// Fetch the whole shell into this version's cache. All-or-nothing: a failed fetch, or HTML that does not
// belong to this worker version (partial/skewed deploy), leaves no cache behind, so a later attempt starts clean.
async function precache(){
  const cache=await caches.open(CACHE);
  try{
    await cache.addAll(ASSETS.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})));
    for(const url of [scopeUrl,shellUrl]){
      const html=await (await cache.match(url)).text();
      if((html.match(SHELL_META)||[])[1]!==VERSION)throw new Error('App shell does not match worker version '+VERSION);
    }
  }catch(error){await caches.delete(CACHE);throw error;}
}
let repair=null;
self.addEventListener('install',event=>event.waitUntil(
  // Complete shell required before install succeeds. No unconditional skipWaiting.
  precache()
));
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
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE),cached=await cache.match(shellUrl);
      if(cached)return cached;
      // The browser dropped this cache (storage pressure): serve from the network and rebuild it, once.
      const response=await fetch(req);
      repair=repair||precache().catch(()=>{}).finally(()=>{repair=null;});event.waitUntil(repair);
      return response;
    })());return;
  }
  if(!ASSETS.some(path=>new URL(path,scope).pathname===url.pathname))return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(url.origin+url.pathname)||fetch(req);})());
});
