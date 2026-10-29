export type DrillCategory = 'Top kontrolü' | 'Pas' | 'Dripling' | 'Bitiricilik' | 'Hız & çeviklik' | 'Özel';

export interface Drill {
  id: string;
  name: string;
  category: DrillCategory;
  duration: number;
  level: 'Başlangıç' | 'Orta' | 'İleri' | 'Kişisel';
  positions: string[];
  equipment: string;
  description: string;
  cues: string[];
  route: string;
  alternateRoute?: string;
  cones: Array<[number, number]>;
  players: Array<[number, number]>;
  isCustom?: boolean;
}

export const DRILL_LIBRARY: Drill[] = [
  { id: 'first-touch-gate', name: 'İlk dokunuş kapısı', category: 'Top kontrolü', duration: 12, level: 'Başlangıç', positions: ['Orta saha', 'Kanat', 'Defans'], equipment: '1 top · 4 koni', description: 'Dar kapılara iki yönlü pas alıp ilk dokunuşla çıkış çalışması.', cues: ['Omuz kontrolü yap', 'İlk dokunuşu boş alana al'], route: 'M 52 145 C 90 120 108 75 145 91 S 203 130 257 55', alternateRoute: 'M 268 145 C 224 119 210 74 174 91 S 118 128 62 55', cones: [[70, 60], [250, 60], [70, 145], [250, 145]], players: [[54, 145], [268, 145]] },
  { id: 'triangle-pass', name: 'Üçgen pas ve destek', category: 'Pas', duration: 15, level: 'Başlangıç', positions: ['Orta saha', 'Defans'], equipment: '1 top · 3 koni', description: 'Pas sonrası yeni açıya hareket ederek üçgen desteği kur.', cues: ['Pas şiddetini ayarla', 'Pas sonrası yer değiştir'], route: 'M 70 130 L 160 53 L 250 130 L 70 130', cones: [[70, 130], [160, 53], [250, 130]], players: [[70, 130], [160, 53], [250, 130]] },
  { id: 'slalom-exit', name: 'Slalom ve hızlanma', category: 'Dripling', duration: 10, level: 'Orta', positions: ['Kanat', 'Forvet'], equipment: '1 top · 5 koni', description: 'Kısa slalomun ardından kontrollü şekilde hızlanıp yön değiştir.', cues: ['Yakın kontrolde küçük dokunuş', 'Çıkışta başını kaldır'], route: 'M 48 140 C 98 142 56 115 112 115 S 75 86 140 84 S 108 54 175 52 L 258 52', cones: [[78, 140], [105, 115], [135, 84], [170, 52], [258, 52]], players: [[48, 140], [258, 52]] },
  { id: 'finish-cross', name: 'Kanat ortası ve bitiriş', category: 'Bitiricilik', duration: 18, level: 'Orta', positions: ['Kanat', 'Forvet'], equipment: '1–2 top · 4 koni', description: 'Geniş alandan çizgiye in, hedef bölgeye orta ve bitiriş.', cues: ['Orta öncesi çevreyi tara', 'Koşu zamanlamasını ayarla'], route: 'M 46 130 C 102 125 135 105 181 73 M 181 73 Q 217 75 250 99', alternateRoute: 'M 52 54 C 105 58 139 77 181 101 M 181 101 Q 218 101 249 77', cones: [[48, 130], [181, 73], [250, 99], [48, 54]], players: [[46, 130], [250, 99]] },
  { id: 'one-two', name: 'Duvar pası ve yön değiştirme', category: 'Pas', duration: 12, level: 'Orta', positions: ['Orta saha', 'Forvet'], equipment: '1 top · 2 koni', description: 'Duvar pasıyla baskıdan çıkış ve karşı yöne hızla açılma.', cues: ['Pas sonrası çapraz koşu', 'İki ayağı da kullan'], route: 'M 57 130 Q 107 40 154 100 T 263 61', alternateRoute: 'M 56 60 Q 112 151 160 88 T 262 130', cones: [[60, 130], [260, 60]], players: [[57, 130], [263, 61]] },
  { id: 'reaction-gates', name: 'Renkli kapı reaksiyonu', category: 'Hız & çeviklik', duration: 10, level: 'İleri', positions: ['Kanat', 'Orta saha', 'Defans'], equipment: '1 top · 4 renkli koni', description: 'İşaret edilen kapıya kısa hızlanma, frenleme ve top kontrolüyle çık.', cues: ['Ağırlık merkezini alçalt', 'Frenlemede dengeyi koru'], route: 'M 157 148 C 125 116 100 97 65 60 M 157 148 C 194 115 219 91 257 57', alternateRoute: 'M 157 148 C 131 113 119 88 160 53', cones: [[65, 60], [257, 57], [160, 53], [157, 148]], players: [[157, 148]] },
];
