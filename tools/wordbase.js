/* The word database of the courses: the sources are written in wordbase/, the files the app downloads are built into packs/.
     node tools/wordbase.js check [pair]     check the sources (structure, content rules, the lemma list); exit 1 on an error
     node tools/wordbase.js build [pair]     write packs/<pair>/ (chunk files and order.json) and refresh packs/index.json
     node tools/wordbase.js stats [pair]     words, coverage and size per level
   Layout (see wordbase/README.md and wordbase/STYLE.md):
     wordbase/<target>/lemmas.tsv      headword TAB part of speech TAB level: the course in the order it is learned, one word a line
     wordbase/<pair>/course.json       {"version": N}: raised when released content changes, so devices download it again
     wordbase/<pair>/src/<LEVEL>-<nnn>.jsonl   the words in lemma order, one JSON object a line, in the compact form below
   The compact form saves keys:  {"w":word,"t":type,"m":meaning,"s":[synonyms],"a":[antonyms],"e":[[sentence,respelling,translation] x2],
   "x":[[phrase,respelling,meaning,sentence,sentence respelling,sentence translation] x0-2]}. */
'use strict';
const fs=require('fs'),path=require('path');
const Packs=require('../packs.js');
const Build=require('./build-packs.js');
const repoRoot=path.resolve(__dirname,'..');

const KEYS=new Set(['w','t','m','s','a','e','x']);
// The labels of a word's kind, in Turkish (a word of several kinds joins them with "/", e.g. "sıfat/zarf").
const TYPE_LABEL='(?:isim \\((?:eril|dişil|eril\\/dişil)\\)|fiil|sıfat|zarf|edat|bağlaç|zamir|belirleyici|ünlem|sayı|kalıp)';
const TYPE_PATTERN=new RegExp(`^${TYPE_LABEL}(?:/${TYPE_LABEL})*$`);
// A respelling is written with Turkish letters (and â î û) and ordinary punctuation: no IPA, no q, w, x.
const RESPELLING=/^[a-zA-ZçğıöşüÇĞİÖŞÜâîûÂÎÛ0-9 ,.;:!?'’\-–—()…/"«»]+$/;
const FORBIDDEN_LETTER=/[qwxQWX]/;
const BATCH_FILE=/^(A1|A2|B1|B2|C1|C2)-(\d{3})\.jsonl$/;

const lf=text=>text.replace(/\r\n/g,'\n');
const plain=text=>String(text).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const isLine=value=>typeof value==='string'&&value.trim().length>0;
const wordsOfText=text=>plain(text).split(/[^a-z0-9]+/).filter(Boolean);

// compact -> the record the app stores (only filled lists are written)
function expand(raw){
  const out={word:raw.w,type:raw.t,meaning:raw.m};
  if(raw.s&&raw.s.length)out.synonyms=raw.s;
  if(raw.a&&raw.a.length)out.antonyms=raw.a;
  out.examples=(raw.e||[]).map(([text,phonetic,translation])=>({text,phonetic,translation}));
  if(raw.x&&raw.x.length)out.expressions=raw.x.map(([text,phonetic,translation,exampleText,examplePhonetic,exampleTranslation])=>({text,phonetic,translation,exampleText,examplePhonetic,exampleTranslation}));
  return out;
}

// Does the sentence use the word? Inflected forms count: a verb is looked for by its stem, any word by its first letters.
// The forms of verbs whose stem changes: a stem rule cannot find them. (Accents are ignored, like everywhere in the check.)
const IRREGULAR_FORMS={
  'œil':'yeux oeil œil',
  nouveau:'nouvel nouvelle nouveaux nouvelles',
  vieux:'vieil vieille vieilles',
  beau:'bel belle beaux belles',
  blanc:'blanche blanches blancs',
  long:'longue longues longs',
  doux:'douce douces',
  faux:'fausse fausses',
  frais:'fraiche fraiches',
  gros:'grosse grosses',
  heureux:'heureuse heureuses',
  fou:'folle folles fous',
  cheveu:'cheveux',
  cheval:'chevaux',
  animal:'animaux',
  journal:'journaux',
  travail:'travaux',
  jeu:'jeux',
  neveu:'neveux',
  oeuf:'oeufs œufs œuf',
  'œuf':'oeuf oeufs œufs',
  ciel:'cieux',
  monsieur:'messieurs',
  madame:'mesdames',
  mademoiselle:'mesdemoiselles',
  etre:'suis es est sommes etes sont etais etait etions etiez etaient ete serai sera seras serons serez seront serais serait soit soient sois soyez etant fut furent',
  avoir:'ai as a avons avez ont avais avait avions aviez avaient eu aura aurai auras aurons aurez auront aurais aurait ait aie ayez ayant',
  aller:'vais vas va allons allez vont allais allait allions alliez allaient irai ira iras irons irez iront irais irait aille ailles',
  faire:'fais fait faisons faites font faisais faisait faisions faisaient ferai fera feras ferons ferez feront ferais ferait fasse fassent faisant',
  vouloir:'veux veut voulons voulez veulent voulais voulait voulaient voulu voudrai voudra voudras voudrais voudrait voudriez veuille veuillez',
  pouvoir:'peux peut pouvons pouvez peuvent pouvais pouvait pouvaient pu pourrai pourra pourras pourrais pourrait pourriez puisse',
  devoir:'dois doit devons devez doivent devais devait devaient du devra devrai devras devrais devrait devriez doive',
  savoir:'sais sait savons savez savent savais savait savaient su saurai saura saurais saurait sache sachez',
  voir:'vois voit voyons voyez voient voyais voyait vu verrai verra verras verrais verrait voie',
  venir:'viens vient venons venez viennent venais venait venu viendrai viendra viendras viendrais viendrait vienne',
  prendre:'prends prend prenons prenez prennent prenais prenait pris prendrai prendra prendras prendrais prendrait prenne',
  dire:'dis dit disons dites disent disais disait dirai dira diras dirais dirait dise',
  mettre:'mets met mettons mettez mettent mettais mettait mis mettrai mettra mettrais mette',
  connaitre:'connais connait connaissons connaissez connaissent connaissais connaissait connu connaitrai',
  croire:'crois croit croyons croyez croient croyais croyait cru croirai croirais',
  partir:'pars part partons partez partent partais partait parti partirai partira',
  sortir:'sors sort sortons sortez sortent sortais sortait sorti sortirai sortira',
  dormir:'dors dort dormons dormez dorment dormais dormait dormi',
  ecrire:'ecris ecrit ecrivons ecrivez ecrivent ecrivais ecrivait ecrirai',
  lire:'lis lit lisons lisez lisent lisais lisait lu lirai',
  boire:'bois boit buvons buvez boivent buvais buvait bu boirai',
  ouvrir:'ouvre ouvres ouvrons ouvrez ouvrent ouvrais ouvrait ouvert ouvrirai',
  courir:'cours court courons courez courent courais courait couru courrai',
  vivre:'vis vit vivons vivez vivent vivais vivait vecu vivrai',
  suivre:'suis suit suivons suivez suivent suivais suivait suivi suivrai',
  mourir:'meurs meurt mourons mourez meurent mourais mourait mort mourrai',
  naitre:'nais nait naissons naissez naissent naissait ne nee nes nees',
  recevoir:'recois recoit recevons recevez recoivent recevais recevait recu recevrai',
  tenir:'tiens tient tenons tenez tiennent tenais tenait tenu tiendrai',
  offrir:'offre offres offrons offrez offrent offrais offrait offert',
  conduire:'conduis conduit conduisons conduisez conduisent conduisais conduisait',
  rire:'ris rit rions riez rient riais riait ri',
  plaire:'plais plait plaisons plaisez plaisent plaisait plu',
  falloir:'faut fallait fallu faudra faudrait',
  asseoir:'assieds assied assois assoit asseyons asseyez assis assise',
  envoyer:'envoie envoies envoient envoyons envoyez envoyais envoyait enverrai enverra',
  payer:'paie paies paient paye payes payent payons payez payais payait',
  acheter:'achete achetes achetent achetons achetez achetais achetait achetai',
  appeler:'appelle appelles appellent appelons appelez appelais appelait appellerai',
  comprendre:'comprends comprend comprenons comprenez comprennent comprenais comprenait compris comprendrai',
  apprendre:'apprends apprend apprenons apprenez apprennent apprenais apprenait appris apprendrai',
  attendre:'attends attend attendons attendez attendent attendais attendait attendu attendrai',
  repondre:'reponds repond repondons repondez repondent repondais repondait repondu repondrai',
  vendre:'vends vend vendons vendez vendent vendais vendait vendu vendrai',
  perdre:'perds perd perdons perdez perdent perdais perdait perdu perdrai',
  descendre:'descends descend descendons descendez descendent descendais descendait descendu',
  entendre:'entends entend entendons entendez entendent entendais entendait entendu',
  devenir:'deviens devient devenons devenez deviennent devenait devenu deviendra',
  revenir:'reviens revient revenons revenez reviennent revenait revenu reviendra',
  apercevoir:'apercois apercoit apercevons apercu',
  se_souvenir:'souviens souvient souvenons souvenez souviennent souvenu',
  finir:'finis finit finissons finissez finissent finissais finissait fini finirai',
  choisir:'choisis choisit choisissons choisissez choisissent choisi',
  reussir:'reussis reussit reussissons reussissent reussi',
};
const irregularStem=word=>{
  const plainWord=plain(word).replace(/^(se|s) /,'').replace(/^s'/,'');
  return IRREGULAR_FORMS[plainWord]?IRREGULAR_FORMS[plainWord].split(' '):null;
};
function usesWord(sentence,word){
  const tokens=wordsOfText(sentence);
  const forms=irregularStem(word);
  if(forms&&tokens.some(token=>forms.includes(token)||token===plain(word)))return true;
  return wordsOfText(word).some(part=>{
    if(part.length<=2)return tokens.includes(part)||tokens.includes(part+'s');
    const stem=part.replace(/(er|ir|re|oir)$/,'');
    const size=Math.max(3,Math.min(stem.length,part.length-1));
    if(/yer$/.test(part)&&tokens.some(token=>token.startsWith(stem.slice(0,-1)+'i')))return true;     // nettoyer: nettoie, nettoient
    return tokens.some(token=>token.startsWith(stem.slice(0,size)));
  });
}

// {errors:[], warnings:[]} for one compact word
function lintWord(raw,{native='tr'}={}){
  const errors=[],warnings=[];
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {errors:['not an object'],warnings};
  for(const key of Object.keys(raw))if(!KEYS.has(key))errors.push(`unknown key ${key}`);
  for(const key of ['w','t','m'])if(!isLine(raw[key]))errors.push(`${key} is missing`);
  if(errors.length)return {errors,warnings};
  const respelling=(text,where)=>{
    if(!isLine(text)){errors.push(`${where}: respelling is missing`);return;}
    if(native==='tr'&&(!RESPELLING.test(text)||FORBIDDEN_LETTER.test(text)))errors.push(`${where}: respelling must use Turkish letters only (no IPA, q, w, x): ${text}`);
  };
  if(!TYPE_PATTERN.test(raw.t))warnings.push(`type "${raw.t}" is not in the list of labels`);
  if(raw.m.length>80)warnings.push('meaning is long (over 80 characters)');
  if(!Array.isArray(raw.e)||raw.e.length!==2)errors.push('e: exactly two examples');
  else raw.e.forEach((example,index)=>{
    const where=`e[${index}]`;
    if(!Array.isArray(example)||example.length!==3||!isLine(example[0])||!isLine(example[2])){errors.push(`${where}: [sentence, respelling, translation]`);return;}
    respelling(example[1],where);
    if(!usesWord(example[0],raw.w))warnings.push(`${where}: the sentence does not seem to use "${raw.w}"`);
    if(example[0].length>140)warnings.push(`${where}: long sentence`);
  });
  if(Array.isArray(raw.e)&&raw.e.length===2&&Array.isArray(raw.e[0])&&Array.isArray(raw.e[1])&&raw.e[0][0]===raw.e[1][0])errors.push('e: the two examples are the same');
  if(raw.x!==undefined){
    if(!Array.isArray(raw.x)||raw.x.length>2)errors.push('x: at most two phrases');
    else raw.x.forEach((item,index)=>{
      const where=`x[${index}]`;
      if(!Array.isArray(item)||item.length!==6||item.some(part=>!isLine(part))){errors.push(`${where}: [phrase, respelling, meaning, sentence, sentence respelling, sentence translation]`);return;}
      respelling(item[1],`${where} phrase`);respelling(item[4],`${where} sentence`);
      const parts=wordsOfText(item[0]).filter(part=>part.length>=3);
      if(parts.length&&!parts.some(part=>usesWord(item[3],part)))warnings.push(`${where}: the sentence does not seem to use "${item[0]}"`);
    });
  }
  const own=plain(raw.w),seen=new Set();
  for(const field of ['s','a']){
    if(raw[field]===undefined)continue;
    if(!Array.isArray(raw[field])||raw[field].length>4||raw[field].some(item=>!isLine(item))){errors.push(`${field}: at most four words`);continue;}
    for(const item of raw[field]){
      if(plain(item)===own)errors.push(`${field}: "${item}" is the word itself`);
      if(seen.has(plain(item)))errors.push(`${field}: "${item}" is listed twice (also across synonyms and antonyms)`);seen.add(plain(item));
    }
  }
  return {errors,warnings};
}

function readLemmas(root,target){
  const file=path.join(root,'wordbase',target,'lemmas.tsv');
  if(!fs.existsSync(file))return null;
  return lf(fs.readFileSync(file,'utf8')).split('\n').map((line,index)=>({line,number:index+1})).filter(({line})=>line.trim()&&!line.startsWith('#')).map(({line,number})=>{
    const [word,pos,level]=line.split('\t').map(part=>part.trim());
    return {word,pos,level,line:number};
  });
}
function readSources(root,pair){
  const dir=path.join(root,'wordbase',pair,'src');
  if(!fs.existsSync(dir))return [];
  const out=[];
  for(const name of fs.readdirSync(dir).filter(name=>/\.jsonl$/.test(name)).sort()){
    lf(fs.readFileSync(path.join(dir,name),'utf8')).split('\n').forEach((text,index)=>{
      if(!text.trim())return;
      let raw=null,broken=false;try{raw=JSON.parse(text);}catch(_){broken=true;}
      out.push({file:name,line:index+1,raw,broken});
    });
  }
  return out;
}
const courseVersion=(root,pair)=>{
  const file=path.join(root,'wordbase',pair,'course.json');
  if(!fs.existsSync(file))return 1;
  try{const version=JSON.parse(fs.readFileSync(file,'utf8')).version;return Number.isInteger(version)&&version>=1?version:1;}catch(_){return 1;}
};

// Everything that can be said about one course's sources: {errors, warnings, entries:[{word, level, record}]}
function checkCourse(root,pair){
  const errors=[],warnings=[],entries=[];
  const parsed=Packs.pairOf(pair);
  if(!parsed)return {errors:[`${pair}: a course is named <target>-<native>`],warnings,entries};
  const lemmas=readLemmas(root,parsed.target);
  if(!lemmas)return {errors:[`wordbase/${parsed.target}/lemmas.tsv is missing`],warnings,entries};
  const levelOrder=lemma=>Packs.LEVELS.indexOf(lemma.level);
  lemmas.forEach((lemma,index)=>{
    if(!lemma.word||!lemma.pos||!Packs.LEVELS.includes(lemma.level))errors.push(`lemmas.tsv line ${lemma.line}: word, part of speech and a level A1-C2 are needed`);
    if(index&&levelOrder(lemma)<levelOrder(lemmas[index-1]))errors.push(`lemmas.tsv line ${lemma.line}: the levels must not go back`);
  });
  const known=new Set();
  for(const lemma of lemmas){const key=Packs.wordKey(lemma.word,parsed.target);if(known.has(key))errors.push(`lemmas.tsv: "${lemma.word}" appears twice`);known.add(key);}
  const sources=readSources(root,pair);
  sources.forEach((source,index)=>{
    const where=`${source.file}:${source.line}`;
    if(source.broken){errors.push(`${where}: not valid JSON`);return;}
    const lemma=lemmas[entries.length];
    const name=BATCH_FILE.exec(source.file);
    if(!name)errors.push(`${source.file}: the name must look like A1-001.jsonl`);
    const result=lintWord(source.raw,{native:parsed.native});
    for(const message of result.errors)errors.push(`${where}${source.raw&&source.raw.w?` (${source.raw.w})`:''}: ${message}`);
    for(const message of result.warnings)warnings.push(`${where} (${source.raw.w}): ${message}`);
    if(!lemma){errors.push(`${where}: more words than the lemma list has`);return;}
    if(source.raw&&source.raw.w!==lemma.word)errors.push(`${where}: expected "${lemma.word}" (lemmas.tsv line ${lemma.line}), found "${source.raw.w}"`);
    else if(name&&name[1]!==lemma.level)errors.push(`${where}: "${lemma.word}" is ${lemma.level} but the file is ${name[1]}`);
    if(!result.errors.length)entries.push({word:lemma.word,level:lemma.level,pos:lemma.pos,record:expand(source.raw),raw:source.raw});
    else entries.push(null);
  });
  const good=entries.filter(Boolean);
  return {errors,warnings,entries:good,lemmas,authored:sources.length};
}

// balanced chunk sizes: 600 words are 2 x 300, not 500 + 100
function chunkSizes(count){
  const parts=Math.max(1,Math.ceil(count/Packs.CHUNK_WORDS)),base=Math.floor(count/parts),extra=count%parts;
  return Array.from({length:parts},(_,index)=>base+(index<extra?1:0));
}
// One word a line keeps changes readable in git and the file small.
const chunkText=chunk=>`{"format":${chunk.format},"id":${JSON.stringify(chunk.id)},"chunk":${JSON.stringify(chunk.chunk)},"level":${JSON.stringify(chunk.level)},"version":${chunk.version},"words":[\n${chunk.words.map(word=>JSON.stringify(word)).join(',\n')}\n]}\n`;
const orderText=order=>`{"format":${order.format},"id":${JSON.stringify(order.id)},"version":${order.version},"chunks":[\n${order.chunks.map(chunk=>JSON.stringify(chunk)).join(',\n')}\n]}\n`;

// The files of a course, from checked entries: [{name, text}]
function planCourse(pair,version,entries){
  const files=[],order={format:Packs.COURSE_FORMAT,id:pair,version,chunks:[]};
  for(const level of Packs.LEVELS){
    const words=entries.filter(entry=>entry.level===level);
    let at=0;
    chunkSizes(words.length).forEach((size,index)=>{
      if(!words.length)return;
      const id=Packs.chunkName(level,index+1),slice=words.slice(at,at+size);at+=size;
      files.push({name:`${id}.json`,text:chunkText({format:Packs.COURSE_FORMAT,id:pair,chunk:id,level,version,words:slice.map(entry=>entry.record)})});
      order.chunks.push({id,level,words:slice.map(entry=>entry.word)});
    });
  }
  files.push({name:'order.json',text:orderText(order)});
  return files;
}

function buildCourse(root,pair){
  const result=checkCourse(root,pair);
  if(result.errors.length)return {...result,written:0};
  if(!result.entries.length)return {...result,written:0,errors:[`${pair}: there are no words yet`]};
  const dir=path.join(root,'packs',pair),files=planCourse(pair,courseVersion(root,pair),result.entries);
  fs.mkdirSync(dir,{recursive:true});
  const keep=new Set(files.map(file=>file.name));
  for(const name of fs.readdirSync(dir))if(/\.json$/.test(name)&&!keep.has(name))fs.rmSync(path.join(dir,name));   // chunks of an earlier build that no longer exist
  for(const file of files)fs.writeFileSync(path.join(dir,file.name),file.text);
  const {problems,index}=Build.inspect(path.join(root,'packs'));
  if(problems.length)return {...result,written:files.length,errors:problems};
  fs.writeFileSync(path.join(root,'packs','index.json'),Build.serialize(index));
  return {...result,written:files.length};
}

function statsOf(root,pair){
  const result=checkCourse(root,pair),rows=[];
  for(const level of Packs.LEVELS){
    const planned=(result.lemmas||[]).filter(lemma=>lemma.level===level).length;
    const done=result.entries.filter(entry=>entry.level===level);
    if(!planned&&!done.length)continue;
    const share=test=>done.length?`${Math.round(100*done.filter(test).length/done.length)}%`:'-';
    const bytes=done.reduce((sum,entry)=>sum+Buffer.byteLength(JSON.stringify(entry.record)),0);
    rows.push({level,planned,written:done.length,synonyms:share(entry=>entry.record.synonyms),antonyms:share(entry=>entry.record.antonyms),phrases:share(entry=>entry.record.expressions),
      bytesPerWord:done.length?Math.round(bytes/done.length):0,kilobytes:Math.round(bytes/1024)});
  }
  return {rows,errors:result.errors,warnings:result.warnings};
}

function pairsIn(root,only){
  if(only)return [only];
  const dir=path.join(root,'wordbase');
  return fs.existsSync(dir)?fs.readdirSync(dir).filter(name=>Packs.pairOf(name)&&fs.statSync(path.join(dir,name)).isDirectory()).sort():[];
}

// A readable sample for a person to proofread: `count` words spread evenly over the written words of a level (or of all levels), as Markdown.
function sampleOf(root,pair,{level=null,count=50}={}){
  const result=checkCourse(root,pair),pool=result.entries.filter(entry=>!level||entry.level===level);
  const step=pool.length/Math.min(count,pool.length||1),chosen=Array.from({length:Math.min(count,pool.length)},(_,index)=>pool[Math.floor(index*step)]);
  const lines=[`# ${pair}: ${chosen.length} words to proofread (${level||'all levels'}, spread evenly over ${pool.length} written words)`,'',
    'For each card check: the meaning, the gender and kind, that the sentences are natural, that every respelling reads like the French when read with Turkish letters, and the translations.',''];
  chosen.forEach((entry,index)=>{
    const word=entry.record;
    lines.push(`## ${index+1}. ${word.word} (${word.type}) [${entry.level}]`,'',`- Anlam: ${word.meaning}`);
    if(word.synonyms)lines.push(`- Eş anlamlı: ${word.synonyms.join(', ')}`);
    if(word.antonyms)lines.push(`- Zıt anlamlı: ${word.antonyms.join(', ')}`);
    word.examples.forEach(example=>lines.push(`- ${example.text} — okunuş: *${example.phonetic}* — ${example.translation}`));
    for(const item of word.expressions||[])lines.push(`- Kalıp: **${item.text}** (*${item.phonetic}*) = ${item.translation}; ${item.exampleText} — *${item.examplePhonetic}* — ${item.exampleTranslation}`);
    lines.push('');
  });
  return lines.join('\n');
}

module.exports={expand,usesWord,lintWord,checkCourse,chunkSizes,planCourse,buildCourse,statsOf,sampleOf,readLemmas,TYPE_PATTERN,RESPELLING};

if(require.main===module){
  const [command,only,levelArg,countArg]=process.argv.slice(2),pairs=pairsIn(repoRoot,only);
  if(!['check','build','stats','sample'].includes(command)){console.error('usage: node tools/wordbase.js check|build|stats [pair]   or   sample <pair> [level] [count]');process.exit(2);}
  if(!pairs.length){console.log('No course sources in wordbase/ yet.');process.exit(0);}
  let failed=false;
  for(const pair of pairs){
    if(command==='sample'){console.log(sampleOf(repoRoot,pair,{level:levelArg&&levelArg!=='all'?levelArg:null,count:+countArg||50}));continue;}
    if(command==='stats'){
      const {rows,errors}=statsOf(repoRoot,pair);
      console.log(`${pair}`);
      console.table(rows);
      if(errors.length){failed=true;console.error(`${errors.length} errors (run check)`);}
      continue;
    }
    const result=command==='check'?checkCourse(repoRoot,pair):buildCourse(repoRoot,pair);
    const shown=result.warnings.length?`${result.warnings.length} warnings`:'no warnings';
    for(const message of result.errors.slice(0,40))console.error(`ERROR ${message}`);
    if(result.errors.length>40)console.error(`... and ${result.errors.length-40} more errors`);
    for(const message of result.warnings.slice(0,15))console.log(`warning ${message}`);
    if(result.warnings.length>15)console.log(`... and ${result.warnings.length-15} more warnings`);
    console.log(`${pair}: ${result.entries.length} words written of ${result.lemmas?result.lemmas.length:'?'} in the lemma list; ${result.errors.length} errors, ${shown}.${command==='build'&&!result.errors.length?` ${result.written} files written.`:''}`);
    if(result.errors.length)failed=true;
  }
  if(failed)process.exit(1);
}
