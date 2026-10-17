'use strict';
/* The ready-made words (packs/) as the app uses them. This is where the app gets every word: there is no AI any more.
   A language pair has a course (packs/<pair>/order.json plus chunk files such as A1-01.json, downloaded one at a time) or, for the small starter
   packs, one file (packs/<pair>.json). Everything fetched is kept in the browser's cache, so a word that was needed once works offline.
   What the page can ask for: the next words of the level the user chose (next), a word typed in the search box (find), a random word (random),
   how far the user has come (progress) and what the next level is (nextBand). Nothing here writes to the user's list: the page does that when
   the user decides to add a word.
   Pure logic (the keys a word is looked up by, the levels) is separate from the part that talks to the network, so the tests can run it without a browser. */
(function(root){
  const PACK_CACHE='vocvoc-packs-v1';
  const BAND_ORDER=Object.freeze(['A1','A2','B1','B2','C1','C2']);

  /* ---------- keys a word is looked up by ---------- */
  // "École", "ecole" and "l'école" are the same word to the user: letters without accents, no case, no leading article.
  // A Turkish keyboard has no î, û or ç: the dotless ı (and İ) the user types instead is an i, ş is s, ğ is g (the accents come off with the marks).
  const ARTICLES=/^(?:l['’]|d['’]|le |la |les |un |une |des |du |de la |de l['’]|au |aux )/;
  function foldText(text,language){
    return String(text??'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/œ/gi,'oe').replace(/æ/gi,'ae')
      .replace(/[’‘`´]/g,"'").replace(/\s+/g,' ').trim().toLocaleLowerCase(language||'en').replace(/ı/g,'i');
  }
  // The loosest key: also a hyphen, an apostrophe and a space are the same ("s'il-vous-plaît" = "s il vous plait").
  const looseKey=(text,language)=>foldText(text,language).replace(/['-]/g,' ').replace(/\s+/g,' ').trim();
  function withoutArticle(text){
    const key=String(text).replace(/\s+/g,' ').trim();
    const match=ARTICLES.exec(key.toLocaleLowerCase('fr'));
    return match&&key.length>match[0].length?key.slice(match[0].length):key;
  }
  // The index of a course: every headword with the chunk it is in, by exact key and by folded key (and a plain list of loose keys for similar words).
  function buildIndex(order,target){
    const exact=new Map(),folded=new Map(),loose=new Map(),list=[];
    for(const chunk of order.chunks){
      for(const word of chunk.words){
        const entry={word,chunk:chunk.id,level:chunk.level};
        exact.set(String(word).normalize('NFC').toLocaleLowerCase(target),entry);
        const key=foldText(word,target);
        if(!folded.has(key))folded.set(key,entry);
        const looser=looseKey(word,target);
        if(!loose.has(looser))loose.set(looser,entry);
        list.push({word,key:looser});
      }
    }
    return {exact,folded,loose,list};
  }
  // Candidate keys for what the user typed, most exact first.
  function lookupKeys(text,target){
    const typed=String(text??'').normalize('NFC').trim();
    const list=[typed];
    if(target==='fr'){const bare=withoutArticle(typed);if(bare!==typed)list.push(bare);}
    return list.filter(Boolean);
  }
  function lookupInIndex(index,text,target){
    for(const candidate of lookupKeys(text,target)){
      const hit=index.exact.get(candidate.toLocaleLowerCase(target));
      if(hit)return hit;
    }
    for(const candidate of lookupKeys(text,target)){
      const hit=index.folded.get(foldText(candidate,target));
      if(hit)return hit;
    }
    for(const candidate of lookupKeys(text,target)){                                         // last: hyphens, apostrophes and spaces count the same
      const hit=index.loose?.get(looseKey(candidate,target));
      if(hit)return hit;
    }
    return null;
  }
  // Edit distance where swapping two neighbouring letters is one edit; gives up (max+1) as soon as it must be larger than max.
  function editDistance(a,b,max){
    if(a===b)return 0;
    if(Math.abs(a.length-b.length)>max)return max+1;
    let before=null,row=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const next=[i];let low=i;
      for(let j=1;j<=b.length;j++){
        let value=Math.min(row[j]+1,next[j-1]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
        if(before&&i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])value=Math.min(value,before[j-2]+1);
        next.push(value);if(value<low)low=value;
      }
      if(low>max)return max+1;
      before=row;row=next;
    }
    return row[b.length];
  }
  // Words that look like what was typed, best first: the same word spelled differently (accents, hyphen, Turkish letters), a typo away, or
  // the beginning of a longer word. `found` is the word that was matched (kept out of the list); a matched word only gets its spelling variants and a one-letter-away
  // neighbour of a longer word, a word that was not found gets everything.
  function similarWords(index,text,target,{limit=8,found=''}={}){
    const keys=[...new Set(lookupKeys(text,target).map(candidate=>looseKey(candidate,target)).filter(Boolean))];
    if(!keys.length)return [];
    const skip=new Set([String(found).normalize('NFC').toLocaleLowerCase(target)]),seen=new Set(skip),out=[];
    const add=item=>{const id=String(item.word).normalize('NFC').toLocaleLowerCase(target);if(seen.has(id))return false;seen.add(id);out.push(item.word);return true;};
    const list=index.list||[];
    for(const item of list)if(keys.includes(item.key))add(item);                              // the same word, spelled another way
    const key=keys[keys.length-1],longest=key.length,max=longest<=3?0:longest<=6?1:2;
    const near=[];
    if(max>0&&(!found||longest>=5)){
      for(const item of list){
        const distance=editDistance(key,item.key,found?1:max);
        if(distance>0&&distance<=(found?1:max)&&!seen.has(String(item.word).normalize('NFC').toLocaleLowerCase(target)))near.push({item,distance});
      }
      near.sort((a,b)=>a.distance-b.distance||a.item.key.length-b.item.key.length||a.item.word.localeCompare(b.item.word,target));
      for(const {item} of near)if(out.length<limit)add(item);
    }
    if(!found&&key.length>=2){
      const longer=list.filter(item=>item.key!==key&&item.key.startsWith(key)).sort((a,b)=>a.key.length-b.key.length||a.word.localeCompare(b.word,target));
      for(const item of longer)if(out.length<limit)add(item);
    }
    return out.slice(0,limit);
  }
  const nextBand=band=>{const at=BAND_ORDER.indexOf(band);return at>=0&&at<BAND_ORDER.length-1?BAND_ORDER[at+1]:null;};
  const copyEntry=entry=>JSON.parse(JSON.stringify({synonyms:[],antonyms:[],examples:[],expressions:[],...entry}));

  /* ---------- the part that talks to the network ---------- */
  // env: packs (VocVocPacks), settings() -> {targetLanguage,nativeLanguage,difficulty}, isKnown(word) -> bool, fetchJson, onChange()
  function create(env){
    const packs=env.packs;
    const state={pair:'',status:'idle',entry:null,pack:null,course:null,index:null};   // status: idle | loading | ready | none | offline
    let load=null;
    const settings=()=>env.settings();
    const currentPair=()=>{const value=settings();return packs.pairId(value.targetLanguage,value.nativeLanguage);};
    const bandOf=()=>packs.normalizeBand(settings().difficulty);                                       // the difficulty setting names the level words are drawn from (an older "A1-A2" is read as A1)
    const changed=()=>{try{env.onChange&&env.onChange();}catch(_){}};

    // order.json of a course: the copy on this device when it is as new as the index says, else a fresh download.
    async function courseOrder(pair,course){
      const url='./packs/'+pair+'/order.json',usable=order=>!!order&&order.id===pair&&!packs.validateOrder(order).length;
      let order=null;try{order=await env.fetchJson(url);}catch(_){}
      if(!usable(order)||(course&&order.version<course.version))order=await env.fetchJson(url,{network:true});
      if(!usable(order))throw new Error('unusable course');
      return order;
    }
    // One chunk of the course (A1-01 …), the same way: the device's copy when it belongs to this version of the course, else a fresh download.
    async function courseChunk(order,id){
      const url='./packs/'+order.id+'/'+id+'.json',usable=chunk=>!!chunk&&chunk.id===order.id&&chunk.chunk===id&&chunk.version===order.version&&!packs.validateChunk(chunk).length;
      let chunk=null;try{chunk=await env.fetchJson(url);}catch(_){}
      if(!usable(chunk))chunk=await env.fetchJson(url,{network:true});
      if(!usable(chunk))throw new Error('unusable chunk');
      return chunk;
    }
    function refresh(){
      const pair=currentPair();
      load=(async()=>{
        Object.assign(state,{pair,status:'loading',entry:null,pack:null,course:null,index:null});changed();
        try{
          let index=null;try{index=await env.fetchJson('./packs/index.json',{network:true});}catch(_){}
          const course=index?.courses?.find(item=>item.id===pair)||null;
          const entry=course||index?.packs?.find(item=>item.id===pair)||null;
          if(state.pair!==pair)return;
          if(index&&!entry){state.status='none';return;}
          if(course||!index){                                                                          // a course; or no index at all (offline): a course kept on this device, else the single pack
            let order=null;try{order=await courseOrder(pair,course);}catch(_){}
            if(order){
              if(state.pair===pair)Object.assign(state,{status:'ready',entry:course||{id:pair,words:order.chunks.reduce((sum,chunk)=>sum+chunk.words.length,0)},course:order,index:buildIndex(order,settings().targetLanguage)});
              return;
            }
            if(course)throw new Error('unusable course');
          }
          let pack=null;try{pack=await env.fetchJson('./packs/'+pair+'.json');}catch(_){}               // the copy kept on this device, if it is usable
          if(entry&&(!pack||pack.version<entry.version||packs.validatePack(pack).length))pack=await env.fetchJson('./packs/'+pair+'.json',{network:true});
          if(!pack||pack.id!==pair||packs.validatePack(pack).length)throw new Error('unusable pack');
          if(state.pair===pair)Object.assign(state,{status:'ready',entry:entry||{id:pair,words:pack.words.length},pack});
        }catch(_){if(state.pair===pair)state.status='offline';}
        finally{if(state.pair===pair)changed();}
      })();
      return load;
    }
    // Waits until the words are there (starting the download the first time, or again after being offline). Returns the status.
    async function ready(){
      if(state.pair!==currentPair()||state.status==='idle'||state.status==='offline')await refresh();
      else if(load)await load;
      return state.status;
    }
    function sync(){try{if(currentPair()!==state.pair)refresh();}catch(_){}}               // the language pair changed

    const chunksOfBand=band=>state.course.chunks.filter(chunk=>(packs.BANDS[band]||[]).includes(chunk.level));
    // How many words of a level (the chosen one when none is named) the user has, out of how many there are. A starter pack is one group only.
    function progress(band=bandOf()){
      if(state.status!=='ready')return {total:0,used:0};
      if(state.course)return packs.courseProgress(state.course,band,env.isKnown);
      return band===packBand()?packs.progress(state.pack,env.isKnown):{total:0,used:0};
    }
    const packBand=()=>packs.normalizeBand(state.pack?.level);
    // The level a headword belongs to (null when it is not in the words of this pair, or they are not loaded).
    function bandOfWord(word){
      if(state.status!=='ready')return null;
      if(!state.course)return state.pack.words.some(item=>item.word===word||foldText(item.word,settings().targetLanguage)===foldText(word,settings().targetLanguage))?packBand():null;
      const hit=lookupInIndex(state.index,word,settings().targetLanguage);
      return hit?BAND_ORDER.find(band=>(packs.BANDS[band]||[]).includes(hit.level))||null:null;
    }
    // The next unknown words of the band the user chose; only the chunks that are needed are downloaded.
    async function next(count){
      if(await ready()!=='ready')throw new Error(state.status);
      if(!state.course)return packs.nextWords(state.pack,env.isKnown,count);
      const ids=packs.pickChunks(state.course,bandOf(),env.isKnown,count),chunks=[];
      for(const id of ids)chunks.push(await courseChunk(state.course,id));
      return packs.nextFromChunks(chunks,env.isKnown,count);
    }
    // What to answer when the words are not there: no words for this language pair at all, or they cannot be had right now.
    const unready=()=>({status:state.status==='none'?'none':'unavailable'});
    // A word the user typed (or a related word): {status:'found',entry,level,similar} | {status:'missing',similar} | {status:'none'} | {status:'unavailable'}.
    // `similar` lists headwords that look like what was typed (another spelling of the word, a typo away, the start of a longer word).
    async function find(text){
      if(await ready()!=='ready')return unready();
      const target=settings().targetLanguage;
      try{
        const index=state.course?state.index:buildIndex({chunks:[{id:'pack',level:state.pack.level||'',words:state.pack.words.map(item=>item.word)}]},target);
        const hit=lookupInIndex(index,text,target);
        if(!hit)return {status:'missing',similar:similarWords(index,text,target,{limit:8})};
        const entry=state.course
          ?(await courseChunk(state.course,hit.chunk)).words.find(item=>item.word===hit.word)
          :state.pack.words.find(item=>item.word===hit.word);
        if(!entry)return {status:'missing',similar:[]};
        return {status:'found',entry:copyEntry(entry),level:hit.level,similar:similarWords(index,text,target,{limit:5,found:hit.word})};
      }catch(_){return {status:'unavailable'};}
    }
    // A random word of the chosen level, one the user does not have yet when there is one.
    async function random(){
      if(await ready()!=='ready')return unready();
      const pick=list=>list[Math.floor(Math.random()*list.length)];
      try{
        if(state.course){
          const chunks=chunksOfBand(bandOf()),fresh=chunks.filter(chunk=>chunk.words.some(word=>!env.isKnown(word)));
          const info=pick(fresh.length?fresh:chunks);
          if(!info)return {status:'missing'};
          const chunk=await courseChunk(state.course,info.id),unknown=chunk.words.filter(item=>!env.isKnown(item.word));
          const entry=pick(unknown.length?unknown:chunk.words);
          return {status:'found',entry:copyEntry(entry),level:info.level};
        }
        const unknown=state.pack.words.filter(item=>!env.isKnown(item.word)),entry=pick(unknown.length?unknown:state.pack.words);
        return {status:'found',entry:copyEntry(entry),level:state.pack.level||''};
      }catch(_){return {status:'unavailable'};}
    }
    // The level after the chosen one that has words; none for a pair that has only a starter pack, or when the chosen level is the last one with words.
    function nextBandOf(){
      if(!state.course)return null;
      for(let band=nextBand(bandOf());band;band=nextBand(band))if(chunksOfBand(band).length)return band;
      return null;
    }
    return {state,refresh,ready,sync,bandOf,bandOfWord,progress,next,find,random,nextBandOf,hasCourse:()=>!!state.course};
  }

  /* ---------- the page ---------- */
  async function fetchJson(url,{network=false}={}){
    const cache='caches' in root?await root.caches.open(PACK_CACHE):null;
    if(cache&&!network){const hit=await cache.match(url);if(hit)return hit.json();}
    try{
      const response=await root.fetch(url,{cache:'no-cache'});
      if(response.ok){if(cache)await cache.put(url,response.clone());return await response.json();}
    }catch(_){}
    if(cache){const hit=await cache.match(url);if(hit)return hit.json();}
    throw new Error('offline');
  }
  const api={PACK_CACHE,BAND_ORDER,foldText,looseKey,withoutArticle,buildIndex,lookupKeys,lookupInIndex,editDistance,similarWords,nextBand,create};
  if(typeof module==='object'&&module.exports)module.exports=api;
  // VocVocData is a top-level const of the page's own script: visible here by name, not as a property of window.
  if(typeof VocVocData!=='undefined'&&root.VocVocPacks){
    const live=create({
      packs:root.VocVocPacks,fetchJson,
      settings:()=>VocVocData.getSettings(),
      isKnown:word=>!!VocVocData.getWordProgress(word),
      onChange:()=>root.dispatchEvent(new CustomEvent('vocvoc-wordbase-changed'))
    });
    root.VocVocWordbase=Object.freeze({...api,...live});
  }
})(typeof window!=='undefined'?window:globalThis);
