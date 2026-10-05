/* VocVoc PWA 1.0: bootstrap recovery, backup and controlled worker updates. */
'use strict';
const PWA_TEXT={
 tr:{backup:'Veri yedeği (JSON)',export:'Dışa aktar',import:'Yedeği geri yükle',restore:'Bu yedek mevcut kelime, ilerleme ve ayarların yerini alacak. Mevcut verinin kurtarma kopyası saklanacak. Devam edilsin mi?',invalidData:'Veri geçersiz veya uyumsuz. Mevcut veriler değiştirilmedi.',storage:'Veri kaydedilemedi. Mevcut kayıtlar korunuyor. Depolama alanını ve tarayıcı izinlerini kontrol edin.',boot:'Veritabanı açılamadı. Eski verileri silmeyin. Diğer VocVoc sekmelerini kapatıp yeniden deneyin; JSON yedeği alabilirsiniz.',conflict:'Veriler başka bir sekmede değişti. Devam etmeden önce sayfayı yenileyin.',update:'Yeni sürüm hazır',reload:'Yenile',later:'Daha sonra',busy:'Önce açık işlemi tamamlayın veya paneli kapatın.',offline:'İnternet bağlantısı gerekiyor. Kayıtlı kelimelerle çevrimdışı çalışabilirsiniz.',retry:'Yeniden dene'},
 en:{backup:'Data backup (JSON)',export:'Export',import:'Restore backup',restore:'This backup will replace your words, progress and settings. A recovery copy of your current data will be retained. Continue?',invalidData:'Invalid or incompatible data. Existing data was not changed.',storage:'Could not save data. Existing records are preserved. Check storage space and browser permissions.',boot:'Could not open the database. Do not delete old data. Close other VocVoc tabs and retry; you can export a JSON backup.',conflict:'Data changed in another tab. Reload before continuing.',update:'New version ready',reload:'Reload',later:'Later',busy:'Finish the current operation or close the panel first.',offline:'Internet connection required. Saved words remain available offline.',retry:'Retry'},
 fr:{backup:'Sauvegarde (JSON)',export:'Exporter',import:'Restaurer',restore:'Cette sauvegarde remplacera vos mots, progrès et réglages. Une copie de récupération sera conservée. Continuer ?',invalidData:'Données invalides ou incompatibles. Aucune donnée modifiée.',storage:'Enregistrement impossible. Les données existantes sont conservées. Vérifiez le stockage et les autorisations.',boot:'Base inaccessible. Ne supprimez pas les anciennes données. Fermez les autres onglets et réessayez ; une sauvegarde JSON est possible.',conflict:'Données modifiées dans un autre onglet. Rechargez la page.',update:'Nouvelle version disponible',reload:'Recharger',later:'Plus tard',busy:'Terminez l’opération ou fermez le panneau.',offline:'Connexion Internet requise. Les mots enregistrés restent disponibles hors ligne.',retry:'Réessayer'},
 de:{backup:'Datensicherung (JSON)',export:'Exportieren',import:'Wiederherstellen',restore:'Die Sicherung ersetzt Wörter, Fortschritt und Einstellungen. Eine Wiederherstellungskopie wird behalten. Fortfahren?',invalidData:'Ungültige oder inkompatible Daten. Bestehende Daten unverändert.',storage:'Speichern fehlgeschlagen. Vorhandene Daten bleiben erhalten. Speicherplatz und Berechtigungen prüfen.',boot:'Datenbank nicht verfügbar. Alte Daten nicht löschen. Andere Tabs schließen und erneut versuchen; JSON-Sicherung möglich.',conflict:'Daten wurden in einem anderen Tab geändert. Bitte neu laden.',update:'Neue Version verfügbar',reload:'Neu laden',later:'Später',busy:'Vorgang abschließen oder Panel schließen.',offline:'Internet erforderlich. Gespeicherte Wörter bleiben offline verfügbar.',retry:'Erneut versuchen'},
 es:{backup:'Copia de datos (JSON)',export:'Exportar',import:'Restaurar',restore:'La copia reemplazará palabras, progreso y ajustes. Se conservará una copia de recuperación. ¿Continuar?',invalidData:'Datos inválidos o incompatibles. No se modificaron los datos.',storage:'No se pudo guardar. Se conservan los datos. Comprueba espacio y permisos.',boot:'Base no disponible. No borres datos antiguos. Cierra otras pestañas y reintenta; puedes exportar JSON.',conflict:'Datos cambiados en otra pestaña. Recarga antes de continuar.',update:'Nueva versión disponible',reload:'Recargar',later:'Más tarde',busy:'Termina la operación o cierra el panel.',offline:'Se requiere Internet. Las palabras guardadas siguen disponibles sin conexión.',retry:'Reintentar'},
 it:{backup:'Backup dati (JSON)',export:'Esporta',import:'Ripristina',restore:'Il backup sostituirà parole, progressi e impostazioni. Una copia di recupero verrà conservata. Continuare?',invalidData:'Dati non validi o incompatibili. Dati esistenti invariati.',storage:'Salvataggio non riuscito. Dati conservati. Controlla spazio e autorizzazioni.',boot:'Database non disponibile. Non eliminare i vecchi dati. Chiudi le altre schede e riprova; puoi esportare JSON.',conflict:'Dati modificati in un’altra scheda. Ricarica prima di continuare.',update:'Nuova versione pronta',reload:'Ricarica',later:'Più tardi',busy:'Completa l’operazione o chiudi il pannello.',offline:'Connessione Internet richiesta. Le parole salvate restano disponibili offline.',retry:'Riprova'}
};
function pwaText(key){
  let language='tr';try{language=VocVocData.getSettings().nativeLanguage;}catch(_){try{language=JSON.parse(LocalStorageAdapter.getRaw('VOCVOC_DB_V1'))?.settings?.nativeLanguage||LocalStorageAdapter.getRaw('NATIVE_LANGUAGE')||'tr';}catch(_){}}
  return (PWA_TEXT[language]||PWA_TEXT.en)[key]||PWA_TEXT.en[key]||key;
}
function reportStorageError(error){showError(pwaText(error?.storageCode==='conflict'?'conflict':error?.storageCode==='invalidData'?'invalidData':'storage'));}
function showStorageBootError(error){
  document.getElementById('storageBootMessage').textContent=pwaText(error?.storageCode==='invalidData'?'invalidData':'boot');
  const retry=document.getElementById('storageRetry');retry.hidden=false;retry.textContent=pwaText('retry');document.getElementById('legacyBackup').hidden=false;
}
function downloadBackup(value){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`VocVoc-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportRecoveryBackup(){try{const backup=await VocVocData.recoveryExport();if(!backup){showError(pwaText('invalidData'));return;}downloadBackup(backup);}catch(error){reportStorageError(error);}}
async function exportVocVocData(){try{downloadBackup(await VocVocData.export());}catch(error){reportStorageError(error);}}
function exportLegacyBackup(){
  try{const db=JSON.parse(LocalStorageAdapter.getRaw(VOCVOC_DB_KEY));VocVocStorage.validate(db);downloadBackup({exportVersion:1,exportedAt:new Date().toISOString(),...db});}
  catch(_){showError(pwaText('invalidData'));}
}
function operationBusy(){
  return VocVocData.pending>0||dailyBusy||geminiControllers.size>0||!!quizSession||!!pendingArchiveUndo||!!flipSession||
    [...document.querySelectorAll('.modal-overlay,.word-popup-overlay,#archiveOverlay')].some(el=>getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden');
}
async function importVocVocData(input){
  const file=input.files?.[0];input.value='';if(!file)return;
  try{
    if(file.size>50*1024*1024)throw VocVocStorage.fail('invalidData');
    const data=JSON.parse(await file.text());
    if(data.exportVersion!==1)throw VocVocStorage.fail('invalidData');
    const {exportVersion,exportedAt,...db}=data;VocVocStorage.validate(db);
    if(!confirm(pwaText('restore')))return;
    if(dailyBusy||geminiControllers.size||VocVocData.pending){showError(pwaText('busy'));return;}
    // Prevent actions from crossing the restore boundary; publish only after commit.
    document.querySelector('.container').inert=true;document.getElementById('modalOverlay').inert=true;
    invalidateAsyncWork();await VocVocData.import(data);location.reload();
  }catch(error){document.querySelector('.container').inert=false;document.getElementById('modalOverlay').inert=false;reportStorageError(error?.storageCode?error:VocVocStorage.fail('invalidData'));}
}
let pwaRegistration=null,pwaReloadRequested=false;
function showPwaUpdate(external=false){
  let host=document.getElementById('pwaUpdate');if(!host){host=document.createElement('div');host.id='pwaUpdate';host.setAttribute('role','status');document.body.append(host);}
  host.replaceChildren();const panel=document.createElement('div');panel.className='ui-panel';const label=document.createElement('span');label.textContent=pwaText(external?'conflict':'update');panel.append(label);
  const reload=document.createElement('button');reload.className='ui-button ui-button-secondary';reload.textContent=pwaText('reload');reload.onclick=async()=>{
    if(operationBusy()){showError(pwaText('busy'));return;}
    document.querySelector('.container').inert=true;await VocVocData.flush();
    if(!external&&pwaRegistration?.waiting){pwaReloadRequested=true;pwaRegistration.waiting.postMessage({type:'ACTIVATE_UPDATE'});}else location.reload();
  };panel.append(reload);const later=document.createElement('button');later.className='ui-panel-close';later.textContent='×';later.setAttribute('aria-label',pwaText('later'));later.onclick=()=>host.remove();panel.append(later);host.append(panel);
}
function refreshPwaLabels(){
  for(const [id,key] of Object.entries({backupLabel:'backup',exportDataBtn:'export',importDataBtn:'import'}))document.getElementById(id).textContent=pwaText(key);
  document.getElementById('recoveryDataBtn').title=pwaText('restore');
}
function initPwaControls(){
  refreshPwaLabels();
  if('BroadcastChannel' in window){const channel=new BroadcastChannel('vocvoc-storage-v1');window.addEventListener('vocvoc-storage-committed',event=>channel.postMessage(event.detail));channel.onmessage=()=>showPwaUpdate(true);}
  window.addEventListener('vocvoc-storage-external',()=>showPwaUpdate(true));
  if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(pwaReloadRequested)location.reload();});
  navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{
    pwaRegistration=reg;if(reg.waiting)showPwaUpdate();
    reg.addEventListener('updatefound',()=>{const installing=reg.installing;installing?.addEventListener('statechange',()=>{if(installing.state==='installed'&&navigator.serviceWorker.controller)showPwaUpdate();});});
    reg.update().catch(()=>{});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update().catch(()=>{});});
  }).catch(()=>showError(pwaText('offline')));
}
window.addEventListener('unhandledrejection',event=>{if(event.reason?.storageCode||['QuotaExceededError','AbortError','UnknownError','InvalidStateError','ConstraintError','SecurityError'].includes(event.reason?.name)){event.preventDefault();reportStorageError(event.reason);}});
// Read-only, opt-in release guards; never add a bootstrap render/storage pass.
window.VocVocPWARegression=Object.freeze({
  async run(){
    await VocVocData.flush();const results=[];const check=(name,value)=>results.push({name,passed:!!value});
    const exported=await VocVocData.export();check('Schema v1 export',exported.schemaVersion===1&&exported.exportVersion===1);
    const {exportVersion,exportedAt,...db}=exported;try{VocVocStorage.validate(db);check('export has no secret fields',true);}catch(_){check('export has no secret fields',false);}
    check('bootstrap layer releases pointer input',document.getElementById('storageBoot').hidden&&getComputedStyle(document.getElementById('storageBoot')).display==='none'&&!document.querySelector('.container').inert);
    check('SPA regression guards',VocVocRegression.run().passed);
    if('serviceWorker' in navigator){const scope=new URL('./',location.href).href,registrations=await navigator.serviceWorker.getRegistrations();check('one registration in application scope',registrations.filter(reg=>reg.scope===scope).length===1);}
    if('caches' in window){const owned=(await caches.keys()).filter(key=>key.startsWith('vocvoc-shell-'+encodeURIComponent(new URL('./',location.href).pathname)+'-'));check('installed shell cache exists',owned.length>0);for(const key of owned){const cache=await caches.open(key),requests=await cache.keys();check('shell cache excludes API and secret URLs',requests.every(req=>new URL(req.url).origin===location.origin&&!/[?&](?:key|api_key)=/i.test(req.url)));}}
    return {passed:results.every(item=>item.passed),results};
  }
});
