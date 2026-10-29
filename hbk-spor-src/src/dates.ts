const pad = (value: number) => String(value).padStart(2, '0');

export function localDayKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addLocalDays(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDayKey(date);
}

export function currentWeekStart(date = new Date()): string {
  return addLocalDays(localDayKey(date), -((date.getDay() + 6) % 7));
}

export function formatDay(key: string): string {
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(new Date(`${key}T12:00:00`));
}
