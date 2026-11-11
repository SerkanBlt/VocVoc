/* Make tools/respell/data/en-pron.tsv, the pronunciations (ARPAbet, first variant, stress digits kept on the vowels) the English respelling engine reads.
     node tools/respell/build-en-dict.js <cmudict.dict> [frequency-list.txt] [how many words, default 30000]
   Words kept: those of the frequency list (the first N lines, "word count") and every English word that the sources already use
   (wordbase/en/lemmas.tsv and the sentences of wordbase/en-tr/src). The dictionary is CMUdict (Carnegie Mellon University, BSD-style licence). */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..','..');
const [dictFile,freqFile,limitArg]=process.argv.slice(2);
if(!dictFile){console.error('usage: node tools/respell/build-en-dict.js <cmudict.dict> [frequency-list.txt] [n]');process.exit(2);}
const limit=+limitArg||30000;
const pron=new Map();
for(const line of fs.readFileSync(dictFile,'utf8').split('\n')){
  const match=/^(\S+?)(\(\d+\))? (.+)$/.exec(line);
  if(!match||match[2])continue;                    // first variant only
  if(!pron.has(match[1]))pron.set(match[1],match[3].trim());
}
const wanted=new Set();
const addWords=text=>{for(const word of String(text).toLowerCase().match(/[a-z]+(?:'[a-z]+)*/g)||[])wanted.add(word);};
if(freqFile)fs.readFileSync(freqFile,'utf8').split('\n').slice(0,limit).forEach(line=>addWords(line.split(' ')[0]));
const lemmas=path.join(root,'wordbase','en','lemmas.tsv');
if(fs.existsSync(lemmas))fs.readFileSync(lemmas,'utf8').split('\n').forEach(line=>addWords(line.split('\t')[0]));
const src=path.join(root,'wordbase','en-tr','src');
if(fs.existsSync(src))for(const name of fs.readdirSync(src))for(const line of fs.readFileSync(path.join(src,name),'utf8').split('\n').filter(Boolean)){
  const raw=JSON.parse(line);addWords(raw.w);for(const e of raw.e||[])addWords(e[0]);for(const x of raw.x||[]){addWords(x[0]);addWords(x[3]);}
}
const out=[...wanted].filter(word=>pron.has(word)).sort().map(word=>`${word}\t${pron.get(word)}`);
const dir=path.join(__dirname,'data');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'en-pron.tsv'),out.join('\n')+'\n');
console.log(`${out.length} words written (${wanted.size} wanted, ${wanted.size-out.length} not in the dictionary)`);
