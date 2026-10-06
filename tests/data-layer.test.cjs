/* Regression tests for the real data layer (VocVocData) of index.html, run in Node on an in-memory IndexedDB: no browser needed.
   The layer is cut out of index.html between two markers and evaluated next to storage.js, so these tests exercise the shipped code.
   Run: node --test --test-reporter=spec tests/data-layer.test.cjs   (npm test does this). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const {IDBFactory}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),storageSource=fs.readFileSync(path.join(root,'storage.js'),'utf8');
const from=html.indexOf('var archiveWordsCache=null;'),to=html.indexOf('function getNativeLanguageCode(){');
if(from<0||to<from)throw new Error('The data layer markers moved in index.html: update tests/data-layer.test.cjs ("var archiveWordsCache" ... "function getNativeLanguageCode").');
const dataLayerSource=html.slice(from,to);
const plain=value=>JSON.parse(JSON.stringify(value)); // objects from the app's own realm -> comparable plain data

/* One "browser profile": an IndexedDB and a localStorage. createApp() is "open the app"; calling it again with the same profile is a restart. */
const newProfile=(legacy={})=>({indexedDB:new IDBFactory(),store:new Map(Object.entries(legacy))});
function createApp(profile){
  const {indexedDB,store}=profile;
  const ctx={indexedDB,structuredClone,setTimeout,clearTimeout,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},dispatchEvent(){},
    localStorage:{getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>{store.set(key,String(value));},removeItem:key=>{store.delete(key);}}};
  ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(storageSource,ctx);vm.runInContext(dataLayerSource,ctx);
  const data=vm.runInContext('VocVocData',ctx),secrets=vm.runInContext('VocVocSecrets',ctx),storage=vm.runInContext('VocVocStorage',ctx);
  return {data,secrets,storage,adapter:storage.adapter,store};
}
const legacySpa=()=>({
  NATIVE_LANGUAGE:'tr',TARGET_LANGUAGE:'fr',
  WORD_HISTORY:JSON.stringify(['Bonjour','Merci','Je','Chat']),            // newest first, like the original SPA
  MEMORIZED_WORDS:JSON.stringify(['Merci']),
  ARCHIVED_WORDS:JSON.stringify([{word:'Chat',sourceStatus:'active',archivedAt:1700000000000}]),
  SAVED_WORDS:JSON.stringify({bonjour:{word:'Bonjour',type:'nom',meaning:'merhaba',synonyms:['Salut'],antonyms:[],examples:[],expressions:[]},merci:{word:'Merci',type:'nom',meaning:'teşekkürler',synonyms:[],antonyms:[],examples:[],expressions:[]}})
});
const start=async(profile=newProfile(legacySpa()))=>{const app=createApp(profile);await app.data.init();return {...app,profile};};
const status=(app,word)=>app.data.getWordProgress(word)?.status;
/* A Schema v1 backup with n words, word i last seen i minutes after the first (so "newest first" is well defined). */
const backupWithWords=(n,{archivedFrom=Infinity}={})=>{
  const base=Date.parse('2026-01-01T00:00:00Z'),words={},aliases={},progress={};
  for(let i=0;i<n;i++){
    const word='mot'+String(i).padStart(4,'0'),id='fr:tr:'+word,stamp=new Date(base+i*60000).toISOString(),archived=i>=archivedFrom;
    words[id]={id,word,normalized:word,targetLanguage:'fr',nativeLanguage:'tr',type:'nom',meaning:'anlam '+word,synonyms:[],antonyms:[],examples:[],expressions:[],createdAt:stamp,updatedAt:stamp};
    aliases[id]=id;progress[id]={wordId:id,status:archived?'archived':'active',firstSeenAt:stamp,lastSeenAt:stamp,statusChangedAt:stamp,memorizedAt:null,archivedAt:archived?stamp:null,archiveSourceStatus:archived?'active':null};
  }
  return {exportVersion:1,schemaVersion:1,meta:{starterWordsInitialized:true},settings:{nativeLanguage:'tr',targetLanguage:'fr',difficulty:'A1-A2',dailyLimit:'10',theme:'system',fontSize:'normal'},words,aliases,progress,dailyUsage:{date:null,count:0}};
};

describe('Migration from the original SPA (localStorage -> IndexedDB)',()=>{
  it('moves history, memorized, archived and saved words into Schema v1 with stable word IDs',async()=>{
    const app=await start();
    assert.deepEqual(plain(app.data.getHistoryWords()),['Bonjour','Merci','Je']);             // newest first, archived ones are not History
    assert.deepEqual(plain(app.data.getMemorizedWords()),['Merci']);
    assert.deepEqual(plain(app.data.getArchivedEntries().map(({word,sourceStatus})=>({word,sourceStatus}))),[{word:'Chat',sourceStatus:'active'}]);
    assert.deepEqual(Object.keys(plain(app.data.getDb().words)).sort(),['fr:tr:bonjour','fr:tr:chat','fr:tr:je','fr:tr:merci']);
    assert.equal(app.data.getWordByText('bonjour').meaning,'merhaba');                         // saved word details survive
    assert(app.store.has('WORD_HISTORY'),'the legacy source must be retained, never deleted');
  });
  it('is idempotent: starting again with the same legacy data changes nothing and creates no duplicates',async()=>{
    const profile=newProfile(legacySpa()),first=await start(profile),snapshot=plain(first.data.getDb()),revision=first.adapter.revision;
    const second=await start(profile);                                                          // a restart: same IndexedDB, same localStorage
    assert.deepEqual(plain(second.data.getDb()),snapshot);
    assert.equal(second.adapter.revision,revision);
    assert.equal(Object.keys(second.data.getDb().words).length,4);
    assert.equal((await second.adapter.read()).migration.phase,'complete');
  });
  it('an interrupted migration (only the "copied" marker) is completed on the next start without duplicates',async()=>{
    const profile=newProfile(legacySpa()),first=await start(profile),snapshot=plain(first.data.getDb());
    await first.adapter.transaction('readwrite',tx=>tx.objectStore('control').put({phase:'copied',schemaVersion:1},'migration'));
    const second=await start(profile);
    assert.equal((await second.adapter.read()).migration.phase,'complete');
    assert.deepEqual(plain(second.data.getDb()),snapshot);
  });
  it('malformed legacy data stops start-up instead of being replaced by an empty database',async()=>{
    const profile=newProfile({...legacySpa(),WORD_HISTORY:'{broken'}),app=createApp(profile);
    await assert.rejects(app.data.init(),error=>error.storageCode==='invalidData');
    assert.equal((await app.adapter.read()).db,undefined,'nothing may be written');
    assert.equal(profile.store.get('WORD_HISTORY'),'{broken','the broken source must be left as it is');
  });
  it('once IndexedDB holds the data it is authoritative: later legacy edits are not re-imported and deletes do not come back',async()=>{
    const profile=newProfile(legacySpa()),first=await start(profile);
    await first.data.deleteWords(['Je']);
    profile.store.set('WORD_HISTORY',JSON.stringify(['Je','Nouveau']));
    const second=await start(profile);
    assert.equal(second.data.getWordByText('Je'),null);assert.equal(second.data.getWordByText('Nouveau'),null);
  });
});

describe('Archive and restore',()=>{
  it('archiving remembers where a word came from, and Undo brings back the exact previous state',async()=>{
    const app=await start(),before=plain(app.data.getWordProgress('Merci'));
    const archived=await app.data.archiveWithSnapshot('Merci');
    assert.equal(archived.sourceStatus,'memorized');assert.equal(status(app,'Merci'),'archived');
    assert(app.data.getArchivedEntries().some(entry=>entry.word==='Merci'&&entry.sourceStatus==='memorized'));
    assert.equal(await app.data.restoreArchivedProgress('Merci',archived.progress),true);
    assert.deepEqual(plain(app.data.getWordProgress('Merci')),before);
  });
  it('restoring words from the archive makes them memorized again (original SPA semantics)',async()=>{
    const app=await start();
    await app.data.restoreArchived(['Chat']);
    assert.equal(status(app,'Chat'),'memorized');assert.equal(app.data.getArchivedEntries().length,0);
  });
  it('archived words disappear from History but stay in the archive list; unarchived ones return',async()=>{
    const app=await start();
    await app.data.archiveWithSnapshot('Bonjour');
    assert(!app.data.getHistoryWords().includes('Bonjour'));assert(app.data.getArchivedEntries().some(entry=>entry.word==='Bonjour'));
    await app.data.restoreArchived(['Bonjour']);
    assert(app.data.getHistoryWords().includes('Bonjour'));
  });
  it('deleting archived words removes word, alias and progress together, and stays deleted after a restart',async()=>{
    const profile=newProfile(legacySpa()),app=await start(profile);
    await app.data.deleteWords(['Chat']);
    const db=plain(app.data.getDb());
    assert(!('fr:tr:chat' in db.words)&&!('fr:tr:chat' in db.aliases)&&!('fr:tr:chat' in db.progress));
    const restarted=await start(profile);
    assert.equal(restarted.data.getWordByText('Chat'),null);assert.equal(restarted.data.getArchivedEntries().length,0);
  });
  it('the status of one word changing is reflected immediately in every derived list (no stale cache)',async()=>{
    const app=await start();
    assert.deepEqual(plain(app.data.getMemorizedWords()),['Merci']);
    await app.data.setStatus('Je','memorized');
    assert.deepEqual(plain(app.data.getMemorizedWords()).sort(),['Je','Merci']);
    await app.data.setStatus('Merci','active');
    assert.deepEqual(plain(app.data.getMemorizedWords()),['Je']);
    assert.equal(app.data.getProgressEntries().find(entry=>entry.word==='Merci').status,'active');
  });
});

describe('Word list order (the Gemini prompt keeps the first 100 of a newest-first list)',()=>{
  it('History is newest first: with 150 records the first 100 are exactly the 100 most recent',async()=>{
    const app=await start(newProfile());
    await app.data.import(backupWithWords(150));
    const history=plain(app.data.getHistoryWords());
    assert.equal(history.length,150);
    const newest100=Array.from({length:100},(_,i)=>'mot'+String(149-i).padStart(4,'0'));
    assert.deepEqual(history.slice(0,100),newest100);
    assert.notDeepEqual(history.slice(-100),newest100,'the LAST 100 are the oldest ones: slice(-100) would be the bug');
  });
  it('the lists handed out are copies: changing one cannot corrupt the next answer',async()=>{
    const app=await start();
    const list=app.data.getHistoryWords();list.length=0;
    assert.deepEqual(plain(app.data.getHistoryWords()),['Bonjour','Merci','Je']);
    const entries=app.data.getProgressEntries();entries.length=0;assert.equal(app.data.getProgressEntries().length,4);
  });
});

describe('API key: never part of data, exports or backups',()=>{
  const KEY='AIza'+'SyDUMMYDUMMYDUMMYDUMMYDUMMYDUMMY123';                                      // split so secret scanners do not mistake this dummy for a real Google key
  it('is kept in its own storage entry; the legacy entry is removed; the key is trimmed and can be cleared',async()=>{
    const app=await start(newProfile({...legacySpa(),GEMINI_API_KEY:'old-legacy-key'}));
    assert.equal(app.secrets.getApiKey(),'old-legacy-key');                                      // legacy value is still readable
    app.secrets.setApiKey(`  ${KEY}  `);
    assert.equal(app.secrets.getApiKey(),KEY);assert(!app.store.has('GEMINI_API_KEY'),'legacy entry must be removed');
    app.secrets.setApiKey('');assert.equal(app.secrets.getApiKey(),'');
  });
  it('is absent from the exported backup, from the recovery copy and from the stored Schema v1 snapshot',async()=>{
    const app=await start();app.secrets.setApiKey(KEY);
    const exported=JSON.stringify(await app.data.export());
    assert(!exported.includes(KEY)&&!/GEMINI|SECRET|apiKey/i.test(exported),'export must not contain the key or its names');
    await app.data.clearProgressAndWords();                                                      // creates a recovery copy
    const recovery=JSON.stringify(await app.data.recoveryExport());
    assert(recovery.includes('Bonjour'),'the recovery copy holds the data that was reset');
    assert(!recovery.includes(KEY));
    assert(!JSON.stringify((await app.adapter.read()).db).includes(KEY),'the stored snapshot must not contain the key');
  });
  it('a backup that carries a key is rejected on import, and the current data stays untouched',async()=>{
    const app=await start(),before=plain(app.data.getDb()),exported=await app.data.export();
    await assert.rejects(app.data.import({...exported,apiKey:KEY}),error=>error.storageCode==='invalidData');
    assert.deepEqual(plain(app.data.getDb()),before);
  });
});

describe('Import, reset and recovery copies',()=>{
  it('importing a valid backup replaces the data in one step and keeps a recovery copy of what it replaced',async()=>{
    const source=await start(),target=await start(newProfile({NATIVE_LANGUAGE:'tr',TARGET_LANGUAGE:'fr',WORD_HISTORY:JSON.stringify(['Seul'])}));
    const originalWords=Object.keys(plain(target.data.getDb().words)).sort(),backup=await source.data.export();
    await target.data.import(backup);
    assert.deepEqual(Object.keys(plain(target.data.getDb().words)).sort(),['fr:tr:bonjour','fr:tr:chat','fr:tr:je','fr:tr:merci']);
    assert.deepEqual(Object.keys(plain((await target.data.recoveryExport()).words)).sort(),originalWords);
  });
  it('a rejected import (wrong version, wrong schema, damaged record) changes nothing',async()=>{
    const app=await start(),before=plain(app.data.getDb()),backup=await app.data.export();
    for(const bad of [{...backup,exportVersion:9},{...backup,schemaVersion:2},{...backup,progress:{broken:{wordId:'broken',status:'active'}}}])
      await assert.rejects(app.data.import(bad),error=>error.storageCode==='invalidData');
    assert.deepEqual(plain(app.data.getDb()),before);
  });
  it('reset keeps a recovery copy of the words; a second reset on an empty vocabulary does not overwrite it',async()=>{
    const app=await start();
    await app.data.clearProgressAndWords();
    assert.equal(Object.keys(app.data.getDb().words).length,0);
    const copy=plain(await app.data.recoveryExport());assert.equal(Object.keys(copy.words).length,4);
    await app.data.clearProgressAndWords();
    assert.equal(Object.keys(plain((await app.data.recoveryExport()).words)).length,4);
  });
  it('changing the language also keeps a recovery copy before it wipes the words',async()=>{
    const app=await start();
    await app.data.changeLanguage({targetLanguage:'de'});
    assert.equal(app.data.getSettings().targetLanguage,'de');assert.equal(Object.keys(app.data.getDb().words).length,0);
    assert.equal(Object.keys(plain((await app.data.recoveryExport()).words)).length,4);
  });
  it('deleting several words at once keeps a recovery copy; deleting a single word does not touch it',async()=>{
    const app=await start();
    await app.data.deleteWords(['Je']);                                                         // single: no copy
    assert.equal(await app.data.recoveryExport(),null);
    await app.data.deleteWords(['Bonjour','Merci']);                                            // bulk: copy of the state before
    assert.deepEqual(Object.keys(plain((await app.data.recoveryExport()).words)).sort(),['fr:tr:bonjour','fr:tr:chat','fr:tr:merci']);
  });
});

describe('Failed writes',()=>{
  it('a write that fails (storage full) is rolled back in memory and on disk, and the next write works',async()=>{
    const app=await start(),write=app.adapter.write.bind(app.adapter),before=plain(app.data.getDb());
    app.adapter.write=()=>Promise.reject(Object.assign(new Error('storage full'),{name:'QuotaExceededError'}));
    await assert.rejects(app.data.setStatus('Merci','active'),error=>error.name==='QuotaExceededError');
    assert.equal(status(app,'Merci'),'memorized');
    assert.deepEqual(plain(app.data.getDb()),before);
    assert.deepEqual(plain((await app.adapter.read()).db),before);
    app.adapter.write=write;await app.data.setStatus('Merci','active');assert.equal(status(app,'Merci'),'active');
  });
});
