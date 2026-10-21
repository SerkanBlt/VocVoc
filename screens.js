'use strict';
/* New interface (prototype): tab bar, screens, simulated sign-in and simulated Free/Premium plan.
   Opt-in: open the app with ?ui=v2 (remembered; ?ui=v1 turns it off). Without it this file only defines VocVocPlan
   and does nothing else, so the default interface and its tests are unaffected. Nothing here is real: there is no account, server or payment.
   The existing home screen (search, word cards, the list) is the "Words" tab; the other tabs, Today included, are full-screen pages drawn over it. No inline handlers, no innerHTML with data. */
(function(){
  const UI_KEY='VOCVOC_UI',PLAN_KEY='VOCVOC_SIM_PLAN',PROFILE_KEY='VOCVOC_SIM_PROFILE',BILLING_KEY='VOCVOC_SIM_BILLING';
  // The record keeps what the app's data cannot say: finished tests and the day each badge was earned. It is small, bounded and lives only
  // in this browser (not in the backup); a progress reset deletes it too (resetActivity).
  const ACTIVITY_KEY='VOCVOC_ACTIVITY_V1';
  const store={
    get(key){try{return localStorage.getItem(key);}catch(_){return null;}},
    set(key,value){try{localStorage.setItem(key,value);}catch(_){}},
    remove(key){try{localStorage.removeItem(key);}catch(_){}}
  };
  const param=new URLSearchParams(location.search).get('ui');
  if(param==='v2')store.set(UI_KEY,'v2');else if(param==='v1')store.remove(UI_KEY);
  const enabled=store.get(UI_KEY)==='v2';

  /* ---------- plan (simulated) ---------- */
  // 'premium' features are locked on the free plan. There is no AI and no API key: every word comes from the word database (wordbase.js). The free plan holds
  // up to FREE_BAND_LIMIT words from each of the six levels (A1 … C2: a gift of 40 words each; archived ones count); Premium has no limit.
  const FEATURES=Object.freeze({freeWords:'free',badges:'free',stats:'premium',historyAnalysis:'premium',unlimitedWords:'premium',sentenceBuilder:'premium',speech:'premium',dailyGoalOver20:'premium'});
  const FREE_DAILY_LIMIT=20;                                                       // a daily goal above this is a Premium feature
  const FREE_BAND_LIMIT=40;                                                        // words of each level on the free plan; the index.html side reads bandWordLimit()
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
    FREE_DAILY_LIMIT,
    dailyLimitMax(){return planNow()==='premium'?Infinity:FREE_DAILY_LIMIT;},
    FREE_BAND_LIMIT,
    bandWordLimit(){return planNow()==='premium'?Infinity:FREE_BAND_LIMIT;}
  });
  window.VocVocPlan=VocVocPlan;

  /* ---------- texts (one table per interface language: tr, en, fr, de, es, it; a missing text falls back to English) ---------- */
  const TEXT={
    tr:{
      nav:'Ana gezinme',today:'Bugün',words:'Kelimeler',study:'Çalış',stats:'İstatistik',profile:'Profil',back:'Geri',menu:'Menü',menuClose:'Menüyü kapat',addedWords:'Eklenen kelimeler',addedTapClose:'Kapatmak için dokun',orbNewWord:'Yeni Kelimeler',orbMemorized:'Ezberimde',photoAdd:'Fotoğraf ekle',photoChange:'Fotoğrafı değiştir',photoRemove:'Fotoğrafı kaldır',photoView:'Profil fotoğrafını büyüt',photoRemoveTitle:'Fotoğraf kaldırılsın mı?',photoRemoveText:'Profil fotoğrafın bu cihazdan silinir. İstersen sonra yeniden ekleyebilirsin.',photoRemoveYes:'Kaldır',photoTitle:'Profil fotoğrafı',photoHelp:'Sürükleyerek yerleştir, iki parmakla veya kaydırıcıyla yakınlaştır. Dairenin içinde kalan kısım kullanılır.',photoZoom:'Yakınlaştır',photoStage:'Fotoğraf alanı: oklarla kaydır, + ve - ile yakınlaştır',photoSave:'Kaydet',photoCancel:'Vazgeç',photoBad:'Bu dosya bir resim olarak açılamadı. En fazla 15 MB bir resim seç.',photoSaveFailed:'Fotoğraf kaydedilemedi: bu cihazda yeterli yer yok.',dayWordsLabel:'{day}, {kind}: {n} kelime. Kelimeleri göster',dayWordsTitle:'{day} · {kind}',dayWordsCount:'{n} kelime',dayWordsMore:'ve {n} kelime daha',
      authTitle:'VocVoc',authSub:'Kelimelerini cihazında öğren ve tekrar et.',authName:'Görünen ad (isteğe bağlı)',authGoogle:'Google ile devam et (simülasyon)',authGuest:'Misafir olarak devam et',
      authNote:'Simülasyon: gerçek hesap ve sunucu yok. Bilgilerin yalnızca bu cihazda kalır.',demoName:'Demo Kullanıcı',
      studyTitle:'Çalış',studyMatch:'Eşleştirme',studyMatchSub:'{n} aktif kelimeyle 10 tur, her turda 4 eşleme',quizNeedMatch:'Eşleştirme için en az 10 aktif kelime gerekir. Şu an {n} var.',modeMatch:'Eşleştirme',studyTest:'Test',studyTestSub:'{n} aktif kelimeden 10 soru',studyRecall:'Hatırla',studyRecallSub:'{n} ezberlediğin kelimeyi sına',studyFlip:'Flip',studyFlipSub:'Kartları çevirerek tekrar et',studyCloze:'Boşluk Doldurma',studyClozeSub:'{n} kelimenin cümlesinden 10 soru',flipAuto:'Kart değişince kelimeyi otomatik oku',flipAutoLocked:'Otomatik okuma (Premium)',flipMore:'Kelime panelini aç',
      statsTitle:'İstatistikler',badgesTitle:'Rozetler',
      lockedTitle:'Premium özelliği',lockedStats:'Günlük etkinlik, test başarısı, öğrenme eğrisi ve seri gibi istatistikler Premium ile açılır.',goPremium:"Premium'a geç",
      profileTitle:'Profil',guest:'Misafir',modeGoogle:'Google (simülasyon)',modeGuest:'Bu cihazda',planFree:'Ücretsiz',planPremium:'Premium (simülasyon)',
      rowPremium:'Premium',rowSettings:'Ayarlar',rowHelp:'Yardım',rowPrivacy:'Gizlilik Politikası',rowTerms:'Kullanım Şartları',rowAbout:'Hakkında',
      signOut:'Çıkış yap (simülasyon)',signOutNote:'Çıkış, kelimelerini ve ilerlemeni silmez.',
      premiumTitle:'Premium',planLabel:'Mevcut plan',premiumIncludes:'Premium (ücretsiz olanların hepsine ek olarak)',
      priceNote:'Fiyatlar USD cinsindendir. Yıllık abonelikte 2 ay bedavadır.',
      simulate:"Premium'u simüle et",backToFree:'Ücretsiz plana dön',simNote:'Simülasyon: gerçek ödeme alınmaz, hiçbir şey satın alınmaz.',perMonth:'/ ay',perYear:'/ yıl',billingLabel:'Faturalama dönemi',billingMonthly:'Aylık',billingYearly:'Yıllık',twoMonthsFree:'2 ay bedava',yearlyNote:'12 ay yerine 10 ay öde',monthlyEquiv:'Aylık ≈ {price}',
      free1:'Altı seviyenin (A1–C2) her birinden 40’ar kelime hediye',free2:'Kartlar, ezberleme, arşiv ve History',free3:'Test, Hatırla ve Flip',free4:'Arama, rastgele kelime ve eş/zıt anlam etiketlerinden kelime ekleme',free5:'Yedekleme, tema ve 6 arayüz dili',free6:'Rozetler',
      prem1:'Her seviyede ilk 40 kelimeden sonrası, 10 bine yakın kelime deposu',prem3:'Sesli okuma',prem4:'İlerleme istatistikleri ve geçmiş analizi',prem5:'Günlük hedefi 20 kelimenin üzerine çıkarma',
      goalTitle:'Günlük hedef',goalValue:'{n} / {m} kelime',goalUnlimited:'Bugün {n} kelime eklendi',addNew:'Yeni Kelime Ekle',goWords:'Kelimelerime Git',statActive:'Aktif',statMemorized:'Ezberlenen',statToday:'Bugün ezberlenen',
      quizClose:'Kapat',quizProgress:'Soru {n}/{total}',quizDone:'Tamamlandı',quizProgressLabel:'Test ilerlemesi',quizNeedActive:'Test için en az 10 aktif kelime gerekir. Şu an {n} var.',quizNeedRecall:'Hatırla için en az 10 ezberlenmiş kelime gerekir. Şu an {n} var.',quizNeedCloze:'Boşluk Doldurma için cümlesi olan en az 10 kelime gerekir. Şu an {n} var.',backToToday:'Bugün ekranına dön',
      statsSummaryTotal:'Toplam kelime',statsMemorized:'Ezberlenen',statsStreak:'Seri (gün)',statsLongest:'En uzun seri',
      statsWeek:'Son 7 gün',legendAdded:'Eklenen',legendMemorized:'Ezberlenen',dayLabel:'{day}: {added} eklendi, {memorized} ezberlendi, {tests} test',
      statsCurve:'Ezberlenen kelime (son 30 gün)',curveSummary:'30 gün önce {from}, şimdi {to} ezberlenmiş kelime.',
      statsTests:'Testler',testsCount:'Test',testsAccuracy:'Ortalama başarı',testsBest:'En iyi',testsNone:'Henüz tamamlanmış test yok. Bir test bitirince sonuçların burada görünür.',lastTests:'Son testler',modeActive:'Test',modeRecall:'Hatırla',modeCloze:'Boşluk',
      statsAnalysis:'Geçmiş analizi',hardestTitle:'En çok yanıldığın kelimeler',hardestNone:'Henüz yanlış yaptığın kelime yok.',speedTitle:'Ortalama ezberleme süresi',speedValue:'{n} gün ({m} kelimeye göre)',speedNone:'Henüz ezberlenmiş kelime yok.',
      statsFootnote:'Rakamlar kelimelerin eklenme ve ezberlenme zamanlarından ve tamamladığın testlerden hesaplanır. Arşive aldığın kelimeler ezberlenen sayısına girmez. Test geçmişi ve rozetler bu cihazda tutulur, yedeğe girmez.',
      badgesSummary:'{n} / {m} rozet kazanıldı',badgesEarned:'Kazandıkların',badgesStarted:'Başladıkların',badgesWaiting:'Bekleyenler',badgesNoneEarned:'Henüz kazandığın rozet yok. Bir kelimeyi ezberlediğinde ilk rozetin gelir.',badgesNoneStarted:'Başladığın ama henüz kazanmadığın rozet yok.',badgesNoneWaiting:'Bekleyen rozet kalmadı: hepsine başladın.',badgeEarned:'Kazanıldı: {date}',badgeProgress:'{n} / {m}',newBadgeTitle:'Yeni rozet!',newBadgesTitle:'{n} yeni rozet!',
      b_memo1:'İlk adım',bd_memo1:'Bir kelimeyi ezberle.',b_memo10:'On kelime',bd_memo10:'10 kelime ezberle.',b_memo50:'Elli kelime',bd_memo50:'50 kelime ezberle.',b_memo100:'Yüz kelime',bd_memo100:'100 kelime ezberle.',b_memo500:'Kelime ustası',bd_memo500:'500 kelime ezberle.',
      b_words50:'Koleksiyoncu',bd_words50:'Listene 50 kelime ekle.',b_test1:'İlk test',bd_test1:'Bir test tamamla.',b_test10:'Düzenli çalışan',bd_test10:'10 test tamamla.',b_perfect:'Kusursuz',bd_perfect:'Bir testi 10/10 bitir.',b_recall8:'Güçlü hafıza',bd_recall8:'Hatırla testinde en az 8/10 yap.',
      b_streak3:'Isınma',bd_streak3:'3 gün üst üste çalış.',b_streak7:'Bir hafta',bd_streak7:'7 gün üst üste çalış.',b_streak30:'Bir ay',bd_streak30:'30 gün üst üste çalış.',b_goal1:'Hedef tamam',bd_goal1:'Günlük kelime hedefine ulaş.',b_points10:'İlk 10 puan',bd_points10:'Kelimelerinden toplam 10 puan kazan.',b_recall1:'İlk hatırlama',bd_recall1:'İlk Hatırla testini tamamla.',b_match1:'İlk eşleştirme',bd_match1:'İlk Eşleştirme testini tamamla.',b_flip10:'Flip meraklısı',bd_flip10:'10’dan fazla Flip kartı çevir.',b_flip30:'Flip tutkunu',bd_flip30:'30’dan fazla Flip kartı çevir.',b_flip50:'Flip ustası',bd_flip50:'50’den fazla Flip kartı çevir.',b_lvlA1:'A1 tamam',bd_lvlA1:'A1 seviyesindeki bütün kelimeleri listene ekle.',b_lvlA2:'A2 tamam',bd_lvlA2:'A2 seviyesindeki bütün kelimeleri listene ekle.',b_lvlB1:'B1 tamam',bd_lvlB1:'B1 seviyesindeki bütün kelimeleri listene ekle.',b_lvlB2:'B2 tamam',bd_lvlB2:'B2 seviyesindeki bütün kelimeleri listene ekle.',b_lvlC1:'C1 tamam',bd_lvlC1:'C1 seviyesindeki bütün kelimeleri listene ekle.',b_lvlC2:'C2 tamam',bd_lvlC2:'C2 seviyesindeki bütün kelimeleri listene ekle.',
      packTitle:'Hazır kelimeler',packLevelA1:'Başlangıç (A1)',packProgress:'{n} / {m} kelime eklendi',packLoading:'Paket indiriliyor…',packOffline:'Paket indirilemedi. İnternete bağlanınca yeniden denenir.',
      packNone:'Bu dil çifti için kelime veritabanı henüz yok.',packDone:'Paketteki tüm kelimeleri ekledin.',packLevelA2:'Temel (A2)',packLevelB1:'Orta (B1)',packLevelB2:'Orta üstü (B2)',packLevelC1:'İleri (C1)',packLevelC2:'Uzman (C2)',courseDone:'Bu seviyedeki tüm kelimeleri listene aldın. Yeni Kelime Ekle’ye basınca bir sonraki seviyeye geçmek isteyip istemediğin sorulur.',courseSoon:'Bu seviyenin kelimeleri henüz hazırlanıyor. Ayarlar’dan başka bir seviye seçebilirsin.',
      speakLabel:'Sesli oku: {text}',speakLocked:'Sesli okuma Premium ile açılır.',speakLockedLabel:'Sesli oku (Premium)',speakNoVoice:'Bu cihazda {language} sesi yok.',speakNone:'Bu tarayıcı sesli okumayı desteklemiyor.',speedNormal:'normal',speedSlow:'yavaş',speakSpeed:'{text} ({speed})',
      aboutTitle:'Hakkında',version:'Sürüm',uiMode:'Arayüz',uiProto:'Yeni arayüz (prototip)',aboutWords:'Hazır kelimelerin sırası, hermitdave/FrequencyWords sıklık listesinden (CC BY-SA 4.0) yararlanılarak belirlendi.',aboutSim:'Bu sürümdeki giriş, Premium ve ödeme ekranları simülasyondur: gerçek hesap, sunucu veya ödeme yoktur.'
    },
    en:{
      nav:'Main navigation',today:'Today',words:'Words',study:'Study',stats:'Stats',profile:'Profile',back:'Back',menu:'Menu',menuClose:'Close menu',addedWords:'Added words',addedTapClose:'Tap to close',orbNewWord:'New Words',orbMemorized:'Memorized',photoAdd:'Add a photo',photoChange:'Change photo',photoRemove:'Remove photo',photoView:'Enlarge the profile photo',photoRemoveTitle:'Remove the photo?',photoRemoveText:'Your profile photo is deleted from this device. You can add it again later.',photoRemoveYes:'Remove',photoTitle:'Profile photo',photoHelp:'Drag to place it, pinch or use the slider to zoom. The part inside the circle is used.',photoZoom:'Zoom',photoStage:'Photo area: arrow keys move it, + and - zoom',photoSave:'Save',photoCancel:'Cancel',photoBad:'This file could not be opened as a picture. Choose a picture of up to 15 MB.',photoSaveFailed:'The photo could not be saved: there is not enough room on this device.',dayWordsLabel:'{day}, {kind}: {n} words. Show the words',dayWordsTitle:'{day} · {kind}',dayWordsCount:'{n} words',dayWordsMore:'and {n} more',
      authTitle:'VocVoc',authSub:'Learn and review your words on your device.',authName:'Display name (optional)',authGoogle:'Continue with Google (simulation)',authGuest:'Continue as guest',
      authNote:'Simulation: there is no real account or server. Your information stays on this device.',demoName:'Demo user',
      studyTitle:'Study',studyMatch:'Matching',studyMatchSub:'10 rounds of 4 pairs from {n} active words',quizNeedMatch:'Matching needs at least 10 active words. You have {n}.',modeMatch:'Matching',studyTest:'Test',studyTestSub:'10 questions from {n} active words',studyRecall:'Recall',studyRecallSub:'Quiz yourself on {n} memorized words',studyFlip:'Flip',studyFlipSub:'Review by flipping cards',studyCloze:'Fill in the blank',studyClozeSub:'10 questions from the sentences of {n} words',flipAuto:'Read the word by itself when the card changes',flipAutoLocked:'Automatic reading (Premium)',flipMore:'Open the word panel',
      statsTitle:'Statistics',badgesTitle:'Badges',
      lockedTitle:'Premium feature',lockedStats:'Statistics such as daily activity, test accuracy, the learning curve and streaks come with Premium.',goPremium:'Go Premium',
      profileTitle:'Profile',guest:'Guest',modeGoogle:'Google (simulation)',modeGuest:'On this device',planFree:'Free',planPremium:'Premium (simulation)',
      rowPremium:'Premium',rowSettings:'Settings',rowHelp:'Help',rowPrivacy:'Privacy Policy',rowTerms:'Terms of Use',rowAbout:'About',
      signOut:'Sign out (simulation)',signOutNote:'Signing out does not delete your words or progress.',
      premiumTitle:'Premium',planLabel:'Current plan',premiumIncludes:'Premium (in addition to everything free)',
      priceNote:'Prices are in USD. The yearly subscription has 2 months free.',
      simulate:'Simulate Premium',backToFree:'Back to the free plan',simNote:'Simulation: no real payment is taken and nothing is purchased.',perMonth:'/ month',perYear:'/ year',billingLabel:'Billing period',billingMonthly:'Monthly',billingYearly:'Yearly',twoMonthsFree:'2 months free',yearlyNote:'Pay for 10 months instead of 12',monthlyEquiv:'About {price} a month',
      free1:'A gift of 40 words from each of the six levels (A1–C2)',free2:'Cards, memorizing, archive and History',free3:'Test, Recall and Flip',free4:'Adding words by search, random word and synonym/antonym tags',free5:'Backup, themes and 6 interface languages',free6:'Badges',
      prem1:'Everything after the first 40 words of each level, a word bank of nearly 10,000 words',prem3:'Read-aloud',prem4:'Progress statistics and history analysis',prem5:'Daily goal above 20 words',
      goalTitle:'Daily goal',goalValue:'{n} / {m} words',goalUnlimited:'{n} words added today',addNew:'Add New Words',goWords:'Go to My Words',statActive:'Active',statMemorized:'Memorized',statToday:'Memorized today',
      quizClose:'Close',quizProgress:'Question {n}/{total}',quizDone:'Finished',quizProgressLabel:'Test progress',quizNeedActive:'A Test needs at least 10 active words. You have {n}.',quizNeedRecall:'Recall needs at least 10 memorized words. You have {n}.',quizNeedCloze:'Fill in the blank needs at least 10 words that have an example sentence. You have {n}.',backToToday:'Back to Today',
      statsSummaryTotal:'Total words',statsMemorized:'Memorized',statsStreak:'Streak (days)',statsLongest:'Longest streak',
      statsWeek:'Last 7 days',legendAdded:'Added',legendMemorized:'Memorized',dayLabel:'{day}: {added} added, {memorized} memorized, {tests} tests',
      statsCurve:'Memorized words (last 30 days)',curveSummary:'30 days ago {from}, now {to} memorized words.',
      statsTests:'Tests',testsCount:'Tests',testsAccuracy:'Average score',testsBest:'Best',testsNone:'No finished test yet. Your results appear here once you finish one.',lastTests:'Latest tests',modeActive:'Test',modeRecall:'Recall',modeCloze:'Blank',
      statsAnalysis:'History analysis',hardestTitle:'Words you miss most',hardestNone:'No missed words yet.',speedTitle:'Average time to memorize',speedValue:'{n} days (from {m} words)',speedNone:'No memorized words yet.',
      statsFootnote:'The numbers come from when words were added and memorized and from the tests you finished. Archived words are not counted as memorized. Test history and badges are kept on this device and are not part of a backup.',
      badgesSummary:'{n} / {m} badges earned',badgesEarned:'Earned',badgesStarted:'Started',badgesWaiting:'Waiting',badgesNoneEarned:'No badge earned yet. Memorize a word and your first one arrives.',badgesNoneStarted:'No badge is under way that you have not earned yet.',badgesNoneWaiting:'No badge is waiting: you have started them all.',badgeEarned:'Earned: {date}',badgeProgress:'{n} / {m}',newBadgeTitle:'New badge!',newBadgesTitle:'{n} new badges!',
      b_memo1:'First step',bd_memo1:'Memorize a word.',b_memo10:'Ten words',bd_memo10:'Memorize 10 words.',b_memo50:'Fifty words',bd_memo50:'Memorize 50 words.',b_memo100:'Hundred words',bd_memo100:'Memorize 100 words.',b_memo500:'Word master',bd_memo500:'Memorize 500 words.',
      b_words50:'Collector',bd_words50:'Add 50 words to your list.',b_test1:'First test',bd_test1:'Complete a test.',b_test10:'Regular',bd_test10:'Complete 10 tests.',b_perfect:'Flawless',bd_perfect:'Finish a test 10/10.',b_recall8:'Strong memory',bd_recall8:'Score at least 8/10 in a Recall test.',
      b_streak3:'Warm-up',bd_streak3:'Study 3 days in a row.',b_streak7:'One week',bd_streak7:'Study 7 days in a row.',b_streak30:'One month',bd_streak30:'Study 30 days in a row.',b_goal1:'Goal reached',bd_goal1:'Reach your daily word goal.',b_points10:'First 10 points',bd_points10:'Earn 10 points from your words.',b_recall1:'First recall',bd_recall1:'Finish your first Recall test.',b_match1:'First match',bd_match1:'Finish your first Matching test.',b_flip10:'Flip fan',bd_flip10:'Turn more than 10 Flip cards over.',b_flip30:'Flip enthusiast',bd_flip30:'Turn more than 30 Flip cards over.',b_flip50:'Flip master',bd_flip50:'Turn more than 50 Flip cards over.',b_lvlA1:'A1 done',bd_lvlA1:'Add every word of level A1 to your list.',b_lvlA2:'A2 done',bd_lvlA2:'Add every word of level A2 to your list.',b_lvlB1:'B1 done',bd_lvlB1:'Add every word of level B1 to your list.',b_lvlB2:'B2 done',bd_lvlB2:'Add every word of level B2 to your list.',b_lvlC1:'C1 done',bd_lvlC1:'Add every word of level C1 to your list.',b_lvlC2:'C2 done',bd_lvlC2:'Add every word of level C2 to your list.',
      packTitle:'Ready-made words',packLevelA1:'Beginner (A1)',packProgress:'{n} / {m} words added',packLoading:'Downloading the pack…',packOffline:'The pack could not be downloaded. It is tried again when you are online.',
      packNone:'There is no word database for this language pair yet.',packDone:'You have added every word of the pack.',packLevelA2:'Elementary (A2)',packLevelB1:'Intermediate (B1)',packLevelB2:'Upper intermediate (B2)',packLevelC1:'Advanced (C1)',packLevelC2:'Proficient (C2)',courseDone:'You have added all the words of this level. Press Add New Words and you will be asked whether to move to the next level.',courseSoon:'The words of this level are still being prepared. You can choose another level in Settings.',
      speakLabel:'Read aloud: {text}',speakLocked:'Read-aloud comes with Premium.',speakLockedLabel:'Read aloud (Premium)',speakNoVoice:'There is no {language} voice on this device.',speakNone:'This browser does not support read-aloud.',speedNormal:'normal',speedSlow:'slow',speakSpeed:'{text} ({speed})',
      aboutTitle:'About',version:'Version',uiMode:'Interface',uiProto:'New interface (prototype)',aboutWords:'The order of the ready-made words is based on the frequency list hermitdave/FrequencyWords (CC BY-SA 4.0).',aboutSim:'Sign-in, Premium and payment in this version are simulations: there is no real account, server or payment.'
    },
    fr:{
      nav:'Navigation principale',today:'Aujourd’hui',words:'Mots',study:'Étudier',stats:'Statistiques',profile:'Profil',back:'Retour',menu:'Menu',menuClose:'Fermer le menu',addedWords:'Mots ajoutés',addedTapClose:'Touchez pour fermer',orbNewWord:'Nouveaux mots',orbMemorized:'Mémorisé',photoAdd:'Ajouter une photo',photoChange:'Changer la photo',photoRemove:'Supprimer la photo',photoView:'Agrandir la photo de profil',photoRemoveTitle:'Supprimer la photo ?',photoRemoveText:'Votre photo de profil est effacée de cet appareil. Vous pourrez la rajouter plus tard.',photoRemoveYes:'Supprimer',photoTitle:'Photo de profil',photoHelp:'Faites glisser pour la placer, pincez ou utilisez le curseur pour zoomer. La partie à l’intérieur du cercle est utilisée.',photoZoom:'Zoom',photoStage:'Zone de la photo : les flèches la déplacent, + et - zooment',photoSave:'Enregistrer',photoCancel:'Annuler',photoBad:'Ce fichier n’a pas pu être ouvert comme image. Choisissez une image de 15 Mo maximum.',photoSaveFailed:'La photo n’a pas pu être enregistrée : il n’y a pas assez de place sur cet appareil.',dayWordsLabel:'{day}, {kind} : {n} mots. Afficher les mots',dayWordsTitle:'{day} · {kind}',dayWordsCount:'{n} mots',dayWordsMore:'et {n} de plus',
      authTitle:'VocVoc',authSub:'Apprenez et révisez vos mots sur votre appareil.',authName:'Nom affiché (facultatif)',authGoogle:'Continuer avec Google (simulation)',authGuest:'Continuer en tant qu’invité',
      authNote:'Simulation : il n’y a ni vrai compte ni serveur. Vos informations restent sur cet appareil.',demoName:'Utilisateur démo',
      studyTitle:'Étudier',studyMatch:'Association',studyMatchSub:'10 manches de 4 paires avec {n} mots actifs',quizNeedMatch:'L’association demande au moins 10 mots actifs. Vous en avez {n}.',modeMatch:'Association',studyTest:'Test',studyTestSub:'10 questions parmi {n} mots actifs',studyRecall:'Réviser',studyRecallSub:'Testez-vous sur {n} mots mémorisés',studyFlip:'Flip',studyFlipSub:'Révisez en retournant des cartes',studyCloze:'Texte à trous',studyClozeSub:'10 questions tirées des phrases de {n} mots',flipAuto:'Lire le mot automatiquement quand la carte change',flipAutoLocked:'Lecture automatique (Premium)',flipMore:'Ouvrir la fiche du mot',
      statsTitle:'Statistiques',badgesTitle:'Badges',
      lockedTitle:'Fonction Premium',lockedStats:'Les statistiques comme l’activité quotidienne, la réussite aux tests, la courbe d’apprentissage et les séries sont réservées à Premium.',goPremium:'Passer à Premium',
      profileTitle:'Profil',guest:'Invité',modeGoogle:'Google (simulation)',modeGuest:'Sur cet appareil',planFree:'Gratuit',planPremium:'Premium (simulation)',
      rowPremium:'Premium',rowSettings:'Réglages',rowHelp:'Aide',rowPrivacy:'Politique de confidentialité',rowTerms:'Conditions d’utilisation',rowAbout:'À propos',
      signOut:'Se déconnecter (simulation)',signOutNote:'Se déconnecter ne supprime ni vos mots ni votre progression.',
      premiumTitle:'Premium',planLabel:'Offre actuelle',premiumIncludes:'Premium (en plus de tout ce qui est gratuit)',
      priceNote:'Les prix sont en USD. L’abonnement annuel offre 2 mois.',
      simulate:'Simuler Premium',backToFree:'Revenir à l’offre gratuite',simNote:'Simulation : aucun vrai paiement n’est prélevé et rien n’est acheté.',perMonth:'/ mois',perYear:'/ an',billingLabel:'Période de facturation',billingMonthly:'Mensuel',billingYearly:'Annuel',twoMonthsFree:'2 mois offerts',yearlyNote:'Payez 10 mois au lieu de 12',monthlyEquiv:'Environ {price} par mois',
      free1:'Un cadeau de 40 mots dans chacun des six niveaux (A1–C2)',free2:'Cartes, mémorisation, archive et History',free3:'Test, Réviser et Flip',free4:'Ajout de mots par la recherche, le mot au hasard et les étiquettes de synonymes/contraires',free5:'Sauvegarde, thèmes et 6 langues d’interface',free6:'Badges',
      prem1:'Tout ce qui suit les 40 premiers mots de chaque niveau, une banque de près de 10 000 mots',prem3:'Lecture à voix haute',prem4:'Statistiques de progression et analyse de l’historique',prem5:'Objectif du jour au-delà de 20 mots',
      goalTitle:'Objectif du jour',goalValue:'{n} / {m} mots',goalUnlimited:'{n} mots ajoutés aujourd’hui',addNew:'Ajouter de nouveaux mots',goWords:'Aller à mes mots',statActive:'Actifs',statMemorized:'Mémorisés',statToday:'Mémorisés aujourd’hui',
      quizClose:'Fermer',quizProgress:'Question {n}/{total}',quizDone:'Terminé',quizProgressLabel:'Progression du test',quizNeedActive:'Un test demande au moins 10 mots actifs. Vous en avez {n}.',quizNeedRecall:'Réviser demande au moins 10 mots mémorisés. Vous en avez {n}.',quizNeedCloze:'Texte à trous demande au moins 10 mots ayant une phrase d’exemple. Vous en avez {n}.',backToToday:'Retour à Aujourd’hui',
      statsSummaryTotal:'Total des mots',statsMemorized:'Mémorisés',statsStreak:'Série (jours)',statsLongest:'Plus longue série',
      statsWeek:'7 derniers jours',legendAdded:'Ajoutés',legendMemorized:'Mémorisés',dayLabel:'{day} : {added} ajoutés, {memorized} mémorisés, {tests} tests',
      statsCurve:'Mots mémorisés (30 derniers jours)',curveSummary:'Il y a 30 jours : {from}. Maintenant : {to} mots mémorisés.',
      statsTests:'Tests',testsCount:'Tests',testsAccuracy:'Score moyen',testsBest:'Meilleur',testsNone:'Aucun test terminé pour l’instant. Vos résultats apparaîtront ici dès que vous en aurez terminé un.',lastTests:'Derniers tests',modeActive:'Test',modeRecall:'Révision',modeCloze:'Trous',
      statsAnalysis:'Analyse de l’historique',hardestTitle:'Les mots que vous ratez le plus',hardestNone:'Aucun mot raté pour l’instant.',speedTitle:'Temps moyen pour mémoriser',speedValue:'{n} jours (sur {m} mots)',speedNone:'Aucun mot mémorisé pour l’instant.',
      statsFootnote:'Les chiffres viennent des dates d’ajout et de mémorisation des mots et des tests terminés. Les mots archivés ne comptent pas comme mémorisés. L’historique des tests et les badges sont conservés sur cet appareil et ne font pas partie d’une sauvegarde.',
      badgesSummary:'{n} / {m} badges obtenus',badgesEarned:'Obtenus',badgesStarted:'Commencés',badgesWaiting:'À venir',badgesNoneEarned:'Aucun badge obtenu pour l’instant. Mémorisez un mot et le premier arrive.',badgesNoneStarted:'Aucun badge en cours que vous n’avez pas encore obtenu.',badgesNoneWaiting:'Aucun badge en attente : vous les avez tous commencés.',badgeEarned:'Obtenu le {date}',badgeProgress:'{n} / {m}',newBadgeTitle:'Nouveau badge !',newBadgesTitle:'{n} nouveaux badges !',
      b_memo1:'Premier pas',bd_memo1:'Mémorisez un mot.',b_memo10:'Dix mots',bd_memo10:'Mémorisez 10 mots.',b_memo50:'Cinquante mots',bd_memo50:'Mémorisez 50 mots.',b_memo100:'Cent mots',bd_memo100:'Mémorisez 100 mots.',b_memo500:'Maître des mots',bd_memo500:'Mémorisez 500 mots.',
      b_words50:'Collectionneur',bd_words50:'Ajoutez 50 mots à votre liste.',b_test1:'Premier test',bd_test1:'Terminez un test.',b_test10:'Assidu',bd_test10:'Terminez 10 tests.',b_perfect:'Sans faute',bd_perfect:'Terminez un test avec 10/10.',b_recall8:'Mémoire solide',bd_recall8:'Obtenez au moins 8/10 à un test de révision.',
      b_streak3:'Échauffement',bd_streak3:'Étudiez 3 jours de suite.',b_streak7:'Une semaine',bd_streak7:'Étudiez 7 jours de suite.',b_streak30:'Un mois',bd_streak30:'Étudiez 30 jours de suite.',b_goal1:'Objectif atteint',bd_goal1:'Atteignez votre objectif quotidien de mots.',b_points10:'Premiers 10 points',bd_points10:'Gagnez 10 points avec vos mots.',b_recall1:'Première révision',bd_recall1:'Terminez votre premier test Réviser.',b_match1:'Première association',bd_match1:'Terminez votre premier test d’association.',b_flip10:'Fan de Flip',bd_flip10:'Retournez plus de 10 cartes Flip.',b_flip30:'Passionné de Flip',bd_flip30:'Retournez plus de 30 cartes Flip.',b_flip50:'Maître du Flip',bd_flip50:'Retournez plus de 50 cartes Flip.',b_lvlA1:'A1 terminé',bd_lvlA1:'Ajoutez tous les mots du niveau A1 à votre liste.',b_lvlA2:'A2 terminé',bd_lvlA2:'Ajoutez tous les mots du niveau A2 à votre liste.',b_lvlB1:'B1 terminé',bd_lvlB1:'Ajoutez tous les mots du niveau B1 à votre liste.',b_lvlB2:'B2 terminé',bd_lvlB2:'Ajoutez tous les mots du niveau B2 à votre liste.',b_lvlC1:'C1 terminé',bd_lvlC1:'Ajoutez tous les mots du niveau C1 à votre liste.',b_lvlC2:'C2 terminé',bd_lvlC2:'Ajoutez tous les mots du niveau C2 à votre liste.',
      packTitle:'Mots prêts à l’emploi',packLevelA1:'Débutant (A1)',packProgress:'{n} / {m} mots ajoutés',packLoading:'Téléchargement du pack…',packOffline:'Le pack n’a pas pu être téléchargé. Une nouvelle tentative a lieu dès que vous êtes en ligne.',
      packNone:'Il n’y a pas encore de base de mots pour cette paire de langues.',packDone:'Vous avez ajouté tous les mots du pack.',packLevelA2:'Élémentaire (A2)',packLevelB1:'Intermédiaire (B1)',packLevelB2:'Intermédiaire supérieur (B2)',packLevelC1:'Avancé (C1)',packLevelC2:'Maîtrise (C2)',courseDone:'Vous avez ajouté tous les mots de ce niveau. En appuyant sur Ajouter de nouveaux mots, on vous demandera si vous voulez passer au niveau suivant.',courseSoon:'Les mots de ce niveau sont encore en préparation. Vous pouvez choisir un autre niveau dans les Réglages.',
      speakLabel:'Lire à voix haute : {text}',speakLocked:'La lecture à voix haute est réservée à Premium.',speakLockedLabel:'Lire à voix haute (Premium)',speakNoVoice:'Aucune voix {language} sur cet appareil.',speakNone:'Ce navigateur ne prend pas en charge la lecture à voix haute.',speedNormal:'normale',speedSlow:'lente',speakSpeed:'{text} ({speed})',
      aboutTitle:'À propos',version:'Version',uiMode:'Interface',uiProto:'Nouvelle interface (prototype)',aboutWords:'L’ordre des mots prêts à l’emploi s’appuie sur la liste de fréquence hermitdave/FrequencyWords (CC BY-SA 4.0).',aboutSim:'La connexion, Premium et le paiement de cette version sont des simulations : il n’y a ni vrai compte, ni serveur, ni paiement.'
    },
    de:{
      nav:'Hauptnavigation',today:'Heute',words:'Wörter',study:'Lernen',stats:'Statistik',profile:'Profil',back:'Zurück',menu:'Menü',menuClose:'Menü schließen',addedWords:'Hinzugefügte Wörter',addedTapClose:'Zum Schließen tippen',orbNewWord:'Neue Wörter',orbMemorized:'Gelernt',photoAdd:'Foto hinzufügen',photoChange:'Foto ändern',photoRemove:'Foto entfernen',photoView:'Profilfoto vergrößern',photoRemoveTitle:'Foto entfernen?',photoRemoveText:'Ihr Profilfoto wird von diesem Gerät gelöscht. Sie können es später wieder hinzufügen.',photoRemoveYes:'Entfernen',photoTitle:'Profilfoto',photoHelp:'Zum Platzieren ziehen, zum Zoomen zwei Finger oder den Regler verwenden. Der Teil im Kreis wird verwendet.',photoZoom:'Zoom',photoStage:'Fotobereich: Pfeiltasten verschieben, + und - zoomen',photoSave:'Speichern',photoCancel:'Abbrechen',photoBad:'Diese Datei konnte nicht als Bild geöffnet werden. Wählen Sie ein Bild bis 15 MB.',photoSaveFailed:'Das Foto konnte nicht gespeichert werden: Auf diesem Gerät ist nicht genug Platz.',dayWordsLabel:'{day}, {kind}: {n} Wörter. Wörter anzeigen',dayWordsTitle:'{day} · {kind}',dayWordsCount:'{n} Wörter',dayWordsMore:'und {n} weitere',
      authTitle:'VocVoc',authSub:'Lernen und wiederholen Sie Ihre Wörter auf Ihrem Gerät.',authName:'Anzeigename (optional)',authGoogle:'Mit Google fortfahren (Simulation)',authGuest:'Als Gast fortfahren',
      authNote:'Simulation: Es gibt kein echtes Konto und keinen Server. Ihre Daten bleiben auf diesem Gerät.',demoName:'Demo-Nutzer',
      studyTitle:'Lernen',studyMatch:'Zuordnen',studyMatchSub:'10 Runden mit je 4 Paaren aus {n} aktiven Wörtern',quizNeedMatch:'Zuordnen braucht mindestens 10 aktive Wörter. Sie haben {n}.',modeMatch:'Zuordnen',studyTest:'Test',studyTestSub:'10 Fragen aus {n} aktiven Wörtern',studyRecall:'Wiederholen',studyRecallSub:'Testen Sie sich an {n} gelernten Wörtern',studyFlip:'Flip',studyFlipSub:'Mit umgedrehten Karten wiederholen',studyCloze:'Lückentext',studyClozeSub:'10 Fragen aus den Sätzen von {n} Wörtern',flipAuto:'Wort beim Kartenwechsel automatisch vorlesen',flipAutoLocked:'Automatisches Vorlesen (Premium)',flipMore:'Wortfenster öffnen',
      statsTitle:'Statistik',badgesTitle:'Abzeichen',
      lockedTitle:'Premium-Funktion',lockedStats:'Statistiken wie tägliche Aktivität, Testergebnisse, Lernkurve und Serien gibt es mit Premium.',goPremium:'Premium holen',
      profileTitle:'Profil',guest:'Gast',modeGoogle:'Google (Simulation)',modeGuest:'Auf diesem Gerät',planFree:'Kostenlos',planPremium:'Premium (Simulation)',
      rowPremium:'Premium',rowSettings:'Einstellungen',rowHelp:'Hilfe',rowPrivacy:'Datenschutzerklärung',rowTerms:'Nutzungsbedingungen',rowAbout:'Über',
      signOut:'Abmelden (Simulation)',signOutNote:'Beim Abmelden werden Ihre Wörter und Ihr Fortschritt nicht gelöscht.',
      premiumTitle:'Premium',planLabel:'Aktueller Tarif',premiumIncludes:'Premium (zusätzlich zu allem Kostenlosen)',
      priceNote:'Preise in USD. Beim Jahresabo sind 2 Monate gratis.',
      simulate:'Premium simulieren',backToFree:'Zurück zum kostenlosen Tarif',simNote:'Simulation: Es wird keine echte Zahlung abgebucht und nichts gekauft.',perMonth:'/ Monat',perYear:'/ Jahr',billingLabel:'Abrechnungszeitraum',billingMonthly:'Monatlich',billingYearly:'Jährlich',twoMonthsFree:'2 Monate gratis',yearlyNote:'10 Monate zahlen statt 12',monthlyEquiv:'Etwa {price} pro Monat',
      free1:'Je 40 Wörter geschenkt aus jeder der sechs Stufen (A1–C2)',free2:'Karten, Lernen, Archiv und History',free3:'Test, Wiederholen und Flip',free4:'Wörter per Suche, Zufallswort und Synonym-/Antonym-Chips hinzufügen',free5:'Sicherung, Designs und 6 Oberflächensprachen',free6:'Abzeichen',
      prem1:'Alles nach den ersten 40 Wörtern jeder Stufe, ein Wortschatz von fast 10.000 Wörtern',prem3:'Vorlesen',prem4:'Fortschrittsstatistiken und Verlaufsanalyse',prem5:'Tagesziel über 20 Wörter',
      goalTitle:'Tagesziel',goalValue:'{n} / {m} Wörter',goalUnlimited:'Heute {n} Wörter hinzugefügt',addNew:'Neue Wörter hinzufügen',goWords:'Zu meinen Wörtern',statActive:'Aktiv',statMemorized:'Gelernt',statToday:'Heute gelernt',
      quizClose:'Schließen',quizProgress:'Frage {n}/{total}',quizDone:'Fertig',quizProgressLabel:'Testfortschritt',quizNeedActive:'Ein Test braucht mindestens 10 aktive Wörter. Sie haben {n}.',quizNeedRecall:'Wiederholen braucht mindestens 10 gelernte Wörter. Sie haben {n}.',quizNeedCloze:'Lückentext braucht mindestens 10 Wörter mit einem Beispielsatz. Sie haben {n}.',backToToday:'Zurück zu Heute',
      statsSummaryTotal:'Wörter gesamt',statsMemorized:'Gelernt',statsStreak:'Serie (Tage)',statsLongest:'Längste Serie',
      statsWeek:'Letzte 7 Tage',legendAdded:'Hinzugefügt',legendMemorized:'Gelernt',dayLabel:'{day}: {added} hinzugefügt, {memorized} gelernt, {tests} Tests',
      statsCurve:'Gelernte Wörter (letzte 30 Tage)',curveSummary:'Vor 30 Tagen {from}, jetzt {to} gelernte Wörter.',
      statsTests:'Tests',testsCount:'Tests',testsAccuracy:'Durchschnittliches Ergebnis',testsBest:'Bestes',testsNone:'Noch kein abgeschlossener Test. Ihre Ergebnisse erscheinen hier, sobald Sie einen beendet haben.',lastTests:'Letzte Tests',modeActive:'Test',modeRecall:'Wiederholen',modeCloze:'Lücke',
      statsAnalysis:'Verlaufsanalyse',hardestTitle:'Wörter, die Sie am häufigsten verfehlen',hardestNone:'Noch keine falschen Wörter.',speedTitle:'Durchschnittliche Lernzeit',speedValue:'{n} Tage (bei {m} Wörtern)',speedNone:'Noch keine gelernten Wörter.',
      statsFootnote:'Die Zahlen stammen aus den Zeitpunkten, zu denen Wörter hinzugefügt und gelernt wurden, und aus den abgeschlossenen Tests. Archivierte Wörter zählen nicht als gelernt. Testverlauf und Abzeichen bleiben auf diesem Gerät und gehören nicht zu einer Sicherung.',
      badgesSummary:'{n} / {m} Abzeichen erhalten',badgesEarned:'Erhalten',badgesStarted:'Begonnen',badgesWaiting:'Ausstehend',badgesNoneEarned:'Noch kein Abzeichen erhalten. Lernen Sie ein Wort, dann kommt das erste.',badgesNoneStarted:'Kein Abzeichen ist in Arbeit, das Sie noch nicht erhalten haben.',badgesNoneWaiting:'Kein Abzeichen steht aus: Sie haben alle begonnen.',badgeEarned:'Erhalten: {date}',badgeProgress:'{n} / {m}',newBadgeTitle:'Neues Abzeichen!',newBadgesTitle:'{n} neue Abzeichen!',
      b_memo1:'Erster Schritt',bd_memo1:'Lernen Sie ein Wort.',b_memo10:'Zehn Wörter',bd_memo10:'Lernen Sie 10 Wörter.',b_memo50:'Fünfzig Wörter',bd_memo50:'Lernen Sie 50 Wörter.',b_memo100:'Hundert Wörter',bd_memo100:'Lernen Sie 100 Wörter.',b_memo500:'Wortmeister',bd_memo500:'Lernen Sie 500 Wörter.',
      b_words50:'Sammler',bd_words50:'Fügen Sie Ihrer Liste 50 Wörter hinzu.',b_test1:'Erster Test',bd_test1:'Schließen Sie einen Test ab.',b_test10:'Regelmäßig',bd_test10:'Schließen Sie 10 Tests ab.',b_perfect:'Makellos',bd_perfect:'Beenden Sie einen Test mit 10/10.',b_recall8:'Starkes Gedächtnis',bd_recall8:'Erreichen Sie in einem Wiederholen-Test mindestens 8/10.',
      b_streak3:'Aufwärmen',bd_streak3:'Lernen Sie 3 Tage in Folge.',b_streak7:'Eine Woche',bd_streak7:'Lernen Sie 7 Tage in Folge.',b_streak30:'Ein Monat',bd_streak30:'Lernen Sie 30 Tage in Folge.',b_goal1:'Ziel erreicht',bd_goal1:'Erreichen Sie Ihr tägliches Wortziel.',b_points10:'Erste 10 Punkte',bd_points10:'Sammeln Sie 10 Punkte mit Ihren Wörtern.',b_recall1:'Erste Wiederholung',bd_recall1:'Schließen Sie Ihren ersten Wiederholen-Test ab.',b_match1:'Erstes Zuordnen',bd_match1:'Schließen Sie Ihren ersten Zuordnen-Test ab.',b_flip10:'Flip-Fan',bd_flip10:'Drehen Sie mehr als 10 Flip-Karten um.',b_flip30:'Flip-Fanatiker',bd_flip30:'Drehen Sie mehr als 30 Flip-Karten um.',b_flip50:'Flip-Meister',bd_flip50:'Drehen Sie mehr als 50 Flip-Karten um.',b_lvlA1:'A1 geschafft',bd_lvlA1:'Nehmen Sie alle Wörter der Stufe A1 in Ihre Liste auf.',b_lvlA2:'A2 geschafft',bd_lvlA2:'Nehmen Sie alle Wörter der Stufe A2 in Ihre Liste auf.',b_lvlB1:'B1 geschafft',bd_lvlB1:'Nehmen Sie alle Wörter der Stufe B1 in Ihre Liste auf.',b_lvlB2:'B2 geschafft',bd_lvlB2:'Nehmen Sie alle Wörter der Stufe B2 in Ihre Liste auf.',b_lvlC1:'C1 geschafft',bd_lvlC1:'Nehmen Sie alle Wörter der Stufe C1 in Ihre Liste auf.',b_lvlC2:'C2 geschafft',bd_lvlC2:'Nehmen Sie alle Wörter der Stufe C2 in Ihre Liste auf.',
      packTitle:'Fertige Wörter',packLevelA1:'Anfänger (A1)',packProgress:'{n} / {m} Wörter hinzugefügt',packLoading:'Paket wird heruntergeladen…',packOffline:'Das Paket konnte nicht heruntergeladen werden. Es wird erneut versucht, sobald Sie online sind.',
      packNone:'Für dieses Sprachpaar gibt es noch keine Wortdatenbank.',packDone:'Sie haben alle Wörter des Pakets hinzugefügt.',packLevelA2:'Grundstufe (A2)',packLevelB1:'Mittelstufe (B1)',packLevelB2:'Gehobene Mittelstufe (B2)',packLevelC1:'Fortgeschritten (C1)',packLevelC2:'Experte (C2)',courseDone:'Sie haben alle Wörter dieser Stufe hinzugefügt. Bei „Neue Wörter hinzufügen“ werden Sie gefragt, ob Sie zur nächsten Stufe wechseln möchten.',courseSoon:'Die Wörter dieser Stufe werden noch vorbereitet. Wählen Sie in den Einstellungen eine andere Stufe.',
      speakLabel:'Vorlesen: {text}',speakLocked:'Vorlesen gibt es mit Premium.',speakLockedLabel:'Vorlesen (Premium)',speakNoVoice:'Auf diesem Gerät gibt es keine {language}-Stimme.',speakNone:'Dieser Browser unterstützt kein Vorlesen.',speedNormal:'normal',speedSlow:'langsam',speakSpeed:'{text} ({speed})',
      aboutTitle:'Über',version:'Version',uiMode:'Oberfläche',uiProto:'Neue Oberfläche (Prototyp)',aboutWords:'Die Reihenfolge der fertigen Wörter beruht auf der Häufigkeitsliste hermitdave/FrequencyWords (CC BY-SA 4.0).',aboutSim:'Anmeldung, Premium und Zahlung in dieser Version sind Simulationen: Es gibt kein echtes Konto, keinen Server und keine Zahlung.'
    },
    es:{
      nav:'Navegación principal',today:'Hoy',words:'Palabras',study:'Estudiar',stats:'Estadísticas',profile:'Perfil',back:'Atrás',menu:'Menú',menuClose:'Cerrar menú',addedWords:'Palabras añadidas',addedTapClose:'Toca para cerrar',orbNewWord:'Palabras nuevas',orbMemorized:'Memorizado',photoAdd:'Añadir foto',photoChange:'Cambiar foto',photoRemove:'Quitar foto',photoView:'Ampliar la foto de perfil',photoRemoveTitle:'¿Quitar la foto?',photoRemoveText:'Tu foto de perfil se borra de este dispositivo. Puedes volver a añadirla más tarde.',photoRemoveYes:'Quitar',photoTitle:'Foto de perfil',photoHelp:'Arrastra para colocarla; pellizca o usa el control deslizante para ampliar. Se usa la parte que queda dentro del círculo.',photoZoom:'Zoom',photoStage:'Zona de la foto: las flechas la mueven, + y - amplían',photoSave:'Guardar',photoCancel:'Cancelar',photoBad:'Este archivo no se pudo abrir como imagen. Elige una imagen de hasta 15 MB.',photoSaveFailed:'No se pudo guardar la foto: no hay espacio suficiente en este dispositivo.',dayWordsLabel:'{day}, {kind}: {n} palabras. Mostrar las palabras',dayWordsTitle:'{day} · {kind}',dayWordsCount:'{n} palabras',dayWordsMore:'y {n} más',
      authTitle:'VocVoc',authSub:'Aprende y repasa tus palabras en tu dispositivo.',authName:'Nombre visible (opcional)',authGoogle:'Continuar con Google (simulación)',authGuest:'Continuar como invitado',
      authNote:'Simulación: no hay cuenta ni servidor reales. Tu información se queda en este dispositivo.',demoName:'Usuario de prueba',
      studyTitle:'Estudiar',studyMatch:'Emparejar',studyMatchSub:'10 rondas de 4 parejas con {n} palabras activas',quizNeedMatch:'Emparejar necesita al menos 10 palabras activas. Tienes {n}.',modeMatch:'Emparejar',studyTest:'Test',studyTestSub:'10 preguntas de {n} palabras activas',studyRecall:'Repasar',studyRecallSub:'Ponte a prueba con {n} palabras memorizadas',studyFlip:'Flip',studyFlipSub:'Repasa dando la vuelta a las tarjetas',studyCloze:'Rellenar huecos',studyClozeSub:'10 preguntas con las frases de {n} palabras',flipAuto:'Leer la palabra sola al cambiar de tarjeta',flipAutoLocked:'Lectura automática (Premium)',flipMore:'Abrir el panel de la palabra',
      statsTitle:'Estadísticas',badgesTitle:'Insignias',
      lockedTitle:'Función Premium',lockedStats:'Las estadísticas, como la actividad diaria, el acierto en los tests, la curva de aprendizaje y las rachas, llegan con Premium.',goPremium:'Pasar a Premium',
      profileTitle:'Perfil',guest:'Invitado',modeGoogle:'Google (simulación)',modeGuest:'En este dispositivo',planFree:'Gratis',planPremium:'Premium (simulación)',
      rowPremium:'Premium',rowSettings:'Ajustes',rowHelp:'Ayuda',rowPrivacy:'Política de privacidad',rowTerms:'Condiciones de uso',rowAbout:'Acerca de',
      signOut:'Cerrar sesión (simulación)',signOutNote:'Cerrar sesión no borra tus palabras ni tu progreso.',
      premiumTitle:'Premium',planLabel:'Plan actual',premiumIncludes:'Premium (además de todo lo gratuito)',
      priceNote:'Los precios son en USD. La suscripción anual tiene 2 meses gratis.',
      simulate:'Simular Premium',backToFree:'Volver al plan gratuito',simNote:'Simulación: no se cobra ningún pago real y no se compra nada.',perMonth:'/ mes',perYear:'/ año',billingLabel:'Periodo de facturación',billingMonthly:'Mensual',billingYearly:'Anual',twoMonthsFree:'2 meses gratis',yearlyNote:'Paga 10 meses en lugar de 12',monthlyEquiv:'Unos {price} al mes',
      free1:'Un regalo de 40 palabras de cada uno de los seis niveles (A1–C2)',free2:'Tarjetas, memorizar, archivo e History',free3:'Test, Repasar y Flip',free4:'Añadir palabras con la búsqueda, la palabra al azar y las etiquetas de sinónimos/antónimos',free5:'Copia de seguridad, temas y 6 idiomas de interfaz',free6:'Insignias',
      prem1:'Todo lo que viene después de las primeras 40 palabras de cada nivel, un banco de casi 10 000 palabras',prem3:'Lectura en voz alta',prem4:'Estadísticas de progreso y análisis del historial',prem5:'Objetivo diario de más de 20 palabras',
      goalTitle:'Objetivo diario',goalValue:'{n} / {m} palabras',goalUnlimited:'{n} palabras añadidas hoy',addNew:'Añadir palabras nuevas',goWords:'Ir a mis palabras',statActive:'Activas',statMemorized:'Memorizadas',statToday:'Memorizadas hoy',
      quizClose:'Cerrar',quizProgress:'Pregunta {n}/{total}',quizDone:'Terminado',quizProgressLabel:'Progreso del test',quizNeedActive:'Un test necesita al menos 10 palabras activas. Tienes {n}.',quizNeedRecall:'Repasar necesita al menos 10 palabras memorizadas. Tienes {n}.',quizNeedCloze:'Rellenar huecos necesita al menos 10 palabras con una frase de ejemplo. Tienes {n}.',backToToday:'Volver a Hoy',
      statsSummaryTotal:'Palabras en total',statsMemorized:'Memorizadas',statsStreak:'Racha (días)',statsLongest:'Racha más larga',
      statsWeek:'Últimos 7 días',legendAdded:'Añadidas',legendMemorized:'Memorizadas',dayLabel:'{day}: {added} añadidas, {memorized} memorizadas, {tests} tests',
      statsCurve:'Palabras memorizadas (últimos 30 días)',curveSummary:'Hace 30 días {from}, ahora {to} palabras memorizadas.',
      statsTests:'Tests',testsCount:'Tests',testsAccuracy:'Puntuación media',testsBest:'Mejor',testsNone:'Aún no hay ningún test terminado. Tus resultados aparecerán aquí cuando termines uno.',lastTests:'Últimos tests',modeActive:'Test',modeRecall:'Repaso',modeCloze:'Hueco',
      statsAnalysis:'Análisis del historial',hardestTitle:'Palabras que más fallas',hardestNone:'Aún no hay palabras falladas.',speedTitle:'Tiempo medio para memorizar',speedValue:'{n} días (con {m} palabras)',speedNone:'Aún no hay palabras memorizadas.',
      statsFootnote:'Las cifras salen de cuándo se añadieron y memorizaron las palabras y de los tests que terminaste. Las palabras archivadas no cuentan como memorizadas. El historial de tests y las insignias se guardan en este dispositivo y no forman parte de una copia de seguridad.',
      badgesSummary:'{n} / {m} insignias conseguidas',badgesEarned:'Conseguidas',badgesStarted:'Empezadas',badgesWaiting:'Pendientes',badgesNoneEarned:'Aún no has conseguido ninguna insignia. Memoriza una palabra y llegará la primera.',badgesNoneStarted:'No hay ninguna insignia en curso que aún no hayas conseguido.',badgesNoneWaiting:'No queda ninguna insignia pendiente: has empezado todas.',badgeEarned:'Conseguida: {date}',badgeProgress:'{n} / {m}',newBadgeTitle:'¡Nueva insignia!',newBadgesTitle:'¡{n} insignias nuevas!',
      b_memo1:'Primer paso',bd_memo1:'Memoriza una palabra.',b_memo10:'Diez palabras',bd_memo10:'Memoriza 10 palabras.',b_memo50:'Cincuenta palabras',bd_memo50:'Memoriza 50 palabras.',b_memo100:'Cien palabras',bd_memo100:'Memoriza 100 palabras.',b_memo500:'Maestro de palabras',bd_memo500:'Memoriza 500 palabras.',
      b_words50:'Coleccionista',bd_words50:'Añade 50 palabras a tu lista.',b_test1:'Primer test',bd_test1:'Completa un test.',b_test10:'Constante',bd_test10:'Completa 10 tests.',b_perfect:'Impecable',bd_perfect:'Termina un test con 10/10.',b_recall8:'Memoria fuerte',bd_recall8:'Consigue al menos 8/10 en un test de repaso.',
      b_streak3:'Calentamiento',bd_streak3:'Estudia 3 días seguidos.',b_streak7:'Una semana',bd_streak7:'Estudia 7 días seguidos.',b_streak30:'Un mes',bd_streak30:'Estudia 30 días seguidos.',b_goal1:'Objetivo cumplido',bd_goal1:'Alcanza tu objetivo diario de palabras.',b_points10:'Primeros 10 puntos',bd_points10:'Consigue 10 puntos con tus palabras.',b_recall1:'Primer repaso',bd_recall1:'Termina tu primer test de Repasar.',b_match1:'Primer emparejamiento',bd_match1:'Termina tu primer test de Emparejar.',b_flip10:'Aficionado al Flip',bd_flip10:'Gira más de 10 tarjetas Flip.',b_flip30:'Entusiasta del Flip',bd_flip30:'Gira más de 30 tarjetas Flip.',b_flip50:'Maestro del Flip',bd_flip50:'Gira más de 50 tarjetas Flip.',b_lvlA1:'A1 completado',bd_lvlA1:'Añade todas las palabras del nivel A1 a tu lista.',b_lvlA2:'A2 completado',bd_lvlA2:'Añade todas las palabras del nivel A2 a tu lista.',b_lvlB1:'B1 completado',bd_lvlB1:'Añade todas las palabras del nivel B1 a tu lista.',b_lvlB2:'B2 completado',bd_lvlB2:'Añade todas las palabras del nivel B2 a tu lista.',b_lvlC1:'C1 completado',bd_lvlC1:'Añade todas las palabras del nivel C1 a tu lista.',b_lvlC2:'C2 completado',bd_lvlC2:'Añade todas las palabras del nivel C2 a tu lista.',
      packTitle:'Palabras listas',packLevelA1:'Principiante (A1)',packProgress:'{n} / {m} palabras añadidas',packLoading:'Descargando el paquete…',packOffline:'No se pudo descargar el paquete. Se vuelve a intentar cuando tengas conexión.',
      packNone:'Todavía no hay base de palabras para este par de idiomas.',packDone:'Has añadido todas las palabras del paquete.',packLevelA2:'Elemental (A2)',packLevelB1:'Intermedio (B1)',packLevelB2:'Intermedio alto (B2)',packLevelC1:'Avanzado (C1)',packLevelC2:'Dominio (C2)',courseDone:'Has añadido todas las palabras de este nivel. Al pulsar Añadir palabras nuevas se te preguntará si quieres pasar al siguiente nivel.',courseSoon:'Las palabras de este nivel aún se están preparando. Puedes elegir otro nivel en Ajustes.',
      speakLabel:'Leer en voz alta: {text}',speakLocked:'La lectura en voz alta llega con Premium.',speakLockedLabel:'Leer en voz alta (Premium)',speakNoVoice:'No hay voz de {language} en este dispositivo.',speakNone:'Este navegador no admite la lectura en voz alta.',speedNormal:'normal',speedSlow:'lenta',speakSpeed:'{text} ({speed})',
      aboutTitle:'Acerca de',version:'Versión',uiMode:'Interfaz',uiProto:'Interfaz nueva (prototipo)',aboutWords:'El orden de las palabras listas se basa en la lista de frecuencia hermitdave/FrequencyWords (CC BY-SA 4.0).',aboutSim:'El inicio de sesión, Premium y el pago de esta versión son simulaciones: no hay cuenta, servidor ni pago reales.'
    },
    it:{
      nav:'Navigazione principale',today:'Oggi',words:'Parole',study:'Studia',stats:'Statistiche',profile:'Profilo',back:'Indietro',menu:'Menu',menuClose:'Chiudi il menu',addedWords:'Parole aggiunte',addedTapClose:'Tocca per chiudere',orbNewWord:'Parole nuove',orbMemorized:'Memorizzato',photoAdd:'Aggiungi una foto',photoChange:'Cambia foto',photoRemove:'Rimuovi foto',photoView:'Ingrandisci la foto del profilo',photoRemoveTitle:'Rimuovere la foto?',photoRemoveText:'La tua foto del profilo viene eliminata da questo dispositivo. Potrai aggiungerla di nuovo più tardi.',photoRemoveYes:'Rimuovi',photoTitle:'Foto del profilo',photoHelp:'Trascina per posizionarla, pizzica o usa il cursore per ingrandire. Viene usata la parte dentro il cerchio.',photoZoom:'Zoom',photoStage:'Area della foto: le frecce la spostano, + e - ingrandiscono',photoSave:'Salva',photoCancel:'Annulla',photoBad:'Questo file non si può aprire come immagine. Scegli un’immagine fino a 15 MB.',photoSaveFailed:'Non è stato possibile salvare la foto: su questo dispositivo non c’è abbastanza spazio.',dayWordsLabel:'{day}, {kind}: {n} parole. Mostra le parole',dayWordsTitle:'{day} · {kind}',dayWordsCount:'{n} parole',dayWordsMore:'e altre {n}',
      authTitle:'VocVoc',authSub:'Impara e ripassa le tue parole sul tuo dispositivo.',authName:'Nome visualizzato (facoltativo)',authGoogle:'Continua con Google (simulazione)',authGuest:'Continua come ospite',
      authNote:'Simulazione: non esistono un account o un server reali. Le tue informazioni restano su questo dispositivo.',demoName:'Utente demo',
      studyTitle:'Studia',studyMatch:'Abbina',studyMatchSub:'10 round da 4 coppie con {n} parole attive',quizNeedMatch:'Abbinare richiede almeno 10 parole attive. Ne hai {n}.',modeMatch:'Abbina',studyTest:'Test',studyTestSub:'10 domande da {n} parole attive',studyRecall:'Ripassa',studyRecallSub:'Mettiti alla prova su {n} parole memorizzate',studyFlip:'Flip',studyFlipSub:'Ripassa girando le carte',studyCloze:'Completa la frase',studyClozeSub:'10 domande dalle frasi di {n} parole',flipAuto:'Leggi la parola da sola quando cambia la carta',flipAutoLocked:'Lettura automatica (Premium)',flipMore:'Apri il pannello della parola',
      statsTitle:'Statistiche',badgesTitle:'Badge',
      lockedTitle:'Funzione Premium',lockedStats:'Statistiche come attività giornaliera, risultati dei test, curva di apprendimento e serie sono incluse in Premium.',goPremium:'Passa a Premium',
      profileTitle:'Profilo',guest:'Ospite',modeGoogle:'Google (simulazione)',modeGuest:'Su questo dispositivo',planFree:'Gratuito',planPremium:'Premium (simulazione)',
      rowPremium:'Premium',rowSettings:'Impostazioni',rowHelp:'Aiuto',rowPrivacy:'Informativa sulla privacy',rowTerms:'Termini d’uso',rowAbout:'Informazioni',
      signOut:'Esci (simulazione)',signOutNote:'Uscire non cancella le tue parole né i tuoi progressi.',
      premiumTitle:'Premium',planLabel:'Piano attuale',premiumIncludes:'Premium (in più rispetto a tutto ciò che è gratuito)',
      priceNote:'I prezzi sono in USD. L’abbonamento annuale ha 2 mesi gratis.',
      simulate:'Simula Premium',backToFree:'Torna al piano gratuito',simNote:'Simulazione: nessun pagamento reale viene addebitato e non si acquista nulla.',perMonth:'/ mese',perYear:'/ anno',billingLabel:'Periodo di fatturazione',billingMonthly:'Mensile',billingYearly:'Annuale',twoMonthsFree:'2 mesi gratis',yearlyNote:'Paga 10 mesi invece di 12',monthlyEquiv:'Circa {price} al mese',
      free1:'In regalo 40 parole da ciascuno dei sei livelli (A1–C2)',free2:'Carte, memorizzazione, archivio e History',free3:'Test, Ripassa e Flip',free4:'Aggiungere parole con la ricerca, la parola casuale e le etichette di sinonimi/contrari',free5:'Backup, temi e 6 lingue dell’interfaccia',free6:'Badge',
      prem1:'Tutto ciò che viene dopo le prime 40 parole di ogni livello, un archivio di quasi 10.000 parole',prem3:'Lettura ad alta voce',prem4:'Statistiche sui progressi e analisi della cronologia',prem5:'Obiettivo giornaliero oltre 20 parole',
      goalTitle:'Obiettivo giornaliero',goalValue:'{n} / {m} parole',goalUnlimited:'{n} parole aggiunte oggi',addNew:'Aggiungi parole nuove',goWords:'Vai alle mie parole',statActive:'Attive',statMemorized:'Memorizzate',statToday:'Memorizzate oggi',
      quizClose:'Chiudi',quizProgress:'Domanda {n}/{total}',quizDone:'Terminato',quizProgressLabel:'Avanzamento del test',quizNeedActive:'Un test richiede almeno 10 parole attive. Ne hai {n}.',quizNeedRecall:'Ripassa richiede almeno 10 parole memorizzate. Ne hai {n}.',quizNeedCloze:'Completa la frase richiede almeno 10 parole con una frase di esempio. Ne hai {n}.',backToToday:'Torna a Oggi',
      statsSummaryTotal:'Parole totali',statsMemorized:'Memorizzate',statsStreak:'Serie (giorni)',statsLongest:'Serie più lunga',
      statsWeek:'Ultimi 7 giorni',legendAdded:'Aggiunte',legendMemorized:'Memorizzate',dayLabel:'{day}: {added} aggiunte, {memorized} memorizzate, {tests} test',
      statsCurve:'Parole memorizzate (ultimi 30 giorni)',curveSummary:'30 giorni fa {from}, ora {to} parole memorizzate.',
      statsTests:'Test',testsCount:'Test',testsAccuracy:'Punteggio medio',testsBest:'Migliore',testsNone:'Nessun test completato per ora. I tuoi risultati compariranno qui quando ne finirai uno.',lastTests:'Ultimi test',modeActive:'Test',modeRecall:'Ripasso',modeCloze:'Spazio',
      statsAnalysis:'Analisi della cronologia',hardestTitle:'Le parole che sbagli di più',hardestNone:'Ancora nessuna parola sbagliata.',speedTitle:'Tempo medio per memorizzare',speedValue:'{n} giorni (su {m} parole)',speedNone:'Ancora nessuna parola memorizzata.',
      statsFootnote:'I numeri derivano da quando le parole sono state aggiunte e memorizzate e dai test che hai completato. Le parole archiviate non contano come memorizzate. La cronologia dei test e i badge restano su questo dispositivo e non fanno parte di un backup.',
      badgesSummary:'{n} / {m} badge ottenuti',badgesEarned:'Ottenuti',badgesStarted:'Iniziati',badgesWaiting:'In attesa',badgesNoneEarned:'Nessun badge ottenuto per ora. Memorizza una parola e arriva il primo.',badgesNoneStarted:'Nessun badge in corso che tu non abbia già ottenuto.',badgesNoneWaiting:'Nessun badge in attesa: li hai iniziati tutti.',badgeEarned:'Ottenuto: {date}',badgeProgress:'{n} / {m}',newBadgeTitle:'Nuovo badge!',newBadgesTitle:'{n} nuovi badge!',
      b_memo1:'Primo passo',bd_memo1:'Memorizza una parola.',b_memo10:'Dieci parole',bd_memo10:'Memorizza 10 parole.',b_memo50:'Cinquanta parole',bd_memo50:'Memorizza 50 parole.',b_memo100:'Cento parole',bd_memo100:'Memorizza 100 parole.',b_memo500:'Maestro delle parole',bd_memo500:'Memorizza 500 parole.',
      b_words50:'Collezionista',bd_words50:'Aggiungi 50 parole alla tua lista.',b_test1:'Primo test',bd_test1:'Completa un test.',b_test10:'Costante',bd_test10:'Completa 10 test.',b_perfect:'Impeccabile',bd_perfect:'Finisci un test con 10/10.',b_recall8:'Memoria forte',bd_recall8:'Ottieni almeno 8/10 in un test di ripasso.',
      b_streak3:'Riscaldamento',bd_streak3:'Studia 3 giorni di fila.',b_streak7:'Una settimana',bd_streak7:'Studia 7 giorni di fila.',b_streak30:'Un mese',bd_streak30:'Studia 30 giorni di fila.',b_goal1:'Obiettivo raggiunto',bd_goal1:'Raggiungi il tuo obiettivo giornaliero di parole.',b_points10:'Primi 10 punti',bd_points10:'Ottieni 10 punti con le tue parole.',b_recall1:'Primo ripasso',bd_recall1:'Completa il tuo primo test Ripassa.',b_match1:'Primo abbinamento',bd_match1:'Completa il tuo primo test Abbina.',b_flip10:'Appassionato di Flip',bd_flip10:'Gira più di 10 carte Flip.',b_flip30:'Fanatico del Flip',bd_flip30:'Gira più di 30 carte Flip.',b_flip50:'Maestro del Flip',bd_flip50:'Gira più di 50 carte Flip.',b_lvlA1:'A1 completato',bd_lvlA1:'Aggiungi alla tua lista tutte le parole del livello A1.',b_lvlA2:'A2 completato',bd_lvlA2:'Aggiungi alla tua lista tutte le parole del livello A2.',b_lvlB1:'B1 completato',bd_lvlB1:'Aggiungi alla tua lista tutte le parole del livello B1.',b_lvlB2:'B2 completato',bd_lvlB2:'Aggiungi alla tua lista tutte le parole del livello B2.',b_lvlC1:'C1 completato',bd_lvlC1:'Aggiungi alla tua lista tutte le parole del livello C1.',b_lvlC2:'C2 completato',bd_lvlC2:'Aggiungi alla tua lista tutte le parole del livello C2.',
      packTitle:'Parole già pronte',packLevelA1:'Principiante (A1)',packProgress:'{n} / {m} parole aggiunte',packLoading:'Download del pacchetto…',packOffline:'Non è stato possibile scaricare il pacchetto. Si riprova quando sei online.',
      packNone:'Non c’è ancora un database di parole per questa coppia di lingue.',packDone:'Hai aggiunto tutte le parole del pacchetto.',packLevelA2:'Elementare (A2)',packLevelB1:'Intermedio (B1)',packLevelB2:'Intermedio superiore (B2)',packLevelC1:'Avanzato (C1)',packLevelC2:'Padronanza (C2)',courseDone:'Hai aggiunto tutte le parole di questo livello. Premendo Aggiungi parole nuove ti verrà chiesto se vuoi passare al livello successivo.',courseSoon:'Le parole di questo livello sono ancora in preparazione. Puoi scegliere un altro livello nelle Impostazioni.',
      speakLabel:'Leggi ad alta voce: {text}',speakLocked:'La lettura ad alta voce è inclusa in Premium.',speakLockedLabel:'Leggi ad alta voce (Premium)',speakNoVoice:'Su questo dispositivo non c’è una voce {language}.',speakNone:'Questo browser non supporta la lettura ad alta voce.',speedNormal:'normale',speedSlow:'lenta',speakSpeed:'{text} ({speed})',
      aboutTitle:'Informazioni',version:'Versione',uiMode:'Interfaccia',uiProto:'Nuova interfaccia (prototipo)',aboutWords:'L’ordine delle parole pronte si basa sull’elenco di frequenza hermitdave/FrequencyWords (CC BY-SA 4.0).',aboutSim:'Accesso, Premium e pagamento in questa versione sono simulazioni: non esistono un account, un server o un pagamento reali.'
    }
  };
  // Long texts. They describe what the app does today and are DRAFTS: contact details, controller name, age limit and a legal review are still missing.
  const PAGES={
    privacy:{
      tr:{title:'Gizlilik Politikası',banner:'Taslak. Yayınlamadan önce iletişim bilgileri, veri sorumlusu, yaş sınırı ve hukuki gözden geçirme eklenmelidir.',sections:[
        {h:'Kısaca',p:["VocVoc'ta hesap, reklam, izleme veya analiz yoktur. Kelimelerin, ilerlemen ve ayarların yalnızca bu cihazda saklanır."]},
        {h:'Cihazında saklananlar',p:['Kelime listen, ezber ve arşiv durumun, ayarların ve (eklediysen) profil fotoğrafın tarayıcının yerel depolamasında (IndexedDB ve localStorage) tutulur ve bize gönderilmez.','Yedeği sen dışa aktarırsın; dosya senin kontrolündedir. Verileri silmek için Ayarlar\'daki "İlerlemeyi sıfırla"yı kullan ya da uygulamanın/tarayıcının verilerini temizle.']},
        {h:'Kelime veritabanı',p:['Kelimeler, uygulamanın kendi sunucusundan indirilen dosyalardan gelir ve cihazında saklanır. Arama kutusuna yazdığın veya dokunduğun kelime hiçbir yere gönderilmez; arama cihazında yapılır.','Dosyaları indirmek, uygulamayı barındıran sunucuya yapılan sıradan bir web isteğidir; bu istekte kelimelerin ya da listen yer almaz.']},
        {h:'Premium (planlanan)',p:['Premium abonelik Google Play üzerinden satın alınır; ödeme bilgilerini biz görmeyiz. Bu bölüm Premium yayınlanmadan önce güncellenecektir. Bu sürümde gerçek ödeme ve sunucu yoktur (simülasyon).']},
        {h:'İletişim',p:['[destek e-postası eklenecek]']}]},
      en:{title:'Privacy Policy',banner:'Draft. Contact details, the data controller, an age limit and a legal review must be added before release.',sections:[
        {h:'In short',p:['VocVoc has no accounts, ads, tracking or analytics. Your words, progress and settings are stored only on this device.']},
        {h:'What stays on your device',p:["Your word list, memorized and archive status, settings and (if you added one) profile photo are kept in the browser's local storage (IndexedDB and localStorage) and are not sent to us.",'You export backups yourself; the file is under your control. To delete your data use "Reset progress" in Settings or clear the app\'s or browser\'s data.']},
        {h:'Word database',p:['The words come from files that the app downloads from its own server and keeps on your device. A word you type in the search box or tap is not sent anywhere: the lookup happens on your device.','Downloading the files is an ordinary web request to the server that hosts the app; it does not include your words or your list.']},
        {h:'Premium (planned)',p:['A Premium subscription is bought through Google Play; we do not see your payment details. This section will be updated before Premium is released. This version has no real payment or server (simulation).']},
        {h:'Contact',p:['[support e-mail to be added]']}]},
      fr:{title:'Politique de confidentialité',banner:'Brouillon. Les coordonnées, le responsable du traitement, une limite d’âge et une relecture juridique doivent être ajoutés avant la publication.',sections:[
        {h:'En bref',p:['VocVoc n’a ni comptes, ni publicité, ni suivi, ni analyses. Vos mots, votre progression et vos réglages sont stockés uniquement sur cet appareil.']},
        {h:'Ce qui reste sur votre appareil',p:['Votre liste de mots, l’état mémorisé et archivé, vos réglages et (si vous en avez ajouté une) votre photo de profil sont conservés dans le stockage local du navigateur (IndexedDB et localStorage) et ne nous sont pas envoyés.','Vous exportez vous-même les sauvegardes ; le fichier reste sous votre contrôle. Pour supprimer vos données, utilisez « Réinitialiser la progression » dans les Réglages ou effacez les données de l’application ou du navigateur.']},
        {h:'Base de mots',p:['Les mots viennent de fichiers que l’application télécharge depuis son propre serveur et conserve sur votre appareil. Un mot saisi dans la zone de recherche ou touché n’est envoyé nulle part : la recherche se fait sur votre appareil.','Le téléchargement des fichiers est une requête web ordinaire vers le serveur qui héberge l’application ; elle ne contient ni vos mots ni votre liste.']},
        {h:'Premium (prévu)',p:['L’abonnement Premium s’achète via Google Play ; nous ne voyons pas vos informations de paiement. Cette section sera mise à jour avant la sortie de Premium. Cette version n’a ni vrai paiement ni serveur (simulation).']},
        {h:'Contact',p:['[adresse e-mail d’assistance à ajouter]']}]},
      de:{title:'Datenschutzerklärung',banner:'Entwurf. Kontaktdaten, der Verantwortliche, eine Altersgrenze und eine rechtliche Prüfung müssen vor der Veröffentlichung ergänzt werden.',sections:[
        {h:'Kurz gesagt',p:['VocVoc hat keine Konten, keine Werbung, kein Tracking und keine Analysen. Ihre Wörter, Ihr Fortschritt und Ihre Einstellungen werden nur auf diesem Gerät gespeichert.']},
        {h:'Was auf Ihrem Gerät bleibt',p:['Ihre Wortliste, der Status „gelernt“ und „archiviert“, Ihre Einstellungen und (falls hinzugefügt) Ihr Profilfoto liegen im lokalen Speicher des Browsers (IndexedDB und localStorage) und werden nicht an uns gesendet.','Sicherungen exportieren Sie selbst; die Datei liegt in Ihrer Hand. Zum Löschen Ihrer Daten verwenden Sie „Fortschritt zurücksetzen“ in den Einstellungen oder löschen die Daten der App bzw. des Browsers.']},
        {h:'Wortdatenbank',p:['Die Wörter stammen aus Dateien, die die App von ihrem eigenen Server lädt und auf Ihrem Gerät speichert. Ein Wort, das Sie im Suchfeld eingeben oder antippen, wird nirgendwohin gesendet: Die Suche läuft auf Ihrem Gerät.','Das Laden der Dateien ist eine gewöhnliche Webanfrage an den Server, der die App bereitstellt; sie enthält weder Ihre Wörter noch Ihre Liste.']},
        {h:'Premium (geplant)',p:['Ein Premium-Abo wird über Google Play gekauft; Ihre Zahlungsdaten sehen wir nicht. Dieser Abschnitt wird vor der Veröffentlichung von Premium aktualisiert. Diese Version hat keine echte Zahlung und keinen Server (Simulation).']},
        {h:'Kontakt',p:['[Support-E-Mail wird ergänzt]']}]},
      es:{title:'Política de privacidad',banner:'Borrador. Antes de publicar hay que añadir los datos de contacto, el responsable del tratamiento, un límite de edad y una revisión legal.',sections:[
        {h:'En breve',p:['VocVoc no tiene cuentas, anuncios, seguimiento ni analíticas. Tus palabras, tu progreso y tus ajustes se guardan solo en este dispositivo.']},
        {h:'Lo que se queda en tu dispositivo',p:['Tu lista de palabras, el estado de memorizada y archivada, tus ajustes y (si la añadiste) tu foto de perfil se guardan en el almacenamiento local del navegador (IndexedDB y localStorage) y no se nos envían.','Las copias de seguridad las exportas tú; el archivo queda bajo tu control. Para borrar tus datos usa «Restablecer progreso» en Ajustes o borra los datos de la aplicación o del navegador.']},
        {h:'Base de palabras',p:['Las palabras vienen de archivos que la aplicación descarga de su propio servidor y guarda en tu dispositivo. Una palabra que escribes en el cuadro de búsqueda o que tocas no se envía a ningún sitio: la búsqueda se hace en tu dispositivo.','Descargar los archivos es una petición web normal al servidor que aloja la aplicación; no incluye tus palabras ni tu lista.']},
        {h:'Premium (previsto)',p:['La suscripción Premium se compra a través de Google Play; no vemos tus datos de pago. Esta sección se actualizará antes de lanzar Premium. Esta versión no tiene pago real ni servidor (simulación).']},
        {h:'Contacto',p:['[se añadirá el correo de soporte]']}]},
      it:{title:'Informativa sulla privacy',banner:'Bozza. Prima della pubblicazione vanno aggiunti i recapiti, il titolare del trattamento, un limite di età e una revisione legale.',sections:[
        {h:'In breve',p:['VocVoc non ha account, pubblicità, tracciamento né analisi. Le tue parole, i tuoi progressi e le tue impostazioni sono salvati solo su questo dispositivo.']},
        {h:'Cosa resta sul tuo dispositivo',p:['La tua lista di parole, lo stato memorizzata e archiviata, le impostazioni e (se l’hai aggiunta) la foto del profilo sono conservati nella memoria locale del browser (IndexedDB e localStorage) e non ci vengono inviati.','I backup li esporti tu; il file resta sotto il tuo controllo. Per cancellare i tuoi dati usa «Azzera progressi» nelle Impostazioni oppure cancella i dati dell’app o del browser.']},
        {h:'Database di parole',p:['Le parole provengono da file che l’app scarica dal proprio server e conserva sul tuo dispositivo. Una parola che digiti nella casella di ricerca o che tocchi non viene inviata da nessuna parte: la ricerca avviene sul tuo dispositivo.','Scaricare i file è una normale richiesta web al server che ospita l’app; non include le tue parole né la tua lista.']},
        {h:'Premium (previsto)',p:['L’abbonamento Premium si acquista tramite Google Play; non vediamo i tuoi dati di pagamento. Questa sezione sarà aggiornata prima del rilascio di Premium. Questa versione non ha pagamenti reali né server (simulazione).']},
        {h:'Contatti',p:['[l’e-mail di supporto sarà aggiunta]']}]}
    },
    terms:{
      tr:{title:'Kullanım Şartları',banner:'Taslak. Yayınlamadan önce hukuki gözden geçirme gerekir.',sections:[
        {h:'Hizmet',p:['VocVoc kelime öğrenmene yardım eden bir uygulamadır ve olduğu gibi sunulur. Kelime veritabanı yapay zekâ yardımıyla hazırlanmıştır; hazır kelimeler hatalı veya eksik olabilir.']},
        {h:'Ücretsiz plan',p:['Ücretsiz planda her seviyeden (A1–C2) 40’ar kelime ekleyebilirsin; Premium bu sınırı kaldırır.']},
        {h:'Verilerin',p:['Verilerin cihazında tutulur. Düzenli yedek almak senin sorumluluğundadır; tarayıcı verisinin silinmesi kelimelerini kaybettirebilir.']},
        {h:'Premium abonelik (planlanan)',p:['Abonelik Google Play kurallarına tabidir; iptal ve iade Google Play üzerinden yapılır. Abonelik bittiğinde Premium özellikler kapanır.']},
        {h:'Değişiklikler',p:['Bu şartlar güncellenebilir; önemli değişiklikler uygulamada duyurulur.']}]},
      en:{title:'Terms of Use',banner:'Draft. A legal review is needed before release.',sections:[
        {h:'The service',p:['VocVoc helps you learn words and is provided as is. The word database was prepared with the help of AI; the ready-made words can be wrong or incomplete.']},
        {h:'Free plan',p:['The free plan lets you keep 40 words from each level (A1–C2); Premium removes this limit.']},
        {h:'Your data',p:["Your data is kept on your device. Taking regular backups is your responsibility; clearing the browser's data can lose your words."]},
        {h:'Premium subscription (planned)',p:['A subscription is subject to the Google Play rules; cancellation and refunds go through Google Play. When it ends, Premium features stop.']},
        {h:'Changes',p:['These terms may be updated; important changes are announced in the app.']}]},
      fr:{title:'Conditions d’utilisation',banner:'Brouillon. Une relecture juridique est nécessaire avant la publication.',sections:[
        {h:'Le service',p:['VocVoc vous aide à apprendre des mots et est fourni tel quel. La base de mots a été préparée avec l’aide de l’IA ; les mots prêts à l’emploi peuvent être erronés ou incomplets.']},
        {h:'Plan gratuit',p:['Le plan gratuit permet de garder 40 mots de chaque niveau (A1–C2) ; Premium supprime cette limite.']},
        {h:'Vos données',p:['Vos données sont conservées sur votre appareil. Faire des sauvegardes régulières relève de votre responsabilité ; effacer les données du navigateur peut vous faire perdre vos mots.']},
        {h:'Abonnement Premium (prévu)',p:['Un abonnement est soumis aux règles de Google Play ; l’annulation et les remboursements passent par Google Play. À sa fin, les fonctions Premium s’arrêtent.']},
        {h:'Modifications',p:['Ces conditions peuvent être mises à jour ; les changements importants sont annoncés dans l’application.']}]},
      de:{title:'Nutzungsbedingungen',banner:'Entwurf. Vor der Veröffentlichung ist eine rechtliche Prüfung nötig.',sections:[
        {h:'Der Dienst',p:['VocVoc hilft Ihnen beim Wörterlernen und wird ohne Gewähr bereitgestellt. Die Wortdatenbank wurde mit Hilfe von KI erstellt; die fertigen Wörter können falsch oder unvollständig sein.']},
        {h:'Kostenloser Plan',p:['Im kostenlosen Plan können je 40 Wörter aus jeder Stufe (A1–C2) in Ihrer Liste stehen; Premium hebt diese Grenze auf.']},
        {h:'Ihre Daten',p:['Ihre Daten bleiben auf Ihrem Gerät. Regelmäßige Sicherungen liegen in Ihrer Verantwortung; das Löschen der Browserdaten kann Ihre Wörter kosten.']},
        {h:'Premium-Abo (geplant)',p:['Ein Abo unterliegt den Regeln von Google Play; Kündigung und Erstattung laufen über Google Play. Mit seinem Ende enden die Premium-Funktionen.']},
        {h:'Änderungen',p:['Diese Bedingungen können aktualisiert werden; wichtige Änderungen werden in der App angekündigt.']}]},
      es:{title:'Condiciones de uso',banner:'Borrador. Antes de publicar hace falta una revisión legal.',sections:[
        {h:'El servicio',p:['VocVoc te ayuda a aprender palabras y se ofrece tal cual. La base de palabras se preparó con ayuda de la IA; las palabras listas pueden ser incorrectas o incompletas.']},
        {h:'Plan gratuito',p:['El plan gratuito permite tener 40 palabras de cada nivel (A1–C2); Premium quita este límite.']},
        {h:'Tus datos',p:['Tus datos se guardan en tu dispositivo. Hacer copias de seguridad con regularidad es responsabilidad tuya; borrar los datos del navegador puede hacerte perder tus palabras.']},
        {h:'Suscripción Premium (prevista)',p:['Una suscripción está sujeta a las normas de Google Play; la cancelación y los reembolsos se gestionan en Google Play. Cuando termina, las funciones Premium se detienen.']},
        {h:'Cambios',p:['Estas condiciones pueden actualizarse; los cambios importantes se anuncian en la aplicación.']}]},
      it:{title:'Termini d’uso',banner:'Bozza. Prima della pubblicazione serve una revisione legale.',sections:[
        {h:'Il servizio',p:['VocVoc ti aiuta a imparare le parole ed è fornita così com’è. Il database di parole è stato preparato con l’aiuto dell’IA; le parole già pronte possono essere errate o incomplete.']},
        {h:'Piano gratuito',p:['Il piano gratuito consente 40 parole per ogni livello (A1–C2); Premium toglie questo limite.']},
        {h:'I tuoi dati',p:['I tuoi dati restano sul tuo dispositivo. Fare backup regolari è una tua responsabilità; cancellare i dati del browser può farti perdere le parole.']},
        {h:'Abbonamento Premium (previsto)',p:['Un abbonamento è soggetto alle regole di Google Play; disdetta e rimborsi passano da Google Play. Quando termina, le funzioni Premium si fermano.']},
        {h:'Modifiche',p:['Questi termini possono essere aggiornati; le modifiche importanti vengono annunciate nell’app.']}]}
    },
    help:{
      tr:{title:'Yardım',sections:[
        {h:'Kelime ekleme',p:['Arama kutusuna bir kelime yazıp ara düğmesine bas. Kelime, kelime veritabanından bir pencerede açılır; sen "Listeme ekle"ye basana kadar listene eklenmez. Eş ve zıt anlam etiketlerine dokunduğunda da aynı pencere açılır.','"Yeni Kelime Ekle" düğmesi seçtiğin seviyeden tek seferde 10 yeni kelime ekler; rastgele düğmesi bir kelime gösterir (o da sen eklemedikçe eklenmez). Seviyenin kelimeleri bitince bir sonraki seviyeye geçmek ister misin diye sorulur.']},
        {h:'Kartlar ve kaydırma',p:['Ana ekranda bir kartı sağa kaydırırsan "Ezberimde" olur, sola kaydırırsan kapanır.','History penceresinde ve Flip\'te sağa kaydırmak ezberler, sola kaydırmak ezberden çıkarır.']},
        {h:'Test, Hatırla, Flip',p:['Test: aktif kelimelerinden 10 soru sorar. Hatırla: ezberlediğin kelimelerle test yapar. Flip: kartı çevirir; klavyede F çevirir, ok tuşları kart değiştirir, M ezber durumunu değiştirir.']},
        {h:'History ve Arşiv',p:["History listendeki kelimeleri gösterir; bir kelimeye dokunarak ayrıntısını aç. Arşive aldığın kelime listeden kalkar; Ayarlar'daki Arşiv'den geri alabilir veya kalıcı silebilirsin."]},
        {h:'Yedekleme',p:["Ayarlar'daki Veri yedeği bölümünden verilerini bir dosyaya aktarıp sonra geri yükleyebilirsin. Tarayıcı verisini silmek kelimelerini kaybettirebilir, düzenli yedek al."]},
        {h:'İnternetsiz kullanım',p:['Kayıtlı kelimeler, Test, Hatırla ve Flip internetsiz çalışır. Kelime veritabanının bir bölümü ilk kullanıldığında indirilir; indirilen bölümler internetsiz de kullanılır, henüz indirilmemiş bölümler için internet gerekir.']},
        {h:'Güncelleme uyarısı',p:['"Yeni sürüm hazır" bandında Yenile\'ye basınca "önce açık işlemi tamamlayın" uyarısı çıkarsa devam eden bir Test veya açık bir pencere vardır; onu bitirip tekrar dene.']},
        {h:'Premium (simülasyon)',p:['Bu sürümde Premium bir simülasyondur: Profil, Premium ekranından açıp kapatabilirsin. Gerçek ödeme veya sunucu yoktur.']},
        {h:'Destek',p:['[destek e-postası eklenecek]']}]},
      en:{title:'Help',sections:[
        {h:'Adding words',p:['Type a word in the search box and press the search button. The word opens in a window from the word database; it is not added to your list until you press "Add to my list". Tapping a synonym or antonym tag opens the same window.','The "Add New Words" button adds 10 new words at once from the level you chose; the random button shows one word (it is not added unless you add it). When the words of a level run out you are asked whether to move to the next level.']},
        {h:'Cards and swiping',p:['On the home screen, swipe a card right to mark it memorized, or left to close it.','In the History window and in Flip, swiping right memorizes and swiping left un-memorizes.']},
        {h:'Test, Recall, Flip',p:['Test asks 10 questions from your active words. Recall tests the words you memorized. Flip turns a card over; on a keyboard F flips, the arrow keys change card and M toggles memorized.']},
        {h:'History and Archive',p:['History shows the words in your list; tap one to open its details. An archived word leaves the list; restore or delete it for good from the Archive in Settings.']},
        {h:'Backup',p:['In the Data backup section of Settings you can export your data to a file and restore it later. Clearing browser data can lose your words, so back up regularly.']},
        {h:'Offline',p:['Saved words, Test, Recall and Flip work without internet. A part of the word database is downloaded the first time it is used; downloaded parts work offline, parts not downloaded yet need internet.']},
        {h:'Update notice',p:['If tapping Reload on the "New version ready" bar says "finish the current operation first", a Test is running or a window is open; finish it and try again.']},
        {h:'Premium (simulation)',p:['In this version Premium is a simulation: switch it on and off in Profile, Premium. There is no real payment or server.']},
        {h:'Support',p:['[support e-mail to be added]']}]},
      fr:{title:'Aide',sections:[
        {h:'Ajouter des mots',p:['Saisissez un mot dans la zone de recherche et appuyez sur le bouton de recherche. Le mot s’ouvre dans une fenêtre depuis la base de mots ; il n’est ajouté à votre liste que lorsque vous appuyez sur « Ajouter à ma liste ». Toucher une étiquette de synonyme ou de contraire ouvre la même fenêtre.','Le bouton « Ajouter de nouveaux mots » ajoute d’un coup 10 nouveaux mots du niveau choisi ; le bouton aléatoire montre un mot (il n’est ajouté que si vous l’ajoutez). Quand les mots d’un niveau sont épuisés, on vous demande si vous voulez passer au niveau suivant.']},
        {h:'Cartes et balayage',p:['Sur l’écran d’accueil, balayez une carte vers la droite pour la marquer comme mémorisée, ou vers la gauche pour la fermer.','Dans la fenêtre History et dans Flip, balayer vers la droite mémorise et balayer vers la gauche annule la mémorisation.']},
        {h:'Test, Réviser, Flip',p:['Test pose 10 questions sur vos mots actifs. Réviser teste les mots que vous avez mémorisés. Flip retourne une carte ; au clavier, F retourne, les flèches changent de carte et M bascule l’état mémorisé.']},
        {h:'History et archive',p:['History affiche les mots de votre liste ; touchez-en un pour ouvrir ses détails. Un mot archivé quitte la liste ; restaurez-le ou supprimez-le définitivement depuis l’archive dans les Réglages.']},
        {h:'Sauvegarde',p:['Dans la section Sauvegarde des données des Réglages, vous pouvez exporter vos données dans un fichier et les restaurer plus tard. Effacer les données du navigateur peut vous faire perdre vos mots, faites donc des sauvegardes régulières.']},
        {h:'Hors connexion',p:['Les mots enregistrés, Test, Réviser et Flip fonctionnent sans internet. Une partie de la base de mots est téléchargée à sa première utilisation ; les parties téléchargées fonctionnent hors connexion, les autres demandent internet.']},
        {h:'Avis de mise à jour',p:['Si l’appui sur Recharger dans la bannière « Nouvelle version prête » affiche « terminez d’abord l’opération en cours », un test est en cours ou une fenêtre est ouverte ; terminez-le puis réessayez.']},
        {h:'Premium (simulation)',p:['Dans cette version, Premium est une simulation : activez-le ou désactivez-le dans Profil, Premium. Il n’y a ni vrai paiement ni serveur.']},
        {h:'Assistance',p:['[adresse e-mail d’assistance à ajouter]']}]},
      de:{title:'Hilfe',sections:[
        {h:'Wörter hinzufügen',p:['Geben Sie ein Wort in das Suchfeld ein und tippen Sie auf die Suchtaste. Das Wort öffnet sich aus der Wortdatenbank in einem Fenster; es kommt erst in Ihre Liste, wenn Sie auf „Zu meiner Liste“ tippen. Ein Antippen von Synonym- oder Antonym-Chips öffnet dasselbe Fenster.','Die Taste „Neue Wörter hinzufügen“ fügt auf einmal 10 neue Wörter der gewählten Stufe hinzu; die Zufallstaste zeigt ein Wort (es wird nur hinzugefügt, wenn Sie es hinzufügen). Sind die Wörter einer Stufe aufgebraucht, werden Sie gefragt, ob Sie zur nächsten Stufe wechseln möchten.']},
        {h:'Karten und Wischen',p:['Auf dem Startbildschirm wischen Sie eine Karte nach rechts, um sie als gelernt zu markieren, oder nach links, um sie zu schließen.','Im History-Fenster und in Flip lernt Wischen nach rechts das Wort, Wischen nach links nimmt es zurück.']},
        {h:'Test, Wiederholen, Flip',p:['Test stellt 10 Fragen zu Ihren aktiven Wörtern. Wiederholen prüft die Wörter, die Sie gelernt haben. Flip dreht eine Karte um; auf der Tastatur dreht F um, die Pfeiltasten wechseln die Karte und M schaltet „gelernt“ um.']},
        {h:'History und Archiv',p:['History zeigt die Wörter Ihrer Liste; tippen Sie auf eines, um die Details zu öffnen. Ein archiviertes Wort verlässt die Liste; stellen Sie es im Archiv in den Einstellungen wieder her oder löschen Sie es endgültig.']},
        {h:'Sicherung',p:['Im Bereich Datensicherung der Einstellungen können Sie Ihre Daten in eine Datei exportieren und später wiederherstellen. Das Löschen der Browserdaten kann Ihre Wörter kosten, sichern Sie daher regelmäßig.']},
        {h:'Offline',p:['Gespeicherte Wörter, Test, Wiederholen und Flip funktionieren ohne Internet. Ein Teil der Wortdatenbank wird bei der ersten Nutzung geladen; geladene Teile funktionieren offline, noch nicht geladene brauchen Internet.']},
        {h:'Update-Hinweis',p:['Wenn nach dem Tippen auf Neu laden in der Leiste „Neue Version bereit“ „zuerst den laufenden Vorgang beenden“ erscheint, läuft ein Test oder ein Fenster ist offen; beenden Sie das und versuchen Sie es erneut.']},
        {h:'Premium (Simulation)',p:['In dieser Version ist Premium eine Simulation: Schalten Sie es unter Profil, Premium ein und aus. Es gibt keine echte Zahlung und keinen Server.']},
        {h:'Support',p:['[Support-E-Mail wird ergänzt]']}]},
      es:{title:'Ayuda',sections:[
        {h:'Añadir palabras',p:['Escribe una palabra en el cuadro de búsqueda y pulsa el botón de buscar. La palabra se abre en una ventana desde la base de palabras; no se añade a tu lista hasta que pulses «Añadir a mi lista». Al tocar una etiqueta de sinónimo o antónimo se abre la misma ventana.','El botón «Añadir palabras nuevas» añade 10 palabras nuevas de una vez del nivel que elegiste; el botón aleatorio muestra una palabra (solo se añade si tú la añades). Cuando se acaban las palabras de un nivel, se te pregunta si quieres pasar al siguiente.']},
        {h:'Tarjetas y deslizar',p:['En la pantalla de inicio, desliza una tarjeta a la derecha para marcarla como memorizada, o a la izquierda para cerrarla.','En la ventana History y en Flip, deslizar a la derecha memoriza y deslizar a la izquierda quita la marca.']},
        {h:'Test, Repasar, Flip',p:['Test hace 10 preguntas con tus palabras activas. Repasar prueba las palabras que memorizaste. Flip da la vuelta a una tarjeta; con el teclado, F la gira, las flechas cambian de tarjeta y M alterna memorizada.']},
        {h:'History y archivo',p:['History muestra las palabras de tu lista; toca una para abrir sus detalles. Una palabra archivada sale de la lista; restáurala o bórrala definitivamente desde el archivo en Ajustes.']},
        {h:'Copia de seguridad',p:['En la sección Copia de datos de Ajustes puedes exportar tus datos a un archivo y restaurarlos más tarde. Borrar los datos del navegador puede hacerte perder tus palabras, así que haz copias con regularidad.']},
        {h:'Sin conexión',p:['Las palabras guardadas, Test, Repasar y Flip funcionan sin internet. Una parte de la base de palabras se descarga la primera vez que se usa; las partes descargadas funcionan sin conexión, las demás necesitan internet.']},
        {h:'Aviso de actualización',p:['Si al pulsar Recargar en la barra «Nueva versión lista» aparece «termina primero la operación en curso», hay un test en marcha o una ventana abierta; termínalo y vuelve a intentarlo.']},
        {h:'Premium (simulación)',p:['En esta versión Premium es una simulación: actívalo y desactívalo en Perfil, Premium. No hay pago real ni servidor.']},
        {h:'Soporte',p:['[se añadirá el correo de soporte]']}]},
      it:{title:'Aiuto',sections:[
        {h:'Aggiungere parole',p:['Scrivi una parola nella casella di ricerca e tocca il pulsante di ricerca. La parola si apre in una finestra dal database di parole; non viene aggiunta alla tua lista finché non tocchi «Aggiungi alla mia lista». Toccando un’etichetta di sinonimo o contrario si apre la stessa finestra.','Il pulsante «Aggiungi parole nuove» aggiunge 10 parole nuove alla volta dal livello scelto; il pulsante casuale mostra una parola (viene aggiunta solo se la aggiungi tu). Quando le parole di un livello finiscono, ti viene chiesto se vuoi passare al livello successivo.']},
        {h:'Carte e scorrimento',p:['Nella schermata iniziale, scorri una carta a destra per segnarla come memorizzata, o a sinistra per chiuderla.','Nella finestra History e in Flip, scorrere a destra memorizza e scorrere a sinistra toglie il segno.']},
        {h:'Test, Ripassa, Flip',p:['Test pone 10 domande sulle tue parole attive. Ripassa mette alla prova le parole che hai memorizzato. Flip gira la carta; con la tastiera F la gira, le frecce cambiano carta e M attiva o disattiva memorizzata.']},
        {h:'History e archivio',p:['History mostra le parole della tua lista; toccane una per aprirne i dettagli. Una parola archiviata esce dalla lista; ripristinala o eliminala definitivamente dall’archivio nelle Impostazioni.']},
        {h:'Backup',p:['Nella sezione Backup dei dati delle Impostazioni puoi esportare i tuoi dati in un file e ripristinarli più tardi. Cancellare i dati del browser può farti perdere le parole, quindi fai backup regolari.']},
        {h:'Offline',p:['Le parole salvate, Test, Ripassa e Flip funzionano senza internet. Una parte del database di parole viene scaricata al primo utilizzo; le parti scaricate funzionano offline, quelle non ancora scaricate richiedono internet.']},
        {h:'Avviso di aggiornamento',p:['Se toccando Ricarica nella barra «Nuova versione pronta» compare «prima termina l’operazione in corso», c’è un test in corso o una finestra aperta; terminalo e riprova.']},
        {h:'Premium (simulazione)',p:['In questa versione Premium è una simulazione: attivalo e disattivalo in Profilo, Premium. Non c’è un pagamento reale né un server.']},
        {h:'Supporto',p:['[l’e-mail di supporto sarà aggiunta]']}]}
    }
  };
  // "Reset progress" (and a change of language) wipes the words, so the finished tests and the earned badges go with them. Works whether or not the new interface is on.
  function resetActivity(){store.remove(ACTIVITY_KEY);window.dispatchEvent(new CustomEvent('vocvoc-activity-reset'));}
  window.VocVocScreens=Object.freeze({TEXT,PAGES,resetActivity});

  if(!enabled)return;

  /* ---------- helpers ---------- */
  const lang=()=>{try{const code=typeof getAppLanguage==='function'?getAppLanguage():'tr';return Object.prototype.hasOwnProperty.call(TEXT,code)?code:'en';}catch(_){return 'tr';}};
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
    menu:'<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    settings:'<circle cx="12" cy="12" r="3.2"/><path d="M19.1 13.4a7.4 7.4 0 0 0 0-2.8l2-1.55-2-3.45-2.45 1a7.4 7.4 0 0 0-2.4-1.4L13.9 2h-3.8l-.35 3.2a7.4 7.4 0 0 0-2.4 1.4l-2.45-1-2 3.45 2 1.55a7.4 7.4 0 0 0 0 2.8l-2 1.55 2 3.45 2.45-1a7.4 7.4 0 0 0 2.4 1.4l.35 3.2h3.8l.35-3.2a7.4 7.4 0 0 0 2.4-1.4l2.45 1 2-3.45-2-1.55z"/>',
    profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    words:'<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    unlock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 017.5-2"/>',
    more:'<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>',
    speaker:'<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.5 5.5a9 9 0 010 13"/>',
    edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    trash:'<path d="M3 6h18"/><path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>'
  };
  function icon(name){const span=h('span',{class:'v2-icon','aria-hidden':'true'});span.innerHTML='<svg viewBox="0 0 24 24" focusable="false">'+ICONS[name]+'</svg>';return span;}

  /* ---------- profile (simulated) ---------- */
  function readProfile(){try{const value=JSON.parse(store.get(PROFILE_KEY)||'null');return value&&(value.mode==='guest'||value.mode==='google-sim')?value:null;}catch(_){return null;}}


  /* ---------- activity record and statistics (the numbers come from stats.js) ---------- */
  // The rest of the statistics is worked out from when words were added and memorized.
  const parseJson=text=>{try{return JSON.parse(text);}catch(_){return null;}};
  const readActivity=()=>VocVocStats.normalizeRecord(parseJson(store.get(ACTIVITY_KEY)));
  const writeActivity=record=>store.set(ACTIVITY_KEY,JSON.stringify(record));
  const today=()=>VocVocStats.localDay(new Date().toISOString());
  let statsCache=null;
  const pointsOf=db=>Object.values(db.words).reduce((sum,word)=>sum+VocVocData.studyScore(word),0);       // the points of all words together
  // The levels whose every word is in the list (archived and memorized ones count). Only when the course is loaded; a badge once earned stays.
  let levelMemo=null;
  function levelsDone(db){
    const status=wordbase?.state.status||'';
    if(levelMemo&&levelMemo.db===db&&levelMemo.status===status)return levelMemo.value;
    const value=[];
    if(wordbase&&status==='ready'&&wordbase.hasCourse())for(const level of VocVocStats.LEVELS){const {total,used}=wordbase.progress(level);if(total>0&&used>=total)value.push(level);}
    levelMemo={db,status,value};
    return value;
  }
  function currentStats(){
    const db=VocVocData.getDb(),raw=store.get(ACTIVITY_KEY)||'',day=today(),limit=getDailyLimit(),goal=Number.isFinite(limit)&&getDailyUsage().count>=limit;
    const course=wordbase?.state.status||'';
    if(statsCache&&statsCache.db===db&&statsCache.raw===raw&&statsCache.day===day&&statsCache.goal===goal&&statsCache.course===course)return statsCache.value;   // nothing changed since last time
    const record=VocVocStats.normalizeRecord(parseJson(raw));
    const words=Object.values(db.progress).map(progress=>({word:db.words[progress.wordId]?.word||'',status:progress.status,addedAt:progress.firstSeenAt||null,memorizedAt:progress.memorizedAt||null}));
    const value=VocVocStats.compute({words,quizzes:record.quizzes,testsTaken:record.testsTaken,earned:record.badges,builtin:[...BUILTIN_DICTIONARY_KEYS],today:day,goalReachedToday:goal,points:pointsOf(db),flips:record.flips,levelsDone:levelsDone(db)});
    statsCache={db,raw,day,goal,course,value};
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
  // While the words that "Add New Words" added are being thrown out of their circle (flingRun) the card waits: both are in the middle of the screen.
  const CELEBRATE_SHOW=2900,CELEBRATE_LEAVE=450,SPARKS=12;
  let celebrating=false;const celebrationWaiting=[];
  function celebrate(ids){
    celebrationWaiting.push(...ids.filter(id=>!celebrationWaiting.includes(id)));
    if(!celebrating&&!flingRun)showCelebration();
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
      h('div',{class:'v2-celebrate-art','aria-hidden':'true'},sparks,badges.slice(0,3).map(badge=>h('span',{class:'v2-medal'+(badge.kind==='level'?' v2-glyph-text':''),style:'--badge-from:'+badgeFrom(badge),text:glyphOf(badge)}))),
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
    writeActivity(VocVocStats.appendQuiz(readActivity(),{t:new Date().toISOString(),mode:['recall','cloze','match'].includes(quizSession.mode)?quizSession.mode:'active',score:quizSession.score,total:quizSession.questions.length,wrong:quizSession.wrongWords||[]}));
    evaluateBadges();
  }


  /* ---------- ready-made words (free) ---------- */
  // Every word comes from the word database (wordbase.js, the files in packs/): there is no AI and no API key. This part shows how far the user has come in the
  // level they chose and what the last press of "Add New Words" added. The adding itself is the app's own addNewWords (index.html), the one the header button runs too.
  const wordbase=window.VocVocWordbase;
  const BAND_TEXT=Object.fromEntries(['A1','A2','B1','B2','C1','C2'].map(level=>[level,'packLevel'+level]));
  const knownWord=word=>!!VocVocData.getWordProgress(word);
  let dailyWords=[];                                                             // what the last press of the button added: shown as pills under it
  async function addNewFromToday(){
    const result=await addNewWords();
    if(result.status==='added'){dailyWords=result.words.map(entry=>entry.word);refreshDashboard();}
  }
  function addedPills(){
    const words=dailyWords.filter(word=>knownWord(word)&&!isArchivedWord(word));
    if(!words.length)return null;
    return h('div',{class:'v2-added'},h('p',{class:'v2-goal-label',text:t('addedWords')}),
      h('ul',{class:'v2-pills','aria-label':t('addedWords')},words.map(word=>h('li',{},wordPill(word)))));
  }
  // "Add New Words" just added its words, so they are all known at once: the page behind goes blurred and a circle appears in the middle of the screen. Every second the
  // next word fades in inside the circle and is then thrown out of it in a badge, in a random direction and in slow motion (FLING_FADE, then FLING_THROW). Every word stays
  // where it landed; the only way out is the button at the bottom (or Escape): touching the screen does nothing. Once every word is out and has landed the circle says
  // "New 10 Words" and a press brings ten more (ten by ten).
  // A word that has landed can be held and moved around the screen: its meaning shows at the bottom while it is held, and a word it lies on glides out of its way
  // (slowly, FLING_EASE; nothing else moves), and where it is let go is where it stays (a word pushed by hand, let go while it moves, goes on for a little first). A word let go inside the circle fades out at once and goes to the memorized words (while the words are still coming a new word comes in its place). There is none when the device asks for less motion.
  const FLING_EVERY=1000,FLING_FADE=600,FLING_THROW=2600,FLING_LEAVE=450,FLING_GAP=14,FLING_SPACE=8,FLING_EDGE=12,FLING_HINT=72,FLING_APART=50,FLING_TRIES=24,FLING_STEPS=6;
  const FLING_PASSES=6,FLING_EASE=500,FLING_TAP=6,FLING_GONE=400;
  const FLING_COAST=260,FLING_REST=20,FLING_FLICK=150,FLING_SPEED=2400,FLING_TRAIL=100,FLING_IDLE=80;      // a word let go while it moves goes on for a little (ms, px/s)
  const FLING_GRAVITY=600,FLING_SPRING=14,FLING_TWIST=3,FLING_ACCEL=12000,FLING_SMOOTH=35,FLING_SWING=1.1;  // a word held by one point sags and swings around it (px/s², 1/s², 1/s, px/s², ms, rad)
  const FLING_SETTLE=40,FLING_SETTLE_DAMP=8;                                                                  // and turns back to the tilt it landed with when it is let go (1/s², 1/s)
  let flingRun=null;
  function stopFling(){
    if(!flingRun)return;
    flingRun.timers.forEach(clearTimeout);flingRun.cleanup.forEach(undo=>undo());flingRun.host.remove();flingRun=null;
  }
  function dismissFling(){
    const run=flingRun;
    if(!run||run.leaving)return;
    run.leaving=true;run.timers.forEach(clearTimeout);run.host.classList.add('v2-leaving');
    setTimeout(()=>{if(flingRun!==run)return;stopFling();if(celebrationWaiting.length&&!celebrating)showCelebration();},FLING_LEAVE);   // a new-badge card that was waiting comes now
  }
  // Two boxes (centre x, y and half width hx, half height hy): how much of them lies on the same ground.
  const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.hx,b.x+b.hx)-Math.max(a.x-a.hx,b.x-b.hx))*Math.max(0,Math.min(a.y+a.hy,b.y+b.hy)-Math.max(a.y-a.hy,b.y-b.hy));
  const clamp=(value,low,high)=>Math.min(Math.max(value,low),high);
  const span=(low,high)=>low<=high?[low,high]:[0,0];
  // Where the centre of a box may be: wholly inside the screen, FLING_EDGE from its edge and above the hint at the bottom (x and y are measured from the screen's middle).
  function reach(host,box){
    const halfW=host.clientWidth/2,halfH=host.clientHeight/2,[left,right]=span(FLING_EDGE+box.hx-halfW,halfW-FLING_EDGE-box.hx),[top,bottom]=span(FLING_EDGE+box.hy-halfH,halfH-FLING_EDGE-FLING_HINT-box.hy);
    return {left,right,top,bottom};
  }
  // How far a box (centre x, y, half width hx, half height hy) has to move to be clear of the held one, along the axis on which they overlap least; null when they
  // do not overlap.
  function away(box,held){
    const needX=box.hx+held.hx+FLING_SPACE,needY=box.hy+held.hy+FLING_SPACE,dx=box.x-held.x,dy=box.y-held.y,px=needX-Math.abs(dx),py=needY-Math.abs(dy);
    if(px<=0||py<=0)return null;
    return px<py?{x:px*(dx<0?-1:1),y:0}:{x:0,y:py*(dy<0?-1:1)};
  }
  // A landed word is drawn at (px, py), measured from the screen's middle, tilted as it landed; the one being held is a little larger.
  const place=item=>{item.node.style.transform='translate(calc(-50% + '+item.px.toFixed(1)+'px),calc(-50% + '+item.py.toFixed(1)+'px)) rotate('+item.rot.toFixed(2)+'deg)'+(flingRun&&flingRun.drag&&flingRun.drag.item===item?' scale(1.06)':'');};
  // Where the landed words want to be: at home. The held word is where the pointer has it. A word whose home lies under the held one gives way, from where it is now,
  // by the little that makes it clear of it (and stays there while the held word is over its home); nothing else moves.
  function wanted(run){
    const drag=run.drag,boxes=run.placed.filter(item=>item.landed).map(item=>({item,x:item.x,y:item.y,hx:item.hx,hy:item.hy}));
    if(!drag)return boxes;
    const held={x:drag.x,y:drag.y,hx:drag.item.hx,hy:drag.item.hy};
    for(const box of boxes){
      if(box.item===drag.item){box.x=drag.x;box.y=drag.y;continue;}
      if(!away(box,held))continue;
      const push=away({x:box.item.px,y:box.item.py,hx:box.hx,hy:box.hy},held)||{x:0,y:0},area=reach(run.host,box);
      box.x=clamp(box.item.px+push.x,area.left,area.right);box.y=clamp(box.item.py+push.y,area.top,area.bottom);
    }
    return boxes;
  }
  const inCircle=(run,drag)=>Math.hypot(drag.x,drag.y)<=run.orb.offsetWidth/2;                                               // the held word's middle is inside the circle
  const markOver=(run,drag)=>{const over=!!drag&&inCircle(run,drag);run.orb.classList.toggle('v2-over',over);run.host.classList.toggle('v2-over',over);};   // the circle shows that letting go here memorizes the word
  // The held word is let go for good: inside the circle it is memorized (when it was let go on purpose), anywhere else it stays where it is.
  function finishDrag(run,onPurpose){
    const drag=run.drag;
    run.host.classList.remove('v2-holding','v2-dragging','v2-over');run.orb.classList.remove('v2-over');drag.item.node.classList.remove('v2-held');
    if(onPurpose&&drag.moved&&inCircle(run,drag))memorizeDropped(run,drag.item);else dropWord(run);
  }
  // How fast the pointer was going when it was let go (px/s), from the last 100 ms of its way; nothing when it had stopped.
  function flick(drag,now){
    const trail=drag.trail,last=trail[trail.length-1];
    if(!last||now-last.t>FLING_IDLE)return {x:0,y:0};
    const first=trail.find(sample=>last.t-sample.t<=FLING_TRAIL),span=last.t-first.t;
    if(span<4)return {x:0,y:0};
    let vx=(last.x-first.x)/span*1000,vy=(last.y-first.y)/span*1000;
    const speed=Math.hypot(vx,vy);
    if(speed>FLING_SPEED){vx*=FLING_SPEED/speed;vy*=FLING_SPEED/speed;}
    return {x:vx,y:vy};
  }
  // A word let go while it was moving goes on for a little, slowing down (FLING_COAST) and stopping at the edge of the screen; when it has stopped it is let go for good.
  // The words it lies on give way to it as they do while it is held.
  function coast(run,dt){
    const drag=run.drag;
    if(!drag||!drag.coast)return;
    const area=reach(run.host,drag.item),x=drag.x+drag.vx*dt/1000,y=drag.y+drag.vy*dt/1000,decay=Math.exp(-dt/FLING_COAST);
    drag.x=clamp(x,area.left,area.right);drag.y=clamp(y,area.top,area.bottom);
    if(drag.x!==x)drag.vx=0;
    if(drag.y!==y)drag.vy=0;
    drag.vx*=decay;drag.vy*=decay;
    markOver(run,drag);
    if(Math.hypot(drag.vx,drag.vy)<FLING_REST)finishDrag(run,true);
  }
  // Half of the box a word of this size needs when it is tilted by `degrees`.
  const tiltBox=(item,degrees)=>{const sin=Math.abs(Math.sin(degrees*Math.PI/180)),cos=Math.abs(Math.cos(degrees*Math.PI/180));return {hx:(item.w*cos+item.h*sin)/2,hy:(item.w*sin+item.h*cos)/2};};
  // The held word hangs from the point it was grabbed by (the pivot), as if held by its ear: gravity makes it sag around that point, and when the pointer speeds up or
  // slows down sideways it swings, held back by a spring towards the tilt it landed with and slowed by a little damping. Grabbed in the middle it does not swing.
  function swing(run,drag,dt){
    const item=drag.item,seconds=Math.max(dt,4)/1000,base=item.turn*Math.PI/180;
    const speed=(drag.target.x-drag.pivot.x)/seconds,push=clamp((speed-drag.pv)/seconds,-FLING_ACCEL,FLING_ACCEL);                // the pivot's sideways speed and acceleration
    drag.pa+=(push-drag.pa)*(1-Math.exp(-dt/FLING_SMOOTH));drag.pv=speed;drag.pivot.x=drag.target.x;drag.pivot.y=drag.target.y;
    const steps=Math.max(1,Math.ceil(dt/8)),step=seconds/steps;
    for(let i=0;i<steps;i++){
      const sin=Math.sin(drag.angle),cos=Math.cos(drag.angle),rx=drag.lx*cos-drag.ly*sin,ry=drag.lx*sin+drag.ly*cos;           // from the pivot to the word's middle
      const alpha=(rx*FLING_GRAVITY+ry*drag.pa)/drag.inertia-FLING_SPRING*(drag.angle-base)-FLING_TWIST*drag.omega;
      drag.omega+=alpha*step;drag.angle+=drag.omega*step;
      if(Math.abs(drag.angle-base)>FLING_SWING){drag.angle=base+Math.sign(drag.angle-base)*FLING_SWING;drag.omega=0;}
    }
    item.rot=drag.angle*180/Math.PI;item.omega=drag.omega*180/Math.PI;Object.assign(item,tiltBox(item,item.rot));
    const sin=Math.sin(drag.angle),cos=Math.cos(drag.angle),area=reach(run.host,item);
    drag.x=clamp(drag.pivot.x+drag.lx*cos-drag.ly*sin,area.left,area.right);drag.y=clamp(drag.pivot.y+drag.lx*sin+drag.ly*cos,area.top,area.bottom);
  }
  // A word that is not held turns back to the tilt it landed with: a spring with a little damping (it overshoots once). Returns true while it is still turning.
  function relax(item,dt){
    if(Math.abs(item.rot-item.turn)<.05&&Math.abs(item.omega)<.5){
      if(item.rot!==item.turn){item.rot=item.turn;item.omega=0;Object.assign(item,tiltBox(item,item.rot));}
      return false;
    }
    const steps=Math.max(1,Math.ceil(dt/8)),step=dt/1000/steps;
    for(let i=0;i<steps;i++){item.omega+=(-FLING_SETTLE*(item.rot-item.turn)-FLING_SETTLE_DAMP*item.omega)*step;item.rot+=item.omega*step;}
    Object.assign(item,tiltBox(item,item.rot));
    return true;
  }
  function tick(now){
    const run=flingRun;
    if(!run)return;
    run.frame=0;
    const dt=run.last?Math.min(now-run.last,64):16,ease=1-Math.exp(-dt/FLING_EASE);
    run.last=now;
    coast(run,dt);
    if(run.drag&&!run.drag.coast){swing(run,run.drag,dt);markOver(run,run.drag);}                                               // the word hangs from the pointer: it may sag into the circle by itself
    let moving=!!run.drag;
    for(const box of wanted(run)){
      const item=box.item,held=!!run.drag&&run.drag.item===item,pivoted=held&&!run.drag.coast,x=held?box.x:item.px+(box.x-item.px)*ease,y=held?box.y:item.py+(box.y-item.py)*ease;
      if(Math.abs(box.x-x)>.3||Math.abs(box.y-y)>.3)moving=true;
      if(!pivoted&&relax(item,dt))moving=true;
      item.px=x;item.py=y;place(item);
    }
    if(moving){if(!run.frame)run.frame=requestAnimationFrame(tick);}else if(!run.frame)run.last=0;
  }
  const wake=run=>{if(!run.frame)run.frame=requestAnimationFrame(tick);};
  // Let go: the word stays where it is. A word whose home lies under it gets a new home: the nearest clear place from where it is now.
  function dropWord(run){
    const drag=run.drag,held={x:drag.x,y:drag.y,hx:drag.item.hx,hy:drag.item.hy};
    drag.item.x=drag.x;drag.item.y=drag.y;
    for(const item of run.placed){
      if(item===drag.item||!item.landed||!away({x:item.x,y:item.y,hx:item.hx,hy:item.hy},held))continue;
      const spot={x:item.px,y:item.py,hx:item.hx,hy:item.hy},area=reach(run.host,spot);
      for(let pass=0;pass<FLING_PASSES;pass++){
        const push=away(spot,held);
        if(!push)break;
        spot.x=clamp(spot.x+push.x,area.left,area.right);spot.y=clamp(spot.y+push.y,area.top,area.bottom);
      }
      item.x=spot.x;item.y=spot.y;
    }
    run.drag=null;wake(run);
  }
  // The colours a batch of words comes in (first, second; a gradient to the upper right): all dark enough for white text (4.5:1 or more). Every batch of words that
  // arrives gets one of them at random, never the one the batch before had; a word that replaces a memorized one keeps the colours of the word it replaces.
  const FLING_GRADIENTS=[['#15803d','#6d28d9'],['#c2410c','#6d28d9'],['#1d4ed8','#0f766e'],['#be123c','#4338ca'],['#b45309','#b91c1c'],['#0f766e','#1e40af'],['#be185d','#6d28d9'],['#4d7c0f','#047857'],['#0e7490','#4338ca'],['#a21caf','#1d4ed8']];
  const randomGradient=avoid=>{const choices=FLING_GRADIENTS.filter(pair=>pair!==avoid);return choices[Math.floor(Math.random()*choices.length)];};
  // Every word that is still to come out of the circle waits in run.queue (with its colours) and comes a second after the last one (run.pump is the timer of the next). run.busy counts
  // the words that are wanted but have not arrived yet.
  function settled(run){return !run.queue.length&&!run.pump&&!run.busy&&run.placed.every(item=>item.landed);}
  // Every word is out and has landed and nothing is on its way: the ring closes and the circle offers "New Word".
  function refreshDone(run){if(flingRun===run&&!run.leaving)run.host.classList.toggle('v2-done',settled(run));}
  function pump(run){
    if(run.pump||!run.queue.length||run.leaving)return;
    run.pump=setTimeout(()=>{
      run.pump=0;
      const entry=run.queue.shift();
      if(entry===undefined||flingRun!==run||run.leaving)return;
      run.lastAt=performance.now();run.thrown++;
      run.count.textContent=run.thrown+' / '+(run.thrown+run.queue.length);
      run.degrees=throwWord(run.host,run.orb,entry.word,entry.gradient,run.placed,run.degrees);
      pump(run);
    },Math.max(0,run.lastAt+FLING_EVERY-performance.now()));
    run.timers.push(run.pump);
  }
  // More words arrived (a replacement, or the ten the circle was asked for): they come out of the circle after the others.
  function extendFling(run,words,replace){
    const gradient=replace&&run.freed.length?run.freed.shift():(run.gradient=randomGradient(run.gradient));          // a new batch has colours of its own
    run.queue.push(...words.map(word=>({word,gradient})));run.host.classList.remove('v2-done');pump(run);
  }
  // A word let go inside the circle while the words are still coming is replaced by a new one. It does not count towards the daily goal (the word it replaces did).
  async function refill(run){
    if(run.refilling)return;
    run.refilling=true;
    try{
      while(run.owed>0){
        run.owed--;
        try{if(flingRun===run&&!run.leaving)await addNewWords({count:1,more:true,replace:true});}catch(_){}                 // the app has told the person what went wrong
        run.busy--;
      }
    }finally{run.refilling=false;refreshDone(run);}
  }
  // A word let go inside the circle: it fades out at once (the others no longer keep out of its way) and is put in the memorized words, like the app's own
  // "memorized" action does.
  function memorizeDropped(run,item){
    const at=run.placed.indexOf(item),replace=!run.host.classList.contains('v2-done');
    if(at>=0)run.placed.splice(at,1);
    run.drag=null;
    item.node.classList.remove('v2-landed','v2-held');
    item.node.style.transition='opacity '+FLING_GONE+'ms ease-out';item.node.style.opacity='0';
    setTimeout(()=>item.node.remove(),FLING_GONE);
    if(replace){run.owed++;run.busy++;run.freed.push(item.gradient);}
    Promise.resolve().then(()=>markMemorized(item.word)).catch(error=>reportStorageError(error)).then(()=>refill(run));
    refreshDone(run);wake(run);
  }
  // The meaning of a word as the app has it (in the native language), for the line at the bottom while a word is held.
  const meaningOf=word=>{try{const entry=VocVocData.getWordByText(word);return (entry&&entry.meaning)||'';}catch(_){return '';}};
  function holdWords(run){
    const host=run.host,point=event=>{const box=host.getBoundingClientRect();return {x:event.clientX-box.left-box.width/2,y:event.clientY-box.top-box.height/2};};
    host.addEventListener('pointerdown',event=>{
      const node=event.target.closest&&event.target.closest('.v2-landed'),item=node&&run.placed.find(entry=>entry.node===node);
      if(!item||run.leaving)return;
      if(run.drag){if(!run.drag.coast)return;finishDrag(run,false);}                                                          // a word that was still coasting is caught
      event.preventDefault();
      const at=point(event),meaning=meaningOf(item.word),rad=item.rot*Math.PI/180,gx=item.px-at.x,gy=item.py-at.y;          // gx, gy: from the grab point to the word's middle
      const lx=gx*Math.cos(rad)+gy*Math.sin(rad),ly=-gx*Math.sin(rad)+gy*Math.cos(rad);                                       // the same in the word's own directions
      run.drag={item,id:event.pointerId,from:at,moved:false,x:item.px,y:item.py,coast:false,vx:0,vy:0,trail:[{t:event.timeStamp,x:at.x,y:at.y}],
        pivot:{x:at.x,y:at.y},target:{x:at.x,y:at.y},pv:0,pa:0,lx,ly,angle:rad,omega:item.omega*Math.PI/180,inertia:(item.w*item.w+item.h*item.h)/12+lx*lx+ly*ly};
      try{node.setPointerCapture(event.pointerId);}catch(_){}
      run.meaning.textContent=meaning;host.classList.toggle('v2-holding',!!meaning);host.classList.add('v2-dragging');             // the circle says what letting go in it does
      node.classList.add('v2-held');place(item);wake(run);
    });
    host.addEventListener('pointermove',event=>{
      const drag=run.drag;
      if(!drag||drag.coast||event.pointerId!==drag.id)return;
      const at=point(event);
      if(Math.hypot(at.x-drag.from.x,at.y-drag.from.y)>FLING_TAP)drag.moved=true;
      drag.target.x=at.x;drag.target.y=at.y;                                                                                  // the pivot goes there; the frame loop swings the word around it
      drag.trail.push({t:event.timeStamp,x:at.x,y:at.y});if(drag.trail.length>12)drag.trail.shift();
      markOver(run,drag);wake(run);
    });
    const release=event=>{
      const drag=run.drag;
      if(!drag||drag.coast||event.pointerId!==drag.id)return;
      const speed=event.type==='pointerup'?flick(drag,event.timeStamp):{x:0,y:0};
      if(Math.hypot(speed.x,speed.y)>=FLING_FLICK){                                                                           // let go while it was moving: it goes on for a little
        drag.coast=true;drag.vx=speed.x;drag.vy=speed.y;
        host.classList.remove('v2-holding','v2-dragging');drag.item.node.classList.remove('v2-held');
        wake(run);return;
      }
      finishDrag(run,event.type==='pointerup');
    };
    host.addEventListener('pointerup',release);host.addEventListener('pointercancel',release);
  }
  // The badge fades in inside the circle (small enough to fit it), then is thrown out: it lands clear of the circle, wholly inside the screen (above the button at the
  // bottom) and clear of the badges that landed before it when the screen has room. The direction is random but never within FLING_APART degrees of the last one.
  // `placed` is the list of the words so far; returns the direction used.
  function throwWord(host,orb,word,gradient,placed,previous){
    const badge=h('span',{class:'v2-fling','aria-hidden':'true',lang:getTargetLanguageCode(),text:word});
    badge.style.setProperty('--grad-from',gradient[0]);badge.style.setProperty('--grad-to',gradient[1]);
    host.append(badge);
    const turn=Math.round(Math.random()*16-8),sin=Math.abs(Math.sin(turn*Math.PI/180)),cos=Math.cos(turn*Math.PI/180);
    const hx=(badge.offsetWidth*cos+badge.offsetHeight*sin)/2,hy=(badge.offsetWidth*sin+badge.offsetHeight*cos)/2;          // half of the box the tilted badge needs
    const radius=orb.offsetWidth/2,{left,right,top,bottom}=reach(host,{hx,hy});                                               // where the badge's centre may be
    const clear=(cx,cy)=>Math.hypot(Math.max(Math.abs(cx)-hx,0),Math.max(Math.abs(cy)-hy,0))>=radius+FLING_GAP;
    let best=null;
    for(let tries=0;tries<FLING_TRIES&&!(best&&best.lap===0);tries++){
      const degrees=(previous+FLING_APART+Math.random()*(360-2*FLING_APART))%360,radians=degrees*Math.PI/180,dx=Math.sin(radians),dy=-Math.cos(radians);
      const far=Math.min(dx>1e-3?right/dx:dx<-1e-3?left/dx:Infinity,dy>1e-3?bottom/dy:dy<-1e-3?top/dy:Infinity);          // as far as the screen shows all of it
      let near=0;while(near<=far&&!clear(dx*near,dy*near))near+=4;                                                           // as near as it is clear of the circle
      if(near>far){if(!best)best={degrees,cx:clamp(dx*(radius+hx+hy),left,right),cy:clamp(dy*(radius+hx+hy),top,bottom),lap:Infinity};continue;}
      for(let step=0;step<FLING_STEPS;step++){
        const distance=near+Math.random()*(far-near),cx=dx*distance,cy=dy*distance;
        const lap=placed.reduce((sum,other)=>sum+overlap({x:cx,y:cy,hx,hy},{x:other.x,y:other.y,hx:other.hx+FLING_SPACE,hy:other.hy+FLING_SPACE}),0);
        if(!best||lap<best.lap){best={degrees,cx,cy,lap};if(lap===0)break;}
      }
    }
    const item={node:badge,word,gradient,x:best.cx,y:best.cy,px:best.cx,py:best.cy,hx,hy,turn,rot:turn,omega:0,w:badge.offsetWidth,h:badge.offsetHeight,landed:false};
    placed.push(item);
    badge.style.setProperty('--dx',Math.round(best.cx)+'px');badge.style.setProperty('--dy',Math.round(best.cy)+'px');badge.style.setProperty('--rot',turn+'deg');
    badge.style.setProperty('--fit',Math.min(.8,orb.offsetWidth*.78/badge.offsetWidth).toFixed(2));
    badge.addEventListener('animationend',event=>{                                                                           // the throw is over (not the fade in): the page draws it from now on and it can be moved
      if(event.animationName!=='v2-fling'||item.landed)return;
      item.landed=true;item.px=item.x;item.py=item.y;
      badge.style.animation='none';badge.style.opacity='1';badge.classList.add('v2-landed');place(item);
      if(flingRun){if(flingRun.drag)wake(flingRun);refreshDone(flingRun);}
    });
    return best.degrees;
  }
  function playAddedWords(words){
    if(!words.length||(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches))return;
    stopFling();
    const first=randomGradient(null),count=h('span',{class:'v2-orb-count'}),memo=h('span',{class:'v2-orb-memo',text:t('orbMemorized')});
    const orb=h('div',{class:'v2-orb','aria-hidden':'true'},count,memo);                                                         // memo: what the circle says while a word is held
    const label=t('orbNewWord').split(' '),lines=label.length>1?[label[0],label.slice(1).join(' ')]:label;                     // "New Words" is written in two lines
    const newWord=h('button',{type:'button',class:'v2-orb-new'},lines.map((line,index)=>[index?' ':null,h('span',{text:line})]));   // in the circle once every word is out: asks for ten more
    const hint=h('button',{type:'button',class:'v2-orb-hint',onclick:dismissFling,text:t('addedTapClose')});                  // the only way out (besides Escape)
    const meaning=h('p',{class:'v2-orb-meaning','aria-hidden':'true',lang:getNativeLanguageCode()});                           // the meaning of the word that is held, in the place of the button
    const host=h('div',{id:'v2Orb',class:'v2-orb-host'},orb,newWord,hint,meaning);
    host.style.setProperty('--fling-fade',FLING_FADE+'ms');host.style.setProperty('--fling-time',FLING_THROW+'ms');
    document.body.append(host);
    const onKey=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismissFling();}};
    document.addEventListener('keydown',onKey,true);window.addEventListener('hashchange',dismissFling);
    const run=flingRun={host,orb,count,meaning,timers:[],leaving:false,placed:[],queue:words.map(word=>({word,gradient:first})),gradient:first,freed:[],thrown:0,lastAt:-Infinity,pump:0,busy:0,owed:0,refilling:false,degrees:Math.random()*360,drag:null,frame:0,last:0,cleanup:[()=>document.removeEventListener('keydown',onKey,true),()=>window.removeEventListener('hashchange',dismissFling),()=>cancelAnimationFrame(run.frame)]};
    newWord.addEventListener('click',async()=>{
      if(run.busy||run.leaving)return;
      run.busy++;newWord.disabled=true;host.classList.remove('v2-done');
      let result={status:'error'};
      try{result=await addNewWords({count:10,more:true});}catch(_){}
      run.busy--;newWord.disabled=false;
      if(result.status==='band-done')dismissFling();else refreshDone(run);                                                    // the level is finished: the app asks about the next one
    });
    holdWords(run);pump(run);
  }
  // A word as a pill: the app's own delegated handler opens its panel, like a chip of the History list.
  const wordPill=(word,extra,faded)=>h('button',{type:'button',class:'history-chip ui-pill v2-wordpill'+(faded?' v2-faded':''),'data-history-word':encodeDomText(word)},h('span',{lang:getTargetLanguageCode(),text:word}),extra?[' ',extra]:null);
  // How many words of the chosen level are in the user's list: a word added from another level (search, a synonym, the random word) counts once its level is chosen.
  function packCard(){
    const state=wordbase?.state;
    if(!state||state.status==='idle')return null;
    let text,bar=null;
    if(state.status==='ready'){
      const {total,used}=wordbase.progress();
      text=!total?t('courseSoon'):used>=total?t(wordbase.hasCourse()?'courseDone':'packDone'):fill(t('packProgress'),{n:used,m:total});
      if(total){
        bar=h('div',{class:'v2-bar v2-bar-thin',role:'progressbar','aria-label':t('packTitle'),'aria-valuemin':'0','aria-valuemax':String(total),'aria-valuenow':String(used)},h('span'));
        bar.style.setProperty('--p',Math.round(used/total*100)+'%');
      }
    }else text=t({loading:'packLoading',none:'packNone',offline:'packOffline'}[state.status]);
    return h('div',{class:'v2-card v2-pack'},h('p',{class:'v2-goal-label',text:t('packTitle')+' · '+t(wordbase.hasCourse()?BAND_TEXT[wordbase.bandOf()]:'packLevelA1')}),h('p',{class:'v2-pack-text',text}),bar);
  }

  /* ---------- read-aloud (Premium) ---------- */
  // The device's own voices (speechSynthesis): free to run, works offline, and sounds as good as the voices installed on the device.
  // Buttons are added next to the words and example sentences of the cards, the word windows and Flip; the app's own markup is not touched.
  const SPEECH_TAGS={tr:'tr-TR',en:'en-US',fr:'fr-FR',de:'de-DE',es:'es-ES',it:'it-IT'};
  const LANGUAGE_NAMES={tr:{tr:'Türkçe',en:'İngilizce',fr:'Fransızca',de:'Almanca',es:'İspanyolca',it:'İtalyanca'},en:{tr:'Turkish',en:'English',fr:'French',de:'German',es:'Spanish',it:'Italian'},
    fr:{tr:'turc',en:'anglais',fr:'français',de:'allemand',es:'espagnol',it:'italien'},de:{tr:'Türkisch',en:'Englisch',fr:'Französisch',de:'Deutsch',es:'Spanisch',it:'Italienisch'},
    es:{tr:'turco',en:'inglés',fr:'francés',de:'alemán',es:'español',it:'italiano'},it:{tr:'turco',en:'inglese',fr:'francese',de:'tedesco',es:'spagnolo',it:'italiano'}};
  const SPEEDS={normal:1,slow:0.5},SPEED_TEXT={normal:'speedNormal',slow:'speedSlow'};
  let speakingButton=null,speakToken=0,lastSpoken={text:'',step:-1};
  const speakText=button=>String(typeof button.speakText==='function'?button.speakText():'').trim();
  function syncSpeakButton(button){
    const locked=!VocVocPlan.has('speech');
    button.classList.toggle('v2-speak-free',locked);
    const label=fill(t('speakLabel'),{text:speakText(button)});
    button.setAttribute('aria-label',locked?t('speakLockedLabel'):(button.dataset.speed?fill(t('speakSpeed'),{text:label,speed:t(SPEED_TEXT[button.dataset.speed])}):label));
  }
  // info = {kind:'word'|'sentence', word:text or function}: what is read and for which word (the app gives points for it).
  function speakButton(getText,info){
    const lock=icon('lock');lock.classList.add('v2-speak-lock');
    const button=h('button',{type:'button',class:'v2-speak','aria-pressed':'false'},icon('speaker'),lock);
    button.speakText=getText;button.speakInfo=info||null;syncSpeakButton(button);
    return button;
  }
  function setSpeaking(button){
    if(speakingButton){speakingButton.setAttribute('aria-pressed','false');speakingButton.classList.remove('v2-speaking');}
    speakingButton=button;
    if(button){button.setAttribute('aria-pressed','true');button.classList.add('v2-speaking');}
  }
  function stopSpeaking(){speakToken++;if(speakingButton){try{window.speechSynthesis?.cancel();}catch(_){}setSpeaking(null);}}
  // The same text pressed again is read at the other speed: normal (1.0), then slow (0.5), then normal again ... A different text starts at normal again.
  function nextSpeed(text){
    const step=lastSpoken.text===text?lastSpoken.step+1:0;
    lastSpoken={text,step};
    return step%2===0?'normal':'slow';
  }
  function speak(button,text){
    const synth=window.speechSynthesis;
    if(!synth||typeof SpeechSynthesisUtterance==='undefined'){toast(t('speakNone'));return false;}
    synth.cancel();
    const code=getTargetLanguageCode(),tag=SPEECH_TAGS[code]||code;
    const voices=(synth.getVoices&&synth.getVoices())||[];
    const matching=voices.filter(voice=>String(voice.lang||'').replace('_','-').toLowerCase().startsWith(code));
    if(voices.length&&!matching.length){toast(fill(t('speakNoVoice'),{language:(LANGUAGE_NAMES[lang()]||LANGUAGE_NAMES.en)[code]||code}));return false;}
    const utterance=new SpeechSynthesisUtterance(text);
    const speed=nextSpeed(text);
    utterance.lang=tag;utterance.rate=SPEEDS[speed];
    const voice=matching.find(item=>item.localService&&String(item.lang).replace('_','-').toLowerCase()===tag.toLowerCase())||matching.find(item=>item.localService)||matching[0];
    if(voice)utterance.voice=voice;
    const mine=++speakToken;                                                                         // an older reading that ends late must not switch the new one off
    utterance.onend=utterance.onerror=()=>{if(speakToken===mine&&speakingButton===button)setSpeaking(null);};
    for(const other of document.querySelectorAll('.v2-speak[data-speed]'))if(other!==button){delete other.dataset.speed;delete other.dataset.rate;syncSpeakButton(other);}
    button.dataset.speed=speed;button.dataset.rate=SPEEDS[speed]+'×';syncSpeakButton(button);
    setSpeaking(button);synth.speak(utterance);
    return true;
  }
  function announceSpoken(button){
    const info=button.speakInfo;if(!info)return;
    const word=typeof info.word==='function'?info.word():info.word;
    if(word)window.dispatchEvent(new CustomEvent('vocvoc-spoken',{detail:{word,kind:info.kind}}));
  }
  function onSpeak(button){
    if(!VocVocPlan.has('speech')){toast(t('speakLocked'));return;}
    const text=speakText(button);
    if(text&&speak(button,text))announceSpoken(button);
  }
  /* ---------- Flip: a lock that reads every new card by itself (off at the first card), and the word's panel from the corner ---------- */
  let flipAuto=false,flipLastWord=null;
  const flipWord=()=>{try{return flipSession?flipSession.cards[flipSession.index].word:null;}catch(_){return null;}};
  function syncAutoButton(button){
    const locked=!VocVocPlan.has('speech');
    button.classList.toggle('v2-speak-free',locked);
    button.setAttribute('aria-pressed',String(flipAuto&&!locked));
    button.setAttribute('aria-label',locked?t('flipAutoLocked'):t('flipAuto'));
  }
  function autoReadButton(){
    const shut=icon('lock'),open=icon('unlock');shut.classList.add('v2-icon-on');open.classList.add('v2-icon-off');                  // shut = on, open = off
    const button=h('button',{type:'button',class:'v2-flip-auto','aria-pressed':'false',onclick:event=>{
      event.stopPropagation();
      if(!VocVocPlan.has('speech')){toast(t('speakLocked'));return;}
      flipAuto=!flipAuto;
      document.querySelectorAll('.v2-flip-auto').forEach(syncAutoButton);
    }},open,shut);
    syncAutoButton(button);
    return button;
  }
  const moreButton=()=>h('button',{type:'button',class:'v2-flip-more','aria-label':t('flipMore'),onclick:event=>{event.stopPropagation();const word=flipWord();if(word)toggleHistoryDetail(word);}},icon('more'));
  // A new card is read by itself when the lock is on; the card the Flip opens with never is. Closing the Flip puts the lock off again.
  function watchFlip(){
    const overlay=document.getElementById('flipOverlay');
    if(!overlay)return;
    new MutationObserver(()=>{
      const word=flipWord();
      if(!word){flipLastWord=null;flipAuto=false;return;}
      if(word===flipLastWord)return;                                                                // the same card drawn again (a filter, memorizing)
      const first=flipLastWord===null;flipLastWord=word;
      if(first||!flipAuto||!VocVocPlan.has('speech'))return;
      const button=overlay.querySelector('[data-flip-face="front"] > .v2-speak');
      if(button&&speak(button,word))announceSpoken(button);
      else if(button){flipAuto=false;document.querySelectorAll('.v2-flip-auto').forEach(syncAutoButton);}   // no voice: stop trying on every card
    }).observe(overlay,{childList:true});
  }
  // [where to put a button, how to find its text]
  const SPEECH_TARGETS=[
    ['.main-word-card',host=>{const word=decodeDomText(host.dataset.word||'');if(!word)return;const button=speakButton(()=>word,{kind:'word',word});button.classList.add('v2-speak-corner');host.classList.add('v2-has-speak');host.append(button);}],
    ['.word-panel-fixed-header .word-title',host=>{const word=host.textContent.trim();if(word)host.after(speakButton(()=>word,{kind:'word',word}));}],
    ['.example-item .fr-text,.expression-item .fr-text',host=>{const text=host.textContent.trim();if(text)host.append(speakButton(()=>text,{kind:'sentence',word:()=>decodeDomText(host.closest('[data-study-word]')?.dataset.studyWord||'')}));}],
    ['#flipOverlay .flip-panel',host=>host.append(speakButton(()=>document.querySelector('#flipOverlay [data-flip-face="front"] .flip-word-text')?.textContent||'',{kind:'word',word:()=>flipWord()}),autoReadButton(),moreButton())]
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
    watchFlip();
  }

  /* ---------- routing ---------- */
  const TABS=['today','words','study','stats','profile'];                        // the entries of the menu
  const QUIZ_ROUTES=['test','recall','cloze','match'];
  const ROUTES=[...TABS,'settings','test','recall','cloze','match','flip','premium','help','privacy','terms','about'];
  const TAB_OF={today:'today',words:'words',study:'study',stats:'stats',profile:'profile',settings:'settings',test:'study',recall:'study',cloze:'study',match:'study',flip:'study',premium:'profile',help:'profile',privacy:'profile',terms:'profile',about:'profile'};
  let shown=null,internalNavigations=0,screen=null,container=null,auth=null,root=null;
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
  // The title of a page is in the bar at the top (next to VocVoc); the heading stays in the page for screen readers and for the focus, out of sight.
  const heading=text=>h('h1',{tabindex:'-1',class:'sr-only',text});
  const backButton=()=>h('button',{type:'button',class:'v2-back',onclick:()=>goBack()},'‹ '+t('back'));
  function counts(){
    try{const {active,memorized,memorizedToday}=currentStats().summary;return {active,memorized,memorizedToday};}
    catch(_){return {active:0,memorized:0,memorizedToday:0};}
  }
  const clozeCount=()=>{try{return getClozePool().length;}catch(_){return 0;}};
  const matchCount=()=>{try{return getMatchPool().length;}catch(_){return 0;}};
  function studyScreen(){
    const {active,memorized}=counts(),tests=currentStats().tests;
    const card=(glyph,title,sub,run)=>h('button',{type:'button',class:'v2-study-card',onclick:run},
      h('span',{class:'v2-study-glyph','aria-hidden':'true',text:glyph}),
      h('span',{},h('span',{class:'v2-study-title',text:title}),h('span',{class:'v2-study-sub',text:sub})));
    return page(heading(t('studyTitle')),testsPanel(tests),
      card('◈',t('studyTest'),fill(t('studyTestSub'),{n:active}),()=>navigate('test')),
      card('↺',t('studyRecall'),fill(t('studyRecallSub'),{n:memorized}),()=>navigate('recall')),
      card('✎',t('studyCloze'),fill(t('studyClozeSub'),{n:clozeCount()}),()=>navigate('cloze')),
      card('⧉',t('studyMatch'),fill(t('studyMatchSub'),{n:matchCount()}),()=>navigate('match')),
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
        h('div',{class:'v2-goal-actions'},
          h('button',{type:'button',class:'ui-button v2-goal-add','data-v2-focus':'daily',onclick:()=>{addNewFromToday();}},t('addNew')),
          h('button',{type:'button',class:'ui-button v2-goal-words','data-v2-focus':'words',onclick:()=>navigate('words')},t('goWords'))),
        addedPills()),
      packCard(),
      h('ul',{class:'v2-statline'},tile(active,t('statActive')),tile(memorized,t('statMemorized')),tile(memorizedToday,t('statToday'))),
      weekSection(currentStats().last7),badgesSection()));
  }
  let dashboardTimer=0;
  function refreshDashboard(){                                                   // after any change of the data, once per burst
    clearTimeout(dashboardTimer);
    dashboardTimer=setTimeout(()=>{
      evaluateBadges();wordbase?.sync();
      if(shown!=='today'||!screen)return;
      const top=screen.scrollTop,active=document.activeElement,keep=screen.contains(active)?(active.dataset.v2Focus||active.tagName):'';
      screen.replaceChildren(todayScreen());screen.scrollTop=top;
      if(keep)(screen.querySelector('[data-v2-focus="'+keep+'"]')||(keep==='H1'?screen.querySelector('h1'):null))?.focus({preventScroll:true});   // the page is redrawn; the user keeps their place
    },0);
  }

  /* ---------- the Test as a page of its own ---------- */
  // The Test itself is the app's own (startQuiz, answerQuiz, the result card); this page only frames it and says how far it is.
  function quizScreen(route){
    const kind={recall:{pool:getRecallQuizPool,title:'studyRecall',need:'quizNeedRecall'},cloze:{pool:getClozePool,title:'studyCloze',need:'quizNeedCloze'},match:{pool:getMatchPool,title:'studyMatch',need:'quizNeedMatch'}}[route]||{pool:getQuizPool,title:'studyTest',need:'quizNeedActive'};
    const poolSize=kind.pool().length;
    const bar=h('div',{class:'v2-study-bar'},
      h('h1',{tabindex:'-1',text:t(kind.title)}),
      h('span',{id:'v2QuizCount',class:'v2-muted'}),
      h('button',{type:'button',class:'v2-close','aria-label':t('quizClose'),onclick:()=>goBack('study')},'×'));
    if(poolSize<10)return page(bar,h('div',{class:'v2-card'},h('p',{text:fill(t(kind.need),{n:poolSize})}),
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
      const starts={recall:[getRecallQuizPool,startRecallQuiz],cloze:[getClozePool,startClozeQuiz],match:[getMatchPool,startMatchQuiz]}[route]||[getQuizPool,startQuiz];
      if(starts[0]().length>=10){starts[1]();updateQuizProgress();}
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
  const LOCALES={tr:'tr-TR',en:'en-GB',fr:'fr-FR',de:'de-DE',es:'es-ES',it:'it-IT'};
  const locale=()=>LOCALES[lang()]||'en-GB';
  const formatDay=(day,options)=>new Date(day+'T12:00:00').toLocaleDateString(locale(),options||{day:'numeric',month:'short',year:'numeric'});
  const tile=(value,label)=>h('li',{class:'v2-stat'},h('strong',{text:String(value)}),h('span',{text:label}));
  const DAY_LONG={weekday:'long',day:'numeric',month:'long'},HOVER_MS=650;
  let dayPopup=null;
  function weekSection(days){
    const peak=Math.max(1,...days.map(day=>Math.max(day.added,day.memorized)));
    const weekday=day=>formatDay(day,{weekday:'short'});
    // A bar with something in it is a button: pressing it, or resting a mouse on it for a moment, shows the words of that day.
    const column=(day,kind)=>{
      const value=kind==='added'?day.added:day.memorized,bar=h('span',{class:'v2-col v2-col-'+kind});
      bar.style.setProperty('--h',Math.round(value/peak*100)+'%');
      if(!value)return h('span',{class:'v2-slot','aria-hidden':'true'},bar);
      let timer=0;
      const button=h('button',{type:'button',class:'v2-slot v2-slot-btn','aria-haspopup':'dialog',
        'aria-label':fill(t('dayWordsLabel'),{day:formatDay(day.day,DAY_LONG),kind:t(kind==='added'?'legendAdded':'legendMemorized'),n:value}),
        onclick:()=>{clearTimeout(timer);openDayWords(day,kind,button);}},bar);
      button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')timer=setTimeout(()=>openDayWords(day,kind,button),HOVER_MS);});
      button.addEventListener('pointerleave',()=>clearTimeout(timer));
      return button;
    };
    return h('section',{class:'v2-card'},h('h2',{text:t('statsWeek')}),
      h('ol',{class:'v2-days'},days.map(day=>h('li',{class:'v2-day'},
        h('span',{class:'sr-only',text:fill(t('dayLabel'),{day:weekday(day.day),added:day.added,memorized:day.memorized,tests:day.tests})}),
        h('span',{class:'v2-bars'},column(day,'added'),column(day,'memorized')),
        h('span',{class:'v2-day-label','aria-hidden':'true',text:weekday(day.day)}),
        h('span',{class:'v2-day-num','aria-hidden':'true',text:day.added+'/'+day.memorized})))),
      h('p',{class:'v2-legend'},h('span',{class:'v2-key v2-key-added','aria-hidden':'true'}),' '+t('legendAdded')+'   ',h('span',{class:'v2-key v2-key-memorized','aria-hidden':'true'}),' '+t('legendMemorized')));
  }
  // The words of one day in a panel, as pills: pressing a pill opens that word's own panel above it, like a chip of the History list.
  function openDayWords(day,kind,opener){
    if(dayPopup&&dayPopup.day===day.day&&dayPopup.kind===kind)return;
    closeDayWords(false);
    const words=(kind==='added'?day.addedWords:day.memorizedWords)||[],count=kind==='added'?day.added:day.memorized;
    const memorized=kind==='added'?new Set(getMemorizedWords().map(normalizeHistoryKey)):new Set();                 // what was added that day and is memorized by now looks faded, as in the History list
    const node=h('div',{id:'v2DayWords',class:'v2-popup',role:'dialog','aria-modal':'true','aria-labelledby':'v2DayWordsTitle',lang:lang()},
      h('div',{class:'v2-scrim',onclick:()=>closeDayWords()}),
      h('div',{class:'v2-popup-card'},
        h('div',{class:'v2-popup-head'},
          h('h2',{id:'v2DayWordsTitle',text:fill(t('dayWordsTitle'),{day:formatDay(day.day,DAY_LONG),kind:t(kind==='added'?'legendAdded':'legendMemorized')})}),
          h('button',{type:'button',class:'v2-popup-close','aria-label':t('quizClose'),onclick:()=>closeDayWords()},'×')),
        h('p',{class:'v2-muted',text:fill(t('dayWordsCount'),{n:count})}),
        h('ul',{class:'v2-pills'},words.map(word=>h('li',{},knownWord(word)&&!isArchivedWord(word)?wordPill(word,null,memorized.has(normalizeHistoryKey(word))):h('span',{class:'ui-pill v2-wordpill v2-wordplain',lang:getTargetLanguageCode(),text:word})))),
        count>words.length?h('p',{class:'v2-muted',text:fill(t('dayWordsMore'),{n:count-words.length})}):null));
    document.body.append(node);
    screen.inert=true;bar.inert=true;
    dayPopup={day:day.day,kind,node,opener};
    node.querySelector('.v2-popup-close').focus({preventScroll:true});
  }
  function closeDayWords(restoreFocus=true){
    if(!dayPopup)return;
    const {node,opener}=dayPopup;dayPopup=null;
    node.remove();screen.inert=false;bar.inert=false;
    if(restoreFocus&&opener?.isConnected)opener.focus({preventScroll:true});
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
            h('span',{class:'v2-test-day',text:formatDay(VocVocStats.localDay(test.t))}),h('span',{class:'v2-muted',text:t({recall:'modeRecall',cloze:'modeCloze',match:'modeMatch'}[test.mode]||'modeActive')}),h('strong',{text:test.score+'/'+test.total}))))
        :h('p',{class:'v2-muted',text:t('testsNone')}));
  }
  function analysisSection(stats){
    return h('section',{class:'v2-card'},h('h2',{text:t('statsAnalysis')}),
      h('h3',{text:t('hardestTitle')}),
      stats.tests.hardest.length
        ?h('ul',{class:'v2-chips'},stats.tests.hardest.map(item=>knownWord(item.word)&&!isArchivedWord(item.word)
          ?h('li',{},wordPill(item.word,h('span',{class:'v2-muted',text:'×'+item.count})))
          :h('li',{class:'v2-chip',lang:getTargetLanguageCode()},item.word,' ',h('span',{class:'v2-muted',text:'×'+item.count}))))
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
  const GLYPH={memorized:'✓',collected:'☰',tests:'◈',perfect:'★',recall:'↺',streak:'✦',goal:'◎',points:'✪',recallTests:'↺',matchTests:'⧉',flips:'⟳'};
  const glyphOf=badge=>badge.kind==='level'?badge.level:(GLYPH[badge.kind]||'★');                     // a level badge shows its level
  // A badge is a gradient: the first colour belongs to the kind of badge (or the level), the second one is always purple.
  const BADGE_FROM={memorized:'#15803d',collected:'#1d4ed8',tests:'#0f766e',perfect:'#b45309',recall:'#0e7490',streak:'#c2410c',goal:'#be185d',points:'#a16207',recallTests:'#0369a1',matchTests:'#be123c',flips:'#4d7c0f'};     // all with white on top at 4.5:1 or more (the purple end is 5.7:1)
  const LEVEL_FROM={A1:'#1d4ed8',A2:'#0e7490',B1:'#047857',B2:'#4d7c0f',C1:'#b45309',C2:'#b91c1c'};
  const badgeFrom=badge=>badge.kind==='level'?(LEVEL_FROM[badge.level]||'#2563eb'):(BADGE_FROM[badge.kind]||'#2563eb');
  // A card is one family of badges (VocVocStats.groupBadges). While a goal is still ahead it is quiet (a lock and the progress towards that goal) and the goals
  // reached so far stay on it as small gradients; when every goal is reached the card is a gradient itself.
  function tierList(card){
    return h('ul',{class:'v2-tiers'},card.earned.map(tier=>h('li',{class:'v2-tier'},
      h('span',{class:'v2-tier-dot','aria-hidden':'true',style:'--badge-from:'+badgeFrom(tier),text:glyphOf(tier)}),
      h('span',{class:'v2-tier-text'},h('span',{class:'v2-tier-name',text:t('b_'+tier.id)}),h('span',{class:'v2-tier-date',text:fill(t('badgeEarned'),{date:formatDay(tier.earnedOn)})})))));
  }
  function badgeCard(card){
    const goal=card.current,done=card.done;
    const bar=done?null:h('div',{class:'v2-bar v2-bar-thin',role:'progressbar','aria-label':t('b_'+goal.id),'aria-valuemin':'0','aria-valuemax':String(goal.target),'aria-valuenow':String(goal.progress)},h('span'));
    bar?.style.setProperty('--p',Math.round(goal.progress/goal.target*100)+'%');
    return h('li',{class:'v2-badge'+(done?' v2-earned':'')},
      h('span',{class:'v2-badge-icon'+(done&&goal.kind==='level'?' v2-glyph-text':''),'aria-hidden':'true',style:done?'--badge-from:'+badgeFrom(goal):null},done?glyphOf(goal):icon('lock')),
      h('div',{class:'v2-badge-body'},h('h3',{text:t('b_'+goal.id)}),h('p',{class:'v2-muted',text:t('bd_'+goal.id)}),
        done?h('p',{class:'v2-badge-date',text:fill(t('badgeEarned'),{date:formatDay(goal.earnedOn)})}):h('p',{class:'v2-muted',text:fill(t('badgeProgress'),{n:goal.progress,m:goal.target})}),
        bar,
        card.tiers.length>1&&card.earned.length?tierList(card):null));
  }
  // Three tabs: the cards with a goal reached (the newest first; one that is quiet again for its next goal stays here), the ones started but with no goal reached yet
  // (closest first) and the ones still waiting. The tab you pick stays picked.
  let badgeTab=null;
  const BADGE_TABS=[['earned','badgesEarned','badgesNoneEarned'],['started','badgesStarted','badgesNoneStarted'],['waiting','badgesWaiting','badgesNoneWaiting']];
  function badgeGroups(cards){
    const ratio=card=>card.current.progress/card.current.target;
    return {
      earned:cards.filter(card=>card.earned.length).sort((a,b)=>b.lastEarnedOn.localeCompare(a.lastEarnedOn)),
      started:cards.filter(card=>!card.earned.length&&card.current.progress>0).sort((a,b)=>ratio(b)-ratio(a)),
      waiting:cards.filter(card=>!card.earned.length&&card.current.progress<=0)
    };
  }
  function selectBadgeTab(id,{focus=false}={}){
    badgeTab=id;
    const current=document.querySelector('.v2-badges-section');if(!current)return;
    const fresh=badgesSection();current.replaceWith(fresh);
    if(focus)fresh.querySelector('[role="tab"][aria-selected="true"]')?.focus({preventScroll:true});
  }
  function badgesSection(){                                                      // the whole list, at the end of Today
    const badges=currentStats().badges,groups=badgeGroups(VocVocStats.groupBadges(badges));
    if(!badgeTab)badgeTab=groups.earned.length?'earned':(groups.started.length?'started':'waiting');
    const tabs=BADGE_TABS.map(([id])=>id);
    const move=(event,id)=>{                                                       // arrows, Home and End move between the tabs
      const index=tabs.indexOf(id),step={ArrowRight:1,ArrowLeft:-1}[event.key];
      const target=event.key==='Home'?tabs[0]:event.key==='End'?tabs[tabs.length-1]:step?tabs[(index+step+tabs.length)%tabs.length]:null;
      if(target){event.preventDefault();selectBadgeTab(target,{focus:true});}
    };
    const [,,noneKey]=BADGE_TABS.find(([id])=>id===badgeTab),list=groups[badgeTab];
    return h('section',{class:'v2-badges-section','aria-labelledby':'v2BadgesTitle'},h('h2',{id:'v2BadgesTitle',text:t('badgesTitle')}),
      h('p',{class:'v2-muted',text:fill(t('badgesSummary'),{n:badges.filter(badge=>badge.earnedOn).length,m:badges.length})}),
      h('div',{class:'v2-subtabs',role:'tablist','aria-label':t('badgesTitle')},BADGE_TABS.map(([id,key])=>
        h('button',{type:'button',role:'tab',id:'v2BadgeTab-'+id,class:'v2-subtab','aria-selected':String(id===badgeTab),'aria-controls':'v2BadgePanel',tabindex:id===badgeTab?'0':'-1',onclick:()=>selectBadgeTab(id),onkeydown:event=>move(event,id)},
          h('span',{text:t(key)}),' ',h('span',{class:'v2-subtab-count',text:String(groups[id].length)})))),
      h('div',{id:'v2BadgePanel',role:'tabpanel','aria-labelledby':'v2BadgeTab-'+badgeTab},
        list.length?h('ul',{class:'v2-badges'},list.map(badgeCard)):h('p',{class:'v2-muted v2-empty',text:t(noneKey)})));
  }
  function chipFor(plan){return h('span',{class:'v2-chip'+(plan==='premium'?' v2-premium':''),text:t(plan==='premium'?'planPremium':'planFree')});}
  function profileScreen(){
    const profile=readProfile()||{mode:'guest',name:''};
    const name=profile.name||t('guest');
    const row=(label,run,end,danger)=>h('li',{},h('button',{type:'button',class:'v2-row','data-danger':danger?'':null,onclick:run},h('span',{text:label}),end?h('span',{class:'v2-row-end',text:end}):null));
    return page(heading(t('profileTitle')),
      h('div',{class:'v2-card'},
        h('div',{class:'v2-profile-head'},
          // The picture (or the first letter) with its two actions laid over its edge: change/add (pencil, lower right) and remove (bin, lower left).
          // The picture itself opens a larger view.
          h('div',{class:'v2-photo-wrap'},
            photo?h('button',{type:'button',class:'v2-avatar v2-avatar-open','aria-label':t('photoView'),'aria-haspopup':'dialog',onclick:openPhotoView},photoCanvas(PROFILE_PHOTO))
                 :h('div',{class:'v2-avatar','aria-hidden':'true'},name.trim().charAt(0).toUpperCase()||'V'),
            h('button',{type:'button',class:'v2-photo-btn v2-photo-edit','data-v2-focus':'photo','aria-label':t(photo?'photoChange':'photoAdd'),title:t(photo?'photoChange':'photoAdd'),onclick:()=>document.getElementById('v2PhotoInput').click()},icon('edit')),
            photo?h('button',{type:'button',class:'v2-photo-btn v2-photo-remove','aria-label':t('photoRemove'),title:t('photoRemove'),onclick:askRemovePhoto},icon('trash')):null),
          h('div',{},h('p',{class:'v2-profile-name',text:name}),h('div',{},chipFor(VocVocPlan.get())),h('p',{class:'v2-muted v2-profile-mode',text:t(profile.mode==='google-sim'?'modeGoogle':'modeGuest')}))),
        h('input',{type:'file',id:'v2PhotoInput',accept:'image/*',hidden:true,onchange:event=>chosePhoto(event.target)})),
      h('ul',{class:'v2-rows'},
        row(t('rowPremium'),()=>navigate('premium'),'›'),
        row(t('rowSettings'),()=>navigate('settings'),'›')),
      h('ul',{class:'v2-rows'},
        row(t('rowHelp'),()=>navigate('help'),'›'),row(t('rowPrivacy'),()=>navigate('privacy'),'›'),row(t('rowTerms'),()=>navigate('terms'),'›'),row(t('rowAbout'),()=>navigate('about'),'›')),
      h('ul',{class:'v2-rows'},
        row(t('signOut'),signOut,'',true)),
      h('p',{class:'v2-muted',text:t('signOutNote')}));
  }
  // Two plan cards (Free, Premium) and a Monthly / Yearly switch. Nothing is bought: the switch only changes what the Premium card shows.
  const PRICE={monthly:1.99,yearly:19.9,yearlyFull:23.88};                          // USD; the yearly price is 10 months of the monthly one (2 months free)
  let billing=store.get(BILLING_KEY)==='monthly'?'monthly':'yearly';
  const money=value=>(value===0?'0':value.toLocaleString(lang()==='en'?'en-US':lang(),{minimumFractionDigits:2,maximumFractionDigits:2}))+' USD';
  function premiumScreen(){
    const premium=VocVocPlan.get()==='premium',yearly=billing==='yearly';
    const list=(keys,extra)=>h('ul',{class:'v2-feature-list'+(extra?' '+extra:'')},keys.map(key=>h('li',{text:t(key)})));
    const choose=kind=>()=>{billing=kind;store.set(BILLING_KEY,kind);render(false);};
    const switcher=h('div',{class:'v2-billing',role:'group','aria-label':t('billingLabel')},
      ['monthly','yearly'].map(kind=>h('button',{type:'button',class:'v2-billing-btn','aria-pressed':String(billing===kind),onclick:choose(kind)},
        t(kind==='monthly'?'billingMonthly':'billingYearly'),kind==='yearly'?h('span',{class:'v2-billing-tag',text:t('twoMonthsFree')}):null)));
    const freeCard=h('section',{class:'v2-plan v2-plan-free','aria-labelledby':'v2PlanFree'},
      h('div',{class:'v2-plan-head'},h('h2',{id:'v2PlanFree',class:'v2-plan-name',text:t('planFree')}),premium?null:h('span',{class:'v2-chip',text:t('planLabel')})),
      h('p',{class:'v2-plan-price'},h('span',{class:'v2-plan-amount',text:money(0)}),h('span',{class:'v2-plan-unit',text:t('perMonth')})),
      list(['free1','free2','free3','free4','free5','free6']));
    const paidCard=h('section',{class:'v2-plan v2-plan-premium','aria-labelledby':'v2PlanPremium'},
      yearly?h('span',{class:'v2-plan-ribbon',text:'★ '+t('twoMonthsFree')}):null,
      h('div',{class:'v2-plan-head'},h('h2',{id:'v2PlanPremium',class:'v2-plan-name',text:t('premiumTitle')}),premium?h('span',{class:'v2-chip v2-chip-on-dark',text:t('planLabel')}):null),
      switcher,
      h('p',{class:'v2-plan-price'},h('span',{class:'v2-plan-amount',text:money(yearly?PRICE.yearly:PRICE.monthly)}),h('span',{class:'v2-plan-unit',text:t(yearly?'perYear':'perMonth')})),
      yearly?h('p',{class:'v2-plan-sub'},h('s',{text:money(PRICE.yearlyFull)}),' ',t('yearlyNote'),' · ',fill(t('monthlyEquiv'),{price:money(PRICE.yearly/12)})):null,
      h('p',{class:'v2-plan-caption',text:t('premiumIncludes')}),
      list(['prem1','prem3','prem4','prem5'],'v2-premium-list'),
      premium
        ?h('button',{type:'button',class:'ui-button v2-plan-btn v2-plan-btn-quiet',onclick:()=>VocVocPlan.set('free')},t('backToFree'))
        :h('button',{type:'button',class:'ui-button v2-plan-btn',onclick:()=>VocVocPlan.set('premium')},t('simulate')));
    return page(backButton(),heading(t('premiumTitle')),
      h('div',{class:'v2-plans'},freeCard,paidCard),
      h('p',{class:'v2-muted',text:t('priceNote')}),h('p',{class:'v2-muted',text:t('simNote')}));
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
      h('p',{class:'v2-note',text:t('aboutWords')}),
      h('ul',{class:'v2-rows'},[['rowHelp','help'],['rowPrivacy','privacy'],['rowTerms','terms']].map(([key,route])=>
        h('li',{},h('button',{type:'button',class:'v2-row',onclick:()=>navigate(route)},h('span',{text:t(key)}),h('span',{class:'v2-row-end',text:'›'}))))));
  }
  /* ---------- Settings, a page like the others ---------- */
  // The settings themselves (the panels with their dropdowns, the backup, archive and reset rows) are the app's own markup: the body of the Settings panel in index.html, with
  // its ids and handlers. This page shows that same body in place of the old full-screen dialog and gives it back to the dialog when the page is left (the old interface
  // still opens it as a dialog). A limit that was typed and not left yet is saved when the page is left.
  function settingsScreen(){
    const body=document.querySelector('.settings-panel-body');
    if(typeof syncSettingsPanel==='function')syncSettingsPanel();                    // the panels show what is saved
    const node=page(heading(t('rowSettings')),body);
    node.classList.add('v2-settings');
    return node;
  }
  function leaveSettings(){
    const body=document.querySelector('#v2Screen .settings-panel-body');
    if(!body)return;
    if(typeof closeUiDropdowns==='function')closeUiDropdowns();
    if(typeof closeDailyLimitMenu==='function')closeDailyLimitMenu();
    if(typeof autoSaveSettings==='function')autoSaveSettings();
    document.querySelector('#modalOverlay .settings-modal')?.append(body);
  }
  function build(route){
    switch(route){
      case 'today':return todayScreen();
      case 'study':case 'flip':return studyScreen();
      case 'test':case 'recall':case 'cloze':case 'match':return quizScreen(route);
      case 'stats':return statsScreen();
      case 'profile':return profileScreen();
      case 'settings':return settingsScreen();
      case 'premium':return premiumScreen();
      case 'help':case 'privacy':case 'terms':return textPage(route);
      case 'about':return aboutScreen();
      default:return null;
    }
  }

  /* ---------- the bar at the top of every page, and the menu that slides in from the left ---------- */
  // The bar says VocVoc, opens the menu (the entries the tab bar used to have, and Settings at the bottom) and leads to the profile.
  // There is no picture to show yet (the sign-in is a simulation): the round button shows the first letter of the name.
  let bar=null,drawer=null,menuButton=null,avatarButton=null,barTitle=null,drawerItems=[];
  // What the bar says next to VocVoc: the title of the page that is open.
  function pageTitle(route){
    if(route==='help'||route==='privacy'||route==='terms')return (PAGES[route][lang()]||PAGES[route].en).title;
    return t({today:'today',words:'words',study:'studyTitle',stats:'statsTitle',profile:'profileTitle',settings:'rowSettings',premium:'premiumTitle',about:'aboutTitle',test:'studyTest',recall:'studyRecall',cloze:'studyCloze',match:'studyMatch',flip:'studyFlip'}[route]||'today');
  }
  function syncChrome(){
    const route=shown||currentRoute(),current=TAB_OF[route],name=readProfile()?.name||t('guest');
    barTitle.textContent=pageTitle(route);
    avatarButton.firstChild.replaceChildren(photo?photoCanvas(36):(name.trim().charAt(0).toUpperCase()||'V'));
    avatarButton.setAttribute('aria-label',t('profile')+': '+name);
    menuButton.setAttribute('aria-label',t('menu'));
    drawer.setAttribute('aria-label',t('menu'));drawer.lang=lang();
    drawer.querySelector('nav').setAttribute('aria-label',t('nav'));
    drawer.querySelector('.v2-drawer-close').setAttribute('aria-label',t('menuClose'));
    for(const item of drawerItems){
      item.querySelector('.v2-nav-label').textContent=t(item.dataset.label);
      if(item.dataset.route===current)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
    }
  }
  function setDrawer(open){
    if(open===drawer.classList.contains('v2-open'))return;
    drawer.classList.toggle('v2-open',open);
    drawer.inert=!open;container.inert=open;screen.inert=open;bar.inert=open;                       // nothing behind the menu can be reached while it is open
    menuButton.setAttribute('aria-expanded',String(open));
    if(open)(drawer.querySelector('[aria-current="page"]')||drawerItems[0]).focus({preventScroll:true});
    else menuButton.focus({preventScroll:true});
  }

  /* ---------- render ---------- */
  function render(moveFocus){
    const route=currentRoute(),was=shown;shown=route;
    if(was==='settings'&&route!=='settings')leaveSettings();
    stopSpeaking();closeDayWords(false);closePhotoView(false);closeConfirm(false);
    // Leaving the study pages ends what they started: a Test that was left is abandoned, an open Flip is closed.
    if(!QUIZ_ROUTES.includes(route)&&quizSession)quizSession=null;
    if(route!=='flip'&&flipSession)closeFlip();
    document.body.classList.toggle('v2-immersive',QUIZ_ROUTES.includes(route));
    syncChrome();
    if(route==='words'){                                                           // the existing home screen: search, word cards, the list
      container.classList.remove('v2-away');screen.hidden=true;screen.replaceChildren();delete screen.dataset.route;
      if(was&&was!=='words')window.renderAllLocal?.();                              // coming back from another page: the cards are drawn again, in the order of the day and the points of now
      return;
    }
    container.classList.add('v2-away');screen.hidden=false;screen.dataset.route=route;
    screen.replaceChildren(build(route));screen.scrollTop=0;
    afterRender(route);
    // The Test and Flip put focus on their own first control (the app's keyboard design); every other page takes it on its heading.
    if(moveFocus&&!QUIZ_ROUTES.includes(route)&&route!=='flip')screen.querySelector('h1')?.focus({preventScroll:true});
  }

  /* ---------- profile photo (kept only on this device) ---------- */
  // A picture is chosen from the device, moved and zoomed inside a circle and kept as a small square JPEG. The page's security policy allows no data: or
  // blob: images, so the picture is decoded with createImageBitmap and drawn on canvases instead of being shown as an image.
  const PHOTO_KEY='VOCVOC_SIM_PHOTO',PHOTO_SIZE=256,PHOTO_MAX_BYTES=15*1024*1024,MAX_ZOOM=5;
  let photo=null,crop=null;                                                      // the decoded picture of the profile (or null), the open crop dialog (or null)
  function dataUrlToBlob(url){
    const [head,body]=String(url).split(',');
    return new Blob([Uint8Array.from(atob(body||''),letter=>letter.charCodeAt(0))],{type:/^data:([^;]+)/.exec(head)?.[1]||'image/jpeg'});
  }
  function photoCanvas(size){                                                    // the picture, round, to fill a circle of this many CSS pixels
    const canvas=document.createElement('canvas'),ratio=Math.min(2,window.devicePixelRatio||1);
    canvas.width=canvas.height=Math.round(size*ratio);canvas.className='v2-photo';
    canvas.getContext('2d').drawImage(photo,0,0,canvas.width,canvas.height);
    return canvas;
  }
  async function loadPhoto(){
    const stored=store.get(PHOTO_KEY);photo=null;
    if(stored&&/^data:image\/jpeg;base64,/.test(stored)){try{photo=await createImageBitmap(dataUrlToBlob(stored));}catch(_){store.remove(PHOTO_KEY);}}
    if(shown)syncChrome();
    if(shown==='profile'&&!crop)render(false);
  }
  function removePhoto(){store.remove(PHOTO_KEY);photo=null;syncChrome();render(false);screen.querySelector('[data-v2-focus="photo"]')?.focus({preventScroll:true});}
  // Two small dialogs of the profile: the picture larger, and the question before the picture is removed. Like the crop dialog they are
  // modal: the page and the bar behind them cannot be reached, Escape and the dark area close them, and focus goes back where it was.
  const PROFILE_PHOTO=96;                                                        // CSS pixels of the round picture on the profile page
  let viewer=null,asking=null;                                                   // the open larger view and the open "remove it?" question (or null)
  function leaveDialog(node){node.remove();screen.inert=false;bar.inert=false;}
  function closePhotoView(restoreFocus=true){
    if(!viewer)return;
    leaveDialog(viewer);viewer=null;
    if(restoreFocus)screen.querySelector('.v2-avatar-open')?.focus({preventScroll:true});
  }
  function openPhotoView(){
    if(!photo||viewer)return;
    const side=Math.max(200,Math.min(340,Math.floor(Math.min(window.innerWidth,window.innerHeight)*0.84))),big=photoCanvas(side);
    big.style.width=big.style.height=side+'px';
    viewer=h('div',{id:'v2PhotoView',class:'v2-crop v2-view',role:'dialog','aria-modal':'true','aria-label':t('photoTitle'),lang:lang()},
      h('div',{class:'v2-scrim',onclick:()=>closePhotoView()}),
      h('div',{class:'v2-view-card'},big,h('button',{type:'button',class:'v2-view-close','aria-label':t('quizClose'),onclick:()=>closePhotoView()},'×')));
    document.body.append(viewer);screen.inert=true;bar.inert=true;
    viewer.querySelector('.v2-view-close').focus({preventScroll:true});
  }
  function closeConfirm(restoreFocus=true){
    if(!asking)return;
    leaveDialog(asking);asking=null;
    if(restoreFocus)screen.querySelector('.v2-photo-remove')?.focus({preventScroll:true});
  }
  function askRemovePhoto(){
    if(!photo||asking)return;
    const cancel=h('button',{type:'button',class:'ui-button ui-button-secondary',onclick:()=>closeConfirm()},t('photoCancel'));   // the safe answer has the focus
    asking=h('div',{id:'v2Confirm',class:'v2-crop v2-confirm',role:'alertdialog','aria-modal':'true','aria-labelledby':'v2ConfirmTitle','aria-describedby':'v2ConfirmText',lang:lang()},
      h('div',{class:'v2-scrim',onclick:()=>closeConfirm()}),
      h('div',{class:'v2-crop-card'},h('h2',{id:'v2ConfirmTitle',text:t('photoRemoveTitle')}),h('p',{id:'v2ConfirmText',text:t('photoRemoveText')}),
        h('div',{class:'v2-actions'},cancel,h('button',{type:'button',class:'ui-button ui-button-danger',onclick:()=>{closeConfirm(false);removePhoto();}},t('photoRemoveYes')))));
    document.body.append(asking);screen.inert=true;bar.inert=true;cancel.focus({preventScroll:true});
  }
  async function chosePhoto(input){
    const file=input.files&&input.files[0];input.value='';                       // the same file can be chosen again
    if(!file)return;
    let bitmap=null;
    if(/^image\//.test(file.type)&&file.size<=PHOTO_MAX_BYTES&&typeof createImageBitmap==='function'){try{bitmap=await createImageBitmap(file);}catch(_){bitmap=null;}}
    if(!bitmap){toast(t('photoBad'));return;}
    openCrop(bitmap);
  }
  function closeCrop(){
    if(!crop)return;
    const {node,bitmap}=crop;crop=null;node.remove();bitmap.close?.();
    screen.inert=false;bar.inert=false;
    screen.querySelector('[data-v2-focus="photo"]')?.focus({preventScroll:true});
  }
  // The picture is drawn under a round window. Dragging moves it, two fingers, the wheel, the slider or + and - zoom it; it always covers the whole window.
  function openCrop(bitmap){
    closeCrop();
    const side=Math.max(180,Math.min(300,Math.floor(Math.min(window.innerWidth,window.innerHeight)*0.78))),ratio=Math.min(2,window.devicePixelRatio||1);
    const fit=side/Math.min(bitmap.width,bitmap.height),view={scale:fit,x:(side-bitmap.width*fit)/2,y:(side-bitmap.height*fit)/2};
    const canvas=h('canvas',{class:'v2-crop-canvas',width:String(Math.round(side*ratio)),height:String(Math.round(side*ratio))}),context2d=canvas.getContext('2d');
    const slider=h('input',{type:'range',min:'100',max:String(MAX_ZOOM*100),step:'1',value:'100','aria-label':t('photoZoom'),oninput:()=>zoomTo(fit*Number(slider.value)/100)});
    const draw=()=>{
      view.x=Math.min(0,Math.max(side-bitmap.width*view.scale,view.x));view.y=Math.min(0,Math.max(side-bitmap.height*view.scale,view.y));
      context2d.setTransform(ratio,0,0,ratio,0,0);context2d.fillStyle='#fff';context2d.fillRect(0,0,side,side);
      context2d.drawImage(bitmap,view.x,view.y,bitmap.width*view.scale,bitmap.height*view.scale);
      slider.value=String(Math.round(view.scale/fit*100));
    };
    function zoomTo(scale,fx=side/2,fy=side/2){                                    // around a point (the middle, or between the fingers)
      const next=Math.min(fit*MAX_ZOOM,Math.max(fit,scale)),k=next/view.scale;
      view.x=fx-(fx-view.x)*k;view.y=fy-(fy-view.y)*k;view.scale=next;draw();
    }
    const stage=h('div',{class:'v2-crop-stage',tabindex:'0',role:'group','aria-label':t('photoStage')},canvas,h('div',{class:'v2-crop-mask','aria-hidden':'true'}));
    stage.style.width=stage.style.height=side+'px';
    const pointers=new Map();let pinch=0;
    stage.addEventListener('pointerdown',event=>{stage.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});pinch=0;event.preventDefault();});
    stage.addEventListener('pointermove',event=>{
      const before=pointers.get(event.pointerId);if(!before)return;
      const now={x:event.clientX,y:event.clientY};
      if(pointers.size===1){view.x+=now.x-before.x;view.y+=now.y-before.y;pointers.set(event.pointerId,now);draw();return;}
      pointers.set(event.pointerId,now);
      const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),box=stage.getBoundingClientRect();
      if(pinch)zoomTo(view.scale*distance/pinch,(a.x+b.x)/2-box.left,(a.y+b.y)/2-box.top);
      pinch=distance;
    });
    const release=event=>{pointers.delete(event.pointerId);pinch=0;};
    stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);
    stage.addEventListener('wheel',event=>{event.preventDefault();const box=stage.getBoundingClientRect();zoomTo(view.scale*Math.exp(-event.deltaY/400),event.clientX-box.left,event.clientY-box.top);},{passive:false});
    stage.addEventListener('keydown',event=>{
      const move={ArrowLeft:[12,0],ArrowRight:[-12,0],ArrowUp:[0,12],ArrowDown:[0,-12]}[event.key];
      if(move){event.preventDefault();view.x+=move[0];view.y+=move[1];draw();}
      else if(event.key==='+'||event.key==='='){event.preventDefault();zoomTo(view.scale*1.1);}
      else if(event.key==='-'){event.preventDefault();zoomTo(view.scale/1.1);}
    });
    const save=async()=>{
      const out=document.createElement('canvas');out.width=out.height=PHOTO_SIZE;
      const outContext=out.getContext('2d');outContext.fillStyle='#fff';outContext.fillRect(0,0,PHOTO_SIZE,PHOTO_SIZE);
      outContext.drawImage(bitmap,-view.x/view.scale,-view.y/view.scale,side/view.scale,side/view.scale,0,0,PHOTO_SIZE,PHOTO_SIZE);
      const url=out.toDataURL('image/jpeg',0.85);
      store.set(PHOTO_KEY,url);
      if(store.get(PHOTO_KEY)!==url){toast(t('photoSaveFailed'));return;}         // the device had no room
      closeCrop();await loadPhoto();syncChrome();render(false);screen.querySelector('[data-v2-focus="photo"]')?.focus({preventScroll:true});
    };
    const node=h('div',{id:'v2Crop',class:'v2-crop',role:'dialog','aria-modal':'true','aria-labelledby':'v2CropTitle',lang:lang()},
      h('div',{class:'v2-scrim',onclick:closeCrop}),
      h('div',{class:'v2-crop-card'},h('h2',{id:'v2CropTitle',text:t('photoTitle')}),h('p',{class:'v2-muted',text:t('photoHelp')}),stage,
        h('label',{class:'v2-crop-zoom'},h('span',{text:t('photoZoom')}),slider),
        h('div',{class:'v2-actions'},h('button',{type:'button',class:'ui-button ui-button-secondary',onclick:closeCrop},t('photoCancel')),h('button',{type:'button',class:'ui-button ui-button-success',onclick:save},t('photoSave')))));
    document.body.append(node);screen.inert=true;bar.inert=true;
    crop={node,bitmap};draw();stage.focus({preventScroll:true});
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
  function signOut(){store.remove(PROFILE_KEY);store.remove(PHOTO_KEY);photo=null;openAuth();}

  /* ---------- start ---------- */
  function start(){
    document.body.classList.add('v2');
    container=document.querySelector('.container');
    screen=h('main',{id:'v2Screen',class:'v2-screen',hidden:true});
    menuButton=h('button',{type:'button',class:'v2-menu-btn','aria-controls':'v2Drawer','aria-expanded':'false',onclick:()=>setDrawer(true)},icon('menu'));
    avatarButton=h('button',{type:'button',class:'v2-avatar-btn',onclick:()=>navigate('profile')},h('span',{class:'v2-avatar-dot','aria-hidden':'true'}));
    barTitle=h('span',{class:'v2-bar-title','aria-hidden':'true'});                                  // the page's own heading is in the page (out of sight); this one is for the eyes
    bar=h('div',{class:'v2-appbar',role:'banner'},menuButton,
      h('div',{class:'v2-bar-line'},h('span',{class:'v2-brand',text:'VocVoc'}),h('span',{class:'v2-bar-sep','aria-hidden':'true'}),barTitle),   // one line: the name and the title sit on the same baseline
      avatarButton);
    const entry=(route,label,run)=>h('button',{type:'button',class:'v2-nav-item'+(route==='settings'?' v2-nav-settings':''),'data-route':route,'data-label':label,onclick:run},icon(route==='settings'?'settings':route),h('span',{class:'v2-nav-label'}));
    drawer=h('div',{id:'v2Drawer',class:'v2-drawer',role:'dialog','aria-modal':'true',inert:true},
      h('div',{class:'v2-scrim',onclick:()=>setDrawer(false)}),
      h('nav',{class:'v2-drawer-panel'},
        h('div',{class:'v2-drawer-head'},h('span',{class:'v2-brand',text:'VocVoc'}),h('button',{type:'button',class:'v2-drawer-close',onclick:()=>setDrawer(false)},'×')),
        h('ul',{class:'v2-nav-list'},TABS.map(route=>h('li',{},entry(route,route,()=>{setDrawer(false);navigate(route);})))),
        h('div',{class:'v2-drawer-foot'},entry('settings','rowSettings',()=>{setDrawer(false);navigate('settings');}))));
    drawerItems=[...drawer.querySelectorAll('.v2-nav-item')];
    root=h('div',{id:'v2Root',class:'v2-root'},bar,screen,drawer);
    auth=h('div',{id:'v2Auth',class:'v2-auth',role:'dialog','aria-modal':'true','aria-labelledby':'v2AuthTitle'});
    document.body.append(root,auth);
    loadPhoto();
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drawer.classList.contains('v2-open')){event.preventDefault();setDrawer(false);}},true);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&crop){event.preventDefault();closeCrop();}},true);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(asking||viewer)){event.preventDefault();if(asking)closeConfirm();else closePhotoView();}},true);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dayPopup&&!document.querySelector('.word-popup-overlay.open')){event.preventDefault();closeDayWords();}},true);
    // Today follows every change of the data
    evaluateBadges();
    wordbase?.refresh();
    window.addEventListener('vocvoc-wordbase-changed',refreshDashboard);
    window.openModal=()=>navigate('settings');                                                                              // Settings is a page here: whatever opens it (the old bar button, a test) comes to it
    window.addEventListener('vocvoc-flipped',()=>{writeActivity(VocVocStats.appendFlip(readActivity()));evaluateBadges();});     // a Flip card was turned over: it counts for the Flip badges
    window.addEventListener('vocvoc-words-added',event=>{
      const detail=event.detail||{},words=detail.words||[];
      if(detail.more&&flingRun&&!flingRun.leaving){dailyWords=[...new Set([...dailyWords,...words])];extendFling(flingRun,words,!!detail.replace);}      // more words (a replacement, or the ten asked for in the circle): they come out after the others
      else playAddedWords(words);
    });     // "Add New Words" (the button on Today or the one in the bar) added these words
    window.addEventListener('vocvoc-activity-reset',()=>{dailyWords=[];refreshDashboard();});
    window.addEventListener('vocvoc-storage-committed',refreshDashboard);
    window.addEventListener('vocvoc-data-adopted',refreshDashboard);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshDashboard();});
    document.addEventListener('vocvoc-quiz-rendered',updateQuizProgress);
    document.addEventListener('vocvoc-quiz-rendered',recordFinishedTest);
    // Flip is the app's own dialog; when it is closed (its x, Escape, the back button) the address goes back with it
    const flip=document.getElementById('flipOverlay');
    if(flip)new MutationObserver(()=>{if(!flip.classList.contains('open')&&shown==='flip')goBack('study');}).observe(flip,{attributes:true,attributeFilter:['class']});
    window.addEventListener('hashchange',()=>{if(currentRoute()!==shown)render(true);});
    window.addEventListener('vocvoc-plan-changed',()=>{document.querySelectorAll('.v2-speak').forEach(syncSpeakButton);document.querySelectorAll('.v2-flip-auto').forEach(syncAutoButton);if(['stats','premium','profile'].includes(shown))render(false);});
    // The interface language was changed (Settings): the bar, the menu and the page follow at once. A running Test or Flip is left as it is.
    window.addEventListener('vocvoc-language-applied',()=>{
      if(!shown||!bar)return;
      syncChrome();
      document.querySelectorAll('.v2-speak').forEach(syncSpeakButton);document.querySelectorAll('.v2-flip-auto').forEach(syncAutoButton);
      if(shown==='words'||QUIZ_ROUTES.includes(shown)||shown==='flip')return;
      const top=screen.scrollTop;render(false);screen.scrollTop=top;
    });
    window.addEventListener('online',()=>{if(wordbase?.state.status==='offline')wordbase.refresh();});
    startSpeech();
    render(false);
    if(!readProfile())openAuth();
  }
  // The app's own start-up (database, migration) finishes first; its boot cover goes away when it is done.
  const boot=document.getElementById('storageBoot');
  if(!boot||boot.hidden)start();
  else{const observer=new MutationObserver(()=>{if(boot.hidden){observer.disconnect();start();}});observer.observe(boot,{attributes:true,attributeFilter:['hidden']});}
})();
