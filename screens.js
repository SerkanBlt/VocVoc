'use strict';
/* New interface (prototype): tab bar, screens, simulated sign-in and simulated Free/Premium plan.
   Opt-in: open the app with ?ui=v2 (remembered; ?ui=v1 or "Eski arayüze dön" turns it off). Without it this file only defines VocVocPlan
   and does nothing else, so the default interface and its tests are unaffected. Nothing here is real: there is no account, server or payment.
   The existing home screen (search, word cards, the list) is the "Words" tab; the other tabs, Today included, are full-screen pages drawn over it. No inline handlers, no innerHTML with data. */
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
      nav:'Ana gezinme',today:'Bugün',words:'Kelimeler',study:'Çalış',stats:'İstatistik',badges:'Rozetler',profile:'Profil',back:'Geri',
      authTitle:'VocVoc',authSub:'Kelimelerini cihazında öğren ve tekrar et.',authName:'Görünen ad (isteğe bağlı)',authGoogle:'Google ile devam et (simülasyon)',authGuest:'Misafir olarak devam et',
      authNote:'Simülasyon: gerçek hesap ve sunucu yok. Bilgilerin yalnızca bu cihazda kalır.',demoName:'Demo Kullanıcı',
      studyTitle:'Çalış',studyTest:'Test',studyTestSub:'{n} aktif kelimeden 10 soru',studyRecall:'Hatırla',studyRecallSub:'{n} ezberlediğin kelimeyi sına',studyFlip:'Flip',studyFlipSub:'Kartları çevirerek tekrar et',
      statsTitle:'İstatistikler',badgesTitle:'Rozetler',
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
      goalTitle:'Günlük hedef',goalValue:'{n} / {m} kelime',goalUnlimited:'Bugün {n} kelime eklendi',addDaily:'Günlük kelimeler ekle',statActive:'Aktif',statMemorized:'Ezberlenen',statToday:'Bugün ezberlenen',
      quizClose:'Kapat',quizProgress:'Soru {n}/{total}',quizDone:'Tamamlandı',quizProgressLabel:'Test ilerlemesi',quizNeedActive:'Test için en az 10 aktif kelime gerekir. Şu an {n} var.',quizNeedRecall:'Hatırla için en az 10 ezberlenmiş kelime gerekir. Şu an {n} var.',backToToday:'Bugün ekranına dön',
      statsSummaryTotal:'Toplam kelime',statsMemorized:'Ezberlenen',statsStreak:'Seri (gün)',statsLongest:'En uzun seri',
      statsWeek:'Son 7 gün',legendAdded:'Eklenen',legendMemorized:'Ezberlenen',dayLabel:'{day}: {added} eklendi, {memorized} ezberlendi, {tests} test',
      statsCurve:'Ezberlenen kelime (son 30 gün)',curveSummary:'30 gün önce {from}, şimdi {to} ezberlenmiş kelime.',
      statsTests:'Testler',testsCount:'Test',testsAccuracy:'Ortalama başarı',testsBest:'En iyi',testsNone:'Henüz tamamlanmış test yok. Bir test bitirince sonuçların burada görünür.',lastTests:'Son testler',modeActive:'Test',modeRecall:'Hatırla',
      statsAnalysis:'Geçmiş analizi',hardestTitle:'En çok yanıldığın kelimeler',hardestNone:'Henüz yanlış yaptığın kelime yok.',speedTitle:'Ortalama ezberleme süresi',speedValue:'{n} gün ({m} kelimeye göre)',speedNone:'Henüz ezberlenmiş kelime yok.',
      statsFootnote:'Rakamlar kelimelerin eklenme ve ezberlenme zamanlarından ve tamamladığın testlerden hesaplanır. Arşive aldığın kelimeler ezberlenen sayısına girmez. Test geçmişi ve rozetler bu cihazda tutulur, yedeğe girmez.',
      badgesSummary:'{n} / {m} rozet kazanıldı',badgeEarned:'Kazanıldı: {date}',badgeProgress:'{n} / {m}',newBadgeTitle:'Yeni rozet!',newBadgesTitle:'{n} yeni rozet!',
      b_memo1:'İlk adım',bd_memo1:'Bir kelimeyi ezberle.',b_memo10:'On kelime',bd_memo10:'10 kelime ezberle.',b_memo50:'Elli kelime',bd_memo50:'50 kelime ezberle.',b_memo100:'Yüz kelime',bd_memo100:'100 kelime ezberle.',b_memo500:'Kelime ustası',bd_memo500:'500 kelime ezberle.',
      b_words50:'Koleksiyoncu',bd_words50:'Listene 50 kelime ekle.',b_test1:'İlk test',bd_test1:'Bir test tamamla.',b_test10:'Düzenli çalışan',bd_test10:'10 test tamamla.',b_perfect:'Kusursuz',bd_perfect:'Bir testi 10/10 bitir.',b_recall8:'Güçlü hafıza',bd_recall8:'Hatırla testinde en az 8/10 yap.',
      b_streak3:'Isınma',bd_streak3:'3 gün üst üste çalış.',b_streak7:'Bir hafta',bd_streak7:'7 gün üst üste çalış.',b_streak30:'Bir ay',bd_streak30:'30 gün üst üste çalış.',b_goal1:'Hedef tamam',bd_goal1:'Günlük kelime hedefine ulaş.',
      packTitle:'Hazır kelimeler',packLevel:'Başlangıç (A1-A2)',packProgress:'{n} / {m} kelime eklendi',packLoading:'Paket indiriliyor…',packOffline:'Paket indirilemedi. İnternete bağlanınca yeniden denenir.',
      packNone:'Bu dil çifti için hazır paket henüz yok. Kendi API anahtarınla yeni kelime ekleyebilirsin.',packDone:'Paketteki tüm kelimeleri ekledin. Yeni kelime için kendi API anahtarını kullanabilirsin.',packAdded:'{n} kelime eklendi.',
      speakLabel:'Sesli oku: {text}',speakLocked:'Sesli okuma Premium ile açılır.',speakLockedLabel:'Sesli oku (Premium)',speakNoVoice:'Bu cihazda {language} sesi yok.',speakNone:'Bu tarayıcı sesli okumayı desteklemiyor.',
      aboutTitle:'Hakkında',version:'Sürüm',uiMode:'Arayüz',uiProto:'Yeni arayüz (prototip)',aboutSim:'Bu sürümdeki giriş, Premium ve ödeme ekranları simülasyondur: gerçek hesap, sunucu veya ödeme yoktur.'
    },
    en:{
      nav:'Main navigation',today:'Today',words:'Words',study:'Study',stats:'Stats',badges:'Badges',profile:'Profile',back:'Back',
      authTitle:'VocVoc',authSub:'Learn and review your words on your device.',authName:'Display name (optional)',authGoogle:'Continue with Google (simulation)',authGuest:'Continue as guest',
      authNote:'Simulation: there is no real account or server. Your information stays on this device.',demoName:'Demo user',
      studyTitle:'Study',studyTest:'Test',studyTestSub:'10 questions from {n} active words',studyRecall:'Recall',studyRecallSub:'Quiz yourself on {n} memorized words',studyFlip:'Flip',studyFlipSub:'Review by flipping cards',
      statsTitle:'Statistics',badgesTitle:'Badges',
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
      goalTitle:'Daily goal',goalValue:'{n} / {m} words',goalUnlimited:'{n} words added today',addDaily:'Add daily words',statActive:'Active',statMemorized:'Memorized',statToday:'Memorized today',
      quizClose:'Close',quizProgress:'Question {n}/{total}',quizDone:'Finished',quizProgressLabel:'Test progress',quizNeedActive:'A Test needs at least 10 active words. You have {n}.',quizNeedRecall:'Recall needs at least 10 memorized words. You have {n}.',backToToday:'Back to Today',
      statsSummaryTotal:'Total words',statsMemorized:'Memorized',statsStreak:'Streak (days)',statsLongest:'Longest streak',
      statsWeek:'Last 7 days',legendAdded:'Added',legendMemorized:'Memorized',dayLabel:'{day}: {added} added, {memorized} memorized, {tests} tests',
      statsCurve:'Memorized words (last 30 days)',curveSummary:'30 days ago {from}, now {to} memorized words.',
      statsTests:'Tests',testsCount:'Tests',testsAccuracy:'Average score',testsBest:'Best',testsNone:'No finished test yet. Your results appear here once you finish one.',lastTests:'Latest tests',modeActive:'Test',modeRecall:'Recall',
      statsAnalysis:'History analysis',hardestTitle:'Words you miss most',hardestNone:'No missed words yet.',speedTitle:'Average time to memorize',speedValue:'{n} days (from {m} words)',speedNone:'No memorized words yet.',
      statsFootnote:'The numbers come from when words were added and memorized and from the tests you finished. Archived words are not counted as memorized. Test history and badges are kept on this device and are not part of a backup.',
      badgesSummary:'{n} / {m} badges earned',badgeEarned:'Earned: {date}',badgeProgress:'{n} / {m}',newBadgeTitle:'New badge!',newBadgesTitle:'{n} new badges!',
      b_memo1:'First step',bd_memo1:'Memorize a word.',b_memo10:'Ten words',bd_memo10:'Memorize 10 words.',b_memo50:'Fifty words',bd_memo50:'Memorize 50 words.',b_memo100:'Hundred words',bd_memo100:'Memorize 100 words.',b_memo500:'Word master',bd_memo500:'Memorize 500 words.',
      b_words50:'Collector',bd_words50:'Add 50 words to your list.',b_test1:'First test',bd_test1:'Complete a test.',b_test10:'Regular',bd_test10:'Complete 10 tests.',b_perfect:'Flawless',bd_perfect:'Finish a test 10/10.',b_recall8:'Strong memory',bd_recall8:'Score at least 8/10 in a Recall test.',
      b_streak3:'Warm-up',bd_streak3:'Study 3 days in a row.',b_streak7:'One week',bd_streak7:'Study 7 days in a row.',b_streak30:'One month',bd_streak30:'Study 30 days in a row.',b_goal1:'Goal reached',bd_goal1:'Reach your daily word goal.',
      packTitle:'Ready-made words',packLevel:'Beginner (A1-A2)',packProgress:'{n} / {m} words added',packLoading:'Downloading the pack…',packOffline:'The pack could not be downloaded. It is tried again when you are online.',
      packNone:'There is no ready-made pack for this language pair yet. You can add new words with your own API key.',packDone:'You have added every word of the pack. You can use your own API key for new words.',packAdded:'{n} words added.',
      speakLabel:'Read aloud: {text}',speakLocked:'Read-aloud comes with Premium.',speakLockedLabel:'Read aloud (Premium)',speakNoVoice:'There is no {language} voice on this device.',speakNone:'This browser does not support read-aloud.',
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
    words:'<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    speaker:'<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.5 5.5a9 9 0 010 13"/>'
  };
  function icon(name){const span=h('span',{class:'v2-icon','aria-hidden':'true'});span.innerHTML='<svg viewBox="0 0 24 24" focusable="false">'+ICONS[name]+'</svg>';return span;}

  /* ---------- profile (simulated) ---------- */
  function readProfile(){try{const value=JSON.parse(store.get(PROFILE_KEY)||'null');return value&&(value.mode==='guest'||value.mode==='google-sim')?value:null;}catch(_){return null;}}


  /* ---------- activity record and statistics (the numbers come from stats.js) ---------- */
  // The record keeps what the app's data cannot say: finished tests and the day each badge was earned. It is small, bounded and lives only
  // in this browser (not in the backup). The rest of the statistics is worked out from when words were added and memorized.
  const ACTIVITY_KEY='VOCVOC_ACTIVITY_V1';
  const parseJson=text=>{try{return JSON.parse(text);}catch(_){return null;}};
  const readActivity=()=>VocVocStats.normalizeRecord(parseJson(store.get(ACTIVITY_KEY)));
  const writeActivity=record=>store.set(ACTIVITY_KEY,JSON.stringify(record));
  const today=()=>VocVocStats.localDay(new Date().toISOString());
  let statsCache=null;
  function currentStats(){
    const db=VocVocData.getDb(),raw=store.get(ACTIVITY_KEY)||'',day=today(),limit=getDailyLimit(),goal=Number.isFinite(limit)&&getDailyUsage().count>=limit;
    if(statsCache&&statsCache.db===db&&statsCache.raw===raw&&statsCache.day===day&&statsCache.goal===goal)return statsCache.value;   // nothing changed since last time
    const record=VocVocStats.normalizeRecord(parseJson(raw));
    const words=Object.values(db.progress).map(progress=>({word:db.words[progress.wordId]?.word||'',status:progress.status,addedAt:progress.firstSeenAt||null,memorizedAt:progress.memorizedAt||null}));
    const value=VocVocStats.compute({words,quizzes:record.quizzes,testsTaken:record.testsTaken,earned:record.badges,builtin:[...BUILTIN_DICTIONARY_KEYS],today:day,goalReachedToday:goal});
    statsCache={db,raw,day,goal,value};
    return value;
  }
  let toastTimer=0;
  function toast(text){
    let node=document.getElementById('v2Toast');
    if(!node){node=h('div',{id:'v2Toast',class:'v2-toast',role:'status'});document.body.append(node);}
    node.textContent=text;node.classList.add('v2-show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('v2-show'),4500);
  }
  // Badges earned since last time are saved with the day they were really earned. The very first look only records what the data already
  // shows (no fanfare for things done long ago); after that every new badge is announced.
  function evaluateBadges(){
    const record=readActivity(),stats=currentStats(),fresh=stats.newlyEarned;
    if(record.seeded&&!fresh.length)return;
    const earned=Object.fromEntries(stats.badges.filter(badge=>fresh.includes(badge.id)).map(badge=>[badge.id,badge.earnedOn]));
    writeActivity(VocVocStats.withBadges({...record,seeded:true},earned));
    if(record.seeded&&fresh.length)celebrate(fresh);
  }
  // Appears with a small burst, stays a few seconds and fades away by itself; it never blocks a tap. Badges earned together share one card.
  const CELEBRATE_SHOW=2900,CELEBRATE_LEAVE=450,SPARKS=12;
  let celebrating=false;const celebrationWaiting=[];
  function celebrate(ids){
    celebrationWaiting.push(...ids.filter(id=>!celebrationWaiting.includes(id)));
    if(!celebrating)showCelebration();
  }
  function showCelebration(){
    const known=currentStats().badges,badges=celebrationWaiting.splice(0).map(id=>known.find(badge=>badge.id===id)).filter(Boolean);
    if(!badges.length){celebrating=false;return;}
    celebrating=true;
    let host=document.getElementById('v2Celebrate');
    if(!host){host=h('div',{id:'v2Celebrate',class:'v2-celebrate',role:'status'});document.body.append(host);}
    const sparks=Array.from({length:SPARKS},(_,index)=>{const spark=h('span',{class:'v2-spark'});spark.style.setProperty('--a',Math.round(index*360/SPARKS)+'deg');return spark;});
    const names=badges.slice(0,2).map(badge=>t('b_'+badge.id)).join(', ')+(badges.length>2?' +'+(badges.length-2):'');
    host.replaceChildren(h('div',{class:'v2-celebrate-card'},
      h('div',{class:'v2-celebrate-art','aria-hidden':'true'},sparks,badges.slice(0,3).map(badge=>h('span',{class:'v2-medal',text:GLYPH[badge.kind]||'★'}))),
      h('p',{class:'v2-celebrate-kicker',text:badges.length>1?fill(t('newBadgesTitle'),{n:badges.length}):t('newBadgeTitle')}),
      h('p',{class:'v2-celebrate-name',text:names}),
      badges.length===1?h('p',{class:'v2-celebrate-desc',text:t('bd_'+badges[0].id)}):null));
    host.classList.remove('v2-leaving');host.classList.add('v2-on');
    setTimeout(()=>{
      host.classList.add('v2-leaving');
      setTimeout(()=>{host.classList.remove('v2-on','v2-leaving');host.replaceChildren();showCelebration();},CELEBRATE_LEAVE);
    },CELEBRATE_SHOW);
  }
  const recordedTests=new WeakSet();
  function recordFinishedTest(){                                                   // told after every drawing of a Test; acts once, when it is finished
    if(!quizSession||quizSession.index<quizSession.questions.length||recordedTests.has(quizSession))return;
    recordedTests.add(quizSession);
    writeActivity(VocVocStats.appendQuiz(readActivity(),{t:new Date().toISOString(),mode:quizSession.mode==='recall'?'recall':'active',score:quizSession.score,total:quizSession.questions.length,wrong:quizSession.wrongWords||[]}));
    evaluateBadges();
  }


  /* ---------- ready-made word packs (free) ---------- */
  // The pack of the user's language pair (packs/<target>-<native>.json) is fetched once, kept in the browser's cache for offline use and checked before use.
  // The Daily button takes its next words from the pack: no API key needed. The service worker does not touch packs (they are not part of the shell).
  const PACK_CACHE='vocvoc-packs-v1';
  const legacyText=key=>window.t(key);                                   // the app's own translations (the t of this file is a different table)
  const packState={pair:'',status:'idle',entry:null,pack:null};            // status: idle | loading | ready | none | offline
  let packLoad=null,packBusy=false;
  async function packJson(url,{network=false}={}){
    const cache='caches' in window?await caches.open(PACK_CACHE):null;
    if(cache&&!network){const hit=await cache.match(url);if(hit)return hit.json();}
    try{
      const response=await fetch(url,{cache:'no-cache'});
      if(response.ok){if(cache)await cache.put(url,response.clone());return await response.json();}
    }catch(_){}
    if(cache){const hit=await cache.match(url);if(hit)return hit.json();}
    throw new Error('offline');
  }
  const currentPair=()=>{const settings=VocVocData.getSettings();return VocVocPacks.pairId(settings.targetLanguage,settings.nativeLanguage);};
  function refreshPack(){
    const pair=currentPair();
    packLoad=(async()=>{
      Object.assign(packState,{pair,status:'loading',entry:null,pack:null});refreshDashboard();
      try{
        let index=null;try{index=await packJson('./packs/index.json',{network:true});}catch(_){}
        const entry=index?.packs?.find(item=>item.id===pair)||null;
        if(packState.pair!==pair)return;
        if(index&&!entry){packState.status='none';return;}
        let pack=null;try{pack=await packJson('./packs/'+pair+'.json');}catch(_){}                     // the copy kept on this device, if it is usable
        if(entry&&(!pack||pack.version<entry.version||VocVocPacks.validatePack(pack).length))pack=await packJson('./packs/'+pair+'.json',{network:true});
        if(!pack||pack.id!==pair||VocVocPacks.validatePack(pack).length)throw new Error('unusable pack');
        if(packState.pair===pair)Object.assign(packState,{status:'ready',entry:entry||{id:pair,words:pack.words.length},pack});
      }catch(_){if(packState.pair===pair)packState.status='offline';}
      finally{if(packState.pair===pair)refreshDashboard();}
    })();
    return packLoad;
  }
  function syncPack(){try{if(currentPair()!==packState.pair)refreshPack();}catch(_){}}               // the language pair changed
  const knownWord=word=>!!VocVocData.getWordProgress(word);
  // The next words of the pack, added the way the Daily words are (they count towards the daily goal). Returns false when the AI Daily should go on.
  async function addFromPack(){
    const remaining=getDailyLimit()-getDailyUsage().count;
    if(remaining<=0){showError(legacyText('dailyLimitReached'));return true;}
    const words=VocVocPacks.nextWords(packState.pack,knownWord,Math.min(10,remaining));
    if(!words.length){
      if(VocVocPlan.ownKeyActive()&&VocVocSecrets.getApiKey())return false;                           // the pack is used up: carry on with the user's own key
      toast(t('packDone'));return true;
    }
    try{await VocVocData.addWordBatch(words,{dailyCount:words.length});}catch(error){reportStorageError(error);return true;}
    quizSession=null;loadSavedWords();renderHistory();renderAllLocal();
    toast(fill(t('packAdded'),{n:words.length}));
    return true;
  }
  async function addDailyFromPackOrAi(){
    if(packBusy)return;packBusy=true;
    try{
      if(packState.status==='idle'||packState.status==='offline')await refreshPack();                  // first use, or back online
      else if(packLoad)await packLoad;
      if(packState.status==='ready'&&await addFromPack())return;
    }finally{packBusy=false;}
    addDailyWords();                                                                                   // no pack for this pair: the app's own Daily (needs the user's API key)
  }
  function packCard(){
    if(packState.status==='idle')return null;
    let text,bar=null;
    if(packState.status==='ready'){
      const {total,used}=VocVocPacks.progress(packState.pack,knownWord);
      text=used>=total?t('packDone'):fill(t('packProgress'),{n:used,m:total});
      bar=h('div',{class:'v2-bar v2-bar-thin',role:'progressbar','aria-label':t('packTitle'),'aria-valuemin':'0','aria-valuemax':String(total),'aria-valuenow':String(used)},h('span'));
      bar.style.setProperty('--p',Math.round(used/total*100)+'%');
    }else text=t({loading:'packLoading',none:'packNone',offline:'packOffline'}[packState.status]);
    return h('div',{class:'v2-card v2-pack'},h('p',{class:'v2-goal-label',text:t('packTitle')+' · '+t('packLevel')}),h('p',{class:'v2-pack-text',text}),bar);
  }

  /* ---------- read-aloud (Premium) ---------- */
  // The device's own voices (speechSynthesis): free to run, works offline, and sounds as good as the voices installed on the device.
  // Buttons are added next to the words and example sentences of the cards, the word windows and Flip; the app's own markup is not touched.
  const SPEECH_TAGS={tr:'tr-TR',en:'en-US',fr:'fr-FR',de:'de-DE',es:'es-ES',it:'it-IT'};
  const LANGUAGE_NAMES={tr:{tr:'Türkçe',en:'İngilizce',fr:'Fransızca',de:'Almanca',es:'İspanyolca',it:'İtalyanca'},en:{tr:'Turkish',en:'English',fr:'French',de:'German',es:'Spanish',it:'Italian'}};
  let speakingButton=null;
  const speakText=button=>String(typeof button.speakText==='function'?button.speakText():'').trim();
  function syncSpeakButton(button){
    const locked=!VocVocPlan.has('speech');
    button.classList.toggle('v2-speak-free',locked);
    button.setAttribute('aria-label',locked?t('speakLockedLabel'):fill(t('speakLabel'),{text:speakText(button)}));
  }
  function speakButton(getText){
    const lock=icon('lock');lock.classList.add('v2-speak-lock');
    const button=h('button',{type:'button',class:'v2-speak','aria-pressed':'false'},icon('speaker'),lock);
    button.speakText=getText;syncSpeakButton(button);
    return button;
  }
  function setSpeaking(button){
    if(speakingButton){speakingButton.setAttribute('aria-pressed','false');speakingButton.classList.remove('v2-speaking');}
    speakingButton=button;
    if(button){button.setAttribute('aria-pressed','true');button.classList.add('v2-speaking');}
  }
  function stopSpeaking(){if(speakingButton){try{window.speechSynthesis?.cancel();}catch(_){}setSpeaking(null);}}
  function speak(button,text){
    const synth=window.speechSynthesis;
    if(!synth||typeof SpeechSynthesisUtterance==='undefined'){toast(t('speakNone'));return;}
    if(speakingButton===button){stopSpeaking();return;}                                               // a second press stops it
    synth.cancel();
    const code=getTargetLanguageCode(),tag=SPEECH_TAGS[code]||code;
    const voices=(synth.getVoices&&synth.getVoices())||[];
    const matching=voices.filter(voice=>String(voice.lang||'').replace('_','-').toLowerCase().startsWith(code));
    if(voices.length&&!matching.length){toast(fill(t('speakNoVoice'),{language:(LANGUAGE_NAMES[lang()]||LANGUAGE_NAMES.en)[code]||code}));return;}
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.lang=tag;utterance.rate=0.9;
    const voice=matching.find(item=>item.localService&&String(item.lang).replace('_','-').toLowerCase()===tag.toLowerCase())||matching.find(item=>item.localService)||matching[0];
    if(voice)utterance.voice=voice;
    utterance.onend=utterance.onerror=()=>{if(speakingButton===button)setSpeaking(null);};
    setSpeaking(button);synth.speak(utterance);
  }
  function onSpeak(button){
    if(!VocVocPlan.has('speech')){toast(t('speakLocked'));return;}
    const text=speakText(button);
    if(text)speak(button,text);
  }
  // [where to put a button, how to find its text]
  const SPEECH_TARGETS=[
    ['.main-word-body .shared-detail-content',host=>{const word=decodeDomText(host.closest('.main-word-card')?.dataset.word||'');if(!word)return;host.prepend(h('div',{class:'v2-speak-row'},speakButton(()=>word)));}],
    ['.word-panel-fixed-header .word-title',host=>{const word=host.textContent.trim();if(word)host.after(speakButton(()=>word));}],
    ['.example-item .fr-text,.expression-item .fr-text',host=>{const text=host.textContent.trim();if(text)host.append(speakButton(()=>text));}],
    ['#flipOverlay .flip-panel',host=>host.append(speakButton(()=>document.querySelector('#flipOverlay [data-flip-face="front"] .flip-word-text')?.textContent||''))]
  ];
  function decorateSpeech(node){
    for(const [selector,decorate] of SPEECH_TARGETS){
      const hosts=[...(node.matches?.(selector)?[node]:[]),...node.querySelectorAll(selector)];
      for(const host of hosts){if(host.dataset.v2Speak)continue;host.dataset.v2Speak='1';decorate(host);}
    }
  }
  function startSpeech(){
    decorateSpeech(document.body);
    new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)decorateSpeech(node);}).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',event=>{
      const button=event.target.closest?.('.v2-speak');if(!button)return;
      event.preventDefault();event.stopPropagation();onSpeak(button);
    },true);
  }

  /* ---------- routing ---------- */
  const TABS=['today','words','study','stats','badges','profile'];
  const QUIZ_ROUTES=['test','recall'];
  const ROUTES=[...TABS,'test','recall','flip','premium','help','privacy','terms','about'];
  const TAB_OF={today:'today',words:'words',study:'study',stats:'stats',badges:'badges',profile:'profile',test:'study',recall:'study',flip:'study',premium:'profile',help:'profile',privacy:'profile',terms:'profile',about:'profile'};
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
    try{const {active,memorized,memorizedToday}=currentStats().summary;return {active,memorized,memorizedToday};}
    catch(_){return {active:0,memorized:0,memorizedToday:0};}
  }
  function studyScreen(){
    const {active,memorized}=counts(),tests=currentStats().tests;
    const card=(glyph,title,sub,run)=>h('button',{type:'button',class:'v2-study-card',onclick:run},
      h('span',{class:'v2-study-glyph','aria-hidden':'true',text:glyph}),
      h('span',{},h('span',{class:'v2-study-title',text:title}),h('span',{class:'v2-study-sub',text:sub})));
    return page(heading(t('studyTitle')),testsPanel(tests),
      card('◈',t('studyTest'),fill(t('studyTestSub'),{n:active}),()=>navigate('test')),
      card('↺',t('studyRecall'),fill(t('studyRecallSub'),{n:memorized}),()=>navigate('recall')),
      card('⇄',t('studyFlip'),t('studyFlipSub'),()=>navigate('flip')),
      recentTests(tests));
  }

  /* ---------- Today: daily goal, ready-made words, counts and the last seven days ---------- */
  function todayScreen(){
    const {active,memorized,memorizedToday}=counts();
    const limit=getDailyLimit(),used=getDailyUsage().count,unlimited=limit===Infinity;
    const bar=unlimited?null:h('div',{class:'v2-bar',role:'progressbar','aria-label':t('goalTitle'),'aria-valuemin':'0','aria-valuemax':String(limit),'aria-valuenow':String(Math.min(used,limit))},h('span'));
    bar?.style.setProperty('--p',Math.min(100,Math.round(used/limit*100))+'%');
    return page(heading(t('today')),h('div',{id:'v2Dashboard'},
      h('div',{class:'v2-card v2-goal'},
        h('p',{class:'v2-goal-label',text:t('goalTitle')}),
        h('p',{class:'v2-goal-value',text:unlimited?fill(t('goalUnlimited'),{n:used}):fill(t('goalValue'),{n:used,m:limit})}),
        bar,
        h('button',{type:'button',class:'ui-button ui-button-success','data-v2-focus':'daily',onclick:()=>{addDailyFromPackOrAi();}},t('addDaily'))),
      packCard(),
      h('ul',{class:'v2-statline'},tile(active,t('statActive')),tile(memorized,t('statMemorized')),tile(memorizedToday,t('statToday'))),
      weekSection(currentStats().last7)));
  }
  let dashboardTimer=0;
  function refreshDashboard(){                                                   // after any change of the data, once per burst
    clearTimeout(dashboardTimer);
    dashboardTimer=setTimeout(()=>{
      evaluateBadges();syncPack();
      if(shown!=='today'||!screen)return;
      const top=screen.scrollTop,active=document.activeElement,keep=screen.contains(active)?(active.dataset.v2Focus||active.tagName):'';
      screen.replaceChildren(todayScreen());screen.scrollTop=top;
      if(keep)(screen.querySelector('[data-v2-focus="'+keep+'"]')||(keep==='H1'?screen.querySelector('h1'):null))?.focus({preventScroll:true});   // the page is redrawn; the user keeps their place
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
  /* ---------- statistics (Premium) ---------- */
  const locale=()=>lang()==='tr'?'tr-TR':'en-GB';
  const formatDay=(day,options)=>new Date(day+'T12:00:00').toLocaleDateString(locale(),options||{day:'numeric',month:'short',year:'numeric'});
  const tile=(value,label)=>h('li',{class:'v2-stat'},h('strong',{text:String(value)}),h('span',{text:label}));
  function weekSection(days){
    const peak=Math.max(1,...days.map(day=>Math.max(day.added,day.memorized)));
    const weekday=day=>formatDay(day,{weekday:'short'});
    const column=(value,kind)=>{const bar=h('span',{class:'v2-col v2-col-'+kind});bar.style.setProperty('--h',Math.round(value/peak*100)+'%');return bar;};
    return h('section',{class:'v2-card'},h('h2',{text:t('statsWeek')}),
      h('ol',{class:'v2-days'},days.map(day=>h('li',{class:'v2-day'},
        h('span',{class:'sr-only',text:fill(t('dayLabel'),{day:weekday(day.day),added:day.added,memorized:day.memorized,tests:day.tests})}),
        h('span',{class:'v2-bars','aria-hidden':'true'},column(day.added,'added'),column(day.memorized,'memorized')),
        h('span',{class:'v2-day-label','aria-hidden':'true',text:weekday(day.day)}),
        h('span',{class:'v2-day-num','aria-hidden':'true',text:day.added+'/'+day.memorized})))),
      h('p',{class:'v2-legend'},h('span',{class:'v2-key v2-key-added','aria-hidden':'true'}),' '+t('legendAdded')+'   ',h('span',{class:'v2-key v2-key-memorized','aria-hidden':'true'}),' '+t('legendMemorized')));
  }
  function curveSection(series){
    const NS='http://www.w3.org/2000/svg',width=300,height=80,pad=4;
    const low=Math.min(...series.map(point=>point.total)),high=Math.max(...series.map(point=>point.total));
    const x=index=>pad+(width-2*pad)*index/(series.length-1),y=value=>height-pad-(height-2*pad)*((value-low)/Math.max(1,high-low));
    const svg=document.createElementNS(NS,'svg');
    svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.setAttribute('class','v2-curve');svg.setAttribute('role','img');
    svg.setAttribute('aria-label',fill(t('curveSummary'),{from:series[0].total,to:series[series.length-1].total}));
    const line=document.createElementNS(NS,'polyline');
    line.setAttribute('points',series.map((point,index)=>x(index).toFixed(1)+','+y(point.total).toFixed(1)).join(' '));
    svg.append(line);
    return h('section',{class:'v2-card'},h('h2',{text:t('statsCurve')}),svg,
      h('p',{class:'v2-muted v2-curve-range','aria-hidden':'true',text:series[0].total+' → '+series[series.length-1].total}));
  }
  function testsPanel(tests){
    const accuracy=tests.accuracy===null?'–':Math.round(tests.accuracy*100)+'%',best=tests.best?tests.best.score+'/'+tests.best.total:'–';
    return h('section',{class:'v2-card'},h('h2',{text:t('statsTests')}),
      h('ul',{class:'v2-statline'},tile(tests.count,t('testsCount')),tile(accuracy,t('testsAccuracy')),tile(best,t('testsBest'))));
  }
  // The colour of the bullet in front of a finished test (out of ten): 9-10 green, 7-8 blue, 5-6 orange, below that red.
  const scoreBand=(score,total)=>{const outOfTen=Math.round(score/Math.max(1,total)*10);return outOfTen>=9?'great':outOfTen>=7?'good':outOfTen>=5?'fair':'low';};
  function recentTests(tests){
    return h('section',{class:'v2-card'},h('h2',{text:t('lastTests')}),
      tests.last.length
        ?h('ul',{class:'v2-testlist'},tests.last.map(test=>h('li',{},
            h('span',{class:'v2-bullet v2-bullet-'+scoreBand(test.score,test.total),'aria-hidden':'true'}),
            h('span',{class:'v2-test-day',text:formatDay(VocVocStats.localDay(test.t))}),h('span',{class:'v2-muted',text:t(test.mode==='recall'?'modeRecall':'modeActive')}),h('strong',{text:test.score+'/'+test.total}))))
        :h('p',{class:'v2-muted',text:t('testsNone')}));
  }
  function analysisSection(stats){
    return h('section',{class:'v2-card'},h('h2',{text:t('statsAnalysis')}),
      h('h3',{text:t('hardestTitle')}),
      stats.tests.hardest.length
        ?h('ul',{class:'v2-chips'},stats.tests.hardest.map(item=>h('li',{class:'v2-chip',lang:getTargetLanguageCode()},item.word,' ',h('span',{class:'v2-muted',text:'×'+item.count}))))
        :h('p',{class:'v2-muted',text:t('hardestNone')}),
      h('h3',{text:t('speedTitle')}),
      stats.speed.medianDays===null
        ?h('p',{class:'v2-muted',text:t('speedNone')})
        :h('p',{},h('strong',{text:fill(t('speedValue'),{n:stats.speed.medianDays,m:stats.speed.samples})})));
  }
  function statsScreen(){
    if(!VocVocPlan.has('stats'))return lockedScreen('statsTitle','lockedStats');
    const stats=currentStats(),summary=stats.summary;
    return page(heading(t('statsTitle')),
      h('ul',{class:'v2-statline v2-statline-4'},tile(summary.total,t('statsSummaryTotal')),tile(summary.memorized,t('statsMemorized')),tile(summary.streak.current,t('statsStreak')),tile(summary.streak.longest,t('statsLongest'))),
      weekSection(stats.last7),curveSection(stats.memorizedSeries),testsPanel(stats.tests),
      VocVocPlan.has('historyAnalysis')?analysisSection(stats):null,
      h('p',{class:'v2-muted',text:t('statsFootnote')}));
  }

  /* ---------- badges (free) ---------- */
  const GLYPH={memorized:'✓',collected:'☰',tests:'◈',perfect:'★',recall:'↺',streak:'✦',goal:'◎'};
  function badgeCard(badge){
    const done=!!badge.earnedOn;
    const bar=done?null:h('div',{class:'v2-bar v2-bar-thin',role:'progressbar','aria-label':t('b_'+badge.id),'aria-valuemin':'0','aria-valuemax':String(badge.target),'aria-valuenow':String(badge.progress)},h('span'));
    bar?.style.setProperty('--p',Math.round(badge.progress/badge.target*100)+'%');
    return h('li',{class:'v2-badge'+(done?' v2-earned':'')},
      h('span',{class:'v2-badge-icon','aria-hidden':'true'},done?GLYPH[badge.kind]:icon('lock')),
      h('div',{class:'v2-badge-body'},h('h3',{text:t('b_'+badge.id)}),h('p',{class:'v2-muted',text:t('bd_'+badge.id)}),
        done?h('p',{class:'v2-badge-date',text:fill(t('badgeEarned'),{date:formatDay(badge.earnedOn)})}):h('p',{class:'v2-muted',text:fill(t('badgeProgress'),{n:badge.progress,m:badge.target})}),
        bar));
  }
  function badgesScreen(){
    const badges=currentStats().badges,earned=badges.filter(badge=>badge.earnedOn).length;
    const ordered=[...badges].sort((a,b)=>(a.earnedOn?0:1)-(b.earnedOn?0:1)||(a.earnedOn?b.earnedOn.localeCompare(a.earnedOn):b.progress/b.target-a.progress/a.target));
    return page(heading(t('badgesTitle')),h('p',{class:'v2-muted',text:fill(t('badgesSummary'),{n:earned,m:badges.length})}),h('ul',{class:'v2-badges'},ordered.map(badgeCard)));
  }
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
      case 'today':return todayScreen();
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
    stopSpeaking();
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
    if(route==='words'){                                                           // the existing home screen: search, word cards, the list
      container.classList.remove('v2-away');screen.hidden=true;screen.replaceChildren();delete screen.dataset.route;
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
    // Today follows every change of the data
    evaluateBadges();
    refreshPack();
    window.addEventListener('vocvoc-storage-committed',refreshDashboard);
    window.addEventListener('vocvoc-data-adopted',refreshDashboard);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshDashboard();});
    document.addEventListener('vocvoc-quiz-rendered',updateQuizProgress);
    document.addEventListener('vocvoc-quiz-rendered',recordFinishedTest);
    // Flip is the app's own dialog; when it is closed (its x, Escape, the back button) the address goes back with it
    const flip=document.getElementById('flipOverlay');
    if(flip)new MutationObserver(()=>{if(!flip.classList.contains('open')&&shown==='flip')goBack('study');}).observe(flip,{attributes:true,attributeFilter:['class']});
    window.addEventListener('hashchange',()=>{if(currentRoute()!==shown)render(true);});
    window.addEventListener('vocvoc-plan-changed',()=>{document.querySelectorAll('.v2-speak').forEach(syncSpeakButton);if(['stats','premium','profile'].includes(shown))render(false);});
    window.addEventListener('online',()=>{if(packState.status==='offline')refreshPack();});
    startSpeech();
    render(false);
    if(!readProfile())openAuth();
  }
  // The app's own start-up (database, migration) finishes first; its boot cover goes away when it is done.
  const boot=document.getElementById('storageBoot');
  if(!boot||boot.hidden)start();
  else{const observer=new MutationObserver(()=>{if(boot.hidden){observer.disconnect();start();}});observer.observe(boot,{attributes:true,attributeFilter:['hidden']});}
})();
