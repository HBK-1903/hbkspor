import type { AppData, CustomGoal } from './types';
import { getWeekStartKey, localDateKey } from './training';

export function getCustomGoalProgress(goal: CustomGoal, data: AppData, today = new Date()): number {
  if (data.demoMode) return 0;
  const todayKey = localDateKey(today);
  let periodStart = goal.createdAt;
  if (goal.period === 'week') periodStart = getWeekStartKey(today);
  if (goal.period === 'month') {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 12);
    periodStart = localDateKey(monthStart);
  }
  const start = periodStart > goal.createdAt ? periodStart : goal.createdAt;
  switch (goal.metric) {
    case 'sessions': return data.sessions.filter((session) => session.kind !== 'rest' && session.date >= start && session.date <= todayKey).length;
    case 'minutes': return data.sessions.filter((session) => session.kind !== 'rest' && session.date >= start && session.date <= todayKey).reduce((sum, session) => sum + session.minutes, 0);
    case 'gpsKm': return (data.gpsActivities ?? []).filter((activity) => activity.date >= start && activity.date <= todayKey).reduce((sum, activity) => sum + activity.distanceKm, 0);
    case 'tests': return (data.skillTests ?? []).filter((record) => record.date >= start && record.date <= todayKey).length;
  }
}

export const GOAL_METRIC_LABELS = { sessions: 'seans', minutes: 'dakika', gpsKm: 'km GPS', tests: 'test sonucu' } as const;
export const GOAL_PERIOD_LABELS = { week: 'bu hafta', month: 'bu ay', all: 'toplam' } as const;
