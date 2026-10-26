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

### Vercel ve ücretsiz kaynak akışı

Vercel varsayılanı artık `sources` modudur: Global Voices’in CC BY 3.0 kapsamındaki metinleri ve NASA’nın haber açıklamalarından özgün başlıklar/kısa alıntılar gösterilir. İngilizce oldukları belirtilir; yazar, özgün haber bağlantısı ve lisans/koşullar her kartta bulunur. Metinler en fazla 60 kelimelik alıntılardır; çeviri veya Meridyen tarafından yazılmış haberler olarak sunulmaz. Fotoğraflar alınmaz. Başlıklar, kategori sayfaları ve arama JavaScript olmadan da kullanılabilir; arama filtrelemesi JavaScript gerektirir.

Kaynak listesi `free-sources.json`, güncel kayıtlar `data/free-feed.json` içindedir. Bu akış ayrı bir veritabanı, servis anahtarı veya model API’si gerektirmez. Yeni bir veritabanı hizmetine geçiş yapılmamıştır. Eski dokuz ajans kaynağı `sources.json` içinde pasif kalır. Üretilen haberlerin mevcut inceleme/yayın kilitleri değiştirilmez.

```sh
npm run sources:refresh
npm run build:sources
npm run preview
```

**Ücretsiz kaynak akışı** GitHub Actions işi yaklaşık 30 dakikada bir RSS’leri kontrol eder. Değişiklik varsa yalnızca veri dosyasını commit eder; bağlı Vercel Git entegrasyonu dağıtımı yeniler. Zamanlama tam dakikada çalışma garantisi vermez. Hata veren kaynağın son kaydı korunur; 14 günden eski ve gelecekteki kayıtlar gösterilmez. Aynı içerik için gereksiz commit atılmaz. Global Voices Türkçe’nin son kaydı 2021 tarihli olduğu için alınmadı; VOA’da üçüncü taraf ajans içeriğini güvenilir biçimde ayıran bir akış doğrulanamadığından eklenmedi. [Kaynak incelemesi](docs/ucretsiz-kaynaklar.md).

`vercel.json`, `dist/` çıktısını ve `npm run build:vercel` komutunu tanımlar. `SITE_URL` açıkça verilmezse Vercel sistem değişkenlerinden üretimde `VERCEL_PROJECT_PRODUCTION_URL`, önizlemede `VERCEL_URL` kullanılır. Sistem değişkenleri kapalıysa kaynak/hazırlık derlemesi canonical adres olmadan tamamlanır. [Vercel sistem değişkenleri](https://vercel.com/docs/environment-variables/system-environment-variables).

`MERIDYEN_BUILD_MODE=launch` boş hazırlık sayfasını seçer. `MERIDYEN_BUILD_MODE=production` ise veritabanından incelemesi tamamlanmış haberleri derler; gerçek mod eksik veritabanı veya künye durumunda kaynak/gösterim moduna geri dönmez. Künye ve tam yayın kurulumu tamamlanana kadar kaynak/hazırlık modları `noindex` ve `robots.txt` ile arama motorlarına kapalı tutulur. `npm run build` gerçek derleme olarak kalır.

`/api/rates` Vercel ve Cloudflare’da aynı kur hesaplamasını kullanır. Vercel güvenlik başlıkları `vercel.json` içinde tanımlıdır. Mevcut veritabanlı zamanlanmış haber/yayın akışı hâlâ Cloudflare içindir; ücretsiz kaynak akışı bu akıştan bağımsızdır. Üretimde aylık haber arşivleri kullanılacaksa Cloudflare `_redirects` yönlendirmeleri Vercel’e ayrıca aktarılmalıdır.

Tasarım, statik derleme, SQL şeması, RLS, haber toplama/yazma/inceleme betikleri, yönetim paneli, kur uç noktası ve yayın iş akışları hazırlanmıştır. Yerel SQL testleri gerçek PostgreSQL motorunun PGlite sürümünde çalışır. Cloudflare'da `meridyen` Pages projesi `main` dalıyla oluşturuldu; hedef adres `https://meridyen.pages.dev`. Henüz uzak Supabase projesine migration uygulanmamış ve Cloudflare dağıtımı yapılmamıştır. Vercel’de ilk hazırlık dağıtımı 26 Ekim’de başarıyla tamamlandı. Mevcut bağlı başka uygulamaların projeleri değiştirilmemiştir.

Canlı kurulum için Meridyen'e ait Supabase projesi, Cloudflare hesabı/projesi, servis anahtarları, gerçek künye bilgileri ve kaynakların kullanım izni gerekir. Varsayılanlar: `AUTO_PUBLISH=false`, reklam kapalı, kaynaklar pasif, yayın iş akışı kapalı. Yönetici girişi, bağlantı eklenene kadar açık bir yapılandırma mesajı gösterir.

Kullanıcı, kaynaklar için izin/lisansı olmadığını bildirerek tümünün pasif kalmasını istedi. `sources.json` bu kararı uygular. Kaynak kodunun hedef deposu: [yusuf-basaran/meridyen](https://github.com/yusuf-basaran/meridyen).

25 Ekim'de kullanıcı veritabanı kurulumunu erteledi. Yeni Supabase projesi oluşturulmadı; alternatif bir veritabanına geçiş yapılmadı. Aşağıdaki Supabase adımları mevcut kod için referanstır; canlı yayın veritabanı kararı ve eksik hesap bilgileri tamamlanana kadar bekler.

## GitHub üzerinden ilk kurulum

Cloudflare proje adı, hesap kimliği ve hedef adres `config.js` içindeki `deployment` alanında hazırdır. İlk yayın için GitHub Secrets'a `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ve `CLOUDFLARE_API_TOKEN` eklenmelidir. Gerçek Meridyen veritabanında aşağıdaki migration uygulanmış olmalıdır. Anahtarları sohbete veya kaynak dosyalara yazmayın.

GitHub **Actions → Haber yayını → Run workflow** formunda site sahibi, iletişim e-postası ve adresi doldurun. Bu bilgiler sitede görünür. Akış eksik anahtarları/veritabanı şemasını kontrol eder, dokuz kaynak kaydını pasif ekler, Pages projesini kontrol eder (gerekiyorsa oluşturur), gerçek site adresini belirler ve dağıtır. Başarılı dağıtımda künye bilgileri `config.js` içine commit edilir. İlk yayında bilgisayarınızda komut çalıştırmanız gerekmez.

**Actions → Kurulum kontrolü** akışı, eksik bilgileri ve veritabanı durumunu yalnızca ad/durum olarak raporlar; anahtar değerlerini göstermez. Akışın başarılı çalışması kurulumun hazır olduğu anlamına gelmez; özetteki `Kurulum: hazır/eksikler var` sonucuna bakın. Kontrol yerelde `node scripts/setup-check.mjs --report-only` ile de çalıştırılabilir.

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

Herkese açık GitHub deposunda `.github/workflows/pipeline.yml` elle çalıştırılabilir. 30 dakikalık zamanlama, `PIPELINE_ENABLED=true` olduğunda açılır. Eşzamanlı ikinci çalışma kuyruğa alınır. İşler: künye/kurulum kontrolü → kaynak kayıtları → ingest → verify → Pages projesi/adresi → build → çıktı kontrolü → Pages dağıtımı → sosyal gönderim. Sosyal bağlantıların açılabilmesi için dağıtım sosyal gönderimden önce yapılır; ayrıca gönderim öncesinde sayfaya HTTP HEAD isteği atılır.

GitHub Actions Secrets:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
GROQ_API_KEY
OPENROUTER_API_KEY
CLOUDFLARE_API_TOKEN
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
BLUESKY_HANDLE
BLUESKY_APP_PASSWORD
```

`CLOUDFLARE_ACCOUNT_ID` yalnızca `config.js` içindeki hazır hesap kimliğini değiştirmek isterseniz ayrıca Secret olarak eklenir.

İsteğe bağlı GitHub Actions Variables:

```text
SITE_URL                     Özel alan adı kullanıyorsanız gerçek HTTPS adresi
CLOUDFLARE_PAGES_PROJECT      Farklı bir Pages projesi kullanıyorsanız proje adı
PIPELINE_ENABLED             30 dakikalık zamanlamayı açmak için true
```

`GITHUB_REPOSITORY` Actions tarafından sağlanır. Cloudflare token'ı yalnızca ilgili hesapta Pages düzenleme yetkisi taşımalıdır. Hazır proje `meridyen` ve ana dal `main` kullanılır. Proje/adres kontrolü Pages API üzerinden yapılır; 401/403 hatalarında yeni proje oluşturulmaz. Farklı GitHub deposuna bağlı proje veya farklı üretim dalı otomatik değiştirilmez. Dağıtım komutu `npx wrangler pages deploy dist --project-name PROJE_ADI --branch main` şeklindedir. `functions/api/rates.js`, Wrangler tarafından aynı dağıtıma eklenir; Supabase servis anahtarı Cloudflare ortamına yüklenmez. Barındırmada yalnızca bu kur uç noktası sunucu kodudur; veri işleyen Node betikleri GitHub Actions'ta çalışır.

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
