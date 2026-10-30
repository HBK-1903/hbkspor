import type { WeeklyPlanItem } from './types';

const KIND_LABELS: Record<WeeklyPlanItem['kind'], string> = {
  gym: 'Gym', pitch: 'Saha', match: 'Maç', gps: 'GPS koşusu', timer: 'Tempo çalışması', recovery: 'Toparlanma', rest: 'Dinlenme',
};
const encoder = new TextEncoder();

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

/** Fold by UTF-8 octets (RFC 5545), never splitting a multibyte character. */
export function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const characterBytes = encoder.encode(character).length;
    if (bytes + characterBytes > 75 && current) {
      parts.push(current);
      current = ` ${character}`;
      bytes = 1 + characterBytes;
    } else {
      current += character;
      bytes += characterBytes;
    }
  }
  parts.push(current);
  return parts.join('\r\n');
}

function localDateTime(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00`);
  if (!Number.isFinite(parsed.getTime()) || `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}` !== date) return null;
  const [year, month, day] = date.split('-');
  const [hour, minute] = time.split(':');
  return `${year}${month}${day}T${hour}${minute}00`;
}

export function buildPlanCalendar(items: readonly WeeklyPlanItem[], exportedAt = new Date()): string {
  const stamp = exportedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HBK Spor//Weekly Training Plan//TR',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:HBK Spor Antrenman Planı',
  ];
  for (const item of items) {
    const start = localDateTime(item.date, item.time);
    if (!start || !Number.isFinite(item.minutes) || item.minutes < 0 || item.minutes > 600) continue;
    const startDate = new Date(`${item.date}T${item.time}:00`);
    if (!Number.isFinite(startDate.getTime())) continue;
    const endDate = new Date(startDate.getTime() + Math.round(item.minutes) * 60_000);
    const end = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}T${String(endDate.getHours()).padStart(2, '0')}${String(endDate.getMinutes()).padStart(2, '0')}00`;
    const description = `${KIND_LABELS[item.kind]} · ${item.minutes} dakika${item.completedSessionId ? ' · tamamlandı' : ''}`;
    lines.push(
      'BEGIN:VEVENT', `UID:${escapeIcsText(item.id)}@hbkspor.local`, `DTSTAMP:${stamp}`,
      `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${escapeIcsText(item.title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`, 'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

export function downloadPlanCalendar(items: readonly WeeklyPlanItem[], exportedAt = new Date()): boolean {
  const eventCount = items.filter((item) => localDateTime(item.date, item.time) && Number.isFinite(item.minutes) && item.minutes >= 0 && item.minutes <= 600).length;
  if (!eventCount) return false;
  const content = buildPlanCalendar(items, exportedAt);
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `hbk-spor-plan-${exportedAt.toISOString().slice(0, 10)}.ics`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}
