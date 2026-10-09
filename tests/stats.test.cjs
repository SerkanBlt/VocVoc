/* Statistics and badges (stats.js): pure logic, checked against numbers worked out by hand. Run: node --test tests/stats.test.cjs (npm test does this). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const Stats=require('../stats.js');

const TODAY='2026-10-07';
const dayOf=iso=>iso.slice(0,10);                                     // timestamps below are written in the same "local" day they mean
const at=(day,time='10:00:00')=>`${day}T${time}Z`;
const word=(name,status,added,memorized=null)=>({word:name,status,addedAt:added?at(added):null,memorizedAt:memorized?at(memorized):null});
const input=(extra={})=>({words:[],quizzes:[],today:TODAY,dayOf,...extra});
const quiz=(day,score,{mode='active',total=10,wrong=[]}={})=>({t:at(day,'08:00:00'),mode,score,total,wrong});
const badge=(result,id)=>result.badges.find(item=>item.id===id);

describe('Summary and the last days',()=>{
  const words=[
    word('A','active','2026-10-07'),
    word('B','memorized','2026-10-01','2026-10-07'),
    word('C','memorized','2026-10-05','2026-10-06'),
    word('D','archived','2026-09-01'),
    word('Bonjour','active','2026-10-01')                                // a built-in starter
  ];
  const result=Stats.compute(input({words,builtin:['bonjour']}));
  it('counts words by status; archived words are not part of the total',()=>{
    assert.deepEqual([result.summary.active,result.summary.memorized,result.summary.archived,result.summary.total],[2,2,1,4]);
    assert.deepEqual([result.summary.memorizedToday,result.summary.addedToday],[1,1]);
  });
  it('the built-in starter words are not something the user added',()=>{
    const withStarter=Stats.compute(input({words:[word('Bonjour','active','2026-10-07')],builtin:['bonjour']}));
    assert.deepEqual([withStarter.summary.addedToday,withStarter.summary.activeDays],[0,0]);
  });
  it('last 7 days run from six days ago to today with what happened on each',()=>{
    assert.deepEqual(result.last7.map(day=>day.day),['2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07']);
    assert.deepEqual(result.last7.map(day=>[day.added,day.memorized,day.tests]),[[1,0,0],[0,0,0],[0,0,0],[0,0,0],[1,0,0],[0,1,0],[1,1,0]]);
  });
  it('every day also lists its words (added and memorized), without the built-in starters; the counts stay exact when the list is capped',()=>{
    assert.deepEqual(result.last7.map(day=>[day.addedWords,day.memorizedWords]),[[['B'],[]],[[],[]],[[],[]],[[],[]],[['C'],[]],[[],['C']],[['A'],['B']]]);
    const many=Stats.compute(input({words:Array.from({length:250},(_,index)=>word('w'+index,'active','2026-10-07'))}));
    const today=many.last7[6];
    assert.deepEqual([today.added,today.addedWords.length,today.addedWords[0],today.addedWords[199]],[250,200,'w0','w199']);
  });
  it('the memorized curve is cumulative over 30 days and starts from what was memorized earlier',()=>{
    assert.equal(result.memorizedSeries.length,30);
    assert.deepEqual([result.memorizedSeries[0].day,result.memorizedSeries[29].day],['2026-09-08','2026-10-07']);
    assert.deepEqual([result.memorizedSeries[28].total,result.memorizedSeries[29].total],[1,2]);
    const older=Stats.compute(input({words:[word('X','memorized','2026-01-01','2026-01-02'),word('Y','memorized','2026-10-06','2026-10-06')]}));
    assert.deepEqual([older.memorizedSeries[0].total,older.memorizedSeries[29].total],[1,2]);   // X was memorized before the window
  });
  it('how long words took to memorize is a median of the days between adding and memorizing',()=>{
    assert.deepEqual(result.speed,{medianDays:3.5,samples:2});                                    // B took 6 days, C took 1
    assert.deepEqual(Stats.compute(input()).speed,{medianDays:null,samples:0});
    const odd=Stats.compute(input({words:[word('P','memorized','2026-10-01','2026-10-02'),word('Q','memorized','2026-10-01','2026-10-04'),word('R','memorized','2026-10-01','2026-10-07')]}));
    assert.equal(odd.speed.medianDays,3);
  });
});

describe('Streak',()=>{
  const learned=days=>input({words:days.map((day,index)=>word('w'+index,'active',day))});
  it('counts consecutive days ending today',()=>{
    const result=Stats.compute(learned(['2026-10-05','2026-10-06','2026-10-07']));
    assert.deepEqual(result.summary.streak,{current:3,longest:3});
  });
  it('a day that is still empty today does not break yesterday\'s streak, a missed day does',()=>{
    assert.equal(Stats.compute(learned(['2026-10-05','2026-10-06'])).summary.streak.current,2);
    assert.equal(Stats.compute(learned(['2026-10-04','2026-10-05'])).summary.streak.current,0);
  });
  it('the longest streak is remembered after it broke',()=>{
    const result=Stats.compute(learned(['2026-09-01','2026-09-02','2026-09-03','2026-09-04','2026-10-06','2026-10-07']));
    assert.deepEqual(result.summary.streak,{current:2,longest:4});
  });
  it('taking a test counts as an active day',()=>{
    const result=Stats.compute(input({quizzes:[quiz('2026-10-06',5),quiz('2026-10-07',6)],testsTaken:2}));
    assert.deepEqual(result.summary.streak,{current:2,longest:2});
  });
  it('works across a month and a year boundary',()=>{
    assert.equal(Stats.addDays('2026-03-01',-1),'2026-02-28');
    assert.equal(Stats.addDays('2027-01-01',-1),'2026-12-31');
    const result=Stats.compute({words:[word('a','active','2026-12-30'),word('b','active','2026-12-31'),word('c','active','2027-01-01')],today:'2027-01-01',dayOf});
    assert.equal(result.summary.streak.current,3);
  });
});

describe('Tests',()=>{
  const quizzes=[quiz('2026-10-05',7,{wrong:['a','b','c']}),quiz('2026-10-06',10),quiz('2026-10-07',8,{mode:'recall',wrong:['a']})];
  const result=Stats.compute(input({quizzes,testsTaken:3}));
  it('accuracy, best score and the latest results (newest first)',()=>{
    assert.equal(result.tests.count,3);
    assert(Math.abs(result.tests.accuracy-25/30)<1e-9);
    assert.deepEqual(result.tests.best,{score:10,total:10});
    assert.deepEqual(result.tests.last.map(item=>item.score),[8,10,7]);
  });
  it('the words missed most often come first, ties alphabetically, at most five',()=>{
    assert.deepEqual(result.tests.hardest,[{word:'a',count:2},{word:'b',count:1},{word:'c',count:1}]);
    const many=Stats.compute(input({quizzes:[quiz('2026-10-07',0,{wrong:['g','f','e','d','c','b','a']})]}));
    assert.deepEqual(many.tests.hardest.map(item=>item.word),['a','b','c','d','e']);
  });
  it('with no tests there is nothing to average',()=>{
    const empty=Stats.compute(input());
    assert.deepEqual([empty.tests.count,empty.tests.accuracy,empty.tests.best,empty.tests.last,empty.tests.hardest],[0,null,null,[],[]]);
  });
  it('malformed results are ignored, not counted',()=>{
    const result2=Stats.compute(input({quizzes:[{t:'nope',mode:'active',score:1,total:10},{t:at('2026-10-07'),mode:'active',score:11,total:10},quiz('2026-10-07',4)]}));
    assert.equal(result2.tests.count,1);
  });
});

describe('Badges',()=>{
  const memorizedWords=count=>Array.from({length:count},(_,index)=>word('m'+index,'memorized','2026-08-01',`2026-09-${String(index+1).padStart(2,'0')}`));
  it('memorizing badges are earned on the day the Nth word was memorized, and show progress until then',()=>{
    const result=Stats.compute(input({words:memorizedWords(12)}));
    assert.deepEqual([badge(result,'memo1').earnedOn,badge(result,'memo10').earnedOn],['2026-09-01','2026-09-10']);
    assert.deepEqual([badge(result,'memo50').earnedOn,badge(result,'memo50').progress,badge(result,'memo50').target],[null,12,50]);
    assert.deepEqual(result.newlyEarned.filter(id=>id.startsWith('memo')).sort(),['memo1','memo10']);
    assert(result.newlyEarned.includes('streak7'),'twelve days in a row are a streak too');
  });
  it('a badge once earned stays earned and keeps its date when the data no longer shows it',()=>{
    const result=Stats.compute(input({words:memorizedWords(3),earned:{memo10:'2026-08-01'}}));
    assert.deepEqual([badge(result,'memo10').earnedOn,badge(result,'memo10').progress],['2026-08-01',10]);
    assert(!result.newlyEarned.includes('memo10'));
    assert.deepEqual(result.newlyEarned.filter(id=>id.startsWith('memo')),['memo1']);              // the one it did not know about yet
  });
  it('collecting counts words the user added, not the starters',()=>{
    const words=Array.from({length:52},(_,index)=>word(index<2?'starter'+index:'w'+index,'active',`2026-09-${String((index%28)+1).padStart(2,'0')}`));
    const result=Stats.compute(input({words,builtin:['starter0','starter1']}));
    assert.equal(badge(result,'words50').progress,50);
    assert(badge(result,'words50').earnedOn);
  });
  it('test badges: first test, the tenth, a perfect test, a Recall with at least 8 of 10',()=>{
    const quizzes=[quiz('2026-10-01',3),quiz('2026-10-02',10),quiz('2026-10-03',8,{mode:'recall'}),quiz('2026-10-04',7,{mode:'recall'})];
    const result=Stats.compute(input({quizzes,testsTaken:4}));
    assert.deepEqual([badge(result,'test1').earnedOn,badge(result,'perfect').earnedOn,badge(result,'recall8').earnedOn],['2026-10-01','2026-10-02','2026-10-03']);
    assert.deepEqual([badge(result,'test10').earnedOn,badge(result,'test10').progress],[null,4]);
    const nearly=Stats.compute(input({quizzes:[quiz('2026-10-01',9),quiz('2026-10-02',7,{mode:'recall'})],testsTaken:2}));
    assert.deepEqual([badge(nearly,'perfect').earnedOn,badge(nearly,'recall8').earnedOn],[null,null]);
  });
  it('the tenth test counts beyond the stored log (the number taken keeps counting)',()=>{
    const result=Stats.compute(input({quizzes:[quiz('2026-10-07',5)],testsTaken:12}));
    assert.equal(badge(result,'test10').progress,10);assert(badge(result,'test10').earnedOn);
  });
  it('streak badges carry the day the streak got that long and show the best streak so far',()=>{
    const days=['2026-09-01','2026-09-02','2026-09-03','2026-09-04','2026-10-07'];
    const result=Stats.compute(input({words:days.map((day,index)=>word('w'+index,'active',day))}));
    assert.deepEqual([badge(result,'streak3').earnedOn,badge(result,'streak7').earnedOn,badge(result,'streak7').progress],['2026-09-03',null,4]);
  });
  it('the daily goal badge is earned on the day the goal is reached',()=>{
    assert.deepEqual([badge(Stats.compute(input({goalReachedToday:true})),'goal1').earnedOn,badge(Stats.compute(input()),'goal1').earnedOn],[TODAY,null]);
  });
  it('every badge in the list is reported, once, with a positive target',()=>{
    const result=Stats.compute(input());
    assert.deepEqual(result.badges.map(item=>item.id),Stats.BADGES.map(item=>item.id));
    assert.equal(new Set(result.badges.map(item=>item.id)).size,result.badges.length);
    for(const item of result.badges)assert(item.target>0&&item.progress>=0&&item.progress<=item.target);
  });
});

describe('The activity record',()=>{
  it('appends finished tests, keeps the newest 300 and keeps counting how many were taken',()=>{
    let record=Stats.normalizeRecord(null);
    for(let index=0;index<305;index++)record=Stats.appendQuiz(record,quiz('2026-10-07',index%11));
    assert.deepEqual([record.quizzes.length,record.testsTaken],[300,305]);
  });
  it('shortens what it stores: at most 10 missed words of at most 60 characters',()=>{
    const record=Stats.appendQuiz(null,quiz('2026-10-07',2,{wrong:Array.from({length:14},(_,index)=>'w'.repeat(80)+index)}));
    assert.equal(record.quizzes[0].wrong.length,10);assert.equal(record.quizzes[0].wrong[0].length,60);
  });
  it('a Fill in the blank test is kept and listed with its own mode; it counts as a test but never earns the Recall badge',()=>{
    const record=Stats.appendQuiz(null,quiz('2026-10-07',10,{mode:'cloze',wrong:['x']}));
    assert.deepEqual([record.testsTaken,record.quizzes[0].mode,Stats.normalizeRecord(JSON.parse(JSON.stringify(record))).quizzes.length],[1,'cloze',1]);
    const result=Stats.compute(input({quizzes:[quiz('2026-10-06',9,{mode:'cloze'}),quiz('2026-10-07',10,{mode:'cloze'})]}));
    assert.deepEqual([result.tests.count,result.tests.last.map(test=>test.mode),badge(result,'perfect').progress,badge(result,'recall8').progress],[2,['cloze','cloze'],1,0]);
  });
  it('refuses a result that makes no sense',()=>{
    for(const bad of [null,{},{t:'x',mode:'active',score:1,total:10},{t:at('2026-10-07'),mode:'other',score:1,total:10},{t:at('2026-10-07'),mode:'active',score:12,total:10},{t:at('2026-10-07'),mode:'active',score:-1,total:10},{t:at('2026-10-07'),mode:'active',score:1.5,total:10}])
      assert.equal(Stats.appendQuiz(null,bad).testsTaken,0);
  });
  it('whatever is in storage, the record that comes out is valid',()=>{
    for(const raw of [undefined,null,'text',42,[],{quizzes:'no',badges:'no'}])assert.deepEqual(Stats.normalizeRecord(raw),{v:1,seeded:false,testsTaken:0,quizzes:[],badges:{}});
    const record=Stats.normalizeRecord({seeded:true,testsTaken:2,quizzes:[quiz('2026-10-07',5),{junk:1}],badges:{memo10:'2026-09-01',notABadge:'2026-09-01',streak3:'yesterday'}});
    assert.deepEqual([record.seeded,record.quizzes.length,Object.keys(record.badges)],[true,1,['memo10']]);
    assert.equal(record.testsTaken,2);
  });
  it('badges are added to the record without overwriting an earlier date',()=>{
    const record=Stats.withBadges({badges:{memo1:'2026-01-01'}},{memo1:'2026-10-07',memo10:'2026-09-10',nope:'2026-09-10',streak3:'yesterday'});
    assert.deepEqual(record.badges,{memo1:'2026-01-01',memo10:'2026-09-10'});
  });
});

describe('Dates and speed',()=>{
  it('the local day of a timestamp is the same one the app uses for its daily usage',()=>{
    for(const iso of ['2026-10-05T23:30:00Z','2026-01-01T00:00:00Z','2026-06-15T12:00:00.000Z'])assert.equal(Stats.localDay(iso),new Date(iso).toLocaleDateString('en-CA'));
    assert.equal(Stats.localDay('not a date'),null);
  });
  it('5,000 words are worked out well within a fraction of a second',()=>{
    const words=Array.from({length:5000},(_,index)=>({word:'w'+index,status:index%3?'memorized':'active',addedAt:new Date(Date.UTC(2026,0,1+index%280,9)).toISOString(),memorizedAt:new Date(Date.UTC(2026,0,2+index%280,9)).toISOString()}));
    const started=process.hrtime.bigint();
    const result=Stats.compute({words,quizzes:[],today:'2026-10-07'});
    const ms=Number(process.hrtime.bigint()-started)/1e6;
    assert(result.summary.total===4999+1&&ms<1500,`took ${ms} ms`);
  });
});
