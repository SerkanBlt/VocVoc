/* Local server for trying the AI features: serves this folder and POST /api/ai with the same code as functions/api/ai.js.
     node tools/ai-dev-server.js [port]              answers with fixed examples (AI_MOCK=1: no key, no cost)
     ANTHROPIC_API_KEY=... node tools/ai-dev-server.js   talks to the real service
   Not part of the app shell. */
'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),port=Number(process.argv[2])||8000;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jsonl':'text/plain'};
const env={ANTHROPIC_API_KEY:process.env.ANTHROPIC_API_KEY,AI_MOCK:process.env.ANTHROPIC_API_KEY?'':'1'};
const source=fs.readFileSync(path.join(root,'functions','api','ai.js'),'utf8');
const loaded=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://x');
  if(url.pathname==='/api/ai'&&req.method==='POST'){
    let text='';for await(const chunk of req)text+=chunk;
    try{const [status,data]=await (await loaded).handle(JSON.parse(text),env);res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));}
    catch(error){res.writeHead(400,{'content-type':'application/json'});res.end('{"error":"bad request"}');}
    return;
  }
  let file=path.join(root,decodeURIComponent(url.pathname==='/'?'index.html':url.pathname));
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
  res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(file).pipe(res);
}).listen(port,()=>console.log('http://localhost:'+port+(env.AI_MOCK?'  (mock AI)':'  (real AI)')));
