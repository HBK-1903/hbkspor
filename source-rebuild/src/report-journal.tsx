import { useMemo, useState } from 'react';
import type { AppData, TrainingSession } from './types';
import { MatchMediaGallery } from './MatchMedia';
import { VoiceNotePlayback } from './VoiceNotePlayback';
import { localDateKey, shiftLocalDate } from './training';

const shortDate = (key: string) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${key}T12:00:00`));
const number = (value: number, digits = 0) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits }).format(value);
const ICONS: Record<TrainingSession['kind'], string> = { gym: '🏋️', pitch: '⚽', match: '🏟️', gps: '🏃', timer: '⏱️', recovery: '🧘', rest: '🌙' };

export function CoachReport({ data }: { data: AppData }) {
  const [weeks, setWeeks] = useState(4);
  const [includeSessions, setIncludeSessions] = useState(true);
  const [includeGps, setIncludeGps] = useState(true);
  const [includeTests, setIncludeTests] = useState(true);
  const [includeMatches, setIncludeMatches] = useState(true);
  const today = localDateKey();
  const start = shiftLocalDate(today, -(weeks * 7 - 1));
  const sessions = data.demoMode ? [] : data.sessions.filter((item) => item.kind !== 'rest' && item.date >= start && item.date <= today);
  const gps = data.demoMode ? [] : (data.gpsActivities ?? []).filter((item) => item.date >= start && item.date <= today);
  const tests = data.demoMode ? [] : (data.skillTests ?? []).filter((item) => item.date >= start && item.date <= today);
  const matches = sessions.filter((item) => item.kind === 'match');
  const print = () => {
    document.body.classList.add('hbk-report-print');
    const restore = () => document.body.classList.remove('hbk-report-print');
    window.addEventListener('afterprint', restore, { once: true });
    window.setTimeout(() => window.print(), 40);
    window.setTimeout(restore, 60_000);
  };
  return <div className="report-workspace">
    <section className="visual-intro report-intro"><span className="visual-intro__icon">📄</span><div><p className="eyebrow">KOÇLA PAYLAŞILABİLİR ÖZET</p><h2>Raporunu seç ve hazırla</h2><p>Yalnızca seçtiğin kayıt alanları çıktıda görünür. Tarayıcı yazdırma penceresinden PDF kaydedebilirsin.</p></div></section>
    <section className="card report-controls"><label className="field-label">Dönem<select value={weeks} onChange={(event) => setWeeks(Number(event.target.value))}><option value={1}>Son 7 gün</option><option value={4}>Son 4 hafta</option><option value={8}>Son 8 hafta</option><option value={12}>Son 12 hafta</option></select></label><div className="report-checks"><label><input type="checkbox" checked={includeSessions} onChange={(event) => setIncludeSessions(event.target.checked)} />Antrenmanlar</label><label><input type="checkbox" checked={includeGps} onChange={(event) => setIncludeGps(event.target.checked)} />GPS özetleri</label><label><input type="checkbox" checked={includeTests} onChange={(event) => setIncludeTests(event.target.checked)} />Test kayıtları</label><label><input type="checkbox" checked={includeMatches} onChange={(event) => setIncludeMatches(event.target.checked)} />Maç olayları</label></div><button className="primary-button full-button" type="button" onClick={print} disabled={data.demoMode}>PDF olarak yazdır / kaydet</button>{data.demoMode && <p className="field-help">Demo profili için kişisel rapor oluşturulmaz.</p>}</section>
    <article className="coach-report"><header className="coach-report__header"><p>HBK SPOR · OYUNCU RAPORU</p><h2>{data.profile?.name ?? 'Oyuncu'}</h2><span>{data.profile?.position ?? 'Futbolcu'} · {shortDate(start)} – {shortDate(today)}</span></header>
      <div className="coach-report__grid">{includeSessions && <ReportMetric icon="⚽" label="Aktif seans" value={String(sessions.length)} detail={`${sessions.reduce((sum, item) => sum + item.minutes, 0)} dk kaydedilmiş süre`} />}{includeGps && <ReportMetric icon="⌁" label="GPS kayıtları" value={`${number(gps.reduce((sum, item) => sum + item.distanceKm, 0), 2)} km`} detail={`${gps.length} içe aktarılmış rota · seanslardan ayrı`} />}{includeTests && <ReportMetric icon="📈" label="Test kayıtları" value={String(tests.length)} detail="Kullanıcının girdiği sonuçlar" />}{includeMatches && <ReportMetric icon="🏟️" label="Maç kayıtları" value={String(matches.length)} detail={`${matches.reduce((sum, item) => sum + (item.matchEvents?.length ?? 0), 0)} eklenmiş olay`} />}</div>
      {includeSessions && <section className="coach-report__section"><h3>Antrenman dökümü</h3><div className="report-type-list">{(['gym', 'pitch', 'match', 'gps', 'timer', 'recovery'] as TrainingSession['kind'][]).map((kind) => { const count = sessions.filter((item) => item.kind === kind).length; return <span key={kind}>{ICONS[kind]} {kind === 'gym' ? 'Gym' : kind === 'pitch' ? 'Saha' : kind === 'match' ? 'Maç' : kind === 'gps' ? 'GPS seansı' : kind === 'timer' ? 'Tempo' : 'Toparlanma'} <b>{count}</b></span>; })}</div></section>}
      {includeMatches && matches.length > 0 && <section className="coach-report__section"><h3>Maç notları</h3>{matches.slice(0, 6).map((match) => <div className="report-match-row" key={match.id}><span><b>{match.title}</b><small>{shortDate(match.date)}{match.score ? ` · ${match.score}` : ''}</small></span><small>{match.matchEvents?.length ?? 0} kayıtlı olay</small></div>)}</section>}
      {includeTests && tests.length > 0 && <section className="coach-report__section"><h3>Test geçmişi</h3>{tests.slice(0, 8).map((test) => <div className="report-match-row" key={test.id}><span><b>{test.name}</b><small>{shortDate(test.date)} · {test.category}</small></span><strong>{number(test.value, 2)} {test.unit}</strong></div>)}</section>}
      <footer>Özet yalnızca seçili dönemdeki kullanıcı kayıtlarını listeler. Bu çıktı tanı, sakatlık riski veya birleşik performans puanı üretmez.</footer>
    </article>
  </div>;
}

function ReportMetric({ icon, label, value, detail }: { icon: string; label: string; value: string; detail: string }) {
  return <article className="report-metric"><span>{icon}</span><small>{label}</small><b>{value}</b><p>{detail}</p></article>;
}

type TimelineEntry =
  | { id: string; date: string; type: 'session'; session: TrainingSession }
  | { id: string; date: string; type: 'gps'; title: string; distanceKm: number; durationSeconds: number }
  | { id: string; date: string; type: 'test'; title: string; value: number; unit: string; category: string };

export function SeasonJournal({ data }: { data: AppData }) {
  const years = useMemo(() => {
    const dates = [...data.sessions.map((item) => item.date), ...(data.gpsActivities ?? []).map((item) => item.date), ...(data.skillTests ?? []).map((item) => item.date)];
    return [...new Set([String(new Date().getFullYear()), ...dates.map((date) => date.slice(0, 4))])].sort((a, b) => b.localeCompare(a));
  }, [data.sessions, data.gpsActivities, data.skillTests]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const entries: TimelineEntry[] = [
    ...(!data.demoMode ? data.sessions : []).filter((item) => item.date.startsWith(year)).map((session) => ({ id: session.id, date: session.date, type: 'session' as const, session })),
    ...(!data.demoMode ? data.gpsActivities ?? [] : []).filter((item) => item.date.startsWith(year)).map((item) => ({ id: item.id, date: item.date, type: 'gps' as const, title: item.fileName, distanceKm: item.distanceKm, durationSeconds: item.durationSeconds })),
    ...(!data.demoMode ? data.skillTests ?? [] : []).filter((item) => item.date.startsWith(year)).map((item) => ({ id: item.id, date: item.date, type: 'test' as const, title: item.name, value: item.value, unit: item.unit, category: item.category })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return <div className="visual-workspace">
    {data.demoMode && <p className="demo-data-note" role="note">Demo kayıtları kişisel sezon günlüğüne eklenmez.</p>}
    <section className="visual-intro"><span className="visual-intro__icon">📚</span><div><p className="eyebrow">SEZON ARŞİVİ</p><h2>Sahanın dışında da hikâyen</h2><p>Antrenman, maç, test ve içe aktardığın rotalar tarih sırasıyla. Maç albümündeki medya cihazında kalır.</p></div></section>
    <div className="season-filter"><label className="field-label">Yıl / sezon<select value={year} onChange={(event) => setYear(event.target.value)}>{years.map((item) => <option key={item} value={item}>{item} sezonu</option>)}</select></label><span>{entries.length} kayıt</span></div>
    {entries.length ? <ol className="season-timeline">{entries.map((entry) => entry.type === 'session' ? <li className="season-entry" key={`session-${entry.id}`}><span className="season-entry__node">{ICONS[entry.session.kind]}</span><article className="season-entry__card"><time>{shortDate(entry.date)}{entry.session.minutes ? ` · ${entry.session.minutes} dk` : ''}</time><h3>{entry.session.title}</h3><p>{entry.session.kind === 'match' ? 'Maç' : entry.session.kind === 'gym' ? 'Gym' : entry.session.kind === 'pitch' ? 'Saha' : entry.session.kind === 'recovery' ? 'Toparlanma' : entry.session.kind === 'rest' ? 'Dinlenme' : 'Antrenman'}{entry.session.score ? ` · ${entry.session.score}` : ''}</p>{entry.session.note && <blockquote>{entry.session.note}</blockquote>}{entry.session.matchEvents?.length ? <ul className="season-events">{entry.session.matchEvents.map((event) => <li key={event.id}><b>{event.minute}′</b> {event.type.replace('-', ' ')}{event.detail ? ` · ${event.detail}` : ''}</li>)}</ul> : null}{entry.session.voiceNoteId && <VoiceNotePlayback id={entry.session.voiceNoteId} />}{entry.session.matchMediaIds?.length ? <MatchMediaGallery ids={entry.session.matchMediaIds} /> : null}</article></li> : entry.type === 'gps' ? <li className="season-entry" key={`gps-${entry.id}`}><span className="season-entry__node">⌁</span><article className="season-entry__card"><time>{shortDate(entry.date)} · GPS rotası</time><h3>{entry.title}</h3><p>{number(entry.distanceKm, 2)} km · {Math.floor(entry.durationSeconds / 60)} dk · GPS içe aktarımı seanslardan ayrıdır.</p></article></li> : <li className="season-entry" key={`test-${entry.id}`}><span className="season-entry__node">📈</span><article className="season-entry__card"><time>{shortDate(entry.date)} · {entry.category}</time><h3>{entry.title}</h3><p>Kaydedilen sonuç: {number(entry.value, 2)} {entry.unit}</p></article></li>)}</ol> : <section className="card"><p className="empty-copy">Bu sezonda henüz kayıt yok. Antrenman veya maç kaydettiğinde günlüğün burada oluşur.</p></section>}
    <p className="analysis-disclaimer">Günlük yalnızca bu tarayıcıdaki kayıtları gösterir. Medya dosyaları JSON/CSV yedeğine dahil edilmez.</p>
  </div>;
}
