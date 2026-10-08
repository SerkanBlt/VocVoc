'use strict';
/* Ready-made word packs: the format, its validation and the choice of the next words. Pure functions (no page, storage or network), used by the
   page (screens.js), by tools/build-packs.js and by the tests.
   A pack is one file per language pair, packs/<target>-<native>.json: the words of a beginner level in the order they are best learned, with their
   meanings in the learner's own language. The page downloads only the pack of the pair the user chose and keeps it for offline use. */
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
      if(!entry||typeof entry!=='object'||Array.isArray(entry)){problems.push(`${where}: not an object`);return;}
      for(const key of Object.keys(entry))if(!WORD_KEYS.has(key))problems.push(`${where}: unknown field ${key}`);
      if(!isText(entry.word,60)){problems.push(`${where}.word`);return;}
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
      const key=wordKey(entry.word,pack.target);
      if(seen.has(key))problems.push(`${where}: "${entry.word}" appears twice`);seen.add(key);
    });
    return problems;
  }
  const checkSize=text=>text.length<=MAX_BYTES?[]:[`pack is larger than ${MAX_BYTES} bytes`];

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

  const api=Object.freeze({SUPPORTED,FORMAT,MAX_WORDS,MAX_BYTES,pairId,wordKey,validatePack,checkSize,nextWords,progress});
  root.VocVocPacks=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
