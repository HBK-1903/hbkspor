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

## Kaynak düzeni ve veri

- `src/App.tsx`: ekranlar ve antrenman akışları
- `src/training.ts`: hareket kataloğu, yerel tarih/seri yardımcıları ve kas yükü hesaplamaları
- `src/training.test.ts`: antrenman iş kuralları testleri
- `src/storage.ts`: cihaz içi kayıt ve dışa aktarma
- `src/types.ts`: uygulama veri tipleri
- `src/index.css`: responsive arayüz stilleri
- `public/`: PWA manifesti, ikonlar ve service worker

Profil, antrenman, şablon, maç olayı ve test verileri `hbk_spor_rebuild_v1` anahtarıyla bu tarayıcıda saklanır. Hareket kaydı her seansın içine kas eşleştirme anlık görüntüsüyle kaydedilir; böylece katalog değişikliği geçmiş raporları sessizce değiştirmez. Eski dağıtım sürümünün IndexedDB kayıtlarına geçiş yapılmaz veya onlar değiştirilmez.
