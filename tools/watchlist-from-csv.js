/* Builds watchlist/default.json, the list every learner starts with in the Watch/Listen list, from a CSV export of a YouTube channel's videos
   (columns "Video Title", "Video URL" and "Publish Date"; the other columns are ignored).
     node tools/watchlist-from-csv.js <file.csv> [--out watchlist/default.json] [--name "ListenEF"] [--channel https://www.youtube.com/@listenef/videos]
   The videos are written oldest first. The URL column is used (not "Video ID": a spreadsheet can put a stray ' in front of an ID that starts with "-"),
   each video once, only https/http addresses. The file is plain JSON and can be edited by hand afterwards: the app adds the links it has not offered
   to a learner before, so new lines reach everyone once, and a link a learner deleted does not come back. */
'use strict';
const fs=require('fs'),path=require('path');

// A CSV with quoted fields (commas, doubled quotes and line breaks inside quotes), with or without a byte order mark.
function parseCsv(text){
  if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quoted){
      if(char==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}
      else field+=char;
    }else if(char==='"')quoted=true;
    else if(char===','){row.push(field);field='';}
    else if(char==='\n'||char==='\r'){if(char==='\r'&&text[i+1]==='\n')i++;row.push(field);field='';if(row.length>1||row[0]!=='')rows.push(row);row=[];}
    else field+=char;
  }
  if(field!==''||row.length){row.push(field);rows.push(row);}
  return rows;
}

const TITLE_MAX=120;
function build(csvText,{name='',channel=''}={}){
  const rows=parseCsv(csvText),head=rows[0]||[],column=title=>head.indexOf(title);
  const [titleAt,urlAt,dateAt]=['Video Title','Video URL','Publish Date'].map(column);
  if(titleAt<0||urlAt<0)throw new Error('the CSV needs the columns "Video Title" and "Video URL"');
  const seen=new Set(),items=[],skipped=[];
  for(const row of rows.slice(1)){
    let url;
    try{url=new URL(String(row[urlAt]||'').trim());}catch(_){skipped.push(row[titleAt]);continue;}
    if(url.protocol!=='https:'&&url.protocol!=='http:'){skipped.push(row[titleAt]);continue;}
    if(seen.has(url.href))continue;
    seen.add(url.href);
    const date=String(row[dateAt]||'').slice(0,10);
    items.push({title:String(row[titleAt]||'').replace(/\s+/g,' ').trim().slice(0,TITLE_MAX),url:url.href,published:/^\d{4}-\d{2}-\d{2}$/.test(date)?date:''});
  }
  items.sort((a,b)=>(a.published||'9999').localeCompare(b.published||'9999'));        // oldest first; the sort is stable, so the CSV order decides between equal days
  for(const item of items)if(!item.published)delete item.published;
  return {skipped,text:serialize({name,channel,order:'oldest first',items})};
}
// One video per line, so a change shows up as one line in a diff.
function serialize({name,channel,order,items}){
  const head=[['name',name],['channel',channel],['order',order]].map(([key,value])=>`  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  return `{\n${head.join('\n')}\n  "items": [\n${items.map(item=>'    '+JSON.stringify(item)).join(',\n')}\n  ]\n}\n`;
}
module.exports={parseCsv,build,serialize};

if(require.main===module){
  const args=process.argv.slice(2),flag=key=>{const at=args.indexOf(key);return at>=0?args[at+1]:null;};
  const input=args.find((value,index)=>!value.startsWith('--')&&(index===0||!args[index-1].startsWith('--')));
  if(!input){console.error('usage: node tools/watchlist-from-csv.js <file.csv> [--out file] [--name text] [--channel url]');process.exit(1);}
  const out=path.resolve(flag('--out')||path.join(__dirname,'..','watchlist','default.json'));
  const {skipped,text}=build(fs.readFileSync(input,'utf8'),{name:flag('--name')||'',channel:flag('--channel')||''});
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,text);
  const count=JSON.parse(text).items.length;
  console.log(`${count} links written to ${out}`+(skipped.length?` (${skipped.length} rows without a usable address skipped)`:''));
}
