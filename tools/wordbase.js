/* The word database of the courses: the sources are written in wordbase/, the files the app downloads are built into packs/.
     node tools/wordbase.js check [pair]     check the sources (structure, content rules, the lemma list); exit 1 on an error
     node tools/wordbase.js build [pair]     write packs/<pair>/ (chunk files and order.json) and refresh packs/index.json
     node tools/wordbase.js stats [pair]     words, coverage and size per level
   Layout (see wordbase/README.md and wordbase/STYLE.md):
     wordbase/<target>/lemmas.tsv      headword TAB part of speech TAB level: the course in the order it is learned, one word a line
     wordbase/<pair>/course.json       {"version": N}: raised when released content changes, so devices download it again
     wordbase/<pair>/src/<LEVEL>-<nnn>.jsonl   the words in lemma order, one JSON object a line, in the compact form below
   The compact form saves keys:  {"w":word,"t":type,"m":meaning,"s":[synonyms],"a":[antonyms],"e":[[sentence,respelling,translation] x2],
   "x":[[phrase,respelling,meaning,sentence,sentence respelling,sentence translation] x0-2]}. */
'use strict';
const fs=require('fs'),path=require('path');
const Packs=require('../packs.js');
const Build=require('./build-packs.js');
const Respell=require('./respell/index.js');
const repoRoot=path.resolve(__dirname,'..');

const KEYS=new Set(['w','t','m','s','a','e','x']);
// The labels of a word's kind, in Turkish (a word of several kinds joins them with "/", e.g. "sıfat/zarf").
// A noun is "isim" alone when the target language has no grammatical gender (English, Turkish), else "isim (eril)" etc.
const TYPE_LABEL='(?:isim(?: \\((?:eril|dişil|nötr|eril\\/dişil)\\))?|fiil|sıfat|zarf|edat|bağlaç|zamir|belirleyici|ünlem|sayı|kalıp)';
const TYPE_PATTERN=new RegExp(`^${TYPE_LABEL}(?:/${TYPE_LABEL})*$`);
// The same list for a French-speaking learner (native fr).
const TYPE_LABEL_FR='(?:nom(?: \\((?:masculin|féminin|masculin\\/féminin)\\))?|verbe|adjectif|adverbe|préposition|postposition|conjonction|pronom|déterminant|interjection|numéral|locution)';
const TYPE_PATTERN_FR=new RegExp(`^${TYPE_LABEL_FR}(?:/${TYPE_LABEL_FR})*$`);
// A respelling is written with the letters of the learner's own language and ordinary punctuation: no IPA, no q, w, x.
const RESPELLING=/^[a-zA-ZçğıöşüÇĞİÖŞÜâîûÂÎÛ0-9 ,.;:!?'’\-–—()…/"«»]+$/;
const RESPELLING_FR=/^[a-zA-ZàâäçéèêëîïôöùûüœÀÂÇÉÈÊÎÔÛ0-9 ,.;:!?'’\-–—()…/"«»]+$/;
const FORBIDDEN_LETTER=/[qwxQWX]/;
const BATCH_FILE=/^(A1|A2|B1|B2|C1|C2)-(\d{3})\.jsonl$/;

const lf=text=>text.replace(/\r\n/g,'\n');
const plain=text=>String(text).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/ı/g,'i').replace(/ß/g,'ss');
const isLine=value=>typeof value==='string'&&value.trim().length>0;
const wordsOfText=text=>plain(text).split(/[^a-z0-9]+/).filter(Boolean);

// compact -> the record the app stores (only filled lists are written)
function expand(raw){
  const out={word:raw.w,type:raw.t,meaning:raw.m};
  if(raw.s&&raw.s.length)out.synonyms=raw.s;
  if(raw.a&&raw.a.length)out.antonyms=raw.a;
  out.examples=(raw.e||[]).map(([text,phonetic,translation])=>({text,phonetic,translation}));
  if(raw.x&&raw.x.length)out.expressions=raw.x.map(([text,phonetic,translation,exampleText,examplePhonetic,exampleTranslation])=>({text,phonetic,translation,exampleText,examplePhonetic,exampleTranslation}));
  return out;
}

// Does the sentence use the word? Inflected forms count: a verb is looked for by its stem, any word by its first letters.
// The forms of verbs whose stem changes: a stem rule cannot find them. (Accents are ignored, like everywhere in the check.)
const IRREGULAR_FORMS={
  'œil':'yeux oeil œil',
  nouveau:'nouvel nouvelle nouveaux nouvelles',
  vieux:'vieil vieille vieilles',
  beau:'bel belle beaux belles',
  blanc:'blanche blanches blancs',
  long:'longue longues longs',
  doux:'douce douces',
  faux:'fausse fausses',
  frais:'fraiche fraiches',
  gros:'grosse grosses',
  heureux:'heureuse heureuses',
  fou:'folle folles fous',
  cheveu:'cheveux',
  cheval:'chevaux',
  animal:'animaux',
  journal:'journaux',
  travail:'travaux',
  jeu:'jeux',
  neveu:'neveux',
  oeuf:'oeufs œufs œuf',
  'œuf':'oeuf oeufs œufs',
  ciel:'cieux',
  monsieur:'messieurs',
  madame:'mesdames',
  mademoiselle:'mesdemoiselles',
  etre:'suis es est sommes etes sont etais etait etions etiez etaient ete serai sera seras serons serez seront serais serait soit soient sois soyez etant fut furent',
  avoir:'ai as a avons avez ont avais avait avions aviez avaient eu aura aurai auras aurons aurez auront aurais aurait ait aie ayez ayant',
  aller:'vais vas va allons allez vont allais allait allions alliez allaient irai ira iras irons irez iront irais irait aille ailles',
  faire:'fais fait faisons faites font faisais faisait faisions faisaient ferai fera feras ferons ferez feront ferais ferait fasse fassent faisant',
  vouloir:'veux veut voulons voulez veulent voulais voulait voulaient voulu voudrai voudra voudras voudrais voudrait voudriez veuille veuillez',
  pouvoir:'peux peut pouvons pouvez peuvent pouvais pouvait pouvaient pu pourrai pourra pourras pourrais pourrait pourriez puisse',
  devoir:'dois doit devons devez doivent devais devait devaient du devra devrai devras devrais devrait devriez doive',
  savoir:'sais sait savons savez savent savais savait savaient su saurai saura saurais saurait sache sachez',
  voir:'vois voit voyons voyez voient voyais voyait vu verrai verra verras verrais verrait voie',
  venir:'viens vient venons venez viennent venais venait venu viendrai viendra viendras viendrais viendrait vienne',
  prendre:'prends prend prenons prenez prennent prenais prenait pris prendrai prendra prendras prendrais prendrait prenne',
  dire:'dis dit disons dites disent disais disait dirai dira diras dirais dirait dise',
  mettre:'mets met mettons mettez mettent mettais mettait mis mettrai mettra mettrais mette',
  connaitre:'connais connait connaissons connaissez connaissent connaissais connaissait connu connaitrai',
  croire:'crois croit croyons croyez croient croyais croyait cru croirai croirais',
  partir:'pars part partons partez partent partais partait parti partirai partira',
  sortir:'sors sort sortons sortez sortent sortais sortait sorti sortirai sortira',
  dormir:'dors dort dormons dormez dorment dormais dormait dormi',
  ecrire:'ecris ecrit ecrivons ecrivez ecrivent ecrivais ecrivait ecrirai',
  lire:'lis lit lisons lisez lisent lisais lisait lu lirai',
  boire:'bois boit buvons buvez boivent buvais buvait bu boirai',
  ouvrir:'ouvre ouvres ouvrons ouvrez ouvrent ouvrais ouvrait ouvert ouvrirai',
  courir:'cours court courons courez courent courais courait couru courrai',
  vivre:'vis vit vivons vivez vivent vivais vivait vecu vivrai',
  suivre:'suis suit suivons suivez suivent suivais suivait suivi suivrai',
  mourir:'meurs meurt mourons mourez meurent mourais mourait mort mourrai',
  naitre:'nais nait naissons naissez naissent naissait ne nee nes nees',
  recevoir:'recois recoit recevons recevez recoivent recevais recevait recu recevrai',
  tenir:'tiens tient tenons tenez tiennent tenais tenait tenu tiendrai',
  offrir:'offre offres offrons offrez offrent offrais offrait offert',
  conduire:'conduis conduit conduisons conduisez conduisent conduisais conduisait',
  rire:'ris rit rions riez rient riais riait ri',
  plaire:'plais plait plaisons plaisez plaisent plaisait plu',
  falloir:'faut fallait fallu faudra faudrait',
  asseoir:'assieds assied assois assoit asseyons asseyez assis assise',
  envoyer:'envoie envoies envoient envoyons envoyez envoyais envoyait enverrai enverra',
  payer:'paie paies paient paye payes payent payons payez payais payait',
  acheter:'achete achetes achetent achetons achetez achetais achetait achetai',
  appeler:'appelle appelles appellent appelons appelez appelais appelait appellerai',
  comprendre:'comprends comprend comprenons comprenez comprennent comprenais comprenait compris comprendrai',
  apprendre:'apprends apprend apprenons apprenez apprennent apprenais apprenait appris apprendrai',
  attendre:'attends attend attendons attendez attendent attendais attendait attendu attendrai',
  repondre:'reponds repond repondons repondez repondent repondais repondait repondu repondrai',
  vendre:'vends vend vendons vendez vendent vendais vendait vendu vendrai',
  perdre:'perds perd perdons perdez perdent perdais perdait perdu perdrai',
  descendre:'descends descend descendons descendez descendent descendais descendait descendu',
  entendre:'entends entend entendons entendez entendent entendais entendait entendu',
  devenir:'deviens devient devenons devenez deviennent devenait devenu deviendra',
  revenir:'reviens revient revenons revenez reviennent revenait revenu reviendra',
  apercevoir:'apercois apercoit apercevons apercu',
  souvenir:'souviens souvient souvenons souvenez souviennent souvenait souvenu',
  finir:'finis finit finissons finissez finissent finissais finissait fini finirai',
  choisir:'choisis choisit choisissons choisissez choisissent choisi',
  reussir:'reussis reussit reussissons reussissent reussi',
  sentir:'sens sent sentons sentez sentent sentais sentait senti sentirai',
  servir:'sers sert servons servez servent servais servait servi servirai',
  eteindre:'eteins eteint eteignons eteignez eteignent eteignais eteignait eteindrai',
  endormir:'endors endort endormons endormez endorment endormais endormait endormi endormirai',
  peindre:'peins peint peignons peignez peignent peignais peignait peindrai',
  mentir:'mens ment mentons mentez mentent mentais mentait menti mentira',
  paraitre:'parais parait paraissons paraissez paraissent paraissait paru paraitra',
  rejoindre:'rejoins rejoint rejoignons rejoignez rejoignent rejoignait rejoindra',
  joindre:'joins joint joignons joignez joignent joignait joindra',
  atteindre:'atteins atteint atteignons atteignez atteignent atteignait atteindra',
  resoudre:'resous resout resolvons resolvez resolvent resolvait resolu resoudra',
  refaire:'refais refait refaisons refaites refont refaisait refera',
  poursuivre:'poursuis poursuit poursuivons poursuivez poursuivent poursuivait poursuivi poursuivra',
  retenir:'retiens retient retenons retenez retiennent retenait retenu retiendra',
  soutenir:'soutiens soutient soutenons soutenez soutiennent soutenait soutenu soutiendra',
  ressentir:'ressens ressent ressentons ressentez ressentent ressentait ressenti ressentira',
  contenir:'contiens contient contenons contenez contiennent contenait contenu contiendra',
  vaincre:'vaincs vainc vainquons vainquez vainquent vainquait vaincu vaincra',
  elire:'elis elit elisons elisez elisent elisait elu elira',
  intervenir:'interviens intervient intervenons intervenez interviennent intervenait intervenu interviendra',
  accomplir:'accomplis accomplit accomplissons accomplissez accomplissent accomplissait accompli accomplira',
  reduire:'reduis reduit reduisons reduisez reduisent reduisait reduit reduira',
  maintenir:'maintiens maintient maintenons maintenez maintiennent maintenait maintenu maintiendra',
  repartir:'repars repart repartons repartez repartent repartait reparti repartira',
  admettre:'admets admet admettons admettez admettent admettait admis admettra',
  commettre:'commets commet commettons commettez commettent commettait commis commettra',
  emettre:'emets emet emettons emettez emettent emettait emis emise emettra',
  omettre:'omets omet omettons omettez omettent omettait omis omise omettra',
  transmettre:'transmets transmet transmettons transmettez transmettent transmettait transmis transmettra',
  conclure:'conclus conclut concluons concluez concluent concluait conclu conclura',
  dissoudre:'dissous dissout dissolvons dissolvez dissolvent dissolvait dissoudra',
  contredire:'contredis contredit contredisons contredisez contredisent contredisait contredira',
  abstenir:'abstiens abstient abstenons abstenez abstiennent abstenait abstenu',
  decevoir:'decois decoit decevons decevez decoivent decevait decu decue decus decues decevra',
  satisfaire:'satisfais satisfait satisfaisons satisfaites satisfont satisfaisait satisfera',
  distraire:'distrais distrait distrayons distrayez distraient distrayait distraira',
  prevoir:'prevois prevoit prevoyons prevoyez prevoient prevoyait prevu prevoira',
  inscrire:'inscris inscrit inscrivons inscrivez inscrivent inscrivait inscrira',
  craindre:'crains craint craignons craignez craignent craignait craindra',
  hair:'hais hait haissons haissez haissent haissait',
  plaindre:'plains plaint plaignons plaignez plaignent plaignait plaindra',
  abattre:'abats abat abattons abattez abattent abattait abattu abattra',
  concevoir:'concois concoit concevons concevez concoivent concevait concu concue',
  redevenir:'redeviens redevient redevenons redevenez redeviennent redevenait redevenu redeviendra',
  retordre:'retors retord retordons retordez retordent retordait retordu',
  restreindre:'restreins restreint restreignons restreignez restreignent restreignait restreignaient restreindra restreindrait restreigne restreignant restreignit',
  rabattre:'rabats rabat rabattons rabattez rabattent rabattait rabattaient rabattra rabattrait rabatte rabattant rabattu rabattue',
  tutoyer:'tutoie tutoies tutoient tutoyons tutoyez tutoyait tutoyaient tutoiera tutoie tutoyant',
  deteindre:'deteins deteint deteignons deteignez deteignent deteignait deteignaient deteindra deteindrait deteigne deteignant deteignit',
  etreindre:'etreins etreint etreignons etreignez etreignent etreignait etreignaient etreindra etreindrait etreigne etreignant etreignit',
  croitre:'crois croit croissons croissez croissent croissait croissaient croitra croitrait croisse croissant crue',
  teindre:'teins teint teignons teignez teignent teignait teignaient teindra teindrait teigne teignant teignit',
  paitre:'pais pait paissons paissez paissent paissait paissaient paitra paitrait paisse paissant',
  soustraire:'soustrais soustrait soustrayons soustrayez soustraient soustrayait soustraira soustraie soustrayant soustrait',
  resservir:'ressers ressert resservons resservez resservent resservait resservaient resservira resservirait resserve resservant resservi',
  deplaire:'deplais deplait deplaisons deplaisez deplaisent deplaisait deplaisaient deplaira deplairait deplaise deplaisant deplu',
  survenir:'survient surviennent survienne surviens survenu survenue survenait survenaient surviendra surviendrait survint survenant',
  gesir:'gis git gisons gisez gisent gisait gisaient gisant',
  eclore:'eclot eclosent eclos eclose eclora eclorait eclosait eclosaient',
  induire:'induis induit induisons induisez induisent induisait induisaient induira induirait induise induisant induisit',
  contraindre:'contrains contraint contraignons contraignez contraignent contraignait contraignaient contraindra contraindrait contraigne contraignant contraignit',
  rendormir:'rendors rendort rendormons rendormez rendorment rendormait rendormaient rendormira rendormirait rendorme rendormant rendormi rendormit',
  advenir:'advient adviennent advienne adviennent advint advenu advenait',
  percevoir:'percois percoit percevons percevez percoivent percevait percevra percu percue percus',
  geindre:'geint geins geignent geignons geignez geignait geignaient geindra geindrait geigne geignant geignit',
  renaitre:'renais renait renaissons renaissez renaissent renaissait renaitra',
  repentir:'repens repent repentons repentez repentent repentait repenti repentira',
  repeindre:'repeins repeint repeignons repeignez repeignent repeignait repeindra',
  entretenir:'entretiens entretient entretenons entretenez entretiennent entretenait entretenu entretiendra',
  convenir:'conviens convient convenons convenez conviennent convenait convenu conviendra',
  equivaloir:'equivaux equivaut equivalons equivalent equivalait equivalu',
  feindre:'feins feint feignons feignez feignent feignait',
  pourvoir:'pourvois pourvoit pourvoyons pourvoient pourvoyait pourvu',
  introduire:'introduis introduit introduisons introduisez introduisent introduisait introduira',
  provenir:'proviens provient provenons provenez proviennent provenait provenu proviendra',
  parvenir:'parviens parvient parvenons parvenez parviennent parvenait parvenu parviendra',
  reproduire:'reproduis reproduit reproduisons reproduisez reproduisent reproduisait reproduira',
  conquerir:'conquiers conquiert conquerons conquerez conquierent conquerait conquis conquerra',
  acquerir:'acquiers acquiert acquerons acquerez acquierent acquerait acquis acquise acquerra',
  subvenir:'subviens subvient subvenons subvenez subviennent subvenait subvenu',
  reconquerir:'reconquiers reconquiert reconquerons reconquierent reconquis reconquerait',
  defaire:'defais defait defaisons defaites defont defaisait defera',
  soumettre:'soumets soumet soumettons soumettez soumettent soumettait soumis soumettra',
  enfreindre:'enfreins enfreint enfreignons enfreignez enfreignent enfreignait enfreindra',
  detenir:'detiens detient detenons detenez detiennent detenait detenu detiendra',
  exclure:'exclus exclut excluons excluez excluent excluait exclura exclu',
  reconstruire:'reconstruis reconstruit reconstruisons reconstruisez reconstruisent reconstruisait reconstruira',
  extraire:'extrais extrait extrayons extrayez extraient extrayait extraira extrayant',
  interrompre:'interromps interrompt interrompons interrompez interrompent interrompait interrompu interrompra',
  promouvoir:'promeus promeut promouvons promouvez promeuvent promouvait promu promouvra',
  predire:'predis predit predisons predisez predisent predisait predira',
  inclure:'inclus inclut incluons incluez incluent incluait inclura inclu',
  compromettre:'compromets compromet compromettons compromettez compromettent compromettait compromis compromettra',
  debattre:'debats debat debattons debattez debattent debattait debattu debattra',
  coudre:'couds coud cousons cousez cousent cousait cousu coudra',
  clore:'clos clot closons closez closent closait',
  recoudre:'recous recoud recousons recousez recousent recousait recousu recousue',
  bouillir:'bous bout bouillons bouillez bouillent bouillait bouilli bouillira',
  requerir:'requiers requiert requerons requerez requierent requerait requis requerra',
  interdire:'interdis interdit interdisons interdisez interdisent interdisait interdira',
  secourir:'secours secourt secourons secourez secourent secourait secouru secourra',
  apparaitre:'apparais apparait apparaissons apparaissez apparaissent apparaissait apparu apparue apparaitra',
  comparaitre:'comparais comparait comparaissons comparaissez comparaissent comparaissait comparu comparaitra',
  seduire:'seduis seduit seduisons seduisez seduisent seduisait seduira',
  revivre:'revis revit revivons revivez revivent revivait revecu revivra',
  combattre:'combats combat combattons combattez combattent combattait combattu combattra',
  reconnaitre:'reconnais reconnait reconnaissons reconnaissez reconnaissent reconnaissait reconnu reconnaitra',
  fuir:'fuis fuit fuyons fuyez fuient fuyait fui fuira',
  permettre:'permets permet permettons permettez permettent permettait permis permettra',
  survivre:'survis survit survivons survivez survivent survivait survecu survivra',
  convaincre:'convaincs convainc convainquons convainquez convainquent convainquait convaincu convaincra',
  prevenir:'previens previent prevenons prevenez previennent prevenait prevenu previendra',
  appartenir:'appartiens appartient appartenons appartenez appartiennent appartenait appartenu',
  reprendre:'reprends reprend reprenons reprenez reprennent reprenait repris reprendra',
  remettre:'remets remet remettons remettez remettent remettais remettait remis remettra',
  obtenir:'obtiens obtient obtenons obtenez obtiennent obtenais obtenait obtenu obtiendra',
  valoir:'vaux vaut valons valez valent valais valait valu vaudra vaudrait',
  battre:'bats bat battons battez battent battais battait battu battra',
  promettre:'promets promet promettons promettez promettent promettais promettait promis promettra',
  disparaitre:'disparais disparait disparaissons disparaissez disparaissent disparaissait disparu disparaitra',
};
const irregularStem=word=>{
  const plainWord=plain(word).replace(/^(se|s) /,'').replace(/^s'/,'');
  return IRREGULAR_FORMS[plainWord]?IRREGULAR_FORMS[plainWord].split(' '):null;
};
// The French rules above know French verbs. Any other target language gets a plain check: a sentence word that starts like the headword
// (its first letters; short words must appear whole). It only feeds a warning, so it may be a little generous.
function usesWordGeneric(sentence,word,target){
  const tokens=wordsOfText(sentence);
  if(target==='tr'){      // suffixes pile up behind the stem: a verb is looked for without -mek/-mak, and the last consonant may soften (kitap -> kitabı, et -> edebilir)
    const soft={t:'d',k:'g',p:'b',c:'c'};
    return wordsOfText(word).some(part=>{
      const cut=part.replace(/(mek|mak)$/,''),stem=cut.length>=2?cut:part,last=stem.slice(-1);       // "emek" is a noun, not "e" + -mek
      const forms=[stem];if(soft[last])forms.push(stem.slice(0,-1)+soft[last]);
      if(stem.length>=3)forms.push(stem.slice(0,-1));
      if(stem.length>=4&&/[aeiou][^aeiou]$/.test(stem))forms.push(stem.slice(0,-2)+last,stem.slice(0,-2)+(soft[last]||last));       // oğul -> oğlum, burun -> burnu: the last vowel may drop
      return tokens.some(token=>forms.some(form=>token===form||(form.length>=2&&token.startsWith(form))));
    });
  }
  return wordsOfText(word).some(part=>{
    if(part.length<=3)return tokens.some(token=>token===part||(token.startsWith(part)&&token.length<=part.length+3)||token.startsWith(part+part.slice(-1)));       // sews, rowed, begged
    const size=Math.max(3,part.length-2);
    return tokens.some(token=>token.startsWith(part.slice(0,size)));
  });
}
function usesWord(sentence,word,target='fr'){
  if(target!=='fr')return usesWordGeneric(sentence,word,target);
  const tokens=wordsOfText(sentence);
  const forms=irregularStem(word);
  if(forms&&tokens.some(token=>forms.includes(token)||token===plain(word)))return true;
  return wordsOfText(word).some(part=>{
    if(part.length<=2)return tokens.includes(part)||tokens.includes(part+'s');
    const stem=part.replace(/(er|ir|re|oir)$/,'');
    const size=Math.max(3,Math.min(stem.length,part.length-1));
    if(/yer$/.test(part)&&tokens.some(token=>token.startsWith(stem.slice(0,-1)+'i')))return true;     // nettoyer: nettoie, nettoient
    return tokens.some(token=>token.startsWith(stem.slice(0,size)));
  });
}

// Two respelling rules a letter table cannot enforce (see wordbase/STYLE-tr-fr.md and STYLE-en-tr.md):
//  - to a French reader, a vowel + word-final n looks like a nasal vowel: Turkish words are respelled with -ne (kan -> kane, ben -> bène);
//  - English "to" is tı before a consonant and tu before a vowel or at the end of a phrase, "the" is zı before a consonant and zi before a vowel.
const FINAL_N=/[aeiouyîéèûâêô]n(?=$|[\s,.;:!?)…»"—–-])/i;
const edgeWord=word=>word.replace(/^[^A-Za-zçğıöşüÇĞİÖŞÜâîû']+|[^A-Za-zçğıöşüÇĞİÖŞÜâîû']+$/g,'');
function respellingRuleProblems(source,text,{native,target}){
  const problems=[];
  if(native==='fr'&&FINAL_N.test(text))problems.push(`a word ends in a vowel + n: write -ne (nasal vowel to a French reader): ${text}`);
  if(native==='tr'&&target==='en'&&typeof source==='string'){
    const sourceWords=source.split(/\s+/),words=text.split(/\s+/);
    if(sourceWords.length===words.length)words.forEach((word,index)=>{
      const spoken=edgeWord(sourceWords[index]).toLowerCase(),written=edgeWord(word);
      if(spoken!=='to'&&spoken!=='the')return;
      const next=index+1<words.length?edgeWord(words[index+1]):'',phraseEnd=index===words.length-1||/[,.;:!?)…]$/.test(word),vowel=/^[aeıioöuü]/i.test(next);
      const wanted=spoken==='to'?(phraseEnd||vowel?'tu':'tı'):(!phraseEnd&&vowel?'zi':'zı');
      if(['tu','tı','zı','zi'].includes(written)&&written!==wanted)problems.push(`"${spoken}" should be ${wanted} here, not ${written}: ${text}`);
    });
  }
  return problems;
}

// {errors:[], warnings:[]} for one compact word
// The label list and the respelling alphabet are known only for French words explained in Turkish (wordbase/STYLE.md); other pairs
// are checked for structure only until their style rules are written down here.
function lintWord(raw,{native='tr',target='fr'}={}){
  const errors=[],warnings=[];
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {errors:['not an object'],warnings};
  for(const key of Object.keys(raw))if(!KEYS.has(key))errors.push(`unknown key ${key}`);
  for(const key of ['w','t','m'])if(!isLine(raw[key]))errors.push(`${key} is missing`);
  if(errors.length)return {errors,warnings};
  const respelling=(text,where,source)=>{
    if(!isLine(text)){errors.push(`${where}: respelling is missing`);return;}
    for(const message of respellingRuleProblems(source,text,{native,target}))warnings.push(`${where}: ${message}`);
    if(native==='tr'&&(!RESPELLING.test(text)||FORBIDDEN_LETTER.test(text)))errors.push(`${where}: respelling must use Turkish letters only (no IPA, q, w, x): ${text}`);
    if(native==='fr'&&(!RESPELLING_FR.test(text)||FORBIDDEN_LETTER.test(text)))errors.push(`${where}: respelling must use French letters only (no IPA, q, w, x): ${text}`);
  };
  if(native==='tr'&&!TYPE_PATTERN.test(raw.t))warnings.push(`type "${raw.t}" is not in the list of labels`);
  if(native==='fr'&&!TYPE_PATTERN_FR.test(raw.t))warnings.push(`type "${raw.t}" is not in the list of labels`);
  if(raw.m.length>80)warnings.push('meaning is long (over 80 characters)');
  if(!Array.isArray(raw.e)||raw.e.length!==2)errors.push('e: exactly two examples');
  else raw.e.forEach((example,index)=>{
    const where=`e[${index}]`;
    if(!Array.isArray(example)||example.length!==3||!isLine(example[0])||!isLine(example[2])){errors.push(`${where}: [sentence, respelling, translation]`);return;}
    respelling(example[1],where,example[0]);
    if(!usesWord(example[0],raw.w,target))warnings.push(`${where}: the sentence does not seem to use "${raw.w}"`);
    if(example[0].length>140)warnings.push(`${where}: long sentence`);
  });
  if(Array.isArray(raw.e)&&raw.e.length===2&&Array.isArray(raw.e[0])&&Array.isArray(raw.e[1])&&raw.e[0][0]===raw.e[1][0])errors.push('e: the two examples are the same');
  if(raw.x!==undefined){
    if(!Array.isArray(raw.x)||raw.x.length>2)errors.push('x: at most two phrases');
    else raw.x.forEach((item,index)=>{
      const where=`x[${index}]`;
      if(!Array.isArray(item)||item.length!==6||item.some(part=>!isLine(part))){errors.push(`${where}: [phrase, respelling, meaning, sentence, sentence respelling, sentence translation]`);return;}
      respelling(item[1],`${where} phrase`,item[0]);respelling(item[4],`${where} sentence`,item[3]);
      const parts=wordsOfText(item[0]).filter(part=>part.length>=3);
      if(parts.length&&!parts.some(part=>usesWord(item[3],part,target)))warnings.push(`${where}: the sentence does not seem to use "${item[0]}"`);
    });
  }
  const own=plain(raw.w),seen=new Set();
  for(const field of ['s','a']){
    if(raw[field]===undefined)continue;
    if(!Array.isArray(raw[field])||raw[field].length>4||raw[field].some(item=>!isLine(item))){errors.push(`${field}: at most four words`);continue;}
    for(const item of raw[field]){
      if(plain(item)===own)errors.push(`${field}: "${item}" is the word itself`);
      if(seen.has(plain(item)))errors.push(`${field}: "${item}" is listed twice (also across synonyms and antonyms)`);seen.add(plain(item));
    }
  }
  return {errors,warnings};
}

function readLemmas(root,target){
  const file=path.join(root,'wordbase',target,'lemmas.tsv');
  if(!fs.existsSync(file))return null;
  return lf(fs.readFileSync(file,'utf8')).split('\n').map((line,index)=>({line,number:index+1})).filter(({line})=>line.trim()&&!line.startsWith('#')).map(({line,number})=>{
    const [word,pos,level]=line.split('\t').map(part=>part.trim());
    return {word,pos,level,line:number};
  });
}
// A pair with a respelling engine (tools/respell) needs no respelling in its sources: an empty one ("") is made from the sentence.
// With overwrite every respelling is made again (one convention for the whole course). Returns how many were made.
const isBlank=value=>value===undefined||value===null||(typeof value==='string'&&!value.trim());
function fillRespellings(raw,pair,{overwrite=false}={}){
  const run=Respell.forPair(pair);
  if(!run||!raw||typeof raw!=='object'||Array.isArray(raw))return 0;
  let made=0;
  const fill=(list,from,to)=>{if(Array.isArray(list)&&typeof list[from]==='string'&&list[from].trim()&&(overwrite||isBlank(list[to]))){list[to]=run(list[from]);made++;}};
  if(Array.isArray(raw.e))raw.e.forEach(example=>fill(example,0,1));
  if(Array.isArray(raw.x))raw.x.forEach(item=>{fill(item,0,1);fill(item,3,4);});
  return made;
}
function readSources(root,pair,{fill=true}={}){
  const dir=path.join(root,'wordbase',pair,'src');
  if(!fs.existsSync(dir))return [];
  const out=[];
  for(const name of fs.readdirSync(dir).filter(name=>/\.jsonl$/.test(name)).sort()){
    lf(fs.readFileSync(path.join(dir,name),'utf8')).split('\n').forEach((text,index)=>{
      if(!text.trim())return;
      let raw=null,broken=false;try{raw=JSON.parse(text);}catch(_){broken=true;}
      if(fill&&raw)fillRespellings(raw,pair);
      out.push({file:name,line:index+1,raw,broken});
    });
  }
  return out;
}
// Write the respellings of the engine into the source files (empty ones, or all of them with overwrite). Returns {files, made}.
function respellSources(root,pair,{overwrite=false}={}){
  const dir=path.join(root,'wordbase',pair,'src');
  if(!Respell.forPair(pair))return {error:`${pair} has no respelling engine (tools/respell)`,files:0,made:0};
  let files=0,made=0;
  for(const name of fs.readdirSync(dir).filter(name=>/\.jsonl$/.test(name)).sort()){
    let changed=0;
    const lines=lf(fs.readFileSync(path.join(dir,name),'utf8')).split('\n').map(text=>{
      if(!text.trim())return text;
      let raw;try{raw=JSON.parse(text);}catch(_){return text;}
      const count=fillRespellings(raw,pair,{overwrite});
      if(!count)return text;
      changed+=count;return JSON.stringify(raw);
    });
    if(changed){fs.writeFileSync(path.join(dir,name),lines.join('\n'));files++;made+=changed;}
  }
  return {files,made};
}
const courseVersion=(root,pair)=>{
  const file=path.join(root,'wordbase',pair,'course.json');
  if(!fs.existsSync(file))return 1;
  try{const version=JSON.parse(fs.readFileSync(file,'utf8')).version;return Number.isInteger(version)&&version>=1?version:1;}catch(_){return 1;}
};

// Everything that can be said about one course's sources: {errors, warnings, entries:[{word, level, record}]}
function checkCourse(root,pair){
  const errors=[],warnings=[],entries=[];
  const parsed=Packs.pairOf(pair);
  if(!parsed)return {errors:[`${pair}: a course is named <target>-<native>`],warnings,entries};
  const lemmas=readLemmas(root,parsed.target);
  if(!lemmas)return {errors:[`wordbase/${parsed.target}/lemmas.tsv is missing`],warnings,entries};
  const levelOrder=lemma=>Packs.LEVELS.indexOf(lemma.level);
  lemmas.forEach((lemma,index)=>{
    if(!lemma.word||!lemma.pos||!Packs.LEVELS.includes(lemma.level))errors.push(`lemmas.tsv line ${lemma.line}: word, part of speech and a level A1-C2 are needed`);
    if(index&&levelOrder(lemma)<levelOrder(lemmas[index-1]))errors.push(`lemmas.tsv line ${lemma.line}: the levels must not go back`);
  });
  const known=new Set();
  for(const lemma of lemmas){const key=Packs.wordKey(lemma.word,parsed.target);if(known.has(key))errors.push(`lemmas.tsv: "${lemma.word}" appears twice`);known.add(key);}
  const sources=readSources(root,pair);
  sources.forEach((source,index)=>{
    const where=`${source.file}:${source.line}`;
    if(source.broken){errors.push(`${where}: not valid JSON`);return;}
    const lemma=lemmas[entries.length];
    const name=BATCH_FILE.exec(source.file);
    if(!name)errors.push(`${source.file}: the name must look like A1-001.jsonl`);
    const result=lintWord(source.raw,{native:parsed.native,target:parsed.target});
    for(const message of result.errors)errors.push(`${where}${source.raw&&source.raw.w?` (${source.raw.w})`:''}: ${message}`);
    for(const message of result.warnings)warnings.push(`${where} (${source.raw.w}): ${message}`);
    if(!lemma){errors.push(`${where}: more words than the lemma list has`);return;}
    if(source.raw&&source.raw.w!==lemma.word)errors.push(`${where}: expected "${lemma.word}" (lemmas.tsv line ${lemma.line}), found "${source.raw.w}"`);
    else if(name&&name[1]!==lemma.level)errors.push(`${where}: "${lemma.word}" is ${lemma.level} but the file is ${name[1]}`);
    if(!result.errors.length)entries.push({word:lemma.word,level:lemma.level,pos:lemma.pos,record:expand(source.raw),raw:source.raw});
    else entries.push(null);
  });
  const good=entries.filter(Boolean);
  return {errors,warnings,entries:good,lemmas,authored:sources.length};
}

// balanced chunk sizes: 600 words are 2 x 300, not 500 + 100
function chunkSizes(count){
  const parts=Math.max(1,Math.ceil(count/Packs.CHUNK_WORDS)),base=Math.floor(count/parts),extra=count%parts;
  return Array.from({length:parts},(_,index)=>base+(index<extra?1:0));
}
// One word a line keeps changes readable in git and the file small.
const chunkText=chunk=>`{"format":${chunk.format},"id":${JSON.stringify(chunk.id)},"chunk":${JSON.stringify(chunk.chunk)},"level":${JSON.stringify(chunk.level)},"version":${chunk.version},"words":[\n${chunk.words.map(word=>JSON.stringify(word)).join(',\n')}\n]}\n`;
const orderText=order=>`{"format":${order.format},"id":${JSON.stringify(order.id)},"version":${order.version},"chunks":[\n${order.chunks.map(chunk=>JSON.stringify(chunk)).join(',\n')}\n]}\n`;

// The files of a course, from checked entries: [{name, text}]
function planCourse(pair,version,entries){
  const files=[],order={format:Packs.COURSE_FORMAT,id:pair,version,chunks:[]};
  for(const level of Packs.LEVELS){
    const words=entries.filter(entry=>entry.level===level);
    let at=0;
    chunkSizes(words.length).forEach((size,index)=>{
      if(!words.length)return;
      const id=Packs.chunkName(level,index+1),slice=words.slice(at,at+size);at+=size;
      files.push({name:`${id}.json`,text:chunkText({format:Packs.COURSE_FORMAT,id:pair,chunk:id,level,version,words:slice.map(entry=>entry.record)})});
      order.chunks.push({id,level,words:slice.map(entry=>entry.word)});
    });
  }
  files.push({name:'order.json',text:orderText(order)});
  return files;
}

function buildCourse(root,pair){
  const result=checkCourse(root,pair);
  if(result.errors.length)return {...result,written:0};
  if(!result.entries.length)return {...result,written:0,errors:[`${pair}: there are no words yet`]};
  const dir=path.join(root,'packs',pair),files=planCourse(pair,courseVersion(root,pair),result.entries);
  fs.mkdirSync(dir,{recursive:true});
  const keep=new Set(files.map(file=>file.name));
  for(const name of fs.readdirSync(dir))if(/\.json$/.test(name)&&!keep.has(name))fs.rmSync(path.join(dir,name));   // chunks of an earlier build that no longer exist
  for(const file of files)fs.writeFileSync(path.join(dir,file.name),file.text);
  const {problems,index}=Build.inspect(path.join(root,'packs'));
  if(problems.length)return {...result,written:files.length,errors:problems};
  fs.writeFileSync(path.join(root,'packs','index.json'),Build.serialize(index));
  return {...result,written:files.length};
}

function statsOf(root,pair){
  const result=checkCourse(root,pair),rows=[];
  for(const level of Packs.LEVELS){
    const planned=(result.lemmas||[]).filter(lemma=>lemma.level===level).length;
    const done=result.entries.filter(entry=>entry.level===level);
    if(!planned&&!done.length)continue;
    const share=test=>done.length?`${Math.round(100*done.filter(test).length/done.length)}%`:'-';
    const bytes=done.reduce((sum,entry)=>sum+Buffer.byteLength(JSON.stringify(entry.record)),0);
    rows.push({level,planned,written:done.length,synonyms:share(entry=>entry.record.synonyms),antonyms:share(entry=>entry.record.antonyms),phrases:share(entry=>entry.record.expressions),
      bytesPerWord:done.length?Math.round(bytes/done.length):0,kilobytes:Math.round(bytes/1024)});
  }
  return {rows,errors:result.errors,warnings:result.warnings};
}

function pairsIn(root,only){
  if(only)return [only];
  const dir=path.join(root,'wordbase');
  return fs.existsSync(dir)?fs.readdirSync(dir).filter(name=>Packs.pairOf(name)&&fs.statSync(path.join(dir,name)).isDirectory()).sort():[];
}

// A readable sample for a person to proofread: `count` words spread evenly over the written words of a level (or of all levels), as Markdown.
function sampleOf(root,pair,{level=null,count=50}={}){
  const result=checkCourse(root,pair),pool=result.entries.filter(entry=>!level||entry.level===level);
  const step=pool.length/Math.min(count,pool.length||1),chosen=Array.from({length:Math.min(count,pool.length)},(_,index)=>pool[Math.floor(index*step)]);
  const lines=[`# ${pair}: ${chosen.length} words to proofread (${level||'all levels'}, spread evenly over ${pool.length} written words)`,'',
    'For each card check: the meaning, the gender and kind, that the sentences are natural, that every respelling reads like the target language when read with the letters of the native language, and the translations.',''];
  chosen.forEach((entry,index)=>{
    const word=entry.record;
    lines.push(`## ${index+1}. ${word.word} (${word.type}) [${entry.level}]`,'',`- Anlam: ${word.meaning}`);
    if(word.synonyms)lines.push(`- Eş anlamlı: ${word.synonyms.join(', ')}`);
    if(word.antonyms)lines.push(`- Zıt anlamlı: ${word.antonyms.join(', ')}`);
    word.examples.forEach(example=>lines.push(`- ${example.text} — okunuş: *${example.phonetic}* — ${example.translation}`));
    for(const item of word.expressions||[])lines.push(`- Kalıp: **${item.text}** (*${item.phonetic}*) = ${item.translation}; ${item.exampleText} — *${item.examplePhonetic}* — ${item.exampleTranslation}`);
    lines.push('');
  });
  return lines.join('\n');
}

module.exports={expand,usesWord,lintWord,checkCourse,chunkSizes,planCourse,buildCourse,statsOf,sampleOf,readLemmas,fillRespellings,respellSources,TYPE_PATTERN,RESPELLING};

if(require.main===module){
  const [command,only,levelArg,countArg]=process.argv.slice(2),pairs=pairsIn(repoRoot,only);
  if(!['check','build','stats','sample','respell'].includes(command)){console.error('usage: node tools/wordbase.js check|build|stats [pair]   or   sample <pair> [level] [count]   or   respell <pair> [--overwrite]');process.exit(2);}
  if(!pairs.length){console.log('No course sources in wordbase/ yet.');process.exit(0);}
  let failed=false;
  if(command==='respell'){       // write the engine's respellings into the sources: the empty ones, or all with --overwrite
    if(!only){console.error('respell needs a pair: node tools/wordbase.js respell <pair> [--overwrite]');process.exit(2);}
    const result=respellSources(repoRoot,only,{overwrite:process.argv.includes('--overwrite')});
    if(result.error){console.error(result.error);process.exit(1);}
    console.log(`${only}: ${result.made} respellings written in ${result.files} files.`);
    process.exit(0);
  }
  for(const pair of pairs){
    if(command==='sample'){console.log(sampleOf(repoRoot,pair,{level:levelArg&&levelArg!=='all'?levelArg:null,count:+countArg||50}));continue;}
    if(command==='stats'){
      const {rows,errors}=statsOf(repoRoot,pair);
      console.log(`${pair}`);
      console.table(rows);
      if(errors.length){failed=true;console.error(`${errors.length} errors (run check)`);}
      continue;
    }
    const result=command==='check'?checkCourse(repoRoot,pair):buildCourse(repoRoot,pair);
    const shown=result.warnings.length?`${result.warnings.length} warnings`:'no warnings';
    for(const message of result.errors.slice(0,40))console.error(`ERROR ${message}`);
    if(result.errors.length>40)console.error(`... and ${result.errors.length-40} more errors`);
    for(const message of result.warnings.slice(0,15))console.log(`warning ${message}`);
    if(result.warnings.length>15)console.log(`... and ${result.warnings.length-15} more warnings`);
    console.log(`${pair}: ${result.entries.length} words written of ${result.lemmas?result.lemmas.length:'?'} in the lemma list; ${result.errors.length} errors, ${shown}.${command==='build'&&!result.errors.length?` ${result.written} files written.`:''}`);
    if(result.errors.length)failed=true;
  }
  if(failed)process.exit(1);
}
