# Okunuş ve içerik onayı: kime ne gönderilecek

Beş pilot çiftin her biri için 50 kartlık A1 örneklemi hazır (kelimeler listeye eşit aralıkla seçildi). Her kart: anlam, tür, eş/zıt anlamlılar, iki örnek cümle (okunuş + çeviri), varsa kalıp.

| Çift | Dosya | Kim bakmalı | Okunuş kuralları |
|---|---|---|---|
| Almanca → Türkçe | `wordbase/de-tr/REVIEW-A1.md` | Almanca ve Türkçe bilen | `STYLE-de-tr.md` |
| İspanyolca → Türkçe | `wordbase/es-tr/REVIEW-A1.md` | İspanyolca ve Türkçe bilen | `STYLE-es-tr.md` |
| İtalyanca → Türkçe | `wordbase/it-tr/REVIEW-A1.md` | İtalyanca ve Türkçe bilen | `STYLE-it-tr.md` |
| İngilizce → Türkçe | `wordbase/en-tr/REVIEW-A1.md` | İngilizce ve Türkçe bilen | `STYLE-en-tr.md` |
| Türkçe → Fransızca | `wordbase/tr-fr/REVIEW-A1.md` | Türkçe ve Fransızca bilen | `STYLE-tr-fr.md` |

`wordbase/fr-tr/REVIEW-A1.md` (Fransızca → Türkçe) daha önce hazırlanmış kursun örneklemidir.

## Her kartta bakılacaklar
1. **Anlam ve tür:** doğru mu, en sık anlam mı? Cinsiyet (Almanca der/die/das, İspanyolca/İtalyanca eril/dişil) doğru mu?
2. **Cümleler:** doğal ve basit mi? İki cümle farklı kullanımı mı gösteriyor? Çeviri doğal mı?
3. **Okunuş:** Türkçe okuyan (Türkçe → Fransızca için Fransızca okuyan) biri okunuşu sesli okuyunca hedef dile yakın bir ses çıkıyor mu?
4. **Kalıp:** doğal ve sık kullanılan bir deyim mi?

## Nasıl geri bildirilecek
Her hata için bir satır yeterli, örneğin:

```
de-tr / kart 7 / okunuş: "gutı naht" → "gute naht" (neden: ...)
es-tr / kart 12 / anlam: "arkadaş" → "dost; arkadaş"
```

Tekrar eden bir hata türü bulunursa (örneğin "her `-en` sonu yanlış") bir kuralı düzeltmek yüzlerce kelimeyi düzeltir; bu yüzden **kural düzeyinde** geri bildirim en değerlisi.

## Ne için kullanılacak
- Düzeltmeler ilgili `STYLE-*.md` tablosuna işlenecek ve kaynaklardaki ilgili okunuşlar toplu olarak yeniden yazılacak.
- Onaydan sonra kalan kelimelerin (A1 kalanı, A2, B1) üretimine geçilecek.
