/* Release step after bumping VERSION (sw.js, <meta name="vocvoc-shell"> in index.html, BUILD_INFO.json):
     node tools/lock-shell.js
   Records the shell fingerprint for that version in tests/shell-lock.json.
   Refuses to record a changed shell under an unchanged VERSION, so the guard in tests/validate.cjs cannot be bypassed by accident. */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),lockPath=path.join(root,'tests','shell-lock.json');
const current=require('./shell-fingerprint.js').compute(root);
let lock=null;try{lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));}catch(_){}
if(lock&&lock.version===current.version&&lock.fingerprint!==current.fingerprint){
  console.error(`The app shell changed (sw.js, the ASSETS list or an asset) but VERSION is still ${current.version}.\nBump VERSION in sw.js, the <meta name="vocvoc-shell"> tag in index.html and BUILD_INFO.json, then run this again.`);
  process.exit(1);
}
fs.writeFileSync(lockPath,JSON.stringify({version:current.version,fingerprint:current.fingerprint,files:current.files},null,2)+'\n');
console.log(`Locked app shell ${current.version} (${current.files.length} files): ${current.fingerprint}`);
