import { describe, expect, it } from 'vitest';
import { getAchievements } from './achievements';
import type { AppData, TrainingSession } from './types';

const base: AppData = { profile: { name: 'Ada', position: 'Orta saha', dominantFoot: 'Sağ', createdAt: '2026-01-01' }, sessions: [], completedGoals: [] };
const session = (kind: TrainingSession['kind'], date: string, minutes = 45): TrainingSession => ({ id: `${kind}-${date}`, kind, title: kind, date, minutes, xp: 1 });

 describe('getAchievements', () => {
  it('unlocks milestones only from matching saved records', () => {
    const data: AppData = {
      ...base,
      sessions: [session('gym', '2026-10-27'), session('pitch', '2026-10-28'), session('match', '2026-10-29')],
      skillTests: [{ id: 'test-1', testId: 'sprint', name: 'Sprint', category: 'Hız', unit: 'sn', lowerIsBetter: true, value: 3.4, date: '2026-10-29' }],
      gpsActivities: [{ id: 'gps-1', fileName: 'run.gpx', date: '2026-10-29', distanceKm: 5.2, durationSeconds: 900, route: [] }],
    };
    const results = getAchievements(data);
    expect(results.find((item) => item.id === 'first-session')?.value).toBe(1);
    expect(results.find((item) => item.id === 'three-disciplines')?.value).toBe(3);
    expect(results.find((item) => item.id === 'three-day-streak')?.value).toBe(3);
    expect(results.find((item) => item.id === 'gps-five-km')?.value).toBe(5);
    expect(results.find((item) => item.id === 'test-tracker')?.value).toBe(1);
  });

  it('does not treat demo fixture sessions or demo GPS as personal progress', () => {
    const data: AppData = { ...base, demoMode: true, sessions: [session('pitch', '2026-10-29', 600)], gpsActivities: [{ id: 'g', fileName: 'demo.gpx', date: '2026-10-29', distanceKm: 20, durationSeconds: 0, route: [] }] };
    const results = getAchievements(data);
    expect(results.every((item) => item.value === 0)).toBe(true);
  });

  it('excludes rest-only records from activity streaks and training minutes', () => {
    const data: AppData = { ...base, sessions: [session('rest', '2026-10-28', 600), session('pitch', '2026-10-29', 30)] };
    const results = getAchievements(data);
    expect(results.find((item) => item.id === 'ten-hours')?.value).toBe(30);
    expect(results.find((item) => item.id === 'three-day-streak')?.value).toBe(1);
  });
});
