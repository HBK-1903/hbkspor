import { describe, expect, it } from 'vitest';
import { expandWeeklyPlan } from './weekly-plan';

const draft = { date: '2026-12-30', time: '17:30', kind: 'pitch' as const, title: 'Pas çalışması', minutes: 45 };

describe('recurring weekly plan', () => {
  it('creates weekly occurrences and groups them into one deletable series', () => {
    let next = 0;
    const items = expandWeeklyPlan({ ...draft, repeatCount: 4 }, () => `id-${++next}`);
    expect(items.map((item) => item.date)).toEqual(['2026-12-30', '2027-01-06', '2027-01-13', '2027-01-20']);
    expect(new Set(items.map((item) => item.recurrenceId))).toEqual(new Set(['id-1']));
    expect(new Set(items.map((item) => item.id))).toHaveProperty('size', 4);
    expect(items.every((item) => item.time === draft.time && item.title === draft.title)).toBe(true);
  });

  it('keeps a one-time plan outside a recurrence series', () => {
    const item = expandWeeklyPlan({ ...draft, repeatCount: 1 }, () => 'one')[0];
    expect(item.date).toBe(draft.date);
    expect(item.recurrenceId).toBeUndefined();
  });
});
