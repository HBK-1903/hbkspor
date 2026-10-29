import type { AppData, NotificationPreferences } from './types';
import { getWeekStartKey, localDateKey } from './training';

export interface ScheduledNotice { key: string; title: string; body: string; }
const DELIVERY_WINDOW_MS = 30 * 60 * 1000;

function targetToday(time: string, now: Date): Date {
  const target = new Date(now);
  const [hour, minute] = time.split(':').map(Number);
  target.setHours(hour, minute, 0, 0);
  return target;
}

function isDue(target: Date, now: Date): boolean {
  const elapsed = now.getTime() - target.getTime();
  return elapsed >= 0 && elapsed < DELIVERY_WINDOW_MS;
}

export function getDueNotifications(data: AppData, now = new Date()): ScheduledNotice[] {
  const preferences: NotificationPreferences = data.notificationPreferences ?? { enabled: false, planReminders: true, leadMinutes: 30, dailyReminder: false, dailyTime: '18:00', weeklySummary: false };
  if (!preferences.enabled || data.demoMode) return [];
  const sent = new Set(data.notificationSentKeys ?? []);
  const today = localDateKey(now);
  const notices: ScheduledNotice[] = [];

  if (preferences.planReminders) {
    for (const item of data.weeklyPlan ?? []) {
      if (item.completedSessionId || item.date !== today) continue;
      const key = `plan:${item.id}:${item.date}:${item.time ?? '17:00'}:${preferences.leadMinutes}`;
      if (sent.has(key)) continue;
      const start = new Date(`${item.date}T${item.time ?? '17:00'}:00`);
      start.setMinutes(start.getMinutes() - preferences.leadMinutes);
      if (isDue(start, now)) notices.push({ key, title: 'Planlı çalışman yaklaşıyor', body: `${item.title} · ${item.minutes} dk için hazırlanmaya başlayabilirsin.` });
    }
  }

  const activeToday = data.sessions.some((session) => session.kind !== 'rest' && session.date === today);
  const plannedToday = (data.weeklyPlan ?? []).some((item) => item.date === today && !item.completedSessionId);
  if (preferences.dailyReminder && !activeToday && !plannedToday) {
    const key = `daily:${today}`;
    if (!sent.has(key) && isDue(targetToday(preferences.dailyTime, now), now)) notices.push({ key, title: 'HBK Spor günlük hatırlatma', body: 'Bugün için antrenman kaydın yok. Planına göz at veya dinlenme gününü kaydet.' });
  }

  if (preferences.weeklySummary && now.getDay() === 0) {
    const weekStart = getWeekStartKey(now);
    const key = `weekly:${weekStart}`;
    if (!sent.has(key) && isDue(targetToday(preferences.dailyTime, now), now)) {
      const sessions = data.sessions.filter((session) => session.kind !== 'rest' && session.date >= weekStart && session.date <= today);
      const gpsKm = (data.gpsActivities ?? []).filter((activity) => activity.date >= weekStart && activity.date <= today).reduce((sum, item) => sum + item.distanceKm, 0);
      notices.push({ key, title: 'Haftalık HBK Spor özeti', body: `${sessions.length} aktif seans kaydettin · GPS rotaları ayrı: ${gpsKm.toFixed(1)} km.` });
    }
  }

  return notices;
}
