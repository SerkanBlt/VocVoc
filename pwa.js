/* VocVoc PWA 1.0: bootstrap recovery, backup and controlled worker updates. */
'use strict';
const PWA_TEXT={
 tr:{backup:'Veri yedeği (JSON)',export:'Dışa aktar',import:'Yedeği geri yükle',restore:'Bu yedek mevcut kelime, ilerleme ve ayarların yerini alacak. Mevcut verinin kurtarma kopyası saklanacak. Devam edilsin mi?',invalidData:'Veri geçersiz veya uyumsuz. Mevcut veriler değiştirilmedi.',storage:'Veri kaydedilemedi. Mevcut kayıtlar korunuyor. Depolama alanını ve tarayıcı izinlerini kontrol edin.',boot:'Veritabanı açılamadı. Eski verileri silmeyin. Diğer VocVoc sekmelerini kapatıp yeniden deneyin; JSON yedeği alabilirsiniz.',conflict:'Veriler başka bir sekmede değişti. Devam etmeden önce sayfayı yenileyin.',update:'Yeni sürüm hazır',reload:'Yenile',later:'Daha sonra',busy:'Önce açık işlemi tamamlayın veya paneli kapatın.',offline:'İnternet bağlantısı gerekiyor. Kayıtlı kelimelerle çevrimdışı çalışabilirsiniz.',retry:'Yeniden dene',persistWarn:"Verileriniz bu cihazda saklanır; tarayıcı bunların süresiz korunacağını garanti etmiyor. Düzenli olarak JSON yedeği almanız önerilir.",startup:"Arayüz başlatılamadı. Kayıtlı verileriniz silinmedi. Sayfayı yenileyin; sorun sürerse JSON yedeği alın.",updateStuck:"Güncelleme şu an etkinleştirilemedi. Verileriniz korunuyor; sayfayı yenileyip tekrar deneyin.",persistIos:" iPhone/iPad’de Safari’den “Ana Ekrana Ekle” ile kurmak verinin silinme riskini azaltır."},
 en:{backup:'Data backup (JSON)',export:'Export',import:'Restore backup',restore:'This backup will replace your words, progress and settings. A recovery copy of your current data will be retained. Continue?',invalidData:'Invalid or incompatible data. Existing data was not changed.',storage:'Could not save data. Existing records are preserved. Check storage space and browser permissions.',boot:'Could not open the database. Do not delete old data. Close other VocVoc tabs and retry; you can export a JSON backup.',conflict:'Data changed in another tab. Reload before continuing.',update:'New version ready',reload:'Reload',later:'Later',busy:'Finish the current operation or close the panel first.',offline:'Internet connection required. Saved words remain available offline.',retry:'Retry',persistWarn:"Your data is stored on this device; the browser does not guarantee to keep it indefinitely. Exporting a JSON backup from time to time is recommended.",startup:"The interface could not start. Your saved data was not changed. Reload the page; if it persists, export a JSON backup.",updateStuck:"The update could not be activated right now. Your data is safe; reload the page and try again.",persistIos:" On iPhone/iPad, installing via Safari “Add to Home Screen” lowers the risk of data being cleared."},
 fr:{backup:'Sauvegarde (JSON)',export:'Exporter',import:'Restaurer',restore:'Cette sauvegarde remplacera vos mots, progrès et réglages. Une copie de récupération sera conservée. Continuer ?',invalidData:'Données invalides ou incompatibles. Aucune donnée modifiée.',storage:'Enregistrement impossible. Les données existantes sont conservées. Vérifiez le stockage et les autorisations.',boot:'Base inaccessible. Ne supprimez pas les anciennes données. Fermez les autres onglets et réessayez ; une sauvegarde JSON est possible.',conflict:'Données modifiées dans un autre onglet. Rechargez la page.',update:'Nouvelle version disponible',reload:'Recharger',later:'Plus tard',busy:'Terminez l’opération ou fermez le panneau.',offline:'Connexion Internet requise. Les mots enregistrés restent disponibles hors ligne.',retry:'Réessayer',persistWarn:"Vos données sont stockées sur cet appareil ; le navigateur ne garantit pas de les conserver indéfiniment. Il est recommandé d’exporter régulièrement une sauvegarde JSON.",startup:"L’interface n’a pas pu démarrer. Vos données enregistrées n’ont pas été modifiées. Rechargez la page ; si le problème persiste, exportez une sauvegarde JSON.",updateStuck:"La mise à jour n’a pas pu être activée pour le moment. Vos données sont conservées ; rechargez la page et réessayez.",persistIos:" Sur iPhone/iPad, l’installation via Safari « Sur l’écran d’accueil » réduit le risque d’effacement."},
 de:{backup:'Datensicherung (JSON)',export:'Exportieren',import:'Wiederherstellen',restore:'Die Sicherung ersetzt Wörter, Fortschritt und Einstellungen. Eine Wiederherstellungskopie wird behalten. Fortfahren?',invalidData:'Ungültige oder inkompatible Daten. Bestehende Daten unverändert.',storage:'Speichern fehlgeschlagen. Vorhandene Daten bleiben erhalten. Speicherplatz und Berechtigungen prüfen.',boot:'Datenbank nicht verfügbar. Alte Daten nicht löschen. Andere Tabs schließen und erneut versuchen; JSON-Sicherung möglich.',conflict:'Daten wurden in einem anderen Tab geändert. Bitte neu laden.',update:'Neue Version verfügbar',reload:'Neu laden',later:'Später',busy:'Vorgang abschließen oder Panel schließen.',offline:'Internet erforderlich. Gespeicherte Wörter bleiben offline verfügbar.',retry:'Erneut versuchen',persistWarn:"Ihre Daten werden auf diesem Gerät gespeichert; der Browser garantiert nicht, sie unbegrenzt zu behalten. Eine regelmäßige JSON-Sicherung wird empfohlen.",startup:"Die Oberfläche konnte nicht starten. Ihre gespeicherten Daten wurden nicht verändert. Seite neu laden; bei anhaltendem Problem JSON-Sicherung exportieren.",updateStuck:"Das Update konnte gerade nicht aktiviert werden. Ihre Daten sind sicher; Seite neu laden und erneut versuchen.",persistIos:" Auf iPhone/iPad verringert die Installation über Safari „Zum Home-Bildschirm“ das Risiko, dass Daten gelöscht werden."},
 es:{backup:'Copia de datos (JSON)',export:'Exportar',import:'Restaurar',restore:'La copia reemplazará palabras, progreso y ajustes. Se conservará una copia de recuperación. ¿Continuar?',invalidData:'Datos inválidos o incompatibles. No se modificaron los datos.',storage:'No se pudo guardar. Se conservan los datos. Comprueba espacio y permisos.',boot:'Base no disponible. No borres datos antiguos. Cierra otras pestañas y reintenta; puedes exportar JSON.',conflict:'Datos cambiados en otra pestaña. Recarga antes de continuar.',update:'Nueva versión disponible',reload:'Recargar',later:'Más tarde',busy:'Termina la operación o cierra el panel.',offline:'Se requiere Internet. Las palabras guardadas siguen disponibles sin conexión.',retry:'Reintentar',persistWarn:"Tus datos se guardan en este dispositivo; el navegador no garantiza conservarlos indefinidamente. Se recomienda exportar una copia JSON de vez en cuando.",startup:"No se pudo iniciar la interfaz. Tus datos guardados no se modificaron. Recarga la página; si persiste, exporta una copia JSON.",updateStuck:"No se pudo activar la actualización ahora. Tus datos están a salvo; recarga la página e inténtalo de nuevo.",persistIos:" En iPhone/iPad, instalar desde Safari con «Añadir a pantalla de inicio» reduce el riesgo de que se borren los datos."},
 it:{backup:'Backup dati (JSON)',export:'Esporta',import:'Ripristina',restore:'Il backup sostituirà parole, progressi e impostazioni. Una copia di recupero verrà conservata. Continuare?',invalidData:'Dati non validi o incompatibili. Dati esistenti invariati.',storage:'Salvataggio non riuscito. Dati conservati. Controlla spazio e autorizzazioni.',boot:'Database non disponibile. Non eliminare i vecchi dati. Chiudi le altre schede e riprova; puoi esportare JSON.',conflict:'Dati modificati in un’altra scheda. Ricarica prima di continuare.',update:'Nuova versione pronta',reload:'Ricarica',later:'Più tardi',busy:'Completa l’operazione o chiudi il pannello.',offline:'Connessione Internet richiesta. Le parole salvate restano disponibili offline.',retry:'Riprova',persistWarn:"I tuoi dati sono salvati su questo dispositivo; il browser non garantisce di conservarli a tempo indeterminato. Si consiglia di esportare ogni tanto un backup JSON.",startup:"Impossibile avviare l’interfaccia. I dati salvati non sono stati modificati. Ricarica la pagina; se persiste, esporta un backup JSON.",updateStuck:"Non è stato possibile attivare l’aggiornamento ora. I dati sono al sicuro; ricarica la pagina e riprova.",persistIos:" Su iPhone/iPad, installare da Safari con «Aggiungi alla schermata Home» riduce il rischio di cancellazione dei dati."}
};
function pwaText(key){
  let language='tr';try{language=getAppLanguage();}catch(_){try{const saved=JSON.parse(LocalStorageAdapter.getRaw('VOCVOC_DB_V1'))?.settings;language=saved?.appLanguage||saved?.nativeLanguage||LocalStorageAdapter.getRaw('NATIVE_LANGUAGE')||'tr';}catch(_){}}
  return (PWA_TEXT[language]||PWA_TEXT.en)[key]||PWA_TEXT.en[key]||key;
}
const STORAGE_ERROR_NAMES=['QuotaExceededError','AbortError','UnknownError','InvalidStateError','ConstraintError','SecurityError'];
const isStorageFailure=error=>!!error?.storageCode||STORAGE_ERROR_NAMES.includes(error?.name);
function reportStorageError(error){showError(pwaText(error?.storageCode==='conflict'?'conflict':error?.storageCode==='invalidData'?'invalidData':'storage'));}
// Startup failure screen. Database problems and interface (render) problems get different messages:
// a UI bug must never tell the user that their data is unavailable. `initialization` marks the DB-open phase.
function showStorageBootError(error,{initialization=false}={}){
  const storage=initialization||isStorageFailure(error);
  if(!storage)console.error('VocVoc interface startup failed',error);
  document.getElementById('storageBootMessage').textContent=pwaText(!storage?'startup':error?.storageCode==='invalidData'?'invalidData':'boot');
  const retry=document.getElementById('storageRetry');retry.hidden=false;retry.textContent=pwaText('retry');
  const backup=document.getElementById('legacyBackup');backup.hidden=false;
  // Database failed: only the retained pre-migration source can be exported. Interface failed: the DB is open, export it.
  backup.onclick=storage?exportLegacyBackup:exportVocVocData;
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
    if(file.size>VocVocStorage.maxImportBytes)throw VocVocStorage.fail('invalidData');
    const {backup:data}=VocVocStorage.parseBackup(await file.text(),file.size);
    if(!confirm(pwaText('restore')))return;
    if(dailyBusy||geminiControllers.size||VocVocData.pending){showError(pwaText('busy'));return;}
    // Prevent actions from crossing the restore boundary; publish only after commit.
    document.querySelector('.container').inert=true;document.getElementById('modalOverlay').inert=true;
    invalidateAsyncWork();await VocVocData.import(data);location.reload();
  }catch(error){document.querySelector('.container').inert=false;document.getElementById('modalOverlay').inert=false;reportStorageError(error?.storageCode?error:VocVocStorage.fail('invalidData'));}
}
const PWA_ACTIVATE_TIMEOUT_MS=8000,PWA_UPDATE_CHECK_MS=60*60*1000;
// Retry on the startup-failure screen. A failed start is exactly when a newer deploy may carry the fix, and a plain
// reload keeps the old worker (and therefore the old shell): look for an update and let a waiting worker take over first.
async function retryStartup(){
  const reload=()=>location.reload();
  try{
    const reg=await navigator.serviceWorker?.getRegistration('./');
    if(reg){
      await reg.update().catch(()=>{});
      const installing=reg.installing;
      if(installing&&installing.state==='installing')await new Promise(resolve=>{installing.addEventListener('statechange',()=>{if(installing.state!=='installing')resolve();});setTimeout(resolve,5000);});
      if(reg.waiting){navigator.serviceWorker.addEventListener('controllerchange',reload,{once:true});reg.waiting.postMessage({type:'ACTIVATE_UPDATE'});setTimeout(reload,4000);return;}
    }
  }catch(_){}
  reload();
}
// Another tab committed. While this tab is idle it simply adopts the new data. The "reload" banner is only for the cases where that
// is not safe (something is open or in flight here, so swapping the data underneath could lose work) or where adopting failed.
let externalSyncRunning=false,externalSyncAgain=false;
async function syncExternalCommit(detail){
  if(Number.isSafeInteger(detail?.revision)&&detail.revision<=VocVocStorage.adapter.revision)return;     // already known
  if(externalSyncRunning){externalSyncAgain=true;return;}
  externalSyncRunning=true;
  try{
    do{
      externalSyncAgain=false;
      if(operationBusy()){showPwaUpdate(true);return;}
      await adoptExternalChange();
      const host=document.getElementById('pwaUpdate');if(host?.dataset.kind==='external')host.remove();
    }while(externalSyncAgain);
  }catch(error){console.warn('VocVoc could not adopt the change made in another tab',error);showPwaUpdate(true);}
  finally{externalSyncRunning=false;}
}
let pwaRegistration=null,pwaReloadRequested=false;
function showPwaUpdate(external=false){
  let host=document.getElementById('pwaUpdate');if(!host){host=document.createElement('div');host.id='pwaUpdate';host.setAttribute('role','status');document.body.append(host);}
  host.replaceChildren();host.dataset.kind=external?'external':'update';const panel=document.createElement('div');panel.className='ui-panel';const label=document.createElement('span');label.textContent=pwaText(external?'conflict':'update');panel.append(label);
  const reload=document.createElement('button');reload.className='ui-button ui-button-secondary';reload.textContent=pwaText('reload');reload.onclick=async()=>{
    if(operationBusy()){showError(pwaText('busy'));return;}
    document.querySelector('.container').inert=true;await VocVocData.flush();
    if(!external&&pwaRegistration?.waiting){
      pwaReloadRequested=true;pwaRegistration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
      // Normally controllerchange reloads within milliseconds. If the worker never takes over, hand the interface back
      // (and ignore a late takeover) instead of leaving it inert forever.
      setTimeout(()=>{if(!pwaReloadRequested)return;pwaReloadRequested=false;document.querySelector('.container').inert=false;showError(pwaText('updateStuck'));},PWA_ACTIVATE_TIMEOUT_MS);
    }else location.reload();
  };panel.append(reload);const later=document.createElement('button');later.className='ui-panel-close';later.textContent='×';later.setAttribute('aria-label',pwaText('later'));later.onclick=()=>host.remove();panel.append(later);host.append(panel);
}
// Ask the browser to exempt this origin from eviction; otherwise warn in the backup section.
async function updatePersistNotice(){
  const note=document.getElementById('persistNotice');if(!note)return;
  let persisted=false;try{persisted=!!(await navigator.storage?.persisted?.());}catch(_){}
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const installed=navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)').matches;
  note.textContent=pwaText('persistWarn')+(ios&&!installed?pwaText('persistIos'):'');note.hidden=persisted;
}
function requestPersistence(){
  window.removeEventListener('click',requestPersistence);window.removeEventListener('keydown',requestPersistence);
  (async()=>{try{if(navigator.storage?.persist&&!await navigator.storage.persisted())await navigator.storage.persist();}catch(_){}updatePersistNotice();})();
}
function refreshPwaLabels(){
  for(const [id,key] of Object.entries({backupLabel:'backup',exportDataBtn:'export',importDataBtn:'import'}))document.getElementById(id).textContent=pwaText(key);
  document.getElementById('recoveryDataBtn').title=pwaText('restore');
  updatePersistNotice();
}
function initPwaControls(){
  refreshPwaLabels();
  document.getElementById('backupControls')?.addEventListener('toggle',updatePersistNotice);
  // Persistence is requested on the first user gesture (some browsers prompt), not at load.
  window.addEventListener('click',requestPersistence);window.addEventListener('keydown',requestPersistence);
  if('BroadcastChannel' in window){const channel=new BroadcastChannel('vocvoc-storage-v1');window.addEventListener('vocvoc-storage-committed',event=>channel.postMessage(event.detail));channel.onmessage=event=>syncExternalCommit(event.data);}
  window.addEventListener('vocvoc-storage-external',()=>showPwaUpdate(true));
  if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(pwaReloadRequested)location.reload();});
  navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{
    pwaRegistration=reg;if(reg.waiting)showPwaUpdate();
    reg.addEventListener('updatefound',()=>{const installing=reg.installing;installing?.addEventListener('statechange',()=>{if(installing.state==='installed'&&navigator.serviceWorker.controller)showPwaUpdate();});});
    reg.update().catch(()=>{});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update().catch(()=>{});});
    setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine!==false)reg.update().catch(()=>{});},PWA_UPDATE_CHECK_MS);
  }).catch(error=>{
    // Registration failed (not "you are offline" unless we really are): the app keeps working, just without offline support.
    console.warn('VocVoc Service Worker could not be registered',error);
    if(navigator.onLine===false)showError(pwaText('offline'));
  });
}
window.addEventListener('unhandledrejection',event=>{if(isStorageFailure(event.reason)){event.preventDefault();reportStorageError(event.reason);}});
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
