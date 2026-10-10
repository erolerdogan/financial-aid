import type { FaqCopy } from './en';

export const tr: FaqCopy = {
  'faq.title': 'Sık sorulan sorular',
  'faq.description':
    'Financial Aid’de ekstre içe aktarma, kategoriler, Bütçe Sağlığı, gizlilik ve yedekler hakkında yanıtlar.',
  'faq.intro': 'Financial Aid’in nasıl çalıştığına dair kısa yanıtlar. Yanıtını okumak için bir soruya dokunun.',

  'faq.start.title': 'Başlarken',
  'faq.start.what.q': 'Financial Aid ne yapar?',
  'faq.start.what.a':
    'Bankanızdan indirdiğiniz ekstreleri okur, her işlemi bir kategoriye yerleştirir ve paranızın nereye gittiğini gösterir: gelir, harcama, bütçeler, borçlar ve eğilimler. Başlamak için şu yoldan bir ekstre içe aktarın: {settings} → {importRow}.',
  'faq.start.bank.q': 'Uygulama bankama bağlanıyor mu?',
  'faq.start.bank.a':
    'Hayır. Ekstreyi bankanızdan kendiniz indirir ve o dosyayı içe aktarırsınız. Uygulama banka giriş bilgilerinizi asla istemez ve bankanızla hiçbir bağlantısı yoktur.',
  'faq.start.statement.q': 'Bankamdan ekstreyi nasıl alırım?',
  'faq.start.statement.a':
    'Ekstreyi bankanızın uygulamasından veya web sitesinden CSV ya da Excel dosyası olarak indirin. {settings} → {guide} bölümü, her bankanın kendi yardım sayfalarından alınan adımları ve diğer bankalar için genel adımları gösterir.',
  'faq.start.demo.q': 'Uygulamayı kendi verilerim olmadan deneyebilir miyim?',
  'faq.start.demo.a':
    'Evet. Karşılama ekranında {demo} seçeneği vardır: üç aylık örnek işlem ve iki örnek borç içeren ayrı bir profil. İçe aktarma, yedekleme, sıfırlama, profil değiştirme ve içe aktarma hatırlatıcıları orada kapalıdır. Gelecek Büyüme planı orada değiştirilemez. Demodan şu düğmeyle çıkılır: {exitDemo}.',

  'faq.import.title': 'Ekstre içe aktarma',
  'faq.import.files.q': 'Hangi dosyaları içe aktarabilirim?',
  'faq.import.files.a':
    'CSV dosyaları, sekme veya noktalı virgülle ayrılmış metin dosyaları (.txt, .tsv) ve Excel dosyaları (.xlsx, .xls). Fotoğraflar, ekran görüntüleri ve CAMT XML, MT940, OFX gibi banka biçimleri, CSV veya Excel dışa aktarımını kullanma önerisiyle reddedilir.',
  'faq.import.banks.q': 'Hangi bankalar destekleniyor?',
  'faq.import.banks.a':
    'Şu bankaların dışa aktarım dosyaları otomatik olarak tanınır: {banks}. Diğer bankalar CSV veya Excel indirme sunuyorsa çalışır; uygulama sütunları başlık satırından algılar.',
  'faq.import.pdf.q': 'PDF ekstre içe aktarabilir miyim?',
  'faq.import.pdf.a':
    'Yalnızca ABN AMRO PDF ekstreleri. Bunlar cihazınızda okunur ve her ekstre, üzerinde yazılı toplamlar ve bakiyelerle karşılaştırılır; tutarları uyuşmayan bir ekstre içe aktarılmaz. Taranmış PDF’ler ve diğer bankalar için CSV veya Excel dışa aktarımını kullanın.',
  'faq.import.twice.q': 'Aynı ekstreyi iki kez içe aktarırsam ne olur?',
  'faq.import.twice.a': 'Uygulamada zaten bulunan işlemler atlanır; bu yüzden çakışan ekstreleri içe aktarmak güvenlidir.',
  'faq.import.share.q': 'Doğrudan banka uygulamamdan içe aktarabilir miyim?',
  'faq.import.share.a':
    'Evet. Ekstreyi banka uygulamanızda dışa aktarın, Paylaş’ı seçin ve Financial Aid’i seçin. Dosya, kendi seçtiğiniz bir dosya gibi etkin profile aktarılır.',
  'faq.import.coverage.q': 'Bir ayın eksiksiz olduğunu nasıl anlarım?',
  'faq.import.coverage.a':
    '{home} ekranındaki ekstre etiketi, seçili ayın ne kadarının ekstrelerinizle kapsandığını gösterir: henüz veri yok, içinde bulunulan ay, günleri eksik geçmiş bir ay veya ayın tamamı. Günleri eksik geçmiş bir ay ayrıca {forYou} altında da listelenir.',

  'faq.import.manual.q': 'Elle işlem ekleyebilir miyim?',
  'faq.import.manual.a':
    'Evet. Sekme çubuğunun ortasındaki + düğmesine dokunun ve gider ya da gelir seçin; ardından tutar, açıklama, tarih ve kategori girin. Kendi girdiğiniz bir işlemi ayrıntı ekranından silebilirsiniz. Daha sonra aynı ödemeyi içeren bir ekstre içe aktarırsanız ödeme ikinci kez eklenir; o zaman kendi kaydınızı silin.',
  'faq.categories.title': 'Kategoriler ve bütçeler',
  'faq.categories.how.q': 'İşlemler nasıl kategorilere ayrılıyor?',
  'faq.categories.how.a':
    'İçe aktarma sırasında, şu sırayla: kendi kurallarınız, aynı satıcı için daha önce seçtiğiniz kategori, ardından satıcı adındaki ve banka metninin geri kalanındaki yerleşik anahtar kelimeler. Hiçbiri uymazsa gelen para {income}, harcama ise {uncategorised} olur. Yerleşik anahtar kelimeler Hollanda bankalarına ve satıcılarına göre ayarlanmıştır.',
  'faq.categories.fix.q': 'Bir işlem yanlış kategoride. Nasıl düzeltirim?',
  'faq.categories.fix.a':
    'İşlemi açın ve kategorisine dokunun. Seçiminiz hatırlanır ve sonradan üzerine yazılmaz. Bir satıcıyı en az iki kez ve çoğunlukla aynı şekilde düzelttiğinizde, o satıcının yeni işlemleri seçiminizi izler.',
  'faq.categories.review.q': 'Kategorisiz işlemlerle ne yapmalıyım?',
  'faq.categories.review.a':
    '{transactions} ekranı en üstte kaç tane olduğunu gösterir. İnceleme listesi bunları satıcıya göre, en büyükten başlayarak gruplar ve mümkün olduğunda bir kategori önerir. Bir kez kategori seçmek, o satıcının tüm işlemlerine ve sonraki içe aktarmalara uygulanır. Ayrıca {home}, {health}, {trends} veya {categories} bölümünde bir kategoriyi açıp kategorisiz işlemleri oraya ekleyebilirsiniz: birkaçını birden işaretleyin; tamamı seçilen satıcı sonraki içe aktarmalar için hatırlanır.',
  'faq.categories.fixed.q': 'Sabit ve esnek giderler nedir?',
  'faq.categories.fixed.a':
    'Sabit giderler kira, faturalar ve abonelikler gibi tekrarlayan ödemelerdir; geri kalanı esnektir. Uygulama bunları satıcının davranışından algılar: düzenli bir aralık, değişmeyen tutarlar ve otomatik ödemeler. Bir işlemin ayrıntısında satıcıyı {fixed} veya {flexible} olarak işaretleyebilir ya da {resetAuto} ile geri dönebilirsiniz.',
  'faq.categories.budget.q': 'Bütçe nasıl belirlerim?',
  'faq.categories.budget.a':
    '{settings} → {budgets} bölümünü açın ve her kategori için aylık bir limit belirleyin. {home} ekranındaki ve bütçe ekranındaki ilerleme çubukları, limite karşı ne kadar harcadığınızı gösterir. Limit, {trends} ekranındaki grafikten de belirlenebilir.',
  'faq.categories.own.q': 'Kendi kategorilerimi ve kurallarımı ekleyebilir miyim?',
  'faq.categories.own.a':
    'Evet. {settings} → {categories} altında kategori oluşturur, adını ve rengini değiştirir, siler ve bunlara anahtar kelime kuralları eklersiniz. Bir kural değiştiğinde, elle kategorilendirmediğiniz işlemler yeniden sıralanır.',

  'faq.plan.score.q': 'Sağlık puanı nasıl hesaplanıyor?',
  'faq.plan.score.a':
    'Puan 0 ile 100 arasındadır ve beş temeli birleştirir: tasarruf oranı (%30), konut (%20), sabit giderler (%15), ipotek hariç borç ödemeleri (%20) ve güvenlik tamponu (%15). Her temel yaygın bir genel kuralla karşılaştırılır. Girmediğiniz bir tampon hesaba katılmaz ve ağırlığını diğer temeller paylaşır.',
  'faq.plan.income.q': 'Sağlık puanı hangi geliri kullanıyor?',
  'faq.plan.income.a':
    'Ekstrelerinizdeki, gelir içeren son üç tam ayın ortalamasını veya kendi yazdığınız tutarı. Gelir içeren bir ay olana kadar puan gösterilmez. Size ödenen bir kredi veya başka bir büyük tek seferlik ödeme gelir sayılmaz.',
  'faq.plan.debts.q': 'Uygulama borç ödemelerimi nasıl buluyor?',
  'faq.plan.debts.a':
    'Her borcun anahtar kelimeleri vardır. Her içe aktarmadan sonra, bir anahtar kelime tam bir sözcükle eşleşiyorsa ve tutar aylık ödemeye yakınsa işlem borca bağlanır. Kıl payı uymayanlar, elle ekleyebileceğiniz olası eşleşmeler olarak listelenir; bağlanmış bir ödemenin bağlantısı kaldırılabilir. Borç formunda işlemlerinizden bir ödeme de seçebilirsiniz: aynı kredi verene yapılan tüm ödemeler onunla birlikte seçilir ve anahtar kelimesi sizin için eklenir.',
  'faq.plan.growth.q': '{growth} neyi gösterir?',
  'faq.plan.growth.a':
    'Bir başlangıç tutarının ve aylık katkının yıllar içinde nasıl büyüyebileceğini. Üç senaryo yıllık %5, %7 ve %9 getiri kullanır; kendi getirinizi, ücretinizi ve enflasyonu da girebilirsiniz. Sonuç bir tahmindir, söz değildir.',
  'faq.plan.advice.q': 'Sağlık puanı veya büyüme hesaplayıcısı finansal tavsiye midir?',
  'faq.plan.advice.a':
    'Hayır. Sağlık puanı harcamalarınızı yaygın genel kurallarla karşılaştırır, büyüme hesaplayıcısı ise garanti edilmeyen bir tahmin gösterir. İkisi de finansal tavsiye değildir.',

  'faq.privacy.title': 'Gizlilik ve yedekler',
  'faq.privacy.where.q': 'Verilerim nerede saklanıyor?',
  'faq.privacy.where.a':
    'Cihazınızdaki bir veritabanında. Finansal verilerinizi hiçbir sunucu almaz ve uygulamada analitik veya reklam bulunmaz.',
  'faq.privacy.account.q': 'Hesaba ihtiyacım var mı?',
  'faq.privacy.account.a':
    'Hayır. Uygulama hesap olmadan çalışır. Hesap yalnızca uygulama içi satın alma için gerekir; böylece satın alım yeni bir telefonda da sizinle kalır. Hesapta e-posta adresiniz, bir hesap kimliği ve oluşturulma tarihi saklanır; finansal verileriniz telefonunuzdan asla çıkmaz. Hesabı {settings} → {account} bölümünden silebilirsiniz.',
  'faq.privacy.lost.q': 'Telefonumu kaybedersem veya uygulamayı silersem ne olur?',
  'faq.privacy.lost.a':
    'Verileriniz yalnızca cihazınızda bulunur, bu yüzden yedek olmadan kurtarılamaz. Düzenli olarak yedek alın ve güvenli bir yerde saklayın; uygulama 30 gün sonra hatırlatır.',
  'faq.privacy.backup.q': 'Nasıl yedek alırım veya yeni bir telefona geçerim?',
  'faq.privacy.backup.a':
    '{settings} → {backup} tüm profillerinizi tek bir dosyaya kaydeder ve dosyanın nereye gideceğini siz seçersiniz. Yeni telefonda karşılama ekranında {restore} seçeneğini kullanın. Geri yükleme cihazdaki her şeyin yerini alır, hiçbir şey birleştirilmez ve uygulama önce nelerin değişeceğini gösterir. {undo} seçeneği değiştirilen verileri geri getirir.',
  'faq.privacy.password.q': 'Yedeğimin parolasını unuttum. Sıfırlanabilir mi?',
  'faq.privacy.password.a':
    'Hayır. Parolalı bir yedek şifrelenir ve parola olmadan onu kimse açamaz, biz de açamayız. Parolayı güvenli bir yerde saklayın veya veriler hâlâ cihazınızdayken yeni bir yedek alın.',
  'faq.privacy.delete.q': 'Tüm verilerimi nasıl silerim?',
  'faq.privacy.delete.a':
    '{settings} → {reset} tüm verileri ve profilleri cihazdan kaldırır. Uygulamayı silmek veritabanını da kaldırır. Başka bir yere kaydettiğiniz yedek dosyalarını kendiniz silmeniz gerekir.',

  'faq.profiles.title': 'Profiller ve ayarlar',
  'faq.profiles.what.q': 'Profiller nedir?',
  'faq.profiles.what.a':
    'Tek bir uygulamada ayrı hesap defterleri; örneğin kişisel, iş ve ev. Her profilin kendi işlemleri, kategorileri, kuralları, bütçeleri ve borçları ile kendi adı, rengi ve para birimi vardır. Ekstre, o anda etkin olan profile aktarılır.',
  'faq.profiles.currency.q': 'Para birimini değiştirdiğimde ne olur?',
  'faq.profiles.currency.a':
    'Uygulama günün döviz kurunu indirir, gösterir ve onayınızdan sonra profilde kayıtlı tutarları (işlemler, bütçeler, borçlar ve hane tutarları) dönüştürür. Gelecek Büyüme planları dönüştürülmez. İstek, verilerinizden hiçbirini içermez. Para birimini değiştirmek için internet bağlantısı gerekir. Dönüştürülen tutarlar yuvarlanır; bu yüzden sonuç yaklaşıktır.',
  'faq.profiles.languages.q': 'Hangi para birimleri ve diller var?',
  'faq.profiles.languages.a':
    'Para birimleri: EUR, USD, GBP, JPY, CHF, CAD ve AUD dahil 150’den fazla. Diller: İngilizce, Felemenkçe, Almanca, Türkçe, İspanyolca, Fransızca, İtalyanca, Portekizce ve Rusça.',
  'faq.profiles.notifications.q': 'Uygulama ne zaman bildirim gönderir?',
  'faq.profiles.notifications.a':
    'Her ayın 15’inde ve 28’inde içe aktarma hatırlatıcıları (bir ekstre içe aktardığınızda iptal edilir) ve açtığınız {health} uyarıları. Hepsi cihazınızda planlanır. Hatırlatıcılar şuradan kapatılır: {settings} → {reminders}.',
};
