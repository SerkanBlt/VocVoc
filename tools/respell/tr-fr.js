/* Turkish -> French letters (wordbase/STYLE-tr-fr.md): the transcription of a Turkish sentence, made by rules instead of by a person.
   transcribe(text) keeps the punctuation, writes every word in lower case, one token for one word. */
'use strict';
const VOWELS='aeıioöuüâî',FRONT='eiöü';
const lower=s=>s.replace(/İ/g,'i').replace(/I/g,'ı').toLowerCase();
const isV=ch=>!!ch&&VOWELS.includes(ch);

function word(raw){
  const w=lower(raw).replace(/[’']/g,'');
  let out='';
  for(let i=0;i<w.length;i++){
    const c=w[i],next=w[i+1]||'',next2=w[i+2]||'',prev=w[i-1]||'';
    switch(c){
      case 'a':out+=(next==='i'?'ay':'a');break;
      case 'â':out+=prev==='g'?'ia':(/[kl]/.test(prev)?'ya':'a');break;
      case 'e':{                                              // open syllable é, closed syllable è
        const closed=next&&!isV(next)&&(!w[i+2]||!isV(w[i+2]));
        out+=closed?'è':'é';break;}
      case 'ı':out+='î';break;
      case 'i':out+='i';break;
      case 'o':if(next==='ğ'&&next2==='u'){out+='ou';i+=2;}else out+='o';break;      // oğu is one long ou (soğuk -> souk)
      case 'ö':out+='eu';break;
      case 'u':if(next==='ğ'&&next2==='u'){out+='ou';i+=2;}else out+='ou';break;
      case 'ü':out+='u';break;
      case 'c':out+='dj';break;
      case 'ç':out+='tch';break;
      case 'ş':out+='ch';break;
      case 'ğ':break;                                         // the vowels around it follow each other
      case 'g':out+=(FRONT.includes(next)&&next!=='ü')?'gu':(next==='â'?'gu':'g');break;       // gü is gu; ge, gi -> gué, gui; gö -> gueu
      case 'k':out+='k';break;
      case 'y':out+='y';break;
      case 'x':out+='ks';break;
      default:out+=c;
    }
    if(c==='n'&&isV(prev)&&(!next))out+='e';                  // a vowel + final n would sound nasal to a French reader
  }
  return out;
}

function transcribe(text){
  return String(text).replace(/[A-Za-zÀ-ÿĞğİıŞşÇçÖöÜüÂâ]+(?:['’][A-Za-zÀ-ÿĞğİıŞşÇçÖöÜüÂâ]+)*/g,word);
}
module.exports={transcribe,word};
