import type { AppData } from './types';
import { getWeekStartKey, localDateKey, shiftLocalDate } from './training';

export interface WeekMetrics {
  sessions: number;
  minutes: number;
  gpsKm: number;
  tests: number;
}

export interface WeekComparison {
  current: WeekMetrics;
  previous: WeekMetrics;
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
}

export function getWeekComparison(data: AppData, today = new Date()): WeekComparison {
  const todayKey = localDateKey(today);
  const currentStart = getWeekStartKey(today);
  const previousStart = shiftLocalDate(currentStart, -7);
  const previousEnd = shiftLocalDate(todayKey, -7);
  const summarize = (start: string, end: string): WeekMetrics => {
    if (data.demoMode) return { sessions: 0, minutes: 0, gpsKm: 0, tests: 0 };
    const sessions = data.sessions.filter((session) => session.kind !== 'rest' && session.date >= start && session.date <= end);
    return {
      sessions: sessions.length,
      minutes: sessions.reduce((sum, session) => sum + session.minutes, 0),
      gpsKm: (data.gpsActivities ?? []).filter((activity) => activity.date >= start && activity.date <= end).reduce((sum, activity) => sum + activity.distanceKm, 0),
      tests: (data.skillTests ?? []).filter((record) => record.date >= start && record.date <= end).length,
    };
  };
  return {
    current: summarize(currentStart, todayKey),
    previous: summarize(previousStart, previousEnd),
    currentStart, currentEnd: todayKey, previousStart, previousEnd,
  };
}
