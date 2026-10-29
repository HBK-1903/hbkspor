import { describe, expect, it } from 'vitest';
import { getWeekComparison } from './weekly-comparison';
import type { AppData } from './types';

const base: AppData = { profile: null, sessions: [], completedGoals: [] };

describe('equivalent week-to-date comparison', () => {
  it('compares the current week with the same weekdays of the prior week', () => {
    const data: AppData = {
      ...base,
      sessions: [
        { id: 'prev', kind: 'gym', title: 'Gym', date: '2026-10-20', minutes: 50, xp: 40 },
        { id: 'current', kind: 'pitch', title: 'Saha', date: '2026-10-27', minutes: 45, xp: 40 },
        { id: 'rest', kind: 'rest', title: 'Dinlenme', date: '2026-10-28', minutes: 0, xp: 10 },
      ],
      gpsActivities: [{ id: 'g', fileName: 'run.gpx', date: '2026-10-21', distanceKm: 4.1, durationSeconds: 0, route: [] }],
    };
    const result = getWeekComparison(data, new Date(2026, 9, 28, 12));
    expect(result.currentStart).toBe('2026-10-26');
    expect(result.previousEnd).toBe('2026-10-21');
    expect(result.current.sessions).toBe(1);
    expect(result.current.minutes).toBe(45);
    expect(result.previous.gpsKm).toBe(4.1);
  });

  it('keeps demo fixture metrics out of both comparison periods', () => {
    const data: AppData = { ...base, demoMode: true, sessions: [{ id: 'demo', kind: 'pitch', title: 'Demo', date: '2026-10-28', minutes: 120, xp: 40 }] };
    const result = getWeekComparison(data, new Date(2026, 9, 28, 12));
    expect(Object.values(result.current).every((value) => value === 0)).toBe(true);
  });
});
