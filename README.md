# Meridyen Haber

Türkçe, kaynak bağlantılı bir haber yayını. Vanilla HTML/CSS/JavaScript, Supabase, GitHub Actions ve Cloudflare Pages kullanır. Haber sayfaları statik HTML'dir; okuyucu içeriği için tarayıcıda JavaScript gerekmez.

## Yerelde çalıştırma

Node.js 24 gerekir.

```sh
npm ci
npm run dev
```

Önizleme: <http://localhost:4173>. Yönetim: <http://localhost:4173/yonetim/>. `PORT` ile port değiştirilebilir.

`npm run build:demo` 21 kurgu haberle `dist/` üretir. Gösterim verisi ayrı `fixtures/` klasöründedir, bütün gösterim sayfaları `noindex` taşır ve gösterim uyarısı içerir. `npm run audit:site` bu çıktının canlıya dağıtımını engeller. `npm run build`, gösterim verisine sessizce geri dönmez; gerçek Supabase bağlantısı ve HTTPS `SITE_URL` ister.

## Kurulum durumu

Tasarım, statik derleme, SQL şeması, RLS, haber toplama/yazma/inceleme betikleri, yönetim paneli, kur uç noktası ve yayın iş akışları hazırlanmıştır. Yerel SQL testleri gerçek PostgreSQL motorunun PGlite sürümünde çalışır. Henüz uzak Supabase projesine migration uygulanmamış, Cloudflare'a dağıtım yapılmamıştır. Mevcut bağlı başka uygulamaların projeleri değiştirilmemiştir.

Canlı kurulum için Meridyen'e ait Supabase projesi, Cloudflare hesabı/projesi, servis anahtarları, gerçek künye bilgileri ve kaynakların kullanım izni gerekir. Varsayılanlar: `AUTO_PUBLISH=false`, reklam kapalı, kaynaklar pasif, yayın iş akışı kapalı. Yönetici girişi, bağlantı eklenene kadar açık bir yapılandırma mesajı gösterir.

## Veritabanı ve yönetici

1. Ücretsiz bir Supabase projesinde `migrations/20261024222533_meridyen_initial.sql` dosyasını SQL Editor üzerinden çalıştırın. Mevcut uygulamaların veritabanlarında çalıştırmayın. Supabase CLI kullanılıyorsa `supabase/migrations`, aynı dosyalara işaret eder; hedef bağlantıyı kontrol ettikten sonra `npx supabase db push` kullanın.
2. Supabase Auth'ta e-posta/şifre kullanıcısı oluşturun; e-postasını onaylayın. Herkese açık kullanıcı kaydını kapatın. Yönetici listesine SQL Editor ile, küçük harfle ekleyin:

   ```sql
   insert into public.admin_users(email) values ('GERCEK_YONETICI_EPOSTASI');
   ```

3. `.env.example` dosyasını `.env` olarak kopyalayın; değerleri yalnızca yerel dosyaya veya GitHub Secrets'a ekleyin. `.env` git dışında tutulur. Tarayıcıya yalnızca Supabase URL'si ve anonim/yayımlanabilir anahtar çıkar; servis anahtarı asla çıkmaz. Legacy JWT'de `role=anon` kontrolü yapılır.
4. `config.js` içindeki `contact.owner`, `contact.email`, `contact.address` alanlarını gerçek bilgilerle doldurun; KVKK metnindeki hizmet bölgesi, saklama süresi ve hukuki sebebi gerçek kurulumunuza göre tamamlayın.
5. Kaynak izinlerini tamamladıktan sonra `npm run sources:import` ve gerçek verilerle `npm run build` çalıştırın.

Bütün tablolarda RLS açıktır. Anonim erişim, yayımlanmış haberlerin kamuya açık sütunları ve aktif kaynakların adı/kimliği ile sınırlıdır. Ham RSS özetleri, denetim kanıtı, bütçe ve yönetici listesi kamuya açılmaz. Yönetici yetkisi, doğrulanmış `auth.users` e-postası ile `admin_users` eşleşmesinden hesaplanır; kullanıcı metadata'sına dayanmaz. Yetkili yardımcı işlevler, sabit `search_path` ile `private` şemasındadır. Kamuya açık bütçe/gönderim RPC'leri yalnızca `service_role` tarafından çağrılabilir.

Yönetici paneli haberleri, denetim bulgularını, kaynakları, istatistikleri ve son iş kayıtlarını gösterir. Değiştirilen metin taslağa ve yeniden incelemeye döner. İnceleme kararını aşarak yayınlamada onay kutusu ve en az 10 karakterlik gerekçe zorunludur. Hassas haberin kaynak koşulu arayüzün yanında SQL trigger'ında da uygulanır.

## Kaynaklar ve modeller

Kullanıcının verdiği dokuz RSS kaynağı `sources.json` içindedir. `Dünya (TR)`, `Dünya` kategorisine eşleştirilir. BBC'nin iki akışı aynı `publisher_key=bbc`, DW'nin iki akışı `publisher_key=dw` kullanır; aynı yayıncının akışları bağımsız kaynak sayılmaz.

Erişim ve kullanım koşullarının durumu [docs/kaynak-kontrolu.md](docs/kaynak-kontrolu.md) dosyasındadır. RSS'nin erişilebilir olması, yeniden kullanım izni sayılmaz. Kaynaklar bu nedenle pasif kayıtlıdır. Yönetim panelinde koşullar adresi ve izin kontrolü kaydedilmeden aktif edilemezler. Kaynak içe aktarımı var olan yönetici tercihlerini üzerine yazmaz. Yeni RSS adresleri önce gerçek HTTP isteğiyle kontrol edilir; yönlendirmelerde de özel ağ adresleri reddedilir.

Sağlayıcı sırası ve model adları `config.js` içindedir. Model adı uydurulmaz:

```sh
npm run preflight -- --discover --feeds
```

Bu komut sağlayıcıların `/models` uç noktalarını sorgular, mevcut ücretsiz model adlarını `config.js` içine yazar ve RSS/kur kontrollerini `artifacts/preflight.json` dosyasına kaydeder. Sonrasında değişiklikleri inceleyip commit edin. Gemini/Groq anahtarı yoksa model listeleri boş kalır. OpenRouter için katalogda sıfır giriş/çıkış fiyatı olan `:free` modeller seçilir. Gemini'de Flash-Lite ailesi, diğerlerinde aile kimliği tanınan modeller kullanılır. Özel sistem talimatları `lib/prompts.mjs` içindedir. Modellerin haber metinleri içindeki talimatları izlememesi istenir.

Gemini ve Groq hesaplarında ücretli faturalandırmayı etkinleştirmeyin. Uygulama kota bittiğinde ücretli bir modele geçmez; 429/hata durumunda belirlenen ücretsiz yedeklere geçer veya işi bekletir. Sağlayıcıların ücretsiz hesap limitleri değişebilir ve yerel günlük 800 istek tavanından daha düşük olabilir. Her gerçek tamamlama denemesi, başarısız olsa da, atomik veritabanı sayacına yazılır. İstek başına en çok üç deneme ve artan bekleme uygulanır.

## Haber ve yayın akışı

```sh
npm run ingest
npm run verify
npm run build
npm run social
```

- RSS'ler 10 saniye zaman aşımı ve boyut sınırıyla okunur. Kaynak hatası diğerlerini durdurmaz. En çok 10 yeni kayıt, kaynaklar arasında dönüşümlü alınır; URL ve normalize başlık+kaynak hash'i veritabanında benzersizdir. İşlenemeyen yazım işleri `pending` kalır.
- Yazar, beş öğeyi tek çağrıda işler. Çıktı şeması, başlık/özet uzunluğu, 120–180 kelimelik ve 2–3 paragraflı gövde ile kategori alanı kontrol edilir. Reklam ve benzeri içerikler model çağrısından önce elenir.
- İki denetçi birbirinin yanıtını görmez. Gerçek sağlayıcı/model aileleri kaydedilir. Aynı sağlayıcı veya aile kullanıldıysa sonuç otomatik yayın için geçerli sayılmaz. Eksik, hatalı veya kotaya takılan denetçi hiçbir zaman `pass` sayılmaz.
- Yerel kurallar sayı/tarih, birim, alıntı, büyük harfli ad adayları, başlık-gövde sayıları, yasaklı ifadeler ve yedi kelimelik aynı alıntıları kontrol eder. Bunlar dilbilimsel ad tanıma veya hakikat kanıtı değildir; muhafazakâr sonuçlar incelemeye düşebilir.
- Çapraz eşleşme, son 12 saatteki kaynak başlıklarının ortak sözcük oranına dayanır. Eşik `.5`, en az üç ortak anlamlı sözcüktür. İngilizce-Türkçe eşleşme için anlamsal çeviri yapılmaz. “İki bağımsız kaynak”, asıl yayıncı ile farklı bir yayıncının eşleşen haberi anlamına gelir.
- İki denetçi `pass`, skorlar en az 80, kurallar temiz ve kaynak koşulu uygunsa `auto_pass` verilir. Ciddi sorunlarda bir kez yeniden yazım yapılır; yeniden yazım sayısı kalıcıdır. Başarısız veya eksik yanıt güvenli biçimde incelemeye bırakılır. Hassas içerik her zaman insan incelemesinde kalır.
- `AUTO_PUBLISH` kapalıdır. Açılması için güncel modeller/kurallarla başarılı **canlı** değerlendirme raporu da gerekir. Yerel test raporu bu kilidi açamaz.

Statik derleme yalnızca `published` haberleri okur. Kategori başına sayfa boyutu 20'dir. Ana sayfa, listeler, arama indeksi, XML dosyaları her derlemede; haber sayfaları içerik/şablon değişince yazılır. Eski ve yayından kaldırılmış sayfalar temizlenir. GitHub önbelleği `dist/` ve derleme manifestini saklar. Haber adresleri `/haber/YYYY/AA/slug/` biçimindedir. 18.000 tekil haber dosyasına yaklaşılınca eski aylar tek arşiv sayfasında toplanır; ay bazlı yönlendirmeler eski bağlantıları korur. 24 MiB üstündeki arşiv derlemeyi durdurur.

`image_url` ileride lisanslı görseller için şemada hazırdır; şu an kapaklar yalnızca yayına ait SVG çizimlerdir. Logo metinleri outline'dır; Source font lisansları `lib/fonts/` içindedir. Marka adı `config.js` içindeki `SITE_NAME` değişkeninden üretilir.

## GitHub Actions ve Cloudflare Pages

Herkese açık GitHub deposunda `.github/workflows/pipeline.yml`, 30 dakikada bir veya elle çalıştırılır. Eşzamanlı ikinci çalışma kuyruğa alınır. İşler: kaynak kontrolü → ingest → verify → build → çıktı kontrolü → Pages dağıtımı → sosyal gönderim. Sosyal bağlantıların açılabilmesi için dağıtım sosyal gönderimden önce yapılır; ayrıca gönderim öncesinde sayfaya HTTP HEAD isteği atılır.

GitHub Actions Secrets:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
GROQ_API_KEY
OPENROUTER_API_KEY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
BLUESKY_HANDLE
BLUESKY_APP_PASSWORD
```

GitHub Actions Variables:

```text
SITE_URL                     Gerçek HTTPS site adresi
CLOUDFLARE_PAGES_PROJECT      Oluşturduğunuz Pages proje adı
PIPELINE_ENABLED             Kurulum tamamlanınca true
```

`GITHUB_REPOSITORY` Actions tarafından sağlanır. Cloudflare token'ı yalnızca ilgili hesapta Pages düzenleme yetkisi taşımalıdır. Pages projesinde ana dal `main` olmalı; dağıtım komutu `npx wrangler pages deploy dist --project-name PROJE_ADI --branch main` şeklindedir. `functions/api/rates.js`, Wrangler tarafından aynı dağıtıma eklenir; Supabase servis anahtarı Cloudflare ortamına yüklenmez. Barındırmada yalnızca bu kur uç noktası sunucu kodudur; veri işleyen Node betikleri GitHub Actions'ta çalışır.

Başarılı zamanlanmış çalışmada günde bir kez etkinlik commit'i atılır. Bu önlem GitHub'ın zamanlanmış işlere ilişkin hareketsizlik davranışını azaltmayı amaçlar, kesintisiz çalışma garantisi vermez. Zamanlama tam dakikasında çalışmayabilir; bu nedenle “en geç 30 dakika” bir zamanlama hedefidir. Acil durumda Actions sayfasından `Run workflow` kullanılabilir. Her ingest turu Supabase'i okur ve çalışma kaydı yazar; ücretsiz proje durdurulmasını tümüyle garanti edemez. `pipeline_runs` kayıtları ve GitHub bağlantısı panelden izlenebilir.

Cloudflare Pages ücretsiz sınırları 24 Ekim 2026'da kontrol edildi: site başına **20.000 dosya**, tek dosyada **25 MiB**. Ücretli planlardaki yüksek dosya sınırına dayanılmaz. GitHub'da derlenip Wrangler Direct Upload ile yüklenir; Cloudflare tarafında Git tabanlı derleme kurulması gerekmez. Güncel limitler: <https://developers.cloudflare.com/pages/platform/limits/>.

## Kur ve sosyal kanallar

USD/TRY ve EUR/TRY, anahtarsız Frankfurter API'den alınır; ECB kaynaklı günlük veridir, anlık fiyat değildir. EUR/TRY, USD/TRY ÷ USD/EUR ile hesaplanır. BTC/TRY, CoinGecko'nun herkese açık `simple/price` uç noktasından gelir. Her iki adres gerçek HTTP isteğiyle kontrol edilmiştir. Güvenilir, kullanım koşulları net bir ücretsiz altın kaynağı eklenmediğinden gram altın gösterilmez.

Kur yanıtı Cloudflare Cache API ile beş dakika saklanır; istemci beş dakikada bir yeniler. Hata veya kota durumunda ilgili değer `—` olur. Ayrı bölgelerin önbellekleri farklı olabilir. Frankfurter anahtar ve kullanım kotası olmadan sunulur: <https://frankfurter.dev/>. CoinGecko herkese açık servisinde kota değişebilir; güncel dokümanlar yaklaşık 30 istek/dakika, trafiğe bağlı değişim ve atıf koşulları belirtir: <https://docs.coingecko.com/reference/common-errors-rate-limit>, <https://www.coingecko.com/en/api_terms>. CoinGecko atfı şeridin altında gösterilir. Kod ücretli API anahtarı veya Pro uç noktası kullanmaz.

Telegram ve Bluesky yalnızca kendi kanal anahtarları verilirse çalışır. Her haber/kanal çifti tek kuyruk kaydıdır. Toplam saatte en çok altı gönderim denemesi ve kayıt başına en çok üç deneme uygulanır. Zaman aşımı gibi sonucu belirsiz Telegram gönderimleri tekrar gönderilmez, `uncertain` olur. Bluesky kaydı sabit anahtarla yazılarak yinelenme azaltılır. Hassas haberlerde editör onay kaydı aranır. Metin başlık ve bağlantıdan oluşur. Anahtarlar yokken herhangi bir sosyal gönderim yapılmaz.

## Kontroller

```sh
npm test
npm run eval
npm run test:build
npm run build:demo
npm run preview
npm run test:browser
node scripts/audit.mjs --allow-demo
```

`test:browser`, sistem Chromium'unu veya Playwright Chromium'unu kullanır. Gerekirse `npx playwright install chromium` çalıştırın veya `CHROMIUM_PATH` belirtin. 375, 768, 1440 px düzenler, JavaScript kapalı okuma, yerel bağlantılar, arama, menü, çerez tercihleri ve axe WCAG AA kontrolleri yapılır. Ekran görüntüleri `artifacts/` içine yazılır. Lighthouse ölçümleri ve son kontrol sonuçları [docs/dogrulama.md](docs/dogrulama.md) dosyasındadır.

`scripts/eval/` içinde 10 tutarlı, 10 kasıtlı bozulmuş örnek bulunur. Yanlış sayı, isim, alıntı, tarih, neden-sonuç ve başlık çelişkileri içerir. Yerel çalıştırıcı test denetçileriyle karar/veri akışını sınar; sonuçları `eval-results/offline.json` dosyasına yazar. Bu rapor **canlı model başarımı değildir** ve otomatik yayını açmaz. Canlı test için:

```sh
npm run eval:live
```

Canlı test, aynı `verify.mjs` denetim/karar çekirdeğini kullanır. İlk metnin inceleme kararını ölçer; yeniden yazım sınırı ayrıca regresyon testinde kontrol edilir. Bozuk örneklerin en az %90'ı `auto_pass` dışında, doğru örneklerin en az %70'i `auto_pass` olmalıdır. Her iki denetçinin yanıtı alınmadan canlı test geçmez. `eval-results/live.json` modeli/kuralları tanımlayan parmak izi içerir; 30 gün sonra veya model/talimat/kural değişiminde geçersizleşir. Canlı rapor olmadan `AUTO_PUBLISH=true` yapılsa bile betik otomatik yayınlamaz.

## Sorun giderme

- **Model listesi boş / 429:** ilgili anahtarı ve hesap kotasını kontrol edin; `preflight --discover` sonrasında model değiştiyse canlı değerlendirmeyi yeniden çalıştırın. Ücretli modele geçmeyin.
- **RSS HTML döndürüyor:** gerçek bir RSS/Atom adresi gerekir; kaynak pasif bırakılmalıdır. DW Türkçe'nin verilen adresi kontrolde XML döndürmedi. NYT, bu çalışma ortamının ağ geçidinde engellendi; bu küresel bir servis arızası olduğu anlamına gelmez.
- **Kaynak yetkisi belirsiz:** RSS'nin açılması izin sağlamaz; kullanım koşullarını ve gerekli yayıncı iznini netleştirin.
- **Yayınla reddediliyor:** hassas haberlerde farklı yayıncıdan eşleşme, diğer incelemelerde gerekçe/onay ve kaydedilmiş taslak gerekir. Tarayıcıdaki bir kısıtı kaldırmak veritabanı kuralını kaldırmaz.
- **Haberde değişiklik sitede yok:** statik derlemenin ve Cloudflare dağıtımının tamamlandığını kontrol edin. Panel güncellemesi tek başına statik dosyayı değiştirmez.
- **Kur yok:** ücretsiz uç nokta hata/kota döndürmüş olabilir. Haber içeriği etkilenmez.
- **Gönderim belirsiz:** `uncertain` kaydını yeniden kuyruğa almadan önce kanaldaki gönderimi kontrol edin.
- **Dağıtım kontrolü durdu:** gösterim verisi, eksik künye, dosya sınırı veya gizli değer kontrolü çıktısını inceleyin.

## Gizlilik

Okuyucuda üyelik, reklam/analitik izleyicisi veya yorum formu yoktur. Tercih bandının seçimi yalnızca `localStorage` içinde tutulur; kabul ilave bir izleme başlatmaz. Yönetici oturumu Supabase Auth kullanır. Google Fonts ve dış bağlantılarla oluşan veri akışı gizlilik metninde açıklanır. Çerezsiz analitik isteğe bağlıdır ve varsayılan olarak eklenmemiştir. KVKK ve künye yer tutucuları gerçek işletmeci bilgileriyle tamamlanmalıdır.
