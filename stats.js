'use strict';
/* Statistics and badges: pure functions over plain data (no page, no storage), so they are tested without a browser.
   The page (screens.js) builds the input from the app's data and keeps a small activity record (finished tests, earned badges).
   Days are local calendar days as "YYYY-MM-DD" strings; every date calculation works on those strings, so it does not depend on a time zone. */
(function(root){
  const MAX_QUIZZES=300,MAX_WRONG=10,MAX_WORD=60,MAX_DAY_WORDS=200,MAX_FLIPS=1000000;
  const LEVELS=['A1','A2','B1','B2','C1','C2'];
  const KINDS=['memorized','collected','tests','perfect','recall','streak','goal','points','recallTests','matchTests','flips','level'];
  // id, what it counts, how many are needed, and the family. Badges of one family count the same thing towards a growing goal (1, 10, 50 … words) and share one card:
  // when a goal is reached the card goes quiet again with the next goal, and the goals reached stay on it (see groupBadges). The others stand alone.
  // "More than 10 Flip cards" is 11.
  const BADGES=Object.freeze([
    ['memo1','memorized',1,'memo'],['memo10','memorized',10,'memo'],['memo50','memorized',50,'memo'],['memo100','memorized',100,'memo'],['memo500','memorized',500,'memo'],
    ['words50','collected',50],
    ['test1','tests',1,'test'],['test10','tests',10,'test'],['perfect','perfect',1],['recall8','recall',1],
    ['streak3','streak',3,'streak'],['streak7','streak',7,'streak'],['streak30','streak',30,'streak'],
    ['goal1','goal',1],
    ['points10','points',10],['recall1','recallTests',1],['match1','matchTests',1],
    ['flip10','flips',11,'flip'],['flip30','flips',31,'flip'],['flip50','flips',51,'flip']
  ].map(([id,kind,target,family=id])=>Object.freeze({id,kind,target,family})).concat(LEVELS.map(level=>Object.freeze({id:'lvl'+level,kind:'level',target:1,family:'lvl'+level,level}))));
  const KNOWN=new Set(BADGES.map(badge=>badge.id));
  const DAY=/^\d{4}-\d{2}-\d{2}$/;

  const formatter=typeof Intl!=='undefined'?new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}):null;
  // The local calendar day of a timestamp (one cached formatter: this runs for every word).
  function localDay(iso){const date=new Date(iso);return Number.isNaN(date.getTime())?null:formatter.format(date);}
  function addDays(day,n){const [year,month,date]=day.split('-').map(Number);return new Date(Date.UTC(year,month-1,date+n)).toISOString().slice(0,10);}
  const median=numbers=>{if(!numbers.length)return null;const sorted=[...numbers].sort((a,b)=>a-b),middle=sorted.length>>1;return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
  const bump=(map,key)=>map.set(key,(map.get(key)||0)+1);
  const collect=(map,key,word)=>{const list=map.get(key)||[];if(!map.has(key))map.set(key,list);if(list.length<MAX_DAY_WORDS)list.push(word);};   // the words of a day (the counts stay exact)

  /* ---------- the activity record ---------- */
  const isQuiz=q=>q&&typeof q==='object'&&typeof q.t==='string'&&!Number.isNaN(Date.parse(q.t))&&(q.mode==='active'||q.mode==='recall'||q.mode==='cloze'||q.mode==='match')&&Number.isInteger(q.score)&&Number.isInteger(q.total)&&q.total>=1&&q.total<=50&&q.score>=0&&q.score<=q.total;
  const cleanQuiz=q=>({t:q.t,mode:q.mode,score:q.score,total:q.total,wrong:(Array.isArray(q.wrong)?q.wrong:[]).filter(word=>typeof word==='string'&&word.trim()).slice(0,MAX_WRONG).map(word=>word.slice(0,MAX_WORD))});
  const emptyRecord=()=>({v:1,seeded:false,testsTaken:0,flips:0,quizzes:[],badges:{}});
  // Whatever is in storage: keep what is valid, drop the rest.
  function normalizeRecord(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return emptyRecord();
    const quizzes=(Array.isArray(raw.quizzes)?raw.quizzes:[]).filter(isQuiz).map(cleanQuiz).slice(-MAX_QUIZZES);
    const badges={};
    if(raw.badges&&typeof raw.badges==='object')for(const [id,day] of Object.entries(raw.badges))if(KNOWN.has(id)&&typeof day==='string'&&DAY.test(day))badges[id]=day;
    const flips=Number.isInteger(raw.flips)&&raw.flips>0?Math.min(raw.flips,MAX_FLIPS):0;
    return {v:1,seeded:raw.seeded===true,testsTaken:Math.max(Number.isInteger(raw.testsTaken)&&raw.testsTaken>0?raw.testsTaken:0,quizzes.length),flips,quizzes,badges};
  }
  // A finished test is added; only the newest MAX_QUIZZES are kept, the number of tests taken keeps counting.
  function appendQuiz(record,result){
    const current=normalizeRecord(record);
    if(!isQuiz(result))return current;
    return {...current,testsTaken:current.testsTaken+1,quizzes:[...current.quizzes,cleanQuiz(result)].slice(-MAX_QUIZZES)};
  }
  // A Flip card was turned over (counted every time).
  function appendFlip(record){
    const current=normalizeRecord(record);
    return {...current,flips:Math.min(current.flips+1,MAX_FLIPS)};
  }
  // earned: {id:day}. A badge already in the record keeps its date.
  function withBadges(record,earned){
    const current=normalizeRecord(record),badges={...current.badges};
    for(const [id,day] of Object.entries(earned||{}))if(KNOWN.has(id)&&!badges[id]&&typeof day==='string'&&DAY.test(day))badges[id]=day;
    return {...current,badges};
  }

  /* ---------- statistics and badges ---------- */
  // input: {words:[{word,status,addedAt,memorizedAt}], quizzes, testsTaken, earned:{id:day}, builtin:[lowercase starter words],
  //         today:'YYYY-MM-DD', dayOf(iso)->day, goalReachedToday, points (the points of all words together), flips (Flip cards turned), levelsDone (['A1',…])}
  function compute(input){
    const dayOf=input.dayOf||localDay,today=input.today,builtin=new Set(input.builtin||[]),earnedBefore=input.earned||{};
    let active=0,memorized=0,archived=0;
    const addedDays=[],memorizedDays=[],speeds=[],activity=new Set();
    const addedByDay=new Map(),memorizedByDay=new Map(),testsByDay=new Map(),addedWordsByDay=new Map(),memorizedWordsByDay=new Map();
    for(const word of input.words||[]){
      if(word.status==='active')active++;else if(word.status==='memorized')memorized++;else if(word.status==='archived')archived++;
      // the built-in starter words are not something the user added
      if(word.addedAt&&!builtin.has(String(word.word||'').toLowerCase())){
        const day=dayOf(word.addedAt);
        if(day){addedDays.push(day);bump(addedByDay,day);collect(addedWordsByDay,day,word.word);activity.add(day);}
      }
      if(word.status==='memorized'&&word.memorizedAt){
        const day=dayOf(word.memorizedAt);
        if(day){
          memorizedDays.push(day);bump(memorizedByDay,day);collect(memorizedWordsByDay,day,word.word);activity.add(day);
          if(word.addedAt){const span=(Date.parse(word.memorizedAt)-Date.parse(word.addedAt))/86400000;if(span>=0)speeds.push(span);}
        }
      }
    }
    addedDays.sort();memorizedDays.sort();
    const quizzes=(input.quizzes||[]).filter(isQuiz);
    for(const quiz of quizzes){const day=dayOf(quiz.t);if(day){activity.add(day);bump(testsByDay,day);}}

    // streak: consecutive days with something learned or a test taken; today may still be empty
    const days=[...activity].sort();
    let longest=0,run=0,previous=null;
    const reached={};
    for(const day of days){
      run=previous&&addDays(previous,1)===day?run+1:1;previous=day;
      if(run>longest)longest=run;
      if(!reached[run])reached[run]=day;                                            // the first day a run got this long
    }
    let current=0,cursor=activity.has(today)?today:(activity.has(addDays(today,-1))?addDays(today,-1):null);
    while(cursor&&activity.has(cursor)){current++;cursor=addDays(cursor,-1);}

    const last7=[];
    for(let back=6;back>=0;back--){const day=addDays(today,-back);last7.push({day,added:addedByDay.get(day)||0,memorized:memorizedByDay.get(day)||0,tests:testsByDay.get(day)||0,addedWords:addedWordsByDay.get(day)||[],memorizedWords:memorizedWordsByDay.get(day)||[]});}
    const start=addDays(today,-29);
    let total=0;for(const day of memorizedDays)if(day<start)total++;
    const series=[];
    for(let step=0;step<30;step++){const day=addDays(start,step);total+=memorizedByDay.get(day)||0;series.push({day,total});}

    let scoreSum=0,maxSum=0,best=null;
    const wrongCount=new Map();
    for(const quiz of quizzes){
      scoreSum+=quiz.score;maxSum+=quiz.total;
      if(!best||quiz.score/quiz.total>=best.score/best.total)best={score:quiz.score,total:quiz.total};
      for(const word of cleanQuiz(quiz).wrong)bump(wrongCount,word);
    }
    const hardest=[...wrongCount].map(([word,count])=>({word,count})).sort((a,b)=>b.count-a.count||a.word.localeCompare(b.word)).slice(0,5);
    const spans=median(speeds);

    const testsTaken=Math.max(input.testsTaken||0,quizzes.length);
    const perfect=quizzes.find(quiz=>quiz.score===quiz.total);
    const recall=quizzes.find(quiz=>quiz.mode==='recall'&&quiz.score/quiz.total>=0.8);
    const goal=!!input.goalReachedToday;
    const points=Math.max(0,input.points||0),flips=Math.max(0,input.flips||0),levelsDone=new Set(input.levelsDone||[]);
    const recallTests=quizzes.filter(quiz=>quiz.mode==='recall'),matchTests=quizzes.filter(quiz=>quiz.mode==='match');
    const badges=[],newlyEarned=[];
    for(const badge of BADGES){
      let progress=0,date=null;
      switch(badge.kind){
        case 'memorized':progress=memorized;date=memorizedDays[badge.target-1]||null;break;
        case 'collected':progress=addedDays.length;date=addedDays[badge.target-1]||null;break;
        case 'tests':progress=testsTaken;date=quizzes[badge.target-1]?dayOf(quizzes[badge.target-1].t):null;break;
        case 'perfect':progress=perfect?1:0;date=perfect?dayOf(perfect.t):null;break;
        case 'recall':progress=recall?1:0;date=recall?dayOf(recall.t):null;break;
        case 'streak':progress=longest;date=reached[badge.target]||null;break;
        case 'goal':progress=goal?1:0;date=goal?today:null;break;
        case 'points':progress=points;break;                                         // no date is known: the day it is noticed
        case 'recallTests':progress=recallTests.length;date=recallTests[badge.target-1]?dayOf(recallTests[badge.target-1].t):null;break;
        case 'matchTests':progress=matchTests.length;date=matchTests[badge.target-1]?dayOf(matchTests[badge.target-1].t):null;break;
        case 'flips':progress=flips;break;
        case 'level':progress=levelsDone.has(badge.level)?1:0;break;
      }
      const derived=progress>=badge.target?(date||today):null;                       // earned now (the date it happened, if the data still knows it)
      const earnedOn=earnedBefore[badge.id]||derived;                                // once earned, always earned
      if(derived&&!earnedBefore[badge.id])newlyEarned.push(badge.id);
      badges.push({id:badge.id,kind:badge.kind,target:badge.target,family:badge.family,...(badge.level?{level:badge.level}:{}),progress:earnedOn?badge.target:Math.min(progress,badge.target),earnedOn});
    }
    return {
      summary:{total:active+memorized,active,memorized,archived,memorizedToday:memorizedByDay.get(today)||0,addedToday:addedByDay.get(today)||0,streak:{current,longest},activeDays:activity.size},
      last7,memorizedSeries:series,
      tests:{count:testsTaken,accuracy:maxSum?scoreSum/maxSum:null,best,last:quizzes.slice(-5).reverse().map(({t,mode,score,total})=>({t,mode,score,total})),hardest},
      speed:{medianDays:spans===null?null:Math.round(spans*10)/10,samples:speeds.length},
      badges,newlyEarned
    };
  }

  // The badges of compute() as cards: one per family, goals in order. A card shows the goal still ahead (next) and, with it, every goal reached (earned);
  // when none is left (done) it shows the last one. lastEarnedOn is the day of the newest goal reached.
  function groupBadges(badges){
    const families=new Map();
    for(const badge of badges||[]){
      if(!families.has(badge.family))families.set(badge.family,{id:badge.family,kind:badge.kind,...(badge.level?{level:badge.level}:{}),tiers:[]});
      families.get(badge.family).tiers.push(badge);
    }
    return [...families.values()].map(card=>{
      const tiers=[...card.tiers].sort((a,b)=>a.target-b.target),earned=tiers.filter(tier=>tier.earnedOn),next=tiers.find(tier=>!tier.earnedOn)||null;
      return {...card,tiers,earned,next,done:!next,current:next||tiers[tiers.length-1],lastEarnedOn:earned.reduce((day,tier)=>tier.earnedOn>day?tier.earnedOn:day,'')||null};
    });
  }

  const api=Object.freeze({BADGES,KINDS,LEVELS,MAX_QUIZZES,localDay,addDays,compute,groupBadges,appendQuiz,appendFlip,normalizeRecord,withBadges});
  root.VocVocStats=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
