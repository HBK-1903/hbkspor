import type { AppData, TrainingSession } from './types';
import { localDateKey, shiftLocalDate } from './training';

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  detail: string;
  value: number;
  target: number;
  unit: string;
}

function currentStreak(sessions: TrainingSession[], today: Date): number {
  const activeDates = new Set(sessions.filter((session) => session.kind !== 'rest').map((session) => session.date));
  const todayKey = localDateKey(today);
  let date = activeDates.has(todayKey) ? todayKey : shiftLocalDate(todayKey, -1);
  let streak = 0;
  while (activeDates.has(date)) {
    streak += 1;
    date = shiftLocalDate(date, -1);
  }
  return streak;
}

/** Achievement inputs are real local records only; a demo profile intentionally produces no claims. */
export function getAchievements(data: AppData, today = new Date()): Achievement[] {
  const sessions = data.demoMode ? [] : data.sessions.filter((session) => session.kind !== 'rest');
  const activeDates = new Set(sessions.map((session) => session.date));
  const kinds = new Set(sessions.map((session) => session.kind));
  const recordedMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
  const testCount = data.demoMode ? 0 : (data.skillTests ?? []).length;
  const gpsDistance = data.demoMode ? 0 : (data.gpsActivities ?? []).reduce((sum, activity) => sum + activity.distanceKm, 0);

  return [
    { id: 'first-session', icon: '⚽', title: 'İlk adım', detail: 'İlk antrenman veya maç kaydını tamamla.', value: Math.min(1, sessions.length), target: 1, unit: 'kayıt' },
    { id: 'five-days', icon: '🗓️', title: 'Ritim kurucu', detail: 'Farklı beş günde aktif çalışma kaydet.', value: Math.min(5, activeDates.size), target: 5, unit: 'gün' },
    { id: 'three-day-streak', icon: '🔥', title: 'Üç günlük seri', detail: 'En az üç gün üst üste kayıt oluştur.', value: Math.min(3, currentStreak(sessions, today)), target: 3, unit: 'gün' },
    { id: 'three-disciplines', icon: '🎽', title: 'Çok yönlü', detail: 'Gym, saha ve maç kayıtlarının üçünü de ekle.', value: ['gym', 'pitch', 'match'].filter((kind) => kinds.has(kind as TrainingSession['kind'])).length, target: 3, unit: 'branş' },
    { id: 'ten-hours', icon: '⏱️', title: '10 saatlik emek', detail: 'Dinlenme kayıtları hariç toplam 10 saat kaydet.', value: Math.min(600, recordedMinutes), target: 600, unit: 'dk' },
    { id: 'gps-five-km', icon: '⌁', title: 'İlk 5 kilometre', detail: 'İçe aktardığın GPS rotalarında toplam 5 km biriktir.', value: Math.min(5, gpsDistance), target: 5, unit: 'km' },
    { id: 'test-tracker', icon: '📈', title: 'Test takipçisi', detail: 'Üç performans testi sonucu kaydet.', value: Math.min(3, testCount), target: 3, unit: 'sonuç' },
  ];
}
