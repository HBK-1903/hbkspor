import { describe, expect, it } from 'vitest';
import { buildPlanCalendar, foldIcsLine } from './calendar-export';
import type { WeeklyPlanItem } from './types';

const item: WeeklyPlanItem = {
  id: 'plan-1', date: '2026-11-02', time: '17:30', kind: 'pitch', title: 'Sprint, tempo; koşu', minutes: 45,
};

describe('calendar export', () => {
  it('writes local floating-time events with escaped content and calculated end times', () => {
    const output = buildPlanCalendar([item], new Date('2026-10-30T12:00:00Z'));
    expect(output).toContain('DTSTART:20261102T173000');
    expect(output).toContain('DTEND:20261102T181500');
    expect(output).toContain('SUMMARY:Sprint\\, tempo\\; koşu');
    expect(output).toContain('DESCRIPTION:Saha · 45 dakika');
    expect(output.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('folds long Unicode lines at no more than 75 UTF-8 bytes per physical line', () => {
    const folded = foldIcsLine(`SUMMARY:${'Çalışma '.repeat(20)}`);
    expect(folded.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(folded.split('\r\n').slice(1).every((line) => line.startsWith(' '))).toBe(true);
  });

  it('skips malformed date and time rows instead of emitting invalid events', () => {
    const output = buildPlanCalendar([
      item,
      { ...item, id: 'bad-date', date: '2026-02-31' },
      { ...item, id: 'bad-time', time: '25:00' },
    ]);
    expect(output.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(output).not.toContain('bad-date');
    expect(output).not.toContain('bad-time');
  });
});
