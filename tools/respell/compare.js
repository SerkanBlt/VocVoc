/* Compare a respelling engine with the respellings already in wordbase/<pair>/src (written by hand or by model agents).
     node tools/respell/compare.js es-tr|tr-fr [how many differences to show]
   Differences are counted per word (sentences with as many words as the source), so a hand-written habit the engine does not know shows up as a list. */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..','..');
const engines={'es-tr':require('./es-tr.js').respell,'tr-fr':require('./tr-fr.js').transcribe};
const pair=process.argv[2],show=+process.argv[3]||40;
if(!engines[pair]){console.error('usage: node tools/respell/compare.js es-tr|tr-fr [n]');process.exit(2);}
const run=engines[pair];
const dir=path.join(root,'wordbase',pair,'src');
const tokens=text=>text.toLowerCase().split(/\s+/).map(t=>t.replace(/^[^\p{L}]+|[^\p{L}]+$/gu,'')).filter(Boolean);
let sentences=0,sentencesEqual=0,skipped=0,words=0,wordsEqual=0;const diffs=new Map();
for(const file of fs.readdirSync(dir).filter(n=>/\.jsonl$/.test(n))){
  for(const line of fs.readFileSync(path.join(dir,file),'utf8').split('\n').filter(Boolean)){
    const raw=JSON.parse(line);
    const pairs=[];for(const e of raw.e||[])pairs.push([e[0],e[1]]);for(const x of raw.x||[]){pairs.push([x[0],x[1]],[x[3],x[4]]);}
    for(const [source,written] of pairs){
      sentences++;
      const mine=run(source),a=tokens(mine),b=tokens(written);
      if(a.length!==b.length){skipped++;continue;}
      let equal=true;
      a.forEach((token,i)=>{words++;if(token===b[i])wordsEqual++;else{equal=false;const key=`${tokens(source)[i]||'?'}  engine:${token}  written:${b[i]}`;diffs.set(key,(diffs.get(key)||0)+1);}});
      if(equal)sentencesEqual++;
    }
  }
}
const pct=(a,b)=>b?(100*a/b).toFixed(1)+'%':'-';
console.log(`${pair}: ${sentences} sentences (${skipped} skipped, word count differs); words equal ${wordsEqual}/${words} (${pct(wordsEqual,words)}); sentences equal ${sentencesEqual}/${sentences-skipped} (${pct(sentencesEqual,sentences-skipped)})`);
console.log([...diffs.entries()].sort((x,y)=>y[1]-x[1]).slice(0,show).map(([k,v])=>`${String(v).padStart(4)}  ${k}`).join('\n'));
