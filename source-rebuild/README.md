# HBK Spor — düzenlenebilir kaynak projesi

Bu depo, dağıtım için derlenmiş HBK Spor dosyalarını ve şimdi eklenen React/TypeScript kaynak uygulamasını içerir. `src/` içindeki uygulama, mevcut dağıtım paketinden geri çıkarılmış özgün kaynak kod değildir; düzenlenebilir, çalışan bir yeniden oluşturmadır ve orijinal uygulamanın tüm özellikleriyle aynı olduğunu iddia etmez.

## Gereksinimler

- Node.js 18 veya üzeri
- npm

## Yerel geliştirme

```bash
npm ci
npm run dev
```

Vite geliştirme sunucusu `0.0.0.0` üzerinde başlar.

## Üretim derlemesi

```bash
npm run build
npm run preview
```

Dağıtılabilir dosyalar `dist/` dizinine yazılır. Cloudflare Pages gibi statik hosting'e `dist/` içeriği gönderilebilir. Mevcut dağıtım dosyaları kökte ayrıca tutulur; burada üretim ortamına otomatik deploy yapılmaz.

## Kaynak düzeni

- `src/App.tsx`: ekranlar ve temel antrenman akışları
- `src/storage.ts`: cihaz içi kayıt ve dışa aktarma
- `src/types.ts`: uygulama veri tipleri
- `src/index.css`: responsive arayüz stilleri
- `public/`: PWA manifesti, ikonlar ve service worker

Bu kaynak sürümü profil ve antrenman verilerini `hbk_spor_rebuild_v1` anahtarıyla bu tarayıcıda saklar. Eski dağıtım sürümünün IndexedDB kayıtlarına geçiş yapmaz veya onları silmez. Eski verilerle uyumluluk/özellik eşitliği henüz doğrulanmamıştır.
