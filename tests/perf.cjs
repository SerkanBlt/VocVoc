/* Mobile performance measurement (not part of `npm test`).
   node tests/perf.cjs [--sizes=100,500,1000,2000,5000] [--rates=1,4] [--label=before] [--out=tests/perf-results.json]
   Optional PWA_BROWSER_PATH points to a Chromium executable. Seeds Schema v1 data straight into IndexedDB (so the cold start is a
   normal start, not a migration), loads the app in a 390x844 mobile viewport with CPU throttling, and times the interactions that
   scale with the number of words. Every interaction is measured 3 times (median) and includes the next two animation frames. */
const {chromium}=require('playwright'),fs=require('fs'),http=require('http'),path=require('path');
const root=path.resolve(__dirname,'..');
const arg=(name,fallback)=>{const hit=process.argv.find(item=>item.startsWith(`--${name}=`));return hit?hit.slice(name.length+3):fallback;};
const appRoot=path.resolve(arg('root',root)); // which tree of the app to measure (default: this checkout)
const sizes=arg('sizes','100,500,1000,2000,5000').split(',').map(Number),rates=arg('rates','1,4').split(',').map(Number),label=arg('label','run'),out=arg('out','');
const mix=arg('mix','50/30/20').split('/').map(Number); // % active / memorized / archived

// Runs inside the page: builds a realistic Schema v1 snapshot (details like a Gemini answer) and stores it in IndexedDB.
function makeDb(n,mix){
  const words={},aliases={},progress={},base=Date.parse('2026-01-01T00:00:00Z'),[active,memorized]=mix;
  for(let i=0;i<n;i++){
    const word='mot'+String(i).padStart(5,'0'),id='fr:tr:'+word,stamp=new Date(base+i*60000).toISOString(),slot=i%100;
    const status=slot<active?'active':slot<active+memorized?'memorized':'archived';
    words[id]={id,word,normalized:word,targetLanguage:'fr',nativeLanguage:'tr',type:'isim (nom masculin)',
      meaning:`${word} sözcüğünün, bir iki cümlelik ayrıntılı Türkçe açıklaması; sıradan bir Gemini yanıtının uzunluğunda bir metin.`,
      synonyms:['syn'+i+'a','syn'+i+'b','syn'+i+'c'],antonyms:['ant'+i+'a','ant'+i+'b'],
      examples:[0,1,2].map(k=>({text:`Voici une phrase d'exemple numéro ${k} avec ${word} dans un contexte utile.`,phonetic:'vuasi ün fraz dekzamp',translation:`${word} ile yararlı bir bağlamda ${k}. örnek cümle.`})),
      expressions:[0,1].map(k=>({text:`expression ${k} avec ${word}`,phonetic:'ekspresyon avek',translation:`${word} içeren ${k}. deyim.`,exampleText:`Une phrase pour l'expression ${k} de ${word}.`,examplePhonetic:'ün fraz pur',exampleTranslation:`${k}. deyim için örnek cümle.`})),
      createdAt:stamp,updatedAt:stamp};
    aliases[id]=id;
    progress[id]={wordId:id,status,firstSeenAt:stamp,lastSeenAt:stamp,statusChangedAt:stamp,memorizedAt:status==='memorized'?stamp:null,archivedAt:status==='archived'?stamp:null,archiveSourceStatus:status==='archived'?'active':null};
  }
  return {schemaVersion:1,meta:{starterWordsInitialized:true},settings:{nativeLanguage:'tr',targetLanguage:'fr',difficulty:'A1-A2',dailyLimit:'unlimited',theme:'system',fontSize:'normal'},words,aliases,progress,dailyUsage:{date:null,count:0}};
}
async function seedIndexedDb(page,n){
  await page.evaluate(async ([maker,count,distribution])=>{
    const db=(new Function('return ('+maker+')'))()(count,distribution);
    const req=indexedDB.open('VOCVOC_PWA',1);
    await new Promise((resolve,reject)=>{req.onupgradeneeded=()=>{req.result.createObjectStore('state');req.result.createObjectStore('control');};req.onerror=()=>reject(req.error);req.onsuccess=resolve;});
    const tx=req.result.transaction(['state','control'],'readwrite');
    tx.objectStore('state').put(db,'schema-v1');tx.objectStore('control').put(1,'revision');tx.objectStore('control').put({phase:'complete'},'migration');
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});req.result.close();
  },[makeDb.toString(),n,mix]);
}
const probe=`(()=>{
  window.__perf={marks:{},calls:{renderHistory:[],renderAllLocal:[],applyAppLanguage:[]},longTasks:0,longTaskMs:0,idbReads:0};
  try{new PerformanceObserver(list=>{for(const e of list.getEntries()){__perf.longTasks++;__perf.longTaskMs+=e.duration;}}).observe({type:'longtask',buffered:true});}catch(_){}
  document.addEventListener('DOMContentLoaded',()=>{
    for(const name of ['renderHistory','renderAllLocal','applyAppLanguage']){const original=window[name];window[name]=function(...args){const t0=performance.now();try{return original.apply(this,args);}finally{__perf.calls[name].push(performance.now()-t0);}};}
    const init=VocVocData.init;VocVocData.init=async function(){const t0=performance.now();try{return await init.call(this);}finally{__perf.marks.initMs=performance.now()-t0;}};
    const read=VocVocStorage.adapter.read;VocVocStorage.adapter.read=function(...args){__perf.idbReads++;return read.apply(this,args);};
    const boot=document.getElementById('storageBoot');
    new MutationObserver(()=>{if(boot.hidden&&!__perf.marks.ready){__perf.marks.ready=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>{__perf.marks.painted=performance.now();}));}}).observe(boot,{attributes:true,attributeFilter:['hidden']});
  });
})();`;
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
const round=value=>Math.round(value*10)/10;

async function measure(browser,n,rate,baseUrl){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(baseUrl+'/baseline.html');await seedIndexedDb(page,n);
  const client=await context.newCDPSession(page);await client.send('Performance.enable');
  if(rate>1)await client.send('Emulation.setCPUThrottlingRate',{rate});
  await page.addInitScript(probe);
  const loadStart=Date.now();await page.goto(baseUrl+'/VocVoc/');
  await page.waitForFunction(()=>window.__perf?.marks.painted,null,{timeout:300000});await page.waitForTimeout(500);
  const startup=await page.evaluate(()=>{const p=__perf;return {readyMs:p.marks.ready,paintedMs:p.marks.painted,initMs:p.marks.initMs,longTasks:p.longTasks,longTaskMs:p.longTaskMs,
    renders:{history:p.calls.renderHistory.length,content:p.calls.renderAllLocal.length},renderHistoryMs:p.calls.renderHistory.reduce((a,b)=>a+b,0),renderAllLocalMs:p.calls.renderAllLocal.reduce((a,b)=>a+b,0),idbReads:p.idbReads};});
  // Interactions, each 3x, median, including the next two frames.
  const times=await page.evaluate(async()=>{
    const frames=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const run=async(fn,reset)=>{const sync=[],total=[];for(let i=0;i<3;i++){const t0=performance.now();await fn();sync.push(performance.now()-t0);await frames();total.push(performance.now()-t0);if(reset)await reset();await frames();}
      const mid=list=>[...list].sort((a,b)=>a-b)[1];return {sync:mid(sync),total:mid(total)};};
    const out={},filter=document.getElementById('historyFilterInput'),sort=document.getElementById('historySort');
    const active=VocVocData.getProgressEntries().find(p=>p.status==='active')?.word;
    out.renderAllLocal=await run(()=>renderAllLocal());
    out.renderHistory=await run(()=>renderHistory());
    out.filterNarrow=await run(()=>{filter.value='mot0012';renderHistory();},()=>{filter.value='';renderHistory();});
    out.filterBroad=await run(()=>{filter.value='mot';renderHistory();},()=>{filter.value='';renderHistory();});
    out.sortAZ=await run(()=>{sort.value='az';renderHistory();},()=>{sort.value='none';renderHistory();});
    out.popupOpen=await run(()=>toggleHistoryDetail(active),()=>closeHistoryDetail());
    out.archiveOpen=await run(()=>openArchive(),()=>closeArchive());
    out.quizPoolOnly=await run(()=>getQuizPool());
    out.recallPoolOnly=await run(()=>getRecallQuizPool());
    out.startTest=await run(()=>startQuiz(),()=>{quizSession=null;});
    out.startRecall=await run(()=>startRecallQuiz(),()=>{quizSession=null;});
    renderAllLocal();await frames();
    out.setStatusCommit=await run(()=>VocVocData.setStatus(active,'memorized'),()=>VocVocData.setStatus(active,'active'));
    // Diagnostic: how much of a full re-render is the document-wide MutationObserver (swipe-footer fitting)?
    swipeFooterMutationObserver.disconnect();await frames();
    out.renderAllLocal_withoutFooterObserver=await run(()=>renderAllLocal());
    out.popupOpen_footerObserverOff=await run(()=>toggleHistoryDetail(active),()=>closeHistoryDetail());
    popupLockObserver.disconnect();await frames();
    out.popupOpen_scrollLockObserverAlsoOff=await run(()=>toggleHistoryDetail(active),()=>closeHistoryDetail());
    return out;
  });
  const metricsList=(await client.send('Performance.getMetrics')).metrics;const metric=name=>metricsList.find(m=>m.name===name)?.value;
  await client.send('HeapProfiler.enable').catch(()=>{});await client.send('HeapProfiler.collectGarbage').catch(()=>{});
  const after=(await client.send('Performance.getMetrics')).metrics;const heap=after.find(m=>m.name==='JSHeapUsedSize')?.value;
  const dom=await page.evaluate(()=>({nodes:document.getElementsByTagName('*').length,cards:document.querySelectorAll('.main-word-card').length,chips:document.querySelectorAll('.history-chip').length,footers:document.querySelectorAll('.swipe-footer').length}));
  await context.close();
  return {n,rate,startup:Object.fromEntries(Object.entries(startup).map(([k,v])=>[k,typeof v==='number'?round(v):v])),times:Object.fromEntries(Object.entries(times).map(([k,v])=>[k,{sync:round(v.sync),total:round(v.total)}])),
    dom,heapMB:round(heap/1048576),nodesMetric:metric('Nodes'),errors,wallSeconds:round((Date.now()-loadStart)/1000)};
}

(async()=>{
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');let file=url.pathname==='/baseline.html'?path.join(root,'tests/fixtures/spa-v1.html'):path.join(appRoot,url.pathname.replace(/^\/VocVoc\//,''));
    if(url.pathname==='/VocVoc/')file=path.join(appRoot,'index.html');
    try{const data=fs.readFileSync(file);res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.png')?'image/png':'text/html');res.end(data);}catch(_){res.writeHead(404);res.end('missing');}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const baseUrl=`http://127.0.0.1:${server.address().port}`;
  const launch={headless:true};if(process.env.PWA_BROWSER_PATH){launch.executablePath=process.env.PWA_BROWSER_PATH;launch.args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'];}
  const browser=await chromium.launch(launch);const results=[];
  for(const rate of rates)for(const n of sizes){
    process.stderr.write(`measuring ${n} words at ${rate}x CPU ... `);
    try{const r=await measure(browser,n,rate,baseUrl);results.push(r);process.stderr.write(`ready ${r.startup.paintedMs} ms, ${r.dom.nodes} nodes\n`);}
    catch(error){results.push({n,rate,error:String(error.message).split('\n')[0]});process.stderr.write(`FAILED ${String(error.message).split('\n')[0]}\n`);}
  }
  await browser.close();server.close();
  const payload={label,when:new Date().toISOString(),mix,viewport:'390x844',results};
  if(out)fs.writeFileSync(path.resolve(root,out),JSON.stringify(payload,null,2));
  console.log(JSON.stringify(payload,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
