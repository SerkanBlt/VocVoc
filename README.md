# VocVoc PWA v1.0

Bu paket frozen `vocvoc_spa_v1_0_candidate.html` kaynağından oluşturuldu. Orijinal dosya değiştirilmedi. Aşama 3 özellikleri yoktur.

## Yayınlama / kurulum

`VocVoc/` içeriğini aynı HTTPS adresindeki bir klasöre yayınlayın. `index.html`, `storage.js`, `pwa.js`, `sw.js`, manifest ve `icons/` birlikte yayınlanmalıdır. Framework, build veya uygulama backend'i gerekmez. Service Worker için `sw.js` dosyasını `text/javascript` olarak sunun; güncelleme kontrolünü engelleyen uzun HTTP cache süresi vermeyin. Manifest için `application/manifest+json` önerilir. Site başka route'lara ait istekleri index.html'e yönlendiriyorsa gerçek `sw.js`/manifest/icon dosyalarını istisna tutun.

Yerel test: `python3 -m http.server 8000 --directory VocVoc`, ardından `http://localhost:8000/`. ZIP'i açıp `index.html` dosyasına çift tıklamak PWA kurmaz; `file://` Service Worker çalıştırmaz. İlk online açılışta Service Worker'ın kurulmasını bekleyin. Chrome/Chromium menüsünden uygulamayı yükleyin; iOS'ta Safari → Paylaş → Ana Ekrana Ekle. Gerçek cihazın kurulum ve safe-area kontrolünü yayınlanan HTTPS adresinde yapın.

## Storage / migration

`UI → VocVocData → IndexedDBAdapter → IndexedDB`.

IndexedDB adı `VOCVOC_PWA`, database version `1`. `state` store'unda `schema-v1` anahtarı Schema v1'in tamamını tutar: meta, settings, words, aliases, progress, dailyUsage. Bu snapshot yapısı mevcut Data API'nin atomik işlemlerini korur; History/Memorized/Archive ayrı veritabanları değildir. `control` store'unda revision, migration marker ve import öncesi kurtarma kopyası bulunur. Object store version ile uygulama schemaVersion birbirinden ayrıdır.

Bootstrap önce DB'yi açar, migration yapar ve doğrular, ardından cache hazır olur ve tek ana render yapılır. Okumalar memory cache üzerinden senkrondur. Değişiklik API'leri Promise döndürür; tek merkezi kuyruk draft oluşturur, transaction `complete` sonrasında committed cache'i yayınlar. Abort/quota hatasında eski committed cache korunur. UI doğrudan IndexedDB kullanmaz. Yeni async mutasyonlar çağrıldığında `await` edilmelidir.

İlk açılışta aynı origin'deki `VOCVOC_DB_V1` validate edilir. Yoksa mevcut eski SPA migration mantığı legacy listeleri dönüştürür. Veri ve `copied` marker tek transaction'da yazılır; durable readback doğrulanınca marker `complete` olur. Kapanma/crash sonrasında tamamlanmamış aktarım doğrulanarak devam eder; word ID'ler korunur, duplicate oluşturulmaz. `VOCVOC_DB_V1`, legacy kaynaklar ve `VOCVOC_MIGRATION_BACKUP_V1` silinmez. Başarılı migration sonrasında IndexedDB authoritative'dir; localStorage'a geri yazılmaz. Bu nedenle PWA sonrasında eski SPA kopyasını düzenlemeye devam etmek iki bağımsız veri oluşturur.

Başka sekmedeki değişiklik revision kontrolüyle eski snapshot'ın üzerine yazılamaz; kullanıcıya yenileme bildirilir. Bu local sekme güvenliğidir, cloud sync değildir.

### Farklı origin'e geçiş

Tarayıcı güvenliği nedeniyle dosya/content URL'sindeki veya başka domain/protokoldeki SPA verisi yeni HTTPS origin'inden okunamaz. Otomatik migration yalnızca **aynı origin** için geçerlidir. Eski uygulamanın tarayıcı konsolunda `tools/export-from-spa.js` içeriğini çalıştırın; indirilen JSON'u yeni PWA'da Ayarlar → Veri yedeği → Yedeği geri yükle ile aktarın. Mobilde gerekirse tarayıcının remote debugging konsolunu kullanın. Eski verileri silmeyin. API key bu aktarımda yoktur; yeni origin'de yeniden girilmelidir.

## Yedekleme / kurtarma

Ayarlar gövdesindeki tek açılır JSON yedeği bölümünde export/import bulunur. Export schemaVersion, exportVersion, exportedAt, meta, settings, words, aliases, progress ve dailyUsage taşır. Secret storage dahil edilmez.

Import bir **restore/overwrite** işlemidir, merge değildir. Dosya boyutu/version/schema/ID/referans/status kontrolü ve açık confirmation sonrası tek transaction çalışır. Önceki veri aynı transaction içinde `before-import` kurtarma kopyasına alınır. `↶ JSON` düğmesi bu önceki kopyayı dışa aktarır; geri dönmek için bu dosyayı import edin. Başarısız işlemde mevcut veri korunur. Son başarılı import'un önceki kopyası tutulur; sınırsız yedek geçmişi değildir. Düzenli export alın: tarayıcı verilerini silmek, origin değiştirmek veya storage eviction yerel veriyi kaybettirebilir; cloud backup yoktur.

Fatal DB/migration hatasında uygulama boş veritabanıyla açılmaz. Retry ve geçerli eski Schema v1 JSON'unu export etme seçenekleri gösterilir. Corrupt JSON kaynak otomatik silinmez/düzeltilmez. IndexedDB açılamıyorsa kullanıcı başka sekmeleri kapatmalı, alan/izin kontrolü yapmalı ve tekrar denemelidir.

Gemini API key, ayrı `VocVocSecrets` / localStorage secret storage'ında kalır. Client-side secret, cihaz/tarayıcı erişimine karşı server-side secret değildir. Word DB, export, manifest ve Service Worker cache'ine eklenmez.

## Offline ve güncelleme

Service Worker sadece allowlist'teki app-shell dosyalarını precache eder. Navigation ve local asset'ler aynı version'ın cache'inden gelir. Gemini POST'ları, tüm external istekler ve allowlist dışındaki URL'ler intercept/cache edilmez. Kayıtlı kelimeler, History, Test/Recall, Archive/Undo, Settings ve swipe işlemleri offline çalışır. AI gereken işlemler localized hata verir; spinner `finally` ile kapanır, kayıtlar korunur. Bağlantı geri gelince normal fetch/fallback akışı devam eder.

`sw.js` içindeki `VERSION` **her app-shell değişikliğinde yükseltilmelidir**. Tüm paketi atomik yayınlayın; worker/shell dosyalarının karışık eski-yeni sürümlerini sunmayın. Registration `updateViaCache: none` kullanır; açılışta ve sekme görünür olduğunda update kontrol edilir. Yeni worker complete shell'i cache'ler ve waiting durumunda kalır. “Yeni sürüm hazır · Yenile” kullanıcı onayıyla aktive eder. Açık panel/Quiz/Flip, AI, pending write veya Undo varsa önce işlemi bitirme istenir. Başka sekmeler zorla reload edilmez. Aktivasyonda yalnızca bu scope'un eski `vocvoc-shell-…` cache'leri temizlenir. IndexedDB ve secret storage güncellemede silinmez.

## Testleri çalıştırma

`npm install --prefix tests`

`npx --prefix tests playwright install chromium`

`npm test --prefix tests`

Alternatif Chromium: `PWA_BROWSER_PATH=/absolute/path/chromium npm test --prefix tests`. Uygulamanın runtime npm bağımlılığı yoktur; bunlar test araçlarıdır. Test sunucusu localhost'ta geçici olarak açılır. Testler sahte Gemini cevapları kullanır; gerçek API key/quota harcamaz. `tests/fixtures/spa-v1.html` dokunulmamış source fixture'ıdır; yayın için gerekli değildir. `tests/browser-results.json` teslim sırasında çalıştırılmış test raporudur.

## Sınırlar

Chromium otomasyonunda offline shell/cold start, IndexedDB migration/persistence, gerçek pointer işlemleri, update lifecycle ve mobile viewport kontrol edilir. Bu, fiziksel Android/iOS kurulum denemesinin veya gerçek Gemini model erişiminin yerini tutmaz. Kullanıcının Gemini hesabındaki model erişimi ve quota'sı değişebilir; SPA fallback sırası korunmuştur. Private/incognito storage, kullanıcı tarafından browser data silinmesi ve cihazın kalıcı disk arızası için cloud koruması yoktur.
