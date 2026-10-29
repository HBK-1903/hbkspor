import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { exportJson, exportSessionsCsv, loadAppData, saveAppData } from './storage';
import {
  EXERCISE_LIBRARY,
  formatSetDetails,
  getExerciseAverageRpe,
  getExerciseSetCount,
  getExerciseTonnage,
  getExerciseTotalReps,
  getStreak,
  getWeekStartKey,
  localDateKey,
  makeLoggedExerciseFromSets,
  MUSCLE_LABELS,
  shiftLocalDate,
  summarizeMuscleWorkload,
  XP_REWARDS,
} from './training';
import type { AppData, CustomDrill, CustomGoal, ExerciseSet, LoggedExercise, MatchEvent, MatchEventType, MuscleGroup, PlayerCardAppearance, SessionKind, SkillTestRecord, TrainingSession, WeeklyPlanItem, WorkoutTemplate } from './types';
import { DrillLibrary, ExerciseVisualLibrary, GpsActivityLibrary, ProgressAchievements, WeeklyComparison, WeeklyPlanner } from './visual-features';
import type { Drill } from './drills';
import type { GpsActivity } from './types';
import { PlayerCardEditor } from './PlayerCardEditor';
import { DEFAULT_CARD_APPEARANCE } from './player-card';
import { clearVoiceNotes, saveVoiceNote } from './audio-notes';
import { VoiceNoteRecorder } from './VoiceNoteRecorder';
import { VoiceNotePlayback } from './VoiceNotePlayback';

const GOALS = [
  { id: 'water', title: 'Günde en az 3 litre su iç', detail: 'Kramp önleme ve performans' },
  { id: 'mobility', title: '15 dk dinamik mobilite', detail: 'Saha veya gym öncesi / sonrası' },
  { id: 'sleep', title: 'En az 8 saat kaliteli uyku', detail: 'Kas toparlanması ve yenilenme' },
  { id: 'weak-foot', title: 'Zayıf ayakla 50 pas / şut', detail: 'Çift ayak gelişimi' },
];

const ACTIONS: Array<{ kind: SessionKind; label: string; icon: string; hint: string }> = [
  { kind: 'gym', label: '+ Gym', icon: '🏋️', hint: 'Kuvvet ve kondisyon' },
  { kind: 'pitch', label: '+ Saha', icon: '⚽', hint: 'Topla teknik çalışma' },
  { kind: 'match', label: '+ Maç', icon: '🏟️', hint: 'Maç kaydı ve skor' },
  { kind: 'gps', label: '+ GPS', icon: '🏃', hint: 'Koşu ve mesafe' },
  { kind: 'timer', label: 'Tempo', icon: '⏱️', hint: 'Aralıklı çalışma' },
  { kind: 'recovery', label: 'Toparlanma', icon: '🧘', hint: 'Esneme ve mobilite' },
  { kind: 'rest', label: 'Dinlenme', icon: '🌙', hint: 'Bugünü dinlenme günü kaydet' },
];

const LABELS: Record<SessionKind, string> = {
  gym: 'Gym', pitch: 'Saha', match: 'Maç', gps: 'GPS koşusu', timer: 'Tempo timer', recovery: 'Toparlanma', rest: 'Dinlenme',
};

const MATCH_EVENT_LABELS: Record<MatchEventType, string> = { goal: 'Gol', assist: 'Asist', 'yellow-card': 'Sarı kart', 'red-card': 'Kırmızı kart', substitution: 'Oyuncu değişikliği', note: 'Not' };
const SKILL_TEST_TEMPLATES = [
  { id: 'sprint-10m', name: '10 m sprint', category: 'Hız', unit: 'sn', lowerIsBetter: true },
  { id: 'sprint-20m', name: '20 m sprint', category: 'Hız', unit: 'sn', lowerIsBetter: true },
  { id: 'sprint-30m', name: '30 m sprint', category: 'Hız', unit: 'sn', lowerIsBetter: true },
  { id: 'agility-505', name: '505 çeviklik testi', category: 'Çeviklik', unit: 'sn', lowerIsBetter: true },
  { id: 'jump', name: 'Dikey sıçrama', category: 'Güç', unit: 'cm', lowerIsBetter: false },
  { id: 'cooper', name: '12 dk koşu', category: 'Dayanıklılık', unit: 'm', lowerIsBetter: false },
] as const;

const shortDate = (value: string) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));
const numberFormat = (value: number, maximumFractionDigits = 1) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits }).format(value);

interface ExerciseDraft {
  exerciseId: string;
}

interface SetDraft {
  reps: string;
  weightKg: string;
  rpe: string;
  restSeconds: string;
}

const freshExerciseDraft = (): ExerciseDraft => ({ exerciseId: EXERCISE_LIBRARY[0].id });
const freshSetDraft = (): SetDraft => ({ reps: '10', weightKg: '0', rpe: '7', restSeconds: '90' });

export default function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [tab, setTab] = useState<'home' | 'calendar' | 'stats' | 'settings'>('home');
  const [statsView, setStatsView] = useState<'overview' | 'muscles' | 'tests' | 'drills' | 'exercises' | 'gps' | 'achievements' | 'comparison'>('overview');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<SessionKind | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [position, setPosition] = useState('Orta saha');
  const [foot, setFoot] = useState<'Sağ' | 'Sol'>('Sağ');
  const [title, setTitle] = useState('Üst Vücut & Core');
  const [minutes, setMinutes] = useState('45');
  const [note, setNote] = useState('');
  const [score, setScore] = useState('');
  const [matchEventMinute, setMatchEventMinute] = useState('');
  const [matchEventType, setMatchEventType] = useState<MatchEventType>('goal');
  const [matchEventDetail, setMatchEventDetail] = useState('');
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [exerciseDraft, setExerciseDraft] = useState<ExerciseDraft>(freshExerciseDraft);
  const [setDraft, setSetDraft] = useState<SetDraft>(freshSetDraft);
  const [pendingSets, setPendingSets] = useState<ExerciseSet[]>([]);
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([]);
  const [voiceNoteBlob, setVoiceNoteBlob] = useState<Blob | null>(null);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => saveAppData(data), [data]);
  useEffect(() => {
    if (restRemaining === null) return;
    if (restRemaining <= 0) { setRestRemaining(null); setToast('Dinlenme süresi tamamlandı.'); return; }
    const timer = window.setTimeout(() => setRestRemaining((remaining) => remaining === null ? null : remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [restRemaining]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const today = localDateKey();
  const todayGoals = data.goalCompletions?.[today] ?? [];
  const totalXp = useMemo(() => data.sessions.reduce((sum, session) => sum + session.xp, 0), [data.sessions]);
  const level = Math.floor(totalXp / 150) + 1;
  const levelProgress = totalXp % 150;
  const todaySessions = data.sessions.filter((session) => session.date === today);
  const streak = getStreak(data.sessions);
  const weekStart = getWeekStartKey();
  const weekEnd = shiftLocalDate(weekStart, 6);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const key = shiftLocalDate(weekStart, index);
    return {
      label: new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(new Date(`${key}T12:00:00`)),
      key,
      active: data.sessions.some((session) => session.date === key),
    };
  }), [data.sessions, weekStart]);

  const createProfile = () => {
    const trimmed = profileName.trim();
    if (!trimmed) return;
    setData((current) => ({ ...current, demoMode: false, profile: { name: trimmed, position, dominantFoot: foot, createdAt: today } }));
    setToast(`Hoş geldin, ${trimmed}!`);
  };

  const startDemo = () => {
    setData({
      profile: { name: 'Yıldız', position: 'Kanat', dominantFoot: 'Sağ', createdAt: today },
      demoMode: true,
      sessions: [{ id: crypto.randomUUID(), kind: 'pitch', title: 'İlk saha çalışmam', minutes: 35, xp: XP_REWARDS.pitch, date: today, note: 'Demo antrenmanı' }],
      completedGoals: [],
      goalCompletions: {},
      workoutTemplates: [],
      skillTests: [],
      gpsActivities: [],
      weeklyPlan: [],
      customGoals: [],
      customDrills: [],
    });
    setToast('Demo profili hazır. Veriler bu cihazda kalır.');
  };

  const openAction = (kind: SessionKind) => {
    setActivePlanId(null);
    setActiveKind(kind);
    setSheetOpen(false);
    setTitle(kind === 'gym' ? 'Kuvvet antrenmanı' : kind === 'pitch' ? 'Teknik çalışma' : kind === 'match' ? 'Haftalık maç' : LABELS[kind]);
    setMinutes(kind === 'rest' ? '0' : '45');
    setNote('');
    setScore('');
    setMatchEvents([]);
    setMatchEventMinute('');
    setMatchEventDetail('');
    setRestRemaining(null);
    setTemplateName('');
    setExerciseDraft(freshExerciseDraft());
    setSetDraft(freshSetDraft());
    setPendingSets([]);
    setLoggedExercises([]);
    setVoiceNoteBlob(null);
    setVoiceRecording(false);
  };

  const addSet = () => {
    const reps = Number(setDraft.reps);
    const weightKg = Number(setDraft.weightKg);
    const rpe = Number(setDraft.rpe);
    const restSeconds = Number(setDraft.restSeconds);
    if (!Number.isInteger(reps) || reps < 1 || reps > 100
      || !Number.isFinite(weightKg) || weightKg < 0 || weightKg > 500
      || !Number.isInteger(rpe) || rpe < 1 || rpe > 10
      || !Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > 600
      || pendingSets.length >= 20) {
      setToast('Tekrar 1–100, yük 0–500 kg, RPE 1–10, dinlenme 0–600 sn; hareket başına en fazla 20 set.');
      return;
    }
    setPendingSets((current) => [...current, { id: crypto.randomUUID(), reps, weightKg, rpe, restSeconds }]);
    if (restSeconds > 0) setRestRemaining(restSeconds);
  };

  const addExercise = () => {
    const definition = EXERCISE_LIBRARY.find((exercise) => exercise.id === exerciseDraft.exerciseId);
    if (!definition) return;
    const entry = makeLoggedExerciseFromSets(definition, pendingSets);
    if (!entry) {
      setToast('Bu harekete eklemeden önce en az bir geçerli set kaydet.');
      return;
    }
    setLoggedExercises((current) => [...current, entry]);
    setExerciseDraft(freshExerciseDraft());
    setSetDraft(freshSetDraft());
    setPendingSets([]);
  };

  const cloneExercises = (exercises: LoggedExercise[] = []) => exercises.map((exercise) => ({
    ...exercise,
    id: crypto.randomUUID(),
    setDetails: exercise.setDetails?.map((set) => ({ ...set, id: crypto.randomUUID() })),
    primaryMuscles: [...exercise.primaryMuscles],
    secondaryMuscles: [...exercise.secondaryMuscles],
  }));

  const copyLastGymWorkout = () => {
    const lastGym = data.sessions.find((session) => session.kind === 'gym' && session.exercises?.length);
    if (!lastGym) return;
    setTitle(lastGym.title);
    setMinutes(String(lastGym.minutes));
    setNote(lastGym.note ?? '');
    setLoggedExercises(cloneExercises(lastGym.exercises));
    setPendingSets([]);
    setToast('Son gym antrenmanı yeni kayıt için kopyalandı.');
  };

  const applyTemplate = (template: WorkoutTemplate) => {
    setTitle(template.name);
    setMinutes(String(template.minutes));
    setNote(template.note ?? '');
    setLoggedExercises(cloneExercises(template.exercises));
    setPendingSets([]);
    setToast(`${template.name} şablonu yüklendi.`);
  };

  const saveWorkoutTemplate = () => {
    if (activeKind !== 'gym' && activeKind !== 'pitch') return;
    const name = templateName.trim() || title.trim();
    if (!name || (data.workoutTemplates?.length ?? 0) >= 20) {
      setToast('Şablona bir ad ver; en fazla 20 şablon saklanabilir.');
      return;
    }
    const template: WorkoutTemplate = {
      id: crypto.randomUUID(), name: name.slice(0, 48), kind: activeKind,
      minutes: Math.max(0, Math.min(600, Math.round(Number(minutes) || 0))),
      ...(note.trim() ? { note: note.trim().slice(0, 500) } : {}),
      ...(activeKind === 'gym' && loggedExercises.length ? { exercises: cloneExercises(loggedExercises) } : {}),
    };
    setData((current) => ({ ...current, workoutTemplates: [...(current.workoutTemplates ?? []), template] }));
    setTemplateName('');
    setToast('Antrenman şablonu kaydedildi.');
  };

  const deleteWorkoutTemplate = (id: string) => setData((current) => ({ ...current, workoutTemplates: (current.workoutTemplates ?? []).filter((template) => template.id !== id) }));

  const addMatchEvent = () => {
    const minute = Number(matchEventMinute);
    if (!Number.isInteger(minute) || minute < 0 || minute > 150 || matchEvents.length >= 50) {
      setToast('Maç dakikası 0–150 arasında olmalı; en fazla 50 olay eklenebilir.');
      return;
    }
    const event: MatchEvent = { id: crypto.randomUUID(), minute, type: matchEventType, ...(matchEventDetail.trim() ? { detail: matchEventDetail.trim().slice(0, 100) } : {}) };
    setMatchEvents((current) => [...current, event].sort((a, b) => a.minute - b.minute));
    setMatchEventMinute('');
    setMatchEventDetail('');
  };

  const saveSkillTest = (test: Omit<SkillTestRecord, 'id' | 'date'>) => {
    const record: SkillTestRecord = { ...test, id: crypto.randomUUID(), date: today };
    setData((current) => ({ ...current, skillTests: [record, ...(current.skillTests ?? [])] }));
    setToast(`${test.name} sonucu kaydedildi.`);
  };

  const importGpsActivity = (activity: GpsActivity) => {
    setData((current) => ({ ...current, gpsActivities: [activity, ...(current.gpsActivities ?? [])] }));
    setToast(`Rota eklendi · ${numberFormat(activity.distanceKm, 2)} km. Antrenman sayısına eklenmedi.`);
  };

  const deleteGpsActivity = (id: string) => {
    if (!window.confirm('Bu GPX rotasını bu cihazdan silmek istiyor musun?')) return;
    setData((current) => ({ ...current, gpsActivities: (current.gpsActivities ?? []).filter((activity) => activity.id !== id) }));
    setToast('GPX rotası silindi.');
  };

  const startDrill = (drill: Drill) => {
    openAction('pitch');
    setTitle(drill.name);
    setMinutes(String(drill.duration));
    setNote(`${drill.description} İpuçları: ${drill.cues.join('; ')}.`);
    setToast(`${drill.name} saha kaydına hazırlandı.`);
  };

  const startExercise = (exerciseId: string) => {
    openAction('gym');
    setExerciseDraft({ exerciseId });
    setToast('Hareket seçildi; setlerini Gym kaydına ekle.');
  };

  const addPlanItem = (item: Omit<WeeklyPlanItem, 'id'>) => {
    setData((current) => ({ ...current, weeklyPlan: [...(current.weeklyPlan ?? []), { ...item, id: crypto.randomUUID() }] }));
    setToast('Çalışma haftalık plana eklendi.');
  };

  const deletePlanItem = (id: string) => setData((current) => ({ ...current, weeklyPlan: (current.weeklyPlan ?? []).filter((item) => item.id !== id) }));

  const startPlanItem = (item: WeeklyPlanItem) => {
    openAction(item.kind);
    setActivePlanId(item.id);
    setTitle(item.title);
    setMinutes(String(item.minutes));
    setToast('Plan kayda dönüştürülmeye hazır. Kaydedince gerçek seans olarak işaretlenir.');
  };

  const addCustomGoal = (goal: Omit<CustomGoal, 'id' | 'createdAt'>) => {
    setData((current) => ({ ...current, customGoals: [...(current.customGoals ?? []), { ...goal, id: crypto.randomUUID(), createdAt: today }] }));
    setToast('Kişisel hedef oluşturuldu.');
  };

  const deleteCustomGoal = (id: string) => setData((current) => ({ ...current, customGoals: (current.customGoals ?? []).filter((goal) => goal.id !== id) }));

  const saveCardAppearance = (playerCard: PlayerCardAppearance) => {
    setData((current) => ({ ...current, playerCard }));
    setToast('Oyuncu kartı görünümü kaydedildi.');
  };

  const saveCustomDrill = (drill: Omit<CustomDrill, 'id' | 'createdAt'>) => {
    if ((data.customDrills?.length ?? 0) >= 20) { setToast('En fazla 20 özel drill saklanabilir.'); return; }
    setData((current) => ({ ...current, customDrills: [{ ...drill, id: crypto.randomUUID(), createdAt: today }, ...(current.customDrills ?? [])] }));
    setToast('Kişisel saha şeması kaydedildi.');
  };

  const deleteCustomDrill = (id: string) => setData((current) => ({ ...current, customDrills: (current.customDrills ?? []).filter((drill) => drill.id !== id) }));

  const saveSession = async () => {
    if (!activeKind) return;
    if (voiceRecording) { setToast('Önce ses kaydını bitir.'); return; }
    const duration = Number(minutes);
    if (!Number.isFinite(duration) || duration < 0 || duration > 600) {
      setToast('Süre 0–600 dakika arasında olmalı.');
      return;
    }
    const session: TrainingSession = {
      id: crypto.randomUUID(),
      kind: activeKind,
      title: title.trim() || LABELS[activeKind],
      minutes: Math.round(duration),
      xp: XP_REWARDS[activeKind],
      date: today,
      note: note.trim(),
      ...(score.trim() ? { score: score.trim() } : {}),
      ...(activeKind === 'match' && matchEvents.length ? { matchEvents: [...matchEvents].sort((a, b) => a.minute - b.minute) } : {}),
      ...(activeKind === 'gym' && loggedExercises.length ? { exercises: loggedExercises } : {}),
      ...(voiceNoteBlob ? { voiceNoteId: crypto.randomUUID() } : {}),
    };
    if (voiceNoteBlob && session.voiceNoteId) {
      try { await saveVoiceNote(session.voiceNoteId, voiceNoteBlob); }
      catch (reason) { setToast(reason instanceof Error ? reason.message : 'Sesli not kaydedilemedi.'); return; }
    }
    const planId = activePlanId;
    setData((current) => ({
      ...current,
      sessions: [session, ...current.sessions],
      weeklyPlan: planId ? (current.weeklyPlan ?? []).map((item) => item.id === planId ? { ...item, completedSessionId: session.id } : item) : current.weeklyPlan,
    }));
    setActivePlanId(null);
    setActiveKind(null);
    setRestRemaining(null);
    setToast(activeKind === 'gym' && loggedExercises.length === 0
      ? 'Genel Gym kaydı eklendi. Kas analizi için sonraki kayıtta hareket detayı ekleyebilirsin.'
      : `${LABELS[session.kind]} kaydı eklendi · +${session.xp} XP`);
  };

  const toggleGoal = (goalId: string) => {
    setData((current) => {
      const goalCompletions = current.goalCompletions ?? {};
      const completedToday = goalCompletions[today] ?? [];
      const next = completedToday.includes(goalId)
        ? completedToday.filter((id) => id !== goalId)
        : [...completedToday, goalId];
      return {
        ...current,
        goalCompletions: { ...goalCompletions, [today]: next },
      };
    });
  };

  const resetProfile = async () => {
    if (!window.confirm('Bu cihazdaki HBK Spor profilini, kayıtlarını ve sesli notlarını sıfırlamak istiyor musun?')) return;
    let cleanupWarning = '';
    try { await clearVoiceNotes(); }
    catch { cleanupWarning = ' Sesli not deposu tarayıcı tarafından kilitli; tekrar deneyebilirsin.'; }
    setData({ profile: null, demoMode: false, sessions: [], completedGoals: [], goalCompletions: {}, workoutTemplates: [], skillTests: [], gpsActivities: [], weeklyPlan: [], customGoals: [], customDrills: [], playerCard: undefined });
    setToast(`Profil ve kayıtlar sıfırlandı.${cleanupWarning}`);
  };

  const renderHome = () => (
    <>
      <header className="topbar">
        <div><p className="eyebrow">HBK SPOR · PERFORMANS GÜNLÜĞÜ</p><h1>Hoş geldin, {data.profile?.name}</h1></div>
        <button className="avatar" aria-label="Ayarlar" onClick={() => setTab('settings')}>{data.profile?.name.slice(0, 1).toUpperCase()}</button>
      </header>
      <section className={`player-card player-card--${data.playerCard?.theme ?? 'field'}`} style={{ '--card-photo-zoom': data.playerCard?.zoom ?? 1, '--card-photo-position': `${data.playerCard?.positionY ?? 42}%`, '--card-photo-saturation': data.playerCard?.saturation ?? DEFAULT_CARD_APPEARANCE.saturation, '--card-photo-brightness': data.playerCard?.brightness ?? DEFAULT_CARD_APPEARANCE.brightness } as CSSProperties}>
        {data.playerCard?.photoDataUrl && <img className="player-card__photo" src={data.playerCard.photoDataUrl} alt="Oyuncu kartı fotoğrafı" />}
        <div className="player-card__head"><div><span className="muted-label">OYUNCU KARTI</span><h2>{data.profile?.position}</h2></div><span className="level-badge">🥉 Lv.{level} Çaylak</span></div>
        <div className="rating-row">
          <span><b>{weekDays.filter((day) => day.active).length}</b><small>AKTİF GÜN</small></span>
          <span><b>{data.sessions.length}</b><small>TOPLAM SEANS</small></span>
          <span className="xp-block"><b>{totalXp}</b><small>XP</small></span>
        </div>
        <div className="xp-track"><span style={{ width: `${(levelProgress / 150) * 100}%` }} /></div>
        <p className="xp-caption">Sonraki seviye için {150 - levelProgress} XP kaldı</p>
      </section>
      <section className="section-head"><div><p className="eyebrow">BUGÜN · {new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(new Date())}</p><h2>Bugünün rotası</h2></div><span className="streak">🔥 {streak} gün</span></section>
      <button className="route-card" onClick={() => openAction('gym')}><span className="route-icon">🏋️</span><span className="route-copy"><b>Kuvvet antrenmanı</b><small>{todaySessions.length ? 'Çalışmanı kaydet veya hareketlerini ekle' : 'Hareketlerini ve setlerini kaydet'}</small></span><span className="route-arrow">›</span></button>
      <div className="quick-actions">{ACTIONS.slice(0, 4).map((action) => <button key={action.kind} onClick={() => openAction(action.kind)}><span>{action.icon}</span><small>{action.label.replace('+ ', '')}</small></button>)}</div>
      <section className="card momentum"><div className="section-head compact"><div><p className="eyebrow">BU HAFTAKİ MOMENTUM</p><h2>{new Set(data.sessions.filter((session) => session.date >= weekStart && session.date <= weekEnd).map((session) => session.date)).size}/5 seans</h2></div><span>⚡</span></div><div className="week-row">{weekDays.map((day) => <div key={day.key} className="week-day"><span>{day.label}</span><i className={day.active ? 'done' : ''}>{day.active ? '✓' : '·'}</i></div>)}</div></section>
      <section className="card goals"><div className="section-head compact"><div><p className="eyebrow">BUGÜNÜN HEDEFLERİ</p><h2>{todayGoals.length}/{GOALS.length}</h2></div><span>🎯</span></div>{GOALS.map((goal) => <label key={goal.id} className="goal-row"><input type="checkbox" checked={todayGoals.includes(goal.id)} onChange={() => toggleGoal(goal.id)} /><span><b>{goal.title}</b><small>{goal.detail}</small></span></label>)}</section>
      <section className="card recent"><div className="section-head compact"><div><p className="eyebrow">SON KAYITLAR</p><h2>Gelişimin</h2></div><button className="text-button" onClick={() => setTab('calendar')}>Tümünü gör</button></div>{data.sessions.slice(0, 3).map((session) => <SessionRow key={session.id} session={session} />)}{!data.sessions.length && <p className="empty-copy">İlk antrenmanını kaydet, gelişimin burada görünsün.</p>}</section>
    </>
  );

  const renderCalendar = () => (
    <><header className="topbar"><div><p className="eyebrow">TAKVİM</p><h1>Antrenman günlüğü</h1></div><span className="streak">🔥 {streak} gün</span></header><WeeklyPlanner items={data.weeklyPlan ?? []} onAdd={addPlanItem} onDelete={deletePlanItem} onStart={startPlanItem} /><section className="card momentum"><p className="eyebrow">BU HAFTA</p><h2>{weekDays.filter((day) => day.active).length} aktif gün</h2><div className="week-row">{weekDays.map((day) => <div key={day.key} className="week-day"><span>{day.label}</span><i className={day.active ? 'done' : ''}>{day.active ? '✓' : '·'}</i></div>)}</div></section><section className="card recent"><div className="section-head compact"><div><p className="eyebrow">KAYIT ARŞİVİ</p><h2>{data.sessions.length} çalışma</h2></div><button className="text-button" onClick={() => setSheetOpen(true)}>+ Ekle</button></div>{data.sessions.length ? data.sessions.map((session) => <SessionRow key={session.id} session={session} />) : <p className="empty-copy">Henüz kayıt yok. İlk çalışmanı ekle.</p>}</section></>
  );

  const renderStats = () => (
    <>
      <header className="topbar"><div><p className="eyebrow">İSTATİSTİK</p><h1>Gelişim özeti</h1></div><span className="level-badge">Lv.{level}</span></header>
      <div className="segmented-control" role="tablist" aria-label="İstatistik görünümü">
        {([
          ['overview', 'Genel'], ['muscles', 'Kas yükü'], ['tests', 'Testler'],
          ['drills', 'Drill'], ['exercises', 'Hareket'], ['gps', 'GPS'], ['achievements', 'Rozetler'], ['comparison', 'Hafta'],
        ] as const).map(([view, label]) => <button key={view} role="tab" aria-selected={statsView === view} className={statsView === view ? 'active' : ''} onClick={() => setStatsView(view)}>{label}</button>)}
      </div>
      {statsView === 'muscles' ? (
        <MuscleAnalysis sessions={data.sessions} weekStart={weekStart} onAddGym={() => openAction('gym')} />
      ) : statsView === 'tests' ? (
        <PerformanceTests records={data.skillTests ?? []} onSave={saveSkillTest} />
      ) : statsView === 'drills' ? (
        <DrillLibrary onUse={startDrill} customDrills={data.customDrills ?? []} onSaveCustom={saveCustomDrill} onDeleteCustom={deleteCustomDrill} />
      ) : statsView === 'exercises' ? (
        <ExerciseVisualLibrary onChoose={startExercise} />
      ) : statsView === 'gps' ? (
        <GpsActivityLibrary activities={data.gpsActivities ?? []} onImport={importGpsActivity} onDelete={deleteGpsActivity} />
      ) : statsView === 'achievements' ? (
        <ProgressAchievements data={data} weekStart={weekStart} onAddGoal={addCustomGoal} onDeleteGoal={deleteCustomGoal} />
      ) : statsView === 'comparison' ? (
        <WeeklyComparison data={data} />
      ) : (
        <>
          <div className="stats-grid"><StatCard icon="⚡" value={String(totalXp)} label="Toplam XP" /><StatCard icon="📅" value={String(data.sessions.length)} label="Toplam seans" /><StatCard icon="🔥" value={String(streak)} label="Seri günü" /><StatCard icon="⏱️" value={`${data.sessions.reduce((sum, session) => sum + session.minutes, 0)}′`} label="Toplam süre" /></div>
          <section className="card"><p className="eyebrow">ÇALIŞMA DAĞILIMI</p><h2>Seans türleri</h2>{ACTIONS.map((action) => { const count = data.sessions.filter((session) => session.kind === action.kind).length; return <div key={action.kind} className="bar-row"><span>{action.icon} {action.label.replace('+ ', '')}</span><div className="bar"><i style={{ width: `${data.sessions.length ? Math.min(100, (count / data.sessions.length) * 100) : 0}%` }} /></div><b>{count}</b></div>; })}</section>
          <section className="card"><div className="section-head compact"><div><p className="eyebrow">KUVVET DETAYI</p><h2>Kas gruplarını incele</h2></div><span>💪</span></div><p className="empty-copy">Hareket, set, tekrar, ağırlık ve algılanan efor bilgilerini kaydedip haftalık tahmini kas yükünü gör.</p><button className="secondary-button full-button" onClick={() => setStatsView('muscles')}>Kas yükü raporunu aç</button></section>
          <div className="feature-shortcuts"><button onClick={() => setStatsView('drills')}><span>⚽</span><b>Görselli drill’ler</b><small>Saha çizimleriyle çalışma seç</small></button><button onClick={() => setStatsView('exercises')}><span>💪</span><b>Hareket galerisi</b><small>Kas grubuna göre ara</small></button><button onClick={() => setStatsView('gps')}><span>⌁</span><b>GPS rotaları</b><small>GPX içe aktar ve haritada gör</small></button><button onClick={() => setStatsView('achievements')}><span>✦</span><b>İlerleme & hedefler</b><small>Kişisel kilometre taşları</small></button><button onClick={() => setStatsView('comparison')}><span>↔</span><b>Hafta kıyasla</b><small>Eşit gün aralıklarını karşılaştır</small></button></div>
        </>
      )}
    </>
  );

  const renderSettings = () => (
    <><header className="topbar"><div><p className="eyebrow">HESAP & VERİ</p><h1>Ayarlar</h1></div><span className="avatar">{data.profile?.name.slice(0, 1).toUpperCase()}</span></header><section className="card settings-card"><p className="eyebrow">PROFİL</p><h2>{data.profile?.name}</h2><p className="empty-copy">{data.profile?.position} · Baskın ayak {data.profile?.dominantFoot}</p><button className="secondary-button" onClick={() => { setProfileName(data.profile?.name ?? ''); setTab('home'); setToast('Profil düzenleme yakında.'); }}>Profili düzenle</button></section><PlayerCardEditor profile={data.profile!} appearance={data.playerCard} stats={{ sessions: data.sessions.length, xp: totalXp, level }} onSave={saveCardAppearance} /><section className="card settings-card"><p className="eyebrow">VERİLERİN SANA AİT</p><h2>Yedekle ve dışa aktar</h2><p className="empty-copy">Kayıtların yalnızca bu cihazda saklanır. İstediğinde JSON veya CSV yedeği alabilirsin.</p><p className="field-help">Sesli notlar cihazdaki ayrı yerel depoda kalır ve JSON / CSV dosyasına dahil edilmez.</p><div className="settings-actions"><button className="primary-button" onClick={() => exportJson(data)}>JSON yedeği al</button><button className="secondary-button" onClick={() => exportSessionsCsv(data)}>Antrenman CSV indir</button></div></section><section className="card settings-card"><p className="eyebrow">GİZLİLİK</p><h2>Hesap gerekmez</h2><p className="empty-copy">Profilin ve antrenmanların bu tarayıcıda kalır; bir sunucuya gönderilmez.</p><button className="danger-button" onClick={resetProfile}>Profili ve verileri sil</button></section><p className="version-copy">HBK Spor · Kaynak yeniden oluşturma prototipi v0.2.0</p></>
  );

  if (!data.profile) {
    return (
      <main className="welcome-screen">
        <div className="brand-mark">HBK<span>SPOR</span></div><p className="eyebrow">FUTBOL PERFORMANS GÜNLÜĞÜ</p><h1>Hoş geldin,<br /><em>Sporcu!</em></h1><p className="welcome-copy">Antrenmanını kaydet. Gelişimini takip et. Kendi ritmini kur.</p>
        {!showProfileForm ? (
          <>
            <button className="primary-button welcome-cta" onClick={() => setShowProfileForm(true)}>Profilimi oluştur</button>
            <button className="demo-link" onClick={startDemo}>Önce demo ile keşfet →</button>
          </>
        ) : (
          <>
            <ProfileForm name={profileName} setName={setProfileName} position={position} setPosition={setPosition} foot={foot} setFoot={setFoot} onSave={createProfile} />
            <button className="demo-link" onClick={() => setShowProfileForm(false)}>← Geri dön</button>
          </>
        )}
        <p className="privacy-note">Verilerin yalnızca bu cihazda saklanır. Hesap gerekmez.</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <main className="page-content" id="main-content">
        {tab === 'home' && renderHome()}
        {tab === 'calendar' && renderCalendar()}
        {tab === 'stats' && renderStats()}
        {tab === 'settings' && renderSettings()}
      </main>
      <nav className="bottom-nav" aria-label="Ana gezinme">
        <button className={tab === 'home' ? 'selected' : ''} onClick={() => setTab('home')}><span>⌂</span><small>Ana sayfa</small></button>
        <button className={tab === 'calendar' ? 'selected' : ''} onClick={() => setTab('calendar')}><span>▦</span><small>Takvim</small></button>
        <button className="fab" aria-label="Yeni kayıt ekle" onClick={() => setSheetOpen(true)}>＋</button>
        <button className={tab === 'stats' ? 'selected' : ''} onClick={() => setTab('stats')}><span>▥</span><small>İstatistik</small></button>
        <button className={tab === 'settings' ? 'selected' : ''} onClick={() => setTab('settings')}><span>⚙</span><small>Ayarlar</small></button>
      </nav>
      {sheetOpen && <div className="scrim" onMouseDown={() => setSheetOpen(false)}><section className="action-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="section-head compact"><div><p className="eyebrow">YENİ KAYIT</p><h2 id="sheet-title">Bugün ne yaptın?</h2></div><button className="close-button" aria-label="Kapat" onClick={() => setSheetOpen(false)}>×</button></div><div className="action-list">{ACTIONS.map((action) => <button key={action.kind} onClick={() => openAction(action.kind)}><span className="action-icon">{action.icon}</span><span><b>{action.label}</b><small>{action.hint}</small></span><span className="route-arrow">›</span></button>)}</div></section></div>}
      {activeKind && <div className="scrim" onMouseDown={() => { setActiveKind(null); setActivePlanId(null); setRestRemaining(null); }}><section className="session-modal" role="dialog" aria-modal="true" aria-labelledby="session-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="section-head compact"><div><p className="eyebrow">{LABELS[activeKind].toUpperCase()} KAYDI</p><h2 id="session-title">Çalışmanı kaydet</h2></div><button className="close-button" aria-label="Kapat" onClick={() => { setActiveKind(null); setActivePlanId(null); setRestRemaining(null); }}>×</button></div>
        <label className="field-label">Çalışma adı<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} /></label>
        {activeKind === 'match' && <><label className="field-label">Skor<input value={score} onChange={(event) => setScore(event.target.value)} placeholder="2-1" /></label><section className="match-event-editor"><div className="section-head compact"><div><p className="eyebrow">MAÇ RAPORU</p><h2>Olay zaman çizelgesi</h2></div><span>⚽</span></div><p className="field-help">Gol, asist, kart ve değişiklikleri gerçekleştiği dakikayla ekle. Bu alanlar oyuncu notudur; takım istatistiği yerine geçmez.</p><div className="match-event-form"><label className="field-label">Dakika<input aria-label="Olay dakikası" type="number" min="0" max="150" value={matchEventMinute} onChange={(event) => setMatchEventMinute(event.target.value)} placeholder="45" /></label><label className="field-label">Olay<select aria-label="Maç olayı" value={matchEventType} onChange={(event) => setMatchEventType(event.target.value as MatchEventType)}>{Object.entries(MATCH_EVENT_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label></div><label className="field-label">Oyuncu / kısa not<input aria-label="Olay ayrıntısı" value={matchEventDetail} onChange={(event) => setMatchEventDetail(event.target.value)} maxLength={100} placeholder="Örn. asist: Deniz" /></label><button type="button" className="secondary-button full-button" onClick={addMatchEvent}>+ Maç olayını ekle</button>{matchEvents.length > 0 && <ol className="match-event-list">{matchEvents.map((event) => <li key={event.id}><time>{event.minute}′</time><span><b>{MATCH_EVENT_LABELS[event.type]}</b>{event.detail && <small>{event.detail}</small>}</span><button type="button" className="remove-exercise" aria-label={`${event.minute}. dakika olayını kaldır`} onClick={() => setMatchEvents((current) => current.filter((item) => item.id !== event.id))}>×</button></li>)}</ol>}</section></>}
        <label className="field-label">Süre (dakika)<input type="number" min="0" max="600" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label>
        {(activeKind === 'gym' || activeKind === 'pitch') && <section className="template-tools"><div className="section-head compact"><div><p className="eyebrow">HIZLI BAŞLAT</p><h2>Şablonlar</h2></div><span>⚡</span></div>{activeKind === 'gym' && data.sessions.some((session) => session.kind === 'gym' && session.exercises?.length) && <button type="button" className="secondary-button full-button" onClick={copyLastGymWorkout}>Son gym antrenmanını kopyala</button>}{(data.workoutTemplates ?? []).filter((template) => template.kind === activeKind).map((template) => <div className="template-row" key={template.id}><button type="button" className="template-apply" onClick={() => applyTemplate(template)}><b>{template.name}</b><small>{template.minutes} dk · {template.exercises?.length ?? 0} hareket</small></button><button type="button" className="remove-exercise" aria-label={`${template.name} şablonunu sil`} onClick={() => deleteWorkoutTemplate(template.id)}>×</button></div>)}<label className="field-label">Bu kaydı şablon olarak sakla<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} maxLength={48} placeholder={title || 'Şablon adı'} /></label><button type="button" className="secondary-button full-button" onClick={saveWorkoutTemplate}>Şablonu kaydet</button></section>}
        {activeKind === 'gym' && <ExerciseLogger draft={exerciseDraft} setDraft={setExerciseDraft} setDraftValue={setDraft} setSetDraft={setSetDraft} pendingSets={pendingSets} onAddSet={addSet} onRemoveSet={(id) => setPendingSets((current) => current.filter((set) => set.id !== id))} entries={loggedExercises} onAdd={addExercise} onRemove={(id) => setLoggedExercises((current) => current.filter((entry) => entry.id !== id))} />}
        {activeKind === 'gym' && restRemaining !== null && <div className="rest-timer" role="status" aria-live="polite"><div><small>SET ARASI DİNLENME</small><strong>{Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, '0')}</strong></div><button type="button" className="secondary-button" onClick={() => setRestRemaining(null)}>Durdur</button></div>}
        <VoiceNoteRecorder onReady={setVoiceNoteBlob} onRecordingChange={setVoiceRecording} />
        <label className="field-label">Not<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Nasıl geçti?" /></label><button className="primary-button full-button" disabled={voiceRecording} onClick={saveSession}>{voiceRecording ? 'Önce ses kaydını bitir' : 'Kaydı tamamla'}</button>
      </section></div>}
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  );
}

function ExerciseLogger({ draft, setDraft, setDraftValue, setSetDraft, pendingSets, onAddSet, onRemoveSet, entries, onAdd, onRemove }: { draft: ExerciseDraft; setDraft: (draft: ExerciseDraft) => void; setDraftValue: SetDraft; setSetDraft: (draft: SetDraft) => void; pendingSets: ExerciseSet[]; onAddSet: () => void; onRemoveSet: (id: string) => void; entries: LoggedExercise[]; onAdd: () => void; onRemove: (id: string) => void }) {
  return (
    <section className="exercise-logger" aria-labelledby="exercise-logger-title">
      <div className="section-head compact"><div><p className="eyebrow">KAS YÜKÜ TAKİBİ</p><h2 id="exercise-logger-title">Hareket ekle</h2></div><span>🏋️</span></div>
      <p className="field-help">Her seti ayrı kaydet. Böylece tekrar, ağırlık, dinlenme ve efor setten sete değişebilir.</p>
      <label className="field-label">Hareket<select value={draft.exerciseId} disabled={pendingSets.length > 0} onChange={(event) => setDraft({ exerciseId: event.target.value })}>{EXERCISE_LIBRARY.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label>
      {pendingSets.length > 0 && <p className="field-help">Hareketi değiştirmek için önce bu hareketi antrenman listesine ekle.</p>}
      <div className="exercise-input-grid">
        <label className="field-label">Tekrar<input type="number" min="1" max="100" step="1" value={setDraftValue.reps} onChange={(event) => setSetDraft({ ...setDraftValue, reps: event.target.value })} /></label>
        <label className="field-label">Ağırlık (kg)<input type="number" min="0" max="500" step="0.5" value={setDraftValue.weightKg} onChange={(event) => setSetDraft({ ...setDraftValue, weightKg: event.target.value })} /></label>
        <label className="field-label">Efor (RPE)<select value={setDraftValue.rpe} onChange={(event) => setSetDraft({ ...setDraftValue, rpe: event.target.value })}>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} / 10</option>)}</select></label>
        <label className="field-label">Dinlenme (sn)<input type="number" min="0" max="600" step="5" value={setDraftValue.restSeconds} onChange={(event) => setSetDraft({ ...setDraftValue, restSeconds: event.target.value })} /></label>
      </div>
      <p className="field-help">RPE: 1 çok hafif, 10 verebileceğin en yüksek efor. Ağrıyı puanlama. Ağırlıksız harekette 0 kg bırak.</p>
      <button type="button" className="secondary-button full-button" onClick={onAddSet}>＋ Seti ekle{pendingSets.length ? ` (${pendingSets.length + 1}. set)` : ''}</button>
      {pendingSets.length > 0 && <div className="pending-sets" aria-label="Hareketin setleri"><b>{EXERCISE_LIBRARY.find((exercise) => exercise.id === draft.exerciseId)?.name} · {pendingSets.length} set</b>{pendingSets.map((set, index) => <div className="pending-set-row" key={set.id}><span>Set {index + 1}: {set.reps} tekrar · {set.weightKg ? `${numberFormat(set.weightKg)} kg` : '0 kg'} · RPE {set.rpe} · {set.restSeconds} sn dinlenme</span><button type="button" className="remove-exercise" aria-label={`${index + 1}. seti kaldır`} onClick={() => onRemoveSet(set.id)}>×</button></div>)}<button type="button" className="primary-button full-button" onClick={onAdd}>Hareketi antrenmana ekle</button></div>}
      <p className="field-help">Kas eşleştirmeleri tahminidir. Ana kas için 1 set, yardımcı kas için 0,5 set sayılır.</p>
      {entries.length > 0 && <ul className="exercise-entry-list" aria-label="Antrenmana eklenen hareketler">{entries.map((entry) => <li key={entry.id}><div><b>{entry.name}</b><small>{formatSetDetails(entry)} · ortalama RPE {numberFormat(getExerciseAverageRpe(entry))}</small><small>{formatMuscleNames(entry.primaryMuscles)} · yardımcı: {formatMuscleNames(entry.secondaryMuscles)}</small></div><button type="button" className="remove-exercise" aria-label={`${entry.name} hareketini kaldır`} onClick={() => onRemove(entry.id)}>×</button></li>)}</ul>}
    </section>
  );
}

function MuscleAnalysis({ sessions, weekStart, onAddGym }: { sessions: TrainingSession[]; weekStart: string; onAddGym: () => void }) {
  const [weeks, setWeeks] = useState<1 | 4 | 12>(4);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const today = localDateKey();
  const rangeStart = shiftLocalDate(weekStart, -(weeks - 1) * 7);
  const summaries = summarizeMuscleWorkload(sessions, rangeStart, today);
  const maxSets = Math.max(1, ...summaries.map((item) => item.effectiveSets));
  const rangeSessions = sessions.filter((session) => session.date >= rangeStart && session.date <= today);
  const exerciseRecords = rangeSessions.flatMap((session) => (session.exercises ?? []).map((exercise) => ({ session, exercise })))
    .sort((a, b) => a.session.date.localeCompare(b.session.date));
  const averageRpe = exerciseRecords.length
    ? exerciseRecords.reduce((sum, item) => sum + getExerciseAverageRpe(item.exercise), 0) / exerciseRecords.length
    : null;
  const totalEffectiveSets = summaries.reduce((sum, item) => sum + item.effectiveSets, 0);
  const selectedExercise = exerciseRecords.some((record) => record.exercise.exerciseId === selectedExerciseId)
    ? selectedExerciseId
    : exerciseRecords[0]?.exercise.exerciseId ?? '';
  const filteredRecords = selectedMuscle
    ? exerciseRecords.filter(({ exercise }) => exercise.primaryMuscles.includes(selectedMuscle) || exercise.secondaryMuscles.includes(selectedMuscle))
    : exerciseRecords;

  return (
    <>
      <header className="muscle-report-header"><p className="eyebrow">KUVVET YÜKÜ</p><h2>{shortDate(rangeStart)} – {shortDate(today)}</h2><p className="empty-copy">Gym hareketlerinden hesaplanır. Saha ve maç yükleri bu rapora dahil değildir.</p></header>
      <div className="period-picker" role="group" aria-label="Rapor dönemi">{([1, 4, 12] as const).map((value) => <button key={value} className={weeks === value ? 'active' : ''} aria-pressed={weeks === value} onClick={() => setWeeks(value)}>{value === 1 ? '1 hafta' : `${value} hafta`}</button>)}</div>
      <div className="stats-grid"><StatCard icon="💪" value={numberFormat(totalEffectiveSets)} label="Kas-set eşdeğeri" /><StatCard icon="🧠" value={averageRpe === null ? '—' : `${numberFormat(averageRpe)} / 10`} label="Kendi bildirdiğin efor" /></div>
      <section className="card"><div className="section-head compact"><div><p className="eyebrow">VÜCUT HARİTASI</p><h2>Çalışan bölgeler</h2></div><span>🧍</span></div><MuscleBodyMap summaries={summaries} selected={selectedMuscle} onSelect={setSelectedMuscle} /><p className="field-help">Renk yoğunluğu, seçili dönemdeki tahmini kas-set eşdeğerini gösterir. Bir bölgeye dokunarak hareketlerini filtrele.</p></section>
      <section className="card muscle-load-card"><div className="section-head compact"><div><p className="eyebrow">KAS GRUBUNA GÖRE</p><h2>{selectedMuscle ? MUSCLE_LABELS[selectedMuscle] : 'Kas yükü dağılımı'}</h2></div><span>📊</span></div>
        {totalEffectiveSets === 0 ? <div className="empty-muscle"><p className="empty-copy">Bu dönemde henüz hareket/set detayı yok. Bir Gym kaydına hareket eklediğinde kas yükü burada görünür.</p><button className="primary-button full-button" onClick={onAddGym}>Gym hareketi kaydet</button></div> : <div className="muscle-list">{summaries.map((item) => <MuscleLoadRow key={item.muscle} muscle={item.muscle} sets={item.effectiveSets} maxSets={maxSets} rpe={item.weightedRpe} movementCount={item.movementCount} selected={selectedMuscle === item.muscle} onClick={() => setSelectedMuscle((current) => current === item.muscle ? null : item.muscle)} />)}</div>}
      </section>
      <TrainingHeatmap sessions={rangeSessions} rangeStart={rangeStart} weeks={weeks} />
      <ExerciseProgressChart records={exerciseRecords} selectedExerciseId={selectedExercise} onSelect={setSelectedExerciseId} />
      <section className="card movement-details"><div className="section-head compact"><div><p className="eyebrow">HAREKET GEÇMİŞİ</p><h2>{filteredRecords.length} hareket kaydı</h2></div>{selectedMuscle && <button className="text-button" onClick={() => setSelectedMuscle(null)}>Filtreyi kaldır</button>}</div>
        {filteredRecords.length ? <ul className="movement-history">{[...filteredRecords].reverse().map(({ session, exercise }) => <li key={`${session.id}-${exercise.id}`}><div className="movement-history__top"><b>{exercise.name}</b><time dateTime={session.date}>{shortDate(session.date)}</time></div><p>{formatSetDetails(exercise)}</p><p>{formatMuscleNames(exercise.primaryMuscles)} <span>· yardımcı: {formatMuscleNames(exercise.secondaryMuscles)}</span></p><div className="movement-history__foot"><span>{getExerciseTonnage(exercise) > 0 ? `${numberFormat(getExerciseTonnage(exercise), 0)} kg·tekrar dış yük hacmi` : 'Dış yük hacmi kaydedilmedi'}</span><span>Algılanan efor: RPE {numberFormat(getExerciseAverageRpe(exercise))}/10</span></div>{exercise.setDetails?.length ? <details className="set-breakdown"><summary>Set ayrıntılarını göster</summary>{exercise.setDetails.map((set, index) => <p key={set.id}>Set {index + 1}: {set.reps} tekrar · {set.weightKg} kg · RPE {set.rpe} · {set.restSeconds} sn dinlenme</p>)}</details> : <p className="field-help">Bu eski kayıtta set başına ayrıntı bulunmuyor.</p>}</li>)}</ul> : <p className="empty-copy">{selectedMuscle ? `${MUSCLE_LABELS[selectedMuscle]} için bu dönemde kayıtlı hareket yok.` : 'Ağırlıksız hareketler de set sayısı olarak rapora girer; ilk hareketini ekle.'}</p>}
      </section>
      <p className="analysis-disclaimer">Bu rapor fizyolojik yorgunluğu veya sakatlık riskini ölçmez. Kas eşleştirmeleri ve etkin setler yaklaşık antrenman planlama göstergeleridir; RPE ise senin 1–10 arası öznel efor puanındır. Ağrı veya olağandışı yorgunluk varsa antrenmanı bırakıp uzman görüşü al.</p>
    </>
  );
}

function MuscleLoadRow({ muscle, sets, maxSets, rpe, movementCount, selected, onClick }: { muscle: MuscleGroup; sets: number; maxSets: number; rpe: number | null; movementCount: number; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`muscle-load-row muscle-load-row-button ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={onClick}>
      <span className="muscle-load-row__top"><b>{MUSCLE_LABELS[muscle]}</b><span>{numberFormat(sets)} etkin set</span></span>
      <span className="muscle-bar" role="progressbar" aria-label={`${MUSCLE_LABELS[muscle]} tahmini etkin set`} aria-valuemin={0} aria-valuemax={maxSets} aria-valuenow={sets}><i style={{ width: `${sets > 0 ? Math.max(2, (sets / maxSets) * 100) : 0}%` }} /></span>
      <small>{movementCount} hareket · {rpe === null ? 'RPE yok' : `ortalama RPE ${numberFormat(rpe)}`}</small>
    </button>
  );
}

function MuscleBodyMap({ summaries, selected, onSelect }: { summaries: ReturnType<typeof summarizeMuscleWorkload>; selected: MuscleGroup | null; onSelect: (muscle: MuscleGroup | null) => void }) {
  const values = new Map(summaries.map((item) => [item.muscle, item.effectiveSets]));
  const max = Math.max(1, ...summaries.map((item) => item.effectiveSets));
  const region = (muscle: MuscleGroup, shapes: React.ReactNode) => {
    const value = values.get(muscle) ?? 0;
    const active = selected === muscle;
    const opacity = value > 0 ? 0.24 + (value / max) * 0.72 : 0.14;
    const onKeyDown = (event: React.KeyboardEvent<SVGGElement>) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(active ? null : muscle); }
    };
    return <g key={muscle} className="body-map-region" role="button" tabIndex={0} aria-label={`${MUSCLE_LABELS[muscle]}, ${numberFormat(value)} kas-set eşdeğeri`} aria-pressed={active} onClick={() => onSelect(active ? null : muscle)} onKeyDown={onKeyDown} style={{ '--region-fill': `rgba(184,243,75,${opacity})`, '--region-stroke': active ? '#ffffff' : '#66805a' } as React.CSSProperties}>{shapes}</g>;
  };
  const regions: Record<MuscleGroup, React.ReactNode> = {
    chest: <><path d="M38 59 Q60 51 82 59 L78 81 Q60 87 42 81Z" /><path d="M37 60 Q28 57 25 67 L33 78 42 75Z" /><path d="M83 60 Q92 57 95 67 L87 78 78 75Z" /></>,
    back: <><path d="M39 58 Q60 51 81 58 L77 91 Q60 99 43 91Z" /><path d="M41 92 Q60 98 79 92 L76 111 44 111Z" /></>,
    shoulders: <><ellipse cx="37" cy="57" rx="11" ry="8" /><ellipse cx="83" cy="57" rx="11" ry="8" /></>,
    biceps: <><path d="M27 68 Q34 65 39 74 L35 96 28 94Z" /><path d="M93 68 Q86 65 81 74 L85 96 92 94Z" /></>,
    triceps: <><path d="M27 70 Q33 67 37 74 L34 98 28 96Z" /><path d="M93 70 Q87 67 83 74 L86 98 92 96Z" /></>,
    core: <><path d="M44 83 Q60 88 76 83 L74 113 Q60 119 46 113Z" /></>,
    quadriceps: <><path d="M43 117 L58 119 56 159 43 160Z" /><path d="M62 119 L77 117 77 160 64 159Z" /></>,
    hamstrings: <><path d="M43 119 L58 119 56 159 43 160Z" /><path d="M62 119 L77 119 77 160 64 160Z" /></>,
    glutes: <><path d="M43 96 Q60 102 77 96 L77 119 Q60 126 43 119Z" /></>,
    calves: <><path d="M44 164 L56 164 54 204 44 202Z" /><path d="M64 164 L76 164 76 202 66 204Z" /></>,
  };
  const renderFigure = (side: 'front' | 'back') => {
    const visible: MuscleGroup[] = side === 'front'
      ? ['shoulders', 'chest', 'biceps', 'core', 'quadriceps', 'calves']
      : ['shoulders', 'back', 'triceps', 'core', 'glutes', 'hamstrings', 'calves'];
    return <div className="body-map-panel" key={side}><b>{side === 'front' ? 'Ön' : 'Arka'}</b><svg viewBox="0 0 120 220" role="group" aria-label={`${side === 'front' ? 'Ön' : 'Arka'} vücut kas haritası`}><circle className="body-base" cx="60" cy="25" r="14" /><path className="body-base" d="M52 40 L68 40 72 49 91 53 99 69 92 101 81 111 79 120 83 160 78 211 64 211 60 169 56 211 42 211 37 160 41 120 39 111 28 101 21 69 29 53 48 49Z" />{visible.map((muscle) => region(muscle, regions[muscle]))}</svg></div>;
  };
  return <div className="body-map-wrap"><div className="body-map-figures">{renderFigure('front')}{renderFigure('back')}</div><div className="body-map-legend">{(Object.keys(MUSCLE_LABELS) as MuscleGroup[]).map((muscle) => <button type="button" key={muscle} className={selected === muscle ? 'active' : ''} onClick={() => onSelect(selected === muscle ? null : muscle)}>{MUSCLE_LABELS[muscle]} <b>{numberFormat(values.get(muscle) ?? 0)}</b></button>)}</div><p className="field-help">Rakamlar yaklaşık kas-set eşdeğeridir; kas büyümesi ölçümü değildir.</p></div>;
}

function TrainingHeatmap({ sessions, rangeStart, weeks }: { sessions: TrainingSession[]; rangeStart: string; weeks: 1 | 4 | 12 }) {
  const weekdays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const columns = Array.from({ length: weeks }, (_, week) => Array.from({ length: 7 }, (_, day) => shiftLocalDate(rangeStart, week * 7 + day)));
  const getDaySummary = (date: string) => {
    const onDay = sessions.filter((session) => session.date === date);
    const sets = onDay.reduce((sum, session) => sum + (session.exercises ?? []).reduce((exerciseSum, exercise) => exerciseSum + getExerciseSetCount(exercise), 0), 0);
    return { sessions: onDay.length, sets };
  };
  return <section className="card training-heatmap"><div className="section-head compact"><div><p className="eyebrow">RİTİM HARİTASI</p><h2>Antrenman günleri</h2></div><span>🗓️</span></div><div className="heatmap-grid" style={{ '--week-count': weeks } as React.CSSProperties}><span /><div className="heatmap-week-labels">{columns.map((_, index) => <small key={index}>{index + 1}</small>)}</div>{weekdays.map((weekday, dayIndex) => <div className="heatmap-row" key={weekday}><small>{weekday}</small>{columns.map((column) => { const date = column[dayIndex]; const summary = getDaySummary(date); const level = summary.sessions === 0 ? 0 : summary.sets >= 10 ? 3 : summary.sets >= 4 ? 2 : 1; return <span key={date} className={`heat-cell level-${level}`} title={`${date}: ${summary.sessions ? `${summary.sessions} seans, ${summary.sets} kaydedilmiş set` : 'kayıt yok'}`} aria-label={`${date}, ${summary.sessions ? `${summary.sessions} seans, ${summary.sets} set` : 'kayıt yok'}`} />; })}</div>)}</div><div className="heatmap-key"><span>Daha az</span><i className="level-0" /><i className="level-1" /><i className="level-2" /><i className="level-3" /><span>Daha çok kayıt</span></div></section>;
}

function ExerciseProgressChart({ records, selectedExerciseId, onSelect }: { records: Array<{ session: TrainingSession; exercise: LoggedExercise }>; selectedExerciseId: string; onSelect: (id: string) => void }) {
  const exercises = Array.from(new Map(records.map(({ exercise }) => [exercise.exerciseId, exercise.name])).entries());
  const points = records.filter(({ exercise }) => exercise.exerciseId === selectedExerciseId);
  const hasExternalLoad = points.some(({ exercise }) => getExerciseTonnage(exercise) > 0);
  const values = points.map(({ exercise }) => hasExternalLoad ? getExerciseTonnage(exercise) : getExerciseTotalReps(exercise));
  const maximum = Math.max(1, ...values);
  const minimum = Math.min(0, ...values);
  const viewWidth = 340;
  const viewHeight = 150;
  const padding = { left: 28, right: 12, top: 14, bottom: 30 };
  const innerWidth = viewWidth - padding.left - padding.right;
  const innerHeight = viewHeight - padding.top - padding.bottom;
  const coords = values.map((value, index) => ({
    x: points.length < 2 ? padding.left + innerWidth / 2 : padding.left + (index / (points.length - 1)) * innerWidth,
    y: padding.top + (1 - (value - minimum) / Math.max(maximum - minimum, 1)) * innerHeight,
    value,
  }));
  return <section className="card exercise-progress"><div className="section-head compact"><div><p className="eyebrow">HAREKET İLERLEMESİ</p><h2>Zaman içindeki kayıt</h2></div><span>📈</span></div>
    {exercises.length === 0 ? <p className="empty-copy">Bu dönemde grafik oluşturacak hareket kaydı yok.</p> : <><label className="field-label">Hareket<select value={selectedExerciseId} onChange={(event) => onSelect(event.target.value)}>{exercises.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label><p className="field-help">{hasExternalLoad ? 'Dikey değer: dış yük hacmi (kg × tekrar).' : 'Dikey değer: toplam tekrar; bu harekette dış yük girilmemiş.'}</p><svg className="progress-chart" viewBox={`0 0 ${viewWidth} ${viewHeight}`} role="img" aria-label={`${exercises.find(([id]) => id === selectedExerciseId)?.[1] ?? 'Hareket'} ilerleme grafiği`}><line x1={padding.left} y1={padding.top + innerHeight} x2={viewWidth - padding.right} y2={padding.top + innerHeight} /><line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerHeight} />{coords.length > 1 && <polyline points={coords.map((point) => `${point.x},${point.y}`).join(' ')} />}{coords.map((point, index) => <g key={`${points[index].session.id}-${index}`}><circle cx={point.x} cy={point.y} r="4" /><title>{shortDate(points[index].session.date)}: {numberFormat(point.value, 0)}</title></g>)}<text x={padding.left} y={viewHeight - 6}>{points[0] ? shortDate(points[0].session.date) : ''}</text><text x={viewWidth - padding.right} y={viewHeight - 6} textAnchor="end">{points.length ? shortDate(points[points.length - 1].session.date) : ''}</text></svg><ol className="progress-values">{points.map(({ session, exercise }, index) => <li key={`${session.id}-${exercise.id}`}>{shortDate(session.date)} <b>{numberFormat(values[index], 0)} {hasExternalLoad ? 'kg·tekrar' : 'tekrar'}</b></li>)}</ol></>}
  </section>;
}

function formatMuscleNames(muscles: MuscleGroup[]): string {
  return muscles.length ? muscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ') : 'Eşleşme yok';
}

function ProfileForm(props: { name: string; setName: (value: string) => void; position: string; setPosition: (value: string) => void; foot: 'Sağ' | 'Sol'; setFoot: (value: 'Sağ' | 'Sol') => void; onSave: () => void }) {
  return <form className="profile-form" onSubmit={(event) => { event.preventDefault(); props.onSave(); }}><label className="field-label">Ad soyad<input required value={props.name} onChange={(event) => props.setName(event.target.value)} placeholder="Örn. Deniz Yılmaz" autoComplete="name" /></label><div className="form-grid"><label className="field-label">Mevki<select value={props.position} onChange={(event) => props.setPosition(event.target.value)}>{['Kaleci', 'Defans', 'Orta saha', 'Kanat', 'Forvet'].map((option) => <option key={option}>{option}</option>)}</select></label><label className="field-label">Baskın ayak<select value={props.foot} onChange={(event) => props.setFoot(event.target.value as 'Sağ' | 'Sol')}><option>Sağ</option><option>Sol</option></select></label></div><button className="primary-button full-button" type="submit" disabled={!props.name.trim()}>Profilimi kaydet →</button></form>;
}

function SessionRow({ session }: { session: TrainingSession }) {
  const icon: Record<SessionKind, string> = { gym: '🏋️', pitch: '⚽', match: '🏟️', gps: '🏃', timer: '⏱️', recovery: '🧘', rest: '🌙' };
  const exerciseCount = session.exercises?.length ?? 0;
  return <div className="session-row"><span className="session-icon">{icon[session.kind]}</span><span className="session-info"><b>{session.title}</b><small>{LABELS[session.kind]} · {shortDate(session.date)}{session.minutes ? ` · ${session.minutes} dk` : ''}{session.score ? ` · ${session.score}` : ''}{exerciseCount ? ` · ${exerciseCount} hareket` : ''}</small>{session.matchEvents?.length ? <ol className="session-event-timeline">{[...session.matchEvents].sort((a, b) => a.minute - b.minute).map((event) => <li key={event.id}><time>{event.minute}′</time><span>{MATCH_EVENT_LABELS[event.type]}{event.detail ? ` · ${event.detail}` : ''}</span></li>)}</ol> : null}{session.voiceNoteId && <VoiceNotePlayback id={session.voiceNoteId} />}</span><span className="session-xp">+{session.xp} XP</span></div>;
}

function PerformanceTests({ records, onSave }: { records: SkillTestRecord[]; onSave: (record: Omit<SkillTestRecord, 'id' | 'date'>) => void }) {
  const [testId, setTestId] = useState<(typeof SKILL_TEST_TEMPLATES)[number]['id']>(SKILL_TEST_TEMPLATES[0].id);
  const [value, setValue] = useState('');
  const test = SKILL_TEST_TEMPLATES.find((item) => item.id === testId) ?? SKILL_TEST_TEMPLATES[0];
  const history = records.filter((record) => record.testId === test.id).sort((a, b) => a.date.localeCompare(b.date));
  const best = history.reduce<SkillTestRecord | null>((selected, record) => !selected || (test.lowerIsBetter ? record.value < selected.value : record.value > selected.value) ? record : selected, null);
  const add = () => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > 100_000) return;
    onSave({ testId: test.id, name: test.name, category: test.category, unit: test.unit, lowerIsBetter: test.lowerIsBetter, value: numericValue });
    setValue('');
  };
  return <div className="test-workspace"><section className="card"><div className="section-head compact"><div><p className="eyebrow">PERFORMANS TESTLERİ</p><h2>Sonuç ekle</h2></div><span>📈</span></div><p className="field-help">Aynı testin geçmişini kıyasla. Süre testlerinde düşük, mesafe/yükseklik testlerinde yüksek değer kişisel en iyi olarak gösterilir.</p><label className="field-label">Test şablonu<select value={testId} onChange={(event) => setTestId(event.target.value as typeof testId)}>{SKILL_TEST_TEMPLATES.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.category}</option>)}</select></label><label className="field-label">Sonuç ({test.unit})<input aria-label={`Sonuç (${test.unit})`} type="number" min="0.01" max="100000" step="any" value={value} onChange={(event) => setValue(event.target.value)} placeholder={test.unit === 'sn' ? 'Örn. 3.42' : 'Sonucu gir'} /></label><button className="primary-button full-button" type="button" onClick={add} disabled={!value || !Number.isFinite(Number(value)) || Number(value) <= 0}>Bugünkü sonucu kaydet</button></section><section className="card test-history"><div className="section-head compact"><div><p className="eyebrow">{test.category.toUpperCase()} · TREND</p><h2>{test.name}</h2></div><span>🎯</span></div><div className="test-best"><span>Kişisel en iyi</span><b>{best ? `${numberFormat(best.value, 2)} ${test.unit}` : '—'}</b><small>{best ? shortDate(best.date) : 'Henüz sonuç yok'}</small></div>{history.length ? <ol className="test-history-list">{[...history].reverse().slice(0, 12).map((record) => <li key={record.id}><time>{shortDate(record.date)}</time><b>{numberFormat(record.value, 2)} {record.unit}</b>{record.id === best?.id && <span>En iyi</span>}</li>)}</ol> : <p className="empty-copy">İlk test sonucunu eklediğinde geçmiş burada birikir.</p>}</section><p className="analysis-disclaimer">Bu kayıtlar yalnızca senin girdiğin sonuçları gösterir. Test koşulları ve ölçüm yöntemi değişebileceğinden, farklı protokollerdeki sonuçlar doğrudan kıyaslanmamalıdır.</p></div>;
}

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return <article className="stat-card"><span>{icon}</span><b>{value}</b><small>{label}</small></article>;
}
