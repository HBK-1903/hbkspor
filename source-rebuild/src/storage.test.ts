import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSessionsCsv, loadAppData } from './storage';
import type { AppData } from './types';

afterEach(() => vi.unstubAllGlobals());

const data: AppData = {
  profile: null,
  sessions: [{ id: 'm1', kind: 'match', title: 'Maç', minutes: 90, xp: 50, date: '2026-10-29', voiceNoteId: 'audio-1', matchMediaIds: ['photo-1'], matchEvents: [{ id: 'e1', minute: 12, type: 'goal', detail: 'Deniz' }] }],
  completedGoals: [],
  gpsActivities: [{ id: 'g1', fileName: 'training.gpx', date: '2026-10-28', distanceKm: 3.5, durationSeconds: 900, route: [] }],
};

describe('local data migration', () => {
  it('marks the earlier seeded demo fixture so achievement summaries can exclude it', () => {
    const legacy = { profile: { name: 'Yıldız', position: 'Kanat', dominantFoot: 'Sağ', createdAt: '2026-10-29' }, sessions: [{ id: 'demo', kind: 'pitch', title: 'İlk saha çalışmam', minutes: 35, xp: 40, date: '2026-10-29', note: 'Demo antrenmanı' }], completedGoals: [] };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(legacy) });
    expect(loadAppData().demoMode).toBe(true);
  });
});

describe('CSV backup rows', () => {
  it('exports GPS route summaries alongside match events in a consistent column shape', () => {
    const csv = buildSessionsCsv(data).replace(/^\uFEFF/, '');
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.split(';').length === 20)).toBe(true);
    expect(rows[1]).toContain('"Cihazda (dosya dışa aktarılmadı)";"Cihazda (dosya dışa aktarılmadı)"');
    expect(rows[1]).toContain('"Cihazda (dosya dışa aktarılmadı)"');
    expect(rows[2]).toContain('"12";"Gol";"Deniz"');
    expect(rows[3]).toContain('"training.gpx";"3.5";"900"');
  });
});
