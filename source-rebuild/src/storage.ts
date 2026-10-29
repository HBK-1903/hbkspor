import type { AppData } from './types';

const STORAGE_KEY = 'hbk_spor_rebuild_v1';

const EMPTY_DATA: AppData = { profile: null, sessions: [], completedGoals: [], goalCompletions: {}, workoutTemplates: [], skillTests: [] };

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_DATA, sessions: [], completedGoals: [], goalCompletions: {} };
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const completions = parsed.goalCompletions && typeof parsed.goalCompletions === 'object'
      ? Object.fromEntries(Object.entries(parsed.goalCompletions).filter(([, ids]) => Array.isArray(ids))) as Record<string, string[]>
      : {};
    return {
      profile: parsed.profile ?? null,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      // Retained for compatibility with earlier reconstruction data. Current
      // daily check-offs live in goalCompletions, keyed by local date.
      completedGoals: Array.isArray(parsed.completedGoals) ? parsed.completedGoals : [],
      goalCompletions: completions,
      workoutTemplates: Array.isArray(parsed.workoutTemplates) ? parsed.workoutTemplates : [],
      skillTests: Array.isArray(parsed.skillTests) ? parsed.skillTests : [],
    };
  } catch {
    return { ...EMPTY_DATA, sessions: [], completedGoals: [], goalCompletions: {} };
  }
}

export function saveAppData(data: AppData): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (error) { console.warn('HBK Spor local save failed:', error); }
}

export function exportJson(data: AppData): void {
  downloadFile(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `hbk-spor-yedek-${new Date().toISOString().slice(0, 10)}.json`);
}

export function exportSessionsCsv(data: AppData): void {
  const header = ['Tarih', 'Tür', 'Antrenman', 'Dakika', 'XP', 'Not', 'Hareket', 'Set', 'Tekrar', 'Ağırlık (kg)', 'RPE', 'Dinlenme (sn)', 'Maç dakikası', 'Olay', 'Olay ayrıntısı'];
  const eventLabels: Record<string, string> = { goal: 'Gol', assist: 'Asist', 'yellow-card': 'Sarı kart', 'red-card': 'Kırmızı kart', substitution: 'Oyuncu değişikliği', note: 'Not' };
  const rows: string[][] = [header, ...data.sessions.flatMap((session) => {
    const sessionFields = [session.date, session.kind, session.title, String(session.minutes), String(session.xp), session.note ?? ''];
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
  })];
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';')).join('\r\n');
  downloadFile(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), 'hbk-spor-antrenman.csv');
}

function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
