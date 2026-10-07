'use strict';
/* New interface (prototype): tab bar, screens, simulated sign-in and simulated Free/Premium plan.
   Opt-in: open the app with ?ui=v2 (remembered; ?ui=v1 or "Eski arayüze dön" turns it off). Without it this file only defines VocVocPlan
   and does nothing else, so the default interface and its tests are unaffected. Nothing here is real: there is no account, server or payment.
   The home screen is the existing one (the "Today" tab); the other tabs are full-screen pages drawn over it. No inline handlers, no innerHTML with data. */
(function(){
  const UI_KEY='VOCVOC_UI',PLAN_KEY='VOCVOC_SIM_PLAN',PROFILE_KEY='VOCVOC_SIM_PROFILE';
  const store={
    get(key){try{return localStorage.getItem(key);}catch(_){return null;}},
    set(key,value){try{localStorage.setItem(key,value);}catch(_){}},
    remove(key){try{localStorage.removeItem(key);}catch(_){}}
  };
  const param=new URLSearchParams(location.search).get('ui');
  if(param==='v2')store.set(UI_KEY,'v2');else if(param==='v1')store.remove(UI_KEY);
  const enabled=store.get(UI_KEY)==='v2';

  /* ---------- plan (simulated) ---------- */
  // 'premium' features are locked on the free plan. The user's own API key works only on the free plan: while Premium is active the
  // built-in AI is used and the stored key is kept but not used (ownKeyActive); when Premium ends the key is active again.
  const FEATURES=Object.freeze({freeWords:'free',ownKeyAi:'free',badges:'free',stats:'premium',historyAnalysis:'premium',builtInAi:'premium',sentenceBuilder:'premium',speech:'premium'});
  const planNow=()=>store.get(PLAN_KEY)==='premium'?'premium':'free';
  const VocVocPlan=Object.freeze({
    features:FEATURES,
    get:planNow,
    set(plan){
      const next=plan==='premium'?'premium':'free';if(next===planNow())return;
      if(next==='premium')store.set(PLAN_KEY,'premium');else store.remove(PLAN_KEY);
      window.dispatchEvent(new CustomEvent('vocvoc-plan-changed',{detail:{plan:next}}));
    },
    has(feature){const need=FEATURES[feature];return need==='free'||(need==='premium'&&planNow()==='premium');},
    ownKeyActive(){return planNow()!=='premium';}
  });
  window.VocVocPlan=VocVocPlan;

  /* ---------- texts (Turkish and English; the other interface languages show English) ---------- */
  const TEXT={
    tr:{
      nav:'Ana gezinme',today:'Bugün',study:'Çalış',stats:'İstatistik',badges:'Rozetler',profile:'Profil',back:'Geri',
      authTitle:'VocVoc',authSub:'Kelimelerini cihazında öğren ve tekrar et.',authName:'Görünen ad (isteğe bağlı)',authGoogle:'Google ile devam et (simülasyon)',authGuest:'Misafir olarak devam et',
      authNote:'Simülasyon: gerçek hesap ve sunucu yok. Bilgilerin yalnızca bu cihazda kalır.',demoName:'Demo Kullanıcı',
      studyTitle:'Çalış',studyTest:'Test',studyTestSub:'{n} aktif kelimeden 10 soru',studyRecall:'Hatırla',studyRecallSub:'{n} ezberlediğin kelimeyi sına',studyFlip:'Flip',studyFlipSub:'Kartları çevirerek tekrar et',
      statsTitle:'İstatistikler',badgesTitle:'Rozetler',soon:'Bu ekran bir sonraki adımda doldurulacak.',
      lockedTitle:'Premium özelliği',lockedStats:'Günlük etkinlik, test başarısı, öğrenme eğrisi ve seri gibi istatistikler Premium ile açılır.',goPremium:"Premium'a geç",
      profileTitle:'Profil',guest:'Misafir',modeGoogle:'Google (simülasyon)',modeGuest:'Bu cihazda',planFree:'Ücretsiz',planPremium:'Premium (simülasyon)',
      rowPremium:'Premium',rowSettings:'Ayarlar',rowHelp:'Yardım',rowPrivacy:'Gizlilik Politikası',rowTerms:'Kullanım Şartları',rowAbout:'Hakkında',
      signOut:'Çıkış yap (simülasyon)',signOutNote:'Çıkış, kelimelerini ve ilerlemeni silmez.',oldUi:'Eski arayüze dön',
      premiumTitle:'Premium',planLabel:'Mevcut plan',freeIncludes:'Ücretsiz',premiumIncludes:'Premium (ücretsiz olanların hepsine ek olarak)',
      priceNote:'Aylık ve yıllık abonelik olacak. Fiyatlar henüz belirlenmedi.',
      keyActive:'API anahtarı: etkin (kendi anahtarınla yeni kelime ekleyebilirsin).',keyOff:'API anahtarı: devre dışı. Premium aktif olduğu için dahili yapay zekâ kullanılır; anahtarın silinmez.',
      keyRule:'Premium aktifken kendi API anahtarın devre dışı kalır. Abonelik bitince anahtarın yeniden etkin olur.',
      simulate:"Premium'u simüle et",backToFree:'Ücretsiz plana dön',simNote:'Simülasyon: gerçek ödeme alınmaz, hiçbir şey satın alınmaz.',
      free1:'Seçtiğin dil çifti için hazır başlangıç kelimeleri',free2:'Kartlar, ezberleme, arşiv ve History',free3:'Test, Hatırla ve Flip',free4:'Kendi API anahtarınla yeni kelime ekleme',free5:'Yedekleme, tema ve 6 arayüz dili',free6:'Rozetler',
      prem1:'Dahili yapay zekâ (anahtar gerekmez)',prem2:"History'den seçtiğin kelimelerle cümle kurma ve anlamını görme",prem3:'Sesli okuma',prem4:'İlerleme istatistikleri ve geçmiş analizi',
      dashHello:'Merhaba, {name}',dashHelloGuest:'Merhaba',goalTitle:'Günlük hedef',goalValue:'{n} / {m} kelime',goalUnlimited:'Bugün {n} kelime eklendi',addDaily:'Günlük kelimeler ekle',statActive:'Aktif',statMemorized:'Ezberlenen',statToday:'Bugün ezberlenen',
      quizClose:'Kapat',quizProgress:'Soru {n}/{total}',quizDone:'Tamamlandı',quizProgressLabel:'Test ilerlemesi',quizNeedActive:'Test için en az 10 aktif kelime gerekir. Şu an {n} var.',quizNeedRecall:'Hatırla için en az 10 ezberlenmiş kelime gerekir. Şu an {n} var.',backToToday:'Bugün ekranına dön',
      aboutTitle:'Hakkında',version:'Sürüm',uiMode:'Arayüz',uiProto:'Yeni arayüz (prototip)',aboutSim:'Bu sürümdeki giriş, Premium ve ödeme ekranları simülasyondur: gerçek hesap, sunucu veya ödeme yoktur.'
    },
    en:{
      nav:'Main navigation',today:'Today',study:'Study',stats:'Stats',badges:'Badges',profile:'Profile',back:'Back',
      authTitle:'VocVoc',authSub:'Learn and review your words on your device.',authName:'Display name (optional)',authGoogle:'Continue with Google (simulation)',authGuest:'Continue as guest',
      authNote:'Simulation: there is no real account or server. Your information stays on this device.',demoName:'Demo user',
      studyTitle:'Study',studyTest:'Test',studyTestSub:'10 questions from {n} active words',studyRecall:'Recall',studyRecallSub:'Quiz yourself on {n} memorized words',studyFlip:'Flip',studyFlipSub:'Review by flipping cards',
      statsTitle:'Statistics',badgesTitle:'Badges',soon:'This screen will be filled in the next step.',
      lockedTitle:'Premium feature',lockedStats:'Statistics such as daily activity, test accuracy, the learning curve and streaks come with Premium.',goPremium:'Go Premium',
      profileTitle:'Profile',guest:'Guest',modeGoogle:'Google (simulation)',modeGuest:'On this device',planFree:'Free',planPremium:'Premium (simulation)',
      rowPremium:'Premium',rowSettings:'Settings',rowHelp:'Help',rowPrivacy:'Privacy Policy',rowTerms:'Terms of Use',rowAbout:'About',
      signOut:'Sign out (simulation)',signOutNote:'Signing out does not delete your words or progress.',oldUi:'Back to the old interface',
      premiumTitle:'Premium',planLabel:'Current plan',freeIncludes:'Free',premiumIncludes:'Premium (in addition to everything free)',
      priceNote:'It will be a monthly and a yearly subscription. Prices are not set yet.',
      keyActive:'API key: active (you can add new words with your own key).',keyOff:'API key: inactive. Premium is on, so the built-in AI is used; your key is kept.',
      keyRule:'While Premium is active your own API key is inactive. When the subscription ends your key is active again.',
      simulate:'Simulate Premium',backToFree:'Back to the free plan',simNote:'Simulation: no real payment is taken and nothing is purchased.',
      free1:'Ready-made beginner words for your language pair',free2:'Cards, memorizing, archive and History',free3:'Test, Recall and Flip',free4:'Adding new words with your own API key',free5:'Backup, themes and 6 interface languages',free6:'Badges',
      prem1:'Built-in AI (no key needed)',prem2:'Build sentences from words you pick in History and see their meaning',prem3:'Read-aloud',prem4:'Progress statistics and history analysis',
      dashHello:'Hello, {name}',dashHelloGuest:'Hello',goalTitle:'Daily goal',goalValue:'{n} / {m} words',goalUnlimited:'{n} words added today',addDaily:'Add daily words',statActive:'Active',statMemorized:'Memorized',statToday:'Memorized today',
      quizClose:'Close',quizProgress:'Question {n}/{total}',quizDone:'Finished',quizProgressLabel:'Test progress',quizNeedActive:'A Test needs at least 10 active words. You have {n}.',quizNeedRecall:'Recall needs at least 10 memorized words. You have {n}.',backToToday:'Back to Today',
      aboutTitle:'About',version:'Version',uiMode:'Interface',uiProto:'New interface (prototype)',aboutSim:'Sign-in, Premium and payment in this version are simulations: there is no real account, server or payment.'
    }
  };
  // Long texts. They describe what the app does today and are DRAFTS: contact details, controller name, age limit and a legal review are still missing.
  const PAGES={
    privacy:{
      tr:{title:'Gizlilik Politikası',banner:'Taslak. Yayınlamadan önce iletişim bilgileri, veri sorumlusu, yaş sınırı ve hukuki gözden geçirme eklenmelidir.',sections:[
        {h:'Kısaca',p:["VocVoc'ta hesap, reklam, izleme veya analiz yoktur. Kelimelerin, ilerlemen ve ayarların yalnızca bu cihazda saklanır."]},
        {h:'Cihazında saklananlar',p:['Kelime listen, ezber ve arşiv durumun ve ayarların tarayıcının yerel depolamasında (IndexedDB ve localStorage) tutulur ve bize gönderilmez.','Yedeği sen dışa aktarırsın; dosya senin kontrolündedir. Verileri silmek için Ayarlar\'daki "İlerlemeyi sıfırla"yı kullan ya da uygulamanın/tarayıcının verilerini temizle.']},
        {h:'Yapay zekâ (kendi anahtarınla)',p:['Yeni bir kelime aradığında veya günlük kelime istediğinde, yazdığın kelime ve istem Google\'ın Gemini API\'sine gönderilir. Bu istek senin kendi API anahtarınla yapılır ve Google\'ın koşullarına tabidir.','API anahtarın yalnızca bu cihazda saklanır, yalnızca Google\'a giden istekte kullanılır ve dışa aktarılan yedeklere girmez.']},
        {h:'Premium (planlanan)',p:['Premium abonelik Google Play üzerinden satın alınır; ödeme bilgilerini biz görmeyiz. Dahili yapay zekâ kullanıldığında istekler bizim sunucumuz üzerinden Google\'a iletilecektir. Bu bölüm Premium yayınlanmadan önce güncellenecektir. Bu sürümde gerçek ödeme ve sunucu yoktur (simülasyon).']},
        {h:'İletişim',p:['[destek e-postası eklenecek]']}]},
      en:{title:'Privacy Policy',banner:'Draft. Contact details, the data controller, an age limit and a legal review must be added before release.',sections:[
        {h:'In short',p:['VocVoc has no accounts, ads, tracking or analytics. Your words, progress and settings are stored only on this device.']},
        {h:'What stays on your device',p:["Your word list, memorized and archive status and settings are kept in the browser's local storage (IndexedDB and localStorage) and are not sent to us.",'You export backups yourself; the file is under your control. To delete your data use "Reset progress" in Settings or clear the app\'s or browser\'s data.']},
        {h:'AI (with your own key)',p:["When you search for a new word or ask for daily words, the word you typed and the prompt are sent to Google's Gemini API. The request is made with your own API key and is subject to Google's terms.",'Your API key is stored only on this device, is used only in the request to Google, and is never part of an exported backup.']},
        {h:'Premium (planned)',p:['A Premium subscription is bought through Google Play; we do not see your payment details. When the built-in AI is used, requests will be passed to Google through our server. This section will be updated before Premium is released. This version has no real payment or server (simulation).']},
        {h:'Contact',p:['[support e-mail to be added]']}]}
    },
    terms:{
      tr:{title:'Kullanım Şartları',banner:'Taslak. Yayınlamadan önce hukuki gözden geçirme gerekir.',sections:[
        {h:'Hizmet',p:['VocVoc kelime öğrenmene yardım eden bir uygulamadır ve olduğu gibi sunulur. Hazır kelimeler ve yapay zekâ ile üretilen içerik hatalı veya eksik olabilir.']},
        {h:'Kendi API anahtarın',p:['Kendi anahtarınla yaptığın istekler ve bunların Google tarafından ücretlendirilmesi senin sorumluluğundadır. Anahtarını başkalarıyla paylaşma.']},
        {h:'Verilerin',p:['Verilerin cihazında tutulur. Düzenli yedek almak senin sorumluluğundadır; tarayıcı verisinin silinmesi kelimelerini kaybettirebilir.']},
        {h:'Premium abonelik (planlanan)',p:['Abonelik Google Play kurallarına tabidir; iptal ve iade Google Play üzerinden yapılır. Abonelik bittiğinde Premium özellikler kapanır ve kendi API anahtarın yeniden etkin olur.']},
        {h:'Değişiklikler',p:['Bu şartlar güncellenebilir; önemli değişiklikler uygulamada duyurulur.']}]},
      en:{title:'Terms of Use',banner:'Draft. A legal review is needed before release.',sections:[
        {h:'The service',p:['VocVoc helps you learn words and is provided as is. Ready-made words and AI-generated content can be wrong or incomplete.']},
        {h:'Your own API key',p:['Requests you make with your own key, and any charges Google makes for them, are your responsibility. Do not share your key.']},
        {h:'Your data',p:["Your data is kept on your device. Taking regular backups is your responsibility; clearing the browser's data can lose your words."]},
        {h:'Premium subscription (planned)',p:['A subscription is subject to the Google Play rules; cancellation and refunds go through Google Play. When it ends, Premium features stop and your own API key is active again.']},
        {h:'Changes',p:['These terms may be updated; important changes are announced in the app.']}]}
    },
    help:{
      tr:{title:'Yardım',sections:[
        {h:'Kelime ekleme',p:['Arama kutusuna bir kelime yazıp ara düğmesine bas. Yeni kelime bulmak için kendi Gemini API anahtarına ihtiyacın var: Google AI Studio\'dan alıp Ayarlar\'a yapıştır.','"Günlük" düğmesi tek seferde 10 yeni kelime ekler, rastgele düğmesi bir kelime önerir.']},
        {h:'Kartlar ve kaydırma',p:['Ana ekranda bir kartı sağa kaydırırsan "Ezberimde" olur, sola kaydırırsan kapanır.','History penceresinde ve Flip\'te sağa kaydırmak ezberler, sola kaydırmak ezberden çıkarır.']},
        {h:'Test, Hatırla, Flip',p:['Test: aktif kelimelerinden 10 soru sorar. Hatırla: ezberlediğin kelimelerle test yapar. Flip: kartı çevirir; klavyede F çevirir, ok tuşları kart değiştirir, M ezber durumunu değiştirir.']},
        {h:'History ve Arşiv',p:["History listendeki kelimeleri gösterir; bir kelimeye dokunarak ayrıntısını aç. Arşive aldığın kelime listeden kalkar; Ayarlar'daki Arşiv'den geri alabilir veya kalıcı silebilirsin."]},
        {h:'Yedekleme',p:["Ayarlar'daki Veri yedeği bölümünden verilerini bir dosyaya aktarıp sonra geri yükleyebilirsin. Tarayıcı verisini silmek kelimelerini kaybettirebilir, düzenli yedek al. API anahtarın yedeğe girmez."]},
        {h:'İnternetsiz kullanım',p:['Kayıtlı kelimeler, Test, Hatırla ve Flip internetsiz çalışır. Yeni kelime bulmak için internet gerekir.']},
        {h:'Güncelleme uyarısı',p:['"Yeni sürüm hazır" bandında Yenile\'ye basınca "önce açık işlemi tamamlayın" uyarısı çıkarsa devam eden bir Test veya açık bir pencere vardır; onu bitirip tekrar dene.']},
        {h:'Premium (simülasyon)',p:['Bu sürümde Premium bir simülasyondur: Profil, Premium ekranından açıp kapatabilirsin. Gerçek ödeme veya sunucu yoktur.']},
        {h:'Destek',p:['[destek e-postası eklenecek]']}]},
      en:{title:'Help',sections:[
        {h:'Adding words',p:['Type a word in the search box and press the search button. To find new words you need your own Gemini API key: get it from Google AI Studio and paste it into Settings.','The "Daily" button adds 10 new words at once; the random button suggests one word.']},
        {h:'Cards and swiping',p:['On the home screen, swipe a card right to mark it memorized, or left to close it.','In the History window and in Flip, swiping right memorizes and swiping left un-memorizes.']},
        {h:'Test, Recall, Flip',p:['Test asks 10 questions from your active words. Recall tests the words you memorized. Flip turns a card over; on a keyboard F flips, the arrow keys change card and M toggles memorized.']},
        {h:'History and Archive',p:['History shows the words in your list; tap one to open its details. An archived word leaves the list; restore or delete it for good from the Archive in Settings.']},
        {h:'Backup',p:['In the Data backup section of Settings you can export your data to a file and restore it later. Clearing browser data can lose your words, so back up regularly. Your API key is not part of a backup.']},
        {h:'Offline',p:['Saved words, Test, Recall and Flip work without internet. Finding new words needs internet.']},
        {h:'Update notice',p:['If tapping Reload on the "New version ready" bar says "finish the current operation first", a Test is running or a window is open; finish it and try again.']},
        {h:'Premium (simulation)',p:['In this version Premium is a simulation: switch it on and off in Profile, Premium. There is no real payment or server.']},
        {h:'Support',p:['[support e-mail to be added]']}]}
    }
  };
  window.VocVocScreens=Object.freeze({TEXT,PAGES});

  if(!enabled)return;

  /* ---------- helpers ---------- */
  const lang=()=>{try{const code=typeof getAppLanguage==='function'?getAppLanguage():'tr';return code==='tr'?'tr':'en';}catch(_){return 'tr';}};
  const t=key=>(TEXT[lang()]||TEXT.en)[key]||TEXT.en[key]||key;
  const fill=(text,values)=>text.replace(/\{(\w+)\}/g,(_,name)=>String(values[name]));
  function h(tag,props,...kids){
    const node=document.createElement(tag);
    for(const [key,value] of Object.entries(props||{})){
      if(value==null||value===false)continue;
      if(key==='class')node.className=value;
      else if(key==='text')node.textContent=value;
      else if(key.startsWith('on'))node.addEventListener(key.slice(2),value);
      else node.setAttribute(key,value===true?'':value);
    }
    for(const kid of kids.flat(Infinity))if(kid!=null&&kid!==false)node.append(kid.nodeType?kid:document.createTextNode(String(kid)));
    return node;
  }
  const ICONS={
    today:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    study:'<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 012 2v12"/>',
    stats:'<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    badges:'<circle cx="12" cy="9" r="6"/><path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5"/>',
    profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'
  };
  function icon(name){const span=h('span',{class:'v2-icon','aria-hidden':'true'});span.innerHTML='<svg viewBox="0 0 24 24" focusable="false">'+ICONS[name]+'</svg>';return span;}

  /* ---------- profile (simulated) ---------- */
  function readProfile(){try{const value=JSON.parse(store.get(PROFILE_KEY)||'null');return value&&(value.mode==='guest'||value.mode==='google-sim')?value:null;}catch(_){return null;}}

  /* ---------- routing ---------- */
  const TABS=['today','study','stats','badges','profile'];
  const QUIZ_ROUTES=['test','recall'];
  const ROUTES=[...TABS,'test','recall','flip','premium','help','privacy','terms','about'];
  const TAB_OF={today:'today',study:'study',stats:'stats',badges:'badges',profile:'profile',test:'study',recall:'study',flip:'study',premium:'profile',help:'profile',privacy:'profile',terms:'profile',about:'profile'};
  let shown=null,internalNavigations=0,tabButtons=null,screen=null,container=null,auth=null,root=null;
  const currentRoute=()=>{const route=location.hash.replace(/^#\/?/,'');return ROUTES.includes(route)?route:'today';};
  function navigate(route){
    internalNavigations++;
    const target='#/'+route;
    if(location.hash!==target)location.hash=target;
    render(true);
  }
  const goBack=(fallback='profile')=>{if(internalNavigations>0)history.back();else navigate(fallback);};

  /* ---------- screens ---------- */
  const page=(...kids)=>h('div',{class:'v2-page',lang:lang()},kids);
  const heading=text=>h('h1',{tabindex:'-1',text});
  const backButton=()=>h('button',{type:'button',class:'v2-back',onclick:()=>goBack()},'‹ '+t('back'));
  function counts(){
    let active=0,memorized=0,memorizedToday=0;
    const today=new Date().toLocaleDateString('en-CA');                       // the local day, like the daily usage of the app
    try{
      for(const word of VocVocData.getWords()){
        const progress=VocVocData.getWordProgress(word.word);
        if(progress?.status==='memorized'){memorized++;if(progress.memorizedAt&&new Date(progress.memorizedAt).toLocaleDateString('en-CA')===today)memorizedToday++;}
        else if(progress?.status==='active')active++;
      }
    }catch(_){}
    return {active,memorized,memorizedToday};
  }
  function studyScreen(){
    const {active,memorized}=counts();
    const card=(glyph,title,sub,run)=>h('button',{type:'button',class:'v2-study-card',onclick:run},
      h('span',{class:'v2-study-glyph','aria-hidden':'true',text:glyph}),
      h('span',{},h('span',{class:'v2-study-title',text:title}),h('span',{class:'v2-study-sub',text:sub})));
    return page(heading(t('studyTitle')),
      card('◈',t('studyTest'),fill(t('studyTestSub'),{n:active}),()=>navigate('test')),
      card('↺',t('studyRecall'),fill(t('studyRecallSub'),{n:memorized}),()=>navigate('recall')),
      card('⇄',t('studyFlip'),t('studyFlipSub'),()=>navigate('flip')));
  }

  /* ---------- dashboard: the top of the Today tab, above the existing home screen ---------- */
  function dashboard(){
    const name=readProfile()?.name||'';
    const {active,memorized,memorizedToday}=counts();
    const limit=getDailyLimit(),used=getDailyUsage().count,unlimited=limit===Infinity;
    const bar=unlimited?null:h('div',{class:'v2-bar',role:'progressbar','aria-label':t('goalTitle'),'aria-valuemin':'0','aria-valuemax':String(limit),'aria-valuenow':String(Math.min(used,limit))},h('span'));
    bar?.style.setProperty('--p',Math.min(100,Math.round(used/limit*100))+'%');
    const stat=(value,label)=>h('li',{class:'v2-stat'},h('strong',{text:String(value)}),h('span',{text:label}));
    const quick=(glyph,label,route)=>h('button',{type:'button',class:'v2-quick-btn',onclick:()=>navigate(route)},h('span',{'aria-hidden':'true',text:glyph}),h('span',{text:label}));
    return h('section',{id:'v2Dashboard',class:'v2-dash','aria-labelledby':'v2DashTitle',lang:lang()},
      h('h2',{id:'v2DashTitle',text:name?fill(t('dashHello'),{name}):t('dashHelloGuest')}),
      h('div',{class:'v2-card v2-goal'},
        h('p',{class:'v2-goal-label',text:t('goalTitle')}),
        h('p',{class:'v2-goal-value',text:unlimited?fill(t('goalUnlimited'),{n:used}):fill(t('goalValue'),{n:used,m:limit})}),
        bar,
        h('button',{type:'button',class:'ui-button ui-button-success',onclick:()=>{addDailyWords();}},t('addDaily'))),
      h('ul',{class:'v2-statline'},stat(active,t('statActive')),stat(memorized,t('statMemorized')),stat(memorizedToday,t('statToday'))),
      h('div',{class:'v2-quick'},quick('◈',t('studyTest'),'test'),quick('↺',t('studyRecall'),'recall'),quick('⇄',t('studyFlip'),'flip')));
  }
  let dashboardTimer=0;
  function refreshDashboard(){                                                   // after any change of the data, once per burst
    clearTimeout(dashboardTimer);
    dashboardTimer=setTimeout(()=>{
      const current=document.getElementById('v2Dashboard');if(!current)return;
      const fresh=dashboard();fresh.hidden=current.hidden;current.replaceWith(fresh);
    },0);
  }

  /* ---------- the Test as a page of its own ---------- */
  // The Test itself is the app's own (startQuiz, answerQuiz, the result card); this page only frames it and says how far it is.
  function quizScreen(route){
    const recall=route==='recall',poolSize=(recall?getRecallQuizPool():getQuizPool()).length;
    const bar=h('div',{class:'v2-study-bar'},
      h('button',{type:'button',class:'v2-close','aria-label':t('quizClose'),onclick:()=>goBack('study')},'×'),
      h('h1',{tabindex:'-1',text:t(recall?'studyRecall':'studyTest')}),
      h('span',{id:'v2QuizCount',class:'v2-muted'}));
    if(poolSize<10)return page(bar,h('div',{class:'v2-card'},h('p',{text:fill(t(recall?'quizNeedRecall':'quizNeedActive'),{n:poolSize})}),
      h('div',{class:'v2-actions'},h('button',{type:'button',class:'ui-button ui-button-secondary',onclick:()=>navigate('today')},t('backToToday')))));
    return page(bar,
      h('div',{id:'v2QuizProgress',class:'v2-bar',role:'progressbar','aria-label':t('quizProgressLabel'),'aria-valuemin':'0','aria-valuemax':'10','aria-valuenow':'0'},h('span')),
      h('div',{id:'v2QuizHost'}));
  }
  function updateQuizProgress(){
    const bar=document.getElementById('v2QuizProgress'),label=document.getElementById('v2QuizCount');
    if(!bar||!label||!quizSession)return;
    const total=quizSession.questions.length,done=Math.min(quizSession.index,total);
    label.textContent=done>=total?t('quizDone'):fill(t('quizProgress'),{n:done+1,total});
    bar.setAttribute('aria-valuemax',String(total));bar.setAttribute('aria-valuenow',String(done));bar.style.setProperty('--p',Math.round(done/total*100)+'%');
  }
  // After a page is drawn: start what it is for.
  function afterRender(route){
    if(QUIZ_ROUTES.includes(route)){
      if((route==='recall'?getRecallQuizPool():getQuizPool()).length>=10){if(route==='recall')startRecallQuiz();else startQuiz();updateQuizProgress();}
    }else if(route==='flip'){
      startFlip();                                                                // the app's own Flip dialog, shown like a page
      if(!flipSession)goBack('study');                                            // nothing to flip: startFlip said why
    }
  }
  function lockedScreen(titleKey,textKey){
    return page(heading(t(titleKey)),h('div',{class:'v2-card v2-locked'},icon('lock'),h('h2',{text:t('lockedTitle')}),h('p',{text:t(textKey)}),
      h('div',{class:'v2-actions'},h('button',{type:'button',class:'ui-button ui-button-success',onclick:()=>navigate('premium')},t('goPremium')))));
  }
  const statsScreen=()=>VocVocPlan.has('stats')?page(heading(t('statsTitle')),h('p',{class:'v2-note',text:t('soon')})):lockedScreen('statsTitle','lockedStats');
  const badgesScreen=()=>page(heading(t('badgesTitle')),h('p',{class:'v2-note',text:t('soon')}));
  function chipFor(plan){return h('span',{class:'v2-chip'+(plan==='premium'?' v2-premium':''),text:t(plan==='premium'?'planPremium':'planFree')});}
  function profileScreen(){
    const profile=readProfile()||{mode:'guest',name:''};
    const name=profile.name||t('guest');
    const row=(label,run,end,danger)=>h('li',{},h('button',{type:'button',class:'v2-row','data-danger':danger?'':null,onclick:run},h('span',{text:label}),end?h('span',{class:'v2-row-end',text:end}):null));
    return page(heading(t('profileTitle')),
      h('div',{class:'v2-card v2-profile-head'},h('div',{class:'v2-avatar','aria-hidden':'true',text:name.trim().charAt(0).toUpperCase()||'V'}),
        h('div',{},h('p',{class:'v2-profile-name',text:name}),h('div',{},chipFor(VocVocPlan.get()),' ',h('span',{class:'v2-muted',text:t(profile.mode==='google-sim'?'modeGoogle':'modeGuest')})))),
      h('ul',{class:'v2-rows'},
        row(t('rowPremium'),()=>navigate('premium'),'›'),
        row(t('rowSettings'),()=>{openModal();},'›')),
      h('ul',{class:'v2-rows'},
        row(t('rowHelp'),()=>navigate('help'),'›'),row(t('rowPrivacy'),()=>navigate('privacy'),'›'),row(t('rowTerms'),()=>navigate('terms'),'›'),row(t('rowAbout'),()=>navigate('about'),'›')),
      h('ul',{class:'v2-rows'},
        row(t('signOut'),signOut,'',true),row(t('oldUi'),oldInterface,'')),
      h('p',{class:'v2-muted',text:t('signOutNote')}));
  }
  function premiumScreen(){
    const premium=VocVocPlan.get()==='premium',list=(keys,extra)=>h('ul',{class:'v2-feature-list'+(extra?' '+extra:'')},keys.map(key=>h('li',{text:t(key)})));
    return page(backButton(),heading(t('premiumTitle')),
      h('div',{class:'v2-card'},h('p',{},h('span',{class:'v2-muted',text:t('planLabel')+': '}),chipFor(VocVocPlan.get())),
        h('p',{text:t(VocVocPlan.ownKeyActive()?'keyActive':'keyOff')}),
        h('div',{class:'v2-actions'},premium
          ?h('button',{type:'button',class:'ui-button ui-button-secondary',onclick:()=>VocVocPlan.set('free')},t('backToFree'))
          :h('button',{type:'button',class:'ui-button ui-button-success',onclick:()=>VocVocPlan.set('premium')},t('simulate'))),
        h('p',{class:'v2-muted',text:t('simNote')})),
      h('h2',{text:t('freeIncludes')}),list(['free1','free2','free3','free4','free5','free6']),
      h('h2',{text:t('premiumIncludes')}),list(['prem1','prem2','prem3','prem4'],'v2-premium-list'),
      h('p',{class:'v2-note',text:t('keyRule')}),h('p',{class:'v2-muted',text:t('priceNote')}));
  }
  function textPage(kind){
    const content=PAGES[kind][lang()]||PAGES[kind].en;
    return page(backButton(),heading(content.title),content.banner?h('p',{class:'v2-note',text:content.banner}):null,
      content.sections.map(section=>[h('h2',{text:section.h}),section.p.map(text=>h('p',{text}))]));
  }
  function aboutScreen(){
    const version=document.querySelector('meta[name="vocvoc-shell"]')?.content||'?';
    return page(backButton(),heading(t('aboutTitle')),
      h('div',{class:'v2-card'},h('p',{},h('strong',{text:'VocVoc'})),h('p',{text:t('version')+': '+version}),h('p',{text:t('uiMode')+': '+t('uiProto')})),
      h('p',{class:'v2-note',text:t('aboutSim')}),
      h('ul',{class:'v2-rows'},[['rowHelp','help'],['rowPrivacy','privacy'],['rowTerms','terms']].map(([key,route])=>
        h('li',{},h('button',{type:'button',class:'v2-row',onclick:()=>navigate(route)},h('span',{text:t(key)}),h('span',{class:'v2-row-end',text:'›'}))))));
  }
  function build(route){
    switch(route){
      case 'study':case 'flip':return studyScreen();
      case 'test':case 'recall':return quizScreen(route);
      case 'stats':return statsScreen();
      case 'badges':return badgesScreen();
      case 'profile':return profileScreen();
      case 'premium':return premiumScreen();
      case 'help':case 'privacy':case 'terms':return textPage(route);
      case 'about':return aboutScreen();
      default:return null;
    }
  }

  /* ---------- render ---------- */
  function render(moveFocus){
    const route=currentRoute();shown=route;
    const tab=TAB_OF[route];
    // Leaving the study pages ends what they started: a Test that was left is abandoned, an open Flip is closed.
    if(!QUIZ_ROUTES.includes(route)&&quizSession)quizSession=null;
    if(route!=='flip'&&flipSession)closeFlip();
    document.body.classList.toggle('v2-immersive',QUIZ_ROUTES.includes(route));
    tabButtons.forEach(button=>{
      button.querySelector('.v2-tab-label').textContent=t(button.dataset.tab);
      if(button.dataset.tab===tab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    root.querySelector('.v2-tabs').setAttribute('aria-label',t('nav'));
    if(route==='today'){
      container.classList.remove('v2-away');screen.hidden=true;screen.replaceChildren();delete screen.dataset.route;
      refreshDashboard();
      return;
    }
    container.classList.add('v2-away');screen.hidden=false;screen.dataset.route=route;
    screen.replaceChildren(build(route));screen.scrollTop=0;
    afterRender(route);
    // The Test and Flip put focus on their own first control (the app's keyboard design); every other page takes it on its heading.
    if(moveFocus&&!QUIZ_ROUTES.includes(route)&&route!=='flip')screen.querySelector('h1')?.focus({preventScroll:true});
  }

  /* ---------- simulated sign-in ---------- */
  function setBackgroundInert(inert){root.inert=inert;if(container)container.inert=inert;}
  function openAuth(){
    auth.replaceChildren(h('div',{class:'v2-auth-card',lang:lang()},
      h('h1',{id:'v2AuthTitle',tabindex:'-1',text:t('authTitle')}),h('p',{text:t('authSub')}),
      h('div',{class:'v2-field'},h('label',{for:'v2AuthName',text:t('authName')}),h('input',{id:'v2AuthName',class:'ui-input',type:'text',maxlength:'40',autocomplete:'off'})),
      h('div',{class:'v2-auth-buttons'},
        h('button',{type:'button',class:'ui-button ui-button-success',onclick:()=>finishAuth('google-sim')},t('authGoogle')),
        h('button',{type:'button',class:'ui-button ui-button-secondary',onclick:()=>finishAuth('guest')},t('authGuest'))),
      h('p',{class:'v2-note',text:t('authNote')})));
    auth.classList.add('v2-open');setBackgroundInert(true);
    auth.querySelector('#v2AuthTitle').focus({preventScroll:true});
  }
  function finishAuth(mode){
    const typed=auth.querySelector('#v2AuthName')?.value.trim()||'';
    store.set(PROFILE_KEY,JSON.stringify({mode,name:mode==='guest'?'':(typed||t('demoName'))}));
    auth.classList.remove('v2-open');auth.replaceChildren();setBackgroundInert(false);
    navigate('today');
  }
  function signOut(){store.remove(PROFILE_KEY);openAuth();}
  function oldInterface(){store.remove(UI_KEY);location.hash='';location.reload();}

  /* ---------- start ---------- */
  function start(){
    document.body.classList.add('v2');
    container=document.querySelector('.container');
    screen=h('main',{id:'v2Screen',class:'v2-screen',hidden:true});
    const nav=h('nav',{class:'v2-tabs'},TABS.map(tab=>h('button',{type:'button',class:'v2-tab','data-tab':tab,onclick:()=>navigate(tab)},icon(tab),h('span',{class:'v2-tab-label'}))));
    root=h('div',{id:'v2Root',class:'v2-root'},screen,nav);
    auth=h('div',{id:'v2Auth',class:'v2-auth',role:'dialog','aria-modal':'true','aria-labelledby':'v2AuthTitle'});
    document.body.append(root,auth);
    tabButtons=[...nav.querySelectorAll('.v2-tab')];
    // dashboard on the home screen; it follows every change of the data and steps aside while a word is being searched
    const search=document.getElementById('searchInput');
    container.insertBefore(dashboard(),document.getElementById('errorArea'));
    search.addEventListener('input',()=>{const current=document.getElementById('v2Dashboard');if(current)current.hidden=!!search.value.trim();});
    window.addEventListener('vocvoc-storage-committed',refreshDashboard);
    window.addEventListener('vocvoc-data-adopted',refreshDashboard);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshDashboard();});
    document.addEventListener('vocvoc-quiz-rendered',updateQuizProgress);
    // Flip is the app's own dialog; when it is closed (its x, Escape, the back button) the address goes back with it
    const flip=document.getElementById('flipOverlay');
    if(flip)new MutationObserver(()=>{if(!flip.classList.contains('open')&&shown==='flip')goBack('study');}).observe(flip,{attributes:true,attributeFilter:['class']});
    window.addEventListener('hashchange',()=>{if(currentRoute()!==shown)render(true);});
    window.addEventListener('vocvoc-plan-changed',()=>{if(['stats','premium','profile'].includes(shown))render(false);});
    render(false);
    if(!readProfile())openAuth();
  }
  // The app's own start-up (database, migration) finishes first; its boot cover goes away when it is done.
  const boot=document.getElementById('storageBoot');
  if(!boot||boot.hidden)start();
  else{const observer=new MutationObserver(()=>{if(boot.hidden){observer.disconnect();start();}});observer.observe(boot,{attributes:true,attributeFilter:['hidden']});}
})();
