/* npm install --prefix tests; npx playwright install chromium; node tests/browser.cjs
   Optional PWA_BROWSER_PATH points to a compatible Chromium executable. */
const {chromium}=require('playwright'),fs=require('fs'),http=require('http'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),original=path.resolve(root,'tests/fixtures/spa-v1.html');
let serveNext=false,skew=null,server,browser;const results=[]; // serveNext: serve the next deploy; skew: 'meta' = HTML still carries the old shell version, 'icon' = one shell asset is missing
const shellVersion=fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/VERSION='([^']+)'/)[1],nextVersion=shellVersion.replace(/\d+$/,n=>String(Number(n)+1));
const record=(name)=>{results.push(name);console.log('PASS',name)};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function seed(n=100){const words={},aliases={},progress={};for(let i=0;i<n;i++){const word='word'+i,id='fr:tr:'+word;words[id]={id,word,normalized:word,targetLanguage:'fr',nativeLanguage:'tr',meaning:'meaning '+i,type:'noun',synonyms:[],antonyms:[],examples:[],expressions:[],createdAt:'2026-01-01',updatedAt:'2026-01-01'};aliases[id]=id;progress[id]={wordId:id,status:i%3===0?'memorized':i%3===1?'active':'archived',firstSeenAt:'2026-01-01',lastSeenAt:'2026-01-01',statusChangedAt:'2026-01-01',memorizedAt:null,archivedAt:i%3===2?'2026-01-01':null,archiveSourceStatus:i%3===2?'memorized':null};}return {schemaVersion:1,meta:{starterWordsInitialized:true},settings:{nativeLanguage:'tr',targetLanguage:'fr',difficulty:'A1-A2',dailyLimit:'10',theme:'system',fontSize:'normal'},words,aliases,progress,dailyUsage:{date:'2026-10-05',count:7}};}
async function main(){
 server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let file=url.pathname==='/baseline.html'?original:path.join(root,url.pathname.replace(/^\/VocVoc\//,''));if(url.pathname==='/VocVoc/')file=path.join(root,'index.html');try{if(serveNext&&skew==='icon'&&url.pathname.endsWith('/icons/maskable-512.png')){res.writeHead(404);res.end('missing');return;}let data=fs.readFileSync(file);if(serveNext&&file.endsWith('sw.js'))data=Buffer.from(data.toString().replace(`VERSION='${shellVersion}'`,`VERSION='${nextVersion}'`));if(serveNext&&file.endsWith('index.html')){let html=data.toString().replace('<title>VocVoc</title>','<title>VocVoc update test</title>');if(skew!=='meta')html=html.replace(`name="vocvoc-shell" content="${shellVersion}"`,`name="vocvoc-shell" content="${nextVersion}"`);data=Buffer.from(html);}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.png')?'image/png':'text/html');res.end(data);}catch(_){res.writeHead(404);res.end('missing');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,url=base+'/VocVoc/';
 const launch={headless:true};if(process.env.PWA_BROWSER_PATH){launch.executablePath=process.env.PWA_BROWSER_PATH;launch.args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'];}
 browser=await chromium.launch(launch);
 // Every context of the suite reports Content Security Policy violations: a normal session must never trigger one (the CSP scenario at the end causes one on purpose and removes it).
 const cspViolations=[],rawNewContext=browser.newContext.bind(browser);
 browser.newContext=async(...args)=>{const c=await rawNewContext(...args);
  await c.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>{if(!window.__cspExpected)console.error('CSP-VIOLATION '+e.violatedDirective+' '+e.blockedURI);},true));
  c.on('console',m=>{if(/CSP-VIOLATION|Content Security Policy/i.test(m.text()))cspViolations.push(m.text());});return c;};
 const errors=[];let context=await browser.newContext();await context.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{window.bootRenderCounts={history:0,content:0};for(const [name,key] of [['renderHistory','history'],['renderAllLocal','content']]){const original=window[name];window[name]=(...args)=>{bootRenderCounts[key]++;return original(...args);};}}));let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const ready=async(p=page)=>{await p.waitForFunction(()=>document.getElementById('storageBoot').hidden);await p.evaluate(()=>VocVocData.flush());};
 const goTo=async(p,label)=>{await p.locator('.v2-menu-btn').click();await p.locator('.v2-nav-item',{hasText:label}).click();};   // the menu replaced the tab bar
 await page.goto(url);await ready();assert.equal(await page.evaluate(()=>VocVocData.getHistoryWords().length),3);assert.equal(await page.evaluate(()=>VocVocRegression.run().passed),true);assert.deepEqual(await page.evaluate(()=>bootRenderCounts),{history:1,content:1});assert.equal(await page.locator('#storageBoot').isVisible(),false);record('fresh initialization + 12 SPA guards + one main render pass');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await ready();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);assert.equal((await page.evaluate(()=>VocVocPWARegression.run())).passed,true);record('online load/reload + worker activation + PWA guards');
 // Network failure path and UI must not mutate data.
 await page.evaluate(()=>VocVocSecrets.setApiKey('test-not-a-real-key'));
 const before=await page.evaluate(()=>JSON.stringify(VocVocData.getDb()));await context.setOffline(true);await page.evaluate(()=>fetchFromGeminiREST('network','test-not-a-real-key'));assert.equal(await page.evaluate(()=>JSON.stringify(VocVocData.getDb())),before);assert.equal(await page.locator('#loader').evaluate(el=>el.style.display),'none');assert.match(await page.locator('#appAlertLayer').innerText(),/İnternet/);record('offline Gemini: localized error, no data change, spinner clears');
 await page.reload();await ready();assert.equal(await page.evaluate(()=>VocVocData.getHistoryWords().length),3);record('offline reload app shell + IndexedDB');
 await page.close();page=await context.newPage();await page.goto(url);await ready();record('offline cold tab start after installation');
 await context.setOffline(false);await context.close();
 // Same-origin migration is atomic, preserves source + secret separation, and is not repeated.
 context=await browser.newContext();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const source=seed(1000);
 await context.addInitScript(db=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('VOCVOC_DB_V1',JSON.stringify(db));localStorage.setItem('VOCVOC_SECRET_GEMINI_API_KEY','secret-test-value');sessionStorage.setItem('seeded','1');}},source);
 const started=Date.now();await page.goto(url);await ready();const startupMs=Date.now()-started;
 assert.deepEqual(await page.evaluate(()=>VocVocData.getDb()),source);assert.equal(await page.evaluate(()=>localStorage.getItem('VOCVOC_DB_V1')),JSON.stringify(source));assert(await page.evaluate(()=>localStorage.getItem('VOCVOC_MIGRATION_BACKUP_V1')));assert.equal(await page.evaluate(async()=> (await VocVocStorage.adapter.read()).migration.phase),'complete');record('1000-word migration exact match + retained localStorage + verified marker');
 await page.evaluate(()=>markMemorized('word1'));await page.reload();await ready();assert.equal(await page.evaluate(()=>VocVocData.getWordProgress('word1').status),'memorized');record('memorize -> reload');
 const snapshot=await page.evaluate(()=>VocVocData.getWordProgress('word1'));
 await page.evaluate(async()=>{const state=await archiveWord('word1');showArchiveUndoToast(state);});assert.equal(await page.evaluate(()=>VocVocData.getWordProgress('word1').status),'archived');await page.evaluate(()=>undoLastArchive());await page.reload();await ready();assert.deepEqual(await page.evaluate(()=>VocVocData.getWordProgress('word1')),snapshot);record('memorized archive -> exact Undo -> reload');
 await page.evaluate(()=>removeMemorized('word1'));const active=await page.evaluate(()=>VocVocData.getWordProgress('word1'));await page.evaluate(async()=>showArchiveUndoToast(await archiveWord('word1')));await page.evaluate(()=>undoLastArchive());await page.reload();await ready();assert.deepEqual(await page.evaluate(()=>VocVocData.getWordProgress('word1')),active);record('active archive -> exact Undo -> reload');
 await page.evaluate(()=>archiveWord('word1'));await page.reload();await ready();assert.equal(await page.evaluate(()=>VocVocData.getWordProgress('word1').status),'archived');await page.evaluate(()=>VocVocData.restoreArchived(['word1']));await page.reload();await ready();assert.equal(await page.evaluate(()=>VocVocData.getWordProgress('word1').status),'memorized');record('archive persists + Restore keeps SPA memorized semantics');
 await page.evaluate(()=>VocVocData.deleteWords(['word2']));await page.reload();await ready();assert.equal(await page.evaluate(()=>VocVocData.getWordByText('word2')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('VOCVOC_DB_V1')),JSON.stringify(source));record('delete -> reload does not resurrect from retained migration source');
 await page.evaluate(()=>VocVocData.addDailyUsage(3));const daily=await page.evaluate(()=>VocVocData.getDailyUsage());await page.reload();await ready();assert.deepEqual(await page.evaluate(()=>VocVocData.getDailyUsage()),daily);record('dailyUsage persistence');
 await page.evaluate(()=>VocVocData.updateSettings({theme:'dark',fontSize:'large',difficulty:'B1-B2',dailyLimit:'20'}));await page.reload();await ready();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');assert.equal(await page.evaluate(()=>document.documentElement.dataset.fontSize),'large');record('settings/theme/font persistence');
 await page.evaluate(async()=>{await VocVocData.saveAndTouch({word:'Écoute',meaning:'listen'},'écouter');await VocVocData.touchWord('écouter');});assert.equal(await page.evaluate(()=>VocVocData.getHistoryWords().filter(w=>w==='Écoute').length),1);assert.equal(await page.evaluate(()=>VocVocData.getWordByText('écouter').id),'fr:tr:ecoute');record('canonical alias + Unicode + no duplicate History');
 await page.evaluate(()=>{startQuiz();});const quiz=await page.evaluate(()=>quizSession.questions);assert.equal(quiz.length,10);assert.equal(new Set(quiz.map(q=>q.word)).size,10);assert.equal(await page.evaluate(()=>quizSession.questions.every(q=>VocVocData.getWordProgress(q.word).status==='active')),true);
 await page.evaluate(()=>startRecallQuiz());assert.equal(await page.evaluate(()=>quizSession.questions.length),10);assert.equal(await page.evaluate(()=>quizSession.questions.every(q=>VocVocData.getWordProgress(q.word).status==='memorized')),true);record('Test / Recall correct distinct 10-word pools; archived excluded');
 await page.evaluate(()=>{quizSession=null;renderAllLocal();startFlip();toggleFlipFilter('includeOther');});assert.equal(await page.evaluate(()=>flipSession.cards.every(c=>VocVocData.getWordProgress(c.word).status==='memorized')),true);await page.evaluate(()=>toggleFlipFilter('includeMemorized'));assert.equal(await page.evaluate(()=>flipSession),null);record('Flip filters + exit behavior');
 await page.evaluate(()=>{document.getElementById('historyFilterInput').value='word1';document.getElementById('historySort').value='az';renderHistory();});assert(await page.locator('.history-chip').count());assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.history-chip')].every(el=>el.textContent.toLowerCase().includes('word1'))),true);record('History filter/sort');
 await page.evaluate(()=>toggleHistoryDetail('word1'));await pause(100);assert.equal(await page.evaluate(()=>getPageScroller().classList.contains('popup-scroll-locked')),true);await page.evaluate(()=>closeHistoryDetail());await pause(100);assert.equal(await page.evaluate(()=>getPageScroller().classList.contains('popup-scroll-locked')),false);record('popup background lock / release');
 // Explicit awaited mutations: failed commit cannot leak an optimistic memory update.
 const prior=await page.evaluate(()=>JSON.stringify(VocVocData.getDb()));assert.equal(await page.evaluate(async()=>{const adapter=VocVocStorage.adapter,write=adapter.write;adapter.write=()=>Promise.reject(new DOMException('full','QuotaExceededError'));try{await VocVocData.setStatus('word1','active');return false;}catch(_){return true;}finally{adapter.write=write;}}),true);assert.equal(await page.evaluate(()=>JSON.stringify(VocVocData.getDb())),prior);record('quota/write failure rollback retains committed runtime data');
 const backup=await page.evaluate(()=>VocVocData.export());assert(!JSON.stringify(backup).includes('secret-test-value'));assert.equal(backup.exportVersion,1);await page.evaluate(()=>VocVocData.setStatus('word1','active'));const preImport=await page.evaluate(()=>VocVocData.getDb());await page.evaluate(data=>VocVocData.import(data),backup);const imported=await page.evaluate(()=>VocVocData.getDb()),expected=Object.fromEntries(Object.entries(backup).filter(([k])=>!['exportVersion','exportedAt'].includes(k)));expected.meta.updatedAt=imported.meta.updatedAt;assert.deepEqual(imported,expected);const recovery=await page.evaluate(()=>VocVocStorage.adapter.recoveryBackup());assert.deepEqual(recovery,preImport);record('secret-free export + transactional restore + recovery snapshot');
 const valid=await page.evaluate(()=>JSON.stringify(VocVocData.getDb()));const invalidCases=[{...backup,schemaVersion:2},{...backup,progress:{bad:{wordId:'bad',status:'active'}}},{...backup,apiKey:'secret'},{...backup,exportVersion:9}];for(const invalid of invalidCases){assert.equal(await page.evaluate(async data=>{try{await VocVocData.import(data);return false;}catch(_){return true;}},invalid),true);}assert.equal(await page.evaluate(()=>JSON.stringify(VocVocData.getDb())),valid);record('invalid imports reject without changing data');
 // Second tab cannot overwrite a newer revision with a stale snapshot.
 const other=await context.newPage();await other.goto(url);await ready(other);await other.evaluate(()=>{window.syncExternalCommit=()=>{};}); // a tab that never received the broadcast (frozen in the background)
 await page.evaluate(()=>VocVocData.setStatus('word1','active'));assert.equal(await other.evaluate(async()=>{try{await VocVocData.setStatus('word1','memorized');return false;}catch(e){return e.storageCode==='conflict';}}),true);await other.close();record('multi-tab stale writer rejected');
 await context.setOffline(true);await page.reload();await ready();await page.evaluate(()=>{startQuiz();startRecallQuiz();quizSession=null;openModal();});await page.evaluate(()=>{closeModal();});await page.evaluate(()=>VocVocData.restoreArchived(['word5']));await page.evaluate(()=>VocVocData.deleteWords(['word8']));await page.evaluate(()=>VocVocData.updateSettings({theme:'light',fontSize:'xlarge'}));await page.reload();await ready();assert.equal(await page.evaluate(()=>VocVocData.getWordByText('word8')),null);assert.equal(await page.evaluate(()=>VocVocData.getSettings().theme),'light');record('offline History/Test/Recall/Archive restore/delete/Settings + reload');
 await context.setOffline(false);
 // Model fallback, malformed response and connection error with real browser fetch interception.
 await page.route('https://generativelanguage.googleapis.com/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));await page.evaluate(()=>fetchFromGeminiREST('unavailable','test'));assert.equal(await page.locator('#loader').evaluate(el=>el.style.display),'none');await page.unroute('https://generativelanguage.googleapis.com/**');
 let calls=0;await page.route('https://generativelanguage.googleapis.com/**',route=>{calls++;return route.fulfill({status:calls===1?503:200,contentType:'application/json',body:JSON.stringify(calls===1?{}:{candidates:[{content:{parts:[{text:JSON.stringify({word:'networkword',meaning:'network meaning'})}]}}]})});});await page.evaluate(()=>fetchFromGeminiREST('networkalias','test'));assert.equal(calls,2);assert.equal(await page.evaluate(()=>VocVocData.getWordByText('networkalias').word),'networkword');await page.unroute('https://generativelanguage.googleapis.com/**');record('network returns + unchanged Gemini fallback sequence');
 // Update is waiting until explicit user action; setting panel blocks update reload.
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await ready();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);serveNext=true;await page.waitForFunction(()=>!!pwaRegistration);await page.evaluate(()=>pwaRegistration.update());await page.waitForFunction(()=>!!pwaRegistration.waiting);await page.waitForSelector('#pwaUpdate');assert.equal(await page.title(),'VocVoc');await page.evaluate(()=>openModal());await page.locator('#pwaUpdate .ui-button').click();assert.equal(await page.title(),'VocVoc');await page.evaluate(()=>closeModal());const updateWords=await page.evaluate(()=>Object.keys(VocVocData.getDb().words).length);await Promise.all([page.waitForNavigation(),page.locator('#pwaUpdate .ui-button').click()]);await ready();assert.equal(await page.title(),'VocVoc update test');assert.equal(await page.evaluate(()=>Object.keys(VocVocData.getDb().words).length),updateWords);assert.equal(await page.evaluate(async v=>{const keys=await caches.keys();return keys.some(k=>k.endsWith('-'+v.next))&&!keys.some(k=>k.endsWith('-'+v.cur));},{next:nextVersion,cur:shellVersion}),true);record('waiting update / busy protection / user refresh / obsolete cache cleanup');
 await context.setOffline(true);await page.reload();await ready();assert.equal(await page.title(),'VocVoc update test');record('new version offline reload');await context.setOffline(false);
 // Language reset is one atomic commit, preserving the configured pair across reload.
 await page.evaluate(()=>{requestLearningLanguageChange('targetLanguageDropdown','targetLanguage','de','German');return confirmLearningLanguageChange();});await page.reload();await ready();assert.equal(await page.evaluate(()=>VocVocData.getSettings().targetLanguage),'de');assert.equal(await page.evaluate(()=>Object.keys(VocVocData.getDb().words).length),0);record('language change + reset + reload atomic');
 // Audit P0: key travels in a header, forbidden list keeps the newest 100, interface language is independent of word data, destructive resets keep a recovery copy.
 {
  const seen=[],pattern='https://generativelanguage.googleapis.com/**';
  await page.route(pattern,route=>{const req=route.request();let prompt='';try{prompt=JSON.parse(req.postData()).contents[0].parts[0].text;}catch(_){}seen.push({url:req.url(),key:req.headers()['x-goog-api-key'],prompt});return route.fulfill({status:400,contentType:'application/json',body:'{"error":{"message":"stub"}}'});});
  await page.evaluate(async()=>{VocVocSecrets.setApiKey('TEST-KEY');await VocVocData.updateSettings({dailyLimit:'unlimited'});await VocVocData.addWordBatch(Array.from({length:120},(_,i)=>({word:'w'+String(i).padStart(3,'0'),meaning:'m'})));await new Promise(r=>setTimeout(r,20));await VocVocData.touchWord('w119');await addDailyWords();});
  await page.unroute(pattern);
  assert(seen.length>0);assert.equal(seen[0].key,'TEST-KEY');assert(!seen[0].url.includes('key='));
  const forbidden=(seen[0].prompt.match(/blocked list: ([^.]*)\. Do not/)||[])[1].split(', ');assert.equal(forbidden.length,100);assert.equal(forbidden[0],'w119');
  record('API key sent in header + forbidden list keeps newest 100');
  const wordCount=()=>page.evaluate(()=>Object.keys(VocVocData.getDb().words).length),before=await wordCount();assert(before>=120);
  await page.evaluate(()=>selectUiDropdown('appLanguageDropdown','en','English'));
  await page.waitForFunction(()=>VocVocData.getSettings().appLanguage==='en'&&document.documentElement.lang==='en');await page.evaluate(()=>VocVocData.flush());
  assert.equal(await wordCount(),before);await page.reload();await ready();
  assert.equal(await page.evaluate(()=>[VocVocData.getSettings().appLanguage,VocVocData.getSettings().nativeLanguage,document.documentElement.lang].join()),'en,tr,en');
  record('interface language is independent of word data + persists');
  // Closed IndexedDB handle: the next mutation reopens it and the write is durable.
  const probe=await page.evaluate(()=>getHistory()[0]);
  await page.evaluate(()=>VocVocStorage.adapter.db.close());
  await page.evaluate(w=>VocVocData.setStatus(w,'memorized'),probe);await page.reload();await ready();
  assert.equal(await page.evaluate(w=>VocVocData.getWordProgress(w).status,probe),'memorized');
  record('closed IndexedDB connection is reopened and the write is durable');
  // A failed language change commits nothing and leaves the dialog, dropdown and data consistent.
  const priorDb=await page.evaluate(()=>JSON.stringify(VocVocData.getDb())),priorTarget=await page.evaluate(()=>VocVocData.getSettings().targetLanguage);
  await page.evaluate(async()=>{const adapter=VocVocStorage.adapter,write=adapter.write;adapter.write=()=>Promise.reject(new DOMException('full','QuotaExceededError'));try{requestLearningLanguageChange('targetLanguageDropdown','targetLanguage','it','Italiano');await confirmLearningLanguageChange();}finally{adapter.write=write;}});
  assert.equal(await page.evaluate(()=>JSON.stringify(VocVocData.getDb())),priorDb);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('languageChangeOverlay')).display),'none');
  assert.equal(await page.evaluate(()=>document.getElementById('targetLanguageSelect').value),priorTarget);
  assert(await page.locator('.app-alert').count()>0);
  record('failed language change leaves data, dropdown and dialog consistent');
  const recoveryCount=()=>page.evaluate(async()=>Object.keys((await VocVocData.recoveryExport()).words).length);
  await page.evaluate(()=>resetAllProgress());await ready();assert.equal(await wordCount(),0);assert.equal(await recoveryCount(),before);
  await page.evaluate(()=>resetAllProgress());await ready();assert.equal(await recoveryCount(),before);
  record('reset keeps a recovery copy; an empty reset does not overwrite it');
  // Prompt cap (100): with 150 History words exactly the NEWEST 100 are listed; words accepted in this run outrank them; archived fill only spare slots.
  {
   const recency=(history,archived)=>{const base=Date.parse('2026-01-01T00:00:00Z'),words={},aliases={},progress={};
    const add=(w,status,i)=>{const id='fr:tr:'+w,stamp=new Date(base+i*60000).toISOString();words[id]={id,word:w,normalized:w,targetLanguage:'fr',nativeLanguage:'tr',meaning:'m',type:'n',synonyms:[],antonyms:[],examples:[],expressions:[],createdAt:stamp,updatedAt:stamp};aliases[id]=id;progress[id]={wordId:id,status,firstSeenAt:stamp,lastSeenAt:stamp,statusChangedAt:stamp,memorizedAt:status==='memorized'?stamp:null,archivedAt:status==='archived'?stamp:null,archiveSourceStatus:status==='archived'?'active':null};};
    for(let i=0;i<history;i++)add('h'+String(i).padStart(3,'0'),i%10===0?'memorized':'active',i); // h000 oldest ... newest last; memorized words are part of History
    for(let i=0;i<archived;i++)add('a'+String(i).padStart(2,'0'),'archived',1000+i);              // highest index = archived most recently
    return {exportVersion:1,schemaVersion:1,meta:{starterWordsInitialized:true},settings:{nativeLanguage:'tr',targetLanguage:'fr',difficulty:'A1-A2',dailyLimit:'unlimited',theme:'system',fontSize:'normal'},words,aliases,progress,dailyUsage:{date:null,count:0}};};
   const newestFirst=(prefix,n,width)=>Array.from({length:n},(_,i)=>prefix+String(n-1-i).padStart(width,'0'));
   const lists=async()=>{ // one Daily run (attempt 1 accepts 3 new words, attempt 2 ends the run) and one Random run
    const daily=[],avoid=[];let calls=0;const pattern='https://generativelanguage.googleapis.com/**';
    await page.route(pattern,route=>{let prompt='';try{prompt=JSON.parse(route.request().postData()).contents[0].parts[0].text;}catch(_){}calls++;
     if(/Generate EXACTLY/.test(prompt)){daily.push(((prompt.match(/blocked list: ([^.]*)\. Do not/)||[])[1]||'').split(', ').filter(Boolean));
      if(daily.length===1)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({words:['zz1','zz2','zz3'].map(w=>({word:w,type:'n',meaning:'m',synonyms:[],antonyms:[],examples:[],expressions:[]}))})}]}}]})});}
     else if(/Choose ONE/.test(prompt))avoid.push(((prompt.match(/Avoid these words: (.*?)\. Return the dictionary/)||[])[1]||'').split(', ').filter(Boolean));
     return route.fulfill({status:400,contentType:'application/json',body:'{"error":{"message":"stop"}}'});});
    await page.evaluate(async()=>{VocVocSecrets.setApiKey('TEST-KEY');await addDailyWords();document.getElementById('loader').style.display='none';await randomWord();});
    await page.unroute(pattern);return {daily,avoid:avoid[0]};};
   await page.evaluate(db=>VocVocData.import(db),recency(150,12));
   assert.equal(await page.evaluate(()=>getHistory().length),150);assert.deepEqual(await page.evaluate(()=>getHistory().slice(0,3)),['h149','h148','h147']); // History is newest-first
   let got=await lists();const newest100=newestFirst('h',150,3).slice(0,100);
   assert.deepEqual(got.daily[0],newest100);                                     // 150 records -> exactly the newest 100, newest first
   assert.deepEqual(got.daily[1],['zz1','zz2','zz3',...newest100.slice(0,97)]);   // retry: words accepted this run first, then the newest 97
   assert.deepEqual(got.avoid,newest100);                                        // Random: same 100
   await page.evaluate(db=>VocVocData.import(db),recency(30,12));
   got=await lists();const spare=[...newestFirst('h',30,3),...newestFirst('a',12,2)];
   assert.deepEqual(got.daily[0],spare);assert.deepEqual(got.avoid,spare);       // under the cap: all History newest-first, then archived newest-first
   record('prompt word cap keeps the newest 100 of 150 records; this-run words outrank them; archived fill spare slots');
  }
 }
 await context.close();serveNext=false;
 // Interrupted migration after copy retries verification instead of duplicating.
 context=await browser.newContext();page=await context.newPage();await page.goto(base+'/baseline.html');await page.evaluate(async db=>{const req=indexedDB.open('VOCVOC_PWA',1);await new Promise((resolve,reject)=>{req.onupgradeneeded=()=>{req.result.createObjectStore('state');req.result.createObjectStore('control');};req.onerror=()=>reject(req.error);req.onsuccess=resolve;});const tx=req.result.transaction(['state','control'],'readwrite');tx.objectStore('state').put(db,'schema-v1');tx.objectStore('control').put(1,'revision');tx.objectStore('control').put({phase:'copied'},'migration');await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});req.result.close();localStorage.setItem('VOCVOC_DB_V1',JSON.stringify(db));},seed(120));await page.goto(url);await ready();assert.equal(await page.evaluate(()=>Object.keys(VocVocData.getDb().words).length),120);assert.equal(await page.evaluate(async()=> (await VocVocStorage.adapter.read()).migration.phase),'complete');record('interrupted migration copied phase safe retry');await context.close();
 // Invalid source must fail visibly without overwriting or deleting it.
 context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('VOCVOC_DB_V1','{broken'));page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>!document.getElementById('storageRetry').hidden);assert.equal(await page.evaluate(()=>document.getElementById('storageBoot').hidden),false);assert.equal(await page.evaluate(()=>localStorage.getItem('VOCVOC_DB_V1')),'{broken');assert(!(await page.locator('#storageBootMessage').textContent()).includes('Arayüz'));record('corrupt migration blocks bootstrap safely with recovery message');await context.close();
 // An interface (render) failure is not a database failure: distinct message, storage already initialized, open DB exportable.
 context=await browser.newContext();await context.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{window.renderHistory=()=>{throw new Error('forced interface failure');};}));page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>!document.getElementById('storageRetry').hidden);
 const uiMessage=await page.locator('#storageBootMessage').textContent();assert(uiMessage.includes('Arayüz')&&!/Veritaban|Veri geçersiz/.test(uiMessage));assert.equal(await page.evaluate(()=>document.getElementById('storageBoot').hidden),false);
 assert.equal(await page.evaluate(async()=>(await VocVocStorage.adapter.read()).migration.phase),'complete');
 const [uiDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#legacyBackup').click()]);assert.equal(JSON.parse(fs.readFileSync(await uiDownload.path(),'utf8')).exportVersion,1);
 record('interface startup failure is reported separately from database failure');await context.close();
 // persist() missing or refused must neither break the app nor read like data loss.
 for(const [label,init] of [['unsupported',()=>Object.defineProperty(navigator,'storage',{get:()=>undefined,configurable:true})],['refused',()=>{StorageManager.prototype.persist=async()=>false;StorageManager.prototype.persisted=async()=>false;}]]){
  context=await browser.newContext();await context.addInitScript(init);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await ready();
  await page.mouse.click(5,5);await page.evaluate(()=>{openModal();document.getElementById('backupControls').open=true;});
  await page.waitForFunction(()=>!document.getElementById('persistNotice').hidden);
  const note=await page.locator('#persistNotice').textContent();assert(note.includes('JSON')&&!/silin|kayb|delete|lost/i.test(note),label);
  assert.equal(await page.locator('.app-alert').count(),0,label);assert.equal(await page.evaluate(()=>document.getElementById('storageBoot').hidden),true,label);
  await context.close();
 }
 record('persist() unsupported or refused keeps the app working with a calm note');
 // Responsive, theme and pointer smoke on actual Chromium, not mocked DOM.
 for(const width of [390,1280]){context=await browser.newContext({viewport:{width,height:844},hasTouch:width===390,isMobile:width===390});page=await context.newPage();await page.goto(url);await ready();for(const theme of ['light','dark']){await page.evaluate(t=>applyTheme(t),theme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.evaluate(()=>toggleHistoryDetail('Bonjour'));await pause(60);const box=await page.locator('#historyDetails .history-detail-card').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);await page.evaluate(()=>closeHistoryDetail());}await context.close();}record('390px touch/mobile + desktop 1280px / light and dark popup bounds');
 // Search/Random/Daily use the unchanged AI contract, with durable async commits.
 context=await browser.newContext();page=await context.newPage();await page.goto(url);await ready();await page.evaluate(()=>VocVocSecrets.setApiKey('test'));
 await page.route('https://generativelanguage.googleapis.com/**',route=>{const prompt=JSON.parse(route.request().postData()).contents[0].parts[0].text;let data;if(prompt.includes('Choose ONE'))data={word:'randompwa'};else if(prompt.includes('"words"'))data={words:Array.from({length:10},(_,i)=>({word:'dailypwa'+i,meaning:'daily meaning '+i}))};else{const word=prompt.includes('randompwa')?'randompwa':prompt.includes('previewpwa')?'previewpwa':'searchpwa';data={word,meaning:'meaning '+word};}return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(data)}]}}]})});});
 await page.evaluate(()=>{document.getElementById('searchInput').value='query';return handleSearch();});assert(await page.evaluate(()=>VocVocData.getHistoryWords().includes('searchpwa')));await page.evaluate(()=>randomWord());assert(await page.evaluate(()=>VocVocData.getHistoryWords().includes('randompwa')));const dailyRevision=await page.evaluate(()=>VocVocStorage.adapter.revision);await page.evaluate(()=>addDailyWords());assert.equal(await page.evaluate(()=>VocVocData.getDailyUsage().count),10);assert.equal(await page.evaluate(()=>VocVocStorage.adapter.revision),dailyRevision+1);assert.equal(await page.locator('#contentArea .main-word-card').count(),10);
 await page.evaluate(()=>openRelatedWordPopup('previewpwa'));assert.equal(await page.evaluate(()=>VocVocData.getWordByText('previewpwa')),null);assert.equal(await page.locator('#relatedWordPopup .card-archive-btn').count(),0);await page.evaluate(()=>addRelatedWordToList('previewpwa'));assert(await page.evaluate(()=>VocVocData.getHistoryWords().includes('previewpwa')));await page.reload();await ready();assert(await page.evaluate(()=>VocVocData.getHistoryWords().includes('randompwa')));record('Search / Random / Daily atomic batch / Related preview-add / persistence');await context.close();
 // Actual pointer drags execute the async commit callbacks on every card family.
 context=await browser.newContext({viewport:{width:1000,height:850}});page=await context.newPage();await page.goto(url);await ready();
 const drag=async(selector,amount)=>{const box=await page.locator(selector).first().boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+amount,y+5,{steps:8});await page.mouse.up();};
 await page.evaluate(()=>toggleHistoryDetail('Bonjour'));await drag('#historyDetails .word-panel-scroll-body .section p',150);await page.waitForFunction(()=>VocVocData.getWordProgress('Bonjour').status==='memorized');
 await page.evaluate(()=>toggleHistoryDetail('Bonjour'));await drag('#historyDetails .word-panel-scroll-body .section p',-150);await page.waitForFunction(()=>VocVocData.getWordProgress('Bonjour').status==='active');record('History pointer swipe memorize/unmemorize persists');
 await page.evaluate(()=>openRelatedWordPopup('Merci'));await drag('#relatedWordPopup .word-panel-scroll-body .section p',150);await page.waitForFunction(()=>VocVocData.getWordProgress('Merci').status==='memorized');record('Related pointer swipe commits and closes');
 await page.evaluate(()=>{closeRelatedWordPopup();closeHistoryDetail();renderAllLocal();});await drag('#contentArea .main-word-card .main-word-toggle',150);await page.waitForFunction(()=>VocVocData.getWordProgress('Bonjour').status==='memorized');record('ContentArea pointer right swipe commits');
 await page.evaluate(()=>startFlip());const flipWord=await page.evaluate(()=>flipSession.cards[flipSession.index].word);const flipStatus=await page.evaluate(w=>VocVocData.getWordProgress(w).status,flipWord);await drag('#flipCard',flipStatus==='memorized'?-150:150);await page.waitForFunction(({w,status})=>VocVocData.getWordProgress(w).status!==status,{w:flipWord,status:flipStatus});await page.evaluate(()=>closeFlip());record('Flip pointer drag commits status');
 const pure=await page.evaluate(async()=>{const adapter=VocVocStorage.adapter,revision=adapter.revision,read=adapter.read;adapter.read=()=>{throw new Error('render read disk');};try{for(let i=0;i<100;i++){renderWordCard({word:'Je',meaning:'meaning'});VocVocData.getWordByText('Je');}return revision===adapter.revision;}finally{adapter.read=read;}});assert(pure);record('render/getter hot paths do not write/read IndexedDB');
 // Data safety: hostile backup files never reach storage, the API key never leaves in a backup, bulk deletes keep the recovery copy.
 {
  const KEY='AIza-SECRET-REGRESSION-KEY',dump=()=>page.evaluate(()=>JSON.stringify(VocVocData.getDb()));
  let dialogs=0;const onDialog=d=>{dialogs++;d.dismiss();};page.on('dialog',onDialog);
  await page.evaluate(k=>{VocVocSecrets.setApiKey(k);openModal();document.getElementById('backupControls').open=true;},KEY);
  const stable=await dump(),envelope=JSON.parse(stable);
  const hostile={
   'larger than 10 MB':Buffer.alloc(10*1024*1024+1,32),
   'corrupt JSON':Buffer.from('{"exportVersion":1,"schemaVersion":1,"words":'),
   'wrong schema version':Buffer.from(JSON.stringify({exportVersion:1,...envelope,schemaVersion:2})),
   'secret field':Buffer.from(JSON.stringify({exportVersion:1,...envelope,apiKey:KEY})),
   'not an object':Buffer.from('[1,2,3]')
  };
  for(const [label,buffer] of Object.entries(hostile)){
   await page.locator('#importDataFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer});
   await page.waitForFunction(()=>document.querySelector('.app-alert'));
   assert.equal(await dump(),stable,label);assert.equal(await page.evaluate(()=>document.querySelector('.container').inert),false,label);
   await page.evaluate(()=>showError(''));await page.waitForFunction(()=>!document.querySelector('.app-alert'));
  }
  assert.equal(dialogs,0);page.off('dialog',onDialog);
  record('hostile backup files (oversize, corrupt, wrong schema, secret field) reject without changing data');
  const plain=JSON.stringify(await page.evaluate(()=>VocVocData.export()));assert(!plain.includes(KEY)&&!/GEMINI_API_KEY|VOCVOC_SECRET|"apiKey"|api_key/i.test(plain));
  await page.evaluate(()=>VocVocData.addWordBatch(Array.from({length:6},(_,i)=>({word:'seedword'+i,meaning:'m'}))));
  const names=await page.evaluate(()=>Object.values(VocVocData.getDb().words).map(w=>w.word));assert(names.length>=6);
  const recoveryOf=()=>page.evaluate(async()=>{const r=await VocVocData.recoveryExport();return r&&JSON.stringify(r.words);}),rec0=await recoveryOf();
  await page.evaluate(w=>VocVocData.deleteWords([w]),names[0]);assert.equal(await recoveryOf(),rec0); // single delete leaves the copy alone
  const idsBefore=Object.keys(JSON.parse(await dump()).words);
  await page.evaluate(w=>VocVocData.deleteWords(w),[names[1],names[2]]);
  assert.deepEqual(Object.keys(JSON.parse(await recoveryOf())).sort(),idsBefore.sort()); // copy = state right before the bulk delete
  assert.equal(Object.keys(JSON.parse(await dump()).words).length,idsBefore.length-2);
  const [recoveryDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#recoveryDataBtn').click()]);
  const recoveryFile=fs.readFileSync(await recoveryDownload.path(),'utf8'),recovered=JSON.parse(recoveryFile);
  assert(!recoveryFile.includes(KEY));assert.equal(recovered.exportVersion,1);assert(Object.values(recovered.words).some(w=>w.word===names[1]));
  record('API key absent from exports; bulk delete keeps a secret-free recovery copy');
  await page.evaluate(()=>{document.getElementById('backupControls').open=false;closeModal();}); // leave the UI as the next scenario expects
 }
 await page.evaluate(()=>openModal());await page.locator('#backupLabel').click();const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportDataBtn').click()]);const exportPath=await download.path();const exported=JSON.parse(fs.readFileSync(exportPath,'utf8'));assert.equal(exported.exportVersion,1);assert(!JSON.stringify(exported).includes('GEMINI_API_KEY')&&!JSON.stringify(exported).includes('AIza-SECRET-REGRESSION-KEY'));
 const restoreWord=exported.words[Object.keys(exported.words)[0]].word;await page.evaluate(w=>VocVocData.deleteWords([w]),restoreWord);page.once('dialog',dialog=>dialog.accept());await Promise.all([page.waitForNavigation(),page.locator('#importDataFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))})]);await ready();assert(await page.evaluate(w=>!!VocVocData.getWordByText(w),restoreWord));record('Settings JSON download / confirmed file restore / reload');await context.close();
 // Baseline layout geometry is unchanged at zero safe-area inset.
 for(const width of [390,1280]){const geometries=[];for(const baseline of [true,false]){context=await browser.newContext({viewport:{width,height:844}});page=await context.newPage();await page.goto(baseline?base+'/baseline.html':url);if(!baseline)await ready();geometries.push(await page.evaluate(()=>Object.fromEntries(['.container','#topChrome','#contentArea','.main-word-card','#historyArea'].map(selector=>{const el=document.querySelector(selector),rect=el.getBoundingClientRect(),css=getComputedStyle(el);return [selector,{x:rect.x,y:rect.y,width:rect.width,height:rect.height,font:css.fontSize,overflow:css.overflow}];}))));await context.close();}assert.deepEqual(geometries[1],geometries[0]);}record('SPA baseline geometry unchanged: mobile + desktop');
 // ===== Service Worker / offline / update matrix =====
 {
  const swAssets=JSON.parse(fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const ASSETS=(\[[^;]+\]);/)[1].replaceAll("'",'"'));
  const shellUrls=[...new Set(swAssets.map(asset=>new URL(asset,url).href))].sort(),cacheName=`vocvoc-shell-${encodeURIComponent('/VocVoc/')}-${shellVersion}`;
  const track=p=>{p.on('pageerror',e=>errors.push(e.message));return p;};
  // A fresh browser context with the CURRENT worker installed and controlling the page.
  const installed=async()=>{const c=await browser.newContext(),p=track(await c.newPage());await p.goto(url);await ready(p);await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await ready(p);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);return {c,p};};
  const cacheEntries=p=>p.evaluate(async()=>{const out={};for(const key of await caches.keys()){const cache=await caches.open(key);out[key]=(await cache.keys()).map(request=>request.url).sort();}return out;});
  const swState=p=>p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return {installing:!!r.installing,waiting:!!r.waiting,active:!!r.active};});
  // Serve the next deploy and ask for an update. window.__installOutcome settles with the state the NEW worker ends in ('installed' or 'redundant' when
  // its install failed), so tests wait for the event instead of guessing a delay.
  const deploy=async(p,variant)=>{serveNext=true;skew=variant;await p.waitForFunction(()=>!!pwaRegistration);return p.evaluate(()=>{
    window.__installOutcome=new Promise(resolve=>{const timer=setTimeout(()=>resolve('no new worker found'),30000);
     pwaRegistration.addEventListener('updatefound',()=>{const worker=pwaRegistration.installing;worker.addEventListener('statechange',()=>{if(['installed','activated','redundant'].includes(worker.state)){clearTimeout(timer);resolve(worker.state);}});},{once:true});});
    return pwaRegistration.update().then(()=>'resolved',()=>'rejected');});};
  const installOutcome=p=>p.evaluate(()=>window.__installOutcome);

  // --- 1/2: first load + reload; nothing but the shell is ever cached
  {
   const {c,p}=await installed();const entries=await cacheEntries(p);
   assert.deepEqual(Object.keys(entries),[cacheName]);assert.deepEqual(entries[cacheName],shellUrls);
   record('SW: online first load + reload leave one versioned cache holding exactly the complete shell');
   const KEY='AIza-CACHE-PROBE-KEY';let geminiCalls=0;
   await p.route('https://generativelanguage.googleapis.com/**',route=>{geminiCalls++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({word:'probeword',type:'n',meaning:'m',synonyms:[],antonyms:[],examples:[],expressions:[]})}]}}]})});});
   await p.evaluate(k=>{VocVocSecrets.setApiKey(k);document.getElementById('searchInput').value='probeword';return handleSearch();},KEY);
   await p.waitForFunction(()=>!!VocVocData.getWordByText('probeword'));assert(geminiCalls>=1);
   assert.deepEqual(await cacheEntries(p),entries); // same URLs as before: the AI request/response was not cached
   const leaked=await p.evaluate(async key=>{for(const name of await caches.keys()){const cache=await caches.open(name);for(const request of await cache.keys()){const response=await cache.match(request);if(request.url.includes(key)||(await response.clone().text()).includes(key))return request.url;}}return null;},KEY);
   assert.equal(leaked,null);record('SW: Gemini request/response and the API key never enter any cache');
   await c.close();
  }
  // --- 3: install is all-or-nothing and verifies the shell belongs to the worker
  {
   const {c,p}=await installed();const words=await p.evaluate(()=>Object.keys(VocVocData.getDb().words).length);
   for(const variant of ['icon','meta']){ // 'icon': one shell file 404s; 'meta': new worker but old HTML (skewed/partial deploy)
    await deploy(p,variant);assert.equal(await installOutcome(p),'redundant',`${variant}: the install must fail`);
    assert.deepEqual(await swState(p),{installing:false,waiting:false,active:true},variant);
    assert.deepEqual(Object.keys(await cacheEntries(p)),[cacheName],variant); // no half-built next cache left behind
    assert.equal(await p.locator('#pwaUpdate').count(),0,variant);assert.equal(await p.title(),'VocVoc');
   }
   assert.equal(await p.evaluate(()=>Object.keys(VocVocData.getDb().words).length),words);
   await deploy(p,null);await p.waitForFunction(()=>!!pwaRegistration.waiting);await p.waitForSelector('#pwaUpdate'); // the next healthy deploy is not blocked by the earlier failures
   record('SW: broken or skewed deploy never replaces a working install; the next healthy deploy installs');
   serveNext=false;skew=null;await c.close();
  }
  // --- 4: cache evicted by the browser
  {
   const {c,p}=await installed();
   await p.evaluate(async()=>{for(const key of await caches.keys())await caches.delete(key);});
   await p.reload();await ready(p);assert.equal(await p.title(),'VocVoc'); // served from the network instead of a dead page
   await p.waitForFunction(async n=>{const keys=await caches.keys();return keys.length===1&&(await (await caches.open(keys[0])).keys()).length===n;},shellUrls.length);
   await c.setOffline(true);await p.reload();await ready(p);assert.equal(await p.title(),'VocVoc');
   record('SW: evicted cache is rebuilt from the network and serves offline again');await c.close();
  }
  // --- 5: banner dismissed, every tab closed: the update still arrives by itself, the database is untouched
  {
   const {c,p}=await installed();const before=await p.evaluate(()=>({revision:VocVocStorage.adapter.revision,words:Object.keys(VocVocData.getDb().words).length}));
   await deploy(p,null);await p.waitForFunction(()=>!!pwaRegistration.waiting);await p.waitForSelector('#pwaUpdate');await p.locator('#pwaUpdate .ui-panel-close').click();await p.close();
   // Once the last client is gone the browser activates the waiting worker by itself. Watch that from a page OUTSIDE the scope
   // (it is not controlled, so it does not hold the old worker alive), and only then open the app again, as a user would.
   const watcher=await c.newPage();await watcher.goto(base+'/baseline.html');
   await watcher.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration('/VocVoc/');return !!r&&!r.waiting&&!r.installing&&r.active?.state==='activated';},null,{timeout:30000});await watcher.close();
   // Chromium can leave the very first navigation made right after a worker swap pending (it reproduces with the original sw.js too);
   // a stuck attempt is abandoned after 10 s. What must hold is that the update gets served without any user action on the update UI.
   const tries=[];let fresh=null;for(let i=0;i<6&&!fresh;i++){const q=track(await c.newPage());let title='(navigation did not finish)';try{await q.goto(url,{timeout:10000});title=await q.title();}catch(_){}tries.push(title);if(title==='VocVoc update test')fresh=q;else{await q.close();await pause(500);}}
   assert(fresh,`a waiting update must apply by itself once every tab is closed (titles seen: ${tries.join(' | ')})`);await ready(fresh);
   assert.deepEqual(await fresh.evaluate(async()=>({revision:VocVocStorage.adapter.revision,words:Object.keys(VocVocData.getDb().words).length,phase:(await VocVocStorage.adapter.read()).migration.phase})),{...before,phase:'complete'});
   record('update: dismissed banner still applies once every tab is closed; revision/words unchanged');serveNext=false;await c.close();
  }
  // --- 6: the worker never takes over: the interface is handed back, not left inert
  {
   const {c,p}=await installed();await deploy(p,null);await p.waitForFunction(()=>!!pwaRegistration.waiting);await p.waitForSelector('#pwaUpdate');
   await p.evaluate(()=>{window.__stillHere=true;pwaRegistration.waiting.postMessage=()=>{};}); // simulate an activation that never happens
   await p.locator('#pwaUpdate .ui-button').click();await p.waitForFunction(()=>document.querySelector('.container').inert===true);
   await p.waitForFunction(()=>document.querySelector('.container').inert===false,null,{timeout:20000});
   assert.match(await p.locator('#appAlertLayer').innerText(),/Güncelleme şu an etkinleştirilemedi/);assert.equal(await p.evaluate(()=>window.__stillHere),true); // no reload happened
   record('update: a worker that never takes over hands the interface back with a message');serveNext=false;await c.close();
  }
  // --- 7: old shell + current DB. A tab keeps running old code while another tab activates the update.
  {
   const {c,p:A}=await installed(),B=track(await c.newPage());await B.goto(url);await ready(B);
   await deploy(B,null);await B.waitForFunction(()=>!!pwaRegistration.waiting);await B.waitForSelector('#pwaUpdate');await A.evaluate(()=>{window.__oldShell=true;window.syncExternalCommit=()=>showPwaUpdate(true);}); // an old shell has no adoption: it only shows the banner
   await Promise.all([B.waitForNavigation(),B.locator('#pwaUpdate .ui-button').click()]);await ready(B);assert.equal(await B.title(),'VocVoc update test');
   assert.equal(await A.evaluate(()=>[window.__oldShell,document.title,document.querySelector('.container').inert].join()),'true,VocVoc,false'); // not reloaded, not frozen
   await B.evaluate(()=>VocVocData.setStatus('Bonjour','memorized')); // the new shell commits
   assert.equal(await A.evaluate(async()=>{try{await VocVocData.setStatus('Merci','memorized');return 'written';}catch(e){return e.storageCode||e.name;}}),'conflict'); // the old shell cannot overwrite it
   assert.equal(await A.evaluate(()=>VocVocData.getWordProgress('Bonjour').status),'active'); // its stale cache is untouched until it reloads
   await A.reload();await ready(A);assert.equal(await A.title(),'VocVoc update test');
   assert.deepEqual(await A.evaluate(()=>[VocVocData.getWordProgress('Bonjour').status,VocVocData.getWordProgress('Merci').status]),['memorized','active']);
   record('lifecycle: old shell + current DB: stale write rejected, no forced reload, reload gets new shell + current data');serveNext=false;await c.close();
  }
  // --- 8: new shell + migration-required DB (IndexedDB gone, legacy source retained)
  {
   const c=await browser.newContext(),p=track(await c.newPage());await p.goto(base+'/baseline.html');await p.evaluate(db=>localStorage.setItem('VOCVOC_DB_V1',JSON.stringify(db)),seed(120));
   await p.goto(url);await ready(p);await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await ready(p);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
   await deploy(p,null);await p.waitForFunction(()=>!!pwaRegistration.waiting);await p.waitForSelector('#pwaUpdate');
   await Promise.all([p.waitForNavigation(),p.locator('#pwaUpdate .ui-button').click()]);await ready(p);assert.equal(await p.title(),'VocVoc update test');
   await p.evaluate(async()=>{VocVocStorage.adapter.close();await new Promise((resolve,reject)=>{const q=indexedDB.deleteDatabase('VOCVOC_PWA');q.onsuccess=resolve;q.onerror=()=>reject(q.error);q.onblocked=()=>reject(new Error('blocked'));});});
   await p.reload();await ready(p);
   assert.deepEqual(await p.evaluate(async()=>({ids:Object.keys(VocVocData.getDb().words).sort(),phase:(await VocVocStorage.adapter.read()).migration.phase})),{ids:Object.keys(seed(120).words).sort(),phase:'complete'});
   record('lifecycle: new shell + migration-required DB rebuilds from the retained source exactly once');serveNext=false;await c.close();
  }
  // --- 9: DB written by a NEWER schema is never modified; Retry lets a waiting worker take over
  {
   const {c,p}=await installed();
   const raw=()=>p.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('VOCVOC_PWA');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,tx=db.transaction(['state','control']),out={};tx.objectStore('state').get('schema-v1').onsuccess=e=>out.state=e.target.result;tx.objectStore('control').get('revision').onsuccess=e=>out.revision=e.target.result;tx.objectStore('control').get('migration').onsuccess=e=>out.migration=e.target.result;tx.oncomplete=()=>{db.close();resolve(JSON.stringify(out));};tx.onerror=()=>reject(tx.error);};}));
   await p.evaluate(()=>new Promise((resolve,reject)=>{VocVocStorage.adapter.close();const q=indexedDB.open('VOCVOC_PWA');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,tx=db.transaction(['state','control'],'readwrite');tx.objectStore('state').put({schemaVersion:2,futureField:{keep:'me'}},'schema-v1');tx.objectStore('control').put(7,'revision');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}));
   const before=await raw();await p.reload();await p.waitForFunction(()=>!document.getElementById('storageRetry').hidden);
   assert.match(await p.locator('#storageBootMessage').textContent(),/Veri geçersiz/);assert.equal(await raw(),before); // the shell refuses it and writes nothing
   serveNext=true;skew=null;await Promise.all([p.waitForNavigation({timeout:30000}),p.locator('#storageRetry').click()]);
   await p.waitForFunction(()=>!document.getElementById('storageRetry').hidden);assert.equal(await p.title(),'VocVoc update test'); // Retry picked up the new deploy
   assert.equal(await raw(),before);record('lifecycle: newer-schema DB untouched by old and new shell; Retry takes over a waiting worker');serveNext=false;await c.close();
  }
  // --- 10: offline, through the real UI
  {
   context=await browser.newContext();page=track(await context.newPage());
   await page.goto(base+'/baseline.html');await page.evaluate(db=>localStorage.setItem('VOCVOC_DB_V1',JSON.stringify(db)),seed(100));
   await page.goto(url);await ready();await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await ready();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   await context.setOffline(true);await page.reload();await ready();
   const data=seed(100),named=status=>Object.values(data.progress).filter(p=>status?p.status===status:p.status!=='archived').map(p=>data.words[p.wordId].word).sort();
   const chips=async()=>(await page.locator('.history-chip').allTextContents()).map(t=>t.replace(/ ✓$/,'').trim());
   const pick=async(dropdown,value)=>{await page.locator(`#${dropdown} .ui-dropdown-trigger`).click();await page.locator(`#${dropdown} .ui-dropdown-option[data-value="${value}"]`).click();};
   // History + Memorized + filtering/sorting
   assert.deepEqual((await chips()).sort(),named());
   await page.fill('#historyFilterInput','word1');assert.deepEqual((await chips()).sort(),named().filter(w=>w.includes('word1')));await page.fill('#historyFilterInput','');
   await pick('historyStatusDropdown','memorized');assert.deepEqual((await chips()).sort(),named('memorized'));
   assert.equal(await page.locator('.history-chip:not(.memorized)').count(),0);await pick('historyStatusDropdown','all');
   await pick('historySortDropdown','za');assert.deepEqual(await chips(),[...named()].sort((a,b)=>b.localeCompare(a,'fr',{sensitivity:'base'})));await pick('historySortDropdown','none');
   record('offline UI: History, Memorized, filtering and sorting');
   // Saved word details, Archive, Undo
   await page.locator('.history-chip',{hasText:/^word1$/}).click();await page.waitForSelector('#historyDetails.open');
   assert.equal(await page.locator('#historyDetails .word-title').textContent(),'word1');assert.match(await page.locator('#historyDetails .section p').first().textContent(),/meaning 1/);
   await page.locator('#historyDetails .card-archive-btn').click();await page.waitForSelector('#archiveUndoToast.show');
   assert.equal(await page.evaluate(()=>VocVocData.getWordProgress('word1').status),'archived');assert.equal(await page.locator('.history-chip',{hasText:/^word1$/}).count(),0);
   await page.locator('#archiveUndoBtn').click();await page.waitForFunction(()=>VocVocData.getWordProgress('word1').status==='active');assert.equal(await page.locator('.history-chip',{hasText:/^word1$/}).count(),1);
   record('offline UI: saved word details, Archive and Undo');
   // Archive panel restore
   const archivedBefore=await page.evaluate(()=>VocVocData.getArchivedEntries().length);
   await page.locator('[onclick="openModal()"]').click();await page.locator('#archiveShowBtn').click();await page.waitForSelector('#archiveOverlay.open .archive-word');
   assert.equal(await page.locator('.archive-word').count(),archivedBefore);const archivedWord=(await page.locator('.archive-word').first().textContent()).trim().replace(/^✓\s*/,'');
   await page.locator('.archive-word').first().click();await page.locator('#archiveRestoreBtn').click();await page.waitForFunction(n=>VocVocData.getArchivedEntries().length===n-1,archivedBefore);
   assert.equal(await page.evaluate(w=>VocVocData.getWordProgress(w).status,archivedWord),'memorized');await page.locator('#archiveOverlay .ui-panel-close').click();
   record('offline UI: Archive panel restore');
   // Test + Recall
   for(const [button,count] of [['#testButton','Test'],['#recallButton','Recall']]){
    await page.locator(button).click();await page.waitForSelector('.quiz-option');assert.equal(await page.locator('.quiz-option').count(),4,count);
    await page.locator('.quiz-option').first().click();await page.waitForFunction(()=>document.querySelector('.quiz-count-v91')?.textContent.includes('2/10'));
   }
   record('offline UI: Test and Recall');
   // Settings persist across an offline reload
   await page.locator('[onclick="openModal()"]').click();await pick('themeDropdown','dark');await page.locator('#settingsSaveBtn').click();
   assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('data-theme')),'dark');
   await page.waitForFunction(()=>VocVocData.getSettings().theme==='dark');await page.evaluate(()=>VocVocData.flush()); // Save is asynchronous: wait for the commit before reloading
   await page.reload();await ready();
   assert.deepEqual(await page.evaluate(()=>[document.documentElement.getAttribute('data-theme'),VocVocData.getSettings().theme]),['dark','dark']);
   record('offline UI: Settings saved and restored after an offline reload');
   // Everything that needs Gemini fails gracefully and changes nothing
   await page.evaluate(()=>{VocVocSecrets.setApiKey('offline-test-key');return VocVocData.updateSettings({dailyLimit:'unlimited'});});const snapshot=await page.evaluate(()=>JSON.stringify(VocVocData.getDb()));
   const failsGracefully=async(label,action)=>{await action();await page.waitForSelector('.app-alert');assert.match(await page.locator('#appAlertLayer').innerText(),/İnternet/,label);
    assert.equal(await page.locator('#loader').evaluate(el=>getComputedStyle(el).display),'none',label);assert.equal(await page.locator('#dailyLoadingOverlay.show').count(),0,label);
    assert.equal(await page.evaluate(()=>JSON.stringify(VocVocData.getDb())),snapshot,label);await page.evaluate(()=>showError(''));await page.waitForFunction(()=>!document.querySelector('.app-alert'));};
   await failsGracefully('search',async()=>{await page.fill('#searchInput','inconnuword');await page.locator('[onclick="handleSearch()"]').click();});
   await failsGracefully('daily',()=>page.locator('[onclick="addDailyWords()"]').click());
   await failsGracefully('random',()=>page.locator('[onclick="randomWord()"]').click());
   record('offline UI: Gemini-dependent actions fail gracefully and leave data untouched');await context.close();
  }
  // --- 11: true cold start. Brand-new browser process, same profile, server gone (connection refused): only the worker can answer.
  {
   const coldServer=http.createServer(server.listeners('request')[0]);await new Promise(r=>coldServer.listen(0,'127.0.0.1',r));const coldUrl=`http://127.0.0.1:${coldServer.address().port}/VocVoc/`;
   const profile=fs.mkdtempSync(path.join(os.tmpdir(),'vocvoc-profile-'));
   try{
    let pc=await chromium.launchPersistentContext(profile,launch),p=pc.pages()[0]||await pc.newPage();
    await p.goto(coldUrl);await ready(p);await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await ready(p);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await p.evaluate(()=>VocVocData.addWordBatch([{word:'persisted',meaning:'kept offline'}]));await p.evaluate(()=>VocVocData.flush());await pc.close();
    coldServer.closeAllConnections?.();await new Promise(r=>coldServer.close(r)); // from here on the network path to the app is dead
    const probe=p=>p.evaluate(async()=>({title:document.title,controlled:!!navigator.serviceWorker.controller,word:VocVocData.getWordByText('persisted')?.meaning,booted:document.getElementById('storageBoot').hidden,caches:(await caches.keys()).length}));
    pc=await chromium.launchPersistentContext(profile,launch);p=pc.pages()[0]||await pc.newPage();await p.goto(coldUrl);await ready(p);
    assert.deepEqual(await probe(p),{title:'VocVoc',controlled:true,word:'kept offline',booted:true,caches:1});await pc.close();
    record('offline cold start: new browser process, server unreachable, shell + IndexedDB data load from the worker');
    // The window of an installed PWA: a standalone app window opened on start_url.
    pc=await chromium.launchPersistentContext(profile,{...launch,args:[...(launch.args||[]),'--app='+coldUrl]});p=pc.pages()[0]||await pc.waitForEvent('page');await p.waitForURL(coldUrl,{timeout:20000});await ready(p);
    assert.deepEqual({...await probe(p),standalone:await p.evaluate(()=>matchMedia('(display-mode: standalone)').matches),start:p.url()},{title:'VocVoc',controlled:true,word:'kept offline',booted:true,caches:1,standalone:true,start:coldUrl});await pc.close();
    record('offline cold start: standalone app window (installed-PWA equivalent) opens from start_url with the server unreachable');
   }finally{coldServer.closeAllConnections?.();coldServer.close();fs.rmSync(profile,{recursive:true,force:true});}
  }
 }
 // ===== Gemini / network layer matrix =====
 {
  const KEY='AIza-NET-MATRIX-KEY-0123456789';
  context=await browser.newContext();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const logged=[];page.on('console',m=>logged.push(m.text()));
  await page.goto(url);await ready();
  await page.evaluate(k=>{VocVocSecrets.setApiKey(k);return VocVocData.updateSettings({dailyLimit:'unlimited'});},KEY);
  const calls=[],allCalls=[];let plan=null;
  const wordCard=word=>({word,type:'n',meaning:'bir anlam',synonyms:[],antonyms:[],examples:[],expressions:[]});
  const ok=payload=>({status:200,contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text:typeof payload==='string'?payload:JSON.stringify(payload)}]}}]})});
  const fail=(status,message,reason)=>({status,contentType:'application/json',body:JSON.stringify({error:{code:status,message,status:'X',details:reason?[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason}]:[]}})});
  await page.route('https://generativelanguage.googleapis.com/**',async route=>{
   const request=route.request(),body=JSON.parse(request.postData()),call={model:/models\/([^:]+):/.exec(request.url())[1],schema:body.generationConfig.responseSchema||null,mime:body.generationConfig.responseMimeType,key:request.headers()['x-goog-api-key'],url:request.url(),prompt:String(body.contents?.[0]?.parts?.[0]?.text||'')};
   calls.push(call);allCalls.push(call);const answer=await plan(calls.length,call);
   if(answer==='hang')return new Promise(()=>{}); // never answers: only the app's own timeout can end it
   if(answer==='drop')return route.abort('failed');
   return route.fulfill(answer);
  });
  const state=()=>page.evaluate(()=>JSON.stringify(VocVocData.getDb()));
  const search=word=>async()=>{await page.fill('#searchInput',word);await page.locator('[onclick="handleSearch()"]').click();};
  const daily=()=>page.locator('[onclick="addDailyWords()"]').click(),random=()=>page.locator('[onclick="randomWord()"]').click();
  // A failing scenario: localized message, expected number of requests, spinner closed, controls usable, stored data identical.
  const failing=async(label,{answer,act,message,count,limits={}})=>{
   const before=await state();calls.length=0;plan=answer;
   await page.evaluate(l=>Object.assign(GEMINI_LIMITS,l),{timeoutMs:15000,dailyBudgetMs:45000,minSliceMs:500,...limits});
   const started=Date.now();await act();await page.waitForSelector('.app-alert');const text=await page.locator('#appAlertLayer').innerText(),elapsed=Date.now()-started;
   assert.match(text,message,label);if(count!=null)assert.equal(calls.length,count,label+': number of requests');
   assert.equal(await page.locator('#loader').evaluate(el=>getComputedStyle(el).display),'none',label+': spinner');assert.equal(await page.locator('#dailyLoadingOverlay.show').count(),0,label+': daily overlay');
   assert.equal(await page.evaluate(()=>[document.querySelector('[onclick="addDailyWords()"]').disabled,document.querySelector('.container').inert].join()),'false,false',label+': app usable');
   assert.equal(await state(),before,label+': data unchanged');
   await page.evaluate(()=>showError(''));await page.waitForFunction(()=>!document.querySelector('.app-alert'));return {elapsed};
  };
  await context.setOffline(true);await failing('offline',{act:search('inconnu0'),message:/İnternet/,count:0});await context.setOffline(false);
  await failing('timeout',{answer:()=>'hang',act:search('inconnu1'),message:/zaman aşımına/,count:3,limits:{timeoutMs:300}});
  await failing('HTTP 500 on every model',{answer:()=>fail(500,'boom'),act:search('inconnu2'),message:/kullanılamıyor/,count:3});
  await failing('429 on every model',{answer:()=>fail(429,'You exceeded your current quota','RATE_LIMIT_EXCEEDED'),act:search('inconnu3'),message:/kota veya istek sınırı/,count:3});
  await failing('fallback failure (500, 429, 503): quota wins',{answer:n=>[fail(500,'a'),fail(429,'b'),fail(503,'c')][n-1],act:search('inconnu4'),message:/kota veya istek sınırı/,count:3});
  await failing('invalid API key: terminal, no fallback burn',{answer:()=>fail(400,'API key not valid. Please pass a valid API key.','API_KEY_INVALID'),act:search('inconnu5'),message:/API anahtarınızı ve kısıtlamalarını/,count:1});
  await failing('key restriction (referrer blocked)',{answer:()=>fail(403,'Requests from referer <empty> are blocked.','API_KEY_HTTP_REFERRER_BLOCKED'),act:search('inconnu6'),message:/API anahtarınızı ve kısıtlamalarını/,count:1});
  await failing('malformed JSON',{answer:()=>ok('this is not json'),act:search('inconnu7'),message:/geçersiz kelime verisi/,count:3});
  await failing('empty response',{answer:()=>({status:200,contentType:'application/json',body:'{"candidates":[]}'}),act:search('inconnu8'),message:/yanıt vermedi/,count:3});
  await failing('unavailable model on every fallback (404)',{answer:()=>fail(404,'models/x is not found','NOT_FOUND'),act:search('inconnu9'),message:/kullanılamıyor/,count:3});
  await failing('connection dropped: no pointless retries',{answer:()=>'drop',act:search('inconnu10'),message:/bağlantısı kurulamadı/,count:1});
  await page.evaluate(()=>VocVocSecrets.setApiKey('anahtar-ğüş'));await failing('key that can never be valid is rejected before any request',{act:search('inconnu11'),message:/API anahtarınızı ve kısıtlamalarını/,count:0});await page.evaluate(k=>VocVocSecrets.setApiKey(k),KEY);
  const slow=await failing('Daily total budget',{answer:()=>'hang',act:daily,message:/toplam süre sınırını/,limits:{timeoutMs:1000,dailyBudgetMs:1500}});
  assert(calls.length<=2&&slow.elapsed<8000,`budget exhausted after ${calls.length} requests in ${slow.elapsed} ms`);
  await failing('Daily: connection dropped',{answer:()=>'drop',act:daily,message:/Günlük kelimeler eklenemedi.*bağlantısı kurulamadı/,count:1});
  await failing('Random: 429 everywhere',{answer:()=>fail(429,'quota'),act:random,message:/kota veya istek sınırı/,count:3});
  record('Gemini errors: offline, timeout, HTTP 5xx, 429/quota, invalid key, key restriction, malformed JSON, empty, unavailable model, fallback failure, dropped connection, Daily budget: all localized, spinner closed, data untouched');
  // Fallback and structured output keep working.
  const models=await page.evaluate(()=>GEMINI_MODELS);
  calls.length=0;plan=n=>n===1?fail(429,'quota'):ok(wordCard('alpha'));await search('alphaq')();await page.waitForFunction(()=>!!VocVocData.getWordByText('alpha'));
  assert.deepEqual(calls.map(c=>c.model),models.slice(0,2));assert.equal(calls[0].key,KEY);assert(!calls[0].url.includes('key=')&&!calls[0].url.includes(KEY));
  assert.equal(calls[0].mime,'application/json');assert.equal(calls[0].schema.type,'OBJECT');assert(calls[0].schema.required.includes('word')&&calls[0].schema.required.includes('meaning'));
  // a card has exactly two example sentences and at most two idioms, each idiom with the sentence that uses it: asked in the prompt and in the schema
  assert(calls[0].prompt.includes('EXACTLY two example sentences')&&calls[0].prompt.includes('up to two common idioms'));
  assert.deepEqual([calls[0].schema.properties.examples.minItems,calls[0].schema.properties.examples.maxItems,calls[0].schema.properties.expressions.maxItems],[2,2,2]);
  assert.deepEqual(calls[0].schema.properties.expressions.items.required,['text','exampleText','exampleTranslation']);
  calls.length=0;plan=n=>n<=2?fail(404,'not found'):ok(wordCard('beta'));await search('betaq')();await page.waitForFunction(()=>!!VocVocData.getWordByText('beta'));assert.deepEqual(calls.map(c=>c.model),models);
  // the pronunciation guide is asked for in the user's ORIGINAL language (the "native" setting), whatever language the interface is in
  await page.evaluate(()=>VocVocData.updateSettings({appLanguage:'en'}));
  calls.length=0;plan=()=>ok(wordCard('zetaw'));await search('zetaq')();await page.waitForFunction(()=>!!VocVocData.getWordByText('zetaw'));
  assert(calls[0].prompt.includes('spelling habits of Turkish')&&!calls[0].prompt.includes('spelling habits of English'),'the guide must follow the original language, not the interface language');
  await page.evaluate(()=>VocVocData.updateSettings({appLanguage:'tr'}));
  record('Gemini fallback order preserved (429 -> next model, 404 -> next model); key only in the x-goog-api-key header; responseSchema sent');
  // A model that refuses the schema gets plain JSON mode, once, and it is remembered.
  await page.reload();await ready();
  calls.length=0;plan=n=>n===1?fail(400,'Invalid JSON payload received. Unknown name "responseSchema"'):ok(wordCard('gamma'));await search('gammaq')();await page.waitForFunction(()=>!!VocVocData.getWordByText('gamma'));
  assert.deepEqual(calls.map(c=>[c.model,!!c.schema]),[[models[0],true],[models[0],false]]);
  calls.length=0;plan=()=>ok(wordCard('gammb'));await search('gammbq')();await page.waitForFunction(()=>!!VocVocData.getWordByText('gammb'));assert.deepEqual(calls.map(c=>[c.model,!!c.schema]),[[models[0],false]]);
  record('Gemini schema refused by a model: plain JSON mode on the same model, remembered, no fallback consumed');
  // Daily and Random use their own schemas (a reload forgets which models refused one).
  await page.reload();await ready();
  calls.length=0;plan=()=>ok({words:Array.from({length:10},(_,i)=>wordCard('delta'+i))});await daily();await page.waitForFunction(()=>!!VocVocData.getWordByText('delta9'));
  assert.equal(calls.length,1);assert.equal(calls[0].schema.properties.words.type,'ARRAY');assert.equal(calls[0].schema.properties.words.items.properties.word.type,'STRING');
  assert(calls[0].prompt.includes('EXACTLY two example sentences')&&calls[0].schema.properties.words.items.properties.examples.minItems===2);   // the Daily words follow the same rule
  calls.length=0;plan=n=>n===1?ok({word:'epsilon'}):ok(wordCard('epsilon'));await random();await page.waitForFunction(()=>!!VocVocData.getWordByText('epsilon'));
  assert.deepEqual(calls[0].schema.required,['word']);assert.equal(calls[0].schema.properties.meaning,undefined);
  record('Gemini structured output: Daily words[] schema, Random headword schema');
  assert(allCalls.length>20&&allCalls.every(c=>c.key===KEY||c.key==='anahtar-ğüş')&&allCalls.every(c=>!c.url.includes('key=')),'every request carried the key only in the header');
  assert(logged.every(line=>!line.includes(KEY)),'the API key never reached the console');
  record('Gemini API key: never in a URL and never in the console across all scenarios');
  await context.close();
 }
 // ===== Accessibility (keyboard only, no pointer) =====
 {
  context=await browser.newContext({viewport:{width:1000,height:800}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await ready(); // fresh data: the Bonjour / Merci / Je starters
  const press=key=>page.keyboard.press(key);
  const active=()=>page.evaluate(()=>{const a=document.activeElement;return {id:a.id||'',tag:a.tagName,cls:String(a.className||''),text:(a.textContent||'').trim().slice(0,40),dialog:a.closest('[role="dialog"]')?.id||'',history:a.dataset?.historyWord||''};});
  const shown=id=>page.evaluate(i=>getComputedStyle(document.getElementById(i)).display!=='none',id);
  const waitShown=(id,on=true)=>page.waitForFunction(([i,want])=>(getComputedStyle(document.getElementById(i)).display!=='none')===want,[id,on]);
  const dialogInfo=id=>page.evaluate(i=>{const el=document.getElementById(i);return [el.getAttribute('role'),el.getAttribute('aria-modal'),(el.getAttribute('aria-labelledby')||'').split(' ').map(x=>document.getElementById(x)?.textContent||'').join(' ').trim()||el.getAttribute('aria-label')||''];},id);
  const tabUntil=async(test,limit=40)=>{for(let i=0;i<limit;i++){if(test(await active()))return true;await press('Tab');}return false;};
  const trapped=async(id,presses=40)=>{for(let i=0;i<presses;i++){await press('Tab');assert.equal((await active()).dialog,id,`Tab #${i} left ${id}`);}for(let i=0;i<8;i++){await press('Shift+Tab');assert.equal((await active()).dialog,id,`Shift+Tab #${i} left ${id}`);}};
  const unnamed=()=>page.evaluate(()=>{
   const visible=el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('[hidden],[inert]');
   const text=id=>document.getElementById(id)?.textContent||'';
   const nameOf=el=>{const by=el.getAttribute('aria-labelledby');if(by)return by.split(/\s+/).map(text).join(' ').trim();const label=el.getAttribute('aria-label');if(label&&label.trim())return label.trim();
    if(el.labels&&el.labels.length)return [...el.labels].map(l=>l.textContent).join(' ').trim();if(/^(BUTTON|A|SUMMARY)$/.test(el.tagName))return (el.textContent||'').trim()||(el.getAttribute('title')||'').trim();return '';};
   return [...document.querySelectorAll('input:not([type=hidden]),select,textarea,button,summary,a[href],[role=button]')].filter(visible).filter(el=>!nameOf(el)).map(el=>el.outerHTML.slice(0,140));
  });
  await page.evaluate(()=>{VocVocSecrets.setApiKey('A11Y-TEST-KEY');});
  // --- names: every visible control has an accessible name, in every main view
  assert.deepEqual(await unnamed(),[],'main view');
  assert.deepEqual(await page.evaluate(()=>[document.documentElement.lang,document.getElementById('searchInput').lang,document.getElementById('searchInput').getAttribute('aria-label')]),['tr','fr','Kelime girin...']);
  record('a11y: every control in the main view has an accessible name; search input is named and marked as the target language');

  // --- Settings: dialog semantics, focus trap, Escape, focus return, labelled controls, keyboard dropdowns
  await page.locator('[onclick="openModal()"]').focus();await press('Enter');await waitShown('modalOverlay');
  assert.deepEqual(await dialogInfo('modalOverlay'),['dialog','true','Ayarlar']);assert.equal((await active()).dialog,'modalOverlay');
  await page.evaluate(()=>{document.getElementById('backupControls').open=true;});
  assert.deepEqual(await unnamed(),[],'settings');
  assert.deepEqual(await page.evaluate(()=>['apiKeyInput','dailyLimitInput'].map(id=>[...document.getElementById(id).labels].map(l=>l.textContent).join(''))),['Gemini API anahtarı','Günlük kelime limiti']);
  await trapped('modalOverlay',45);
  // a dropdown works from the keyboard: Enter opens on the current value, arrows move, Enter chooses and focus returns to the button
  await page.locator('#themeDropdown .ui-dropdown-trigger').focus();
  assert.match(await page.evaluate(()=>{const b=document.querySelector('#themeDropdown .ui-dropdown-trigger');return b.getAttribute('aria-labelledby').split(' ').map(id=>document.getElementById(id).textContent).join(' ');}),/Tema.*Sistem/);
  await press('Enter');assert.match((await active()).cls,/ui-dropdown-option/);assert.equal(await page.evaluate(()=>document.activeElement.dataset.value),'system');
  await press('ArrowDown');await press('Enter');
  assert.deepEqual([await page.evaluate(()=>document.getElementById('themeSelect').value),(await active()).cls.includes('ui-dropdown-trigger'),await page.locator('#themeDropdown.open').count()],['light',true,0]);
  await press('Enter');await press('Escape'); // Escape closes only the open menu, the dialog stays
  assert.deepEqual([await page.locator('#themeDropdown.open').count(),await shown('modalOverlay'),(await active()).cls.includes('ui-dropdown-trigger')],[0,true,true]);
  // destructive confirmations: the safe button has focus, Escape cancels, focus goes back to where it was
  await page.locator('#resetProgressBtn').focus();await press('Enter');await waitShown('resetConfirmOverlay');
  assert.deepEqual(await dialogInfo('resetConfirmOverlay'),['dialog','true','İlerlemeyi Sıfırla']);assert.equal((await active()).id,'resetCancelBtn');
  await trapped('resetConfirmOverlay',12);await press('Escape');await waitShown('resetConfirmOverlay',false);
  assert.deepEqual([await shown('modalOverlay'),(await active()).id],[true,'resetProgressBtn']);
  await page.locator('#nativeLanguageDropdown .ui-dropdown-trigger').focus();await press('Enter');await press('ArrowDown');await press('Enter'); // choose another original language
  await waitShown('languageChangeOverlay');assert.equal((await active()).id,'languageChangeCancelBtn');assert.match((await dialogInfo('languageChangeOverlay'))[2],/Dil seçimi/);
  await press('Escape');await waitShown('languageChangeOverlay',false);
  assert.deepEqual([await page.evaluate(()=>document.getElementById('nativeLanguageSelect').value),(await active()).cls.includes('ui-dropdown-trigger')],['tr',true]); // nothing changed
  await press('Escape');await waitShown('modalOverlay',false);assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('onclick')),'openModal()');
  record('a11y: Settings + confirmation dialogs: role/aria-modal/name, focus trap, Escape, focus return, keyboard dropdowns, labelled fields');

  // --- Archive dialog
  await page.evaluate(()=>VocVocData.setStatus('Merci','archived'));
  await page.locator('[onclick="openModal()"]').focus();await press('Enter');await waitShown('modalOverlay');
  await page.waitForFunction(()=>!document.getElementById('archiveShowBtn').disabled); // Settings syncs this button one frame after opening
  await page.locator('#archiveShowBtn').focus();await press('Enter');await waitShown('archiveOverlay');
  assert.deepEqual(await dialogInfo('archiveOverlay'),['dialog','true','Arşiv']);assert.equal((await active()).dialog,'archiveOverlay');
  assert.deepEqual(await unnamed(),[],'archive');await trapped('archiveOverlay',20);
  await press('Escape');await waitShown('archiveOverlay',false);assert.notEqual((await active()).tag,'BODY'); // focus is not lost
  await page.evaluate(()=>VocVocData.setStatus('Merci','active'));await page.evaluate(()=>{renderHistory();renderAllLocal();});
  record('a11y: Archive dialog semantics, trap, Escape, focus not lost');

  // --- History details: dialog, target-language markup, no status buttons (the swipe does that), focus return
  const chip=word=>page.locator('.history-chip',{hasText:new RegExp(`^${word}( ✓)?$`)});
  await chip('Bonjour').focus();await press('Enter');await waitShown('historyDetails');
  assert.deepEqual(await dialogInfo('historyDetails'),['dialog','true','Bonjour']);assert.equal((await active()).dialog,'historyDetails');
  assert.deepEqual(await page.evaluate(()=>[document.querySelector('#historyDetails .word-title').lang,document.querySelector('#historyDetails .fr-text').lang,document.querySelector('.history-chip span').lang,document.querySelector('#historyDetails .section p').lang||'(inherits)']),['fr','fr','fr','(inherits)']);
  assert.deepEqual(await unnamed(),[],'history details');
  assert.deepEqual(await page.evaluate(()=>[document.querySelectorAll('#historyDetails .word-status-actions,#historyDetails [data-word-status]').length,document.querySelectorAll('#historyDetails .swipe-footer').length]),[0,1]);
  await press('Escape');await waitShown('historyDetails',false);
  assert.equal(await page.evaluate(()=>VocVocData.getWordProgress('Bonjour').status),'active');   // nothing changed without a swipe
  assert.equal((await active()).history,await page.evaluate(()=>encodeDomText('Bonjour'))); // back on the same chip
  await press('Enter');await waitShown('historyDetails');await press('Escape');await waitShown('historyDetails',false);assert.equal((await active()).history,await page.evaluate(()=>encodeDomText('Bonjour')));
  record('a11y: History details dialog; no status buttons under the card, swipe hints shown; target language marked; Escape returns focus to the chip');

  // --- Related word popup (opened from a synonym) stacks on top of the details dialog
  await page.route('https://generativelanguage.googleapis.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({word:'Salut',type:'interj.',meaning:'selam',synonyms:[],antonyms:[],examples:[],expressions:[]})}]}}]})}));
  await chip('Bonjour').focus();await press('Enter');await waitShown('historyDetails');
  await page.evaluate(()=>{document.querySelector('#historyDetails details.fold').open=true;});
  assert.equal(await tabUntil(a=>a.cls.includes('clickable-badge')),true);await press('Enter');await waitShown('relatedWordPopup');
  await page.waitForFunction(()=>!!document.querySelector('#relatedWordPopup [data-add-related-word]'));
  assert.deepEqual(await dialogInfo('relatedWordPopup'),['dialog','true','Salut']);assert.equal((await active()).dialog,'relatedWordPopup');await trapped('relatedWordPopup',25);
  await press('Escape');await waitShown('relatedWordPopup',false);assert.deepEqual([await shown('historyDetails'),(await active()).cls.includes('clickable-badge')],[true,true]);
  await press('Escape');await waitShown('historyDetails',false);
  record('a11y: related word popup is a stacked dialog (trap, Escape closes only the top one, focus returns to the synonym)');

  // --- Main word card: opens from the keyboard; memorizing and closing are swipes, so there are no buttons under the card
  await page.evaluate(()=>{document.getElementById('searchInput').value='';renderAllLocal();});
  await page.locator('.main-word-toggle').first().focus();await press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-expanded')),'true');
  const cardWord=await page.evaluate(()=>decodeDomText(document.activeElement.closest('.main-word-card').dataset.word));
  assert.deepEqual(await page.evaluate(()=>[document.querySelectorAll('#contentArea .main-word-card.open .word-status-actions,#contentArea .main-word-card.open button[data-card-memorize],#contentArea .main-word-card.open button[data-card-dismiss]').length,document.querySelectorAll('#contentArea .main-word-card.open .swipe-footer').length]),[0,1]);
  await page.evaluate(()=>{renderHistory();renderAllLocal();});
  record('a11y: main card opens from the keyboard and has no status buttons; the swipe hints are shown');

  // --- Flip: keyboard shortcuts, focus kept; no status button under the card (the swipe does that)
  await page.locator('#flipButton').focus();await press('Enter');await waitShown('flipOverlay');
  assert.deepEqual(await dialogInfo('flipOverlay'),['dialog','true','Anlamı görmek için dokun']);assert.equal((await active()).id,'flipCard');
  assert.deepEqual(await unnamed(),[],'flip');
  await press('f');assert.equal(await page.locator('#flipRotator.is-flipped').count(),1);await press('f');assert.equal(await page.locator('#flipRotator.is-flipped').count(),0);
  const firstCard=await page.locator('#flipCard').textContent();await press('ArrowRight');await page.waitForFunction(text=>document.querySelector('#flipCard').textContent!==text,firstCard);
  const flipWord=(await page.locator('#flipCard').textContent()).trim(),before=await page.evaluate(w=>VocVocData.getWordProgress(w).status,flipWord);
  await press('m');await page.waitForFunction(([w,was])=>VocVocData.getWordProgress(w).status!==was,[flipWord,before]);
  assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('flip-card')),true); // focus is back on the card after the re-render
  await press('m');await page.waitForFunction(([w,was])=>VocVocData.getWordProgress(w).status===was,[flipWord,before]); // the same shortcut undoes it
  assert.equal(await page.locator('#flipOverlay [data-flip-status],#flipOverlay .flip-actions').count(),0);
  await page.locator('[data-flip-face="front"] [data-flip-nav="1"]').focus();await press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.dataset.flipNav),'1'); // next-card button keeps focus
  await press('Escape');await waitShown('flipOverlay',false);assert.equal((await active()).id,'flipButton');
  record('a11y: Flip is fully keyboard-driven (F flips, arrows move, M memorizes/undoes, Escape closes), has no status button, and focus is kept/returned');

  // --- Test (quiz) with the keyboard only
  await page.evaluate(()=>VocVocData.addWordBatch(Array.from({length:12},(_,i)=>({word:'quizword'+i,meaning:'anlam '+i}))));await page.evaluate(()=>{renderHistory();renderAllLocal();});
  await page.locator('#testButton').focus();await press('Enter');
  await page.waitForFunction(()=>document.activeElement.classList.contains('quiz-option'));assert.equal(await page.locator('.quiz-option').first().getAttribute('lang'),'fr');
  assert.deepEqual(await unnamed(),[],'quiz');
  for(let q=1;q<=10;q++){
   await page.waitForFunction(n=>document.querySelector('.quiz-count-v91')?.textContent.includes(`${n}/10`)&&document.activeElement.classList.contains('quiz-option'),q);
   await press('Enter');
  }
  await page.waitForFunction(()=>document.activeElement.classList.contains('quiz-restart-btn'));
  await page.waitForFunction(()=>/^(doğru|yanlış)/.test(document.getElementById('a11yAnnouncer')?.textContent||''));
  record('a11y: Test runs with the keyboard only: focus moves to the first option of every question, result screen, answers announced');
  await context.close();
 }
 // ===== Localization =====
 {
  context=await browser.newContext();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await ready();
  const languages=['en','tr','fr','de','es','it'];
  // Product behaviour kept as is: the interface follows the original (native) language.
  const useLanguage=async lang=>{await page.evaluate(l=>VocVocData.updateSettings({nativeLanguage:l}),lang);await page.evaluate(()=>applyAppLanguage());};
  // 1) Each supported language renders without raw keys / undefined, and shows its own words.
  for(const lang of languages){
   await useLanguage(lang);
   const view=await page.evaluate(()=>{
    document.getElementById('backupControls').open=true;
    const camelKeys=Object.keys(I18N.en).filter(key=>/[a-z][A-Z]/.test(key));
    const attributes=[...document.querySelectorAll('[aria-label],[title],[placeholder]')].map(el=>[el.getAttribute('aria-label'),el.title,el.placeholder].join(' ')).join(' ');
    const clone=document.body.cloneNode(true);clone.querySelectorAll('script,style').forEach(el=>el.remove());const text=clone.textContent+' '+attributes; // visible and hidden UI text, without the code itself
    return {html:document.documentElement.lang,leaked:camelKeys.filter(key=>text.includes(key)),broken:/undefined|\[object |NaN/.test(text.replace(/AIza/g,'')),
     settings:document.getElementById('settingsTitle').textContent,apiLabel:document.getElementById('apiKeyLabel').textContent,search:document.getElementById('searchInput').placeholder,
     fonts:[...document.querySelectorAll('#fontSizeDropdown .ui-dropdown-option')].map(o=>o.textContent),expected:{settings:I18N[document.documentElement.lang].settings,apiLabel:I18N[document.documentElement.lang].apiKeyLabel,search:I18N[document.documentElement.lang].searchPlaceholder,fonts:['fontSmall','fontNormal','fontLarge','fontXLarge'].map(key=>I18N[document.documentElement.lang][key])}};
   });
   assert.equal(view.html,lang);assert.deepEqual(view.leaked,[],`${lang}: raw translation keys on screen`);assert.equal(view.broken,false,`${lang}: undefined/NaN on screen`);
   assert.deepEqual([view.settings,view.apiLabel,view.search,view.fonts],[view.expected.settings,view.expected.apiLabel,view.expected.search,view.expected.fonts],lang);
  }
  await useLanguage('tr');
  const turkish=await page.evaluate(()=>[...document.querySelectorAll('#modalOverlay, #archiveOverlay, #resetConfirmOverlay, #languageChangeOverlay, .study-actions, header')].map(el=>el.textContent+' '+[...el.querySelectorAll('[aria-label],[title]')].map(x=>x.getAttribute('aria-label')+' '+x.title).join(' ')).join(' '));
  assert.doesNotMatch(turkish,/\b(Settings|Archive|Delete|Cancel|Reset progress|Show archive|Save|Close|Search|Daily|Random word)\b/,'English text left in the Turkish interface');
  record('i18n: all six languages render complete (no raw keys, no undefined); Turkish interface has no English leftovers');
  // 2) A missing key, language or data layer never makes the interface fail.
  const robust=await page.evaluate(()=>{
   const out={};
   out.unknownKey=t('definitelyMissingKey');out.vars=t('only {n} left',{n:3});out.nullVars=t('save',null);
   delete I18N.tr.save;out.keyMissingInLanguage=t('save');I18N.tr.save='Kaydet';           // falls back to English, then restores
   VocVocData.updateSettings({nativeLanguage:'xx'});                                           // a language with no table
   return VocVocData.flush().then(()=>{
    out.unknownLanguage=t('save');
    const original=VocVocData.getSettings;VocVocData.getSettings=()=>{throw new Error('unavailable');};                  // data layer not ready
    try{out.noData=[t('save'),getAppLanguage()];}catch(error){out.noData='THREW '+error.message;}finally{VocVocData.getSettings=original;}
    return out;
   });
  });
  assert.deepEqual(robust,{unknownKey:'definitelyMissingKey',vars:'only 3 left',nullVars:'Kaydet',keyMissingInLanguage:'Save',unknownLanguage:'Save',noData:['Kaydet','tr']});
  await useLanguage('tr');
  record('i18n: unknown key, key missing in one language, unknown language and an unavailable data layer all fall back without throwing');
  // 3) One helper decides what "unlimited" means, in every language.
  const unlimited=await page.evaluate(()=>({
   own:Object.keys(I18N).map(lang=>isUnlimitedText(I18N[lang].unlimited)),
   typed:['Sinirsiz','SINIRSIZ',' sınırsız ','Unlimited','illimité','Unbegrenzt','ILIMITADO','illimitato','∞'].map(isUnlimitedText),
   no:['','10','unlimit','abc',null,undefined,'0'].map(isUnlimitedText)
  }));
  assert.deepEqual(unlimited,{own:[true,true,true,true,true,true],typed:Array(9).fill(true),no:Array(7).fill(false)});
  for(const [lang,word] of [['de','Unbegrenzt'],['es','Ilimitado'],['it','Illimitato'],['fr','Illimité'],['tr','Sınırsız'],['en','Unlimited']]){
   await useLanguage(lang);
   const result=await page.evaluate(async typed=>{
    const input=document.getElementById('dailyLimitInput');input.value=typed;syncDailyLimitSelection();
    const highlighted=document.querySelector('.daily-limit-menu .ui-dropdown-option[data-value="unlimited"]').classList.contains('selected');
    await saveApiKey();                                                                                      // reads the field, stores the limit
    return {highlighted,stored:VocVocData.getSettings().dailyLimit,shown:input.value,expected:t('unlimited')};
   },word);
   assert.deepEqual([result.highlighted,result.stored,result.shown],[true,'unlimited',result.expected],lang);
   await page.evaluate(()=>VocVocData.updateSettings({dailyLimit:'10'}));
  }
  await useLanguage('tr');
  record('i18n: "unlimited" is recognized in every language by one helper (highlight, save, display)');
  await context.close();
 }
 // ===== Large vocabularies (performance work) =====
 {
  // 450 active words: more than one page of chips (400) and of cards (100).
  context=await browser.newContext({viewport:{width:1000,height:800}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/baseline.html');
  await page.evaluate(()=>{const base=Date.parse('2026-01-01T00:00:00Z'),words={},aliases={},progress={};
   for(let i=0;i<450;i++){const word='mot'+String(i).padStart(4,'0'),id='fr:tr:'+word,stamp=new Date(base+i*60000).toISOString();
    words[id]={id,word,normalized:word,targetLanguage:'fr',nativeLanguage:'tr',type:'nom',meaning:'anlam '+word,synonyms:['syn'+i],antonyms:[],examples:[{text:'Exemple '+word,phonetic:'',translation:'örnek '+word}],expressions:[],createdAt:stamp,updatedAt:stamp};
    aliases[id]=id;progress[id]={wordId:id,status:'active',firstSeenAt:stamp,lastSeenAt:stamp,statusChangedAt:stamp,memorizedAt:null,archivedAt:null,archiveSourceStatus:null};}
   localStorage.setItem('VOCVOC_DB_V1',JSON.stringify({schemaVersion:1,meta:{starterWordsInitialized:true},settings:{nativeLanguage:'tr',targetLanguage:'fr',difficulty:'A1-A2',dailyLimit:'unlimited',theme:'system',fontSize:'normal'},words,aliases,progress,dailyUsage:{date:null,count:0}}));});
  await page.goto(url);await ready();
  const counts=()=>page.evaluate(()=>({chips:document.querySelectorAll('#historyArea .history-chip').length,cards:document.querySelectorAll('#contentArea .main-word-card').length,
   chipMore:document.querySelector('#historyArea [data-show-more]')?.textContent||'',cardMore:document.querySelector('#contentArea [data-show-more]')?.textContent||'',
   bodiesBuilt:document.querySelectorAll('.main-word-body[data-filled]').length,footers:document.querySelectorAll('.swipe-footer').length,nodes:document.getElementsByTagName('*').length}));
  const first=await counts();
  assert.deepEqual([first.chips,first.cards,first.chipMore,first.cardMore,first.bodiesBuilt,first.footers],[400,100,'Daha fazla göster (50)','Daha fazla göster (350)',0,0]); // a page, a button, no hidden detail built
  assert.equal(await page.evaluate(()=>VocVocData.getHistoryWords().length),450);                                                     // all words are still there
  // old words stay reachable: through the filter (searches everything) ...
  await page.fill('#historyFilterInput','mot0000');assert.deepEqual(await page.locator('#historyArea .history-chip').allTextContents(),['mot0000']);await page.fill('#historyFilterInput','');
  assert.equal((await counts()).chips,400);                                                                                           // clearing the filter returns to the first page
  // ... and through "Show more", which keeps keyboard focus on the first new item
  await page.locator('#historyArea [data-show-more]').focus();await page.keyboard.press('Enter');
  const all=await counts();assert.deepEqual([all.chips,all.chipMore],[450,'']);assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('history-chip')&&document.activeElement.textContent),'mot0049');
  await page.locator('#contentArea [data-show-more]').click();assert.deepEqual([(await counts()).cards,(await counts()).cardMore],[200,'Daha fazla göster (250)']);
  // a status change re-renders but does not collapse what the user expanded
  await page.evaluate(()=>VocVocData.setStatus('mot0449','memorized').then(()=>{renderHistory();renderAllLocal();}));
  assert.deepEqual([(await counts()).chips,(await counts()).cards],[450,200]);
  // sorting/filtering start again from the first page
  await page.evaluate(()=>{document.getElementById('historySort').value='za';renderHistory();});assert.equal((await counts()).chips,400);
  assert.equal(await page.locator('#historyArea .history-chip').first().textContent(),'mot0449 ✓');                                    // Z-A over ALL words, not just the page
  await page.evaluate(()=>{document.getElementById('historySort').value='none';renderHistory();});
  // card details are built only when a card is opened
  await page.locator('#contentArea .main-word-toggle').first().focus();await page.keyboard.press('Enter');
  assert.deepEqual([(await counts()).bodiesBuilt,(await counts()).footers],[1,1]);
  assert.equal(await page.locator('#contentArea .main-word-card.open .section p').first().textContent(),'anlam mot0448');
  assert.equal(await page.locator('#contentArea .main-word-card.open .word-status-actions').count(),0);
  assert.deepEqual(await page.evaluate(()=>{const unnamed=[...document.querySelectorAll('.show-more-btn')].filter(b=>!b.textContent.trim()).length;return [unnamed,document.querySelectorAll('[data-show-more]').length];}),[0,2]); // one for the chips, one for the cards
  record('large vocabulary: pages of chips/cards, every word still reachable (filter, Show more, status changes keep expansion), card details built on first open');
  await context.close();
 }
 // ===== Archive paging =====
 {
  context=await browser.newContext({viewport:{width:1000,height:800}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/baseline.html');
  await page.evaluate(()=>{const base=Date.parse('2026-01-01T00:00:00Z'),words={},aliases={},progress={};
   for(let i=0;i<430;i++){const word='arc'+String(i).padStart(4,'0'),id='fr:tr:'+word,stamp=new Date(base+i*60000).toISOString(),archived=i>=10; // 420 archived, 10 active
    words[id]={id,word,normalized:word,targetLanguage:'fr',nativeLanguage:'tr',type:'nom',meaning:'anlam '+word,synonyms:[],antonyms:[],examples:[],expressions:[],createdAt:stamp,updatedAt:stamp};
    aliases[id]=id;progress[id]={wordId:id,status:archived?'archived':'active',firstSeenAt:stamp,lastSeenAt:stamp,statusChangedAt:stamp,memorizedAt:null,archivedAt:archived?stamp:null,archiveSourceStatus:archived?'active':null};}
   localStorage.setItem('VOCVOC_DB_V1',JSON.stringify({schemaVersion:1,meta:{starterWordsInitialized:true},settings:{nativeLanguage:'tr',targetLanguage:'fr',difficulty:'A1-A2',dailyLimit:'unlimited',theme:'system',fontSize:'normal'},words,aliases,progress,dailyUsage:{date:null,count:0}}));});
  await page.goto(url);await ready();
  const archiveState=()=>page.evaluate(()=>({words:document.querySelectorAll('#archiveList .archive-word').length,more:document.querySelector('#archiveList [data-show-more]')?.textContent||'',meta:document.getElementById('archiveMeta').textContent}));
  const openArchiveFromSettings=async()=>{await page.evaluate(()=>openModal());await page.waitForFunction(()=>!document.getElementById('archiveShowBtn').disabled);await page.locator('#archiveShowBtn').click();await page.waitForFunction(()=>document.querySelectorAll('#archiveList .archive-word').length>0);};
  await openArchiveFromSettings();
  assert.deepEqual(await archiveState(),{words:400,more:'Daha fazla göster (20)',meta:'420 kelime'});                       // a page, the real total in the header
  await page.fill('#archiveSearchInput','arc0429');assert.deepEqual((await archiveState()).words,1);await page.fill('#archiveSearchInput',''); // the filter reaches words beyond the page
  assert.equal((await archiveState()).words,400);
  await page.locator('#archiveList [data-show-more]').click();assert.deepEqual([(await archiveState()).words,(await archiveState()).more],[420,'']);
  assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('archive-word')),true);                           // focus lands on the first new item
  await page.locator('#archiveList .archive-word').last().click();await page.locator('#archiveRestoreBtn').click();                  // selecting and restoring still works on a later page
  await page.waitForFunction(()=>VocVocData.getArchivedEntries().length===419);
  await page.evaluate(()=>closeArchive());await openArchiveFromSettings();
  await page.waitForFunction(()=>document.querySelectorAll('#archiveList .archive-word').length===400,null,{timeout:5000}).catch(()=>{});   // the first page is drawn a moment after the dialog opens
  assert.equal((await archiveState()).words,400);                                                                                  // reopening starts at the first page
  record('archive paging: a page of 400, every word reachable (filter, Show more, restore from a later page), reopening starts over');
  await context.close();
 }
 // ===== The "Reload" button of an update banner is blocked only by something really open =====
 {
  context=await browser.newContext({viewport:{width:1000,height:900}});
  const A=await context.newPage();A.on('pageerror',e=>errors.push(e.message));await A.goto(url);await ready(A);
  await A.evaluate(()=>VocVocData.addWordBatch(Array.from({length:30},(_,i)=>({word:'mot'+String(i).padStart(2,'0'),meaning:'anlam '+i}))));await A.evaluate(()=>{renderHistory();renderAllLocal();});
  const alertText=()=>A.evaluate(()=>document.querySelector('.app-alert .app-alert-text')?.textContent||'');
  assert.equal(await A.evaluate(()=>operationBusy()),false);
  // a Test that is running blocks the reload and says why; nothing reloads
  await A.evaluate(()=>{window.__sameDocument=true;startQuiz();showPwaUpdate(true);});
  assert.equal(await A.evaluate(()=>operationBusy()),true);
  await A.locator('#pwaUpdate .ui-button').click();await A.waitForFunction(()=>/Önce açık işlemi tamamlayın/.test(document.querySelector('.app-alert .app-alert-text')?.textContent||''));
  assert.equal(await A.evaluate(()=>window.__sameDocument),true);
  // the Test is finished and its result is on screen: nothing is open any more
  for(let question=0;question<10;question++){await A.locator('.quiz-option:not([disabled])').first().click();await A.waitForFunction(count=>quizSession.index>count,question);}
  await A.waitForSelector('.quiz-result-card');
  assert.deepEqual(await A.evaluate(()=>[!!quizSession,operationBusy()]),[true,false]);               // the finished session is still around, but it does not count
  // another tab commits while the result is on screen: the data is adopted, the result screen is not replaced, the stale banner goes away
  const B=await context.newPage();B.on('pageerror',e=>errors.push(e.message));await B.goto(url);await ready(B);
  await B.evaluate(()=>markMemorized('mot00'));
  await A.waitForFunction(()=>VocVocData.getWordProgress('mot00').status==='memorized'&&!document.getElementById('pwaUpdate'));
  assert.equal(await A.locator('.quiz-result-card').count(),1);await B.close();
  record('two tabs: a finished Test\'s result screen is not replaced by the other tab\'s commit (the data still follows)');
  // and now the button works: the page reloads
  await A.evaluate(()=>showPwaUpdate(true));
  await Promise.all([A.waitForNavigation(),A.locator('#pwaUpdate .ui-button').click()]);await ready(A);
  assert.equal(await A.evaluate(()=>window.__sameDocument===undefined),true);assert.equal(await A.evaluate(()=>VocVocData.getWordProgress('mot00').status),'memorized');
  record('update button: a running Test blocks it with an explanation, a finished Test (result on screen) does not');
  await context.close();
 }
 // ===== New interface (prototype): off by default; opt-in tab bar, simulated sign-in, simulated Free/Premium =====
 {
  // off by default: nothing of it is on the page
  context=await browser.newContext({viewport:{width:390,height:844}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const packRequests=[];page.on('request',r=>{if(r.url().includes('/packs/'))packRequests.push(r.url());});
  await page.goto(url);await ready();await pause(500);
  assert.deepEqual([packRequests,await page.evaluate(()=>document.querySelectorAll('.v2-speak,.v2-pack').length)],[[],0]);   // no download, no buttons
  assert.deepEqual(await page.evaluate(()=>[!!document.getElementById('v2Root'),document.body.classList.contains('v2'),typeof VocVocPlan,VocVocPlan.get(),VocVocPlan.has('stats'),!!document.getElementById('v2Dashboard'),getComputedStyle(document.querySelector('.study-actions')).display!=='none',localStorage.getItem('VOCVOC_ACTIVITY_V1')]),[false,false,'object','free',false,false,true,null]);
  await context.close();
  record('new interface: off by default (no tab bar, no sign-in); the plan helper exists and says Free');

  // opt-in with ?ui=v2: the simulated sign-in comes first
  context=await browser.newContext({viewport:{width:390,height:844}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'?ui=v2');await ready();await page.waitForSelector('#v2Auth.v2-open');
  assert.deepEqual(await page.evaluate(()=>[document.activeElement.id,document.getElementById('v2Root').inert,document.querySelector('.container').inert,document.getElementById('v2Auth').getAttribute('role')]),['v2AuthTitle',true,true,'dialog']);
  assert.match(await page.locator('#v2Auth').textContent(),/Simülasyon/);
  await page.locator('#v2AuthName').fill('Ayşe');await page.getByRole('button',{name:/Google/}).click();
  await page.waitForSelector('#v2Auth:not(.v2-open)',{state:'attached'});
  assert.deepEqual(await page.evaluate(()=>[document.getElementById('v2Root').inert,document.querySelector('.container').inert,JSON.parse(localStorage.getItem('VOCVOC_SIM_PROFILE')).name]),[false,false,'Ayşe']);
  record('new interface: the simulated sign-in comes first, blocks what is behind it, and a profile is remembered');

  // menu: the entries the tab bar had (Badges moved into Today), Settings last; Words is the existing home screen (search, word cards, the list), Today and the others are pages
  const entries=()=>page.evaluate(()=>[...document.querySelectorAll('.v2-nav-item')].map(item=>item.textContent+(item.getAttribute('aria-current')==='page'?'*':'')));
  assert.deepEqual(await entries(),['Bugün*','Kelimeler','Çalış','İstatistik','Profil','Ayarlar']);
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.v2-tabs,.v2-tab,[data-route="badges"]').length),0);   // no bar at the bottom, no Badges page
  assert.deepEqual(await page.evaluate(()=>[document.querySelector('.container').classList.contains('v2-away'),document.getElementById('v2Screen').dataset.route,document.querySelector('#v2Screen h1').textContent]),[true,'today','Bugün']);   // Today is a page
  for(const [entry,heading] of [['Çalış','Çalış'],['İstatistik','İstatistikler'],['Profil','Profil'],['Bugün','Bugün']]){
   await goTo(page,entry);
   assert.equal(await page.locator('#v2Screen h1').textContent(),heading);
   assert.equal(await page.evaluate(()=>document.activeElement.tagName),'H1');                                       // focus moves to the new page's heading
   assert.equal((await entries()).filter(label=>label.endsWith('*')).length,1);
   assert.equal(await page.evaluate(()=>document.querySelector('.container').classList.contains('v2-away')),true);  // the home screen steps aside
   assert.equal(await page.evaluate(()=>document.getElementById('v2Drawer').classList.contains('v2-open')),false);  // choosing an entry closes the menu
  }
  await goTo(page,'Kelimeler');                                                                          // the existing home screen takes over
  assert.deepEqual(await page.evaluate(()=>[document.getElementById('v2Screen').hidden,document.querySelector('.container').classList.contains('v2-away'),!!document.getElementById('searchInput').offsetParent,!!document.getElementById('historyPanel').offsetParent,document.querySelector('.v2-nav-item[aria-current="page"]').textContent]),[true,false,true,true,'Kelimeler']);
  await goTo(page,'Bugün');
  record('new interface: the menu has the five pages and Settings, Words is the existing home screen, Today and the others are full pages, the heading takes focus, one entry is current');

  // Today: daily goal, ready-made words, the three counts and the last seven days under them; no greeting, streak label, shortcut row, word cards or list; the old study row steps aside
  const dash=()=>page.evaluate(()=>({goal:document.querySelector('.v2-goal-value')?.textContent,bar:document.querySelector('#v2Dashboard .v2-bar')?.getAttribute('aria-valuenow'),stats:[...document.querySelectorAll('.v2-stat strong')].map(node=>node.textContent),oldRow:getComputedStyle(document.querySelector('.study-actions')).display,
   crowd:document.querySelectorAll('#v2Screen .v2-quick-btn,#v2Screen .v2-streak,#v2Screen #contentArea,#v2Screen #historyPanel,#v2Screen #searchInput').length,title:document.querySelector('#v2Screen h1').textContent,days:document.querySelectorAll('#v2Dashboard .v2-day').length,
   chartUnderCounts:document.querySelector('#v2Dashboard .v2-statline').nextElementSibling?.querySelector('.v2-days')!==null}));
  assert.deepEqual(await dash(),{goal:'0 / 10 kelime',bar:'0',stats:['3','0','0'],oldRow:'none',crowd:0,title:'Bugün',days:7,chartUnderCounts:true});
  assert(!/Merhaba|Seri:/.test(await page.locator('#v2Screen').textContent()));
  await page.evaluate(()=>VocVocData.addDailyUsage(3));                                                 // the dashboard follows every change of the data
  await page.evaluate(()=>VocVocData.addWordBatch(Array.from({length:12},(_,i)=>({word:'hubword'+i,meaning:'anlam '+i}))));
  await page.waitForFunction(()=>document.querySelector('.v2-goal-value')?.textContent==='3 / 10 kelime'&&document.querySelector('.v2-stat strong')?.textContent==='15');
  await page.evaluate(()=>markMemorized('hubword0'));
  await page.waitForFunction(()=>[...document.querySelectorAll('.v2-stat strong')].map(node=>node.textContent).join()==='14,1,1');
  assert.equal((await dash()).bar,'3');
  assert.match(await page.locator('#v2Dashboard .v2-day').last().locator('.sr-only').textContent(),/: 12 eklendi, 1 ezberlendi, 0 test$/);   // the chart follows the data too (the starters are not counted)
  record('new interface: Today shows the daily goal, the counts and the last seven days (no greeting, streak label, shortcuts or word list) and follows every data change');

  // Test page: its own page, immersive (no tab bar), with a progress bar; closing abandons it
  await goTo(page,'Çalış');
  assert.match(await page.locator('.v2-study-card',{hasText:'Test'}).textContent(),/14 aktif kelimeden 10 soru/);
  await page.locator('.v2-study-card',{hasText:'Test'}).click();await page.waitForSelector('#v2QuizHost .quiz-option');
  const testState=()=>page.evaluate(()=>({hash:location.hash,running:!!quizSession,tabs:getComputedStyle(document.querySelector('.v2-appbar')).display,count:document.getElementById('v2QuizCount').textContent,now:document.getElementById('v2QuizProgress').getAttribute('aria-valuenow'),inHost:!!document.querySelector('#v2QuizHost .quiz-card'),inList:!!document.querySelector('#contentArea .quiz-card'),focus:document.activeElement.classList.contains('quiz-option')}));
  assert.deepEqual(await testState(),{hash:'#/test',running:true,tabs:'none',count:'Soru 1/10',now:'0',inHost:true,inList:false,focus:true});
  await page.locator('#v2QuizHost .quiz-option').first().click();await page.waitForFunction(()=>document.getElementById('v2QuizCount').textContent==='Soru 2/10');
  assert.equal((await testState()).now,'1');
  await page.getByRole('button',{name:'Kapat'}).click();
  assert.deepEqual(await page.evaluate(()=>[location.hash,!!quizSession,getComputedStyle(document.querySelector('.v2-appbar')).display,document.getElementById('v2Screen').dataset.route]),['#/study',false,'flex','study']);
  // finishing: the result is on the page, "new test" starts again on the same page
  await page.locator('.v2-study-card',{hasText:'Test'}).click();await page.waitForSelector('#v2QuizHost .quiz-option');
  for(let question=0;question<10;question++){await page.locator('#v2QuizHost .quiz-option:not([disabled])').first().click();await page.waitForFunction(count=>quizSession.index>count,question);}
  await page.waitForSelector('#v2QuizHost .quiz-result-card');
  assert.deepEqual(await page.evaluate(()=>[document.getElementById('v2QuizCount').textContent,document.getElementById('v2QuizProgress').getAttribute('aria-valuenow'),operationBusy()]),['Tamamlandı','10',false]);
  await page.locator('#v2QuizHost .quiz-restart-btn').click();await page.waitForSelector('#v2QuizHost .quiz-option');
  assert.deepEqual(await page.evaluate(()=>[!!quizSession,document.getElementById('v2QuizCount').textContent,!!document.querySelector('#contentArea .quiz-card')]),[true,'Soru 1/10',false]);
  await page.goBack();                                                                                   // the Android back button leaves the Test
  assert.deepEqual(await page.evaluate(()=>[!!quizSession,document.getElementById('v2Screen').dataset.route]),[false,'study']);
  // Recall needs 10 memorized words: until then the page says how many there are
  await page.locator('.v2-study-card',{hasText:'Hatırla'}).click();
  assert.match(await page.locator('#v2Screen').textContent(),/en az 10 ezberlenmiş kelime gerekir. Şu an 1 var/);
  assert.equal(await page.evaluate(()=>!!quizSession),false);await page.getByRole('button',{name:'Bugün ekranına dön'}).click();
  assert.deepEqual(await page.evaluate(()=>[document.getElementById('v2Screen').hidden,document.getElementById('v2Screen').dataset.route]),[false,'today']);
  record('new interface: the Test is a page of its own (no tab bar, progress, result, new test), closing and the back button abandon it, Recall explains when there are too few words');

  // Flip page: the app's own Flip dialog shown like a page and tied to the address; every way of closing it returns
  await goTo(page,'Çalış');await page.locator('.v2-study-card',{hasText:'Flip'}).click();
  await page.waitForSelector('#flipOverlay.open [data-flip-face="front"]');
  assert.deepEqual(await page.evaluate(()=>[location.hash,!!flipSession,document.getElementById('v2Screen').dataset.route,getComputedStyle(document.getElementById('flipOverlay')).backgroundColor!=='rgba(0, 0, 0, 0.48)']),['#/flip',true,'flip',true]);
  await page.goBack();                                                                                   // Android back closes it
  assert.deepEqual(await page.evaluate(()=>[location.hash,!!flipSession,document.getElementById('flipOverlay').classList.contains('open')]),['#/study',false,false]);
  await page.locator('.v2-study-card',{hasText:'Flip'}).click();await page.waitForSelector('#flipOverlay.open [data-flip-face="front"]');
  await page.locator('#flipOverlay [data-flip-face="front"] .word-popup-close').click();               // its own close button
  await page.waitForFunction(()=>location.hash==='#/study');
  assert.equal(await page.evaluate(()=>!!flipSession),false);
  await page.locator('.v2-study-card',{hasText:'Flip'}).click();await page.waitForSelector('#flipOverlay.open [data-flip-face="front"]');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>location.hash==='#/study');         // Escape
  record('new interface: Flip is tied to the address: Android back, its close button and Escape all close it and return to the study page');

  // Free: Statistics are locked and lead to Premium; simulating Premium unlocks them and switches the API key off
  await goTo(page,'İstatistik');
  assert.equal(await page.locator('#v2Screen .v2-locked').count(),1);
  await page.getByRole('button',{name:"Premium'a geç"}).click();assert.equal(await page.locator('#v2Screen h1').textContent(),'Premium');
  assert.match(await page.locator('#v2Screen').textContent(),/API anahtarı: etkin/);
  await page.getByRole('button',{name:"Premium'u simüle et"}).click();
  assert.deepEqual(await page.evaluate(()=>[VocVocPlan.get(),VocVocPlan.has('stats'),VocVocPlan.has('sentenceBuilder'),VocVocPlan.ownKeyActive(),localStorage.getItem('VOCVOC_SIM_PLAN')]),['premium',true,true,false,'premium']);
  assert.match(await page.locator('#v2Screen').textContent(),/API anahtarı: devre dışı/);
  await goTo(page,'İstatistik');assert.equal(await page.locator('#v2Screen .v2-locked').count(),0);
  record('new interface: Statistics are locked on Free, "Premium" simulation unlocks them and switches the own API key off');

  // the choices survive a reload and a normal page does not ask for sign-in again
  await page.goto(url+'#/profile');await ready();
  assert.deepEqual(await page.evaluate(()=>[document.getElementById('v2Auth').classList.contains('v2-open'),VocVocPlan.get(),document.querySelector('#v2Screen h1')?.textContent]),[false,'premium','Profil']);
  assert.match(await page.locator('#v2Screen').textContent(),/Ayşe/);
  // Android back button: pages are history entries
  await page.getByRole('button',{name:/Gizlilik Politikası/}).click();assert.equal(await page.locator('#v2Screen h1').textContent(),'Gizlilik Politikası');
  await page.goBack();assert.equal(await page.locator('#v2Screen h1').textContent(),'Profil');
  record('new interface: plan and profile survive a reload, the route comes from the address, and the back button returns to the previous page');

  // the text pages say what the app really does, and are marked as drafts
  for(const [row,heading,expected] of [['Gizlilik Politikası','Gizlilik Politikası',/Gemini API/],['Kullanım Şartları','Kullanım Şartları',/Google Play/],['Yardım','Yardım',/Ezberimde/],['Hakkında','Hakkında',/Sürüm: \d+\.\d+\.\d+/]]){
   await page.locator('#v2Screen').getByRole('button',{name:new RegExp(row)}).click();
   assert.equal(await page.locator('#v2Screen h1').textContent(),heading);assert.match(await page.locator('#v2Screen').textContent(),expected);
   if(/Gizlilik|Kullanım/.test(row))assert.match(await page.locator('#v2Screen .v2-note').first().textContent(),/Taslak/);
   await page.goBack();
  }
  // signing out only asks again; the learning data stays. "Back to the old interface" removes the new one.
  const wordCount=await page.evaluate(()=>VocVocData.getWords().length);
  await page.getByRole('button',{name:/Çıkış yap/}).click();await page.waitForSelector('#v2Auth.v2-open');
  assert.equal(await page.evaluate(()=>VocVocData.getWords().length),wordCount);
  await page.getByRole('button',{name:/Misafir olarak/}).click();await page.waitForSelector('#v2Auth:not(.v2-open)',{state:'attached'});
  await page.evaluate(()=>{location.hash='#/profile';});await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:/Eski arayüze dön/}).click()]);await ready();
  assert.deepEqual(await page.evaluate(()=>[!!document.getElementById('v2Root'),localStorage.getItem('VOCVOC_UI')]),[false,null]);
  record('new interface: draft policy/terms/help/about pages, sign-out keeps the data, "old interface" turns the new one off');
  await context.close();
 }
 // ===== New interface: finished tests are recorded, badges are earned, statistics and badges screens =====
 {
  const quizWords=n=>Array.from({length:n},(_,index)=>({word:'qa'+index,meaning:'anlam '+index}));
  // a finished Test is recorded; a perfect one earns badges, announced once
  context=await browser.newContext({viewport:{width:390,height:844}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'?ui=v2');await ready();await page.waitForSelector('#v2Auth.v2-open');await page.getByRole('button',{name:/Misafir olarak/}).click();await page.waitForSelector('#v2Auth:not(.v2-open)',{state:'attached'});
  const activity=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('VOCVOC_ACTIVITY_V1')));
  assert.deepEqual(await page.evaluate(()=>[JSON.parse(localStorage.getItem('VOCVOC_ACTIVITY_V1')).seeded,document.getElementById('v2Celebrate')?.classList.contains('v2-on')||false]),[true,false]);   // the very first look is silent
  await page.evaluate(words=>VocVocData.addWordBatch(words),quizWords(12));
  await page.evaluate(()=>{location.hash='#/test';});await page.waitForSelector('#v2QuizHost .quiz-option');
  for(let question=0;question<10;question++){
   const answer=await page.evaluate(()=>quizSession.questions[quizSession.index].word);
   await page.locator('#v2QuizHost .quiz-option:not([disabled])',{hasText:new RegExp('^'+answer.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).click();
   await page.waitForFunction(count=>quizSession.index>count,question);
  }
  await page.waitForSelector('#v2QuizHost .quiz-result-card');
  const todayDay=await page.evaluate(()=>VocVocStats.localDay(new Date().toISOString()));
  const saved=await activity();
  assert.deepEqual([saved.testsTaken,saved.quizzes.length,saved.quizzes[0].mode,saved.quizzes[0].score,saved.quizzes[0].total,saved.quizzes[0].wrong],[1,1,'active',10,10,[]]);
  assert.deepEqual([saved.badges.test1,saved.badges.perfect,saved.badges.words50],[todayDay,todayDay,undefined]);
  await page.waitForSelector('#v2Celebrate.v2-on');
  assert.deepEqual([await page.locator('.v2-celebrate-kicker').textContent(),await page.locator('.v2-celebrate-name').textContent()],['2 yeni rozet!','İlk test, Kusursuz']);
  // the same finished Test is not recorded twice (the result screen is drawn again, for example on a language change)
  await page.evaluate(()=>{renderQuizQuestion();renderQuizQuestion();});assert.equal((await activity()).testsTaken,1);
  await page.reload();await ready();
  assert.deepEqual(await page.evaluate(()=>[JSON.parse(localStorage.getItem('VOCVOC_ACTIVITY_V1')).testsTaken,document.getElementById('v2Celebrate')?.classList.contains('v2-on')||false]),[1,false]);   // remembered, not announced again
  await context.close();
  record('new interface: a finished Test is recorded once, a perfect one earns badges that are announced once, the first look is silent');
 }
 {
  // seeded history: 30 words (12 memorized on days 0..9, two days after being added), 3 finished tests, a signed-in profile, Premium
  const noon=back=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-back);return date.toISOString();};
  const seedHistory=([stamps,quizDays,seeded])=>{
   if(sessionStorage.getItem('seededHistory'))return;sessionStorage.setItem('seededHistory','1');
   const words={},aliases={},progress={};
   for(let i=0;i<30;i++){const word='s'+i,id='fr:tr:'+word,memorizedWord=i<12,added=memorizedWord?stamps[(i%10)+2]:stamps[i%7],memorized=memorizedWord?stamps[i%10]:null;
    words[id]={id,word,normalized:word,targetLanguage:'fr',nativeLanguage:'tr',type:'isim',meaning:'anlam '+i,synonyms:[],antonyms:[],examples:[],expressions:[],createdAt:added,updatedAt:added};aliases[id]=id;
    progress[id]={wordId:id,status:memorizedWord?'memorized':'active',firstSeenAt:added,lastSeenAt:added,statusChangedAt:memorized||added,memorizedAt:memorized,archivedAt:null,archiveSourceStatus:null};}
   localStorage.setItem('VOCVOC_DB_V1',JSON.stringify({schemaVersion:1,meta:{starterWordsInitialized:true},settings:{nativeLanguage:'tr',targetLanguage:'fr',difficulty:'A1-A2',dailyLimit:'10',theme:'system',fontSize:'normal'},words,aliases,progress,dailyUsage:{date:null,count:0}}));
   localStorage.setItem('VOCVOC_SIM_PROFILE',JSON.stringify({mode:'google-sim',name:'Ayşe'}));localStorage.setItem('VOCVOC_SIM_PLAN','premium');
   localStorage.setItem('VOCVOC_ACTIVITY_V1',JSON.stringify({v:1,seeded,testsTaken:3,badges:{},quizzes:[
    {t:quizDays[0],mode:'active',score:6,total:10,wrong:['s20','s21','s22','s23']},{t:quizDays[1],mode:'recall',score:9,total:10,wrong:['s20']},{t:quizDays[2],mode:'active',score:10,total:10,wrong:[]}]}));
  };
  const open=async seeded=>{
   const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
   await c.addInitScript(seedHistory,[Array.from({length:14},(_,back)=>noon(back)),[noon(1),noon(0),noon(0)],seeded]);
   await p.goto(url+'?ui=v2');await ready(p);await p.waitForFunction(()=>!!document.getElementById('v2Root'));
   return {c,p};
  };
  const route=async(p,name)=>{await p.evaluate(r=>{location.hash='#/'+r;},name);await p.waitForSelector(`#v2Screen[data-route="${name}"] h1`);};

  // statistics (Premium): every number worked out from the seeded history
  {
   const {c,p}=await open(true);await route(p,'stats');
   assert.deepEqual(await p.locator('.v2-statline-4 .v2-stat').evaluateAll(nodes=>nodes.map(node=>node.textContent)),['30Toplam kelime','12Ezberlenen','12Seri (gün)','12En uzun seri']);
   assert.equal(await p.locator('.v2-day').count(),7);
   assert.match(await p.locator('.v2-day').last().locator('.sr-only').textContent(),/: 3 eklendi, 2 ezberlendi, 2 test$/);
   assert.equal(await p.locator('.v2-curve').getAttribute('aria-label'),'30 gün önce 0, şimdi 12 ezberlenmiş kelime.');
   assert.deepEqual(await p.locator('#v2Screen .v2-statline:not(.v2-statline-4) .v2-stat strong').evaluateAll(nodes=>nodes.map(node=>node.textContent)),['3','83%','10/10']);
   assert.equal(await p.locator('.v2-testlist').count(),0);                                          // the latest tests are listed at the bottom of the Study page, not here
   assert.deepEqual(await p.locator('.v2-chips li').evaluateAll(nodes=>nodes.map(node=>node.textContent.replace(/\s+/g,' ').trim())),['s20 ×2','s21 ×1','s22 ×1','s23 ×1']);
   // a word you miss is a pill that opens its panel, like a chip of the History list; a word that left the list is plain text (pressing it would only start a search)
   assert.equal(await p.locator('.v2-chips li button.history-chip').count(),4);
   await p.locator('.v2-chips li button.history-chip').first().click();await p.waitForSelector('#historyDetails.open .word-title');
   assert.equal(await p.locator('#historyDetails .word-title').first().textContent(),'s20');
   await p.evaluate(()=>closeHistoryDetail());
   await p.evaluate(()=>archiveWord('s23'));await route(p,'today');await route(p,'stats');
   assert.deepEqual(await p.locator('.v2-chips li').evaluateAll(nodes=>nodes.map(node=>[node.querySelector('button')!==null,node.textContent.replace(/\s+/g,' ').trim()])),[[true,'s20 ×2'],[true,'s21 ×1'],[true,'s22 ×1'],[false,'s23 ×1']]);
   assert.match(await p.locator('#v2Screen').textContent(),/2 gün \(12 kelimeye göre\)/);
   // the Study page: the same Tests panel on top, the latest tests at the very bottom, newest first, a bullet by score (10 and 9 green, 6 orange)
   await route(p,'study');
   assert.deepEqual(await p.locator('#v2Screen .v2-statline .v2-stat strong').evaluateAll(nodes=>nodes.map(node=>node.textContent)),['3','83%','10/10']);
   assert.equal(await p.locator('#v2Screen .v2-page').evaluate(node=>[...node.children].map(child=>child.tagName+(child.querySelector('.v2-testlist')?'-list':'')).join()),'H1,SECTION,BUTTON,BUTTON,BUTTON,BUTTON,SECTION-list');
   assert.deepEqual(await p.locator('.v2-testlist li strong').evaluateAll(nodes=>nodes.map(node=>node.textContent)),['10/10','9/10','6/10']);
   assert.deepEqual(await p.locator('.v2-testlist .v2-bullet').evaluateAll(nodes=>nodes.map(node=>node.className.replace('v2-bullet ',''))),['v2-bullet-great','v2-bullet-great','v2-bullet-fair']);
   // Today shows the last seven days of the same history (the streak is on the Statistics page)
   await route(p,'today');assert.equal(await p.locator('#v2Dashboard .v2-day').count(),7);
   assert.match(await p.locator('#v2Dashboard .v2-day').last().locator('.sr-only').textContent(),/: 3 eklendi, 2 ezberlendi, 2 test$/);
   assert.equal(await p.locator('.v2-streak').count(),0);
   await c.close();
  }
  // badges (free): earned ones with their real dates first, the others with their progress
  {
   const {c,p}=await open(false);await route(p,'today');
   assert.equal(await p.locator('.v2-badges-section > .v2-muted').textContent(),'7 / 14 rozet kazanıldı');
   assert.equal(await p.locator('.v2-days').count(),1);                                                // right under the last seven days
   assert.equal(await p.locator('.v2-days').evaluate(node=>node.closest('.v2-card').nextElementSibling.className),'v2-badges-section');
   const names=selector=>p.locator(selector).evaluateAll(nodes=>nodes.map(node=>node.querySelector('h3').textContent));
   assert.deepEqual((await names('.v2-badge.v2-earned')).sort(),['Bir hafta','Güçlü hafıza','Isınma','Kusursuz','On kelime','İlk adım','İlk test'].sort());
   assert.match(await p.locator('.v2-earned .v2-badge-date').first().textContent(),/^Kazanıldı: \d{1,2} \p{L}+ \d{4}$/u);
   // three tabs: Earned (open, with counts), Started (closest first, with their progress), Waiting (nothing done yet)
   const tabLabels=()=>p.locator('.v2-subtab').evaluateAll(nodes=>nodes.map(node=>node.textContent.replace(/\s+/g,' ').trim()+(node.getAttribute('aria-selected')==='true'?'*':'')));
   assert.deepEqual(await tabLabels(),['Kazandıkların 7*','Başladıkların 6','Bekleyenler 1']);
   assert.deepEqual(await p.evaluate(()=>[document.querySelector('.v2-subtabs').getAttribute('role'),[...document.querySelectorAll('.v2-subtab')].map(tab=>[tab.getAttribute('role'),tab.tabIndex]),document.getElementById('v2BadgePanel').getAttribute('role'),document.getElementById('v2BadgePanel').getAttribute('aria-labelledby')]),['tablist',[['tab',0],['tab',-1],['tab',-1]],'tabpanel','v2BadgeTab-earned']);
   await p.getByRole('tab',{name:/Başladıkların/}).click();
   assert.deepEqual(await names('.v2-badge'),['Koleksiyoncu','Bir ay','Düzenli çalışan','Elli kelime','Yüz kelime','Kelime ustası']);   // the closest to done first
   const fifty=p.locator('.v2-badge',{hasText:'Elli kelime'});
   assert.match(await fifty.textContent(),/12 \/ 50/);assert.equal(await fifty.locator('[role="progressbar"]').getAttribute('aria-valuenow'),'12');
   await p.getByRole('tab',{name:/Bekleyenler/}).click();
   assert.deepEqual(await names('.v2-badge'),['Hedef tamam']);
   assert.deepEqual(await tabLabels(),['Kazandıkların 7','Başladıkların 6','Bekleyenler 1*']);
   await route(p,'study');await route(p,'today');                                                       // the tab you picked stays picked
   assert.deepEqual(await tabLabels(),['Kazandıkların 7','Başladıkların 6','Bekleyenler 1*']);
   // the keyboard moves between the tabs: arrows (they wrap), Home and End; the focus follows
   await p.getByRole('tab',{name:/Bekleyenler/}).focus();await p.keyboard.press('ArrowRight');
   assert.deepEqual([await p.evaluate(()=>document.activeElement.id),(await tabLabels())[0]],['v2BadgeTab-earned','Kazandıkların 7*']);
   await p.keyboard.press('End');assert.equal(await p.evaluate(()=>document.activeElement.id),'v2BadgeTab-waiting');
   await p.keyboard.press('Home');await p.keyboard.press('ArrowLeft');assert.equal(await p.evaluate(()=>document.activeElement.id),'v2BadgeTab-waiting');
   await p.getByRole('tab',{name:/Kazandıkların/}).click();
   // the first look recorded them silently (no announcement), with the days they were really earned
   assert.deepEqual(await p.evaluate(()=>[document.getElementById('v2Toast')?.classList.contains('v2-show')||false,Object.keys(JSON.parse(localStorage.getItem('VOCVOC_ACTIVITY_V1')).badges).length,JSON.parse(localStorage.getItem('VOCVOC_ACTIVITY_V1')).seeded]),[false,7,true]);
   // a badge once earned stays earned when the words behind it are gone
   await p.evaluate(async()=>{for(let i=0;i<12;i++)await VocVocData.setStatus('s'+i,'active');});
   await route(p,'study');await route(p,'today');
   assert.equal(await p.locator('.v2-badge.v2-earned',{hasText:'On kelime'}).count(),1);
   await c.close();
  }
  // a profile that already has history and badges is announced when it is a later look (new badges), by two names and a count
  {
   const {c,p}=await open(true);
   await p.waitForSelector('#v2Celebrate.v2-on');
   assert.equal(await p.locator('.v2-celebrate-kicker').textContent(),'7 yeni rozet!');
   assert.match(await p.locator('.v2-celebrate-name').textContent(),/^.+, .+ \+5$/);
   await c.close();
  }
  record('new interface: Statistics (Premium) and Badges (free) are computed from the history: numbers, charts, dates, progress, kept badges, silent first look');
 }
 // ===== New interface: bullets of the latest tests, the new-badge card, the bottom edge of every page =====
 {
  const words=n=>Array.from({length:n},(_,index)=>({word:'cw'+index,meaning:'anlam '+index}));
  const openGuest=async({scores,width=360,height=640,context:options={}}={})=>{
   const c=await browser.newContext({viewport:{width,height},...options}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
   if(scores)await c.addInitScript(list=>{if(!localStorage.getItem('VOCVOC_ACTIVITY_V1'))localStorage.setItem('VOCVOC_ACTIVITY_V1',JSON.stringify({v:1,seeded:false,testsTaken:list.length,badges:{},quizzes:list.map((score,index)=>({t:new Date(Date.now()-(list.length-index)*864e5).toISOString(),mode:'active',score,total:10,wrong:[]}))}));},scores);
   await p.goto(url+'?ui=v2');await ready(p);await p.waitForSelector('#v2Auth.v2-open');await p.getByRole('button',{name:/Misafir olarak/}).click();await p.waitForSelector('#v2Auth:not(.v2-open)',{state:'attached'});
   return {c,p};
  };
  const openStudy=async p=>{await p.evaluate(()=>{location.hash='#/study';});await p.waitForSelector('#v2Screen[data-route="study"] h1');};

  // the latest tests are on the Study page (free): a bullet by score, 9-10 green, 7-8 blue, 5-6 orange, below that red; every edge of every band
  for(const [scores,shown,classes] of [
   [[4,5,7,9,10],[10,9,7,5,4],['great','great','good','fair','low']],
   [[6,8,2,10,9],[9,10,2,8,6],['great','great','low','good','fair']]]){
   const {c,p}=await openGuest({scores});await openStudy(p);
   assert.equal(await p.evaluate(()=>VocVocPlan.get()),'free');                                       // not a Premium page
   assert.deepEqual(await p.locator('.v2-testlist li strong').evaluateAll(nodes=>nodes.map(node=>node.textContent)),shown.map(score=>score+'/10'));
   assert.deepEqual(await p.locator('.v2-testlist .v2-bullet').evaluateAll(nodes=>nodes.map(node=>node.className.replace('v2-bullet v2-bullet-',''))),classes);
   assert.equal(await p.locator('.v2-testlist li').first().evaluate(node=>node.firstElementChild.classList.contains('v2-bullet')),true);   // the bullet starts the line
   if(scores[0]===4){
    const colours=await p.locator('.v2-testlist .v2-bullet').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node,'::before').backgroundColor));
    assert.equal(new Set(colours).size,4,'four bands, four colours: '+colours);
   }
   await c.close();
  }
  {
   const {c,p}=await openGuest();await openStudy(p);                                                   // no test yet
   assert.deepEqual(await p.locator('#v2Screen .v2-statline .v2-stat strong').evaluateAll(nodes=>nodes.map(node=>node.textContent)),['0','–','–']);
   assert.equal(await p.locator('.v2-testlist').count(),0);
   assert.match(await p.locator('#v2Screen').textContent(),/Henüz tamamlanmış test yok/);
   await c.close();
  }
  record('Study page: the Tests panel on top and the latest tests at the bottom for a free user, a coloured bullet by score at every band edge, an empty state');

  // a new badge: in the middle, with a burst, away by itself, never in the way; several in a row wait their turn
  {
   const {c,p}=await openGuest({height:700});
   await p.evaluate(list=>VocVocData.addWordBatch(list),words(12));
   await p.evaluate(()=>{window.__seen=[];new MutationObserver(()=>{for(const node of document.querySelectorAll('.v2-celebrate-name'))if(!window.__seen.some(item=>item.name===node.textContent))window.__seen.push({name:node.textContent,at:performance.now()});}).observe(document.body,{childList:true,subtree:true});});
   await p.evaluate(()=>markMemorized('cw0'));
   await p.waitForSelector('#v2Celebrate.v2-on');await p.waitForTimeout(900);                          // the entrance is over
   const card=await p.evaluate(()=>{
    const box=document.querySelector('.v2-celebrate-card').getBoundingClientRect(),host=document.getElementById('v2Celebrate');
    return {dx:Math.round(Math.abs(box.left+box.width/2-innerWidth/2)),dy:Math.round(Math.abs(box.top+box.height/2-innerHeight/2)),role:host.getAttribute('role'),events:getComputedStyle(host).pointerEvents,
     sparks:document.querySelectorAll('.v2-spark').length,motion:[getComputedStyle(document.querySelector('.v2-medal')).animationName,getComputedStyle(document.querySelector('.v2-spark')).animationName],
     text:[...document.querySelectorAll('.v2-celebrate-kicker,.v2-celebrate-name,.v2-celebrate-desc')].map(node=>node.textContent),hiddenArt:document.querySelector('.v2-celebrate-art').getAttribute('aria-hidden')};
   });
   assert.deepEqual(card,{dx:0,dy:card.dy,role:'status',events:'none',sparks:12,motion:['v2-medal-in','v2-spark'],text:['Yeni rozet!','İlk adım','Bir kelimeyi ezberle.'],hiddenArt:'true'});
   assert(card.dy<=2,'centred vertically: '+card.dy);
   await goTo(p,'Çalış');                                                                              // it never blocks a tap
   assert.equal(await p.evaluate(()=>document.getElementById('v2Screen').dataset.route),'study');
   for(let index=1;index<10;index++)await p.evaluate(number=>markMemorized('cw'+number),index);       // the tenth memorized word earns the next badge while the first card is still up
   await p.waitForFunction(()=>window.__seen.length===2,null,{timeout:12000});
   const seen=await p.evaluate(()=>window.__seen);
   assert.deepEqual(seen.map(item=>item.name),['İlk adım','On kelime']);                                // one after the other, in order ...
   assert(seen[1].at-seen[0].at>=3000,'... the second card waits until the first is gone: '+(seen[1].at-seen[0].at)+' ms');
   await p.waitForFunction(()=>!document.getElementById('v2Celebrate').classList.contains('v2-on'),null,{timeout:8000});
   assert.equal(await p.evaluate(()=>document.getElementById('v2Celebrate').children.length),0);        // gone by itself
   await c.close();
  }
  {
   const {c,p}=await openGuest({height:700,context:{reducedMotion:'reduce'}});                          // reduced motion: a plain fade, no burst
   await p.evaluate(list=>VocVocData.addWordBatch(list),words(12));
   await p.evaluate(()=>markMemorized('cw0'));await p.waitForSelector('#v2Celebrate.v2-on');
   assert.deepEqual(await p.evaluate(()=>[getComputedStyle(document.querySelector('.v2-spark')).display,getComputedStyle(document.querySelector('.v2-medal')).animationName,getComputedStyle(document.querySelector('.v2-celebrate-card')).animationName]),['none','none','v2-fade-in']);
   await p.waitForFunction(()=>!document.getElementById('v2Celebrate').classList.contains('v2-on'),null,{timeout:8000});
   await c.close();
  }
  record('new badge: a card in the middle with a burst, never blocks a tap, away by itself, badges earned in a row come one after the other, reduced motion is a plain fade');

  // the bottom edge of the last panel is visible on every page, on a short phone screen; the last card of the main list is not painted over (default interface too)
  const lastCardEdge=p=>p.evaluate(()=>{const cards=document.querySelectorAll('#contentArea .main-word-card'),card=cards[cards.length-1];card.scrollIntoView({block:'center'});const box=card.getBoundingClientRect(),x=box.left+box.width/2;return [1,2,4].map(inset=>!!document.elementsFromPoint(x,box.bottom-inset)[0]?.closest('.main-word-card'));});
  {
   const {c,p}=await openGuest();
   await p.evaluate(list=>VocVocData.addWordBatch(list),words(30));await p.evaluate(()=>VocVocPlan.set('premium'));
   await p.getByRole('button',{name:'Günlük kelimeler ekle'}).click();await p.waitForFunction(()=>document.querySelector('.v2-goal-value')?.textContent==='10 / 10 kelime');
   const ends={};
   for(const route of ['today','words','study','stats','profile','premium']){
    await p.evaluate(name=>{location.hash='#/'+name;},route);
    await (route==='words'?p.waitForSelector('#contentArea .main-word-card'):p.waitForSelector('#v2Screen[data-route="'+route+'"] h1'));
    ends[route]=await p.evaluate(()=>{
     const container=document.querySelector('.container'),away=container.classList.contains('v2-away'),screen=document.getElementById('v2Screen');
     const scroller=away?screen:container;scroller.scrollTop=scroller.scrollHeight;
     const last=away?screen.querySelector('.v2-page').lastElementChild:document.getElementById('historyPanel');
     return {gap:Math.round(innerHeight-last.getBoundingClientRect().bottom),scrolls:scroller.scrollHeight>scroller.clientHeight};
    });
   }
   for(const route of ['today','words','stats'])assert.equal(ends[route].scrolls,true,route+' must really scroll for this check to mean anything');
   for(const [route,end] of Object.entries(ends))assert(end.gap>=8,route+': the last panel ends '+end.gap+'px from the bottom of the screen (hidden when negative)');
   await p.evaluate(()=>{location.hash='#/words';});await p.waitForSelector('#contentArea .main-word-card');
   assert.deepEqual(await lastCardEdge(p),[true,true,true]);                                            // the last card's own bottom edge is on top, not covered by the toolbar below it
   await c.close();
  }
  {
   const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));       // the default interface had the same cut
   await p.goto(url);await ready(p);
   await p.evaluate(async()=>{await VocVocData.addWordBatch(Array.from({length:6},(_,index)=>({word:'edge'+index,meaning:'anlam '+index})));quizSession=null;loadSavedWords();renderHistory();renderAllLocal();});
   await p.waitForSelector('#contentArea .main-word-card');
   assert.deepEqual(await lastCardEdge(p),[true,true,true]);
   await c.close();
  }
  record('main list: the bottom edge of the last card is not painted over, in both interfaces, and the last panel of every page ends above the bottom of the screen');
 }
 // ===== New interface: the bar at the top of every page and the menu that slides in from the left =====
 {
  const openSignedIn=async({width=390,height=844,context:options={},profile={mode:'google-sim',name:'Ayşe'}}={})=>{
   const c=await browser.newContext({viewport:{width,height},...options}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
   await c.addInitScript(value=>localStorage.setItem('VOCVOC_SIM_PROFILE',JSON.stringify(value)),profile);
   await p.goto(url+'?ui=v2');await ready(p);await p.waitForSelector('#v2Screen[data-route="today"] h1');
   return {c,p};
  };
  {
   const {c,p}=await openSignedIn();
   // on every page: fixed and as wide as the screen, the menu button first, VocVoc, the round profile button at the far right; the page starts under it
   for(const route of ['today','words','study','stats','profile','premium','help']){
    await p.evaluate(name=>{location.hash='#/'+name;},route);
    await p.waitForFunction(name=>name==='words'?document.querySelector('.container:not(.v2-away)'):document.querySelector('#v2Screen[data-route="'+name+'"] h1'),route);
    const bar=await p.evaluate(()=>{
     const box=document.querySelector('.v2-appbar').getBoundingClientRect(),avatar=document.querySelector('.v2-avatar-btn').getBoundingClientRect(),menu=document.querySelector('.v2-menu-btn').getBoundingClientRect(),brand=document.querySelector('.v2-appbar .v2-brand').getBoundingClientRect();
     const words=!!document.querySelector('.container:not(.v2-away)'),under=(words?document.querySelector('.top-chrome'):document.getElementById('v2Screen')).getBoundingClientRect().top;
     return {full:box.width===innerWidth&&box.left===0&&box.top===0,fixed:getComputedStyle(document.querySelector('.v2-appbar')).position,text:document.querySelector('.v2-appbar .v2-brand').textContent,order:menu.right<=brand.left+1&&brand.right<=avatar.left+1,farRight:Math.round(innerWidth-avatar.right)<=12,round:getComputedStyle(document.querySelector('.v2-avatar-dot')).borderRadius==='50%',under:Math.round(under)>=Math.round(box.bottom),
      // the title of the page is next to VocVoc, after a thin grey vertical line, in grey; the page's own heading is out of sight (it stays for screen readers)
      title:document.querySelector('.v2-bar-title').textContent,after:document.querySelector('.v2-bar-title').getBoundingClientRect().left>=document.querySelector('.v2-bar-sep').getBoundingClientRect().right-1&&document.querySelector('.v2-bar-sep').getBoundingClientRect().left>=brand.right-1,
      sep:(sep=>[Math.round(sep.width),Math.round(sep.height)>=20])(document.querySelector('.v2-bar-sep').getBoundingClientRect()),
      grey:getComputedStyle(document.querySelector('.v2-bar-title')).color===getComputedStyle(document.querySelector('.v2-menu-btn')).color?'same as the text':'grey',
      headingHidden:(rect=>rect.width<=1&&rect.height<=1)(document.querySelector('#v2Screen h1')?.getBoundingClientRect()||{width:0,height:0})};
    });
    assert.deepEqual(bar,{full:true,fixed:'fixed',text:'VocVoc',order:true,farRight:true,round:true,under:true,title:{today:'Bugün',words:'Kelimeler',study:'Çalış',stats:'İstatistikler',profile:'Profil',premium:'Premium',help:'Yardım'}[route],after:true,sep:[1,true],grey:'grey',headingHidden:true},route);
    if(route!=='words')assert.equal(await p.locator('#v2Screen h1').textContent(),bar.title);                  // the heading is still there for screen readers, with the same words
   }
   // the round button shows the first letter of the name and leads to the profile
   assert.deepEqual(await p.evaluate(()=>[document.querySelector('.v2-avatar-dot').textContent,document.querySelector('.v2-avatar-btn').getAttribute('aria-label')]),['A','Profil: Ayşe']);
   await p.evaluate(()=>{location.hash='#/words';});await p.waitForSelector('.container:not(.v2-away)');
   await p.locator('.v2-avatar-btn').click();
   assert.deepEqual(await p.evaluate(()=>[location.hash,document.querySelector('#v2Screen h1').textContent]),['#/profile','Profil']);
   // the Test has its own bar with a close button: no top bar while it runs
   await p.evaluate(()=>{location.hash='#/test';});await p.waitForSelector('#v2Screen[data-route="test"]');
   assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('.v2-appbar')).display),'none');
   await p.evaluate(()=>{location.hash='#/today';});await p.waitForSelector('#v2Screen[data-route="today"] h1');
   // the menu: closed it cannot be reached; opened it slides in from the left to the right and everything behind it is out of reach
   assert.deepEqual(await p.evaluate(()=>{const drawer=document.getElementById('v2Drawer');return [drawer.inert,getComputedStyle(drawer).visibility,drawer.classList.contains('v2-open'),document.querySelector('.v2-menu-btn').getAttribute('aria-expanded')];}),[true,'hidden',false,'false']);
   const slide=await p.evaluate(async()=>{const panel=document.querySelector('.v2-drawer-panel');document.querySelector('.v2-menu-btn').click();await new Promise(resolve=>requestAnimationFrame(resolve));const early=panel.getBoundingClientRect().left;await new Promise(resolve=>setTimeout(resolve,600));return {early:Math.round(early),late:Math.round(panel.getBoundingClientRect().left)};});
   assert(slide.early<-20&&slide.late===0,'the menu slides in: '+JSON.stringify(slide));
   assert.deepEqual(await p.evaluate(()=>{const drawer=document.getElementById('v2Drawer');return [drawer.inert,document.querySelector('.container').inert,document.getElementById('v2Screen').inert,document.querySelector('.v2-appbar').inert,document.querySelector('.v2-menu-btn').getAttribute('aria-expanded'),document.activeElement.textContent,drawer.getAttribute('aria-modal')];}),[false,true,true,true,'true','Bugün','true']);
   // Settings is the last entry, at the very bottom, away from the five pages
   assert.deepEqual(await p.evaluate(()=>{const items=[...document.querySelectorAll('.v2-nav-item')],last=items[items.length-1].getBoundingClientRect(),previous=items[items.length-2].getBoundingClientRect(),panel=document.querySelector('.v2-drawer-panel').getBoundingClientRect();return {settings:items[items.length-1].classList.contains('v2-nav-settings'),text:items[items.length-1].textContent,apart:last.top>previous.bottom+100,atBottom:panel.bottom-last.bottom<24,entries:items.length};}),{settings:true,text:'Ayarlar',apart:true,atBottom:true,entries:6});
   // Escape and the dimmed page close it; the focus goes back to the button and the page is reachable again
   await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('v2Drawer').classList.contains('v2-open'));
   assert.deepEqual(await p.evaluate(()=>[document.activeElement.className,document.querySelector('.container').inert,document.getElementById('v2Screen').inert,document.querySelector('.v2-appbar').inert,document.getElementById('v2Drawer').inert]),['v2-menu-btn',false,false,false,true]);
   await p.locator('.v2-menu-btn').click();await p.locator('.v2-scrim').click({position:{x:370,y:400}});
   await p.waitForFunction(()=>!document.getElementById('v2Drawer').classList.contains('v2-open'));
   // Settings opens the app's own Settings, and the menu is closed behind it
   await p.locator('.v2-menu-btn').click();await p.locator('.v2-nav-settings').click();
   await p.waitForFunction(()=>getComputedStyle(document.getElementById('modalOverlay')).display==='flex');
   assert.equal(await p.evaluate(()=>document.getElementById('v2Drawer').classList.contains('v2-open')),false);
   await p.evaluate(()=>closeModal());
   await c.close();
  }
  {
   const {c,p}=await openSignedIn({profile:{mode:'guest',name:''}});                                    // a guest has no name: the letter of "Misafir"
   assert.equal(await p.evaluate(()=>document.querySelector('.v2-avatar-dot').textContent),'M');
   await c.close();
  }
  {
   const {c,p}=await openSignedIn({context:{reducedMotion:'reduce'}});                                  // reduced motion: it simply appears
   const left=await p.evaluate(async()=>{document.querySelector('.v2-menu-btn').click();await new Promise(resolve=>requestAnimationFrame(resolve));return Math.round(document.querySelector('.v2-drawer-panel').getBoundingClientRect().left);});
   assert.equal(left,0);
   await c.close();
  }
  {
   const {c,p}=await openSignedIn({width:320,height:600});                                              // the narrowest phone: the bar and the menu fit
   assert.deepEqual(await p.evaluate(()=>{const brand=document.querySelector('.v2-appbar .v2-brand');return [document.querySelector('.v2-menu-btn').getBoundingClientRect().left>=0,document.querySelector('.v2-avatar-btn').getBoundingClientRect().right<=innerWidth,brand.scrollWidth<=brand.clientWidth];}),[true,true,true]);
   assert.deepEqual(await p.evaluate(()=>[...document.querySelectorAll('.v2-subtab')].filter(tab=>tab.scrollWidth>tab.clientWidth).map(tab=>tab.textContent)),[]);   // the three badge tabs fit too
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.getElementById('v2Screen').scrollWidth<=innerWidth),true);   // and nothing on Today pushes the page sideways
   await p.locator('.v2-menu-btn').click();
   assert.deepEqual(await p.evaluate(()=>{const box=document.querySelector('.v2-drawer-panel').getBoundingClientRect();return [box.width<=innerWidth*0.85,[...document.querySelectorAll('.v2-nav-label')].filter(label=>label.scrollWidth>label.clientWidth).length];}),[true,0]);
   await c.close();
  }
  record('new interface: a bar with the menu button, VocVoc and the round profile button on every page, a menu that slides in from the left (closed by Escape, the dimmed page or an entry) with Settings at the bottom');
 }
 // ===== New interface: the words behind a bar of the last seven days, the profile photo =====
 {
  const noon=back=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-back);return date.toISOString();};
  // 30 words: 12 memorized (on days 0..9, two days after being added), the rest added over the last seven days; a signed-in profile, Premium
  const seedWords=stamps=>{
   if(sessionStorage.getItem('seededWords'))return;sessionStorage.setItem('seededWords','1');
   const words={},aliases={},progress={};
   for(let i=0;i<30;i++){const word='s'+i,id='fr:tr:'+word,memorizedWord=i<12,added=memorizedWord?stamps[(i%10)+2]:stamps[i%7],memorized=memorizedWord?stamps[i%10]:null;
    words[id]={id,word,normalized:word,targetLanguage:'fr',nativeLanguage:'tr',type:'isim',meaning:'anlam '+i,synonyms:[],antonyms:[],examples:[],expressions:[],createdAt:added,updatedAt:added};aliases[id]=id;
    progress[id]={wordId:id,status:memorizedWord?'memorized':'active',firstSeenAt:added,lastSeenAt:added,statusChangedAt:memorized||added,memorizedAt:memorized,archivedAt:null,archiveSourceStatus:null};}
   localStorage.setItem('VOCVOC_DB_V1',JSON.stringify({schemaVersion:1,meta:{starterWordsInitialized:true},settings:{nativeLanguage:'tr',targetLanguage:'fr',difficulty:'A1-A2',dailyLimit:'10',theme:'system',fontSize:'normal'},words,aliases,progress,dailyUsage:{date:null,count:0}}));
   localStorage.setItem('VOCVOC_SIM_PROFILE',JSON.stringify({mode:'google-sim',name:'Ayşe'}));localStorage.setItem('VOCVOC_SIM_PLAN','premium');
   localStorage.setItem('VOCVOC_ACTIVITY_V1',JSON.stringify({v:1,seeded:false,testsTaken:0,badges:{},quizzes:[]}));
  };
  const openSeeded=async(route='stats')=>{
   const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
   await c.addInitScript(seedWords,Array.from({length:14},(_,back)=>noon(back)));
   await p.goto(url+'?ui=v2#/'+route);await ready(p);await p.waitForSelector('#v2Screen[data-route="'+route+'"] .v2-days');
   return {c,p};
  };

  // a bar with something in it is a button; pressing it (or resting a mouse on it for a moment) shows that day's words as pills
  {
   const {c,p}=await openSeeded();
   assert.equal(await p.locator('.v2-slot-btn').count(),14);
   const bar=p.locator('.v2-slot-btn').first();
   const label=await bar.getAttribute('aria-label');
   assert.match(label,/^\d{1,2} \p{L}+ \p{L}+, Eklenen: \d+ kelime\. Kelimeleri göster$/u);
   const count=Number(label.match(/: (\d+) kelime/)[1]);
   await bar.click();
   assert.deepEqual(await p.evaluate(()=>{const popup=document.getElementById('v2DayWords');return [popup.getAttribute('role'),popup.getAttribute('aria-modal'),document.getElementById('v2Screen').inert,document.activeElement.className];}),['dialog','true',true,'v2-popup-close']);
   assert.equal(await p.locator('#v2DayWords .v2-pills li').count(),count);
   assert.match(await p.locator('#v2DayWordsTitle').textContent(),/ · Eklenen$/);
   assert.equal(await p.locator('#v2DayWords .v2-popup-card > p').first().textContent(),count+' kelime');
   // a pill opens the word's own panel above the popup; Escape closes the panel first, then the popup, and the focus goes back to the bar
   const word=await p.locator('#v2DayWords .history-chip').first().textContent();
   await p.locator('#v2DayWords .history-chip').first().click();await p.waitForSelector('#historyDetails.open .word-title');
   assert.equal(await p.locator('#historyDetails .word-title').first().textContent(),word);
   assert.equal(await p.evaluate(()=>!!document.elementFromPoint(innerWidth/2,innerHeight/2).closest('#historyDetails')),true);   // the panel is on top
   await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#historyDetails.open'));
   assert.equal(await p.evaluate(()=>!!document.getElementById('v2DayWords')),true);
   await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('v2DayWords'));
   assert.deepEqual(await p.evaluate(()=>[document.activeElement.className,document.getElementById('v2Screen').inert,document.querySelector('.v2-appbar').inert]),['v2-slot v2-slot-btn',false,false]);
   // the dimmed page and the close button close it too; a word that left the list is plain text in it (pressing it would only start a search)
   await bar.click();await p.locator('#v2DayWords .v2-scrim').click({position:{x:5,y:5}});assert.equal(await p.locator('#v2DayWords').count(),0);
   await p.evaluate(name=>archiveWord(name),word);
   await bar.click();
   assert.deepEqual(await p.evaluate(name=>{const pill=[...document.querySelectorAll('#v2DayWords .v2-pills li > *')].find(node=>node.textContent===name);return [pill.tagName,pill.classList.contains('v2-wordplain')];},word),['SPAN',true]);
   await p.locator('.v2-popup-close').click();assert.equal(await p.locator('#v2DayWords').count(),0);
   // a mouse resting on a bar opens it after a moment, not at once, and not when it only passes by
   const other=p.locator('.v2-slot-btn').nth(3);
   await other.hover();await pause(250);assert.equal(await p.locator('#v2DayWords').count(),0);
   await p.waitForSelector('#v2DayWords',{timeout:3000});
   await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('v2DayWords'));
   await p.mouse.move(2,2);
   await other.hover();await p.mouse.move(2,2);await pause(1100);assert.equal(await p.locator('#v2DayWords').count(),0);
   // the memorized bars list the memorized words of the day; Today has the same chart and the same panels
   await p.locator('.v2-slot-btn-memorized,.v2-slot-btn').nth(1).click();
   assert.match(await p.locator('#v2DayWordsTitle').textContent(),/ · (Eklenen|Ezberlenen)$/);
   await p.keyboard.press('Escape');
   await p.evaluate(()=>{location.hash='#/today';});await p.waitForSelector('#v2Screen[data-route="today"] .v2-slot-btn');
   await p.locator('#v2Screen .v2-slot-btn').last().click();assert.equal(await p.locator('#v2DayWords .v2-pills li').count()>0,true);
   await c.close();
  }
  {
   const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
   await c.addInitScript(()=>localStorage.setItem('VOCVOC_SIM_PROFILE',JSON.stringify({mode:'guest',name:''})));
   await p.goto(url+'?ui=v2');await ready(p);await p.waitForSelector('#v2Screen[data-route="today"] .v2-days');
   assert.deepEqual(await p.evaluate(()=>[document.querySelectorAll('.v2-slot-btn').length,document.querySelectorAll('.v2-slot').length,[...document.querySelectorAll('.v2-slot')].every(node=>node.tagName==='SPAN'&&node.getAttribute('aria-hidden')==='true')]),[0,14,true]);   // empty bars are not buttons
   await c.close();
  }
  record('Last 7 days: a bar with words is a button (press, or a mouse resting on it) that shows the words of the day as pills; a pill opens the word panel above, Escape closes them in order, empty bars are not buttons');

  // the profile photo: chosen from the device, moved and zoomed under a round window (mouse, wheel, slider, keys, two fingers), kept as a small square JPEG, shown round in the bar and on the profile
  {
   const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
   await c.addInitScript(()=>localStorage.setItem('VOCVOC_SIM_PROFILE',JSON.stringify({mode:'google-sim',name:'Ayşe'})));
   await p.goto(url+'?ui=v2#/profile');await ready(p);await p.waitForSelector('#v2Screen[data-route="profile"] h1');
   const choose=(options={})=>p.evaluate(async({type='image/png',size=0,text=null})=>{
    let picture;
    if(text!==null)picture=new File([text],'a.png',{type});
    else if(size)picture=new File([new Uint8Array(size)],'big.png',{type});
    else{const canvas=document.createElement('canvas');canvas.width=600;canvas.height=400;const context2d=canvas.getContext('2d');
     context2d.fillStyle='#d00';context2d.fillRect(0,0,300,400);context2d.fillStyle='#00d';context2d.fillRect(300,0,300,400);context2d.fillStyle='#0a0';context2d.fillRect(250,150,100,100);   // left red, right blue, a green square in the middle
     picture=new File([await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))],'two-colours.png',{type:'image/png'});}
    const transfer=new DataTransfer();transfer.items.add(picture);const input=document.getElementById('v2PhotoInput');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
   },options);
   const saved=()=>p.evaluate(async()=>{
    const url=localStorage.getItem('VOCVOC_SIM_PHOTO');if(!url)return null;
    const bytes=Uint8Array.from(atob(url.split(',')[1]),letter=>letter.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes],{type:'image/jpeg'}));
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const context2d=canvas.getContext('2d');context2d.drawImage(bitmap,0,0);
    const dominant=([r,g,b])=>r>g&&r>b?'red':g>r&&g>b?'green':'blue',at=(x,y)=>[...context2d.getImageData(x,y,1,1).data].slice(0,3);
    return {type:url.slice(0,23),size:[bitmap.width,bitmap.height],row:[32,128,224].map(x=>dominant(at(x,128))),corners:[[2,2],[253,2],[2,253],[253,253]].map(([x,y])=>at(x,y).every(value=>value>235))};
   });
   // nothing yet: the first letter, one button
   assert.deepEqual(await p.evaluate(()=>[document.querySelector('.v2-avatar-dot').textContent,document.querySelector('.v2-avatar-dot canvas'),[...document.querySelectorAll('#v2Screen .ui-button')].map(button=>button.textContent)]),['A',null,['Fotoğraf ekle']]);
   // bad files are refused with a message, no dialog: not a picture, and too large
   await choose({type:'image/png',text:'this is not a picture'});await p.waitForFunction(()=>/resim olarak açılamadı/.test(document.getElementById('v2Toast')?.textContent||''));
   await choose({type:'image/png',size:16*1024*1024});await p.waitForFunction(()=>/resim olarak açılamadı/.test(document.getElementById('v2Toast')?.textContent||''));
   assert.deepEqual([await p.locator('#v2Crop').count(),await saved()],[0,null]);
   // the dialog: modal, the page behind it is out of reach, the picture covers the round window from the start
   await choose();await p.waitForSelector('#v2Crop');
   assert.deepEqual(await p.evaluate(()=>[document.getElementById('v2Crop').getAttribute('role'),document.getElementById('v2Crop').getAttribute('aria-modal'),document.getElementById('v2Screen').inert,document.querySelector('.v2-appbar').inert,document.activeElement.className,document.querySelector('.v2-crop-zoom input').value]),['dialog','true',true,true,'v2-crop-stage','100']);
   // Escape cancels: nothing is kept
   await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('v2Crop'));
   assert.deepEqual([await saved(),await p.evaluate(()=>document.querySelector('.v2-avatar-dot canvas'))],[null,null]);
   // saved as it is: the middle of the picture
   await choose();await p.waitForSelector('#v2Crop');await p.getByRole('button',{name:'Kaydet'}).click();await p.waitForFunction(()=>!document.getElementById('v2Crop')&&document.querySelector('.v2-avatar-dot canvas'));
   assert.deepEqual(await saved(),{type:'data:image/jpeg;base64,',size:[256,256],row:['red','green','blue'],corners:[false,false,false,false]});
   assert.deepEqual(await p.evaluate(()=>[document.querySelector('.v2-avatar-dot').textContent,!!document.querySelector('.v2-avatar canvas'),getComputedStyle(document.querySelector('.v2-avatar-dot')).borderRadius,[...document.querySelectorAll('#v2Screen .ui-button')].map(button=>button.textContent),document.activeElement.getAttribute('data-v2-focus')]),['',true,'50%',['Fotoğrafı değiştir','Fotoğrafı kaldır'],'photo']);
   // zoom in with the slider and move it with the mouse: the part under the window is what is kept (and it never leaves an empty edge)
   await choose();await p.waitForSelector('#v2Crop');
   const box=await p.locator('.v2-crop-stage').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
   await p.locator('.v2-crop-zoom input').fill('250');
   await p.mouse.move(cx,cy);await p.mouse.down();await p.mouse.move(cx-60,cy,{steps:6});await p.mouse.move(cx-80,cy+10,{steps:4});await p.mouse.up();
   await p.getByRole('button',{name:'Kaydet'}).click();await p.waitForFunction(()=>!document.getElementById('v2Crop'));
   assert.deepEqual((await saved()).row,['green','green','blue']);                                    // moved to the right part of the picture, zoomed on the green square
   // far too far: the picture still covers the whole window
   await choose();await p.waitForSelector('#v2Crop');
   await p.locator('.v2-crop-zoom input').fill('300');
   await p.mouse.move(cx,cy);await p.mouse.down();await p.mouse.move(cx+400,cy-400,{steps:8});await p.mouse.up();
   await p.getByRole('button',{name:'Kaydet'}).click();await p.waitForFunction(()=>!document.getElementById('v2Crop'));
   assert.deepEqual((await saved()).corners,[false,false,false,false]);
   // the wheel and the keyboard: + zooms, the arrows move; the slider follows
   await choose();await p.waitForSelector('#v2Crop');
   await p.mouse.move(cx,cy);await p.mouse.wheel(0,-400);
   const afterWheel=Number(await p.locator('.v2-crop-zoom input').inputValue());assert(afterWheel>100,'the wheel zooms in: '+afterWheel);
   await p.locator('.v2-crop-stage').focus();await p.keyboard.press('+');
   assert(Number(await p.locator('.v2-crop-zoom input').inputValue())>afterWheel);
   for(let press=0;press<14;press++)await p.keyboard.press('-');
   assert.equal(await p.locator('.v2-crop-zoom input').inputValue(),'100');                          // it never zooms out beyond covering the window
   // two fingers zoom, one finger moves
   const cdp=await c.newCDPSession(p);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-20,y:cy,id:1},{x:cx+20,y:cy,id:2}]});
   for(let step=1;step<=8;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-20-step*10,y:cy,id:1},{x:cx+20+step*10,y:cy,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert(Number(await p.locator('.v2-crop-zoom input').inputValue())>=300,'a pinch zooms in');
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});
   for(let step=1;step<=6;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-step*12,y:cy,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await p.getByRole('button',{name:'Kaydet'}).click();await p.waitForFunction(()=>!document.getElementById('v2Crop'));
   assert.deepEqual((await saved()).row,['green','green','blue']);                                    // zoomed on the middle (the green square), then moved a little to the right
   // it stays: after a reload the bar and the profile show it; removing it brings the letter back and deletes it from the device
   await p.reload();await ready(p);await p.waitForFunction(()=>document.querySelector('.v2-avatar-dot canvas')&&document.querySelector('.v2-avatar canvas'));
   await p.getByRole('button',{name:'Fotoğrafı kaldır'}).click();
   assert.deepEqual(await p.evaluate(()=>[document.querySelector('.v2-avatar-dot').textContent,document.querySelector('.v2-avatar-dot canvas'),localStorage.getItem('VOCVOC_SIM_PHOTO'),[...document.querySelectorAll('#v2Screen .ui-button')].map(button=>button.textContent)]),['A',null,null,['Fotoğraf ekle']]);
   // signing out takes the photo of the profile with it
   await choose();await p.waitForSelector('#v2Crop');await p.getByRole('button',{name:'Kaydet'}).click();await p.waitForFunction(()=>!document.getElementById('v2Crop'));
   await p.getByRole('button',{name:/Çıkış yap/}).click();await p.waitForSelector('#v2Auth.v2-open');
   assert.equal(await p.evaluate(()=>localStorage.getItem('VOCVOC_SIM_PHOTO')),null);
   await c.close();
  }
  record('profile photo: choose, move and zoom under a round window (mouse, wheel, slider, keys, two fingers), never an empty edge, saved as a small JPEG, round in the bar and on the profile, kept after a reload, removable, bad and oversized files refused, taken away by signing out');
 }
 // ===== New interface: the interface language follows the Settings; the pronunciation stays in the user's original language =====
 {
  const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await c.addInitScript(()=>localStorage.setItem('VOCVOC_SIM_PROFILE',JSON.stringify({mode:'google-sim',name:'Ayşe'})));
  await p.goto(url+'?ui=v2');await ready(p);await p.waitForSelector('#v2Screen[data-route="today"] h1');
  const snapshot=()=>p.evaluate(()=>({bar:document.querySelector('.v2-bar-title').textContent,heading:document.querySelector('#v2Screen h1')?.textContent,menu:[...document.querySelectorAll('.v2-nav-label')].map(node=>node.textContent),menuButton:document.querySelector('.v2-menu-btn').getAttribute('aria-label'),avatar:document.querySelector('.v2-avatar-btn').getAttribute('aria-label'),daily:document.querySelector('.v2-goal .ui-button')?.textContent,pageLang:document.querySelector('.v2-page')?.lang}));
  assert.deepEqual(await snapshot(),{bar:'Bugün',heading:'Bugün',menu:['Bugün','Kelimeler','Çalış','İstatistik','Profil','Ayarlar'],menuButton:'Menü',avatar:'Profil: Ayşe',daily:'Günlük kelimeler ekle',pageLang:'tr'});
  // through the real Settings dialog: the bar, the menu and the page change at once (the menu and the bar used to stay in the old language)
  await p.locator('.v2-menu-btn').click();await p.locator('.v2-nav-settings').click();await p.waitForFunction(()=>getComputedStyle(document.getElementById('modalOverlay')).display==='flex');
  await p.locator('#appLanguageDropdown .ui-dropdown-trigger').click();await p.locator('#appLanguageDropdown .ui-dropdown-option[data-value="en"]').click();
  await p.waitForFunction(()=>document.querySelector('.v2-bar-title').textContent==='Today');
  assert.deepEqual(await snapshot(),{bar:'Today',heading:'Today',menu:['Today','Words','Study','Stats','Profile','Settings'],menuButton:'Menu',avatar:'Profile: Ayşe',daily:'Add daily words',pageLang:'en'});
  await p.evaluate(()=>closeModal());
  // another page: a change made while it is open redraws it in the new language and keeps its place
  await p.evaluate(()=>{location.hash='#/study';});await p.waitForSelector('#v2Screen[data-route="study"] .v2-study-card');
  assert.deepEqual(await p.locator('.v2-study-title').allTextContents(),['Test','Recall','Fill in the blank','Flip']);
  await p.evaluate(()=>{document.getElementById('v2Screen').scrollTop=60;});
  await p.evaluate(()=>changeAppLanguage('tr'));
  await p.waitForFunction(()=>document.querySelector('.v2-study-title')?.textContent==='Test'&&document.querySelectorAll('.v2-study-title')[1].textContent==='Hatırla');
  assert.deepEqual([await p.locator('.v2-study-title').allTextContents(),await p.locator('.v2-bar-title').textContent(),await p.evaluate(()=>document.getElementById('v2Screen').scrollTop>0||document.getElementById('v2Screen').scrollHeight<=document.getElementById('v2Screen').clientHeight)],[['Test','Hatırla','Boşluk Doldurma','Flip'],'Çalış',true]);
  // a language the new screens have no texts for shows English there, and the app's own language (the document language) follows
  await p.evaluate(()=>changeAppLanguage('fr'));
  await p.waitForFunction(()=>document.querySelector('.v2-bar-title').textContent==='Study');
  assert.deepEqual(await p.evaluate(()=>[document.documentElement.lang,document.querySelector('.v2-page').lang,[...document.querySelectorAll('.v2-nav-label')].map(node=>node.textContent).join()]),['fr','en','Today,Words,Study,Stats,Profile,Settings']);
  // the interface language never touches the original (native) language or the learned one, so the pronunciation guides stay in the original language
  await p.evaluate(()=>changeAppLanguage('en'));
  assert.deepEqual(await p.evaluate(()=>[getNativeLanguageCode(),getTargetLanguageCode(),VocVocData.getSettings().appLanguage]),['tr','fr','en']);
  await p.evaluate(()=>{location.hash='#/today';});await p.waitForSelector('#v2Screen[data-route="today"] .v2-pack-text');
  await p.getByRole('button',{name:'Add daily words'}).click();await p.waitForFunction(()=>!!VocVocData.getWordByText('au revoir'));
  assert.deepEqual(await p.evaluate(()=>{const word=VocVocData.getWordByText('au revoir');return [word.meaning,word.examples[0].phonetic,word.examples[0].translation];}),['hoşça kal; görüşürüz','o rövuar, a dömen','Hoşça kal, yarın görüşürüz!']);   // meaning, respelling and translation in Turkish with the interface in English
  await c.close();
  record('language: changing the interface language in Settings redraws the bar, the menu and the open page at once (Turkish, English, a language without screen texts); the original language and the pronunciation guides stay the same');
 }
 // ===== New interface: no scrollbar anywhere, and everything still scrolls =====
 {
  const c=await browser.newContext({viewport:{width:390,height:500}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await c.addInitScript(()=>localStorage.setItem('VOCVOC_SIM_PROFILE',JSON.stringify({mode:'google-sim',name:'Ayşe'})));
  await p.goto(url+'?ui=v2');await ready(p);await p.waitForSelector('#v2Screen[data-route="today"] .v2-pack-text');
  await p.evaluate(()=>VocVocData.updateSettings({dailyLimit:'unlimited'}));
  for(let press=0;press<2;press++){await p.getByRole('button',{name:'Günlük kelimeler ekle'}).click();await pause(500);}
  const check=async(selector,label)=>{
   const info=await p.evaluate(sel=>{const node=document.querySelector(sel);if(!node)return null;const style=getComputedStyle(node);return {none:style.scrollbarWidth,gutter:node.offsetWidth-node.clientWidth,scrolls:node.scrollHeight>node.clientHeight};},selector);
   assert(info,label+': not found');assert.deepEqual([info.none,info.gutter,info.scrolls],['none',0,true],label+' must scroll without a scrollbar: '+JSON.stringify(info));
   const moved=await p.evaluate(sel=>{const node=document.querySelector(sel);node.scrollTop=120;return node.scrollTop;},selector);
   assert(moved>0,label+' still scrolls ('+moved+')');
  };
  await check('#v2Screen','Today');                                                                       // the page of Today
  await p.evaluate(()=>{location.hash='#/words';});await p.waitForSelector('.container:not(.v2-away)');
  await check('.container','the Words list');
  await p.evaluate(()=>toggleHistoryDetail('Bonjour'));await p.waitForSelector('#historyDetails.open .word-panel-scroll-body');
  await p.evaluate(()=>{for(const details of document.querySelectorAll('#historyDetails details.fold'))details.open=true;});
  await check('#historyDetails .word-panel-scroll-body','the word panel');
  await p.evaluate(()=>closeHistoryDetail());
  await p.evaluate(()=>openModal());await p.waitForFunction(()=>getComputedStyle(document.getElementById('modalOverlay')).display==='flex');
  await check('#modalOverlay .settings-panel-body','Settings');
  assert.equal(await p.evaluate(()=>[document.documentElement,document.body].every(node=>getComputedStyle(node).scrollbarWidth==='none')),true);
  await c.close();
  record('scrollbars: none is drawn on any page, list, dialog or panel of the new interface, and each of them still scrolls');
 }
 // ===== New interface: the Fill in the blank test =====
 {
  const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await c.addInitScript(()=>localStorage.setItem('VOCVOC_SIM_PROFILE',JSON.stringify({mode:'google-sim',name:'Ayşe'})));
  await p.goto(url+'?ui=v2');await ready(p);await p.waitForSelector('#v2Screen[data-route="today"] .v2-pack-text');
  // how the blank is made (it must leave the word out, find it also as written in an inflected form, and not invent one)
  assert.deepEqual(await p.evaluate(()=>[
   blankSentence('Je mange du pain.','pain'),blankSentence('Bonjour, madame.','bonjour'),blankSentence('Je mange une pomme.','manger'),
   blankSentence("Un café, s'il vous plaît.","s'il vous plaît"),blankSentence('Il est trois heures.','être'),blankSentence("L'eau est froide.",'eau'),
   blankSentence('Le chat dort.','main'),blankSentence('','pain'),blankSentence('Le pain.','')]),
   ['Je mange du _____.','_____, madame.','Je _____ une pomme.',"Un café, _____.",null,"L'_____ est froide.",null,null,null]);
  // not enough words with a sentence: the page says how many there are, and nothing starts
  await p.evaluate(()=>{location.hash='#/cloze';});await p.waitForSelector('#v2Screen[data-route="cloze"] .v2-card');
  assert.match(await p.locator('#v2Screen').textContent(),/Boşluk Doldurma için cümlesi olan en az 10 kelime gerekir\. Şu an \d+ var\./);
  assert.equal(await p.evaluate(()=>!!quizSession),false);
  // enough words: the Study page offers it between Recall and Flip
  await p.evaluate(()=>VocVocData.updateSettings({dailyLimit:'unlimited'}));
  for(let press=0;press<2;press++){await p.evaluate(()=>{location.hash='#/today';});await p.waitForSelector('#v2Screen[data-route="today"] .v2-pack-text');await p.getByRole('button',{name:'Günlük kelimeler ekle'}).click();await pause(500);}
  await p.evaluate(()=>{location.hash='#/study';});await p.waitForSelector('#v2Screen[data-route="study"] .v2-study-card');
  assert.deepEqual(await p.locator('.v2-study-title').allTextContents(),['Test','Hatırla','Boşluk Doldurma','Flip']);
  assert.match(await p.locator('.v2-study-card',{hasText:'Boşluk Doldurma'}).textContent(),/\d+ kelimenin cümlesinden 10 soru/);
  await p.locator('.v2-study-card',{hasText:'Boşluk Doldurma'}).click();await p.waitForSelector('#v2QuizHost .quiz-option');
  assert.deepEqual(await p.evaluate(()=>[location.hash,document.querySelector('.v2-study-bar h1').textContent,document.querySelector('.v2-appbar')&&getComputedStyle(document.querySelector('.v2-appbar')).display,quizSession.mode,quizSession.questions.length]),['#/cloze','Boşluk Doldurma','none','cloze',10]);
  // a question: the sentence of the word with a blank, its translation as a hint, four different words, one of them the answer
  const ask=()=>p.evaluate(()=>{const q=quizSession.questions[quizSession.index],sentence=document.querySelector('#v2QuizHost .quiz-word-v91').textContent;return {answer:q.word,sentence,hint:document.querySelector('#v2QuizHost .quiz-cloze-hint')?.textContent||'',options:[...document.querySelectorAll('#v2QuizHost .quiz-option')].map(node=>node.textContent),blank:sentence.includes('_____'),original:q.cloze.text===sentence};});
  const first=await ask();
  assert.deepEqual([first.blank,first.original,first.options.length,new Set(first.options).size,first.options.includes(first.answer),first.hint.length>0],[true,true,4,4,true,true]);
  assert(!new RegExp('(^|[^\\p{L}])'+first.answer.replace(/[.*+?^\${}()|[\]\\]/g,'\\$&')+'([^\\p{L}]|$)','iu').test(first.sentence),'the sentence must not show the word: '+first.sentence);
  // answer: the first one wrongly, the rest rightly
  const pick=text=>p.locator('#v2QuizHost .quiz-option:not([disabled])').evaluateAll((nodes,wanted)=>nodes.find(node=>node.textContent===wanted).click(),text);
  const wrong=first.options.find(option=>option!==first.answer);
  await pick(wrong);await p.waitForFunction(()=>quizSession.index===1);
  for(let question=1;question<10;question++){const now=await ask();await pick(now.answer);await p.waitForFunction(count=>quizSession.index>count,question);}
  await p.waitForSelector('#v2QuizHost .quiz-result-card');
  assert.deepEqual(await p.evaluate(()=>[document.getElementById('v2QuizCount').textContent,quizSession.score,quizSession.wrongWords.length,document.querySelectorAll('#v2QuizHost .quiz-wrong-badge').length]),['Tamamlandı',9,1,1]);
  // it is recorded as a Fill in the blank test (it counts as a test; the Recall badge is for Recall only)
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('VOCVOC_ACTIVITY_V1')));
  assert.deepEqual([saved.testsTaken,saved.quizzes.at(-1).mode,saved.quizzes.at(-1).score,saved.quizzes.at(-1).wrong.length,saved.badges.recall8],[1,'cloze',9,1,undefined]);
  // "new test" starts another one of the same kind; the list on the Study page names it
  await p.locator('#v2QuizHost .quiz-restart-btn').click();await p.waitForSelector('#v2QuizHost .quiz-option');
  assert.equal(await p.evaluate(()=>quizSession.mode),'cloze');
  await p.evaluate(()=>{location.hash='#/study';});await p.waitForSelector('.v2-testlist li');
  assert.deepEqual(await p.locator('.v2-testlist li').first().evaluate(item=>[item.querySelector('.v2-muted').textContent,item.querySelector('strong').textContent,item.querySelector('.v2-bullet').className]),['Boşluk','9/10','v2-bullet v2-bullet-great']);
  await c.close();
  record('Fill in the blank: a sentence of the word with a blank and its translation, four words to choose from, ten questions, recorded as a test of its own kind; too few words say so; it sits between Recall and Flip');
 }
 // ===== Word panel (the default interface): two examples, idioms as pills with the sentence that uses them =====
 {
  const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url);await ready(p);
  await p.evaluate(()=>VocVocData.addWordBatch([{word:'idiomtest',type:'isim',meaning:'bir anlam',
   examples:[{text:'First sentence.',phonetic:'ilk',translation:'Birinci cümle.'},{text:'Second sentence.',phonetic:'ikinci',translation:'İkinci cümle.'}],
   expressions:[{text:'break a leg',phonetic:'breyk ı leg',translation:'bol şans',exampleText:'Break a leg tonight!',examplePhonetic:'breyk ı leg tunayt',exampleTranslation:'Bu akşam bol şans!'},
                {text:'no sentence idiom',phonetic:'nou sentıns idiyım',translation:'cümlesiz deyim'}]}]));
  await p.evaluate(()=>toggleHistoryDetail('idiomtest'));await p.waitForSelector('#historyDetails.open .word-title');
  assert.equal(await p.locator('#historyDetails .example-item').count(),2);
  assert.deepEqual(await p.locator('#historyDetails .expression-pill').evaluateAll(nodes=>nodes.map(node=>[node.textContent,getComputedStyle(node).borderRadius!=='0px'])),[['break a leg',true],['no sentence idiom',true]]);
  // with a sentence: the pill, then the sentence with its pronunciation and meaning (not the idiom's own); without one: the idiom's own pronunciation and meaning stand in
  await p.evaluate(()=>{for(const details of document.querySelectorAll('#historyDetails details.fold'))details.open=true;});
  const items=await p.locator('#historyDetails .expression-item').evaluateAll(nodes=>nodes.map(node=>[...node.children].map(child=>child.className.split(' ')[0]+':'+child.innerText.replace(/\s+/g,' ').trim())));
  assert.deepEqual(items,[['fr-text:break a leg','expression-example:Break a leg tonight! Okunuş: breyk ı leg tunayt Bu akşam bol şans!'],['fr-text:no sentence idiom','phonetic-text:Okunuş: nou sentıns idiyım','tr-text:cümlesiz deyim']]);
  await c.close();
  record('word panel: two example sentences, idioms as pills with the sentence that uses them (their own pronunciation and meaning only when there is no sentence)');
 }
 // ===== New interface: ready-made word packs and read-aloud =====
 {
  const signedIn=()=>{localStorage.setItem('VOCVOC_SIM_PROFILE',JSON.stringify({mode:'google-sim',name:'Ayşe'}));};
  const openPage=async(options={})=>{
   const c=await browser.newContext({viewport:{width:390,height:844},...options.context}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
   const seen={gemini:0,pack:0,index:0};
   await p.route('https://generativelanguage.googleapis.com/**',r=>{seen.gemini++;r.abort();});
   p.on('request',r=>{if(r.url().endsWith('/packs/fr-tr.json'))seen.pack++;if(r.url().endsWith('/packs/index.json'))seen.index++;});
   await c.addInitScript(signedIn);if(options.init)await c.addInitScript(options.init,options.initArg);
   await p.goto(url+'?ui=v2');await ready(p);
   return {c,p,seen};
  };
  const packText=p=>p.evaluate(()=>document.querySelector('.v2-pack .v2-pack-text')?.textContent||'');
  const waitPack=(p,text)=>p.waitForFunction(expected=>document.querySelector('.v2-pack .v2-pack-text')?.textContent===expected,text);

  // the pack of the pair is downloaded once; the Daily button takes its next words from it: no key, no AI, counted towards the goal
  {
   const {c,p,seen}=await openPage();
   await waitPack(p,'2 / 40 kelime eklendi');                                                        // Bonjour and Merci are the starters
   assert.equal(seen.pack,1);
   const before=await p.evaluate(()=>getHistory().length);
   await p.getByRole('button',{name:'Günlük kelimeler ekle'}).click();
   await p.waitForFunction(()=>document.querySelector('.v2-goal-value')?.textContent==='10 / 10 kelime');
   const history=await p.evaluate(()=>getHistory());
   assert.equal(history.length,before+10);
   for(const word of ['au revoir',"s'il vous plaît",'oui','non','pardon','eau','pain','café','maison','ami'])assert(history.includes(word),word+' was not added');
   assert.equal(await p.evaluate(()=>VocVocData.getWordByText('maison').meaning),'ev');
   assert.equal(await p.evaluate(()=>VocVocData.getWordByText('maison').examples[0].phonetic),'la mezon e grand');
   const maison=await p.evaluate(()=>VocVocData.getWordByText('maison'));                             // two examples, and idioms with the sentence that uses each
   assert.deepEqual([maison.examples.length,maison.examples[1].text,maison.expressions.map(item=>item.text),maison.expressions[0].exampleText],[2,'Ma maison est près de la gare.',['faire comme chez soi','à la maison'],'Faites comme chez vous !']);
   // the words just added are pills under the button, in the order they were added; a pill opens the word's panel
   assert.deepEqual(await p.locator('.v2-added .history-chip').evaluateAll(nodes=>nodes.map(node=>node.textContent)),['au revoir',"s'il vous plaît",'oui','non','pardon','eau','pain','café','maison','ami']);
   await p.locator('.v2-added .history-chip',{hasText:'maison'}).click();await p.waitForSelector('#historyDetails.open .word-title');
   assert.equal(await p.locator('#historyDetails .word-title').first().textContent(),'maison');
   assert.equal(await p.locator('#historyDetails .example-item').count(),2);
   assert.deepEqual(await p.locator('#historyDetails .expression-pill').evaluateAll(nodes=>nodes.map(node=>node.textContent)),['faire comme chez soi','à la maison']);
   // under an idiom: the sentence that uses it with its pronunciation and meaning, and nothing else (not the idiom's own pronunciation and meaning)
   assert.deepEqual(await p.locator('#historyDetails .expression-item').first().evaluate(item=>[item.querySelectorAll('.phonetic-text').length,item.querySelector('.phonetic-text').textContent,item.querySelectorAll('.tr-text').length,item.querySelector('.tr-text').textContent,item.querySelector('.expression-example .fr-text').textContent]),[1,'Okunuş: fet kom şe vu',1,'Kendi evinizdeymiş gibi davranın!','Faites comme chez vous !']);
   await p.evaluate(()=>closeHistoryDetail());
   await waitPack(p,'12 / 40 kelime eklendi');
   await goTo(p,'Kelimeler');                                          // the cards are on the Words tab
   const titles=await p.locator('#contentArea .main-word-card .word-title').evaluateAll(nodes=>nodes.map(node=>node.textContent));
   assert.deepEqual(titles.slice(0,10).sort(),['au revoir',"s'il vous plaît",'oui','non','pardon','eau','pain','café','maison','ami'].sort());   // the new words are on top
   assert.equal(titles.length,13);                                                                  // and the three starters are still there
   assert.equal(seen.gemini,0);                                                                      // no AI, no key needed
   await goTo(p,'Bugün');
   // the daily limit applies to the pack as it does to the AI
   await p.getByRole('button',{name:'Günlük kelimeler ekle'}).click();
   await p.waitForFunction(()=>!!document.querySelector('.app-alert .app-alert-text'));
   assert.equal(await p.evaluate(()=>getHistory().length),before+10);
   // offline: the pack comes from the device and keeps working; it was fetched from the network only once
   await p.evaluate(()=>VocVocData.updateSettings({dailyLimit:'unlimited'}));
   await c.setOffline(true);await p.reload();await ready(p);
   await waitPack(p,'12 / 40 kelime eklendi');
   await p.getByRole('button',{name:'Günlük kelimeler ekle'}).click();
   await waitPack(p,'22 / 40 kelime eklendi');
   assert.deepEqual([seen.pack,seen.gemini],[1,0]);
   await c.close();
  }
  record('word packs: the pack of the language pair is downloaded once and kept; the Daily button adds its next words in order, without a key, within the daily limit, also offline');

  // a pair without a pack says so and falls back to the user's own key; a damaged copy on the device is replaced
  {
   const {c,p,seen}=await openPage();
   await waitPack(p,'2 / 40 kelime eklendi');
   await p.evaluate(()=>VocVocData.changeLanguage({nativeLanguage:'en'}));                            // French for an English speaker: no pack
   await p.waitForFunction(()=>/no ready-made pack/.test(document.querySelector('.v2-pack .v2-pack-text')?.textContent||''));
   const words=await p.evaluate(()=>getHistory().length);
   await p.getByRole('button',{name:'Add daily words'}).click();
   await p.waitForFunction(()=>!!document.querySelector('.app-alert .app-alert-text'));
   assert.deepEqual([await p.evaluate(()=>getHistory().length),seen.gemini],[words,0]);              // no key: nothing is added and nothing is sent
   await c.close();
  }
  {
   const {c,p}=await openPage();
   await waitPack(p,'2 / 40 kelime eklendi');
   await p.evaluate(async()=>{const cache=await caches.open('vocvoc-packs-v1');await cache.put(new URL('./packs/fr-tr.json',location.href).href,new Response('{ this is not json'));});
   await p.reload();await ready(p);await waitPack(p,'2 / 40 kelime eklendi');                         // replaced by a fresh download
   assert.equal(await p.evaluate(async()=>{const cache=await caches.open('vocvoc-packs-v1');return (await (await cache.match(new URL('./packs/fr-tr.json',location.href).href)).json()).words.length;}),40);
   await c.close();
  }
  record('word packs: a pair without a pack says so and sends nothing without a key; a damaged copy on the device is replaced');

  // the pack is used up: with a key the Daily button goes on with the AI, also while the Premium simulation is on (it used to say "use your own key" to people who had one); without a key it says so
  for(const plan of ['free','premium']){
   const {c,p,seen}=await openPage({init:value=>{if(value==='premium')localStorage.setItem('VOCVOC_SIM_PLAN','premium');},initArg:plan});
   await waitPack(p,'2 / 40 kelime eklendi');
   await p.evaluate(()=>VocVocData.updateSettings({dailyLimit:'unlimited'}));
   await p.evaluate(async()=>{const pack=await (await fetch('./packs/fr-tr.json')).json();await VocVocData.addWordBatch(pack.words.filter(entry=>!VocVocData.getWordProgress(entry.word)));});   // the whole pack is known now
   await waitPack(p,'Paketteki tüm kelimeleri ekledin. Yeni kelime için kendi API anahtarını kullanabilirsin.');
   await p.getByRole('button',{name:'Günlük kelimeler ekle'}).click();                               // no key: told so, nothing sent
   await p.waitForFunction(()=>/Paketteki tüm kelimeleri/.test(document.getElementById('v2Toast')?.textContent||''));
   assert.equal(seen.gemini,0);
   await p.evaluate(()=>VocVocSecrets.setApiKey('AIzaTestKey1234567890'));                          // with a key: the AI goes on
   await p.evaluate(()=>{document.getElementById('v2Toast').textContent='';document.getElementById('v2Toast').classList.remove('v2-show');});
   await p.getByRole('button',{name:'Günlük kelimeler ekle'}).click();
   for(let waited=0;waited<60&&!seen.gemini;waited++)await pause(100);
   assert(seen.gemini>=1,plan+': the AI must be asked when the pack is used up and there is a key');
   assert(!/Paketteki tüm kelimeleri/.test(await p.evaluate(()=>document.getElementById('v2Toast')?.textContent||'')));
   await c.close();
  }
  {
   // and when the AI answers, the words it added are pills under the button too
   const {c,p}=await openPage();
   await waitPack(p,'2 / 40 kelime eklendi');
   await p.evaluate(()=>VocVocData.updateSettings({dailyLimit:'unlimited'}));
   await p.evaluate(async()=>{const pack=await (await fetch('./packs/fr-tr.json')).json();await VocVocData.addWordBatch(pack.words.filter(entry=>!VocVocData.getWordProgress(entry.word)));VocVocSecrets.setApiKey('AIzaTestKey1234567890');});
   const fresh=Array.from({length:10},(_,index)=>'nouveau'+index);
   await p.route('https://generativelanguage.googleapis.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({words:fresh.map(word=>({word,type:'n',meaning:'anlam '+word,synonyms:[],antonyms:[],examples:[{text:word+' un',phonetic:'p',translation:'t'},{text:word+' deux',phonetic:'p',translation:'t'}],expressions:[]}))})}]}}]})}));
   await p.getByRole('button',{name:'Günlük kelimeler ekle'}).click();
   await p.waitForFunction(()=>document.querySelectorAll('.v2-added .history-chip').length===10);
   assert.deepEqual(await p.locator('.v2-added .history-chip').evaluateAll(nodes=>nodes.map(node=>node.textContent).sort()),[...fresh].sort());
   await c.close();
  }
  record('word packs: when the pack is used up the Daily button goes on with the AI if there is a key (also with the Premium simulation on) and says so without one; the words the AI added are pills too');

  // read-aloud: the device's voice, Premium only; the app's own markup stays as it is
  const speechMock=([voices])=>{
   const calls=[];window.__speech=calls;
   window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:voices===null?undefined:{getVoices:()=>voices,speak(utterance){calls.push({text:utterance.text,lang:utterance.lang,voice:utterance.voice&&utterance.voice.name,rate:utterance.rate});setTimeout(()=>utterance.onend&&utterance.onend(),40);},cancel(){calls.push({cancel:true});}}});
  };
  const FRENCH=[{lang:'fr-FR',name:'Fake French',localService:true},{lang:'tr-TR',name:'Fake Turkish',localService:true}];
  {
   const {c,p}=await openPage({init:speechMock,initArg:[FRENCH]});
   const calls=()=>p.evaluate(()=>window.__speech);
   await p.evaluate(()=>toggleHistoryDetail('Bonjour'));await p.waitForSelector('#historyDetails.open .v2-speak');
   const labels=await p.locator('#historyDetails .v2-speak').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')));
   assert(labels.length>=3&&labels.every(label=>label==='Sesli oku (Premium)'),JSON.stringify(labels));      // title, an example, an expression: locked on Free
   await p.locator('#historyDetails .v2-speak').first().click();
   await p.waitForFunction(()=>/Premium/.test(document.getElementById('v2Toast')?.textContent||'')&&document.getElementById('v2Toast').classList.contains('v2-show'));
   assert.deepEqual(await calls(),[]);                                                                // a free user does not start speech
   await p.evaluate(()=>VocVocPlan.set('premium'));
   assert.equal(await p.locator('#historyDetails .v2-speak').first().getAttribute('aria-label'),'Sesli oku: Bonjour');
   await p.locator('#historyDetails .v2-speak').first().click();
   assert.deepEqual((await calls()).filter(call=>!call.cancel),[{text:'Bonjour',lang:'fr-FR',voice:'Fake French',rate:1}]);
   await p.waitForFunction(()=>document.querySelector('#historyDetails .v2-speak').getAttribute('aria-pressed')==='false');   // ended
   // an example sentence is read as written; the same sentence pressed again is read slower, then faster, then slower ...
   await p.evaluate(()=>{for(const details of document.querySelectorAll('#historyDetails details.fold'))details.open=true;});
   const sentence=await p.locator('#historyDetails .example-item .fr-text').first().evaluate(node=>node.firstChild.textContent.trim());
   await p.evaluate(()=>{window.__speech.length=0;window.__utterances=[];window.speechSynthesis.speak=function(utterance){window.__utterances.push(utterance);window.__speech.push({text:utterance.text,lang:utterance.lang,rate:utterance.rate});};});   // it never ends by itself now
   const example=p.locator('#historyDetails .example-item .v2-speak').first();
   const spoken=async()=>(await calls()).filter(call=>call.text);
   await example.click();assert.deepEqual([(await spoken())[0].text,await example.getAttribute('aria-pressed'),await example.getAttribute('data-rate')],[sentence,'true','1×']);
   for(let press=0;press<4;press++)await example.click();
   assert.deepEqual((await spoken()).map(call=>call.rate),[1,0.6,1.3,0.6,1.3]);                      // normal, slow, fast, slow, fast
   assert.deepEqual([await example.getAttribute('data-rate'),await example.getAttribute('aria-label')],['1.3×',`Sesli oku: ${sentence} (hızlı)`]);
   // pressing while it is being read does not stop it, it starts again at the next speed; an older reading that ends late does not switch the new one off
   await p.evaluate(()=>window.__utterances[0].onend());
   assert.equal(await example.getAttribute('aria-pressed'),'true');
   await p.evaluate(()=>window.__utterances[4].onend());
   assert.equal(await example.getAttribute('aria-pressed'),'false');
   // another text starts at normal speed again; the first one is at normal speed again when it is pressed next
   await p.locator('#historyDetails .word-panel-fixed-header .v2-speak').click();
   assert.deepEqual([(await spoken()).pop().rate,await example.getAttribute('data-rate')],[1,null]);   // the speed badge belongs to the one read last
   await example.click();assert.equal((await spoken()).pop().rate,1);
   // on a phone the button is at the right of the sentence, in its first line, not below it
   assert.deepEqual(await p.evaluate(()=>{const row=document.querySelector('#historyDetails .example-item .fr-text'),button=row.querySelector('.v2-speak').getBoundingClientRect(),box=row.getBoundingClientRect();return {sameLine:button.top-box.top<14,atTheRight:button.right<=box.right+1&&button.left>box.left+box.width/2};}),{sameLine:true,atTheRight:true});
   await p.evaluate(()=>closeHistoryDetail());
   // the main card: its speaker sits in the header row, to the right of the title (not on a row of its own below it), also while the card is closed
   await goTo(p,'Kelimeler');
   const firstCard=p.locator('#contentArea .main-word-card').first();
   await p.evaluate(()=>{window.__speech.length=0;});
   await firstCard.locator(':scope > .v2-speak-corner').click();
   assert.equal(await firstCard.evaluate(card=>card.classList.contains('open')),false);                // it does not open the card
   assert.equal((await spoken())[0].text,await firstCard.locator('.word-title').textContent());
   await firstCard.locator('.main-word-toggle').click();await p.waitForSelector('#contentArea .main-word-card.open > .v2-speak-corner');
   assert.deepEqual(await p.evaluate(()=>{const card=document.querySelector('#contentArea .main-word-card.open'),button=card.querySelector(':scope > .v2-speak-corner').getBoundingClientRect(),title=card.querySelector('.word-title').getBoundingClientRect(),box=card.getBoundingClientRect();return {rightOfTitle:button.left>=title.right-1,notBelow:button.top<title.bottom,inside:button.right<=box.right&&button.top>=box.top&&button.left>=box.left};}),{rightOfTitle:true,notBelow:true,inside:true});
   const cardWord=await p.locator('#contentArea .main-word-card.open .word-title').textContent();
   await p.evaluate(()=>{window.__speech.length=0;});
   await p.locator('#contentArea .main-word-card.open > .v2-speak-corner').click();
   assert.equal((await calls()).find(call=>call.text).text,cardWord);
   await p.evaluate(()=>{location.hash='#/flip';});await p.waitForSelector('#flipOverlay.open [data-flip-face="front"] .flip-word-text');
   assert.equal(await p.locator('#flipOverlay .flip-panel > .v2-speak').count(),2);
   const flipWord=await p.locator('#flipOverlay [data-flip-face="front"] .flip-word-text').textContent();
   await p.evaluate(()=>{window.__speech.length=0;});
   await p.locator('#flipOverlay [data-flip-face="front"] > .v2-speak').click();
   assert.equal((await calls()).find(call=>call.text).text,flipWord);
   // leaving the page stops the voice
   await p.evaluate(()=>{window.speechSynthesis.speak=function(utterance){window.__speech.push({text:utterance.text});};});
   await p.evaluate(()=>{window.__speech.length=0;});
   await p.locator('#flipOverlay [data-flip-face="front"] > .v2-speak').click();
   await p.goBack();await p.waitForFunction(()=>window.__speech.some(call=>call.cancel));
   await c.close();
  }
  {
   // no voice for the language, and no speech at all: told in words, nothing breaks
   const noFrench=await openPage({init:speechMock,initArg:[[{lang:'tr-TR',name:'Fake Turkish',localService:true}]],context:{}});
   await noFrench.p.evaluate(()=>{localStorage.setItem('VOCVOC_SIM_PLAN','premium');});await noFrench.p.reload();await ready(noFrench.p);
   await noFrench.p.evaluate(()=>toggleHistoryDetail('Bonjour'));await noFrench.p.waitForSelector('#historyDetails.open .v2-speak');
   await noFrench.p.locator('#historyDetails .v2-speak').first().click();
   await noFrench.p.waitForFunction(()=>document.getElementById('v2Toast')?.textContent==='Bu cihazda Fransızca sesi yok.');
   assert.deepEqual((await noFrench.p.evaluate(()=>window.__speech)).filter(call=>call.text),[]);
   await noFrench.c.close();
   const none=await openPage({init:speechMock,initArg:[null]});
   await none.p.evaluate(()=>{localStorage.setItem('VOCVOC_SIM_PLAN','premium');});await none.p.reload();await ready(none.p);
   await none.p.evaluate(()=>toggleHistoryDetail('Bonjour'));await none.p.waitForSelector('#historyDetails.open .v2-speak');
   await none.p.locator('#historyDetails .v2-speak').first().click();
   await none.p.waitForFunction(()=>document.getElementById('v2Toast')?.textContent==='Bu tarayıcı sesli okumayı desteklemiyor.');
   await none.c.close();
  }
  record('read-aloud: locked on Free, the device voice for the word, example, main card and Flip on Premium, the same text pressed again is read slower, faster, slower ..., the button of a card in its header row, stop on leaving, clear messages without a voice');

  // Flip: a lock to the right of the speaker (off at the first card; on reads every new card by itself) and three dots at the lower left that open the word's panel
  {
   const {c,p}=await openPage({init:speechMock,initArg:[FRENCH]});
   const spoken=async()=>(await p.evaluate(()=>window.__speech)).filter(call=>call.text);
   const flipText=()=>p.locator('#flipOverlay [data-flip-face="front"] .flip-word-text').textContent();
   await p.evaluate(()=>{location.hash='#/flip';});await p.waitForSelector('#flipOverlay.open [data-flip-face="front"] .v2-flip-auto');
   const lock=p.locator('#flipOverlay [data-flip-face="front"] .v2-flip-auto');
   // Free: the lock is there but locked; pressing says why and nothing changes
   assert.equal(await lock.getAttribute('aria-pressed'),'false');
   await lock.click();await p.waitForFunction(()=>/Premium/.test(document.getElementById('v2Toast')?.textContent||''));
   assert.equal(await lock.getAttribute('aria-pressed'),'false');
   await p.evaluate(()=>VocVocPlan.set('premium'));
   // where they are: the speaker, the lock to its right on the same line, the three dots at the lower left; round, one tap big
   assert.deepEqual(await p.evaluate(()=>{const panel=document.querySelector('#flipOverlay [data-flip-face="front"]'),box=panel.getBoundingClientRect(),speak=panel.querySelector(':scope > .v2-speak').getBoundingClientRect(),auto=panel.querySelector(':scope > .v2-flip-auto').getBoundingClientRect(),more=panel.querySelector(':scope > .v2-flip-more').getBoundingClientRect();
    return {lockRightOfSpeaker:auto.left>=speak.right,sameLine:Math.abs(auto.top-speak.top)<2,dotsLowerLeft:more.left<box.left+box.width/3&&more.bottom>box.bottom-box.height/3&&more.top>box.top+box.height/2,big:[speak,auto,more].every(item=>item.width>=32&&item.height>=32)};}),{lockRightOfSpeaker:true,sameLine:true,dotsLowerLeft:true,big:true});
   assert.equal(await lock.getAttribute('aria-label'),'Kart değişince kelimeyi otomatik oku');
   // off at the first card: nothing is read when the Flip opens or when the lock is pressed; only a change of card is read
   assert.deepEqual(await spoken(),[]);
   await lock.click();assert.deepEqual([await lock.getAttribute('aria-pressed'),(await spoken()).length],['true',0]);
   assert.equal(await p.locator('#flipOverlay .v2-flip-auto[aria-pressed="true"]').count(),2);               // both faces agree
   const before=await flipText();
   await p.locator('#flipOverlay [data-flip-face="front"] [data-flip-nav="1"]').click();
   await p.waitForFunction(old=>document.querySelector('#flipOverlay [data-flip-face="front"] .flip-word-text')?.textContent!==old,before);
   const second=await flipText();
   await p.waitForFunction(word=>window.__speech.some(call=>call.text===word),second);
   assert.deepEqual((await spoken()).map(call=>[call.text,call.lang,call.rate]),[[second,'fr-FR',1]]);   // the new card, by itself, at normal speed
   assert.equal(await p.locator('#flipOverlay [data-flip-face="front"] .v2-flip-auto').getAttribute('aria-pressed'),'true');   // the lock stays on while the cards change
   await p.locator('#flipOverlay [data-flip-face="front"] [data-flip-nav="-1"]').click();
   await p.waitForFunction(word=>window.__speech.some(call=>call.text===word),before);
   assert.deepEqual((await spoken()).map(call=>call.text),[second,before]);
   // turning the face does not read anything; the lock off again: the next card is silent
   await p.locator('#flipOverlay [data-flip-face="front"] .flip-card').click();await p.locator('#flipCardBack').click();assert.equal((await spoken()).length,2);
   await lock.click();assert.equal(await p.locator('#flipOverlay [data-flip-face="front"] .v2-flip-auto').getAttribute('aria-pressed'),'false');
   await p.locator('#flipOverlay [data-flip-face="front"] [data-flip-nav="1"]').click();
   await p.waitForFunction(old=>document.querySelector('#flipOverlay [data-flip-face="front"] .flip-word-text')?.textContent!==old,before);
   await pause(300);assert.equal((await spoken()).length,2);
   // the three dots: the word's own panel above the Flip, like a chip of the History list; its keys belong to it, Escape closes it first
   const current=await flipText();
   await p.locator('#flipOverlay [data-flip-face="front"] .v2-flip-more').click();await p.waitForSelector('#historyDetails.open .word-title');
   assert.equal(await p.locator('#historyDetails .word-title').first().textContent(),current);
   assert.equal(await p.evaluate(()=>!!document.elementFromPoint(innerWidth/2,innerHeight/2).closest('#historyDetails')),true);        // on top of the Flip
   await p.keyboard.press('ArrowRight');await pause(400);assert.equal(await flipText(),current);                                       // the Flip behind did not move
   await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#historyDetails.open'));
   assert.deepEqual(await p.evaluate(()=>[!!document.querySelector('#flipOverlay.open'),location.hash]),[true,'#/flip']);              // only the panel closed
   // closing the Flip and opening it again: the lock is off again at its first card
   await lock.click();assert.equal(await p.locator('#flipOverlay [data-flip-face="front"] .v2-flip-auto').getAttribute('aria-pressed'),'true');
   await p.keyboard.press('Escape');await p.waitForFunction(()=>location.hash==='#/study');
   await p.evaluate(()=>{location.hash='#/flip';});await p.waitForSelector('#flipOverlay.open [data-flip-face="front"] .v2-flip-auto');
   assert.equal(await p.locator('#flipOverlay [data-flip-face="front"] .v2-flip-auto').getAttribute('aria-pressed'),'false');
   await c.close();
  }
  record('Flip: a lock beside the speaker (locked on Free, off at the first card, on reads each new card by itself and goes off when the Flip closes) and three dots at the lower left that open the word panel above the Flip');
 }
 // ===== New interface: WCAG AA contrast of its screens, light and dark =====
 {
 const MEASURE=([selector,pseudo])=>{
   const el=document.querySelector(selector);if(!el)return null;
   const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};};
   const blend=(top,bottom)=>({r:top.r*top.a+bottom.r*(1-top.a),g:top.g*top.a+bottom.g*(1-top.a),b:top.b*top.a+bottom.b*(1-top.a),a:1});
   const fg=parse(getComputedStyle(el,pseudo).color)||{r:0,g:0,b:0,a:1};
   const stack=[];for(let n=el;n;n=n.parentElement){const c=parse(getComputedStyle(n).backgroundColor);if(c&&c.a>0)stack.push(c);if(c&&c.a===1)break;}
   let base=stack.length&&stack[stack.length-1].a===1?stack.pop():parse(getComputedStyle(document.documentElement).backgroundColor)||{r:255,g:255,b:255,a:1};if(base.a<1)base=blend(base,{r:255,g:255,b:255,a:1});
   while(stack.length)base=blend(stack.pop(),base);
   const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);};
   const text=fg.a<1?blend(fg,base):fg,L1=lum(text),L2=lum(base),ratio=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
   const style=getComputedStyle(el);return {ratio:Math.round(ratio*100)/100,size:parseFloat(style.fontSize),weight:style.fontWeight};
 };
  const checks=[['',[['#v2Auth h1'],['#v2Auth p'],['#v2Auth label'],['#v2Auth .ui-button-success'],['#v2Auth .ui-button-secondary'],['#v2Auth .v2-note']]],
   ['#/today',[['#v2Screen h1'],['.v2-goal-label'],['.v2-goal-value'],['.v2-pack .v2-goal-label'],['.v2-pack-text'],['.v2-goal .ui-button'],['.v2-stat strong'],['.v2-stat span'],['#v2Dashboard .v2-day-label'],['#v2Dashboard .v2-day-num'],['#v2Dashboard .v2-legend'],['#v2Dashboard .v2-card h2'],['.v2-subtab[aria-selected="true"]'],['.v2-subtab[aria-selected="false"]'],['.v2-subtab-count']]],
   ['#/test',[['.v2-study-bar h1'],['#v2QuizCount'],['.v2-close'],['#v2QuizHost .quiz-option'],['#v2QuizHost .quiz-word-v91']]],
   ['#/cloze',[['.v2-study-bar h1'],['#v2QuizCount'],['#v2QuizHost .quiz-option'],['#v2QuizHost .quiz-word-v91'],['#v2QuizHost .quiz-cloze-hint']]],
   ['#/study',[['.v2-appbar .v2-brand'],['.v2-bar-title'],['.v2-avatar-dot'],['.v2-menu-btn'],['.v2-study-title'],['.v2-study-sub'],['#v2Screen h1'],['.v2-card h2'],['.v2-statline .v2-stat strong'],['.v2-statline .v2-stat span'],
    ['.v2-testlist .v2-bullet-great'],['.v2-testlist .v2-bullet-good'],['.v2-testlist .v2-bullet-fair'],['.v2-testlist .v2-bullet-low'],['.v2-test-day'],['.v2-testlist .v2-muted'],['.v2-testlist strong']]],
   ['#/stats',[['.v2-locked h2'],['.v2-locked p'],['.v2-locked .ui-button']]],
   ['#/profile',[['.v2-profile-name'],['.v2-chip'],['.v2-profile-head .v2-muted'],['.v2-row'],['.v2-row-end'],['.v2-row[data-danger]'],['.v2-page > .v2-muted']]],
   ['#/premium',[['.v2-back'],['.v2-card .v2-muted'],['.v2-feature-list li'],['.v2-note'],['.v2-card .ui-button']]],
   ['#/privacy',[['.v2-note'],['.v2-page h2'],['.v2-page p:not(.v2-note)']]]];
  let measured=0;
  for(const colorScheme of ['light','dark']){
   context=await browser.newContext({viewport:{width:390,height:844},colorScheme});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await context.addInitScript(()=>{const day=back=>new Date(Date.now()-back*864e5).toISOString();if(!localStorage.getItem('VOCVOC_ACTIVITY_V1'))localStorage.setItem('VOCVOC_ACTIVITY_V1',JSON.stringify({v:1,seeded:false,testsTaken:5,badges:{},quizzes:[3,5,7,9,10].map((score,index)=>({t:day(5-index),mode:'active',score,total:10,wrong:[]}))}));});
   await page.goto(url+'?ui=v2');await ready();await page.waitForSelector('#v2Auth.v2-open');
   const failures=[];
   const measureAll=async list=>{for(const [selector] of list){const result=await page.evaluate(MEASURE,[selector,null]);assert(result,`${selector} not found (${colorScheme})`);measured++;const need=(result.size>=24||(result.size>=18.66&&Number(result.weight)>=700))?3:4.5;if(result.ratio<need)failures.push(`${selector} ${result.ratio}:1 < ${need}`);}};
   await measureAll(checks[0][1]);
   await page.getByRole('button',{name:/Misafir olarak/}).click();await page.waitForSelector('#v2Auth:not(.v2-open)',{state:'attached'});
   await page.evaluate(()=>VocVocData.addWordBatch(Array.from({length:12},(_,i)=>({word:'contrast'+i,meaning:'anlam '+i,examples:[{text:'This is contrast'+i+' here.',phonetic:'dis iz kontrast here',translation:'Bu burada.'}],...(i===1?{expressions:[{text:'an idiom',translation:'bir deyim',exampleText:'An example.',examplePhonetic:'en igzempıl',exampleTranslation:'Bir örnek.'}]}:{})}))));
   for(const [hash,list] of checks.slice(1)){await page.evaluate(h=>{location.hash=h;},hash);await page.waitForSelector(hash==='#/today'?'#v2Screen[data-route="today"] .v2-pack-text':`#v2Screen[data-route="${hash.slice(2)}"] h1`);if(hash==='#/test'||hash==='#/cloze')await page.waitForSelector('#v2QuizHost .quiz-option');await measureAll(list);}
   await page.evaluate(()=>{VocVocPlan.set('premium');location.hash='#/premium';});await page.waitForSelector('#v2Screen[data-route="premium"] .v2-chip.v2-premium');await measureAll([['.v2-chip'],['.v2-card .ui-button']]);
   await page.evaluate(()=>markMemorized('contrast0'));await page.waitForFunction(()=>VocVocData.getWordProgress('contrast0').status==='memorized');
   await page.waitForSelector('#v2Celebrate.v2-on');await measureAll([['.v2-celebrate-kicker'],['.v2-celebrate-name'],['.v2-celebrate-desc'],['.v2-medal']]);   // the new-badge card
   await page.evaluate(()=>toggleHistoryDetail('contrast0'));await page.waitForSelector('#historyDetails.open .v2-speak');await measureAll([['#historyDetails .v2-speak']]);await page.evaluate(()=>closeHistoryDetail());
   for(const [hash,list] of [['#/stats',[['.v2-statline-4 .v2-stat strong'],['.v2-statline-4 .v2-stat span'],['.v2-day-label'],['.v2-day-num'],['.v2-legend'],['.v2-curve-range'],['.v2-card h2'],['.v2-card h3'],['.v2-card .v2-muted'],['.v2-page > .v2-muted']]],['#/today',[['.v2-badge-body h3'],['.v2-badge-body p.v2-muted'],['.v2-badge-date'],['.v2-badge-icon'],['.v2-badges-section > .v2-muted'],['.v2-badges-section h2']]]]){await page.evaluate(h=>{location.hash=h;},hash);await page.waitForSelector(`#v2Screen[data-route="${hash.slice(2)}"] h1`);await measureAll(list);}
   await page.locator('.v2-menu-btn').click();await measureAll([['.v2-drawer-head .v2-brand'],['.v2-nav-item'],['.v2-nav-item[aria-current="page"]'],['.v2-nav-settings'],['.v2-drawer-close']]);await page.keyboard.press('Escape');   // the open menu
   // the pills under the Daily button, the words of a day, the photo dialog, an idiom in the word panel
   await page.evaluate(()=>{location.hash='#/today';});await page.waitForSelector('#v2Screen[data-route="today"] .v2-pack-text');
   await page.getByRole('button',{name:'Günlük kelimeler ekle'}).click();await page.waitForSelector('.v2-added .v2-wordpill');await measureAll([['.v2-added .v2-goal-label'],['.v2-added .v2-wordpill']]);
   await page.locator('#v2Screen .v2-slot-btn').first().click();await page.waitForSelector('#v2DayWords');await measureAll([['#v2DayWordsTitle'],['#v2DayWords .v2-popup-card > p'],['#v2DayWords .v2-wordpill'],['.v2-popup-close']]);await page.keyboard.press('Escape');
   await page.evaluate(()=>{location.hash='#/profile';});await page.waitForSelector('#v2PhotoInput',{state:'attached'});
   await page.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=300;canvas.height=200;canvas.getContext('2d').fillRect(0,0,300,200);const file=new File([await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))],'a.png',{type:'image/png'});const transfer=new DataTransfer();transfer.items.add(file);const input=document.getElementById('v2PhotoInput');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
   await page.waitForSelector('#v2Crop');await measureAll([['.v2-crop-card h2'],['.v2-crop-card p'],['.v2-crop-zoom span'],['.v2-crop-card .ui-button-secondary'],['.v2-crop-card .ui-button-success']]);await page.keyboard.press('Escape');
   await page.evaluate(()=>toggleHistoryDetail('contrast1'));await page.waitForSelector('#historyDetails.open .expression-pill',{state:'attached'});await page.evaluate(()=>{for(const details of document.querySelectorAll('#historyDetails details.fold'))details.open=true;});await measureAll([['#historyDetails .expression-pill']]);await page.evaluate(()=>closeHistoryDetail());
   assert.deepEqual(failures,[],`contrast below WCAG AA in the ${colorScheme} theme`);
   await context.close();
  }
  record(`new interface: every checked text of its screens meets WCAG AA contrast in both themes (${measured} measurements)`);
 }
 // ===== Two tabs: an idle tab follows the other one, a busy tab is protected =====
 {
  context=await browser.newContext({viewport:{width:1000,height:800}});
  const A=await context.newPage();A.on('pageerror',e=>errors.push(e.message));await A.goto(url);await ready(A);
  const B=await context.newPage();B.on('pageerror',e=>errors.push(e.message));await B.goto(url);await ready(B);
  const cards=p=>p.evaluate(()=>[...document.querySelectorAll('#contentArea .main-word-card')].map(card=>card.querySelector('.word-title')?.textContent.trim()));
  const revision=p=>p.evaluate(()=>VocVocStorage.adapter.revision);
  const banner=p=>p.evaluate(()=>document.getElementById('pwaUpdate')?.dataset.kind||null);
  assert.deepEqual((await cards(A)).sort(),['Bonjour','Je','Merci']);
  await A.evaluate(()=>{window.__sameDocument=true;});
  // 1. B memorizes a word: A, idle, adopts it without a reload, without a banner, and can write right away
  await B.evaluate(()=>markMemorized('Merci'));
  await A.waitForFunction(()=>VocVocData.getWordProgress('Merci').status==='memorized');
  assert.deepEqual((await cards(A)).sort(),['Bonjour','Je']);assert.equal(await banner(A),null);
  assert.equal(await A.evaluate(()=>window.__sameDocument),true);assert.equal(await revision(A),await revision(B));
  await A.evaluate(()=>VocVocData.setStatus('Je','memorized'));                                    // no conflict: the cache and revision were adopted
  await B.waitForFunction(()=>VocVocData.getWordProgress('Je').status==='memorized');
  assert.deepEqual(await cards(B),['Bonjour']);assert.equal(await banner(B),null);
  record('two tabs: an idle tab adopts the other tab\'s commit (lists, revision) without reload or banner, and its own next write succeeds');
  // 2. a theme change in B reaches A, and a card A's reader has opened stays open
  await A.locator('#contentArea .main-word-toggle').first().click();
  assert.equal(await A.evaluate(()=>document.querySelectorAll('#contentArea .main-word-card.open').length),1);
  await B.evaluate(()=>VocVocData.updateSettings({theme:'dark'}));
  await A.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  assert.equal(await A.evaluate(()=>document.querySelectorAll('#contentArea .main-word-card.open').length),1);assert.equal(await A.evaluate(()=>document.getElementById('themeSelect').value),'dark');
  record('two tabs: settings (theme) follow the other tab and an opened card is not collapsed by it');
  // 3. a search result on screen is not replaced; the History chips still follow
  await A.fill('#searchInput','zzz');const shown=await A.evaluate(()=>document.getElementById('contentArea').innerHTML);
  await B.evaluate(()=>markMemorized('Bonjour'));
  await A.waitForFunction(()=>VocVocData.getWordProgress('Bonjour').status==='memorized');
  assert.equal(await A.evaluate(()=>document.getElementById('contentArea').innerHTML),shown);
  assert.equal(await A.evaluate(()=>[...document.querySelectorAll('#historyArea .history-chip.memorized')].length),3);
  await A.fill('#searchInput','');
  record('two tabs: a query being typed keeps its content; the History chips follow');
  // 4. a busy tab (Settings open) does not swap its data underneath: it shows the banner instead; its stale write is rejected
  await A.evaluate(()=>openModal());
  await B.evaluate(()=>VocVocData.setStatus('Bonjour','active'));
  await A.waitForFunction(()=>document.getElementById('pwaUpdate')?.dataset.kind==='external');
  assert.equal(await A.evaluate(()=>VocVocData.getWordProgress('Bonjour').status),'memorized');           // untouched while busy
  assert.equal(await A.evaluate(async()=>{try{await VocVocData.setStatus('Merci','active');return 'written';}catch(e){return e.storageCode||e.name;}}),'conflict');
  record('two tabs: a busy tab keeps its data and shows the reload banner; a stale write is still rejected');
  // 5. once it is idle again, the next commit is adopted and the external banner goes away by itself
  await A.evaluate(()=>closeModal());
  await B.evaluate(()=>VocVocData.setStatus('Merci','active'));
  await A.waitForFunction(()=>VocVocData.getWordProgress('Merci').status==='active'&&!document.getElementById('pwaUpdate'));
  assert.equal(await A.evaluate(()=>VocVocData.getWordProgress('Bonjour').status),'active');                  // it also caught up with what it had missed
  assert.deepEqual((await cards(A)).sort(),['Bonjour','Merci']);assert.equal(await revision(A),await revision(B));
  record('two tabs: back to idle, the tab catches up on everything it missed and the banner disappears');
  // 6. a burst of commits ends in the final state with no banner
  await B.evaluate(async()=>{for(const word of ['Je','Merci','Bonjour'])await VocVocData.setStatus(word,'memorized');});
  await A.waitForFunction(()=>['Je','Merci','Bonjour'].every(word=>VocVocData.getWordProgress(word).status==='memorized'));
  assert.equal(await banner(A),null);assert.equal(await revision(A),await revision(B));
  record('two tabs: a burst of commits is adopted completely');
  await context.close();
 }
 // ===== Flip: the previous/next arrows have no borders =====
 {
  for(const colorScheme of ['light','dark']){
   context=await browser.newContext({viewport:{width:390,height:844},colorScheme});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);await ready();await page.evaluate(()=>startFlip());await page.waitForSelector('#flipOverlay [data-flip-face="front"] .flip-nav');
   const arrows=await page.evaluate(()=>[...document.querySelectorAll('#flipOverlay .flip-nav')].map(button=>{const style=getComputedStyle(button);return [style.borderTopWidth,style.borderRightWidth,style.borderBottomWidth,style.borderLeftWidth,style.borderStyle].join(' ');}));
   assert.equal(arrows.length,4);                                                                   // two arrows on each of the two faces
   assert(arrows.every(border=>/^0px 0px 0px 0px /.test(border)),`the arrows still have a border (${colorScheme}): ${arrows}`);
   await context.close();
  }
  record('Flip: the previous/next arrows have no border on either face, in the light and the dark theme');
 }
 // ===== Popup headword: selectable and copyable; the rest of the header is a swipe surface =====
 {
  context=await browser.newContext({viewport:{width:1000,height:800}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await ready();
  await page.evaluate(()=>toggleHistoryDetail('Bonjour'));await page.waitForSelector('#historyDetails.open');
  const style=selector=>page.evaluate(selector=>getComputedStyle(document.querySelector(selector)).userSelect,selector);
  assert.deepEqual([await style('#historyDetails .word-title'),await style('#historyDetails .word-type'),await style('#historyDetails .ui-panel-header')],['text','none','none']);
  // a real double-click selects the headword; the same gesture on the part-of-speech label selects nothing
  await page.dblclick('#historyDetails .word-title');assert.equal(await page.evaluate(()=>getSelection().toString().trim()),'Bonjour');
  await page.evaluate(()=>getSelection().removeAllRanges());await page.dblclick('#historyDetails .word-type');assert.equal(await page.evaluate(()=>getSelection().toString().trim()),'');
  // selectstart (its target is a text node) and the context menu are only blocked on the swipe surface, and nothing throws
  const prevented=await page.evaluate(()=>{
   const fire=(node,type)=>{const event=new Event(type,{bubbles:true,cancelable:true});node.dispatchEvent(event);return event.defaultPrevented;};
   const title=document.querySelector('#historyDetails .word-title'),label=document.querySelector('#historyDetails .word-type'),close=document.querySelector('#historyDetails .word-popup-close');
   return {titleText:fire(title.firstChild,'selectstart'),titleMenu:fire(title,'contextmenu'),labelText:fire(label.firstChild,'selectstart'),labelMenu:fire(label,'contextmenu'),closeMenu:fire(close,'contextmenu')};});
  assert.deepEqual(prevented,{titleText:false,titleMenu:false,labelText:true,labelMenu:true,closeMenu:true});
  // a press that selected the headword and then became a swipe leaves no selection behind
  assert.equal(await page.evaluate(()=>{getSelection().selectAllChildren(document.querySelector('#historyDetails .word-title'));const before=getSelection().toString().trim();releaseCardSwipeGesture();claimCardSwipeGesture({cancelable:false});const after=getSelection().toString();releaseCardSwipeGesture();return before+'|'+after;}),'Bonjour|');
  record('popup headword: selectable and copyable (double-click, context menu), the rest of the header stays a swipe surface, a swipe clears the selection');
  await context.close();
 }
 // ===== Backup file name carries the user's local day =====
 {
  context=await browser.newContext({timezoneId:'Pacific/Auckland'});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await ready();
  await page.clock.setFixedTime(new Date('2026-10-05T23:30:00Z'));                                   // 12:30 on 6 October in Auckland, still 5 October in UTC
  assert.deepEqual(await page.evaluate(()=>[new Date().toISOString().slice(0,10),backupDateStamp()]),['2026-10-05','2026-10-06']);
  await page.evaluate(()=>openModal());await page.locator('#backupLabel').click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportDataBtn').click()]);
  assert.equal(download.suggestedFilename(),'VocVoc-backup-2026-10-06.json');
  record('backup file name uses the local date (6 October in Auckland, not the UTC 5 October)');
  await context.close();
 }
 // ===== Content Security Policy =====
 {
  context=await browser.newContext();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://generativelanguage.googleapis.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.route('https://example.com/**',route=>route.fulfill({status:200,contentType:'text/plain',body:'reachable'}));   // would answer if the browser let the request out
  await page.goto(url);await ready();
  assert((await page.evaluate(()=>document.querySelector('meta[http-equiv="Content-Security-Policy"]').content)).includes("connect-src 'self' https://generativelanguage.googleapis.com;"));
  const mark=cspViolations.length;
  const probe=await page.evaluate(async()=>{
   window.__cspExpected=true;const seen=[],out={};document.addEventListener('securitypolicyviolation',e=>seen.push(e.violatedDirective));
   for(const [name,target,method] of [['gemini',GEMINI_ENDPOINT+'probe:generateContent','POST'],['sameOrigin',location.href,'GET'],['other','https://example.com/','GET']]){
    try{out[name]='reachable '+(await fetch(target,{method})).status;}catch(error){out[name]=error.name;}}
   await new Promise(resolve=>setTimeout(resolve,100));out.violations=seen;return out;});
  assert.deepEqual(probe,{gemini:'reachable 200',sameOrigin:'reachable 200',other:'TypeError',violations:['connect-src']});
  await pause(300);assert(cspViolations.splice(mark).length>=1,'the violation collector did not see the blocked request');   // caused on purpose; proves the suite-wide collector works
  record('CSP: requests to this origin and the Gemini API pass, a request to any other origin is blocked by connect-src');
  await context.close();
 }
 assert.deepEqual(errors,[]);record('no browser JavaScript errors');
 assert.deepEqual(cspViolations,[]);record('CSP: the whole suite (every screen, backup, update, offline, Gemini calls) ran without a single policy violation');
 console.log(JSON.stringify({passed:results.length,startup1000ms:startupMs,results},null,2));fs.writeFileSync(path.join(root,'tests','browser-results.json'),JSON.stringify({passed:results.length,startup1000ms:startupMs,results},null,2));
}
main().catch(e=>{console.error(e);console.error(`
Last scenario that passed: ${results[results.length-1]||'(none)'}
The failing scenario is the next one in tests/browser.cjs.`);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
