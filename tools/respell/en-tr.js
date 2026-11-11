/* English -> Turkish letters (wordbase/STYLE-en-tr.md): the respelling of an English sentence, made from a pronunciation dictionary
   (tools/respell/data/en-pron.tsv, CMUdict, made by build-en-dict.js) and the table below. A word that is not in the dictionary is made from its
   base form (plural, past, -ing) or, last, from its letters (rough); respellUnknown(text) lists those words so they can be looked at. */
'use strict';
const fs=require('fs'),path=require('path');
let dict=null;
function load(){
  if(dict)return dict;
  dict=new Map();
  const file=path.join(__dirname,'data','en-pron.tsv');
  if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split('\n')){const [word,phones]=line.split('\t');if(word&&phones)dict.set(word,phones);}
  return dict;
}
const VOWEL=new Set(['AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW']);
const MAP={AA:'a',AE:'e',AO:'o',AW:'au',AY:'ay',EH:'e',EY:'ey',IH:'i',IY:'i',OW:'o',OY:'oy',UH:'u',UW:'u',
  B:'b',CH:'ç',D:'d',DH:'z',F:'f',G:'g',HH:'h',JH:'c',K:'k',L:'l',M:'m',N:'n',NG:'ng',P:'p',R:'r',S:'s',SH:'ş',T:'t',TH:'s',V:'v',W:'v',Y:'y',Z:'z',ZH:'j'};
// words whose weak form is the one people say in a sentence
const WEAK={a:'ı',an:'en',of:'ıv',and:'end',the:'zı',to:'tı',or:'or',at:'et',am:'em'};
// words where the dictionary's first pronunciation is not the one STYLE-en-tr.md (and the course so far) uses
const WORDS={new:'nyu',news:'nyuz',knew:'nyu',newspaper:'nyuzpeypır',newspapers:'nyuzpeypırz',student:'styudınt',students:'styudınts',tuesday:'tyuzdey',duty:'dyuti',during:'dyuring',due:'dyu',tune:'tyun',
  our:'aur',ours:'aurz',hour:'aur',hours:'aurz',every:'evri',live:'liv',hello:'helo',use:'yuz',read:'rid',
  monday:'mandey',wednesday:'venzdey',thursday:'sörzdey',friday:'fraydey',saturday:'setırdey',sunday:'sandey',
  bought:'bot',thought:'sot',caught:'kot',taught:'tot',ankara:'ankara',coffee:'kofi',cause:'koz',sorry:'sori'};

function fromPhones(phones){
  const list=phones.split(' ');let out='';
  const push=text=>{if(text&&text.length===1&&out.slice(-1)===text&&!/[aeıioöuü]/.test(text))return;out+=text;};      // two phones that make one letter twice (clothes: DH Z) are written once
  list.forEach((phone,i)=>{
    const base=phone.replace(/[0-9]/,''),stress=phone.slice(base.length),next=(list[i+1]||'').replace(/[0-9]/,''),after=(list[i+2]||'');
    if(base==='AH'){push(stress==='0'?(next==='JH'&&!after?'i':'ı'):'a');return;}                                  // -age: vilic, mesic
    if(base==='ER'){out+=stress==='0'?'ır':'ör';return;}
    if(base==='AA'&&/^(G|F|S|TH)$/.test(next)){out+='o';return;}                                              // dog, coffee, cost, cause: o before g, f, s, z, th
    if(base==='NG'){out+=next==='K'?'n':'ng';return;}                                                          // bank, think: n + k; finger: ng
    if(base==='G'&&(list[i-1]||'')==='NG'){return;}                                                            // the g of ng+g is not written (angry, English)
    push(MAP[base]||'');
  });
  return out;
}
// the letters of a word that is nowhere in the dictionary (names, rare words): rough, for a first look
function fromLetters(word){
  return word.replace(/tion/g,'şın').replace(/sh/g,'ş').replace(/ch/g,'ç').replace(/th/g,'s').replace(/ph/g,'f').replace(/ck/g,'k').replace(/qu/g,'kv')
    .replace(/ee|ea/g,'i').replace(/oo/g,'u').replace(/ou/g,'au').replace(/ai|ay/g,'ey').replace(/w/g,'v').replace(/x/g,'ks').replace(/c(?=[ei])/g,'s').replace(/c/g,'k').replace(/j/g,'c').replace(/q/g,'k').replace(/(.)\1/g,'$1');
}
const unknown=new Set();
function lookup(word){
  const d=load();
  if(WORDS[word])return WORDS[word];
  if(d.has(word))return fromPhones(d.get(word));
  const bare=word.replace(/'/g,'');
  if(d.has(bare))return fromPhones(d.get(bare));
  const [head,tail]=word.split("'");
  if(tail!==undefined&&d.has(head)){                                              // it's, don't, I'm: the word and its ending
    const e=fromPhones(d.get(head));
    if(tail==='s')return e+(/[sşzcç]$/.test(e)?'ız':/[ptkfs]$/.test(e)?'s':'z');
    if(tail==='t'&&/n$/.test(e))return e.replace(/n$/,'nt');
    if(tail==='m')return e+'m';if(tail==='re')return e+'ır';if(tail==='ll')return e+'ıl';if(tail==='ve')return e+'v';if(tail==='d')return e+'d';
  }
  const inflect=[[/ies$/,'y'],[/s$/,''],[/es$/,''],[/ing$/,''],[/ing$/,'e'],[/ed$/,''],[/ed$/,'e'],[/ied$/,'y'],[/(.)\1ing$/,'$1'],[/(.)\1ed$/,'$1'],[/ly$/,''],[/er$/,''],[/est$/,'']];
  for(const [pattern,back] of inflect){
    if(!pattern.test(word))continue;
    const base=word.replace(pattern,back);
    if(base.length<2||!d.has(base))continue;
    const e=fromPhones(d.get(base)),last=e.slice(-1);
    if(pattern.source==='s$'||pattern.source==='es$'||pattern.source==='ies$')return e+(/[sşzcçj]$/.test(e)?'ız':/[ptkf]$/.test(e)?'s':'z');
    if(pattern.source.includes('ing'))return e+'ing';
    if(pattern.source.includes('ed'))return e+(/[td]$/.test(e)?'id':/[ptkfsşç]$/.test(e)?'t':'d');
    if(pattern.source==='ly$')return e+'li';
    if(pattern.source==='er$')return e+'ır';
    if(pattern.source==='est$')return e+'ist';
  }
  unknown.add(word);
  return fromLetters(bare);
}

function respell(text){
  // words and the spaces/punctuation between them, so that to/the can look at the next word
  const parts=String(text).split(/([A-Za-z]+(?:['’][A-Za-z]+)*)/);
  const words=[];
  for(let i=1;i<parts.length;i+=2){const w=parts[i].toLowerCase().replace(/’/g,"'");words.push({index:i,w});parts[i]=WEAK[w]!==undefined&&!['the','to'].includes(w)?WEAK[w]:lookup(w);}
  const VOWEL_START=/^[aeıioöuü]/;
  words.forEach((word,k)=>{
    if(word.w!=='to'&&word.w!=='the')return;
    const next=words[k+1],between=parts[word.index+1]||'';
    const phraseEnd=!next||/[,.;:!?)…]/.test(between)||/[,.;:!?)…]/.test(between.split(/\s+/)[0]||'');
    const nextStarts=next&&VOWEL_START.test(parts[next.index]);
    parts[word.index]=word.w==='to'?((phraseEnd||nextStarts)?'tu':'tı'):((!phraseEnd&&nextStarts)?'zi':'zı');
  });
  return parts.join('');
}
function respellUnknown(text){unknown.clear();respell(text);return [...unknown];}
module.exports={respell,respellUnknown,unknownWords:()=>[...unknown]};
