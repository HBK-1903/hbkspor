import { describe, expect, it } from 'vitest';
import { buildPushSchedule } from './push-schedule';
import type { AppData } from './types';

const now = new Date(2026, 10, 29, 10, 0);
const prefs = { enabled: true, planReminders: true, leadMinutes: 30 as const, dailyReminder: true, dailyTime: '18:00', weeklySummary: true };
const base: AppData = { profile: null, sessions: [], completedGoals: [], notificationPreferences: prefs };

describe('closed-app push schedule generation', () => {
  it('queues future recurring plan occurrences and optional nudges', () => {
    const data: AppData = { ...base, weeklyPlan: [
      { id: 'p1', recurrenceId: 'series', date: '2026-11-30', time: '17:00', kind: 'pitch', title: 'Teknik', minutes: 45 },
      { id: 'p2', recurrenceId: 'series', date: '2026-12-07', time: '17:00', kind: 'pitch', title: 'Teknik', minutes: 45 },
    ] };
    const schedule = buildPushSchedule(data, now);
    expect(schedule.some((item) => item.key.startsWith('plan:p1:'))).toBe(true);
    expect(schedule.some((item) => item.key.startsWith('plan:p2:'))).toBe(true);
    expect(schedule.some((item) => item.key === 'daily:2026-11-30')).toBe(false); // planned day
    expect(schedule.find((item) => item.key.startsWith('plan:p1:'))?.scheduledAt).toBe(new Date(2026, 10, 30, 16, 30).getTime());
  });

  it('omits completed, already-sent, and demo notifications', () => {
    const data: AppData = { ...base, weeklyPlan: [{ id: 'done', date: '2026-11-30', time: '11:00', kind: 'gym', title: 'Gym', minutes: 30, completedSessionId: 's' }] };
    expect(buildPushSchedule({ ...data, demoMode: true }, now)).toEqual([]);
    expect(buildPushSchedule({ ...data, notificationSentKeys: ['plan:done:2026-11-30:11:00:30'] }, now).some((item) => item.key.includes('plan:done'))).toBe(false);
  });
});
