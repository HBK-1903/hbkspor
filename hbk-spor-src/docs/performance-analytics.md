# Performans Analizi: veri kaynakları ve GPS içe aktarma

Performans merkezi, Analiz sekmesindeki mevcut kayıtları birleştirir; legacy IndexedDB şemasını değiştirmez ve bu store’lara salt okunur bağlanır.

## Veri kaynakları

| Görünüm | Kaynak | Kullanım |
| --- | --- | --- |
| Antrenman ve setler | IndexedDB `workouts`, `exercises` | Süre, set/tekrar/ağırlık, egzersiz-kas eşlemesi ve oturumda girilmiş RPE |
| Maç | IndexedDB `matches` | Skor, dakika, gol/asist, puan, MVP ve kartlar/notlar |
| Planlanan–gerçekleşen | IndexedDB `weeklyPlan`, `customPlans` | Planlı antrenman gününü aynı tarihteki workout/maç ile eşleştirir |
| Oyuncu | IndexedDB `playerProfile` | Özet başlığında profil adı |
| Toparlanma | `workouts[].wellness` | Mevcut uyku, enerji, ağrı ve stres check-in’leri (1–5) |
| GPS | `localStorage` `hbk_gps_runs` | Uygulamadaki GPS aktiviteleri ve varsa rota |
| Performans testleri | `localStorage` `hbk_skill_tests_v1` | Mevcut test sonuçlarının tarihçesi ve kişisel en iyiler |
| Ek set RPE / dış GPS | `hbk_muscle_effort_v1`, `hbk_analytics_gps_imports_v1` | Uygulama DB’sinden bağımsız, cihazdaki ek analiz verisi |

`demo-`/`demo_` ile başlayan örnek kayıtlar analiz metriklerinden çıkarılır. Kas yükündeki öz bildirimli RPE × süre, ölçülmüş yorgunluk, sakatlık riski veya kas gelişimi değildir. RPE bulunmayan seanslara yük puanı uydurulmaz. Özet ekranı 4/8/12 haftayı eşit uzunluklu önceki dönemle karşılaştırır, 12 haftalık hareket takvimi ve tarih aralığı seçilebilir CSV raporu sunar.

## Strava veya cihazdan dosya alma

**Analiz → Performans analizi → GPS** alanında `.gpx`, `.tcx` veya `.fit` seçilebilir. Strava’dan tek aktiviteyi GPX olarak dışa aktarmak en basit başlangıçtır; Strava’nın “orijinal” FIT dosyası veya bir GPS saati/servisinin TCX/FIT dışa aktarımı da seçilebilir. ZIP arşivleri otomatik açılmaz; arşivi cihazda açıp içindeki aktivite dosyasını seçin. İçe aktarma 20 MB dosya boyutuyla sınırlıdır.

- **GPX / TCX:** Koordinat ve zaman noktalarından Haversine mesafesi, toplam süre, yaklaşık hareket süresi, ortalama tempo ve 1 km tempo turları hesaplanır. Yükseklik, kalp hızı veya kadans yalnızca dosyada varsa gösterilir.
- **FIT:** Dosya tarayıcı içinde ayrıştırılır. Uygun olduğunda cihazın oturum özeti (mesafe, hareket/toplam süre, ortalama/maksimum hız, nabız, kadans, tırmanış) tercih edilir; rota noktaları varsa haritada çizilir.
- Noktalar arasındaki aşırı zaman aralıkları ve fiziksel olarak makul olmayan sıçramalar mesafe hesabından çıkarılır. GPS örnekleme sıklığı, duraklama algısı, üretici filtresi ve yükseklik düzeltmeleri nedeniyle sonuçlar Strava veya saatin değerinden farklı olabilir.
- GPS sekmesinde 4/8/12 haftalık haftalık mesafe grafiği, aktivite sıralama, toplam hareket temposu ve mevcutsa tırmanış/nabız özeti bulunur. Her aktivitenin açılır ayrıntısı; tempo, nabız, yükseklik, kadans ve uygulama kayıtlarında GPS doğruluk/kesinti özetini kaynak veriye göre çizer. Tur tablosu ve GPX rota indirme de sunulur.
- GPX dışa aktarımı ham orijinal dosya değil; gizlilik ve depolama için saklanan en çok 600 rota örneğini verir. Uygulama GPS koşularında varsa cihazın kaydettiği kalite sınıfı, medyan doğruluk tahmini, reddedilen noktalar ve sinyal boşlukları yeniden kullanılır. Bunlar cihazın raporudur, ölçüm garantisi değildir.
- Hız bölgeleri gösterilmez; futbol/koşu/bisiklet için uygun ve kişiselleştirilmiş eşikler olmadan bölge sınıfı çıkarmak yanıltıcı olur.

Ham GPX/TCX/FIT dosyası sunucuya gönderilmez ve saklanmaz. İçe aktarılan kayıtlar cihazdaki localStorage’da tutulur; rota haritası için en fazla 600 konum noktası saklanır. Kullanıcı, aktivite kartındaki **Sil** ile içe aktarılan rotayı silebilir. Analiz yedeği set eforu ve dışarıdan içe aktarılan GPS aktivitelerini JSON olarak indirip başka cihaza taşıyabilir; uygulamanın asıl antrenman/maç verisi bu yedeğin parçası değildir.

Bu sürüm **Strava OAuth/API senkronizasyonu yapmaz**. Otomatik bağlantı için ayrı bir Strava uygulama kaydı, OAuth izin/onay ve yönlendirme akışı gerekir. Client secret tarayıcıya konmamalı; API çağrısı ve token saklama için güvenli bir sunucu/Worker katmanı tasarlanmalıdır. Kullanıcı onayı ve üretim kimlik bilgileri olmadan bu entegrasyon etkinleştirilmez.
