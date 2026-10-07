/* Fingerprint of everything a Service Worker version ships: sw.js itself, the ASSETS list and the bytes of every asset.
   tests/validate.cjs compares it with tests/shell-lock.json; `node tools/lock-shell.js` records it after a VERSION bump. */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const TEXT=/\.(?:html|js|css|webmanifest|json)$/;
function compute(root){
  const swText=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  const version=swText.match(/const VERSION='([^']+)'/)[1];
  const assets=JSON.parse(swText.match(/const ASSETS=(\[[^;]+\]);/)[1].replaceAll("'",'"'));
  const files=['sw.js',...new Set(assets.map(asset=>asset==='./'?'index.html':asset.replace(/^\.\//,'')))].sort();
  const hash=crypto.createHash('sha256');
  hash.update('assets:'+assets.join('|')+'\n');
  for(const file of files){
    let bytes=fs.readFileSync(path.join(root,file));
    // Line endings differ between checkouts (git autocrlf); they must not change the fingerprint.
    if(TEXT.test(file))bytes=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));
    hash.update(file+'\0'+bytes.length+'\0');hash.update(bytes);
  }
  return {version,assets,files,fingerprint:hash.digest('hex')};
}
module.exports={compute};
