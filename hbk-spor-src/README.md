# HBK Spor — kapsamlı uygulama + düzenlenebilir kas analizi

Bu klasör, mevcut kapsamlı HBK Spor dağıtımını koruyup üzerine kaynak kodlu kas analizi eklemek için oluşturulmuş bir Vite projesidir.

## Önemli kaynak kodu notu

Depoda özgün React kaynakları veya source map bulunmadığından mevcut ana uygulamanın kaynak kodu birebir geri çıkarılamaz. `public/assets/index-CGAXHvPf.js` ve `index-DnZOOWBL.css`, repodaki mevcut kapsamlı dağıtım paketinin aynısıdır; bu modüller çalışır durumda korunur. Yeni kas analizi ise `src/` altında düzenlenebilir TypeScript/React olarak yazılmıştır. Bu nedenle bu klasör kapsamlı eski işlevleri yayınlarken yenisini ekler; eski modüller için henüz özgün kaynak kodu sağlamaz.

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

Bu proje kendi başına deploy etmez.

## Mevcut uygulamayla uyumluluk

- Kapsamlı uygulama `hbk_spor_performans_db` IndexedDB veritabanının v2 sürümünü kullanır.
- Kas analizi `workouts` ve `exercises` store'larını **salt okunur** biçimde açar; veritabanını yükseltmez, kayıtları değiştirmez veya sıfırlamaz.
- Analiz, mevcut `workout → gymExercises → sets` yapısını okur ve paket içindeki egzersiz kataloğuyla kas gruplarını eşleştirir.
- Yeni set RPE ve dinlenme değerleri `hbk_muscle_effort_v1` anahtarında, yalnızca bu cihazda saklanır. Bunlar ana uygulamanın JSON yedeğine dahil değildir; verileri taşımak için kas analizi penceresindeki ayrı JSON yedeğini kullanın.
- Bilinmeyen özel hareketlerin kas grubu tahmin edilmez; yanlış kas yükü üretmek yerine rapordan çıkarılır.

Kas eşleştirmeleri ve ana/yardımcı kas set ağırlıkları yaklaşık planlama göstergeleridir; gerçek kas gelişimi, yorgunluk veya sağlık durumu ölçümü değildir.

## Lisans

Yeni kaynak kodu ve dokümantasyon için depo kökündeki [`LICENSE`](../LICENSE) dosyasına bak. Kapsamlı eski derlenmiş uygulama paketi, depo kökündeki dağıtım dosyaları, `public/` varlıkları ve çıkarılmış `src/data/exercise-catalog.json` MIT kapsamına dahil değildir; bunların mevcut hakları saklıdır.
