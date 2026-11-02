'use strict';
/* AI data layer (no DOM): the inbox, the log of mistakes and the client of the AI service.
   The app holds no API key. Every request goes to ./api/ai on this origin (functions/api/ai.js): the key lives on that server, the page only sends a task
   and a small payload. The inbox and the mistake log are their own IndexedDB database (VOCVOC_INBOX), apart from the word data (VOCVOC_PWA) and the
   backup: they are never part of an export. */
(function(root){
  const DB_NAME='VOCVOC_INBOX',DB_VERSION=1,MSG='messages',MIS='mistakes',ENDPOINT='./api/ai',TIMEOUT_MS=45000;
  const MAX_MESSAGES=200,MAX_MISTAKES=500,AREAS=Object.freeze(['chat','sentence','story']);
  let dbPromise=null;
  const wrap=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('aborted'));});
  function open(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const request=root.indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(MSG))db.createObjectStore(MSG,{keyPath:'id'}).createIndex('createdAt','createdAt');
        if(!db.objectStoreNames.contains(MIS))db.createObjectStore(MIS,{keyPath:'id'}).createIndex('at','at');
      };
      request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();dbPromise=null;};resolve(request.result);};
      request.onerror=()=>{dbPromise=null;reject(request.error);};
    });
    return dbPromise;
  }
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const changed=()=>{try{root.dispatchEvent?.(new CustomEvent('vocvoc-inbox-changed'));}catch(_){}};
  const clip=(value,max)=>String(value??'').slice(0,max);

  /* ---------- inbox ---------- */
  // kind: 'chat' (evaluation of a conversation), 'report' (analysis of mistakes), 'story' (a story kept for later). body is what the service returned.
  async function addMessage({kind,title,body}){
    const db=await open(),message={id:uid(),kind:clip(kind,20),title:clip(title,120),body,createdAt:new Date().toISOString(),read:false};
    const tx=db.transaction(MSG,'readwrite'),store=tx.objectStore(MSG);
    store.put(message);
    const all=await wrap(store.getAll());                                          // bounded: the oldest messages go first
    if(all.length>MAX_MESSAGES)all.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(0,all.length-MAX_MESSAGES).forEach(old=>store.delete(old.id));
    await done(tx);changed();return message;
  }
  async function listMessages(){
    const db=await open();
    return (await wrap(db.transaction(MSG).objectStore(MSG).getAll())).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }
  async function unreadCount(){return (await listMessages()).filter(m=>!m.read).length;}
  async function markRead(id,read=true){
    const db=await open(),tx=db.transaction(MSG,'readwrite'),store=tx.objectStore(MSG),message=await wrap(store.get(id));
    if(!message)return;
    message.read=read;store.put(message);await done(tx);changed();
  }
  async function removeMessage(id){const db=await open(),tx=db.transaction(MSG,'readwrite');tx.objectStore(MSG).delete(id);await done(tx);changed();}
  async function clearInbox(){const db=await open(),tx=db.transaction(MSG,'readwrite');tx.objectStore(MSG).clear();await done(tx);changed();}

  /* ---------- mistakes ---------- */
  // One record per mistake: where it was made (area), what the user wrote (said), the better form, a short note and the word it was about.
  // `reported` turns true once an analysis has taken it in, so the next report only looks at new ones.
  async function logMistakes(area,items){
    if(!AREAS.includes(area))throw new Error('unknown area');
    const list=(items||[]).filter(item=>item&&String(item.said||'').trim()&&String(item.better||'').trim());
    if(!list.length)return 0;
    const db=await open(),tx=db.transaction(MIS,'readwrite'),store=tx.objectStore(MIS),at=new Date().toISOString();
    for(const item of list)store.put({id:uid(),at,area,said:clip(item.said,300),better:clip(item.better,300),note:clip(item.note,300),word:clip(item.word,80),reported:false});
    const all=await wrap(store.getAll());
    if(all.length>MAX_MISTAKES)all.sort((a,b)=>a.at.localeCompare(b.at)).slice(0,all.length-MAX_MISTAKES).forEach(old=>store.delete(old.id));
    await done(tx);return list.length;
  }
  async function listMistakes({unreportedOnly=false}={}){
    const db=await open(),all=await wrap(db.transaction(MIS).objectStore(MIS).getAll());
    return all.filter(m=>!unreportedOnly||!m.reported).sort((a,b)=>a.at.localeCompare(b.at));
  }
  async function markReported(ids){
    const set=new Set(ids),db=await open(),tx=db.transaction(MIS,'readwrite'),store=tx.objectStore(MIS);
    for(const m of await wrap(store.getAll()))if(set.has(m.id)){m.reported=true;store.put(m);}
    await done(tx);
  }
  async function clearMistakes(){const db=await open(),tx=db.transaction(MIS,'readwrite');tx.objectStore(MIS).clear();await done(tx);}

  /* ---------- the service ---------- */
  // Errors carry a code the page can word: 'unavailable' (no service at this address, e.g. a plain static host), 'offline', 'busy' (rate limit),
  // 'timeout', 'bad' (the service answered with something unusable).
  function fail(code,detail){const error=new Error(code+(detail?': '+detail:''));error.aiCode=code;return error;}
  async function call(task,payload,{signal}={}){
    if(root.navigator&&root.navigator.onLine===false)throw fail('offline');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    signal?.addEventListener?.('abort',()=>controller.abort());
    let response;
    try{
      response=await root.fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task,payload}),signal:controller.signal,cache:'no-store'});
    }catch(error){throw fail(controller.signal.aborted&&!signal?.aborted?'timeout':'offline');}
    finally{clearTimeout(timer);}
    if(response.status===404||response.status===405)throw fail('unavailable');
    if(response.status===429)throw fail('busy');
    if(!response.ok)throw fail('bad','HTTP '+response.status);
    let data;try{data=await response.json();}catch(_){throw fail('bad','not JSON');}
    if(!data||typeof data!=='object'||data.error)throw fail('bad',data&&data.error);
    return data;
  }

  // What the service needs to know about the user: the two languages, the level and the words of the list (the ones still being learned come first).
  function context(){
    const data=typeof VocVocData!=='undefined'?VocVocData:root.VocVocData,settings=data.getSettings(),entries=data.getProgressEntries().filter(entry=>entry.status!=='archived');
    const rank=entry=>entry.status==='active'?0:1;
    const words=entries.sort((a,b)=>rank(a)-rank(b)).map(entry=>entry.word).slice(0,30);
    const level=/^(A1|A2|B1|B2|C1|C2)/.exec(String(settings.difficulty||''))?.[1]||'A1';
    return {target:settings.targetLanguage||'fr',native:settings.nativeLanguage||'tr',level,words};
  }

  // Analyse the mistakes made since the last report and put the result in the inbox. Returns the message, or null when there was nothing new.
  async function analyzeMistakes({minimum=1}={}){
    const fresh=await listMistakes({unreportedOnly:true});
    if(fresh.length<minimum)return null;
    const ctx=context(),batch=fresh.slice(-60);
    const result=await call('analyze',{target:ctx.target,native:ctx.native,level:ctx.level,mistakes:batch.map(({area,said,better,note,word})=>({area,said,better,note,word}))});
    const message=await addMessage({kind:'report',title:'',body:{...result,count:batch.length}});
    await markReported(batch.map(m=>m.id));
    return message;
  }

  const api=Object.freeze({AREAS,addMessage,listMessages,unreadCount,markRead,removeMessage,clearInbox,logMistakes,listMistakes,markReported,clearMistakes,call,context,analyzeMistakes,
    available:()=>true});
  root.VocVocAI=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
