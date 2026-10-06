/* Regenerates SHA256SUMS (one "<sha256>  <path>" line per file, the format `sha256sum -c` reads).
     node tools/update-checksums.js           write SHA256SUMS         (npm run checksums)
     node tools/update-checksums.js --check   only verify, exit 1 on a difference
   Run it after the last change of a release. Generated output (test results, measurements, npm's lock file) and git metadata are left
   out, so running the tests never invalidates the list. Text files are hashed with LF line endings, which is what git stores and what
   .gitattributes (eol=lf) checks out, so a CRLF working copy gives the same list on every platform. */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const EXCLUDED=new Set(['SHA256SUMS','.gitattributes','.gitignore','tests/browser-results.json','tests/package-lock.json','tests/perf-before.json','tests/perf-after.json']);
const git=(root,args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8'}).split('\n').map(line=>line.trim()).filter(Boolean);
// Tracked files, plus (for generating) new files git does not ignore: the same list before and after a commit.
function listed(root,{untracked=true}={}){
  const names=git(root,untracked?['ls-files','--cached','--others','--exclude-standard']:['ls-files']);
  return [...new Set(names)].filter(file=>!EXCLUDED.has(file)&&fs.existsSync(path.join(root,file))).sort();
}
function hashOf(buffer){
  const text=!buffer.includes(0);                                   // binary files (icons) are hashed as they are
  const bytes=text?Buffer.from(buffer.toString('latin1').replace(/\r\n/g,'\n'),'latin1'):buffer;
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
const hashFile=(root,file)=>hashOf(fs.readFileSync(path.join(root,file)));
const parse=text=>text.split(/\r?\n/).filter(line=>line.trim()).map(line=>{const match=line.match(/^([0-9a-f]{64}) [ *](.+)$/);if(!match)throw new Error(`not a checksum line: ${line}`);return {hash:match[1],file:match[2]};});
function generate(root){return listed(root).map(file=>`${hashFile(root,file)}  ${file}`).join('\n')+'\n';}
// Problems in the existing SHA256SUMS: listed files that are missing or changed, generated files that must not be listed, tracked files that are not listed.
function verify(root){
  const problems=[],entries=parse(fs.readFileSync(path.join(root,'SHA256SUMS'),'utf8')),names=new Set(entries.map(entry=>entry.file));
  for(const {hash,file} of entries){
    if(EXCLUDED.has(file)){problems.push(`${file} is generated output and must not be listed`);continue;}
    if(!fs.existsSync(path.join(root,file))){problems.push(`${file} is listed but missing`);continue;}
    if(hashFile(root,file)!==hash)problems.push(`${file} changed`);
  }
  try{for(const file of listed(root,{untracked:false}))if(!names.has(file))problems.push(`${file} is tracked but not listed`);}catch(_){/* no git: skip this part */}
  return problems;
}
module.exports={EXCLUDED,hashOf,parse,generate,verify};
if(require.main===module){
  const root=path.resolve(__dirname,'..');
  if(process.argv.includes('--check')){
    const problems=verify(root);
    if(problems.length){console.error(`SHA256SUMS is out of date:\n  ${problems.join('\n  ')}\nRun: npm run checksums`);process.exit(1);}
    console.log('SHA256SUMS matches.');
  }else{
    const text=generate(root);fs.writeFileSync(path.join(root,'SHA256SUMS'),text);
    console.log(`SHA256SUMS written (${text.trim().split('\n').length} files).`);
  }
}
