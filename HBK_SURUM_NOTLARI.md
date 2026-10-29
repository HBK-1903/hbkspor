# HBK Spor — İz 2 kaynak proje sürümü (Cloudflare Pages paketi)

Bu paket `hbk-spor-src/` kaynak projesinden `npm run build` ile üretilmiştir (React 18 + Vite + Tailwind + lucide-react; başka bağımlılık yok).

## Yayınlama
- Cloudflare Pages → "Upload assets" → bu zip'in **içeriğini** (kök seviyede index.html, assets/, sw.js, _headers …) yükleyin.
- `_headers`: /assets/* immutable, /sw.js ve /index.html no-cache.
- SW cache adı `hbk-spor-cache-v3-<bundle hash>`; eski sürüm açıkken "Yeni sürüm hazır → Yenile" çubuğu çıkar.

## Veri uyumluluğu
- Aynı IndexedDB (`hbk_spor_performans_db` v2), aynı store/alan adları, aynı localStorage anahtarları (hbk_*).
- Mevcut kullanıcı verisi olduğu gibi okunur; JSON yedek v3 (v2 de yüklenir).

## Bu sürümde (kaynak portu)
Ana sayfa · Plan (haftalık/aylık, MD ritmi, gün düzenleyici, haftalık şablon + 4 hazır ritim) · Ekle (Gym Merkezi + form, Saha, Maç, Toparlanma, Dinlenme, GPS Koşu Faz 1, Saha Haritası 2.0, Alet Çantası) · Analiz (Yük/Form/Maç/Gelişim, tüm kayıtlar, kayıt detayı/düzenle/sil) · Daha (oyuncu kartı + kart fotoğrafı [galeri/kamera, yalnızca cihazda], PNG paylaşım, profil, kariyer, rozetler, çıkartma albümü, arkadaş kartları, drill kütüphanesi, skill testleri, egzersiz/şablon yöneticisi, yedek/CSV, ayarlar, demo).
