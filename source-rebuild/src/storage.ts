import type { AppData } from './types';

const STORAGE_KEY = 'hbk_spor_rebuild_v1';

const EMPTY_DATA: AppData = { profile: null, sessions: [], completedGoals: [] };

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DATA;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      profile: parsed.profile ?? null,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      completedGoals: Array.isArray(parsed.completedGoals) ? parsed.completedGoals : [],
    };
  } catch {
    return EMPTY_DATA;
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
  const rows = [['Tarih', 'Tür', 'Antrenman', 'Dakika', 'XP', 'Not'], ...data.sessions.map((s) => [s.date, s.kind, s.title, String(s.minutes), String(s.xp), s.note ?? ''])];
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';')).join('\r\n');
  downloadFile(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), 'hbk-spor-antrenman.csv');
}

function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
