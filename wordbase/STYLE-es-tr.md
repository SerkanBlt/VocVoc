# Yazım kuralları (İspanyolca → Türkçe)

`STYLE.md` (Fransızca → Türkçe) ile aynı yapı geçerlidir: tam 2 örnek cümle, en çok 4 eş/zıt anlamlı (İspanyolca kelimelerle), 0–2 kalıp, anlam Türkçe ve en çok 3 karşılık (`;` ile).
Bu belge yalnızca farkları yazar. Kaynak dosyalar: `wordbase/es-tr/src/A1-001.jsonl` …; kelime listesi: `wordbase/es/lemmas.tsv`.

## Kelime biçimi
- Fiil: mastar (`hablar`; sadece özü yansıma olanlarda `-se`: `llamarse`). İsim: tekil. Sıfat: eril tekil (dişil biçimi örnek cümlede görünür).
- Tür etiketi Türkçe: `isim (eril)` · `isim (dişil)` · `isim (eril/dişil)` · `fiil` · `sıfat` · `zarf` · `edat` · `bağlaç` · `zamir` · `belirleyici` · `ünlem` · `sayı` · `kalıp`.
- Lemma listesi kısaltmaları: nm, nmpl→isim (eril), nf, nfpl→isim (dişil), v→fiil, adj→sıfat, adv→zarf, prep→edat, pron→zamir, det→belirleyici, conj→bağlaç, num→sayı, interj→ünlem, loc→kalıp.
- Ünlem işaretleri (¿ ¡) cümlede yazılır; okunuşta yazılmaz (yalnızca `?` ve `!`).

## Okunuş (Türkçe harflerle, kelime kelime)
Amerika İspanyolcası (seseo: `c`, `z` → s). `q`, `w`, `x` ve IPA simgeleri **yasak**; vurgu işaretlenmez. Kelimeler arası boşluk ve noktalama cümledeki gibi kalır; hepsi küçük harf.

| İspanyolca | Türkçe harfler | Örnek |
|---|---|---|
| a, e, i, o, u | a, e, i, o, u | `casa` → `kasa`, `mesa` → `mesa` |
| á, é, í, ó, ú | aynı ünlü (vurgu yazılmaz) | `café` → `kafe` |
| ie, ia, io, iu | ye, ya, yo, yu | `bien` → `byen`, `gracias` → `grasyas` |
| ue, ua, ui, uo | ue, ua, ui, uo (ayrı yazılır) | `bueno` → `bueno`, `agua` → `agua` |
| ei, ai, oi, au, eu | ey, ay, oy, au, eu | `aire` → `ayre`, `hoy` → `oy` |
| b, v | b | `vino` → `bino`, `bueno` → `bueno` |
| c (a, o, u önünde), k, qu | k | `casa` → `kasa`, `que` → `ke`, `quien` → `kyen` |
| c (e, i önünde), z | s | `cena` → `sena`, `luz` → `lus` |
| ch | ç | `mucho` → `muço` |
| d | d (ünlüler arasında ve sonda yumuşak: d) | `todo` → `todo` |
| g (e, i önünde), j | h | `gente` → `hente`, `jugar` → `hugar` |
| g (a, o, u önünde), gu (e, i önünde) | g | `gato` → `gato`, `guerra` → `gera` |
| gü | gu | `pingüino` → `pinguino` |
| h | yazılmaz | `hola` → `ola`, `hombre` → `ombre` |
| ll, y (ünsüz) | y | `llamar` → `yamar`, `yo` → `yo` |
| ñ | ny | `año` → `anyo`, `español` → `espanyol` |
| r, rr | r (kuvvetli rr de tek r) | `perro` → `pero`, `rojo` → `roho` |
| s | s | `casa` → `kasa` |
| x | ks | `examen` → `eksamen` |

Tabloyla çeliştiğinde tablo kazanır. Emin olamadığın okunuşta yaygın bir sözlüğün okunuşuna yaklaş.

## Denetim
`node tools/wordbase.js check es-tr` yapıyı, Türkçe harf kuralını ve cümlede kelimenin geçişini denetler; anlamı, cinsiyeti, okunuşun doğruluğunu ve çevirinin doğallığını denetlemez. `sample es-tr A1 50` ile örneklem okunur.

## Pilotta (ilk 150 kelime) alınan kararlar
Bu kararlar pilot ajanın önerisinden derlendi; bir İspanyolcayı bilen kişi gözden geçirmedi.
- **Vurgulu í, ú ayrı ünlüdür** (hiatus), `y` almaz: `día` → `dia`, `tío` → `tio`, `todavía` → `todabia`. Diftong ise y alır: `salió` → `salyo`, `también` → `tambyen`, `adiós` → `adyos`. Yanlış okunabilecek yerde tire kullan: `ahí` → `a-i`, `país` → `pa-is`.
- **Bağlaç `y`** → `i`; sondaki `y` → `oy` (`hoy`), `mui` (`muy`), `soy` (`soy`).
- **x → h** `México`, `Texas`, `Oaxaca`'da; **h her yerde yazılmaz** (`ahora` → `aora`).
- **gu + a, o** → `gua`, `guo` (`agua` → `agua`); **ci + ünlü**: `dieciocho` → `dyesyoço`.
- `ll`, `y` ünsüz → `y`; `ee` → `ee` (`leer` → `leer`).
