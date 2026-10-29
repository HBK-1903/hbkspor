import type { WeeklyPlanItem } from './types';
import { shiftLocalDate } from './training';

export type RepeatCount = 1 | 4 | 8 | 12;
export type WeeklyPlanDraft = Omit<WeeklyPlanItem, 'id' | 'recurrenceId' | 'completedSessionId'> & { repeatCount: RepeatCount };

export function expandWeeklyPlan(draft: WeeklyPlanDraft, createId: () => string = () => crypto.randomUUID()): WeeklyPlanItem[] {
  const { repeatCount, ...plan } = draft;
  const seriesId = repeatCount > 1 ? createId() : undefined;
  return Array.from({ length: repeatCount }, (_, index) => ({
    ...plan,
    date: shiftLocalDate(plan.date, index * 7),
    id: createId(),
    ...(seriesId ? { recurrenceId: seriesId } : {}),
  }));
}
