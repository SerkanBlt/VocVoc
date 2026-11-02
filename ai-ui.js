'use strict';
/* The screens of the AI features: Inbox, Chat room, Story and Sentence. screens.js owns routing and the bar; it asks this file for the routes, the study cards and the
   inbox badge and hands over its small toolkit (h, page, heading, navigate, goBack, lang, fill). Data and the service are in ai.js. No innerHTML with data. */
(function(){
  const TEXT={
    tr:{
      inbox:'Gelen kutusu',inboxTitle:'Gelen kutusu',inboxEmpty:'Henüz mesaj yok. Sohbet odası değerlendirmeleri ve hata analizleri burada görünür.',unread:'okunmadı',delete:'Sil',
      analyzeNow:'Hatalarımı analiz et',analyzing:'Analiz ediliyor…',nothingNew:'Analiz edilecek yeni hata yok.',reportTitle:'Hata analizi',chatTitle:'Sohbet değerlendirmesi',
      score:'Puan',strengths:'İyi yaptıkların',mistakes:'Hatalar',patterns:'Tekrar eden hatalar',tips:'Öneriler',focus:'Çalışılacak kelimeler',used:'Kullanılan kelimeler',missed:'Kullanılmayanlar',advice:'Tavsiye',
      basedOn:'{n} hataya dayanır',
      aiStudy:'Yapay zekâ ile',chatCard:'Sohbet odası',chatSub:'Kelimelerinle sesli sohbet et, sonunda değerlendirme gelsin',storyCard:'Hikâye',storySub:'Kelimelerinle seviyene uygun bir hikâye',sentenceCard:'Cümle düzeltme',sentenceSub:'Cümle yaz, yazım ve söz dizimi önerileri al',
      chatPage:'Sohbet odası',storyPage:'Hikâye',sentencePage:'Cümle düzeltme',
      needWords:'Önce listene birkaç kelime ekle.',
      start:'Başlat',talk:'Konuş',listening:'Dinliyorum…',stopTalk:'Durdur',send:'Gönder',typeHere:'Ya da buraya yaz…',you:'Sen',tutor:'Eğitmen',thinking:'Düşünüyor…',
      endChat:'Bitir ve değerlendir',evaluating:'Değerlendiriliyor…',sentToInbox:'Değerlendirme gelen kutuna gönderildi.',openInbox:'Gelen kutusunu aç',tooShort:'Değerlendirme için biraz daha konuş.',noVoiceInput:'Bu tarayıcı sesli girişi desteklemiyor; yazarak devam edebilirsin.',
      handsFree:'Eğitmen bitince otomatik dinle',
      makeStory:'Hikâye oluştur',newStory:'Yeni hikâye',showTranslation:'Çeviriyi göster',hideTranslation:'Çeviriyi gizle',listen:'Dinle',stopListen:'Durdur',tapWord:'Bir kelimeye dokunarak listene ekleyebilirsin.',
      quiz:'Test',quizDone:'{n}/{m} doğru',checkAnswers:'Cevapları kontrol et',
      sentenceFor:'Şu kelimeyle bir cümle yaz:',sentencePh:'Cümleni yaz…',check:'Kontrol et',nextWord:'Başka kelime',perfect:'Cümlen doğru görünüyor.',betterHint:'Daha iyisi — düzeltmek için dokun',applied:'Cümle düzeltildi.',
      checking:'Kontrol ediliyor…',
      errUnavailable:'Yapay zekâ servisi bu adreste kurulu değil.',errOffline:'Bağlantı yok ya da servis yanıt vermedi.',errBusy:'Servis meşgul, biraz sonra tekrar dene.',errTimeout:'Servis zaman aşımına uğradı.',errBad:'Servis beklenmeyen bir yanıt verdi.',
      retry:'Tekrar dene',back:'Geri'
    },
    en:{
      inbox:'Inbox',inboxTitle:'Inbox',inboxEmpty:'No messages yet. Chat evaluations and mistake analyses show up here.',unread:'unread',delete:'Delete',
      analyzeNow:'Analyse my mistakes',analyzing:'Analysing…',nothingNew:'There are no new mistakes to analyse.',reportTitle:'Mistake analysis',chatTitle:'Chat evaluation',
      score:'Score',strengths:'What went well',mistakes:'Mistakes',patterns:'Repeated mistakes',tips:'Tips',focus:'Words to practise',used:'Words used',missed:'Words not used',advice:'Advice',
      basedOn:'Based on {n} mistakes',
      aiStudy:'With AI',chatCard:'Chat room',chatSub:'Talk with your words, get an evaluation at the end',storyCard:'Story',storySub:'A story for your words and your level',sentenceCard:'Sentence correction',sentenceSub:'Write a sentence, get spelling and word-order help',
      chatPage:'Chat room',storyPage:'Story',sentencePage:'Sentence correction',
      needWords:'Add a few words to your list first.',
      start:'Start',talk:'Talk',listening:'Listening…',stopTalk:'Stop',send:'Send',typeHere:'Or type here…',you:'You',tutor:'Tutor',thinking:'Thinking…',
      endChat:'Finish and evaluate',evaluating:'Evaluating…',sentToInbox:'The evaluation was sent to your inbox.',openInbox:'Open inbox',tooShort:'Talk a little more to get an evaluation.',noVoiceInput:'This browser has no voice input; you can type instead.',
      handsFree:'Listen automatically after the tutor',
      makeStory:'Create a story',newStory:'New story',showTranslation:'Show translation',hideTranslation:'Hide translation',listen:'Listen',stopListen:'Stop',tapWord:'Tap a word to add it to your list.',
      quiz:'Quiz',quizDone:'{n}/{m} correct',checkAnswers:'Check answers',
      sentenceFor:'Write a sentence with:',sentencePh:'Write your sentence…',check:'Check',nextWord:'Another word',perfect:'Your sentence looks right.',betterHint:'Better — tap to apply',applied:'Sentence corrected.',
      checking:'Checking…',
      errUnavailable:'The AI service is not set up at this address.',errOffline:'No connection, or the service did not answer.',errBusy:'The service is busy, try again shortly.',errTimeout:'The service timed out.',errBad:'The service gave an unexpected answer.',
      retry:'Try again',back:'Back'
    }
  };
  const SPEECH_LANG={fr:'fr-FR',en:'en-US',de:'de-DE',es:'es-ES',it:'it-IT',tr:'tr-TR'};
  let kit=null,cleanup=null;
  const t=key=>{const l=kit?kit.lang():'en';return (TEXT[l]||TEXT.en)[key]??TEXT.en[key]??key;};
  const fill=(text,values)=>text.replace(/\{(\w+)\}/g,(_,name)=>String(values[name]));
  const AI=()=>window.VocVocAI;
  const errorText=error=>{const text=t({unavailable:'errUnavailable',offline:'errOffline',busy:'errBusy',timeout:'errTimeout'}[error?.aiCode]||'errBad');return error?.aiCode==='bad'&&error.detail?text+' ('+error.detail+')':text;};
  const dateText=iso=>{try{return new Date(iso).toLocaleString(kit.lang()==='tr'?'tr-TR':undefined,{dateStyle:'medium',timeStyle:'short'});}catch(_){return iso;}};
  const list=items=>Array.isArray(items)?items.filter(item=>typeof item==='string'&&item.trim()):[];
  const speechLang=()=>SPEECH_LANG[AI().context().target]||'fr-FR';
  const SpeechRec=()=>window.SpeechRecognition||window.webkitSpeechRecognition||null;
  function speak(text,{onend}={}){
    const synth=window.speechSynthesis;
    if(!synth||!text){onend?.();return;}
    synth.cancel();
    const utterance=new SpeechSynthesisUtterance(text);utterance.lang=speechLang();utterance.rate=.95;
    utterance.onend=utterance.onerror=()=>onend?.();
    synth.speak(utterance);
  }
  const stopSpeaking=()=>{try{window.speechSynthesis?.cancel();}catch(_){}};
  function status(node,text,{error=false,retry=null}={}){
    node.replaceChildren();node.hidden=!text;if(!text)return;
    node.className='v2-ai-status'+(error?' v2-ai-error':'');
    node.append(text);
    if(retry){const b=kit.h('button',{type:'button',class:'ui-button ui-button-secondary',onclick:retry},t('retry'));node.append(' ',b);}
  }
  const ensureWords=()=>AI().context().words.length>0;
  const needWordsCard=()=>kit.h('div',{class:'v2-card'},kit.h('p',{text:t('needWords')}));
  const section=(title,...kids)=>kit.h('div',{class:'v2-ai-section'},kit.h('h3',{text:title}),kids);
  const bullets=items=>kit.h('ul',{class:'v2-ai-list'},items.map(text=>kit.h('li',{text})));
  const pair=(said,better)=>kit.h('p',{class:'v2-ai-pair'},kit.h('span',{class:'v2-ai-said',text:said}),' → ',kit.h('span',{class:'v2-ai-better',text:better}));

  /* ---------- inbox ---------- */
  function messageBody(m){
    const b=m.body||{},h=kit.h,out=[];
    if(b.summary)out.push(h('p',{text:b.summary}));
    if(m.kind==='chat'){
      if(Number.isFinite(b.score))out.push(h('p',{class:'v2-ai-score',text:t('score')+': '+Math.round(b.score)+'/100'}));
      if(list(b.strengths).length)out.push(section(t('strengths'),bullets(list(b.strengths))));
      if(Array.isArray(b.mistakes)&&b.mistakes.length)out.push(section(t('mistakes'),b.mistakes.map(x=>h('div',{},pair(x.said,x.better),x.note?h('p',{class:'v2-muted',text:x.note}):null))));
      if(list(b.wordsUsed).length)out.push(section(t('used'),h('p',{text:list(b.wordsUsed).join(', ')})));
      if(list(b.wordsMissed).length)out.push(section(t('missed'),h('p',{text:list(b.wordsMissed).join(', ')})));
      if(b.advice)out.push(section(t('advice'),h('p',{text:b.advice})));
    }else{
      if(Array.isArray(b.patterns)&&b.patterns.length)out.push(section(t('patterns'),b.patterns.map(p=>h('div',{class:'v2-ai-pattern'},h('strong',{text:p.title}),h('p',{text:p.explanation}),
        (Array.isArray(p.examples)?p.examples:[]).map(x=>pair(x.said,x.better))))));
      if(list(b.tips).length)out.push(section(t('tips'),bullets(list(b.tips))));
      if(list(b.focusWords).length)out.push(section(t('focus'),h('p',{text:list(b.focusWords).join(', ')})));
      if(b.count)out.push(h('p',{class:'v2-muted',text:fill(t('basedOn'),{n:b.count})}));
    }
    return out;
  }
  function inboxScreen(){
    const h=kit.h,box=h('div',{class:'v2-ai-inbox'}),state=h('div',{role:'status','aria-live':'polite',hidden:true}),open=new Set();
    const analyze=h('button',{type:'button',class:'ui-button',onclick:async()=>{
      analyze.disabled=true;status(state,t('analyzing'));
      try{const message=await AI().analyzeMistakes();status(state,message?'':t('nothingNew'));if(message)open.add(message.id);}
      catch(error){status(state,errorText(error),{error:true});}
      analyze.disabled=false;
    }},t('analyzeNow'));
    async function paint(){
      const messages=await AI().listMessages();
      box.replaceChildren(...(messages.length?messages.map(m=>{
        const title=m.title||t(m.kind==='chat'?'chatTitle':'reportTitle'),isOpen=open.has(m.id);
        const head=h('button',{type:'button',class:'v2-ai-msg-head','aria-expanded':String(isOpen),onclick:async()=>{
          if(open.has(m.id))open.delete(m.id);else{open.add(m.id);if(!m.read)await AI().markRead(m.id);}
          paint();
        }},h('span',{class:'v2-ai-dot'+(m.read?'':' on'),'aria-label':m.read?'':t('unread')}),h('span',{class:'v2-ai-msg-title',text:title}),h('span',{class:'v2-muted',text:dateText(m.createdAt)}));
        return h('div',{class:'v2-card v2-ai-msg'},head,isOpen?h('div',{class:'v2-ai-msg-body'},messageBody(m),
          h('div',{class:'v2-actions'},h('button',{type:'button',class:'ui-button ui-button-secondary',onclick:async()=>{await AI().removeMessage(m.id);open.delete(m.id);}},t('delete')))):null);
      }):[h('div',{class:'v2-card'},h('p',{text:t('inboxEmpty')}))]));
    }
    const onChange=()=>paint();
    window.addEventListener('vocvoc-inbox-changed',onChange);cleanup=()=>window.removeEventListener('vocvoc-inbox-changed',onChange);
    paint();
    return kit.page(kit.heading(t('inboxTitle')),h('div',{class:'v2-actions'},analyze),state,box);
  }

  /* ---------- chat room ---------- */
  function chatScreen(){
    const h=kit.h;
    if(!ensureWords())return kit.page(kit.heading(t('chatPage')),needWordsCard());
    const ctx=AI().context(),Rec=SpeechRec();
    const history=[],log=h('div',{class:'v2-ai-log',role:'log','aria-live':'polite'}),state=h('div',{role:'status','aria-live':'polite',hidden:true});
    let rec=null,busy=false,listening=false,ended=false,handsFree=true;
    const input=h('input',{type:'text',class:'ui-input v2-ai-input',placeholder:t('typeHere'),'aria-label':t('typeHere'),autocomplete:'off',autocapitalize:'off',spellcheck:'false',lang:ctx.target});
    const mic=h('button',{type:'button',class:'ui-button v2-ai-mic','aria-pressed':'false',onclick:()=>listening?stopListening():startListening()},t('talk'));
    const sendBtn=h('button',{type:'button',class:'ui-button ui-button-secondary',onclick:()=>submit(input.value)},t('send'));
    const endBtn=h('button',{type:'button',class:'ui-button ui-button-secondary',onclick:()=>finish()},t('endChat'));
    const auto=h('input',{type:'checkbox',checked:true,onchange:()=>{handsFree=auto.checked;}});
    const controls=h('div',{class:'v2-ai-controls'},Rec?mic:null,input,sendBtn);
    const setBusy=value=>{busy=value;for(const b of [mic,sendBtn,endBtn,input])b.disabled=value;};
    const line=(who,text)=>{log.append(h('p',{class:'v2-ai-line '+who},h('strong',{text:t(who==='me'?'you':'tutor')+': '}),text));log.scrollTop=log.scrollHeight;};
    async function turn(){
      setBusy(true);status(state,t('thinking'));
      try{
        const r=await AI().call('chat',{...ctx,mode:'turn',history});
        const reply=String(r.reply||'').trim();if(!reply)throw Object.assign(new Error('empty'),{aiCode:'bad'});
        history.push({role:'assistant',text:reply});line('tutor',reply);status(state,'');setBusy(false);
        speak(reply,{onend:()=>{if(!ended&&handsFree&&Rec&&!busy&&!listening)startListening();}});
      }catch(error){status(state,errorText(error),{error:true,retry:()=>{history.length&&history[history.length-1].role==='user'?turn():begin();}});setBusy(false);}
    }
    const begin=()=>turn();
    function submit(text){
      text=String(text||'').trim();if(!text||busy)return;
      stopListening();stopSpeaking();input.value='';history.push({role:'user',text});line('me',text);turn();
    }
    function startListening(){
      if(!Rec||busy||ended)return;
      stopSpeaking();rec=new Rec();rec.lang=speechLang();rec.interimResults=false;rec.maxAlternatives=1;
      rec.onresult=event=>{const text=event.results[0]?.[0]?.transcript;listening=false;syncMic();if(text)submit(text);};
      rec.onerror=()=>{listening=false;syncMic();};
      rec.onend=()=>{listening=false;syncMic();};
      try{rec.start();listening=true;syncMic();}catch(_){listening=false;syncMic();}
    }
    function stopListening(){try{rec?.abort();}catch(_){}listening=false;syncMic();}
    function syncMic(){mic.textContent=t(listening?'listening':'talk');mic.setAttribute('aria-pressed',String(listening));mic.classList.toggle('on',listening);}
    async function finish(){
      if(history.filter(m=>m.role==='user').length<2){status(state,t('tooShort'));return;}
      ended=true;stopListening();stopSpeaking();setBusy(true);status(state,t('evaluating'));
      try{
        const result=await AI().call('chat',{...ctx,mode:'end',history});
        await AI().addMessage({kind:'chat',title:'',body:result});
        await AI().logMistakes('chat',(Array.isArray(result.mistakes)?result.mistakes:[]));
        status(state,t('sentToInbox'));controls.hidden=true;endBtn.hidden=true;
        log.after(h('div',{class:'v2-actions'},h('button',{type:'button',class:'ui-button',onclick:()=>kit.navigate('inbox')},t('openInbox'))));
        autoAnalyze();
      }catch(error){ended=false;status(state,errorText(error),{error:true,retry:finish});setBusy(false);}
    }
    input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();submit(input.value);}});
    cleanup=()=>{ended=true;stopListening();stopSpeaking();};
    syncMic();
    const view=kit.page(kit.heading(t('chatPage')),h('div',{class:'v2-card'},
      h('p',{class:'v2-muted',text:ctx.words.slice(0,8).join(' · ')}),
      Rec?h('label',{class:'v2-ai-check'},auto,' ',t('handsFree')):h('p',{class:'v2-muted',text:t('noVoiceInput')}),
      log,state,controls,h('div',{class:'v2-actions'},endBtn)));
    // The conversation begins by itself: the tutor speaks first.
    const startBtn=h('button',{type:'button',class:'ui-button',onclick:()=>{startBtn.remove();begin();}},t('start'));
    log.before(startBtn);
    return view;
  }

  /* ---------- story ---------- */
  function storyScreen(){
    const h=kit.h;
    if(!ensureWords())return kit.page(kit.heading(t('storyPage')),needWordsCard());
    const ctx=AI().context(),holder=h('div'),state=h('div',{role:'status','aria-live':'polite',hidden:true});
    let reading=false;
    async function make(){
      stopSpeaking();holder.replaceChildren();status(state,t('thinking'));button.disabled=true;
      try{
        const story=await AI().call('story',ctx);
        if(typeof story.text!=='string'||!story.text.trim())throw Object.assign(new Error('empty'),{aiCode:'bad'});
        status(state,'');holder.replaceChildren(storyView(story));button.textContent=t('newStory');
      }catch(error){status(state,errorText(error),{error:true,retry:make});}
      button.disabled=false;
    }
    const button=h('button',{type:'button',class:'ui-button',onclick:make},t('makeStory'));
    function textNodes(text){                    // every word is a button that opens the app's own word window, where it can be added to the list
      return text.split(/\n{2,}/).map(par=>h('p',{lang:ctx.target,class:'v2-ai-par'},par.split(/([\p{L}\p{M}'’-]+)/u).map(part=>/^[\p{L}\p{M}'’-]+$/u.test(part)
        ?h('button',{type:'button',class:'v2-ai-word',onclick:()=>window.openRelatedWordPopup?.(part.replace(/^['’-]+|['’-]+$/g,'').toLocaleLowerCase(ctx.target))},part):part)));
    }
    function storyView(story){
      let showTr=false;const tr=h('div',{class:'v2-ai-translation',hidden:true},String(story.translation||'').split(/\n{2,}/).map(p=>h('p',{text:p})));
      const trBtn=h('button',{type:'button',class:'ui-button ui-button-secondary',onclick:()=>{showTr=!showTr;tr.hidden=!showTr;trBtn.textContent=t(showTr?'hideTranslation':'showTranslation');}},t('showTranslation'));
      const listenBtn=h('button',{type:'button',class:'ui-button ui-button-secondary',onclick:()=>{
        if(reading){stopSpeaking();reading=false;listenBtn.textContent=t('listen');return;}
        reading=true;listenBtn.textContent=t('stopListen');speak(story.text.replace(/\n+/g,' '),{onend:()=>{reading=false;listenBtn.textContent=t('listen');}});
      }},t('listen'));
      cleanup=()=>stopSpeaking();
      return h('div',{class:'v2-card'},h('h2',{text:String(story.title||'')}),textNodes(story.text),h('p',{class:'v2-muted',text:t('tapWord')}),
        h('div',{class:'v2-actions'},listenBtn,trBtn),tr,quizView(story));
    }
    function quizView(story){
      const questions=(Array.isArray(story.quiz)?story.quiz:[]).filter(q=>q&&Array.isArray(q.options)&&q.options.length>=2&&Number.isInteger(q.answer)&&q.options[q.answer]!=null);
      if(!questions.length)return null;
      const picked=new Map(),result=h('p',{class:'v2-ai-score',role:'status',hidden:true});
      const blocks=questions.map((q,qi)=>h('fieldset',{class:'v2-ai-q'},h('legend',{lang:ctx.target,text:q.q}),
        q.options.map((option,oi)=>h('label',{class:'v2-ai-opt'},h('input',{type:'radio',name:'story-q'+qi,onchange:()=>picked.set(qi,oi)}),' ',h('span',{lang:ctx.target,text:option})))));
      const check=h('button',{type:'button',class:'ui-button',onclick:async()=>{
        let right=0;const wrong=[];
        questions.forEach((q,qi)=>{
          const fs=blocks[qi],ok=picked.get(qi)===q.answer;if(ok)right++;
          else wrong.push({said:q.options[picked.get(qi)]??'—',better:q.options[q.answer],note:q.q,word:''});
          fs.querySelectorAll('.v2-ai-opt').forEach((label,oi)=>{label.classList.toggle('right',oi===q.answer);label.classList.toggle('wrong',oi===picked.get(qi)&&!ok);label.querySelector('input').disabled=true;});
        });
        check.disabled=true;result.hidden=false;result.textContent=fill(t('quizDone'),{n:right,m:questions.length});
        await AI().logMistakes('story',wrong.filter(x=>x.said!=='—'));
      }},t('checkAnswers'));
      return section(t('quiz'),blocks,check,result);
    }
    cleanup=()=>stopSpeaking();
    return kit.page(kit.heading(t('storyPage')),h('div',{class:'v2-card'},h('p',{class:'v2-muted',text:ctx.level+' · '+ctx.words.slice(0,8).join(' · ')}),h('div',{class:'v2-actions'},button)),state,holder);
  }

  /* ---------- sentence correction ---------- */
  // A word is checked as soon as it is finished (a space or a mark after it); the right spelling fades in at the bottom, stays a moment and fades out.
  // When the sentence is checked, a better one fades in and stays; a tap puts it in the box.
  function sentenceScreen(){
    const h=kit.h;
    if(!ensureWords())return kit.page(kit.heading(t('sentencePage')),needWordsCard());
    const ctx=AI().context();
    let word=null,spellSeq=0,popTimer=0;const checked=new Map();
    const pickWord=()=>{const pool=ctx.words.filter(w=>w!==word);word=pool[Math.floor(Math.random()*pool.length)]||ctx.words[0];};
    pickWord();
    const target=h('strong',{class:'v2-ai-target',lang:ctx.target,text:word}),state=h('div',{role:'status','aria-live':'polite',hidden:true});
    const box=h('textarea',{class:'ui-input v2-ai-sentence',rows:'3',placeholder:t('sentencePh'),'aria-label':t('sentencePh'),lang:ctx.target,autocapitalize:'off',autocorrect:'off',spellcheck:'false'});
    const popup=h('div',{class:'v2-ai-popup',role:'status','aria-live':'polite'});
    document.body.append(popup);
    function showPopup(text,{sticky=false,onclick=null,cls=''}={}){
      clearTimeout(popTimer);popup.className='v2-ai-popup '+cls;popup.textContent='';popup.append(text);
      popup.onclick=onclick;popup.style.pointerEvents=onclick?'auto':'none';
      popup.classList.remove('show');void popup.offsetWidth;popup.classList.add('show');          // fade in
      if(!sticky)popTimer=setTimeout(()=>popup.classList.remove('show'),1900);                    // a moment later: fade out
    }
    async function spellWord(token){
      const key=token.toLocaleLowerCase(ctx.target);
      let r=checked.get(key);
      if(!r){
        const seq=++spellSeq;
        try{r=await AI().call('spell',{...ctx,sentence:box.value,word:token});}catch(_){return;}
        if(seq!==spellSeq&&!box.value.includes(token))return;
        checked.set(key,r);
      }
      if(r&&r.ok===false&&r.correct&&r.correct.toLocaleLowerCase(ctx.target)!==key){
        showPopup(r.correct,{cls:'spell'});
        AI().logMistakes('sentence',[{said:token,better:r.correct,note:'',word}]);
      }
    }
    box.addEventListener('input',()=>{
      const value=box.value,m=/([\p{L}\p{M}'’-]+)[\s.,;:!?]$/u.exec(value);
      if(m&&m[1].length>1)spellWord(m[1]);
    });
    async function checkSentence(){
      const sentence=box.value.trim();if(!sentence)return;
      checkBtn.disabled=true;status(state,t('checking'));
      try{
        const r=await AI().call('improve',{...ctx,sentence,word});
        status(state,'');
        const better=String(r.better||'').trim();
        if(r.ok||!better||better===sentence)showPopup(t('perfect'),{cls:'good'});
        else showPopup(h('span',{},h('small',{text:t('betterHint')}),h('br'),better),{sticky:true,cls:'better',onclick:()=>{box.value=better;showPopup(t('applied'),{cls:'good'});box.focus();}});
        const mistakes=Array.isArray(r.mistakes)?r.mistakes:[];
        await AI().logMistakes('sentence',mistakes.map(x=>({...x,word})));
        autoAnalyze();
      }catch(error){status(state,errorText(error),{error:true,retry:checkSentence});}
      checkBtn.disabled=false;
    }
    const checkBtn=h('button',{type:'button',class:'ui-button',onclick:checkSentence},t('check'));
    const nextBtn=h('button',{type:'button',class:'ui-button ui-button-secondary',onclick:()=>{pickWord();target.textContent=word;box.value='';popup.classList.remove('show');box.focus();}},t('nextWord'));
    cleanup=()=>{clearTimeout(popTimer);popup.remove();};
    return kit.page(kit.heading(t('sentencePage')),h('div',{class:'v2-card'},h('p',{},t('sentenceFor')+' ',target),box,h('div',{class:'v2-actions'},checkBtn,nextBtn)),state);
  }

  // Once enough new mistakes have piled up, the analysis is made by itself; the report arrives in the inbox. Failures are silent (the Inbox button tries again).
  let analyzing=false;
  async function autoAnalyze(){
    if(analyzing)return;analyzing=true;
    try{await AI().analyzeMistakes({minimum:8});}catch(_){}finally{analyzing=false;}
  }

  /* ---------- hooks for screens.js ---------- */
  const ROUTES={
    inbox:{tab:'profile',title:'inboxTitle',build:inboxScreen},
    chat:{tab:'study',title:'chatPage',build:chatScreen},
    story:{tab:'study',title:'storyPage',build:storyScreen},
    sentence:{tab:'study',title:'sentencePage',build:sentenceScreen}
  };
  window.VocVocAIScreens=Object.freeze({
    routes:Object.keys(ROUTES),
    tabOf:route=>ROUTES[route]?.tab,
    title:(route,toolkit)=>{kit=toolkit;return t(ROUTES[route].title);},
    build(route,toolkit){kit=toolkit;this.leave();return ROUTES[route].build();},
    leave(){try{cleanup?.();}catch(_){}cleanup=null;},
    studyCards(toolkit){
      kit=toolkit;
      const card=(glyph,title,sub,route)=>kit.h('button',{type:'button',class:'v2-study-card',onclick:()=>kit.navigate(route)},
        kit.h('span',{class:'v2-study-glyph','aria-hidden':'true',text:glyph}),kit.h('span',{},kit.h('span',{class:'v2-study-title',text:title}),kit.h('span',{class:'v2-study-sub',text:sub})));
      return [card('💬',t('chatCard'),t('chatSub'),'chat'),card('📖',t('storyCard'),t('storySub'),'story'),card('✍',t('sentenceCard'),t('sentenceSub'),'sentence')];
    },
    label:toolkit=>{kit=toolkit;return t('inbox');}
  });
})();
