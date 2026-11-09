# Yazım kuralları (İngilizce → Türkçe)

`STYLE.md` (Fransızca → Türkçe) ile aynı yapı geçerlidir: tam 2 örnek cümle, en çok 4 eş/zıt anlamlı (İngilizce kelimelerle), 0–2 kalıp, anlam Türkçe ve en çok 3 karşılık (`;` ile).
Bu belge yalnızca farkları yazar. Kaynak dosyalar: `wordbase/en-tr/src/A1-001.jsonl` …; kelime listesi: `wordbase/en/lemmas.tsv`.

## Kelime biçimi
- Fiil: yalın biçim (`go`, `wake up`). İsim: tekil. Sıfat: yalın biçim. Amerikan yazımı (`color`, `favorite`).
- İngilizcede dilbilgisel cinsiyet yok: isim etiketi sadece `isim` (`isim (eril)` kullanılmaz). Diğer etiketler `STYLE.md` listesiyle aynı:
  `isim` · `fiil` · `sıfat` · `zarf` · `edat` · `bağlaç` · `zamir` · `belirleyici` · `ünlem` · `sayı` · `kalıp`
- Lemma listesindeki tür kısaltmaları: n→isim, v→fiil, adj→sıfat, adv→zarf, prep→edat, pron→zamir, det→belirleyici, conj→bağlaç, num→sayı, interj→ünlem, loc→kalıp.
- Çekimli biçimler (kısa biçimler dahil: `I'm`, `don't`) cümlede görünebilir; kelime cümlede geçmelidir.

## Okunuş (Türkçe harflerle, kelime kelime)
Amerikan telaffuzu. `q`, `w`, `x` ve IPA simgeleri **yasak**; vurgu işaretlenmez. Kelimeler arası boşluk ve noktalama cümledeki gibi kalır; kısaltmalar duyulduğu gibi (`I'm` → `aym`).

| İngilizce ses | Türkçe harfler | Örnek |
|---|---|---|
| w | v | `water` → `votır`, `we` → `vi` |
| th (dil ucu, `thin`) | s | `thank` → `senk` |
| th (`this`) | z | `this` → `zis`, `the` → `zı` |
| sh | ş | `she` → `şi` |
| ch, tch | ç | `chair` → `çer` |
| j, dg, g (e önünde) | c | `job` → `cab` |
| y (ünsüz) | y | `yes` → `yes` |
| h | h | `home` → `hom` |
| r (ünlü önünde ve sonunda) | r | `red` → `red`, `car` → `kar` |
| ng | ng | `sing` → `sing` |
| c (a, o, u önünde), k, ck | k | `cat` → `ket` |
| c (e, i önünde) | s | `city` → `siti` |
| x | ks | `box` → `boks` |
| ee, ea, ie (uzun i) | i | `see` → `si`, `eat` → `it` |
| i (kısa) | i | `big` → `big` |
| a (`cat`) | e | `cat` → `ket`, `man` → `men` |
| a (`father`), o (`hot`) | a | `hot` → `hat`, `father` → `fazır` |
| o (uzun), ow (`go`) | o | `go` → `go`, `no` → `no` |
| oo (`food`), u (uzun) | u | `food` → `fud` |
| oo (`book`), u (`put`) | u | `book` → `buk` |
| u (`cup`), o (`love`) | a | `cup` → `kap`, `love` → `lav` |
| e (`bed`) | e | `bed` → `bed` |
| vurgusuz ünlü (schwa) | ı | `about` → `ıbaut`, `the` → `zı` |
| er, ir, ur (`bird`) | ör | `bird` → `börd`, `work` → `vörk` |
| ay, ai, eigh, i (uzun) | ay | `my` → `may`, `time` → `taym` |
| ow, ou (`now`) | au | `now` → `nau` |
| oy | oy | `boy` → `boy` |
| ou, a (`call`) | o | `call` → `kol` |
| sessiz harfler | yazıldığı gibi | `b d f g l m n p s t v z` |

Pilotta (ilk 150 kelime) ortaya çıkan eklemeler:

| Durum | Yazım | Örnek |
|---|---|---|
| uzun a (a_e, ai, ay) | ey | `name` → `neym`, `day` → `dey`, `rain` → `reyn` |
| kısa a, nazal ya da s/ss/sk önünde (ask, glass, pass, aunt) | e | `ask` → `esk`, `pass` → `pes`, `aunt` → `ent` |
| vurgusuz -er, -or, -ar sonu | ır | `water` → `votır`, `sister` → `sistır` |
| th (this) kelimelerde the, this, that, they, them, there, with, other, brother, father, together | z | `with` → `viz`, `brother` → `brazır` |
| o + g, f, s, th (dog, coffee, cost) | o | `dog` → `dog`, `coffee` → `kofi` |
| -tion, -sion | şın | `station` → `steyşın` |
| -ture | çır | `picture` → `pikçır` |
| sondaki vurgusuz -y, -ie | i | `happy` → `hepi`, `very` → `veri` |
| -ing | ing | `morning` → `morning`, `doing` → `duing` |
| q (qu) | kv | `question` → `kveşçın` |
| -ed | d / t / id (sese göre) | `arrived` → `ırayvd`, `passed` → `pest`, `wanted` → `vantid` |
| the | zı (ünsüz önünde), zi (ünlü önünde) | `the book` → `zı buk`, `the apple` → `zi epıl` |
| zayıf biçimler | sabit | `was` → `vaz`, `of` → `ıv`, `from` → `fram`, `to` → `tu` (cümle sonu) / `tı`, `are` → `ar`, `can` → `ken` |

Tabloyla çeliştiğinde tablo kazanır. Emin olamadığın okunuşta yaygın bir sözlüğün Amerikan okunuşuna yaklaş.

## Denetim
`node tools/wordbase.js check en-tr` yapıyı, Türkçe harf kuralını ve cümlede kelimenin geçişini denetler; anlamı, okunuşun doğruluğunu ve çevirinin doğallığını denetlemez. İlk 50 kelimeden örneklem (`sample en-tr A1 50`) okunur.

## A1 yazılırken eklenen kararlar
| Durum | Yazım | Örnek |
|---|---|---|
| -day (gün adları) | -dey | `Monday` → `mandey`, `Tuesday` → `tyuzdey`, `Wednesday` → `venzdey` |
| aylar | `cenyueri`, `februeri`, `març`, `eypril`, `mey`, `cun`, `culay`, `ogıst`, `septembır`, `oktobır`, `novembır`, `desembır` | |
| ünsüzden sonra uzun u (tu, du, nu, mu) | yu | `new` → `nyu`, `music` → `myuzik` |
| sondaki -le (vurgusuz) | -ıl | `apple` → `epıl`, `table` → `teybıl`, `bottle` → `batıl` |
| -able, -ible | -ıbıl | `terrible` → `terıbıl` |
| çoğul / 3. tekil -s | ses sonrası s; sesli ya da ötümlü ünsüzden sonra z | `books` → `buks`, `friends` → `frendz` |
| -es (s, sh, ch, x sonrası) | -ız | `washes` → `vaşız`, `classes` → `klesız` |
| wa-, wo- (watch, want, what, wash) | va- (o sesi a) | `want` → `vant`, `wash` → `vaş` |
| war-, wor-, wal- (warm, walk, water) | vor-, vok, votır | `warm` → `vorm`, `walk` → `vok` |
| -ow (window, yellow) | -o | `window` → `vindo` |
| ow (know), ew (new) | no, nyu | |
| qu | kv | `quiet` → `kvayıt` |
| a- (vurgusuz başta: another, about) | ı- | `another` → `ınazır` |

## Kesin kurallar (pilot sonrası)
- `to`: sonraki okunuş ünsüzle başlıyorsa `tı` (`tı skul`, `tı yu`), ünlüyle başlıyorsa ya da ifadenin sonundaysa `tu` (`tu ı park`, `ay vont tu`). `two` her zaman `tu`.
- `the`: ünsüzden önce `zı`, ünlüden önce `zi` (`zı buk`, `zi epıl`); `the` ifadenin sonunda ya da vurgulu olarak `zi`.
- `check` bu iki kuralı denetler; kaynak dosyalardaki bütün örnekler kurala göre düzeltildi.
