import type { AppData } from './types';
import { getWeekStartKey, localDateKey, shiftLocalDate } from './training';
import type { ScheduledNotice } from './notification-schedule';

export interface PushScheduleEntry extends ScheduledNotice { scheduledAt: number; }
const MAX_SCHEDULE_DAYS = 90;

function atLocalTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

export function buildPushSchedule(data: AppData, now = new Date()): PushScheduleEntry[] {
  const preferences = data.notificationPreferences;
  if (!preferences?.enabled || data.demoMode) return [];
  const sent = new Set(data.notificationSentKeys ?? []);
  const startDay = localDateKey(now);
  const endDay = shiftLocalDate(startDay, MAX_SCHEDULE_DAYS);
  const entries: PushScheduleEntry[] = [];
  const add = (notice: ScheduledNotice, at: Date) => {
    if (at.getTime() <= now.getTime() || sent.has(notice.key) || !Number.isFinite(at.getTime())) return;
    entries.push({ ...notice, scheduledAt: at.getTime() });
  };

  if (preferences.planReminders) {
    for (const item of data.weeklyPlan ?? []) {
      if (item.completedSessionId || item.date < startDay || item.date > endDay) continue;
      const start = atLocalTime(item.date, item.time || '17:00');
      start.setMinutes(start.getMinutes() - preferences.leadMinutes);
      add({ key: `plan:${item.id}:${item.date}:${item.time || '17:00'}:${preferences.leadMinutes}`, title: 'Planlı çalışman yaklaşıyor', body: `${item.title} · ${item.minutes} dk için hazırlanmaya başlayabilirsin.` }, start);
    }
  }

  const plannedDays = new Set((data.weeklyPlan ?? []).filter((item) => !item.completedSessionId).map((item) => item.date));
  const activeDays = new Set(data.sessions.filter((session) => session.kind !== 'rest').map((session) => session.date));
  for (let offset = 0; offset < MAX_SCHEDULE_DAYS; offset++) {
    const date = shiftLocalDate(startDay, offset);
    const localDay = atLocalTime(date, '12:00').getDay();
    if (preferences.dailyReminder && !plannedDays.has(date) && !activeDays.has(date)) {
      add({ key: `daily:${date}`, title: 'HBK Spor günlük hatırlatma', body: 'Bugün için antrenman kaydın yok. Planına göz at veya dinlenme gününü kaydet.' }, atLocalTime(date, preferences.dailyTime));
    }
    if (preferences.weeklySummary && localDay === 0) {
      const weekStart = getWeekStartKey(atLocalTime(date, '12:00'));
      const sessions = data.sessions.filter((session) => session.kind !== 'rest' && session.date >= weekStart && session.date <= date);
      const gpsKm = (data.gpsActivities ?? []).filter((activity) => activity.date >= weekStart && activity.date <= date).reduce((sum, activity) => sum + activity.distanceKm, 0);
      add({ key: `weekly:${weekStart}`, title: 'Haftalık HBK Spor özeti', body: `${sessions.length} aktif seans kaydettin · GPS rotaları ayrı: ${gpsKm.toFixed(1)} km.` }, atLocalTime(date, preferences.dailyTime));
    }
  }

  return entries.sort((a, b) => a.scheduledAt - b.scheduledAt).slice(0, 250);
}
