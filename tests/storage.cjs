/* Data-layer regression tests for storage.js (IndexedDB adapter, Schema v1 validation, backup files) on an in-memory IndexedDB.
   Run: node --test --test-reporter=spec tests/storage.cjs   (npm test does this). Every test starts from an empty database. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const {IDBFactory}=require('fake-indexeddb');
const ctx={indexedDB:null,structuredClone,setTimeout,clearTimeout,CustomEvent:class{},dispatchEvent(){}};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../storage.js'),'utf8'),ctx);
const storage=vm.runInContext('VocVocStorage',ctx);
const fresh=()=>({schemaVersion:1,meta:{},settings:{nativeLanguage:'tr',targetLanguage:'fr',difficulty:'A1-A2',dailyLimit:'10',theme:'system',fontSize:'normal'},words:{},aliases:{},progress:{},dailyUsage:{date:null,count:0}});
const codeIs=code=>error=>error.storageCode===code;
const open=async()=>{const adapter=new storage.IndexedDBAdapter();await adapter.initialize(()=>fresh());return adapter;};
beforeEach(()=>{ctx.indexedDB=new IDBFactory();});

describe('IndexedDB adapter',()=>{
  it('first start builds the database once and marks the migration complete',async()=>{
    const adapter=new storage.IndexedDBAdapter();let builds=0;
    await adapter.initialize(()=>{builds++;return fresh();});
    assert.equal(builds,1);assert.equal((await adapter.read()).migration.phase,'complete');adapter.close();
  });
  it('a transaction that aborts leaves the data and the revision untouched',async()=>{
    const adapter=await open(),db=fresh();db.meta.test='before';await adapter.write(db);const revision=adapter.revision;
    await assert.rejects(adapter.transaction('readwrite',(tx,set,abort)=>{tx.objectStore('state').put({...db,meta:{test:'aborted'}},'schema-v1');abort(new Error('forced abort'));}),/forced abort/);
    const stored=await adapter.read();assert.equal(stored.db.meta.test,'before');assert.equal(stored.revision,revision);adapter.close();
  });
  it('restarting never repeats the migration (idempotent) and keeps the stored data',async()=>{
    const adapter=await open(),db=fresh();db.meta.test='before';await adapter.write(db);
    adapter.close();await adapter.initialize(()=>{throw new Error('migration must not repeat');});
    assert.equal((await adapter.read()).db.meta.test,'before');adapter.close();
  });
  it('a second tab writing with a stale revision is rejected (optimistic concurrency)',async()=>{
    const first=await open(),second=await open(),db=fresh();
    await first.write({...db,meta:{test:'new'}});
    await assert.rejects(second.write({...db,meta:{test:'stale'}}),codeIs('conflict'));
    assert.equal((await first.read()).db.meta.test,'new');first.close();second.close();
  });
  it('a restore (backup:true) keeps a recovery copy of the data it replaced',async()=>{
    const adapter=await open(),db=fresh();db.meta.test='original';await adapter.write(db);
    const before=(await adapter.read()).db;
    await adapter.write({...db,meta:{test:'imported'}},{backup:true});
    assert.deepEqual(await adapter.recoveryBackup(),before);adapter.close();
  });
  it('an interrupted first-run migration leaves nothing behind and completes on the next start',async()=>{
    const adapter=new storage.IndexedDBAdapter();await adapter.open();
    const transaction=adapter.transaction.bind(adapter);
    adapter.transaction=(mode,work)=>transaction(mode,mode==='readwrite'?(tx,set,abort)=>{work(tx,set,abort);abort(new Error('migration interrupted'));}:work);
    await assert.rejects(adapter.initialize(()=>fresh()),/migration interrupted/);
    adapter.transaction=transaction;
    const left=await adapter.read();assert.equal(left.db,undefined);assert.equal(left.migration,undefined);
    await adapter.initialize(()=>fresh());assert.equal((await adapter.read()).migration.phase,'complete');adapter.close();
  });
  it('two tabs starting at once end up with the same single database',async()=>{
    const a=new storage.IndexedDBAdapter(),b=new storage.IndexedDBAdapter();
    const [first,second]=await Promise.all([a.initialize(()=>({...fresh(),meta:{tab:'a'}})),b.initialize(()=>({...fresh(),meta:{tab:'b'}}))]);
    assert.deepEqual(first,second);assert.equal((await a.read()).migration.phase,'complete');a.close();b.close();
  });
  it('a browser without IndexedDB is reported as "unavailable"',async()=>{
    ctx.indexedDB=null;
    await assert.rejects(new storage.IndexedDBAdapter().open(),codeIs('unavailable'));
    await assert.rejects(new storage.IndexedDBAdapter().read(),codeIs('unavailable'));
  });
  it('a closed connection is reopened on demand (silent close and browser close event)',async()=>{
    const adapter=await open(),revision=(await adapter.read()).revision;
    adapter.db.close();assert.equal((await adapter.read()).revision,revision); // the handle died silently: InvalidStateError, reopened once
    adapter.db.onclose();assert.equal(adapter.db,null);
    const next=fresh();next.meta.reopened='yes';await adapter.write(next);assert.equal((await adapter.read()).db.meta.reopened,'yes');adapter.close();
  });
  it('storage wiped behind the app never accepts a stale write',async()=>{
    const adapter=await open();adapter.close();
    ctx.indexedDB=new IDBFactory();
    await assert.rejects(adapter.write(fresh()),codeIs('conflict'));
    assert.equal((await adapter.read()).db,undefined);adapter.close();
  });
  it('a damaged revision record is treated as corrupt data',async()=>{
    const adapter=await open(),revision=adapter.revision;
    await adapter.transaction('readwrite',tx=>tx.objectStore('control').put('abc','revision'));
    await assert.rejects(adapter.read(),codeIs('invalidData'));
    await adapter.transaction('readwrite',tx=>tx.objectStore('control').put(revision,'revision'));
    assert.equal((await adapter.read()).revision,revision);adapter.close();
  });
  it('start-up reads a complete database once; a first run still re-reads what it wrote',async()=>{
    const adapter=new storage.IndexedDBAdapter();let reads=0;const read=adapter.read.bind(adapter);adapter.read=()=>{reads++;return read();};
    await adapter.initialize(()=>fresh());assert.equal(reads,3,'first run: read, read back the insert, read back the completed marker');
    adapter.close();reads=0;await adapter.initialize(()=>{throw new Error('migration must not repeat');});assert.equal(reads,1,'complete database: one read');
    assert.equal(adapter.revision,(await read()).revision);adapter.close();
  });
});

describe('Schema v1 validation',()=>{
  const withProgress=patch=>{const d=fresh();d.words['fr:tr:a']={id:'fr:tr:a',word:'a',normalized:'a',targetLanguage:'fr',nativeLanguage:'tr'};d.aliases['fr:tr:a']='fr:tr:a';d.progress['fr:tr:a']={wordId:'fr:tr:a',status:'active',...patch};return d;};
  it('rejects other schema versions, secret fields and prototype keys',()=>{
    assert.throws(()=>storage.validate({...fresh(),schemaVersion:2}));
    assert.throws(()=>storage.validate({...fresh(),apiKey:'no'}));
    assert.throws(()=>storage.validate({...fresh(),words:JSON.parse('{"__proto__":{}}')}));
  });
  it('accepts an optional interface language and rejects invalid ones',()=>{
    const withApp=language=>({...fresh(),settings:{...fresh().settings,appLanguage:language}});
    storage.validate(withApp('en'));storage.validate(fresh());
    assert.throws(()=>storage.validate(withApp(5)));assert.throws(()=>storage.validate(withApp('English!')));
  });
  it('a vocabulary word called "secret" is not mistaken for a secret field',()=>{
    const word={id:'fr:tr:secret',word:'secret',normalized:'secret',targetLanguage:'fr',nativeLanguage:'tr'},db=fresh();
    db.words[word.id]=word;db.aliases[word.id]=word.id;storage.validate(db);
  });
  it('bounds the nesting depth instead of overflowing the stack',()=>{
    let deep={},cursor=deep;for(let i=0;i<40;i++){cursor.n={};cursor=cursor.n;}
    assert.throws(()=>storage.validate({...fresh(),meta:{deep}}),codeIs('invalidData'));
  });
  it('checks progress timestamps and meta field types',()=>{
    storage.validate(withProgress({firstSeenAt:'2026-01-01',memorizedAt:null,archivedAt:null}));
    assert.throws(()=>storage.validate(withProgress({firstSeenAt:5})));assert.throws(()=>storage.validate(withProgress({archivedAt:{}})));
    assert.throws(()=>storage.validate({...fresh(),meta:{updatedAt:5}}));assert.throws(()=>storage.validate({...fresh(),meta:{starterWordsInitialized:'yes'}}));
  });
});

describe('Backup files (parseBackup)',()=>{
  const text=object=>JSON.stringify(object),good={exportVersion:1,exportedAt:'2026-01-01T00:00:00.000Z',...fresh()};
  const rejects=(label,input,bytes)=>assert.throws(()=>storage.parseBackup(input,bytes),codeIs('invalidData'),label);
  it('accepts a valid export, including a file of exactly the 10 MB limit',()=>{
    assert.equal(storage.parseBackup(text(good)).db.schemaVersion,1);
    assert.equal(storage.maxImportBytes,10*1024*1024);
    storage.parseBackup(text(good),storage.maxImportBytes);
  });
  it('rejects corrupt, empty, non-object and wrongly versioned files',()=>{
    rejects('truncated JSON','{"exportVersion":1,"schemaV');rejects('empty','');rejects('null','null');rejects('array','[]');rejects('scalar','5');rejects('not a string',undefined);
    rejects('export version',text({...good,exportVersion:2}));rejects('missing export version',text(fresh()));rejects('schema version',text({...good,schemaVersion:2}));
    rejects('exportedAt type',text({...good,exportedAt:5}));
  });
  it('rejects a file carrying an API key, also when nested (a backup can never restore a secret)',()=>{
    rejects('secret key',text({...good,apiKey:'x'}));rejects('nested secret',text({...good,meta:{GEMINI_API_KEY:'x'}}));
  });
  it('rejects a file over 10 MB using the real file size, not the text length',()=>{
    rejects('over the limit',text(good),storage.maxImportBytes+1);
  });
});
