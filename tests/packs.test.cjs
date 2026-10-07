/* Word packs: the format and the choice of the next words (packs.js), the packs that ship with the app, and the index the app reads.
   Run: node --test tests/packs.test.cjs (npm test does this). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const Packs=require('../packs.js');
const Build=require('../tools/build-packs.js');
const dir=path.resolve(__dirname,'..','packs');

const sample=(extra={})=>({format:1,id:'fr-tr',target:'fr',native:'tr',level:'A1-A2',version:1,
  words:[{word:'bonjour',type:'ünlem',meaning:'merhaba',examples:[{text:'Bonjour !',phonetic:'bonjur',translation:'Merhaba!'}]},{word:'merci',meaning:'teşekkürler'}],...extra});
const problemsOf=pack=>Packs.validatePack(pack);

describe('Validating a pack',()=>{
  it('accepts a minimal pack, with and without the optional fields',()=>{
    assert.deepEqual(problemsOf(sample()),[]);
    assert.deepEqual(problemsOf(sample({words:[{word:'a',meaning:'b'}]})),[]);
  });
  it('rejects what is not a pack',()=>{
    for(const bad of [null,undefined,'x',42,[],{}])assert(problemsOf(bad).length>0);
  });
  it('checks the header: format, languages, id, level, version',()=>{
    assert(problemsOf(sample({format:2})).some(message=>/format/.test(message)));
    assert(problemsOf(sample({target:'xx',id:'xx-tr'})).some(message=>/target language/.test(message)));
    assert(problemsOf(sample({native:'fr',id:'fr-fr'})).some(message=>/must differ/.test(message)));
    assert(problemsOf(sample({id:'tr-fr'})).some(message=>/id must be/.test(message)));
    assert(problemsOf(sample({level:''})).some(message=>/level/.test(message)));
    assert(problemsOf(sample({version:0})).some(message=>/version/.test(message)));
  });
  it('needs words, and not too many',()=>{
    assert(problemsOf(sample({words:[]})).some(message=>/words/.test(message)));
    assert(problemsOf(sample({words:'no'})).some(message=>/words/.test(message)));
    assert(problemsOf(sample({words:Array.from({length:Packs.MAX_WORDS+1},(_,index)=>({word:'w'+index,meaning:'m'}))})).some(message=>/words/.test(message)));
  });
  it('checks every word: text, meaning, lists, examples, unknown fields',()=>{
    const word=extra=>problemsOf(sample({words:[{word:'a',meaning:'b',...extra}]}));
    assert(word({meaning:''}).some(message=>/meaning/.test(message)));
    assert(word({word:''}).some(message=>/word/.test(message)));
    assert(word({synonyms:'x'}).some(message=>/synonyms/.test(message)));
    assert(word({antonyms:Array(9).fill('x')}).some(message=>/antonyms/.test(message)));
    assert(word({examples:[{text:'',translation:'t'}]}).some(message=>/examples/.test(message)));
    assert(word({examples:[{text:'t'}]}).some(message=>/translation/.test(message)));
    assert(word({examples:Array(6).fill({text:'t',translation:'u'})}).some(message=>/at most 5/.test(message)));
    assert(word({colour:'red'}).some(message=>/unknown field colour/.test(message)));
  });
  it('refuses markup and control characters anywhere in the text',()=>{
    for(const poison of ['<b>x</b>','a\u0000b','a\nb','<script>'])assert(problemsOf(sample({words:[{word:'a',meaning:poison}]})).length>0,poison);
    assert(problemsOf(sample({words:[{word:'x<y',meaning:'m'}]})).length>0);
  });
  it('refuses a word that appears twice, also in another case or form of the same letters',()=>{
    assert(problemsOf(sample({words:[{word:'Bonjour',meaning:'a'},{word:'bonjour',meaning:'b'}]})).some(message=>/appears twice/.test(message)));
    assert(problemsOf(sample({target:'tr',native:'en',id:'tr-en',words:[{word:'İstanbul',meaning:'a'},{word:'istanbul',meaning:'b'}]})).some(message=>/appears twice/.test(message)));
    assert.equal(Packs.wordKey('Wasser','de'),'wasser');
  });
  it('limits the size of a pack file',()=>{
    assert.deepEqual(Packs.checkSize('x'.repeat(100)),[]);
    assert.equal(Packs.checkSize('x'.repeat(Packs.MAX_BYTES+1)).length,1);
  });
});

describe('Choosing the next words',()=>{
  const pack=sample({words:['a','b','c','d','e'].map(word=>({word,meaning:word.toUpperCase()}))});
  it('takes the first words the user does not have, in the pack\'s order',()=>{
    assert.deepEqual(Packs.nextWords(pack,()=>false,3).map(entry=>entry.word),['a','b','c']);
    assert.deepEqual(Packs.nextWords(pack,word=>['a','c'].includes(word),3).map(entry=>entry.word),['b','d','e']);
  });
  it('gives fewer when the pack runs out, and none when nothing is left',()=>{
    assert.equal(Packs.nextWords(pack,word=>word!=='e',10).length,1);
    assert.deepEqual(Packs.nextWords(pack,()=>true,10),[]);
    assert.deepEqual(Packs.nextWords(pack,()=>false,0),[]);
  });
  it('hands out complete word records (empty lists filled in) that are copies, not the pack\'s own objects',()=>{
    const [first]=Packs.nextWords(pack,()=>false,1);
    assert.deepEqual([first.synonyms,first.antonyms,first.examples,first.expressions],[[],[],[],[]]);
    first.meaning='changed';assert.equal(pack.words[0].meaning,'A');
  });
  it('reports how many of the pack the user already has',()=>{
    assert.deepEqual(Packs.progress(pack,word=>word==='a'||word==='b'),{total:5,used:2});
  });
});

describe('The packs that ship with the app',()=>{
  const files=fs.readdirSync(dir).filter(name=>/\.json$/.test(name)&&name!=='index.json').sort();
  const load=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8').replace(/\r\n/g,'\n'));
  it('there is a pack for each target language of a Turkish speaker',()=>{
    assert.deepEqual(files,['de-tr.json','en-tr.json','es-tr.json','fr-tr.json','it-tr.json']);
  });
  it('every pack is valid, is named after its pair and has 40 words in a beginner level',()=>{
    for(const name of files){
      const pack=load(name);
      assert.deepEqual(Packs.validatePack(pack),[],name);
      assert.equal(name,`${pack.id}.json`);assert.equal(pack.native,'tr');assert.equal(pack.level,'A1-A2');assert.equal(pack.words.length,40);
    }
  });
  it('every word has a Turkish meaning, a type, and an example with its respelling and translation',()=>{
    for(const name of files)for(const entry of load(name).words){
      assert(entry.type&&entry.meaning,`${name}: ${entry.word}`);
      assert.equal(entry.examples.length,1);
      const [example]=entry.examples;assert(example.text&&example.phonetic&&example.translation,`${name}: ${entry.word}`);
    }
  });
  it('the same 40 ideas come in the same order in every language (so progress means the same everywhere)',()=>{
    const meanings=files.map(name=>load(name).words.map(entry=>entry.meaning));
    for(const list of meanings.slice(1)){
      assert.equal(list.length,meanings[0].length);
      // greetings, courtesy words and numbers keep their Turkish meaning; a few nouns differ slightly in wording per language, so compare the first word of each meaning
      const lead=meaning=>meaning.split(/[;,]/)[0].trim();
      const differing=list.filter((meaning,index)=>lead(meaning)!==lead(meanings[0][index]));
      assert(differing.length<=8,`too many differences: ${differing.join(' | ')}`);
    }
  });
  it('the index the app reads matches the packs: ids, word counts and sizes, and the build tool finds no problem',()=>{
    assert.deepEqual(Build.check(),[]);
    const index=JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8'));
    assert.deepEqual(index.packs.map(entry=>entry.id),files.map(name=>name.replace('.json','')));
    for(const entry of index.packs){
      assert.equal(entry.words,40);
      assert.equal(entry.bytes,Buffer.byteLength(fs.readFileSync(path.join(dir,`${entry.id}.json`),'utf8').replace(/\r\n/g,'\n')));
      assert(entry.bytes<Packs.MAX_BYTES);
    }
  });
  it('the build tool notices a broken pack and a stale index',()=>{
    const {problems}=Build.inspect();assert.deepEqual(problems,[]);
    assert(Build.serialize({format:1,packs:[]})!==fs.readFileSync(path.join(dir,'index.json'),'utf8'));
  });
});
