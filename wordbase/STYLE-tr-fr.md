# Règles d'écriture (turc → français)

Le même cadre que `STYLE.md` s'applique : exactement 2 phrases d'exemple, au plus 4 synonymes/antonymes (en turc), 0 à 2 expressions, sens en **français** (au plus 3 équivalents séparés par `;`).
Ce document ne note que les différences. Sources : `wordbase/tr-fr/src/A1-001.jsonl` … ; liste de mots : `wordbase/tr/lemmas.tsv`.

## Forme du mot
- Verbe : infinitif en `-mek/-mak` (`gelmek`). Nom : forme nue. Adjectif : forme de base. Lettres turques correctes (ı İ ş ğ ç ö ü).
- Le turc n'a pas de genre : le nom est simplement `nom`. Étiquettes **françaises**, dans cette liste (plusieurs : `adjectif/adverbe`) :
  `nom` · `verbe` · `adjectif` · `adverbe` · `postposition` · `conjonction` · `pronom` · `déterminant` · `interjection` · `numéral` · `locution`
- Abréviations de `lemmas.tsv` : n→nom, v→verbe, adj→adjectif, adv→adverbe, postp→postposition, pron→pronom, det→déterminant, conj→conjonction, num→numéral, interj→interjection, loc→locution.
- Le mot doit apparaître dans la phrase (fléchi ou avec un suffixe, c'est normal en turc).
- Le sens est court et en français ; les parenthèses seulement si nécessaire.

## Transcription (lettres françaises, mot par mot)
Écris comment le turc **s'entend**, avec des lettres françaises, **mot à mot** (pas syllabe par syllabe). Espaces et ponctuation comme dans la phrase.
Interdits : `q`, `w`, `x` et les symboles API. Pas d'accent tonique. Écris les mots tels qu'ils sont prononcés dans la phrase (ex. `geliyorum` → `guéliyorom`).

| Turc | Lettres françaises | Exemple |
|---|---|---|
| a | a | `ana` → `ana` |
| e | é (è devant r, l, m, n finaux) | `ev` → `év`, `el` → `èl` |
| ı | î (voyelle sourde, entre « i » et « e muet ») | `kız` → `kîz` |
| i | i | `iki` → `iki` |
| o | o | `ocak` → `odjak` |
| ö | eu | `göz` → `gueuz`, `öğle` → `eulé` |
| u | ou | `su` → `sou`, `okul` → `okoul` |
| ü | u | `gün` → `gune`, `üç` → `utch` |
| c | dj | `can` → `djan` |
| ç | tch | `çay` → `tchay` |
| ş | ch | `şu` → `chou` |
| j | j | `jandarma` → `jandarma` |
| g (a, o, u, ı devant) | g | `gül` → `gul` |
| g (e, i, ö, ü devant) | gu | `gel` → `guèl`, `göz` → `gueuz` |
| ğ | (allonge la voyelle, ou rien) | `dağ` → `da`, `değil` → `déil` |
| k (a, o, u, ı devant) | k | `kalem` → `kalèm` |
| k (e, i, ö, ü devant) | k (ou `ky`) | `kedi` → `kédi` |
| h | h (toujours prononcé) | `hava` → `hava` |
| y | y | `yok` → `yok` |
| s | s (toujours /s/, même entre voyelles) | `masa` → `masa` |
| z, v, l, m, n, p, r, t, d, b, f | idem | |
| n devant g/k (nasal) | n | `bunga` → `bounga` |

« u » seul n'est jamais `ou` : `ü` est `u`, `u` est `ou`. Donc `geliyorum` → `guéliyoroum` (le `u` de `-um` est `ou`). En cas de doute, le tableau l'emporte.

Règles précisées pendant le pilote :
- **é / è** : `è` quand la syllabe se ferme sur r, l, m, n, s, ş… (`gel` → `guèl`, `ders` → `dèrs`, `ben` → `bèn`) ; `é` en syllabe ouverte (`veri` → `véri`, `ne` → `né`, `ahmet` → `ahmét`, `-mek` → `-mék`).
- **n final** : une voyelle suivie d'un `n` en fin de mot se lirait comme une voyelle nasale en français : on écrit `-ne` (`kan` → `kane`, `bin` → `bine`, `nasılsın` → `nasîlsîne`, `gün` → `gune`). Devant une consonne on écrit `n` simplement (`binmek` → `binmék`) ; la lecture nasale éventuelle est acceptée.
- **ğ** : rien après une voyelle (`dağ` → `da`, `değil` → `déil`) ; entre deux voyelles identiques on double la voyelle (`mağaza` → `maaza`) ; sinon on ne l'écrit pas (`oğlum` → `oloum`, `öğle` → `eulé`).
- **gü, kü** : `gü` → `gu`, `kü` → `ku` ; `gö` → `gueu`, `ge` → `gué`, `gi` → `gui` (le `g` reste dur).
- **a + i** (hiatus, `aile`) : `ayilé` ; `ay` reste `ay`.
- **ş + ç / c** : on garde chaque lettre (`hoşça` → `hochtcha`, `çalışmak` → `tchalîchmak`).
- Accents autorisés : seulement `é`, `è`, `î` (pas de `ê`, `ô`).
- Les suffixes après une apostrophe (`Ahmet'e`) sont transcrits comme un seul mot sans apostrophe (`ahmété`).
- Étiquettes combinées autorisées : tout couple de la liste (`verbe/nom`, `interjection/nom`) ; la particule interrogative `mi` est étiquetée `conjonction`.

## Contrôle
`node tools/wordbase.js check tr-fr` vérifie la structure, les lettres autorisées et la présence du mot dans la phrase ; il ne juge ni le sens, ni l'exactitude de la transcription, ni le naturel de la traduction. Un échantillon (`sample tr-fr A1 50`) doit être relu par quelqu'un qui connaît le turc.

## Décisions prises pendant A1
- `ğ` entre deux voyelles différentes : les voyelles se suivent (`mesleği` → `mèsléi`, `oyuncağı` → `oyoundjaî`) ; entre deux voyelles identiques : une seule voyelle doublée (`düğün` → `duune`, `yemeğe` → `yéméé`) ; devant une consonne : rien (`ağrı` → `arî`, `doğru` → `dorou`, `yağmur` → `yamour`).
- `â` : `kâ`, `gâ`, `lâ` → `kya`, `gya`, `lya` (`hikâye` → `hikyayé`, `rüzgâr` → `ruzguiar`).
- Le `-ne` final s'applique à chaque mot (même devant un autre mot) : `kalîne`, `itchine`, `lutfène`.
- Les noms de mois : `ocak` → `odjak`, `şubat` → `choubat`, `mart` → `mart`, `nisan` → `nisane`, `mayıs` → `mayîs`, `haziran` → `haziranne`, `temmuz` → `témmouz`, `ağustos` → `aoustos`, `eylül` → `èylul`, `ekim` → `ékim`, `kasım` → `kasîm`, `aralık` → `aralîk`.
- Avant `v`, `y`, `ş`, `ç`, `k` en syllabe fermée : `è` (`èyvah`, `tèkrar`, `béch` reste `béch`). Ces cas restent à relire par un locuteur natif.

## Règles uniformes (après relecture du pilote)
- **n final** : toute voyelle + `n` en fin de mot s'écrit `-ne`, sans exception : mots turcs, suffixes (`-dan`, `-nın`, `-in`, `-ken`), mots d'emprunt (`plane`, `télèfone`, `romane`) et le pronom `ben` → `bène`. L'outil `check` signale chaque mot qui ne suit pas la règle.
- **ğ** (toujours à relire par un locuteur natif) : voir plus haut ; les doubles voyelles obtenues (`aa`, `ou+ou`) sont acceptées telles quelles tant que la règle n'est pas révisée.
