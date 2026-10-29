import { useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import { getAchievements } from './achievements';
import { parseGpx, MAX_GPX_BYTES, formatDuration } from './gps';
import { DRILL_LIBRARY, type Drill, type DrillCategory } from './drills';
import { shiftLocalDate } from './training';
import type { AppData, GpsActivity } from './types';

const CATEGORIES: Array<'Tümü' | DrillCategory> = ['Tümü', 'Top kontrolü', 'Pas', 'Dripling', 'Bitiricilik', 'Hız & çeviklik'];
const MAX_GPS_ACTIVITIES = 30;
const shortDate = (date: string) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));
const formatNumber = (number: number, digits = 1) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits }).format(number);

export function DrillLibrary({ onUse }: { onUse: (drill: Drill) => void }) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Tümü');
  const drills = DRILL_LIBRARY.filter((drill) => category === 'Tümü' || drill.category === category);
  return <div className="visual-workspace">
    <section className="visual-intro"><span className="visual-intro__icon">⚽</span><div><p className="eyebrow">SAHADA DENEMEYE HAZIR</p><h2>Görselli çalışma kütüphanesi</h2><p>Her saha şeması kısa ve çevrimdışı çizimdir. Süreleri öneridir; kendi seviyene ve alanına göre uyarlayabilirsin.</p></div></section>
    <div className="drill-filters" role="group" aria-label="Çalışma türünü filtrele">{CATEGORIES.map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="drill-grid">{drills.map((drill) => <DrillCard key={drill.id} drill={drill} onUse={() => onUse(drill)} />)}</div>
    <p className="analysis-disclaimer">Şemalar eğitim amaçlı örneklerdir; gerçek saha ölçüsü veya profesyonel antrenör yönlendirmesinin yerine geçmez.</p>
  </div>;
}

function DrillCard({ drill, onUse }: { drill: Drill; onUse: () => void }) {
  return <article className="drill-card">
    <div className="drill-card__art"><DrillDiagram drill={drill} /><span className="drill-duration">⏱ {drill.duration} dk</span></div>
    <div className="drill-card__body"><div className="drill-meta"><span>{drill.category}</span><span>{drill.level}</span></div><h3>{drill.name}</h3><p>{drill.description}</p><div className="drill-tags">{drill.positions.map((position) => <span key={position}>{position}</span>)}</div><div className="drill-equipment">🟠 {drill.equipment}</div><details className="drill-cues"><summary>Uygulama ipuçları</summary><ul>{drill.cues.map((cue) => <li key={cue}>{cue}</li>)}</ul></details><button type="button" className="secondary-button full-button" onClick={onUse}>Saha kaydına ekle <span aria-hidden="true">→</span></button></div>
  </article>;
}

function DrillDiagram({ drill }: { drill: Drill }) {
  const arrowId = `arrow-${drill.id}`;
  return <svg className="drill-diagram" viewBox="0 0 320 190" role="img" aria-label={`${drill.name} saha şeması`}>
    <defs><marker id={arrowId} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 Z" fill="#d8ff8c" /></marker><linearGradient id={`field-${drill.id}`} x1="0" x2="1"><stop stopColor="#173b2a" /><stop offset="1" stopColor="#214d31" /></linearGradient></defs>
    <rect x="6" y="6" width="308" height="178" rx="15" fill={`url(#field-${drill.id})`} stroke="#7bac68" strokeOpacity=".65" />
    <path d="M160 7 V183 M7 95 H313 M7 50 H49 V140 H7 M313 50 H271 V140 H313" fill="none" stroke="#d8e5c3" strokeOpacity=".34" strokeWidth="1.2" />
    <circle cx="160" cy="95" r="24" fill="none" stroke="#d8e5c3" strokeOpacity=".34" strokeWidth="1.2" />
    <path d={drill.route} fill="none" stroke="#d8ff8c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 5" markerEnd={`url(#${arrowId})`} />
    {drill.alternateRoute && <path d={drill.alternateRoute} fill="none" stroke="#58c7ff" strokeOpacity=".92" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 5" markerEnd={`url(#${arrowId})`} />}
    {drill.cones.map(([cx, cy], index) => <g key={`cone-${index}`}><circle cx={cx} cy={cy} r="6" fill={index % 2 ? '#fb923c' : '#ffcf5c'} stroke="#fff3cf" strokeWidth="1.5" /><circle cx={cx} cy={cy} r="10" fill="none" stroke="#ffcf5c" strokeOpacity=".23" /></g>)}
    {drill.players.map(([px, py], index) => <g key={`player-${index}`}><circle cx={px} cy={py} r="7" fill="#e9ffbe" stroke="#112018" strokeWidth="2" /><path d={`M${px} ${py + 8} v9`} stroke="#e9ffbe" strokeWidth="2.5" strokeLinecap="round" /></g>)}
    <g transform="translate(17 164)"><circle cx="4" cy="4" r="4" fill="#e9ffbe"/><text x="12" y="7" fill="#d5e7d0" fontSize="8">oyuncu</text><circle cx="68" cy="4" r="4" fill="#fb923c"/><text x="76" y="7" fill="#d5e7d0" fontSize="8">koni</text></g>
  </svg>;
}

export function GpsActivityLibrary({ activities, onImport, onDelete }: { activities: GpsActivity[]; onImport: (activity: GpsActivity) => void; onDelete: (id: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setError('');
    if (activities.length >= MAX_GPS_ACTIVITIES) {
      setError(`En fazla ${MAX_GPS_ACTIVITIES} rota saklanabilir; yeni rota eklemeden önce birini sil.`);
      return;
    }
    if (!/\.gpx$/i.test(file.name) || file.size > MAX_GPX_BYTES) {
      setError('En fazla 8 MB boyutunda bir .gpx dosyası seç.');
      return;
    }
    setImporting(true);
    try {
      onImport(parseGpx(await file.text(), file.name));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'GPX dosyası okunamadı.');
    } finally {
      setImporting(false);
    }
  };
  const totalKm = activities.reduce((sum, activity) => sum + activity.distanceKm, 0);
  return <div className="visual-workspace">
    <section className="gps-hero"><div className="gps-hero__top"><span className="gps-hero__icon">⌁</span><div><p className="eyebrow">ROTALARIN · CİHAZINDA KALIR</p><h2>Koşu haritan</h2><p>GPX rotanı ekle; mesafe ve süre özetiyle birlikte gör. Harita karosu gerekmez, konum verisi dışarı gönderilmez.</p></div></div><div className="gps-hero__metrics"><span><b>{activities.length}</b><small>rota</small></span><span><b>{formatNumber(totalKm, 2)} km</b><small>içe aktarılan toplam mesafe</small></span><button type="button" className="primary-button" onClick={() => inputRef.current?.click()} disabled={importing}>{importing ? 'Okunuyor…' : '＋ GPX ekle'}</button></div><input ref={inputRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" hidden onChange={handleFile} /></section>
    {error && <p className="gps-import-error" role="alert">{error}</p>}
    {activities.length ? <div className="gps-activity-grid">{activities.slice().sort((a, b) => b.date.localeCompare(a.date)).map((activity) => <GpsActivityCard key={activity.id} activity={activity} onDelete={() => onDelete(activity.id)} />)}</div> : <section className="card gps-empty"><span aria-hidden="true">🗺️</span><h3>Henüz rota eklenmedi</h3><p>Telefonundaki saat veya spor uygulamasından GPX dışa aktar ve burada aç. Konum kayıtları antrenman sayılarına otomatik eklenmez.</p><button className="secondary-button" onClick={() => inputRef.current?.click()}>İlk rotanı seç</button></section>}
    <p className="analysis-disclaimer">Rota çizimi ham koordinatların sadeleştirilmiş görselleştirmesidir; harita, GPS doğruluğu veya performans ölçümü garantisi değildir. GPX dosyası yalnızca bu tarayıcıda işlenir.</p>
  </div>;
}

function GpsActivityCard({ activity, onDelete }: { activity: GpsActivity; onDelete: () => void }) {
  const paceSeconds = activity.distanceKm > 0 ? activity.durationSeconds / activity.distanceKm : 0;
  const pace = paceSeconds ? `${Math.floor(paceSeconds / 60)}:${String(Math.round(paceSeconds % 60)).padStart(2, '0')} /km` : '—';
  return <article className="gps-activity-card"><RouteMap activity={activity} /><div className="gps-activity-card__body"><div className="gps-activity-card__title"><div><time>{shortDate(activity.date)} · GPX</time><h3>{activity.fileName}</h3></div><button className="remove-exercise" type="button" aria-label={`${activity.fileName} rotasını sil`} onClick={onDelete}>×</button></div><div className="gps-activity-card__stats"><span><b>{formatNumber(activity.distanceKm, 2)}</b><small>km</small></span><span><b>{activity.durationSeconds ? formatDuration(activity.durationSeconds) : '—'}</b><small>süre</small></span><span><b>{pace}</b><small>ortalama tempo*</small></span></div><p>* GPX zaman damgalarından yaklaşık hesaplanır.</p></div></article>;
}

function RouteMap({ activity }: { activity: GpsActivity }) {
  const points = activity.route;
  if (points.length < 2) return <div className="route-visual route-visual--empty">Rota noktası yok</div>;
  const cosLat = Math.cos((points.reduce((sum, point) => sum + point.lat, 0) / points.length) * Math.PI / 180);
  const projected = points.map((point) => ({ x: point.lon * cosLat, y: point.lat, speedKmh: point.speedKmh }));
  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const maxY = Math.max(...projected.map((point) => point.y));
  const spanX = Math.max(maxX - minX, 0.00001);
  const spanY = Math.max(maxY - minY, 0.00001);
  const scale = Math.min(282 / spanX, 142 / spanY);
  const drawWidth = spanX * scale;
  const drawHeight = spanY * scale;
  const offsetX = (320 - drawWidth) / 2;
  const offsetY = (180 - drawHeight) / 2;
  const xy = projected.map((point) => ({ x: offsetX + (point.x - minX) * scale, y: 12 + offsetY + (maxY - point.y) * scale, speedKmh: point.speedKmh }));
  const path = xy.map((point) => `${point.x},${point.y}`).join(' ');
  const heatSpots = xy.filter((_, index) => index % Math.max(1, Math.floor(xy.length / 18)) === 0);
  return <svg className="route-visual" viewBox="0 0 320 180" role="img" aria-label={`${formatNumber(activity.distanceKm, 2)} kilometrelik GPX rotası; yeşilden turuncuya renk hız değişimini gösterir`}>
    <defs><pattern id={`route-grid-${activity.id}`} width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#c7e8cf" strokeOpacity=".06" strokeWidth=".7" /></pattern><radialGradient id={`route-heat-${activity.id}`}><stop stopColor="#d8ff8c" stopOpacity=".48" /><stop offset="1" stopColor="#d8ff8c" stopOpacity="0" /></radialGradient><filter id={`route-glow-${activity.id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter></defs>
    <rect width="320" height="180" rx="16" fill="#0d2119" /><rect width="320" height="180" rx="16" fill={`url(#route-grid-${activity.id})`} />
    {heatSpots.map((point, index) => <circle key={`heat-${index}`} cx={point.x} cy={point.y} r="16" fill={`url(#route-heat-${activity.id})`} />)}
    <polyline points={path} fill="none" stroke="#94f0a9" strokeOpacity=".48" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" filter={`url(#route-glow-${activity.id})`} />
    {xy.slice(1).map((point, index) => { const previous = xy[index]; const speed = point.speedKmh; const color = speed === undefined ? '#d8ff8c' : speed < 7 ? '#74e6a5' : speed < 12 ? '#ffd166' : '#ff875f'; return <line key={`segment-${index}`} x1={previous.x} y1={previous.y} x2={point.x} y2={point.y} stroke={color} strokeWidth="3.2" strokeLinecap="round" />; })}
    <circle cx={xy[0].x} cy={xy[0].y} r="5.5" fill="#d8ff8c" stroke="#102119" strokeWidth="2" /><text x={xy[0].x + 9} y={xy[0].y - 8} fill="#efffdb" fontSize="9" fontWeight="800">BAŞLANGIÇ</text>
    <circle cx={xy[xy.length - 1].x} cy={xy[xy.length - 1].y} r="5.5" fill="#ff8167" stroke="#102119" strokeWidth="2" /><text x={xy[xy.length - 1].x + 9} y={xy[xy.length - 1].y + 15} fill="#ffe8df" fontSize="9" fontWeight="800">BİTİŞ</text>
    <g transform="translate(14 12)"><rect width="103" height="19" rx="9.5" fill="#07140dcc" /><circle cx="10" cy="9.5" r="3" fill="#74e6a5" /><text x="17" y="13" fill="#cbd9ce" fontSize="8">daha yavaş</text><circle cx="67" cy="9.5" r="3" fill="#ff875f" /><text x="74" y="13" fill="#cbd9ce" fontSize="8">daha hızlı</text></g>
  </svg>;
}

export function ProgressAchievements({ data, weekStart }: { data: AppData; weekStart: string }) {
  const achievements = getAchievements(data);
  const unlocked = achievements.filter((achievement) => achievement.value >= achievement.target).length;
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = shiftLocalDate(weekStart, index);
    const sessions = data.demoMode ? [] : data.sessions.filter((session) => session.kind !== 'rest' && session.date === date);
    const minutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
    return { date, label: new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)), minutes };
  });
  const maxMinutes = Math.max(30, ...weekdays.map((day) => day.minutes));
  const recentTests = data.demoMode ? [] : data.skillTests ?? [];
  return <div className="visual-workspace">
    {data.demoMode && <p className="demo-data-note" role="note">Demo profilindeki örnek kayıtlar kişisel ilerleme ve rozet hesabına dahil edilmez.</p>}
    <section className="progress-hero"><div className="progress-hero__copy"><p className="eyebrow">KAYITLARINDAN HESAPLANIR</p><h2>Her çalışma bir adım ileri</h2><p>Rozetler yalnızca bu profildeki kayıtlarına dayanır; sağlık, yorgunluk veya sakatlık tahmini değildir.</p></div><div className="progress-ring" style={{ '--progress': `${(unlocked / achievements.length) * 100}%` } as CSSProperties}><strong>{unlocked}<small>/{achievements.length}</small></strong><span>açılan rozet</span></div></section>
    <section className="card weekly-visual"><div className="section-head compact"><div><p className="eyebrow">BU HAFTAKİ ÇALIŞMA</p><h2>Dakikalar, gün gün</h2></div><span>📊</span></div><div className="weekly-bars" role="img" aria-label="Bu haftaki antrenman dakikaları"><div className="weekly-bars__scale"><span>{formatNumber(maxMinutes, 0)} dk</span><span>0</span></div>{weekdays.map((day) => <div className="weekly-bar-col" key={day.date}><div className="weekly-bar-track"><i style={{ height: `${day.minutes ? Math.max(5, day.minutes / maxMinutes * 100) : 0}%` }} title={`${day.minutes} dakika`} /></div><small>{day.label}</small><b>{day.minutes ? `${day.minutes}′` : '·'}</b></div>)}</div><p className="field-help">Yalnızca kaydedilmiş aktif seans süreleri gösterilir; dinlenme günleri hariçtir.</p></section>
    <div className="achievement-grid">{achievements.map((achievement) => {
      const complete = achievement.value >= achievement.target;
      const progress = Math.min(100, achievement.value / achievement.target * 100);
      const displayValue = achievement.unit === 'km' ? formatNumber(achievement.value, 1) : formatNumber(achievement.value, 0);
      return <article key={achievement.id} className={`achievement-card${complete ? ' is-complete' : ''}`}><div className="achievement-card__top"><span className="achievement-icon" aria-hidden="true">{achievement.icon}</span><span className="achievement-status">{complete ? 'TAMAMLANDI' : 'SONRAKİ HEDEF'}</span></div><h3>{achievement.title}</h3><p>{achievement.detail}</p><div className="achievement-progress"><i style={{ width: `${progress}%` }} /></div><div className="achievement-card__foot"><span>{displayValue} / {achievement.target} {achievement.unit}</span>{complete && <b aria-label="Rozet açıldı">✦</b>}</div></article>;
    })}</div>
    <section className="card progress-records"><div className="section-head compact"><div><p className="eyebrow">KAYIT KAPSAMI</p><h2>İlerlemenin dayanağı</h2></div><span>🔒</span></div><div><b>{data.demoMode ? 0 : data.sessions.filter((session) => session.kind !== 'rest').length}</b><span> aktif seans</span><i /><b>{data.demoMode ? 0 : (data.gpsActivities ?? []).length}</b><span> GPS rotası</span><i /><b>{recentTests.length}</b><span> test sonucu</span></div><p className="field-help">Bu ekrandaki rozetler ve grafikler yerel kayıtlarından hesaplanır. Paylaşım veya otomatik veri aktarımı yapılmaz.</p></section>
  </div>;
}
