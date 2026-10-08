# VocVoc PWA v1.0 — Aşama 2 teslim raporu

> **Güncel durum (2026-10-06):** Bu rapor ilk Aşama 2 teslimini (sürüm 1.0.0) anlatır; "Doğrulama sonuçları"ndaki sayılar o günün sayılarıdır. Teslimden sonra yapılan sertleştirme (veri güvenliği, Service Worker güncellemesi, Gemini hata yönetimi, erişilebilirlik, yerelleştirme, 5000 kelime performansı, CI) `README.md`'de ve `AUDIT_REPORT.md`'de anlatılır. Güncel doğrulama: `npm test` 51 doğrulama + 93 veri testi, Chrome paketi 120 senaryo, GitHub Actions yeşil. Freeze etiketi `v1.0.8-stage2`; CSP ve başka sekme yenileme sürüm 1.0.9'da (`v1.0.9`), küçük temizlik ve UX düzeltmeleri (ölü kod, `__proto__` kelimesi, kopyalanabilir başlık, yerel tarihli export adı, manifest `lang`/`screenshots`) sürüm 1.0.10'da (`v1.0.10`); kartların altındaki ezberleme düğmelerinin kaldırılması ve Flip oklarının kenarlıksız olması sürüm 1.0.11'dedir; "Yenile" düğmesinin bitmiş bir Test yüzünden "Önce açık işlemi tamamlayın" demesi 1.0.12'de düzeltildi. Sürüm 1.1.0 mağaza uygulaması için yeni arayüzün ilk iskeletini ekler (varsayılan kapalı, simülasyon; ayrıntı README, *Yeni arayüz*). Sürüm 1.1.1 buna Bugün panosunu, Test sayfasını ve adrese bağlı Flip sayfasını, sürüm 1.2.0 İstatistik (Premium) ve Rozetler (ücretsiz) ekranlarını, sürüm 1.3.0 hazır kelime paketlerini (ücretsiz; 5 örnek paket) ve sesli okumayı (Premium) ekler; sürüm 1.4.0 Bugün sayfasını sadeleştirir (kelime kartları ve havuz yeni *Kelimeler* sekmesine taşındı, son 7 gün grafiği eklendi), Çalış sayfasına Testler panelini ve renkli noktalı son testler listesini koyar, yeni rozeti ekranın ortasında bir kartla duyurur ve eski ana ekranın son panelinin alt kenarının sekme çubuğunun altında kalmasını düzeltir; sürüm 1.5.0 alt sekme çubuğunu kaldırır, her sayfaya üst çubuk (menü düğmesi, VocVoc, yuvarlak profil düğmesi) ve soldan açılan menü (Ayarlar en altta) ekler, Rozetler sayfasını Bugün'ün sonuna taşır ve `contentArea` içindeki son kartın kesik alt kenarını (kelime havuzu araç çubuğunun arka plan süsü kartın üstüne biniyordu; eski arayüzde de vardı) düzeltir; sürüm 1.6.0 rozetleri üç sekmeye böler, Günlük düğmesinin eklediği kelimeleri piller olarak gösterir, profil fotoğrafı (kırpma ve yakınlaştırma), okuma hızı döngüsü, son 7 gün çubuklarından açılan kelime paneli, her kelimede iki örnek cümle ve deyim pilleri ekler ve hazır paket bitince Günlük düğmesinin, anahtar olduğu halde, yapay zekâya geçmemesi hatasını düzeltir.

Kaynak: `vocvoc_spa_v1_0_candidate.html`. Orijinal SHA-256: `7b8e5727e0e63e2d2fcbc4312a7d70b6533a904ddb0d842977ccdcec04ee3f8f`. Kaynak değiştirilmedi; test fixture'ı byte-for-byte aynıdır. Kullanıcının yazdığı `canditate` adına karşılık mevcut dosyanın adı `candidate` idi; farklı bir SPA revizyonu kullanılmadı.

## Audit sonucu ve değişiklik kapsamı

Tam SPA dosyasındaki Data API, Adapter, Schema v1, LocalStorage/secret kullanımı, legacy migration, startup/render, manifest/icon ve Service Worker bağlantıları incelendi. PWA hazırlığı yalnızca HTML link/meta etiketleri ve tek registration'dan oluşuyordu; gerekli local PWA dosyaları yoktu. Bu tek eski registration kaldırılarak tek `pwa.js` lifecycle'ı getirildi. Eski CSS/gesture patch katmanları bu dönüşümde körlemesine temizlenmedi; frozen çalışan cascade korundu. HTML/CSS/JS framework'e taşınmadı.

Yeni dosyalar: `storage.js`, `pwa.js`, `sw.js`, `manifest.webmanifest`, dört icon, export helper ve testler. Uygulamanın mevcut inline CSS/JS'si `index.html` içinde kaldı. Settings gövdesine tek açılır JSON backup bölümü, storage-failure bootstrap ekranı ve küçük update bildirimi eklendi. Viewport-fit ve mevcut authoritative padding kurallarına safe-area desteği getirildi; yeni !important patch katmanı oluşturulmadı. Ana layout'un desktop/mobile geometrisi orijinal fixture ile aynı bulundu.

## IndexedDB ve Data API

`VOCVOC_PWA` database version 1; `state` / `control` object store'ları. `state/schema-v1`, eski Schema v1'in bütün mantıksal gruplarını birlikte saklar. Bu snapshot tercihinin sebebi, mevcut memory-cache Data API'sini ve bir işlemde word/alias/progress/settings tutarlılığını atomik korumaktır. Ayrı duplicate History veya Archive truth source yoktur. Stable ID ve canonical word modeli korundu.

Data getter'ları committed memory cache okur. Mutasyonlar async Promise döndürür; merkezi seri kuyruk bir draft oluşturur, strict durability talep edilen readwrite transaction complete sonrası cache'i yayınlar. Desteklemeyen tarayıcılar için standart transaction fallback'i vardır. Quota/abort'ta committed cache korunur. UI doğrudan IndexedDB açmaz. Dil ayarı/reset ve Search save/touch tek atomik işlem oldu. Daily batch tek durable write yapar. Çoklu sekme stale revision yazımı reddedilir.

Deterministic bootstrap: DB open → kaynak doğrulama/migration → durable readback → Data ready → starters gerekiyorsa bir defa → tek ana render → idle consistency. Başlangıç katmanı pointer input'u yalnızca hazır olana kadar tutar. Bu görünürlük için özel regression guard eklendi.

## Migration ve recovery

Aynı origin'deki `VOCVOC_DB_V1` strict validate edilir. Veri + copied marker tek transaction; durable readback/validation sonrası complete marker. Commit öncesi kesinti sıfır partial state bırakır; copied sonrası kesinti verification ile tamamlanır. İlk açılışta yarışan iki adapter aynı kaydı okur; duplicate yazmaz. LocalStorage kaynakları ve `VOCVOC_MIGRATION_BACKUP_V1` korunur; IDB hazır olduktan sonra eski DB'ye geri yazılmaz. Silinen kelimeler retained eski kaynaktan yeniden migrate edilmez.

API key ayrı VocVocSecrets/localStorage storage'ında kalır. Cache, word DB veya export'a taşınmaz. Farklı origin'deki/download HTML storage otomatik erişilemez: `tools/export-from-spa.js` eski SPA origin'inde çalıştırılıp yeni PWA'ya import edilmelidir. Bu bir tarayıcı güvenlik sınırıdır.

Fatal migration/DB hatasında boş DB ile sessiz devam edilmez. Retry ve geçerli eski Schema v1 export seçeneği vardır. Invalid JSON kaynak silinmez. Import öncesi durable recovery snapshot saklanır ve Settings'teki ↶ JSON ile çıkarılabilir.

## Offline/cache/update

Versioned, scope'a özel `vocvoc-shell-…-<VERSION>` cache (ilk teslimde 1.0.0); yalnızca app-shell allowlist'i. Install bütün asset'leri almadan tamamlanmaz. Navigation/local asset'ler installed sürüm cache'inden okunur. Gemini POST, external URL ve allowlist dışındaki local URL'ler cache/intercept edilmez.

Yeni worker waiting durumunda kalır. Açılış/görünürlük değişiminde update kontrolü, kullanıcı kontrollü Yeni sürüm hazır → Yenile. Açık panel/Quiz/Flip, AI, Undo veya pending write sırasında reload engellenir. Update diğer sekmeleri zorla reload etmez. Activate yalnızca aynı scope'un obsolete cache'lerini siler; yeni cache/IndexedDB/secret korunur. Her app-shell değişikliğinde sw.js VERSION yükseltilmeli ve paket atomik yayınlanmalıdır.

Offline local özellikler mevcut memory/IndexedDB verileriyle çalışır. AI gereken işlemler altı UI dilinde anlaşılır bağlantı hatası verir; spinner kapanır, kayıtlar değişmez. Online olduğunda gerçek fetch hata/timeout/fallback handling devam eder. Gemini model sırası değiştirilmedi.

## Export/import

JSON formatı: schemaVersion=1, exportVersion=1, exportedAt, meta, settings, words, aliases, progress, dailyUsage. API key yoktur. Import validate/version/ID/reference/status kontrolü ve açık confirmation sonrası overwrite/restore'dur; merge değildir. Önceki snapshot ve yeni state aynı transaction'dadır. Yanlış dosya veya transaction failure mevcut veriyi değiştirmez.

## Doğrulama sonuçları (ilk teslim, sürüm 1.0.0)

- Gerçek headless Chromium: **39 senaryo PASS**, tarayıcı JS error yok.
- 1000 kelimelik migration + ilk açılış bu ortamda **252 ms**. Tek örnek smoke ölçümüdür; fiziksel telefon benchmark'ı değildir.
- Fresh/online reload/offline reload/offline cold start, History/Test/Recall/Archive/Settings offline persistence PASS.
- Active/memorized archive → exact Undo → reload, archive restore → memorized, delete → reload, Daily/settings/language persistence PASS.
- Search/Random/Daily AI contract simulated responses ile PASS; Daily batch tek write. Related preview geçici, Add durable, listede olmayan kartta archive yok.
- Gerçek pointer: History memorize/unmemorize, Related, ContentArea ve Flip PASS. Popup background lock/release PASS.
- 390px mobile/touch viewport ve 1280px desktop/light/dark popup bounds PASS. Ana ekran geometry frozen SPA fixture ile aynı.
- Settings gerçek JSON download + confirmation/file import + reload PASS.
- Quota rejection committed cache'i korur; stale writer conflict PASS.
- IDB testleri: gerçek transaction abort semantics (fake-indexeddb), interrupted-before-commit retry, copied-phase retry, concurrent initialization, readback/idempotency, recovery backup, validation, unavailable DB PASS.
- SW waiting/update/busy gate/user reload/obsolete cache cleanup/new-version offline reload PASS.
- 12 SPA guard + opt-in PWA guards PASS. Render storage write ve getter disk-read yok; duplicate startup render yok.
- `node --check`: tüm JS dosyaları ve bütün inline JS PASS. Manifest JSON, icon boyut/path, HTML local references, SW asset listesi ve registration scope PASS.
- Kaynak SHA-256 eşleşmesi PASS.

Test komutları `README.md`'dedir; senaryo isimleri her tarayıcı koşusunun yazdığı `tests/browser-results.json` dosyasında (git'te izlenmez) ve CI iş özetindedir. Opt-in console guard'ları: `VocVocRegression.run()` ve `await VocVocPWARegression.run()`.

## Kalan sınırlar

Paket GitHub Pages ile HTTPS üzerinden yayınlanıyor (`https://serkanblt.github.io/VocVoc/`). Fiziksel Android/iOS Add to Home Screen / installed safe-area testi ve ekran okuyucu testi yapılmadı; gerçek Gemini hesabı/model erişimi (`responseSchema` dahil) denenmedi. Bu testler kullanılan Chromium otomasyonunun kapsamı dışındadır. Kullanıcı cihazı kurulum denemesi ve farklı-origin veri aktarımı yönergeleri README'dedir. Tarayıcı verisi silinmesi/storage eviction için cloud backup yoktur; düzenli export gerekir.

Çözümsüz bir uygulama kodu blocker'ı tespit edilmedi. Aşama 3 uygulanmadı.

**VocVoc PWA v1.0 / Aşama 2 freeze için hazır** (etiket `v1.0.8-stage2`).

Teknik lifecycle referansları: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB ve https://web.dev/articles/service-worker-lifecycle
