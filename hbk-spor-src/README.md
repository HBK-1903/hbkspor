# HBK Spor — kapsamlı uygulama + kaynaklı performans analizi

Bu klasör, mevcut kapsamlı HBK Spor dağıtımını korur ve mevcut kullanıcı verisini yeniden kullanan performans analiz merkezini ekler. Analiz; 4/8/12 haftalık dönem kıyası, haftalık yük grafiği, 12 haftalık aktivite takvimi, CSV raporu, kas, maç, GPS, toparlanma, testler, kişisel rekorlar ve planlanan–gerçekleşen karşılaştırmasını içerir.

## Önemli kaynak kodu notu

Depoda özgün React kaynakları veya source map bulunmadığından mevcut ana uygulamanın kaynak kodu birebir geri çıkarılamaz. `public/assets/index-CGAXHvPf.js` ve `index-DnZOOWBL.css`, repodaki mevcut kapsamlı dağıtım paketinin aynısıdır; bu modüller çalışır durumda korunur. Yeni performans analizi ise `src/` altında düzenlenebilir TypeScript/React olarak yazılmıştır. Eski modüller için özgün kaynak bulunduğu iddia edilmez.

## Yerel geliştirme, test ve derleme

Node.js 18+ ve npm gerekir.

```bash
cd hbk-spor-src
npm ci
npm run test
npm run dev
```

Üretim derlemesi:

```bash
npm run build
npm run preview
```

Çıktı `dist/` dizinine yazılır. Cloudflare Pages, Git bağlantısı:

- Repository: `HBK-1903/hbkspor`
- Production branch: `main`
- Root directory: `hbk-spor-src`
- Build command: `npm run build`
- Build output directory: `dist`

Bu proje kendi başına deploy etmez. Üretim yönlendirmesi öncesi test, build ve gerçek cihaz/veri uyumluluğu ayrıca doğrulanmalıdır.

## Mevcut uygulamayla veri uyumluluğu

- Kapsamlı uygulama `hbk_spor_performans_db` IndexedDB veritabanının v2 sürümünü kullanır.
- Analiz `workouts`, `exercises`, `matches`, `weeklyPlan`, `customPlans` ve `playerProfile` store'larını **salt okunur** biçimde açar; veritabanını yükseltmez, kayıtları değiştirmez veya sıfırlamaz.
- GPS koşuları `hbk_gps_runs`, performans testleri `hbk_skill_tests_v1` localStorage kayıtlarından okunur. Toparlanma check-in’leri mevcut workout kayıtlarının `wellness` alanından alınır.
- `demo-` / `demo_` ile başlayan örnek kayıtlar analiz metriklerinden hariç tutulur.
- Yeni set RPE bilgileri `hbk_muscle_effort_v1`; dışarıdan alınan GPS özetleri ve sadeleştirilmiş rota noktaları `hbk_analytics_gps_imports_v1` anahtarında, yalnızca bu cihazda tutulur. Bunlar ana uygulamanın JSON yedeğine dahil değildir.
- Analiz yedeği mevcut antrenman/maç kayıtlarını taşımaz; yalnızca ek set eforu ve dışarıdan içe aktarılan GPS verisini JSON olarak taşır. Uygulamanın kendi yedeği ayrıca alınmalıdır.

## GPS dosyası ve Strava

GPS sekmesi `.gpx`, `.tcx` ve `.fit` dosyalarını kabul eder. GPX/TCX rota noktalarından yaklaşık mesafe, süre, hareket süresi, tempo ve 1 km turları hesaplanır. FIT içe aktarımında, varsa cihazın aktivite özeti tercih edilir. GPS alanı haftalık mesafe trendi, sıralama, özet metrikler, rota başına tempo/nabız/yükseklik/kadans grafikleri, tur tablosu ve sadeleştirilmiş GPX dışa aktarımı sunar. Uygulamanın GPS kayıtlarındaki cihaz kalite özeti (doğruluk tahmini, reddedilen noktalar ve kesinti) varsa ayrıca gösterilir. Mesafe, tempo, hız, yükseklik, nabız ve kadans yalnızca kaynağın sağladığı verilere dayanır; eksik sensör değerleri uydurulmaz.

Dosya 20 MB ile sınırlıdır. Ham dosya yüklenmez veya saklanmaz; içe aktarılan rota için en fazla 600 koordinat localStorage’da kalır ve kullanıcı aktivite kartından silebilir. Strava OAuth/API ile otomatik senkronizasyon bu sürümde yoktur. API bağlantısı için ayrıca OAuth izni ve secret’ları tarayıcı dışında tutan güvenli bir sunucu/Worker gerekir.

Ayrıntılı kaynaklar, hesaplama kuralları ve aktarım/gizlilik sınırları: [`docs/performance-analytics.md`](./docs/performance-analytics.md).

## Hesaplama sınırları

- Oturum yükü yalnızca kaydedilmiş öz bildirimli oturum RPE’si (1–10) × süre ile gösterilir. Bu ölçülmüş yorgunluk, sakatlık riski veya kas gelişimi değildir; RPE olmayan oturumlara yük puanı üretilmez.
- Kas eşleştirmeleri ve ana/yardımcı kas set ağırlıkları yaklaşık planlama göstergeleridir; gerçek kas gelişimi, yorgunluk veya sağlık durumu ölçümü değildir.
- GPS mesafesi/hareket süresi algoritmik tahmindir ve Strava veya cihaz değerinden farklı çıkabilir. Kişiye/branşa uygun eşikler girilmediğinden hız bölgeleri sınıflandırılmaz.
- Kişisel rekorlar yalnızca kayıtlı değerlerden hesaplanır; tahmini 1RM veya kondisyon skoru üretilmez.

## Lisans

Yeni kaynak kodu ve dokümantasyon için depo kökündeki [`LICENSE`](../LICENSE) dosyasına bak. Kapsamlı eski derlenmiş uygulama paketi, depo kökündeki dağıtım dosyaları, `public/` varlıkları ve çıkarılmış `src/data/exercise-catalog.json` MIT kapsamına dahil değildir; bunların mevcut hakları saklıdır.
