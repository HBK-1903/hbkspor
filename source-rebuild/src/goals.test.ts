import { describe, expect, it } from 'vitest';
import { getCustomGoalProgress } from './goals';
import type { AppData, CustomGoal } from './types';

const base: AppData = { profile: null, sessions: [], completedGoals: [] };
const goal = (metric: CustomGoal['metric'], period: CustomGoal['period'] = 'all'): CustomGoal => ({ id: 'goal', title: 'Test hedefi', metric, period, target: 3, createdAt: '2026-10-01' });

describe('custom goal progress', () => {
  it('counts only saved active sessions in the selected period', () => {
    const data: AppData = { ...base, sessions: [
      { id: 'old', kind: 'gym', title: 'Eski', minutes: 30, xp: 1, date: '2026-10-10' },
      { id: 'current', kind: 'pitch', title: 'Saha', minutes: 45, xp: 1, date: '2026-10-29' },
      { id: 'rest', kind: 'rest', title: 'Dinlenme', minutes: 0, xp: 1, date: '2026-10-29' },
    ] };
    expect(getCustomGoalProgress(goal('sessions', 'week'), data, new Date(2026, 9, 29, 12))).toBe(1);
    expect(getCustomGoalProgress(goal('minutes', 'all'), data, new Date(2026, 9, 29, 12))).toBe(75);
  });

  it('does not award progress for demo data and uses user-imported GPS separately', () => {
    const data: AppData = { ...base, gpsActivities: [{ id: 'gps', fileName: 'run.gpx', date: '2026-10-29', distanceKm: 4.2, durationSeconds: 900, route: [] }] };
    expect(getCustomGoalProgress(goal('gpsKm'), data, new Date(2026, 9, 29, 12))).toBe(4.2);
    expect(getCustomGoalProgress(goal('gpsKm'), { ...data, demoMode: true }, new Date(2026, 9, 29, 12))).toBe(0);
  });
});
