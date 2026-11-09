# Yazım kuralları (Almanca → Türkçe)

`STYLE.md` (Fransızca → Türkçe) ile aynı yapı geçerlidir: tam 2 örnek cümle, en çok 4 eş/zıt anlamlı (Almanca kelimelerle), 0–2 kalıp, anlam Türkçe ve en çok 3 karşılık (`;` ile).
Bu belge yalnızca farkları yazar. Kaynak dosyalar: `wordbase/de-tr/src/A1-001.jsonl` …; kelime listesi: `wordbase/de/lemmas.tsv`.

## Kelime biçimi
- Fiil: mastar (`gehen`, ayrılabilir fiiller tek parça: `anfangen`). İsim: tekil, **büyük harfle** (`Haus`), artikelsiz kelime olarak (`w`), cinsiyet tür etiketinde. Sıfat: yalın biçim.
- Tür etiketi Türkçe: `isim (eril)` (der) · `isim (dişil)` (die) · `isim (nötr)` (das) · `fiil` · `sıfat` · `zarf` · `edat` · `bağlaç` · `zamir` · `belirleyici` · `ünlem` · `sayı` · `kalıp`.
- Lemma listesi kısaltmaları: nm→isim (eril), nf→isim (dişil), nn→isim (nötr), npl→`isim` (yalın), v→fiil, adj→sıfat, adv→zarf, prep→edat, pron→zamir, det→belirleyici, conj→bağlaç, num→sayı, interj→ünlem, loc→kalıp.
- İsimlerde çoğul biçimi bir örnek cümlede göster (`die Häuser`); hâl çekimleri cümlede serbesttir.

## Okunuş (Türkçe harflerle, kelime kelime)
Standart Almanca (Hochdeutsch). `q`, `w`, `x` ve IPA simgeleri **yasak**; vurgu işaretlenmez. Kelimeler arası boşluk ve noktalama cümledeki gibi kalır; cümle içinde büyük/küçük harf yok (hepsi küçük).

| Almanca | Türkçe harfler | Örnek |
|---|---|---|
| a, ah, aa | a | `Hand` → `hant`, `Jahr` → `yar` |
| e (vurgulu), eh, ee | e | `Weg` → `vek`, `See` → `ze` |
| e (vurgusuz, sonda), -en, -el | ı | `Name` → `namı`, `machen` → `mahın`, `Vogel` → `fogıl` |
| -er (vurgusuz sonda) | ır | `Vater` → `fatır`, `aber` → `abır` |
| ä, äh | e | `Mädchen` → `metçın` |
| i (kısa) | i | `bin` → `bin` |
| ie, ih | i | `Liebe` → `libı`, `Tier` → `tir` |
| o | o | `Hose` → `hozı`, `Ort` → `ort` |
| ö | ö | `schön` → `şön` |
| u (kısa/uzun) | u | `gut` → `gut` |
| ü, y | ü | `für` → `für` |
| ei, ai | ay | `mein` → `mayn`, `Mai` → `may` |
| eu, äu | oy | `heute` → `hoytı`, `Häuser` → `hoyzır` |
| au | au | `Haus` → `haus` |
| b, d, g sonda ya da ünsüzden önce | p, t, k | `Hund` → `hunt`, `Tag` → `tak`, `ab` → `ap` |
| s + ünlü | z | `Sonne` → `zonı` |
| s sonda, ss, ß | s | `Haus` → `haus`, `Straße` → `ştrasi` |
| sch | ş | `schön` → `şön` |
| st, sp kelime başında | şt, şp | `Stadt` → `ştat`, `Sport` → `şport` |
| ch (a, o, u, au sonrası) | h | `Buch` → `buh`, `nach` → `nah` |
| ch (diğer), -ig | h | `ich` → `ih`, `richtig` → `rihtih` |
| chs | ks | `sechs` → `zeks` |
| j | y | `ja` → `ya` |
| v | f | `viel` → `fil` |
| w | v | `wir` → `vir` |
| z, tz | ts | `Zeit` → `tsayt`, `Platz` → `plats` |
| pf | pf | `Apfel` → `apfıl` |
| qu | kv | `Qualität` → `kvalitet` |
| x | ks | `Taxi` → `taksi` |
| ck | k | `Stück` → `ştük` |
| ph | f | `Foto` → `foto` |
| tion | tsyon | `Nation` → `natsyon` |
| r | r (sonda -er → ır) | `rot` → `rot` |
| h (ünlüden sonra) | yazılmaz | `gehen` → `gen`, `Uhr` → `ur` |

**Ünlüden sonraki `h` yazılmaz** (uzunluk işareti): `gehen` → `gen`, `sehen` → `zen`, `Uhr` → `ur`. Tabloyla çeliştiğinde tablo kazanır. Emin olamadığın okunuşta yaygın bir sözlüğün okunuşuna yaklaş.

## Denetim
`node tools/wordbase.js check de-tr` yapıyı, Türkçe harf kuralını ve cümlede kelimenin geçişini denetler; anlamı, cinsiyeti, okunuşun doğruluğunu ve çevirinin doğallığını denetlemez. `sample de-tr A1 50` ile örneklem okunur.

## Pilotta (ilk 150 kelime) alınan kararlar
Bu kararlar pilot ajanın önerisinden derlendi; bir Almancayı bilen kişi gözden geçirmedi.
- **Sessiz h + ek:** ünlüden sonraki `h` yazılmaz, `-en` bu durumda `n` olur: `gehen` → `gen`, `sehen` → `zen`, `stehen` → `ştehen` değil `şten`. Sonda `-he` → `-` (ünlü): `gehe` → `ge`, `Nähe` → `ne`.
- **tsch** → `ç` (`Deutsch` → `doyç`, `tschüss` → `çüs`); sondaki `-sch` → `ş` (`Englisch` → `engliş`).
- **Vurgusuz önekler:** `ge-` → `gı-`, `be-` → `bı-`, `ver-` → `fer-`, `er-` → `er-`, `zer-` → `tser-`, `ent-` → `ent-` (`bekommen` → `bıkomın`).
- **-ig, -lich, ch ünsüzden sonra:** `-ig` → `ih`, `-lich` → `lih`, `ch` ünsüz ve e, i sonrası → `h` (`fertig` → `fertih`, `welcher` → `velhır`, `manchmal` → `manhmal`).
- **Sondaki ötümlüleşme:** b, d, g hece sonunda (ünsüz ekten önce de) p, t, k olur: `gibt` → `gipt`, `liegt` → `likt`, `Tag` → `tak`. `-ßt` → `st`.
- **Çift ünsüz** tek yazılır (`Mutter` → `mutır`, `Kaffee` → `kafe`, `Hallo` → `halo`).
- **ie + ünlü** → `yı` (`Familie` → `familyı`, `Italien` → `italyın`); sondaki `-ie` yabancı sözcükte `i` (`Idee` → `ide`). Yabancı `y` → `i` (`Handy` → `hendi`).
- **ng, nk** yazıldığı gibi (`Wohnung` → `vonung`, `Bank` → `bank`; `ng` sondaki ötümlüleşmeye girmez). Sonda `-ei` → `ay` (`Türkei` → `türkay`).
- Kısa e, ä ve ö, ü uzunlukları ayırt edilmez (`Bett` → `bet`, `schläft` → `şleft`).
