/* Run in the ORIGINAL SPA's browser console (same origin as the old data).
   Downloads Schema v1 only; never includes the separate API-key storage. */
(()=>{
  const raw=localStorage.getItem('VOCVOC_DB_V1');if(!raw)throw new Error('VOCVOC_DB_V1 not found on this origin.');
  const db=JSON.parse(raw);if(db.schemaVersion!==1)throw new Error('Expected Schema v1.');
  const backup={exportVersion:1,exportedAt:new Date().toISOString()};
  for(const key of ['schemaVersion','meta','settings','words','aliases','progress','dailyUsage'])backup[key]=db[key];
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='VocVoc-SPA-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
})();
