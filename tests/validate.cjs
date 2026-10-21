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

describe('No AI and no API key (static guards)',()=>{
  const wordbaseJs=read('wordbase.js');
  it('nothing talks to an AI service or asks for a key: no Gemini request, key header, key field, key loader or Daily prompt in any shipped file',()=>{
    for(const file of ['index.html','a11y.js','pwa.js','screens.js','wordbase.js','packs.js','sw.js'])
      assert(!/generativelanguage|GEMINI_(?!API_KEY)|x-goog-api-key|apiKeyInput|apiToggleBtn|saveApiKey|getApiKey|addDailyWords|geminiControllers|responseSchema|dailyLoading/.test(read(file)),`${file} still has AI or API key code`);
    assert(!/id="(?:apiKeyInput|apiKeyLabel|apiKeyHint|loader|dailyLoadingOverlay)"/.test(html),'the key row, the AI loader and the Daily orb are gone from the markup');
  });
  it('no shipped file contains something that looks like an API key, and nothing logs one',()=>{
    for(const file of ['index.html','a11y.js','pwa.js','screens.js','screens.css','stats.js','packs.js','wordbase.js','sw.js','storage.js','manifest.webmanifest','README.md','tools/export-from-spa.js','tools/lock-shell.js','tools/shell-fingerprint.js'])
      assert(!/AIza[0-9A-Za-z_-]{35}/.test(read(file)),`${file} contains something that looks like an API key`);
    for(const [name,source] of [['index.html',html],['pwa.js',pwa]])assert(!/console\.\w+\([^)]*(apiKey|getApiKey|x-goog-api-key|SECRET_KEY)/i.test(source),`${name} logs the API key`);
  });
  it('a key that an earlier version stored is deleted at start-up, and a stored key is still no part of Schema v1 (exports and backups cannot contain it)',()=>{
    assert(/const VocVocSecrets=\{\s*forget\(\)\{[^]*?VOCVOC_SECRET_KEY,"GEMINI_API_KEY"[^]*?remove\(name\)/.test(html));
    assert(/DOMContentLoaded[^]*?VocVocSecrets\.forget\(\);/.test(html),'the old key is forgotten when the app starts');
    assert.throws(()=>vm.runInNewContext(`${storage};VocVocStorage.validate({schemaVersion:1,apiKey:'x'})`,{structuredClone}),/invalidData/);
  });
  it('"Add new words" takes the next words of the chosen level from the word database, counts them towards the daily goal, respects the free word limit and the daily goal, and asks about the next level when a level is used up',()=>{
    const add=html.slice(html.indexOf('async function addNewWords()'),html.indexOf('let pendingNextLevel'));
    assert(add.includes('wordbase.next(Math.min(10,remainingToday,room))'),'ten words at most, fewer when the daily goal or the free plan leaves less room');
    assert(add.includes('VocVocData.addWordBatch(words,{dailyCount:words.length})'),'the words count towards the daily goal');
    assert(add.indexOf('dailyLimitReached')<add.indexOf('wordbase.ready()')&&add.indexOf('wordbase.ready()')<add.indexOf('bandRoom(band)'),'the daily goal is checked first; the free allowance of the chosen level group once the course is known (before any chunk is downloaded)');
    assert(add.includes('freeWordLimitText(band)')&&html.includes('const band=window.VocVocWordbase?.bandOfWord(word);'),'a looked-up word uses the allowance of its own level group');
    assert(/offerNextLevel\(\);return \{status:"band-done"/.test(add)&&add.includes('t("levelEmpty")'),'no words left in the level: the level-up question, or the note that nothing is written for the level');
    const offer=html.slice(html.indexOf('function offerNextLevel()'),html.indexOf('// The random button'));
    assert(offer.includes('t(next?"levelUpAsk":"levelUpAll")'),'a next level is offered, or the whole course is reported finished');
    assert(/closeLevelUp\(accepted\)\{[^]*?VocVocData\.updateSettings\(\{difficulty:level\}\)/.test(offer+html.slice(html.indexOf('async function closeLevelUp'),html.indexOf('// The random button'))),'saying yes sets the level the way Settings does');
    assert(html.includes('onclick="addNewWords()"')&&!html.includes('addDailyWords'),'the header button runs the same function');
  });
  it('search, the random button and the synonym/antonym tags open the word database in the word window and never add by themselves; the user adds with the button',()=>{
    const search=html.slice(html.indexOf('async function handleSearch()'),html.indexOf('let appDataEpoch'));
    assert(search.includes('await openRelatedWordPopup(query);')&&!/addHistory|saveAndTouch|touchWord|addWordBatch/.test(search),'search only looks a word up');
    const random=html.slice(html.indexOf('async function randomWord()'),html.indexOf('function shuffle('));
    assert(random.includes('VocVocWordbase.random()')&&random.includes('openRelatedWordPopup(')&&!/addHistory|saveAndTouch|touchWord|addWordBatch/.test(random),'the random button only shows a word');
    const popup=html.slice(html.indexOf('async function getWordDataForPopup'),html.indexOf('function renderPopupStatus'));
    assert(popup.includes('VocVocWordbase.find(word)')&&!/addHistory|saveAndTouch|touchWord|addWordBatch/.test(popup),'looking a word up adds nothing');
    assert(/document\.addEventListener\("click",e=>\{\s*const badge=e\.target\.closest\("\.clickable-badge\[data-related-word\]"\);[^]*?openRelatedWordPopup\(word\.trim\(\)\)/.test(html),'a synonym or antonym tag opens the same window');
    assert(html.includes('data-add-related-word=')&&/async function addRelatedWordToList\(word\)\{[^]*?await addHistory\(word\);/.test(html),'only the Add button adds, with what the user saw (localDictionary)');
  });
  it('the word database is read through one module that only fetches files of ./packs/ and is part of the offline shell',()=>{
    const code=wordbaseJs.replace(/\/\*[^]*?\*\//g,'').replace(/\/\/.*$/gm,'');
    assert(!/\bdocument\b|\blocalStorage\b|\bindexedDB\b|XMLHttpRequest|WebSocket|sendBeacon/.test(code),'wordbase.js does not touch the page or storage');
    assert.equal((code.match(/\.fetch\(/g)||[]).length,1,'one network call, in fetchJson');
    const urls=[...code.matchAll(/env\.fetchJson\(([^,)]*)/g)].map(match=>match[1]);
    assert(urls.length>=4&&urls.every(argument=>/^'\.\/packs\/|^url$/.test(argument)),`only ./packs/ files are fetched: ${urls}`);
    assert(html.indexOf('./packs.js')<html.indexOf('./wordbase.js')&&html.indexOf('./wordbase.js')<html.indexOf('./screens.js'),'packs.js, then wordbase.js, then screens.js');
    assert(precacheList().includes('./wordbase.js')&&!precacheList().some(asset=>/(^|\/)packs\//.test(asset)),'the code is precached, never the pack files');
    assert(/const PACK_CACHE='vocvoc-packs-v1'/.test(wordbaseJs)&&!/vocvoc-packs/.test(sw),'the pack files live in their own cache that the worker never touches');
  });
  it('the language lists keep their choice but only Turkish (original) and French (learned) can be picked; the others are visible and disabled',()=>{
    assert(html.includes('const OPEN_LANGUAGES=Object.freeze({nativeLanguage:"tr",targetLanguage:"fr"});'));
    assert(/value!==OPEN_LANGUAGES\[field\]\)\{syncUiDropdown\(dropdownId,current\);return;\}/.test(html),'a language that is not open cannot be chosen even by calling the function');
    for(const [list,open] of [['nativeLanguageDropdown','tr'],['targetLanguageDropdown','fr']]){
      const body=html.slice(html.indexOf('id="'+list+'"'),html.indexOf('</div>',html.indexOf('id="'+list+'"')+300));
      const options=[...body.matchAll(/<button type="button" class="ui-dropdown-option([^"]*)" data-value="(\w+)"([^>]*)>/g)];
      assert.equal(options.length,6,list);
      for(const [,classes,value,rest] of options)assert.equal(/disabled/.test(rest)&&/locked/.test(classes),value!==open,`${list}: ${value}`);
    }
  });
});

describe('Tags, similar words, reset and the Profile page (static guards)',()=>{
  const screensJs=read('screens.js');
  it('a word of the list can be tagged: the tags are saved on the word record, validated in every backup, shown at the end of the word details and found by the History filter and by "#tag" in the search box',()=>{
    assert(/setWordTags:asynchronous\(setWordTags\)/.test(html)&&html.includes('const TAG_LIMITS=Object.freeze({perWord:12,length:24});'));
    assert(storage.includes("w.tags!=null&&(!Array.isArray(w.tags)"),'Schema v1 validates the optional tags list');
    assert(/\$\{renderTagsSection\(data\)\}\s*`;\s*\}/.test(html),'the tags come last in the details, so the tab order of the rest does not change');
    assert(/function renderTagsSection\(data\)\{[^]*?progress\.status==="archived"/.test(html),'only a word that is in the list (not the archive) can be tagged');
    assert(/if\(query\.startsWith\("#"\)\)\{showWordsWithTag\(query\.slice\(1\)\);return;\}/.test(html),'"#tag" in the search box shows the words with that tag');
    assert(html.includes('byTag=rawFilter.startsWith("#")')&&html.includes('tagHit'),'the History filter reads tags');
    assert(!/<form\b/.test(html),'tags are added with a field and a button, not a form');
  });
  it('the word window shows the words that look like what was typed: for a word that is not in the database and for one that was found',()=>{
    assert(/error\.similar=found\.similar\|\|\[\]/.test(html)&&html.includes('similarWordsHtml(popupSimilar.word===entry.word?popupSimilar.list:[])'));
    assert(html.includes('renderPopupStatus(area,word,e.message||t("detailsLoadError"),{error:true,similar:e.similar||[]})'));
    assert(read('wordbase.js').includes(".replace(/ı/g,'i')"),'a Turkish ı is an i');
  });
  it('a word that is already in the list shows only the note in the word window: the × closes it, there is no second Close button',()=>{
    const start=html.indexOf('const listed=!!VocVocData.getWordProgress(entry.word)'),listed=html.slice(start,html.indexOf('const card=renderWordPanel(area,entry,{',start));
    const [whenListed,whenNot]=listed.split(':`<div class="related-actions ui-panel-actions">');
    assert(whenListed.includes('related-listed')&&!/<button/.test(whenListed),'the listed word has no button at all');
    assert(whenNot.includes('related-add')&&whenNot.includes('related-cancel'),'a word that can be added keeps Add and Cancel');
  });
  it('resetting progress (or changing the language) also deletes the finished tests and the earned badges, with or without the new interface',()=>{
    assert(/function clearWordProgressOnly[^]*?VocVocScreens\?\.resetActivity\?\.\(\)/.test(html));
    assert(/function resetActivity\(\)\{store\.remove\(ACTIVITY_KEY\);window\.dispatchEvent\(new CustomEvent\('vocvoc-activity-reset'\)\);\}/.test(screensJs)&&/window\.VocVocScreens=Object\.freeze\(\{TEXT,PAGES,resetActivity\}\)/.test(screensJs));
    assert(screensJs.indexOf('function resetActivity()')<screensJs.indexOf('if(!enabled)return;'),'defined before the new interface switch');
  });
  it('the Profile page has no "back to the old interface" row any more',()=>{
    assert(!/oldUi|oldInterface/.test(screensJs));
  });
});

describe('Free allowance per level group, points for words, Premium cards and the card triangle (static guards)',()=>{
  const screensJs=read('screens.js'),screensCss=read('screens.css');
  it('the free plan gives 40 words from each of the six levels; the count comes from the words in the list (archived ones too) per level, not from a counter',()=>{
    assert(/const FREE_BAND_LIMIT=40;/.test(screensJs)&&/bandWordLimit\(\)\{return planNow\(\)==='premium'\?Infinity:FREE_BAND_LIMIT;\}/.test(screensJs));
    assert(/function bandRoom\(band\)\{[^]*?window\.VocVocWordbase\.progress\(band\)\.used/.test(html),'used = the words of that group that are in the list (archived included)');
    assert(/function progress\(band=bandOf\(\)\)/.test(read('wordbase.js'))&&read('wordbase.js').includes('function bandOfWord(word)'));
    assert(!/wordRoom|wordCap/.test(html),'the old limit on the whole list is gone');
  });
  it('points: eight things a word that is not memorized yet can earn (1+1+1+1+1+1+2+2 = 10), counted once, kept on the word record, saved in backups; the chips, the cards and the word windows take a tone',()=>{
    assert(html.includes('const STUDY_POINTS=Object.freeze({picked:1,heard:1,opened:1,explored:1,read:1,flipped:1,match:2,quiz:2});'));
    assert(/if\(!progress\|\|progress\.status!=="active"\|\|record\.study\?\.\[key\]===true\)return false;/.test(html),'only an active word earns points, each once');
    assert(storage.includes("['picked','heard','opened','explored','read','flipped','match','quiz'].includes(name)||done!==true"),'Schema v1 validates the optional study record');
    for(const hook of ['noteStudy(data.word,"picked")','toggleHistoryDetail(word,{fromChip:true})','noteStudy(q.word,"quiz")','noteStudy(flipSession.cards[flipSession.index].word,"flipped")','noteStudy(round.pairs[wordIndex].word,"match")','noteStudy(decodeDomText(card.dataset.word||""),"opened")','noteStudy(data.word,"opened")','details.dataset.studyFold!=="explored"','window.addEventListener("vocvoc-spoken"'])assert(html.includes(hook),hook);
    assert(/class="history-chip ui-pill\$\{isMem\?' memorized':''\} score-\$\{score\}"/.test(html)&&html.includes('class="card main-word-card score-$'+'{score}"'));
    for(let n=1;n<=10;n++)assert(html.includes('--score-color:var(--score-'+n+');--score-ink:var(--score-text-'+n+')'),'tone '+n);
    assert(html.includes('#contentArea .main-word-card[data-score]:not([data-score="0"]) .word-title,.word-detail-panel[data-score]:not([data-score="0"]) .word-title{color:var(--score-ink)}')&&!/\.main-word-card\[data-score\][^{]*\{[^}]*border-color/.test(html),'on the home screen and in the word windows the word takes the tone, not the card border');
    assert(html.includes('data-panel-word="${encodeDomText(data.word||"")}"')&&html.includes('.word-detail-panel[data-panel-word]'),'a word window follows the points of its word at once');
    assert(/\$\{renderStudySection\(data\)\}\$\{renderTagsSection\(data\)\}/.test(html),'the points come before the tags, both at the end of the details');
  });
  it('the read-aloud button of the new interface tells the app which word was read (a word, or a sentence or idiom of it) once the voice has started',()=>{
    assert(/function announceSpoken\(button\)\{[^]*?new CustomEvent\('vocvoc-spoken',\{detail:\{word,kind:info\.kind\}\}\)/.test(screensJs));
    assert(/if\(text&&speak\(button,text\)\)announceSpoken\(button\);/.test(screensJs)&&screensJs.includes("{kind:'sentence',word:()=>decodeDomText(host.closest('[data-study-word]')"),'a sentence belongs to the word whose window it is in');
  });
  it('the Premium page is a card for each plan (Free 0 USD, Premium 1.99 USD a month or 19.90 USD a year, two months free) with a Monthly / Yearly switch',()=>{
    assert(screensJs.includes('const PRICE={monthly:1.99,yearly:19.9,yearlyFull:23.88};')&&Math.abs(1.99*10-19.9)<1e-9&&Math.abs(1.99*12-23.88)<1e-9,'the year is ten months of the monthly price');
    assert(/class:'v2-plan v2-plan-free'/.test(screensJs)&&/class:'v2-plan v2-plan-premium'/.test(screensJs)&&screensJs.includes("class:'v2-billing'"));
    assert(/\.v2-plan-premium\{[^}]*background-color:#5b21b6;background-image:linear-gradient/.test(screensCss),'a solid colour under the gradient');
    assert(!/oldUi|freeIncludes/.test(screensJs));
  });
  it('the triangle of a main card is level with the word: it sits on the middle of the first title line without a height of its own, and the toggle lines its children up at the top',()=>{
    assert(html.includes('.main-word-toggle{align-items:flex-start !important}')&&html.includes('height:0 !important;\n    margin-top:calc(var(--main-title-size) * var(--line-tight) / 2) !important;'),'the triangle has no height of its own and sits on the middle of the first title line');
    assert(html.includes('.main-word-card:not(.open){--main-title-size:1.45rem}')&&html.includes('.main-word-card{--main-title-size:var(--font-3xl)}'));
  });
});

describe('Collapsible Points and Tags sections, the tag panel and the Matching test (static guards)',()=>{
  const screensJs=read('screens.js');
  it('the Points and Tags sections are closed every time a word is shown (nothing is remembered) and open one at a time: the badge with the total is the toggle of the Points, the + is the toggle of the Tags, the whole line is the target (no arrows, no "no tags yet" line)',()=>{
    assert(/function setSectionOpen\(section,open\)\{/.test(html)&&!/SECTION_PREF_KEY|VOCVOC_DETAIL_SECTIONS|sectionIsOpen/.test(html),'nothing is remembered');
    assert(html.includes('const head=event.target.closest(".study-section > .section-head,.tags-section > .section-head");'),'the whole line is the target');
    assert(html.includes('.section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:1.22rem;cursor:pointer}'),'at least as high as the arrow of a fold row (1.22rem), like the folds (a larger text makes both the same height)');
    assert(/\.section-add\{[^}]*border:0;border-radius:0;background:transparent;/.test(html),'the + has no circle around it');
    assert(html.includes('padding-top:8px!important;'),'less room above the word of an open card');
    assert(/<button type="button" class="study-total score-\$\{score\}" data-section-toggle="study" aria-expanded="\$\{open\}"/.test(html),'points: the badge is the toggle');
    assert(/<button type="button" class="section-add" data-section-toggle="tags" aria-expanded="\$\{open\}"/.test(html),'tags: the + is the toggle');
    assert(!/section-chevron|sectionToggleButton|data-tag-panel|is-adding|tag-empty|tagsNone/.test(html),'the arrows, the separate tag panel switch and the empty-tags line are gone');
    assert(html.includes('.tags-section,.study-section{border-top:1px solid var(--border);padding:13px 0 0;margin:13px 0 0}'),'a separator above the Points and above the Tags, spaced like the folds');
    assert(/document\.addEventListener\("input",event=>\{\s*if\(!event\.target\.classList\?\.contains\("tag-input"\)\)return;/.test(html)&&html.includes('tagExistingHtml(record,event.target.value)'),'typing narrows the tags in use');
    assert(html.includes('data-tag-new=')&&html.includes('aria-disabled="true"'),'a tag that is already on the word cannot be added twice; a new one is offered');
  });
  it('the meaning sits close under the line below the word, on the home cards and in the word windows',()=>{
    assert(html.includes('#contentArea .main-word-card.open .word-header{margin-bottom:6px!important}')&&html.includes('#contentArea .main-word-body{padding-top:4px!important}')&&html.includes('.word-detail-panel .word-panel-scroll-body{padding-top:6px!important}'));
    assert(html.includes('.meaning-section{margin-bottom:0}')&&html.includes('<div class="section meaning-section">'),'little room under the meaning');
  });
  it('a Flip card that is turned over earns a point for its word, and the Matching test is a mode of the quiz engine with its own page, card and test kind',()=>{
    assert(/function toggleFlip\(\)\{[^]*?if\(flipSession\.flipped\)\{\s*noteStudy\(flipSession\.cards\[flipSession\.index\]\.word,"flipped"\);[^]*?new CustomEvent\("vocvoc-flipped"\)/.test(html),'a Flip card turned over: a point for its word and one more flip for the badges');
    assert(/function startMatchQuiz\(\)\{[^]*?mode:"match"/.test(html)&&/function getMatchPool\(\)/.test(html)&&html.includes('if(quizSession.mode==="match"){renderMatchRound(area);return;}'));
    assert(/const QUIZ_ROUTES=\['test','recall','cloze','match'\];/.test(screensJs)&&screensJs.includes("card('⧉',t('studyMatch')")&&screensJs.includes("match:[getMatchPool,startMatchQuiz]"));
    assert(read('stats.js').includes("q.mode==='match'")&&screensJs.includes("['recall','cloze','match'].includes(quizSession.mode)"),'a finished Matching is recorded as a test of its own kind');
    assert(/for\(let guard=0;pairs\.length<4&&guard<400;guard\+\+\)/.test(html)&&html.includes('Array.from({length:10},()=>'),'ten rounds of four pairs');
  });
  it('the cards of the Words page: three lists (today, yesterday, earlier) each under a label, in each list the words with more points on top, the same points in the order they were pulled',()=>{
    assert(html.includes('eligible.sort((a,b)=>a.group-b.group||b.score-a.score||a.pulledAt-b.pulledAt||a.pulledAs-b.pulledAs);'),'the list, then the points, then the time and place of the pull');
    assert(html.includes('group:day===today?0:day===yesterday?1:2')&&html.includes('yesterday=dayOf(new Date(now.getFullYear(),now.getMonth(),now.getDate()-1))'),'the day of the pull: today, yesterday, earlier');
    assert(html.includes('class="section-title card-group-label" role="heading" aria-level="2"')&&html.includes('area.innerHTML=html+showMoreButton("cards",rest);'),'a label where a list starts');
    assert(html.includes('CARD_GROUP_KEYS=["groupToday","groupYesterday","groupEarlier"]'));
    for(const [language,today,yesterday,earlier] of [['en','Today','Yesterday','Earlier'],['tr','Bugün','Dün','Öncekiler'],['fr','Aujourd’hui','Hier','Plus tôt'],['de','Heute','Gestern','Früher'],['es','Hoy','Ayer','Anteriores'],['it','Oggi','Ieri','Precedenti']]){
      assert(html.includes(`groupToday:"${today}",groupYesterday:"${yesterday}",groupEarlier:"${earlier}",`),`${language}: labels of the three lists`);
    }
  });
  it('the search box offers words like a dictionary: a listbox under the combobox, from the third letter, never for a #tag, chosen words go through the normal search',()=>{
    assert(html.includes('role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="searchSuggest"')&&html.includes('<div id="searchSuggest" class="search-suggest" role="listbox" hidden></div>'));
    assert(html.includes('const SUGGEST_MIN_LETTERS=3;')&&html.includes('text.startsWith("#")||[...text].length<SUGGEST_MIN_LETTERS'),'three letters, no tags');
    assert(/function pickSuggestion\(word\)\{[^]*?handleSearch\(\);/.test(html)&&/async function handleSearch\(\)\{\s*closeSuggestions\(\);/.test(html),'a chosen word is searched for like a typed one');
    assert(read('wordbase.js').includes('if(state.status!==\'ready\')return [];'),'suggest never starts a download');
  });
  it('Test and Recall questions show the meaning without ???: parts spelled like the word are left out, the whole meaning when nothing else is left; entering the Words page draws the cards again',()=>{
    assert(html.includes('masked=cloze?"":quizPrompt(meaning,answer);')&&!html.includes('masked=cloze?"":maskQuizAnswer(meaning,answer);'));
    assert(html.includes('return kept.length?kept.join("; "):text;'),'the whole meaning when every part gives the word away');
    assert(screensJs.includes("if(was&&was!=='words')window.renderAllLocal?.();"),'coming back to the Words page redraws the cards');
  });
  it('the Premium card:the first line says what comes after the first 40 words of each level, the line about sentences from History is gone',()=>{
    assert(screensJs.includes("prem1:'Her seviyede ilk 40 kelimeden sonrası, 10 bine yakın kelime deposu'"),'Turkish line');
    assert(screensJs.includes("free1:'Altı seviyenin (A1–C2) her birinden 40’ar kelime hediye'")&&screensJs.includes("prem1:'Everything after the first 40 words of each level"),'the Free and Premium cards name the same 40 words');
    assert(!/prem2:/.test(screensJs)&&screensJs.includes("list(['prem1','prem3','prem4','prem5'],'v2-premium-list')"),'no sentence line in any language');
  });
  it('Settings: every setting is a panel (name at the left, choice or button at the right), a change is saved at once, there is no Save button, no footer and no line of text under the title',()=>{
    assert(!/settingsSaveBtn|settingsSubtitle|settings-panel-footer|settingsSub:/.test(html),'no Save button, no subtitle, no footer');
    assert(html.includes('<label id="archiveShowLabel" for="archiveShowBtn">')&&html.includes('<label id="resetProgressLabel" for="resetProgressBtn">'),'Show archive and Reset progress are rows with a button');
    assert(html.includes('.settings-panel-body > .settings-row{--ui-control-h:40px;display:flex;align-items:center;justify-content:space-between;'),'the panels');
    assert(html.includes('const autoSaveSettings=()=>saveSettings().catch(reportStorageError);')&&/if\(change==="difficulty"\|\|change==="theme"\|\|change==="fontSize"\)autoSaveSettings\(\);/.test(html)&&html.includes('data-ui-change="difficulty"'),'the dropdowns save when they change');
    assert(html.includes('document.addEventListener("change",e=>{if(e.target?.id==="dailyLimitInput")autoSaveSettings();});')&&/closeUiDropdowns\(\);closeDailyLimitMenu\(\);overlay\.style\.display='none';\s*if\(wasOpen\)autoSaveSettings\(\);/.test(html),'a typed limit is saved when the field is left or the dialog closes');
    assert(/const differs=/.test(html)&&html.includes('if(differs)await VocVocData.updateSettings(next);'),'nothing is written when nothing changed');
  });
  it('the Matching board has rows of one height (a tile as high as the longest one needs, at most twice the usual) and a tile with a long text scrolls inside itself without a scrollbar',()=>{
    assert(html.includes('.match-board{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;')&&html.includes('.match-col{display:contents}'),'equal rows, the two groups placed by row');
    assert(/\.match-item\{[^}]*min-height:56px;max-height:112px;overflow-y:auto;[^}]*scrollbar-width:none;/.test(html)&&html.includes('.match-item::-webkit-scrollbar{display:none}'),'twice the height at most, scrolls, no scrollbar');
    assert(html.includes('.match-text{margin:auto;max-width:100%}')&&html.includes('<span class=\"match-text\">'),'centred text that is never cut at the top');
  });
  it('the level is one of A1 A2 B1 B2 C1 C2 (an older "A1-A2" setting is read as A1), in Settings, the pack card and the free allowance',()=>{
    const packs=read('packs.js'),wordbase=read('wordbase.js');
    assert(packs.includes("const BANDS=Object.freeze({A1:['A1'],A2:['A2'],B1:['B1'],B2:['B2'],C1:['C1'],C2:['C2']});")&&packs.includes("const LEGACY_BANDS=Object.freeze({'A1-A2':'A1','B1-B2':'B1','C1-C2':'C1'});"));
    assert(wordbase.includes("const BAND_ORDER=Object.freeze(['A1','A2','B1','B2','C1','C2']);")&&wordbase.includes('const bandOf=()=>packs.normalizeBand(settings().difficulty);'));
    for(const level of ['A1','A2','B1','B2','C1','C2'])assert(html.includes('data-value="'+level+'" onclick="selectUiDropdown(\'difficultyDropdown\',\''+level+'\''),'Settings offers '+level);
    assert(!/data-value="(A1-A2|B1-B2|C1-C2)"/.test(html),'no group of two levels is offered any more');
    assert(html.includes('const normalizeLevel=value=>/^(A1|A2|B1|B2|C1|C2)$/.test(value)?value:({"A1-A2":"A1","B1-B2":"B1","C1-C2":"C1"})[value]||"A1";')&&html.includes('function levelOf(value){return VocVocData.normalizeLevel(value);}'),'the page reads a saved level the same way as VocVocPacks.normalizeBand');
    assert(screensJs.includes("const BAND_TEXT=Object.fromEntries(['A1','A2','B1','B2','C1','C2'].map(level=>[level,'packLevel'+level]));"));
  });
  it('the badges: first 10 points, first Recall and Matching test, more than 10 / 30 / 50 Flip cards, one for each level passed; each a gradient whose second colour is always purple',()=>{
    const stats=require('../stats.js'),ids=stats.BADGES.map(badge=>badge.id);
    for(const id of ['points10','recall1','match1','flip10','flip30','flip50','lvlA1','lvlA2','lvlB1','lvlB2','lvlC1','lvlC2','test1'])assert(ids.includes(id),id);
    assert.deepEqual(stats.BADGES.filter(badge=>badge.kind==='flips').map(badge=>badge.target),[11,31,51],'"more than 10" is 11');
    assert(html.includes('new CustomEvent("vocvoc-flipped")')&&screensJs.includes("window.addEventListener('vocvoc-flipped'")&&screensJs.includes('VocVocStats.appendFlip(readActivity())'));
    const css=read('screens.css');
    assert(/\.v2-earned \.v2-badge-icon\{background:linear-gradient\(135deg,var\(--badge-from,#2563eb\),#7c3aed\)/.test(css)&&/\.v2-medal\{[^}]*background:linear-gradient\(135deg,var\(--badge-from,#2563eb\),#7c3aed\)/.test(css),'the second colour of every badge is purple');
    assert(screensJs.includes('levelsDone:levelsDone(db)')&&screensJs.includes('points:pointsOf(db)'));
  });
  it('badges with a growing goal (memorized words, tests, streak days, Flip cards) are one card each: it goes quiet again with the next goal and keeps the goals reached; the saved ids did not change',()=>{
    const stats=require('../stats.js'),css=read('screens.css');
    assert.deepEqual([...new Set(stats.BADGES.filter(badge=>badge.family!==badge.id).map(badge=>badge.family))],['memo','test','streak','flip']);
    assert.equal(stats.groupBadges(stats.compute({words:[],quizzes:[],today:'2026-10-07'}).badges).length,17);
    assert(screensJs.includes('VocVocStats.groupBadges(badges)')&&screensJs.includes('function tierList(card)')&&screensJs.includes('card.tiers.length>1&&card.earned.length?tierList(card):null'),'the goals reached are listed on the card');
    assert(screensJs.includes("earned:cards.filter(card=>card.earned.length).sort((a,b)=>b.lastEarnedOn.localeCompare(a.lastEarnedOn))")&&screensJs.includes("started:cards.filter(card=>!card.earned.length&&card.current.progress>0)"),'a card stays in Earned while it works towards its next goal');
    assert(screensJs.includes("{n:badges.filter(badge=>badge.earnedOn).length,m:badges.length}"),'the summary still counts every goal reached');
    assert(/\.v2-tier-dot\{[^}]*background:linear-gradient\(135deg,var\(--badge-from,#2563eb\),#7c3aed\)/.test(css),'the goals reached are gradients ending in purple');
  });
  it('Add New Words throws every word it added out of a circle, one every second, in a big badge, in a random direction and in slow motion; the words stay on screen (inside it, clear of each other); the only way out is the button at the bottom; a word let go in the circle is replaced while the words are still coming; once every word is out the circle says New Word; reduced motion has none',()=>{
    const css=read('screens.css');
    const saved=html.indexOf('await VocVocData.addWordBatch(words,{dailyCount:words.length});'),announced=html.indexOf('window.dispatchEvent(new CustomEvent("vocvoc-words-added",{detail:{words:words.map(data=>data.word),more,replace}}));');
    assert(saved>0&&announced>saved&&html.indexOf('return {status:"added",words};')>announced,'announced once the words are saved');
    assert(screensJs.includes("window.addEventListener('vocvoc-words-added'")&&screensJs.includes('const FLING_EVERY=1000,')&&screensJs.includes('},Math.max(0,run.lastAt+FLING_EVERY-performance.now()));'),'one word every second');
    assert(screensJs.includes('const degrees=(previous+FLING_APART+Math.random()*(360-2*FLING_APART))%360')&&screensJs.includes('FLING_APART=50')&&screensJs.includes('const turn=Math.round(Math.random()*16-8)'),'random direction, never close to the last one');
    assert(screensJs.includes("window.matchMedia('(prefers-reduced-motion: reduce)').matches))return;"),'nothing for reduced motion');
    assert(screensJs.includes('FLING_EDGE=12,FLING_HINT=72,')&&screensJs.includes('halfH-FLING_EDGE-FLING_HINT-box.hy')&&screensJs.includes('const lap=placed.reduce('),'inside the screen above the hint, clear of the words that landed before');
    // the words are never faded out; only the button at the bottom, Escape, a change of page or a new run takes the screen away: touching the screen does nothing
    assert(/@keyframes v2-fling\{\s*from\{transform:[^\n]*\n\s*to\{transform:translate\(calc\(-50% \+ var\(--dx,0px\)\)[^\n]*\n\}/.test(css),'the throw is a move of its own after the fade in (and it ends with the words where they land)');
    assert(/\.v2-fling\{[^}]*font-size:1\.3rem[^}]*animation:v2-fling-in var\(--fling-fade,\.6s\) ease-out both,v2-fling var\(--fling-time,2\.6s\) cubic-bezier\(\.2,\.7,\.3,1\) var\(--fling-fade,\.6s\) forwards/.test(css)&&!/\.v2-orb-host\{[^}]*cursor:pointer/.test(css)&&!/\.v2-orb-host\{[^}]*pointer-events:none/.test(css)&&/\.v2-orb-host\.v2-leaving\{pointer-events:none/.test(css)&&css.includes('@media(prefers-reduced-motion:reduce){.v2-orb-host{display:none}}'));
    assert(!screensJs.includes("host.addEventListener('click'")&&!screensJs.includes('justDragged')&&screensJs.includes("const hint=h('button',{type:'button',class:'v2-orb-hint',onclick:dismissFling,text:t('addedTapClose')});")&&screensJs.includes("event.key==='Escape'")&&screensJs.includes("window.addEventListener('hashchange',dismissFling)")&&screensJs.includes("run.host.classList.toggle('v2-done',settled(run))"),'a tap, Escape or another page closes it; the hint comes when the last word has landed');
    assert(screensJs.includes("if(celebrationWaiting.length&&!celebrating)showCelebration();},FLING_LEAVE)")&&screensJs.includes('if(!celebrating&&!flingRun)showCelebration();'),'a new-badge card waits for it');
    assert(screensJs.includes("h('div',{id:'v2Orb',class:'v2-orb-host'},orb,newWord,hint,meaning)")&&screensJs.includes("h('div',{class:'v2-orb','aria-hidden':'true'},count)")&&screensJs.includes("h('span',{class:'v2-fling','aria-hidden':'true',"),'the circle and the words are decoration (the message of the added words is the app\'s own); the two buttons are not');
    // the page behind is blurred; a word fades in inside the circle (small enough to fit it) before it is thrown
    assert(/\.v2-orb-host\{[^}]*backdrop-filter:blur\(8px\)/.test(css)&&css.includes('@keyframes v2-fling-in{from{opacity:0;transform:translate(-50%,-50%) scale(calc(var(--fit,.8) * .7))}to{opacity:1;transform:translate(-50%,-50%) scale(var(--fit,.8))}}')&&screensJs.includes("badge.style.setProperty('--fit',Math.min(.8,orb.offsetWidth*.78/badge.offsetWidth).toFixed(2));"),'blur, fade in inside the circle');
    // a landed word can be held and moved: the others keep out of its way and drift a little with it; where it is let go it stays
    assert(screensJs.includes("badge.addEventListener('animationend',event=>{")&&screensJs.includes("if(event.animationName!=='v2-fling'||item.landed)return;")&&screensJs.includes("badge.style.animation='none';badge.style.opacity='1';badge.classList.add('v2-landed');")&&screensJs.includes("host.addEventListener('pointerdown',event=>{")&&screensJs.includes("node.classList.add('v2-held');")&&screensJs.includes('function away(box,held){')&&screensJs.includes('function wanted(run){')&&!screensJs.includes('FLING_FOLLOW')&&!screensJs.includes('function separate(')&&screensJs.includes('function dropWord(run){'),'words can be held and moved');
    assert(/\.v2-fling\.v2-landed\{pointer-events:auto;cursor:grab;touch-action:none/.test(css)&&/\.v2-fling\{[^}]*pointer-events:none/.test(css)&&/\.v2-orb-host\{[^}]*touch-action:none/.test(css),'only a landed word takes the pointer');
    // the others are pushed aside slowly; the held word's meaning shows at the bottom; a word let go inside the circle fades out and is memorized
    assert(screensJs.includes('FLING_EASE=500,')&&screensJs.includes("const meaning=h('p',{class:'v2-orb-meaning','aria-hidden':'true',lang:getNativeLanguageCode()});")&&screensJs.includes('const meaningOf=word=>')&&screensJs.includes("host.classList.toggle('v2-holding',!!meaning)"),'slow glide, the meaning of the held word');
    assert(screensJs.includes('function memorizeDropped(run,item){')&&screensJs.includes('Promise.resolve().then(()=>markMemorized(item.word)).catch(error=>reportStorageError(error)).then(()=>refill(run));')&&screensJs.includes("if(event.type==='pointerup'&&drag.moved&&inCircle(drag))memorizeDropped(run,drag.item);else dropWord(run);")&&screensJs.includes("item.node.style.transition='opacity '+FLING_GONE+'ms ease-out';item.node.style.opacity='0';"),'let go inside the circle: fades out and is memorized with the app\'s own action');
    // while the words are still coming a word let go in the circle is replaced by a new one (not counted towards the daily goal); when every word is out the circle says New Word and a press brings one more
    assert(html.includes('async function addNewWords({count=10,more=false,replace=false}={}){')&&html.includes('if(!replace&&remainingToday<=0){showError(t("dailyLimitReached"))')&&html.includes('{dailyCount:replace?0:words.length}')&&html.includes('if(!more)showError(t("wordsAdded"'),'the app can add single words that replace memorized ones');
    assert(screensJs.includes('async function refill(run){')&&screensJs.includes('await addNewWords({count:1,more:true,replace:true})')&&screensJs.includes('const word=run.queue.shift();')&&screensJs.includes('function extendFling(run,words){')&&screensJs.includes('if(detail.more&&flingRun&&!flingRun.leaving)')&&screensJs.includes("const replace=!run.host.classList.contains('v2-done');"),'a word let go while the words are still coming is replaced');
    assert(screensJs.includes("const newWord=h('button',{type:'button',class:'v2-orb-new',text:t('orbNewWord')});")&&screensJs.includes('result=await addNewWords({count:10,more:true});')&&screensJs.includes("if(result.status==='band-done')dismissFling();")&&/\.v2-orb-host\.v2-done \.v2-orb-new\{opacity:1;pointer-events:auto\}/.test(css)&&css.includes('body:has(#v2Orb) .app-alert-layer{z-index:12500!important}'),'the circle says New Word once every word is out; the app\'s messages show above the blurred screen');
    // a word pushed by hand (let go while it moves) goes on for a little, slowing down, and stops at the edge of the screen; one let go standing still stays
    assert(screensJs.includes('function flick(drag,now){')&&screensJs.includes('function coast(run,dt){')&&screensJs.includes('FLING_COAST=260,')&&screensJs.includes('FLING_SPEED=2400,')&&screensJs.includes('drag.coast=true;drag.vx=speed.x;drag.vy=speed.y;')&&screensJs.includes('if(Math.hypot(drag.vx,drag.vy)<FLING_REST)finishDrag(run,true);')&&screensJs.includes('coast(run,dt);')&&screensJs.includes('now-last.t>FLING_IDLE'),'coasting');
    // every batch of words comes in a gradient of its own (random, never the one before), all soft pastels with dark text on them; the circle's label is in two lines
    const palette=screensJs.slice(screensJs.indexOf('const FLING_GRADIENTS=['),screensJs.indexOf('];',screensJs.indexOf('const FLING_GRADIENTS=['))).match(/#[0-9a-f]{6}/g)||[];
    const luminance=hex=>{const [r,g,b]=[1,3,5].map(at=>parseInt(hex.slice(at,at+2),16)/255).map(value=>value<=.03928?value/12.92:Math.pow((value+.055)/1.055,2.4));return .2126*r+.7152*g+.0722*b;};
    assert(palette.length>=16&&palette.length%2===0&&new Set(palette.map((hex,index)=>index%2?'':palette[index]+palette[index+1])).size>=9,'at least eight different gradients');
    for(const hex of palette)assert((luminance(hex)+.05)/(luminance('#1e293b')+.05)>=4.5,'dark text on '+hex+' is below 4.5:1');
    for(const hex of palette)assert(luminance(hex)>=.45,hex+' is not a pastel (it is too dark)');
    assert(css.includes('color:#1e293b;font-size:1.3rem;'),'dark text on the pastel badges');
    assert(screensJs.includes('const randomGradient=avoid=>')&&screensJs.includes('(run.gradient=randomGradient(run.gradient))')&&screensJs.includes('run.freed.push(item.gradient)')&&screensJs.includes("badge.style.setProperty('--grad-from',gradient[0]);badge.style.setProperty('--grad-to',gradient[1]);")&&css.includes('linear-gradient(to top right,var(--grad-from,#bbf7d0),var(--grad-to,#ddd6fe))'),'a batch of its own colours, a replacement keeps the colours of the word it replaces');
    assert(screensJs.includes("lines=label.length>1?[label[0],label.slice(1).join(' ')]:label")&&css.includes('.v2-orb-new span{display:block}'),'the label of the circle is in two lines');
    // the held word hangs from the point it was grabbed by (gravity makes it sag around that point, sideways acceleration of the pointer swings it) and turns back to its tilt when let go
    assert(screensJs.includes('function swing(run,drag,dt){')&&screensJs.includes('function relax(item,dt){')&&screensJs.includes('const tiltBox=(item,degrees)=>')&&screensJs.includes('FLING_GRAVITY=600,')&&screensJs.includes('const alpha=(rx*FLING_GRAVITY+ry*drag.pa)/drag.inertia-FLING_SPRING*(drag.angle-base)-FLING_TWIST*drag.omega;')&&screensJs.includes('if(run.drag&&!run.drag.coast){swing(run,run.drag,dt);markOver(run,run.drag);}')&&screensJs.includes('if(!pivoted&&relax(item,dt))moving=true;')&&screensJs.includes("rotate('+item.rot.toFixed(2)+'deg)'")&&!screensJs.includes('grabX'),'the word hangs from where it was grabbed');
    // while a word is held the circle says "Memorized" in place of the count or "New Words", and goes back to it when the word is let go
    assert(screensJs.includes("memo=h('span',{class:'v2-orb-memo',text:t('orbMemorized')})")&&screensJs.includes("host.classList.add('v2-dragging')")&&screensJs.includes("host.classList.remove('v2-holding','v2-dragging');drag.item.node.classList.remove('v2-held');")&&screensJs.includes("run.host.classList.remove('v2-holding','v2-dragging','v2-over')")&&/\.v2-orb-host\.v2-dragging \.v2-orb-memo\{opacity:1\}/.test(css)&&/\.v2-orb-host\.v2-dragging \.v2-orb-new\{opacity:0;pointer-events:none\}/.test(css)&&/\.v2-orb\.v2-over \.v2-orb-memo\{color:var\(--v2-green\)\}/.test(css),'the circle says Memorized while a word is held');
    assert(/\.v2-orb-host\.v2-holding \.v2-orb-meaning\{opacity:1\}/.test(css)&&/\.v2-orb\.v2-over\{transform:scale\(1\.1\)/.test(css)&&/animation:v2-orb-in \.5s cubic-bezier\(\.2,1\.2,\.4,1\) backwards/.test(css),'the meaning replaces the hint; the circle shows that a word over it will be memorized (its entrance does not hold its end state)');
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
    assert(!/\beval\(|new Function\(/.test(screensCode));
    // the new interface has no network call of its own: the words come through wordbase.js
    assert.equal((screensCode.match(/\bfetch\(/g)||[]).length,0,'screens.js does not open network connections');
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
  it('the plan rules match the agreed product: Free by default with 40 words from each level and a 20-word daily goal, stats/sentences/speech/unlimited words are Premium, no AI and no key anywhere',()=>{
    const {win,events,storage}=load(),plan=win.VocVocPlan;
    assert.deepEqual([plan.get(),plan.has('stats'),plan.has('badges'),plan.has('freeWords'),plan.has('unlimitedWords')],['free',false,true,true,false]);
    assert.deepEqual(Object.entries(plan.features).filter(([,need])=>need==='premium').map(([name])=>name).sort(),['dailyGoalOver20','historyAnalysis','sentenceBuilder','speech','stats','unlimitedWords']);
    assert(!('ownKeyActive' in plan)&&!('ownKeyAi' in plan.features)&&!('builtInAi' in plan.features),'the own key and the built-in AI are not part of the plan any more');
    assert.deepEqual([plan.FREE_DAILY_LIMIT,plan.dailyLimitMax()],[20,20],'the free plan keeps the daily goal at 20 words');
    assert.deepEqual([plan.FREE_BAND_LIMIT,plan.bandWordLimit()],[40,40],'the free plan gives 40 words from each level');
    assert(!('wordLimit' in plan)&&!('FREE_WORD_LIMIT' in plan),'no single limit on the whole list any more');
    assert.equal(plan.has('somethingUnknown'),false);
    plan.set('premium');
    assert.deepEqual([plan.dailyLimitMax(),plan.bandWordLimit()],[Infinity,Infinity],'Premium has no limit on the daily goal or the words');
    assert.deepEqual([plan.get(),plan.has('stats'),plan.has('sentenceBuilder'),plan.has('speech'),plan.has('unlimitedWords'),storage.VOCVOC_SIM_PLAN,events.length],['premium',true,true,true,true,'premium',1]);
    plan.set('premium');assert.equal(events.length,1,'setting the same plan again is not a change');
    plan.set('free');assert.deepEqual([plan.get(),plan.bandWordLimit(),'VOCVOC_SIM_PLAN' in storage,events.length],['free',40,false,2]);
    assert.throws(()=>{'use strict';plan.features.stats='free';},TypeError);
    assert.equal(load({VOCVOC_SIM_PLAN:'garbage'}).win.VocVocPlan.get(),'free');
  });
  it('all six interface languages have exactly the same text keys and placeholders, and every page exists in all six with the same shape',()=>{
    const {TEXT,PAGES}=load().win.VocVocScreens,LANGUAGES=['de','en','es','fr','it','tr'];
    assert.deepEqual(Object.keys(TEXT).sort(),LANGUAGES);
    const holes=text=>[...String(text).matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort().join();
    for(const language of LANGUAGES){
      assert.deepEqual(Object.keys(TEXT[language]).sort(),Object.keys(TEXT.en).sort(),`${language}: text keys differ from English`);
      for(const [key,value] of Object.entries(TEXT[language])){
        assert(typeof value==='string'&&value.trim(),`${language}.${key} is empty`);
        assert.equal(holes(value),holes(TEXT.en[key]),`${language}.${key}: placeholders differ from English`);
      }
    }
    // a language that only repeats the English text has not been translated (a few words are the same in several languages)
    for(const language of ['de','es','fr','it','tr']){
      const same=Object.keys(TEXT.en).filter(key=>TEXT[language][key]===TEXT.en[key]);
      assert(same.length<=20,`${language}: ${same.length} texts are identical to English: ${same.join(', ')}`);
    }
    for(const [kind,page] of Object.entries(PAGES)){
      assert.deepEqual(Object.keys(page).sort(),LANGUAGES,kind);
      for(const language of LANGUAGES){
        assert.equal(page[language].sections.length,page.en.sections.length,`${kind}/${language}: different number of sections`);
        page[language].sections.forEach((section,index)=>{assert(section.h.trim(),`${kind}/${language}, section ${index}: heading`);assert.equal(section.p.length,page.en.sections[index].p.length,`${kind}/${language}, section ${index}`);});
        assert.equal(Boolean(page[language].banner),Boolean(page.en.banner),`${kind}/${language}: banner`);
      }
    }
    const draft={tr:'Taslak',en:'Draft',fr:'Brouillon',de:'Entwurf',es:'Borrador',it:'Bozza'};
    for(const kind of ['privacy','terms'])for(const language of LANGUAGES)assert(PAGES[kind][language].banner.startsWith(draft[language]),`${kind}/${language} must be marked as a draft`);
  });
  it('every text key the screens ask for exists, and no text key is left unused',()=>{
    const {TEXT}=load().win.VocVocScreens;
    const code=screensJs.slice(screensJs.indexOf('/* ---------- helpers'));                        // after the text tables
    const asked=new Set([
      ...[...code.matchAll(/\bt\('(\w+)'\)/g)].map(match=>match[1]),                              // t('key')
      ...[...code.matchAll(/list\(\[([^\]]*)\]/g)].flatMap(match=>[...match[1].matchAll(/'(\w+)'/g)].map(item=>item[1])),   // list(['free1',...])
      ...[...code.matchAll(/lockedScreen\('(\w+)','(\w+)'\)/g)].flatMap(match=>[match[1],match[2]]),
      ...[...code.matchAll(/\['(row\w+)','(\w+)'\]/g)].map(match=>match[1]),                       // ['rowHelp','help']
      ...['today','words','study','stats','profile']                                           // menu entries
    ]);
    for(const key of asked)assert(key in TEXT.en,`missing text key ${key}`);
    const badgeIds=require('../stats.js').BADGES.map(badge=>badge.id);
    for(const key of Object.keys(TEXT.en)){
      if(/^bd?_(\w+)$/.test(key)&&badgeIds.includes(key.replace(/^bd?_/,'')))continue;                // badge texts are looked up as t('b_'+id) / t('bd_'+id)
      if(/^packLevel(A1|A2|B1|B2|C1|C2)$/.test(key)&&code.includes("'packLevel'+level"))continue;       // the level on the pack card: BAND_TEXT is made from 'packLevel'+level
      assert(new RegExp(`'${key}'`).test(code),`text key ${key} is never used`);
    }
    for(const id of badgeIds)for(const language of ['tr','en','fr','de','es','it'])assert(TEXT[language]['b_'+id]&&TEXT[language]['bd_'+id],`badge ${id} has no ${language} name or description`);
    assert(code.includes("t('b_'+")&&code.includes("t('bd_'+"));
  });
  it('word packs are pure logic and load before the word module',()=>{
    const packsCode=read('packs.js').replace(/\/\*[^]*?\*\//g,'').replace(/\/\/.*$/gm,'');
    assert(!/\bdocument\b|\blocalStorage\b|\bfetch\(|\bXMLHttpRequest\b|\bindexedDB\b|\bcaches\b/.test(packsCode),'packs.js must not touch the page, storage or the network');
    assert(html.indexOf('<script src="./packs.js"></script>')>0&&html.indexOf('./packs.js')<html.indexOf('./wordbase.js'));
  });
  it('read-aloud is a Premium feature, and a free user cannot start speech',()=>{
    assert(/FEATURES=Object\.freeze\(\{[^}]*speech:'premium'/.test(screensJs));
    assert(/if\(!VocVocPlan\.has\('speech'\)\)\{toast\(t\('speakLocked'\)\);return;\}/.test(screensJs),'a free user must not be able to start speech');
  });
  it('Today has two buttons of the same size, "Add New Words" (green to purple) and "Go to My Words" (blue to purple), and Add New Words runs the app\'s own function',()=>{
    assert(/class:'ui-button v2-goal-add'[^]*?onclick:\(\)=>\{addNewFromToday\(\);\}\},t\('addNew'\)/.test(screensJs)&&/class:'ui-button v2-goal-words'[^]*?onclick:\(\)=>navigate\('words'\)\},t\('goWords'\)/.test(screensJs));
    assert(/const result=await addNewWords\(\);\s*if\(result\.status==='added'\)/.test(screensJs));
    assert(/\.v2-goal-actions \.ui-button\{flex:1 1 0;/.test(screensCss)&&!/\.v2-goal-actions \.ui-button:first-child/.test(screensCss),'both buttons share the width');
    assert(/\.v2-goal-add\{background:linear-gradient\(to top right,var\(--v2-grad-green\),var\(--v2-grad-purple\)\)\}/.test(screensCss)&&/\.v2-goal-words\{background:linear-gradient\(to top right,var\(--v2-grad-orange\),var\(--v2-grad-purple\)\)\}/.test(screensCss),'both gradients run from the lower left to the upper right: green-purple and orange-purple');
    const {TEXT}=load().win.VocVocScreens;
    assert.deepEqual([TEXT.tr.addNew,TEXT.tr.goWords],['Yeni Kelime Ekle','Kelimelerime Git']);
  });
  it('the ready-made words count a word of the chosen level once it is in the list, however it got there (the progress comes from the list, not from a counter)',()=>{
    assert(/isKnown:word=>!!VocVocData\.getWordProgress\(word\)/.test(read('wordbase.js')));
    assert(/const \{total,used\}=wordbase\.progress\(\);/.test(screensJs)&&screensJs.includes("window.addEventListener('vocvoc-storage-committed',refreshDashboard)"));
  });
  it('statistics and badges are pure logic (no page, no storage, no network), loaded before the screens that use them',()=>{
    const statsCode=read('stats.js').replace(/\/\*[^]*?\*\//g,'').replace(/\/\/.*$/gm,'');
    assert(!/\bdocument\b|\blocalStorage\b|\bsessionStorage\b|\bfetch\(|\bXMLHttpRequest\b|\bindexedDB\b/.test(statsCode),'stats.js must not touch the page, storage or the network');
    assert(html.indexOf('<script src="./stats.js"></script>')>0&&html.indexOf('./stats.js')<html.indexOf('./screens.js'));
    assert(/const ACTIVITY_KEY='VOCVOC_ACTIVITY_V1'/.test(screensJs)&&!/ACTIVITY_KEY/.test(storage+pwa),'the activity record is the new interface\'s own, not part of the app data or the backup');
  });
});

describe('Word card content (examples and idioms)',()=>{
  it('the words come from the word database only: no prompt, no response schema and no model call is left in the app',()=>{
    assert(!/examplesRule|GEMINI_SCHEMAS|generationConfig|promptWords|buildPrompt/.test(html));
  });
  it('the top bar keeps VocVoc, the separator and the page title in one line on a common baseline, and the profile photo has icon actions over its edge plus a larger view and a question before removing',()=>{
    const screensJs=read('screens.js'),screensCss=read('screens.css');
    assert(/class:'v2-bar-line'\},h\('span',\{class:'v2-brand'[^]*?barTitle\)/.test(screensJs)&&/\.v2-bar-line\{[^}]*align-items:baseline/.test(screensCss));
    assert(/\.v2-photo-wrap\{position:relative/.test(screensCss)&&/\.v2-photo-btn\{position:absolute/.test(screensCss));
    for(const piece of ["icon('edit')","icon('trash')",'function openPhotoView()','function askRemovePhoto()',"role:'alertdialog'",'onclick:askRemovePhoto','onclick:openPhotoView'])assert(screensJs.includes(piece),piece);
    assert(!/onclick:removePhoto/.test(screensJs),'removing a photo is asked first: only the confirmation may call removePhoto');
    assert(/closeConfirm\(false\);removePhoto\(\)/.test(screensJs));
  });
  it('the Fill in the blank test is part of the app: a mode of the same quiz engine, with its message in all six languages and a restart that starts the same kind',()=>{
    assert(/function startClozeQuiz\(\)\{[^]*?mode:"cloze"/.test(html)&&/function getClozePool\(\)/.test(html)&&/function blankSentence\(/.test(html));
    assert.equal((html.match(/clozeNeed:"/g)||[]).length,6,'one message per interface language');
    assert(html.includes("quizSession.mode==='cloze'?'startClozeQuiz()'"),'"new test" must start the same kind of test');
    assert(/q\.cloze\.text/.test(html)&&html.includes('quiz-cloze-hint'));
  });
  it('an idiom is shown as a pill with the sentence that uses it underneath, not with its own pronunciation and meaning (those only when it has no sentence)',()=>{
    const render=html.slice(html.indexOf('function renderWordDetailBody'),html.indexOf('async function removeMemorized'));
    assert(render.includes('<span class=\\"expression-pill\\">${esc(exp.text)}</span>')||render.includes('<span class="expression-pill">${esc(exp.text)}</span>'));
    const idioms=render.slice(render.indexOf('expressions.map(exp=>'));
    assert(/exp\.exampleText\s*\?`<div class="expression-example">[^]*?:`\$\{exp\.phonetic/.test(idioms),'the idiom\'s own pronunciation and meaning are only the fallback of a missing sentence');
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
  const sources=['index.html','pwa.js','a11y.js','storage.js','screens.js','stats.js','packs.js','wordbase.js'].map(read),everything=sources.join('\n');
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
  it('index.html carries one CSP meta tag, before any script, style or link, so nothing loads outside it',()=>{
    assert(meta,'no Content-Security-Policy meta tag');
    assert.equal(html.match(/http-equiv="Content-Security-Policy"/g).length,1);
    assert(html.indexOf(meta[0])<html.search(/<(?:script|style|link)\b/),'the policy must come before the first script, style or link');
  });
  it('connect-src allows this origin and nothing else; no directive names any other origin',()=>{
    assert.deepEqual(policy['connect-src'],["'self'"]);
    for(const [name,sources] of Object.entries(policy))for(const source of sources){
      assert(!/^https?:/.test(source),`${name} allows ${source}`);
      assert(!['*','data:','blob:',"'unsafe-eval'"].includes(source),`${name} allows ${source}`);
    }
    assert.deepEqual(policy['object-src'],["'none'"]);assert.deepEqual(policy['base-uri'],["'self'"]);assert.deepEqual(policy['form-action'],["'self'"]);
    assert.deepEqual(policy['worker-src'],["'self'"]);assert.deepEqual(policy['manifest-src'],["'self'"]);
  });
  it('the code needs nothing the policy forbids: no fetch in the page itself (wordbase.js reads this site\'s files), no eval, no external resources, no frames or forms',()=>{
    assert.equal([...appScript.matchAll(/\bfetch\(/g)].length,0,'index.html opens no network connection');
    for(const file of ['pwa.js','storage.js','a11y.js'])assert(!/\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/.test(read(file)),`${file} opens a network connection`);
    for(const [name,source] of [['index.html',html],['pwa.js',pwa],['storage.js',storage],['a11y.js',read('a11y.js')],['wordbase.js',read('wordbase.js')]]){
      assert(!/\beval\(|new Function\(|\bsetTimeout\(\s*["'`]|\bsetInterval\(\s*["'`]/.test(source),`${name} evaluates strings as code (needs 'unsafe-eval')`);
    }
    assert(!/(?:src|href|action)="https?:/i.test(html)&&!/url\(\s*["']?(?:https?:|data:)/i.test(html),'index.html loads an external or data: resource');
    assert(!/<(?:iframe|object|embed|form)\b/i.test(html));
  });
});

describe('Word list regressions',()=>{
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
