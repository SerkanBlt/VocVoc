/* VocVoc PWA 1.0 — persistence only. UI never opens IndexedDB. */
'use strict';
const VocVocStorage=(()=>{
  const NAME='VOCVOC_PWA', VERSION=1, STATE='schema-v1';
  const MAX_IMPORT_BYTES=10*1024*1024, MAX_DEPTH=16;
  const clone=value=>structuredClone(value);
  const fail=code=>Object.assign(new Error(code),{storageCode:code});
  const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  function validate(db){
    if(!object(db)||db.schemaVersion!==1)throw fail('invalidData');
    const allowed=new Set(['schemaVersion','meta','settings','words','aliases','progress','dailyUsage']);
    if(Object.keys(db).some(k=>!allowed.has(k)))throw fail('invalidData');
    // Bounded depth: hostile/corrupt nesting must be rejected, not overflow the stack.
    function scan(value,depth=0){if(!value||typeof value!=='object')return;if(depth>MAX_DEPTH)throw fail('invalidData');for(const key of Object.keys(value)){
      if(['__proto__','prototype','constructor'].includes(key)||/^(?:apiKey|api_key|GEMINI_API_KEY|VOCVOC_SECRET_GEMINI_API_KEY|secrets?)$/i.test(key))throw fail('invalidData');scan(value[key],depth+1);}}
    scan(db);
    for(const key of ['meta','settings','words','aliases','progress','dailyUsage'])if(!object(db[key]))throw fail('invalidData');
    const m=db.meta;
    for(const k of ['createdAt','updatedAt','migratedFromLegacyAt'])if(m[k]!=null&&typeof m[k]!=='string')throw fail('invalidData');
    if(m.starterWordsInitialized!=null&&typeof m.starterWordsInitialized!=='boolean')throw fail('invalidData');
    const s=db.settings;
    for(const key of ['nativeLanguage','targetLanguage'])if(typeof s[key]!=='string'||! /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(s[key]))throw fail('invalidData');
    // Optional interface language (absent in data saved before it existed).
    if(s.appLanguage!=null&&(typeof s.appLanguage!=='string'||! /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(s.appLanguage)))throw fail('invalidData');
    if(!['system','light','dark'].includes(s.theme)||!['small','normal','large','xlarge'].includes(s.fontSize)||typeof s.difficulty!=='string'||!(s.dailyLimit==='unlimited'||/^\d+$/.test(String(s.dailyLimit))&&Number(s.dailyLimit)>0))throw fail('invalidData');
    for(const [id,w] of Object.entries(db.words)){
      if(!object(w)||w.id!==id||typeof w.word!=='string'||!w.word.trim()||typeof w.targetLanguage!=='string'||typeof w.nativeLanguage!=='string')throw fail('invalidData');
      const norm=w.word.trim().toLocaleLowerCase(w.targetLanguage).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      if(id!==`${w.targetLanguage}:${w.nativeLanguage}:${encodeURIComponent(norm)}`||w.normalized!==norm)throw fail('invalidData');
      for(const k of ['type','meaning','createdAt','updatedAt'])if(w[k]!=null&&typeof w[k]!=='string')throw fail('invalidData');
      for(const k of ['synonyms','antonyms','examples','expressions'])if(w[k]!=null&&!Array.isArray(w[k]))throw fail('invalidData');
      for(const k of ['synonyms','antonyms'])if(w[k]?.some(x=>typeof x!=='string'))throw fail('invalidData');
      for(const k of ['examples','expressions'])if(w[k]?.some(x=>!object(x)||Object.values(x).some(v=>typeof v!=='string')))throw fail('invalidData');
    }
    for(const [alias,id] of Object.entries(db.aliases))if(typeof id!=='string'||!Object.hasOwn(db.words,id)||!alias.startsWith(`${db.words[id].targetLanguage}:${db.words[id].nativeLanguage}:`))throw fail('invalidData');
    for(const [id,p] of Object.entries(db.progress)){
      if(!object(p)||p.wordId!==id||!Object.hasOwn(db.words,id)||!['active','memorized','archived'].includes(p.status))throw fail('invalidData');
      if(p.archiveSourceStatus!=null&&!['active','memorized'].includes(p.archiveSourceStatus))throw fail('invalidData');
      for(const k of ['firstSeenAt','lastSeenAt','statusChangedAt','memorizedAt','archivedAt'])if(p[k]!=null&&typeof p[k]!=='string')throw fail('invalidData');
    }
    if(!Number.isSafeInteger(db.dailyUsage.count)||db.dailyUsage.count<0||!(db.dailyUsage.date===null||typeof db.dailyUsage.date==='string'))throw fail('invalidData');
    return db;
  }
  // One entry point for every backup file: size, JSON syntax, export envelope and Schema v1 are all
  // checked before anything touches stored data. `bytes` is the real file size (text.length is not bytes).
  function parseBackup(text,bytes=typeof text==='string'?text.length:Infinity){
    if(typeof text!=='string'||!(bytes<=MAX_IMPORT_BYTES))throw fail('invalidData');
    let data;try{data=JSON.parse(text);}catch(_){throw fail('invalidData');}
    if(!object(data)||data.exportVersion!==1||(data.exportedAt!=null&&typeof data.exportedAt!=='string'))throw fail('invalidData');
    const {exportVersion,exportedAt,...db}=data;
    return {backup:data,db:validate(db)};
  }
  class IndexedDBAdapter{
    constructor(){this.db=null;this.revision=0;this.initializing=null;}
    open(){
      if(this.db)return Promise.resolve(this.db);
      if(this.initializing)return this.initializing;
      this.initializing=new Promise((resolve,reject)=>{
        if(!globalThis.indexedDB){reject(fail('unavailable'));return;}
        let done=false;const request=indexedDB.open(NAME,VERSION);
        const timer=setTimeout(()=>{done=true;reject(fail('blocked'));},10000);
        request.onupgradeneeded=()=>{const db=request.result;for(const name of ['state','control'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name);};
        request.onblocked=()=>{clearTimeout(timer);done=true;reject(fail('blocked'));};
        request.onerror=()=>{clearTimeout(timer);done=true;reject(request.error||fail('unavailable'));};
        request.onsuccess=()=>{
          clearTimeout(timer);if(done){request.result.close();return;}
          this.db=request.result;
          this.db.onversionchange=()=>{this.db.close();this.db=null;this.initializing=null;globalThis.dispatchEvent?.(new CustomEvent('vocvoc-storage-external'));};
          this.db.onclose=()=>{this.db=null;this.initializing=null;};resolve(this.db);
        };
      }).catch(error=>{this.initializing=null;throw error;});return this.initializing;
    }
    begin(mode){
      try{return this.db.transaction(['state','control'],mode,mode==='readwrite'?{durability:'strict'}:undefined);}
      catch(error){if(!(error instanceof TypeError))throw error;return this.db.transaction(['state','control'],mode);}
    }
    async transaction(mode,work,reopened=false){
      // A connection the browser closed (storage housekeeping, onclose/versionchange) is reopened on demand.
      if(!this.db)await this.open();
      let tx;
      try{tx=this.begin(mode);}
      catch(error){
        if(error?.name==='InvalidStateError'&&!reopened){try{this.db.close();}catch(_){}this.db=null;this.initializing=null;return this.transaction(mode,work,true);}
        throw error;
      }
      return new Promise((resolve,reject)=>{
        let result,reason;
        tx.oncomplete=()=>resolve(result);
        tx.onabort=()=>reject(reason||tx.error||fail('aborted'));
        tx.onerror=()=>{};
        try{work(tx,value=>result=value,error=>{reason=error;tx.abort();});}catch(error){reason=error;tx.abort();}
      });
    }
    read(){return this.transaction('readonly',(tx,set)=>{
      const out={};tx.objectStore('state').get(STATE).onsuccess=e=>out.db=e.target.result;
      tx.objectStore('control').get('revision').onsuccess=e=>out.revision=e.target.result||0;
      tx.objectStore('control').get('migration').onsuccess=e=>out.migration=e.target.result;
      set(out);
    }).then(out=>{
      // A damaged revision would make every later optimistic-concurrency write meaningless: treat as corrupt.
      if(!Number.isSafeInteger(out.revision)||out.revision<0)throw fail('invalidData');
      return out;
    });}
    async initialize(build){
      await this.open();let existing=await this.read();
      if(existing.db===undefined){
        const candidate=validate(await build());let inserted=false;
        await this.transaction('readwrite',(tx)=>{
          const state=tx.objectStore('state'),control=tx.objectStore('control');
          state.get(STATE).onsuccess=e=>{if(e.target.result)return;inserted=true;state.put(candidate,STATE);control.put(1,'revision');control.put({phase:'copied',at:new Date().toISOString(),schemaVersion:1},'migration');};
        });
        existing=await this.read();
        // Verify the durable clone, not the original object or a request success.
        validate(existing.db);
        if(inserted&&JSON.stringify(existing.db)!==JSON.stringify(candidate)&&existing.revision===1)throw fail('verification');
      }
      validate(existing.db);
      if(existing.migration?.phase!=='complete'){
        await this.transaction('readwrite',(tx)=>{
          tx.objectStore('control').put({...existing.migration,phase:'complete',verifiedAt:new Date().toISOString()},'migration');
        });
        // We just wrote: verify what was durably stored. (A complete database was read and validated a moment ago and nothing
        // has been written since, so reading and validating the same megabytes again would only slow every start-up.)
        existing=await this.read();validate(existing.db);
      }
      this.revision=existing.revision;return existing.db;
    }
    async write(db,{backup=false}={}){
      validate(db);const expected=this.revision;
      const revision=await this.transaction('readwrite',(tx,set,abort)=>{
        const control=tx.objectStore('control'),state=tx.objectStore('state');
        control.get('revision').onsuccess=e=>{
          if((e.target.result||0)!==expected){abort(fail('conflict'));return;}
          if(backup)state.get(STATE).onsuccess=old=>control.put({db:old.target.result,at:new Date().toISOString()},'before-import');
          state.put(db,STATE);control.put(expected+1,'revision');set(expected+1);
        };
      });this.revision=revision;
      globalThis.dispatchEvent?.(new CustomEvent('vocvoc-storage-committed',{detail:{revision}}));
    }
    async recoveryBackup(){return this.transaction('readonly',(tx,set)=>{tx.objectStore('control').get('before-import').onsuccess=e=>set(e.target.result?.db||null);});}
    close(){this.db?.close();this.db=null;this.initializing=null;}
  }
  const adapter=new IndexedDBAdapter();
  return Object.freeze({adapter,IndexedDBAdapter,validate,parseBackup,maxImportBytes:MAX_IMPORT_BYTES,clone,fail});
})();
