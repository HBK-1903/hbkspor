import { describe, expect, it } from 'vitest';
import { getDueNotifications } from './notification-schedule';
import type { AppData } from './types';

const base: AppData = { profile: null, sessions: [], completedGoals: [], notificationPreferences: { enabled: true, planReminders: true, leadMinutes: 30, dailyReminder: false, dailyTime: '18:00', weeklySummary: false } };

describe('local reminder schedule', () => {
  it('reminds once before an uncompleted planned session', () => {
    const data: AppData = { ...base, weeklyPlan: [{ id: 'p', date: '2026-10-29', time: '18:00', kind: 'pitch', title: 'Pas çalışması', minutes: 30 }] };
    const now = new Date(2026, 9, 29, 17, 35);
    expect(getDueNotifications(data, now)).toHaveLength(1);
    const notice = getDueNotifications(data, now)[0];
    expect(getDueNotifications({ ...data, notificationSentKeys: [notice.key] }, now)).toHaveLength(0);
  });

  it('sends an optional daily nudge only if there is no session or plan today', () => {
    const data: AppData = { ...base, notificationPreferences: { ...base.notificationPreferences!, dailyReminder: true }, weeklyPlan: [] };
    expect(getDueNotifications(data, new Date(2026, 9, 29, 18, 5))[0]?.key).toBe('daily:2026-10-29');
    expect(getDueNotifications({ ...data, sessions: [{ id: 's', kind: 'gym', title: 'Gym', date: '2026-10-29', minutes: 45, xp: 40 }] }, new Date(2026, 9, 29, 18, 5))).toHaveLength(0);
  });

  it('excludes demo metrics and creates a Sunday recap without a performance score', () => {
    const sunday = new Date(2026, 10, 1, 18, 5);
    const data: AppData = { ...base, notificationPreferences: { ...base.notificationPreferences!, weeklySummary: true }, sessions: [{ id: 's', kind: 'pitch', title: 'Saha', date: '2026-10-29', minutes: 60, xp: 40 }] };
    expect(getDueNotifications(data, sunday)[0]?.body).toContain('1 aktif seans');
    expect(getDueNotifications({ ...data, demoMode: true }, sunday)).toHaveLength(0);
  });
});
