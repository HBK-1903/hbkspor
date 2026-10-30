import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { addLocalDays, currentWeekStart, formatDay, localDayKey } from './dates';
import type { AnalyticsData, GpsActivity, LegacyMatch, LegacyPlan, LegacyWorkout } from './types';
import { gpsDistanceAtProgress, gpsRouteSegmentAtProgress, projectGpsRoute, projectGpsRoutes, validGpsRoute } from './gps-map';
import './extended-analytics.css';

export type AnalyticsSection = 'overview' | 'muscles' | 'movements' | 'matches' | 'gps' | 'recovery' | 'tests' | 'records';
type AnalyticsRange = 4 | 8 | 12;
type NonMuscleSection = Exclude<AnalyticsSection, 'muscles' | 'movements'>;

interface Props {
  data: AnalyticsData;
  section: NonMuscleSection;
  weeks: AnalyticsRange;
  setWeeks: (value: AnalyticsRange) => void;
  onGpsImport: (file?: File) => void;
  onDeleteGps: (id: string) => void;
}

const dateToday = () => localDayKey();
const validNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const formatNumber = (value: number, digits = 0) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const formatPace = (seconds: number) => seconds > 0 && Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}` : '—';
const formatDuration = (seconds: number) => {
  const hours = Math.floor(Math.max(0, seconds) / 3600);
  const minutes = Math.floor((Math.max(0, seconds) % 3600) / 60);
  return hours ? `${hours} sa ${minutes} dk` : `${minutes} dk`;
};
const dateRangeStart = (weeks: AnalyticsRange) => addLocalDays(currentWeekStart(), -(weeks - 1) * 7);
const inRange = (date: string, start: string, end: string) => date >= start && date <= end;
const sessionType = (type?: string) => ['gym', 'saha', 'mac', 'takim'].includes(type ?? '');
const restType = (type?: string) => ['dinlenme', 'rejenerasyon', 'bos', ''].includes(type ?? '');
const dayOfWeek = (date: string) => new Date(`${date}T12:00:00`).getDay();
const readableWorkout = (workout: LegacyWorkout) => workout.title || ({ gym: 'Kuvvet antrenmanı', saha: 'Saha antrenmanı', toparlanma: 'Toparlanma' }[workout.type] ?? 'Antrenman');

function getPlanForDate(date: string, weeklyPlan: LegacyPlan[], customPlans: LegacyPlan[]): LegacyPlan | undefined {
  return customPlans.find((item) => item.date === date) ?? weeklyPlan.find((item) => Number(item.dayOfWeek) === dayOfWeek(date));
}

function plannedActual(data: AnalyticsData, start: string, end: string) {
  const completedDays = new Set([...data.workouts.filter((item) => sessionType(item.type)).map((item) => item.date), ...data.matches.map((item) => item.date)]);
  const dates: string[] = [];
  for (let date = start; date <= end; date = addLocalDays(date, 1)) {
    const plan = getPlanForDate(date, data.weeklyPlan, data.customPlans);
    if (plan && sessionType(plan.type) && !restType(plan.type)) dates.push(date);
  }
  return { planned: dates.length, completed: dates.filter((date) => completedDays.has(date)).length, dates };
}

function FilterBar({ weeks, setWeeks }: { weeks: AnalyticsRange; setWeeks: (value: AnalyticsRange) => void }) {
  return <div className="extended-filter" aria-label="Tarih aralığı">
    <span>Son</span>{([4, 8, 12] as AnalyticsRange[]).map((value) => <button key={value} type="button" aria-pressed={weeks === value} onClick={() => setWeeks(value)}>{value} hf</button>)}
  </div>;
}

function StatCard({ label, value, detail, accent = false }: { label: string; value: string | number; detail?: string; accent?: boolean }) {
  return <article className={`extended-stat${accent ? ' accent' : ''}`}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="extended-empty"><span aria-hidden="true">◌</span><h3>{title}</h3><p>{detail}</p></div>;
}

function WeeklyLoadChart({ workouts, start, weeks }: { workouts: LegacyWorkout[]; start: string; weeks: AnalyticsRange }) {
  const today = dateToday();
  const items = Array.from({ length: weeks }, (_, index) => {
    const weekStart = addLocalDays(start, index * 7);
    const weekEnd = addLocalDays(weekStart, 6);
    const sessions = workouts.filter((workout) => inRange(workout.date, weekStart, weekEnd));
    const minutes = sessions.reduce((sum, workout) => sum + (validNumber(workout.durationMinutes) ?? 0), 0);
    const loaded = sessions.filter((workout) => (validNumber(workout.rpeScale) ?? 0) >= 1 && (validNumber(workout.rpeScale) ?? 0) <= 10 && (validNumber(workout.durationMinutes) ?? 0) > 0);
    const rpeLoad = loaded.reduce((sum, workout) => sum + (validNumber(workout.rpeScale) ?? 0) * (validNumber(workout.durationMinutes) ?? 0), 0);
    return { weekStart, weekEnd, minutes, rpeLoad, rpeSessions: loaded.length, days: sessions.length };
  });
  const hasRpe = items.some((item) => item.rpeLoad > 0);
  const maximum = Math.max(1, ...items.map((item) => hasRpe ? item.rpeLoad : item.minutes));
  return <section className="extended-card">
    <div className="extended-card__heading"><div><p className="extended-kicker">HAFTALIK TREND</p><h3>{hasRpe ? 'Öz bildirime dayalı antrenman yükü' : 'Antrenman süresi'}</h3></div><span>{hasRpe ? 'RPE × dakika' : 'Dakika'}</span></div>
    <div className="load-chart" role="img" aria-label={`${weeks} haftalık ${hasRpe ? 'RPE x dakika yükü' : 'antrenman süresi'} grafiği`}>
      {items.map((item) => {
        const value = hasRpe ? item.rpeLoad : item.minutes;
        const height = Math.max(value ? 8 : 3, Math.round(value / maximum * 100));
        return <div className="load-chart__column" key={item.weekStart} title={`${formatDay(item.weekStart)}: ${hasRpe ? `${formatNumber(value)} RPE×dk` : `${formatNumber(value)} dk`}`}>
          <span className="load-chart__value">{value ? formatNumber(value) : '—'}</span><span className={`load-chart__bar${item.weekEnd >= today ? ' current' : ''}`} style={{ height: `${height}%` }} />
          <small>{formatDay(item.weekStart)}</small>
        </div>;
      })}
    </div>
    <p className="extended-note">{hasRpe ? 'Yalnızca oturumda öz bildirim olarak kaydedilmiş RPE (1–10) × süre kullanılır; bu değer ölçülmüş yorgunluk veya sakatlık riski değildir.' : 'Kayıtlı süre gösteriliyor. Oturum RPE’si olmayan çalışmalar için yük puanı üretilmedi.'}</p>
  </section>;
}

function PlanCard({ data, start, end }: { data: AnalyticsData; start: string; end: string }) {
  const { planned, completed } = plannedActual(data, start, end);
  const percent = planned ? Math.round(completed / planned * 100) : 0;
  return <section className="extended-card plan-card">
    <div className="extended-card__heading"><div><p className="extended-kicker">PLAN · GERÇEKLEŞEN</p><h3>Planlanan oturumlar</h3></div><span className="plan-percent">{planned ? `${percent}%` : '—'}</span></div>
    {planned ? <><div className="plan-progress"><span style={{ width: `${Math.min(100, percent)}%` }} /></div><p><strong>{completed} / {planned}</strong> planlı gün antrenman veya maç kaydıyla tamamlandı.</p><small>Yalnızca kayıtlı haftalık/özel planlar ve aynı tarihteki oturumlar karşılaştırılır.</small></> : <p className="extended-note">Bu tarih aralığında eşleştirilebilir aktif plan bulunamadı. Uygulamadaki haftalık plan ve tarihli özel planlar kullanılır.</p>}
  </section>;
}

function ActivityHeatmap({ data }: { data: AnalyticsData }) {
  const start = addLocalDays(currentWeekStart(), -77);
  const end = dateToday();
  const activeDates = new Map<string, number>();
  [...data.workouts.filter((item) => sessionType(item.type)).map((item) => item.date), ...data.matches.map((item) => item.date)].forEach((date) => activeDates.set(date, (activeDates.get(date) ?? 0) + 1));
  const cells = Array.from({ length: 84 }, (_, index) => {
    const date = addLocalDays(start, index);
    const count = date <= end ? activeDates.get(date) ?? 0 : 0;
    const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;
    return { date, count, level };
  });
  return <section className="extended-card"><div className="extended-card__heading"><div><p className="extended-kicker">12 HAFTALIK AKTİVİTE</p><h3>Aktivite takvimi</h3></div><span>Antrenman / maç günleri</span></div><div className="heatmap-wrap"><div className="heatmap-weekdays" aria-hidden="true">{['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => <small key={day}>{day}</small>)}</div><div className="activity-heatmap" aria-label="Son 12 haftanın antrenman ve maç takvimi">{cells.map((cell) => <span key={cell.date} className={`heat-cell level-${cell.level}`} title={`${formatDay(cell.date)} · ${cell.count} oturum`} aria-label={`${cell.date}: ${cell.count} oturum`} />)}</div></div><div className="heatmap-legend"><span>Daha az</span>{[0, 1, 2, 3].map((level) => <i key={level} className={`heat-cell level-${level}`} />)}<span>Daha çok</span></div></section>;
}

function downloadPeriodReport(data: AnalyticsData, weeks: AnalyticsRange) {
  const end = dateToday();
  const start = dateRangeStart(weeks);
  const header = ['Tür', 'Tarih', 'Ad / rakip / test', 'Süre (dk)', 'RPE öz bildirimi', 'Skor', 'Gol', 'Asist', 'Mesafe (km)', 'Tempo (sn/km)', 'Uyku (1-5)', 'Enerji (1-5)', 'Ağrı (1-5)', 'Stres (1-5)', 'Sonuç', 'Birim'];
  const csvCell = (value: unknown) => {
    let text = value === undefined || value === null ? '' : String(value);
    if (/^[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows: unknown[][] = [header];
  data.workouts.filter((item) => inRange(item.date, start, end)).forEach((item) => {
    rows.push(['Antrenman', item.date, readableWorkout(item), item.durationMinutes, item.rpeScale, '', '', '', '', '', '', '', '', '', '', '']);
  });
  data.matches.filter((item) => inRange(item.date, start, end)).forEach((item) => {
    rows.push(['Maç', item.date, item.opponent || 'Rakip', item.minutesPlayed, '', `${item.scoreOur ?? ''}-${item.scoreOpponent ?? ''}`, item.goals, item.assists, '', '', '', '', '', '', item.rating, '/10']);
  });
  data.gpsActivities.filter((item) => inRange(item.date, start, end)).forEach((item) => {
    const pace = item.movingSeconds && item.distanceKm ? Math.round(item.movingSeconds / item.distanceKm) : '';
    rows.push(['GPS', item.date, item.fileName || (item.source === 'app' ? 'Uygulama GPS’i' : `${item.source.toUpperCase()} içe aktarımı`), Math.round(item.elapsedSeconds / 60), '', '', '', '', item.distanceKm, pace, '', '', '', '', '', '']);
  });
  data.wellness.filter((item) => inRange(item.date, start, end)).forEach((item) => {
    rows.push(['Toparlanma (öz bildirim)', item.date, item.title, '', '', '', '', '', '', '', item.sleep, item.energy, item.soreness, item.stress, '', '']);
  });
  data.skillTests.forEach((test) => test.history.filter((item) => inRange(item.date, start, end)).forEach((item) => {
    rows.push(['Performans testi', item.date, test.name, '', '', '', '', '', '', '', '', '', '', '', item.value, test.unit]);
  }));
  const content = `\uFEFFHBK Spor performans raporu;${start} — ${end}\r\n\r\n${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `hbk-spor-performans-${start}-${end}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function PeriodComparison({ data, start, end }: { data: AnalyticsData; start: string; end: string }) {
  const days = Math.max(1, Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000) + 1);
  const previousEnd = addLocalDays(start, -1);
  const previousStart = addLocalDays(previousEnd, -(days - 1));
  const currentWorkouts = data.workouts.filter((item) => inRange(item.date, start, end));
  const previousWorkouts = data.workouts.filter((item) => inRange(item.date, previousStart, previousEnd));
  const currentMatches = data.matches.filter((item) => inRange(item.date, start, end));
  const previousMatches = data.matches.filter((item) => inRange(item.date, previousStart, previousEnd));
  const currentGps = data.gpsActivities.filter((item) => inRange(item.date, start, end)).reduce((sum, item) => sum + item.distanceKm, 0);
  const previousGps = data.gpsActivities.filter((item) => inRange(item.date, previousStart, previousEnd)).reduce((sum, item) => sum + item.distanceKm, 0);
  const currentMinutes = currentWorkouts.reduce((sum, item) => sum + (validNumber(item.durationMinutes) ?? 0), 0);
  const previousMinutes = previousWorkouts.reduce((sum, item) => sum + (validNumber(item.durationMinutes) ?? 0), 0);
  const rows = [
    { label: 'Oturum', current: currentWorkouts.length, previous: previousWorkouts.length, unit: '' },
    { label: 'Maç', current: currentMatches.length, previous: previousMatches.length, unit: '' },
    { label: 'Süre', current: currentMinutes, previous: previousMinutes, unit: ' dk' },
    { label: 'GPS', current: currentGps, previous: previousGps, unit: ' km' },
  ];
  return <section className="extended-card"><div className="extended-card__heading"><div><p className="extended-kicker">EŞİT SÜRELİ KARŞILAŞTIRMA</p><h3>Önceki döneme göre</h3></div><span>{previousStart} — {previousEnd}</span></div><div className="period-comparison">{rows.map((row) => { const delta = row.current - row.previous; const change = row.previous === 0 ? (row.current === 0 ? 'Önceki dönemde de 0' : `+${formatNumber(delta, row.unit === ' km' ? 1 : 0)} · önceki 0`) : `${delta > 0 ? '+' : ''}${formatNumber((delta / row.previous) * 100)}%`; return <div key={row.label}><span>{row.label}</span><strong>{formatNumber(row.current, row.unit === ' km' ? 1 : 0)}{row.unit}</strong><small className={delta > 0 ? 'up' : delta < 0 ? 'down' : ''}>{change}</small></div>; })}</div><p className="extended-note">Aynı uzunluktaki hemen önceki tarih aralığıyla kıyas. Artış/azalış yalnızca kayıt sayısı ve süreyi karşılaştırır; kalite veya performans iyileşmesi anlamına gelmez.</p></section>;
}

function Overview({ data, weeks, setWeeks }: { data: AnalyticsData; weeks: AnalyticsRange; setWeeks: (value: AnalyticsRange) => void }) {
  const end = dateToday();
  const start = dateRangeStart(weeks);
  const workouts = data.workouts.filter((item) => inRange(item.date, start, end));
  const matches = data.matches.filter((item) => inRange(item.date, start, end));
  const gps = data.gpsActivities.filter((item) => inRange(item.date, start, end));
  const minutes = workouts.reduce((sum, item) => sum + (validNumber(item.durationMinutes) ?? 0), 0);
  const goals = matches.reduce((sum, item) => sum + (validNumber(item.goals) ?? 0), 0);
  const rpeWorkouts = workouts.filter((item) => (validNumber(item.rpeScale) ?? 0) >= 1 && (validNumber(item.rpeScale) ?? 0) <= 10 && (validNumber(item.durationMinutes) ?? 0) > 0);
  const totalLoad = rpeWorkouts.reduce((sum, item) => sum + (validNumber(item.rpeScale) ?? 0) * (validNumber(item.durationMinutes) ?? 0), 0);
  const plan = plannedActual(data, start, end);
  return <div className="extended-view">
    <div className="extended-view__heading"><div><p className="extended-kicker">PERFORMANS MERKEZİ</p><h2>{data.profile?.name ? `${data.profile.name} · Genel bakış` : 'Genel bakış'}</h2><p>Uygulamadaki antrenman, maç, toparlanma ve GPS kayıtlarının birleştirilmiş görünümü.</p></div><div className="extended-view__tools"><FilterBar weeks={weeks} setWeeks={setWeeks} /><button type="button" className="report-export" onClick={() => downloadPeriodReport(data, weeks)}>CSV raporu indir</button></div></div>
    <div className="extended-grid extended-grid--stats">
      <StatCard label="Antrenman" value={workouts.length} detail={`${formatNumber(minutes)} dk kayıtlı süre`} />
      <StatCard label="Maç" value={matches.length} detail={`${goals} gol kaydı`} />
      <StatCard label="RPE × süre" value={totalLoad ? formatNumber(totalLoad) : '—'} detail={`${rpeWorkouts.length} öz bildirimli oturum`} accent />
      <StatCard label="GPS mesafesi" value={`${formatNumber(gps.reduce((sum, run) => sum + run.distanceKm, 0), 1)} km`} detail={`${gps.length} aktivite`} />
    </div>
    <PeriodComparison data={data} start={start} end={end} />
    <div className="extended-grid extended-grid--main">
      <WeeklyLoadChart workouts={workouts} start={start} weeks={weeks} />
      <PlanCard data={data} start={start} end={end} />
    </div>
    <ActivityHeatmap data={data} />
    <div className="extended-grid extended-grid--stats extended-secondary-stats">
      <StatCard label="Toparlanma check-in’i" value={data.wellness.filter((item) => inRange(item.date, start, end)).length} detail="öz bildirime dayalı kayıt" />
      <StatCard label="Performans testi" value={data.skillTests.reduce((sum, item) => sum + item.history.filter((row) => inRange(row.date, start, end)).length, 0)} detail="test sonucu" />
      <StatCard label="Set kaydı" value={workouts.reduce((sum, item) => sum + (item.gymExercises ?? []).reduce((exerciseSum, exercise) => exerciseSum + exercise.sets.length, 0), 0)} detail="kuvvet antrenmanlarında" />
      <StatCard label="En aktif gün" value={mostActiveWeekday([...workouts.map((item) => item.date), ...matches.map((item) => item.date)])} detail="seçili dönemde" />
    </div>
    <section className="extended-card"><div className="extended-card__heading"><div><p className="extended-kicker">SON KAYITLAR</p><h3>Yakın dönem</h3></div><span>{start} — {end}</span></div>
      {workouts.length || matches.length ? <ul className="recent-list">{[...workouts.map((item) => ({ date: item.date, title: readableWorkout(item), type: item.type, suffix: validNumber(item.durationMinutes) ? `${item.durationMinutes} dk` : 'Antrenman' })), ...matches.map((item) => ({ date: item.date, title: `${item.opponent || 'Rakip'} maçı`, type: 'match', suffix: `${validNumber(item.goals) ?? 0} gol · ${validNumber(item.assists) ?? 0} asist` }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((item, index) => <li key={`${item.date}-${index}`}><time>{formatDay(item.date)}</time><span className="recent-mark">{item.type === 'match' ? '⚽' : '●'}</span><strong>{item.title}</strong><small>{item.suffix}</small></li>)}</ul> : <EmptyState title="Henüz kayıt yok" detail="Antrenman veya maç eklediğinde özet burada oluşur." />}
    </section>
    <p className="extended-note">Plan karşılaştırması: {plan.planned ? `${plan.completed}/${plan.planned} planlı oturum` : 'bu dönem için eşleşen plan yok'}. Demo veya tahmini değer eklenmez.</p>
  </div>;
}

function mostActiveWeekday(dates: string[]) {
  if (!dates.length) return '—';
  const totals = Array(7).fill(0) as number[];
  dates.forEach((date) => { totals[dayOfWeek(date)] += 1; });
  const names = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  return names[totals.indexOf(Math.max(...totals))];
}

function MatchSection({ data, weeks, setWeeks }: { data: AnalyticsData; weeks: AnalyticsRange; setWeeks: (value: AnalyticsRange) => void }) {
  const start = dateRangeStart(weeks);
  const end = dateToday();
  const matches = data.matches.filter((match) => inRange(match.date, start, end)).sort((a, b) => b.date.localeCompare(a.date));
  let wins = 0; let draws = 0; let losses = 0;
  matches.forEach((match) => {
    const ours = validNumber(match.scoreOur); const theirs = validNumber(match.scoreOpponent);
    if (ours === undefined || theirs === undefined) return;
    if (ours > theirs) wins += 1; else if (ours === theirs) draws += 1; else losses += 1;
  });
  const goals = matches.reduce((sum, match) => sum + (validNumber(match.goals) ?? 0), 0);
  const assists = matches.reduce((sum, match) => sum + (validNumber(match.assists) ?? 0), 0);
  const rated = matches.filter((match) => validNumber(match.rating) !== undefined);
  const rating = rated.length ? rated.reduce((sum, match) => sum + (validNumber(match.rating) ?? 0), 0) / rated.length : null;
  return <div className="extended-view"><ViewHeading kicker="MAÇ RAPORU" title="Maç istatistikleri" description="Skor, dakika, gol, asist, kart ve maç puanı alanları mevcut maç kayıtlarından okunur." weeks={weeks} setWeeks={setWeeks} />
    <div className="extended-grid extended-grid--stats"><StatCard label="Maç" value={matches.length} detail={`${wins}G · ${draws}B · ${losses}M`} /><StatCard label="Gol + asist" value={`${goals} + ${assists}`} detail="oyuncu kaydı" accent /><StatCard label="Sahada" value={`${formatNumber(matches.reduce((sum, match) => sum + (validNumber(match.minutesPlayed) ?? 0), 0))} dk`} detail="oynanmış dakika" /><StatCard label="Ortalama puan" value={rating === null ? '—' : formatNumber(rating, 1)} detail={rated.length ? `${rated.length} puanlanmış maç` : 'puan girilmemiş'} /></div>
    {matches.length ? <div className="match-list">{matches.map((match) => <MatchCard key={match.id} match={match} />)}</div> : <EmptyState title="Bu dönemde maç kaydı yok" detail="Maçlar uygulamanın mevcut maç defterinden otomatik alınır; ayrıca kopya kayıt oluşturulmaz." />}
    <p className="extended-note">W/D/L yalnızca iki skor girilmiş maçlarda hesaplanır. Oyuncu golleri ve maç skoru birbirinden ayrı tutulur.</p>
  </div>;
}

function MatchCard({ match }: { match: LegacyMatch }) {
  const ours = validNumber(match.scoreOur); const theirs = validNumber(match.scoreOpponent);
  const result = ours === undefined || theirs === undefined ? 'Skor yok' : ours > theirs ? 'Galibiyet' : ours === theirs ? 'Beraberlik' : 'Mağlubiyet';
  const yellow = match.yellowCard === true;
  const red = match.redCard === true;
  const moment = typeof match.moment === 'string' ? match.moment : '';
  const learned = typeof match.learned === 'string' ? match.learned : '';
  const notes = typeof match.notes === 'string' ? match.notes : '';
  return <article className="match-card"><div className={`match-result ${result === 'Galibiyet' ? 'win' : result === 'Mağlubiyet' ? 'loss' : ''}`}><strong>{ours ?? '–'} : {theirs ?? '–'}</strong><small>{result}</small></div><div className="match-main"><span>{formatDay(match.date)} · {match.isHome ? 'İç saha' : 'Deplasman'}</span><h3>{match.opponent || 'Rakip belirtilmemiş'}</h3><p>{validNumber(match.minutesPlayed) ?? 0} dk · {validNumber(match.goals) ?? 0} gol · {validNumber(match.assists) ?? 0} asist{match.isMvp ? ' · ⭐ MVP' : ''}</p>{(yellow || red) && <div className="match-events">{yellow && <span>🟨 Sarı kart</span>}{red && <span>🟥 Kırmızı kart</span>}</div>}{moment && <p className="match-highlight"><strong>Maç anı:</strong> {moment}</p>}{learned && <p className="match-highlight"><strong>Not:</strong> {learned}</p>}{!moment && !learned && notes && <p className="match-highlight">{notes}</p>}</div>{validNumber(match.rating) !== undefined && <div className="match-rating"><strong>{formatNumber(match.rating!, 1)}</strong><small>/ 10</small></div>}</article>;
}

const LazyGpsLeafletMap = lazy(() => import('./GpsLeafletMap'));

function RouteMap({ activity, progress }: { activity: GpsActivity; progress: number }) {
  const gridId = `gps-grid-${useId().replace(/:/g, '')}`;
  const points = useMemo(() => validGpsRoute(activity.route), [activity.route]);
  const projection = useMemo(() => projectGpsRoute(points), [points]);
  const [mapEnabled, setMapEnabled] = useState(false);
  if (!projection) return <div className="route-map route-map--empty">Harita için geçerli rota verisi yok</div>;
  const segment = gpsRouteSegmentAtProgress(points, progress);
  const start = segment ? projection.points[segment.index] : projection.start;
  const finish = segment ? projection.points[segment.index + 1] : projection.finish;
  const marker = segment ? [start[0] + (finish[0] - start[0]) * segment.progress, start[1] + (finish[1] - start[1]) * segment.progress] : projection.start;
  const route = projection.points.map(([x, y]) => `${x},${y}`).join(' ');
  return <div className="route-map-shell">
    {mapEnabled ? <>
      <Suspense fallback={<div className="route-map route-map--loading" role="status">Harita bileşeni yükleniyor…</div>}>
        <LazyGpsLeafletMap points={points} progress={progress} activityName={activity.fileName || 'GPS aktivitesi'} />
      </Suspense>
      <button type="button" className="route-map-consent route-map-consent--close" onClick={() => setMapEnabled(false)}>Haritayı kapat</button>
      <p className="route-map-privacy">OpenStreetMap altlık sağlayıcısı, görünür alanın harita karoları için yaklaşık konum isteklerini alır. GPS dosyası ve rota çizgisi tarayıcıdan gönderilmez.</p>
    </> : <>
      <svg className="route-map" viewBox="0 0 120 100" role="img" aria-label={`${activity.distanceKm.toFixed(2)} kilometrelik yerel GPS rota önizlemesi`}>
        <defs><pattern id={gridId} width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth=".45" /></pattern></defs>
        <rect width="120" height="100" fill={`url(#${gridId})`} />
        <path d="M 4 22 C 25 14, 31 39, 52 31 S 80 16, 116 27 M 2 76 C 23 63, 43 83, 67 69 S 92 81, 119 59" fill="none" stroke="#294050" strokeWidth="1.3" strokeDasharray="2 3" />
        <polyline points={route} fill="none" stroke="#fb923c" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={projection.start[0]} cy={projection.start[1]} r="3.2" fill="#86efac" stroke="#0f172a" strokeWidth="1.2"><title>Başlangıç</title></circle>
        <circle cx={projection.finish[0]} cy={projection.finish[1]} r="3.2" fill="#fb7185" stroke="#0f172a" strokeWidth="1.2"><title>Bitiş</title></circle>
        <circle cx={marker[0]} cy={marker[1]} r="4.1" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.4"><title>Oynatım konumu</title></circle>
      </svg>
      <div className="route-map-optin">
        <span>Yerel rota önizlemesi</span>
        <button type="button" className="route-map-consent" onClick={() => setMapEnabled(true)} aria-label="İnteraktif OpenStreetMap haritasını yükle">Harita altlığını aç</button>
      </div>
      <p className="route-map-privacy">Harita altlığı isteğe bağlıdır; açınca OpenStreetMap, gösterilen bölgenin yaklaşık konumunu karo isteklerinden görebilir. GPS dosyan cihazında kalır.</p>
    </>}
  </div>;
}

type GpsChartMetric = 'pace' | 'speedKmh' | 'heartRate' | 'elevationM' | 'cadence' | 'accuracyM';

function GpsSection({ data, weeks, setWeeks, onImport, onDelete }: { data: AnalyticsData; weeks: AnalyticsRange; setWeeks: (value: AnalyticsRange) => void; onImport: (file?: File) => void; onDelete: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'distance' | 'pace'>('recent');
  const start = dateRangeStart(weeks); const end = dateToday();
  const activities = data.gpsActivities.filter((activity) => inRange(activity.date, start, end));
  const distance = activities.reduce((sum, activity) => sum + activity.distanceKm, 0);
  const moving = activities.reduce((sum, activity) => sum + activity.movingSeconds, 0);
  const pace = moving && distance ? moving / distance : 0;
  const ascentActivities = activities.filter((activity) => activity.elevationGainM !== undefined);
  const totalAscent = ascentActivities.reduce((sum, activity) => sum + (activity.elevationGainM ?? 0), 0);
  const hrActivities = activities.filter((activity) => activity.avgHeartRate !== undefined);
  const avgHr = hrActivities.length ? Math.round(hrActivities.reduce((sum, activity) => sum + (activity.avgHeartRate ?? 0), 0) / hrActivities.length) : undefined;
  const sorted = [...activities].sort((a, b) => sortBy === 'distance'
    ? b.distanceKm - a.distanceKm
    : sortBy === 'pace'
      ? (a.movingSeconds / a.distanceKm || Infinity) - (b.movingSeconds / b.distanceKm || Infinity)
      : b.date.localeCompare(a.date));
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => { onImport(event.target.files?.[0]); event.target.value = ''; };
  return <div className="extended-view"><ViewHeading kicker="GPS · AKTİVİTE" title="Koşu ve rota analizi" description="Mesafe, tempo, yükseklik, sensör eğilimleri ve tur karşılaştırması; mevcut kayıtların ayrıntılı görünümü." weeks={weeks} setWeeks={setWeeks} />
    <section className="gps-import-card"><div><span className="gps-import-card__icon">⌁</span><div><strong>Strava / cihaz GPS dosyası içe aktar</strong><p>GPX, TCX ve FIT dosyalarını cihazından ekle. Nabız, kadans, yükseklik ve rota noktalarının zamanı dosyada bulunduğu ölçüde analiz edilir.</p></div></div><button type="button" className="gps-import-button" onClick={() => input.current?.click()}>GPS dosyası seç</button><input ref={input} type="file" accept=".gpx,.tcx,.fit,application/gpx+xml,application/xml,text/xml,application/octet-stream" hidden onChange={handleFile} /></section>
    <div className="extended-grid extended-grid--stats gps-summary"><StatCard label="Toplam mesafe" value={`${formatNumber(distance, 2)} km`} detail={`${activities.length} aktivite · seçili dönemde`} accent /><StatCard label="Hareket süresi" value={formatDuration(moving)} detail="GPX/TCX yaklaşık; FIT cihaz özeti" /><StatCard label="Ortalama hareket temposu" value={`${formatPace(pace)} /km`} detail="mesafe ÷ toplam hareket süresi" /><StatCard label="Tırmanış" value={ascentActivities.length ? `${formatNumber(totalAscent)} m` : '—'} detail={ascentActivities.length ? `${ascentActivities.length} ölçümlü aktivitede` : 'yükseklik verisi yok'} /><StatCard label="Ortalama nabız" value={avgHr ? `${avgHr} bpm` : '—'} detail={`${hrActivities.length} nabız verili aktivite`} /></div>
    <GpsWeeklyDistance activities={activities} start={start} weeks={weeks} />
    {activities.length > 1 && <GpsActivityComparison activities={activities} />}
    {activities.length ? <><div className="gps-list-toolbar"><div><strong>{activities.length} aktivite</strong><span>{start} — {end}</span></div><label>Sırala<select aria-label="GPS aktivitelerini sırala" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="recent">En yeni</option><option value="distance">En uzun mesafe</option><option value="pace">En hızlı tempo</option></select></label></div><div className="gps-activity-list">{sorted.map((activity) => <GpsActivityCard key={activity.id} activity={activity} onDelete={onDelete} />)}</div></> : <EmptyState title="GPS aktivitesi bulunamadı" detail="Uygulamadaki GPS koşuları burada görünür. Yeni kayıt eklemek için GPX, TCX veya FIT dosyası aktarabilirsin." />}
    <section className="extended-card gps-howto"><div className="extended-card__heading"><div><p className="extended-kicker">DOSYA VE ÖLÇÜM NOTLARI</p><h3>GPS verileri nasıl yorumlanıyor?</h3></div><span>Gizlilik öncelikli</span></div><ol><li>GPX/TCX rota ve zaman noktalarından mesafe, hareket süresi, hız/tempo, 1 km turları ve varsa irtifa/nabız/kadans hesaplanır. FIT’te varsa cihazın oturum özeti kullanılır.</li><li>Detay grafikler yalnızca dosyada bulunan örnekleri gösterir; eksik sensör verisi tahmin edilmez. Rota, grafikte en fazla 600 örnek noktayla saklanır.</li><li>Ham GPS dosyası sunucuya gönderilmez. İçe aktarılan kayıt bu cihazdaki tarayıcı depolamasında kalır; karttan dışa aktarabilir veya silebilirsin.</li></ol><p className="extended-note">GPS örnekleme aralığı, duraklama algısı ve cihazın filtreleri ölçümleri etkiler. Hız bölgeleri kişisel eşik olmadan sınıflandırılmaz. Bu sürüm Strava OAuth/API otomatik senkronizasyonu yapmaz.</p></section>
  </div>;
}

function GpsActivityComparison({ activities }: { activities: GpsActivity[] }) {
  const [selectedIds, setSelectedIds] = useState<[string, string]>(['', '']);
  const firstId = activities.some((activity) => activity.id === selectedIds[0]) ? selectedIds[0] : activities[0]?.id ?? '';
  const secondId = activities.some((activity) => activity.id === selectedIds[1] && activity.id !== firstId)
    ? selectedIds[1]
    : activities.find((activity) => activity.id !== firstId)?.id ?? '';
  const first = activities.find((activity) => activity.id === firstId);
  const second = activities.find((activity) => activity.id === secondId);
  const setSelection = (which: 0 | 1, value: string) => setSelectedIds((current) => {
    const next: [string, string] = [...current];
    next[which] = value;
    if (next[0] === next[1]) next[1 - which as 0 | 1] = activities.find((activity) => activity.id !== value)?.id ?? '';
    return next;
  });
  const projectedRoutes = first && second ? projectGpsRoutes([first.route, second.route]) : null;
  const routes = projectedRoutes?.length === 2 ? projectedRoutes : null;
  const metricRows = first && second ? [
    { label: 'Mesafe', a: first.distanceKm, b: second.distanceKm, unit: ' km', digits: 2 },
    { label: 'Hareket süresi', a: first.movingSeconds, b: second.movingSeconds, unit: '', duration: true },
    { label: 'Ortalama tempo', a: first.distanceKm ? first.movingSeconds / first.distanceKm : undefined, b: second.distanceKm ? second.movingSeconds / second.distanceKm : undefined, unit: ' dk/km', pace: true },
    { label: 'Tırmanış', a: first.elevationGainM, b: second.elevationGainM, unit: ' m', digits: 0 },
    { label: 'Ortalama nabız', a: first.avgHeartRate, b: second.avgHeartRate, unit: ' bpm', digits: 0 },
    { label: 'Ortalama hız', a: first.avgSpeedKmh, b: second.avgSpeedKmh, unit: ' km/sa', digits: 1 },
  ] : [];
  const value = (item: typeof metricRows[number], number?: number) => number === undefined ? '—' : item.duration ? formatDuration(number) : item.pace ? `${formatPace(number)}${item.unit}` : `${formatNumber(number, item.digits ?? 1)}${item.unit}`;
  return <section className="extended-card gps-compare"><div className="extended-card__heading"><div><p className="extended-kicker">GPS · KARŞILAŞTIRMA</p><h3>İki aktiviteyi karşılaştır</h3></div><span>Yalnızca bu cihazda</span></div>
    <div className="gps-compare__selectors"><label>Aktivite A<select aria-label="Karşılaştırma aktivitesi A" value={firstId} onChange={(event) => setSelection(0, event.target.value)}>{activities.map((activity) => <option key={activity.id} value={activity.id}>{formatDay(activity.date)} · {activity.fileName || 'GPS aktivitesi'}</option>)}</select></label><label>Aktivite B<select aria-label="Karşılaştırma aktivitesi B" value={secondId} onChange={(event) => setSelection(1, event.target.value)}>{activities.filter((activity) => activity.id !== firstId).map((activity) => <option key={activity.id} value={activity.id}>{formatDay(activity.date)} · {activity.fileName || 'GPS aktivitesi'}</option>)}</select></label></div>
    {first && second && <div className="gps-compare__content">{routes ? <svg className="gps-compare__map" viewBox="0 0 120 100" role="img" aria-label="İki GPS aktivitesinin yerel rota üst üste görünümü"><path d={routes[0].points.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ')} fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><path d={routes[1].points.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ')} fill="none" stroke="#fb923c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx={routes[0].start[0]} cy={routes[0].start[1]} r="2.6" fill="#7dd3fc"/><circle cx={routes[1].start[0]} cy={routes[1].start[1]} r="2.6" fill="#fdba74"/></svg> : <div className="gps-compare__map gps-compare__map--empty">Her iki aktivitede de üst üste çizilecek yeterli rota noktası yok.</div>}<div className="gps-compare__legend"><span><i className="gps-compare__swatch gps-compare__swatch--a" />A · {first.fileName || formatDay(first.date)}</span><span><i className="gps-compare__swatch gps-compare__swatch--b" />B · {second.fileName || formatDay(second.date)}</span></div><div className="gps-compare__table-wrap"><table className="gps-compare__table"><thead><tr><th>Ölçüm</th><th>A</th><th>B</th><th>Fark (B−A)</th></tr></thead><tbody>{metricRows.map((item) => { const difference = item.a !== undefined && item.b !== undefined ? item.b - item.a : undefined; return <tr key={item.label}><th>{item.label}</th><td>{value(item, item.a)}</td><td>{value(item, item.b)}</td><td>{difference === undefined ? '—' : item.duration ? `${difference >= 0 ? '+' : '−'}${formatDuration(Math.abs(difference))}` : item.pace ? `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${formatPace(Math.abs(difference))}` : `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${formatNumber(Math.abs(difference), item.digits ?? 1)}${item.unit}`}</td></tr>; })}</tbody></table></div></div>}
    <p className="extended-note">Rota çizgileri aynı yerel ölçekte üst üste gösterilir; GPS koordinatları dış servise gönderilmez. Harita altlığı kullanılmadığı için bu karşılaştırma için ağ isteği yapılmaz. GPS sapması, hava ve parkur farkları karşılaştırmayı etkileyebilir.</p>
  </section>;
}

function GpsWeeklyDistance({ activities, start, weeks }: { activities: GpsActivity[]; start: string; weeks: number }) {
  const buckets = Array.from({ length: weeks }, (_, index) => {
    const weekStart = addLocalDays(start, index * 7);
    const weekEnd = addLocalDays(weekStart, 6);
    const rows = activities.filter((item) => inRange(item.date, weekStart, weekEnd));
    return { weekStart, km: rows.reduce((sum, row) => sum + row.distanceKm, 0), count: rows.length };
  });
  const maxKm = Math.max(1, ...buckets.map((item) => item.km));
  return <section className="extended-card gps-weekly"><div className="extended-card__heading"><div><p className="extended-kicker">GPS YÜK TRENDİ</p><h3>Haftalık mesafe</h3></div><span>{weeks} haftalık görünüm</span></div><div className="gps-weekly-chart" role="img" aria-label={`${weeks} haftalık GPS mesafe grafiği`}>{buckets.map((item) => <div key={item.weekStart} title={`${item.weekStart}: ${formatNumber(item.km, 2)} km · ${item.count} aktivite`}><strong>{item.km ? formatNumber(item.km, 1) : '—'}</strong><i style={{ height: `${item.km ? Math.max(6, item.km / maxKm * 100) : 2}%` }} /><small>{formatDay(item.weekStart)}</small></div>)}</div><p className="extended-note">Yalnızca seçili dönemdeki GPS kayıtlarının toplamı; GPS olmayan antrenmanlar dahil değildir.</p></section>;
}

function getGpsSeries(activity: GpsActivity, metric: GpsChartMetric) {
  const route = activity.route;
  if (metric === 'pace') {
    return route.slice(1).flatMap((point, index) => {
      const previous = route[index];
      const fromKm = previous.distanceKm;
      const toKm = point.distanceKm;
      const fromTime = previous.time ? Date.parse(previous.time) : NaN;
      const toTime = point.time ? Date.parse(point.time) : NaN;
      if (!Number.isFinite(fromKm) || !Number.isFinite(toKm) || !Number.isFinite(fromTime) || !Number.isFinite(toTime)) return [];
      const deltaKm = toKm! - fromKm!;
      const deltaSeconds = (toTime - fromTime) / 1000;
      if (deltaKm <= 0 || deltaSeconds <= 0 || deltaSeconds > 300) return [];
      const secondsPerKm = deltaSeconds / deltaKm;
      return secondsPerKm >= 120 && secondsPerKm <= 1800 ? [{ x: toKm!, y: secondsPerKm }] : [];
    });
  }
  return route.flatMap((point, index) => {
    const value = point[metric];
    const x = point.distanceKm ?? index;
    return typeof value === 'number' && Number.isFinite(value) ? [{ x, y: value }] : [];
  });
}

function GpsTelemetryChart({ activity, progress }: { activity: GpsActivity; progress: number }) {
  const available: Array<{ key: GpsChartMetric; label: string; unit: string }> = [
    ...(activity.route.some((point) => point.time && point.distanceKm !== undefined) ? [{ key: 'pace' as const, label: 'Tempo', unit: 'dk/km' }] : []),
    ...(activity.route.some((point) => point.speedKmh !== undefined) ? [{ key: 'speedKmh' as const, label: 'Hız', unit: 'km/sa' }] : []),
    ...(activity.route.some((point) => point.heartRate !== undefined) ? [{ key: 'heartRate' as const, label: 'Nabız', unit: 'bpm' }] : []),
    ...(activity.route.some((point) => point.elevationM !== undefined) ? [{ key: 'elevationM' as const, label: 'Yükseklik', unit: 'm' }] : []),
    ...(activity.route.some((point) => point.cadence !== undefined) ? [{ key: 'cadence' as const, label: 'Kadans', unit: 'adım/dk' }] : []),
    ...(activity.route.some((point) => point.accuracyM !== undefined) ? [{ key: 'accuracyM' as const, label: 'GPS doğruluk tahmini', unit: 'm' }] : []),
  ];
  const [selected, setSelected] = useState<GpsChartMetric | null>(available[0]?.key ?? null);
  const metric = available.find((item) => item.key === selected) ?? available[0];
  if (!metric) return <p className="gps-no-series">Bu dosyada rota boyunca çizilebilecek zamanlı nabız, kadans, yükseklik veya tempo örneği yok. Oturum özeti varsa yukarıda gösterilir.</p>;
  const rows = getGpsSeries(activity, metric.key);
  if (rows.length < 2) return <p className="gps-no-series">{metric.label} grafiği için yeterli örnek bulunamadı.</p>;
  const values = rows.map((row) => row.y);
  const min = Math.min(...values); const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max) * 0.04, 1);
  const xMin = Math.min(...rows.map((row) => row.x)); const xMax = Math.max(...rows.map((row) => row.x));
  const xRange = Math.max(xMax - xMin, 1e-9);
  const plotX = (value: number) => 36 + ((value - xMin) / xRange) * 548;
  const plotY = (value: number) => 136 - ((value - (min - range * .08)) / (range * 1.16)) * 112;
  const points = rows.map((row) => `${plotX(row.x)},${plotY(row.y)}`).join(' ');
  const display = (value: number) => metric.key === 'pace' ? formatPace(value) : formatNumber(value, metric.key === 'elevationM' ? 0 : 1);
  const routeHasDistance = activity.route.every((point) => typeof point.distanceKm === 'number');
  const playbackX = routeHasDistance ? gpsDistanceAtProgress(activity.route, progress, activity.distanceKm) : xMin + xRange * progress;
  const cursorX = plotX(Math.max(xMin, Math.min(xMax, playbackX)));
  const currentValue = rows.reduce((closest, row) => Math.abs(row.x - playbackX) < Math.abs(closest.x - playbackX) ? row : closest, rows[0]);
  return <div className="gps-telemetry"><div className="gps-chart-tabs" role="tablist" aria-label="GPS grafik ölçümü">{available.map((item) => <button type="button" key={item.key} role="tab" aria-selected={metric.key === item.key} onClick={() => setSelected(item.key)}>{item.label}</button>)}</div><div className="gps-chart-meta"><span>{metric.label} · {metric.unit}</span><strong>{display(min)} — {display(max)}</strong><span className="gps-chart-current">Oynatımda: {display(currentValue.y)}</span></div><svg viewBox="0 0 600 165" role="img" aria-label={`${metric.label} grafiği; oynatım imleci rota konumuyla eşleşir`}>{[30, 82, 134].map((y) => <line key={y} x1="36" x2="584" y1={y} y2={y} className="gps-chart-grid" />)}<polyline points={points} className="gps-chart-line" /><line x1={cursorX} x2={cursorX} y1="22" y2="140" className="gps-chart-cursor" /><circle cx={cursorX} cy={plotY(currentValue.y)} r="4.2" className="gps-chart-cursor-point"><title>Oynatım konumu · {display(currentValue.y)} {metric.unit}</title></circle><text x="36" y="157">0 km</text><text x="584" y="157" textAnchor="end">{formatNumber(activity.distanceKm, 2)} km</text></svg></div>;
}

function downloadGpsGpx(activity: GpsActivity) {
  if (activity.route.length < 2) return;
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]!));
  const points = activity.route.map((point) => `<trkpt lat="${point.lat}" lon="${point.lon}">${point.elevationM === undefined ? '' : `<ele>${point.elevationM}</ele>`}${point.time ? `<time>${escape(point.time)}</time>` : ''}${point.heartRate === undefined ? '' : `<extensions><gpxtpx:TrackPointExtension xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><gpxtpx:hr>${point.heartRate}</gpxtpx:hr>${point.cadence === undefined ? '' : `<gpxtpx:cad>${point.cadence}</gpxtpx:cad>`}</gpxtpx:TrackPointExtension></extensions>`}</trkpt>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="HBK Spor" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${escape(activity.fileName || 'GPS aktivitesi')}</name><trkseg>${points}</trkseg></trk></gpx>`;
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${(activity.fileName || 'gps-aktivitesi').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-')}.gpx`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function GpsActivityCard({ activity, onDelete }: { activity: GpsActivity; onDelete: (id: string) => void }) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playbackProgress = useRef(0);
  const setPlaybackProgress = (value: number) => { const bounded = Math.max(0, Math.min(1, value)); playbackProgress.current = bounded; setProgress(bounded); };
  useEffect(() => {
    if (!playing) return;
    const from = playbackProgress.current >= 1 ? 0 : playbackProgress.current;
    if (playbackProgress.current >= 1) setPlaybackProgress(0);
    const start = performance.now();
    const durationMs = Math.max(1200, 10_000 * (1 - from));
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(1, from + (now - start) / durationMs * (1 - from));
      setPlaybackProgress(next);
      if (next >= 1) setPlaying(false);
      else frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);
  const pace = activity.movingSeconds && activity.distanceKm ? activity.movingSeconds / activity.distanceKm : 0;
  const stoppedSeconds = Math.max(0, activity.pausedSeconds ?? activity.elapsedSeconds - activity.movingSeconds);
  const qualityLabel = activity.quality?.grade === 'good' ? 'İyi' : activity.quality?.grade === 'fair' ? 'Orta' : activity.quality?.grade === 'poor' ? 'Zayıf' : undefined;
  const activeDistance = gpsDistanceAtProgress(activity.route, progress, activity.distanceKm);
  const segment = gpsRouteSegmentAtProgress(activity.route, progress);
  return <article className="gps-activity-card"><RouteMap activity={activity} progress={progress} />{activity.route.length > 1 && <div className="gps-route-playback"><div className="gps-route-playback__top"><strong>Rota oynatımı</strong><span>{formatNumber(activeDistance, 2)} / {formatNumber(activity.distanceKm, 2)} km · {formatDuration(activity.elapsedSeconds * progress)} / {formatDuration(activity.elapsedSeconds)}</span></div><input type="range" min="0" max="1" step="0.001" value={progress} aria-label={`Rota oynatımı: ${activity.fileName || 'GPS aktivitesi'}`} onChange={(event) => { setPlaying(false); setPlaybackProgress(Number(event.target.value)); }} /><div className="gps-route-playback__bottom"><span>{segment ? `Örnek ${segment.index + 1} / ${activity.route.length} · ${segment.basis === 'time' ? 'zaman' : segment.basis === 'distance' ? 'mesafe' : 'rota noktası'}` : 'Yerel rota'}</span><button type="button" onClick={() => { if (playing) setPlaying(false); else { if (progress >= 1) setPlaybackProgress(0); setPlaying(true); } }} aria-label={playing ? 'Rota oynatımını duraklat' : 'Rota oynatımını başlat'}>{playing ? 'Duraklat' : progress >= 1 ? 'Baştan oynat' : '▶ Oynat'}</button></div><p>Hızlandırılmış önizleme; işaretçi kaydedilmiş zaman varsa zamana, yoksa mesafeye göre ilerler.</p></div>}<div className="gps-activity-card__content"><div className="gps-activity-card__top"><div><span>{formatDay(activity.date)} · {activity.source === 'app' ? 'Uygulama GPS’i' : `${activity.source.toUpperCase()} içe aktarıldı`}</span><h3>{activity.fileName || 'GPS aktivitesi'}</h3></div><div className="gps-card-actions">{activity.route.length > 1 && <button type="button" className="gps-export" onClick={() => downloadGpsGpx(activity)} aria-label="Rota GPX olarak indir">GPX indir</button>}{activity.source !== 'app' && <button type="button" className="delete-gps" onClick={() => onDelete(activity.id)} aria-label="İçe aktarılan GPS kaydını sil">Sil</button>}</div></div><div className="gps-metrics"><span><strong>{formatNumber(activity.distanceKm, 2)}</strong><small>km mesafe</small></span><span><strong>{formatDuration(activity.elapsedSeconds)}</strong><small>toplam süre</small></span><span><strong>{formatPace(pace)}</strong><small>dk/km hareket temposu</small></span>{activity.elevationGainM !== undefined && <span><strong>{activity.elevationGainM}</strong><small>m tırmanış</small></span>}{activity.avgHeartRate !== undefined && <span><strong>{activity.avgHeartRate}</strong><small>ort. nabız</small></span>}{activity.maxHeartRate !== undefined && <span><strong>{activity.maxHeartRate}</strong><small>maks. nabız</small></span>}{activity.avgCadence !== undefined && <span><strong>{activity.avgCadence}</strong><small>ort. kadans</small></span>}{activity.avgSpeedKmh !== undefined && <span><strong>{formatNumber(activity.avgSpeedKmh, 1)}</strong><small>ort. km/sa</small></span>}{activity.maxSpeedKmh !== undefined && <span><strong>{formatNumber(activity.maxSpeedKmh, 1)}</strong><small>maks. km/sa</small></span>}</div>
    <details className="gps-details"><summary>Detaylı analiz <span>{activity.route.length ? `${activity.route.length} rota noktası` : 'özet verisi'}</span></summary><div className="gps-detail-body"><div className="gps-detail-stats"><span><small>Hareket süresi</small><b>{formatDuration(activity.movingSeconds)}</b></span><span><small>Duraklama farkı</small><b>{formatDuration(stoppedSeconds)}</b></span><span><small>Tur sayısı</small><b>{activity.splits?.length ?? '—'}</b></span><span><small>Kayıt kaynağı</small><b>{activity.source.toUpperCase()}</b></span>{activity.maxSpeedKmh !== undefined && <span><small>Maks. hız</small><b>{formatNumber(activity.maxSpeedKmh, 1)} km/sa</b></span>}{activity.maxCadence !== undefined && <span><small>Maks. kadans</small><b>{activity.maxCadence}</b></span>}{qualityLabel && <span><small>GPS kalite özeti</small><b>{qualityLabel}{typeof activity.quality?.medianAccuracyM === 'number' ? ` · ±${formatNumber(activity.quality.medianAccuracyM, 1)} m` : ''}</b></span>}{activity.quality?.acceptedSegments !== undefined && <span><small>Geçerli rota parçası</small><b>{activity.quality.acceptedSegments}</b></span>}{activity.quality?.rejectedPoints !== undefined && <span><small>Reddedilen GPS noktası</small><b>{activity.quality.rejectedPoints}</b></span>}{activity.quality?.gapSeconds !== undefined && <span><small>Kayıt boşluğu</small><b>{formatDuration(activity.quality.gapSeconds + (activity.quality.backgroundGapSeconds ?? 0))}</b></span>}{activity.quality?.stationarySamples !== undefined && <span><small>Hareketsiz örnek</small><b>{activity.quality.stationarySamples}</b></span>}</div><GpsTelemetryChart activity={activity} progress={progress} />{activity.splits?.length ? <div className="gps-splits-table-wrap"><table className="gps-splits-table"><caption>Tur karşılaştırması · GPS’den yaklaşık hesap</caption><thead><tr><th>Tur</th><th>Mesafe</th><th>Hareket süresi</th><th>Tempo</th></tr></thead><tbody>{activity.splits.map((split) => <tr key={split.number}><td>{split.number}</td><td>{formatNumber(split.distanceKm, 2)} km</td><td>{formatDuration(split.movingSeconds)}</td><td>{formatPace(split.paceSecondsPerKm)} /km</td></tr>)}</tbody></table></div> : null}<p className="gps-detail-note">Rota aktarımı, saklanan en fazla 600 örnek noktasını içerir; ham dosya cihazda tutulmaz. GPX dışa aktarımı bu sadeleştirilmiş rotayı verir. Uygulama GPS kalite özeti, cihazın topladığı doğruluk ve kesinti sayaçlarından alınır; ölçüm garantisi değildir.</p></div></details></div></article>;
}

function LineTrend({ rows, metrics }: { rows: Array<Record<string, number | string>>; metrics: Array<{ key: string; label: string; color: string }> }) {
  if (!rows.length) return <EmptyState title="Toparlanma kaydı yok" detail="Uygulamadaki mevcut 1–5 wellness check-in’leri burada zaman çizgisine dönüşür." />;
  return <div className="trend-wrap"><div className="trend-legend">{metrics.map((metric) => <span key={metric.key}><i style={{ background: metric.color }} />{metric.label}</span>)}</div><svg className="trend-chart" viewBox="0 0 600 210" role="img" aria-label="Toparlanma ölçümlerinin 1 ile 5 arasındaki zaman grafiği"><line x1="40" y1="22" x2="590" y2="22" /><line x1="40" y1="63" x2="590" y2="63" /><line x1="40" y1="105" x2="590" y2="105" /><line x1="40" y1="147" x2="590" y2="147" /><line x1="40" y1="188" x2="590" y2="188" /><text x="7" y="27">5</text><text x="7" y="68">4</text><text x="7" y="110">3</text><text x="7" y="152">2</text><text x="7" y="193">1</text>{metrics.map((metric) => { const coords = rows.map((row, index) => `${rows.length === 1 ? 315 : 40 + index * 550 / (rows.length - 1)},${188 - ((Number(row[metric.key]) - 1) / 4) * 166}`).join(' '); return <g key={metric.key}><polyline points={coords} fill="none" stroke={metric.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{rows.map((row, index) => <circle key={`${metric.key}-${index}`} cx={rows.length === 1 ? 315 : 40 + index * 550 / (rows.length - 1)} cy={188 - ((Number(row[metric.key]) - 1) / 4) * 166} r="3.5" fill={metric.color}><title>{String(row.date)} · {metric.label}: {row[metric.key]}/5</title></circle>)}</g>; })}</svg><div className="trend-dates">{rows.length > 1 && <><span>{formatDay(String(rows[0].date))}</span><span>{formatDay(String(rows[rows.length - 1]?.date))}</span></>}</div></div>;
}

function RecoverySection({ data, weeks, setWeeks }: { data: AnalyticsData; weeks: AnalyticsRange; setWeeks: (value: AnalyticsRange) => void }) {
  const start = dateRangeStart(weeks); const end = dateToday();
  const wellness = data.wellness.filter((item) => inRange(item.date, start, end)).slice(-12);
  const latest = wellness[wellness.length - 1];
  const trendRows = wellness.map((item) => ({ date: item.date, sleep: item.sleep, energy: item.energy, soreness: item.soreness, stress: item.stress }));
  const metrics = [{ key: 'sleep', label: 'Uyku', color: '#60a5fa' }, { key: 'energy', label: 'Enerji', color: '#34d399' }, { key: 'soreness', label: 'Ağrı', color: '#fb923c' }, { key: 'stress', label: 'Stres', color: '#f472b6' }];
  return <div className="extended-view"><ViewHeading kicker="TOPARLANMA · CHECK-IN" title="Öz bildirimli toparlanma" description="Uygulamadaki uyku, enerji, ağrı ve stres puanları (1–5). Bu kayıtlar tanı veya ölçülmüş fizyoloji değildir." weeks={weeks} setWeeks={setWeeks} />
    <div className="extended-grid extended-grid--stats"><StatCard label="Check-in" value={wellness.length} detail="seçili dönemde" /><StatCard label="Uyku" value={latest ? `${latest.sleep}/5` : '—'} detail="son kayıt" /><StatCard label="Enerji" value={latest ? `${latest.energy}/5` : '—'} detail="son kayıt" accent /><StatCard label="Ağrı · stres" value={latest ? `${latest.soreness}/5 · ${latest.stress}/5` : '—'} detail="son kayıt" /></div>
    <section className="extended-card"><div className="extended-card__heading"><div><p className="extended-kicker">1–5 ÖZ BİLDİRİM</p><h3>Toparlanma eğilimi</h3></div><span>Son {wellness.length} kayıt</span></div><LineTrend rows={trendRows} metrics={metrics} /></section>
    {latest && <section className="extended-card"><div className="extended-card__heading"><div><p className="extended-kicker">EN SON CHECK-IN</p><h3>{formatDay(latest.date)}</h3></div></div><p className="recovery-latest">Uyku <strong>{latest.sleep}/5</strong><i /> Enerji <strong>{latest.energy}/5</strong><i /> Ağrı <strong>{latest.soreness}/5</strong><i /> Stres <strong>{latest.stress}/5</strong></p></section>}
  </div>;
}

function TestsSection({ data, weeks, setWeeks }: { data: AnalyticsData; weeks: AnalyticsRange; setWeeks: (value: AnalyticsRange) => void }) {
  const start = dateRangeStart(weeks); const end = dateToday();
  const tests = data.skillTests.map((test) => ({ ...test, history: test.history.filter((row) => inRange(row.date, start, end)).sort((a, b) => a.date.localeCompare(b.date)) })).filter((test) => test.history.length).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  return <div className="extended-view"><ViewHeading kicker="PERFORMANS TESTLERİ" title="Test eğilimleri" description="Mevcut beceri ve fiziksel test sonuçları. Süre testlerinde düşük değer, diğerlerinde yüksek değer rekor kabul edilir." weeks={weeks} setWeeks={setWeeks} />
    {tests.length ? <div className="test-list">{tests.map((test) => { const lowerBetter = /sn|saniye|sprint|süre|time/i.test(`${test.unit} ${test.name}`); const best = test.history.reduce((chosen, row) => lowerBetter ? row.value < chosen.value ? row : chosen : row.value > chosen.value ? row : chosen); const latest = test.history[test.history.length - 1]; return <article className="test-card" key={test.id}><div className="test-card__title"><span>{test.category || 'Test'}</span><h3>{test.name}</h3></div><div className="test-values"><span><small>Sonuç</small><strong>{formatNumber(latest.value, 2)} <i>{test.unit}</i></strong><time>{formatDay(latest.date)}</time></span><span><small>{lowerBetter ? 'En iyi' : 'Rekor'}</small><strong>{formatNumber(best.value, 2)} <i>{test.unit}</i></strong></span></div><div className="test-sparkline" aria-label={`${test.name} test eğilimi`}>{test.history.map((row, index) => <span key={`${row.date}-${index}`} title={`${formatDay(row.date)}: ${row.value} ${test.unit}`} style={{ height: `${Math.max(12, row.value / Math.max(best.value, 1) * 100)}%` }} />)}</div></article>; })}</div> : <EmptyState title="Bu dönemde performans testi yok" detail="Beceri testleri uygulamanın hbk_skill_tests_v1 kayıtlarından okunur." />}
  </div>;
}

function RecordsSection({ data }: { data: AnalyticsData }) {
  const sets = data.workouts.flatMap((workout) => (workout.gymExercises ?? []).flatMap((exercise) => exercise.sets.map((set) => ({ name: exercise.exerciseName, weight: validNumber(set.weight) ?? 0, reps: validNumber(set.reps) ?? 0, date: workout.date }))));
  const bestLift = sets.filter((item) => item.weight > 0).reduce<(typeof sets)[number] | null>((best, item) => !best || item.weight > best.weight ? item : best, null);
  const mostReps = sets.reduce<(typeof sets)[number] | null>((best, item) => !best || item.reps > best.reps ? item : best, null);
  const heaviestSession = data.workouts.map((workout) => ({ workout, volume: (workout.gymExercises ?? []).reduce((sum, exercise) => sum + exercise.sets.reduce((setSum, set) => setSum + (validNumber(set.weight) ?? 0) * (validNumber(set.reps) ?? 0), 0), 0) })).reduce<{ workout: LegacyWorkout; volume: number } | null>((best, item) => item.volume > 0 && (!best || item.volume > best.volume) ? item : best, null);
  const longestGps = data.gpsActivities.reduce<GpsActivity | null>((best, item) => !best || item.distanceKm > best.distanceKm ? item : best, null);
  const mostGoals = data.matches.reduce<LegacyMatch | null>((best, item) => !best || (validNumber(item.goals) ?? 0) > (validNumber(best.goals) ?? 0) ? item : best, null);
  const tests = data.skillTests.flatMap((test) => test.history.length ? [{ test, best: test.history.reduce((a, b) => /sn|saniye|sprint|süre/i.test(`${test.unit} ${test.name}`) ? (a.value <= b.value ? a : b) : (a.value >= b.value ? a : b)) }] : []);
  return <div className="extended-view"><ViewHeading kicker="KİŞİSEL REKORLAR" title="Kendi en iyilerin" description="Kayıtlı set, maç, GPS ve test geçmişinden hesaplanır. Rekorlar dönem filtresinden bağımsız, tüm geçmişi kapsar." />
    <div className="record-grid">
      <RecordCard label="En ağır set" value={bestLift ? `${formatNumber(bestLift.weight, 1)} kg` : '—'} detail={bestLift ? `${bestLift.name} · ${bestLift.reps} tekrar · ${formatDay(bestLift.date)}` : 'Kayıtlı ağırlık seti yok'} icon="🏋️" />
      <RecordCard label="En çok tekrar" value={mostReps ? `${mostReps.reps} tekrar` : '—'} detail={mostReps ? `${mostReps.name} · ${formatNumber(mostReps.weight, 1)} kg · ${formatDay(mostReps.date)}` : 'Set verisi yok'} icon="↗" />
      <RecordCard label="En yüksek seans hacmi" value={heaviestSession ? `${formatNumber(heaviestSession.volume)} kg·tekrar` : '—'} detail={heaviestSession ? `${readableWorkout(heaviestSession.workout)} · ${formatDay(heaviestSession.workout.date)}` : 'Kuvvet kaydı yok'} icon="▦" />
      <RecordCard label="En uzun GPS aktivitesi" value={longestGps ? `${formatNumber(longestGps.distanceKm, 2)} km` : '—'} detail={longestGps ? `${formatDay(longestGps.date)} · ${longestGps.source === 'app' ? 'Uygulama GPS’i' : longestGps.source.toUpperCase()}` : 'GPS kaydı yok'} icon="⌁" />
      <RecordCard label="Bir maçta en çok gol" value={mostGoals ? `${validNumber(mostGoals.goals) ?? 0} gol` : '—'} detail={mostGoals ? `${mostGoals.opponent || 'Rakip'} · ${formatDay(mostGoals.date)}` : 'Maç kaydı yok'} icon="⚽" />
      {tests.map(({ test, best }) => <RecordCard key={test.id} label={`${test.name} · ${/sn|saniye|sprint|süre/i.test(`${test.unit} ${test.name}`) ? 'en iyi' : 'rekor'}`} value={`${formatNumber(best.value, 2)} ${test.unit}`} detail={`${test.category || 'Test'} · ${formatDay(best.date)}`} icon="✦" />)}
    </div>
    <div className="extended-card"><div className="extended-card__heading"><div><p className="extended-kicker">KAYNAK ŞEFFAFLIĞI</p><h3>Nasıl hesaplanıyor?</h3></div></div><p>Rekorlar yalnızca kayıtlı değerlerden çıkarılır. Tahmini 1RM, kas gelişimi veya kondisyon skoru üretilmez; yeni rekor tanımı ölçülen veri geldikçe güncellenebilir.</p></div>
  </div>;
}

function RecordCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: string }) {
  return <article className="record-card"><span className="record-icon" aria-hidden="true">{icon}</span><span className="record-label">{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function ViewHeading({ kicker, title, description, weeks, setWeeks }: { kicker: string; title: string; description: string; weeks?: AnalyticsRange; setWeeks?: (value: AnalyticsRange) => void }) {
  return <div className="extended-view__heading"><div><p className="extended-kicker">{kicker}</p><h2>{title}</h2><p>{description}</p></div>{weeks && setWeeks && <FilterBar weeks={weeks} setWeeks={setWeeks} />}</div>;
}

export default function ExtendedAnalyticsView({ data, section, weeks, setWeeks, onGpsImport, onDeleteGps }: Props) {
  const rangeProps = { weeks, setWeeks };
  const deleteGps = (id: string) => { if (window.confirm('Bu GPX rotasını bu cihazdan silmek istiyor musun?')) onDeleteGps(id); };
  const sectionView = (() => {
    switch (section) {
      case 'overview': return <Overview data={data} weeks={weeks} setWeeks={setWeeks} />;
      case 'matches': return <MatchSection data={data} weeks={weeks} setWeeks={setWeeks} />;
      case 'gps': return <GpsSection data={data} weeks={weeks} setWeeks={setWeeks} onImport={onGpsImport} onDelete={deleteGps} />;
      case 'recovery': return <RecoverySection data={data} weeks={weeks} setWeeks={setWeeks} />;
      case 'tests': return <TestsSection data={data} weeks={weeks} setWeeks={setWeeks} />;
      case 'records': return <RecordsSection data={data} />;
      default: return <Overview data={data} weeks={weeks} setWeeks={setWeeks} />;
    }
  })();
  // The active section owns its own heading/filter; shared state keeps ranges in sync across tabs.
  return <div className="extended-analytics" data-range={rangeProps.weeks}>{sectionView}</div>;
}
