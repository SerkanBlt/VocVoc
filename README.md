# VocVoc PWA v1.0

Bu paket frozen `vocvoc_spa_v1_0_candidate.html` kaynağından oluşturuldu. Orijinal dosya değiştirilmedi. Aşama 3 özellikleri yoktur.

## Yayınlama / kurulum

`VocVoc/` içeriğini aynı HTTPS adresindeki bir klasöre yayınlayın. `index.html`, `storage.js`, `a11y.js`, `pwa.js`, `sw.js`, manifest ve `icons/` birlikte yayınlanmalıdır. Framework, build veya uygulama backend'i gerekmez. Service Worker için `sw.js` dosyasını `text/javascript` olarak sunun; güncelleme kontrolünü engelleyen uzun HTTP cache süresi vermeyin. Manifest için `application/manifest+json` önerilir. Site başka route'lara ait istekleri index.html'e yönlendiriyorsa gerçek `sw.js`/manifest/icon dosyalarını istisna tutun.

Yerel test: `python3 -m http.server 8000 --directory VocVoc`, ardından `http://localhost:8000/`. ZIP'i açıp `index.html` dosyasına çift tıklamak PWA kurmaz; `file://` Service Worker çalıştırmaz. İlk online açılışta Service Worker'ın kurulmasını bekleyin. Chrome/Chromium menüsünden uygulamayı yükleyin; iOS'ta Safari → Paylaş → Ana Ekrana Ekle. Gerçek cihazın kurulum ve safe-area kontrolünü yayınlanan HTTPS adresinde yapın.

## Storage / migration

`UI → VocVocData → IndexedDBAdapter → IndexedDB`.

IndexedDB adı `VOCVOC_PWA`, database version `1`. `state` store'unda `schema-v1` anahtarı Schema v1'in tamamını tutar: meta, settings, words, aliases, progress, dailyUsage. Bu snapshot yapısı mevcut Data API'nin atomik işlemlerini korur; History/Memorized/Archive ayrı veritabanları değildir. `control` store'unda revision, migration marker ve import öncesi kurtarma kopyası bulunur. Object store version ile uygulama schemaVersion birbirinden ayrıdır.

Bootstrap önce DB'yi açar, migration yapar ve doğrular, ardından cache hazır olur ve tek ana render yapılır. Okumalar memory cache üzerinden senkrondur. Değişiklik API'leri Promise döndürür; tek merkezi kuyruk draft oluşturur, transaction `complete` sonrasında committed cache'i yayınlar. Abort/quota hatasında eski committed cache korunur. UI doğrudan IndexedDB kullanmaz. Yeni async mutasyonlar çağrıldığında `await` edilmelidir.

İlk açılışta aynı origin'deki `VOCVOC_DB_V1` validate edilir. Yoksa mevcut eski SPA migration mantığı legacy listeleri dönüştürür. Veri ve `copied` marker tek transaction'da yazılır; durable readback doğrulanınca marker `complete` olur. Kapanma/crash sonrasında tamamlanmamış aktarım doğrulanarak devam eder; word ID'ler korunur, duplicate oluşturulmaz. `VOCVOC_DB_V1`, legacy kaynaklar ve `VOCVOC_MIGRATION_BACKUP_V1` silinmez. Arayüz dili ayrı bir ayardır (`settings.appLanguage`, isteğe bağlı alan; şema sürümü 1 kalır). Kaydı olmayan veride eskisi gibi orijinal dili izler, bu yüzden arayüz dilini değiştirmek kelimeleri silmez. Başarılı migration sonrasında IndexedDB authoritative'dir; localStorage'a geri yazılmaz. Bu nedenle PWA sonrasında eski SPA kopyasını düzenlemeye devam etmek iki bağımsız veri oluşturur.

Başka sekmedeki değişiklik revision kontrolüyle eski snapshot'ın üzerine yazılamaz; kullanıcıya yenileme bildirilir. Bu local sekme güvenliğidir, cloud sync değildir.

### Farklı origin'e geçiş

Tarayıcı güvenliği nedeniyle dosya/content URL'sindeki veya başka domain/protokoldeki SPA verisi yeni HTTPS origin'inden okunamaz. Otomatik migration yalnızca **aynı origin** için geçerlidir. Eski uygulamanın tarayıcı konsolunda `tools/export-from-spa.js` içeriğini çalıştırın; indirilen JSON'u yeni PWA'da Ayarlar → Veri yedeği → Yedeği geri yükle ile aktarın. Mobilde gerekirse tarayıcının remote debugging konsolunu kullanın. Eski verileri silmeyin. API key bu aktarımda yoktur; yeni origin'de yeniden girilmelidir.

## Yedekleme / kurtarma

Ayarlar gövdesindeki tek açılır JSON yedeği bölümünde export/import bulunur. Export schemaVersion, exportVersion, exportedAt, meta, settings, words, aliases, progress ve dailyUsage taşır. Secret storage dahil edilmez.

Import bir **restore/overwrite** işlemidir, merge değildir. Dosya boyutu (en fazla ~10 MB, gerçek dosya boyutuna göre)/JSON sözdizimi/version/schema/ID/referans/status/alan tipi kontrolü (hepsi `VocVocStorage.parseBackup` tek giriş noktasında) ve açık confirmation sonrası tek transaction çalışır. Önceki veri aynı transaction içinde `before-import` kurtarma kopyasına alınır. `↶ JSON` düğmesi bu önceki kopyayı dışa aktarır; geri dönmek için bu dosyayı import edin. Başarısız işlemde mevcut veri korunur. Son başarılı import'un önceki kopyası tutulur; sınırsız yedek geçmişi değildir. **İlerlemeyi sıfırla**, **öğrenilen/orijinal dil değişikliği** ve birden fazla kelimeyi silen **toplu arşiv silme** de veri sildiği için aynı kurtarma kopyasını (`before-import`) önceden alır; bu durumda da `↶ JSON` ile dışa aktarıp import edebilirsiniz. Veritabanı zaten boşsa kopya alınmaz, böylece ikinci bir sıfırlama önceki kopyanın üzerine yazmaz. Uygulama ilk kullanıcı etkileşiminde `navigator.storage.persist()` ile kalıcı depolama ister; tarayıcı vermezse (özellikle iOS Safari'de ana ekrana eklenmemiş sitelerde) Ayarlar → Veri yedeği bölümünde uyarı gösterilir. Düzenli export alın: tarayıcı verilerini silmek, origin değiştirmek veya storage eviction yerel veriyi kaybettirebilir; cloud backup yoktur.

Kapanan IndexedDB bağlantısı bir sonraki işlemde otomatik yeniden açılır; depo dışarıdan silinmişse eski revision ile yazma `conflict` ile reddedilir, boş veri yeniden oluşturulmaz. Fatal DB/migration hatasında uygulama boş veritabanıyla açılmaz. Arayüz (render) hatası veritabanı hatasından ayrı bir mesajla gösterilir; bu durumda veriler açıktır ve ekrandaki JSON düğmesi mevcut veriyi dışa aktarır. Retry ve geçerli eski Schema v1 JSON'unu export etme seçenekleri gösterilir. Corrupt JSON kaynak otomatik silinmez/düzeltilmez. IndexedDB açılamıyorsa kullanıcı başka sekmeleri kapatmalı, alan/izin kontrolü yapmalı ve tekrar denemelidir.

Gemini API key, ayrı `VocVocSecrets` / localStorage secret storage'ında kalır ve istekte URL'de değil `x-goog-api-key` header'ında gönderilir. Anahtarı Google AI Studio'da site adresiyle (HTTP referrer) ve yalnızca Gemini API ile kısıtlamanız önerilir (Ayarlar'da ipucu gösterilir). Client-side secret, cihaz/tarayıcı erişimine karşı server-side secret değildir. Word DB, export, manifest ve Service Worker cache'ine eklenmez.

## Performans

Ölçüm: `node tests/perf.cjs [--sizes=100,500,1000,2000,5000] [--rates=1,4] [--label=...] [--out=...]` (`npm test` içinde değildir). Gerçekçi ayrıntılı kelimelerle (eş/zıt anlam, örnek, deyim) 100–5000 kelimelik IndexedDB verisi hazırlar, 390x844 mobil görünümde Chrome'u 1× ve 4× CPU kısmasıyla açar; her etkileşimi 3 kez ölçüp medyan alır (sonraki 2 kare dahil). Sonuçlar `tests/perf-before.json` / `tests/perf-after.json` dosyalarındadır; mutlak değerler makineye bağlıdır, 4× serisi gürültülüdür — karşılaştırma için aynı koşulda önce/sonra çalıştırın.

5000 kelimede (karma durum: %50 aktif, %30 ezber, %20 arşiv), önce → sonra:

| ölçüm | 1× CPU | 4× CPU (telefon benzeri) |
|---|---|---|
| açılış (ilk boyama) | 6,5 sn → 0,87 sn | 9,8 sn → 1,8 sn |
| `renderAllLocal` | 3,0 sn → 0,07 sn | 32,9 sn → 0,33 sn |
| pop-up açılışı | 0,53 sn → 0,05 sn | 7,4 sn → 0,13 sn |
| filtre (geniş) / A→Z sıralama | 0,38 / 0,43 sn → 0,03 / 0,04 sn | 5,7 / 6,2 sn → 0,12 / 0,10 sn |
| Arşiv açılışı | 0,82 sn → 0,13 sn | 2,2 sn → 0,38 sn |
| DOM düğümü | 188.800 → 3.303 | aynı |
| ezber/arşiv işlemi (commit) | 0,81 sn → 0,30 sn | 0,87 sn → 0,80 sn (gürültülü) |

Yapılan (ölçümün gösterdiği sırayla, her biri testle korunur):
- **Kart ayrıntıları ilk açılışta kurulur** (kapalı kart ~8 düğüm; önceden ~76). En büyük kazanç: DOM %81 küçüldü.
- **Sayfalama:** ana ekranda en yeni 100 kart, History'de 400 çip, Arşiv'de 400 kelime; altında “Daha fazla göster (N)”. Hiçbir kelime kaybolmaz: filtre kutuları her zaman *tüm* kelimeleri arar, “Daha fazla göster” kalanını açar, açılan sayfa durum değişikliklerinde daralmaz, filtre/sıralama değişince başa dönülür.
- Footer `MutationObserver`'ı yalnızca footer içerebilen alt ağaçları izler (önceden tüm `body`).
- İlerleme listeleri (geçmiş / ezber / arşiv) commit başına bir kez türetilir; sıralama tek bir `Intl.Collator` kullanır (`localeCompare(locale, options)` her karşılaştırmada yeni collator kuruyordu); `normalizeHistoryKey` sonuçları önbelleğe alınır.
- Açılışta tamamlanmış veritabanı bir kez okunup doğrulanır (önceden aynı veri art arda iki kez okunuyordu).

Bilinçli olarak yapılmayan: IndexedDB'nin tek anlık görüntü (`schema-v1`) modelinden kayıt-bazlı depolara geçirilmesi. Ölçüm, bir durum değişikliğinin maliyetinin doğrusal olduğunu gösterdi (5000 kelimede 0,3 sn; yapısal kopya %51, doğrulama %23, IDB yazımı %26) ve 2000 kelimeye kadar rahat kalıyor (0,18 sn / mobilde ~0,5 sn). Bu eşik aşılırsa ilk adım kayıt-bazlı depo değil, kopyala-yaz yapısal paylaşımı olmalıdır.

## Yerelleştirme (i18n)

- Arayüz metinleri `index.html` içindeki `I18N` tablosunda (tr, en, fr, de, es, it), `pwa.js` içindeki güncelleme/yedek/hata metinleri `PWA_TEXT` tablosundadır. `tests/validate.cjs` her dilin tam olarak İngilizce anahtarlarla aynı anahtarları tanımladığını, kodun istediği her anahtarın var olduğunu, Türkçede İngilizce arayüz kelimesi kalmadığını ve şablonlarda sabit İngilizce metin bulunmadığını denetler.
- `t()` hiçbir durumda hata fırlatmaz: bilinmeyen dil → İngilizce; o dilde eksik anahtar → İngilizce metin, o da yoksa anahtarın kendisi; veri katmanı hazır değilken (açılış, depolama hatası) kaydedilmiş orijinal dil ya da varsayılan dil kullanılır.
- “Sınırsız / Unlimited / Illimité / Unbegrenzt / Ilimitado / Illimitato / ∞” tek bir yardımcıyla (`isUnlimitedText`) tanınır; yazım, vurgulama ve kaydetme aynı kuralı kullanır.
- Arayüz dili varsayılan olarak orijinal (native) dili izler. Ayarlar'da, önceki bir görevde eklenmiş isteğe bağlı bir “Uygulama dili” seçimi de vardır (`settings.appLanguage`; kayıt yoksa orijinal dil kullanılır). Aşama 2 freeze kararı: bu alan Schema v1'in isteğe bağlı bir parçası olarak kalır (şema sürümü değişmez; alan yoksa orijinal dil izlenir, eski sürüme geri dönüş testle doğrulandı). Arayüz dilini orijinal dilden bağımsız bir ürün özelliği olarak genişletmek ayrı bir backlog kararıdır; yerelleştirme çalışması ona dokunmaz.

## Erişilebilirlik

Tasarım ve davranış korunarak eklenenler (`a11y.js` + işaretleme):

- **Dialoglar** (Ayarlar, onaylar, Arşiv, kelime ayrıntısı, ilgili kelime, Flip): `role="dialog"`, `aria-modal="true"`, başlıktan gelen erişilebilir ad, odak tuzağı (Tab/Shift+Tab dialog içinde kalır), Escape ile kapanma (iç içe dialogda yalnızca en üsttekini; açık dropdown varsa önce onu), kapanınca odak açan elemana döner (yeniden çizilen History çipi bulunur; bulunamazsa arama kutusu). Onay dialoglarında başlangıç odağı güvenli düğmedir (Vazgeç).
- **Etiketler:** tüm metin alanları ve dropdown'lar erişilebilir ada sahiptir (`for`, `aria-labelledby`, dile göre güncellenen `aria-label`); History/Arşiv filtre ve sıralama dropdown'ları "Durum filtresi: Tümü" gibi okunur.
- **Dil işaretleme:** öğrenilen dildeki kelime, eş/zıt anlam, örnek cümle, deyim, test şıkkı, Flip ön yüzü ve arama kutusu `lang="{öğrenilen dil}"` taşır; anlamlar ve çeviriler sayfa dilinde kalır (`<html lang>` arayüz dilini izler).
- **Swipe'a bağımlı işlemler için düğme:** ana kartta *Ezberimde* / *Kapat*, History ve ilgili kelime penceresinde *Ezberimde* / *Ezberimden çıkar*, Flip'te aynı düğme. Swipe davranışı aynen duruyor.
- **Klavye:** dropdown'lar (Enter/Boşluk açar, ↑ ↓ Home End gezinir, Enter seçer, Esc kapatır, seçimden sonra odak düğmeye döner); Flip: *F* çevirir, *← →* kart değiştirir, *M* ezber durumunu değiştirir, *Esc* kapatır; Test'te her soruda odak ilk şıkka, bitişte "yeni test" düğmesine gider ve doğru/yanlış sesli duyurulur; yeniden çizimlerde odak kaybolmaz.

Otomatik test yalnızca klavye ve DOM/ARIA düzeyinde yapılır; NVDA, VoiceOver veya TalkBack ile elle doğrulama yapılmadı.

## Offline ve güncelleme

Service Worker sadece allowlist'teki app-shell dosyalarını precache eder. Navigation ve local asset'ler aynı version'ın cache'inden gelir. Gemini POST'ları, tüm external istekler ve allowlist dışındaki URL'ler intercept/cache edilmez. Kayıtlı kelimeler, History, Test/Recall, Archive/Undo, Settings ve swipe işlemleri offline çalışır. AI gereken işlemler localized hata verir; spinner `finally` ile kapanır, kayıtlar korunur. Bağlantı geri gelince normal fetch/fallback akışı devam eder.

`sw.js` içindeki `VERSION` **her app-shell değişikliğinde yükseltilmelidir**. Tüm paketi atomik yayınlayın; worker/shell dosyalarının karışık eski-yeni sürümlerini sunmayın. Registration `updateViaCache: none` kullanır; açılışta ve sekme görünür olduğunda update kontrol edilir. Yeni worker complete shell'i cache'ler ve waiting durumunda kalır. “Yeni sürüm hazır · Yenile” kullanıcı onayıyla aktive eder. Açık panel/Quiz/Flip, AI, pending write veya Undo varsa önce işlemi bitirme istenir. Başka sekmeler zorla reload edilmez. Aktivasyonda yalnızca bu scope'un eski `vocvoc-shell-…` cache'leri temizlenir. IndexedDB ve secret storage güncellemede silinmez.

### Service Worker sertleştirmesi

- **Kurulum hep-ya-da-hiç:** shell dosyalarının hepsi indirilir ve cache'lenen `index.html` içindeki `<meta name="vocvoc-shell">` değerinin worker `VERSION`'ı ile aynı olduğu doğrulanır. Bir dosya eksikse ya da HTML başka sürümdense (kısmi/çarpık deploy, CDN gecikmesi) kurulum başarısız olur, yarım cache silinir ve çalışan kurulum olduğu gibi kalır; bir sonraki sağlam deploy normal şekilde kurulur.
- **Cache silinirse:** tarayıcı depolama baskısında cache'i silerse ilk navigation ağdan karşılanır ve shell arka planda yeniden kurulur (offline çalışma geri gelir). Hiç ağ yokken ve cache silinmişken yapılabilecek bir şey yoktur.
- **Gemini ve API key cache'e girmez:** worker yalnızca scope içindeki ASSETS listesindeki GET isteklerini yakalar; Gemini (başka origin, POST) hiç yakalanmaz ve hiçbir isteğin yanıtı runtime'da cache'e yazılmaz. Anahtar yalnızca `x-goog-api-key` header'ında gider.
- **Güncelleme sonsuza kadar beklemez:** açılışta, sekme görünür olduğunda ve görünürken saatlik olarak update kontrol edilir. Banner kapatılsa bile bekleyen worker, tüm sekmeler kapanınca kendiliğinden devralır. Açılış hata ekranındaki *Retry* düğmesi de bekleyen worker'ı devralır (düz reload eski worker'ı korurdu). “Yenile” sonrası worker devralmazsa 8 sn içinde arayüz geri verilir ve açıklayıcı mesaj gösterilir; arayüz sonsuza dek kilitli kalmaz. Aktif işlem varken (busy) agresif reload yapılmaz.
- **Bilinen Chromium davranışı:** bekleyen worker son sekme kapanınca devralırken, hemen ardından yapılan *ilk* gezinme (uygulamayı kapatıp saniyeler içinde yeniden açmak) bazen askıda kalabilir; sayfayı durdurup yeniden yüklemek çözer. Orijinal `sw.js` ile de aynı şekilde görülür (kendi `fetch` mantığından bağımsızdır); testler bunu bekleyerek ve gezinmeyi yeniden deneyerek tolere eder.

### Gemini / ağ katmanı

- **API anahtarı:** yalnızca `x-goog-api-key` header'ında gider. URL'ye, console'a, Service Worker cache'ine, export/backup dosyasına yazılmaz; kaynak kodunda sabit anahtar yoktur (`tests/validate.cjs` bunu denetler). Geçerli olamayacak bir anahtar (ASCII dışı, boşluklu) hiç istek atılmadan "anahtarı kontrol edin" olarak reddedilir. Ayarlar'da, anahtarı Google AI Studio'da site adresi (HTTP referrer) ve Gemini API ile kısıtlama önerisi gösterilir.
- **Yapılandırılmış çıktı:** istekler `generationConfig.responseSchema` taşır (tek kelime kartı, Daily `words[]`, Random `word`); istemci yine de her yanıtı doğrular. Bir model şemayı reddederse (anahtarla ilgisiz 400) aynı model şemasız JSON moduyla yeniden denenir ve oturum boyunca hatırlanır. Model sırası (`GEMINI_MODELS`) ve fallback davranışı değişmedi. **Şema, canlı Gemini API'sine karşı denenmedi** (test ortamında anahtar yok); sahte yanıtlarla doğrulandı. Canlıda şema 400 verirse yukarıdaki geri dönüş devreye girer.
- **Süre sınırları** (`GEMINI_LIMITS`): istek başına 15 sn, Daily için tüm denemeler ve modeller toplamında 45 sn. Bütçe dolunca yeni istek başlatılmaz.
- **Hatalar:** hepsi yerelleştirilmiş tek mesaj verir, yükleme göstergesi kapanır, kayıtlı veri değişmez ve uygulama kullanılabilir kalır: offline, zaman aşımı, HTTP hatası (5xx), 429/kota (başka model denenir; hepsi başarısızsa kota mesajı öncelikli), geçersiz anahtar veya anahtar kısıtlaması (denemeyi durdurur, fallback tüketmez), bozuk JSON, boş yanıt, bulunamayan model (404 → sonraki model), tüm modellerin başarısız olması, kopan bağlantı (tekrar denenmez), Daily toplam süre aşımı.

### Sürüm yayınlama adımları

1. `sw.js` içindeki `VERSION`'ı, `index.html` içindeki `<meta name="vocvoc-shell" content="…">` değerini ve `BUILD_INFO.json` `version`'ını aynı sayıya yükseltin.
2. `node tools/lock-shell.js` çalıştırın (shell parmak izini `tests/shell-lock.json`'a yazar; shell değişmiş ama VERSION değişmemişse reddeder).
3. `npm test --prefix tests`: `validate.cjs`, ASSETS listesi, `sw.js` veya herhangi bir asset baytı değişmiş ama VERSION yükseltilmemişse **FAIL** eder.
4. Tüm klasörü atomik yayınlayın.

### Güncelleme ve IndexedDB yaşam döngüsü

Service Worker IndexedDB'ye hiç dokunmaz ve diğer sekmeleri reload etmez; bu yüzden güncelleme ile migration arasında doğrudan yarış yoktur. Kombinasyonlar:

- **Eski shell + güncel DB:** başka sekme yeni shell'e geçip yazdıysa eski sekme çalışmaya devam eder, yazması revision kontrolüyle `conflict` olarak reddedilir (üzerine yazamaz); yenilenince yeni shell + güncel veri gelir.
- **Yeni shell + mevcut DB:** revision ve migration marker değişmeden devam eder; açılış ek yazma yapmaz.
- **Yeni shell + migration gerektiren DB:** IndexedDB yoksa ve legacy kaynak duruyorsa migration idempotent çalışır (aynı ID'ler, tekrar kopya yok, marker `complete`).
- **Daha yeni şemadaki DB (geri alınan deploy / ileride şema artışı):** `schemaVersion` 1 dışındaki kayıt hiçbir shell tarafından değiştirilmez; uygulama güvenli hata ekranı gösterir. Bu sürümde yerinde şema migration'ı yoktur; ileride eklenirse tek transaction'da yazılmalı ve revision'ı artırmalıdır, aksi halde eski sekmeler çakışmayı fark edemez.

## Testleri çalıştırma ve sürekli doğrulama (CI)

```
cd tests && npm ci      # test araçları: playwright, fake-indexeddb (uygulamanın çalışma zamanı bağımlılığı yoktur)
npm test                # hızlı paket, tarayıcı gerekmez (yaklaşık 3 sn): 27 doğrulama + 42 veri testi
npm run test:browser    # Chrome regresyon paketi (84 senaryo, yaklaşık 2 dk)
npm run test:all        # ikisi birden
```

`npm test` kök dizinden de çalışır (`package.json` yalnızca `tests/`'e yönlendirir). Tarayıcı paketi sistemdeki Chrome'u `PWA_BROWSER_PATH=/yol/chrome` ile kullanır; verilmezse Playwright'ın Chromium'u gerekir (`npx playwright install chromium`). Testler sahte Gemini cevapları kullanır, gerçek anahtar/kota harcamaz. `tests/fixtures/spa-v1.html` dokunulmamış kaynak fixture'ıdır.

**GitHub Actions** (`.github/workflows/ci.yml`): her push ve pull request'te iki iş paralel çalışır: *Validate* (`npm test`) ve *Browser tests* (`npm run test:browser`, runner'ın Chrome'u ile; yoksa Chromium indirir). `tests/package-lock.json` repoda olmalıdır (`npm ci` ve önbellek ona bağlıdır).

| İstenen kontrol | Nerede (test adı) |
|---|---|
| JavaScript söz dizimi | `validate.cjs` → *every shipped, tool and test JavaScript file parses*, *the inline scripts of index.html parse* |
| Manifest | *describes an installable standalone app…*, *every icon exists and has exactly the declared size…* |
| Service Worker asset'leri | *lists existing files only, once each*, *covers every local file index.html loads…*, *real handlers: Gemini and foreign requests are never intercepted…* |
| **ASSETS değişti ama VERSION aynı → FAIL** | *VERSION is bumped whenever ASSETS, an asset or sw.js changes…* ve bu korumanın kendisini sınayan *the guard itself works…* |
| IndexedDB / veri regresyonu | `storage.cjs` (adaptör, doğrulama, yedek dosyaları) ve `data-layer.test.cjs` (gerçek `VocVocData` kodu) |
| Migration idempotency | *is idempotent: starting again with the same legacy data changes nothing…*, *an interrupted migration… is completed…*, *two tabs starting at once…*, *restarting never repeats the migration…* |
| Arşiv / geri yükleme durumu | `data-layer.test.cjs` → *Archive and restore* grubu (Undo birebir, geri yüklenenler ezberde, silme kalıcı) |
| İlk 100 kayıt (`slice`) regresyonu | *History is newest first: with 150 records the first 100 are exactly the 100 most recent*, *the prompt word cap keeps the NEWEST 100 words…* ve tarayıcıda *prompt word cap keeps the newest 100 of 150 records…* |
| API anahtarı export/cache'e girmez | *is absent from the exported backup, from the recovery copy and from the stored Schema v1 snapshot*, *a backup that carries a key is rejected…*, *the key travels only in the x-goog-api-key header…*, tarayıcıda *Gemini request/response and the API key never enter any cache* |

Bir testin neden düştüğü adından okunur; tarayıcı paketi hata anında "son geçen senaryo"yu yazdırır (düşen, bir sonrakidir).

### Sürüm yükseltme (Service Worker cache)

Uygulama kabuğundaki (`index.html`, `storage.js`, `a11y.js`, `pwa.js`, manifest, ikonlar, `sw.js` ve `ASSETS` listesi) herhangi bir değişiklikte: `sw.js` `VERSION`, `index.html` içindeki `<meta name="vocvoc-shell">` ve `BUILD_INFO.json` `version` aynı sayıya yükseltilir, sonra `node tools/lock-shell.js` (veya `npm run lock-shell`) çalıştırılır. Yükseltmeden CI kırmızı olur; aksi halde kullanıcılar eski cache'te kalırdı.

## Sınırlar

Chromium otomasyonunda offline shell/cold start, IndexedDB migration/persistence, gerçek pointer işlemleri, update lifecycle ve mobile viewport kontrol edilir. Bu, fiziksel Android/iOS kurulum denemesinin veya gerçek Gemini model erişiminin yerini tutmaz. Kullanıcının Gemini hesabındaki model erişimi ve quota'sı değişebilir; SPA fallback sırası korunmuştur. Private/incognito storage, kullanıcı tarafından browser data silinmesi ve cihazın kalıcı disk arızası için cloud koruması yoktur.
