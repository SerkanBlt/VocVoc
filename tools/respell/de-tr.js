/* German -> Turkish letters (wordbase/STYLE-de-tr.md): the respelling of a German sentence, made by rules.
   respell(text) keeps the punctuation, writes every word in lower case, one token for one word.
   The rules know the letters, not the stress or the prefixes of a word: ge-, ver-, zer-, ent-, be-, er- are guessed from the shape of the word
   (see prefixOf), a few short words are listed (PLAIN), the rest follows the table. */
'use strict';
const V='aeiouäöüy';
const isV=ch=>!!ch&&V.includes(ch);
const PLAIN=new Set(['der','er','wer','vor','mir','dir','wir','ihr','hier','mehr','sehr','nur','für','den','dem','des','es','wen','wem','denn','dann','wenn','kein','dein','mein','sein','ein','gern','woher','wohin','daher','dahin','hierher']);
const NOT_PREFIX=/^(gebe|gebr|gehe|gehö|gewi|gene|gere|gero|geli|geld|gern|gele|gelb|gelt|geme|gemi|gena|gesu|gese|gesa|gest|gast|bere|bern|best|bett|bewe|bein|bei|berg|beru|erst|erde|ernst|enge|engl|ente|entf)/;
const PARTICIPLE=/^ge[a-zäöüß]{3,}(t|en)$/;
function prefixOf(w){
  if(w.length<7)return null;
  if(PARTICIPLE.test(w)&&!NOT_PREFIX.test(w))return ['ge','gı'];
  if(/^ver[a-zäöüß]{3,}/.test(w))return ['ver','fer'];
  if(/^zer[a-zäöüß]{3,}/.test(w))return ['zer','tser'];
  if(/^ent[a-zäöüß]{3,}/.test(w)&&!NOT_PREFIX.test(w))return ['ent','ent'];
  if(/^be[a-zäöüß]{4,}/.test(w)&&!NOT_PREFIX.test(w))return ['be','bı'];
  if(/^er[a-zäöüß]{4,}/.test(w)&&!NOT_PREFIX.test(w))return ['er','er'];
  return null;
}

function word(raw){
  let w=raw.toLowerCase().replace(/[’']/g,'').replace(/[éèê]/g,'e').replace(/[àâ]/g,'a');     // a loanword with a French accent: Café
  const plain=PLAIN.has(w);                                  // a short word whose ending is not weakened (der, den, es ...)
  let out='';
  const pre=prefixOf(w);
  if(pre){out+=pre[1];w=w.slice(pre[0].length);}
  for(let i=0;i<w.length;i++){
    const c=w[i],n1=w[i+1]||'',n2=w[i+2]||'',n3=w[i+3]||'',prev=w[i-1]||'',rest=w.slice(i);
    const atEnd=i===w.length-1;
    if(c==='t'&&n1==='s'&&n2==='c'&&n3==='h'){out+='ç';i+=3;continue;}
    if(c==='s'&&n1==='c'&&n2==='h'){out+='ş';i+=2;continue;}
    if(c==='c'&&n1==='h'&&n2==='s'&&n3!=='t'){out+='ks';i+=2;continue;}                                  // sechs, wachsen (but machst)
    if(c==='d'&&n1==='t'){out+='t';i++;continue;}                                                          // Stadt
    if(c==='c'&&n1==='h'){out+='h';i++;continue;}
    if(c==='c'&&n1==='k'){out+='k';i++;continue;}
    if(c==='c'){out+=/[eiy]/.test(n1)?'ts':'k';continue;}                                                  // a loanword: Café, Computer, Cent
    if(c==='p'&&n1==='h'){out+='f';i++;continue;}
    if(c==='q'&&n1==='u'){out+='kv';i++;continue;}
    if(c==='t'&&n1==='z'){out+='ts';i++;continue;}
    if(c==='t'&&rest==='tion'||c==='t'&&rest==='tions'){out+='tsyon'+(rest==='tions'?'s':'');break;}
    if(c==='t'&&n1==='i'&&n2==='o'&&n3==='n'){out+='tsyon';i+=3;continue;}
    if(c==='s'&&(n1==='t'||n1==='p')&&i===0){out+='ş';continue;}                                          // st-, sp- at the start
    if(c==='s'&&n1==='s'){out+='s';i++;continue;}
    if(c==='ß'){out+='s';continue;}
    if(c==='s'){out+=isV(n1)?'z':'s';continue;}
    if(c==='z'){out+='ts';continue;}
    if(c==='v'){out+='f';continue;}
    if(c==='w'){out+='v';continue;}
    if(c==='j'){out+='y';continue;}
    if(c==='y'){out+='ü';continue;}
    if(c==='x'){out+='ks';continue;}
    if(c==='h'){
      if(isV(prev)&&!/^h(er|in)$/.test(rest)){continue;}                                                  // a silent h after a vowel (but wo-her, wo-hin)
      out+='h';continue;
    }
    if(c==='a'&&n1==='u'){out+='au';i++;continue;}
    if((c==='e'||c==='a')&&n1==='i'){out+='ay';i++;continue;}
    if((c==='e'||c==='ä')&&n1==='u'){out+='oy';i++;continue;}
    if(c==='ä'&&n1==='u'){out+='oy';i++;continue;}
    if(c==='e'&&n1==='e'){out+='e';i++;continue;}                                                         // Kaffee, Tee, Idee
    if(c==='i'&&n1==='e'){
      if(rest==='ien'&&w.length>=6){out+='yın';i+=2;continue;}                                             // Italien, Ferien (not Wien)
      out+='i';i++;continue;
    }
    if(c==='ä'){out+='e';continue;}
    if(c==='e'&&!plain){
      if(rest==='e'){out+='ı';continue;}
      if(rest==='en'){out+=(prev==='h'&&isV(w[i-2]))?'n':'ın';i++;continue;}                              // gehen -> gen (the silent h lengthens the e), wohnen -> vonın
      if(rest==='em'&&w.length>=5&&w!=='problem'){out+='ım';i++;continue;}
      if(rest==='es'&&w.length>=5){out+='ıs';i++;continue;}
      if(rest==='ers'){out+='ırs';i+=2;continue;}
      if(rest==='ere'){out+='ırı';i+=2;continue;}
      if(rest==='el'){out+='ıl';i++;continue;}
      if(rest==='er'){out+='ır';i++;continue;}
      if(rest==='ern'){out+='ırn';i+=2;continue;}
      if(rest==='est'){out+='ıst';i+=2;continue;}
      if(rest==='et'){out+='ıt';i++;continue;}
      if(rest==='ete'){out+='ıtı';i+=2;continue;}
      if(rest==='end'){out+='ınt';i+=2;continue;}
      if(rest==='ert'){out+='ırt';i+=2;continue;}
      out+='e';continue;
    }
    if(c==='e'){out+='e';continue;}
    if(c==='i'&&n1==='g'&&!n2){out+='ih';i++;continue;}                                                   // -ig
    if(c==='l'&&n1==='i'&&n2==='c'&&n3==='h'&&!w[i+4]){out+='lih';i+=3;continue;}                       // -lich
    if((c==='b'||c==='d'||c==='g')&&!(c==='g'&&prev==='n')&&(atEnd||(!isV(n1)&&!'lrn'.includes(n1)&&n1!==c))){out+=({b:'p',d:'t',g:'k'})[c];continue;}   // final devoicing (not ng, not before l r n)
    if(n1===c&&'bdfglmnprt'.includes(c)){out+=c;i++;continue;}                                            // a double consonant is written once
    out+=c;
  }
  return out;
}

function respell(text){
  return String(text).replace(/[A-Za-zÀ-ÿß]+(?:['’][A-Za-zÀ-ÿß]+)*/g,word);
}
module.exports={respell,word};
