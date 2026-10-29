<div align="center">
  <img src="./og-cover.jpg" alt="HBK Spor — futbol performansı ve antrenman takibi" width="100%" />
  <h1>HBK SPOR</h1>
  <p><strong>Antrenmanı kafadan değil, kayıttan yönet.</strong><br />Planla. Sahaya çık. Gelişimini gör.</p>
  <p>
    <a href="https://hbkspor.pages.dev/"><strong>⚽ Uygulamayı aç</strong></a>
    ·
    <a href="./HBK_SURUM_NOTLARI.md">Sürüm notları</a>
    ·
    <a href="./hbk-spor-src/README.md">Kaynak ve yayınlama rehberi</a>
  </p>
  <p>
    <img alt="PWA" src="https://img.shields.io/badge/PWA-y%C3%BCklenebilir-9BEA32?style=flat-square" />
    <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=111" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-kaynakl%C4%B1-3178C6?style=flat-square&logo=typescript&logoColor=white" />
    <img alt="Öncelik" src="https://img.shields.io/badge/Odak-futbol%20performans%C4%B1-111?style=flat-square" />
  </p>
</div>

---

## Sahadaki emeğin, ekranda da karşılığını bulsun

**HBK Spor**, futbolcuların ve antrenman yapan sporcuların günlük işini tek yerde toplar: antrenmanını planla, yaptığını kaydet, haftalar içindeki yükünü ve gelişimini takip et. Masa başında süslü grafik üretmek için değil; bir sonraki antrenmana daha bilinçli çıkman için.

> **Kısa versiyon:** Planını kur. Gym ve saha çalışmalarını kaydet. Maçlarını ve gelişimini takip et. Verin senin cihazında kalsın.

## Neler var?

| Alan | İçerik |
|---|---|
| **Plan** | Haftalık ve aylık takvim, gün düzenleme, haftalık şablonlar ve hazır antrenman ritimleri |
| **Antrenman ekle** | Gym setleri, saha çalışması, maç, toparlanma, dinlenme ve GPS koşu (Faz 1) kaydı |
| **Saha araçları** | Saha haritası, drill kütüphanesi, alet çantası ve skill testleri |
| **Analiz** | Antrenman yükü, form, maç, gelişim ve tüm kayıtların ayrıntıları |
| **Oyuncu profili** | Oyuncu kartı, kariyer bilgileri, rozetler, çıkartma albümü ve arkadaş kartları |
| **Veri yönetimi** | JSON yedekleme, CSV dışa aktarma, hareket ve şablon yöneticileri |
| **Performans analizi** | 4/8/12 haftalık dönem kıyası, yük grafiği ve 12 haftalık takvim; kas, maç/olay, GPS içe aktarma, öz bildirimli toparlanma, test eğilimleri, kişisel rekorlar, planlanan–gerçekleşen karşılaştırması ve CSV raporu |

Arayüz telefonda antrenman sırasında kullanılabilecek şekilde tasarlanmıştır; PWA olarak ana ekrana eklenebilir. Uygulama çevrimdışı açılmayı destekler. PWA önbelleği uygulama dosyalarını saklar; kullanıcı verilerinin yedeğini ayrıca almanı öneririz.

## Verin senin. Nokta.

Antrenman, maç, plan ve profil kayıtları bu tarayıcıdaki **IndexedDB**’den salt okunur alınır; veritabanı yükseltilmez veya değiştirilmez. GPS koşuları ve test sonuçları uygulamanın localStorage kayıtlarından; toparlanma check-in’leri mevcut antrenmanlardaki wellness alanından okunur. Demo kimlikli örnek kayıtlar gerçek performans özetine katılmaz.

Set bazında eklenen **RPE/dinlenme** ile içe aktarılan GPS dosyalarının özet ve rota noktaları cihazda ayrı localStorage anahtarlarında tutulur. Analiz penceresindeki **Analiz yedeğini indir / içe aktar** kontrolleri bu ek verileri taşır; ana uygulama antrenman/maç yedeğinin yerini almaz.

GPS sekmesi Strava veya cihazlardan `.gpx`, `.tcx` ve `.fit` dosyalarını alır. Rota, tempo, 1 km turları, mesafe, hareket süresi ve dosyada varsa yükseklik, nabız/kadans gösterilir. Ham dosya sunucuya gönderilmez; dışarıdan alınan rotalar bu cihazda kalır ve silinebilir. Strava OAuth/API otomatik bağlantısı bu sürümde yoktur; ayrıntılar [`GPS ve analiz notlarında`](./hbk-spor-src/docs/performance-analytics.md).

> **RPE bir öz bildirimdir.** RPE × süre ölçülmüş yorgunluk/sakatlık riski değildir; kas grubu eşleştirmeleri ve etkin set katsayıları da yaklaşık planlama göstergeleridir. GPS hesaplamaları Strava/cihaz değerlerinden farklı olabilir.

## Hemen dene

[**HBK Spor'u tarayıcıda aç →**](https://hbkspor.pages.dev/)

Uygulama bir hesap oluşturmadan kullanılabilir. Kendi verinle başlamadan önce mevcut yedeğini sakla; başka cihazda kullanacaksan uygulamanın yedekleme/dışa aktarma araçlarını kullan.

## Kaynak kodu: önemli bir dürüstlük notu

Bu repoda uygulamanın önceki kapsamlı sürümünün **özgün React kaynakları ve source map dosyaları yoktu**. Bu nedenle eski kaynakları geri elde etmiş gibi davranmıyoruz.

- [`hbk-spor-src/`](./hbk-spor-src/) mevcut kapsamlı derlenmiş uygulamayı statik varlık olarak korur ve üzerine düzenlenebilir **kas analizi** kaynağını ekler.
- [`source-rebuild/`](./source-rebuild/) ayrı, çalıştırılabilir bir kaynak yeniden oluşturumudur. Eski uygulamanın birebir kaynak portu değildir ve bütün eski özelliklerin aynısını sunduğu iddia edilmez.
- Depo kökündeki statik dosyalar mevcut dağıtım paketini korur.

Özetle: kapsamlı eski uygulamayı kaybetmeden yeni analizi kaynak koduyla geliştirebiliyoruz; ancak derlenmiş eski modüller hâlâ özgün kaynak değildir.

## Geliştirme

### Kapsamlı uygulama paketi + kas analizi

```bash
cd hbk-spor-src
npm ci
npm run test
npm run dev
```

Üretim derlemesi ve yerel önizleme:

```bash
npm run build
npm run preview
```

`npm run test`, mevcut IndexedDB v2 verisiyle uyumluluğu ve kas/set hesaplamalarının temel kurallarını kontrol eder. Güncel ayrıntılar için [`hbk-spor-src/README.md`](./hbk-spor-src/README.md) dosyasına bak.

### Bağımsız kaynak yeniden oluşturumu

```bash
cd source-rebuild
npm ci
npm run dev
```

Bu ikinci proje de düzenlenebilir bir başlangıç noktasıdır; kapsamı ve depolama yapısı `source-rebuild/README.md` içinde açıklanır.

### Cloudflare Pages

`hbk-spor-src/` projesini Git bağlantısıyla derlemek için:

- **Root directory:** `hbk-spor-src`
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node.js:** 18 veya üzeri

Bu repo kendi başına üretime deploy etmez. Yayına almadan önce build/test sonuçlarını ve mevcut kullanıcı verileriyle davranışı doğrula.

## Depo düzeni

```text
.
├── index.html, assets/, sw.js     # Korunan dağıtım dosyaları
├── hbk-spor-src/                 # Kapsamlı paket + kaynak kodlu kas analizi
│   ├── src/                      # React/TypeScript analizi ve testler
│   └── public/                   # Korunan uygulama paketi ve PWA varlıkları
├── source-rebuild/               # Bağımsız kaynak yeniden oluşturumu
├── HBK_SURUM_NOTLARI.md          # Sürüm kapsamı ve dağıtım notları
└── SURUM.txt                     # Paket kimliği
```

## Katkı

Hata bulduysan veya geliştirme fikrin varsa bir issue aç; değişiklik göndermeden önce ilgili projede test ve üretim derlemesini çalıştır. Gerçek kullanıcı verilerini, yedekleri veya kişisel bilgileri issue ve pull request'lere ekleme.

## Lisans

Özgün kaynak kodu ve proje dokümantasyonu, [`LICENSE`](./LICENSE) dosyasındaki **MIT** lisansı kapsamındadır. Eski derlenmiş uygulama paketleri, depo kökündeki dağıtım dosyaları (`index.html`, `sw.js`, `assets/`, ikonlar ve görseller dâhil), iki projenin `public/` varlıkları, `hbk-spor-src/src/data/exercise-catalog.json`, marka öğeleri ve üçüncü taraf içerikler bu lisansın kapsamı dışındadır; ilgili hak ve lisansları saklıdır. Bu kapsam, sahipliği belirsiz eski dağıtım dosyalarına yanlışlıkla yeniden kullanım izni vermemek için özellikle ayrılmıştır.
