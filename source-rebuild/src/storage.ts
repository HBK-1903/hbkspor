import type { AppData } from './types';

export const STORAGE_KEY = 'hbk_spor_rebuild_v1';
export const LAST_BACKUP_KEY = 'hbk_spor_last_backup_export_v1';

export const DEFAULT_NOTIFICATION_PREFERENCES: NonNullable<AppData['notificationPreferences']> = { enabled: false, planReminders: true, leadMinutes: 30, dailyReminder: false, dailyTime: '18:00', weeklySummary: false };
const EMPTY_DATA: AppData = { profile: null, sessions: [], completedGoals: [], goalCompletions: {}, workoutTemplates: [], skillTests: [], gpsActivities: [], weeklyPlan: [], customGoals: [], customDrills: [], notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES, notificationSentKeys: [] };

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_DATA, sessions: [], completedGoals: [], goalCompletions: {} };
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    const legacyDemo = parsed.profile?.name === 'Yıldız'
      && sessions.some((session) => session.title === 'İlk saha çalışmam' && session.note === 'Demo antrenmanı');
    const completions = parsed.goalCompletions && typeof parsed.goalCompletions === 'object'
      ? Object.fromEntries(Object.entries(parsed.goalCompletions).filter(([, ids]) => Array.isArray(ids))) as Record<string, string[]>
      : {};
    const preferences = parsed.notificationPreferences;
    const leadMinutes = [0, 15, 30, 60].includes(Number(preferences?.leadMinutes)) ? Number(preferences?.leadMinutes) as 0 | 15 | 30 | 60 : DEFAULT_NOTIFICATION_PREFERENCES.leadMinutes;
    const notificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(preferences && typeof preferences === 'object' ? preferences : {}),
      leadMinutes,
      dailyTime: typeof preferences?.dailyTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(preferences.dailyTime) ? preferences.dailyTime : DEFAULT_NOTIFICATION_PREFERENCES.dailyTime,
    };
    return {
      profile: parsed.profile ?? null,
      demoMode: parsed.demoMode === true || legacyDemo,
      sessions,
      // Retained for compatibility with earlier reconstruction data. Current
      // daily check-offs live in goalCompletions, keyed by local date.
      completedGoals: Array.isArray(parsed.completedGoals) ? parsed.completedGoals : [],
      goalCompletions: completions,
      workoutTemplates: Array.isArray(parsed.workoutTemplates) ? parsed.workoutTemplates : [],
      skillTests: Array.isArray(parsed.skillTests) ? parsed.skillTests : [],
      skillTestTargets: parsed.skillTestTargets && typeof parsed.skillTestTargets === 'object' && !Array.isArray(parsed.skillTestTargets)
        ? Object.fromEntries(Object.entries(parsed.skillTestTargets).filter(([key, value]) => key.length <= 100 && !['__proto__', 'constructor', 'prototype'].includes(key) && typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100000).slice(0, 100))
        : {},
      gpsActivities: Array.isArray(parsed.gpsActivities) ? parsed.gpsActivities : [],
      weeklyPlan: Array.isArray(parsed.weeklyPlan) ? parsed.weeklyPlan.map((item) => ({ ...item, time: typeof item.time === 'string' ? item.time : '17:00' })) : [],
      customGoals: Array.isArray(parsed.customGoals) ? parsed.customGoals : [],
      playerCard: parsed.playerCard && typeof parsed.playerCard === 'object' ? parsed.playerCard : undefined,
      customDrills: Array.isArray(parsed.customDrills) ? parsed.customDrills : [],
      notificationPreferences,
      notificationSentKeys: Array.isArray(parsed.notificationSentKeys) ? parsed.notificationSentKeys.filter((key): key is string => typeof key === 'string').slice(-500) : [],
    };
  } catch {
    return { ...EMPTY_DATA, sessions: [], completedGoals: [], goalCompletions: {} };
  }
}

export function persistAppData(data: AppData): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}

export function saveAppData(data: AppData): void {
  if (!persistAppData(data)) console.warn('HBK Spor local save failed: browser storage quota or access denied.');
}

export function getLastBackupExportAt(): string | null {
  try {
    const value = localStorage.getItem(LAST_BACKUP_KEY);
    return value && Number.isFinite(Date.parse(value)) ? value : null;
  } catch { return null; }
}

export function clearLastBackupExportAt(): void {
  try { localStorage.removeItem(LAST_BACKUP_KEY); } catch { /* storage may be disabled */ }
}

export function getSavedAppDataBytes(): number {
  try { return new Blob([localStorage.getItem(STORAGE_KEY) ?? '']).size; }
  catch { return 0; }
}

export function exportJson(data: AppData): void {
  const exportedAt = new Date().toISOString();
  const payload = {
    app: 'hbk-spor-source-rebuild', schemaVersion: 1, exportedAt,
    counts: { sessions: data.sessions.length, gpsActivities: data.gpsActivities?.length ?? 0, skillTests: data.skillTests?.length ?? 0 },
    data,
  };
  downloadFile(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `hbk-spor-yedek-${exportedAt.slice(0, 10)}.json`);
  try { localStorage.setItem(LAST_BACKUP_KEY, exportedAt); } catch { /* reminder metadata is best-effort */ }
}

export function buildSessionsCsv(data: AppData): string {
  const header = ['Tarih', 'Tür', 'Antrenman', 'Dakika', 'XP', 'Not', 'Hareket', 'Set', 'Tekrar', 'Ağırlık (kg)', 'RPE', 'Dinlenme (sn)', 'Maç dakikası', 'Olay', 'Olay ayrıntısı', 'GPS dosyası', 'GPS mesafe (km)', 'GPS süre (sn)', 'Sesli not', 'Maç medyası'];
  const eventLabels: Record<string, string> = { goal: 'Gol', assist: 'Asist', 'yellow-card': 'Sarı kart', 'red-card': 'Kırmızı kart', substitution: 'Oyuncu değişikliği', note: 'Not' };
  const sessionRows = data.sessions.flatMap((session) => {
    const sessionFields = [session.date, session.kind, session.title, String(session.minutes), String(session.xp), session.note ?? '', '', '', '', session.voiceNoteId ? 'Cihazda (dosya dışa aktarılmadı)' : '', session.matchMediaIds?.length ? 'Cihazda (dosya dışa aktarılmadı)' : ''];
    const exerciseRows = !session.exercises?.length
      ? [[...sessionFields, '', '', '', '', '', '', '', '', '']]
      : session.exercises.flatMap((exercise) => {
        if (exercise.setDetails?.length) return exercise.setDetails.map((set, index) => [
          ...sessionFields, exercise.name, String(index + 1), String(set.reps), String(set.weightKg), String(set.rpe), String(set.restSeconds), '', '', '',
        ]);
        return [[...sessionFields, exercise.name, String(exercise.sets), String(exercise.reps), String(exercise.weightKg), String(exercise.rpe), '', '', '', '']];
      });
    const eventRows = (session.matchEvents ?? []).map((event) => [
      ...sessionFields, '', '', '', '', '', '', String(event.minute), eventLabels[event.type] ?? event.type, event.detail ?? '',
    ]);
    return [...exerciseRows, ...eventRows];
  });
  const gpsRows = (data.gpsActivities ?? []).map((activity) => [
    activity.date, 'gps', 'İçe aktarılan GPX', '', '', '', '', '', '', '', '', '', '', '', '',
    activity.fileName, String(activity.distanceKm), String(activity.durationSeconds), '', '',
  ]);
  const rows: string[][] = [header, ...sessionRows, ...gpsRows];
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';')).join('\r\n');
  return `\uFEFF${csv}`;
}

export function exportSessionsCsv(data: AppData): void {
  downloadFile(new Blob([buildSessionsCsv(data)], { type: 'text/csv;charset=utf-8' }), 'hbk-spor-antrenman.csv');
}

function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
