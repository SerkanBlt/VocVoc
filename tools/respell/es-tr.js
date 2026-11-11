/* Spanish -> Turkish letters (wordbase/STYLE-es-tr.md): the respelling of a Spanish sentence, made by rules instead of by a person.
   respell(text) keeps the punctuation (without ¿ ¡), writes every word in lower case, one token for one word. */
'use strict';
const V='aeiouáéíóúü',STRONG='aeoáéó';
const plainVowel={á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u'};
const strip=ch=>plainVowel[ch]||ch;

function word(raw){
  const w=raw.toLowerCase().normalize('NFC');
  if(w==='y')return 'i';                                       // the conjunction
  if(/^m[eé]xico$/.test(w))return 'mehiko';
  if(w==='texas')return 'tehas';
  if(w==='oaxaca')return 'oahaka';
  let out='';
  for(let i=0;i<w.length;i++){
    const c=w[i],next=w[i+1]||'',next2=w[i+2]||'',prev=w[i-1]||'';
    const frontNext=/[eiéí]/.test(next);
    if(c==='q'&&next==='u'){out+='k';i++;if(!/[eiéí]/.test(next2))out+='u';continue;}                 // que, qui: the u is silent
    if(c==='g'&&next==='u'&&/[eiéí]/.test(next2)){out+='g';i++;continue;}                              // gue, gui
    if(c==='g'&&next==='ü'){out+='gu';i++;continue;}                                                   // güe, güi
    if(c==='c'&&next==='h'){out+='ç';i++;continue;}
    if(c==='c'){out+=frontNext?'s':'k';continue;}
    if(c==='g'){out+=frontNext?'h':'g';continue;}
    if(c==='j'){out+='h';continue;}
    if(c==='z'){out+='s';continue;}
    if(c==='h')continue;
    if(c==='l'&&next==='l'){out+='y';i++;continue;}
    if(c==='r'&&next==='r'){out+='r';i++;continue;}
    if(c==='ñ'){out+='ny';continue;}
    if(c==='v'){out+='b';continue;}
    if(c==='x'){out+='ks';continue;}
    if(c==='w'){out+='u';continue;}
    if(c==='y'){                                               // consonant y before a vowel, i/y at the end of a word
      if(i===w.length-1)out+=prev==='u'?'i':'y';
      else out+=(next&&V.includes(next))?'y':'i';
      continue;
    }
    if(c==='i'&&!/[í]/.test(prev)&&next&&V.includes(next)&&!/[ií]/.test(next)){    // ie, ia, io, iu: a glide
      if(STRONG.includes(next)||next==='u'||next==='ú'){out+='y';continue;}
    }
    if(V.includes(c)){
      const plain=strip(c);
      if(next==='i'&&'aeo'.includes(plain)&&!/[í]/.test(next)&&!(w[i+2]&&V.includes(w[i+2])&&false)){out+=plain+(plain==='o'?'y':plain==='a'?'y':'y');i++;continue;}   // ai, ei, oi
      out+=plain;continue;
    }
    out+=c;
  }
  return out;
}

function respell(text){
  return String(text).replace(/[¿¡]/g,'').replace(/[A-Za-zÀ-ÿ]+/g,word);
}
module.exports={respell,word};
