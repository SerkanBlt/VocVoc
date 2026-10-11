/* Checks every pack and course in packs/ and writes packs/index.json, the small list the app reads to know which packs and courses exist, how many
   words they have and how big they are.
     node tools/build-packs.js            validate everything, write packs/index.json   (npm run packs)
     node tools/build-packs.js --check    only verify; exit 1 on a problem or when index.json is out of date
   A pack is one file, packs/<pair>.json (format 1). A course is a folder, packs/<pair>/, with chunk files <LEVEL>-<nn>.json and order.json (format 2);
   tools/wordbase.js writes those from the sources in wordbase/. Line endings are normalised to LF before measuring, so the sizes agree on every checkout. */
'use strict';
const fs=require('fs'),path=require('path');
const Packs=require('../packs.js');
const defaultDir=path.resolve(__dirname,'..','packs');
const INDEX_FORMAT=2;
const lf=text=>text.replace(/\r\n/g,'\n');

function readJson(file,label,problems){
  const text=lf(fs.readFileSync(file,'utf8'));
  try{return {text,value:JSON.parse(text)};}catch(error){problems.push(`${label}: not valid JSON`);return null;}
}

// One course folder: every chunk is valid, listed in order.json and the same as it, and the course has no word twice. Returns the index entry or null.
function inspectCourse(dir,pair,problems){
  const base=path.join(dir,pair),at=name=>`${pair}/${name}`;
  const files=fs.readdirSync(base).filter(name=>/\.json$/.test(name)).sort();
  const parsed=files.includes('order.json')?readJson(path.join(base,'order.json'),at('order.json'),problems):null;
  if(!files.includes('order.json'))problems.push(`${at('order.json')} is missing`);
  if(!parsed)return null;
  const {text:orderText,value:order}=parsed,before=problems.length;
  for(const message of Packs.validateOrder(order))problems.push(`${at('order.json')}: ${message}`);
  if(Buffer.byteLength(orderText)>Packs.MAX_ORDER_BYTES)problems.push(`${at('order.json')}: larger than ${Packs.MAX_ORDER_BYTES} bytes`);
  if(problems.length>before)return null;                                      // what follows needs a sound order.json
  if(order.id!==pair){problems.push(`${at('order.json')}: id must be ${pair}`);return null;}
  const listed=new Set(order.chunks.map(chunk=>`${chunk.id}.json`));
  for(const name of files)if(name!=='order.json'&&!listed.has(name))problems.push(`${at(name)}: is not listed in order.json`);
  const chunks=[],levels={};
  for(const entry of order.chunks){
    const name=`${entry.id}.json`;
    if(!files.includes(name)){problems.push(`${at(name)}: is listed in order.json but missing`);continue;}
    const read=readJson(path.join(base,name),at(name),problems);
    if(!read)continue;
    const {text,value:chunk}=read,found=[...Packs.validateChunk(chunk),...Packs.checkChunkSize(text)];
    if(chunk.id!==pair)found.push(`id must be ${pair}`);
    if(chunk.chunk!==entry.id)found.push(`chunk must be ${entry.id}`);
    if(chunk.version!==order.version)found.push(`version must be ${order.version}, the version of order.json`);
    if(Array.isArray(chunk.words)&&JSON.stringify(chunk.words.map(word=>word&&word.word))!==JSON.stringify(entry.words))found.push('its words differ from order.json');
    for(const message of found)problems.push(`${at(name)}: ${message}`);
    if(found.length)continue;
    chunks.push({id:entry.id,level:entry.level,words:chunk.words.length,bytes:Buffer.byteLength(text)});
    levels[entry.level]=(levels[entry.level]||0)+chunk.words.length;
  }
  if(chunks.length!==order.chunks.length)return null;
  const {target,native}=Packs.pairOf(pair);
  return {id:pair,target,native,version:order.version,words:chunks.reduce((sum,chunk)=>sum+chunk.words,0),levels,orderBytes:Buffer.byteLength(orderText),chunks};
}

// {problems:[...], index:{...}}: nothing is written here
function inspect(dir=defaultDir){
  const problems=[],entries=[],courses=[];
  const names=fs.existsSync(dir)?fs.readdirSync(dir):[];
  for(const name of names.filter(name=>/\.json$/.test(name)&&name!=='index.json').sort()){
    const read=readJson(path.join(dir,name),name,problems);
    if(!read)continue;
    const {text,value:pack}=read,found=[...Packs.validatePack(pack),...Packs.checkSize(text)];
    if(pack&&pack.id&&name!==`${pack.id}.json`)found.push(`file name must be ${pack.id}.json`);
    for(const message of found)problems.push(`${name}: ${message}`);
    if(!found.length)entries.push({id:pack.id,target:pack.target,native:pack.native,level:pack.level,version:pack.version,words:pack.words.length,bytes:Buffer.byteLength(text)});
  }
  for(const name of names.filter(name=>fs.statSync(path.join(dir,name)).isDirectory()).sort()){
    if(!Packs.pairOf(name)){problems.push(`${name}/: a course folder is named <target>-<native>`);continue;}
    const course=inspectCourse(dir,name,problems);
    if(course)courses.push(course);
  }
  const ids=[...entries.map(entry=>entry.id),...courses.map(course=>course.id)];
  if(new Set(ids).size!==ids.length)problems.push('a pack and a course (or two packs) have the same id');
  return {problems,index:{format:INDEX_FORMAT,packs:entries,courses}};
}
const serialize=index=>JSON.stringify(index,null,2)+'\n';
function check(dir=defaultDir){
  const {problems,index}=inspect(dir),file=path.join(dir,'index.json');
  const current=fs.existsSync(file)?lf(fs.readFileSync(file,'utf8')):null;
  if(current!==serialize(index))problems.push('packs/index.json is out of date (run: npm run packs)');
  return problems;
}
module.exports={INDEX_FORMAT,inspect,serialize,check};

if(require.main===module){
  if(process.argv.includes('--check')){
    const problems=check();
    if(problems.length){console.error(problems.join('\n'));process.exit(1);}
    console.log('Packs and courses are valid and packs/index.json is current.');
  }else{
    const {problems,index}=inspect();
    if(problems.length){console.error(problems.join('\n'));process.exit(1);}
    fs.writeFileSync(path.join(defaultDir,'index.json'),serialize(index));
    const total=index.packs.reduce((sum,entry)=>sum+entry.words,0)+index.courses.reduce((sum,course)=>sum+course.words,0);
    console.log(`packs/index.json written: ${index.packs.length} packs, ${index.courses.length} courses, ${total} words.`);
  }
}
