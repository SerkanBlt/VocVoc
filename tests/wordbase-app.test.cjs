/* The word module of the app (wordbase.js): looking a word up, the next words of a level, a random word, the progress of a level and what happens offline.
   It runs against the real files in packs/ (read from disk instead of the network), so the shipped course is what is tested.
   Run: node --test tests/wordbase-app.test.cjs   (npm test does this). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const Packs=require('../packs.js');
const Wordbase=require('../wordbase.js');
const root=path.resolve(__dirname,'..');
const order=JSON.parse(fs.readFileSync(path.join(root,'packs','fr-tr','order.json'),'utf8'));
const wordsOf=band=>order.chunks.filter(chunk=>Packs.BANDS[band].includes(chunk.level)).flatMap(chunk=>chunk.words);

/* A page that has the files on disk and can be switched offline. `requested` lists the files asked for, in order. */
function makeEnv({settings={},known=[]}={}){
  const state={offline:false,requested:[],settings:{targetLanguage:'fr',nativeLanguage:'tr',difficulty:'A1',...settings},known:new Set(known),changes:0};
  const env={
    packs:Packs,
    settings:()=>state.settings,
    isKnown:word=>state.known.has(word),
    onChange:()=>{state.changes++;},
    async fetchJson(url){
      state.requested.push(url);
      if(state.offline)throw new Error('offline');
      return JSON.parse(fs.readFileSync(path.join(root,url.replace(/^\.\//,'')),'utf8'));
    }
  };
  return {env,state,wordbase:Wordbase.create(env)};
}

describe('Looking a word up (keys)',()=>{
  it('ignores case, accents and a leading article, but keeps the exact spelling first',()=>{
    assert.equal(Wordbase.foldText('École'),'ecole');
    assert.equal(Wordbase.foldText('  cœur '),'coeur');
    assert.equal(Wordbase.withoutArticle("l'école"),'école');
    assert.equal(Wordbase.withoutArticle('les amis'),'amis');
    assert.equal(Wordbase.withoutArticle('le'),'le','a word that is only an article stays');
    assert.deepEqual(Wordbase.lookupKeys("L’École",'fr'),['L’École','École']);
    const index=Wordbase.buildIndex({chunks:[{id:'A1-01',level:'A1',words:['école','être']}]},'fr');
    for(const typed of ['école','ECOLE','Ecole',"l'école",'une école'])assert.equal(Wordbase.lookupInIndex(index,typed,'fr')?.word,'école',typed);
    assert.equal(Wordbase.lookupInIndex(index,'etre','fr')?.word,'être');
    assert.equal(Wordbase.lookupInIndex(index,'zzz','fr'),null);
  });
  it('offers words like a dictionary while one types: the words that begin with it (shortest first), then a later part of a phrase; accents, case and article do not matter',()=>{
    const index=Wordbase.buildIndex({chunks:[{id:'A1-01',level:'A1',words:['maison','mais','maïs','maisonnette','école',"s'il vous plaît",'la mairie']},{id:'A2-01',level:'A2',words:['maintenant']}]},'fr');
    const offer=(typed,options)=>Wordbase.suggestWords(index,typed,'fr',options).map(item=>item.word);
    assert.deepEqual(offer('mai'),['mais','maïs','maison','maintenant','maisonnette','la mairie']);
    assert.deepEqual(offer('MAISO'),['maison','maisonnette']);
    assert.deepEqual(offer('ecol'),['école']);
    assert.deepEqual(offer('plai'),["s'il vous plaît"]);
    assert.deepEqual(offer('le maiso'),['maison','maisonnette'],'the article is left out');
    assert.deepEqual(offer('mai',{limit:2}),['mais','maïs']);
    assert.deepEqual(offer('zzz'),[]);
    assert.deepEqual(Wordbase.suggestWords(index,'maint','fr'),[{word:'maintenant',level:'A2'}],'each word comes with its level');
  });
  it('knows the order of the levels and what comes after each',()=>{
    assert.deepEqual([...Wordbase.BAND_ORDER],['A1','A2','B1','B2','C1','C2']);
    assert.deepEqual(['A1','A2','B1','B2','C1','C2','X'].map(Wordbase.nextBand),['A2','B1','B2','C1','C2',null,null]);
  });
});

describe('The course of the app',()=>{
  it('downloads the index and the order list first and a chunk only when words are needed',async()=>{
    const {wordbase,state}=makeEnv();
    assert.equal(await wordbase.ready(),'ready');
    assert.deepEqual(state.requested,['./packs/index.json','./packs/fr-tr/order.json'],'no chunk before it is needed');
    const words=await wordbase.next(10);
    assert.equal(words.length,10);
    assert.deepEqual(state.requested.slice(2),['./packs/fr-tr/A1-01.json'],'one chunk for the first ten words');
    assert.deepEqual(words.map(entry=>entry.word),wordsOf('A1').slice(0,10),'in the order of the course');
    for(const entry of words)assert(entry.meaning&&entry.examples.length===2,entry.word);
  });
  it('gives the next words of the level the user chose, skipping what is known, and none when the level is used up',async()=>{
    const b1=wordsOf('B1');
    const {wordbase}=makeEnv({settings:{difficulty:'B1'},known:[b1[0],b1[1]]});
    assert.deepEqual((await wordbase.next(3)).map(entry=>entry.word),b1.slice(2,5));
    const done=makeEnv({settings:{difficulty:'C2'}});
    done.state.known=new Set(wordsOf('C2'));
    done.env.isKnown=word=>done.state.known.has(word);
    const used=Wordbase.create(done.env);
    assert.deepEqual(await used.next(10),[],'nothing left: the page asks about the next level');
    await used.ready();
    assert.equal(used.nextBandOf(),null,'C2 is the last level');
    const first=makeEnv({settings:{difficulty:'A1'}});await first.wordbase.ready();
    assert.equal(first.wordbase.nextBandOf(),'A2');
    const old=makeEnv({settings:{difficulty:'A1-A2'}});await old.wordbase.ready();
    assert.equal(old.wordbase.bandOf(),'A1','a setting saved by an older version (a group of two levels) is read as its first level');
    assert.deepEqual((await old.wordbase.next(3)).map(entry=>entry.word),wordsOf('A1').slice(0,3));
  });
  it('offers only a next level that has words: a course that stops at B2 has no level after B2, and a pair with only a starter pack has none at all',async()=>{
    const short=makeEnv({settings:{difficulty:'B2'}});
    const fetchAll=short.env.fetchJson;
    short.env.fetchJson=async(url,options)=>{
      const data=await fetchAll(url,options);
      return url.endsWith('/order.json')?{...data,chunks:data.chunks.filter(chunk=>!/^C/.test(chunk.level))}:data;
    };
    const course=Wordbase.create(short.env);
    await course.ready();
    assert.equal(course.nextBandOf(),null,'no words are written for C1 or C2');
    assert.equal(course.progress().total>0,true);
    short.state.settings.difficulty='A1';
    assert.equal(course.nextBandOf(),'A2');
    short.state.settings.difficulty='B1';
    assert.equal(course.nextBandOf(),'B2');
    const single=makeEnv({settings:{targetLanguage:'de'}});
    await single.wordbase.ready();
    assert.equal(single.wordbase.nextBandOf(),null);
  });
  it('counts a word of the chosen level once it is in the list, however it got there (search, a synonym tag, the random word)',async()=>{
    const b1=wordsOf('B1'),a1=wordsOf('A1');
    const {wordbase,state}=makeEnv({settings:{difficulty:'A1'},known:[b1[7]]});
    await wordbase.ready();
    assert.deepEqual(wordbase.progress(),{total:a1.length,used:0},'a B1 word does not count while A1 is chosen');
    state.settings.difficulty='B1';
    assert.deepEqual(wordbase.progress(),{total:b1.length,used:1},'it counts as soon as B1 is chosen');
    state.known.add(a1[0]);
    assert.equal(wordbase.progress().used,1,'a word of another level still does not');
    state.settings.difficulty='A1';
    assert.equal(wordbase.progress().used,1);
  });
  it('finds a typed word, with its level, whatever level the user chose; the entry is a copy',async()=>{
    const c2=wordsOf('C2')[0];
    const {wordbase}=makeEnv({settings:{difficulty:'A1'}});
    const found=await wordbase.find(c2);
    assert.equal(found.status,'found');assert.equal(found.entry.word,c2);assert.equal(found.level.startsWith('C'),true);
    assert(found.entry.meaning&&Array.isArray(found.entry.synonyms)&&Array.isArray(found.entry.examples));
    found.entry.meaning='changed';
    assert.notEqual((await wordbase.find(c2)).entry.meaning,'changed','the next answer is not affected');
    const accented=order.chunks.flatMap(chunk=>chunk.words).find(word=>word!==Wordbase.foldText(word,'fr')&&!/[ '-]/.test(word));
    assert.equal((await wordbase.find(Wordbase.foldText(accented,'fr'))).entry.word,accented,'a word typed without its accents is found');
    assert.deepEqual(await wordbase.find('zzzxqj'),{status:'missing',similar:[]});
  });
  it('a random word comes from the chosen level, one the user does not have when there is one',async()=>{
    const a1=wordsOf('A1'),known=a1.slice(0,a1.length-3);
    const {wordbase}=makeEnv({known});
    const left=new Set(a1.slice(-3));
    for(let i=0;i<8;i++){const result=await wordbase.random();assert.equal(result.status,'found');assert(left.has(result.entry.word),`${result.entry.word} is not one of the three words left`);}
    const all=makeEnv({known:a1});
    assert.equal((await all.wordbase.random()).status,'found','when the level is used up a known word is shown rather than nothing');
  });
  it('tells "no words for this pair" from "cannot be reached"; after going offline it tries again',async()=>{
    const none=makeEnv({settings:{nativeLanguage:'en'}});                                       // there is no fr-en
    assert.equal(await none.wordbase.ready(),'none');
    assert.deepEqual(await none.wordbase.find('maison'),{status:'none'});
    assert.deepEqual(await none.wordbase.random(),{status:'none'});
    await assert.rejects(none.wordbase.next(10));
    const offline=makeEnv();offline.state.offline=true;
    assert.equal(await offline.wordbase.ready(),'offline');
    assert.deepEqual(await offline.wordbase.find('maison'),{status:'unavailable'});
    assert.deepEqual(await offline.wordbase.random(),{status:'unavailable'});
    await assert.rejects(offline.wordbase.next(10));
    offline.state.offline=false;
    assert.equal(await offline.wordbase.ready(),'ready','the next request tries again');
    assert.equal((await offline.wordbase.next(2)).length,2);
  });
  it('follows the language pair: another pair is loaded when the settings change; a pair with a single starter pack works the same way',async()=>{
    const {wordbase,state}=makeEnv();
    assert.equal(await wordbase.ready(),'ready');assert.equal(wordbase.hasCourse(),true);
    state.settings.targetLanguage='de';
    assert.equal(await wordbase.ready(),'ready');assert.equal(wordbase.hasCourse(),false,'German has one starter pack, no course');
    const words=await wordbase.next(5);
    assert.equal(words.length,5);
    const found=await wordbase.find(words[0].word);
    assert.equal(found.status,'found');assert.equal(found.entry.word,words[0].word);
    assert.deepEqual(Object.keys(wordbase.progress()),['total','used']);
  });
  it('tells the page when its state changes, and survives a page that throws in that callback',async()=>{
    const {wordbase,state,env}=makeEnv();
    await wordbase.ready();
    assert(state.changes>=2,'loading and ready');
    env.onChange=()=>{throw new Error('page bug');};
    const again=Wordbase.create(env);
    assert.equal(await again.ready(),'ready');
  });
});

describe('Words typed with Turkish letters, and words that look alike',()=>{
  const index=Wordbase.buildIndex(order,'fr');
  const hit=text=>Wordbase.lookupInIndex(index,text,'fr')?.word;
  it('the dotless ı and the dotted İ of a Turkish keyboard are an i, ş is s, ğ is g; hyphens, apostrophes and spaces count the same',()=>{
    assert.equal(Wordbase.foldText('ÎLE ıle İle Île','fr'),'ile ile ile ile');
    assert.equal(Wordbase.foldText('şğüöç','fr'),'sguoc');
    assert.equal(Wordbase.looseKey("S'il-vous-plaît",'fr'),'s il vous plait');
    for(const typed of ['ıle','ILE','île','İle','ile'])assert.equal(hit(typed),'île',typed);
    assert.equal(hit("s'il-vous-plaît"),"s'il vous plaît");assert.equal(hit('s il vous plait'),"s'il vous plaît");
  });
  it('edit distance counts a swap of two neighbouring letters as one edit and gives up beyond the limit',()=>{
    assert.deepEqual([['maison','maison'],['maisson','maison'],['chta','chat'],['abc','xyz'],['abc','abcdef']].map(([a,b])=>Wordbase.editDistance(a,b,2)),[0,1,1,3,3]);
  });
  it('a word that is not there brings the words that look like it: a typo away, the same word with other accents, the beginning of a longer word; nothing for nonsense',()=>{
    const near=text=>Wordbase.similarWords(index,text,'fr',{limit:8});
    assert.equal(near('maisson')[0],'maison');
    assert.equal(near('chta')[0],'chat');
    assert(near('ecol').includes('école')&&near('ecol').includes('écolier'));
    assert.equal(near('sil vous plait')[0],"s'il vous plaît");
    assert.deepEqual(near('zzzxqj'),[]);
    assert(near('maisson').length<=8&&new Set(near('maisson')).size===near('maisson').length);
  });
  it('a word that was found only lists spelling variants of it (ou - où), never itself',()=>{
    const variants=Wordbase.similarWords(index,'ou','fr',{limit:5,found:'ou'});
    assert(variants.includes('où')&&!variants.includes('ou'));
    assert.deepEqual(Wordbase.similarWords(index,'bonjour','fr',{limit:5,found:'bonjour'}).filter(word=>word==='bonjour'),[]);
  });
  it('find hands the similar words along, found or not',async()=>{
    const {wordbase}=makeEnv();
    const found=await wordbase.find('ıle');
    assert.equal(found.status,'found');assert.equal(found.entry.word,'île');assert.equal(Array.isArray(found.similar),true);
    const missing=await wordbase.find('maisson');
    assert.equal(missing.status,'missing');assert.equal(missing.similar[0],'maison');
    assert.deepEqual((await wordbase.find('zzzxqj')),{status:'missing',similar:[]});
  });
});

describe('Levels: how many words of each the user has, and which level a word belongs to',()=>{
  it('counts the words of any level, not only the chosen one, and names the level of a word (the free allowance is per level)',async()=>{
    const [a1,a2,b1,b2,c1,c2]=['A1','A2','B1','B2','C1','C2'].map(wordsOf);
    const {wordbase}=makeEnv({settings:{difficulty:'A1'},known:[...a1.slice(0,3),...a2.slice(0,2),...b1.slice(0,5),b2[0],...c1.slice(0,4),c2[0]]});
    await wordbase.ready();
    assert.deepEqual(['A1','A2','B1','B2','C1','C2'].map(band=>wordbase.progress(band).used),[3,2,5,1,4,1]);
    assert.deepEqual(wordbase.progress(),wordbase.progress('A1'),'no level named: the chosen one');
    assert.equal(wordbase.progress('B1').total,b1.length);
    assert.deepEqual([a1[0],a2[3],b1[10],b2[2],c1[3],c2[4],'zzzxqj'].map(word=>wordbase.bandOfWord(word)),['A1','A2','B1','B2','C1','C2',null]);
    assert.notEqual(wordbase.bandOfWord('île'),null);assert.equal(wordbase.bandOfWord('ıle'),wordbase.bandOfWord('île'),'a word typed with a Turkish ı belongs to the same group as the word');
  });
  it('a pair with only a starter pack has one level (A1); nothing is known before the words are loaded',async()=>{
    const single=makeEnv({settings:{targetLanguage:'de'}});
    assert.equal(single.wordbase.bandOfWord('Hallo'),null);assert.deepEqual(single.wordbase.progress('A1'),{total:0,used:0});
    await single.wordbase.ready();
    const first=single.wordbase.state.pack.words[0].word;
    assert.equal(single.wordbase.bandOfWord(first),'A1');
    assert.equal(single.wordbase.progress('A1').total,single.wordbase.state.pack.words.length);
    assert.deepEqual(single.wordbase.progress('A2'),{total:0,used:0});
    assert.deepEqual(single.wordbase.progress('C2'),{total:0,used:0});
  });
});
