# Doğrulama raporu

24 Ekim 2026. Çalışma ortamı: Node.js 24, Chromium, Playwright, axe ve PostgreSQL 17 uyumlu PGlite. Bu rapor yerel uygulama doğrulamasıdır; uzak Supabase, model servisleri ve canlı Cloudflare dağıtımı tamamlanmış sayılmaz.

## Tamamlanan kontroller

| Kontrol | Sonuç |
| --- | --- |
| Kod/veritabanı testleri | 20/20 geçti |
| Gerçek PostgreSQL motorunda migration | SQL uygulandı; tablo, politika, trigger ve RPC'ler çalıştırıldı |
| RLS | Anonim taslak erişimi, iç sütun erişimi ve yetkisiz yönetici işlemleri engellendi |
| Yayın koşulları | Eksik denetim, düşük skor, aynı aile/sağlayıcı ve yetersiz kaynak durumları engellendi |
| Editör akışı | Gerekçe/onay zorunlu; değişen metin taslağa dönüyor |
| Günlük bütçe | 802 denemeden yalnızca 800 rezervasyon verildi |
| Yerel değerlendirme | 10/10 tutarlı örnek uygun, 10/10 bozuk örnek uygun kararının dışında; test denetçileri kullanıldı |
| Statik derleme entegrasyonu | Yayımlanmış veri filtresi, 20'lik sayfalama, XML ve istemciye servis anahtarı çıkmaması geçti |
| Artımlı derleme | Değişiklik yokken 0, yalnızca gövde değişince 1 haber sayfası yazıldı |
| Yayından kaldırma | Eski HTML dosyası ve arama kaydı temizlendi |
| Tarayıcı düzenleri | 7 sayfa × 3 genişlik; 375, 768 ve 1440 px'de yatay taşma yok |
| Yerel bağlantılar | 41 sayfa başarıyla açıldı |
| JavaScript kapalı | Ana sayfa, kategori ve haber içerikleri görünür; mobil menü klavyeyle çalışıyor |
| Erişilebilirlik | Ana sayfa/haber detayı, mobil/masaüstü; axe WCAG A/AA ihlali yok |
| Arama ve çerez | Eşleşen/eşleşmeyen arama, tercih saklama ve bandın kapanması geçti |
| Cloudflare Function | Wrangler ile derlendi; yerel Pages sunucusunda HTTP 200 ve 5 dakikalık Cache API hit doğrulandı |
| Güvenlik başlıkları | Yerel Pages üzerinde CSP uygulandı; çerez ve arama betikleri CSP altında çalıştı |
| Bağımlılıklar | `npm audit` tüm bağımlılıklarda 0 açık bildirdi |
| Çıktı taraması | 71 dosyada gizli değer, yayın dili ve dosya boyutu kontrolü geçti |

Cloudflare'ın yerel çalışma zamanı bu ortamda dış servislere ulaşamadığından kur yanıtındaki değerler `null` döndü; görünümdeki karşılığı `—` oldu. Aynı uç noktaların gerçek HTTP yanıtları Node/proxy üzerinden ayrıca alındı. Başarılı fiyat dönüşümü ve çapraz kur hesabı birim testinde, gerçek Cache API hit ise yerel çalışma zamanında doğrulandı.

## Lighthouse

| Yerel sayfa | Sürüm | Performans | Erişilebilirlik | En iyi uygulamalar | SEO |
| --- | --- | ---: | ---: | ---: | ---: |
| İndekslenebilir yayın şablonu, mobil ana sayfa | 13.5.0 | 100 | 100 | 100 | 100 |
| İndekslenebilir yayın şablonu, mobil haber detayı | 13.5.0 | 99 | 100 | 100 | 100 |
| Gösterim önizlemesi, mobil | 13.0.3 | 100 | 100 | 100 | 66 |
| Gösterim önizlemesi, masaüstü | 13.0.3 | 100 | 100 | 100 | 66 |

İndekslenebilir şablon testi, yerel bir Supabase HTTP taklidi ve açıkça işaretlenmiş kurgu kayıtlarla ayrı `artifacts/production-fixture` klasöründe üretildi. Gerçek veritabanından veya canlı site üzerinden ölçüm yapılmadı. Bu çıktı varsayılan `dist/` dosyalarını değiştirmez; test işareti taşıyan çıktı yayın kontrolünden geçemez. SEO etiketleri, JSON-LD ve haber site haritası bu yerel üretim yolunda kontrol edildi.

Gösterim sayfalarındaki SEO puanı, bilerek konulan `noindex` ve `Disallow: /` nedeniyle düşüktür. Bu işaretler önizleme haberlerinin arama motorlarına gerçek haber olarak çıkmasını engeller. Ölçüm puanları ortama ve ağ koşullarına göre değişebilir; canlıya çıktıktan sonra gerçek adreste yeniden ölçüm gerekir.

## Görüntüler ve raporlar

- [Ana sayfa — masaüstü](screenshots/home-desktop.png)
- [Ana sayfa — mobil](screenshots/home-mobile.png)
- [Haber detayı — masaüstü](screenshots/article-desktop.png)
- [Haber detayı — mobil](screenshots/article-mobile.png)
- [Tarayıcı raporu](tarayici-raporu.json)
- [Uç nokta kontrolü](son-on-kontrol.json)
- [Yerel değerlendirme çıktısı](../eval-results/offline.json)

Tam Lighthouse HTML/JSON raporları yerelde `artifacts/` içindedir. GitHub kod kontrolü tamamlandığında ekran görüntüleri ve yerel raporlar iş akışı artifact'ından da indirilebilir.

## Henüz doğrulanamayanlar

- Meridyen'e ait uzak Supabase projesinde migration, Auth oturumu ve RLS/advisor kontrolü. Bağlı başka uygulamaların projelerine işlem yapılmadı. Yerel Supabase servis yığını başlatılmadığından CLI migration-list bağlantısı kurulamadı; SQL testleri PGlite ile yapıldı.
- Gerçek Gemini/Groq/OpenRouter tamamlama çağrıları ve canlı 20 örneklik model ölçümü. Anahtarlar yok. `AUTO_PUBLISH` ve canlı değerlendirme kilidi kapalı.
- Cloudflare hesabında gerçek Pages dağıtımı, üretim adresinde önbellek ve Lighthouse.
- Telegram/Bluesky'ye gerçek gönderim. Kanal anahtarları verilmedi; ileti gönderilmedi.
- Kullanıcı, yeniden kullanım izni/lisansı olmadığını bildirip tüm kaynakların pasif kalmasını istedi; bu karar uygulandı. Verilen DW Türkçe adresinin geçerliliği ve NYT RSS erişimi ayrıca çözümlenmedi.
- Gerçek site sahibi/iletişim bilgileriyle künye ve KVKK metninin tamamlanması.
