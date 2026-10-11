'use strict';
/* Ready-made word packs: the format, its validation and the choice of the next words. Pure functions (no page, storage or network), used by the
   page (screens.js), by tools/build-packs.js and by the tests.
   A pack is one file per language pair, packs/<target>-<native>.json: the words of a beginner level in the order they are best learned, with their
   meanings in the learner's own language. The page downloads only the pack of the pair the user chose and keeps it for offline use.
   A pair can instead have a course (format 2, see "courses" below): all levels A1-C2 in chunk files. */
(function(root){
  const SUPPORTED=Object.freeze(['tr','en','fr','de','es','it']);
  const FORMAT=1,MAX_WORDS=2000,MAX_BYTES=400*1024;
  const WORD_KEYS=new Set(['word','type','meaning','synonyms','antonyms','examples','expressions']);
  const BAD_TEXT=/[\u0000-\u001f\u007f<>]/;                                  // control characters and anything that looks like markup
  const isText=(value,max,{min=1}={})=>typeof value==='string'&&value.trim().length>=min&&value.length<=max&&!BAD_TEXT.test(value);

  const pairId=(target,native)=>`${target}-${native}`;
  // The key under which a word is recognised as "already known": case-insensitive in the language it belongs to.
  const wordKey=(word,target)=>String(word).normalize('NFC').toLocaleLowerCase(target);

  function checkSamples(list,label,problems,{translation}){
    if(!Array.isArray(list)||list.length>5){problems.push(`${label}: at most 5 entries`);return;}
    list.forEach((item,index)=>{
      const where=`${label}[${index}]`;
      if(!item||typeof item!=='object'){problems.push(`${where}: not an object`);return;}
      if(!isText(item.text,200))problems.push(`${where}.text`);
      if(item.phonetic!==undefined&&!isText(item.phonetic,200,{min:0}))problems.push(`${where}.phonetic`);
      if(translation&&!isText(item.translation,200))problems.push(`${where}.translation`);
    });
  }
  // Every problem found, as short messages; an empty list means the pack is usable.
  function validatePack(pack){
    const problems=[];
    if(!pack||typeof pack!=='object'||Array.isArray(pack))return ['not an object'];
    if(pack.format!==FORMAT)problems.push(`format must be ${FORMAT}`);
    if(!SUPPORTED.includes(pack.target))problems.push('target language is not supported');
    if(!SUPPORTED.includes(pack.native))problems.push('native language is not supported');
    if(pack.target===pack.native)problems.push('target and native language must differ');
    if(pack.id!==pairId(pack.target,pack.native))problems.push('id must be <target>-<native>');
    if(!isText(pack.level,20))problems.push('level');
    if(!Number.isInteger(pack.version)||pack.version<1)problems.push('version must be a positive integer');
    if(!Array.isArray(pack.words)||!pack.words.length||pack.words.length>MAX_WORDS)return [...problems,`words: 1 to ${MAX_WORDS} entries`];
    const seen=new Set();
    pack.words.forEach((entry,index)=>{
      const where=`words[${index}]`;
      if(!checkEntry(entry,where,problems))return;
      const key=wordKey(entry.word,pack.target);
      if(seen.has(key))problems.push(`${where}: "${entry.word}" appears twice`);seen.add(key);
    });
    return problems;
  }
  // One word record: the checks both kinds of file share. False when the record has no usable headword (nothing more can be said about it).
  function checkEntry(entry,where,problems){
    if(!entry||typeof entry!=='object'||Array.isArray(entry)){problems.push(`${where}: not an object`);return false;}
    for(const key of Object.keys(entry))if(!WORD_KEYS.has(key))problems.push(`${where}: unknown field ${key}`);
    if(!isText(entry.word,60)){problems.push(`${where}.word`);return false;}
    if(!isText(entry.meaning,200))problems.push(`${where}.meaning`);
    if(entry.type!==undefined&&!isText(entry.type,60,{min:0}))problems.push(`${where}.type`);
    for(const field of ['synonyms','antonyms'])if(entry[field]!==undefined&&(!Array.isArray(entry[field])||entry[field].length>8||entry[field].some(item=>!isText(item,60))))problems.push(`${where}.${field}`);
    if(entry.examples!==undefined)checkSamples(entry.examples,`${where}.examples`,problems,{translation:true});
    if(entry.expressions!==undefined){
      checkSamples(entry.expressions,`${where}.expressions`,problems,{translation:true});
      // an idiom or phrase comes with the sentence that uses it
      (Array.isArray(entry.expressions)?entry.expressions:[]).forEach((item,index)=>{
        if(!item||typeof item!=='object'||item.exampleText===undefined)return;
        const at=`${where}.expressions[${index}]`;
        if(!isText(item.exampleText,200))problems.push(`${at}.exampleText`);
        if(item.examplePhonetic!==undefined&&!isText(item.examplePhonetic,200,{min:0}))problems.push(`${at}.examplePhonetic`);
        if(!isText(item.exampleTranslation,200))problems.push(`${at}.exampleTranslation`);
      });
    }
    return true;
  }
  const checkSize=text=>text.length<=MAX_BYTES?[]:[`pack is larger than ${MAX_BYTES} bytes`];

  /* ---------- courses (format 2) ----------
     A course is one language pair's words from A1 to C2 in the order they are best learned. It is far too big for one file, so it is cut into
     chunk files (packs/<pair>/<LEVEL>-<nn>.json, about 500 words each) that the page downloads only when it needs them. packs/<pair>/order.json lists
     the headwords of every chunk in order: with it the page counts progress and finds the next chunk without downloading any chunk. */
  const LEVELS=Object.freeze(['A1','A2','B1','B2','C1','C2']);
  const BANDS=Object.freeze({'A1-A2':['A1','A2'],'B1-B2':['B1','B2'],'C1-C2':['C1','C2']});  // the difficulty setting of the app names a band
  const COURSE_FORMAT=2,CHUNK_WORDS=500,MAX_CHUNK_WORDS=600,MAX_CHUNK_BYTES=800*1024,MAX_ORDER_BYTES=400*1024,MAX_CHUNKS=100;
  const CHUNK_ID=/^(A1|A2|B1|B2|C1|C2)-(\d{2})$/;
  const chunkName=(level,number)=>`${level}-${String(number).padStart(2,'0')}`;
  const pairOf=id=>{const match=/^([a-z]{2})-([a-z]{2})$/.exec(String(id));return match&&SUPPORTED.includes(match[1])&&SUPPORTED.includes(match[2])&&match[1]!==match[2]?{target:match[1],native:match[2]}:null;};

  // A chunk file: the header and its words, each checked like the words of a single pack.
  function validateChunk(chunk){
    const problems=[];
    if(!chunk||typeof chunk!=='object'||Array.isArray(chunk))return ['not an object'];
    if(chunk.format!==COURSE_FORMAT)problems.push(`format must be ${COURSE_FORMAT}`);
    const pair=pairOf(chunk.id);
    if(!pair)problems.push('id must be <target>-<native> of two different supported languages');
    const named=CHUNK_ID.exec(String(chunk.chunk));
    if(!named)problems.push('chunk must look like A1-01');
    else if(chunk.level!==named[1])problems.push('level must be the one the chunk name starts with');
    if(!Number.isInteger(chunk.version)||chunk.version<1)problems.push('version must be a positive integer');
    if(!Array.isArray(chunk.words)||!chunk.words.length||chunk.words.length>MAX_CHUNK_WORDS)return [...problems,`words: 1 to ${MAX_CHUNK_WORDS} entries`];
    const seen=new Set();
    chunk.words.forEach((entry,index)=>{
      const where=`words[${index}]`;
      if(!checkEntry(entry,where,problems))return;
      const key=wordKey(entry.word,pair?pair.target:'en');
      if(seen.has(key))problems.push(`${where}: "${entry.word}" appears twice`);seen.add(key);
    });
    return problems;
  }
  const checkChunkSize=text=>text.length<=MAX_CHUNK_BYTES?[]:[`chunk is larger than ${MAX_CHUNK_BYTES} bytes`];

  // order.json: {format, id, version, chunks:[{id, level, words:[headwords]}]}. The chunks run from A1 up, numbered 01, 02 … within a level,
  // and no headword appears twice in the whole course.
  function validateOrder(order){
    const problems=[];
    if(!order||typeof order!=='object'||Array.isArray(order))return ['not an object'];
    if(order.format!==COURSE_FORMAT)problems.push(`format must be ${COURSE_FORMAT}`);
    const pair=pairOf(order.id);
    if(!pair)problems.push('id must be <target>-<native> of two different supported languages');
    if(!Number.isInteger(order.version)||order.version<1)problems.push('version must be a positive integer');
    if(!Array.isArray(order.chunks)||!order.chunks.length||order.chunks.length>MAX_CHUNKS)return [...problems,`chunks: 1 to ${MAX_CHUNKS} entries`];
    const seen=new Map();let level=-1,number=0;
    order.chunks.forEach((chunk,index)=>{
      const where=`chunks[${index}]`;
      if(!chunk||typeof chunk!=='object'||Array.isArray(chunk)){problems.push(`${where}: not an object`);return;}
      const named=CHUNK_ID.exec(String(chunk.id));
      if(!named){problems.push(`${where}.id must look like A1-01`);return;}
      if(chunk.level!==named[1])problems.push(`${where}.level must be ${named[1]}`);
      const at=LEVELS.indexOf(named[1]);
      if(at<level)problems.push(`${where}: ${chunk.id} comes after a higher level`);
      const expected=at===level?number+1:1;                                      // a new level starts again at 01
      if(Number(named[2])!==expected)problems.push(`${where}: ${chunk.id} should be ${chunkName(named[1],expected)}`);
      level=Math.max(level,at);number=Number(named[2]);
      if(!Array.isArray(chunk.words)||!chunk.words.length||chunk.words.length>MAX_CHUNK_WORDS||chunk.words.some(word=>!isText(word,60))){problems.push(`${where}.words: 1 to ${MAX_CHUNK_WORDS} headwords`);return;}
      for(const word of chunk.words){
        const key=wordKey(word,pair?pair.target:'en');
        if(seen.has(key))problems.push(`${where}: "${word}" is already in ${seen.get(key)}`);else seen.set(key,chunk.id);
      }
    });
    return problems;
  }

  const inBand=(order,band)=>order.chunks.filter(chunk=>(BANDS[band]||[]).includes(chunk.level));
  // How many headwords of a band (A1-A2 …) the course holds and how many of them the user already has.
  function courseProgress(order,band,isKnown){
    let total=0,used=0;
    for(const chunk of inBand(order,band)){total+=chunk.words.length;used+=chunk.words.filter(word=>isKnown(word)).length;}
    return {total,used};
  }
  // The ids of the chunks to download, in order, to give `count` words the user does not have yet from a band (fewer when the band runs out).
  function pickChunks(order,band,isKnown,count){
    const ids=[];let found=0;
    for(const chunk of inBand(order,band)){
      if(found>=count)break;
      const unknown=chunk.words.filter(word=>!isKnown(word)).length;
      if(unknown){ids.push(chunk.id);found+=unknown;}
    }
    return ids;
  }
  // The next `count` unknown words out of downloaded chunks, given in the order pickChunks named them.
  function nextFromChunks(chunks,isKnown,count){
    const out=[];
    for(const chunk of chunks){if(out.length>=count)break;out.push(...nextWords(chunk,isKnown,count-out.length));}
    return out;
  }

  // The next `count` words of the pack that the user does not have yet, in the pack's order (it is a course: easiest and most useful first).
  function nextWords(pack,isKnown,count){
    const out=[];
    for(const entry of pack.words){
      if(out.length>=count)break;
      if(!isKnown(entry.word))out.push(JSON.parse(JSON.stringify({synonyms:[],antonyms:[],examples:[],expressions:[],...entry})));
    }
    return out;
  }
  const progress=(pack,isKnown)=>({total:pack.words.length,used:pack.words.filter(entry=>isKnown(entry.word)).length});

  const api=Object.freeze({SUPPORTED,FORMAT,MAX_WORDS,MAX_BYTES,pairId,wordKey,validatePack,checkSize,nextWords,progress,
    LEVELS,BANDS,COURSE_FORMAT,CHUNK_WORDS,MAX_CHUNK_WORDS,MAX_CHUNK_BYTES,MAX_ORDER_BYTES,chunkName,pairOf,validateChunk,checkChunkSize,validateOrder,courseProgress,pickChunks,nextFromChunks});
  root.VocVocPacks=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
