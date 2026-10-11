/* The word database of the courses: the format-2 checks in packs.js, the course checks of tools/build-packs.js and the authoring tool
   tools/wordbase.js (compact form, content rules, building the chunk files). Run: node --test tests/wordbase.test.cjs (npm test does this). */
const {describe,it,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const Packs=require('../packs.js');
const Build=require('../tools/build-packs.js');
const Wordbase=require('../tools/wordbase.js');

// ----- fixtures -----
const compact=(w,extra={})=>({w,t:'isim (eril)',m:w.toUpperCase(),e:[[`Voici le ${w}.`,'vuasi lö kelime','İşte kelime.'],[`Où est le ${w} ?`,'u e lö kelime','Kelime nerede?']],...extra});
const lemmaFile=lemmas=>lemmas.map(([word,level])=>`${word}\tn.m.\t${level}`).join('\n')+'\n';
const jsonl=words=>words.map(raw=>JSON.stringify(raw)).join('\n')+'\n';
function makeRoot(lemmas,batches,{version}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vocvoc-wordbase-'));
  fs.mkdirSync(path.join(root,'wordbase','fr','src'),{recursive:true});fs.mkdirSync(path.join(root,'wordbase','fr-tr','src'),{recursive:true});fs.mkdirSync(path.join(root,'packs'));
  fs.writeFileSync(path.join(root,'wordbase','fr','lemmas.tsv'),lemmaFile(lemmas));
  for(const [name,words] of Object.entries(batches))fs.writeFileSync(path.join(root,'wordbase','fr-tr','src',name),jsonl(words));
  if(version)fs.writeFileSync(path.join(root,'wordbase','fr-tr','course.json'),JSON.stringify({version}));
  return root;
}
const chunkOf=(over={})=>({format:2,id:'fr-tr',chunk:'A1-01',level:'A1',version:1,words:[{word:'bonjour',meaning:'merhaba'},{word:'merci',meaning:'teşekkürler'}],...over});
const orderOf=(over={})=>({format:2,id:'fr-tr',version:1,chunks:[{id:'A1-01',level:'A1',words:['bonjour','merci']},{id:'A1-02',level:'A1',words:['oui']},{id:'A2-01',level:'A2',words:['non']}],...over});

describe('Chunk files (format 2)',()=>{
  it('accepts a chunk, and refuses a bad header',()=>{
    assert.deepEqual(Packs.validateChunk(chunkOf()),[]);
    for(const bad of [null,'x',[],{}])assert(Packs.validateChunk(bad).length>0);
    const has=(over,pattern)=>assert(Packs.validateChunk(chunkOf(over)).some(message=>pattern.test(message)),JSON.stringify(over));
    has({format:1},/format/);has({id:'fr-fr'},/id must be/);has({id:'xx-tr'},/id must be/);has({chunk:'A1'},/chunk must look like/);has({level:'B1'},/level/);has({version:0},/version/);
    has({words:[]},/words/);has({words:Array.from({length:Packs.MAX_CHUNK_WORDS+1},(_,index)=>({word:'w'+index,meaning:'m'}))},/words/);
  });
  it('checks the words like those of a pack, and refuses a word twice',()=>{
    assert(Packs.validateChunk(chunkOf({words:[{word:'a',meaning:''}]})).some(message=>/meaning/.test(message)));
    assert(Packs.validateChunk(chunkOf({words:[{word:'a',meaning:'b',colour:'red'}]})).some(message=>/unknown field/.test(message)));
    assert(Packs.validateChunk(chunkOf({words:[{word:'Bonjour',meaning:'a'},{word:'bonjour',meaning:'b'}]})).some(message=>/appears twice/.test(message)));
    assert(Packs.validateChunk(chunkOf({words:[{word:'a',meaning:'<b>x</b>'}]})).length>0,'markup is refused');
  });
  it('limits the size of a chunk file',()=>{
    assert.deepEqual(Packs.checkChunkSize('x'.repeat(100)),[]);
    assert.equal(Packs.checkChunkSize('x'.repeat(Packs.MAX_CHUNK_BYTES+1)).length,1);
  });
});

describe('order.json',()=>{
  const problems=order=>Packs.validateOrder(order);
  it('accepts a course that runs from A1 up, numbered within each level',()=>{assert.deepEqual(problems(orderOf()),[]);});
  it('refuses what is not an order, a bad header and no chunks',()=>{
    for(const bad of [null,'x',[],{}])assert(problems(bad).length>0);
    assert(problems(orderOf({format:1})).some(message=>/format/.test(message)));
    assert(problems(orderOf({id:'tr-tr'})).some(message=>/id must be/.test(message)));
    assert(problems(orderOf({version:0})).some(message=>/version/.test(message)));
    assert(problems(orderOf({chunks:[]})).some(message=>/chunks/.test(message)));
  });
  it('refuses chunks that are out of order, wrongly numbered or named for another level',()=>{
    assert(problems(orderOf({chunks:[{id:'A2-01',level:'A2',words:['a']},{id:'A1-01',level:'A1',words:['b']}]})).some(message=>/higher level/.test(message)));
    assert(problems(orderOf({chunks:[{id:'A1-01',level:'A1',words:['a']},{id:'A1-03',level:'A1',words:['b']}]})).some(message=>/should be A1-02/.test(message)));
    assert(problems(orderOf({chunks:[{id:'A2-02',level:'A2',words:['a']}]})).some(message=>/should be A2-01/.test(message)));
    assert(problems(orderOf({chunks:[{id:'A1-01',level:'B1',words:['a']}]})).some(message=>/level must be A1/.test(message)));
    assert(problems(orderOf({chunks:[{id:'x',level:'A1',words:['a']}]})).some(message=>/must look like/.test(message)));
  });
  it('refuses a headword that appears twice in the course, in any case',()=>{
    assert(problems(orderOf({chunks:[{id:'A1-01',level:'A1',words:['Bonjour']},{id:'A1-02',level:'A1',words:['bonjour']}]})).some(message=>/already in A1-01/.test(message)));
  });
  it('refuses an empty chunk and headwords that are not text',()=>{
    assert(problems(orderOf({chunks:[{id:'A1-01',level:'A1',words:[]}]})).some(message=>/headwords/.test(message)));
    assert(problems(orderOf({chunks:[{id:'A1-01',level:'A1',words:[1]}]})).some(message=>/headwords/.test(message)));
  });
});

describe('Choosing the next words of a course',()=>{
  const order={format:2,id:'fr-tr',version:1,chunks:[
    {id:'A1-01',level:'A1',words:['a','b','c']},{id:'A2-01',level:'A2',words:['d','e']},{id:'B1-01',level:'B1',words:['f','g']},{id:'B2-01',level:'B2',words:['h']},{id:'C1-01',level:'C1',words:['i']}]};
  const known=(...words)=>word=>words.includes(word);
  it('counts the words of a band and the ones the user has',()=>{
    assert.deepEqual(Packs.courseProgress(order,'A1-A2',known('a','e')),{total:5,used:2});
    assert.deepEqual(Packs.courseProgress(order,'B1-B2',known()),{total:3,used:0});
    assert.deepEqual(Packs.courseProgress(order,'C1-C2',known('i')),{total:1,used:1});
    assert.deepEqual(Packs.courseProgress(order,'nothing',known()),{total:0,used:0});
  });
  it('names the chunks that hold the next unknown words, in order, and none that are used up',()=>{
    assert.deepEqual(Packs.pickChunks(order,'A1-A2',known(),2),['A1-01']);
    assert.deepEqual(Packs.pickChunks(order,'A1-A2',known(),4),['A1-01','A2-01']);
    assert.deepEqual(Packs.pickChunks(order,'A1-A2',known('a','b','c'),2),['A2-01']);
    assert.deepEqual(Packs.pickChunks(order,'A1-A2',known('a','b','c','d','e'),10),[]);
    assert.deepEqual(Packs.pickChunks(order,'B1-B2',known(),99),['B1-01','B2-01']);
    assert.deepEqual(Packs.pickChunks(order,'A1-A2',known(),0),[]);
  });
  it('takes the words out of the downloaded chunks across a chunk boundary, as complete records',()=>{
    const chunks=[chunkOf({words:[{word:'a',meaning:'A'},{word:'b',meaning:'B'}]}),chunkOf({chunk:'A1-02',words:[{word:'c',meaning:'C'},{word:'d',meaning:'D'}]})];
    assert.deepEqual(Packs.nextFromChunks(chunks,known('a'),3).map(entry=>entry.word),['b','c','d']);
    assert.deepEqual(Packs.nextFromChunks(chunks,known(),1).map(entry=>entry.word),['a']);
    assert.deepEqual(Packs.nextFromChunks(chunks,known('a','b','c','d'),5),[]);
    const [first]=Packs.nextFromChunks(chunks,known(),1);
    assert.deepEqual([first.synonyms,first.antonyms,first.examples,first.expressions],[[],[],[],[]]);
    first.meaning='changed';assert.equal(chunks[0].words[0].meaning,'A');
  });
});

describe('The compact form and its content rules',()=>{
  const lint=(raw,options)=>Wordbase.lintWord(raw,options);
  it('opens a compact word into the record the app stores, writing only filled lists',()=>{
    const full=Wordbase.expand(compact('merci',{s:['remerciement'],a:[],x:[['non, merci','non, mersi','hayır, teşekkürler','Un dessert ? Non, merci.','en deser? non, mersi','Tatlı? Hayır, teşekkürler.']]}));
    assert.deepEqual(Object.keys(full),['word','type','meaning','synonyms','examples','expressions']);
    assert.deepEqual(full.examples[0],{text:'Voici le merci.',phonetic:'vuasi lö kelime',translation:'İşte kelime.'});
    assert.deepEqual(Object.keys(full.expressions[0]),['text','phonetic','translation','exampleText','examplePhonetic','exampleTranslation']);
    assert.deepEqual(Packs.validateChunk(chunkOf({words:[full]})),[],'what the tool writes passes the check the app makes');
  });
  it('accepts a complete word without warnings',()=>{assert.deepEqual(lint(compact('livre')),{errors:[],warnings:[]});});
  it('wants exactly two different examples, each with a respelling and a translation',()=>{
    assert(lint(compact('a',{e:[compact('a').e[0]]})).errors.some(message=>/exactly two/.test(message)));
    assert(lint(compact('a',{e:[compact('a').e[0],compact('a').e[0]]})).errors.some(message=>/the same/.test(message)));
    assert(lint(compact('a',{e:[['x','','y'],compact('a').e[1]]})).errors.some(message=>/respelling is missing|\[sentence/.test(message)));
    assert(lint(compact('a',{e:[['x','ab','y','z'],compact('a').e[1]]})).errors.some(message=>/\[sentence, respelling, translation\]/.test(message)));
  });
  it('wants the respelling in Turkish letters: no IPA, no q, w or x',()=>{
    const withRespelling=text=>lint(compact('a',{e:[['Voici a.',text,'İşte a.'],compact('a').e[1]]})).errors;
    assert.deepEqual(withRespelling('bonjur, madam'),[]);
    assert.deepEqual(withRespelling('şö, ğ, ı, ü, â'),[]);
    for(const bad of ['bɔ̃ʒuʁ','quand','wagon','taxi','bon<b>'])assert(withRespelling(bad).some(message=>/Turkish letters/.test(message)),bad);
    assert.deepEqual(lint(compact('a',{e:[['Voici a.','bɔ̃','İşte a.'],compact('a').e[1]]}),{native:'en'}).errors,[],'only a Turkish respelling is checked for its alphabet');
  });
  it('checks phrases: at most two, each with its sentence, respelling and translations',()=>{
    const phrase=['non, merci','non, mersi','hayır, teşekkürler','Un dessert ? Non, merci.','en deser? non, mersi','Tatlı? Hayır, teşekkürler.'];
    assert.deepEqual(lint(compact('merci',{x:[phrase,phrase]})).errors,[]);
    assert(lint(compact('merci',{x:[phrase,phrase,phrase]})).errors.some(message=>/at most two/.test(message)));
    assert(lint(compact('merci',{x:[phrase.slice(0,5)]})).errors.some(message=>/\[phrase/.test(message)));
    assert(lint(compact('merci',{x:[[...phrase.slice(0,4),'wagon',phrase[5]]]})).errors.some(message=>/Turkish letters/.test(message)));
  });
  it('checks synonyms and antonyms: at most four, never the word itself, never twice',()=>{
    assert.deepEqual(lint(compact('grand',{s:['énorme','vaste'],a:['petit']})).errors,[]);
    assert(lint(compact('grand',{s:['a','b','c','d','e']})).errors.some(message=>/at most four/.test(message)));
    assert(lint(compact('grand',{s:['Grand']})).errors.some(message=>/the word itself/.test(message)));
    assert(lint(compact('grand',{s:['énorme'],a:['enorme']})).errors.some(message=>/twice/.test(message)));
  });
  it('rejects unknown keys and missing basics',()=>{
    assert(lint(compact('a',{colour:'red'})).errors.some(message=>/unknown key/.test(message)));
    assert(lint({w:'a',t:'fiil'}).errors.some(message=>/m is missing/.test(message)));
    assert(lint(null).errors.length>0);
  });
  it('only warns about the kind label, long meanings and a sentence that does not use the word',()=>{
    assert(lint(compact('a',{t:'noun'})).warnings.some(message=>/type "noun"/.test(message)));
    for(const good of ['fiil','sıfat/zarf','isim (eril/dişil)','kalıp'])assert(Wordbase.TYPE_PATTERN.test(good),good);
    for(const bad of ['noun','isim','isim (neutral)','fiil/'])assert(!Wordbase.TYPE_PATTERN.test(bad),bad);
    assert(lint(compact('a',{m:'x'.repeat(81)})).warnings.some(message=>/meaning is long/.test(message)));
    assert(lint(compact('chat',{e:[['Il dort.','il dor','Uyuyor.'],compact('chat').e[1]]})).warnings.some(message=>/does not seem to use/.test(message)));
  });
  it('knows an inflected word in a sentence (verb stems, plural, feminine)',()=>{
    for(const [sentence,word] of [['Nous mangeons du pain.','manger'],['Elles sont grandes.','grand'],['Les enfants jouent.','enfant'],['Il allait au marché.','aller'],["S'il vous plaît, madame.","s'il vous plaît"],['Vous avez raison.','avoir'],
      ["J'ai vingt ans.",'an'],['Je viens de manger.','venir'],['Il nettoie la voiture.','nettoyer'],['Mon père a un nouvel ordinateur.','nouveau'],['Les chevaux courent vite.','cheval'],['Elle a de grands yeux.','œil'],['Je vais au lit.','aller'],['Je ne peux pas.','pouvoir']])
      assert(Wordbase.usesWord(sentence,word),`${sentence} / ${word}`);
    assert(!Wordbase.usesWord('Il dort.','chat'));
  });
});

describe('Building a course from its sources',()=>{
  let root;
  const lemmas=[['bonjour','A1'],['merci','A1'],['oui','A1'],['lire','A2'],['aimer','A2']];
  beforeEach(()=>{root=null;});
  afterEach(()=>{if(root)fs.rmSync(root,{recursive:true,force:true});});

  it('balances the chunks of a level instead of leaving a small tail',()=>{
    assert.deepEqual(Wordbase.chunkSizes(600),[300,300]);assert.deepEqual(Wordbase.chunkSizes(500),[500]);assert.deepEqual(Wordbase.chunkSizes(501),[251,250]);
    assert.deepEqual(Wordbase.chunkSizes(1500),[500,500,500]);assert.deepEqual(Wordbase.chunkSizes(1),[1]);
  });
  it('checks the sources against the lemma list, in order, and names the first difference',()=>{
    root=makeRoot(lemmas,{'A1-001.jsonl':[compact('bonjour'),compact('oui')]});
    const result=Wordbase.checkCourse(root,'fr-tr');
    assert(result.errors.some(message=>/expected "merci".*found "oui"/.test(message)),result.errors.join('\n'));
  });
  it('wants the file of a level to hold the words of that level, a file name of the right form, and no word beyond the list',()=>{
    root=makeRoot(lemmas,{'A1-001.jsonl':[compact('bonjour'),compact('merci'),compact('oui'),compact('lire')],'notes.jsonl':[]});
    const errors=Wordbase.checkCourse(root,'fr-tr').errors.join('\n');
    assert(/"lire" is A2 but the file is A1/.test(errors),errors);
    const tooMany=makeRoot([['bonjour','A1']],{'A1-001.jsonl':[compact('bonjour'),compact('merci')]});
    try{assert(Wordbase.checkCourse(tooMany,'fr-tr').errors.some(message=>/more words than the lemma list/.test(message)));}finally{fs.rmSync(tooMany,{recursive:true,force:true});}
  });
  it('says what is wrong with the lemma list itself',()=>{
    root=makeRoot([['bonjour','A1'],['merci','B1'],['oui','A1'],['bonjour','C1']],{});
    const errors=Wordbase.checkCourse(root,'fr-tr').errors.join('\n');
    assert(/levels must not go back/.test(errors)&&/"bonjour" appears twice/.test(errors),errors);
  });
  it('reports a broken line and a missing lemma list instead of crashing',()=>{
    root=makeRoot(lemmas,{'A1-001.jsonl':[compact('bonjour')]});
    fs.appendFileSync(path.join(root,'wordbase','fr-tr','src','A1-001.jsonl'),'{ not json\n');
    assert(Wordbase.checkCourse(root,'fr-tr').errors.some(message=>/not valid JSON/.test(message)));
    fs.rmSync(path.join(root,'wordbase','fr','lemmas.tsv'));
    assert(Wordbase.checkCourse(root,'fr-tr').errors.some(message=>/lemmas\.tsv is missing/.test(message)));
    assert(Wordbase.checkCourse(root,'fr-fr').errors.some(message=>/named <target>-<native>/.test(message)));
  });
  it('builds chunk files and order.json that the app-side checks accept, and refreshes the index',()=>{
    root=makeRoot(lemmas,{'A1-001.jsonl':[compact('bonjour'),compact('merci'),compact('oui')],'A2-001.jsonl':[compact('lire'),compact('aimer')]},{version:3});
    const result=Wordbase.buildCourse(root,'fr-tr');
    assert.deepEqual(result.errors,[]);assert.equal(result.written,3);
    const dir=path.join(root,'packs','fr-tr');
    assert.deepEqual(fs.readdirSync(dir).sort(),['A1-01.json','A2-01.json','order.json']);
    const order=JSON.parse(fs.readFileSync(path.join(dir,'order.json'),'utf8'));
    assert.deepEqual(order,{format:2,id:'fr-tr',version:3,chunks:[{id:'A1-01',level:'A1',words:['bonjour','merci','oui']},{id:'A2-01',level:'A2',words:['lire','aimer']}]});
    assert.deepEqual(Packs.validateOrder(order),[]);
    const chunk=JSON.parse(fs.readFileSync(path.join(dir,'A1-01.json'),'utf8'));
    assert.deepEqual([chunk.chunk,chunk.level,chunk.version,chunk.words.length],['A1-01','A1',3,3]);assert.deepEqual(Packs.validateChunk(chunk),[]);
    const index=JSON.parse(fs.readFileSync(path.join(root,'packs','index.json'),'utf8'));
    assert.equal(index.format,2);assert.deepEqual(index.packs,[]);
    assert.deepEqual(index.courses,[{id:'fr-tr',target:'fr',native:'tr',version:3,words:5,levels:{A1:3,A2:2},orderBytes:Buffer.byteLength(fs.readFileSync(path.join(dir,'order.json'),'utf8')),
      chunks:[{id:'A1-01',level:'A1',words:3,bytes:Buffer.byteLength(fs.readFileSync(path.join(dir,'A1-01.json'),'utf8'))},{id:'A2-01',level:'A2',words:2,bytes:Buffer.byteLength(fs.readFileSync(path.join(dir,'A2-01.json'),'utf8'))}]}]);
    assert.deepEqual(Build.check(path.join(root,'packs')),[],'the index is current');
  });
  it('builds a level that is only half written, and builds it again when more arrives; a chunk that no longer exists is removed',()=>{
    root=makeRoot(lemmas,{'A1-001.jsonl':[compact('bonjour'),compact('merci')]});
    assert.deepEqual(Wordbase.buildCourse(root,'fr-tr').errors,[]);
    const dir=path.join(root,'packs','fr-tr');fs.writeFileSync(path.join(dir,'A9-01.json'),'{}');
    fs.writeFileSync(path.join(root,'wordbase','fr-tr','src','A1-002.jsonl'),jsonl([compact('oui')]));
    assert.deepEqual(Wordbase.buildCourse(root,'fr-tr').errors,[]);
    assert.deepEqual(fs.readdirSync(dir).sort(),['A1-01.json','order.json']);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'order.json'),'utf8')).chunks[0].words,['bonjour','merci','oui']);
  });
  it('writes nothing when the sources have an error, and says so when there are no words',()=>{
    root=makeRoot(lemmas,{'A1-001.jsonl':[compact('bonjour',{e:[]})]});
    const result=Wordbase.buildCourse(root,'fr-tr');
    assert(result.errors.length>0);assert.equal(fs.existsSync(path.join(root,'packs','fr-tr')),false);
    fs.rmSync(path.join(root,'wordbase','fr-tr','src','A1-001.jsonl'));
    assert(Wordbase.buildCourse(root,'fr-tr').errors.some(message=>/no words yet/.test(message)));
  });
  it('makes a readable sample to proofread: words spread evenly over the written ones, with their respellings and phrases',()=>{
    root=makeRoot([['bonjour','A1'],['merci','A1'],['oui','A1'],['lire','A2']],{'A1-001.jsonl':[compact('bonjour',{a:['au revoir'],x:[['dire bonjour','dir bonjur','merhaba demek','Il dit bonjour.','il di bonjur','Merhaba der.']]}),compact('merci'),compact('oui')]});
    const text=Wordbase.sampleOf(root,'fr-tr',{level:'A1',count:2});
    assert(text.startsWith('# fr-tr: 2 words to proofread (A1, spread evenly over 3 written words)'));
    assert(/## 1\. bonjour \(isim \(eril\)\) \[A1\]/.test(text)&&/## 2\. merci/.test(text)&&!/oui/.test(text.split('## 2.')[1].split('## 3.')[0].replace('Où','')) ,'two of three, evenly spaced: the first and the second');
    assert(text.includes('Zıt anlamlı: au revoir')&&text.includes('Kalıp: **dire bonjour**')&&text.includes('okunuş: *vuasi lö kelime*'));
    assert.equal(Wordbase.sampleOf(root,'fr-tr',{level:'B1',count:5}).split('\n')[0],'# fr-tr: 0 words to proofread (B1, spread evenly over 0 written words)');
  });
  it('reports each level: words planned and written, how many have synonyms, antonyms and phrases, the size',()=>{
    root=makeRoot(lemmas,{'A1-001.jsonl':[compact('bonjour',{s:['salut']}),compact('merci'),compact('oui',{a:['non']})]});
    const {rows}=Wordbase.statsOf(root,'fr-tr');
    assert.deepEqual(rows.map(row=>[row.level,row.planned,row.written,row.synonyms,row.antonyms,row.phrases]),[['A1',3,3,'33%','33%','0%'],['A2',2,0,'-','-','-']]);
    assert(rows[0].bytesPerWord>100);
  });
});

describe('Checking a course folder in packs/',()=>{
  let root;
  const lemmas=[['bonjour','A1'],['merci','A1'],['lire','A2']];
  const built=()=>{root=makeRoot(lemmas,{'A1-001.jsonl':[compact('bonjour'),compact('merci')],'A2-001.jsonl':[compact('lire')]});Wordbase.buildCourse(root,'fr-tr');return path.join(root,'packs');};
  afterEach(()=>{if(root)fs.rmSync(root,{recursive:true,force:true});root=null;});
  const edit=(dir,name,change)=>{const file=path.join(dir,'fr-tr',name),value=JSON.parse(fs.readFileSync(file,'utf8'));change(value);fs.writeFileSync(file,JSON.stringify(value));};
  it('finds no problem in a fresh build',()=>{assert.deepEqual(Build.inspect(built()).problems,[]);});
  it('notices a missing chunk, an unlisted file and a missing order.json',()=>{
    let dir=built();fs.rmSync(path.join(dir,'fr-tr','A2-01.json'));
    assert(Build.inspect(dir).problems.some(message=>/A2-01\.json: is listed in order\.json but missing/.test(message)));
    fs.writeFileSync(path.join(dir,'fr-tr','B1-01.json'),'{}');
    assert(Build.inspect(dir).problems.some(message=>/B1-01\.json: is not listed/.test(message)));
    fs.rmSync(path.join(dir,'fr-tr','order.json'));
    assert(Build.inspect(dir).problems.some(message=>/order\.json is missing/.test(message)));
  });
  it('notices a chunk that differs from order.json: other words, another version, a wrong name',()=>{
    let dir=built();edit(dir,'A1-01.json',chunk=>{chunk.words[0].word='salut';});
    assert(Build.inspect(dir).problems.some(message=>/its words differ from order\.json/.test(message)));
    fs.rmSync(root,{recursive:true,force:true});dir=built();edit(dir,'A1-01.json',chunk=>{chunk.version=9;});
    assert(Build.inspect(dir).problems.some(message=>/version must be 1/.test(message)));
    fs.rmSync(root,{recursive:true,force:true});dir=built();edit(dir,'A1-01.json',chunk=>{chunk.chunk='A1-02';});
    assert(Build.inspect(dir).problems.some(message=>/chunk must be A1-01/.test(message)));
  });
  it('notices a broken chunk, a broken order.json and a folder that is not a pair',()=>{
    let dir=built();edit(dir,'A1-01.json',chunk=>{chunk.words[1].meaning='';});
    assert(Build.inspect(dir).problems.some(message=>/A1-01\.json: .*meaning/.test(message)));
    fs.writeFileSync(path.join(dir,'fr-tr','order.json'),'{ nope');
    assert(Build.inspect(dir).problems.some(message=>/order\.json: not valid JSON/.test(message)));
    fs.writeFileSync(path.join(dir,'fr-tr','order.json'),'null');
    assert(Build.inspect(dir).problems.some(message=>/order\.json: not an object/.test(message)));
    fs.mkdirSync(path.join(dir,'french'));
    assert(Build.inspect(dir).problems.some(message=>/french\/: a course folder is named/.test(message)));
  });
  it('notices an index that is out of date, also for the courses',()=>{
    const dir=built();assert.deepEqual(Build.check(dir),[]);
    edit(dir,'A1-01.json',chunk=>{chunk.words[0].meaning='başka';});                  // the size changes
    assert(Build.check(dir).some(message=>/out of date/.test(message)));
  });
  it('refuses a pack and a course with the same id',()=>{
    const dir=built();
    fs.writeFileSync(path.join(dir,'fr-tr.json'),JSON.stringify({format:1,id:'fr-tr',target:'fr',native:'tr',level:'A1-A2',version:1,words:[{word:'a',meaning:'b'}]}));
    assert(Build.inspect(dir).problems.some(message=>/same id/.test(message)));
  });
});

describe('The courses that ship with the app',()=>{
  it('packs/ is consistent: every pack and course is valid and the index is current',()=>{assert.deepEqual(Build.check(),[]);});
  it('the sources in wordbase/ are valid and build to exactly the shipped files',()=>{
    const root=path.resolve(__dirname,'..'),dir=path.join(root,'wordbase');
    const pairs=fs.existsSync(dir)?fs.readdirSync(dir).filter(name=>Packs.pairOf(name)):[];
    for(const pair of pairs){
      const result=Wordbase.checkCourse(root,pair);
      assert.deepEqual(result.errors,[],pair);
      if(!result.entries.length)continue;
      // A course that is written but not built yet (the app does not use it) has no folder in packs/ and is not in the index; a built one must match its sources exactly.
      if(!fs.existsSync(path.join(root,'packs',pair))){
        assert(!JSON.parse(fs.readFileSync(path.join(root,'packs','index.json'),'utf8')).courses.some(course=>course.id===pair),`${pair} is in the index but has no folder`);
        continue;
      }
      const courseFile=path.join(dir,pair,'course.json'),version=fs.existsSync(courseFile)?JSON.parse(fs.readFileSync(courseFile,'utf8')).version:1;
      const files=Wordbase.planCourse(pair,version,result.entries);
      for(const file of files)assert.equal(fs.readFileSync(path.join(root,'packs',pair,file.name),'utf8').replace(/\r\n/g,'\n'),file.text,`${pair}/${file.name} is not what the sources build (run: node tools/wordbase.js build)`);
      assert.deepEqual(fs.readdirSync(path.join(root,'packs',pair)).sort(),files.map(file=>file.name).sort());
    }
  });
});
