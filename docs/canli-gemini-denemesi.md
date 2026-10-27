# Canlı Gemini denemesi

GitHub Actions → **Canlı Gemini denemesi** işi, yalnızca güncel ve izinli bir NASA haber açıklamasının başlığı/kısa alıntısıyla kısa Türkçe bir taslak üretir. İki inceleme istemi gerçek model yanıtlarıyla çalışır. Sonuç yalnızca Actions raporundadır; siteye, sosyal kanallara veya veritabanına gönderilmez.

Bu kontrol tam haber üretimi ve değerlendirme akışının yerine geçmez. Kısa kaynak, 120–180 kelimelik habere genişletilmez. Global Voices metinleri bu denemede harici modele gönderilmez. İzin bekleyen kaynaklar etkinleştirilmez.

En fazla üç Gemini üretim isteğine izin verilir; başarısız denemeler de bu sınıra dahildir. Yalnızca yapılandırmada onaylı ve gerçek hesap kataloğunda bulunan modeller kullanılır. Anahtar yalnızca çağrı adımına aktarılır; değeri rapora yazılmaz. Hesapta ücretli kullanım etkinleştirilmemelidir; kod hesap faturalandırmasını değiştirmez veya ücretsiz kotayı artırmaz.

İş dosyaları ana dala değişiklikle geldiğinde ve elle çalıştırıldığında deneme yapılır; zamanlanmış üretim yoktur. Tam yanıt alınması, metnin doğru olduğu anlamına gelmez: denetçi ve yerel kural bulguları ayrıca okunmalıdır. Eksik/geçersiz yanıt işi başarısız yapar. Aynı Gemini modeline verilen iki istem bağımsız denetim sayılmaz. Otomatik yayın ve canlı yayın değerlendirme kilidi kapalı kalır.
