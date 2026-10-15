# Kelime veritabanı (wordbase)

Uygulamanın indirdiği A1–C2 kelime kurslarının **kaynakları** burada yazılır; uygulamanın okuduğu dosyalar `packs/` altına **üretilir**
(`node tools/wordbase.js build`). `packs/<çift>/` altındaki dosyalar elle düzenlenmez.

```
wordbase/
  STYLE.md                       yazım kuralları: seviye ölçütleri, tür etiketleri, okunuş tablosu
  fr/lemmas.tsv                  Fransızca kök kelime listesi: kelime ⇥ tür ⇥ seviye (öğrenme sırasıyla, satır başına bir kelime)
  fr-tr/course.json              {"version": N}  içerik değişince artırılır (cihazlar yeniden indirsin diye)
  fr-tr/src/A1-001.jsonl …       kelimeler: lemmas.tsv sırasıyla, satır başına bir JSON nesnesi, 50 kelime/dosya
```

## Komutlar

```
node tools/wordbase.js check [çift]   kaynakları denetler (yapı, içerik kuralları, lemmas.tsv ile örtüşme); hata varsa 1 döner
node tools/wordbase.js build [çift]   packs/<çift>/ altına parçaları ve order.json'ı yazar, packs/index.json'ı yeniler
node tools/wordbase.js stats [çift]   seviye başına kelime, eş/zıt anlam ve kalıp kapsamı, bayt
node tools/wordbase.js sample <çift> [seviye] [sayı]   gözden geçirmek için okunur bir örnek (Markdown): yazılmış kelimelere eşit aralıkla dağılmış N kart
npm run packs                         packs/ altındaki her şeyi doğrular ve index.json'ı yazar
```

## Kısa anahtarlı kaynak biçimi

Satır başına bir kelime (anahtar tekrarı belirteç yer, bu yüzden kısa):

```json
{"w":"bonjour","t":"ünlem","m":"merhaba; günaydın","s":[],"a":["au revoir"],"e":[["Bonjour, madame.","bonjur, madam","Günaydın, hanımefendi."],["Bonjour, comment allez-vous ?","bonjur, koman tale vu","Günaydın, nasılsınız?"]],"x":[["dire bonjour","dir bonjur","merhaba demek","Il dit bonjour à tout le monde.","il di bonjur a tu lö mond","Herkese merhaba der."]]}
```

| Anahtar | Anlam |
|---|---|
| `w` | kelime (köklü biçim: fiil mastar, sıfat eril tekil) |
| `t` | tür etiketi (Türkçe, `STYLE.md`'deki listeden) |
| `m` | Türkçe anlam |
| `s`, `a` | eş ve zıt anlamlılar (Fransızca, en çok 4; yoksa boş dizi ya da hiç yazılmaz) |
| `e` | **tam 2** örnek: `[cümle, Türkçe harflerle okunuş, Türkçe çeviri]` |
| `x` | 0–2 deyim/kalıp: `[kalıp, okunuşu, anlamı, onu kullanan cümle, cümlenin okunuşu, cümlenin çevirisi]` |

`check` hata verir: bilinmeyen anahtar, 2 örnek olmaması, eksik okunuş/çeviri, okunuşta Türkçe harf dışı karakter (IPA, `q w x`), kalıpta cümle eksikliği,
eş/zıt anlamda kelimenin kendisi ya da tekrar, `lemmas.tsv` sırasından sapma, dosya adındaki seviyenin kelimenin seviyesiyle uyuşmaması.
Uyarı verir (derlemeyi durdurmaz): tür etiketi listede yok, örnek cümlede kelime (ya da çekimi) görünmüyor, uzun anlam/cümle.

## Sürüm ve dağıtım

1. Kaynakları yaz → `node tools/wordbase.js check` temiz.
2. İçerik yayımlanacaksa `course.json`'daki `version`'ı artır.
3. `node tools/wordbase.js build` → `packs/fr-tr/*.json`, `order.json`, `index.json`.
4. Uygulama sürümünü artır (sw.js, `<meta name="vocvoc-shell">`, BUILD_INFO.json), `npm run lock-shell`, `npm run checksums`, testler.

Parçalar `packs/fr-tr/A1-01.json` gibi adlanır, her biri ~500 kelime (seviye kelimeleri eşit bölünür: 600 kelime = 2 × 300).
`order.json` kursun tüm kelimelerini sırayla listeler; uygulama ilerlemeyi ve sıradaki parçayı bundan bulur, parçaları gerektikçe indirir.

## Kelime listesi nereden geldi

`wordbase/fr/lemmas.tsv` (A1–B2: 5.226 köklü kelime) bir **aday havuzundan** seçildi: Hermit Dave'in *FrequencyWords* projesindeki OpenSubtitles tabanlı
Fransızca sıklık listesi (`fr_50k`, içerik **CC BY-SA 4.0**, kod MIT; https://github.com/hermitdave/FrequencyWords). Ham liste depoya **eklenmedi**.
Havuzdaki çekimli biçimler köke indirildi; özel isimler, İngilizce sızıntılar, argo/küfür ve kısaltmalar çıkarıldı; her kelimenin türü ve **A1–C2 seviyesi**
(ve seviye içindeki sırası) elle atandı. A1/A2 için altyazı dilinin yanlı bıraktığı gündelik konular (sayılar, aylar, giyim, yiyecek, ev, kalıplar) tematik olarak eklendi.
Seviyeler **yaklaşık**tır; resmî bir sınav listesiyle (DELF, Oxford, Cambridge…) birebir örtüşmez ve onlardan kopyalanmamıştır.
Yayınlanan içeriğin Hakkında sayfasında bu kaynağa atıf verilmelidir (kurs içeriği uygulamada yayımlanırken eklenir).

C1 ve C2 listeleri henüz yazılmadı; o seviyeler yazılmadan önce aynı yöntemle çıkarılır (`lemmas.tsv`'ye eklenir, `check` sıra ve tekrar kurallarını denetler).
