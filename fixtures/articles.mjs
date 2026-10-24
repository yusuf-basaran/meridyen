import { slugify } from '../lib/slug.mjs';

const rows = [
  ['Gündem', 'Kentlerde ulaşımın yeni rotası: raylı sistem ve yaya odaklı planlama', 'Kent içi ulaşımda aktarma noktaları, yaya yolları ve toplu taşıma bağlantıları birlikte ele alınıyor. Yeni planlamaların odağında günlük yolculukları kolaylaştırmak var.', 'Kent içindeki yolculukların daha erişilebilir hâle gelmesi için raylı sistem bağlantıları ve yaya güzergâhları üzerine hazırlanan planlar ele alındı. Ulaşım planlamasına ilişkin değerlendirmede, istasyon çevrelerindeki yürüme yollarının toplu taşıma ağının bir parçası olarak düşünülmesi gerektiği belirtildi.\n\nÇalışmada, farklı ulaşım araçları arasında geçişin kolaylaştırılması ve mahallelerden duraklara erişimin iyileştirilmesi öne çıktı. Düzenlemelerin günlük yaşam üzerindeki etkisinin, uygulama alanlarına ilişkin değerlendirmelerin ardından ele alınacağı bildirildi.'],
  ['Ekonomi', 'Yerel üreticiler yeni hasat dönemine hazırlanıyor', 'Üreticilerin hazırlıklarında depolama, dağıtım ve yerel pazarlara erişim öne çıkıyor.'],
  ['Dünya', 'Avrupa kentlerinde ortak gündem: kamusal alanların geleceği', 'Şehirlerin dönüşümü üzerine yapılan görüşmelerde erişilebilirlik ve yeşil alanlar ele alındı.'],
  ['Teknoloji', 'Dijital arşivler kültürel mirasa erişimi genişletiyor', 'Kütüphane ve arşiv koleksiyonlarının dijital ortama aktarılması, araştırmacılara yeni olanaklar sunuyor.'],
  ['Bilim', 'Deniz araştırmalarında uzun süreli gözlemin önemi', 'Araştırmacılar, deniz ekosistemlerindeki değişimleri izlemek için düzenli veri toplanmasının önemini vurguladı.'],
  ['Spor', 'Genç sporcular yeni sezon hazırlıklarını sürdürüyor', 'Antrenman programlarında takım çalışması ve temel becerilerin geliştirilmesi öne çıkıyor.'],
  ['Sağlık', 'Kent parklarında erişilebilir yürüyüş yolları gündemde', 'Açık alanların herkesin kullanımına uygun düzenlenmesi için yürüyüş güzergâhları değerlendiriliyor.'],
  ['Gündem', 'Mahalle kütüphanelerinde okuma alanları genişliyor', 'Yeni okuma alanlarında sessiz çalışma bölümleri ve çocuk kitaplıkları birlikte planlanıyor.'],
  ['Ekonomi', 'Kooperatifler yerel pazarlarda doğrudan satışa yöneliyor', 'Üretici ile tüketici arasındaki bağlantıyı güçlendirmeyi amaçlayan çalışmalar ele alınıyor.'],
  ['Dünya', 'Akdeniz kentleri kıyıların korunmasını görüşüyor', 'Kıyı bölgelerinin kullanımı ve doğal alanların korunması toplantının başlıca konuları oldu.'],
  ['Spor', 'Amatör kulüpler için ortak antrenman alanları', 'Mahallelerdeki spor alanlarının kullanımına ilişkin yeni düzenlemeler değerlendiriliyor.'],
  ['Teknoloji', 'Açık kaynak projeleri üniversite topluluklarını buluşturuyor', 'Öğrenciler, ortak yazılım projeleri üzerinden deneyim paylaşımında bulunuyor.'],
  ['Bilim', 'Gözlemevlerinde sonbahar gözlemleri başladı', 'Gökyüzünü izlemek isteyenler için düzenlenen etkinliklerde temel gözlem yöntemleri anlatılıyor.'],
  ['Sağlık', 'Günlük yaşamda dinlenme alanlarına duyulan ihtiyaç', 'Kamusal mekânların tasarımında oturma alanları ve gölgeliklerin erişilebilirliği tartışılıyor.'],
  ['Gündem', 'Tarihi çarşıda restorasyon çalışmaları ele alındı', 'Yapıların korunması ile çarşının günlük kullanımı birlikte değerlendiriliyor.'],
  ['Ekonomi', 'Küçük işletmelerde ortak lojistik arayışı', 'Dağıtım süreçlerinde iş birliği olanakları işletmelerin gündeminde yer alıyor.'],
  ['Teknoloji', 'Yeni nesil sensörlerle su tüketimi takip ediliyor', 'Ölçüm sistemleri, tesislerdeki su kullanımının daha yakından izlenmesine olanak tanıyor.'],
  ['Bilim', 'Tohum koleksiyonları araştırmacılara kapılarını açıyor', 'Bitki çeşitliliğinin korunmasına yönelik koleksiyonlar araştırma çalışmalarına katkı sunuyor.'],
  ['Dünya', 'Uluslararası kitap fuarında çeviri yayınlar öne çıktı', 'Farklı dillerde yayımlanan eserler ve yayıncılık iş birlikleri görüşmelerin odağındaydı.'],
  ['Spor', 'Bisiklet toplulukları ortak güzergâhlarda buluştu', 'Katılımcılar, kent içinde güvenli sürüş ve güzergâh seçimi üzerine deneyimlerini paylaştı.'],
  ['Sağlık', 'Kamusal binalarda yönlendirme işaretleri yenileniyor', 'Hizmet alanlarına erişimi kolaylaştıran okunaklı ve anlaşılır işaretler değerlendiriliyor.']
];

export const demoArticles = rows.map(([category, title, summary, body], index) => {
  const slug = slugify(title);
  return {
    id: `demo-${index + 1}`, slug, title, summary,
    body: body || `${summary} Konuya ilişkin değerlendirmelerde, mevcut çalışmaların kapsamı ve uygulama süreci ele alındı. İlgili başlıklar üzerine görüşlerin paylaşılmasının ardından çalışmaların izlenmeye devam edileceği belirtildi.\n\nHazırlık sürecinde farklı ihtiyaçların birlikte ele alınması üzerinde duruldu. Uygulamalara ilişkin ayrıntıların çalışmaların ilerleyen bölümünde paylaşılacağı ifade edildi.`,
    category, source_name: 'Gösterim metni', source_url: `/onizleme-kaynagi/#${slug}`,
    source_title: title, source_excerpt: summary,
    status: 'published', sensitivity: 'normal', verdict: 'auto_pass', featured: index === 0,
    corroborating_sources: [], published_at: new Date(Date.UTC(2026, 9, 24, 12, 42 - index * 17)).toISOString(),
    created_at: '2026-10-24T00:00:00.000Z', updated_at: '2026-10-24T00:00:00.000Z', image_url: null
  };
});
