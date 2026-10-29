import { useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, MouseEvent } from 'react';
import { getAchievements } from './achievements';
import { getCustomGoalProgress, GOAL_METRIC_LABELS, GOAL_PERIOD_LABELS } from './goals';
import { getWeekComparison } from './weekly-comparison';
import type { WeeklyPlanDraft, RepeatCount } from './weekly-plan';
import { parseGpx, MAX_GPX_BYTES, formatDuration } from './gps';
import { DRILL_LIBRARY, type Drill, type DrillCategory } from './drills';
import { EXERCISE_LIBRARY, getWeekStartKey, localDateKey, MUSCLE_LABELS, shiftLocalDate } from './training';
import type { ExerciseDefinition } from './training';
import type { AppData, CustomDrill, CustomGoal, GoalMetric, GoalPeriod, GpsActivity, MuscleGroup, TrainingSession, WeeklyPlanItem } from './types';

const CATEGORIES: Array<'Tümü' | DrillCategory> = ['Tümü', 'Top kontrolü', 'Pas', 'Dripling', 'Bitiricilik', 'Hız & çeviklik', 'Özel'];
const MAX_GPS_ACTIVITIES = 30;
const shortDate = (date: string) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));
const formatNumber = (number: number, digits = 1) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits }).format(number);

export function DrillLibrary({ onUse, customDrills = [], onSaveCustom, onDeleteCustom }: {
  onUse: (drill: Drill) => void;
  customDrills?: CustomDrill[];
  onSaveCustom?: (drill: Omit<CustomDrill, 'id' | 'createdAt'>) => void;
  onDeleteCustom?: (id: string) => void;
}) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Tümü');
  const custom: Drill[] = customDrills.map((drill) => ({
    id: drill.id, name: drill.name, category: 'Özel', duration: drill.duration, level: 'Kişisel',
    positions: ['Kişisel'], equipment: drill.equipment || 'Belirtilmedi', description: drill.description,
    cues: ['Kendi saha düzenine göre uygula'],
    route: drill.routePoints.map(([x, y], index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' '),
    cones: drill.cones, players: [drill.routePoints[0], drill.routePoints[drill.routePoints.length - 1]], isCustom: true,
  }));
  const drills = [...DRILL_LIBRARY, ...custom].filter((drill) => category === 'Tümü' || drill.category === category);
  return <div className="visual-workspace">
    <section className="visual-intro"><span className="visual-intro__icon">⚽</span><div><p className="eyebrow">SAHADA DENEMEYE HAZIR</p><h2>Görselli çalışma kütüphanesi</h2><p>Hazır saha şemalarını kullan veya kendi rota ve konilerini çiz. Süreler öneridir; çalışma kayda dönüşmeden performans metriklerine eklenmez.</p></div></section>
    {onSaveCustom && <CustomDrillBuilder count={customDrills.length} onSave={onSaveCustom} />}
    <div className="drill-filters" role="group" aria-label="Çalışma türünü filtrele">{CATEGORIES.map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    {drills.length ? <div className="drill-grid">{drills.map((drill) => <DrillCard key={drill.id} drill={drill} onUse={() => onUse(drill)} onDelete={drill.isCustom ? () => onDeleteCustom?.(drill.id) : undefined} />)}</div> : <p className="empty-copy">Bu filtrede henüz özel çalışma yok; ilkini yukarıda çiz.</p>}
    <p className="analysis-disclaimer">Şemalar eğitim amaçlıdır; gerçek saha ölçüsü veya profesyonel antrenör yönlendirmesinin yerine geçmez.</p>
  </div>;
}

function DrillCard({ drill, onUse, onDelete }: { drill: Drill; onUse: () => void; onDelete?: () => void }) {
  const [playing, setPlaying] = useState(false);
  return <article className="drill-card">
    <div className={`drill-card__art${playing ? ' is-animated' : ''}`}><DrillDiagram drill={drill} animated={playing} /><span className="drill-duration">⏱ {drill.duration} dk</span><button type="button" className="drill-play" aria-pressed={playing} onClick={() => setPlaying((value) => !value)}>{playing ? 'Ⅱ Durdur' : '▶ Canlandır'}</button></div>
    <div className="drill-card__body"><div className="drill-meta"><span>{drill.category}</span><span>{drill.level}</span></div><h3>{drill.name}</h3><p>{drill.description}</p><div className="drill-tags">{drill.positions.map((position) => <span key={position}>{position}</span>)}</div><div className="drill-equipment">🟠 {drill.equipment}</div><details className="drill-cues"><summary>Uygulama ipuçları</summary><ul>{drill.cues.map((cue) => <li key={cue}>{cue}</li>)}</ul></details><button type="button" className="secondary-button full-button" onClick={onUse}>Saha kaydına ekle <span aria-hidden="true">→</span></button>{onDelete && <button type="button" className="drill-delete" onClick={onDelete}>Özel çalışmayı sil</button>}</div>
  </article>;
}

function CustomDrillBuilder({ count, onSave }: { count: number; onSave: (drill: Omit<CustomDrill, 'id' | 'createdAt'>) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('Kendi çizdiğim saha çalışması.');
  const [equipment, setEquipment] = useState('Top · koniler');
  const [duration, setDuration] = useState('15');
  const [tool, setTool] = useState<'route' | 'cone'>('route');
  const [routePoints, setRoutePoints] = useState<Array<[number, number]>>([]);
  const [cones, setCones] = useState<Array<[number, number]>>([]);
  const [error, setError] = useState('');
  const addPoint = (event: MouseEvent<SVGSVGElement>) => {
    if (count >= 20) { setError('En fazla 20 özel drill saklanabilir.'); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(Math.max(10, Math.min(310, (event.clientX - rect.left) / rect.width * 320)));
    const y = Math.round(Math.max(10, Math.min(180, (event.clientY - rect.top) / rect.height * 190)));
    if (tool === 'route') {
      if (routePoints.length >= 12) { setError('Bir drill için en fazla 12 rota noktası ekleyebilirsin.'); return; }
      setRoutePoints((current) => [...current, [x, y]]);
    } else {
      if (cones.length >= 10) { setError('Bir drill için en fazla 10 koni ekleyebilirsin.'); return; }
      setCones((current) => [...current, [x, y]]);
    }
    setError('');
  };
  const save = () => {
    const parsedDuration = Number(duration);
    if (!name.trim() || routePoints.length < 2 || !Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 120 || count >= 20) {
      setError('İsim gir, sahaya en az iki rota noktası koy ve süreyi 1–120 dakika seç.'); return;
    }
    onSave({ name: name.trim().slice(0, 48), description: description.trim().slice(0, 160) || 'Kişisel saha çalışması.', equipment: equipment.trim().slice(0, 60) || 'Belirtilmedi', duration: parsedDuration, routePoints: [...routePoints], cones: [...cones] });
    setName(''); setRoutePoints([]); setCones([]); setError('');
  };
  const route = routePoints.map(([x, y], index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
  return <section className="card custom-drill-builder"><div className="section-head compact"><div><p className="eyebrow">KENDİ SAHA ŞEMAN</p><h2>Drill oluştur <small>{count}/20</small></h2></div><span>✎</span></div><p className="field-help">Rota veya koni aracını seçip sahaya dokun. Noktalar cihazında saklanır.</p>
    <label className="field-label">Çalışma adı<input value={name} onChange={(event) => setName(event.target.value)} maxLength={48} placeholder="Örn. Baskıdan çıkış" /></label>
    <svg className="drill-builder-field" viewBox="0 0 320 190" role="img" aria-label="Kişisel drill çizim alanı; seçilen araçla noktalar eklemek için dokun" onClick={addPoint}><rect x="4" y="4" width="312" height="182" rx="15" fill="#173b2a" stroke="#89ab71"/><path d="M160 5V185M5 95H315" fill="none" stroke="#d8e5c3" strokeOpacity=".42"/><circle cx="160" cy="95" r="24" fill="none" stroke="#d8e5c3" strokeOpacity=".42"/>{routePoints.length > 1 && <path d={route} fill="none" stroke="#d8ff8c" strokeWidth="4" strokeDasharray="7 5" strokeLinecap="round" strokeLinejoin="round"/>}{routePoints.map(([x, y], index) => <g key={`route-${index}`}><circle cx={x} cy={y} r={index === 0 || index === routePoints.length - 1 ? 7 : 5} fill={index === 0 ? '#d8ff8c' : index === routePoints.length - 1 ? '#ff8167' : '#70d6ff'} stroke="#102018" strokeWidth="2"/><text x={x + 8} y={y - 7} fill="#efffdb" fontSize="8">{index === 0 ? 'BAŞLA' : index === routePoints.length - 1 ? 'BİTİR' : index + 1}</text></g>)}{cones.map(([x, y], index) => <path key={`cone-${index}`} d={`M${x} ${y - 7} l7 13 h-14 z`} fill="#fb923c" stroke="#fff0c2" strokeWidth="1.2"/>)}<g transform="translate(16 165)"><text x="0" y="0" fill="#d4e4d0" fontSize="8">● Rota noktası  ▲ Koni</text></g></svg>
    <div className="builder-tools"><button type="button" className={tool === 'route' ? 'active' : ''} onClick={() => setTool('route')}>● Rota çiz</button><button type="button" className={tool === 'cone' ? 'active' : ''} onClick={() => setTool('cone')}>▲ Koni koy</button><button type="button" onClick={() => tool === 'route' ? setRoutePoints((points) => points.slice(0, -1)) : setCones((points) => points.slice(0, -1))}>Geri al</button><button type="button" onClick={() => { setRoutePoints([]); setCones([]); }}>Temizle</button></div>
    <div className="form-grid"><label className="field-label">Süre (dk)<input type="number" min="1" max="120" value={duration} onChange={(event) => setDuration(event.target.value)} /></label><label className="field-label">Ekipman<input value={equipment} onChange={(event) => setEquipment(event.target.value)} maxLength={60} /></label></div>
    <label className="field-label">Kısa açıklama<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={160} /></label>{error && <p className="gps-import-error" role="alert">{error}</p>}<button type="button" className="primary-button full-button" onClick={save} disabled={count >= 20}>Drill’i kaydet</button>
  </section>;
}

function DrillDiagram({ drill, animated }: { drill: Drill; animated: boolean }) {
  const arrowId = `arrow-${drill.id}`;
  return <svg className={`drill-diagram${animated ? ' is-animated' : ''}`} viewBox="0 0 320 190" role="img" aria-label={`${drill.name} saha şeması`}>
    <defs><marker id={arrowId} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 Z" fill="#d8ff8c" /></marker><linearGradient id={`field-${drill.id}`} x1="0" x2="1"><stop stopColor="#173b2a" /><stop offset="1" stopColor="#214d31" /></linearGradient></defs>
    <rect x="6" y="6" width="308" height="178" rx="15" fill={`url(#field-${drill.id})`} stroke="#7bac68" strokeOpacity=".65" />
    <path d="M160 7 V183 M7 95 H313 M7 50 H49 V140 H7 M313 50 H271 V140 H313" fill="none" stroke="#d8e5c3" strokeOpacity=".34" strokeWidth="1.2" />
    <circle cx="160" cy="95" r="24" fill="none" stroke="#d8e5c3" strokeOpacity=".34" strokeWidth="1.2" />
    <path className="drill-route" d={drill.route} fill="none" stroke="#d8ff8c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 5" markerEnd={`url(#${arrowId})`} />
    {drill.alternateRoute && <path d={drill.alternateRoute} fill="none" stroke="#58c7ff" strokeOpacity=".92" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 5" markerEnd={`url(#${arrowId})`} />}
    {drill.cones.map(([cx, cy], index) => <g key={`cone-${index}`}><circle cx={cx} cy={cy} r="6" fill={index % 2 ? '#fb923c' : '#ffcf5c'} stroke="#fff3cf" strokeWidth="1.5" /><circle cx={cx} cy={cy} r="10" fill="none" stroke="#ffcf5c" strokeOpacity=".23" /></g>)}
    {drill.players.map(([px, py], index) => <g className="drill-player" key={`player-${index}`}><circle cx={px} cy={py} r="7" fill="#e9ffbe" stroke="#112018" strokeWidth="2" /><path d={`M${px} ${py + 8} v9`} stroke="#e9ffbe" strokeWidth="2.5" strokeLinecap="round" /></g>)}
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

export function ProgressAchievements({ data, weekStart, onAddGoal, onDeleteGoal }: { data: AppData; weekStart: string; onAddGoal: (goal: Omit<CustomGoal, 'id' | 'createdAt'>) => void; onDeleteGoal: (id: string) => void }) {
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
    <CustomGoalPanel data={data} goals={data.customGoals ?? []} onAdd={onAddGoal} onDelete={onDeleteGoal} />
    <section className="card progress-records"><div className="section-head compact"><div><p className="eyebrow">KAYIT KAPSAMI</p><h2>İlerlemenin dayanağı</h2></div><span>🔒</span></div><div><b>{data.demoMode ? 0 : data.sessions.filter((session) => session.kind !== 'rest').length}</b><span> aktif seans</span><i /><b>{data.demoMode ? 0 : (data.gpsActivities ?? []).length}</b><span> GPS rotası</span><i /><b>{recentTests.length}</b><span> test sonucu</span></div><p className="field-help">Bu ekrandaki rozetler ve grafikler yerel kayıtlarından hesaplanır. Paylaşım veya otomatik veri aktarımı yapılmaz.</p></section>
  </div>;
}

export function ExerciseVisualLibrary({ onChoose }: { onChoose: (exerciseId: string) => void }) {
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all');
  const [query, setQuery] = useState('');
  const exercises = EXERCISE_LIBRARY.filter((exercise) => {
    const matchesMuscle = muscle === 'all' || exercise.primaryMuscles.includes(muscle) || exercise.secondaryMuscles.includes(muscle);
    return matchesMuscle && exercise.name.toLocaleLowerCase('tr-TR').includes(query.trim().toLocaleLowerCase('tr-TR'));
  });
  return <div className="visual-workspace">
    <section className="visual-intro"><span className="visual-intro__icon">💪</span><div><p className="eyebrow">HAREKET GALERİSİ</p><h2>Görselli hareket kütüphanesi</h2><p>Kas grubu çizimleri şematiktir. Bir hareketi seçerek Gym kaydında set ve tekrar girmeye geç.</p></div></section>
    <label className="field-label">Hareket ara<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Örn. squat" /></label>
    <label className="field-label">Kas grubuna göre filtrele<select value={muscle} onChange={(event) => setMuscle(event.target.value as MuscleGroup | 'all')}><option value="all">Tüm kas grupları</option>{Object.entries(MUSCLE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <div className="exercise-visual-grid">{exercises.map((exercise) => <ExerciseVisualCard key={exercise.id} exercise={exercise} onChoose={() => onChoose(exercise.id)} />)}</div>
    {!exercises.length && <p className="empty-copy">Bu aramayla eşleşen hareket yok.</p>}
    <p className="analysis-disclaimer">Çizimler kas gruplarını hatırlatmak için hazırlanmış şematik görsellerdir; hareket tekniği veya sakatlık önleme tavsiyesi değildir.</p>
  </div>;
}

function ExerciseVisualCard({ exercise, onChoose }: { exercise: ExerciseDefinition; onChoose: () => void }) {
  const target = [...exercise.primaryMuscles, ...exercise.secondaryMuscles];
  const lower = target.some((muscle) => ['quadriceps', 'hamstrings', 'glutes', 'calves'].includes(muscle));
  const core = target.includes('core') && !lower;
  const pull = target.some((muscle) => ['back', 'biceps'].includes(muscle));
  const kind = lower ? 'lower' : core ? 'core' : pull ? 'pull' : 'push';
  return <article className="exercise-visual-card"><div className={`exercise-art exercise-art--${kind}`}><svg viewBox="0 0 160 110" role="img" aria-label={`${exercise.name} için şematik hareket görseli`}>
    <defs><linearGradient id={`exercise-bg-${exercise.id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#25392b"/><stop offset="1" stopColor="#101a14"/></linearGradient></defs>
    <rect x="2" y="2" width="156" height="106" rx="14" fill={`url(#exercise-bg-${exercise.id})`} stroke="#8eaa78" strokeOpacity=".38"/>
    <path d="M20 87H140" stroke="#dbe8d4" strokeOpacity=".25" strokeWidth="2"/>
    {kind === 'lower' ? <g fill="none" stroke="#e4f1dc" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><circle cx="80" cy="24" r="8" fill="#e4f1dc" stroke="none"/><path d="M80 34L80 58 61 69 51 86M80 58L99 68 109 86M64 43L44 57M96 43L115 54"/><path d="M51 86H40M109 86H121" stroke="#b8f34b"/></g> : kind === 'core' ? <g fill="none" stroke="#e4f1dc" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><circle cx="46" cy="62" r="7" fill="#e4f1dc" stroke="none"/><path d="M54 63L91 63 115 70M68 63L56 84M91 63L104 84M115 70L132 70"/><path d="M49 50Q79 36 112 51" stroke="#b8f34b" strokeWidth="3"/></g> : kind === 'pull' ? <g fill="none" stroke="#e4f1dc" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><circle cx="78" cy="22" r="8" fill="#e4f1dc" stroke="none"/><path d="M78 32L78 60M78 39L49 57 36 48M78 39L107 57 120 48M78 60L62 85M78 60L94 85"/><path d="M31 42L41 52M115 52L125 42" stroke="#b8f34b" strokeWidth="4"/><path d="M27 38V22H133V38" stroke="#70d6ff" strokeWidth="2"/></g> : <g fill="none" stroke="#e4f1dc" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><circle cx="80" cy="24" r="8" fill="#e4f1dc" stroke="none"/><path d="M80 34L80 61M80 41L47 39M80 41L113 39M80 61L63 86M80 61L97 86"/><path d="M38 35H122M45 30V40M115 30V40" stroke="#b8f34b" strokeWidth="3"/></g>}
    {target.slice(0, 3).map((group, index) => <circle key={group} cx={index === 0 ? 72 : index === 1 ? 85 : 78} cy={kind === 'lower' ? 61 + index * 9 : kind === 'core' ? 62 : 45 + index * 7} r="4.5" fill="#b8f34b" stroke="#efffd4" strokeWidth="1"/>)}
  </svg></div><div className="exercise-visual-card__body"><h3>{exercise.name}</h3><div className="exercise-muscle-tags">{target.slice(0, 4).map((group) => <span key={group}>{MUSCLE_LABELS[group]}</span>)}</div><button type="button" className="secondary-button full-button" onClick={onChoose}>Gym kaydına ekle</button></div></article>;
}

const PLAN_KIND_LABELS: Record<TrainingSession['kind'], string> = { gym: 'Gym', pitch: 'Saha', match: 'Maç', gps: 'GPS', timer: 'Tempo', recovery: 'Toparlanma', rest: 'Dinlenme' };
const PLAN_KIND_ICONS: Record<TrainingSession['kind'], string> = { gym: '🏋️', pitch: '⚽', match: '🏟️', gps: '🏃', timer: '⏱️', recovery: '🧘', rest: '🌙' };

export function WeeklyPlanner({ items, onAdd, onDelete, onStart }: {
  items: WeeklyPlanItem[];
  onAdd: (item: WeeklyPlanDraft) => void;
  onDelete: (id: string, deleteSeries?: boolean) => void;
  onStart: (item: WeeklyPlanItem) => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<TrainingSession['kind']>('pitch');
  const [minutes, setMinutes] = useState('45');
  const [time, setTime] = useState('17:00');
  const [repeatCount, setRepeatCount] = useState<RepeatCount>(1);
  const [date, setDate] = useState(localDateKey());
  const [error, setError] = useState('');
  const baseWeek = getWeekStartKey();
  const weekStart = shiftLocalDate(baseWeek, weekOffset * 7);
  const dates = Array.from({ length: 7 }, (_, index) => shiftLocalDate(weekStart, index));
  const visibleItems = items.filter((item) => dates.includes(item.date)).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'tr'));
  const changeWeek = (amount: number) => {
    const nextOffset = weekOffset + amount;
    setWeekOffset(nextOffset);
    setDate(shiftLocalDate(baseWeek, nextOffset * 7));
  };
  const add = () => {
    const parsedMinutes = Number(minutes);
    if (!title.trim() || !dates.includes(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isInteger(parsedMinutes) || parsedMinutes < 0 || parsedMinutes > 600 || items.length + repeatCount > 100) {
      setError('Başlık, saat ve bu haftadan bir gün seç; süre 0–600 dakika olmalı (en fazla 100 plan kaydı).');
      return;
    }
    onAdd({ date, time, kind, title: title.trim().slice(0, 60), minutes: parsedMinutes, repeatCount });
    setTitle(''); setError('');
  };
  return <div className="visual-workspace">
    <section className="visual-intro"><span className="visual-intro__icon">🗓️</span><div><p className="eyebrow">HAFTALIK PLAN</p><h2>Çalışmalarını önceden gör</h2><p>Planlar niyet/taslak olarak saklanır. İstatistiklere ancak kaydı gerçekten tamamladığında girer.</p></div></section>
    <section className="card weekly-planner"><div className="planner-heading"><button type="button" className="secondary-button" aria-label="Önceki hafta" onClick={() => changeWeek(-1)}>‹</button><div><p className="eyebrow">HAFTA PLANI</p><h2>{shortDate(weekStart)} – {shortDate(dates[6])}</h2></div><button type="button" className="secondary-button" aria-label="Sonraki hafta" onClick={() => changeWeek(1)}>›</button></div>
      <div className="planner-week" role="list" aria-label="Haftanın planı">{dates.map((day) => {
        const dayItems = visibleItems.filter((item) => item.date === day);
        return <section className={`planner-day${day === localDateKey() ? ' is-today' : ''}`} key={day} role="listitem"><div className="planner-day__head"><b>{new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(new Date(`${day}T12:00:00`))}</b><time>{new Intl.DateTimeFormat('tr-TR', { day: 'numeric' }).format(new Date(`${day}T12:00:00`))}</time></div>{dayItems.length ? dayItems.map((item) => <article className={`plan-item${item.completedSessionId ? ' is-complete' : ''}`} key={item.id}><span>{PLAN_KIND_ICONS[item.kind]}</span><b>{item.title}</b><small>{item.time ?? '17:00'} · {item.minutes} dk · {PLAN_KIND_LABELS[item.kind]}</small>{item.recurrenceId && <small className="plan-repeat">↻ Haftalık tekrar</small>}{item.completedSessionId ? <small className="plan-done">✓ Kayda dönüştü</small> : <button type="button" className="plan-start" onClick={() => onStart(item)}>Kayda dönüştür →</button>}<button type="button" className="plan-delete" aria-label={`${item.title} tekrarını sil`} onClick={() => onDelete(item.id)}>Bu tekrar</button>{item.recurrenceId && <button type="button" className="plan-delete plan-delete--series" aria-label={`${item.title} haftalık serisini sil`} onClick={() => onDelete(item.id, true)}>Tüm seri</button>}</article>) : <span className="planner-day__empty">Boş</span>}</section>;
      })}</div>
    </section>
    <section className="card plan-form"><div className="section-head compact"><div><p className="eyebrow">YENİ PLAN</p><h2>Bir çalışma ekle</h2></div><span>＋</span></div><label className="field-label">Çalışma adı<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} placeholder="Örn. Teknik pas çalışması" /></label><div className="form-grid planner-form-grid"><label className="field-label">Gün<input type="date" value={date} min={dates[0]} max={dates[6]} onChange={(event) => setDate(event.target.value)} /></label><label className="field-label">Saat<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label><label className="field-label">Tür<select value={kind} onChange={(event) => setKind(event.target.value as TrainingSession['kind'])}>{Object.entries(PLAN_KIND_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div><label className="field-label">Planlanan süre (dakika)<input type="number" min="0" max="600" step="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label><label className="field-label">Tekrar<select value={repeatCount} onChange={(event) => setRepeatCount(Number(event.target.value) as RepeatCount)}><option value={1}>Yalnızca bu hafta</option><option value={4}>Her hafta · 4 tekrar</option><option value={8}>Her hafta · 8 tekrar</option><option value={12}>Her hafta · 12 tekrar</option></select></label>{error && <p className="gps-import-error" role="alert">{error}</p>}<button type="button" className="primary-button full-button" onClick={add}>Haftaya ekle</button></section>
  </div>;
}

function CustomGoalPanel({ data, goals, onAdd, onDelete }: { data: AppData; goals: CustomGoal[]; onAdd: (goal: Omit<CustomGoal, 'id' | 'createdAt'>) => void; onDelete: (id: string) => void }) {
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('sessions');
  const [period, setPeriod] = useState<GoalPeriod>('month');
  const [target, setTarget] = useState('8');
  const [error, setError] = useState('');
  const add = () => {
    const numericTarget = Number(target);
    const max = metric === 'gpsKm' ? 1000 : 10_000;
    if (!title.trim() || !Number.isFinite(numericTarget) || numericTarget <= 0 || numericTarget > max || (metric !== 'gpsKm' && !Number.isInteger(numericTarget)) || goals.length >= 10) {
      setError('Başlık ve geçerli bir hedef gir; en fazla 10 kişisel hedef saklanabilir.');
      return;
    }
    onAdd({ title: title.trim().slice(0, 48), metric, period, target: numericTarget });
    setTitle(''); setError('');
  };
  return <section className="card custom-goals"><div className="section-head compact"><div><p className="eyebrow">KENDİ HEDEFİN</p><h2>Kişisel hedefler</h2></div><span>🎯</span></div><p className="field-help">Hedefler yalnızca seçtiğin kayıt türünü toplar. Dinlenme ve demo kayıtları ilerleme sayılmaz.</p>
    {goals.length > 0 && <div className="custom-goal-list">{goals.map((goal) => {
      const value = getCustomGoalProgress(goal, data);
      const complete = value >= goal.target;
      const display = goal.metric === 'gpsKm' ? formatNumber(value, 1) : formatNumber(value, 0);
      return <article className="custom-goal-card" key={goal.id}><div className="custom-goal-card__top"><div><b>{goal.title}</b><small>{GOAL_PERIOD_LABELS[goal.period]} · {GOAL_METRIC_LABELS[goal.metric]}</small></div><button type="button" className="remove-exercise" aria-label={`${goal.title} hedefini sil`} onClick={() => onDelete(goal.id)}>×</button></div><div className="achievement-progress"><i style={{ width: `${Math.min(100, value / goal.target * 100)}%` }} /></div><div className="custom-goal-card__foot"><span>{display} / {formatNumber(goal.target, goal.metric === 'gpsKm' ? 1 : 0)} {GOAL_METRIC_LABELS[goal.metric]}</span><b>{complete ? '✓ Tamamlandı' : 'Devam ediyor'}</b></div></article>;
    })}</div>}
    <div className="custom-goal-form"><label className="field-label">Hedef adı<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={48} placeholder="Örn. Ayda 8 saha çalışması" /></label><div className="form-grid"><label className="field-label">Ölçüt<select value={metric} onChange={(event) => setMetric(event.target.value as GoalMetric)}>{Object.entries(GOAL_METRIC_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="field-label">Dönem<select value={period} onChange={(event) => setPeriod(event.target.value as GoalPeriod)}>{Object.entries(GOAL_PERIOD_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div><label className="field-label">Hedef miktarı<input type="number" min="0.1" max={metric === 'gpsKm' ? 1000 : 10000} step={metric === 'gpsKm' ? '0.1' : '1'} value={target} onChange={(event) => setTarget(event.target.value)} /></label>{error && <p className="gps-import-error" role="alert">{error}</p>}<button type="button" className="secondary-button full-button" onClick={add}>Kişisel hedef oluştur</button></div>
  </section>;
}

export function WeeklyComparison({ data }: { data: AppData }) {
  const comparison = getWeekComparison(data);
  const currentRange = `${shortDate(comparison.currentStart)} – ${shortDate(comparison.currentEnd)}`;
  const previousRange = `${shortDate(comparison.previousStart)} – ${shortDate(comparison.previousEnd)}`;
  const metrics = [
    { key: 'sessions' as const, label: 'Aktif seans', unit: 'seans', icon: '⚽' },
    { key: 'minutes' as const, label: 'Kaydedilen süre', unit: 'dk', icon: '⏱️' },
    { key: 'gpsKm' as const, label: 'İçe aktarılan GPS', unit: 'km', icon: '⌁' },
    { key: 'tests' as const, label: 'Test sonucu', unit: 'sonuç', icon: '📈' },
  ];
  return <div className="visual-workspace">
    {data.demoMode && <p className="demo-data-note" role="note">Demo kayıtları haftalık kişisel karşılaştırmaya katılmaz.</p>}
    <section className="visual-intro"><span className="visual-intro__icon">↔</span><div><p className="eyebrow">HAFTADAN HAFTAYA</p><h2>Ritmini karşılaştır</h2><p>Bu haftanın bugüne kadarki kayıtlarını, geçen haftanın aynı günleriyle yan yana gör.</p></div></section>
    <div className="comparison-periods"><span><i className="comparison-dot current" />Bu hafta · {currentRange}</span><span><i className="comparison-dot previous" />Önceki hafta · {previousRange}</span></div>
    <div className="comparison-grid">{metrics.map((metric) => {
      const current = comparison.current[metric.key];
      const previous = comparison.previous[metric.key];
      const maximum = Math.max(current, previous, metric.key === 'gpsKm' ? .1 : 1);
      const format = (value: number) => metric.key === 'gpsKm' ? formatNumber(value, 2) : formatNumber(value, 0);
      return <article className="comparison-card" key={metric.key}><div className="comparison-card__head"><span>{metric.icon}</span><div><small>{metric.label}</small><b>{format(current)} <i>{metric.unit}</i></b></div></div><div className="comparison-row"><small>Bu hafta</small><div className="comparison-track"><i className="current" style={{ width: `${current ? Math.max(4, current / maximum * 100) : 0}%` }} /></div><b>{format(current)}</b></div><div className="comparison-row"><small>Önceki</small><div className="comparison-track"><i className="previous" style={{ width: `${previous ? Math.max(4, previous / maximum * 100) : 0}%` }} /></div><b>{format(previous)}</b></div></article>;
    })}</div>
    <p className="analysis-disclaimer">Bu yalnızca kayıt miktarlarının görsel karşılaştırmasıdır; tek başına performans, yorgunluk veya gelişim puanı değildir. GPS rotaları antrenman seanslarından ayrı sayılır.</p>
  </div>;
}
