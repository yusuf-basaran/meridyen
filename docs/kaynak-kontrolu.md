# RSS ve kullanım koşulları kontrolü

Kontrol tarihi: 24 Ekim 2026. Kaynaklar kullanıcının verdiği listeden alınmıştır. Kullanıcı, izin/lisansı olmadığını bildirip kaynakların pasif kalmasını istemiştir. Dokuz kaynak da pasiftir.

| Kaynak | HTTP / içerik sonucu | Kullanım durumu |
| --- | --- | --- |
| Anadolu Ajansı | Proxy üzerinden HTTP 200 ve RSS XML; Node'un yerel DNS kontrolü bu ortamda hostname'i çözemedi | İzin/koşul kaydı bekleniyor |
| BBC Türkçe | HTTP 200, RSS ayrıştırıldı | İzin/koşul kaydı bekleniyor |
| Bloomberg HT | HTTP 200, RSS ayrıştırıldı | İzin/koşul kaydı bekleniyor |
| DW Türkçe | HTTP 200; 28 baytlık yanıt RSS/Atom XML değil | Geçerli adres ve izin durumu gerekiyor |
| BBC News World | HTTP 200, RSS ayrıştırıldı | İzin/koşul kaydı bekleniyor |
| The Guardian World | HTTP 200, RSS ayrıştırıldı | RSS bilgi sayfası kişisel, ticari olmayan kullanım sınırı belirtiyor |
| NYT World | Ortamın proxy tüneli 403 verdi | Erişim ve izin bu ortamda doğrulanamadı |
| NPR World | HTTP 200, RSS ayrıştırıldı | Koşullarda kişisel/ticari olmayan kullanım ve yeniden yayın kısıtları var |
| DW English | HTTP 200, RDF RSS ayrıştırıldı | İzin/koşul kaydı bekleniyor |

İncelenen koşullar: [Guardian RSS](https://www.theguardian.com/help/feeds), [NPR kullanım koşulları](https://www.npr.org/about-npr/179876898/terms-of-use). Bu tespit, içerik kullanımı için hukuki izin vermez. Kullanıcının izin/lisansı olmadığı ve kaynakların pasif kalması yönündeki yanıtı kaydedilmiştir. BBC koşulları için denenen sayfa 404 verdi; geçerli bir koşul sayfası bulunduğu iddia edilmez.

`sources.json` kaynak adını, kullanıcının verdiği tam RSS adresini, kategori ve güven düzeyini korur. İlgisiz veya örnek RSS adresi eklenmemiştir. BBC ve DW'nin farklı dil akışları ayrı bağımsız yayıncı olarak değerlendirilmez. Örnek testlerde kullanılan `example.invalid` yalnızca ağ isteği yapılmayan test verisidir, kaynak listesine eklenmez.
