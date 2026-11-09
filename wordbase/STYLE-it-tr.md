# Yazım kuralları (İtalyanca → Türkçe)

`STYLE.md` (Fransızca → Türkçe) ile aynı yapı geçerlidir: tam 2 örnek cümle, en çok 4 eş/zıt anlamlı (İtalyanca kelimelerle), 0–2 kalıp, anlam Türkçe ve en çok 3 karşılık (`;` ile).
Bu belge yalnızca farkları yazar. Kaynak dosyalar: `wordbase/it-tr/src/A1-001.jsonl` …; kelime listesi: `wordbase/it/lemmas.tsv`.

## Kelime biçimi
- Fiil: mastar (`parlare`; sadece özü yansıma olanlarda `-si`: `chiamarsi`). İsim: tekil. Sıfat: eril tekil (dişil biçimi örnek cümlede görünür).
- Tür etiketi Türkçe: `isim (eril)` · `isim (dişil)` · `isim (eril/dişil)` · `fiil` · `sıfat` · `zarf` · `edat` · `bağlaç` · `zamir` · `belirleyici` · `ünlem` · `sayı` · `kalıp`.
- Lemma listesi kısaltmaları: nm, nmpl→isim (eril), nf, nfpl→isim (dişil), v→fiil, adj→sıfat, adv→zarf, prep→edat, pron→zamir, det→belirleyici, conj→bağlaç, num→sayı, interj→ünlem, loc→kalıp.

## Okunuş (Türkçe harflerle, kelime kelime)
Standart İtalyanca. `q`, `w`, `x` ve IPA simgeleri **yasak**; vurgu işaretlenmez. Çift ünsüzler çift yazılır (italyancada uzun okunur). Kelimeler arası boşluk ve noktalama cümledeki gibi kalır; hepsi küçük harf.

| İtalyanca | Türkçe harfler | Örnek |
|---|---|---|
| a, e, i, o, u | a, e, i, o, u | `pane` → `pane`, `uno` → `uno` |
| à, è, é, ì, ò, ó, ù | aynı ünlü | `città` → `çitta`, `perché` → `perke` |
| c (e, i önünde) | ç | `cena` → `çena`, `ciao` → `çao` |
| cc (e, i önünde) | tç | `faccia` → `fatça`, `braccio` → `bratço` |
| c (a, o, u önünde), ch, k | k | `cane` → `kane`, `che` → `ke`, `chi` → `ki` |
| g (e, i önünde) | c | `gelato` → `celato`, `giorno` → `corno` |
| g (a, o, u önünde), gh | g | `gatto` → `gatto`, `ghiaccio` → `gyatço` |
| gli | ly | `figlio` → `filyo`, `famiglia` → `familya` |
| gn | ny | `bagno` → `banyo` |
| sc (e, i önünde) | ş | `scena` → `şena`, `pesce` → `peşe` |
| sch | sk | `scuola` → `skuola`, `schiena` → `skyena` |
| s (ünlüler arası) | z | `casa` → `kaza`, `rosa` → `roza` |
| s (diğer), ss | s | `sole` → `sole`, `basso` → `basso` |
| z, zz | ts, tts (bazen dz) | `grazie` → `gratsye`, `pizza` → `pittsa` |
| qu | kv | `quando` → `kvando`, `questo` → `kvesto` |
| ia, ie, io, iu (hece içi) | ya, ye, yo, yu | `bianco` → `byanko`, `più` → `pyu` |
| h | yazılmaz | `ho` → `o`, `hanno` → `anno` |
| gl, gn dışındaki çiftler | çift yazılır | `mamma` → `mamma`, `bello` → `bello` |
| x | ks | `taxi` → `taksi` |

Tabloyla çeliştiğinde tablo kazanır. Emin olamadığın okunuşta yaygın bir sözlüğün okunuşuna yaklaş.

## Denetim
`node tools/wordbase.js check it-tr` yapıyı, Türkçe harf kuralını ve cümlede kelimenin geçişini denetler; anlamı, cinsiyeti, okunuşun doğruluğunu ve çevirinin doğallığını denetlemez. `sample it-tr A1 50` ile örneklem okunur.

## Pilotta (ilk 150 kelime) alınan kararlar
Bu kararlar pilot ajanın önerisinden derlendi; bir İtalyancayı bilen kişi gözden geçirmedi.
- **ci, gi + ünlü**: `i` yazılmaz, ünsüz kalır: `ciao` → `çao`, `giorno` → `corno`, `mangiare` → `mancare`, `già` → `ca`; `sci + ünlü` → `ş + ünlü` (`sciare` → `şare`). `gg` + e, i → `cc` (`oggi` → `occi`), `cci` → `tç` (`faccia` → `fatça`).
- **z**: varsayılan `ts` / `tts`; `dz` yalnızca `zero`, `zona`, `zucchero`, `zaino`, `zebra`'da (`dzero`).
- **s** iki ünlü arasında `z`; bileşik sözcüklerin sınırında `s` (`buonasera` → `buonasera`, `girasole`).
- **gli** (artikel dahil) → `lyi`; `gu + ünlü` → `gu` (`guarda` → `guarda`); `uo` → `uo`; sondaki `-ai, -ei, -oi, -ui` → `ay, ey, oy, ui`.
- **Kesme işareti** yazılmaz, kelimeler kaynaşır (`l'aiuto` → `layuto`); proklitikler sonraki sözcükle bir yazılır.
