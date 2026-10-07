/* Checks every pack in packs/ and writes packs/index.json, the small list the app reads to know which packs exist, how many words they have
   and how big they are.
     node tools/build-packs.js            validate all packs, write packs/index.json   (npm run packs)
     node tools/build-packs.js --check    only verify; exit 1 on a problem or when index.json is out of date
   Line endings are normalised to LF before measuring, so the sizes agree on every checkout. */
'use strict';
const fs=require('fs'),path=require('path');
const Packs=require('../packs.js');
const dir=path.resolve(__dirname,'..','packs');
const lf=text=>text.replace(/\r\n/g,'\n');

// {problems:[...], index:{...}}: nothing is written here
function inspect(){
  const problems=[],entries=[];
  const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(name=>/\.json$/.test(name)&&name!=='index.json').sort():[];
  for(const name of files){
    const text=lf(fs.readFileSync(path.join(dir,name),'utf8'));
    let pack;try{pack=JSON.parse(text);}catch(error){problems.push(`${name}: not valid JSON`);continue;}
    const found=[...Packs.validatePack(pack),...Packs.checkSize(text)];
    if(pack.id&&name!==`${pack.id}.json`)found.push(`file name must be ${pack.id}.json`);
    for(const message of found)problems.push(`${name}: ${message}`);
    if(!found.length)entries.push({id:pack.id,target:pack.target,native:pack.native,level:pack.level,version:pack.version,words:pack.words.length,bytes:Buffer.byteLength(text)});
  }
  const ids=entries.map(entry=>entry.id);
  if(new Set(ids).size!==ids.length)problems.push('two packs have the same id');
  return {problems,index:{format:Packs.FORMAT,packs:entries}};
}
const serialize=index=>JSON.stringify(index,null,2)+'\n';
function check(){
  const {problems,index}=inspect(),file=path.join(dir,'index.json');
  const current=fs.existsSync(file)?lf(fs.readFileSync(file,'utf8')):null;
  if(current!==serialize(index))problems.push('packs/index.json is out of date (run: npm run packs)');
  return problems;
}
module.exports={inspect,serialize,check};

if(require.main===module){
  if(process.argv.includes('--check')){
    const problems=check();
    if(problems.length){console.error(problems.join('\n'));process.exit(1);}
    console.log('Packs are valid and packs/index.json is current.');
  }else{
    const {problems,index}=inspect();
    if(problems.length){console.error(problems.join('\n'));process.exit(1);}
    fs.writeFileSync(path.join(dir,'index.json'),serialize(index));
    console.log(`packs/index.json written: ${index.packs.length} packs, ${index.packs.reduce((sum,entry)=>sum+entry.words,0)} words.`);
  }
}
