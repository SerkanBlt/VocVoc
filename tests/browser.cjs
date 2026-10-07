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
 server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let file=url.pathname==='/baseline.html'?original:path.join(root,url.pathname.replace(/^\/VocVoc\//,''));if(url.pathname==='/VocVoc/')file=path.join(root,'index.html');try{if(serveNext&&skew==='icon'&&url.pathname.endsWith('/icons/maskable-512.png')){res.writeHead(404);res.end('missing');return;}let data=fs.readFileSync(file);if(serveNext&&file.endsWith('sw.js'))data=Buffer.from(data.toString().replace(`VERSION='${shellVersion}'`,`VERSION='${nextVersion}'`));if(serveNext&&file.endsWith('index.html')){let html=data.toString().replace('<title>VocVoc</title>','<title>VocVoc update test</title>');if(skew!=='meta')html=html.replace(`name="vocvoc-shell" content="${shellVersion}"`,`name="vocvoc-shell" content="${nextVersion}"`);data=Buffer.from(html);}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.png')?'image/png':'text/html');res.end(data);}catch(_){res.writeHead(404);res.end('missing');}});
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
   const request=route.request(),body=JSON.parse(request.postData()),call={model:/models\/([^:]+):/.exec(request.url())[1],schema:body.generationConfig.responseSchema||null,mime:body.generationConfig.responseMimeType,key:request.headers()['x-goog-api-key'],url:request.url()};
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
  calls.length=0;plan=n=>n<=2?fail(404,'not found'):ok(wordCard('beta'));await search('betaq')();await page.waitForFunction(()=>!!VocVocData.getWordByText('beta'));assert.deepEqual(calls.map(c=>c.model),models);
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
  await page.evaluate(()=>closeArchive());await openArchiveFromSettings();assert.equal((await archiveState()).words,400);          // reopening starts at the first page
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
  await page.goto(url);await ready();
  assert.deepEqual(await page.evaluate(()=>[!!document.getElementById('v2Root'),document.body.classList.contains('v2'),typeof VocVocPlan,VocVocPlan.get(),VocVocPlan.has('stats')]),[false,false,'object','free',false]);
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

  // tab bar: five tabs, Today is the existing home screen, the others are pages
  const tabs=()=>page.evaluate(()=>[...document.querySelectorAll('.v2-tab')].map(button=>button.textContent+(button.getAttribute('aria-current')==='page'?'*':'')));
  assert.deepEqual(await tabs(),['Bugün*','Çalış','İstatistik','Rozetler','Profil']);
  assert.equal(await page.evaluate(()=>document.querySelector('.container').classList.contains('v2-away')),false);   // the existing home screen
  for(const [tab,heading] of [['Çalış','Çalış'],['İstatistik','İstatistikler'],['Rozetler','Rozetler'],['Profil','Profil']]){
   await page.locator('.v2-tab',{hasText:tab}).click();
   assert.equal(await page.locator('#v2Screen h1').textContent(),heading);
   assert.equal(await page.evaluate(()=>document.activeElement.tagName),'H1');                                       // focus moves to the new page's heading
   assert.equal((await tabs()).filter(label=>label.endsWith('*')).length,1);
   assert.equal(await page.evaluate(()=>document.querySelector('.container').classList.contains('v2-away')),true);  // the home screen steps aside
  }
  await page.locator('.v2-tab',{hasText:'Bugün'}).click();assert.equal(await page.evaluate(()=>document.getElementById('v2Screen').hidden),true);
  record('new interface: five tabs, Today is the existing home screen, the others are full pages, the heading takes focus, one tab is current');

  // the study hub starts the existing flows
  await page.locator('.v2-tab',{hasText:'Çalış'}).click();
  assert.match(await page.locator('.v2-study-card',{hasText:'Test'}).textContent(),/3 aktif kelimeden 10 soru/);
  await page.evaluate(()=>VocVocData.addWordBatch(Array.from({length:12},(_,i)=>({word:'hubword'+i,meaning:'anlam '+i}))));   // a Test needs more than the 3 starter words
  await page.locator('.v2-tab',{hasText:'Bugün'}).click();await page.locator('.v2-tab',{hasText:'Çalış'}).click();
  assert.match(await page.locator('.v2-study-card',{hasText:'Test'}).textContent(),/15 aktif kelimeden 10 soru/);
  await page.locator('.v2-study-card',{hasText:'Test'}).click();
  assert.deepEqual(await page.evaluate(()=>[!!quizSession,location.hash,document.querySelector('.container').classList.contains('v2-away')]),[true,'#/today',false]);
  await page.evaluate(()=>{quizSession=null;renderAllLocal();});
  record('new interface: the study hub shows the counts and starts the existing Test on the home screen');

  // Free: Statistics are locked and lead to Premium; simulating Premium unlocks them and switches the API key off
  await page.locator('.v2-tab',{hasText:'İstatistik'}).click();
  assert.equal(await page.locator('#v2Screen .v2-locked').count(),1);
  await page.getByRole('button',{name:"Premium'a geç"}).click();assert.equal(await page.locator('#v2Screen h1').textContent(),'Premium');
  assert.match(await page.locator('#v2Screen').textContent(),/API anahtarı: etkin/);
  await page.getByRole('button',{name:"Premium'u simüle et"}).click();
  assert.deepEqual(await page.evaluate(()=>[VocVocPlan.get(),VocVocPlan.has('stats'),VocVocPlan.has('sentenceBuilder'),VocVocPlan.ownKeyActive(),localStorage.getItem('VOCVOC_SIM_PLAN')]),['premium',true,true,false,'premium']);
  assert.match(await page.locator('#v2Screen').textContent(),/API anahtarı: devre dışı/);
  await page.locator('.v2-tab',{hasText:'İstatistik'}).click();assert.equal(await page.locator('#v2Screen .v2-locked').count(),0);
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
  await page.getByRole('button',{name:/Misafir/}).click();await page.waitForSelector('#v2Auth:not(.v2-open)',{state:'attached'});
  await page.evaluate(()=>{location.hash='#/profile';});await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:/Eski arayüze dön/}).click()]);await ready();
  assert.deepEqual(await page.evaluate(()=>[!!document.getElementById('v2Root'),localStorage.getItem('VOCVOC_UI')]),[false,null]);
  record('new interface: draft policy/terms/help/about pages, sign-out keeps the data, "old interface" turns the new one off');
  await context.close();
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
   ['#/study',[['.v2-tab[aria-current="page"] .v2-tab-label'],['.v2-tab:not([aria-current="page"]) .v2-tab-label'],['.v2-study-title'],['.v2-study-sub'],['#v2Screen h1']]],
   ['#/stats',[['.v2-locked h2'],['.v2-locked p'],['.v2-locked .ui-button']]],
   ['#/profile',[['.v2-profile-name'],['.v2-chip'],['.v2-profile-head .v2-muted'],['.v2-row'],['.v2-row-end'],['.v2-row[data-danger]'],['.v2-page > .v2-muted']]],
   ['#/premium',[['.v2-back'],['.v2-card .v2-muted'],['.v2-feature-list li'],['.v2-note'],['.v2-card .ui-button']]],
   ['#/privacy',[['.v2-note'],['.v2-page h2'],['.v2-page p:not(.v2-note)']]]];
  let measured=0;
  for(const colorScheme of ['light','dark']){
   context=await browser.newContext({viewport:{width:390,height:844},colorScheme});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url+'?ui=v2');await ready();await page.waitForSelector('#v2Auth.v2-open');
   const failures=[];
   const measureAll=async list=>{for(const [selector] of list){const result=await page.evaluate(MEASURE,[selector,null]);assert(result,`${selector} not found (${colorScheme})`);measured++;const need=(result.size>=24||(result.size>=18.66&&Number(result.weight)>=700))?3:4.5;if(result.ratio<need)failures.push(`${selector} ${result.ratio}:1 < ${need}`);}};
   await measureAll(checks[0][1]);
   await page.getByRole('button',{name:/Misafir/}).click();await page.waitForSelector('#v2Auth:not(.v2-open)',{state:'attached'});
   for(const [hash,list] of checks.slice(1)){await page.evaluate(h=>{location.hash=h;},hash);await page.waitForSelector(`#v2Screen[data-route="${hash.slice(2)}"] h1`);await measureAll(list);}
   await page.evaluate(()=>{VocVocPlan.set('premium');location.hash='#/premium';});await page.waitForSelector('#v2Screen[data-route="premium"] .v2-chip.v2-premium');await measureAll([['.v2-chip'],['.v2-card .ui-button']]);
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
