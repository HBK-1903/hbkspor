# HBK Spor — düzenlenebilir kaynak projesi

Bu depo, dağıtım için derlenmiş HBK Spor dosyalarını ve `source-rebuild/` altında düzenlenebilir React/TypeScript kaynak uygulamasını içerir. Kaynak uygulama mevcut dağıtım paketinden geri çıkarılmış özgün kaynak kod değildir; çalışan, sınırlı kapsamlı bir yeniden oluşturmadır ve orijinal uygulamanın tüm özellikleriyle aynı olduğunu iddia etmez.

## Gereksinimler ve çalıştırma

- Node.js 18 veya üzeri
- npm

```bash
cd source-rebuild
npm ci
npm run dev
```

## Test ve üretim derlemesi

```bash
npm run test
npm run build
npm run preview
```

Dağıtılabilir dosyalar `dist/` dizinine yazılır. Cloudflare Pages gibi statik hosting'e bu dizinin içeriği gönderilebilir. Mevcut dağıtım dosyaları depo kökünde ayrıca tutulur; bu projeden otomatik deploy yapılmaz.

## Antrenman ve kas yükü takibi

- Gym kaydına hazır hareketlerden bir veya daha fazlası eklenebilir; son Gym kaydını tek dokunuşla kopyalayabilir veya Gym/Saha şablonu kaydedip yeniden kullanabilirsin. Şablonlar JSON yedeğinin parçasıdır.
- Her setin tekrar, dış yük (kg), dinlenme süresi ve kullanıcının bildirdiği RPE (1–10) ayrı saklanır; böylece setler arası değişiklikler korunur.
- İstatistikler → **Kas yükü** görünümü, 1/4/12 haftalık filtre, ön/arka vücut haritası, kas grubu grafiği, antrenman ısı haritası ve hareket ilerleme grafiği sunar.
- Ana kas için set başına 1, yardımcı kas için 0,5 **kas-set eşdeğeri** sayılır.
- Hareket hacmi `set × tekrar × girilen kg` olarak hesaplanır. Ağırlıksız hareketlerde setler sayılır ama dış yük tonajı gösterilmez.
- Kas eşleştirmeleri yaklaşık ve düzenlenebilir katalog varsayımlarıdır. RPE yalnızca kullanıcının öznel efor bildirimidir; ekranda fizyolojik yorgunluk, sakatlık riski veya tıbbi değerlendirme olarak sunulmaz.
- XP, antrenman süresine göre sınırsız artmaz; oturum türü için sabit ödül kullanılır.
- Set eklenince seçilen dinlenme süresi için durdurulabilir sayaç başlar.
- Maç kaydına dakika bazlı gol, asist, kart, değişiklik ve not olayları eklenir; maç günlüğünde zaman sırasıyla görünür.
- İstatistikler → **Testler** ekranında sprint, çeviklik, sıçrama ve dayanıklılık şablonlarından sonuç girilir; geçmiş ve kişisel en iyi aynı test protokolü içinde listelenir.
- Günlük hedef işaretleri yerel takvim tarihine göre saklanır.
- İstatistikler → **Koç raporu** bölümünde son 4/8/12 haftayı ve rapora eklenecek seans, GPS, test ve maç alanlarını seçip sistem yazdırma penceresinden PDF olarak kaydedebilirsin. Rapor klinik veya sakatlık değerlendirmesi değildir.
- İstatistikler → **Sezon günlüğü** seans, maç, test ve GPX kayıtlarını yıl bazında kronolojik sıralar; demo verileri kişisel günlüğe/rapora karışmaz.
- Maç kaydında en fazla 6 JPG/PNG/WebP fotoğrafı (8 MB'a kadar, cihazda küçültülür) veya 30 saniyeye kadar MP4/WebM klip (25 MB'a kadar) iliştirilebilir. Bu dosyalar ayrı IndexedDB deposunda yalnızca cihazda tutulur; JSON/CSV yedeğine eklenmez ve yeni tarayıcıya otomatik taşınmaz.
- **Ayarlar → Bildirim tercihleri** bölümünde uygulama açıkken plan saati öncesi hatırlatma (0/15/30/60 dk), isteğe bağlı günlük hatırlatma ve Pazar özeti açılabilir. Sistem izni kullanıcıdan açıkça istenir. Tarayıcı arka plan zamanlayıcıları geciktirebilir; uygulama kapalıyken güvenilir anında push için ayrıca sunucu/push altyapısı gerekir.
- Seans ses notları, maç albümü ve özel çizimler yerel depolarda tutulur; JSON/CSV dışa aktarımı bunların ham dosyalarını taşımaz.

## Kaynak düzeni ve veri

- `src/App.tsx`: ekranlar ve antrenman akışları
- `src/training.ts`: hareket kataloğu, yerel tarih/seri yardımcıları ve kas yükü hesaplamaları
- `src/training.test.ts`: antrenman iş kuralları testleri
- `src/storage.ts`: cihaz içi kayıt ve dışa aktarma
- `src/types.ts`: uygulama veri tipleri
- `src/index.css`: responsive arayüz stilleri
- `public/`: PWA manifesti, ikonlar ve service worker

Profil, antrenman, şablon, maç olayı ve test verileri `hbk_spor_rebuild_v1` anahtarıyla bu tarayıcıda saklanır. Hareket kaydı her seansın içine kas eşleştirme anlık görüntüsüyle kaydedilir; böylece katalog değişikliği geçmiş raporları sessizce değiştirmez. Eski dağıtım sürümünün IndexedDB kayıtlarına geçiş yapılmaz veya onlar değiştirilmez.
