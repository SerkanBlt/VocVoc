/* Regenerates the manifest screenshots in screenshots/ from the real app (its built-in starter words, a fresh profile).
     node tools/make-screenshots.js            (uses PWA_BROWSER_PATH like the browser tests, else Playwright's Chromium)
   Chrome shows them in its install dialog. They are not part of the offline shell. Sizes must match "sizes" in manifest.webmanifest. */
'use strict';
const fs=require('fs'),http=require('http'),path=require('path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'screenshots');
const {chromium}=require(path.join(root,'tests','node_modules','playwright'));
const types={'.html':'text/html','.js':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png'};
const shots=[
  {file:'narrow-home.png',viewport:{width:390,height:844},scale:2,mobile:true,theme:'light',open:true},
  {file:'narrow-dark.png',viewport:{width:390,height:844},scale:2,mobile:true,theme:'dark',open:false},
  {file:'wide-home.png',viewport:{width:1280,height:800},scale:1,mobile:false,theme:'light',open:true}
];
(async()=>{
  const server=http.createServer((req,res)=>{
    const name=new URL(req.url,'http://x').pathname,file=path.join(root,name==='/'?'index.html':name);
    if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const launch={headless:true};if(process.env.PWA_BROWSER_PATH){launch.executablePath=process.env.PWA_BROWSER_PATH;launch.args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'];}
  const browser=await chromium.launch(launch);fs.mkdirSync(out,{recursive:true});
  for(const shot of shots){
    const context=await browser.newContext({viewport:shot.viewport,deviceScaleFactor:shot.scale,isMobile:shot.mobile,hasTouch:shot.mobile,colorScheme:shot.theme,serviceWorkers:'block'});
    const page=await context.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(()=>document.getElementById('storageBoot').hidden);
    if(shot.open){await page.locator('#contentArea .main-word-toggle').first().click();await page.waitForSelector('#contentArea .main-word-card.open');}
    await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
    await page.screenshot({path:path.join(out,shot.file)});
    console.log(`${shot.file}  ${shot.viewport.width*shot.scale}x${shot.viewport.height*shot.scale}`);
    await context.close();
  }
  await browser.close();server.close();
})().catch(error=>{console.error(error);process.exit(1);});
