/* Italian -> Turkish letters (wordbase/STYLE-it-tr.md): the respelling of an Italian sentence, made by rules.
   respell(text) keeps the punctuation, writes every word in lower case, one token for one word (an apostrophe joins the words: l'aiuto -> layuto). */
'use strict';
const V='aeiou',FRONT='ei';
const ACCENT={à:'a',è:'e',é:'e',ì:'i',í:'i',ò:'o',ó:'o',ù:'u',ú:'u'};
const DZ=/^(zero|zona|zucchero|zaino|zebra)/;       // the z of these words is dz, any other z is ts
const isV=ch=>!!ch&&V.includes(ch);

function word(raw){
  const w=raw.toLowerCase().replace(/[’']/g,'').replace(/[àèéìíòóùú]/g,ch=>ACCENT[ch]);
  const dz=DZ.test(w),compound=/sera$/.test(w);       // an s between vowels is z, but not at the start of a second word (stasera)
  let out='';
  for(let i=0;i<w.length;i++){
    const c=w[i],n1=w[i+1]||'',n2=w[i+2]||'',n3=w[i+3]||'',prev=w[i-1]||'';
    if(c==='s'&&n1==='c'&&FRONT.includes(n2)){out+=isV(prev)?'şş':'ş';i++;continue;}                  // sce, sci
    if(c==='s'&&n1==='c'&&n2==='h'){out+='sk';i+=2;continue;}                                          // sch
    if(c==='c'&&n1==='c'&&FRONT.includes(n2)){out+='tç';i++;if(n2==='i'&&isV(n3))i++;continue;}        // cce, cci(+vowel)
    if(c==='c'&&n1==='h'){out+='k';i++;continue;}
    if(c==='c'&&FRONT.includes(n1)){out+='ç';if(n1==='i'&&isV(n2))i++;continue;}                       // ce, ci, and the silent i of cia, cio
    if(c==='c'){out+='k';continue;}
    if(c==='g'&&n1==='g'&&FRONT.includes(n2)){out+='cc';i++;if(n2==='i'&&isV(n3))i++;continue;}        // gge, ggi
    if(c==='g'&&n1==='l'&&n2==='i'){out+='ly';i+=2;if(!isV(n3))out+='i';continue;}                     // gli: lyi, glia: lya
    if(c==='g'&&n1==='n'){out+='ny';i++;continue;}
    if(c==='g'&&n1==='h'){out+='g';i++;continue;}
    if(c==='g'&&FRONT.includes(n1)){out+='c';if(n1==='i'&&isV(n2))i++;continue;}
    if(c==='h')continue;
    if(c==='q'){out+='kv';if(n1==='u')i++;continue;}
    if(c==='z'){
      if(n1==='z'){out+='tts';i++;continue;}
      out+=dz&&i===0?'dz':'ts';continue;
    }
    if(c==='s'){
      if(n1==='s'){out+='ss';i++;continue;}
      out+=isV(prev)&&isV(n1)&&!(compound&&/^sera$/.test(w.slice(i)))?'z':'s';continue;
    }
    if(c==='x'){out+='ks';continue;}
    if(c==='i'&&isV(n1)&&!(prev==='z'&&i===1)){                                                         // ia, ie, io, iu: a glide (but zio)
      if(!prev||!isV(prev)){out+='y';continue;}
    }
    if(c==='i'&&prev&&'aeo'.includes(prev)){out+='y';continue;}                                        // ai, ei, oi: y
    out+=c;
  }
  return out;
}

function respell(text){
  return String(text).replace(/[A-Za-zÀ-ÿ]+(?:['’][A-Za-zÀ-ÿ]+)*/g,word);
}
module.exports={respell,word};
