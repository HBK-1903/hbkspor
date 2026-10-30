# HBK Spor — düzenlenebilir kaynak projesi

Bu depo, dağıtım için derlenmiş HBK Spor dosyalarını ve `source-rebuild/` altında düzenlenebilir React/TypeScript kaynak uygulamasını içerir. Kaynak uygulama mevcut dağıtım paketinden geri çıkarılmış özgün kaynak kod değildir; çalışan, sınırlı kapsamlı bir yeniden oluşturmadır ve orijinal uygulamanın tüm özellikleriyle aynı olduğunu iddia etmez.

## Gereksinimler ve çalıştırma

- Node.js 20.19+ veya 22.12+ (Vite 7 ve React eklentisinin gereksinimi)
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
npx playwright install chromium webkit
npm run test:e2e
```

Playwright uçtan uca geri yükleme testleri Pixel 7/Chromium ve iPhone 13/WebKit cihaz profili emülasyonlarında yeni tarayıcı profiline JSON + `.hbm` yedeği yüklemeyi sınar. WebKit emülasyonu gerçek iPhone donanımında Safari testi yerine geçmez. PR iş akışı bu testleri CI’da çalıştırır.

Dağıtılabilir dosyalar `dist/` dizinine yazılır. Cloudflare Pages gibi statik hosting'e bu dizinin içeriği gönderilebilir. Mevcut dağıtım dosyaları depo kökünde ayrıca tutulur; bu projeden otomatik deploy yapılmaz.

## Antrenman ve kas yükü takibi

- Gym kaydına hazır hareketlerden bir veya daha fazlası eklenebilir; son Gym kaydını tek dokunuşla kopyalayabilir veya Gym/Saha şablonu kaydedip yeniden kullanabilirsin. Ana ekrandaki **Kayıtlı şablonlar** kartı tek dokunuşla hızlı başlatır. Şablonlar JSON yedeğinin parçasıdır.
- Her setin tekrar, dış yük (kg), dinlenme süresi ve kullanıcının bildirdiği RPE (1–10) ayrı saklanır; böylece setler arası değişiklikler korunur.
- İstatistikler → **Kas yükü** görünümü, 1/4/12 haftalık filtre, ön/arka vücut haritası, kas grubu grafiği, antrenman ısı haritası ve hareket ilerleme grafiği sunar.
- Ana kas için set başına 1, yardımcı kas için 0,5 **kas-set eşdeğeri** sayılır.
- Hareket hacmi `set × tekrar × girilen kg` olarak hesaplanır. Ağırlıksız hareketlerde setler sayılır ama dış yük tonajı gösterilmez.
- Kas eşleştirmeleri yaklaşık ve düzenlenebilir katalog varsayımlarıdır. RPE yalnızca kullanıcının öznel efor bildirimidir; ekranda fizyolojik yorgunluk, sakatlık riski veya tıbbi değerlendirme olarak sunulmaz.
- XP, antrenman süresine göre sınırsız artmaz; oturum türü için sabit ödül kullanılır.
- Set eklenince seçilen dinlenme süresi için durdurulabilir sayaç başlar.
- Maç kaydına dakika bazlı gol, asist, kart, değişiklik ve not olayları eklenir; maç günlüğünde zaman sırasıyla görünür.
- İstatistikler → **Testler** ekranında sprint, çeviklik, sıçrama ve dayanıklılık şablonlarından sonuç girilir; geçmiş ve kişisel en iyi aynı test protokolü içinde listelenir. Her test için ayrı hedef girilip ölçüm yönüne (süre testinde düşük, mesafe/yükseklikte yüksek) uygun ilerleme görülür.
- Günlük hedef işaretleri yerel takvim tarihine göre saklanır.
- İstatistikler → **Koç raporu** bölümünde son 7 gün/4/8/12 haftayı ve rapora eklenecek seans, GPS, test ve maç alanlarını seçip sistem yazdırma penceresinden PDF olarak kaydedebilirsin. Rapor klinik veya sakatlık değerlendirmesi değildir.
- İstatistikler → **Sezon günlüğü** seans, maç, test ve GPX kayıtlarını yıl bazında kronolojik sıralar; demo verileri kişisel günlüğe/rapora karışmaz.
- Maç kaydında en fazla 6 JPG/PNG/WebP fotoğrafı (8 MB'a kadar, cihazda küçültülür) veya 30 saniyeye kadar MP4/WebM klip (25 MB'a kadar) iliştirilebilir. Bu dosyalar ayrı IndexedDB deposunda yalnızca cihazda tutulur; JSON/CSV yedeğine eklenmez. Yeni tarayıcıya otomatik taşınmaz, ancak Ayarlar’daki ayrı `.hbm` medya yedeğiyle elle taşınabilir.
- Haftalık planda tek seferlik ya da 4/8/12 haftalık seri oluşturulabilir. Her tekrar ayrı occurrence olarak görünür; tek haftayı ya da serinin tamamını silebilirsin. Takvim ekranı geçerli bugünkü/gelecek planları yerel saatleri koruyan `.ics` dosyası olarak dışa aktarır.
- **Ayarlar → Veri güvenliği** alanında son yedek tarihi, 30 günlük yedek hatırlatması ve tarayıcı depolamasının yaklaşık kullanımı görünür. JSON yedeği indirildikten sonra en son yedek zamanı cihazda kaydedilir.
- JSON yedeği sürümlü biçimde seans, plan, hedef, test, şablon, GPS, profil ve tercihler gibi uygulama kayıtlarını içerir. İçe aktarma önce doğrulama/önizleme sunar; geçersiz satırları sayar ve mevcut veriyle birleştirme ya da yedekle değiştirme seçeneği verir. Eski düz JSON yedekleri de desteklenir. Yerel yazım başarısız olursa mevcut kayıtlar korunur.
- Sesli notlar ile maç fotoğraf/video dosyaları, **Ayarlar → Ayrı medya yedeği** alanından `.hbm` arşivi olarak dışa aktarılıp geri yüklenebilir. İçe aktarma önce dosya türü/sayısı/boyutu ve her medya parçasının SHA-256 özeti doğrular, ardından onay ister; bozuk arşiv hiçbir yerel veriyi değiştirmez. Mevcut öğelerden yalnızca aynı kimlikteki medya güncellenir, diğerleri silinmez. Arşiv üst sınırı 150 MB’tır; bütünlük özeti şifreleme değildir. Arşiv şifrelenmez ve uygulama sunucusuna gönderilmez. Hassas medyayı güvenli yerde saklayın.
- **Ayarlar → Bildirim tercihleri** bölümünde uygulama açıkken plan saati öncesi hatırlatma (0/15/30/60 dk), isteğe bağlı günlük hatırlatma ve Pazar özeti açılabilir. Sistem izni kullanıcıdan açıkça istenir. İsteğe bağlı Cloudflare Worker push entegrasyonu uygulama kapalıyken teslim için zamanlanmış bildirimleri D1’de saklar; Worker dakikalık cron ile Web Push (VAPID + aes128gcm) gönderir.
- Kapalı uygulama push’u varsayılan olarak çalışmaz. Cloudflare D1/Worker, gerçek VAPID anahtarları, izin verilen HTTPS origin’i ve `VITE_PUSH_API_URL` ayarı yapılandırılmalı/deploy edilmelidir. Push etkinleştirilince yalnızca bildirim içeriği ve planlanan saat sunucuya gider; seans geçmişi ve medya gitmez. Tarayıcı/işletim sistemi yine teslimatı geciktirebilir.
- Seans ses notları, maç albümü ve özel çizimler yerel depolarda tutulur; JSON/CSV dışa aktarımı bunların ham dosyalarını taşımaz.

## Kapalı uygulama push backend kurulumu

Push Worker uygulama ve Cloudflare tarafında ayrıca yapılandırılmalıdır; burada deploy edilmemiştir.

1. `cd source-rebuild` dizininde `npx wrangler d1 create hbkspor-push` çalıştır; Wrangler’ın verdiği gerçek database ID’yi `push-worker/wrangler.example.toml` içeriğini `push-worker/wrangler.toml` olarak kopyaladıktan sonra `database_id` alanına yaz.
2. `ALLOWED_ORIGINS` alanına uygulamanın kesin HTTPS origin’lerini (virgülle ayrılmış) ve `VAPID_SUBJECT` alanına iletişim e-postanı gir. Yapılandırma dosyası `.gitignore` içindedir.
3. Şemayı oluştur: `npx wrangler d1 execute hbkspor-push --remote --config push-worker/wrangler.toml --file=push-worker/schema.sql`.
4. VAPID çifti üret: `node push-worker/generate-vapid-keys.mjs`. Public key’i `VAPID_PUBLIC_KEY` değişkenine ekle; private key’i **commit etmeden** `npx wrangler secret put VAPID_PRIVATE_KEY --config push-worker/wrangler.toml` ile tanımla.
5. Worker’ı `npx wrangler deploy --config push-worker/wrangler.toml` ile yayınla. Çıkan HTTPS Worker adresini `source-rebuild/.env.local` dosyasındaki `VITE_PUSH_API_URL` değerine yazıp web uygulamasını yeniden derle/deploy et.

Worker cihaz aboneliklerini ve ileri tarihli hatırlatmaları D1’de tutar, cron ile gönderir; kapalı uygulama push’u için hem Worker hem web uygulaması deploy’u ve gerçek VAPID/D1 ayarları zorunludur. Bu prototipte sunucuya giden içerik plan başlığı/zamanı ve seçili kısa bildirim metnidir; ses, maç medyası, antrenman geçmişi veya profil aktarılmaz. Kullanıcı push aboneliğini Ayarlar’dan kaldırabilir.

## Kaynak düzeni ve veri

- `src/App.tsx`: ekranlar ve antrenman akışları
- `src/training.ts`: hareket kataloğu, yerel tarih/seri yardımcıları ve kas yükü hesaplamaları
- `src/training.test.ts`: antrenman iş kuralları testleri
- `src/storage.ts`: cihaz içi kayıt, sürümlü JSON dışa aktarma ve yedek zamanı
- `src/backup.ts`: JSON yedeği doğrulama, önizleme verisi ve güvenli birleştirme kuralları
- `src/calendar-export.ts`: yerel planların `.ics` takvim dosyasına aktarımı
- `src/types.ts`: uygulama veri tipleri
- `src/index.css`: responsive arayüz stilleri
- `public/`: PWA manifesti, ikonlar ve service worker

Profil, antrenman, şablon, maç olayı ve test verileri `hbk_spor_rebuild_v1` anahtarıyla bu tarayıcıda saklanır. Hareket kaydı her seansın içine kas eşleştirme anlık görüntüsüyle kaydedilir; böylece katalog değişikliği geçmiş raporları sessizce değiştirmez. Eski dağıtım sürümünün IndexedDB kayıtlarına geçiş yapılmaz veya onlar değiştirilmez.
