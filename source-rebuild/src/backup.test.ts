import { describe, expect, it } from 'vitest';
import { mergeAppData, validateAppBackup } from './backup';
import type { AppData } from './types';

const session = { id: 'session-1', kind: 'gym', title: 'Kuvvet', minutes: 45, xp: 25, date: '2026-10-29' } as const;
const profile = { name: 'Oyuncu', position: 'Orta saha', dominantFoot: 'Sağ', createdAt: '2026-10-01' } as const;
const data: AppData = { profile, sessions: [session], completedGoals: [], goalCompletions: {}, skillTestTargets: { 'sprint-20m': 3.2 }, weeklyPlan: [] };

describe('validated application backups', () => {
  it('validates a versioned backup envelope and accepts a legacy flat export', () => {
    const envelope = validateAppBackup(JSON.stringify({ app: 'hbk-spor-source-rebuild', schemaVersion: 1, exportedAt: '2026-10-30T12:00:00.000Z', data }));
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.data.sessions).toEqual([session]);
    expect(envelope.data.skillTestTargets).toEqual({ 'sprint-20m': 3.2 });
    expect(validateAppBackup(JSON.stringify(data)).schemaVersion).toBe('legacy');
  });

  it('rejects wrong app/version, malformed roots and invalid JSON before storage writes', () => {
    expect(() => validateAppBackup('{')).toThrow('JSON');
    expect(() => validateAppBackup(JSON.stringify({ app: 'other', schemaVersion: 1, data }))).toThrow('ait değil');
    expect(() => validateAppBackup(JSON.stringify({ app: 'hbk-spor-source-rebuild', schemaVersion: 99, data }))).toThrow('sürümü desteklenmiyor');
    expect(() => validateAppBackup(JSON.stringify({ profile, completedGoals: [] }))).toThrow('antrenman kayıtları');
  });

  it('reports and skips malformed records and calendar dates', () => {
    const result = validateAppBackup(JSON.stringify({
      ...data,
      sessions: [session, { ...session, title: 'duplicate ID' }, { ...session, id: '__proto__' }, { ...session, id: 'bad-date', date: '2026-02-31' }],
      workoutTemplates: [{ id: 'template-1', name: 'Gym', kind: 'gym', minutes: 45 }, null],
      gpsActivities: [{ id: 'gps-1', fileName: 'track.gpx', date: '2026-10-29', distanceKm: 3, durationSeconds: 600, route: [{ lat: 100, lon: 29 }] }],
    }));
    expect(result.data.sessions).toEqual([session]);
    expect(result.counts.sessions).toEqual({ valid: 1, total: 4, rejected: 3 });
    expect(result.counts.workoutTemplates).toEqual({ valid: 1, total: 2, rejected: 1 });
    expect(result.data.gpsActivities).toEqual([]);
    expect(result.invalidFields).toContain('gpsActivities');
  });

  it('rejects prototype-mutating object keys in keyed backup data', () => {
    const result = validateAppBackup('{"sessions":[],"completedGoals":[],"skillTestTargets":{"__proto__":2,"safe":3}}');
    expect(result.data.skillTestTargets).toEqual({ safe: 3 });
  });

  it('merges collections by stable ID, unions daily check-offs, and keeps local profile/preferences', () => {
    const current: AppData = {
      ...data,
      sessions: [session],
      profile,
      goalCompletions: { '2026-10-29': ['water'] },
      notificationPreferences: { enabled: false, planReminders: true, leadMinutes: 30, dailyReminder: false, dailyTime: '18:00', weeklySummary: false },
    };
    const incoming: AppData = {
      ...data,
      profile: { ...profile, name: 'Yedek profil' },
      sessions: [{ ...session, title: 'Yedekten güncel' }, { ...session, id: 'session-2', title: 'Saha', kind: 'pitch' }],
      goalCompletions: { '2026-10-29': ['water', 'mobility'] },
      skillTestTargets: { 'sprint-20m': 3.1 },
      notificationPreferences: { enabled: true, planReminders: true, leadMinutes: 15, dailyReminder: false, dailyTime: '19:00', weeklySummary: false },
    };
    const merged = mergeAppData(current, incoming);
    expect(merged.sessions).toHaveLength(2);
    expect(merged.sessions.find((item) => item.id === 'session-1')?.title).toBe('Yedekten güncel');
    expect(merged.profile?.name).toBe('Oyuncu');
    expect(merged.goalCompletions?.['2026-10-29']).toEqual(['water', 'mobility']);
    expect(merged.skillTestTargets?.['sprint-20m']).toBe(3.1);
    expect(merged.notificationPreferences?.enabled).toBe(true);
    expect(merged.notificationPreferences?.leadMinutes).toBe(15);
  });
});
