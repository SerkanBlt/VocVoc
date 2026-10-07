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
  it('declares its language and install screenshots: real PNGs of the declared size, a narrow and a wide one',()=>{
    assert.match(manifest.lang,/^[a-z]{2}(?:-[A-Z]{2})?$/);
    assert(manifest.screenshots.length>=2);
    for(const shot of manifest.screenshots){
      const bytes=fs.readFileSync(path.join(root,shot.src)),[width,height]=shot.sizes.split('x').map(Number);
      assert.equal(bytes.subarray(1,4).toString(),'PNG',`${shot.src} is not a PNG`);
      assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[width,height],`${shot.src} size`);
      assert(Math.min(width,height)>=320&&Math.max(width,height)<=3840&&Math.max(width,height)/Math.min(width,height)<=2.3,`${shot.src} is outside what Chrome accepts`);
      assert.equal(shot.form_factor,width>height?'wide':'narrow',`${shot.src} form_factor`);
      assert.equal(typeof shot.label,'string');
    }
    assert(manifest.screenshots.some(shot=>shot.form_factor==='narrow')&&manifest.screenshots.some(shot=>shot.form_factor==='wide'));
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
    for(const file of ['index.html','a11y.js','pwa.js','screens.js','screens.css','stats.js','sw.js','storage.js','manifest.webmanifest','README.md','tools/export-from-spa.js','tools/lock-shell.js','tools/shell-fingerprint.js'])
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

describe('New interface (prototype)',()=>{
  const screensJs=read('screens.js'),screensCss=read('screens.css'),screensCode=screensJs.replace(/\/\*[^]*?\*\//g,'');   // code without the comments
  // Run screens.js on its own, as a page that did not ask for the new interface would: it must only define the plan helper.
  function load(storage={}){
    const events=[],win={dispatchEvent:event=>events.push(event)};
    const sandbox={window:win,location:{search:'',hash:''},URLSearchParams,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},
      localStorage:{getItem:key=>key in storage?storage[key]:null,setItem:(key,value)=>{storage[key]=String(value);},removeItem:key=>{delete storage[key];}}};
    vm.runInNewContext(screensJs,sandbox);
    return {win,events,storage};
  }
  it('is loaded by index.html, has no inline handlers, and builds nodes without innerHTML except for its own icons',()=>{
    assert(html.includes('<link rel="stylesheet" href="./screens.css">')&&html.includes('<script src="./screens.js"></script>'));
    assert(!/\bon(?:click|input|change|keydown)\s*=/.test(screensCode),'screens.js must not use inline handlers');
    assert.equal((screensCode.match(/innerHTML/g)||[]).length,1,'only the icon helper may use innerHTML');
    assert(!/\beval\(|new Function\(|fetch\(/.test(screensCode));
    assert(/body\.v2/.test(screensCss)&&!/^\s*(?:body|html|\.container)\s*\{/m.test(screensCss),'the stylesheet must not restyle the default interface');
  });
  it('the hooks the new interface relies on are in the app: the Test draws into a named host, and it announces drawing and adopted data',()=>{
    assert(html.includes('function quizHost(){return document.getElementById("v2QuizHost")||document.getElementById("contentArea");}'));
    assert(/function renderQuizQuestionContent\(\)\{\s*if\(!quizSession\)return;\s*const area=quizHost\(\);/.test(html),'the Test must draw into quizHost()');
    assert(/function focusQuizControl\(\)\{[^]*?const area=quizHost\(\)/.test(html));
    assert(html.includes('document.dispatchEvent(new CustomEvent("vocvoc-quiz-rendered"))'));
    assert(/async function adoptExternalChange\(\)\{[^]*?window\.dispatchEvent\(new CustomEvent\("vocvoc-data-adopted"\)\);\s*\}/.test(html));
  });
  it('does nothing visible unless asked: without ?ui=v2 it only defines the plan helper',()=>{
    const {win}=load();
    assert.deepEqual(Object.keys(win).sort(),['VocVocPlan','VocVocScreens','dispatchEvent']);
  });
  it('the plan rules match the agreed product: Free by default, stats/AI/sentences/speech are Premium, the own key is off while Premium is on',()=>{
    const {win,events,storage}=load(),plan=win.VocVocPlan;
    assert.deepEqual([plan.get(),plan.has('stats'),plan.has('badges'),plan.has('ownKeyAi'),plan.has('freeWords'),plan.ownKeyActive()],['free',false,true,true,true,true]);
    assert.deepEqual(Object.entries(plan.features).filter(([,need])=>need==='premium').map(([name])=>name).sort(),['builtInAi','historyAnalysis','sentenceBuilder','speech','stats']);
    assert.equal(plan.has('somethingUnknown'),false);
    plan.set('premium');
    assert.deepEqual([plan.get(),plan.has('stats'),plan.has('sentenceBuilder'),plan.has('speech'),plan.has('builtInAi'),plan.ownKeyActive(),storage.VOCVOC_SIM_PLAN,events.length],['premium',true,true,true,true,false,'premium',1]);
    plan.set('premium');assert.equal(events.length,1,'setting the same plan again is not a change');
    plan.set('free');assert.deepEqual([plan.get(),plan.ownKeyActive(),'VOCVOC_SIM_PLAN' in storage,events.length],['free',true,false,2]);
    assert.throws(()=>{'use strict';plan.features.stats='free';},TypeError);
    assert.equal(load({VOCVOC_SIM_PLAN:'garbage'}).win.VocVocPlan.get(),'free');
  });
  it('Turkish and English texts have exactly the same keys and every page has both languages with the same shape',()=>{
    const {TEXT,PAGES}=load().win.VocVocScreens;
    assert.deepEqual(Object.keys(TEXT.tr).sort(),Object.keys(TEXT.en).sort());
    for(const [language,table] of Object.entries(TEXT))for(const [key,value] of Object.entries(table))assert(typeof value==='string'&&value.trim(),`${language}.${key} is empty`);
    for(const [kind,page] of Object.entries(PAGES)){
      assert.deepEqual(Object.keys(page).sort(),['en','tr'],kind);
      assert.equal(page.tr.sections.length,page.en.sections.length,`${kind}: different number of sections`);
      page.tr.sections.forEach((section,index)=>assert.equal(section.p.length,page.en.sections[index].p.length,`${kind}, section ${index}`));
      assert.equal(Boolean(page.tr.banner),Boolean(page.en.banner),`${kind}: banner`);
    }
    for(const draft of ['privacy','terms'])assert(PAGES[draft].tr.banner.startsWith('Taslak')&&PAGES[draft].en.banner.startsWith('Draft'),`${draft} must be marked as a draft`);
  });
  it('every text key the screens ask for exists, and no text key is left unused',()=>{
    const {TEXT}=load().win.VocVocScreens;
    const code=screensJs.slice(screensJs.indexOf('/* ---------- helpers'));                        // after the text tables
    const asked=new Set([
      ...[...code.matchAll(/\bt\('(\w+)'\)/g)].map(match=>match[1]),                              // t('key')
      ...[...code.matchAll(/list\(\[([^\]]*)\]/g)].flatMap(match=>[...match[1].matchAll(/'(\w+)'/g)].map(item=>item[1])),   // list(['free1',...])
      ...[...code.matchAll(/lockedScreen\('(\w+)','(\w+)'\)/g)].flatMap(match=>[match[1],match[2]]),
      ...[...code.matchAll(/\['(row\w+)','(\w+)'\]/g)].map(match=>match[1]),                       // ['rowHelp','help']
      ...['today','study','stats','badges','profile']                                            // tab labels
    ]);
    for(const key of asked)assert(key in TEXT.en,`missing text key ${key}`);
    const badgeIds=require('../stats.js').BADGES.map(badge=>badge.id);
    for(const key of Object.keys(TEXT.en)){
      if(/^bd?_(\w+)$/.test(key)&&badgeIds.includes(key.replace(/^bd?_/,'')))continue;                // badge texts are looked up as t('b_'+id) / t('bd_'+id)
      assert(new RegExp(`'${key}'`).test(code),`text key ${key} is never used`);
    }
    for(const id of badgeIds)for(const language of ['tr','en'])assert(TEXT[language]['b_'+id]&&TEXT[language]['bd_'+id],`badge ${id} has no ${language} name or description`);
    assert(code.includes("t('b_'+")&&code.includes("t('bd_'+"));
  });
  it('statistics and badges are pure logic (no page, no storage, no network), loaded before the screens that use them',()=>{
    const statsCode=read('stats.js').replace(/\/\*[^]*?\*\//g,'').replace(/\/\/.*$/gm,'');
    assert(!/\bdocument\b|\blocalStorage\b|\bsessionStorage\b|\bfetch\(|\bXMLHttpRequest\b|\bindexedDB\b/.test(statsCode),'stats.js must not touch the page, storage or the network');
    assert(html.indexOf('<script src="./stats.js"></script>')>0&&html.indexOf('./stats.js')<html.indexOf('./screens.js'));
    assert(/const ACTIVITY_KEY='VOCVOC_ACTIVITY_V1'/.test(screensJs)&&!/ACTIVITY_KEY/.test(storage+pwa),'the activity record is the new interface\'s own, not part of the app data or the backup');
  });
});

describe('Card controls',()=>{
  it('memorizing and closing are swipes: no status buttons under cards, popups or Flip (the Flip M shortcut stays)',()=>{
    for(const leftover of ['data-card-memorize','data-card-dismiss','data-word-status','data-flip-status','word-status-actions','flip-actions','renderCardActions','renderStatusActions'])
      assert(!html.includes(leftover),`${leftover} is still in index.html`);
    assert(html.includes('renderSwipeFooter(isMem)')&&html.includes('renderSwipeFooter(false,{dismissLeft:true})'),'the swipe hints must stay');
    assert(/e\.key==="m"\|\|e\.key==="M"\)\)\{e\.preventDefault\(\);toggleFlipMemorized\(\);\}/.test(html),'the Flip M shortcut must stay');
  });
  it('the Flip previous/next arrows have no border of their own',()=>{
    const rules=[...html.matchAll(/\.flip-(?:stage|panel) \.flip-nav[^{]*\{([^}]*)\}/g)].map(match=>match[1]);
    assert(rules.length>=3);
    assert(rules.some(body=>/border:0\b/.test(body)),'the arrows must reset their border');
    for(const body of rules)assert(!/border-(?:left|right|top|bottom)\s*:\s*[1-9]/.test(body)&&!/border\s*:\s*[1-9]/.test(body),`a Flip arrow rule draws a border: ${body}`);
  });
});

describe('Code hygiene',()=>{
  const sources=['index.html','pwa.js','a11y.js','storage.js','screens.js','stats.js'].map(read),everything=sources.join('\n');
  it('no function is defined and then never used (dead code stays out)',()=>{
    const escape=name=>name.replace(/\$/g,'\\$');
    const dead=[];
    for(const text of sources)for(const name of new Set([...text.matchAll(/(?:^|[\s;{}])(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1])))
      if((everything.match(new RegExp(`(?<![\\w$.])${escape(name)}(?![\\w$])`,'g'))||[]).length<=1)dead.push(name);
    assert.deepEqual(dead,[],`defined but never used: ${dead.join(', ')}`);
  });
  it('maps keyed by user-typed words have no prototype, so a word named __proto__ cannot corrupt them',()=>{
    assert(/const localDictionary=Object\.assign\(Object\.create\(null\),\{/.test(html));
    assert(/function getSavedWordMap\(\)\{\s*const db=getDb\(\),map=Object\.create\(null\);/.test(html));
  });
  it('the backup file name uses the local date, not the UTC date',()=>{
    assert(/function backupDateStamp\(/.test(pwa)&&pwa.includes('${backupDateStamp()}')&&!/download=`[^`]*toISOString/.test(pwa));
  });
});

describe('Release checksums',()=>{
  const checksums=require('../tools/update-checksums.js');
  it('SHA256SUMS lists real files, matches their bytes and leaves out generated output',()=>{
    const problems=checksums.verify(root);
    assert.deepEqual(problems,[],`SHA256SUMS is out of date (run "npm run checksums"): ${problems.join('; ')}`);
    const names=checksums.parse(read('SHA256SUMS')).map(entry=>entry.file);
    for(const generated of ['SHA256SUMS','tests/browser-results.json','tests/package-lock.json'])assert(!names.includes(generated),`${generated} must not be listed`);
    assert(names.includes('index.html')&&names.includes('sw.js')&&names.includes('tests/fixtures/spa-v1.html'));
  });
  it('hashing ignores the line endings of text files (a CRLF checkout agrees with LF everywhere) but never touches binary files',()=>{
    const lf=Buffer.from('a\nb\n'),crlf=Buffer.from('a\r\nb\r\n'),png=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x00,0x0a]);
    assert.equal(checksums.hashOf(crlf),checksums.hashOf(lf));
    assert.notEqual(checksums.hashOf(png),checksums.hashOf(Buffer.from([0x89,0x50,0x4e,0x47,0x0a,0x00,0x0a])));
    assert.notEqual(checksums.hashOf(Buffer.from('a\nb')),checksums.hashOf(lf));
  });
});

describe('Content Security Policy (static guards)',()=>{
  const meta=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/);
  const policy=Object.fromEntries((meta?.[1]||'').split(';').map(part=>part.trim().split(/\s+/)).filter(parts=>parts[0]).map(([name,...sources])=>[name,sources]));
  const geminiOrigin=new URL(html.match(/GEMINI_ENDPOINT="([^"]+)"/)[1]).origin;
  it('index.html carries one CSP meta tag, before any script, style or link, so nothing loads outside it',()=>{
    assert(meta,'no Content-Security-Policy meta tag');
    assert.equal(html.match(/http-equiv="Content-Security-Policy"/g).length,1);
    assert(html.indexOf(meta[0])<html.search(/<(?:script|style|link)\b/),'the policy must come before the first script, style or link');
  });
  it('connect-src allows this origin and the Gemini API, nothing else; no directive names any other origin',()=>{
    assert.deepEqual(policy['connect-src'],["'self'",geminiOrigin]);
    for(const [name,sources] of Object.entries(policy))for(const source of sources){
      assert(!/^https?:/.test(source)||source===geminiOrigin,`${name} allows ${source}`);
      assert(!['*','data:','blob:',"'unsafe-eval'"].includes(source),`${name} allows ${source}`);
    }
    assert.deepEqual(policy['object-src'],["'none'"]);assert.deepEqual(policy['base-uri'],["'self'"]);assert.deepEqual(policy['form-action'],["'self'"]);
    assert.deepEqual(policy['worker-src'],["'self'"]);assert.deepEqual(policy['manifest-src'],["'self'"]);
  });
  it('the code needs nothing the policy forbids: one fetch (Gemini), no eval, no external resources, no frames or forms',()=>{
    const fetches=[...appScript.matchAll(/\bfetch\(([^)]*)/g)].map(match=>match[1]);
    assert.equal(fetches.length,1);assert(fetches[0].includes('GEMINI_ENDPOINT'));
    for(const file of ['pwa.js','storage.js','a11y.js'])assert(!/\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/.test(read(file)),`${file} opens a network connection`);
    for(const [name,source] of [['index.html',html],['pwa.js',pwa],['storage.js',storage],['a11y.js',read('a11y.js')]]){
      assert(!/\beval\(|new Function\(|\bsetTimeout\(\s*["'`]|\bsetInterval\(\s*["'`]/.test(source),`${name} evaluates strings as code (needs 'unsafe-eval')`);
    }
    assert(!/(?:src|href|action)="https?:/i.test(html)&&!/url\(\s*["']?(?:https?:|data:)/i.test(html),'index.html loads an external or data: resource');
    assert(!/<(?:iframe|object|embed|form)\b/i.test(html));
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
  it('only a running Test counts as an open operation: a finished one (result still on screen) must not block an update',()=>{
    assert(/function quizRunning\(\)\{return !!quizSession&&quizSession\.index<quizSession\.questions\.length;\}/.test(pwa));
    const busy=pwa.match(/function operationBusy\(\)\{([^]*?)\n\}/)[1];
    assert(busy.includes('quizRunning()')&&!busy.includes('!!quizSession'),'operationBusy must ask quizRunning(), not whether a session object exists');
    assert(/!document\.getElementById\("searchInput"\)\.value\.trim\(\)&&!quizSession\)renderAllLocal\(\)/.test(html),'adopting another tab\'s data must not replace a Test result');
  });
  it('another tab\'s commit is adopted only while this tab is idle; a busy tab keeps its data and shows the banner',()=>{
    assert(pwa.includes('channel.onmessage=event=>syncExternalCommit(event.data)'));
    assert(/if\(operationBusy\(\)\)\{showPwaUpdate\(true\);return;\}\s*await adoptExternalChange\(\);/.test(pwa),'the busy check must come before the adoption');
    assert(/async function adoptExternalChange\(\)\{[^]*?await VocVocData\.refresh\(\);/.test(html)&&!/channel\.onmessage=\(\)=>showPwaUpdate/.test(pwa));
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
