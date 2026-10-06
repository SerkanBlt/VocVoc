# VocVoc PWA v1.0 — Audit Raporu

**Tarih:** 2026-10-05
**Kapsam:** `index.html` (tüm JS, satır 2424–5135, ve HTML iskeleti), `storage.js`, `pwa.js`, `sw.js`, `manifest.webmanifest`, `tests/`, `tools/`.
**Yöntem:** Statik kod incelemesi. Testler çalıştırılmadı (`tests/node_modules` yok), uygulama tarayıcıda açılmadı. Kod değiştirilmedi.
**Doğrulama:** `SHA256SUMS` içindeki tüm dosyalar eşleşiyor. Gemini model adları (`gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`) Google'ın model listesinde stabil olarak yer alıyor (<https://ai.google.dev/gemini-api/docs/models>).

**Güncelleme (2026-10-06, sürüm 1.0.10):** Bu rapor ilk audit'in kaydıdır; "Yöntem" ve "Bulgular" o günkü koda aittir ve değiştirilmedi. "Yapılacaklar" listesinin onay kutuları yapılan işe göre güncellendi; ayrıntılar README'de (Performans, Yerelleştirme, Erişilebilirlik, Offline ve güncelleme, CI), `RELEASE_REPORT.md`'de ve `v1.0.8-stage2` etiketindedir.

## Özet

Veri katmanı, migration ve Service Worker sağlam tasarlanmış. XSS açığı bulunmadı. Asıl riskler:

1. **Veri kaybı:** kalıcı depolama istenmiyor; sıfırlama ve dil değişimi yedeksiz siliyor.
2. **Erişilebilirlik:** ezber işaretleme yalnızca kaydırma hareketiyle yapılabiliyor.
3. **Ölçeklenme:** her değişiklikte tüm veritabanı kopyalanıp baştan yazılıyor.
4. **Mantık hatası:** Daily/Random, yasaklı listeye en yeni değil en eski kelimeleri koyuyor.

## Bulgular

### Yüksek

| # | Bulgu | Yer |
|---|---|---|
| H1 | **Kalıcı depolama istenmiyor.** `navigator.storage.persist()` hiçbir yerde çağrılmıyor. Chrome depolama baskısında veriyi silebilir; iOS Safari, ana ekrana eklenmemiş sitelerin verisini 7 gün kullanılmayınca siler. Veri yalnızca yerelde tutulduğundan bu doğrudan kayıp demek, kullanıcıya uyarı da gösterilmiyor. | `storage.js`, `index.html:3347` |
| H2 | **Yıkıcı işlemlerden önce yedek alınmıyor.** "İlerlemeyi sıfırla" ve dil değişikliği her şeyi siliyor; import'taki `before-import` kurtarma kopyası bu işlemlerde kullanılmıyor. Arayüz dili ana dile bağlı (`getAppLanguage()` → `nativeLanguage`), yani **arayüz dilini değiştirmek tüm kelimeleri siliyor**. `appLanguage` çevirileri var ama kullanılmıyor. | `index.html:3039`, `:2542`, `:3011` |
| H3 | **Ezber işaretleme yalnızca kaydırmayla yapılabiliyor.** Ana kart, History popup'ı, Related popup ve Flip'te "ezberledim / çıkar" için buton ya da klavye yolu yok (WCAG 2.1.1, 2.5.1). | `index.html:4888`, `:4986`, `:4181` |
| H4 | **API anahtarı zayıf korunuyor.** Anahtar URL'de `?key=` olarak gidiyor (`x-goog-api-key` header'ı destekleniyor), `localStorage`'da düz metin duruyor, kullanıcıya referrer/API kısıtlaması önerilmiyor. | `index.html:3960`, `:2571` |

### Orta

| # | Bulgu | Yer |
|---|---|---|
| M1 | **Yasaklı liste en yeni kelimeleri düşürüyor.** History en yeniden en eskiye sıralı, `.slice(-100)` ise sondaki 100 (en eski) kelimeyi alıyor. 100'den fazla kelimesi olanlarda Gemini son öğrenilenleri tekrar önerir; "yalnızca X/10 kelime hazırlanabildi" hatası çıkar. | `index.html:4055`, `:4127` |
| M2 | **Ölçeklenme.** Her mutasyon tüm DB'yi `structuredClone` ile kopyalıyor ve `strict` durability ile baştan yazıyor. `renderAllLocal()` tüm History'yi kart olarak çiziyor. `body` üzerindeki MutationObserver her DOM değişikliğinde tüm `.swipe-footer`'ları ölçüyor. 1000 kelime testi masaüstü Chromium'da yapılmış. | `index.html:2590`, `:3855`, `:4611` |
| M3 | **Çoklu sekme sürtünmesi.** Bir sekmedeki her commit (aramadaki `touchWord` dahil) diğer sekmeyi "yenileyin" durumuna düşürüyor; oradaki yazmalar `conflict` veriyor. `refresh()` yalnızca açılışta kullanılıyor. | `pwa.js`, `index.html:3041` |
| M4 | **Dialog erişilebilirliği.** Yalnızca Flip'te `role="dialog"` ve Escape var. Ayarlar, Arşiv, onaylar ve kelime popup'larında focus tuzağı, Escape ve focus dönüşü yok; `label`'lar `for` içermiyor; dropdown'larda ok tuşu yok. | `index.html:2206–2422` |
| M5 | **Hedef dil metinlerinde `lang` yok.** Sayfa `lang="tr"`; Fransızca kelime/cümleler etiketsiz, ekran okuyucu Türkçe sesle okur. | `index.html:4845` |
| M6 | **CSP yok**, 95 inline `onclick` var. `unsafe-inline` ile bile `connect-src` sınırlanabilir. | `index.html:4` |
| M7 | **SW `VERSION` elle yükseltiliyor.** Shell cache-first olduğundan `VERSION` unutulursa kullanıcılar güncelleme almaz; `validate.cjs` bunu denetlemiyor. | `sw.js:3`, `tests/validate.cjs` |
| M8 | **Gemini verimliliği.** `responseSchema` yok; Daily en kötü durumda 5 deneme × 3 model × 15 sn ≈ 225 sn, her denemede 10 kelimenin tam detayı isteniyor. | `index.html:4051`, `:3962` |
| M9 | **Açılış hatası yanlış teşhis ediliyor.** Her hata (render hatası dahil) "Veritabanı açılamadı" olarak gösteriliyor. | `index.html:3391` |

### Düşük

| # | Bulgu | Yer |
|---|---|---|
| L1 | `aiPreparing` ve `dailyPreparing` Türkçe sözlükte İngilizce kalmış. | `index.html:2468` |
| L2 | "Sınırsız" için iki farklı regex var; seçim ve dil değişimindeki olan `Unbegrenzt`/`Ilimitado`/`Illimitato`'yu tanımıyor. | `:3141`, `:3295` vs `:3416` |
| L3 | Sabit İngilizce metinler: "Word details could not be loaded.", dinamik panellerde `aria-label="Close"` ve "Swipe actions", açılış ekranında "↻" / "JSON ↓". | `:4718`, `:4656` |
| L4 | Import doğrulaması `progress` alan tiplerini ve `meta`'yı denetlemiyor; 50 MB sınırı mobil için yüksek. | `storage.js:29`, `pwa.js` |
| L5 | `localDictionary` ve `getSavedWordMap` düz `{}` kullanıyor; `__proto__` adlı kelime prototipi değiştirir. | `index.html:2870`, `:3914` |
| L6 | IndexedDB bağlantısı kapanırsa (`onclose`) yeniden açılmıyor; yenilemeye kadar yazmalar başarısız olur. | `storage.js:52` |
| L7 | SW kaydı başarısız olunca "İnternet gerekiyor" mesajı yanıltıcı; waiting worker kaybolursa `.container` `inert` takılı kalabilir. | `pwa.js` |
| L8 | Panel başlıklarında metin seçimi ve sağ tık engelli; kelime kopyalanamıyor. | `index.html:4822` |
| L9 | Ölü kod: `clearHistory`, `saveWordData`, `appLanguage` çevirileri, boş `if` bloğu (`:3772`), sahipsiz yorum (`:4550`). | |
| L10 | Bakım: 234 KB tek dosya, 471 `!important`, tek satırlık testler, CI yok; `SHA256SUMS`/`BUILD_INFO` elle güncelleniyor. | |
| L11 | Manifest'te `screenshots` ve `lang` yok; export dosya adı UTC tarihi kullanıyor. | |

### İyi durumda olanlar

- Tüm dinamik HTML `esc()` ile kaçışlanıyor; `data-*` değerleri base64url kodlu.
- Mutasyonlar tek kuyruktan geçiyor; transaction abort olursa committed cache korunuyor.
- Revision kontrolü eski sekmenin yazmasını reddediyor.
- Migration kesintiye dayanıklı; kaynak veri silinmiyor.
- SW yalnızca allowlist'teki same-origin GET'leri yakalıyor; güncelleme kullanıcı onaylı.
- Teslim raporuna göre 39 tarayıcı testi geçmiş (bu audit'te yeniden çalıştırılmadı).

## Yapılacaklar

Efor: **S** = birkaç saat, **M** = 1–2 gün, **L** = daha uzun.

### P0 — hemen (veri güvenliği ve hata) — uygulandı (2026-10-05)
- [x] **S** Açılışta `navigator.storage.persist()` çağır; reddedilirse Ayarlar'da uyar, iOS'ta "Ana Ekrana Ekle" öner. (H1)
- [x] **S** `changeLanguage` ve `clearProgressAndWords` yazmalarını `{backup:true}` ile yap. (H2)
- [x] **M** Arayüz dilini ayrı bir ayar yap (`settings.appLanguage`); dil değişimi veriyi silmesin. (H2)
- [x] **S** Yasaklı liste sıralaması (M1). İlk düzeltme (`.slice(-100)` → `.slice(0,100)`) eksikti: Daily'de aynı çalıştırmada kabul edilen kelimeleri de listeden düşürüyordu. Doğru çözüm: önce bu çalıştırmada kabul edilenler, sonra History (yeniden eskiye), sonra arşiv; üst sınır 100. Random zaten `[History, arşiv]` sırasında olduğu için yalnızca `.slice(0,100)`. Regresyon testi: 150 kayıtta tam eşitlik (`tests/browser.cjs`).
- [x] **S** API anahtarını `x-goog-api-key` header'ına taşı; Ayarlar'a referrer/API kısıtlama notu ekle. (H4)
- [x] **S** Eksik Türkçe çevirileri tamamla. (L1)

> Uygulama notları: `persist()` ilk kullanıcı etkileşiminde istenir (Firefox izin sorabilir), reddedilirse Ayarlar → Veri yedeği altında uyarı çıkar. Sıfırlama/dil değişimi, kelime varsa `before-import` kurtarma kopyasını alır (boş DB kopyayı ezmez). `settings.appLanguage` isteğe bağlı alandır, şema sürümü 1 kalır; kaydı olmayan veri eskisi gibi orijinal dili izler. `sw.js` VERSION 1.0.1.

### P1 — kısa vade (erişilebilirlik ve sağlamlık) — uygulandı
- [x] **M** Detay panellerine ve ana karta "Ezberledim / Ezberden çıkar" butonu; Flip'e klavye kısayolu. (H3)
- [x] **M** Tüm modallara `role="dialog"`, `aria-modal`, focus tuzağı, Escape, focus dönüşü; `label for` ve arama etiketi. (M4)
- [x] **S** Hedef dil metinlerine `lang="{targetLanguage}"`. (M5)
- [x] **S** `connect-src 'self' https://generativelanguage.googleapis.com` içeren CSP meta etiketi. (M6) — 1.0.9. `script-src` ve `style-src` hâlâ `'unsafe-inline'` içerir, çünkü sayfada yaklaşık 100 satır içi `onclick` var; sıkı CSP için aşağıdaki P3 maddesi gerekir.
- [x] **S** `validate.cjs`: ASSETS içeriği değişmiş ama `VERSION` aynıysa test başarısız olsun. (M7)
- [x] **S** "Sınırsız" kontrolünü tek yardımcıya topla; sabit İngilizce metinleri `t()` ile çevir. (L2, L3)
- [x] **S** Açılışta storage hatası ile render hatasını ayrı mesajlarla göster. (M9)

### P2 — orta vade (performans ve UX)
- [x] **M** Gemini'ye `responseSchema`; Daily için toplam süre sınırı. (M8) — Daily'nin toplam bütçesi 45 sn; deneme sayısı 5 olarak kaldı, bütçe sınırlıyor. `responseSchema` canlı Gemini API'ye karşı henüz denenmedi (model reddederse düz JSON moduna dönülür).
- [x] **M** Başka sekme commit ettiğinde, bekleyen işlem yoksa otomatik yenileme; banner yalnızca güvenli olmadığında. (M3) — 1.0.9. Boştaki sekme veriyi ve listeleri sayfayı yenilemeden alır; Ayarlar, Quiz, Flip, AI isteği veya bekleyen yazma varken veri değiştirilmez, banner gösterilir.
- [x] **M** `renderAllLocal`'ı sınırla (son N kart / sayfalama); MutationObserver'ı konteynerle sınırla; 2–5 bin kelimeyle ölç. (M2) — 5000 kelimede açılış 432 ms, commit 267 ms (README → Performans).
- [x] **L** Ölçüm kötü çıkarsa tek snapshot yerine kayıt bazlı store'lara geç. (M2) — Ölçüm gerektirmedi, tek snapshot korundu (yavaşlatılmış CPU'da 5000 kelimede commit 916 ms).
- [x] **S** Import doğrulamasını derinleştir ve boyut sınırını ~10 MB yap; bağlantı kapanınca yeniden aç. (L4, L6)
- [x] **S** Runtime sözlüklerini (`localDictionary`, `getSavedWordMap`) prototipsiz nesne yap. (L5) — 1.0.10. `__proto__` adlı bir kelime eski haritada gerçekten bozulma yaratıyordu; veri katmanı testi artık bunu sınar.
- [ ] **S** Periyodik yedek hatırlatması (ör. 30 günde bir).

### P3 — bakım
- [x] **S** Ölü kodu temizle. (L9) — 1.0.10: `clearHistory`, `saveWordData` ve `searchWord` silindi; kullanılmayan fonksiyon bırakılmadığını bir test denetler.
- [x] **M** Testleri okunur biçime getir; `npm test` için GitHub Actions kur.
- [x] **S** `SHA256SUMS`'ı script ile üret (`npm run checksums`; bir test dosyalarla uyumunu denetler). `BUILD_INFO.json` sürümü elle yükseltilir, `sw.js` ve `index.html` ile uyumunu bir test denetler.
- [ ] **L** Inline `onclick`'leri delegasyona taşı (sıkı CSP için); CSS/JS'i ayrı dosyalara böl, `!important` katmanlarını sadeleştir.
- [x] **S** Manifest'e `screenshots`/`lang`; export dosya adında yerel tarih; başlıkta metin seçimine izin ver. (L8, L11) — 1.0.10. Kelime başlığı seçilip kopyalanabilir; başlığın geri kalanı swipe yüzeyi olarak kalır.

### Rapor kapsamı dışında kalan açık işler
- Gerçek cihazda ve ekran okuyucuyla (NVDA, VoiceOver, TalkBack) erişilebilirlik testi yapılmadı.
- Türkçe dışındaki beş dilin çevirisi insan gözüyle okunmadı.
- `responseSchema` ve model adları gerçek bir Gemini anahtarıyla denenmedi.
