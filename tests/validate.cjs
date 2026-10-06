/* Release validation without a browser: syntax, manifest, Service Worker, and the guards that keep audited behaviour from regressing.
   Run: node --test --test-reporter=spec tests/validate.cjs   (npm test does this). Each test name says what must stay true. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html'),sw=read('sw.js'),pwa=read('pwa.js'),storage=read('storage.js');
const precacheList=()=>JSON.parse(sw.match(/const ASSETS=(\[[^;]+\]);/)[1].replaceAll("'",'"'));
const fileOf=asset=>asset==='./'?'index.html':asset.replace(/^\.\//,'');
// The part of the inline script that is code (the translation dictionary itself legitimately holds English text).
const withoutDictionary=text=>{const start=text.indexOf('const I18N={'),end=text.indexOf('\n};',start);return text.slice(0,start)+text.slice(end+3);};
const appScript=withoutDictionary(html.slice(html.indexOf('<script>'),html.lastIndexOf('</script>')));
const javascriptFiles=()=>{
  const out=[];
  for(const dir of ['.','tools','tests'])for(const name of fs.readdirSync(path.join(root,dir)))if(/\.(?:js|cjs)$/.test(name))out.push(path.posix.join(dir,name));
  return out.sort();
};

describe('JavaScript syntax',()=>{
  it('every shipped, tool and test JavaScript file parses',()=>{
    for(const file of javascriptFiles())cp.execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe'});
  });
  it('the inline scripts of index.html parse',()=>{
    const inline=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]).join('\n');
    assert.doesNotThrow(()=>new vm.Script(inline));
  });
  it('index.html only references files that exist',()=>{
    for(const match of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g))assert(fs.existsSync(path.join(root,match[1])),`${match[1]} is referenced but missing`);
  });
});

describe('Web app manifest',()=>{
  const manifest=JSON.parse(read('manifest.webmanifest'));
  it('describes an installable standalone app (name, start_url inside scope, colours)',()=>{
    for(const field of ['id','name','short_name','description'])assert.equal(typeof manifest[field],'string',`${field} is required`);
    assert.deepEqual([manifest.display,manifest.scope,manifest.start_url],['standalone','./','./']);
    for(const field of ['background_color','theme_color'])assert.match(manifest[field],/^#[0-9a-f]{6}$/i,field);
    assert.match(html,new RegExp(`<link rel="manifest" href="\\./manifest\\.webmanifest">`),'index.html must link the manifest');
  });
  it('every icon exists and has exactly the declared size; 192, 512 and a maskable 512 are present',()=>{
    for(const icon of manifest.icons){
      const bytes=fs.readFileSync(path.join(root,icon.src)),[width,height]=icon.sizes.split('x').map(Number);
      assert.equal(bytes.subarray(1,4).toString(),'PNG',`${icon.src} is not a PNG`);
      assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[width,height],`${icon.src} size`);
    }
    const has=(size,purpose)=>manifest.icons.some(icon=>icon.sizes===size&&icon.purpose===purpose);
    assert(has('192x192','any')&&has('512x512','any')&&has('512x512','maskable'));
  });
});

describe('Service Worker precache list (ASSETS)',()=>{
  it('lists existing files only, once each',()=>{
    const assets=precacheList();
    assert.equal(new Set(assets).size,assets.length,'duplicate entries');
    for(const asset of assets)assert(fs.existsSync(path.join(root,fileOf(asset))),`${asset} is precached but missing`);
  });
  it('covers every local file index.html loads (scripts, manifest, icons), so the app shell works offline',()=>{
    const assets=new Set(precacheList().map(fileOf));
    for(const match of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g))assert(assets.has(match[1]),`${match[1]} is loaded by index.html but not precached`);
    assert(assets.has('index.html'));
  });
  it('is a single, narrow worker: one registration, no Gemini URL, GET + same-origin only, owned caches only',()=>{
    assert.equal((html+pwa).match(/serviceWorker\.register\(/g).length,1);
    assert(!html.includes('indexedDB.'),'the page must not open IndexedDB directly');
    assert(!sw.includes('generativelanguage.googleapis.com'));
    assert(sw.includes("req.method!=='GET'||url.origin!==scope.origin"));
    assert(sw.includes('key!==CACHE'));
    assert(!/skipWaiting\(\)/.test(sw.slice(sw.indexOf("self.addEventListener('install'"),sw.indexOf("self.addEventListener('activate'"))),'install must not skip waiting');
  });
  it('installs all-or-nothing and verifies that the shell belongs to its VERSION',()=>{
    assert(sw.includes('SHELL_META')&&sw.includes('await caches.delete(CACHE)')&&sw.includes('repair=repair||precache()'));
    assert(pwa.includes('PWA_ACTIVATE_TIMEOUT_MS')&&pwa.includes('PWA_UPDATE_CHECK_MS'));
  });
  it('real handlers: Gemini and foreign requests are never intercepted; activation deletes only obsolete owned caches',async()=>{
    const listeners={},deleted=[],version=sw.match(/const VERSION='([^']+)'/)[1];
    const worker={URL,Request,Promise,self:{registration:{scope:'https://example.org/VocVoc/'},clients:{claim:async()=>{}},addEventListener:(name,callback)=>listeners[name]=callback,skipWaiting:async()=>{}},
      caches:{keys:async()=>['vocvoc-shell-%2FVocVoc%2F-old','vocvoc-shell-%2FVocVoc%2F-'+version,'other-cache'],delete:async key=>deleted.push(key),open:async()=>({addAll:async()=>{},match:async()=>({shell:true})})},fetch:async()=>({network:true})};
    vm.createContext(worker);vm.runInContext(sw,worker);
    let intercepted=0;
    listeners.fetch({request:new Request('https://generativelanguage.googleapis.com/v1',{method:'POST'}),respondWith(){intercepted++;}});
    listeners.fetch({request:new Request('https://example.org/private'),respondWith(){intercepted++;}});
    assert.equal(intercepted,0);
    let activation;listeners.activate({waitUntil:promise=>{activation=promise;}});await activation;
    assert.deepEqual(deleted,['vocvoc-shell-%2FVocVoc%2F-old']);
  });
});

describe('Service Worker cache VERSION',()=>{
  const {compute}=require('../tools/shell-fingerprint.js');
  const shell=compute(root),lock=JSON.parse(read('tests/shell-lock.json'));
  it('VERSION is bumped whenever ASSETS, an asset or sw.js changes (fails otherwise: users would keep the old cache)',()=>{
    assert.equal(shell.version,lock.version,`VERSION ${shell.version} is not recorded yet: run node tools/lock-shell.js`);
    assert.equal(shell.fingerprint,lock.fingerprint,`App shell (sw.js, ASSETS list or an asset) changed but VERSION ${shell.version} was not bumped`);
  });
  it('sw.js VERSION, the shell meta in index.html and BUILD_INFO.json agree',()=>{
    assert.equal((html.match(/<meta name="vocvoc-shell" content="([^"]+)"/)||[])[1],shell.version,'index.html shell meta must equal sw.js VERSION');
    assert.equal(JSON.parse(read('BUILD_INFO.json')).version,shell.version,'BUILD_INFO.json version must equal sw.js VERSION');
  });
  it('the guard itself works: it detects a changed asset byte, a changed ASSETS list and a changed sw.js, but ignores CRLF checkouts',()=>{
    const tamper=mutate=>{
      const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vocvoc-shell-'));
      try{for(const file of shell.files){fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(dir,file));}mutate(dir);return compute(dir);}
      finally{fs.rmSync(dir,{recursive:true,force:true});}
    };
    const edit=(file,change)=>dir=>{const target=path.join(dir,file);fs.writeFileSync(target,change(fs.readFileSync(target,'utf8')));};
    const unbumped=result=>result.version===lock.version&&result.fingerprint!==lock.fingerprint;
    assert(unbumped(tamper(edit('storage.js',text=>text+'\n// changed'))),'asset byte change must be detected');
    assert(unbumped(tamper(edit('sw.js',text=>text.replace("'./pwa.js',",'')))),'ASSETS list change must be detected');
    assert(unbumped(tamper(edit('sw.js',text=>text+'\n// changed'))),'sw.js change must be detected');
    assert.notEqual(tamper(edit('sw.js',text=>text.replace(`VERSION='${shell.version}'`,"VERSION='9.9.9'"))).version,lock.version);
    assert.equal(tamper(edit('index.html',text=>text.replace(/\r?\n/g,'\r\n'))).fingerprint,lock.fingerprint,'line endings must not matter');
  });
});

describe('API key handling (static guards)',()=>{
  it('the key travels only in the x-goog-api-key header, never in a URL',()=>{
    assert(!/generateContent\?key=/.test(html)&&html.includes('"x-goog-api-key":apiKey'));
    assert(!/[?&](?:key|api_key)=/i.test(html.match(/GEMINI_ENDPOINT=[^\n]*/)[0])&&!/\$\{apiKey\}|encodeURIComponent\(apiKey\)/.test(html));
  });
  it('no shipped file contains something that looks like an API key, and nothing logs it',()=>{
    for(const file of ['index.html','a11y.js','pwa.js','sw.js','storage.js','manifest.webmanifest','README.md','tools/export-from-spa.js','tools/lock-shell.js','tools/shell-fingerprint.js'])
      assert(!/AIza[0-9A-Za-z_-]{35}/.test(read(file)),`${file} contains something that looks like an API key`);
    for(const [name,source] of [['index.html',html],['pwa.js',pwa]])assert(!/console\.\w+\([^)]*(apiKey|getApiKey|x-goog-api-key|SECRET_KEY)/i.test(source),`${name} logs the API key`);
  });
  it('a stored key is not part of Schema v1, so exports and backups cannot contain it',()=>{
    assert.throws(()=>vm.runInNewContext(`${storage};VocVocStorage.validate({schemaVersion:1,apiKey:'x'})`,{structuredClone}),/invalidData/);
  });
  it('structured output and the Daily time budget are wired in',()=>{
    assert(html.includes('responseSchema')&&html.includes('GEMINI_SCHEMAS.words')&&html.includes('GEMINI_LIMITS.dailyBudgetMs')&&html.includes('geminiSchemaRefused'));
  });
});

describe('Word list regressions',()=>{
  it('the prompt word cap keeps the NEWEST 100 words: slice(0,100) on newest-first lists, never slice(-100)',()=>{
    assert(!/\.slice\(-100\)/.test(html));
    assert((html.match(/\.slice\(0,100\)/g)||[]).length>=2);
    assert(html.includes('...fresh.map(data=>normalizeHistoryKey(data.word)),...blocked'),'words accepted in this run must outrank History in the capped list');
  });
  it('archive keeps the source status for Restore/Undo, and renderWordCard never persists anything',()=>{
    assert(!/(?:swipe-armed|main-swipe-archive)\s*\{/.test(html));
    assert(!/max-height:\s*260px\s*[;!]/.test(html));
    assert(!/function renderWordCard[\s\S]*?(?:VocVocData\.(?:saveWord|setStatus|touchWord))/.test(html.split('function renderWordCard')[1]?.split('let archiveSelection')[0]||''));
    assert(html.includes('archiveWithSnapshot')&&html.includes('restoreArchivedProgress'));
  });
  it('interface language and destructive resets: appLanguage falls back to the native language; resets keep a recovery copy',()=>{
    assert(/return settings\.appLanguage\|\|settings\.nativeLanguage/.test(html)&&!/function getAppLanguage\(\)\{\s*return getNativeLanguageCode/.test(html));
    assert(/clearProgressAndWords:\(\)=>transaction\(clearProgressAndWords,\[\],\{backup:hasWords\}\)/.test(html)&&/changeLanguage:patch=>transaction\([^\n]*\{backup:hasWords\}\)/.test(html));
  });
});

describe('Storage safety (static guards)',()=>{
  it('persistent storage is requested, imports are capped at ~10 MB and go through one validated entry point',()=>{
    assert(pwa.includes('navigator.storage.persist()'));
    assert(storage.includes('MAX_IMPORT_BYTES=10*1024*1024')&&!/50\s*\*\s*1024/.test(storage+pwa));
    assert(pwa.includes('VocVocStorage.parseBackup(')&&!pwa.includes('JSON.parse(await file.text())'));
  });
  it('database failures and interface failures are told apart; a closed connection is reopened; bulk deletes keep a recovery copy',()=>{
    assert(pwa.includes('storage=initialization||isStorageFailure(error)')&&html.includes('showStorageBootError(error,{initialization:true})')&&html.includes('await VocVocData.init();}'));
    assert(storage.includes("error?.name==='InvalidStateError'&&!reopened")&&html.includes('deleteWords:words=>transaction(deleteWords,[words],{backup:'));
  });
});

describe('Performance guards (measured with tests/perf.cjs)',()=>{
  it('card details are built on first open, the footer observer is scoped, sorting uses one cached collator',()=>{
    assert(html.includes('<div class="main-word-body" hidden></div>')&&html.includes('function fillMainWordBody('),'main card details must be built lazily');
    assert(!/swipeFooterMutationObserver\.observe\(document\.body/.test(html),'the footer observer must not watch the whole document');
    assert(!/localeCompare\([a-z]+,getTargetLanguageCode\(\)/.test(html),'sorting must use the cached collator');
  });
});

describe('Localization',()=>{
  const grab=(source,name)=>vm.runInNewContext('('+source.match(new RegExp('const '+name+'=(\\{[\\s\\S]*?\\n\\})[;\\n]'))[1]+')');
  const I18N=grab(html,'I18N'),PWA=grab(pwa,'PWA_TEXT'),languages=['en','tr','fr','de','es','it'];
  it('every language defines exactly the English keys, none empty (interface and PWA texts)',()=>{
    for(const [name,table] of [['I18N',I18N],['PWA_TEXT',PWA]]){
      assert.deepEqual(Object.keys(table).sort(),[...languages].sort(),`${name} must cover exactly the supported languages`);
      const keys=Object.keys(table.en).sort();
      for(const lang of languages){
        assert.deepEqual(Object.keys(table[lang]).sort(),keys,`${name}.${lang} must define exactly the English keys`);
        for(const key of keys)assert(typeof table[lang][key]==='string'&&table[lang][key].trim(),`${name}.${lang}.${key} is empty`);
      }
    }
  });
  it('every translation key the code asks for exists',()=>{
    const asked=[...html.matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"/g),...html.matchAll(/setText\("[^"]+","([A-Za-z0-9_]+)"\)/g)].map(match=>match[1]);
    for(const key of asked)assert(key in I18N.en,`t("${key}") is used but not defined`);
    for(const key of [...pwa.matchAll(/\bpwaText\(\s*'([A-Za-z0-9_]+)'/g)].map(match=>match[1]))assert(key in PWA.en,`pwaText('${key}') is used but not defined`);
  });
  it('the Turkish interface has no English UI words left (Flip and Test are feature names)',()=>{
    for(const [key,value] of Object.entries(I18N.tr))if(!['flip','test'].includes(key))assert(!/\b(History|Settings|Archive|Delete|Cancel|Close|Undo|Search|Reset|Save|Daily|Random)\b/.test(value),`Turkish text still has English UI words: ${key} = ${value}`);
  });
  it('no user-visible English is hard-coded in the code, and "unlimited" is decided by one helper',()=>{
    for(const literal of ['aria-label="Close"','aria-label="Swipe actions"','Word details could not be loaded'])assert(!appScript.includes(literal),`hard-coded English in script: ${literal}`);
    assert(!/sınırsız\|sinirsiz\|unlimited/i.test(appScript.replace(/const UNLIMITED_SPELLINGS[^\n]*/,'')),'"unlimited" must be decided by isUnlimitedText only');
    assert(appScript.includes('function isUnlimitedText(')&&(appScript.match(/isUnlimitedText\(/g)||[]).length>=4);
  });
});
