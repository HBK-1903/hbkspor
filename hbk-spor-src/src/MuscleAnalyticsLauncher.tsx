import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import catalogJson from './data/exercise-catalog.json';
import { currentWeekStart, addLocalDays, formatDay, localDayKey } from './dates';
import { loadSetEffortMetadata, readLegacyTrainingData, saveSetEffortMetadata, setMetadataKey } from './db';
import { loadImportedGpsActivities, parseGpsDeviceFile, readSupplementalAnalytics, saveImportedGpsActivities, MAX_GPX_BYTES } from './analytics-data';
import ExtendedAnalyticsView, { type AnalyticsSection } from './ExtendedAnalyticsView';
import {
  flattenGymWorkouts,
  MUSCLE_LABELS,
  mapExerciseMuscles,
  summarizeMuscleLoads,
  type FlattenedSet,
} from './muscles';
import type { AnalyticsData, ExerciseDefinition, GpsActivity, LegacyWorkout, MuscleGroup, MuscleLoad, SetEffortStore } from './types';

const STATIC_CATALOG = catalogJson as ExerciseDefinition[];
type RangeWeeks = 4 | 8 | 12;

export default function MuscleAnalyticsLauncher() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [effort, setEffort] = useState<SetEffortStore>(() => loadSetEffortMetadata());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [weeks, setWeeks] = useState<RangeWeeks>(4);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [section, setSection] = useState<AnalyticsSection>('overview');
  const closeButton = useRef<HTMLButtonElement>(null);
  const effortFileInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await readLegacyTrainingData();
      const catalogById = new Map(STATIC_CATALOG.map((item) => [item.id, item]));
      for (const item of result.exercises) catalogById.set(item.id, item);
      const supplemental = readSupplementalAnalytics(result.workouts);
      setData({ ...result, catalog: [...catalogById.values()], ...supplemental });
      setEffort(loadSetEffortMetadata());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Antrenman verileri okunamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  useEffect(() => {
    if (open) closeButton.current?.focus();
    else document.querySelector<HTMLButtonElement>('.muscle-analysis-entry')?.focus();
  }, [open]);

  useEffect(() => {
    let entry: HTMLDivElement | null = null;

    const syncEntry = () => {
      const activeNav = document.querySelector<HTMLElement>('nav[aria-label="Ana gezinme"] [aria-current="page"]');
      const isAnalysisTab = activeNav?.textContent?.trim() === 'Analiz';
      const heading = Array.from(document.querySelectorAll('h1')).find((node) => node.textContent?.trim() === 'Analiz' && node.closest('#root'));
      const header = heading?.parentElement?.parentElement;
      const page = header?.parentElement;

      if (!isAnalysisTab || !header || !page) {
        entry?.remove();
        entry = null;
        return;
      }

      if (entry?.isConnected && entry.parentElement === page && entry.previousElementSibling === header) return;
      entry?.remove();
      entry = document.createElement('div');
      entry.dataset.hbkMuscleAnalysisEntry = 'true';
      entry.className = 'muscle-analysis-entry-mount';
      const entryButton = document.createElement('button');
      entryButton.type = 'button';
      entryButton.className = 'muscle-analysis-entry';
      entryButton.setAttribute('aria-label', 'Performans analiz merkezini aç');
      entryButton.setAttribute('aria-haspopup', 'dialog');
      entryButton.innerHTML = '<span class="muscle-analysis-entry__icon" aria-hidden="true">📊</span><span class="muscle-analysis-entry__copy"><small>GÜÇ &amp; PERFORMANS</small><strong>Performans analizi</strong><span>Kas, maç, GPS, toparlanma ve kişisel rekorların</span></span><span class="muscle-analysis-entry__action" aria-hidden="true">Aç <i>↗</i></span>';
      entryButton.addEventListener('click', () => setOpen(true));
      entry.append(entryButton);
      header.insertAdjacentElement('afterend', entry);
    };

    const observer = new MutationObserver(syncEntry);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-current'] });
    syncEntry();
    return () => {
      observer.disconnect();
      entry?.remove();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const updateEffort = (key: string, field: 'rpe' | 'restSeconds', raw: string) => {
    const next = { ...effort };
    const current = { ...(next[key] ?? {}) };
    if (raw === '') delete current[field];
    else {
      const value = Number(raw);
      const valid = field === 'rpe'
        ? Number.isInteger(value) && value >= 1 && value <= 10
        : Number.isInteger(value) && value >= 0 && value <= 600;
      if (!valid) return;
      current[field] = value;
    }
    if (Object.keys(current).length) next[key] = current;
    else delete next[key];
    setEffort(next);
    if (!saveSetEffortMetadata(next)) setError('Set eforu bu cihazda saklanamadı. Tarayıcı depolama alanını kontrol et.');
    else setError('');
  };

  const importGpsFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > MAX_GPX_BYTES) throw new Error('GPS dosyası 20 MB sınırını aşıyor.');
      const imported = await parseGpsDeviceFile(file);
      const saved = saveImportedGpsActivities([imported, ...loadImportedGpsActivities()]);
      if (!saved) throw new Error('GPX rotası cihazda saklanamadı; depolama alanını kontrol et.');
      setData((current) => current ? {
        ...current,
        gpsActivities: [imported, ...current.gpsActivities.filter((activity) => activity.id !== imported.id)].sort((a, b) => b.date.localeCompare(a.date)),
      } : current);
      setError('GPS dosyası içe aktarıldı. Rota ve özet yalnızca bu cihazda saklanıyor.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'GPS dosyası içe aktarılamadı.');
    }
  };

  const deleteGpsImport = (id: string) => {
    const remaining = loadImportedGpsActivities().filter((activity) => activity.id !== id);
    if (!saveImportedGpsActivities(remaining)) {
      setError('GPS dosyası kaydı cihazdan silinemedi. Tarayıcı depolama alanını kontrol et.');
      return;
    }
    setData((current) => current ? { ...current, gpsActivities: current.gpsActivities.filter((activity) => activity.id !== id) } : current);
    setError('İçe aktarılan GPS rotası bu cihazdan silindi.');
  };

  const exportEffort = () => {
    const payload = { schemaVersion: 2, exportedAt: new Date().toISOString(), setEffort: effort, gpsImports: loadImportedGpsActivities() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `hbk-spor-analiz-yedegi-${localDayKey()}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const importEffort = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error('Analiz yedeği 10 MB sınırını aşıyor.');
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !('schemaVersion' in parsed) || ![1, 2].includes(Number(parsed.schemaVersion)) || !('setEffort' in parsed)) {
        throw new Error('Bu dosya HBK Spor analiz yedeği değil veya biçimi desteklenmiyor.');
      }
      const incoming = parsed.setEffort;
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('Yedek içindeki kayıtlar geçersiz.');
      const valid: SetEffortStore = {};
      for (const [key, value] of Object.entries(incoming)) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const item = value as { rpe?: unknown; restSeconds?: unknown };
        const rpeOk = item.rpe === undefined || (typeof item.rpe === 'number' && Number.isInteger(item.rpe) && item.rpe >= 1 && item.rpe <= 10);
        const restOk = item.restSeconds === undefined || (typeof item.restSeconds === 'number' && Number.isInteger(item.restSeconds) && item.restSeconds >= 0 && item.restSeconds <= 600);
        if (key.length > 300 || !rpeOk || !restOk) continue;
        valid[key] = {
          ...(typeof item.rpe === 'number' ? { rpe: item.rpe } : {}),
          ...(typeof item.restSeconds === 'number' ? { restSeconds: item.restSeconds } : {}),
        };
      }
      const gpsImports = 'gpsImports' in parsed && Array.isArray(parsed.gpsImports)
        ? parsed.gpsImports.filter((activity): activity is GpsActivity => Boolean(activity && typeof activity === 'object' && 'source' in activity && ['gpx', 'tcx', 'fit'].includes(String(activity.source))))
        : [];
      if (!window.confirm(`${Object.keys(valid).length} set kaydı ve ${gpsImports.length} içe aktarılmış GPS rotası yedekle birleştirilecek. Aynı setlere ait ek bilgiler yedektekilerle değişebilir. Devam edilsin mi?`)) return;
      const next = { ...effort, ...valid };
      if (!saveSetEffortMetadata(next)) throw new Error('Yedek tarayıcıda saklanamadı.');
      setEffort(next);
      if ('gpsImports' in parsed && Array.isArray(parsed.gpsImports)) {
        const byId = new Map([...loadImportedGpsActivities(), ...gpsImports].map((activity) => [activity.id, activity]));
        if (!saveImportedGpsActivities([...byId.values()])) throw new Error('Rota yedeği tarayıcıda saklanamadı.');
        const mergedImports = loadImportedGpsActivities();
        setData((current) => current ? { ...current, gpsActivities: [...current.gpsActivities.filter((activity) => activity.source === 'app'), ...mergedImports].sort((a, b) => b.date.localeCompare(a.date)) } : current);
      }
      setError('Analiz yedeği bu cihazdaki kayıtlarla birleştirildi.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Yedek içe aktarılamadı.');
    } finally {
      if (effortFileInput.current) effortFileInput.current.value = '';
    }
  };

  return (
    <>
      {open && <section className="muscle-overlay" role="dialog" aria-modal="true" aria-labelledby="muscle-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <div className="muscle-panel">
          <header className="muscle-panel__header">
            <div><p className="muscle-eyebrow">HBK SPOR · PERFORMANS</p><h1 id="muscle-title">Performans analizi</h1><p>Antrenman, maç, test, toparlanma ve GPS geçmişin tek yerde.</p></div>
            <div className="muscle-panel__actions"><button type="button" className="muscle-refresh" onClick={() => void refresh()} disabled={loading}>{loading ? 'Yükleniyor…' : '↻ Yenile'}</button><button ref={closeButton} type="button" className="muscle-close" onClick={() => setOpen(false)} aria-label="Performans analizini kapat">×</button></div>
          </header>
          {error && <div className="muscle-alert" role="alert">{error}</div>}
          {data && <div className="muscle-data-tools"><span>Set RPE ve içe aktarılan GPS rotaları yerel analiz yedeğine dahil edilir.</span><button type="button" onClick={exportEffort}>Analiz yedeğini indir</button><button type="button" onClick={() => effortFileInput.current?.click()}>Analiz yedeğini içe aktar</button><input ref={effortFileInput} type="file" accept="application/json,.json" hidden onChange={(event) => void importEffort(event.target.files?.[0])} /></div>}
          {loading && !data ? <div className="muscle-empty" role="status">Antrenman kayıtların yükleniyor…</div> : data ? <AnalyticsWorkspace data={data} effort={effort} weeks={weeks} setWeeks={setWeeks} section={section} setSection={setSection} selectedMuscle={selectedMuscle} setSelectedMuscle={setSelectedMuscle} selectedExercise={selectedExercise} setSelectedExercise={setSelectedExercise} onEffortChange={updateEffort} onGpsImport={importGpsFile} onDeleteGps={deleteGpsImport} /> : <div className="muscle-empty"><h2>Veriler okunamadı</h2><p>Uygulamanın ana ekranı kullanılabilir. Analizi tekrar yenileyebilirsin.</p><button type="button" className="muscle-primary" onClick={() => void refresh()}>Tekrar dene</button></div>}
          <footer className="muscle-footer">Mevcut uygulama kayıtları salt okunur. Ek RPE bilgisi ve içe aktarılan GPS dosyaları ayrı yerel anahtarlarda saklanır.</footer>
        </div>
      </section>}
    </>
  );
}

function AnalyticsWorkspace({ data, effort, weeks, setWeeks, section, setSection, selectedMuscle, setSelectedMuscle, selectedExercise, setSelectedExercise, onEffortChange, onGpsImport, onDeleteGps }: {
  data: AnalyticsData;
  effort: SetEffortStore;
  weeks: RangeWeeks;
  setWeeks: (value: RangeWeeks) => void;
  section: AnalyticsSection;
  setSection: (value: AnalyticsSection) => void;
  selectedMuscle: MuscleGroup | null;
  setSelectedMuscle: (value: MuscleGroup | null) => void;
  selectedExercise: string;
  setSelectedExercise: (value: string) => void;
  onEffortChange: (key: string, field: 'rpe' | 'restSeconds', value: string) => void;
  onGpsImport: (file?: File) => void;
  onDeleteGps: (id: string) => void;
}) {
  const tabs: Array<{ id: AnalyticsSection; label: string; icon: string }> = [
    { id: 'overview', label: 'Özet', icon: '◫' },
    { id: 'muscles', label: 'Kas', icon: '✳' },
    { id: 'matches', label: 'Maç', icon: '⚽' },
    { id: 'gps', label: 'GPS', icon: '⌁' },
    { id: 'recovery', label: 'Form', icon: '◉' },
    { id: 'tests', label: 'Testler', icon: '⌁' },
    { id: 'records', label: 'Rekorlar', icon: '↗' },
  ];
  return <div className="analytics-workspace">
    <div className="analytics-tabs" role="tablist" aria-label="Performans analizleri">{tabs.map((tab) => <button type="button" role="tab" key={tab.id} aria-selected={section === tab.id} className={section === tab.id ? 'active' : ''} onClick={() => setSection(tab.id)}><span aria-hidden="true">{tab.icon}</span>{tab.label}</button>)}</div>
    {section === 'muscles'
      ? <MuscleReport data={data} effort={effort} weeks={weeks} setWeeks={setWeeks} selectedMuscle={selectedMuscle} setSelectedMuscle={setSelectedMuscle} selectedExercise={selectedExercise} setSelectedExercise={setSelectedExercise} onEffortChange={onEffortChange} />
      : <ExtendedAnalyticsView data={data} section={section} weeks={weeks} setWeeks={setWeeks} onGpsImport={onGpsImport} onDeleteGps={onDeleteGps} />}
  </div>;
}

function MuscleReport({ data, effort, weeks, setWeeks, selectedMuscle, setSelectedMuscle, selectedExercise, setSelectedExercise, onEffortChange }: {
  data: AnalyticsData;
  effort: SetEffortStore;
  weeks: RangeWeeks;
  setWeeks: (value: RangeWeeks) => void;
  selectedMuscle: MuscleGroup | null;
  setSelectedMuscle: (value: MuscleGroup | null) => void;
  selectedExercise: string;
  setSelectedExercise: (value: string) => void;
  onEffortChange: (key: string, field: 'rpe' | 'restSeconds', value: string) => void;
}) {
  const today = localDayKey();
  const weekStart = currentWeekStart();
  const startDate = addLocalDays(weekStart, -(weeks - 1) * 7);
  const allSets = useMemo(() => flattenGymWorkouts(data.workouts, data.catalog, effort), [data.workouts, data.catalog, effort]);
  const periodSets = allSets.filter((row) => row.date >= startDate && row.date <= today);
  const summary = summarizeMuscleLoads(periodSets, startDate, today);
  const maxSets = Math.max(1, ...summary.map((item) => item.effectiveSets));
  const totalSets = summary.reduce((total, item) => total + item.effectiveSets, 0);
  const attributedVolume = summary.reduce((total, item) => total + item.weightedVolume, 0);
  const rpeValues = periodSets.flatMap((row) => row.rpe ? [row.rpe] : []);
  const averageRpe = rpeValues.length ? rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length : null;
  const exerciseOptionMap = new Map<string, string>();
  for (const row of [...periodSets].reverse()) exerciseOptionMap.set(row.exerciseId, row.exerciseName);
  const exerciseOptions: Array<[string, string]> = [...exerciseOptionMap.entries()];
  const activeExercise = exerciseOptions.some(([id]) => id === selectedExercise) ? selectedExercise : exerciseOptions[0]?.[0] ?? '';
  const filteredSets = selectedMuscle
    ? periodSets.filter((row) => row.primaryMuscles.includes(selectedMuscle) || row.secondaryMuscles.includes(selectedMuscle))
    : periodSets;
  const coveredWorkoutIds = new Set(allSets.map((row) => row.workoutId));
  const definitionsById = new Map(data.catalog.map((definition) => [definition.id, definition]));
  const unlabeledWorkoutCount = data.workouts.flatMap((workout) => workout.gymExercises ?? [])
    .filter((exercise) => {
      const definition = definitionsById.get(exercise.exerciseId);
      return definition?.track !== false && !mapExerciseMuscles(definition, exercise);
    }).length;

  return <div className="muscle-report">
    <div className="muscle-report__topline">
      <div className="muscle-period-controls" role="group" aria-label="Analiz dönemi">{([4, 8, 12] as const).map((period) => <button type="button" key={period} className={weeks === period ? 'active' : ''} aria-pressed={weeks === period} onClick={() => setWeeks(period)}>{period} hafta</button>)}</div>
      <p className="muscle-range"><span aria-hidden="true" />{formatDay(startDate)} – {formatDay(today)} <i /> {periodSets.length} set kaydı</p>
    </div>
    <div className="muscle-kpis"><Kpi icon="💪" value={formatNumber(totalSets)} label="Kas-set eşdeğeri" /><Kpi icon="🏋️" value={formatNumber(attributedVolume, 0)} label="Tahmini kg·tekrar" /><Kpi icon="🧠" value={averageRpe === null ? '—' : `${formatNumber(averageRpe)} / 10`} label="Ortalama RPE" /><Kpi icon="📅" value={String(new Set(periodSets.map((row) => row.date)).size)} label="Gym yapılan gün" /></div>
    {data.dbVersion < 2 && <div className="muscle-alert" role="status">HBK Spor’un mevcut v2 veritabanı bulunamadı. Ana uygulamayı bir kez açıp veriler yüklendikten sonra “Yenile”ye bas.</div>}
    {data.workouts.length === 0 && data.dbVersion >= 2 && <div className="muscle-empty"><h2>Henüz gym kaydı yok</h2><p>Önce ana HBK Spor ekranından bir gym antrenmanı ve hareket kaydet. Bu sayfa kayıtları otomatik okuyacak.</p></div>}
    {unlabeledWorkoutCount > 0 && <p className="muscle-note">{unlabeledWorkoutCount} özel/harici hareket kas kataloğunda eşleşmediği için kas grafiğine dahil edilmedi.</p>}
    {periodSets.length > 0 && <>
      <section className="muscle-card muscle-card--map"><SectionTitle eyebrow="VÜCUT HARİTASI" title="Çalışan kas grupları" /><MuscleBodyMap summaries={summary} selected={selectedMuscle} onSelect={setSelectedMuscle} /><p className="muscle-note">Ana kas seti 1, yardımcı kas seti 0,5 katsayısıyla hesaplanır. Set RPE’si girilmemişse antrenman genel RPE’si kullanılır; RPE öz bildirimdir. Renk ve tahmini hacim gerçek kas gelişimi veya fizyolojik yorgunluk ölçümü değildir.</p></section>
      <section className="muscle-card muscle-card--distribution"><SectionTitle eyebrow="KAS DAĞILIMI" title={selectedMuscle ? MUSCLE_LABELS[selectedMuscle] : 'Dönem özeti'} />{selectedMuscle && <button type="button" className="muscle-text-button" onClick={() => setSelectedMuscle(null)}>Filtreyi temizle</button>}<div className="muscle-bars">{summary.map((item) => <MuscleBar key={item.muscle} item={item} max={maxSets} selected={selectedMuscle === item.muscle} onClick={() => setSelectedMuscle(selectedMuscle === item.muscle ? null : item.muscle)} />)}</div></section>
      <TrainingHeatmap workouts={data.workouts} rows={periodSets} weeks={weeks} startDate={startDate} />
      <ExerciseProgress rows={periodSets} options={exerciseOptions} selectedExercise={activeExercise} setSelectedExercise={setSelectedExercise} />
      <section className="muscle-card muscle-card--sets"><div className="muscle-section-heading"><SectionTitle eyebrow="HAREKET & SET DETAYI" title={`${filteredSets.length} set`} />{selectedMuscle && <button type="button" className="muscle-text-button" onClick={() => setSelectedMuscle(null)}>Filtreyi kaldır</button>}</div>{filteredSets.length ? <div className="muscle-table-scroll"><table className="muscle-set-table"><thead><tr><th>Gün / hareket</th><th>Set</th><th>Tekrar</th><th>Kg</th><th>RPE</th><th>Dinlenme</th></tr></thead><tbody>{[...filteredSets].reverse().map((row) => { const key = setMetadataKey(row.workoutId, row.exerciseId, row.setId); return <tr key={key}><td><b>{row.exerciseName}</b><small>{formatDay(row.date)} · {row.workoutTitle}</small><small>{row.primaryMuscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ')}</small></td><td>{row.setNumber}</td><td>{row.reps}</td><td>{formatNumber(row.weightKg, 1)}</td><td><input aria-label={`${row.exerciseName} set ${row.setNumber} RPE`} type="number" min="1" max="10" step="1" value={effort[key]?.rpe ?? ''} placeholder={row.workoutRpe ? String(row.workoutRpe) : '—'} onChange={(event) => onEffortChange(key, 'rpe', event.target.value)} /></td><td><div className="rest-input"><input aria-label={`${row.exerciseName} set ${row.setNumber} dinlenme saniye`} type="number" min="0" max="600" step="5" value={effort[key]?.restSeconds ?? ''} placeholder="—" onChange={(event) => onEffortChange(key, 'restSeconds', event.target.value)} /><span>sn</span></div></td></tr>; })}</tbody></table></div> : <p className="muscle-empty-copy">Bu kas grubu için set kaydı bulunmuyor.</p>}</section>
    </>}
    {data.workouts.some((workout) => workout.type === 'gym') && coveredWorkoutIds.size === 0 && <p className="muscle-note">Gym kayıtların bulundu ancak içlerinde kas kataloğuyla eşleşen set bilgisi bulunamadı. Hareket adlarını kontrol etmek için ana uygulamadaki kayıt detayını aç.</p>}
  </div>;
}

function Kpi({ icon, value, label }: { icon: string; value: string; label: string }) {
  return <article className="muscle-kpi"><span aria-hidden="true">{icon}</span><b>{value}</b><small>{label}</small></article>;
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="muscle-section-title"><p>{eyebrow}</p><h2>{title}</h2></div>;
}

function MuscleBar({ item, max, selected, onClick }: { item: MuscleLoad; max: number; selected: boolean; onClick: () => void }) {
  return <button type="button" className={`muscle-bar-row ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={onClick}><span className="muscle-bar-top"><b>{MUSCLE_LABELS[item.muscle]}</b><strong>{formatNumber(item.effectiveSets)} set</strong></span><span className="muscle-bar-track" role="progressbar" aria-label={`${MUSCLE_LABELS[item.muscle]} etkin set`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={item.effectiveSets}><i style={{ width: `${item.effectiveSets ? Math.max(2, item.effectiveSets / max * 100) : 0}%` }} /></span><small>{item.movements} hareket · {item.avgRpe === null ? 'RPE girilmedi' : `RPE ${formatNumber(item.avgRpe)}`} · {formatNumber(item.weightedVolume, 0)} kg·tekrar</small></button>;
}

function MuscleBodyMap({ summaries, selected, onSelect }: { summaries: MuscleLoad[]; selected: MuscleGroup | null; onSelect: (value: MuscleGroup | null) => void }) {
  const values = new Map(summaries.map((item) => [item.muscle, item.effectiveSets]));
  const max = Math.max(1, ...summaries.map((item) => item.effectiveSets));
  const shapes: Record<MuscleGroup, ReactNode> = {
    chest: <path d="M38 58 Q60 50 82 58 L78 82 Q60 88 42 82Z" />,
    back: <path d="M39 56 Q60 49 81 56 L77 93 Q60 100 43 93Z" />,
    shoulders: <><ellipse cx="37" cy="56" rx="10" ry="8" /><ellipse cx="83" cy="56" rx="10" ry="8" /></>,
    rearDelts: <><ellipse cx="37" cy="57" rx="10" ry="8" /><ellipse cx="83" cy="57" rx="10" ry="8" /></>,
    traps: <path d="M47 48 L60 43 73 48 78 63 60 70 42 63Z" />,
    biceps: <><path d="M27 66 Q34 63 39 73 L35 94 28 92Z" /><path d="M93 66 Q86 63 81 73 L85 94 92 92Z" /></>,
    triceps: <><path d="M27 68 Q34 65 39 75 L35 96 28 94Z" /><path d="M93 68 Q86 65 81 75 L85 96 92 94Z" /></>,
    forearms: <><path d="M27 96 L35 97 39 119 32 123Z" /><path d="M93 96 L85 97 81 119 88 123Z" /></>,
    core: <path d="M45 84 Q60 90 75 84 L73 112 Q60 118 47 112Z" />,
    obliques: <><path d="M41 84 L47 86 48 111 43 108Z" /><path d="M79 84 L73 86 72 111 77 108Z" /></>,
    hipFlexors: <><ellipse cx="49" cy="117" rx="7" ry="11" /><ellipse cx="71" cy="117" rx="7" ry="11" /></>,
    quadriceps: <><path d="M43 117 L58 119 56 160 43 160Z" /><path d="M62 119 L77 117 77 160 64 160Z" /></>,
    hamstrings: <><path d="M43 118 L58 120 56 161 43 161Z" /><path d="M62 120 L77 118 77 161 64 161Z" /></>,
    glutes: <path d="M43 95 Q60 102 77 95 L77 119 Q60 126 43 119Z" />,
    adductors: <><path d="M56 120 L62 120 60 158 55 158Z" /></>,
    calves: <><path d="M44 164 L56 164 54 203 44 201Z" /><path d="M64 164 L76 164 76 201 66 203Z" /></>,
    tibialis: <><path d="M42 164 L49 165 47 202 42 200Z" /><path d="M78 164 L71 165 73 202 78 200Z" /></>,
  };
  const region = (muscle: MuscleGroup) => {
    const value = values.get(muscle) ?? 0;
    const active = selected === muscle;
    const activate = () => onSelect(active ? null : muscle);
    const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
    };
    return <g key={muscle} className="muscle-map-region" role="button" tabIndex={0} aria-pressed={active} aria-label={`${MUSCLE_LABELS[muscle]}: ${formatNumber(value)} etkin set`} onClick={activate} onKeyDown={onKeyDown} style={{ '--heat': value ? 0.25 + value / max * 0.7 : 0.12, '--region-stroke': active ? '#fff' : '#64735f' } as CSSProperties}>{shapes[muscle]}</g>;
  };
  const front: MuscleGroup[] = ['shoulders', 'chest', 'biceps', 'forearms', 'core', 'obliques', 'hipFlexors', 'quadriceps', 'adductors', 'calves', 'tibialis'];
  const back: MuscleGroup[] = ['shoulders', 'rearDelts', 'traps', 'back', 'triceps', 'forearms', 'core', 'glutes', 'hamstrings', 'calves', 'tibialis'];
  const figure = (side: 'Ön' | 'Arka', groups: MuscleGroup[]) => <div className="muscle-map-figure" key={side}><b>{side}</b><svg viewBox="0 0 120 220" role="group" aria-label={`${side} kas haritası`}><circle className="muscle-map-base" cx="60" cy="25" r="14" /><path className="muscle-map-base" d="M52 40 L68 40 72 49 91 53 99 69 92 101 81 111 79 120 83 160 78 211 64 211 60 169 56 211 42 211 37 160 41 120 39 111 28 101 21 69 29 53 48 49Z" />{groups.map(region)}</svg></div>;
  return <div className="muscle-map"><div className="muscle-map-figures">{figure('Ön', front)}{figure('Arka', back)}</div><div className="muscle-map-legend">{(Object.keys(MUSCLE_LABELS) as MuscleGroup[]).map((muscle) => <button type="button" key={muscle} className={selected === muscle ? 'selected' : ''} onClick={() => onSelect(selected === muscle ? null : muscle)}>{MUSCLE_LABELS[muscle]} <b>{formatNumber(values.get(muscle) ?? 0)}</b></button>)}</div></div>;
}

function TrainingHeatmap({ workouts, rows, weeks, startDate }: { workouts: LegacyWorkout[]; rows: FlattenedSet[]; weeks: RangeWeeks; startDate: string }) {
  const columns = Array.from({ length: weeks }, (_, week) => Array.from({ length: 7 }, (_, day) => addLocalDays(startDate, week * 7 + day)));
  return <section className="muscle-card muscle-card--heatmap"><SectionTitle eyebrow="ANTRENMAN RİTMİ" title="Gym günleri" /><div className="muscle-heatmap" style={{ '--week-count': weeks } as CSSProperties}><span /><div className="muscle-heatmap-week-labels">{columns.map((_, index) => <small key={index}>{index + 1}</small>)}</div>{['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day, dayIndex) => <div className="muscle-heatmap-row" key={day}><small>{day}</small>{columns.map((column) => { const date = column[dayIndex]; const count = workouts.filter((workout) => workout.type === 'gym' && workout.date === date).length; const sets = rows.filter((row) => row.date === date).length; const level = !count ? 0 : sets >= 10 ? 3 : sets >= 4 ? 2 : 1; return <span key={date} className={`muscle-heat-cell level-${level}`} title={`${date}: ${count ? `${count} gym antrenmanı, ${sets} set` : 'kayıt yok'}`} aria-label={`${date}: ${count ? `${count} antrenman, ${sets} set` : 'kayıt yok'}`} />; })}</div>)}</div><div className="muscle-heat-key"><span>Az</span><i className="level-0" /><i className="level-1" /><i className="level-2" /><i className="level-3" /><span>Çok</span></div><p className="muscle-note">Isı haritası set kaydını gösterir; dinlenme günü başarısızlık değildir.</p></section>;
}

function ExerciseProgress({ rows, options, selectedExercise, setSelectedExercise }: { rows: FlattenedSet[]; options: Array<[string, string]>; selectedExercise: string; setSelectedExercise: (value: string) => void }) {
  const points = rows.filter((row) => row.exerciseId === selectedExercise).reduce((acc, row) => {
    const current = acc.get(row.workoutId) ?? { date: row.date, title: row.workoutTitle, tonnage: 0, reps: 0 };
    current.tonnage += row.reps * row.weightKg;
    current.reps += row.reps;
    acc.set(row.workoutId, current);
    return acc;
  }, new Map<string, { date: string; title: string; tonnage: number; reps: number }>())
    .values();
  const sortedPoints = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const weighted = sortedPoints.some((point) => point.tonnage > 0);
  const values = sortedPoints.map((point) => weighted ? point.tonnage : point.reps);
  const max = Math.max(1, ...values);
  const viewW = 360; const viewH = 150; const pad = { x: 26, y: 14, bottom: 28 };
  const innerW = viewW - pad.x - 12; const innerH = viewH - pad.y - pad.bottom;
  const coords = values.map((value, index) => ({ x: sortedPoints.length < 2 ? pad.x + innerW / 2 : pad.x + index / (sortedPoints.length - 1) * innerW, y: pad.y + (1 - value / max) * innerH }));
  return <section className="muscle-card muscle-card--progress"><SectionTitle eyebrow="HAREKET İLERLEMESİ" title="Zaman içindeki kayıtlar" />{!options.length ? <p className="muscle-empty-copy">Bu dönemde hareket grafiği için kayıt bulunmuyor.</p> : <><label className="muscle-select-label">Hareket<select value={selectedExercise} onChange={(event) => setSelectedExercise(event.target.value)}>{options.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label><p className="muscle-note">{weighted ? 'Grafik: dış yük hacmi (kg × tekrar).' : 'Bu harekette yük girilmedi; grafik toplam tekrarları gösteriyor.'}</p><svg className="muscle-progress-chart" viewBox={`0 0 ${viewW} ${viewH}`} role="img" aria-label={`${options.find(([id]) => id === selectedExercise)?.[1] ?? 'Hareket'} gelişim grafiği`}><line x1={pad.x} y1={pad.y + innerH} x2={viewW - 12} y2={pad.y + innerH} /><line x1={pad.x} y1={pad.y} x2={pad.x} y2={pad.y + innerH} />{coords.length > 1 && <polyline points={coords.map((point) => `${point.x},${point.y}`).join(' ')} />}{coords.map((point, index) => <g key={`${sortedPoints[index].date}-${index}`}><circle cx={point.x} cy={point.y} r="4" /><title>{formatDay(sortedPoints[index].date)}: {formatNumber(values[index], 0)}</title></g>)}<text x={pad.x} y={viewH - 5}>{sortedPoints[0] ? formatDay(sortedPoints[0].date) : ''}</text><text x={viewW - 12} y={viewH - 5} textAnchor="end">{sortedPoints.length ? formatDay(sortedPoints[sortedPoints.length - 1].date) : ''}</text></svg><ul className="muscle-chart-values">{sortedPoints.map((point, index) => <li key={`${point.date}-${point.title}-${index}`}>{formatDay(point.date)} <b>{formatNumber(values[index], 0)} {weighted ? 'kg·tekrar' : 'tekrar'}</b></li>)}</ul></>}</section>;
}

function formatNumber(value: number, digits = 1): string {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits }).format(value);
}
